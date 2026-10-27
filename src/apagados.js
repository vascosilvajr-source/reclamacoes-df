// Apagados: o que se apaga nas listas da app fica 30 dias e pode ser reposto.
// A deteção é feita na gravação: compara o que estava guardado com o que vai ser guardado
// e regista os registos (com "id") que desapareceram. Importações grandes não contam.

export const STORAGE_APAGADOS_KEY = "reclamacoes:apagados";
export const DIAS_APAGADOS = 30;
const MAX_POR_GRAVACAO = 10;

// Listas com lixo e o nome que aparece em "Apagados".
export const LISTAS_COM_LIXO = {
  "reclamacoes:registo": "Reclamações",
  "reclamacoes:auditorias": "Auditorias",
  "reclamacoes:sancoes": "Sanções",
  "reclamacoes:ocorrencias": "Ocorrências",
  "reclamacoes:avaliacoes": "Avaliações",
  "reclamacoes:riscos": "Riscos e oportunidades",
  "reclamacoes:objetivos": "Objetivos",
  "reclamacoes:documentos": "Controlo documental",
  "reclamacoes:formacao": "Plano de formação",
  "reclamacoes:espacos": "Espaços",
  "reclamacoes:eventos": "Eventos",
  "reclamacoes:desistencias": "Desistências",
  "reclamacoes:experiencias": "Experiências",
  "reclamacoes:desvinculacoes": "Desvinculações",
  "reclamacoes:inqueritos-plano": "Cronograma de inquéritos",
  "reclamacoes:inqueritos-eventos": "Inquéritos",
  "reclamacoes:respostas-tipo": "Respostas-tipo",
};

const temId = (x) => x && typeof x === "object" && !Array.isArray(x) && x.id !== undefined && x.id !== null;

// Registos que estavam em "antes" e já não estão em "depois", com o caminho até à lista.
export function registosRemovidos(antes, depois, caminho = [], prof = 0) {
  if (prof > 3 || antes === null || antes === undefined) return [];
  if (Array.isArray(antes)) {
    if (!antes.some(temId)) return [];
    const ficam = new Set((Array.isArray(depois) ? depois : []).filter(temId).map((x) => String(x.id)));
    return antes
      .map((x, posicao) => ({ x, posicao }))
      .filter(({ x }) => temId(x) && !ficam.has(String(x.id)))
      .map(({ x, posicao }) => ({ caminho, item: x, posicao }));
  }
  if (typeof antes === "object") {
    const d = depois && typeof depois === "object" ? depois : {};
    // Uma época inteira que desaparece não é um registo apagado à mão.
    return Object.keys(antes).flatMap((k) => (k in d ? registosRemovidos(antes[k], d[k], [...caminho, k], prof + 1) : []));
  }
  return [];
}

export function aceitaRemocao(lista) {
  return lista.length > 0 && lista.length <= MAX_POR_GRAVACAO;
}

const curto = (s, n = 90) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
// Nome legível de um registo apagado.
export function rotuloApagado(chave, item, caminho = []) {
  const i = item || {};
  const epoca = caminho[0] === "epocas" && caminho[1] ? ` · ${caminho[1]}` : "";
  if (chave === "reclamacoes:registo") return `Nº ${String(i.entryNumber ?? "").padStart(4, "0")} — ${curto(i.complainant || i.school || "reclamação")}`;
  if (chave === "reclamacoes:riscos") return `Nº ${i.n ?? "?"}${epoca} — ${curto(i.identificacao || i.causa || "")}`;
  if (chave === "reclamacoes:documentos") return `${i.codigo && i.codigo !== "-" ? `${i.codigo} — ` : ""}${curto(i.identificacao)}`;
  if (chave === "reclamacoes:espacos") return `${i.escola || ""} · ${i.dia || ""} ${i.hora || ""} — ${curto((i.turmas || []).join(" + ") || i.turma)}`;
  const nome = i.titulo || i.identificacao || i.conteudo || i.objetivo || i.nome || i.personName || (i.atletas || []).join(", ") || i.school || i.escola || i.turma || i.tipo || "registo";
  const quando = i.data || i.date || "";
  return `${curto(nome)}${quando ? ` · ${String(quando).slice(0, 10)}` : ""}${epoca}`;
}

// Mantém só os últimos 30 dias.
export function limparAntigos(lista, hoje = new Date()) {
  const limite = new Date(hoje.getTime() - DIAS_APAGADOS * 86400000).toISOString();
  return (lista || []).filter((a) => a && a.em >= limite);
}

// Repõe um registo no sítio de onde saiu. Devolve o novo valor (ou null se já lá está).
export function reporEm(valor, caminho, item, posicao) {
  const raiz = valor === undefined || valor === null ? (caminho.length ? {} : []) : JSON.parse(JSON.stringify(valor));
  let pai = raiz;
  for (const k of caminho.slice(0, -1)) {
    if (!pai[k] || typeof pai[k] !== "object") pai[k] = {};
    pai = pai[k];
  }
  const ult = caminho[caminho.length - 1];
  let lista;
  if (caminho.length === 0) lista = raiz;
  else {
    if (!Array.isArray(pai[ult])) pai[ult] = [];
    lista = pai[ult];
  }
  if (!Array.isArray(lista)) return null;
  if (lista.some((x) => temId(x) && String(x.id) === String(item.id))) return null;
  const p = Number.isInteger(posicao) ? Math.min(Math.max(0, posicao), lista.length) : lista.length;
  lista.splice(p, 0, item);
  return raiz;
}
