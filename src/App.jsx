import React, { useState, useEffect, useMemo, useCallback } from "react";
import { dbStorage } from "./supabaseClient";
import { Plus, X, Check, AlertTriangle, Clock, Search, Trash2, Pencil, ShieldAlert, LayoutGrid, BarChart3, Inbox, Play, ClipboardList, Award } from "lucide-react";
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
const STORAGE_CERT_KEY = "reclamacoes:certificacao";

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

const TYPE_LABEL = { normal: "Reclamação normal", livro: "Livro de Reclamações" };
const TYPE_DAYS = { normal: 10, livro: 15 };

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

const CERT_STATUS_META = {
  nao_iniciado: { label: "Não iniciado", color: COLORS.slate, bg: COLORS.doneBg },
  em_andamento: { label: "Em andamento", color: COLORS.progress, bg: COLORS.progressBg },
  concluido: { label: "Cumprido", color: COLORS.ok, bg: COLORS.okBg },
  nao_conforme: { label: "Não conforme", color: COLORS.danger, bg: COLORS.dangerBg },
};

// ---------- FPF certification: escala de pontuação e estrelas ----------
// Sistema FPF: soma de pontos de 9 critérios de avaliação, até 100 pontos.
// A estrela atribuída depende do total de pontos E do cumprimento dos
// requisitos de acesso / critérios obrigatórios específicos de cada nível.
const CERT_TIERS = [
  { min: 90, max: 100, stars: 5, label: "Entidade Formadora — 5 estrelas" },
  { min: 80, max: 89.99, stars: 4, label: "Entidade Formadora — 4 estrelas" },
  { min: 50, max: 79.99, stars: 3, label: "Entidade Formadora — 3 estrelas" },
];

