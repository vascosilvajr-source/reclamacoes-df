// Núcleo da app: estilos, cores, utilitários e componentes precisos logo ao abrir (e partilhados).
import { useState, useEffect } from "react";
import { X, Check, AlertTriangle, Clock, Inbox } from "lucide-react";
import { lazy, Suspense } from "react";

// ---------- Tokens ----------
// ---------- Sistema de cores: tema claro e escuro ----------
// COLORS mantém o mesmo nome e chaves de sempre, mas os valores passam a ser
// substituídos conforme o tema. Como todos os componentes leem COLORS no
// momento em que renderizam, trocar o tema basta para tudo acompanhar.
export const TEMA_CLARO = {
  ink: "#0E1420",
  ink2: "#48536B",
  paper: "#F2F2F7",
  paperRaised: "#FFFFFF",
  paperSunken: "#F7F7FA",
  rule: "#E6E8EC",
  ruleSoft: "#F0F1F4",
  navy: "#0A52C7",
  navySoft: "#0A52C7",
  navyWash: "#EAF1FD",
  slate: "#8A93A5",
  ok: "#0C7A52",
  okBg: "#E6F4EE",
  warn: "#9A6A00",
  warnBg: "#FBF2DE",
  danger: "#C2570C",
  dangerBg: "#FDEEE3",
  done: "#8A93A5",
  doneBg: "#F0F1F4",
  progress: "#0A52C7",
  progressBg: "#EAF1FD",
  purple: "#6B4C9A",
  purpleBg: "#F1EBF8",
  sideBg: "#FFFFFF",
  onAccent: "#FFFFFF",
  shadow: "0 1px 2px rgba(14,20,32,0.05)",
  // Materiais translúcidos: fundo, bordo e brilho superior (reflexo especular).
  segTrack: "#EFEFF4",
  lift: "0 8px 24px -12px rgba(14,20,32,0.18)",
};

export const TEMA_ESCURO = {
  ink: "#E7ECF3",
  ink2: "#A7B2C2",
  paper: "#000000",
  paperRaised: "#1C1C1E",
  paperSunken: "#2C2C2E",
  rule: "#38383A",
  ruleSoft: "#2C2C2E",
  navy: "#528CFF",
  navySoft: "#8AB4FF",
  navyWash: "#15243C",
  slate: "#6F7C8E",
  ok: "#2BBE87",
  okBg: "#10281F",
  warn: "#E0A63A",
  warnBg: "#2A2113",
  danger: "#F08A4B",
  dangerBg: "#2E1F15",
  done: "#6F7C8E",
  doneBg: "#1B232D",
  progress: "#528CFF",
  progressBg: "#15243C",
  purple: "#A98AD8",
  purpleBg: "#221B33",
  sideBg: "#1C1C1E",
  onAccent: "#08131F",
  shadow: "0 1px 2px rgba(0,0,0,0.5)",
  segTrack: "#2C2C2E",
  lift: "0 10px 28px -14px rgba(0,0,0,0.7)",
};

export const COLORS = { ...TEMA_CLARO };

// ---------- Date / business-day helpers (PT holidays) ----------
export function easterSunday(year) {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function ptHolidays(year) {
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);
  const fixed = [
    [0, 1], [3, 25], [4, 1], [5, 10], [7, 15],
    [9, 5], [10, 1], [11, 1], [11, 8], [11, 25],
  ].map(([m, d]) => new Date(year, m, d));
  return [...fixed, goodFriday, corpusChristi].map((d) => d.toDateString());
}

export function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const holidays = ptHolidays(date.getFullYear());
  return !holidays.includes(date.toDateString());
}

