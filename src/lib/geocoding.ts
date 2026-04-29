import { supabase } from "@/integrations/supabase/client";

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const { data, error } = await supabase.functions.invoke("geocode-address", {
    body: { address },
  });
  if (error) throw new Error(`Geocoding failed: ${error.message}`);
  if (!data || typeof data !== "object") return null;
  if ("error" in data) return null;
  const { lat, lng, displayName } = data as Partial<GeocodeResult>;
  if (typeof lat !== "number" || typeof lng !== "number" || typeof displayName !== "string") {
    return null;
  }
  return { lat, lng, displayName };
}
