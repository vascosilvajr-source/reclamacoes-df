// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { Plus, X, Search, Mail, Sparkles } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { CANAL_META, COLORS, SEVERITY_META, STATUS_META, Stamp, StatCard, Tag, Vazio, addDays, colorForLabel, epocaAud, epocaDe, fmt, iconBtnStyle, inputStyle, isBusinessDay, labelStyle, linkBtnStyle, nomeCausa, normChave, normalizeText, panelStyle, panelTitle, primaryBtnStyle, secondaryBtnStyle, tokenize } from "../nucleo.jsx";
import { ComparacaoEpocas, DicaGrafico, FiltroEpocas, Observacoes, PainelCausas, SeletorCausa, TickNome, epocasDisponiveis, itensCausa, naEpoca, naSelecao, observacoesReclamacoes } from "../partilhado.jsx";

function addBusinessDays(startDate, n) {
  let d = new Date(startDate);
  let remaining = n;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) remaining -= 1;
  }
  return d;
}

// Prazo legal: sempre 10 dias úteis a contar da data de receção.
const BUSINESS_DAYS_DEADLINE = 10;

const EFICACIA_META = {
  eficaz: { label: "Eficaz", color: COLORS.ok, bg: COLORS.okBg },
  parcial: { label: "Parcialmente eficaz", color: COLORS.warn, bg: COLORS.warnBg },
  ineficaz: { label: "Ineficaz", color: COLORS.danger, bg: COLORS.dangerBg },
};

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
    presencial: ["presencialmente", "pessoalmente", "balcao", "secretaria", "atendimento", "deslocar", "deslocei"],
    livro: ["livro"],
    redes: ["facebook", "instagram", "publicacao", "comentario", "rede", "social", "twitter", "tiktok"],
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

// Compara pela raiz da palavra, para "tecnica"/"tecnico" contarem como "Técnico".
// Exige raiz longa e comprimentos próximos, para evitar falsos positivos como
// "equipa" (da equipa de futebol) colar com "equipamentos".
function stemMatch(a, b) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min < 6) return false;
  if (Math.abs(a.length - b.length) > 3) return false;
  const root = min - 2;
  return a.slice(0, root) === b.slice(0, root);
}

function classifyFromList(words, learnedField, list, seedField) {
  const scores = scoreFromLearned(words, learnedField);
  Object.keys(scores).forEach((val) => {
    if (!list.includes(val)) delete scores[val];
  });
  list.forEach((label) => {
    const labelWords = tokenize(label);
    const hits = labelWords.filter((lw) => words.some((w) => stemMatch(w, lw))).length;
    if (hits > 0) scores[label] = (scores[label] || 0) + hits * 2;
  });
  // Pistas semânticas: reconhecem a categoria pelo assunto ("gritou", "insulto"
  // → Disciplinar) mesmo quando o nome da categoria não aparece no texto.
  if (seedField) {
    Object.entries(seedField).forEach(([label, keywords]) => {
      if (!list.includes(label)) return;
      const hits = keywords.filter((kw) => words.includes(kw)).length;
      if (hits > 0) scores[label] = (scores[label] || 0) + hits;
    });
  }
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

// Escolhe a escola mencionada no texto. Primeiro tenta o nome completo; se não
// encontrar, aceita correspondência pelas palavras distintivas do nome (ex:
// "Gondomar" basta para reconhecer "Dragon Force Gondomar"), ignorando termos
// genéricos que aparecem em quase todas as escolas.
const SCHOOL_GENERIC_WORDS = new Set(["dragon", "force", "escola", "academia", "centro", "clube", "futebol", "df"]);
function matchSchool(rawText, schools) {
  const norm = normalizeText(rawText);
  const textWords = new Set(tokenize(rawText));

  let best = "";
  let bestLen = 0;
  (schools || []).forEach((s) => {
    const ns = normalizeText(s).trim();
    if (ns && norm.includes(ns) && ns.length > bestLen) {
      best = s;
      bestLen = ns.length;
    }
  });
  if (best) return best;

  let bestScore = 0;
  (schools || []).forEach((s) => {
    const distinctive = tokenize(s).filter((w) => !SCHOOL_GENERIC_WORDS.has(w));
    if (distinctive.length === 0) return;
    const hits = distinctive.filter((w) => textWords.has(w)).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = s;
    }
  });
  return bestScore > 0 ? best : "";
}

