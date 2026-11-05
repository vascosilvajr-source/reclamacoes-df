// Recursos humanos: lógica sem React, usada pela página de RH, pela integração (formação),
// pelos Espaços e pelo App (contadores e limpeza dos 2 anos).
// Os dados dos colaboradores nunca saem em e-mails nem na janela operacional.

export const RH_VAZIO = {
  colaboradores: [],
  funcoes: ["Treinador", "Coordenador técnico", "Responsável operacional", "Armazém", "Administrativo", "Direção"],
  funcoesEspacos: ["Treinador"],
  passos: [
    { id: "docs", nome: "Envio de documentos", tipo: "docs" },
    { id: "acolhimento", nome: "Acolhimento", tipo: "simples" },
    { id: "formacao", nome: "Formação inicial", tipo: "simples" },
  ],
  pacotes: [],
  notaMinima: 2,
};
export const ANOS_GUARDAR = 2;

// Dados com os valores por omissão nos campos que faltam.
export const rhCompleto = (d) => ({ ...RH_VAZIO, ...(d || {}), colaboradores: (d && d.colaboradores) || [] });

const chave = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// "João Pedro Martins" -> "JM" (primeiro e último nome).
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
export function iniciaisDoNome(nome) {
  const p = String(nome || "").trim().split(/\s+/).filter((w) => w && !PARTICULAS.has(w.toLowerCase()));
  if (!p.length) return "";
  const l = (w) => (w.match(/\p{L}/u) || [""])[0].toLocaleUpperCase("pt-PT");
  return p.length === 1 ? l(p[0]) : l(p[0]) + l(p[p.length - 1]);
}

export const saiu = (c) => !!c.saida;
export function estadoColaborador(c) {
  if (c.impedido) return "impedido";
  return saiu(c) ? "saiu" : "ativo";
}

