import { supabase } from "../lib/supabase";

export type BusRoute = {
  id: string | number;
  origin: string;
  destination: string;
  departure_datetime?: string; // ISO string (timestamptz/timestamp)
  arrival_datetime?: string;   // ISO string (timestamptz/timestamp)
  departure_time?: string; // alternate legacy naming
  arrival_time?: string;   // alternate legacy naming
  duration?: string;  // free-form duration; type varies by schema
  price?: number;
  bus_company?: string;
  available_seats?: number;
  status?: "active" | "inactive";
  // Driver linking
  driver_id?: string;
  // Optional second driver linking
  second_driver_id?: string;
  // Bus linking
  bus_id?: string;
};

const extractTime = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const busRoutesService = {
  async listFutureRoutes() {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("routes")
      .select("*")
      .gte("departure_datetime", nowIso)
      .order("departure_datetime", { ascending: true });

    if (error) throw error;
    return data as BusRoute[];
  },

  async getAllRoutes() {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("routes")
      .select("*")
      .gte("departure_datetime", nowIso)
      .order("departure_datetime", { ascending: true });
    if (error) throw error;
    return data as BusRoute[];
  },

  async createRoute(newRoute: Omit<BusRoute, "id">) {
    // Build superset payload including legacy time-only fields
    const depTime = extractTime(newRoute.departure_datetime);
    const arrTime = extractTime(newRoute.arrival_datetime);
    const superset: any = { ...newRoute };
    if (depTime) {
      superset.departure = depTime;
      superset.departure_time = depTime;
    }
    if (arrTime) {
      superset.arrival = arrTime;
      superset.arrival_time = arrTime;
    }

    // First attempt: send superset (covers DBs with legacy columns)
    const first = await supabase.from("routes").insert(superset).select();
    if (!first.error) return (first.data || []) as BusRoute[];

    // If columns don't exist (PGRST204), fallback to new columns only
    if (first.error.code === "PGRST204") {
      const modernOnly: any = { ...newRoute };
      delete modernOnly.departure;
      delete modernOnly.arrival;
      delete modernOnly.departure_time;
      delete modernOnly.arrival_time;
      // Preserve driver_id in modern schema
      const second = await supabase.from("routes").insert(modernOnly).select();
      if (!second.error) return (second.data || []) as BusRoute[];
      throw second.error;
    }

    // Other errors: surface
    throw first.error;
  },

  async updateRoute(id: string | number, updatedFields: Partial<Omit<BusRoute, "id">>) {
    // Build superset payload including legacy time-only fields
    const depTime = extractTime(updatedFields.departure_datetime);
    const arrTime = extractTime(updatedFields.arrival_datetime);
    const superset: any = { ...updatedFields };
    if (depTime) {
      superset.departure = depTime;
      superset.departure_time = depTime;
    }
    if (arrTime) {
      superset.arrival = arrTime;
      superset.arrival_time = arrTime;
    }

    const first = await supabase
      .from("routes")
      .update(superset)
      .eq("id", id)
      .select();

    if (!first.error) return (first.data || []) as BusRoute[];

    if (first.error.code === "PGRST204") {
      const modernOnly: any = { ...updatedFields };
      delete modernOnly.departure;
      delete modernOnly.arrival;
      delete modernOnly.departure_time;
      delete modernOnly.arrival_time;
      // Preserve driver_id in modern schema
      const second = await supabase
        .from("routes")
        .update(modernOnly)
        .eq("id", id)
        .select();
      if (!second.error) return (second.data || []) as BusRoute[];
      throw second.error;
    }

    throw first.error;
  },

  async deleteRoute(id: string | number) {
    const { error } = await supabase.from("routes").delete().eq("id", id);
    if (error) throw error;
  },
};
