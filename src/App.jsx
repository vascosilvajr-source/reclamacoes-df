import React, { useState, useEffect, useMemo, useCallback } from "react";
import { dbStorage } from "./supabaseClient";
import { Plus, X, Check, AlertTriangle, Clock, Search, Trash2, Pencil, ShieldAlert, LayoutGrid, BarChart3, Inbox, Play, ClipboardList, Scale, Mail, Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

// ---------- Tokens ----------
const COLORS = {
  ink: "#101826",
  paper: "#F6F5F1",
  paperRaised: "#FFFFFF",
  rule: "#D8D4C8",
  navy: "#0F2A4A",
  navySoft: "#1E3E63",
  slate: "#5B6472",
  ok: "#1F7A4D",
  okBg: "#E6F2EA",
  warn: "#9A6B0B",
  warnBg: "#FBEFD9",
  danger: "#A32E2E",
  dangerBg: "#F7E5E5",
  done: "#5B6472",
  doneBg: "#E9E8E3",
  progress: "#2B5C8A",
  progressBg: "#E4EEF6",
  purple: "#6B4C9A",
  purpleBg: "#EFE7F5",
};

const APP_NAME = "Auditoria e Gestão de Qualidade DF";

const STORAGE_KEY = "reclamacoes:registo";
const STORAGE_OPTIONS_KEY = "reclamacoes:opcoes";
const STORAGE_AUDITS_KEY = "reclamacoes:auditorias";
const STORAGE_SANCOES_KEY = "reclamacoes:sancoes";
const STORAGE_TRIAGEM_KEY = "reclamacoes:triagem-aprendizagem";

// ---------- Date / business-day helpers (PT holidays) ----------
function easterSunday(year) {
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

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function ptHolidays(year) {
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);
  const fixed = [
    [0, 1], [3, 25], [4, 1], [5, 10], [7, 15],
    [11, 1], [11, 8], [11, 25],
  ].map(([m, d]) => new Date(year, m, d));
  return [...fixed, goodFriday, corpusChristi].map((d) => d.toDateString());
}

function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const holidays = ptHolidays(date.getFullYear());
  return !holidays.includes(date.toDateString());
}

function addBusinessDays(startDate, n) {
  let d = new Date(startDate);
  let remaining = n;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) remaining -= 1;
  }
  return d;
}

function fmt(date) {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function deriveStatus(item) {
  if (item.status === "concluido") return "concluido";
  const today = startOfDay(new Date());
  const deadline = startOfDay(new Date(item.deadline));
  if (today > deadline) return "atrasado";
  return item.status === "em_andamento" ? "em_andamento" : "por_pegar";
}

const STATUS_META = {
  por_pegar: { label: "Por iniciar", color: COLORS.warn, bg: COLORS.warnBg },
  em_andamento: { label: "Em andamento", color: COLORS.progress, bg: COLORS.progressBg },
  atrasado: { label: "Atrasado", color: COLORS.danger, bg: COLORS.dangerBg },
  concluido: { label: "Concluído", color: COLORS.ok, bg: COLORS.okBg },
};

const SEVERITY_META = {
  baixa: { label: "Baixa", color: COLORS.ok, bg: COLORS.okBg },
  media: { label: "Média", color: COLORS.warn, bg: COLORS.warnBg },
  alta: { label: "Alta", color: COLORS.danger, bg: COLORS.dangerBg },
};

const CLASSIFICATION_META = {
  NCM: { label: "Não conformidade maior", color: COLORS.danger, bg: COLORS.dangerBg },
  NC: { label: "Não conformidade", color: COLORS.warn, bg: COLORS.warnBg },
  OM: { label: "Oportunidade de Melhoria", color: COLORS.progress, bg: COLORS.progressBg },
  AS: { label: "Área Sensível", color: COLORS.purple, bg: COLORS.purpleBg },
};

// Prazo legal: sempre 10 dias úteis a contar da data de receção.
const BUSINESS_DAYS_DEADLINE = 10;

const CANAL_META = {
  email: { label: "E-mail", color: COLORS.progress, bg: COLORS.progressBg },
  presencial: { label: "Pessoal", color: COLORS.ok, bg: COLORS.okBg },
  livro: { label: "Livro de Reclamações", color: COLORS.navy, bg: COLORS.rule },
  redes: { label: "Redes Sociais", color: COLORS.purple, bg: COLORS.purpleBg },
};

// Categoria da reclamação passa a ser uma lista editável (options.complaintCategories),
// com estas como sugestão inicial — deixou de ser um enum fixo.
const DEFAULT_CATEGORIAS = ["Disciplinar", "Técnico", "Infraestrutura e Equipamentos"];

// Tipos de sanção aplicáveis a pais/EE — lista editável (options.sanctionTypes).
const DEFAULT_TIPOS_SANCAO = [
  "Suspensão da pessoa",
  "Treinos à porta fechada",
  "Expulsão",
  "Advertência escrita",
];

// Paleta usada para colorir categorias e temas de forma consistente, já que
// deixaram de ter uma cor fixa por serem listas geríveis pelo utilizador.
const TAG_PALETTE = [
  { color: COLORS.danger, bg: COLORS.dangerBg },
  { color: COLORS.progress, bg: COLORS.progressBg },
  { color: COLORS.warn, bg: COLORS.warnBg },
  { color: COLORS.purple, bg: COLORS.purpleBg },
  { color: COLORS.ok, bg: COLORS.okBg },
  { color: COLORS.navySoft, bg: COLORS.rule },
];
function colorForLabel(label) {
  if (!label) return { color: COLORS.slate, bg: COLORS.doneBg };
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

const EFICACIA_META = {
  eficaz: { label: "Eficaz", color: COLORS.ok, bg: COLORS.okBg },
  parcial: { label: "Parcialmente eficaz", color: COLORS.warn, bg: COLORS.warnBg },
  ineficaz: { label: "Ineficaz", color: COLORS.danger, bg: COLORS.dangerBg },
};

// ---------- Sanções / ocorrências disciplinares ----------
const MOTIVO_META = {
  ma_conduta: { label: "Má conduta", color: COLORS.warn, bg: COLORS.warnBg },
  ameacas: { label: "Ameaças", color: COLORS.danger, bg: COLORS.dangerBg },
  insultos: { label: "Insultos", color: COLORS.danger, bg: COLORS.dangerBg },
  agressao: { label: "Agressão", color: COLORS.danger, bg: COLORS.dangerBg },
  outro: { label: "Outro", color: COLORS.slate, bg: COLORS.doneBg },
};

const PERSON_TYPE_META = {
  familia: { label: "Pai / Encarregado de Educação" },
  elemento_df: { label: "Elemento Dragon Force" },
};

const DF_STAGE_META = {
  ocorrencia: { label: "Ocorrência registada", color: COLORS.slate, bg: COLORS.doneBg },
  inquerito: { label: "Inquérito disciplinar aberto", color: COLORS.warn, bg: COLORS.warnBg },
  proposta: { label: "Sanção proposta (para decisão)", color: COLORS.progress, bg: COLORS.progressBg },
  decisao_suspensao: { label: "Decisão: Suspensão", color: COLORS.danger, bg: COLORS.dangerBg },
  decisao_expulsao: { label: "Decisão: Expulsão do projeto", color: COLORS.danger, bg: COLORS.dangerBg },
  decisao_arquivado: { label: "Decisão: Arquivado / sem sanção", color: COLORS.ok, bg: COLORS.okBg },
};

// ---------- Stamp badge (signature element) ----------
function Stamp({ statusKey, onClick }) {
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
        fontFamily: "'IBM Plex Mono', monospace",
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
function Tag({ label, color, bg, title }) {
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

const STOPWORDS = new Set([
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

function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// Pistas iniciais (funcionam desde o primeiro dia, antes de haver dados aprendidos).
const SEED_HINTS = {
  gravidade: {
    alta: ["agressao", "agrediu", "ameaca", "ameacou", "insulto", "insultou", "violencia", "bateu", "socou", "empurrou", "humilhou", "grave", "perigo", "seguranca", "racista", "discriminacao"],
    media: ["preocupado", "preocupada", "insatisfeito", "insatisfeita", "injusto", "injusta", "desrespeito", "queixa"],
    baixa: ["duvida", "sugestao", "horario", "pequena", "informacao", "esclarecimento", "questao"],
  },
  categoria: {
    "Disciplinar": ["comportamento", "insulto", "agressao", "indisciplina", "respeito", "gritou", "humilhou", "bullying", "conduta", "atitude"],
    "Técnico": ["convocado", "convocatoria", "minutos", "jogo", "treino", "avaliacao", "tecnico", "titular", "suplente", "posicao", "equipa"],
    "Infraestrutura e Equipamentos": ["balneario", "equipamento", "transporte", "pagamento", "mensalidade", "material", "instalacoes", "campo", "autocarro"],
  },
  canal: {
    presencial: ["liguei", "telefonei", "fui", "pessoalmente", "reuniao", "falei"],
    livro: ["livro", "reclamacoes"],
    redes: ["facebook", "instagram", "publicamos", "publicado", "rede", "social", "twitter"],
  },
};

function scoreFromLearned(words, learnedField) {
  const scores = {};
  if (!learnedField) return scores;
  words.forEach((w) => {
    const assoc = learnedField[w];
    if (!assoc) return;
    Object.entries(assoc).forEach(([val, count]) => {
      scores[val] = (scores[val] || 0) + count;
    });
  });
  return scores;
}

function bestFromScores(scores, minScore = 1) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0 || entries[0][1] < minScore) return null;
  return entries[0][0];
}

function classifyEnum(words, learnedField, seedField) {
  const scores = scoreFromLearned(words, learnedField);
  if (seedField) {
    Object.entries(seedField).forEach(([val, keywords]) => {
      const hits = keywords.filter((kw) => words.includes(kw)).length;
      if (hits > 0) scores[val] = (scores[val] || 0) + hits * 2;
    });
  }
  return bestFromScores(scores);
}

function classifyFromList(words, learnedField, list) {
  const scores = scoreFromLearned(words, learnedField);
  Object.keys(scores).forEach((val) => {
    if (!list.includes(val)) delete scores[val];
  });
  list.forEach((label) => {
    const labelWords = tokenize(label);
    const hits = labelWords.filter((lw) => words.includes(lw)).length;
    if (hits > 0) scores[label] = (scores[label] || 0) + hits * 2;
  });
  return bestFromScores(scores);
}

// Aplica-se ao colar um e-mail: devolve a sugestão de classificação.
// Extrai a data mencionada no texto (dd/mm/aaaa, dd-mm-aaaa, "12 de março").
const MESES_PT = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function extractDate(rawText) {
  const numeric = rawText.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (numeric) {
    const [, d, m, yRaw] = numeric;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!isNaN(new Date(iso + "T00:00:00").getTime())) return iso;
  }
  const norm = normalizeText(rawText);
  const textual = norm.match(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (textual) {
    const idx = MESES_PT.indexOf(textual[2]);
    if (idx >= 0) {
      const y = textual[3] || String(new Date().getFullYear());
      return `${y}-${String(idx + 1).padStart(2, "0")}-${String(textual[1]).padStart(2, "0")}`;
    }
  }
  return null;
}

// Tenta encontrar o nome de quem reclama a partir da assinatura ou de fórmulas
// comuns em português ("Chamo-me X", "O meu nome é X", "Atenciosamente, X").
function extractComplainantName(rawText) {
  const patterns = [
    /(?:chamo-me|o meu nome (?:é|e)|sou (?:a|o))\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÀ-ÿ]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÀ-ÿ]+){0,3})/,
    /(?:atenciosamente|cumprimentos|com os melhores cumprimentos|obrigado|obrigada)[,\s]*\n+\s*([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÀ-ÿ]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\wÀ-ÿ]+){1,3})/i,
  ];
  for (const re of patterns) {
    const m = rawText.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return "";
}