export function fmt(date) {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

// Época desportiva: de 1 de agosto a 31 de julho. Uma data de 2026-03 pertence a 2025/26.
// Época de uma visita de auditoria: a indicada (importação) ou a da data.
export const epocaAud = (a) => a.epoca || epocaDe(a.date);
export const dataAud = (a) => (a.date ? fmt(new Date(a.date + "T00:00:00")) : "Sem data");

export function epocaDe(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const ano = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${ano}/${String(ano + 1).slice(2)}`;
}

export const STATUS_META = {
  por_pegar: { label: "Por iniciar", color: COLORS.warn, bg: COLORS.warnBg },
  em_andamento: { label: "Em andamento", color: COLORS.progress, bg: COLORS.progressBg },
  atrasado: { label: "Atrasado", color: COLORS.danger, bg: COLORS.dangerBg },
  concluido: { label: "Concluído", color: COLORS.ok, bg: COLORS.okBg },
};

export const SEVERITY_META = {
  baixa: { label: "Baixa", color: COLORS.ok, bg: COLORS.okBg },
  media: { label: "Média", color: COLORS.warn, bg: COLORS.warnBg },
  alta: { label: "Alta", color: COLORS.danger, bg: COLORS.dangerBg },
};

export const CANAL_META = {
  email: { label: "E-mail", color: COLORS.progress, bg: COLORS.progressBg },
  presencial: { label: "Pessoal", color: COLORS.ok, bg: COLORS.okBg },
  livro: { label: "Livro de Reclamações", color: COLORS.navy, bg: COLORS.rule },
  redes: { label: "Redes Sociais", color: COLORS.purple, bg: COLORS.purpleBg },
};

// Tipos de sanção aplicáveis a pais/EE — lista editável (options.sanctionTypes).
export const DEFAULT_MOTIVOS_DESISTENCIA = [
  "Mudança de residência",
  "Motivos financeiros",
  "Desmotivação / falta de interesse",
  "Lesão ou problema de saúde",
  "Incompatibilidade de horários",
  "Mudança para outro clube",
  "Insatisfação com a experiência",
  "Fim de ciclo / idade",
  "Não especificado",
  "Outro",
];

export const DEFAULT_ESPACOS = ["Campo 1", "Campo 2", "Meio-campo A", "Meio-campo B", "Pavilhão"];

// Capacidade sugerida por turma, ajustável no registo.
export function capacidadeSugerida(turma, niveis) {
  // Lotação máxima por turma (e por grupo de turmas que treinam juntas).
  const mapa = { "Raíz": 8, "Raiz": 8, "Iniciação": 10, "Básico": 12, "Intermédio": 14, "Avançado": 16, "Expert": 18 };
  if (mapa[turma]) return mapa[turma];
  const esc = escalaoDaTurma(turma, niveis);
  if (mapa[esc]) return mapa[esc];
  return ehEscolinha(turma, niveis) ? 16 : 20;
}

// ---------- Requisitos da NP EN ISO 9001:2015 ----------
// Cada constatação pode ser associada a um requisito. As palavras-chave servem para sugerir
// o requisito a partir do texto; a sugestão só é aplicada sozinha quando a certeza é alta.
export const REQUISITOS_ISO = [
  { c: "4.1", t: "Compreender a organização e o seu contexto", kw: ["contexto", "swot", "envolvente", "concorrencia", "concorrente"] },
  { c: "4.2", t: "Necessidades e expetativas das partes interessadas", kw: ["partes interessadas", "parceiro", "parceria", "autarquia", "camara municipal", "junta de freguesia", "colegio parceiro"] },
  { c: "4.3", t: "Âmbito do sistema de gestão da qualidade", kw: ["ambito do sistema", "ambito do sgq", "fora do ambito"] },
  { c: "4.4", t: "Sistema de gestão da qualidade e respetivos processos", kw: ["processo nao definido", "mapa de processos", "fluxograma", "interacao entre processos", "dono do processo"] },
  { c: "5.1.1", t: "Liderança e compromisso: generalidades", kw: ["lideranca", "compromisso da gestao", "gestao de topo", "direcao nao"] },
  { c: "5.1.2", t: "Foco no cliente", kw: ["foco no cliente", "expetativas dos encarregados", "expectativas dos encarregados", "requisitos do cliente"] },
  { c: "5.2", t: "Política da qualidade", kw: ["politica da qualidade", "politica de qualidade", "politica nao"] },
  { c: "5.3", t: "Funções, responsabilidades e autoridades", kw: ["organograma", "funcoes", "responsabilidades", "descricao de funcao", "sem responsavel", "responsavel nao definido", "quem e responsavel", "autoridade"] },
  { c: "6.1", t: "Ações para tratar riscos e oportunidades", kw: ["risco", "riscos", "oportunidade", "plano de contingencia", "matriz de risco", "analise de risco"] },
  { c: "6.2", t: "Objetivos da qualidade e planeamento para os atingir", kw: ["objetivo", "objetivos", "meta", "metas", "indicador", "indicadores", "kpi"] },
  { c: "6.3", t: "Planeamento das alterações", kw: ["planeamento das alteracoes", "mudanca organizacional", "reestruturacao"] },
  { c: "7.1.2", t: "Pessoas", kw: ["falta de treinador", "falta de treinadores", "recursos humanos", "staff insuficiente", "numero de treinadores", "racio", "sem treinador", "treinadores insuficientes", "falta de pessoal", "falta de coordenador"] },
  { c: "7.1.3", t: "Infraestrutura", kw: ["instalacoes", "instalacao", "balneario", "balnearios", "vestiario", "campo", "relvado", "sintetico", "baliza", "balizas", "equipamento", "equipamentos", "material", "materiais", "bolas", "cones", "coletes", "sinalizadores", "iluminacao", "manutencao", "redes", "piso", "armazem", "arrecadacao", "casa de banho", "casas de banho", "wc", "chuveiro", "pavilhao", "bancada", "vedacao", "porta", "fechadura", "avariado", "danificado", "partido", "estragado", "desfibrilhador", "dae", "mala de primeiros socorros", "kit de primeiros socorros", "estojo"] },
  { c: "7.1.4", t: "Ambiente para a operacionalização dos processos", kw: ["limpeza", "higiene", "sujo", "sujidade", "lixo", "ruido", "temperatura", "aquecimento", "agua quente", "ambiente", "seguranca", "inseguro", "perigo", "perigoso", "bullying", "comportamento", "conflito", "clima", "emocional", "acolhimento"] },
  { c: "7.1.5", t: "Recursos de monitorização e medição", kw: ["calibracao", "calibrado", "balanca", "cronometro", "medicao", "instrumento de medicao", "termometro", "fita metrica"] },
  { c: "7.1.6", t: "Conhecimento organizacional", kw: ["conhecimento organizacional", "licoes aprendidas", "partilha de conhecimento", "boas praticas", "metodologia df", "manual do treinador"] },
  { c: "7.2", t: "Competências", kw: ["formacao", "formacoes", "qualificacao", "qualificacoes", "certificado", "certificacao", "tptd", "cedula", "curso", "competencia", "competencias", "grau", "licenca", "habilitacao", "nao habilitado", "suporte basico de vida", "sbv"] },
  { c: "7.3", t: "Consciencialização", kw: ["desconhece", "desconheciam", "nao conhece", "nao conheciam", "consciencializacao", "sensibilizacao", "nao sabia", "nao sabiam"] },
  { c: "7.4", t: "Comunicação", kw: ["comunicacao", "comunicar", "comunicado", "informacao aos", "informar", "email", "e-mail", "contacto", "contactos", "aviso", "avisos", "divulgacao", "afixado", "afixada", "afixar", "placard", "quadro informativo", "redes sociais", "whatsapp", "reuniao", "reunioes"] },
  { c: "7.5", t: "Informação documentada", kw: ["registo", "registos", "documento", "documentos", "documentacao", "folha de presencas", "presencas", "arquivo", "arquivado", "dossier", "dossie", "ficha", "fichas", "impresso", "modelo", "versao", "desatualizado", "desatualizada", "nao preenchido", "preenchimento", "assinatura", "assinado", "evidencia", "evidencias", "lista de"] },
  { c: "8.1", t: "Planeamento e controlo operacional", kw: ["planeamento", "plano de treino", "planos de treino", "plano semanal", "planos semanais", "microciclo", "mesociclo", "horario", "horarios", "calendario", "calendarizacao", "programacao"] },
  { c: "8.2", t: "Requisitos para produtos e serviços", kw: ["inscricao", "inscricoes", "contrato", "mensalidade", "mensalidades", "pagamento", "pagamentos", "quota", "regulamento", "condicoes de inscricao", "preco", "precario", "kit de equipamento", "comunicacao com o cliente", "pedido do encarregado"] },
  { c: "8.3", t: "Design e desenvolvimento de produtos e serviços", kw: ["novo programa", "novo servico", "desenvolvimento de produto", "conteudos programaticos", "design"] },
  { c: "8.4", t: "Controlo de fornecedores externos", kw: ["fornecedor", "fornecedores", "subcontrat", "prestador", "prestadores", "transporte", "autocarro", "empresa de", "aluguer", "catering", "outsourcing", "externo"] },
  { c: "8.5.1", t: "Controlo da prestação do serviço", kw: ["treino", "treinos", "sessao", "sessoes", "pontualidade", "atraso", "atrasos", "assiduidade", "faltas do treinador", "acompanhamento", "jogo", "jogos", "torneio", "competicao", "aquecimento", "exercicio", "exercicios", "avaliacao dos alunos", "relatorio de avaliacao", "metodologia", "supervisao", "vigilancia"] },
  { c: "8.5.2", t: "Identificação e rastreabilidade", kw: ["identificacao", "identificado", "identificados", "etiqueta", "etiquetado", "cartao", "credencial", "rastreabilidade"] },
  { c: "8.5.3", t: "Propriedade dos clientes ou de fornecedores externos", kw: ["objetos pessoais", "perdidos", "perdidos e achados", "dados pessoais", "rgpd", "protecao de dados", "consentimento", "direitos de imagem", "autorizacao de imagem", "fotografias"] },
  { c: "8.5.4", t: "Preservação", kw: ["armazenamento", "armazenado", "conservacao", "validade", "fora de validade", "expirado", "acondicionamento", "acondicionado", "guardado", "medicamentos"] },
  { c: "8.5.5", t: "Atividades posteriores à entrega", kw: ["pos-servico", "follow-up", "seguimento apos"] },
  { c: "8.5.6", t: "Controlo das alterações", kw: ["alteracao de horario", "alteracao do treinador", "substituicao do treinador", "mudanca de horario", "cancelamento de treino", "treino cancelado"] },
  { c: "8.6", t: "Libertação de produtos e serviços", kw: ["libertacao", "verificacao final", "aprovacao final"] },
  { c: "8.7", t: "Controlo de saídas não conformes", kw: ["saida nao conforme", "servico nao conforme", "produto nao conforme"] },
  { c: "9.1.1", t: "Monitorização e medição: generalidades", kw: ["monitorizacao", "monitorizar", "medir", "medicao do desempenho"] },
  { c: "9.1.2", t: "Satisfação do cliente", kw: ["satisfacao", "inquerito", "inqueritos", "questionario", "questionarios", "reclamacao", "reclamacoes", "elogio", "feedback dos encarregados"] },
  { c: "9.1.3", t: "Análise e avaliação", kw: ["analise de dados", "analise dos dados", "dados nao analisados", "tratamento de dados", "estatistica", "relatorio de analise"] },
  { c: "9.2", t: "Auditoria interna", kw: ["auditoria", "auditorias", "auditor", "programa de auditorias"] },
  { c: "9.3", t: "Revisão pela gestão", kw: ["revisao pela gestao", "revisao do sistema"] },
  { c: "10.2", t: "Não conformidade e ação corretiva", kw: ["acao corretiva", "acoes corretivas", "nao conformidade anterior", "reincidencia", "reincidente", "repete-se", "voltou a acontecer", "nao resolvida", "por resolver", "anteriormente identificad"] },
  { c: "10.3", t: "Melhoria contínua", kw: ["melhoria continua", "melhorar", "melhoria"] },
];
export const REQUISITO_ISO_POR_CODIGO = Object.fromEntries(REQUISITOS_ISO.map((r) => [r.c, r]));
export const GRUPOS_ISO = { 4: "4 · Contexto da organização", 5: "5 · Liderança", 6: "6 · Planeamento", 7: "7 · Suporte", 8: "8 · Operacionalização", 9: "9 · Avaliação do desempenho", 10: "10 · Melhoria" };
export const rotuloISO = (c) => (REQUISITO_ISO_POR_CODIGO[c] ? `${c} ${REQUISITO_ISO_POR_CODIGO[c].t}` : c || "");

// Pistas pela área: quando o texto não diz nada, a área aponta para onde costuma cair.
export const ISO_POR_AREA = {
  "instalacoes e equipamentos": "7.1.3",
  medica: "7.1.4",
  tecnica: "8.5.1",
  administrativa: "7.5",
  "escolar e social": "7.1.4",
};

// Sugere o requisito ISO de uma constatação. Devolve { c, certeza: "alta" | "media" | "baixa", alternativas }.
export function sugerirRequisitoISO(f) {
  const norm = (t) => " " + normChave(t).replace(/[^a-z0-9 -]/g, " ").replace(/\s+/g, " ") + " ";
  const titulo = norm([f.description, f.category].filter(Boolean).join(" "));
  const resto = norm([f.analiseCausas, f.acao].filter(Boolean).join(" "));
  // Palavras curtas (wc, dae, kpi) têm de aparecer inteiras; as outras contam também no plural.
  const tem = (txt, k) => (k.length <= 3 ? txt.includes(` ${k} `) : txt.includes(` ${k}`));
  const pont = REQUISITOS_ISO.map((r) => {
    let s = 0;
    // Sem contar duas vezes a mesma palavra (ex.: "balneario" e "balnearios").
    const kws = r.kw.filter((k) => !r.kw.some((o) => o !== k && o.length > 3 && k.startsWith(o)));
    kws.forEach((k) => {
      // Uma expressão inteira ("plano de treino") diz mais do que uma palavra solta ("treino").
      const peso = k.includes(" ") ? 4 : 2;
      if (tem(titulo, k)) s += peso;
      else if (tem(resto, k)) s += 1;
    });
    return { c: r.c, s };
  });
  const area = ISO_POR_AREA[normChave(f.area)];
  if (area) pont.find((p) => p.c === area).s += 1;
  pont.sort((a, b) => b.s - a.s);
  const [a, b] = pont;
  if (!a || a.s === 0) return { c: area || "", certeza: "baixa", alternativas: [] };
  const certeza = a.s >= 4 && a.s >= (b ? b.s : 0) * 2 ? "alta" : a.s >= 2 && a.s > (b ? b.s : 0) ? "media" : "baixa";
  return { c: a.c, certeza, alternativas: pont.slice(1, 3).filter((p) => p.s > 0 && p.s >= a.s / 2).map((p) => p.c) };
}

export const DEFAULT_NIVEIS = ["Raíz", "Iniciação", "Básico", "Intermédio", "Avançado", "Expert"];

// Classificação do crescimento de inscritos. Os limites são configuráveis na app.
export const LIMITES_CRESC_PADRAO = { critico: -10, declinio: -2, estavel: 2 };
export const CLASSES_CRESC = [
  { key: "critico", label: "Crítico", color: COLORS.danger, bg: COLORS.dangerBg },
  { key: "declinio", label: "Declínio moderado", color: COLORS.warn, bg: COLORS.warnBg },
  { key: "estavel", label: "Estável", color: COLORS.slate, bg: COLORS.doneBg },
  { key: "positiva", label: "Evolução positiva", color: COLORS.ok, bg: COLORS.okBg },
];
export function classificarCrescimento(pct, limites) {
  const L = limites || LIMITES_CRESC_PADRAO;
  if (pct < L.critico) return CLASSES_CRESC[0];
  if (pct < L.declinio) return CLASSES_CRESC[1];
  if (pct <= L.estavel) return CLASSES_CRESC[2];
  return CLASSES_CRESC[3];
}

// Escalão a partir do nome da turma: "Sub-11A" -> "Sub-11"; níveis mantêm o nome.
export function escalaoDaTurma(t, niveis) {
  if (!t) return "—";
  const m = String(t).match(/^sub[\s-]*(\d+)/i);
  if (m) return "Sub-" + m[1];
  const n = (niveis || DEFAULT_NIVEIS).find((x) => String(t).toLowerCase().startsWith(x.toLowerCase()));
  return n || "Competição (outras)";
}
// Só os níveis das turmas (Raíz … Expert): um "Sub-…" na lista de níveis não é um nível.
export const niveisTurmas = (niveis) => (niveis || DEFAULT_NIVEIS).filter((n) => !/^sub/i.test(String(n)));
export function ehEscolinha(t, niveis) {
  return (niveis || DEFAULT_NIVEIS).includes(escalaoDaTurma(t, niveis));
}

// Semana ISO no formato aaaa-Wnn, e etiqueta legível.
export function semanaLabel(key) {
  if (!key) return "";
  const [ano, sem] = String(key).split("-W");
  return `S${sem}/${String(ano).slice(2)}`;
}

// Paleta usada para colorir categorias e temas de forma consistente, já que
// deixaram de ter uma cor fixa por serem listas geríveis pelo utilizador.
export const TAG_PALETTE = [
  { color: COLORS.danger, bg: COLORS.dangerBg },
  { color: COLORS.progress, bg: COLORS.progressBg },
  { color: COLORS.warn, bg: COLORS.warnBg },
  { color: COLORS.purple, bg: COLORS.purpleBg },
  { color: COLORS.ok, bg: COLORS.okBg },
  { color: COLORS.navySoft, bg: COLORS.rule },
];
export function colorForLabel(label) {
  if (!label) return { color: COLORS.slate, bg: COLORS.doneBg };
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

// ---------- Sanções / ocorrências disciplinares ----------
export const MOTIVO_META = {
  ma_conduta: { label: "Má conduta", color: COLORS.warn, bg: COLORS.warnBg },
  ameacas: { label: "Ameaças", color: COLORS.danger, bg: COLORS.dangerBg },
  insultos: { label: "Insultos", color: COLORS.danger, bg: COLORS.dangerBg },
  agressao: { label: "Agressão", color: COLORS.danger, bg: COLORS.dangerBg },
  outro: { label: "Outro", color: COLORS.slate, bg: COLORS.doneBg },
};

// Uma ocorrência de atletas pode ter um ou vários alunos, identificados pelo código.
// (Registos antigos podem ter iniciais em vez do código.)
export function nomesAtletas(s) {
  return (s.atletas || []).map((n) => String(n || "").trim()).filter(Boolean);
}
export function idsFilhos(s) {
  return (s.idsFilhos || []).map((n) => String(n || "").trim()).filter(Boolean);
}
export function nomeOcorrencia(s) {
  if (s.personType === "familia") {
    const ids = idsFilhos(s);
    if (ids.length) return `EE ${ids.length === 1 ? "do aluno" : "dos alunos"} ${ids.join(", ")}`;
    return s.personName || "EE (sem código de aluno)";
  }
  if (s.personType !== "atleta") return s.personName;
  const nomes = nomesAtletas(s);
  if (nomes.length) return nomes.join(", ");
  const n = Number(s.nAtletas) || 1;
  const partes = [`${n} ${n === 1 ? "atleta" : "atletas"}`];
  if (s.escalao) partes.push(s.escalao);
  if (s.referencia) partes.push(s.referencia);
  return partes.join(" · ");
}

// ---------- Stamp badge (signature element) ----------
export function Stamp({ statusKey, onClick }) {
  const meta = STATUS_META[statusKey];
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 3,
        border: `1.5px solid ${meta.color}`,
        color: meta.color,
        background: meta.bg,
        fontVariantNumeric: "tabular-nums",
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 600,
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {statusKey === "por_pegar" && <Inbox size={12} />}
      {statusKey === "em_andamento" && <Clock size={12} />}
      {statusKey === "atrasado" && <AlertTriangle size={12} />}
      {statusKey === "concluido" && <Check size={12} />}
      {meta.label}
    </span>
  );
}

// ---------- Generic small tag (severity / classification) ----------
export function Tag({ label, color, bg, title }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 3,
        border: `1px solid ${color}`,
        color,
        background: bg,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ---------- Entry form ----------
// ---------- Triagem automática: classificador por palavras-chave que aprende ----------
// Não usa nenhuma API paga. Aprende sozinho: sempre que uma reclamação é
// guardada, as palavras da descrição/contexto ficam associadas ao tema,
// categoria, gravidade e canal escolhidos. Ao colar um novo e-mail, soma as
// associações aprendidas (mais umas pistas iniciais) e sugere o valor mais
// provável para cada campo — o utilizador confirma ou corrige sempre.

export const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "que", "para", "com", "uma", "um", "uns", "umas", "este", "esta", "estes",
  "estas", "isso", "isto", "aquilo", "nao", "sim", "foi", "ser", "sido", "tem", "tinha", "teve", "muito",
  "pouco", "mais", "menos", "como", "quando", "onde", "porque", "pois", "mas", "ainda", "sobre", "entre",
  "pela", "pelo", "pelas", "pelos", "esse", "essa", "esses", "essas", "seu", "sua", "seus", "suas", "meu",
  "minha", "meus", "minhas", "nos", "nossa", "nosso", "nossas", "nossos", "eles", "elas", "ele", "ela",
  "isto", "aqui", "ali", "la", "ja", "so", "todo", "toda", "todos", "todas", "outro", "outra", "outros",
  "outras", "mesmo", "mesma", "cada", "qualquer", "algum", "alguma", "alguns", "algumas", "tambem", "depois",
  "antes", "hoje", "ontem", "amanha", "caro", "cara", "prezado", "prezada", "obrigado", "obrigada", "atenciosamente",
  "cumprimentos", "venho", "gostaria", "gostariamos", "informar", "solicitar", "pedir", "the", "and", "for",
]);

export function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

export function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}


// ---------- Estilos partilhados ----------
// São objetos vazios preenchidos por aplicarTema(), para que a troca de tema
// atualize todos os componentes sem ter de passar cores por props.
// Declarados com let porque aplicarTema() os substitui por objetos novos: o
// React congela os objetos de estilo que recebe, por isso não podem ser mutados.
export let labelStyle = {};
export let inputStyle = {};
export let primaryBtnStyle = {};
export let secondaryBtnStyle = {};
export let iconBtnStyle = {};
export let linkBtnStyle = {};
export let panelStyle = {};
export let panelTitle = {};

export function aplicarTema(tema) {
  Object.assign(COLORS, tema === "dark" ? TEMA_ESCURO : TEMA_CLARO);

  labelStyle = {
    display: "block",
    fontSize: 11.5,
    fontWeight: 600,
    color: COLORS.ink2,
    letterSpacing: 0,
    textTransform: "none",
    marginBottom: 5,
    marginTop: 14,
  };

  inputStyle = {
    width: "100%",
    padding: "8px 11px",
    border: `1px solid ${COLORS.rule}`,
    borderRadius: 8,
    fontSize: 13.5,
    color: COLORS.ink,
    background: COLORS.paperRaised,
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  primaryBtnStyle = {
    flex: 1,
    padding: "9px 14px",
    borderRadius: 8,
    border: "none",
    background: COLORS.navy,
    color: COLORS.onAccent,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  secondaryBtnStyle = {
    flex: 1,
    padding: "9px 14px",
    borderRadius: 8,
    border: `1px solid ${COLORS.rule}`,
    background: COLORS.paperRaised,
    color: COLORS.ink,
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    fontFamily: "inherit",
  };

  iconBtnStyle = {
    border: "none",
    background: "transparent",
    color: COLORS.slate,
    cursor: "pointer",
    padding: 4,
    fontFamily: "inherit",
  };

  linkBtnStyle = {
    border: "none",
    background: "transparent",
    color: COLORS.navySoft,
    cursor: "pointer",
    padding: 0,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: "none",
    marginTop: 14,
    fontFamily: "inherit",
  };

  panelStyle = {
    background: COLORS.paperRaised,
    border: `1px solid ${COLORS.rule}`,
    borderRadius: 14,
    padding: "16px 18px",
    boxShadow: COLORS.shadow,
  };

  panelTitle = {
    fontSize: 12.5,
    fontWeight: 600,
    color: COLORS.ink,
    textTransform: "none",
    letterSpacing: "-0.01em",
    marginBottom: 14,
  };
}

aplicarTema("light");

// ---------- Primitivas de interface ----------

// Conta de 0 até ao valor final. Respeita quem desativou animações e trata
// valores com sufixo ("91%", "6,2 d") preservando o formato.
export function Contador({ valor, duracao = 700 }) {
  const texto = String(valor ?? "");
  const match = texto.match(/^(-?[\d.,]+)(.*)$/);
  const alvo = match ? parseFloat(match[1].replace(",", ".")) : null;
  const sufixo = match ? match[2] : "";
  const decimais = match && match[1].includes(",") ? (match[1].split(",")[1] || "").length : 0;

  const [mostrado, setMostrado] = useState(alvo === null ? null : 0);

  useEffect(() => {
    if (alvo === null || isNaN(alvo)) return;
    let reduzido = false;
    try {
      reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      // sem matchMedia: segue com animação
    }
    if (reduzido || duracao === 0) {
      setMostrado(alvo);
      return;
    }
    // Alguns ambientes (testes, renderização no servidor) não têm
    // requestAnimationFrame: nesses casos mostra-se o valor final de imediato.
    const raf = typeof window !== "undefined" && window.requestAnimationFrame;
    const cancel = typeof window !== "undefined" && window.cancelAnimationFrame;
    if (!raf) {
      setMostrado(alvo);
      return;
    }
    let handle;
    const agoraFn = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    const inicio = agoraFn();
    const passo = () => {
      const t = Math.min(1, (agoraFn() - inicio) / duracao);
      // Saída suave: rápido no início, assenta no fim.
      const eased = 1 - Math.pow(1 - t, 3);
      setMostrado(alvo * eased);
      if (t < 1) handle = raf(passo);
    };
    handle = raf(passo);
    return () => cancel && cancel(handle);
  }, [alvo, duracao]);

  if (alvo === null || isNaN(alvo)) return <>{texto}</>;
  const fmt = decimais
    ? mostrado.toFixed(decimais).replace(".", ",")
    : Math.round(mostrado).toLocaleString("pt-PT");
  return (
    <>
      {fmt}
      {sufixo}
    </>
  );
}

// Anel de progresso com o traço a desenhar-se à entrada.
export function AnelProgresso({ pct, tamanho = 64, espessura = 6, cor, rotulo }) {
  const valor = Math.max(0, Math.min(100, Number(pct) || 0));
  const raio = (tamanho - espessura) / 2;
  const perimetro = 2 * Math.PI * raio;
  const [desenhado, setDesenhado] = useState(0);

  useEffect(() => {
    let reduzido = false;
    try {
      reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      // segue com animação
    }
    if (reduzido) {
      setDesenhado(valor);
      return;
    }
    const raf = typeof window !== "undefined" && window.requestAnimationFrame;
    if (!raf) {
      setDesenhado(valor);
      return;
    }
    const id = raf(() => setDesenhado(valor));
    return () => window.cancelAnimationFrame && window.cancelAnimationFrame(id);
  }, [valor]);

  const corFinal = cor || COLORS.navy;
  return (
    <div style={{ position: "relative", width: tamanho, height: tamanho, flex: "none" }}>
      <svg width={tamanho} height={tamanho} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={raio} fill="none" stroke={COLORS.ruleSoft} strokeWidth={espessura} />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={raio}
          fill="none"
          stroke={corFinal}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={perimetro}
          strokeDashoffset={perimetro - (perimetro * desenhado) / 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.25,0.1,0.25,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: tamanho > 56 ? 13 : 11,
          fontWeight: 700,
          color: COLORS.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {rotulo !== undefined ? rotulo : `${Math.round(valor)}%`}
      </div>
    </div>
  );
}

// Blocos cinzentos com brilho a passar, na forma do conteúdo que vai chegar.
export function Esqueleto({ altura = 14, largura = "100%", radius = 6, style }) {
  return <div className="shimmer" style={{ height: altura, width: largura, borderRadius: radius, ...style }} />;
}

export function EsqueletoPagina() {
  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...panelStyle, flex: 1, minWidth: 140 }}>
            <Esqueleto altura={11} largura="60%" />
            <Esqueleto altura={24} largura="45%" style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <Esqueleto altura={12} largura={160} />
        <Esqueleto altura={190} radius={10} style={{ marginTop: 14 }} />
      </div>
      <div style={panelStyle}>
        <Esqueleto altura={12} largura={120} />
        {[0, 1, 2, 3, 4].map((i) => (
          <Esqueleto key={i} altura={16} style={{ marginTop: 12 }} />
        ))}
      </div>
    </div>
  );
}

// Estado vazio com ícone, explicação e, quando faz sentido, uma ação.
export function Vazio({ icon: Icon, titulo, texto, acao, onAcao }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        background: COLORS.paperRaised,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 14,
      }}
    >
      {Icon && (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: COLORS.navyWash,
            display: "grid",
            placeItems: "center",
            margin: "0 auto 14px",
          }}
        >
          <Icon size={22} color={COLORS.navySoft} />
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>{titulo}</div>
      {texto && <div style={{ fontSize: 13, color: COLORS.ink2, maxWidth: 360, margin: "0 auto", lineHeight: 1.55 }}>{texto}</div>}
      {acao && onAcao && (
        <button className="press" onClick={onAcao} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px", marginTop: 16 }}>
          {acao}
        </button>
      )}
    </div>
  );
}

// ---------- Stat card ----------
export function StatCard({ label, value, color, subtitle, anel }) {
  return (
    <div
      className="liftable"
      style={{
        background: COLORS.paperRaised,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 14,
        padding: "14px 16px",
        flex: 1,
        minWidth: 140,
        boxShadow: COLORS.shadow,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: COLORS.ink2, fontWeight: 500 }}>{label}</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: color || COLORS.ink,
              lineHeight: 1,
              marginTop: 7,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Contador valor={value} />
          </div>
          {subtitle && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>{subtitle}</div>}
        </div>
        {anel !== null && anel !== undefined && (
          <AnelProgresso pct={anel} tamanho={52} espessura={5} cor={color} rotulo="" />
        )}
      </div>
    </div>
  );
}

// Área / departamento sugerido para um assunto, pelas palavras que contém.
export const PISTAS_AREA = [
  [/fisio|medic|saude|socorr|lesao|enferm/, ["medica"]],
  [/instala|equipamen|material|seguran|balneari|baliz|estrutur|limpez|campo|espaco/, ["instalacoes"]],
  [/treinador|tecnic|treino|planeamento|exercic|sessao|coordenador tecnico|metodolog/, ["tecnica"]],
  [/secretari|administr|documenta|registo|ficha|inscri|pagamento|organizacao|processo|sgq|gestao da qualidade|software|arquivo|decoracao|publicidade/, ["administrativa"]],
  [/escolar|social|pais|encarregad|comunicac|atendimento|evento|alunos/, ["escolar", "social"]],
];
export function areaSugerida(assunto, areas, mapa) {
  const n = normChave(assunto);
  if (!n) return "";
  if (mapa && mapa[n] && areas.includes(mapa[n])) return mapa[n];
  const exata = areas.find((a) => normChave(a) === n);
  if (exata) return exata;
  for (const [re, chaves] of PISTAS_AREA) {
    if (re.test(n)) {
      const a = areas.find((x) => chaves.some((c) => normChave(x).includes(c)));
      if (a) return a;
    }
  }
  return "";
}

// Palavras com significado de um texto (sem acentos, sem palavras pequenas).
export const palavrasDe = (t) =>
  normChave(t)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .map((w) => w.replace(/(oes|aes|ais|eis|s)$/, ""));

// Categoria mais provável para uma constatação: a da lista cujo nome aparece no texto,
// ou a que partilha mais palavras com o título e a análise de causas.
export function categoriaSugerida(texto, categorias) {
  const n = normChave(texto);
  if (!n || !categorias || !categorias.length) return null;
  const pal = new Set(palavrasDe(texto));
  let melhor = null;
  categorias.forEach((c) => {
    const nc = normChave(c);
    if (!nc) return;
    let s = 0;
    if (n.includes(nc)) s += 10;
    const pc = palavrasDe(c);
    const comuns = pc.filter((w) => pal.has(w)).length;
    if (pc.length) s += (comuns / pc.length) * 6 + comuns;
    if (s > 0 && (!melhor || s > melhor.s)) melhor = { c, s };
  });
  return melhor && melhor.s >= 2 ? melhor.c : null;
}

// Sugestão de área e categoria para uma constatação, a partir do título e da análise de causas.
export function sugerirAreaCategoria(f, areas, categorias, mapaAreas) {
  const titulo = f.description || "";
  const causas = [f.analiseCausas, f.acao].filter(Boolean).join(" ");
  const catTitulo = categoriaSugerida(titulo, categorias);
  const category = f.category || catTitulo || categoriaSugerida(`${titulo} ${causas}`, categorias) || "";
  const deCat = category ? areaSugerida(category, areas, mapaAreas) : "";
  const deTitulo = areaSugerida(titulo, areas, mapaAreas);
  const area = f.area || deCat || deTitulo || areaSugerida(causas, areas, mapaAreas) || "";
  const origem = (campo, atual, deTit) => (atual ? "já tinha" : !campo ? "sem pista" : deTit ? "pelo título" : "pela análise de causas");
  return {
    area,
    category,
    origemArea: origem(area, f.area, deCat || deTitulo),
    origemCat: origem(category, f.category, catTitulo),
  };
}

// Revisão das sugestões de área e categoria. itens: [{ auditId, f, rotulo }].
export function PreencherAreasCategorias({ itens, areas, categorias, mapaAreas, onAplicar, onFechar, embutido, onGerirLista }) {
  const [linhas, setLinhas] = useState(() =>
    itens.map((it) => {
      const s = sugerirAreaCategoria(it.f, areas, categorias, mapaAreas);
      return { ...it, ...s, incluir: Boolean((s.area && !it.f.area) || (s.category && !it.f.category)) };
    })
  );
  const muda = (i, campos) => setLinhas((l) => l.map((x, j) => (j === i ? { ...x, ...campos } : x)));
  const aAplicar = linhas.filter((x) => x.incluir && (x.area !== (x.f.area || "") || x.category !== (x.f.category || "")));
  const semPista = linhas.filter((x) => !x.area || !x.category).length;
  const tag = (txt) => (
    <span style={{ fontSize: 10.5, color: txt === "já tinha" ? COLORS.slate : txt === "sem pista" ? COLORS.warn : COLORS.ok, whiteSpace: "nowrap" }}>{txt}</span>
  );
  const corpo = (
    <>
      <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.55, marginBottom: 12 }}>
        A app propõe a área / departamento e a categoria de cada constatação pelo título e pela análise de causas. Revê, corrige o que for preciso e aplica só as que estão marcadas.
        {onGerirLista && (
          <>
            {" "}
            <button onClick={() => onGerirLista("auditCategories")} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
              Gerir categorias
            </button>
          </>
        )}
      </div>
      {categorias.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.warn, marginBottom: 10 }}>Ainda não há categorias na lista: só a área pode ser sugerida.</div>}
      <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden", maxHeight: embutido ? 360 : "none", overflowY: embutido ? "auto" : "visible" }}>
        {linhas.map((x, i) => (
          <div key={`${x.auditId}|${x.f.id}`} style={{ padding: "9px 12px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 12.5, background: x.incluir ? "transparent" : COLORS.paperSunken }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={x.incluir} onChange={(e) => muda(i, { incluir: e.target.checked })} style={{ marginTop: 3 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {x.rotulo && <span style={{ fontSize: 11, color: COLORS.slate }}>{x.rotulo} · </span>}
                <strong style={{ fontWeight: 600 }}>{x.f.classification || "—"}</strong> {x.f.description || "(sem título)"}
                {x.f.analiseCausas && <span style={{ display: "block", fontSize: 11.5, color: COLORS.slate, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Causas: {x.f.analiseCausas}</span>}
              </span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginTop: 7, paddingLeft: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select value={x.area} onChange={(e) => muda(i, { area: e.target.value, origemArea: "escolhida", incluir: true })} aria-label="Área" style={{ ...inputStyle, padding: "5px 8px", fontSize: 12.5, borderColor: x.area ? undefined : COLORS.warn }}>
                  <option value="">Sem área</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                {tag(x.origemArea)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select value={x.category} onChange={(e) => muda(i, { category: e.target.value, origemCat: "escolhida", incluir: true })} aria-label="Categoria" style={{ ...inputStyle, padding: "5px 8px", fontSize: 12.5, borderColor: x.category ? undefined : COLORS.warn }}>
                  <option value="">Sem categoria</option>
                  {[...new Set([...categorias, x.f.category].filter(Boolean))].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {tag(x.origemCat)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 12, color: semPista ? COLORS.warn : COLORS.slate }}>{semPista ? `${semPista} sem área ou categoria sugerida: escolhe à mão` : "Todas com sugestão"}</span>
        <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "8px 14px" }}>
          Cancelar
        </button>
        <button
          disabled={!aAplicar.length}
          onClick={() => onAplicar(aAplicar.map((x) => ({ auditId: x.auditId, findingId: x.f.id, patch: { area: x.area, category: x.category } })))}
          style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "8px 16px", opacity: aAplicar.length ? 1 : 0.5 }}
        >
          Aplicar a {aAplicar.length} {aAplicar.length === 1 ? "constatação" : "constatações"}
        </button>
      </div>
    </>
  );
  if (embutido) return <div style={{ padding: 12, borderRadius: 10, background: COLORS.paperSunken, border: `1px solid ${COLORS.rule}`, marginBottom: 14 }}>{corpo}</div>;
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(820px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Preencher área e categoria</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {itens.length === 0 ? <div style={{ fontSize: 13, color: COLORS.ink2 }}>Todas as constatações já têm área e categoria.</div> : corpo}
      </div>
    </div>
  );
}

// Seletor do requisito ISO, agrupado pelos capítulos da norma.
export function SeletorISO({ valor, onChange, style, vazio = "Sem requisito ISO" }) {
  const grupos = {};
  REQUISITOS_ISO.forEach((r) => {
    const g = r.c.split(".")[0];
    (grupos[g] = grupos[g] || []).push(r);
  });
  return (
    <select value={valor || ""} onChange={(e) => onChange(e.target.value)} aria-label="Requisito ISO 9001" title={valor ? rotuloISO(valor) : "Requisito ISO 9001"} style={style}>
      <option value="">{vazio}</option>
      {Object.entries(grupos).map(([g, rs]) => (
        <optgroup key={g} label={GRUPOS_ISO[g]}>
          {rs.map((r) => (
            <option key={r.c} value={r.c}>
              {r.c} {r.t}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export const CERTEZA_ISO = {
  alta: { rotulo: "certeza alta", cor: () => COLORS.ok },
  media: { rotulo: "por confirmar", cor: () => COLORS.warn },
  baixa: { rotulo: "sem certeza: escolhe", cor: () => COLORS.warn },
};

// Revisão em lote do requisito ISO. itens: [{ auditId, f, rotulo }].
// As de certeza alta vêm marcadas; as outras ficam por confirmar.
export function AssociarISO({ itens, onAplicar, onFechar, embutido }) {
  const [linhas, setLinhas] = useState(() =>
    itens.map((it) => {
      const s = sugerirRequisitoISO(it.f);
      return { ...it, iso: s.c, certeza: s.certeza, alternativas: s.alternativas, incluir: s.certeza === "alta" && !!s.c };
    })
  );
  const [so, setSo] = useState("todas");
  const muda = (i, campos) => setLinhas((l) => l.map((x, j) => (j === i ? { ...x, ...campos } : x)));
  const aAplicar = linhas.filter((x) => x.incluir && x.iso);
  const n = (c) => linhas.filter((x) => x.certeza === c).length;
  const visiveis = linhas.map((x, i) => ({ x, i })).filter(({ x }) => so === "todas" || (so === "duvida" ? x.certeza !== "alta" : x.certeza === "alta"));
  const corpo = (
    <>
      <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.55, marginBottom: 10 }}>
        A app propõe o requisito da NP EN ISO 9001:2015 pelo texto, pela categoria e pela área. As de certeza alta vêm marcadas. Nas outras, confirma ou escolhe o requisito e marca a linha.
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, fontSize: 12 }}>
        {[
          ["todas", `Todas (${linhas.length})`],
          ["duvida", `Por confirmar (${n("media") + n("baixa")})`],
          ["alta", `Certeza alta (${n("alta")})`],
        ].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSo(k)} style={{ border: `1px solid ${so === k ? COLORS.navy : COLORS.rule}`, background: so === k ? COLORS.navy : "transparent", color: so === k ? COLORS.onAccent : COLORS.ink2, borderRadius: 14, padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden", maxHeight: embutido ? 380 : "none", overflowY: embutido ? "auto" : "visible" }}>
        {visiveis.map(({ x, i }, k) => (
          <div key={`${x.auditId}|${x.f.id}`} style={{ padding: "9px 12px", borderTop: k ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 12.5, background: x.incluir ? "transparent" : COLORS.paperSunken }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={x.incluir} disabled={!x.iso} onChange={(e) => muda(i, { incluir: e.target.checked })} style={{ marginTop: 3 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {x.rotulo && <span style={{ fontSize: 11, color: COLORS.slate }}>{x.rotulo} · </span>}
                <strong style={{ fontWeight: 600 }}>{x.f.classification || "—"}</strong> {x.f.description || "(sem título)"}
                {(x.f.area || x.f.category) && <span style={{ display: "block", fontSize: 11.5, color: COLORS.slate, marginTop: 2 }}>{[x.f.area, x.f.category].filter(Boolean).join(" · ")}</span>}
              </span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, paddingLeft: 24, flexWrap: "wrap" }}>
              <SeletorISO valor={x.iso} onChange={(v) => muda(i, { iso: v, certeza: v ? "alta" : "baixa", incluir: !!v, escolhida: true })} style={{ ...inputStyle, padding: "5px 8px", fontSize: 12.5, flex: "1 1 260px", borderColor: x.iso ? undefined : COLORS.warn }} vazio="Escolher requisito…" />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: x.escolhida ? COLORS.slate : CERTEZA_ISO[x.certeza].cor(), whiteSpace: "nowrap" }}>{x.escolhida ? "escolhido" : CERTEZA_ISO[x.certeza].rotulo}</span>
              {!x.escolhida && x.alternativas.length > 0 && (
                <span style={{ fontSize: 11, color: COLORS.slate }}>
                  ou{" "}
                  {x.alternativas.map((c, j) => (
                    <button key={c} type="button" onClick={() => muda(i, { iso: c, incluir: true, escolhida: true })} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 11 }} title={rotuloISO(c)}>
                      {j ? ", " : ""}
                      {c}
                    </button>
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}
        {!visiveis.length && <div style={{ padding: 12, fontSize: 12.5, color: COLORS.slate }}>Nada neste filtro.</div>}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ flex: 1, fontSize: 12, color: COLORS.slate }}>{linhas.length - aAplicar.length} ficam por associar</span>
        <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "8px 14px" }}>
          Cancelar
        </button>
        <button
          disabled={!aAplicar.length}
          onClick={() => onAplicar(aAplicar.map((x) => ({ auditId: x.auditId, findingId: x.f.id, patch: { iso: x.iso, isoOrigem: "confirmado" } })))}
          style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "8px 16px", opacity: aAplicar.length ? 1 : 0.5 }}
        >
          Associar {aAplicar.length} {aAplicar.length === 1 ? "constatação" : "constatações"}
        </button>
      </div>
    </>
  );
  if (embutido) return <div className="semFoto" style={{ padding: 12, borderRadius: 10, background: COLORS.paperSunken, border: `1px solid ${COLORS.rule}`, marginBottom: 14 }}>{corpo}</div>;
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(860px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Requisitos ISO 9001 das constatações</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {itens.length === 0 ? <div style={{ fontSize: 13, color: COLORS.ink2 }}>Todas as constatações já têm requisito ISO.</div> : corpo}
      </div>
    </div>
  );
}

// ======================= E-MAILS ÀS ESCOLAS =======================
// Contactos (vários e-mails por escola), pedido de envio, respostas dos operacionais
// e confirmação dos códigos dos alunos que eles indicam para as turmas sem alunos.
export const MOTIVOS_EXPERIENCIA_PADRAO = ["Técnico (treino ou treinador)", "Horário", "Preço", "Distância ou transporte", "Escolheu outro clube", "Outra modalidade", "Família sem resposta", "Outro"];

// ---------- Espaços: mapa de ocupação com lotação automática ----------
// Turmas de um bloco do mapa (os blocos antigos tinham uma só turma).
export const turmasDoBloco = (b) => (Array.isArray(b.turmas) && b.turmas.length ? b.turmas : b.turma ? [b.turma] : []);

// Alunos inscritos numa data (entraram até lá e não tinham saído).
export function alunosNaData(reg, data) {
  return Object.values((reg && reg.alunos) || {}).filter((a) => (!a.entrada || a.entrada <= data) && (a.estado === "ativo" || !a.saida || a.saida > data));
}

export function contasEvento(ev, registoAlunos, niveis) {
  const ep = epocaDe(ev.data);
  const reg = registoAlunos[ep];
  const excluidas = new Set(ev.excluidas || []);
  const escolasEv = ev.escolas && ev.escolas.length ? ev.escolas.filter((e) => !excluidas.has(e)) : null;
  const escaloes = ev.escaloes && ev.escaloes.length ? new Set(ev.escaloes) : null;
  const elegivel = (a) => !excluidas.has(a.escola) && (!escolasEv || escolasEv.includes(a.escola)) && (!escaloes || escaloes.has(escalaoDaTurma(a.turma, niveis)));
  let naData = alunosNaData(reg, ev.data);
  // Escolas carregadas depois da data do evento: os alunos têm "entrada" posterior (data da
  // importação) e ficariam de fora. Se a escola não tem nenhum aluno à data, contam todos os que
  // lá estão (sem saída marcada antes do evento).
  const comAlunosNaData = new Set(naData.map((a) => a.escola));
  const tardios = Object.values((reg && reg.alunos) || {}).filter((a) => !comAlunosNaData.has(a.escola) && (a.estado === "ativo" || !a.saida || a.saida > ev.data));
  if (tardios.length) naData = [...naData, ...tardios];
  const eleg = naData.filter(elegivel);
  // Decisões tomadas na revisão dos casos (por código do Excel): corrigir o código, contar numa
  // escola mesmo fora do público, ou não contar. Valem para as próximas atualizações do Excel.
  const dec = (ev.participantes && ev.participantes.decisoes) || {};
  let ignorados = 0;
  const pares = [];
  ((ev.participantes && ev.participantes.ids) || []).map(String).forEach((raw) => {
    const d = dec[raw];
    if (d && d.acao === "ignorar") return ignorados++;
    pares.push({ raw, id: d && d.acao === "corrigir" && d.novo ? String(d.novo) : raw, d });
  });
  const ids = new Set(pares.map((x) => x.id));
  const porEscola = {};
  const linha = (e) => (porEscola[e] = porEscola[e] || { escola: e, elegiveis: 0, inscritos: 0, fora: 0 });
  (escolasEv || [...new Set(eleg.map((a) => a.escola))]).forEach(linha);
  eleg.forEach((a) => {
    const l = linha(a.escola);
    l.elegiveis++;
    if (ids.has(String(a.id))) l.inscritos++;
  });
  // Inscritos no evento que não são do público definido (outra escola ou escalão).
  const porId = Object.fromEntries(naData.map((a) => [String(a.id), a]));
  let semCorrespondencia = 0;
  let foraEscolas = 0;
  let contadosAMao = 0;
  const casos = [];
  const vistos = new Set();
  pares.forEach(({ raw, id, d }) => {
    if (vistos.has(id)) return;
    vistos.add(id);
    const a = porId[id] || (reg && reg.alunos && reg.alunos[id]);
    if (a && elegivel(a) && porId[id]) return; // já contado nos elegíveis
    // "Contar na mesma": entra como inscrito (e elegível) na escola escolhida.
    if (d && d.acao === "contar" && (d.escola || (a && a.escola))) {
      const l = linha(d.escola || a.escola);
      l.inscritos++;
      l.elegiveis++;
      contadosAMao++;
      return;
    }
    if (!a) {
      semCorrespondencia++;
      casos.push({ raw, id, motivo: "sem registo" });
    } else if (!elegivel(a)) {
      if (porEscola[a.escola]) porEscola[a.escola].fora++;
      else foraEscolas++;
      casos.push({ raw, id, motivo: porEscola[a.escola] ? "outra turma/equipa" : "escola fora do público", escola: a.escola });
    } else {
      semCorrespondencia++; // existe mas não estava ativo na data do evento
      casos.push({ raw, id, motivo: "não estava ativo na data", escola: a.escola });
    }
  });
  // Excel sem código: contagem por escola (nome do Excel → escola da app), só dos escalões do evento.
  const bruto = (ev.participantes && ev.participantes.porEscola) || {};
  const mapa = (ev.participantes && ev.participantes.mapa) || {};
  const escNorm = (k) => normChave(k).replace(/s$/, "");
  const escalaoOk = (k) => !escaloes || [...escaloes].some((x) => escNorm(x) === escNorm(k));
  let semEscola = 0;
  Object.entries(bruto).forEach(([raw, x]) => {
    const e = mapa[raw];
    const dentro = Object.keys(x.porEscalao || {}).length ? Object.entries(x.porEscalao).reduce((t, [k, n]) => t + (escalaoOk(k) ? n : 0), 0) : x.total;
    if (!e) {
      semEscola += x.total;
      return;
    }
    if (!porEscola[e] && escolasEv) {
      foraEscolas += x.total;
      return;
    }
    const l = linha(e);
    l.inscritos += dentro;
    l.fora += x.total - dentro;
  });
  // Contagens escritas à mão substituem as do Excel.
  Object.entries((ev.participantes && ev.participantes.manual) || {}).forEach(([e, n]) => {
    if (n === "" || n === null || n === undefined) return;
    linha(e).inscritos = Number(n) || 0;
  });
  const linhas = Object.values(porEscola).sort((a, b) => b.elegiveis - a.elegiveis || a.escola.localeCompare(b.escola, "pt"));
  // Na adesão só contam as escolas com elegíveis; o resto fica explicado à parte.
  const tot = linhas.filter((l) => l.elegiveis > 0).reduce((t, l) => ({ elegiveis: t.elegiveis + l.elegiveis, inscritos: t.inscritos + l.inscritos, fora: t.fora + l.fora }), { elegiveis: 0, inscritos: 0, fora: 0 });
  const semElegiveis = linhas.filter((l) => !l.elegiveis).reduce((t, l) => t + l.inscritos, 0);
  const lidos = ids.size || Object.values(bruto).reduce((t, x) => t + x.total, 0);
  return { ep, temRegisto: !!reg, linhas, tot, lidos, semElegiveis, semCorrespondencia, foraEscolas, semEscola, ignorados, contadosAMao, casos, adesao: tot.elegiveis ? (tot.inscritos / tot.elegiveis) * 100 : null };
}

export function normChave(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Semanas da época desportiva: a época vai de 1 de agosto a 31 de julho e a
// semana 1 começa sempre a 1 de agosto (7 dias por semana a partir daí).
export function semana1Padrao(epoca) {
  const ano = Number(String(epoca).slice(0, 4)) || new Date().getFullYear();
  return `${ano}-08-01`;
}
export const semanaDaEpoca = (iso, s1) => (iso ? Math.min(53, Math.max(1, Math.floor((Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") - Date.parse(s1 + "T00:00:00Z")) / (7 * 86400000)) + 1)) : null);
export const inicioSemanaEpoca = (k, s1) => {
  const d = new Date(s1 + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + (k - 1) * 7);
  return d.toISOString().slice(0, 10);
};
// As semanas contam-se sempre pelas datas, a partir do início da semana 1 da época.
export const semanaEntradaDe = (a, s1) => (a.entrada ? semanaDaEpoca(a.entrada, s1) : a.semEntrada || 1);
export const semanaSaidaDe = (a, s1) => (a.estado === "desistiu" ? (a.saida ? semanaDaEpoca(a.saida, s1) : a.semSaida) : null);
export const semanaExpDe = (x, s1) => (x.data ? semanaDaEpoca(x.data, s1) : x.semana);

// Balanço de cada semana da época: entradas, desistências, experiências e alunos no fim.
export function balancoSemanal(reg, escola, epoca) {
  if (!reg) return [];
  const s1 = semana1Padrao(epoca);
  const alunos = Object.values(reg.alunos || {}).filter((a) => !escola || a.escola === escola);
  const exps = Object.values(reg.experiencias || {}).filter((x) => !escola || x.escola === escola);
  if (!alunos.length && !exps.length) return [];
  const sems = [...alunos.map((a) => semanaEntradaDe(a, s1)), ...alunos.map((a) => semanaSaidaDe(a, s1)), ...exps.map((x) => semanaExpDe(x, s1))].filter(Boolean);
  const emCurso = epocaDe(isoDe(new Date())) === epoca;
  const ultima = Math.min(53, emCurso ? Math.max(semanaDaEpoca(isoDe(new Date()), s1), ...sems) : Math.max(...sems));
  const linhas = [];
  for (let k = 1; k <= ultima; k++) {
    const ini = inicioSemanaEpoca(k, s1);
    const fimD = new Date(ini + "T00:00:00Z");
    fimD.setUTCDate(fimD.getUTCDate() + 6);
    const entradas = alunos.filter((a) => semanaEntradaDe(a, s1) === k);
    const saidas = alunos.filter((a) => semanaSaidaDe(a, s1) === k);
    const ativos = alunos.filter((a) => semanaEntradaDe(a, s1) <= k && !(semanaSaidaDe(a, s1) && semanaSaidaDe(a, s1) <= k)).length;
    linhas.push({
      k,
      semana: semanaISO(new Date(ini + "T12:00:00")),
      ini,
      // A última semana acaba a 31 de julho.
      fim: [fimD.toISOString().slice(0, 10), `${Number(String(epoca).slice(0, 4)) + 1}-07-31`].sort()[0],
      entradas: entradas.length,
      novos: entradas.filter((a) => a.rubrica !== "renov").length,
      renov: entradas.filter((a) => a.rubrica === "renov").length,
      desist: saidas.length,
      exp: exps.filter((x) => semanaExpDe(x, s1) === k).length,
      ativos,
    });
  }
  // As semanas antes da primeira entrada não interessam.
  const primeira = linhas.findIndex((l) => l.ativos || l.exp || l.desist);
  const uteis = primeira > 0 ? linhas.slice(primeira) : linhas;
  return uteis.map((l, i) => ({ ...l, variacao: i ? l.ativos - uteis[i - 1].ativos : l.ativos }));
}

// ---------- Indicadores dos inscritos ----------
// Saem do registo de alunos de cada época. Cada indicador mostra uma coluna por época escolhida.
export const fimEpocaISO = (ep) => `${Number(ep.slice(0, 4)) + 1}-07-31`;
export const diasEntreISO = (a, b) => Math.round((new Date(String(b).slice(0, 10) + "T00:00:00") - new Date(String(a).slice(0, 10) + "T00:00:00")) / 86400000);
export const pctDe = (a, b) => (b ? (a / b) * 100 : null);

export function indicadoresDaEpoca(ep, registoAlunos, niveis, capacidades, escola) {
  const reg = registoAlunos[ep];
  if (!reg) return null;
  const daEsc = (a) => !escola || a.escola === escola;
  const al = Object.values(reg.alunos || {}).filter(daEsc);
  const ativos = al.filter((a) => a.estado === "ativo");
  const desist = al.filter((a) => a.estado === "desistiu");
  const tipo = (t) => (ehEscolinha(t, niveis) ? "turma" : "competicao");

  // 1 e 7. Retenção e transição a partir da época anterior.
  const regAnt = registoAlunos[epAntDe(ep)];
  let ret = null;
  let trans = null;
  if (regAnt) {
    const todosAgora = reg.alunos || {};
    const base = Object.values(regAnt.alunos || {}).filter((a) => a.estado === "ativo" && !a.semCodigo && daEsc(a));
    const porEscalao = {};
    const porEscola = {};
    let voltaram = 0;
    let mudaram = 0;
    const t = { turma: { turma: 0, competicao: 0, saiu: 0 }, competicao: { turma: 0, competicao: 0, saiu: 0 } };
    const perdaEscalao = {};
    base.forEach((a) => {
      const n = todosAgora[a.id];
      const k = escalaoDaTurma(a.turma, niveis);
      const x = (porEscalao[k] = porEscalao[k] || { base: 0, voltaram: 0, mudaram: 0 });
      const y = (porEscola[a.escola] = porEscola[a.escola] || { base: 0, voltaram: 0, mudaram: 0 });
      x.base++;
      y.base++;
      const origem = tipo(a.turma);
      if (n) {
        voltaram++;
        x.voltaram++;
        y.voltaram++;
        if (n.escola !== a.escola) {
          mudaram++;
          x.mudaram++;
          y.mudaram++;
        }
        t[origem][tipo(n.turma)]++;
      } else {
        t[origem].saiu++;
        if (origem === "turma") perdaEscalao[k] = (perdaEscalao[k] || 0) + 1;
      }
    });
    ret = { base: base.length, voltaram, mudaram, taxa: pctDe(voltaram, base.length), porEscalao, porEscola };
    // Os que estavam no último escalão de turmas e podiam passar para competição.
    const ultimo = niveisTurmas(niveis).slice(-1)[0];
    const doUltimo = base.filter((a) => escalaoDaTurma(a.turma, niveis) === ultimo);
    const passaram = doUltimo.filter((a) => todosAgora[a.id] && tipo(todosAgora[a.id].turma) === "competicao").length;
    // Todos os que estavam em turmas (qualquer nível) e agora estão numa equipa de competição.
    const deTurmas = t.turma.turma + t.turma.competicao + t.turma.saiu;
    const porNivel = {};
    base
      .filter((a) => tipo(a.turma) === "turma")
      .forEach((a) => {
        const k = escalaoDaTurma(a.turma, niveis);
        const x = (porNivel[k] = porNivel[k] || { base: 0, passaram: 0 });
        x.base++;
        if (todosAgora[a.id] && tipo(todosAgora[a.id].turma) === "competicao") x.passaram++;
      });
    trans = { t, perdaEscalao, ultimo, doUltimo: doUltimo.length, passaram, perdidos: doUltimo.filter((a) => !todosAgora[a.id]).length, deTurmas, paraCompeticao: t.turma.competicao, porNivel };
  }

  // 2. Momento da desistência.
  const meses = {};
  const semanas = { ate4: 0, ate12: 0, ate24: 0, mais: 0, sem: 0 };
  desist.forEach((a) => {
    if (a.saida) meses[Number(a.saida.slice(5, 7)) - 1] = (meses[Number(a.saida.slice(5, 7)) - 1] || 0) + 1;
    if (!a.saida || !a.entrada) return semanas.sem++;
    const w = diasEntreISO(a.entrada, a.saida) / 7;
    if (w <= 4) semanas.ate4++;
    else if (w <= 12) semanas.ate12++;
    else if (w <= 24) semanas.ate24++;
    else semanas.mais++;
  });
  const comDur = desist.filter((a) => a.saida && a.entrada).map((a) => diasEntreISO(a.entrada, a.saida) / 7);

  // 3. Desistência de novos e de quem renovou.
  const renov = al.filter((a) => a.rubrica === "renov");
  const novos = al.filter((a) => a.rubrica !== "renov");
  const novosRen = {
    renov: renov.length,
    renovDes: renov.filter((a) => a.estado === "desistiu").length,
    novos: novos.length,
    novosDes: novos.filter((a) => a.estado === "desistiu").length,
  };

  // 4. Ocupação face à capacidade (turmas com alunos ativos).
  const porTurma = {};
  ativos.filter((a) => tipo(a.turma) === "turma").forEach((a) => {
    const kk = `${a.escola}|${a.turma}`;
    const x = (porTurma[kk] = porTurma[kk] || { escola: a.escola, turma: a.turma, n: 0, cap: (capacidades || {})[kk] || capacidadeSugerida(a.turma, niveis) || 0 });
    x.n++;
  });
  const turmasL = Object.values(porTurma);
  const ocupEscola = {};
  const ocupEscalao = {};
  turmasL.forEach((x) => {
    const e = (ocupEscola[x.escola] = ocupEscola[x.escola] || { n: 0, cap: 0, turmas: [] });
    e.n += x.n;
    e.cap += x.cap;
    e.turmas.push(x);
    const k = escalaoDaTurma(x.turma, niveis);
    const z = (ocupEscalao[k] = ocupEscalao[k] || { n: 0, cap: 0 });
    z.n += x.n;
    z.cap += x.cap;
  });
  const lugares = turmasL.reduce((t, x) => t + x.cap, 0);

  // 5. Tempo de conversão das experiências.
  const exps = Object.values(reg.experiencias || {}).filter(daEsc);
  const conv = exps.filter((x) => (reg.alunos || {})[x.id]);
  const dias = conv.map((x) => (x.data && reg.alunos[x.id].entrada ? diasEntreISO(x.data, reg.alunos[x.id].entrada) : null)).filter((d) => d !== null && d >= 0).sort((a, b) => a - b);
  const mediana = dias.length ? dias[Math.floor(dias.length / 2)] : null;
  const expEscola = {};
  const expMes = {};
  exps.forEach((x) => {
    const c = (reg.alunos || {})[x.id] ? 1 : 0;
    const e = (expEscola[x.escola] = expEscola[x.escola] || { n: 0, conv: 0 });
    e.n++;
    e.conv += c;
    if (x.data) {
      const m = Number(String(x.data).slice(5, 7)) - 1;
      const z = (expMes[m] = expMes[m] || { n: 0, conv: 0 });
      z.n++;
      z.conv += c;
    }
  });

  // 6. Feminino por escalão.
  const comGenero = ativos.filter((a) => a.genero);
  const femEscalao = {};
  comGenero.forEach((a) => {
    const k = escalaoDaTurma(a.turma, niveis);
    const x = (femEscalao[k] = femEscalao[k] || { n: 0, f: 0 });
    x.n++;
    if (a.genero === "f") x.f++;
  });

  // 8. Concentração e turmas abaixo de 50% há várias semanas.
  const hoje = isoDe(new Date());
  const refData = ep === epocaDe(hoje) ? hoje : fimEpocaISO(ep);
  const SEMANAS = 8;
  const datas = Array.from({ length: SEMANAS }, (_, i) => {
    const d = new Date(refData + "T00:00:00");
    d.setDate(d.getDate() - 7 * i);
    return isoDe(d);
  });
  const naData = datas.map((d) => alunosNaData(reg, d).filter(daEsc));
  const contaTurma = (lista) => {
    const c = {};
    lista.forEach((a) => (c[`${a.escola}|${a.turma}`] = (c[`${a.escola}|${a.turma}`] || 0) + 1));
    return c;
  };
  const contas = naData.map(contaTurma);
  const baixas = turmasL
    .map((x) => {
      const kk = `${x.escola}|${x.turma}`;
      let seguidas = 0;
      for (let i = 0; i < SEMANAS; i++) {
        if (x.cap && (contas[i][kk] || 0) / x.cap < 0.5) seguidas++;
        else break;
      }
      return { ...x, seguidas };
    })
    .filter((x) => x.seguidas >= 4)
    .sort((a, b) => b.seguidas - a.seguidas || a.n / a.cap - b.n / b.cap);
  const concentracao = Object.entries(ocupEscola).map(([e, x]) => {
    const top = [...x.turmas].sort((a, b) => b.n - a.n).slice(0, 3);
    return { escola: e, total: x.n, turmas: x.turmas.length, top, pct: pctDe(top.reduce((t, y) => t + y.n, 0), x.n) };
  });

  return {
    ep,
    ativos: ativos.length,
    entradas: al.length,
    ret,
    trans,
    desist: desist.length,
    meses,
    semanas,
    medianaSemanas: comDur.length ? [...comDur].sort((a, b) => a - b)[Math.floor(comDur.length / 2)] : null,
    novosRen,
    lugares,
    ocupados: turmasL.reduce((t, x) => t + x.n, 0),
    ocupEscola,
    ocupEscalao,
    exps: exps.length,
    conv: conv.length,
    mediana,
    ate7: dias.filter((d) => d <= 7).length,
    comDias: dias.length,
    expEscola,
    expMes,
    fem: pctDe(comGenero.filter((a) => a.genero === "f").length, comGenero.length),
    femEscalao,
    baixas,
    concentracao,
    refData,
  };
}

export const epAntDe = (ep) => `${Number(ep.slice(0, 4)) - 1}/${ep.slice(2, 4)}`;

// ---------- Métricas ----------
// Satisfeitos: quartil de cima da escala (4–5 em 1–5; 8–10 em 0–10).
// Insatisfeitos: quartil de baixo (1–2 em 1–5; 0–2 em 0–10).
export function limitesEscala(p) {
  const amp = p.max - p.min;
  return { sat: Math.ceil(p.min + 0.75 * amp - 1e-9), insat: Math.floor(p.min + 0.25 * amp + 1e-9) };
}

export function resumoContagens(p, contagens) {
  const c = contagens || {};
  let n = 0;
  let sat = 0;
  let insat = 0;
  let soma = 0;
  let prom = 0;
  let detr = 0;
  const { sat: lSat, insat: lInsat } = limitesEscala(p);
  Object.entries(c).forEach(([v, q]) => {
    const x = Number(v);
    n += q;
    soma += x * q;
    if (x >= lSat) sat += q;
    if (x <= lInsat) insat += q;
    if (x >= 9) prom += q;
    if (x <= 6) detr += q;
  });
  return {
    n,
    sat,
    insat,
    pctSat: n ? Math.round((sat / n) * 100) : null,
    pctInsat: n ? Math.round((insat / n) * 100) : null,
    media: n ? soma / n : null,
    indice: n ? Math.round(((soma / n - p.min) / (p.max - p.min)) * 100) : null,
    prom,
    detr,
    nps: n ? Math.round(((prom - detr) / n) * 100) : null,
  };
}

export const pergEscala = (q) => q.tipo === "escala";

// Satisfação de um conjunto de perguntas: soma das respostas satisfeitas sobre o total.
export function satisfacaoDe(perguntas, seg) {
  let n = 0;
  let sat = 0;
  let insat = 0;
  perguntas.filter(pergEscala).forEach((q) => {
    const r = resumoContagens(q, seg ? (q.porSegmento || {})[seg] : q.contagens);
    n += r.n;
    sat += r.sat;
    insat += r.insat;
  });
  return { n, pct: n ? Math.round((sat / n) * 100) : null, pctInsat: n ? Math.round((insat / n) * 100) : null };
}
export const DEFAULT_REGRAS_ENVIO = { "Evento 1 dia": 1, Camp: 0 };

// Além dos feriados nacionais, as tolerâncias que o cronograma considera.
export function diaNaoUtilPlano(d) {
  if (!isBusinessDay(d)) return true;
  const m = d.getMonth();
  const dia = d.getDate();
  if ((m === 11 && (dia === 24 || dia === 31)) || (m === 5 && dia === 24)) return true;
  const carnaval = addDays(easterSunday(d.getFullYear()), -47);
  return carnaval.toDateString() === d.toDateString();
}

export const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const dataLocal = (iso) => (iso ? new Date(iso + "T00:00:00") : null);

export function dataEnvioPlano(item, regras) {
  if (item.envioManual) return item.envioManual;
  if (!item.fim) return null;
  const off = Number((regras || {})[item.tipologia] ?? 1);
  if (!off) return item.fim;
  const d = addDays(dataLocal(item.fim), off);
  return diaNaoUtilPlano(d) ? item.fim : isoDe(d);
}

export function semanaISO(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const sem = Math.ceil(((x - ini) / 86400000 + 1) / 7);
  return `${x.getUTCFullYear()}-W${String(sem).padStart(2, "0")}`;
}

// ======================================================================
// ---------- Causa raiz ----------
// ======================================================================
// O tema diz "de que se queixam"; a causa diz "porque aconteceu". Só se
// regista ao fechar (reclamação concluída ou constatação resolvida) e usa a
// mesma lista fixa em toda a app, para se poder somar entre módulos.

// Lista editável em "Todas as listas" (options.causasRaiz). Estas são as de partida.
export const DEFAULT_CAUSAS_RAIZ = ["Pessoas", "Processo", "Comunicação", "Instalações e equipamento", "Fornecedor ou parceiro", "Fator externo", "Sem fundamento"];
// Registos antigos guardavam um código; converte para o nome.
export const CODIGO_CAUSA = { pessoas: "Pessoas", processo: "Processo", comunicacao: "Comunicação", instalacoes: "Instalações e equipamento", fornecedor: "Fornecedor ou parceiro", externo: "Fator externo", sem_fundamento: "Sem fundamento" };
export const nomeCausa = (v) => (v ? CODIGO_CAUSA[v] || v : "");

// A lista atual vem das opções; o App atualiza-a a cada render (como as cores do tema).
export let CAUSAS_ATUAIS = DEFAULT_CAUSAS_RAIZ;
export function definirCausasAtuais(lista) {
  CAUSAS_ATUAIS = lista;
}

// ======================================================================
// ---------- Previsão de fim de época ----------
// ======================================================================
// Projeta os inscritos de cada escola até 31 de julho. Com a época passada importada,
// segue a forma dessa época (ver preverEscola). Sem ela, usa:
// - a última semana importada (ponto de partida);
// - o ritmo das últimas semanas: novas inscrições e desistências por semana;
// - as experiências por avaliar, multiplicadas pela taxa de conversão da escola.
// As entradas vão abrandando ao longo da época (8% por semana); as saídas
// mantêm-se. O intervalo vai de "sem novas inscrições" a "ritmo atual mantido".

export const SEMANAS_RITMO = 8;
export const ABRANDAMENTO_ENTRADAS = 0.92;

export function fimDeEpoca(ep) {
  return `${Number(String(ep).slice(0, 4)) + 1}-07-31`;
}

// Segunda-feira de uma semana ISO (aaaa-Wnn).
export function inicioSemanaISO(chave) {
  const [ano, sem] = String(chave).split("-W").map(Number);
  const d = new Date(Date.UTC(ano, 0, 4));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + (sem - 1) * 7);
  return d.toISOString().slice(0, 10);
}

// Época a que pertence uma semana (pelo domingo, para a semana de 1 de agosto contar na época nova).
export function epocaDaSemanaISO(chave) {
  const d = new Date(inicioSemanaISO(chave) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return epocaDe(d.toISOString().slice(0, 10));
}

// Curva da época passada (inscritos no fim de cada semana da época), por escola e no
// total. A App preenche-a a partir dos alunos importados da época anterior.
export let CURVA_EPOCA_ANTERIOR = null;
export function definirCurvaEpocaAnterior(c) {
  CURVA_EPOCA_ANTERIOR = c;
}
// Valor da curva na semana k (ou o último antes dela).
export function valorCurva(c, k) {
  let v = null;
  Object.keys(c)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((j) => {
      if (j <= k) v = c[j];
    });
  return v;
}

// Previsão de fim de época de uma escola.
// Com a época passada importada: os inscritos de hoje seguem a mesma forma da época
// passada a partir desta semana (quanto cresceu, ou caiu, daqui até 31 de julho).
// A faixa vai da evolução da escola à do total da Dragon Force.
// Sem época passada: ritmo das últimas semanas, com as entradas a abrandar.
export function preverEscola({ escola, inscritos, epocaAnterior, experiencias, turmasAlunos, niveis, hoje }) {
  const ep = epocaDe(hoje);
  const serie = [...(inscritos[escola] || [])]
    .filter((r) => epocaDaSemanaISO(r.semana) === ep)
    .sort((a, b) => a.semana.localeCompare(b.semana));
  if (serie.length < 3) return { escola, insuficiente: true, semanasComDados: serie.length };

  const atual = serie[serie.length - 1].total;
  const recentes = serie.slice(-SEMANAS_RITMO);
  let entradas = recentes.reduce((t, r) => t + (r.novas || 0), 0) / recentes.length;
  let saidas = recentes.reduce((t, r) => t + (r.desist || 0), 0) / recentes.length;
  // Sem novas/desistências registadas: usa a variação do total.
  if (!entradas && !saidas && recentes.length > 1) {
    const liquido = (recentes[recentes.length - 1].total - recentes[0].total) / (recentes.length - 1);
    entradas = Math.max(0, liquido);
    saidas = Math.max(0, -liquido);
  }

  const xps = experiencias.filter((x) => x.escola === escola);
  const suc = xps.filter((x) => x.resultado === "sucesso").reduce((t, x) => t + x.n, 0);
  const ins = xps.filter((x) => x.resultado === "insucesso").reduce((t, x) => t + x.n, 0);
  const conv = suc + ins ? suc / (suc + ins) : 0.5;
  const pendentes = xps.filter((x) => x.resultado === "pendente").reduce((t, x) => t + x.n, 0);
  const deExperiencias = Math.round(pendentes * conv);

  const turmas = turmasAlunos.filter((t) => t.escola === escola);
  const capacidade = turmas.reduce((t, x) => t + (x.cap || capacidadeSugerida(x.turma, niveis)), 0);
  const limitar = (v) => Math.max(0, capacidade ? Math.min(capacidade, v) : v);

  const fim = fimDeEpoca(ep);
  const s1 = semana1Padrao(ep);
  const semanaChave = (j) => semanaISO(new Date(inicioSemanaEpoca(j, s1) + "T12:00:00"));
  const kHoje = semanaDaEpoca([hoje, fim].sort()[0], s1);
  const kFim = semanaDaEpoca(fim, s1);
  const semanas = Math.max(0, kFim - kHoje);
  const trajetoria = [];
  let central;
  let alto;
  let baixo;
  let metodo = "ritmo";

  const curva = CURVA_EPOCA_ANTERIOR && CURVA_EPOCA_ANTERIOR.epoca === epAntDe(ep) ? CURVA_EPOCA_ANTERIOR : null;
  const cEsc = curva && curva.escolas[escola];
  const cTot = curva && curva.total;
  const fator = (c, j) => {
    const base = c && valorCurva(c, kHoje);
    const v = c && valorCurva(c, j);
    return base >= 20 && v !== null ? v / base : null;
  };
  if (cTot && fator(cTot, kFim) !== null) {
    metodo = "epocaPassada";
    const usaEsc = fator(cEsc, kFim) !== null;
    // Peso da escola: escolas pequenas ou com um arranque diferente no ano passado
    // puxam-se para a evolução do total.
    const peso = usaEsc ? Math.min(1, valorCurva(cEsc, kHoje) / 150) : 0;
    for (let j = kHoje + 1; j <= kFim; j++) {
      const fT = fator(cTot, j);
      // A escola não se afasta mais de 20 pontos da evolução do total.
      const fE = usaEsc ? Math.min(fT + 0.2, Math.max(fT - 0.2, fator(cEsc, j))) : fT;
      const c = limitar(atual * (peso * fE + (1 - peso) * fT));
      const lo = limitar(atual * Math.min(fE, fT) * 0.97);
      const hi = limitar(atual * Math.max(fE, fT) * 1.03);
      trajetoria.push({ semana: semanaChave(j), central: Math.round(c), baixo: Math.round(lo), alto: Math.round(hi) });
    }
    const ult = trajetoria[trajetoria.length - 1];
    central = ult ? ult.central : atual;
    baixo = ult ? ult.baixo : atual;
    alto = ult ? ult.alto : atual;
  } else {
    central = atual + deExperiencias;
    alto = atual + deExperiencias;
    baixo = atual;
    for (let w = 1; w <= semanas; w++) {
      central = limitar(central + entradas * Math.pow(ABRANDAMENTO_ENTRADAS, w) - saidas);
      alto = limitar(alto + entradas * Math.pow(ABRANDAMENTO_ENTRADAS, w / 2) - saidas);
      baixo = limitar(baixo - saidas);
      trajetoria.push({ semana: semanaChave(kHoje + w), central: Math.round(central), baixo: Math.round(baixo), alto: Math.round(alto) });
    }
  }

  const antCurva = cEsc ? valorCurva(cEsc, kFim) : null;
  const ant = (epocaAnterior[escola] || {}).inscritos || antCurva || null;
  const prev = Math.round(central);
  const variacao = ant ? Math.round(((prev - ant) / ant) * 1000) / 10 : null;
  const falta = ant ? Math.max(0, ant - prev) : null;
  return {
    escola,
    atual,
    ant,
    previsao: prev,
    baixo: Math.round(baixo),
    alto: Math.round(alto),
    variacao,
    falta,
    porSemana: falta && semanas ? Math.ceil(falta / semanas) : 0,
    entradas: Math.round(entradas * 10) / 10,
    saidas: Math.round(saidas * 10) / 10,
    deExperiencias,
    capacidade,
    semanas,
    fim,
    serie,
    trajetoria,
    metodo,
    semanasRitmo: recentes.length,
  };
}

export function previsoesEscolas(ctx) {
  const hoje = ctx.hoje || isoDe(new Date());
  return (ctx.escolas || []).map((escola) => preverEscola({ ...ctx, escola, hoje, niveis: ctx.niveis || DEFAULT_NIVEIS }));
}
export const segSGQ = (opcoes, valor, onChange) => (
  <div style={{ display: "inline-flex", gap: 3, background: COLORS.segTrack, borderRadius: 8, padding: 2, flexWrap: "wrap" }}>
    {opcoes.map(([k, l]) => (
      <button key={k} type="button" onClick={() => onChange(k)} style={{ border: "none", borderRadius: 6, padding: "5px 11px", fontSize: 12.5, cursor: "pointer", background: valor === k ? COLORS.paperRaised : "transparent", fontWeight: valor === k ? 600 : 500, color: valor === k ? COLORS.ink : COLORS.ink2, boxShadow: valor === k ? "0 1px 3px rgba(0,0,0,0.1)" : "none", fontFamily: "inherit" }}>
        {l}
      </button>
    ))}
  </div>
);

// ======================================================================
// Páginas carregadas à medida: cada página vem no seu ficheiro (src/paginas) e só é
// descarregada quando é aberta. Depois da app abrir, ficam todas pré-carregadas em segundo plano.
// ======================================================================
const CARREGAR_PAGINA = {
  reclamacoes: () => import("./paginas/reclamacoes.jsx"),
  auditorias: () => import("./paginas/auditorias.jsx"),
  sancoes: () => import("./paginas/sancoes.jsx"),
  emails: () => import("./paginas/emails.jsx"),
  inscritos: () => import("./paginas/inscritos.jsx"),
  inqueritos: () => import("./paginas/inqueritos.jsx"),
  relatorios: () => import("./paginas/relatorios.jsx"),
  formacao: () => import("./paginas/formacao.jsx"),
  documentos: () => import("./paginas/documentos.jsx"),
  objetivos: () => import("./paginas/objetivos.jsx"),
  riscos: () => import("./paginas/riscos.jsx"),
  ocorrencias: () => import("./paginas/ocorrencias.jsx"),
};
const paginasCarregadas = {};
const carregarPagina = (g) => (paginasCarregadas[g] = paginasCarregadas[g] || CARREGAR_PAGINA[g]().catch((e) => {
  delete paginasCarregadas[g];
  throw e;
}));
function aMedida(grupo, nome, comEsqueleto) {
  const Componente = lazy(() => carregarPagina(grupo).then((m) => ({ default: m[nome] })));
  const Embrulho = (props) => (
    <Suspense fallback={comEsqueleto ? <EsqueletoPagina /> : null}>
      <Componente {...props} />
    </Suspense>
  );
  Embrulho.displayName = nome;
  return Embrulho;
}
export function precarregarPaginas() {
  Object.keys(CARREGAR_PAGINA).forEach((g) => carregarPagina(g).catch(() => {}));
}
export const EntryForm = aMedida("reclamacoes", "EntryForm", false);
export const ComplaintDetail = aMedida("reclamacoes", "ComplaintDetail", false);
export const AnalysisDashboard = aMedida("reclamacoes", "AnalysisDashboard", true);
export const BibliotecaRespostas = aMedida("reclamacoes", "BibliotecaRespostas", false);
export const AuditForm = aMedida("auditorias", "AuditForm", false);
export const AuditDetail = aMedida("auditorias", "AuditDetail", false);
export const ImportarAuditorias = aMedida("auditorias", "ImportarAuditorias", false);
export const AreasConstatacoes = aMedida("auditorias", "AreasConstatacoes", false);
export const AuditsPage = aMedida("auditorias", "AuditsPage", true);
export const SanctionForm = aMedida("sancoes", "SanctionForm", false);
export const SanctionDetail = aMedida("sancoes", "SanctionDetail", false);
export const SanctionsPage = aMedida("sancoes", "SanctionsPage", true);
export const ContactosEscolas = aMedida("emails", "ContactosEscolas", false);
export const HistoricoEmailsEscolas = aMedida("emails", "HistoricoEmailsEscolas", false);
export const PainelEmailsEscolas = aMedida("emails", "PainelEmailsEscolas", true);
export const InscritosPage = aMedida("inscritos", "InscritosPage", true);
export const InqueritosPage = aMedida("inqueritos", "InqueritosPage", true);
export const RelatorioEscolaPage = aMedida("relatorios", "RelatorioEscolaPage", true);
export const FormacaoPage = aMedida("formacao", "FormacaoPage", true);
export const DocumentosPage = aMedida("documentos", "DocumentosPage", true);
export const ObjetivosPage = aMedida("objetivos", "ObjetivosPage", true);
export const RiscosPage = aMedida("riscos", "RiscosPage", true);
export const OcorrenciasPage = aMedida("ocorrencias", "OcorrenciasPage", true);

