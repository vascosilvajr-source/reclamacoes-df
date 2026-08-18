import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Faltam as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Confirma o ficheiro .env (ver guia)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Camada de compatibilidade que imita a API window.storage usada
// originalmente pelo Artifact, mas grava tudo na tabela app_storage
// do Supabase, partilhada por todos os utilizadores da app.
export const dbStorage = {
  async get(key) {
    const { data, error } = await supabase
      .from("app_storage")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { value: JSON.stringify(data.value) };
  },
  async set(key, value) {
    const parsed = JSON.parse(value);
    const { error } = await supabase
      .from("app_storage")
      .upsert({ key, value: parsed, updated_at: new Date().toISOString() });
    if (error) throw error;
    return { key, value: parsed };
  },
};