function extractEmailLink(rawText) {
  const url = rawText.match(/https?:\/\/[^\s<>"')]+/);
  return url ? url[0] : "";
}

// Escolhe a escola mencionada no texto, comparando com a lista real de escolas.
function matchSchool(rawText, schools) {
  const norm = normalizeText(rawText);
  let best = "";
  let bestLen = 0;
  (schools || []).forEach((s) => {
    const ns = normalizeText(s).trim();
    if (ns && norm.includes(ns) && ns.length > bestLen) {
      best = s;
      bestLen = ns.length;
    }
  });
  return best;
}

function classifyText(rawText, learned, temas, categorias, schools) {
  const words = tokenize(rawText);
  const canal = classifyEnum(words, learned.canal, SEED_HINTS.canal) || "email";
  const gravidade = classifyEnum(words, learned.gravidade, SEED_HINTS.gravidade) || "media";
  const categoria = classifyFromList(words, learned.categoria, categorias) || "";
  const tema = classifyFromList(words, learned.tema, temas) || "";

  // Divide o texto: as primeiras frases viram resumo, o resto vai para contexto.
  const trimmed = rawText.trim().replace(/[ \t]+/g, " ");
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  let resumo = "";
  let i = 0;
  while (i < sentences.length && resumo.length < 200) {
    resumo += (resumo ? " " : "") + sentences[i].trim();
    i++;
  }
  const contexto = sentences.slice(i).join(" ").trim();

  return {
    canal,
    gravidade,
    categoria,
    tema,
    resumo,
    contexto,
    school: matchSchool(rawText, schools),
    complainant: extractComplainantName(rawText),
    emailLink: extractEmailLink(rawText),
    receivedDate: extractDate(rawText),
    _hadAnyMatch: words.length > 0,
  };
}

// Chamado sempre que uma reclamação é guardada — reforça as associações
// entre as palavras do texto e a classificação escolhida (final, já corrigida
// pelo utilizador se necessário). É assim que a triagem "aprende" ao longo do tempo.
function learnFromEntry(learned, entry) {
  const text = `${entry.description || ""} ${entry.context || ""}`;
  const words = tokenize(text);
  if (words.length === 0) return learned;
  const next = {
    canal: { ...(learned.canal || {}) },
    categoria: { ...(learned.categoria || {}) },
    tema: { ...(learned.tema || {}) },
    gravidade: { ...(learned.gravidade || {}) },
  };
  const bump = (field, value) => {
    if (!value) return;
    words.forEach((w) => {
      next[field][w] = { ...(next[field][w] || {}) };
      next[field][w][value] = (next[field][w][value] || 0) + 1;
    });
  };
  bump("canal", entry.canal);
  bump("categoria", entry.categoria);
  bump("tema", entry.tema);
  bump("gravidade", entry.severity);
  return next;
}


function TriageBox({ onApply, temas, categorias, learned, schools }) {
  const [emailText, setEmailText] = useState("");
  const [triageError, setTriageError] = useState(null);
  const [open, setOpen] = useState(false);

  const runTriage = () => {
    const text = emailText.trim();
    if (!text) return;
    setTriageError(null);
    const result = classifyText(text, learned || {}, temas, categorias, schools);
    if (!result._hadAnyMatch) {
      setTriageError("Texto demasiado curto para reconhecer padrões. Preenche os campos manualmente.");
      return;
    }
    onApply(result);
  };

  return (
    <div style={{ marginBottom: 18, border: `1.5px dashed ${COLORS.navySoft}`, borderRadius: 5, padding: "12px 14px", background: "#F4F7FA" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          color: COLORS.navySoft,
        }}
      >
        <Sparkles size={15} />
        Triagem automática (colar texto do e-mail)
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <textarea
            rows={6}
            placeholder="Cola aqui o corpo do e-mail recebido..."
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginBottom: 8 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={runTriage}
              disabled={!emailText.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 4,
                border: "none",
                background: COLORS.navySoft,
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: !emailText.trim() ? "default" : "pointer",
                opacity: !emailText.trim() ? 0.6 : 1,
              }}
            >
              <Sparkles size={14} />
              Sugerir classificação
            </button>
            <div style={{ fontSize: 11, color: COLORS.slate }}>
              Preenche data, nome, escola, canal, categoria, tema, gravidade, resumo e contexto. Confirma ou corrige sempre.
            </div>
          </div>
          {triageError && <div style={{ color: COLORS.danger, fontSize: 12, marginTop: 8 }}>{triageError}</div>}
        </div>
      )}
    </div>
  );
}

function EntryForm({ initial, nextNumber, onCancel, onSave, schoolOptions, categoryOptions, categoriaOptions, onManageOptions, learned }) {
  const [form, setForm] = useState(
    initial || {
      receivedDate: new Date().toISOString().slice(0, 10),
      complainant: "",
      school: "",
      tema: "",
      categoria: "",
      canal: "email",
      severity: "media",
      description: "",
      context: "",
      emailLink: "",
    }
  );
  const [suggested, setSuggested] = useState(new Set());

  const preview = useMemo(() => {
    if (!form.receivedDate) return null;
    return addBusinessDays(new Date(form.receivedDate + "T00:00:00"), BUSINESS_DAYS_DEADLINE);
  }, [form.receivedDate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const applyTriage = (data) => {
    const next = { ...form };
    const applied = new Set();
    if (data.tema && categoryOptions.includes(data.tema)) {
      next.tema = data.tema;
      applied.add("tema");
    }
    if (data.categoria && categoriaOptions.includes(data.categoria)) {
      next.categoria = data.categoria;
      applied.add("categoria");
    }
    if (data.gravidade && SEVERITY_META[data.gravidade]) {
      next.severity = data.gravidade;
      applied.add("severity");
    }
    if (data.canal && CANAL_META[data.canal]) {
      next.canal = data.canal;
      applied.add("canal");
    }
    if (data.resumo) {
      next.description = data.resumo;
      applied.add("description");
    }
    if (data.contexto) {
      next.context = data.contexto;
      applied.add("context");
    }
    if (data.school && schoolOptions.includes(data.school)) {
      next.school = data.school;
      applied.add("school");
    }
    if (data.complainant) {
      next.complainant = data.complainant;
      applied.add("complainant");
    }
    if (data.emailLink) {
      next.emailLink = data.emailLink;
      applied.add("emailLink");
    }
    if (data.receivedDate) {
      next.receivedDate = data.receivedDate;
      applied.add("receivedDate");
    }
    setForm(next);
    setSuggested(applied);
  };

  const fieldHint = (key) =>
    suggested.has(key) ? (
      <span style={{ fontSize: 10.5, color: COLORS.navySoft, fontWeight: 700, marginLeft: 6 }}>· sugerido, confirma</span>
    ) : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(16,24,38,0.45)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "min(460px, 100%)",
          background: COLORS.paperRaised,
          height: "100%",
          padding: "28px 26px",
          overflowY: "auto",
          boxShadow: "-8px 0 24px rgba(16,24,38,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
              ENTRADA Nº {String(initial ? initial.entryNumber : nextNumber).padStart(4, "0")}
            </div>
            <h2 style={{ margin: "4px 0 0", fontFamily: "'Fraunces', serif", fontSize: 22, color: COLORS.navy }}>
              {initial ? "Editar reclamação" : "Nova reclamação"}
            </h2>
          </div>
          <button onClick={onCancel} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        {!initial && <TriageBox onApply={applyTriage} temas={categoryOptions} categorias={categoriaOptions} learned={learned} schools={schoolOptions} />}

        <label style={{ ...labelStyle, marginTop: 0 }}>Canal de contacto{fieldHint("canal")}</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {Object.entries(CANAL_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, canal: key }))}
              style={{
                flex: "1 1 45%",
                padding: "9px 8px",
                borderRadius: 4,
                border: `1.5px solid ${form.canal === key ? COLORS.navy : COLORS.rule}`,
                background: form.canal === key ? COLORS.navy : "transparent",
                color: form.canal === key ? "#fff" : COLORS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Data de receção{fieldHint("receivedDate")}</label>
        <input type="date" value={form.receivedDate} onChange={set("receivedDate")} style={inputStyle} />
        {preview && (
          <div style={{ margin: "8px 0 4px", fontSize: 12.5, color: COLORS.slate, fontFamily: "'IBM Plex Mono', monospace" }}>
            Prazo (10 dias úteis) → <strong style={{ color: COLORS.navy }}>{fmt(preview)}</strong>
          </div>
        )}

        <label style={labelStyle}>Gravidade{fieldHint("severity")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(SEVERITY_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, severity: key }))}
              style={{
                flex: 1,
                padding: "8px 6px",
                borderRadius: 4,
                border: `1.5px solid ${form.severity === key ? meta.color : COLORS.rule}`,
                background: form.severity === key ? meta.bg : "transparent",
                color: form.severity === key ? meta.color : COLORS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle }}>Categoria{fieldHint("categoria")}</label>
          <button type="button" onClick={onManageOptions} style={linkBtnStyle}>
            Gerir lista
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {categoriaOptions.length === 0 && <div style={{ fontSize: 12, color: COLORS.slate }}>Sem categorias — usa "Gerir lista" para adicionar.</div>}
          {categoriaOptions.map((label) => {
            const meta = colorForLabel(label);
            return (
              <button
                key={label}
                type="button"
                onClick={() => setForm((f) => ({ ...f, categoria: label }))}
                style={{
                  flex: "1 1 30%",
                  padding: "8px 6px",
                  borderRadius: 4,
                  border: `1.5px solid ${form.categoria === label ? meta.color : COLORS.rule}`,
                  background: form.categoria === label ? meta.bg : "transparent",
                  color: form.categoria === label ? meta.color : COLORS.ink,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <label style={labelStyle}>Reclamante (nome){fieldHint("complainant")}</label>
        <input type="text" placeholder="Nome de quem faz a reclamação" value={form.complainant} onChange={set("complainant")} style={inputStyle} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 14 }}>Escola{fieldHint("school")}</label>
          <button type="button" onClick={onManageOptions} style={linkBtnStyle}>
            Gerir lista
          </button>
        </div>
        <select value={form.school} onChange={set("school")} style={inputStyle}>
          <option value="">{schoolOptions.length ? "Selecionar escola..." : "Sem escolas — usa 'Gerir lista'"}</option>
          {schoolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 14 }}>Tema (mais específico que a categoria){fieldHint("tema")}</label>
          <button type="button" onClick={onManageOptions} style={linkBtnStyle}>
            Gerir lista
          </button>
        </div>
        <select value={form.tema} onChange={set("tema")} style={inputStyle}>
          <option value="">{categoryOptions.length ? "Selecionar tema..." : "Sem temas — usa 'Gerir lista'"}</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Hiperligação ao e-mail recebido{fieldHint("emailLink")}</label>
        <input
          type="url"
          placeholder="https://mail.google.com/... ou link do Outlook"
          value={form.emailLink}
          onChange={set("emailLink")}
          style={inputStyle}
        />

        <label style={labelStyle}>Descrição (resumo do e-mail){fieldHint("description")}</label>
        <textarea
          rows={4}
          placeholder="Resumo objetivo da reclamação..."
          value={form.description}
          onChange={set("description")}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        <label style={labelStyle}>Contexto adicional{fieldHint("context")}</label>
        <textarea
          rows={4}
          placeholder="Corpo de texto com mais contexto, histórico, ou detalhes que não cabem no resumo..."
          value={form.context}
          onChange={set("context")}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.complainant.trim()) return;
              const deadline = addBusinessDays(new Date(form.receivedDate + "T00:00:00"), BUSINESS_DAYS_DEADLINE);
              onSave({
                ...form,
                deadline: deadline.toISOString(),
                entryNumber: initial ? initial.entryNumber : nextNumber,
                id: initial ? initial.id : `c_${Date.now()}`,
                status: initial ? initial.status : "por_pegar",
              });
            }}
            style={primaryBtnStyle}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}


