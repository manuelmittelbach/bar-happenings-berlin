import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = "Inside Bars Security <security@send.insidebars.co>";
const REPLY_TO = "hello@insidebars.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !anonKey || !resendKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resend = new Resend(resendKey);
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">Your password was changed</h2>
      <p style="margin: 0 0 12px 0; line-height: 1.5;">Hi,</p>
      <p style="margin: 0 0 12px 0; line-height: 1.5;">
        The password on your Inside Bars account (<strong>${user.email}</strong>) was just changed.
        For your security, all other devices have been signed out.
      </p>
      <p style="margin: 0 0 12px 0; line-height: 1.5;">
        If this was you, no action is needed.
      </p>
      <p style="margin: 0 0 12px 0; line-height: 1.5;">
        <strong>If you did not change your password</strong>, please reset it immediately and contact us at
        <a href="mailto:hello@insidebars.co">hello@insidebars.co</a>.
      </p>
      <p style="margin: 24px 0 0 0; font-size: 12px; color: #666;">— Inside Bars</p>
    </div>
  `.trim();

  try {
    await resend.emails.send({
      from: FROM,
      to: user.email,
      replyTo: REPLY_TO,
      subject: "Your Inside Bars password was changed",
      html,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email send failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