function certTierFor(totalPoints) {
  const tier = CERT_TIERS.find((t) => totalPoints >= t.min && totalPoints <= t.max);
  if (tier) return tier;
  if (totalPoints > 0) return { min: 0, max: 49.99, stars: 0, label: "Escola de Futebol / Centro Básico (CBFF)" };
  return { min: 0, max: 0, stars: 0, label: "Sem pontuação registada" };
}

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
function EntryForm({ initial, nextNumber, onCancel, onSave, schoolOptions, categoryOptions, onManageOptions }) {
  const [form, setForm] = useState(
    initial || {
      type: "normal",
      receivedDate: new Date().toISOString().slice(0, 10),
      complainant: "",
      school: "",
      category: "",
      severity: "media",
      description: "",
    }
  );

  const preview = useMemo(() => {
    if (!form.receivedDate) return null;
    const days = TYPE_DAYS[form.type];
    return addBusinessDays(new Date(form.receivedDate + "T00:00:00"), days);
  }, [form.receivedDate, form.type]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
          width: "min(440px, 100%)",
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

        <label style={labelStyle}>Tipo</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["normal", "livro"].map((t) => (
            <button
              key={t}
              onClick={() => setForm((f) => ({ ...f, type: t }))}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 4,
                border: `1.5px solid ${form.type === t ? COLORS.navy : COLORS.rule}`,
                background: form.type === t ? COLORS.navy : "transparent",
                color: form.type === t ? "#fff" : COLORS.ink,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {TYPE_LABEL[t]}
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.85, fontFamily: "'IBM Plex Mono', monospace" }}>
                {TYPE_DAYS[t]} dias úteis
              </div>
            </button>
          ))}
        </div>

        <label style={labelStyle}>Data de receção</label>
        <input type="date" value={form.receivedDate} onChange={set("receivedDate")} style={inputStyle} />

        <label style={labelStyle}>Gravidade</label>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(SEVERITY_META).map(([key, meta]) => (
            <button
              key={key}
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

        {preview && (
          <div style={{ margin: "10px 0 18px", fontSize: 12.5, color: COLORS.slate, fontFamily: "'IBM Plex Mono', monospace" }}>
            Prazo calculado → <strong style={{ color: COLORS.navy }}>{fmt(preview)}</strong>
          </div>
        )}

        <label style={labelStyle}>Reclamante</label>
        <input type="text" placeholder="Nome do reclamante" value={form.complainant} onChange={set("complainant")} style={inputStyle} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 14 }}>Escola</label>
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
          <label style={{ ...labelStyle, marginTop: 14 }}>Assunto / Categoria</label>
          <button type="button" onClick={onManageOptions} style={linkBtnStyle}>
            Gerir lista
          </button>
        </div>
        <select value={form.category} onChange={set("category")} style={inputStyle}>
          <option value="">{categoryOptions.length ? "Selecionar categoria..." : "Sem categorias — usa 'Gerir lista'"}</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Descrição</label>
        <textarea
          rows={5}
          placeholder="Resumo da reclamação..."
          value={form.description}
          onChange={set("description")}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.complainant.trim()) return;
              const deadline = addBusinessDays(new Date(form.receivedDate + "T00:00:00"), TYPE_DAYS[form.type]);
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
function ManageOptionsModal({ schools, categories, auditCategories, onAdd, onRemove, onClose }) {
  const [newSchool, setNewSchool] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newAuditCategory, setNewAuditCategory] = useState("");

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
          Estas listas ficam disponíveis para toda a equipa ao criar ou editar reclamações.
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
          Categorias / Assuntos
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {categories.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate }}>Ainda sem categorias.</div>}
          {categories.map((c) => (
            <Chip key={c} label={c} onDelete={() => onRemove("categories", c)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <input
            type="text"
            placeholder="Nome da nova categoria"
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
  const notes = [...(entry.notes || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  const submit = () => {
    const v = note.trim();
    if (!v) return;
    onAddNote(entry.id, v);
    setNote("");
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,38,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(520px, 92vw)", maxHeight: "86vh", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 6, padding: "24px 24px 26px" }}
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
        </div>

        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 18, lineHeight: 1.6 }}>
          {TYPE_LABEL[entry.type]} · {entry.school || "sem escola"} · {entry.category || "sem categoria"} <br />
          Receção: {fmt(new Date(entry.receivedDate + "T00:00:00"))} · Prazo: {fmt(new Date(entry.deadline))}
        </div>

        {entry.description && (
          <div style={{ fontSize: 13.5, marginBottom: 18, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
            {entry.description}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {entry.status === "por_pegar" && (
            <button onClick={() => onStart(entry.id)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
              Iniciar
            </button>
          )}
          {entry.derivedStatus !== "concluido" ? (
            <button onClick={() => onDone(entry.id)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
              Marcar concluído
            </button>
          ) : (
            <button onClick={() => onReopen(entry.id)} style={{ ...secondaryBtnStyle, flex: "none", padding: "7px 12px", fontSize: 12.5 }}>
              Reabrir
            </button>
          )}
        </div>

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

function AnalysisDashboard({ withStatus }) {
  const total = withStatus.length;

  const monthly = useMemo(() => monthlyData(withStatus), [withStatus]);

  const typeData = useMemo(() => {
    const normal = withStatus.filter((e) => e.type === "normal").length;
    const livro = withStatus.filter((e) => e.type === "livro").length;
    return [
      { name: TYPE_LABEL.normal, value: normal, color: COLORS.navySoft },
      { name: TYPE_LABEL.livro, value: livro, color: COLORS.navy },
    ];
  }, [withStatus]);

  const statusData = useMemo(
    () =>
      Object.keys(STATUS_META).map((key) => ({
        name: STATUS_META[key].label,
        value: withStatus.filter((e) => e.derivedStatus === key).length,
        color: STATUS_META[key].color,
      })),
    [withStatus]
  );

  const categoryData = useMemo(
    () => topCounts(withStatus, "category").slice(0, 8).map(([name, value]) => ({ name, value })),
    [withStatus]
  );
  const schoolData = useMemo(
    () => topCounts(withStatus, "school").slice(0, 8).map(([name, value]) => ({ name, value })),
    [withStatus]
  );

  const resolved = withStatus.filter((e) => e.status === "concluido" && e.resolvedDate);
  const avgResolutionDays = resolved.length
    ? Math.round(
        resolved.reduce((sum, e) => sum + (new Date(e.resolvedDate) - new Date(e.receivedDate + "T00:00:00")) / 86400000, 0) /
          resolved.length
      )
    : null;
  const onTimeRate = resolved.length
    ? Math.round((resolved.filter((e) => new Date(e.resolvedDate) <= new Date(e.deadline)).length / resolved.length) * 100)
    : null;

  const responded = withStatus.filter((e) => e.startedDate);
  const avgResponseDays = responded.length
    ? Math.round(
        (responded.reduce((sum, e) => sum + (new Date(e.startedDate) - new Date(e.receivedDate + "T00:00:00")) / 86400000, 0) /
          responded.length) *
          10
      ) / 10
    : null;

  if (total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: COLORS.slate, border: `1.5px dashed ${COLORS.rule}`, borderRadius: 6 }}>
        Ainda não há reclamações registadas para analisar.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="Total de reclamações" value={total} />
        <StatCard label="Tempo médio de resposta" value={avgResponseDays !== null ? `${avgResponseDays} d` : "—"} color={COLORS.progress} />
        <StatCard label="Tempo médio de resolução" value={avgResolutionDays !== null ? `${avgResolutionDays} d` : "—"} />
        <StatCard label="Resolvidas dentro do prazo" value={onTimeRate !== null ? `${onTimeRate}%` : "—"} color={COLORS.ok} />
      </div>

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

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ ...panelStyle, flex: "1 1 260px" }}>
          <div style={panelTitle}>Distribuição por tipo</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {typeData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 12, marginTop: 4 }}>
            {typeData.map((d) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: "inline-block" }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

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
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ ...panelStyle, flex: "1 1 320px" }}>
          <div style={panelTitle}>Categorias mais recorrentes</div>
          {categoryData.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados de categoria ainda.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, categoryData.length * 32)}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid stroke={COLORS.rule} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: COLORS.ink }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }} />
                <Bar dataKey="value" fill={COLORS.navySoft} radius={[0, 3, 3, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

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
      </div>
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

// ---------- FPF certification: point form (create/edit) ----------
function CertForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(
    initial || { title: "", requirement: "", dueDate: "", points: "", mandatory: false }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,38,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
      onClick={onCancel}
    >
      <div
        style={{ width: "min(460px, 92vw)", background: COLORS.paperRaised, borderRadius: 6, padding: "24px 24px 26px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 20, color: COLORS.navy }}>
            {initial ? "Editar ponto" : "Novo ponto de certificação"}
          </h2>
          <button onClick={onCancel} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        <label style={{ ...labelStyle, marginTop: 0 }}>Ponto</label>
        <input type="text" placeholder="Ex: Plano de emergência médica" value={form.title} onChange={set("title")} style={inputStyle} />

        <label style={labelStyle}>O que é necessário</label>
        <textarea
          rows={4}
          placeholder="Descrição do requisito da certificação FPF..."
          value={form.requirement}
          onChange={set("requirement")}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />

        <label style={labelStyle}>Prazo (opcional)</label>
        <input type="date" value={form.dueDate} onChange={set("dueDate")} style={inputStyle} />

        <label style={labelStyle}>Pontos atribuídos ao critério (escala FPF, 0–100)</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="Ex: 12"
          value={form.points}
          onChange={set("points")}
          style={inputStyle}
        />
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>
          Os pontos só contam para a pontuação total quando o critério estiver marcado como "Cumprido".
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.ink,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={!!form.mandatory}
            onChange={(e) => setForm((f) => ({ ...f, mandatory: e.target.checked }))}
          />
          Requisito de acesso / critério obrigatório para o nível
        </label>
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>
          Além da pontuação total, a FPF exige o cumprimento dos requisitos de acesso e critérios
          obrigatórios específicos de cada nível — marca aqui os pontos que são condição obrigatória.
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button onClick={onCancel} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.title.trim()) return;
              onSave({
                ...form,
                points: form.points === "" ? 0 : Number(form.points),
                mandatory: !!form.mandatory,
                id: initial ? initial.id : `cp_${Date.now()}`,
                status: initial ? initial.status : "nao_iniciado",
                notes: initial ? initial.notes : [],
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

// ---------- FPF certification: point detail / notes ----------
function CertDetail({ point, onClose, onAddNote, onSetStatus, onEdit, onRemove }) {
  const [note, setNote] = useState("");
  const notes = [...(point.notes || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const meta = CERT_STATUS_META[point.status];

  const submit = () => {
    const v = note.trim();
    if (!v) return;
    onAddNote(point.id, v);
    setNote("");
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,38,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55 }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(520px, 92vw)", maxHeight: "86vh", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 6, padding: "24px 24px 26px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Tag label={meta.label} color={meta.color} bg={meta.bg} />
            {point.mandatory && <Tag label="Requisito obrigatório" color={COLORS.purple} bg={COLORS.purpleBg} />}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button title="Editar" onClick={() => onEdit(point)} style={iconBtnStyle}>
              <Pencil size={16} />
            </button>
            <button title="Eliminar" onClick={() => onRemove(point.id)} style={iconBtnStyle}>
              <Trash2 size={16} color={COLORS.danger} />
            </button>
            <button onClick={onClose} style={iconBtnStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
        <h2 style={{ margin: "8px 0 6px", fontFamily: "'Fraunces', serif", fontSize: 20, color: COLORS.navy }}>{point.title}</h2>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 4 }}>
          {point.dueDate && (
            <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: "'IBM Plex Mono', monospace" }}>
              Prazo: {fmt(new Date(point.dueDate + "T00:00:00"))}
            </div>
          )}
          <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: "'IBM Plex Mono', monospace" }}>
            Pontos: {point.points || 0} {point.status === "concluido" ? "(contabilizados)" : "(ainda não contabilizados)"}
          </div>
        </div>
        <div style={{ marginBottom: 12 }} />
        {point.requirement && (
          <div style={{ fontSize: 13.5, marginBottom: 18, padding: "10px 12px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${COLORS.rule}` }}>
            {point.requirement}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {Object.entries(CERT_STATUS_META).map(([key, m]) => (
            <button
              key={key}
              onClick={() => onSetStatus(point.id, key)}
              style={{
                padding: "7px 12px",
                borderRadius: 4,
                border: `1.5px solid ${point.status === key ? m.color : COLORS.rule}`,
                background: point.status === key ? m.bg : "transparent",
                color: point.status === key ? m.color : COLORS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          O que já foi feito / o que falta fazer
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <textarea
            rows={2}
            placeholder="Ex: Pedido orçamento ao fornecedor; falta aprovação da direção..."
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

// ---------- FPF certification page (project-management style tracker) ----------
function CertPage({ points, onNew, onOpen }) {
  const counts = {
    nao_iniciado: points.filter((p) => p.status === "nao_iniciado").length,
    em_andamento: points.filter((p) => p.status === "em_andamento").length,
    concluido: points.filter((p) => p.status === "concluido").length,
    nao_conforme: points.filter((p) => p.status === "nao_conforme").length,
  };
  const total = points.length;
  const complianceRate = total ? Math.round((counts.concluido / total) * 100) : null;

  const totalPoints = points.reduce((sum, p) => (p.status === "concluido" ? sum + (Number(p.points) || 0) : sum), 0);
  const maxPoints = points.reduce((sum, p) => sum + (Number(p.points) || 0), 0);
  const tier = certTierFor(totalPoints);
  const pendingMandatory = points.filter((p) => p.mandatory && p.status !== "concluido");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", flex: 1 }}>
          {Object.entries(CERT_STATUS_META).map(([key, meta]) => (
            <StatCard key={key} label={meta.label} value={counts[key]} color={meta.color} />
          ))}
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
          <Plus size={16} /> Novo ponto
        </button>
      </div>

      {total > 0 && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={panelTitle}>Pontuação FPF (escala de 0 a 100)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {tier.stars > 0 &&
                Array.from({ length: 5 }).map((_, i) => (
                  <Award key={i} size={16} color={i < tier.stars ? "#C9971C" : COLORS.rule} fill={i < tier.stars ? "#C9971C" : "none"} />
                ))}
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: COLORS.navy }}>
                {totalPoints.toFixed(2).replace(/\.00$/, "")} pts
              </span>
            </div>
          </div>
          <div style={{ height: 10, background: COLORS.rule, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, totalPoints)}%`,
                background: tier.stars >= 5 ? COLORS.ok : tier.stars >= 3 ? COLORS.navy : COLORS.warn,
              }}
            />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy }}>{tier.label}</div>
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>
            5 estrelas: 90–100 pts · 4 estrelas: 80–89,99 pts · 3 estrelas: 50–79,99 pts.
            {maxPoints > 0 && ` Pontos atribuídos até agora entre todos os critérios: ${maxPoints.toFixed(2).replace(/\.00$/, "")}.`}
          </div>

          {pendingMandatory.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginTop: 14,
                padding: "10px 12px",
                background: COLORS.dangerBg,
                border: `1px solid ${COLORS.danger}`,
                borderRadius: 4,
              }}
            >
              <ShieldAlert size={16} color={COLORS.danger} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: "#5c1414" }}>
                Independentemente da pontuação, a certificação exige o cumprimento de todos os requisitos de acesso e
                critérios obrigatórios. Há {pendingMandatory.length} critério(s) obrigatório(s) por cumprir:{" "}
                {pendingMandatory.map((p) => p.title).join(", ")}.
              </div>
            </div>
          )}
        </div>
      )}

      {total > 0 && (
        <div style={{ ...panelStyle, marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={panelTitle}>Cumprimento geral (nº de pontos concluídos)</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: COLORS.ok }}>{complianceRate}%</div>
          </div>
          <div style={{ height: 8, background: COLORS.rule, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${complianceRate}%`, background: COLORS.ok }} />
          </div>
        </div>
      )}

      {points.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: COLORS.slate, border: `1.5px dashed ${COLORS.rule}`, borderRadius: 6 }}>
          Ainda não há pontos de certificação registados. Cria o primeiro com "Novo ponto".
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...points]
            .sort((a, b) => (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1)
            .map((p) => {
              const meta = CERT_STATUS_META[p.status];
              return (
                <div
                  key={p.id}
                  onClick={() => onOpen(p)}
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
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.title}</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {p.dueDate && (
                        <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: "'IBM Plex Mono', monospace" }}>
                          Prazo: {fmt(new Date(p.dueDate + "T00:00:00"))}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: COLORS.slate, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {Number(p.points) || 0} pts
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {p.mandatory && <Tag label="Obrigatório" color={COLORS.purple} bg={COLORS.purpleBg} />}
                    <Tag label={meta.label} color={meta.color} bg={meta.bg} />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [entries, setEntries] = useState([]);
  const [options, setOptions] = useState({ schools: [], categories: [], auditCategories: [] });
  const [audits, setAudits] = useState([]);
  const [certPoints, setCertPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [viewingAudit, setViewingAudit] = useState(null);
  const [viewingDetail, setViewingDetail] = useState(null);
  const [showCertForm, setShowCertForm] = useState(false);
  const [editingCert, setEditingCert] = useState(null);
  const [viewingCert, setViewingCert] = useState(null);
  const [page, setPage] = useState("registo");
  const [reclamacoesView, setReclamacoesView] = useState("registo");
  const [editing, setEditing] = useState(null);
  const [filterType, setFilterType] = useState("todos");
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

  const persistCert = useCallback(async (next) => {
    setCertPoints(next);
    try {
      await dbStorage.set(STORAGE_CERT_KEY, JSON.stringify(next));
    } catch (e) {
      setError("Não foi possível guardar a certificação FPF.");
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
        if (res && res.value) setOptions({ schools: [], categories: [], auditCategories: [], ...JSON.parse(res.value) });
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
        const res = await dbStorage.get(STORAGE_CERT_KEY);
        if (res && res.value) setCertPoints(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
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

  const saveCertPoint = (point) => {
    const exists = certPoints.some((p) => p.id === point.id);
    const next = exists ? certPoints.map((p) => (p.id === point.id ? point : p)) : [...certPoints, point];
    persistCert(next);
    setShowCertForm(false);
    setEditingCert(null);
  };

  const removeCertPoint = (id) => {
    persistCert(certPoints.filter((p) => p.id !== id));
    setViewingCert(null);
  };

  const setCertStatus = (id, status) => {
    const next = certPoints.map((p) => (p.id === id ? { ...p, status } : p));
    persistCert(next);
    setViewingCert(next.find((p) => p.id === id));
  };

  const addCertNote = (id, text) => {
    const next = certPoints.map((p) =>
      p.id === id ? { ...p, notes: [...(p.notes || []), { id: `n_${Date.now()}`, text, date: new Date().toISOString() }] } : p
    );
    persistCert(next);
    setViewingCert(next.find((p) => p.id === id));
  };

  const nextNumber = entries.length ? Math.max(...entries.map((e) => e.entryNumber)) + 1 : 1;

  const withStatus = entries.map((e) => ({ ...e, derivedStatus: deriveStatus(e) }));

  const filtered = withStatus
    .filter((e) => (filterType === "todos" ? true : e.type === filterType))
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
    setShowForm(false);
    setEditing(null);
  };

  const startWork = (id) => {
    persist(
      entries.map((e) => (e.id === id ? { ...e, status: "em_andamento", startedDate: e.startedDate || new Date().toISOString() } : e))
    );
  };

  const markDone = (id) => {
    persist(
      entries.map((e) =>
        e.id === id
          ? { ...e, status: "concluido", resolvedDate: new Date().toISOString(), startedDate: e.startedDate || new Date().toISOString() }
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
              : page === "certificacao"
              ? "Certificação FPF"
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
          { key: "certificacao", label: "Certificação FPF", icon: Award },
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
        ) : page === "certificacao" ? (
          <CertPage
            points={certPoints}
            onNew={() => {
              setEditingCert(null);
              setShowCertForm(true);
            }}
            onOpen={(p) => setViewingCert(p)}
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
          <AnalysisDashboard withStatus={withStatus} />
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
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...inputStyle, width: 190 }}>
            <option value="todos">Todos os tipos</option>
            <option value="normal">Reclamação normal</option>
            <option value="livro">Livro de Reclamações</option>
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
                  {["Nº", "Receção", "Tipo", "Gravidade", "Escola", "Categoria", "Reclamante", "Prazo", "Estado", ""].map((h) => (
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
                    <td style={{ padding: "10px 14px" }}>{TYPE_LABEL[e.type]}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {e.severity && <Tag label={SEVERITY_META[e.severity].label} color={SEVERITY_META[e.severity].color} bg={SEVERITY_META[e.severity].bg} />}
                    </td>
                    <td style={{ padding: "10px 14px", color: COLORS.slate }}>{e.school || "—"}</td>
                    <td style={{ padding: "10px 14px", color: COLORS.slate }}>{e.category || "—"}</td>
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
                          <button title="Marcar concluído" onClick={() => markDone(e.id)} style={iconBtnStyle}>
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
          onManageOptions={() => setShowManage(true)}
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
          onDone={(id) => {
            markDone(id);
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

      {showCertForm && (
        <CertForm
          initial={editingCert}
          onCancel={() => {
            setShowCertForm(false);
            setEditingCert(null);
          }}
          onSave={saveCertPoint}
        />
      )}

      {viewingCert && (
        <CertDetail
          point={certPoints.find((p) => p.id === viewingCert.id) || viewingCert}
          onClose={() => setViewingCert(null)}
          onAddNote={addCertNote}
          onSetStatus={setCertStatus}
          onEdit={(p) => {
            setEditingCert(p);
            setViewingCert(null);
            setShowCertForm(true);
          }}
          onRemove={removeCertPoint}
        />
      )}
    </div>
  );
}