const labelStyle = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600,
  color: COLORS.slate,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  marginBottom: 6,
  marginTop: 14,
};

const inputStyle = {
  width: "100%",
  padding: "9px 11px",
  border: `1.5px solid ${COLORS.rule}`,
  borderRadius: 4,
  fontSize: 14,
  color: COLORS.ink,
  background: "#fff",
  boxSizing: "border-box",
};

const primaryBtnStyle = {
  flex: 1,
  padding: "11px",
  borderRadius: 4,
  border: "none",
  background: COLORS.navy,
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryBtnStyle = {
  flex: 1,
  padding: "11px",
  borderRadius: 4,
  border: `1.5px solid ${COLORS.rule}`,
  background: "transparent",
  color: COLORS.ink,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const iconBtnStyle = {
  border: "none",
  background: "transparent",
  color: COLORS.slate,
  cursor: "pointer",
  padding: 4,
};

const linkBtnStyle = {
  border: "none",
  background: "transparent",
  color: COLORS.navySoft,
  cursor: "pointer",
  padding: 0,
  fontSize: 11.5,
  fontWeight: 600,
  textDecoration: "underline",
  marginTop: 14,
};

const panelStyle = {
  background: COLORS.paperRaised,
  border: `1px solid ${COLORS.rule}`,
  borderRadius: 5,
  padding: "18px 20px",
};

const panelTitle = {
  fontSize: 11,
  fontWeight: 600,
  color: COLORS.slate,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 14,
};

// ---------- Stat card ----------
function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        background: COLORS.paperRaised,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 5,
        padding: "16px 18px",
        flex: 1,
        minWidth: 130,
      }}
    >
      <div style={{ fontSize: 28, fontFamily: "'Fraunces', serif", color: color || COLORS.navy, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

// ---------- Manage schools/categories modal ----------
function ManageOptionsModal({ schools, categories, auditCategories, complaintCategories, sanctionTypes, onAdd, onRemove, onClose }) {
  const [newSchool, setNewSchool] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newAuditCategory, setNewAuditCategory] = useState("");
  const [newComplaintCategory, setNewComplaintCategory] = useState("");
  const [newSanctionType, setNewSanctionType] = useState("");

  const submitSchool = () => {
    const v = newSchool.trim();
    if (v) onAdd("schools", v);
    setNewSchool("");
  };
  const submitCategory = () => {
    const v = newCategory.trim();
    if (v) onAdd("categories", v);
    setNewCategory("");
  };
  const submitAuditCategory = () => {
    const v = newAuditCategory.trim();
    if (v) onAdd("auditCategories", v);
    setNewAuditCategory("");
  };
  const submitComplaintCategory = () => {
    const v = newComplaintCategory.trim();
    if (v) onAdd("complaintCategories", v);
    setNewComplaintCategory("");
  };
  const submitSanctionType = () => {
    const v = newSanctionType.trim();
    if (v) onAdd("sanctionTypes", v);
    setNewSanctionType("");
  };

  const Chip = ({ label, onDelete }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 3,
        padding: "5px 8px 5px 10px",
        fontSize: 12.5,
        background: COLORS.paper,
      }}
    >
      {label}
      <button onClick={onDelete} style={{ ...iconBtnStyle, padding: 0 }} title="Remover">
        <X size={12} />
      </button>
    </div>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,38,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(480px, 92vw)", maxHeight: "84vh", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 6, padding: "24px 24px 26px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 20, color: COLORS.navy }}>Escolas e categorias</h2>
          <button onClick={onClose} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 20 }}>
          Estas listas ficam disponíveis para toda a equipa em Reclamações, Auditorias e Análise. As escolas são
          transversais a todas as áreas da app.
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Escolas
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {schools.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate }}>Ainda sem escolas.</div>}
          {schools.map((s) => (
            <Chip key={s} label={s} onDelete={() => onRemove("schools", s)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <input
            type="text"
            placeholder="Nome da nova escola"
            value={newSchool}
            onChange={(e) => setNewSchool(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitSchool()}
            style={inputStyle}
          />
          <button onClick={submitSchool} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 14px" }}>
            Adicionar
          </button>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Categorias
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {complaintCategories.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate }}>Ainda sem categorias.</div>}
          {complaintCategories.map((c) => (
            <Chip key={c} label={c} onDelete={() => onRemove("complaintCategories", c)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <input
            type="text"
            placeholder="Nome da nova categoria"
            value={newComplaintCategory}
            onChange={(e) => setNewComplaintCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitComplaintCategory()}
            style={inputStyle}
          />
          <button onClick={submitComplaintCategory} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 14px" }}>
            Adicionar
          </button>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Tipos de sanção (Pais / EE)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {(sanctionTypes || []).length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate }}>Ainda sem tipos de sanção.</div>}
          {(sanctionTypes || []).map((t) => (
            <Chip key={t} label={t} onDelete={() => onRemove("sanctionTypes", t)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <input
            type="text"
            placeholder="Ex: Suspensão por 3 jogos"
            value={newSanctionType}
            onChange={(e) => setNewSanctionType(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitSanctionType()}
            style={inputStyle}
          />
          <button onClick={submitSanctionType} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 14px" }}>
            Adicionar
          </button>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Temas (mais específicos que a categoria)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {categories.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate }}>Ainda sem temas.</div>}
          {categories.map((c) => (
            <Chip key={c} label={c} onDelete={() => onRemove("categories", c)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <input
            type="text"
            placeholder="Nome do novo tema"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCategory()}
            style={inputStyle}
          />
          <button onClick={submitCategory} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 14px" }}>
            Adicionar
          </button>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Categorias de constatações de auditoria
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {auditCategories.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate }}>Ainda sem categorias.</div>}
          {auditCategories.map((c) => (
            <Chip key={c} label={c} onDelete={() => onRemove("auditCategories", c)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Ex: Instalações, Documentação, Segurança..."
            value={newAuditCategory}
            onChange={(e) => setNewAuditCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitAuditCategory()}
            style={inputStyle}
          />
          <button onClick={submitAuditCategory} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 14px" }}>
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Complaint detail / notes timeline ----------
function ComplaintDetail({ entry, onClose, onAddNote, onStart, onDone, onReopen }) {
  const [note, setNote] = useState("");
  const [concluding, setConcluding] = useState(false);
  const [responseText, setResponseText] = useState(entry.responseText || "");
  const [eficacia, setEficacia] = useState(entry.eficacia || "");
  const notes = [...(entry.notes || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  const submit = () => {
    const v = note.trim();
    if (!v) return;
    onAddNote(entry.id, v);
    setNote("");
  };

  const confirmDone = () => {
    onDone(entry.id, { responseText: responseText.trim(), eficacia });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,38,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(560px, 92vw)", maxHeight: "86vh", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 6, padding: "24px 24px 26px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
            ENTRADA Nº {String(entry.entryNumber).padStart(4, "0")}
          </div>
          <button onClick={onClose} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>
        <h2 style={{ margin: "0 0 12px", fontFamily: "'Fraunces', serif", fontSize: 20, color: COLORS.navy }}>{entry.complainant}</h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Stamp statusKey={entry.derivedStatus} />
          {entry.severity && (
            <Tag label={`Gravidade: ${SEVERITY_META[entry.severity].label}`} color={SEVERITY_META[entry.severity].color} bg={SEVERITY_META[entry.severity].bg} />
          )}
          {entry.categoria && (
            <Tag label={entry.categoria} color={colorForLabel(entry.categoria).color} bg={colorForLabel(entry.categoria).bg} />
          )}
          {entry.canal && CANAL_META[entry.canal] && (
            <Tag label={CANAL_META[entry.canal].label} color={CANAL_META[entry.canal].color} bg={CANAL_META[entry.canal].bg} />
          )}
          {entry.eficacia && EFICACIA_META[entry.eficacia] && (
            <Tag label={`Eficácia: ${EFICACIA_META[entry.eficacia].label}`} color={EFICACIA_META[entry.eficacia].color} bg={EFICACIA_META[entry.eficacia].bg} />
          )}
        </div>

        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 14, lineHeight: 1.6 }}>
          {entry.school || "sem escola"} · {entry.tema || "sem tema"} <br />
          Receção: {fmt(new Date(entry.receivedDate + "T00:00:00"))} · Prazo: {fmt(new Date(entry.deadline))}
        </div>

        {entry.emailLink && (
          <a
            href={entry.emailLink}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.navySoft, marginBottom: 14, textDecoration: "underline" }}
          >
            <Mail size={13} /> Abrir e-mail original
          </a>
        )}

        {entry.description && (
          <div style={{ fontSize: 13.5, marginBottom: 12, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
            {entry.description}
          </div>
        )}

        {entry.context && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Contexto adicional
            </div>
            <div style={{ fontSize: 13, color: COLORS.slate, whiteSpace: "pre-wrap" }}>{entry.context}</div>
          </div>
        )}

        {entry.status === "concluido" && entry.responseText && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.ok, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Resposta dada à reclamação
            </div>
            <div style={{ fontSize: 13.5, padding: "10px 12px", background: COLORS.okBg, borderRadius: 4, border: `1px solid ${COLORS.ok}`, whiteSpace: "pre-wrap" }}>
              {entry.responseText}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {entry.status === "por_pegar" && (
            <button onClick={() => onStart(entry.id)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
              Iniciar
            </button>
          )}
          {entry.derivedStatus !== "concluido" ? (
            <button onClick={() => setConcluding((v) => !v)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
              Marcar concluído
            </button>
          ) : (
            <button onClick={() => onReopen(entry.id)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
              Reabrir
            </button>
          )}
        </div>

        {concluding && entry.derivedStatus !== "concluido" && (
          <div style={{ marginBottom: 20, padding: "12px 14px", background: COLORS.paper, border: `1.5px solid ${COLORS.navySoft}`, borderRadius: 5 }}>
            <label style={{ ...labelStyle, marginTop: 0 }}>Resposta dada à reclamação</label>
            <textarea
              rows={3}
              placeholder="O que foi respondido / decidido..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
            <label style={labelStyle}>Eficácia da resposta</label>
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(EFICACIA_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setEficacia(key)}
                  style={{
                    flex: 1,
                    padding: "7px 6px",
                    borderRadius: 4,
                    border: `1.5px solid ${eficacia === key ? meta.color : COLORS.rule}`,
                    background: eficacia === key ? meta.bg : "transparent",
                    color: eficacia === key ? meta.color : COLORS.ink,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <button onClick={confirmDone} style={{ ...primaryBtnStyle, marginTop: 12, flex: "none", padding: "8px 16px" }}>
              Confirmar conclusão
            </button>
          </div>
        )}

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          O que já foi feito / o que falta fazer
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <textarea
            rows={2}
            placeholder="Ex: Contactado o reclamante por telefone; falta confirmar com a escola..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
          />
          <button onClick={submit} style={{ ...primaryBtnStyle, flex: "none", padding: "0 16px" }}>
            Adicionar
          </button>
        </div>

        {notes.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Ainda sem notas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ borderLeft: `2.5px solid ${COLORS.navySoft}`, paddingLeft: 12 }}>
                <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: COLORS.slate, marginBottom: 3 }}>
                  {new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
                    new Date(n.date)
                  )}
                </div>
                <div style={{ fontSize: 13.5 }}>{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ---------- (recurrence lists superseded by AnalysisDashboard charts) ----------

function topCounts(entries, field) {
  const map = {};
  entries.forEach((e) => {
    const v = (e[field] || "").trim();
    if (!v) return;
    map[v] = (map[v] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthlyData(entries) {
  const map = {};
  entries.forEach((e) => {
    if (!e.receivedDate) return;
    const d = new Date(e.receivedDate + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-12)
    .map(([key, total]) => {
      const [y, m] = key.split("-");
      return { month: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`, total };
    });
}

const ANALYSIS_PARAMS = [
  { key: "monthly", label: "Tendência mensal" },
  { key: "canal", label: "Canal de contacto" },
  { key: "status", label: "Estado" },
  { key: "categoria", label: "Categoria" },
  { key: "eficacia", label: "Eficácia da resposta" },
  { key: "tema", label: "Temas mais recorrentes" },
  { key: "escola", label: "Escolas mais recorrentes" },
];

function AnalysisDashboard({ withStatus, schoolOptions, categoryOptions, categoriaOptions }) {
  const [fSchool, setFSchool] = useState("todos");
  const [fTema, setFTema] = useState("todos");
  const [fCategoria, setFCategoria] = useState("todos");
  const [fCanal, setFCanal] = useState("todos");
  const [fGravidade, setFGravidade] = useState("todos");
  const [visibleParams, setVisibleParams] = useState(new Set(ANALYSIS_PARAMS.map((p) => p.key)));

  const toggleParam = (key) => {
    setVisibleParams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = useMemo(
    () =>
      withStatus
        .filter((e) => (fSchool === "todos" ? true : e.school === fSchool))
        .filter((e) => (fTema === "todos" ? true : e.tema === fTema))
        .filter((e) => (fCategoria === "todos" ? true : e.categoria === fCategoria))
        .filter((e) => (fCanal === "todos" ? true : e.canal === fCanal))
        .filter((e) => (fGravidade === "todos" ? true : e.severity === fGravidade)),
    [withStatus, fSchool, fTema, fCategoria, fCanal, fGravidade]
  );

  const total = filtered.length;

  const monthly = useMemo(() => monthlyData(filtered), [filtered]);

  const canalData = useMemo(
    () =>
      Object.entries(CANAL_META).map(([key, meta]) => ({
        name: meta.label,
        value: filtered.filter((e) => e.canal === key).length,
        color: meta.color,
      })),
    [filtered]
  );

  const statusData = useMemo(
    () =>
      Object.keys(STATUS_META).map((key) => ({
        name: STATUS_META[key].label,
        value: filtered.filter((e) => e.derivedStatus === key).length,
        color: STATUS_META[key].color,
      })),
    [filtered]
  );

  const categoriaData = useMemo(
    () => topCounts(filtered, "categoria").map(([name, value]) => ({ name, value, color: colorForLabel(name).color })),
    [filtered]
  );

  const eficaciaData = useMemo(
    () =>
      Object.entries(EFICACIA_META).map(([key, meta]) => ({
        name: meta.label,
        value: filtered.filter((e) => e.eficacia === key).length,
        color: meta.color,
      })),
    [filtered]
  );

  const temaData = useMemo(() => topCounts(filtered, "tema").slice(0, 8).map(([name, value]) => ({ name, value })), [filtered]);
  const schoolData = useMemo(() => topCounts(filtered, "school").slice(0, 8).map(([name, value]) => ({ name, value })), [filtered]);

  const resolved = filtered.filter((e) => e.status === "concluido" && e.resolvedDate);
  const avgResolutionDays = resolved.length
    ? Math.round(
        resolved.reduce((sum, e) => sum + (new Date(e.resolvedDate) - new Date(e.receivedDate + "T00:00:00")) / 86400000, 0) /
          resolved.length
      )
    : null;
  const onTimeRate = resolved.length
    ? Math.round((resolved.filter((e) => new Date(e.resolvedDate) <= new Date(e.deadline)).length / resolved.length) * 100)
    : null;

  const responded = filtered.filter((e) => e.startedDate);
  const avgResponseDays = responded.length
    ? Math.round(
        (responded.reduce((sum, e) => sum + (new Date(e.startedDate) - new Date(e.receivedDate + "T00:00:00")) / 86400000, 0) /
          responded.length) *
          10
      ) / 10
    : null;

  const filterSelectStyle = { ...inputStyle, width: 180 };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={fSchool} onChange={(e) => setFSchool(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todas as escolas</option>
          {schoolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={fTema} onChange={(e) => setFTema(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todos os temas</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todas as categorias</option>
          {categoriaOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todos os canais</option>
          {Object.entries(CANAL_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
        <select value={fGravidade} onChange={(e) => setFGravidade(e.target.value)} style={filterSelectStyle}>
          <option value="todos">Todas as gravidades</option>
          {Object.entries(SEVERITY_META).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Parâmetros de análise mostrados
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ANALYSIS_PARAMS.map((p) => {
            const active = visibleParams.has(p.key);
            return (
              <button
                key={p.key}
                onClick={() => toggleParam(p.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: `1.5px solid ${active ? COLORS.navy : COLORS.rule}`,
                  background: active ? COLORS.navy : "transparent",
                  color: active ? "#fff" : COLORS.slate,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {active ? "✓ " : "+ "}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {total === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: COLORS.slate, border: `1.5px dashed ${COLORS.rule}`, borderRadius: 6 }}>
          Sem reclamações para os filtros selecionados.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="Total de reclamações" value={total} />
            <StatCard label="Tempo médio de resposta" value={avgResponseDays !== null ? `${avgResponseDays} d` : "—"} color={COLORS.progress} />
            <StatCard label="Tempo médio de resolução" value={avgResolutionDays !== null ? `${avgResolutionDays} d` : "—"} />
            <StatCard label="Resolvidas dentro do prazo" value={onTimeRate !== null ? `${onTimeRate}%` : "—"} color={COLORS.ok} />
          </div>

          {visibleParams.has("monthly") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Reclamações por mês (últimos 12 meses)</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthly}>
                  <CartesianGrid stroke={COLORS.rule} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                  <Line type="monotone" dataKey="total" stroke={COLORS.navy} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.navy }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {visibleParams.has("canal") && (
              <div style={{ ...panelStyle, flex: "1 1 260px" }}>
                <div style={panelTitle}>Distribuição por canal de contacto</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={canalData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {canalData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11.5, marginTop: 4, flexWrap: "wrap" }}>
                  {canalData.map((d) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visibleParams.has("status") && (
              <div style={{ ...panelStyle, flex: "1 1 260px" }}>
                <div style={panelTitle}>Distribuição por estado</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {statusData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11.5, marginTop: 4, flexWrap: "wrap" }}>
                  {statusData.map((d) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visibleParams.has("categoria") && (
              <div style={{ ...panelStyle, flex: "1 1 260px" }}>
                <div style={panelTitle}>Distribuição por categoria</div>
                {categoriaData.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados de categoria ainda.</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={categoriaData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                          {categoriaData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11, marginTop: 4, flexWrap: "wrap" }}>
                      {categoriaData.map((d) => (
                        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {visibleParams.has("eficacia") && (
              <div style={{ ...panelStyle, flex: "1 1 260px" }}>
                <div style={panelTitle}>Eficácia da resposta (concluídas)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={eficaciaData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {eficaciaData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11.5, marginTop: 4, flexWrap: "wrap" }}>
                  {eficaciaData.map((d) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {visibleParams.has("tema") && (
              <div style={{ ...panelStyle, flex: "1 1 320px" }}>
                <div style={panelTitle}>Temas mais recorrentes</div>
                {temaData.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados de tema ainda.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(160, temaData.length * 32)}>
                    <BarChart data={temaData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid stroke={COLORS.rule} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                      <Bar dataKey="value" fill={COLORS.navySoft} radius={[0, 3, 3, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {visibleParams.has("escola") && (
              <div style={{ ...panelStyle, flex: "1 1 320px" }}>
                <div style={panelTitle}>Escolas mais recorrentes</div>
                {schoolData.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados de escola ainda.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(160, schoolData.length * 32)}>
                    <BarChart data={schoolData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid stroke={COLORS.rule} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                      <Bar dataKey="value" fill={COLORS.navy} radius={[0, 3, 3, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}




// ---------- New audit form ----------
function AuditForm({ schoolOptions, onCancel, onSave, onManageOptions }) {
  const [school, setSchool] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,38,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
      onClick={onCancel}
    >
      <div
        style={{ width: "min(420px, 92vw)", background: COLORS.paperRaised, borderRadius: 6, padding: "24px 24px 26px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 20, color: COLORS.navy }}>Nova auditoria</h2>
          <button onClick={onCancel} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
          <button type="button" onClick={onManageOptions} style={{ ...linkBtnStyle, marginTop: 0 }}>
            Gerir lista
          </button>
        </div>
        <select value={school} onChange={(e) => setSchool(e.target.value)} style={inputStyle}>
          <option value="">{schoolOptions.length ? "Selecionar escola..." : "Sem escolas — usa 'Gerir lista'"}</option>
          {schoolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Data da auditoria</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!school) return;
              onSave({ id: `a_${Date.now()}`, school, date, findings: [] });
            }}
            style={primaryBtnStyle}
          >
            Criar auditoria
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Audit detail: findings management ----------
function AuditDetail({ audit, auditCategoryOptions, onClose, onAddFinding, onRemoveFinding, onRemoveAudit, onManageOptions }) {
  const [classification, setClassification] = useState("NC");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const submit = () => {
    const v = description.trim();
    if (!v) return;
    onAddFinding(audit.id, { id: `f_${Date.now()}`, classification, category, description: v });
    setDescription("");
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,38,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(560px, 92vw)", maxHeight: "86vh", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 6, padding: "24px 24px 26px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
            {fmt(new Date(audit.date + "T00:00:00"))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button title="Eliminar auditoria" onClick={() => onRemoveAudit(audit.id)} style={iconBtnStyle}>
              <Trash2 size={16} color={COLORS.danger} />
            </button>
            <button onClick={onClose} style={iconBtnStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
        <h2 style={{ margin: "0 0 18px", fontFamily: "'Fraunces', serif", fontSize: 20, color: COLORS.navy }}>{audit.school}</h2>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Nova constatação
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {Object.entries(CLASSIFICATION_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setClassification(key)}
              style={{
                padding: "6px 10px",
                borderRadius: 4,
                border: `1.5px solid ${classification === key ? meta.color : COLORS.rule}`,
                background: classification === key ? meta.bg : "transparent",
                color: classification === key ? meta.color : COLORS.ink,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
              title={meta.label}
            >
              {key}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 10 }}>{CLASSIFICATION_META[classification].label}</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Categoria</label>
          <button type="button" onClick={onManageOptions} style={{ ...linkBtnStyle, marginTop: 0 }}>
            Gerir lista
          </button>
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
          <option value="">{auditCategoryOptions.length ? "Selecionar categoria..." : "Sem categorias — usa 'Gerir lista'"}</option>
          {auditCategoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <textarea
            rows={2}
            placeholder="Descrição da constatação..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
          />
          <button onClick={submit} style={{ ...primaryBtnStyle, flex: "none", padding: "0 16px" }}>
            Adicionar
          </button>
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Constatações ({audit.findings.length})
        </div>
        {audit.findings.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Ainda sem constatações registadas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {audit.findings.map((f) => (
              <div
                key={f.id}
                style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}
              >
                <Tag label={f.classification} color={CLASSIFICATION_META[f.classification].color} bg={CLASSIFICATION_META[f.classification].bg} />
                <div style={{ flex: 1 }}>
                  {f.category && <div style={{ fontSize: 11, color: COLORS.slate, marginBottom: 2 }}>{f.category}</div>}
                  <div style={{ fontSize: 13.5 }}>{f.description}</div>
                </div>
                <button title="Remover" onClick={() => onRemoveFinding(audit.id, f.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Audits page (list + analysis) ----------
function AuditsPage({ audits, onNewAudit, onOpenAudit }) {
  const allFindings = useMemo(() => audits.flatMap((a) => a.findings.map((f) => ({ ...f, school: a.school }))), [audits]);

  const classificationCounts = Object.keys(CLASSIFICATION_META).map((key) => ({
    name: key,
    value: allFindings.filter((f) => f.classification === key).length,
    color: CLASSIFICATION_META[key].color,
  }));

  const schoolData = useMemo(() => topCounts(allFindings, "school").slice(0, 8).map(([name, value]) => ({ name, value })), [allFindings]);
  const categoryData = useMemo(() => topCounts(allFindings, "category").slice(0, 8).map(([name, value]) => ({ name, value })), [allFindings]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", flex: 1 }}>
          {Object.entries(CLASSIFICATION_META).map(([key, meta]) => (
            <StatCard key={key} label={meta.label} value={allFindings.filter((f) => f.classification === key).length} color={meta.color} />
          ))}
        </div>
        <button
          onClick={onNewAudit}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: COLORS.navy,
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "10px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Plus size={16} /> Nova auditoria
        </button>
      </div>

      {allFindings.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ ...panelStyle, flex: "1 1 260px" }}>
            <div style={panelTitle}>Distribuição por classificação</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={classificationCounts} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {classificationCounts.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 11.5, marginTop: 4, flexWrap: "wrap" }}>
              {classificationCounts.map((d) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle, flex: "1 1 260px" }}>
            <div style={panelTitle}>Escolas com mais constatações</div>
            {schoolData.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, schoolData.length * 32)}>
                <BarChart data={schoolData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke={COLORS.rule} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                  <Bar dataKey="value" fill={COLORS.navy} radius={[0, 3, 3, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ ...panelStyle, flex: "1 1 260px" }}>
            <div style={panelTitle}>Categorias mais recorrentes</div>
            {categoryData.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados de categoria ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, categoryData.length * 32)}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke={COLORS.rule} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                  <Bar dataKey="value" fill={COLORS.navySoft} radius={[0, 3, 3, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <div style={panelTitle}>Auditorias realizadas</div>
      {audits.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: COLORS.slate, border: `1.5px dashed ${COLORS.rule}`, borderRadius: 6 }}>
          Ainda não há auditorias registadas. Cria a primeira com "Nova auditoria".
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...audits]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((a) => {
              const counts = Object.keys(CLASSIFICATION_META).map((k) => [k, a.findings.filter((f) => f.classification === k).length]).filter(([, n]) => n > 0);
              return (
                <div
                  key={a.id}
                  onClick={() => onOpenAudit(a)}
                  style={{
                    ...panelStyle,
                    padding: "14px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{a.school}</div>
                    <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {fmt(new Date(a.date + "T00:00:00"))} · {a.findings.length} constatações
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {counts.length === 0 ? (
                      <span style={{ fontSize: 12, color: COLORS.slate }}>Sem constatações</span>
                    ) : (
                      counts.map(([k, n]) => (
                        <Tag key={k} label={`${k} · ${n}`} color={CLASSIFICATION_META[k].color} bg={CLASSIFICATION_META[k].bg} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ---------- Sanções: novo registo de ocorrência ----------
function SanctionForm({ onCancel, onSave, schoolOptions, complaints, sanctionTypes, onManageOptions }) {
  const [form, setForm] = useState({
    personType: "familia",
    personName: "",
    school: "",
    motivo: "ma_conduta",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    sanctionApplied: null,
    sanctionType: "",
    sanctionDescription: "",
    relatedComplaintId: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,38,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
      onClick={onCancel}
    >
      <div
        style={{ width: "min(460px, 92vw)", maxHeight: "88vh", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 6, padding: "24px 24px 26px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 20, color: COLORS.navy }}>Nova ocorrência</h2>
          <button onClick={onCancel} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        <label style={{ ...labelStyle, marginTop: 0 }}>Quem está envolvido</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {Object.entries(PERSON_TYPE_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setForm((f) => ({ ...f, personType: key }))}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 4,
                border: `1.5px solid ${form.personType === key ? COLORS.navy : COLORS.rule}`,
                background: form.personType === key ? COLORS.navy : "transparent",
                color: form.personType === key ? "#fff" : COLORS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Nome</label>
        <input type="text" placeholder="Nome da pessoa envolvida" value={form.personName} onChange={set("personName")} style={inputStyle} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle }}>Escola (opcional)</label>
          <button type="button" onClick={onManageOptions} style={linkBtnStyle}>
            Gerir lista
          </button>
        </div>
        <select value={form.school} onChange={set("school")} style={inputStyle}>
          <option value="">Sem escola associada</option>
          {schoolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Reclamação associada (opcional)</label>
        <select value={form.relatedComplaintId} onChange={set("relatedComplaintId")} style={inputStyle}>
          <option value="">Nenhuma — ocorrência independente</option>
          {complaints.map((c) => (
            <option key={c.id} value={c.id}>
              Nº {String(c.entryNumber).padStart(4, "0")} — {c.complainant}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Motivo</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(MOTIVO_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setForm((f) => ({ ...f, motivo: key }))}
              style={{
                flex: "1 1 30%",
                padding: "7px 6px",
                borderRadius: 4,
                border: `1.5px solid ${form.motivo === key ? meta.color : COLORS.rule}`,
                background: form.motivo === key ? meta.bg : "transparent",
                color: form.motivo === key ? meta.color : COLORS.ink,
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Data da ocorrência</label>
        <input type="date" value={form.date} onChange={set("date")} style={inputStyle} />

        <label style={labelStyle}>Descrição da ocorrência</label>
        <textarea
          rows={4}
          placeholder="O que aconteceu..."
          value={form.description}
          onChange={set("description")}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        {form.personType === "familia" && (
          <>
            <label style={labelStyle}>Foi aplicada sanção?</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { key: true, label: "Sim" },
                { key: false, label: "Não" },
              ].map((opt) => (
                <button
                  key={String(opt.key)}
                  onClick={() => setForm((f) => ({ ...f, sanctionApplied: opt.key }))}
                  style={{
                    flex: 1,
                    padding: "8px 6px",
                    borderRadius: 4,
                    border: `1.5px solid ${form.sanctionApplied === opt.key ? COLORS.navy : COLORS.rule}`,
                    background: form.sanctionApplied === opt.key ? COLORS.navy : "transparent",
                    color: form.sanctionApplied === opt.key ? "#fff" : COLORS.ink,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.sanctionApplied === true && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <label style={{ ...labelStyle }}>Tipo de sanção</label>
                  <button type="button" onClick={onManageOptions} style={linkBtnStyle}>
                    Gerir lista
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sanctionTypes.length === 0 && (
                    <div style={{ fontSize: 12, color: COLORS.slate }}>Sem tipos — usa "Gerir lista" para adicionar.</div>
                  )}
                  {sanctionTypes.map((label) => {
                    const meta = colorForLabel(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, sanctionType: label }))}
                        style={{
                          flex: "1 1 45%",
                          padding: "8px 6px",
                          borderRadius: 4,
                          border: `1.5px solid ${form.sanctionType === label ? meta.color : COLORS.rule}`,
                          background: form.sanctionType === label ? meta.bg : "transparent",
                          color: form.sanctionType === label ? meta.color : COLORS.ink,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <label style={labelStyle}>Detalhe da sanção (opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Ex: duração, condições, data de reavaliação..."
                  value={form.sanctionDescription}
                  onChange={set("sanctionDescription")}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </>
            )}
          </>
        )}

        {form.personType === "elemento_df" && (
          <div style={{ marginTop: 14, fontSize: 12, color: COLORS.slate, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
            Como se trata de um elemento Dragon Force, o processo disciplinar (inquérito → proposta de sanção → decisão
            final de suspensão ou expulsão) é gerido depois, a partir do detalhe da ocorrência.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.personName.trim()) return;
              onSave({
                ...form,
                id: `s_${Date.now()}`,
                stage: form.personType === "elemento_df" ? "ocorrencia" : null,
                notes: [],
              });
            }}
            style={primaryBtnStyle}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Sanções: detalhe / progressão do processo ----------
function SanctionDetail({ sanction, onClose, onUpdate, onAddNote, onRemove, complaints, sanctionTypes }) {
  const [note, setNote] = useState("");
  const [propostaText, setPropostaText] = useState(sanction.propostaSancao || "");
  const [sancaoFamiliaText, setSancaoFamiliaText] = useState(sanction.sanctionDescription || "");
  const notes = [...(sanction.notes || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const motivoMeta = MOTIVO_META[sanction.motivo] || MOTIVO_META.outro;
  const relatedComplaint = sanction.relatedComplaintId ? complaints.find((c) => c.id === sanction.relatedComplaintId) : null;

  const submitNote = () => {
    const v = note.trim();
    if (!v) return;
    onAddNote(sanction.id, v);
    setNote("");
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,38,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(540px, 92vw)", maxHeight: "88vh", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 6, padding: "24px 24px 26px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
            {fmt(new Date(sanction.date + "T00:00:00"))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button title="Eliminar" onClick={() => onRemove(sanction.id)} style={iconBtnStyle}>
              <Trash2 size={16} color={COLORS.danger} />
            </button>
            <button onClick={onClose} style={iconBtnStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
        <h2 style={{ margin: "6px 0 6px", fontFamily: "'Fraunces', serif", fontSize: 20, color: COLORS.navy }}>{sanction.personName}</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <Tag label={PERSON_TYPE_META[sanction.personType].label} color={COLORS.navy} bg={COLORS.rule} />
          <Tag label={motivoMeta.label} color={motivoMeta.color} bg={motivoMeta.bg} />
          {sanction.school && <Tag label={sanction.school} color={COLORS.slate} bg={COLORS.doneBg} />}
        </div>

        {relatedComplaint && (
          <div style={{ fontSize: 12.5, color: COLORS.navySoft, marginBottom: 14 }}>
            Associada à reclamação Nº {String(relatedComplaint.entryNumber).padStart(4, "0")} — {relatedComplaint.complainant}
          </div>
        )}

        {sanction.description && (
          <div style={{ fontSize: 13.5, marginBottom: 18, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
            {sanction.description}
          </div>
        )}

        {sanction.personType === "familia" ? (
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...labelStyle, marginTop: 0 }}>Foi aplicada sanção?</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[
                { key: true, label: "Sim" },
                { key: false, label: "Não" },
              ].map((opt) => (
                <button
                  key={String(opt.key)}
                  onClick={() => onUpdate(sanction.id, { sanctionApplied: opt.key })}
                  style={{
                    flex: 1,
                    padding: "8px 6px",
                    borderRadius: 4,
                    border: `1.5px solid ${sanction.sanctionApplied === opt.key ? COLORS.navy : COLORS.rule}`,
                    background: sanction.sanctionApplied === opt.key ? COLORS.navy : "transparent",
                    color: sanction.sanctionApplied === opt.key ? "#fff" : COLORS.ink,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {sanction.sanctionApplied === true && (
              <>
                <label style={{ ...labelStyle, marginTop: 4 }}>Tipo de sanção</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {(sanctionTypes || []).map((label) => {
                    const meta = colorForLabel(label);
                    const active = sanction.sanctionType === label;
                    return (
                      <button
                        key={label}
                        onClick={() => onUpdate(sanction.id, { sanctionType: label })}
                        style={{
                          flex: "1 1 45%",
                          padding: "8px 6px",
                          borderRadius: 4,
                          border: `1.5px solid ${active ? meta.color : COLORS.rule}`,
                          background: active ? meta.bg : "transparent",
                          color: active ? meta.color : COLORS.ink,
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <textarea
                    rows={2}
                    placeholder="Detalhe da sanção (duração, condições)..."
                    value={sancaoFamiliaText}
                    onChange={(e) => setSancaoFamiliaText(e.target.value)}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
                  />
                  <button
                    onClick={() => onUpdate(sanction.id, { sanctionDescription: sancaoFamiliaText })}
                    style={{ ...primaryBtnStyle, flex: "none", padding: "0 14px" }}
                  >
                    Guardar
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Processo disciplinar
            </div>
            <Tag label={DF_STAGE_META[sanction.stage]?.label || "Ocorrência registada"} color={DF_STAGE_META[sanction.stage]?.color || COLORS.slate} bg={DF_STAGE_META[sanction.stage]?.bg || COLORS.doneBg} />

            {sanction.stage === "ocorrencia" && (
              <button
                onClick={() => onUpdate(sanction.id, { stage: "inquerito", inqueritoDate: new Date().toISOString() })}
                style={{ ...secondaryBtnStyle, flex: "none", padding: "8px 14px", marginTop: 12, display: "block" }}
              >
                Abrir inquérito disciplinar
              </button>
            )}

            {sanction.stage === "inquerito" && (
              <div style={{ marginTop: 12 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Proposta de sanção (para tomada de decisão)</label>
                <textarea
                  rows={3}
                  placeholder="Conclusões do inquérito e proposta de sanção..."
                  value={propostaText}
                  onChange={(e) => setPropostaText(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
                <button
                  onClick={() => onUpdate(sanction.id, { stage: "proposta", propostaSancao: propostaText })}
                  style={{ ...secondaryBtnStyle, flex: "none", padding: "8px 14px" }}
                >
                  Submeter proposta para decisão
                </button>
              </div>
            )}

            {(sanction.stage === "proposta" || sanction.stage === "decisao_suspensao" || sanction.stage === "decisao_expulsao" || sanction.stage === "decisao_arquivado") && sanction.propostaSancao && (
              <div style={{ fontSize: 13, marginTop: 12, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
                <strong>Proposta:</strong> {sanction.propostaSancao}
              </div>
            )}

            {sanction.stage === "proposta" && (
              <div style={{ marginTop: 14 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Decisão final</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => onUpdate(sanction.id, { stage: "decisao_suspensao", decisaoDate: new Date().toISOString() })}
                    style={{ ...secondaryBtnStyle, flex: "1 1 30%", padding: "8px 6px", fontSize: 12, borderColor: COLORS.danger, color: COLORS.danger }}
                  >
                    Suspensão
                  </button>
                  <button
                    onClick={() => onUpdate(sanction.id, { stage: "decisao_expulsao", decisaoDate: new Date().toISOString() })}
                    style={{ ...secondaryBtnStyle, flex: "1 1 30%", padding: "8px 6px", fontSize: 12, borderColor: COLORS.danger, color: COLORS.danger }}
                  >
                    Expulsão do projeto
                  </button>
                  <button
                    onClick={() => onUpdate(sanction.id, { stage: "decisao_arquivado", decisaoDate: new Date().toISOString() })}
                    style={{ ...secondaryBtnStyle, flex: "1 1 30%", padding: "8px 6px", fontSize: 12, borderColor: COLORS.ok, color: COLORS.ok }}
                  >
                    Arquivar / sem sanção
                  </button>
                </div>
              </div>
            )}

            {sanction.decisaoDate && (
              <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
                Decisão registada em {fmt(new Date(sanction.decisaoDate))}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Notas
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <textarea
            rows={2}
            placeholder="Adicionar nota ao processo..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
          />
          <button onClick={submitNote} style={{ ...primaryBtnStyle, flex: "none", padding: "0 16px" }}>
            Adicionar
          </button>
        </div>
        {notes.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Ainda sem notas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ borderLeft: `2.5px solid ${COLORS.navySoft}`, paddingLeft: 12 }}>
                <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: COLORS.slate, marginBottom: 3 }}>
                  {new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
                    new Date(n.date)
                  )}
                </div>
                <div style={{ fontSize: 13.5 }}>{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Sanções: página (lista + análise) ----------
function SanctionsPage({ sanctions, onNew, onOpen }) {
  const familia = sanctions.filter((s) => s.personType === "familia");
  const elementosDF = sanctions.filter((s) => s.personType === "elemento_df");

  const sancoesAplicadasFamilia = familia.filter((s) => s.sanctionApplied === true).length;
  const semSancaoFamilia = familia.filter((s) => s.sanctionApplied === false).length;
  const sancoesFinaisDF = elementosDF.filter((s) => s.stage === "decisao_suspensao" || s.stage === "decisao_expulsao").length;
  const semSancaoDF = elementosDF.filter((s) => s.stage === "decisao_arquivado").length;

  const motivoData = Object.entries(MOTIVO_META).map(([key, meta]) => ({
    name: meta.label,
    value: sanctions.filter((s) => s.motivo === key).length,
    color: meta.color,
  }));

  const tipoSancaoData = useMemo(() => {
    const counts = {};
    familia.forEach((s) => {
      if (s.sanctionApplied === true && s.sanctionType) counts[s.sanctionType] = (counts[s.sanctionType] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, color: colorForLabel(name).color }));
  }, [familia]);

  const Row = ({ s }) => (
    <div
      key={s.id}
      onClick={() => onOpen(s)}
      style={{
        ...panelStyle,
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.personName}</div>
        <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: "'IBM Plex Mono', monospace" }}>
          {fmt(new Date(s.date + "T00:00:00"))}
          {s.school ? ` · ${s.school}` : ""}
          {s.relatedComplaintId ? " · associada a reclamação" : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag label={MOTIVO_META[s.motivo].label} color={MOTIVO_META[s.motivo].color} bg={MOTIVO_META[s.motivo].bg} />
        {s.personType === "familia" ? (
          s.sanctionApplied === true ? (
            <Tag label={s.sanctionType || "Sanção aplicada"} color={COLORS.danger} bg={COLORS.dangerBg} />
          ) : s.sanctionApplied === false ? (
            <Tag label="Sem sanção" color={COLORS.ok} bg={COLORS.okBg} />
          ) : (
            <Tag label="Por decidir" color={COLORS.slate} bg={COLORS.doneBg} />
          )
        ) : (
          <Tag
            label={DF_STAGE_META[s.stage]?.label || "Ocorrência registada"}
            color={DF_STAGE_META[s.stage]?.color || COLORS.slate}
            bg={DF_STAGE_META[s.stage]?.bg || COLORS.doneBg}
          />
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", flex: 1 }}>
          <StatCard label="Total de ocorrências" value={sanctions.length} />
          <StatCard label="Sanções aplicadas (Pais/EE)" value={sancoesAplicadasFamilia} color={COLORS.danger} />
          <StatCard label="Sem sanção (Pais/EE)" value={semSancaoFamilia} color={COLORS.ok} />
          <StatCard label="Suspensão/Expulsão (DF)" value={sancoesFinaisDF} color={COLORS.danger} />
        </div>
        <button
          onClick={onNew}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: COLORS.navy,
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "10px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Plus size={16} /> Nova ocorrência
        </button>
      </div>

      {sanctions.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 24 }}>
          <div style={panelTitle}>Ocorrências por motivo (má conduta, ameaças, insultos, agressões)</div>
          <ResponsiveContainer width="100%" height={Math.max(160, motivoData.length * 34)}>
            <BarChart data={motivoData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke={COLORS.rule} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
              <Bar dataKey="value" fill={COLORS.navySoft} radius={[0, 3, 3, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tipoSancaoData.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 24 }}>
          <div style={panelTitle}>Sanções aplicadas por tipo (Pais / EE)</div>
          <ResponsiveContainer width="100%" height={Math.max(160, tipoSancaoData.length * 34)}>
            <BarChart data={tipoSancaoData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke={COLORS.rule} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
              <Bar dataKey="value" fill={COLORS.danger} radius={[0, 3, 3, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={panelTitle}>Sanções a Pais / Encarregados de Educação</div>
      {familia.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 20px", color: COLORS.slate, border: `1.5px dashed ${COLORS.rule}`, borderRadius: 6, marginBottom: 26 }}>
          Sem ocorrências registadas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {[...familia].sort((a, b) => new Date(b.date) - new Date(a.date)).map((s) => <Row key={s.id} s={s} />)}
        </div>
      )}

      <div style={panelTitle}>Elementos Dragon Force (processo disciplinar)</div>
      {elementosDF.length === 0 ? (
        <div style={{ textAlign: "center", padding: "30px 20px", color: COLORS.slate, border: `1.5px dashed ${COLORS.rule}`, borderRadius: 6 }}>
          Sem ocorrências registadas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...elementosDF].sort((a, b) => new Date(b.date) - new Date(a.date)).map((s) => <Row key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [entries, setEntries] = useState([]);
  const [options, setOptions] = useState({ schools: [], categories: [], auditCategories: [], complaintCategories: DEFAULT_CATEGORIAS, sanctionTypes: DEFAULT_TIPOS_SANCAO });
  const [audits, setAudits] = useState([]);
  const [sanctions, setSanctions] = useState([]);
  const [learned, setLearned] = useState({ canal: {}, categoria: {}, tema: {}, gravidade: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [viewingAudit, setViewingAudit] = useState(null);
  const [viewingDetail, setViewingDetail] = useState(null);
  const [showSanctionForm, setShowSanctionForm] = useState(false);
  const [viewingSanction, setViewingSanction] = useState(null);
  const [page, setPage] = useState("registo");
  const [reclamacoesView, setReclamacoesView] = useState("registo");
  const [editing, setEditing] = useState(null);
  const [filterCanal, setFilterCanal] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");

  const persist = useCallback(async (next) => {
    setEntries(next);
    try {
      await dbStorage.set(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      setError("Não foi possível guardar. As alterações podem não ter sido sincronizadas.");
    }
  }, []);

  const persistOptions = useCallback(async (next) => {
    setOptions(next);
    try {
      await dbStorage.set(STORAGE_OPTIONS_KEY, JSON.stringify(next));
    } catch (e) {
      setError("Não foi possível guardar as listas de escolas/categorias.");
    }
  }, []);

  const persistAudits = useCallback(async (next) => {
    setAudits(next);
    try {
      await dbStorage.set(STORAGE_AUDITS_KEY, JSON.stringify(next));
    } catch (e) {
      setError("Não foi possível guardar as auditorias.");
    }
  }, []);

  const persistSanctions = useCallback(async (next) => {
    setSanctions(next);
    try {
      await dbStorage.set(STORAGE_SANCOES_KEY, JSON.stringify(next));
    } catch (e) {
      setError("Não foi possível guardar o registo de sanções.");
    }
  }, []);

  const persistLearned = useCallback(async (next) => {
    setLearned(next);
    try {
      await dbStorage.set(STORAGE_TRIAGEM_KEY, JSON.stringify(next));
    } catch (e) {
      // falha silenciosa — não é crítico, a triagem só fica sem aprender desta vez
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await dbStorage.get(STORAGE_KEY);
        if (res && res.value) setEntries(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_OPTIONS_KEY);
        if (res && res.value) setOptions({ schools: [], categories: [], auditCategories: [], complaintCategories: DEFAULT_CATEGORIAS, sanctionTypes: DEFAULT_TIPOS_SANCAO, ...JSON.parse(res.value) });
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_AUDITS_KEY);
        if (res && res.value) setAudits(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_SANCOES_KEY);
        if (res && res.value) setSanctions(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await dbStorage.get(STORAGE_TRIAGEM_KEY);
        if (res && res.value) setLearned({ canal: {}, categoria: {}, tema: {}, gravidade: {}, ...JSON.parse(res.value) });
      } catch (e) {
        // chave ainda não existe — arranque limpo, aprende a partir de agora
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addOption = (kind, value) => {
    if (options[kind].includes(value)) return;
    persistOptions({ ...options, [kind]: [...options[kind], value] });
  };

  const removeOption = (kind, value) => {
    persistOptions({ ...options, [kind]: options[kind].filter((v) => v !== value) });
  };

  const addAudit = (audit) => {
    persistAudits([...audits, audit]);
    setShowAuditForm(false);
  };

  const removeAudit = (auditId) => {
    persistAudits(audits.filter((a) => a.id !== auditId));
    setViewingAudit(null);
  };

  const addFinding = (auditId, finding) => {
    const next = audits.map((a) => (a.id === auditId ? { ...a, findings: [...a.findings, finding] } : a));
    persistAudits(next);
    setViewingAudit(next.find((a) => a.id === auditId));
  };

  const removeFinding = (auditId, findingId) => {
    const next = audits.map((a) => (a.id === auditId ? { ...a, findings: a.findings.filter((f) => f.id !== findingId) } : a));
    persistAudits(next);
    setViewingAudit(next.find((a) => a.id === auditId));
  };

  const addNote = (entryId, text) => {
    const next = entries.map((e) =>
      e.id === entryId ? { ...e, notes: [...(e.notes || []), { id: `n_${Date.now()}`, text, date: new Date().toISOString() }] } : e
    );
    persist(next);
    setViewingDetail(next.find((e) => e.id === entryId));
  };

  const saveSanction = (sanction) => {
    const exists = sanctions.some((s) => s.id === sanction.id);
    const next = exists ? sanctions.map((s) => (s.id === sanction.id ? sanction : s)) : [...sanctions, sanction];
    persistSanctions(next);
    setShowSanctionForm(false);
  };

  const removeSanction = (id) => {
    persistSanctions(sanctions.filter((s) => s.id !== id));
    setViewingSanction(null);
  };

  const updateSanction = (id, patch) => {
    const next = sanctions.map((s) => (s.id === id ? { ...s, ...patch } : s));
    persistSanctions(next);
    setViewingSanction(next.find((s) => s.id === id));
  };

  const addSanctionNote = (id, text) => {
    const next = sanctions.map((s) =>
      s.id === id ? { ...s, notes: [...(s.notes || []), { id: `n_${Date.now()}`, text, date: new Date().toISOString() }] } : s
    );
    persistSanctions(next);
    setViewingSanction(next.find((s) => s.id === id));
  };

  const nextNumber = entries.length ? Math.max(...entries.map((e) => e.entryNumber)) + 1 : 1;

  const withStatus = entries.map((e) => ({ ...e, derivedStatus: deriveStatus(e) }));

  const filtered = withStatus
    .filter((e) => (filterCanal === "todos" ? true : e.canal === filterCanal))
    .filter((e) => (filterStatus === "todos" ? true : e.derivedStatus === filterStatus))
    .filter((e) => (search ? (e.complainant + e.description).toLowerCase().includes(search.toLowerCase()) : true))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const stats = {
    porPegar: withStatus.filter((e) => e.derivedStatus === "por_pegar").length,
    emAndamento: withStatus.filter((e) => e.derivedStatus === "em_andamento").length,
    atrasadas: withStatus.filter((e) => e.derivedStatus === "atrasado").length,
    concluidas: withStatus.filter((e) => e.derivedStatus === "concluido").length,
  };

  const handleSave = (item) => {
    const exists = entries.some((e) => e.id === item.id);
    const next = exists ? entries.map((e) => (e.id === item.id ? item : e)) : [...entries, item];
    persist(next);
    persistLearned(learnFromEntry(learned, item));
    setShowForm(false);
    setEditing(null);
  };

  const startWork = (id) => {
    persist(
      entries.map((e) => (e.id === id ? { ...e, status: "em_andamento", startedDate: e.startedDate || new Date().toISOString() } : e))
    );
  };

  const markDone = (id, { responseText, eficacia } = {}) => {
    persist(
      entries.map((e) =>
        e.id === id
          ? {
              ...e,
              status: "concluido",
              resolvedDate: new Date().toISOString(),
              startedDate: e.startedDate || new Date().toISOString(),
              responseText: responseText !== undefined ? responseText : e.responseText || "",
              eficacia: eficacia !== undefined ? eficacia : e.eficacia || "",
            }
          : e
      )
    );
  };

  const reopen = (id) => {
    persist(entries.map((e) => (e.id === id ? { ...e, status: "em_andamento", resolvedDate: null } : e)));
  };

  const remove = (id) => {
    persist(entries.filter((e) => e.id !== id));
  };

  return (
    <div
      style={{
        fontFamily: "'Source Sans 3', sans-serif",
        background: COLORS.paper,
        minHeight: "100vh",
        color: COLORS.ink,
        padding: "0",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Source+Sans+3:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <header
        style={{
          borderBottom: `2px solid ${COLORS.navy}`,
          background: COLORS.navy,
          color: "#fff",
          padding: "22px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: "0.12em", opacity: 0.7 }}>
            {APP_NAME.toUpperCase()}
          </div>
          <h1 style={{ margin: "2px 0 0", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26 }}>
            {page === "auditorias"
              ? "Auditorias"
              : page === "sancoes"
              ? "Sanções"
              : reclamacoesView === "analise"
              ? "Reclamações — Análise"
              : "Reclamações — Registo"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setShowManage(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              color: "#fff",
              border: "1.5px solid rgba(255,255,255,0.5)",
              borderRadius: 4,
              padding: "10px 14px",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Escolas e categorias
          </button>
          {page === "registo" && reclamacoesView === "registo" && (
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fff",
                color: COLORS.navy,
                border: "none",
                borderRadius: 4,
                padding: "10px 16px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              <Plus size={16} /> Nova reclamação
            </button>
          )}
        </div>
      </header>

      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "14px 28px 0",
          maxWidth: 1100,
          margin: "0 auto",
          borderBottom: `1px solid ${COLORS.rule}`,
        }}
      >
        {[
          { key: "registo", label: "Reclamações", icon: LayoutGrid },
          { key: "auditorias", label: "Auditorias", icon: ClipboardList },
          { key: "sancoes", label: "Sanções", icon: Scale },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setPage(key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 16px",
              border: "none",
              borderBottom: `2.5px solid ${page === key ? COLORS.navy : "transparent"}`,
              background: "transparent",
              color: page === key ? COLORS.navy : COLORS.slate,
              fontWeight: 600,
              fontSize: 13.5,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "22px 28px 60px", maxWidth: 1100, margin: "0 auto" }}>
        {page === "auditorias" ? (
          <AuditsPage audits={audits} onNewAudit={() => setShowAuditForm(true)} onOpenAudit={(a) => setViewingAudit(a)} />
        ) : page === "sancoes" ? (
          <SanctionsPage
            sanctions={sanctions}
            onNew={() => setShowSanctionForm(true)}
            onOpen={(s) => setViewingSanction(s)}
          />
        ) : (
        <>
        <div
          style={{
            display: "inline-flex",
            gap: 3,
            padding: 3,
            marginBottom: 20,
            background: "#EFEDE6",
            border: `1px solid ${COLORS.rule}`,
            borderRadius: 6,
          }}
        >
          {[
            { key: "registo", label: "Registo", icon: LayoutGrid },
            { key: "analise", label: "Análise", icon: BarChart3 },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setReclamacoesView(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                border: "none",
                borderRadius: 4,
                background: reclamacoesView === key ? COLORS.navy : "transparent",
                color: reclamacoesView === key ? "#fff" : COLORS.slate,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {reclamacoesView === "analise" ? (
          <AnalysisDashboard withStatus={withStatus} schoolOptions={options.schools} categoryOptions={options.categories} categoriaOptions={options.complaintCategories} />
        ) : (
        <>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            background: COLORS.warnBg,
            border: `1px solid ${COLORS.warn}`,
            borderRadius: 5,
            padding: "12px 14px",
            marginBottom: 22,
            fontSize: 13,
            color: "#5c4409",
          }}
        >
          <ShieldAlert size={18} color={COLORS.warn} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            Estes dados são partilhados por qualquer pessoa com acesso a este artefacto — não têm autenticação real.
            Não é adequado para dados sensíveis de reclamantes a longo prazo; usa isto como protótipo de trabalho,
            e mantém o link apenas dentro da equipa.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Por iniciar" value={stats.porPegar} color={COLORS.warn} />
          <StatCard label="Em andamento" value={stats.emAndamento} color={COLORS.progress} />
          <StatCard label="Atrasadas" value={stats.atrasadas} color={COLORS.danger} />
          <StatCard label="Concluídas" value={stats.concluidas} color={COLORS.ok} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: COLORS.slate }} />
            <input
              placeholder="Pesquisar reclamante ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>
          <select value={filterCanal} onChange={(e) => setFilterCanal(e.target.value)} style={{ ...inputStyle, width: 190 }}>
            <option value="todos">Todos os canais</option>
            {Object.entries(CANAL_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 190 }}>
            <option value="todos">Todos os estados</option>
            <option value="por_pegar">Por iniciar</option>
            <option value="em_andamento">Em andamento</option>
            <option value="atrasado">Atrasado</option>
            <option value="concluido">Concluído</option>
          </select>
        </div>

        {loading ? (
          <div style={{ color: COLORS.slate, padding: 30, textAlign: "center" }}>A carregar registo...</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
              color: COLORS.slate,
              border: `1.5px dashed ${COLORS.rule}`,
              borderRadius: 6,
            }}
          >
            Sem reclamações a mostrar. Cria a primeira entrada com "Nova reclamação".
          </div>
        ) : (
          <div style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 6, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 880 }}>
              <thead>
                <tr style={{ background: "#EFEDE6", textAlign: "left" }}>
                  {["Nº", "Receção", "Canal", "Gravidade", "Categoria", "Escola", "Tema", "Reclamante", "Prazo", "Estado", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        fontSize: 11,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: COLORS.slate,
                        fontWeight: 600,
                        borderBottom: `1.5px solid ${COLORS.rule}`,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${COLORS.rule}` }}>
                    <td style={{ padding: "10px 14px", fontFamily: "'IBM Plex Mono', monospace", color: COLORS.slate }}>
                      {String(e.entryNumber).padStart(4, "0")}
                    </td>
                    <td style={{ padding: "10px 14px" }}>{fmt(new Date(e.receivedDate + "T00:00:00"))}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {e.canal && CANAL_META[e.canal] && <Tag label={CANAL_META[e.canal].label} color={CANAL_META[e.canal].color} bg={CANAL_META[e.canal].bg} />}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {e.severity && <Tag label={SEVERITY_META[e.severity].label} color={SEVERITY_META[e.severity].color} bg={SEVERITY_META[e.severity].bg} />}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {e.categoria && <Tag label={e.categoria} color={colorForLabel(e.categoria).color} bg={colorForLabel(e.categoria).bg} />}
                    </td>
                    <td style={{ padding: "10px 14px", color: COLORS.slate }}>{e.school || "—"}</td>
                    <td style={{ padding: "10px 14px", color: COLORS.slate }}>{e.tema || "—"}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{e.complainant}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(new Date(e.deadline))}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <Stamp statusKey={e.derivedStatus} onClick={() => setViewingDetail(e)} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {e.status === "por_pegar" && (
                          <button title="Iniciar" onClick={() => startWork(e.id)} style={iconBtnStyle}>
                            <Play size={16} color={COLORS.progress} />
                          </button>
                        )}
                        {e.derivedStatus === "concluido" ? (
                          <button title="Reabrir" onClick={() => reopen(e.id)} style={iconBtnStyle}>
                            <Clock size={16} />
                          </button>
                        ) : (
                          <button title="Marcar concluído" onClick={() => setViewingDetail(e)} style={iconBtnStyle}>
                            <Check size={16} color={COLORS.ok} />
                          </button>
                        )}
                        <button
                          title="Editar"
                          onClick={() => {
                            setEditing(e);
                            setShowForm(true);
                          }}
                          style={iconBtnStyle}
                        >
                          <Pencil size={16} />
                        </button>
                        <button title="Eliminar" onClick={() => remove(e.id)} style={iconBtnStyle}>
                          <Trash2 size={16} color={COLORS.danger} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <div style={{ color: COLORS.danger, marginTop: 14, fontSize: 13 }}>{error}</div>}
        </>
        )}
        </>
        )}
      </div>

      {showForm && (
        <EntryForm
          initial={editing}
          nextNumber={nextNumber}
          schoolOptions={options.schools}
          categoryOptions={options.categories}
          categoriaOptions={options.complaintCategories}
          onManageOptions={() => setShowManage(true)}
          learned={learned}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      {showManage && (
        <ManageOptionsModal
          schools={options.schools}
          categories={options.categories}
          auditCategories={options.auditCategories}
          complaintCategories={options.complaintCategories}
          sanctionTypes={options.sanctionTypes}
          onAdd={addOption}
          onRemove={removeOption}
          onClose={() => setShowManage(false)}
        />
      )}

      {viewingDetail && (
        <ComplaintDetail
          entry={withStatus.find((e) => e.id === viewingDetail.id) || viewingDetail}
          onClose={() => setViewingDetail(null)}
          onAddNote={addNote}
          onStart={(id) => {
            startWork(id);
            setViewingDetail(null);
          }}
          onDone={(id, extra) => {
            markDone(id, extra);
            setViewingDetail(null);
          }}
          onReopen={(id) => {
            reopen(id);
            setViewingDetail(null);
          }}
        />
      )}

      {showAuditForm && (
        <AuditForm
          schoolOptions={options.schools}
          onCancel={() => setShowAuditForm(false)}
          onSave={addAudit}
          onManageOptions={() => setShowManage(true)}
        />
      )}

      {viewingAudit && (
        <AuditDetail
          audit={audits.find((a) => a.id === viewingAudit.id) || viewingAudit}
          auditCategoryOptions={options.auditCategories}
          onClose={() => setViewingAudit(null)}
          onAddFinding={addFinding}
          onRemoveFinding={removeFinding}
          onRemoveAudit={removeAudit}
          onManageOptions={() => setShowManage(true)}
        />
      )}

      {showSanctionForm && (
        <SanctionForm
          onCancel={() => setShowSanctionForm(false)}
          onSave={saveSanction}
          schoolOptions={options.schools}
          complaints={entries}
          sanctionTypes={options.sanctionTypes}
          onManageOptions={() => setShowManage(true)}
        />
      )}

      {viewingSanction && (
        <SanctionDetail
          sanction={sanctions.find((s) => s.id === viewingSanction.id) || viewingSanction}
          onClose={() => setViewingSanction(null)}
          onUpdate={updateSanction}
          onAddNote={addSanctionNote}
          onRemove={removeSanction}
          complaints={entries}
          sanctionTypes={options.sanctionTypes}
        />
      )}
    </div>
  );
}
