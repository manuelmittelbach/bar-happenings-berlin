"""
Helper for the recurring-verify workflow (read-only).

Two modes:

  list    Fetch all recurring series roots from `events` and print them as a
          JSON array on stdout, each annotated with a human-readable cadence
          description (e.g. "every Tuesday", "2nd Thursday of each month").
          The orchestrator reads this to know what each sub-agent should look
          for on the venue page.

  report  Read a JSON array of verdicts (one per series) and write a Markdown
          report to /tmp/recurring_verify_report.md, grouped by verdict, with
          a summary line. NEVER writes to the database — the admin decides what
          to do with each flagged series in the dashboard.

Usage:
    python3 scripts/verify_recurring_helper.py list
    python3 scripts/verify_recurring_helper.py list --out /tmp/recurring_roots.json
    python3 scripts/verify_recurring_helper.py report /tmp/recurring_verify_results.json
    cat results.json | python3 scripts/verify_recurring_helper.py report -

A series "root" is a row in `events` with an empty/NULL `parent_id` and a
non-empty `recurrence` rule. Its materialized child occurrences (parent_id set,
recurrence empty) are NOT checked — verifying the root is enough, since the
pg_cron `extend_recurring_series` job derives all children from the root.
"""

import argparse
import json
import math
import os
import sys
from datetime import date
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

REPORT_PATH = "/tmp/recurring_verify_report.md"

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
ORDINAL_NAMES = ["", "1st", "2nd", "3rd", "4th", "5th"]

# Verdict vocabulary the sub-agents must use. Keep in sync with the runbook.
VERDICTS = ["confirmed", "confirmed_weak", "changed", "not_found", "unreachable"]
VERDICT_TITLES = {
    "confirmed":      "✅ Confirmed — still recurring",
    "confirmed_weak": "🟡 Confirmed (weak) — title present, cadence not restated",
    "changed":        "🔁 Changed — found, but day/cadence differs from stored rule",
    "not_found":      "❌ Not found — no longer on the page (review for removal)",
    "unreachable":    "⚠️  Unreachable — page failed to load (inconclusive, retry next run)",
}


def parse_rule(recurrence: str | None) -> tuple[str | None, str | None]:
    """Return (freq, until) from a stored recurrence string like
    'weekly;until=2026-12-31' or 'monthly_by_weekday'."""
    if not recurrence:
        return None, None
    parts = [p.strip() for p in recurrence.split(";") if p.strip()]
    if not parts:
        return None, None
    freq = parts[0]
    until = None
    for p in parts[1:]:
        if p.startswith("until="):
            until = p[len("until="):]
    return freq, until


def ordinal_of_weekday_in_month(d: date) -> int:
    return math.ceil(d.day / 7)


def describe_rule(start_iso: str, freq: str) -> str:
    """Mirror of describeRule() in src/lib/recurrence.ts — human cadence label."""
    try:
        d = date.fromisoformat(start_iso)
    except ValueError:
        return freq
    weekday = WEEKDAY_NAMES[d.weekday()]
    if freq == "weekly":
        return f"every {weekday}"
    if freq == "biweekly":
        nth = ordinal_of_weekday_in_month(d)
        return (f"1st and 3rd {weekday} of each month" if nth % 2 == 1
                else f"2nd and 4th {weekday} of each month")
    if freq == "monthly_last_weekday":
        return f"last {weekday} of each month"
    # monthly_by_weekday
    nth = ordinal_of_weekday_in_month(d)
    label = ORDINAL_NAMES[nth] if nth < len(ORDINAL_NAMES) else f"{nth}th"
    return f"{label} {weekday} of each month"