// Média das notas (1 a 5) de uma avaliação.
const mediaNotas = (notas) => {
  const v = Object.values(notas || {})
    .map((x) => Number(String(x ?? "").replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
// Avaliações do staff desta pessoa: mesmas iniciais numa das escolas dela.
export function avaliacoesDe(c, avaliacoes) {
  const ini = String(c.iniciais || "").toUpperCase();
  if (!ini) return [];
  const escolas = new Set((c.escolas || []).map(chave));
  return ((avaliacoes && avaliacoes.itens) || []).filter((a) => String(a.avaliado || "").toUpperCase() === ini && (!escolas.size || escolas.has(chave(a.escola))));
}
// Média da avaliação mais recente (ou null se não houver).
export function ultimaNota(c, avaliacoes) {
  const l = avaliacoesDe(c, avaliacoes).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return l.length ? mediaNotas(l[0].notas) : null;
}
export function notaBaixa(c, avaliacoes, minimo = 2) {
  const n = ultimaNota(c, avaliacoes);
  return n !== null && n <= minimo;
}

// Alguém impedido com o mesmo nome e data de nascimento (para não voltar ao projeto).
export function coincideImpedido(novo, lista) {
  const n = chave(novo.nome);
  if (!n || !novo.nascimento) return null;
  return (lista || []).find((c) => c.id !== novo.id && c.impedido && chave(c.nome) === n && c.nascimento === novo.nascimento) || null;
}

// Saídas há mais de 2 anos: saem da lista; os impedidos ficam para sempre, só com o mínimo para os reconhecer.
export function limparRH(dados, hoje = new Date()) {
  const d = rhCompleto(dados);
  const limite = new Date(hoje.getFullYear() - ANOS_GUARDAR, hoje.getMonth(), hoje.getDate());
  const lim = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}-${String(limite.getDate()).padStart(2, "0")}`;
  let mudou = false;
  const colaboradores = [];
  d.colaboradores.forEach((c) => {
    if (!c.saida || c.saida > lim || c.reduzido) return colaboradores.push(c);
    mudou = true;
    if (!c.impedido) return;
    const { id, nome, iniciais, nascimento, funcao, entrada, saida, motivoSaida, gravoso, impedido, motivoImpedido } = c;
    colaboradores.push({ id, nome, iniciais, nascimento, funcao, entrada, saida, motivoSaida, gravoso, impedido, motivoImpedido, escolas: [], reduzido: true });
  });
  // null = nada a mudar.
  return mudou ? { ...d, colaboradores } : null;
}

// Ativos das funções que dão treinos, numa escola, sem a sigla em nenhum horário dessa escola.
export function semHorario(dados, espacos, escola) {
  const d = rhCompleto(dados);
  const fs = new Set((d.funcoesEspacos || []).map(chave));
  const e = chave(escola);
  const siglas = new Set((espacos || []).filter((b) => chave(b.escola) === e).flatMap((b) => (b.siglasTreinadores || []).map((s) => String(s).toUpperCase())));
  return d.colaboradores.filter((c) => !saiu(c) && fs.has(chave(c.funcao)) && (c.escolas || []).some((x) => chave(x) === e) && c.iniciais && !siglas.has(String(c.iniciais).toUpperCase()));
}

// Ativos com algum passo da integração por marcar.
export function porIntegrar(dados) {
  const d = rhCompleto(dados);
  return d.colaboradores.filter((c) => !saiu(c) && d.passos.some((p) => !(c.integracao || {})[p.id]));
}

// Resultados dos quizzes (tabela formacao_pedidos) -> ficha de cada pessoa.
// Cada tentativa entra uma só vez (chave token:tentativa). Passar num módulo de integração marca o passo dele.
// Devolve { dados, tokens } com o que mudou, ou null se não há nada de novo.
export function aplicarFormacoes(dados, pedidos) {
  const d = rhCompleto(dados);
  const porId = new Map(d.colaboradores.map((c) => [c.id, c]));
  const novos = {};
  const tokens = [];
  (pedidos || []).forEach((p) => {
    const c = porId.get(p.colaborador_id);
    if (!c) return;
    const mod = p.modulo || {};
    [...(p.historico || []), ...(p.resultado ? [p.resultado] : [])].forEach((r) => {
      const chave = `${p.token}:${r.tentativa || 1}`;
      if ((c.formacoes || []).some((f) => f.chave === chave) || (novos[c.id] || []).some((f) => f.chave === chave)) return;
      (novos[c.id] = novos[c.id] || []).push({ chave, moduloId: mod.id, modulo: mod.nome, tipo: mod.tipo, passo: mod.passo, data: r.data, nota: r.nota, passou: !!r.passou, tentativa: r.tentativa || 1 });
      if (!tokens.includes(p.token)) tokens.push(p.token);
    });
  });
  if (!tokens.length) return null;
  const colaboradores = d.colaboradores.map((c) => {
    const l = novos[c.id];
    if (!l) return c;
    const integracao = { ...(c.integracao || {}) };
    l.filter((f) => f.passou && f.tipo === "integracao" && f.passo && !integracao[f.passo]).forEach((f) => (integracao[f.passo] = f.data));
    return { ...c, formacoes: [...(c.formacoes || []), ...l], integracao };
  });
  return { dados: { ...d, colaboradores }, tokens };
}

// Formações de módulos "contínuos" cuja última aprovação já passou da validade (meses).
export function formacoesEmFalta(dados) {
  const d = rhCompleto(dados);
  const hoje = new Date();
  const out = [];
  d.colaboradores
    .filter((c) => !saiu(c))
    .forEach((c) => {
      (d.modulos || [])
        .filter((m) => m.tipo === "continua" && Number(m.validadeMeses) > 0 && (!(m.funcoes || []).length || m.funcoes.some((f) => chave(f) === chave(c.funcao))))
        .forEach((m) => {
          const ult = (c.formacoes || []).filter((f) => f.moduloId === m.id && f.passou).map((f) => f.data).sort().pop();
          if (!ult) return out.push({ colaborador: c, modulo: m, ultima: "" });
          const lim = new Date(ult);
          lim.setMonth(lim.getMonth() + Number(m.validadeMeses));
          if (lim < hoje) out.push({ colaborador: c, modulo: m, ultima: ult });
        });
    });
  return out;
}

// Pacote de documentos para a função da pessoa.
export const pacoteDe = (dados, funcao) => (rhCompleto(dados).pacotes || []).find((p) => (p.funcoes || []).some((f) => chave(f) === chave(funcao))) || null;
