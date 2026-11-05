// Base de conhecimento: uma pasta do Obsidian (ficheiros .md, .txt, .pdf, .docx) ligada pelo browser.
// Os ficheiros não saem do computador: o texto é partido em trechos e o índice fica em IndexedDB neste browser.
// A pesquisa é local (sem IA e sem custos). Grupos = pastas de 1.º nível.
import { useCallback, useEffect, useState } from "react";

// ---------- IndexedDB (pasta ligada + índice) ----------
const abrirBD = () =>
  new Promise((ok, falha) => {
    const r = indexedDB.open("df-conhecimento", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
const kvGet = async (k) => {
  const bd = await abrirBD();
  return new Promise((ok, falha) => {
    const q = bd.transaction("kv").objectStore("kv").get(k);
    q.onsuccess = () => ok(q.result);
    q.onerror = () => falha(q.error);
  });
};
const kvSet = async (k, v) => {
  const bd = await abrirBD();
  return new Promise((ok, falha) => {
    const t = bd.transaction("kv", "readwrite");
    t.objectStore("kv").put(v, k);
    t.oncomplete = () => ok();
    t.onerror = () => falha(t.error);
  });
};

export const suportado = () => typeof window !== "undefined" && "showDirectoryPicker" in window && typeof indexedDB !== "undefined";
export const INDICE_VAZIO = { ficheiros: {}, atualizado: null };
let cache = null; // índice em memória (partilhado pelos painéis)
const ouvintes = new Set();
const avisar = () => ouvintes.forEach((f) => f());

export async function lerIndice() {
  if (!cache) cache = (await kvGet("indice")) || INDICE_VAZIO;
  return cache;
}
async function guardarIndice(indice) {
  cache = indice;
  await kvSet("indice", indice);
  avisar();
}
export async function ligarPasta() {
  const h = await window.showDirectoryPicker({ mode: "read" });
  await kvSet("pasta", h);
  await guardarIndice({ ...INDICE_VAZIO });
  return h;
}
export async function estadoPasta() {
  const h = await kvGet("pasta");
  if (!h) return { estado: "sem-pasta" };
  const p = await h.queryPermission({ mode: "read" });
  return { estado: p === "granted" ? "pronta" : "permissao", handle: h, nome: h.name };
}
export const pedirPermissao = async (h) => (await h.requestPermission({ mode: "read" })) === "granted";
export async function esquecerPasta() {
  await kvSet("pasta", null);
  await guardarIndice({ ...INDICE_VAZIO });
}

// ---------- Ler ficheiros ----------
const EXTENSOES = ["md", "txt", "pdf", "docx"];
async function* percorrer(dir, caminho = []) {
  for await (const [nome, h] of dir.entries()) {
    if (nome.startsWith(".")) continue; // .obsidian, .git…
    if (h.kind === "directory") yield* percorrer(h, [...caminho, nome]);
    else if (EXTENSOES.includes(nome.split(".").pop().toLowerCase())) yield { caminho: [...caminho, nome], h };
  }
}

async function lerPdf(buf) {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    const c = await pg.getTextContent();
    paginas.push(c.items.map((x) => (x.str || "") + (x.hasEOL ? "\n" : " ")).join(""));
  }
  return paginas.join("\n");
}

// .docx = zip: procura word/document.xml e descomprime (deflate cru) com a API nativa do browser.
async function lerDocx(buf) {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let fim = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error("docx inválido");
  const n = v.getUint16(fim + 10, true);
  let p = v.getUint32(fim + 16, true);
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const tam = v.getUint32(p + 20, true);
    const nNome = v.getUint16(p + 28, true);
    const nExtra = v.getUint16(p + 30, true);
    const nCom = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nNome));
    if (nome === "word/document.xml") {
      const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const dados = u8.subarray(ini, ini + tam);
      let xml;
      if (metodo === 0) xml = new TextDecoder().decode(dados);
      else {
        const s = new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        xml = await new Response(s).text();
      }
      return xml
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:tab\/>/g, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
    }
    p += 46 + nNome + nExtra + nCom;
  }
  throw new Error("docx sem texto");
}

