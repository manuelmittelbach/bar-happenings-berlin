/* Central role-aware navigation map.
 *
 * Why this exists: role-conditional routing used to be scattered as inline
 * ternaries across Profile, EditEvent, EventDetail and the auth gate, and most
 * of them branched on the *live* `role`. Because an admin's role isn't in
 * `user_metadata` (it's promoted in the `profiles` table), `useAuth` reports
 * `role === "user"` for a beat until the DB lookup resolves — so any route
 * decision taken on the live role during that window sends an admin down the
 * plain-user path (the "Your events" flash + wrong Cancel target).
 *
 * The fixes that flow from this file:
 *   1. Role-dependent UI must wait for `roleResolved` (see Profile).
 *   2. The editor's Cancel target is derived from where the user *came from*
 *      (a deterministic `?from=` param), never from the race-prone live role.
 */

export type Role = "user" | "organizer" | "admin" | null;

/** Where a freshly-confirmed / freshly-landed session for `role` belongs.
 *  Only call once `roleResolved` is true. */
export function homeForRole(role: Role): string {
  if (role === "admin") return "/profile/admin";
  if (role === "organizer") return "/profile/events";
  return "/events";
}

/** The account-hub links a fully-resolved role may see. Only call once
 *  `roleResolved` is true — otherwise an admin briefly gets the user links. */
export function accountLinks(role: Role): { label: string; to: string }[] {
  const links: { label: string; to: string }[] = [];
  if (role === "user" || role === "organizer") {
    links.push({ label: "Your events", to: "/profile/events" });
  }
  if (role === "organizer") {
    links.push({ label: "Your bar", to: "/profile/bar" });
  }
  if (role === "admin") {
    links.push({ label: "Admin", to: "/profile/admin" });
  }
  links.push({ label: "Your profile", to: "/profile/details" });
  return links;
}

/* ---- Event editor return targets -------------------------------------- *
 * Every entry point into /edit-event/:id tags itself with `?from=<source>`.
 * Cancel pops in-app history when it exists; on a deep load / fresh tab it
 * resolves the fallback purely from that source — no live-role guessing. */

export type EditorSource = "event" | "my-events" | "admin" | "admin-all-bars";

/** Build the `?from=` value for a link into the editor. */
export function editorFrom(source: EditorSource): string {
  return `from=${source}`;
}

/** Fallback route for the editor's Cancel/return when there's no history to
 *  pop. Derived from the `from` param, so it's role-independent and race-free.
 *  `null`/unknown → the public events list, which is never a wrong-role page. */
export function editorReturnTo(fromParam: string | null, id?: string): string {
  switch (fromParam) {
    case "admin":
      return "/profile/admin?tab=recurring&filter=approved";
    case "admin-all-bars":
      return "/profile/admin?tab=all-bars";
    case "my-events":
      return "/profile/events";
    case "event":
      return id ? `/event/${id}` : "/events";
    default:
      return "/events";
  }
}
