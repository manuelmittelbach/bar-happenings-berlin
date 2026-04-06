import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const events = await req.json();
  
  // Insert in batches of 50
  let inserted = 0;
  for (let i = 0; i < events.length; i += 50) {
    const batch = events.slice(i, i + 50);
    const { error } = await supabase.from("events").upsert(batch, { onConflict: "id" });
    if (error) {
      return new Response(JSON.stringify({ error: error.message, inserted }), { status: 500 });
    }
    inserted += batch.length;
  }

  return new Response(JSON.stringify({ inserted }), { headers: { "Content-Type": "application/json" } });
});
