import { Resend } from "npm:resend@4";

// Public endpoint — anyone can submit the contact form. The function
// is deployed with verify_jwt: false. Honeypot field guards against
// the cheapest spam; if abuse becomes real we'll add Cloudflare
// Turnstile in a follow-up.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Verified Resend subdomain — same one notify-password-changed sends
// from. `Contact` label keeps the From distinct from the security
// transactional sender so inbox rules can route separately.
const FROM = "Inside Bars Contact <contact@send.insidebars.co>";
const TO = "hello@insidebars.co";

// Topic ids must mirror src/pages/Contact.tsx — keep these in sync.
// We trust the id, not a free-text subject from the client.
const TOPIC_SUBJECTS: Record<string, string> = {
  instagram: "Instagram / TikTok collab",
  host: "Host an event",
  collab: "Collaboration",
  bug: "Bug report",
  press: "Press inquiry",
  feedback: "Feedback",
  other: "Other",
};

const MAX_MESSAGE_LEN = 5000;
const MAX_NAME_LEN = 200;

type Payload = {
  name?: string;
  email?: string;
  message?: string;
  topic?: string;
  hp?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // Honeypot: real users leave this empty. Bots fill every field.
  // Silently return 200 so the spammer doesn't learn the trap exists.
  if (payload.hp && payload.hp.trim().length > 0) {
    return jsonResponse({ ok: true });
  }

  const email = (payload.email ?? "").trim();
  const message = (payload.message ?? "").trim();
  const name = (payload.name ?? "").trim().slice(0, MAX_NAME_LEN);
  const topicId = (payload.topic ?? "").trim();

  if (!isEmail(email)) {
    return jsonResponse({ error: "Please enter a valid email address." }, 400);
  }
  if (message.length === 0) {
    return jsonResponse({ error: "Message can't be empty." }, 400);
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return jsonResponse(
      { error: `Message is too long (max ${MAX_MESSAGE_LEN} characters).` },
      400,
    );
  }
  const topicSubject = TOPIC_SUBJECTS[topicId];
  if (!topicSubject) {
    return jsonResponse({ error: "Unknown topic." }, 400);
  }

  const subject = `[Inside Bars] ${topicSubject}`;
  const text = [
    `Topic: ${topicSubject}`,
    name ? `From: ${name} <${email}>` : `From: ${email}`,
    "",
    message,
  ].join("\n");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
      <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.08em;">${escapeHtml(topicSubject)}</p>
      <h2 style="margin: 0 0 16px 0; font-size: 18px;">
        ${name ? `${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;` : escapeHtml(email)}
      </h2>
      <div style="white-space: pre-wrap; line-height: 1.5; font-size: 15px;">${escapeHtml(message)}</div>
      <p style="margin: 24px 0 0 0; font-size: 12px; color: #666;">
        Sent from the Inside Bars contact form.
      </p>
    </div>
  `.trim();

  const resend = new Resend(resendKey);
  try {
    await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: email,
      subject,
      text,
      html,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    return jsonResponse({ error: msg }, 502);
  }

  return jsonResponse({ ok: true });
});
