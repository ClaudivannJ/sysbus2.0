import { createClient } from "@supabase/supabase-js";

// Cliente Supabase do navegador (Auth + PostgREST sob RLS + Realtime).
// Só a anon key aqui — regra de negócio sensível fica em Edge Functions.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);