function classifyText(rawText, learned, temas, categorias, schools) {
  const words = tokenize(rawText);
  const canal = classifyEnum(words, learned.canal, SEED_HINTS.canal) || "email";
  const gravidade = classifyEnum(words, learned.gravidade, SEED_HINTS.gravidade) || "media";
  const categoria = classifyFromList(words, learned.categoria, categorias, SEED_HINTS.categoria) || "";
  const tema = classifyFromList(words, learned.tema, temas) || "";

  // Remove a assinatura final antes de dividir em resumo/contexto, para não
  // ficar "Atenciosamente, Maria Silva" no meio do contexto.
  const semAssinatura = rawText.replace(
    /\n\s*(atenciosamente|cumprimentos|com os melhores cumprimentos|melhores cumprimentos|obrigado|obrigada|abra[çc]o)[,.\s]*[\s\S]*$/i,
    ""
  );

  // Remove a saudação inicial ("Boa tarde,", "Exmos. Senhores,") do resumo.
  const semSaudacao = semAssinatura.replace(
    /^\s*(bom dia|boa tarde|boa noite|ol[áa]|exmos?\.?\s+senhores?|exmo\.?\s+senhor|caros?|prezados?)[,.\s]*/i,
    ""
  );

  // Divide o texto: as primeiras frases viram resumo, o resto vai para contexto.
  const trimmed = semSaudacao.trim().replace(/[ \t]+/g, " ");
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
                color: COLORS.onAccent,
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

export function EntryForm({ initial, nextNumber, onCancel, onSave, schoolOptions, categoryOptions, categoriaOptions, onGerirLista, learned }) {
  const [form, setForm] = useState(
    initial || {
      receivedDate: new Date().toISOString().slice(0, 10),
      epoca: epocaDe(new Date().toISOString().slice(0, 10)),
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

  // A época acompanha a data de receção, a menos que tenha sido escolhida à mão.
  const [epocaManual, setEpocaManual] = useState(false);
  const setReceived = (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, receivedDate: v, epoca: epocaManual ? f.epoca : epocaDe(v) }));
  };

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
      if (!epocaManual) next.epoca = epocaDe(data.receivedDate);
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
      className="veil"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,14,24,0.5)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        className="drawer"
        style={{
          width: "min(470px, 100%)",
          background: COLORS.paperRaised,
          height: "100%",
          padding: "24px 24px 32px",
          overflowY: "auto",
          borderLeft: `1px solid ${COLORS.rule}`,
          boxShadow: "-14px 0 40px -10px rgba(8,14,24,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
              ENTRADA Nº {String(initial ? initial.entryNumber : nextNumber).padStart(4, "0")}
            </div>
            <h2 style={{ margin: "4px 0 0", fontSize: 22, color: COLORS.navy }}>
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
                color: form.canal === key ? COLORS.onAccent : COLORS.ink,
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
        <input type="date" value={form.receivedDate} onChange={setReceived} style={inputStyle} />

        <label style={labelStyle}>Época</label>
        <select
          value={form.epoca || ""}
          onChange={(e) => {
            setEpocaManual(true);
            setForm((f) => ({ ...f, epoca: e.target.value }));
          }}
          style={inputStyle}
        >
          {epocasDisponiveis([form.epoca]).map((ep) => (
            <option key={ep} value={ep}>
              {ep}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 4 }}>
          Preenchida a partir da data de receção. Muda-a se estiveres a registar uma reclamação de outra época.
        </div>
        {preview && (
          <div style={{ margin: "8px 0 4px", fontSize: 12.5, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
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
          <button type="button" onClick={() => onGerirLista("complaintCategories")} style={linkBtnStyle}>
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
          <button type="button" onClick={() => onGerirLista("schools")} style={linkBtnStyle}>
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
          <button type="button" onClick={() => onGerirLista("categories")} style={linkBtnStyle}>
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

// ---------- Manage schools/categories modal ----------

// ---------- Avaliação da eficácia pela escola (e-mail ao operacional e ao coordenador) ----------
const ROTULO_AVALIACAO = { eficaz: "Eficaz", parcial: "Parcialmente eficaz", ineficaz: "Não eficaz" };
const novoTokenPedido = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");

function AvaliacaoEscola({ entry, contactos, notificar }) {
  const [pedidos, setPedidos] = useState(null);
  const [resumo, setResumo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const carregar = useCallback(async () => {
    try {
      const { data } = await supabase.from("pedidos_operacionais").select("token, itens, respostas, respondido_em, criado, enviado_em, expira").eq("itens->>reclamacaoId", entry.id).order("criado", { ascending: false });
      setPedidos(data || []);
    } catch (e) {
      setPedidos([]);
    }
  }, [entry.id]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const papeis = [
    ["operacional", "Operacional", contactos.op || []],
    ["coordenador", "Coordenador", contactos.ct || []],
  ].filter(([, , l]) => l.length);
  const agora = new Date().toISOString();
  const emEspera = (pedidos || []).filter((p) => !p.respondido_em && p.expira > agora);
  const enviar = async () => {
    setAEnviar(true);
    try {
      const concluida = entry.resolvedDate ? new Date(entry.resolvedDate).toISOString().slice(0, 10) : "";
      const linhas = papeis.map(([papel, , l]) => ({
        token: novoTokenPedido(),
        escola: entry.school,
        emails: l,
        expira: new Date(Date.now() + 14 * 86400000).toISOString(),
        itens: { tipo: "eficacia", papel, reclamacaoId: entry.id, numero: entry.entryNumber, tema: entry.tema || entry.categoria || "", recebida: entry.receivedDate || "", concluida, resumo: resumo.trim() },
      }));
      const { error } = await supabase.from("pedidos_operacionais").insert(linhas);
      if (error) throw error;
      notificar && notificar("Pedido feito. O e-mail sai em poucos minutos.", "ok", 7000);
      setResumo("");
      await carregar();
    } catch (e) {
      notificar && notificar("Não foi possível criar o pedido. Confirma que o SQL novo foi corrido no Supabase.", "aviso", 8000);
    } finally {
      setAEnviar(false);
    }
  };
  if (!entry.school) return null;
  return (
    <div style={{ marginBottom: 18, padding: "12px 14px", background: COLORS.paper, border: `1px solid ${COLORS.rule}`, borderRadius: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Avaliar a eficácia com a escola</div>
      {papeis.length === 0 ? (
        <div style={{ fontSize: 12.5, color: COLORS.slate, lineHeight: 1.5 }}>Não há e-mails definidos para {entry.school}. Define-os em Inscritos › Experiências › Contactos das escolas.</div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 8 }}>
            Envia um e-mail a {papeis.map(([, nome, l]) => `${nome.toLowerCase()} (${l.length})`).join(" e ")} de {entry.school} para avaliarem se foi eficaz, parcialmente eficaz ou não eficaz. O e-mail leva só o número, o tema e as datas.
          </div>
          <textarea
            rows={2}
            value={resumo}
            maxLength={400}
            onChange={(e) => setResumo(e.target.value)}
            placeholder="O que foi feito (opcional, aparece no e-mail). Sem nomes de alunos ou famílias."
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: 13 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button onClick={enviar} disabled={aEnviar || emEspera.length > 0} style={{ ...primaryBtnStyle, flex: "none", padding: "7px 14px", fontSize: 12.5, opacity: aEnviar || emEspera.length > 0 ? 0.5 : 1 }}>
              {aEnviar ? "A criar…" : "Enviar para avaliação"}
            </button>
            {emEspera.length > 0 && <span style={{ fontSize: 12, color: COLORS.slate }}>Já pedido, à espera de resposta.</span>}
          </div>
        </>
      )}
      {(pedidos || []).length > 0 && (
        <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
          {pedidos.map((p) => {
            const av = p.respostas && p.respostas.avaliacao;
            const cor = av === "eficaz" ? COLORS.ok : av === "ineficaz" ? COLORS.danger : av === "parcial" ? COLORS.warn : COLORS.slate;
            return (
              <div key={p.token} style={{ fontSize: 12.5, borderLeft: `3px solid ${cor}`, paddingLeft: 8 }}>
                <strong>{p.itens?.papel === "coordenador" ? "Coordenador" : "Operacional"}</strong>
                {": "}
                {av ? (
                  <>
                    <span style={{ color: cor, fontWeight: 600 }}>{ROTULO_AVALIACAO[av]}</span>
                    {p.respostas.nota ? <span style={{ color: COLORS.ink2 }}> · {p.respostas.nota}</span> : null}
                  </>
                ) : !p.enviado_em ? (
                  <span style={{ color: COLORS.slate }}>a enviar nos próximos 10 minutos</span>
                ) : p.expira < agora ? (
                  <span style={{ color: COLORS.slate }}>expirou sem resposta</span>
                ) : (
                  <span style={{ color: COLORS.warn }}>enviado, à espera de resposta</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Complaint detail / notes timeline ----------
export function ComplaintDetail({ entry, onClose, onAddNote, onStart, onDone, onReopen, biblioteca = [], historico = [], onGerirLista, contactosEscola = {}, notificar, recorrencia = null, onIrRiscos }) {
  const [respostaTipoId, setRespostaTipoId] = useState(entry.respostaTipoId || null);
  const [assuntoSugerido, setAssuntoSugerido] = useState("");
  const [causaRaiz, setCausaRaiz] = useState(entry.causaRaiz || "");
  const [note, setNote] = useState("");
  const [concluding, setConcluding] = useState(false);
  const [responseText, setResponseText] = useState(entry.responseText || "");
  const [eficacia, setEficacia] = useState(entry.eficacia || "");
  const [resolvedOn, setResolvedOn] = useState(
    entry.resolvedDate ? new Date(entry.resolvedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [startedOn, setStartedOn] = useState(entry.startedDate ? new Date(entry.startedDate).toISOString().slice(0, 10) : "");
  const notes = [...(entry.notes || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Se a reclamação mudar (ou for atualizada após guardar), repõe os campos do
  // formulário a partir do que está realmente gravado.
  useEffect(() => {
    setResponseText(entry.responseText || "");
    setEficacia(entry.eficacia || "");
    setResolvedOn(
      entry.resolvedDate ? new Date(entry.resolvedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
    );
    setStartedOn(entry.startedDate ? new Date(entry.startedDate).toISOString().slice(0, 10) : "");
    setCausaRaiz(entry.causaRaiz || "");
  }, [entry.id, entry.responseText, entry.eficacia, entry.resolvedDate, entry.startedDate, entry.causaRaiz]);

  const submit = () => {
    const v = note.trim();
    if (!v) return;
    onAddNote(entry.id, v);
    setNote("");
  };

  const confirmDone = () => {
    const isEditing = entry.derivedStatus === "concluido";
    onDone(entry.id, { responseText: responseText.trim(), eficacia, resolvedDate: resolvedOn, startedDate: startedOn || null, respostaTipoId, causaRaiz }, isEditing);
  };

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="sheet"
        style={{ width: "min(560px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
            ENTRADA Nº {String(entry.entryNumber).padStart(4, "0")}
          </div>
          <button onClick={onClose} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: 20, color: COLORS.navy }}>{entry.complainant}</h2>

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
          {entry.epoca ? `Época ${entry.epoca} · ` : ""}Receção: {fmt(new Date(entry.receivedDate + "T00:00:00"))} · Prazo: {fmt(new Date(entry.deadline))}
          {entry.resolvedDate && ` · Concluída: ${fmt(new Date(entry.resolvedDate))}`}
        </div>

        {recorrencia && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, marginBottom: 14, padding: "8px 12px", borderRadius: 8, background: recorrencia.ligado ? COLORS.paper : COLORS.warnBg, border: `1px solid ${recorrencia.ligado ? COLORS.rule : COLORS.warn}` }}>
            <span style={{ flex: "1 1 240px", lineHeight: 1.5 }}>
              <strong>Recorrente:</strong> {recorrencia.n} reclamações de {String(recorrencia.tema).toLowerCase()} em {recorrencia.escola} nesta época.{" "}
              {recorrencia.ligado ? `Ligada ao risco nº ${recorrencia.ligado}.` : "Ainda sem risco ou ação no registo de riscos."}
            </span>
            {onIrRiscos && (
              <button type="button" onClick={onIrRiscos} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5 }}>
                {recorrencia.ligado ? "Ver em Riscos" : "Criar risco em Riscos"}
              </button>
            )}
          </div>
        )}

        {/^https?:\/\//i.test(entry.emailLink || "") && (
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
              {entry.causaRaiz ? ` · causa: ${nomeCausa(entry.causaRaiz)}` : ""}
            </div>
            <div style={{ fontSize: 13.5, padding: "10px 12px", background: COLORS.okBg, borderRadius: 4, border: `1px solid ${COLORS.ok}`, whiteSpace: "pre-wrap" }}>
              {entry.responseText}
            </div>
          </div>
        )}

        {entry.derivedStatus === "concluido" && <AvaliacaoEscola entry={entry} contactos={contactosEscola} notificar={notificar} />}

        {entry.derivedStatus !== "concluido" && (
          <SugestoesResposta
            entry={entry}
            biblioteca={biblioteca}
            historico={historico}
            onUsar={(texto, id, assunto) => {
              setResponseText(texto);
              setRespostaTipoId(id);
              setAssuntoSugerido(assunto || "");
              setConcluding(true);
            }}
          />
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
            <>
              <button onClick={() => setConcluding((v) => !v)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
                {concluding ? "Fechar edição" : "Editar conclusão"}
              </button>
              <button onClick={() => onReopen(entry.id)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
                Reabrir
              </button>
            </>
          )}
        </div>

        {concluding && (
          <div style={{ marginBottom: 20, padding: "12px 14px", background: COLORS.paper, border: `1.5px solid ${COLORS.navySoft}`, borderRadius: 5 }}>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data de início do trabalho (opcional)</label>
            <input
              type="date"
              value={startedOn}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setStartedOn(e.target.value)}
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 4, marginBottom: 14 }}>
              Deixa em branco se não sabes — nesse caso esta reclamação não entra no "Tempo médio de resposta" da
              Análise. Preenche se souberes quando começaste a tratar do assunto (mesmo que já tenha sido).
            </div>

            <label style={labelStyle}>Data da resposta / conclusão</label>
            <input
              type="date"
              value={resolvedOn}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setResolvedOn(e.target.value)}
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 4 }}>
              Ajusta esta data ao registar reclamações antigas — é a partir dela que se calcula o tempo de resolução.
            </div>

            <label style={labelStyle}>Resposta dada à reclamação</label>
            {assuntoSugerido && (
              <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 6 }}>
                Assunto do e-mail: <strong>{assuntoSugerido}</strong>
              </div>
            )}
            <textarea
              rows={responseText.length > 200 ? 9 : 3}
              placeholder="O que foi respondido / decidido..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
            {responseText.includes("[a preencher]") && (
              <div style={{ fontSize: 12, color: COLORS.warn, marginTop: 4, fontWeight: 600 }}>
                Substitui os campos “[a preencher]” antes de enviar.
              </div>
            )}
            {respostaTipoId && (
              <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>
                Baseada numa resposta-tipo. Podes adaptá-la: o texto final fica como exemplo para casos parecidos.
              </div>
            )}
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
            <div style={{ marginTop: 16 }}>
              <SeletorCausa valor={causaRaiz} onChange={setCausaRaiz} onGerirLista={onGerirLista} />
            </div>
            <button
              onClick={() => {
                confirmDone();
                if (entry.derivedStatus === "concluido") setConcluding(false);
              }}
              style={{ ...primaryBtnStyle, marginTop: 12, flex: "none", padding: "8px 16px" }}
            >
              {entry.derivedStatus === "concluido" ? "Guardar alterações" : "Confirmar conclusão"}
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
                <div style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: COLORS.slate, marginBottom: 3 }}>
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

export function AnalysisDashboard({ withStatus, audits = [], schoolOptions, categoryOptions, categoriaOptions }) {
  const [fSchool, setFSchool] = useState("todos");
  const [fTema, setFTema] = useState("todos");
  const [fCategoria, setFCategoria] = useState("todos");
  const [fCanal, setFCanal] = useState("todos");
  const [fGravidade, setFGravidade] = useState("todos");
  const [fEpoca, setFEpoca] = useState([]);
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
        .filter((e) => (fGravidade === "todos" ? true : e.severity === fGravidade))
        .filter((e) => naSelecao(fEpoca, e.epoca)),
    [withStatus, fSchool, fTema, fCategoria, fCanal, fGravidade, fEpoca]
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
      <ComparacaoEpocas
        titulo="Comparação entre épocas"
        nota="Respeita os filtros de escola, tema, categoria, canal e gravidade."
        epocas={withStatus.map((e) => e.epoca)}
        selecionadas={fEpoca}
        metricas={[
          { key: "n", label: "Reclamações recebidas", melhor: "baixo" },
          { key: "alta", label: "De gravidade alta", melhor: "baixo" },
          { key: "prazo", label: "Resolvidas no prazo", unidade: "%", melhor: "alto" },
          { key: "resp", label: "Tempo médio de resposta", unidade: " dias", melhor: "baixo", dec: 1 },
          { key: "resol", label: "Tempo médio de resolução", unidade: " dias", melhor: "baixo", dec: 1 },
          { key: "efic", label: "Respostas eficazes", unidade: "%", melhor: "alto" },
        ]}
        calcular={(ep, lim) => {
          const base = withStatus
            .filter((e) => (fSchool === "todos" ? true : e.school === fSchool))
            .filter((e) => (fTema === "todos" ? true : e.tema === fTema))
            .filter((e) => (fCategoria === "todos" ? true : e.categoria === fCategoria))
            .filter((e) => (fCanal === "todos" ? true : e.canal === fCanal))
            .filter((e) => (fGravidade === "todos" ? true : e.severity === fGravidade));
          const l = naEpoca(base, "receivedDate", ep, lim);
          const res = l.filter((e) => e.status === "concluido" && e.resolvedDate);
          const ini = l.filter((e) => e.startedDate);
          const media = (xs, f) => (xs.length ? Math.round((xs.reduce((t, x) => t + f(x), 0) / xs.length) * 10) / 10 : null);
          const dias = (a, b) => (new Date(b) - new Date(a + "T00:00:00")) / 86400000;
          return {
            n: l.length,
            alta: l.filter((e) => e.severity === "alta").length,
            prazo: res.length ? Math.round((res.filter((e) => new Date(e.resolvedDate) <= new Date(e.deadline)).length / res.length) * 100) : null,
            resp: media(ini, (e) => dias(e.receivedDate, e.startedDate)),
            resol: media(res, (e) => dias(e.receivedDate, e.resolvedDate)),
            efic: res.filter((e) => e.eficacia).length ? Math.round((res.filter((e) => e.eficacia === "eficaz").length / res.filter((e) => e.eficacia).length) * 100) : null,
          };
        }}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <FiltroEpocas epocas={withStatus.map((e) => e.epoca)} valor={fEpoca} onChange={setFEpoca} />
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
                  color: active ? COLORS.onAccent : COLORS.slate,
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
        <Vazio
          icon={Search}
          titulo="Nenhuma reclamação corresponde aos filtros"
          texto="Experimenta alargar o período ou limpar algum dos filtros acima."
        />
      ) : (
        <>
          <Observacoes itens={[...observacoesReclamacoes(filtered), ...observacoesCausas(itensCausa(filtered, audits.filter((a) => fSchool === "todos" || a.school === fSchool)))]} />
          <PainelCausas
            titulo="Causa raiz (reclamações e auditorias)"
            itens={itensCausa(filtered, audits.filter((a) => (fSchool === "todos" || a.school === fSchool) && naSelecao(fEpoca, epocaAud(a))))}
          />

          <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="Total de reclamações" value={total} />
            <StatCard
              label="Tempo médio de resposta"
              value={avgResponseDays !== null ? `${avgResponseDays} d` : "—"}
              color={COLORS.progress}
              subtitle="receção → início do trabalho"
            />
            <StatCard
              label="Tempo médio de resolução"
              value={avgResolutionDays !== null ? `${avgResolutionDays} d` : "—"}
              subtitle="receção → conclusão"
            />
            <StatCard
              label="Resolvidas dentro do prazo"
              value={onTimeRate !== null ? `${onTimeRate}%` : "—"}
              color={COLORS.ok}
              anel={onTimeRate}
            />
          </div>

          {visibleParams.has("monthly") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Reclamações por mês (últimos 12 meses)</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="gradAcento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.navy} stopOpacity="0.28" />
                      <stop offset="100%" stopColor={COLORS.navy} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} padding={{ left: 18, right: 18 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<DicaGrafico />} cursor={{ stroke: COLORS.rule }} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Reclamações"
                    stroke={COLORS.navy}
                    strokeWidth={2.5}
                    fill="url(#gradAcento)"
                    dot={{ r: 3, fill: COLORS.navy, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: COLORS.paperRaised }}
                    animationDuration={900}
                  />
                </AreaChart>
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
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
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
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
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
                        <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
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
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
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
                      <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={<TickNome largura={130} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
                      <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                      <Bar dataKey="value" fill={COLORS.navySoft} radius={[0, 3, 3, 0]} barSize={16} animationDuration={800} />
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
                      <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={<TickNome largura={130} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
                      <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                      <Bar dataKey="value" fill={COLORS.navy} radius={[0, 3, 3, 0]} barSize={16} animationDuration={800} />
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

// ======================================================================
// ---------- Respostas-tipo às reclamações ----------
// ======================================================================
// Sugere respostas para uma reclamação aberta a partir de duas fontes:
// 1) a biblioteca (respostas do Manual e as que forem acrescentadas);
// 2) respostas dadas no passado a reclamações parecidas.
// Aprende: cada vez que uma resposta-tipo é usada, o texto dessa reclamação
// passa a contar como exemplo daquela resposta nas sugestões seguintes.

const PALAVRAS_VAZIAS = new Set(
  "a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para com sem sob sobre que se nao sim e ou mas como mais menos muito muita muitos muitas ja ainda so tambem foi era ser esta estao estava este esta isso isto aquele aquela ao aos me mim te ti lhe lhes nos vos eu tu ele ela eles elas meu minha meus minhas seu sua seus suas nosso nossa filho filha educando atleta dragon force porque quando onde qual quais ha tem tinha ter fazer feito fez dia dias vez vezes ter".split(" ")
);

function tokensResposta(texto) {
  return normChave(texto)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !PALAVRAS_VAZIAS.has(t))
    .map((t) => t.slice(0, 6));
}

function vetor(tokens) {
  const v = {};
  tokens.forEach((t) => (v[t] = (v[t] || 0) + 1));
  return v;
}

function cosseno(a, b) {
  let num = 0;
  let na = 0;
  let nb = 0;
  Object.entries(a).forEach(([k, x]) => {
    na += x * x;
    if (b[k]) num += x * b[k];
  });
  Object.values(b).forEach((x) => (nb += x * x));
  return na && nb ? num / Math.sqrt(na * nb) : 0;
}

const textoReclamacao = (e) => [e.description, e.context, e.tema].filter(Boolean).join(" ");

function sugerirRespostas(entry, biblioteca, historico) {
  const texto = normChave(textoReclamacao(entry));
  const v = vetor(tokensResposta(textoReclamacao(entry)));
  if (!Object.keys(v).length) return [];

  const daBiblioteca = biblioteca.map((r) => {
    const palavras = (r.palavras || []).filter((p) => texto.includes(normChave(p)));
    // Exemplos aprendidos: reclamações a que esta resposta já foi dada.
    const exemplos = historico.filter((h) => h.respostaTipoId === r.id && h.id !== entry.id);
    const corpus = [r.situacao, (r.palavras || []).join(" "), ...exemplos.map(textoReclamacao)].join(" ");
    const sim = cosseno(v, vetor(tokensResposta(corpus)));
    const temaBonus = entry.tema && (r.temas || []).includes(entry.tema) ? 0.08 : 0;
    const score = palavras.length * 0.22 + sim * 0.9 + temaBonus + Math.min(exemplos.length, 5) * 0.02;
    return {
      tipo: "biblioteca",
      id: r.id,
      score,
      titulo: r.situacao,
      texto: r.texto,
      fonte: r.origem === "anexo" ? `Anexo · Modelo ${r.modelo}` : r.origem === "manual" ? `Manual · ${String(r.capitulo || "").split(",")[0]}` : "Biblioteca",
      assunto: r.assunto || "",
      origem: r.origem,
      motivo: palavras.length ? `Reconheceu: ${palavras.slice(0, 3).join(", ")}` : exemplos.length ? `Usada em ${exemplos.length} reclamação(ões) parecida(s)` : "Texto parecido",
      usos: exemplos.length,
    };
  });

  const passadas = historico
    .filter((h) => h.id !== entry.id && h.status === "concluido" && (h.responseText || "").trim().length >= 40 && h.eficacia !== "ineficaz")
    .map((h) => {
      const sim = cosseno(v, vetor(tokensResposta(textoReclamacao(h))));
      const bonus = (h.tema && h.tema === entry.tema ? 0.1 : 0) + (h.categoria && h.categoria === entry.categoria ? 0.04 : 0) + (h.eficacia === "eficaz" ? 0.05 : 0);
      return {
        tipo: "historico",
        id: h.id,
        score: sim + bonus,
        sim,
        titulo: `Resposta à nº ${String(h.entryNumber).padStart(4, "0")}${h.tema ? ` · ${h.tema}` : ""}`,
        texto: desembrulharResposta(h.responseText),
        original: h.responseText,
        fonte: `Resposta tua anterior${h.eficacia ? ` · ${EFICACIA_META[h.eficacia]?.label.toLowerCase()}` : ""}`,
        motivo: h.description ? `“${h.description.slice(0, 90)}${h.description.length > 90 ? "…" : ""}”` : "Reclamação parecida",
        respostaTipoId: h.respostaTipoId || null,
      };
    });

  const bib = daBiblioteca.filter((s) => s.score >= 0.3).sort((a, b) => b.score - a.score).slice(0, 3);
  // Sem repetir: uma resposta antiga que é a mesma resposta-tipo já sugerida não aparece outra vez.
  const vistos = new Set(bib.map((x) => x.id));
  const textos = new Set(bib.map((x) => normChave(x.texto)));
  const hist = passadas
    .filter((s) => s.sim >= 0.32 && s.score >= 0.35 && !(s.respostaTipoId && vistos.has(s.respostaTipoId)) && !textos.has(normChave(s.texto)))
    .sort((a, b) => b.score - a.score)
    .filter((s, i, arr) => arr.findIndex((o) => normChave(o.texto) === normChave(s.texto)) === i)
    .slice(0, 2);
  return [...bib, ...hist].sort((a, b) => b.score - a.score);
}

// Tira a saudação e a despedida de uma resposta antiga, para a reutilizar
// com o nome e a escola da reclamação atual.
function desembrulharResposta(texto) {
  let linhas = String(texto || "").split("\n");
  if (/^exm[oa]/i.test((linhas[0] || "").trim())) linhas = linhas.slice(1);
  while (linhas.length && (!linhas[0].trim() || /^agradecemos o seu contacto\.?$/i.test(linhas[0].trim()))) linhas = linhas.slice(1);
  const fim = linhas.findIndex((l) => /^agradecemos o contacto e permanecemos/i.test(l.trim()) || /^com os melhores cumprimentos/i.test(l.trim()));
  if (fim >= 0) linhas = linhas.slice(0, fim);
  return linhas.join("\n").trim();
}

// Formato dos modelos do Anexo: saudação, texto do modelo e assinatura.
// Não acrescenta frases: o texto é sempre o do modelo ou o que foi escrito antes.
function embrulharResposta(texto, entry, origem, assinatura) {
  const nome = (entry.complainant || "").trim();
  return [
    nome ? `Exmo.(a) Sr.(a) ${nome},` : "Exmo.(a) Sr.(a) Encarregado(a) de Educação,",
    "",
    texto.trim(),
    "",
    "Com os melhores cumprimentos,",
    "",
    "Secretaria Dragon Force",
    ...(assinatura ? [assinatura] : []),
  ].join("\n");
}

// Reutiliza uma resposta já dada tal como foi escrita, trocando só o nome na saudação.
function trocarNomeSaudacao(texto, entry) {
  const linhas = String(texto || "").split("\n");
  const nome = (entry.complainant || "").trim();
  if (nome && /^exm[oa]/i.test((linhas[0] || "").trim())) linhas[0] = `Exmo.(a) Sr.(a) ${nome},`;
  return linhas.join("\n");
}

const LS_ASSINATURA = "df-assinatura";

function SugestoesResposta({ entry, biblioteca, historico, onUsar }) {
  const [aberta, setAberta] = useState(null);
  const [comMoldura, setComMoldura] = useState(true);
  const [procurar, setProcurar] = useState(false);
  const [termo, setTermo] = useState("");
  const sugestoes = useMemo(() => sugerirRespostas(entry, biblioteca, historico), [entry, biblioteca, historico]);

  const [assinatura, setAssinatura] = useState(() => {
    try {
      return window.localStorage.getItem(LS_ASSINATURA) || "";
    } catch (e) {
      return "";
    }
  });
  const guardarAssinatura = (v) => {
    setAssinatura(v);
    try {
      window.localStorage.setItem(LS_ASSINATURA, v);
    } catch (e) {
      // só nesta sessão
    }
  };
  const usar = (s) => {
    const orig = s.origem || (biblioteca.find((r) => r.id === (s.tipo === "biblioteca" ? s.id : s.respostaTipoId)) || {}).origem;
    const final =
      s.tipo === "historico"
        ? comMoldura
          ? trocarNomeSaudacao(s.original || s.texto, entry)
          : s.texto
        : comMoldura
        ? embrulharResposta(s.texto, entry, orig, assinatura.trim())
        : s.texto;
    onUsar(final, s.tipo === "biblioteca" ? s.id : s.respostaTipoId || null, s.assunto || "");
  };
  const encontrados = termo.trim()
    ? biblioteca.filter((r) => normChave(`${r.situacao} ${r.texto} ${(r.palavras || []).join(" ")}`).includes(normChave(termo))).slice(0, 8)
    : biblioteca.slice(0, 8);

  return (
    <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 10, background: COLORS.navyWash, border: `1px solid ${COLORS.rule}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={13} /> Respostas sugeridas
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 11.5, color: COLORS.ink2, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input type="checkbox" checked={comMoldura} onChange={(e) => setComMoldura(e.target.checked)} /> Com saudação e assinatura
          </label>
          {comMoldura && (
            <input
              value={assinatura}
              onChange={(e) => guardarAssinatura(e.target.value)}
              placeholder="O teu nome (assinatura)"
              aria-label="Nome para a assinatura"
              style={{ ...inputStyle, width: 170, padding: "4px 8px", fontSize: 12 }}
            />
          )}
        </div>
      </div>

      {sugestoes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5 }}>
          Nenhum modelo do Anexo se aplica e ainda não respondeste a uma reclamação parecida. Escreve a resposta: fica guardada e passa a ser sugerida em casos semelhantes.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {sugestoes.map((s, i) => {
            const chave = `${s.tipo}-${s.id}`;
            const exp = aberta === chave;
            return (
              <div key={chave} style={{ background: COLORS.paperRaised, borderRadius: 8, padding: "10px 12px", border: `1px solid ${i === 0 ? COLORS.navySoft : COLORS.rule}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: s.tipo === "historico" ? COLORS.purple : COLORS.navySoft, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {s.fonte}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{s.titulo}</div>
                    {s.assunto && <div style={{ fontSize: 12, color: COLORS.ink2, marginTop: 2 }}>Assunto: {s.assunto}</div>}
                    <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 2 }}>
                      {s.motivo}
                      {s.texto.includes("[a preencher]") ? " · tem campos a preencher" : ""}
                    </div>
                  </div>
                  <button onClick={() => usar(s)} className="press" style={{ ...primaryBtnStyle, flex: "none", width: "auto", padding: "6px 12px", fontSize: 12.5 }}>
                    Usar
                  </button>
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: COLORS.ink2,
                    marginTop: 6,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    ...(exp ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }),
                  }}
                >
                  {s.texto}
                </div>
                <button onClick={() => setAberta(exp ? null : chave)} style={{ ...linkBtnStyle, marginTop: 4, fontSize: 11.5 }}>
                  {exp ? "Mostrar menos" : "Ler tudo"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => setProcurar((v) => !v)} style={{ ...linkBtnStyle, marginTop: 8, fontSize: 12 }}>
        {procurar ? "Fechar biblioteca" : "Procurar na biblioteca de respostas"}
      </button>
      {procurar && (
        <div style={{ marginTop: 8 }}>
          <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex: reembolso, convocatória, seguro…" style={inputStyle} aria-label="Procurar resposta-tipo" />
          <div style={{ display: "grid", gap: 4, marginTop: 6, maxHeight: 220, overflowY: "auto" }}>
            {encontrados.map((r) => (
              <button
                key={r.id}
                onClick={() => usar({ tipo: "biblioteca", id: r.id, texto: r.texto, assunto: r.assunto, origem: r.origem })}
                className="rowHover"
                style={{ textAlign: "left", background: "transparent", border: "none", borderRadius: 6, padding: "7px 8px", cursor: "pointer", color: COLORS.ink, font: "inherit" }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.situacao}</div>
                <div style={{ fontSize: 11.5, color: COLORS.slate, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.texto}</div>
              </button>
            ))}
            {encontrados.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate }}>Nada encontrado.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Biblioteca de respostas-tipo ----------
export function BibliotecaRespostas({ biblioteca, historico, onGuardar, onRemover, notificar }) {
  const [termo, setTermo] = useState("");
  const [editar, setEditar] = useState(null);
  const [confirmar, setConfirmar] = useState(false);

  const usos = (id) => historico.filter((h) => h.respostaTipoId === id);
  const lista = biblioteca.filter((r) => !termo.trim() || normChave(`${r.situacao} ${r.texto} ${(r.palavras || []).join(" ")}`).includes(normChave(termo)));
  const grupoDe = (r) => (r.origem === "anexo" ? `Anexo · ${r.capitulo}` : r.origem === "manual" ? `Manual · ${String(r.capitulo || "").split(",")[0]}` : "Acrescentadas por ti");
  const grupos = [...new Set(lista.map(grupoDe))].sort((a, b) => (a.startsWith("Acrescentadas") ? -1 : b.startsWith("Acrescentadas") ? 1 : 0));

  // Respostas dadas que ainda não estão na biblioteca: candidatas a resposta-tipo.
  const candidatas = historico
    .filter((h) => h.status === "concluido" && h.eficacia === "eficaz" && !h.respostaTipoId && (h.responseText || "").trim().length >= 60)
    .filter((h) => !biblioteca.some((r) => normChave(r.texto) === normChave(desembrulharResposta(h.responseText))))
    .reverse()
    .filter((h, i, arr) => arr.findIndex((o) => normChave(desembrulharResposta(o.responseText)) === normChave(desembrulharResposta(h.responseText))) === i)
    .slice(0, 5);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 420 }}>
          <Search size={14} color={COLORS.slate} style={{ position: "absolute", left: 10, top: 11 }} />
          <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Procurar respostas…" style={{ ...inputStyle, paddingLeft: 30 }} aria-label="Procurar respostas-tipo" />
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setEditar({ id: `r_${Date.now()}`, situacao: "", texto: "", palavras: [], temas: [], origem: "propria", novo: true })}
          className="press"
          style={{ display: "flex", alignItems: "center", gap: 7, background: COLORS.navy, color: COLORS.onAccent, border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
        >
          <Plus size={15} /> Nova resposta-tipo
        </button>
      </div>

      <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 16, lineHeight: 1.55, maxWidth: 760 }}>
        Os {biblioteca.filter((r) => r.origem === "anexo").length} modelos de e-mail do Anexo{biblioteca.some((r) => r.origem !== "anexo") ? " e as respostas que acrescentaste" : ""}. São sugeridos nas reclamações abertas. Quando um modelo não serve tal como está, adapta-o ou escreve a tua resposta: o texto que deres fica como exemplo e passa a ser sugerido em casos parecidos.
      </div>

      {candidatas.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={panelTitle}>Respostas tuas, com eficácia, que podes juntar à biblioteca</div>
          <div style={{ display: "grid", gap: 8 }}>
            {candidatas.map((h) => (
              <div key={h.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between", padding: "8px 10px", background: COLORS.paperSunken, borderRadius: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                    Nº {String(h.entryNumber).padStart(4, "0")} · {h.tema || "sem tema"}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.slate, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{h.responseText}</div>
                </div>
                <button
                  onClick={() => setEditar({ id: `r_${Date.now()}`, situacao: h.description || "", texto: desembrulharResposta(h.responseText), palavras: [], temas: h.tema ? [h.tema] : [], origem: "propria", novo: true })}
                  style={{ ...secondaryBtnStyle, flex: "none", padding: "6px 10px", fontSize: 12 }}
                >
                  Acrescentar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {grupos.map((g) => (
        <div key={g} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.navy, marginBottom: 8 }}>{g}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
            {lista
              .filter((r) => grupoDe(r) === g)
              .map((r) => {
                const u = usos(r.id);
                const efic = u.filter((h) => h.eficacia === "eficaz").length;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setConfirmar(false);
                      setEditar(r);
                    }}
                    className="liftable"
                    style={{ ...panelStyle, textAlign: "left", cursor: "pointer", font: "inherit", color: COLORS.ink, padding: "12px 14px" }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>“{r.situacao}”</div>
                    {r.assunto && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 2 }}>Assunto: {r.assunto}</div>}
                    <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 4, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.texto}</div>
                    <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 6 }}>
                      {u.length ? `Usada ${u.length}× · ${efic} eficaz${efic === 1 ? "" : "es"}` : "Ainda não usada"}
                      {(r.palavras || []).length ? ` · ${r.palavras.slice(0, 3).join(", ")}` : ""}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      ))}

      {editar && (
        <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={() => setEditar(null)}>
          <div
            className="sheet"
            style={{ width: "min(620px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>{editar.novo ? "Nova resposta-tipo" : "Editar resposta-tipo"}</h2>
              <button onClick={() => setEditar(null)} style={iconBtnStyle}>
                <X size={18} />
              </button>
            </div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="rt-situacao">
              Situação (o que o encarregado diz)
            </label>
            <input id="rt-situacao" value={editar.situacao} onChange={(e) => setEditar((x) => ({ ...x, situacao: e.target.value }))} placeholder="Ex: O meu filho joga pouco" style={inputStyle} />
            <label style={labelStyle} htmlFor="rt-assunto">
              Assunto do e-mail
            </label>
            <input id="rt-assunto" value={editar.assunto || ""} onChange={(e) => setEditar((x) => ({ ...x, assunto: e.target.value }))} placeholder="Ex: Esclarecimento sobre convocatória" style={inputStyle} />
            <label style={labelStyle} htmlFor="rt-texto">
              Resposta (sem saudação nem assinatura)
            </label>
            <textarea id="rt-texto" rows={7} value={editar.texto} onChange={(e) => setEditar((x) => ({ ...x, texto: e.target.value }))} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.55 }} />
            <label style={labelStyle} htmlFor="rt-palavras">
              Palavras-chave (separadas por vírgula)
            </label>
            <input
              id="rt-palavras"
              value={(editar.palavras || []).join(", ")}
              onChange={(e) => setEditar((x) => ({ ...x, palavras: e.target.value.split(",").map((p) => p.trim()).filter(Boolean) }))}
              placeholder="Ex: tempo de jogo, minutos, banco"
              style={inputStyle}
            />
            <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>Quando aparecem no texto da reclamação, esta resposta sobe nas sugestões.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center", flexWrap: "wrap" }}>
              {!editar.novo && (
                <button
                  onClick={() => {
                    if (!confirmar) return setConfirmar(true);
                    onRemover(editar.id);
                    setEditar(null);
                    notificar("Resposta-tipo apagada.", "aviso");
                  }}
                  style={{ ...secondaryBtnStyle, flex: "none", color: COLORS.danger, borderColor: confirmar ? COLORS.danger : COLORS.rule }}
                >
                  {confirmar ? "Confirmar: apagar" : "Apagar"}
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => setEditar(null)} style={{ ...secondaryBtnStyle, flex: "none" }}>
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!editar.situacao.trim() || !editar.texto.trim()) return notificar("Preenche a situação e a resposta.", "aviso");
                  const { novo, ...r } = editar;
                  onGuardar({ ...r, situacao: r.situacao.trim(), texto: r.texto.trim() });
                  setEditar(null);
                  notificar(novo ? "Resposta-tipo acrescentada." : "Resposta-tipo atualizada.");
                }}
                style={{ ...primaryBtnStyle, flex: "none", padding: "10px 18px" }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Causas que não apontam para uma falha interna: não entram nos alertas de "causa principal".
const causaNeutra = (c) => ["sem fundamento", "fator externo"].includes(normChave(c));

function observacoesCausas(itens) {
  const obs = [];
  const com = itens.filter((i) => i.causa);
  if (com.length < 5) return obs;
  const conta = {};
  com.forEach((i) => (conta[i.causa] = (conta[i.causa] || 0) + 1));
  const [top, n] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
  if (!causaNeutra(top)) {
    const origens = [...new Set(com.filter((i) => i.causa === top).map((i) => i.origem))];
    obs.push({
      nivel: n / com.length >= 0.35 ? "alarme" : "atencao",
      titulo: `${top} explica ${Math.round((n / com.length) * 100)}% dos casos classificados`,
      texto: `${n} de ${com.length}${origens.length > 1 ? ", em reclamações e em auditorias" : ""}. Corrigir esta causa resolve mais do que tratar cada caso.`,
    });
  }
  // Escola onde uma causa pesa muito mais do que no total.
  const escolas = [...new Set(com.map((i) => i.escola))];
  escolas.forEach((e) => {
    const daEsc = com.filter((i) => i.escola === e);
    if (daEsc.length < 4) return;
    const c = {};
    daEsc.forEach((i) => (c[i.causa] = (c[i.causa] || 0) + 1));
    const [k, v] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    const pesoEsc = v / daEsc.length;
    const pesoTotal = (conta[k] || 0) / com.length;
    if (!causaNeutra(k) && pesoEsc >= 0.5 && pesoEsc - pesoTotal >= 0.15) {
      obs.push({ nivel: "atencao", titulo: `${e}: ${Math.round(pesoEsc * 100)}% dos casos por ${k.toLowerCase()}`, texto: `Na média das escolas é ${Math.round(pesoTotal * 100)}%.` });
    }
  });
  const sem = itens.length - com.length;
  if (sem > 0 && sem / itens.length >= 0.3) {
    obs.push({ nivel: "atencao", titulo: `${sem} caso${sem === 1 ? "" : "s"} fechado${sem === 1 ? "" : "s"} sem causa`, texto: "Classifica-os ao concluir para a análise de causas ficar completa." });
  }
  const fund = Object.entries(conta).filter(([k]) => normChave(k) === "sem fundamento").reduce((t, [, v]) => t + v, 0);
  if (fund / com.length >= 0.3) {
    obs.push({ nivel: "bom", titulo: `${Math.round((fund / com.length) * 100)}% dos casos sem fundamento`, texto: "Depois de analisados, não havia falha da Dragon Force." });
  }
  return obs;
}