// ---------- Partir em trechos (por título / artigo) ----------
const TITULO_MD = /^(#{1,6})\s+(.*\S)\s*$/;
const ARTIGO = /^\s*(artigo|art\.)\s*\d+[.ºo°]?[^\n]{0,80}$/i;
const MAX_TRECHO = 1400;
export function partir(texto, nota) {
  const linhas = String(texto || "")
    .replace(/\r/g, "")
    .replace(/^---\n[\s\S]*?\n---\n/, "") // frontmatter do Obsidian
    .split("\n");
  const pilha = [];
  let artigo = "";
  const seccoes = [];
  let atual = { seccao: "", linhas: [] };
  const fecha = () => {
    const t = atual.linhas.join("\n").trim();
    if (t) seccoes.push({ seccao: atual.seccao, texto: t });
  };
  const rotulo = () => [...pilha.filter(Boolean), artigo].filter(Boolean).join(" › ");
  linhas.forEach((l) => {
    const m = l.match(TITULO_MD);
    if (m) {
      fecha();
      const nivel = m[1].length;
      pilha.length = nivel - 1;
      pilha[nivel - 1] = m[2].replace(/[*_`[\]]/g, "");
      artigo = "";
      atual = { seccao: rotulo(), linhas: [] };
    } else if (ARTIGO.test(l)) {
      fecha();
      artigo = l.trim().replace(/\s+/g, " ").slice(0, 90);
      atual = { seccao: rotulo(), linhas: [l] };
    } else atual.linhas.push(l);
  });
  fecha();
  // Secções grandes partem-se por parágrafos.
  const trechos = [];
  seccoes.forEach((s) => {
    if (s.texto.length <= MAX_TRECHO) return trechos.push(s);
    let corrente = "";
    s.texto.split(/\n\s*\n/).forEach((par) => {
      if (corrente && (corrente + par).length > MAX_TRECHO) {
        trechos.push({ seccao: s.seccao, texto: corrente.trim() });
        corrente = "";
      }
      corrente += `${par}\n\n`;
    });
    if (corrente.trim()) trechos.push({ seccao: s.seccao, texto: corrente.trim() });
  });
  // Cada artigo/secção fica no seu trecho (mesmo pequeno), para a citação apontar ao sítio certo.
  return trechos.filter((t) => t.texto.length > 20).map((t) => ({ nota, seccao: t.seccao, texto: t.texto }));
}

// Lê a pasta ligada e (re)indexa só o que mudou. progresso({ feitos, total, ficheiro }).
export async function atualizarIndice(handle, progresso = () => {}) {
  const antigo = await lerIndice();
  const ficheiros = {};
  const lista = [];
  for await (const f of percorrer(handle)) lista.push(f);
  let feitos = 0;
  const erros = [];
  for (const { caminho, h } of lista) {
    const chave = caminho.join("/");
    progresso({ feitos, total: lista.length, ficheiro: chave });
    try {
      const file = await h.getFile();
      const ant = antigo.ficheiros[chave];
      if (ant && ant.mod === file.lastModified && ant.tam === file.size) ficheiros[chave] = ant;
      else {
        const ext = caminho[caminho.length - 1].split(".").pop().toLowerCase();
        const nota = caminho[caminho.length - 1].replace(/\.[^.]+$/, "");
        const texto = ext === "pdf" ? await lerPdf(await file.arrayBuffer()) : ext === "docx" ? await lerDocx(await file.arrayBuffer()) : await file.text();
        ficheiros[chave] = { mod: file.lastModified, tam: file.size, grupo: caminho.length > 1 ? caminho[0] : "Geral", trechos: partir(texto, nota) };
      }
    } catch (e) {
      erros.push(`${chave}: ${e?.message || e}`);
    }
    feitos++;
  }
  const indice = { ficheiros, atualizado: new Date().toISOString() };
  await guardarIndice(indice);
  return { indice, erros, ficheiros: lista.length };
}

// ---------- Grupos e onde valem (neste computador) ----------
export const USOS = [
  ["reclamacoes", "Reclamações"],
  ["sancoes", "Sanções"],
  ["quizzes", "Quizzes"],
];
const LS_GRUPOS = "df-conhecimento-grupos";
export const lerPrefs = () => {
  try {
    return JSON.parse(window.localStorage.getItem(LS_GRUPOS) || "{}");
  } catch (e) {
    return {};
  }
};
export const guardarPrefs = (p) => {
  try {
    window.localStorage.setItem(LS_GRUPOS, JSON.stringify(p));
  } catch (e) {
    // só nesta sessão
  }
  avisar();
};
export const gruposDe = (indice) => [...new Set(Object.values((indice && indice.ficheiros) || {}).map((f) => f.grupo))].sort((a, b) => a.localeCompare(b, "pt"));
// Grupos onde o uso (reclamacoes | sancoes | quizzes) está ligado; por omissão, todos.
export function gruposPara(indice, uso) {
  const prefs = lerPrefs();
  return new Set(gruposDe(indice).filter((g) => !prefs[g] || prefs[g][uso] !== false));
}
export const temTrechos = (indice) => !!indice && Object.values(indice.ficheiros || {}).some((f) => f.trechos && f.trechos.length);

// ---------- Pesquisa (BM25 simples, sem IA) ----------
const VAZIAS = new Set("de da do das dos e em no na nos nas um uma uns umas o a os as que por para com sem ao aos se ou como mais mas foi sao ser tem ter nao seu sua seus suas este esta estes estas isso essa esse entre sobre pelo pela pelos pelas tambem quando onde qual quais ja ate muito pouco aos".split(" "));
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const tokensDe = (t) =>
  norm(t)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((x) => x.length > 2 && !VAZIAS.has(x))
    .map((x) => x.slice(0, 6));

let prep = null; // { indice, docs, df, media }
function preparar(indice) {
  if (prep && prep.indice === indice) return prep;
  const docs = [];
  Object.entries(indice.ficheiros || {}).forEach(([caminho, f]) =>
    (f.trechos || []).forEach((t) => {
      const toks = tokensDe(`${t.texto} ${t.nota} ${t.seccao} ${t.seccao} ${t.nota}`);
      const tf = {};
      toks.forEach((k) => (tf[k] = (tf[k] || 0) + 1));
      docs.push({ t, grupo: f.grupo, caminho, tf, len: toks.length });
    })
  );
  const df = {};
  docs.forEach((d) => Object.keys(d.tf).forEach((k) => (df[k] = (df[k] || 0) + 1)));
  prep = { indice, docs, df, media: docs.reduce((a, d) => a + d.len, 0) / (docs.length || 1) };
  return prep;
}

function excertoDe(texto, termos) {
  const t = texto.replace(/\s+/g, " ").trim();
  if (t.length <= 320) return t;
  const baixo = norm(t);
  let pos = -1;
  for (const k of termos) {
    const i = baixo.indexOf(k);
    if (i >= 0 && (pos < 0 || i < pos)) pos = i;
  }
  const ini = Math.max(0, (pos < 0 ? 0 : pos) - 80);
  return `${ini > 0 ? "…" : ""}${t.slice(ini, ini + 320)}${ini + 320 < t.length ? "…" : ""}`;
}

// procurar(indice, "texto", { grupos: Set|null, n }) -> [{ ...trecho, grupo, score, excerto }]
export function procurar(indice, consulta, { grupos = null, n = 5 } = {}) {
  if (!temTrechos(indice)) return [];
  const q = [...new Set(tokensDe(consulta))];
  if (!q.length) return [];
  const { docs, df, media } = preparar(indice);
  const N = docs.length;
  const out = [];
  docs.forEach((d) => {
    if (grupos && !grupos.has(d.grupo)) return;
    let s = 0;
    q.forEach((k) => {
      const f = d.tf[k];
      if (!f) return;
      const idf = Math.log(1 + (N - df[k] + 0.5) / (df[k] + 0.5));
      s += (idf * f * 2.4) / (f + 1.4 * (0.25 + (0.75 * d.len) / media));
    });
    if (s > 0) out.push({ ...d.t, grupo: d.grupo, score: s });
  });
  out.sort((a, b) => b.score - a.score);
  const termos = q;
  return out.slice(0, n).map((r) => ({ ...r, excerto: excertoDe(r.texto, termos) }));
}
export const citacao = (t) => `${t.nota}${t.seccao ? `, ${t.seccao}` : ""}`;

// ---------- Hook: estado da pasta + índice, partilhado entre painéis ----------
export function useConhecimento() {
  const [estado, setEstado] = useState({ estado: suportado() ? "a-ver" : "sem-suporte" });
  const [indice, setIndice] = useState(null);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(async () => {
    if (!suportado()) return;
    try {
      setEstado(await estadoPasta());
      setIndice(await lerIndice());
    } catch (e) {
      setEstado({ estado: "erro" });
    }
    setVersao((v) => v + 1);
  }, []);
  useEffect(() => {
    recarregar();
    ouvintes.add(recarregar);
    return () => ouvintes.delete(recarregar);
  }, [recarregar]);
  return { ...estado, indice, versao, recarregar };
}
