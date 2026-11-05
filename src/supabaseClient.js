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
// Cada chave guarda a versão (updated_at) lida: só se grava por cima da versão que se viu.
// Assim, se outra pessoa ou o envio automático (op_preparar/op_responder) mudou a chave entretanto,
// a gravação falha em vez de apagar o trabalho dos outros.
const versoes = {};
const preCarregado = {};
const filas = {};
const CONFLITO = "Estes dados foram alterados noutro lado depois de abrires a app. Recarrega a página (F5) antes de voltar a gravar, para não apagar essas alterações.";

export const dbStorage = {
  // Lê várias chaves num só pedido (arranque); os get() seguintes destas chaves não voltam ao servidor.
  async carregar(keys) {
    const { data, error } = await supabase.from("app_storage").select("key, value, updated_at").in("key", keys);
    if (error) throw error;
    keys.forEach((k) => (preCarregado[k] = null));
    (data || []).forEach((r) => {
      versoes[r.key] = r.updated_at;
      preCarregado[r.key] = r;
    });
  },
  async get(key) {
    let data;
    if (key in preCarregado) {
      data = preCarregado[key];
      delete preCarregado[key];
    } else {
      const r = await supabase.from("app_storage").select("value, updated_at").eq("key", key).maybeSingle();
      if (r.error) throw r.error;
      data = r.data;
      if (data) versoes[key] = data.updated_at;
    }
    if (!data) return null;
    return { value: JSON.stringify(data.value) };
  },
  // Gravações da mesma chave em fila (a 2.ª espera pela versão nova da 1.ª). As que chegam enquanto
  // uma corre juntam-se numa só com o valor mais recente (ex.: escrever um número tecla a tecla).
  set(key, value) {
    const f = (filas[key] ||= { ultimo: Promise.resolve(), proximo: null, valor: null });
    f.valor = value;
    if (!f.proximo) {
      f.proximo = f.ultimo.catch(() => {}).then(() => {
        f.proximo = null;
        return gravar(key, f.valor);
      });
      f.ultimo = f.proximo;
    }
    return f.ultimo;
  },
};

async function gravar(key, value) {
  const parsed = JSON.parse(value);
  const q = versoes[key]
    ? supabase.from("app_storage").update({ value: parsed }).eq("key", key).eq("updated_at", versoes[key])
    : supabase.from("app_storage").insert({ key, value: parsed });
  const { data, error } = await q.select("updated_at");
  if (error) throw error.code === "23505" ? new Error(CONFLITO) : error;
  if (!data || !data.length) throw new Error(CONFLITO);
  versoes[key] = data[0].updated_at;
  return { key, value: parsed };
}