def client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in scripts/.env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def cmd_list(args):
    c = client()
    # Roots only: empty/NULL parent_id, non-empty recurrence, still live.
    rows = (
        c.table("events")
        .select("id,parent_id,title,venue,venue_id,date,recurrence,url,status")
        .eq("status", "approved")
        .order("venue")
        .order("title")
        .execute()
        .data
    ) or []

    roots: list[dict[str, Any]] = []
    for r in rows:
        rec = (r.get("recurrence") or "").strip()
        parent = (r.get("parent_id") or "") if "parent_id" in r else ""
        if not rec or parent:
            continue
        freq, until = parse_rule(rec)
        roots.append({
            "id":         r["id"],
            "title":      r.get("title"),
            "venue":      r.get("venue"),
            "venue_id":   r.get("venue_id"),
            "anchor_date": r.get("date"),
            "freq":       freq,
            "until":      until,
            "cadence":    describe_rule(r.get("date") or "", freq or ""),
            "url":        r.get("url"),
        })

    out = json.dumps(roots, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"Wrote {len(roots)} recurring series roots to {args.out}", file=sys.stderr)
    else:
        print(out)


def load_results(path: str) -> list[dict[str, Any]]:
    raw = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
    data = json.loads(raw)
    if not isinstance(data, list):
        raise SystemExit("Results input must be a JSON array of verdict objects.")
    return data


def cmd_report(args):
    results = load_results(args.path)

    buckets: dict[str, list[dict[str, Any]]] = {v: [] for v in VERDICTS}
    unknown: list[dict[str, Any]] = []
    for r in results:
        v = (r.get("verdict") or "").strip()
        if v in buckets:
            buckets[v].append(r)
        else:
            unknown.append(r)

    lines: list[str] = []
    lines.append("# Recurring Series Verification Report")
    lines.append("")
    counts = ", ".join(f"{len(buckets[v])} {v}" for v in VERDICTS)
    extra = f", {len(unknown)} unknown-verdict" if unknown else ""
    lines.append(f"**{len(results)} series checked** — {counts}{extra}.")
    lines.append("")
    lines.append("> Read-only report. No database rows were changed. Decide per "
                 "flagged series in the Admin Dashboard.")
    lines.append("")

    def fmt(r: dict[str, Any]) -> str:
        title = r.get("title") or "(untitled)"
        venue = r.get("venue") or "?"
        cadence = r.get("cadence") or r.get("freq") or "?"
        url = r.get("url") or ""
        ev = (r.get("evidence") or "").strip()
        sid = r.get("id") or ""
        head = f"- **{title}** @ {venue} — _{cadence}_"
        sub = f"\n  - id: `{sid}`\n  - url: {url}"
        if ev:
            sub += f"\n  - evidence: {ev}"
        return head + sub

    for v in VERDICTS:
        if not buckets[v]:
            continue
        lines.append(f"## {VERDICT_TITLES[v]}  ({len(buckets[v])})")
        lines.append("")
        for r in buckets[v]:
            lines.append(fmt(r))
        lines.append("")

    if unknown:
        lines.append(f"## ⁇ Unknown verdict  ({len(unknown)})")
        lines.append("")
        for r in unknown:
            lines.append(fmt(r) + f"\n  - raw verdict: `{r.get('verdict')!r}`")
        lines.append("")

    report = "\n".join(lines)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(report)

    # Compact summary to stdout for the orchestrator to relay.
    review = len(buckets["not_found"]) + len(buckets["changed"])
    print(f"Report written to {REPORT_PATH}")
    print(f"{counts}{extra}")
    print(f"{review} series need admin review (not_found + changed).")


def parse_args():
    p = argparse.ArgumentParser(description="Recurring-verify workflow helper (read-only).")
    sub = p.add_subparsers(dest="cmd", required=True)

    pl = sub.add_parser("list", help="Print recurring series roots as JSON.")
    pl.add_argument("--out", help="Write JSON to this path instead of stdout.")
    pl.set_defaults(func=cmd_list)

    pr = sub.add_parser("report", help="Write a Markdown report from a verdicts JSON.")
    pr.add_argument("path", help="Path to results JSON, or '-' for stdin.")
    pr.set_defaults(func=cmd_report)

    return p.parse_args()


def main():
    args = parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
