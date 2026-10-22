// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Check, Search, Trash2, ClipboardList, Sparkles, FileText } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { AssociarISO, CAUSAS_ATUAIS, COLORS, GRUPOS_ISO, PreencherAreasCategorias, REQUISITOS_ISO, SeletorISO, StatCard, TAG_PALETTE, Tag, Vazio, areaSugerida, dataAud, diaNaoUtilPlano, epocaAud, epocaDe, fmt, iconBtnStyle, inputStyle, isoDe, labelStyle, linkBtnStyle, normChave, palavrasDe, panelStyle, panelTitle, primaryBtnStyle, rotuloISO, secondaryBtnStyle, sugerirRequisitoISO } from "../nucleo.jsx";
import { BotaoFoto, CLASSIFICATION_META, ComparacaoEpocas, DicaGrafico, FiltroEpocas, Observacoes, PainelCausas, ParamChips, QuadrantMatrix, SeletorCausa, TickEixoX, TickNome, ambitoAud, ambitoDoNome, dataDeCelula, itensCausa, lerCSVInq, lerExcelInq, naSelecao, nomeEscolaProposto, observacoesAuditorias, selecaoInicial } from "../partilhado.jsx";

// Constatações que já constavam na auditoria anterior da mesma escola (mesmo âmbito).
// Compara as palavras com significado do título; a mesma categoria e o mesmo requisito ajudam.
function auditoriaAnterior(audit, audits) {
  const chave = (a) => `${normChave(a.school)}|${a.ambito || ""}`;
  const k = chave(audit);
  const d = String(audit.date || "");
  if (!d) return null;
  return (
    (audits || [])
      .filter((a) => a.id !== audit.id && chave(a) === k && a.date && String(a.date) < d)
      .sort((x, y) => String(y.date).localeCompare(String(x.date)))[0] || null
  );
}
function semelhancaConstatacoes(f, g) {
  const p1 = new Set(palavrasDe(f.description));
  const p2 = new Set(palavrasDe(g.description));
  if (!p1.size || !p2.size) return 0;
  const comuns = [...p1].filter((w) => p2.has(w)).length;
  let s = comuns / Math.min(p1.size, p2.size);
  if (normChave(f.description) === normChave(g.description)) s = 1;
  if (f.category && g.category && normChave(f.category) === normChave(g.category)) s += 0.15;
  if (f.iso && g.iso && f.iso === g.iso) s += 0.1;
  return Math.min(1, s);
}
// Mapa findingId -> { f, audit } com a constatação equivalente na auditoria anterior.
function repetidasDaAnterior(audit, audits) {
  const ant = auditoriaAnterior(audit, audits);
  if (!ant) return { anterior: null, mapa: {} };
  const mapa = {};
  (audit.findings || []).forEach((f) => {
    if (f.repetidaManual === false) return;
    let melhor = null;
    (ant.findings || []).forEach((g) => {
      const s = semelhancaConstatacoes(f, g);
      if (s >= 0.6 && (!melhor || s > melhor.s)) melhor = { s, f: g };
    });
    if (melhor) mapa[f.id] = { f: melhor.f, audit: ant, s: melhor.s };
  });
  return { anterior: ant, mapa };
}

const EFICACIA_ACAO_META = {
  eficaz: { label: "Eficaz", color: COLORS.ok, bg: COLORS.okBg },
  parcial: { label: "Parcialmente eficaz", color: COLORS.warn, bg: COLORS.warnBg },
  ineficaz: { label: "Ineficaz", color: COLORS.danger, bg: COLORS.dangerBg },
};
// Cores bem distintas para séries empilhadas (até 10 sem repetir).
const SERIES_DISTINTAS = ["#2F5FD0", "#C2570C", "#E0A030", "#7A5AC8", "#2E9E6A", "#14A3B8", "#E26FA8", "#8A6D3B", "#6B7A8C", "#9DB83A"];




// ---------- New audit form ----------
export function AuditForm({ schoolOptions, onCancel, onSave, onGerirLista }) {
  const [school, setSchool] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onCancel}
    >
      <div
        className="sheet"
        style={{ width: "min(420px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Nova auditoria</h2>
          <button onClick={onCancel} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
          <button type="button" onClick={() => onGerirLista("schools")} style={{ ...linkBtnStyle, marginTop: 0 }}>
            Gerir lista
          </button>
        </div>
        <select value={school} onChange={(e) => setSchool(e.target.value)} style={inputStyle}>
          <option value="">{schoolOptions.length ? "Selecionar escola..." : "Sem escolas — usa 'Gerir lista'"}</option>
          {Object.entries(AMBITOS_AUDITORIA).map(([k, a]) => (
            <option key={k} value={`__ambito__${k}`}>
              {a.nome} ({a.descricao.toLowerCase()})
            </option>
          ))}
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
              const amb = school.startsWith("__ambito__") ? school.slice(10) : null;
              onSave({ id: `a_${Date.now()}`, school: amb ? AMBITOS_AUDITORIA[amb].nome : school, ambito: amb, date, findings: [] });
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

// ---------- PDF da auditoria: documento próprio para papel (não é uma cópia do ecrã) ----------
function htmlAuditoria(audit, rep) {
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const data = (iso) => (iso ? fmt(new Date(iso + "T00:00:00")) : "");
  const TIPOS = {
    NCM: { cor: "#C2570C", fundo: "#FDF0E6", nome: "Não conformidade maior", plural: "Não conformidades maiores" },
    NC: { cor: "#A66A00", fundo: "#FBF3DF", nome: "Não conformidade", plural: "Não conformidades" },
    AS: { cor: "#6B4FA0", fundo: "#F1ECF8", nome: "Área sensível", plural: "Áreas sensíveis" },
    OM: { cor: "#1D4F9A", fundo: "#E8F0FB", nome: "Oportunidade de melhoria", plural: "Oportunidades de melhoria" },
  };
  const ordem = ["NCM", "NC", "AS", "OM"];
  const lista = [...(audit.findings || [])].sort((a, b) => {
    const ia = ordem.indexOf(a.classification);
    const ib = ordem.indexOf(b.classification);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
  });
  const hoje = isoDe(new Date());
  const resolvidas = lista.filter((f) => f.resolvida).length;
  const nRep = lista.filter((f) => rep && rep.mapa && rep.mapa[f.id]).length;
  const porTipo = ordem.map((t) => [t, lista.filter((f) => f.classification === t).length]).filter(([, n]) => n);
  const semTipo = lista.filter((f) => !TIPOS[f.classification]).length;

  const cartao = (valor, rotulo) => `<div class="au-k"><div class="au-kn">${valor}</div><div class="au-kl">${rotulo}</div></div>`;
  const resumo = `
    <div class="au-resumo">
      ${cartao(lista.length, lista.length === 1 ? "constatação" : "constatações")}
      ${cartao(resolvidas, resolvidas === 1 ? "resolvida" : "resolvidas")}
      ${cartao(lista.length - resolvidas, "por resolver")}
      ${nRep ? cartao(nRep, nRep === 1 ? "repetida da anterior" : "repetidas da anterior") : ""}
    </div>
    <div class="au-tipos">${porTipo
      .map(([t, n]) => `<span class="au-chip" style="color:${TIPOS[t].cor};background:${TIPOS[t].fundo}"><b>${n}</b> ${esc(n > 1 ? TIPOS[t].plural : TIPOS[t].nome)}</span>`)
      .join("")}${semTipo ? `<span class="au-chip" style="color:#5B6577;background:#EEF1F6"><b>${semTipo}</b> sem tipo</span>` : ""}</div>`;

  const linha = (rotulo, valor) => (valor ? `<div class="au-l"><span>${rotulo}</span><div>${esc(valor)}</div></div>` : "");
  const blocos = lista
    .map((f, i) => {
      const t = TIPOS[f.classification] || { cor: "#5B6577", fundo: "#EEF1F6", nome: "Sem tipo" };
      const r = rep && rep.mapa ? rep.mapa[f.id] : null;
      const ef = EFICACIA_ACAO_META[f.eficacia];
      const foraPrazo = f.prazo && (f.resolvidaEm ? f.resolvidaEm > f.prazo : !f.resolvida && f.prazo < hoje);
      const prazo = f.prazo ? `${data(f.prazo)}${f.prazoTexto ? ` (${f.prazoTexto})` : ""}` : f.prazoTexto || "";
      const fecho = f.fechoEpoca ? `Fim da época ${epocaAud(audit) || ""}` : data(f.resolvidaEm);
      const estado = f.resolvida ? `<span class="au-est" style="color:#1F7A4D;background:#E6F4EC">Resolvida</span>` : `<span class="au-est" style="color:#5B6577;background:#EEF1F6">Por resolver</span>`;
      return `
      <div class="au-f" style="border-left-color:${t.cor}">
        <div class="au-fh">
          <span class="au-n">${i + 1}</span>
          <span class="au-tipo" style="color:${t.cor};background:${t.fundo}">${esc(f.classification || "—")} · ${esc(t.nome)}</span>
          ${r ? `<span class="au-tipo" style="color:#A66A00;background:#FBF3DF">Repetida</span>` : ""}
          <span class="au-sp"></span>
          ${estado}
        </div>
        ${[f.area, f.category].filter(Boolean).length ? `<div class="au-ctx">${esc([f.area, f.category].filter(Boolean).join(" · "))}</div>` : ""}
        ${f.iso ? `<div class="au-ctx">ISO 9001:2015 · ${esc(rotuloISO(f.iso))}</div>` : ""}
        <div class="au-d">${esc(f.description || "(sem descrição)")}</div>
        ${r ? `<div class="au-rep">Já constava na auditoria de ${esc(dataAud(r.audit))}: «${esc(r.f.description)}»${r.f.resolvida ? " · tinha sido dada como resolvida" : " · ainda por resolver"}</div>` : ""}
        <div class="au-ls">
          ${linha("Análise de causas", f.analiseCausas)}
          ${linha("Causa raiz", f.causaRaiz)}
          ${linha("Ação corretiva", f.acao)}
          ${linha("Responsável", f.responsavel)}
          ${linha("Prazo", prazo ? prazo + (foraPrazo ? " · fora do prazo" : "") : "")}
          ${linha("Fecho", fecho)}
          ${linha("Eficácia", ef ? ef.label : "")}
        </div>
      </div>`;
    })
    .join("");

  const css = `<style>
    #folhaBalanco .au-resumo { display: flex; gap: 10px; margin-bottom: 10px; }
    #folhaBalanco .au-k { flex: 1; border: 1px solid #D5DBE5; border-radius: 6px; padding: 10px 12px; background: #F7F9FC; }
    #folhaBalanco .au-kn { font-size: 24px; font-weight: 700; color: #0B2A5B; line-height: 1.1; }
    #folhaBalanco .au-kl { font-size: 11px; color: #5B6577; margin-top: 3px; }
    #folhaBalanco .au-tipos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
    #folhaBalanco .au-chip { font-size: 11px; padding: 3px 9px; border-radius: 20px; }
    #folhaBalanco .au-f { border: 1px solid #D5DBE5; border-left: 4px solid #5B6577; border-radius: 4px; padding: 11px 14px 12px; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
    #folhaBalanco .au-fh { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
    #folhaBalanco .au-n { font-size: 11px; font-weight: 700; color: #8A94A6; min-width: 16px; }
    #folhaBalanco .au-tipo { font-size: 10.5px; font-weight: 700; letter-spacing: .02em; padding: 2px 8px; border-radius: 4px; }
    #folhaBalanco .au-sp { flex: 1; }
    #folhaBalanco .au-est { font-size: 10.5px; font-weight: 600; padding: 2px 9px; border-radius: 20px; }
    #folhaBalanco .au-ctx { font-size: 11px; color: #5B6577; margin-bottom: 2px; }
    #folhaBalanco .au-d { font-size: 13px; line-height: 1.5; color: #0F1B2D; margin-top: 5px; white-space: pre-wrap; }
    #folhaBalanco .au-rep { font-size: 11px; color: #A66A00; margin-top: 6px; line-height: 1.45; }
    #folhaBalanco .au-ls { margin-top: 8px; border-top: 1px solid #E6EAF0; }
    #folhaBalanco .au-l { display: flex; gap: 12px; padding: 5px 0; border-bottom: 1px solid #EEF1F6; font-size: 11.5px; line-height: 1.45; }
    #folhaBalanco .au-l:last-child { border-bottom: none; }
    #folhaBalanco .au-l > span { flex: none; width: 112px; color: #6B7A90; }
    #folhaBalanco .au-l > div { flex: 1; color: #0F1B2D; white-space: pre-wrap; }
    #folhaBalanco .au-vazio { font-size: 13px; color: #5B6577; padding: 20px 0; }
  </style>`;
  return css + resumo + (lista.length ? blocos : `<div class="au-vazio">Sem constatações registadas.</div>`);
}

// ---------- Audit detail: findings management ----------
export function AuditDetail({
  audit,
  auditCategoryOptions,
  areaOptions,
  onClose,
  onAddFinding,
  onRemoveFinding,
  onUpdateFinding,
  onUpdateFindings,
  mapaAreas,
  onRemoveAudit,
  onUpdateAudit,
  schoolOptions,
  onGerirLista,
  audits,
}) {
  const [editarVisita, setEditarVisita] = useState(false);
  const [preencher, setPreencher] = useState(false);
  const [associarIso, setAssociarIso] = useState(false);
  const semAreaCat = audit.findings.filter((f) => !f.area || !f.category);
  const semIso = audit.findings.filter((f) => !f.iso);
  // Constatações que já vinham da auditoria anterior da mesma escola.
  const rep = useMemo(() => repetidasDaAnterior(audit, audits || []), [audit, audits]);
  const nRep = Object.keys(rep.mapa).length;
  const [visita, setVisita] = useState({ school: audit.school, date: audit.date || "", epoca: audit.epoca || "" });
  useEffect(() => setVisita({ school: audit.school, date: audit.date || "", epoca: audit.epoca || "" }), [audit.id, audit.school, audit.date, audit.epoca]);
  const [classification, setClassification] = useState("NC");
  const [category, setCategory] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [acaoDraft, setAcaoDraft] = useState({});
  const fotoRef = useRef(null);

  const submit = () => {
    const v = description.trim();
    if (!v) return;
    const nova = { classification, category, area, description: v };
    // Requisito ISO: só fica associado sozinho quando a certeza é alta; senão aparece como sugestão.
    const sug = sugerirRequisitoISO(nova);
    onAddFinding(audit.id, {
      id: `f_${Date.now()}`,
      ...nova,
      ...(sug.certeza === "alta" && sug.c ? { iso: sug.c, isoOrigem: "auto" } : {}),
      resolvida: false,
      eficacia: "",
      acao: "",
    });
    setDescription("");
  };

  const resolvidas = audit.findings.filter((f) => f.resolvida).length;

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="sheet"
        ref={fotoRef}
        style={{ width: "min(600px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
            {dataAud(audit)} · Época {epocaAud(audit) || "—"}
          </div>
          <div className="semFoto" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <BotaoFoto alvo={fotoRef} vertical rotulo="PDF" tipo="Auditoria" conteudo={() => htmlAuditoria(audit, rep)} titulo={`Auditoria · ${audit.school}`} subtitulo={`${dataAud(audit)} · Época ${epocaAud(audit) || "—"}`} nome={`Auditoria ${audit.school} ${audit.date || isoDe(new Date())}`} />
            <button title="Eliminar auditoria" onClick={() => onRemoveAudit(audit.id)} style={iconBtnStyle}>
              <Trash2 size={16} color={COLORS.danger} />
            </button>
            <button onClick={onClose} style={iconBtnStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, color: COLORS.navy }}>{audit.school}</h2>
        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: editarVisita ? 10 : 18, display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <span>
            {audit.findings.length} constatações · {resolvidas} resolvidas
            {nRep > 0 && (
              <strong style={{ color: COLORS.warn, fontWeight: 600 }}>
                {" "}
                · {nRep} {nRep === 1 ? "repetida" : "repetidas"} da auditoria de {dataAud(rep.anterior)}
              </strong>
            )}
          </span>
          {onUpdateAudit && (
            <button className="semFoto" onClick={() => setEditarVisita((x) => !x)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
              {editarVisita ? "Fechar edição" : "Editar escola, data ou época"}
            </button>
          )}
        </div>
        {editarVisita && (
          <div className="semFoto" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, padding: 12, borderRadius: 10, background: COLORS.paperSunken, marginBottom: 18 }}>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
              <select value={visita.school} onChange={(e) => setVisita((x) => ({ ...x, school: e.target.value }))} style={inputStyle}>
                {[...new Set([visita.school, ...(schoolOptions || [])])].filter(Boolean).map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Data da visita</label>
              <input type="date" value={visita.date} onChange={(e) => setVisita((x) => ({ ...x, date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Época</label>
              <input value={visita.epoca} placeholder={visita.date ? epocaDe(visita.date) : "2025/26"} onChange={(e) => setVisita((x) => ({ ...x, epoca: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  onUpdateAudit(audit.id, { school: visita.school, date: visita.date || null, epoca: normEpoca(visita.epoca) || null });
                  setEditarVisita(false);
                }}
                style={{ ...primaryBtnStyle, width: "auto", padding: "8px 16px" }}
              >
                Guardar visita
              </button>
            </div>
          </div>
        )}

        <div className="semFoto">
        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Nova constatação
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
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
          <label style={{ ...labelStyle, marginTop: 0 }}>Área / Departamento</label>
          <button type="button" onClick={() => onGerirLista("auditAreas")} style={{ ...linkBtnStyle, marginTop: 0 }}>
            Gerir lista
          </button>
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }}>
          <option value="">{areaOptions.length ? "Selecionar área..." : "Sem áreas — usa 'Gerir lista'"}</option>
          {areaOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Categoria</label>
          <button type="button" onClick={() => onGerirLista("auditCategories")} style={{ ...linkBtnStyle, marginTop: 0 }}>
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
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Constatações ({audit.findings.length})
        </div>
        {onUpdateFindings && semAreaCat.length > 0 && !preencher && (
          <div className="semFoto" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.warn}`, background: COLORS.warnBg, marginBottom: 12, fontSize: 12.5 }}>
            <span style={{ flex: 1 }}>
              {semAreaCat.length} {semAreaCat.length === 1 ? "constatação" : "constatações"} sem área ou categoria.
            </span>
            <button onClick={() => setPreencher(true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} /> Preencher automaticamente
            </button>
          </div>
        )}
        {onUpdateFindings && semIso.length > 0 && !associarIso && !preencher && (
          <div className="semFoto" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.rule}`, background: COLORS.paperSunken, marginBottom: 12, fontSize: 12.5 }}>
            <span style={{ flex: 1 }}>
              {semIso.length} {semIso.length === 1 ? "constatação" : "constatações"} sem requisito ISO 9001.
            </span>
            <button onClick={() => setAssociarIso(true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} /> Associar requisitos ISO
            </button>
          </div>
        )}
        {associarIso && (
          <AssociarISO
            embutido
            itens={semIso.map((f) => ({ auditId: audit.id, f }))}
            onFechar={() => setAssociarIso(false)}
            onAplicar={(alteracoes) => {
              onUpdateFindings(alteracoes);
              setAssociarIso(false);
            }}
          />
        )}
        {preencher && (
          <PreencherAreasCategorias
            embutido
            itens={semAreaCat.map((f) => ({ auditId: audit.id, f }))}
            areas={areaOptions || []}
            categorias={auditCategoryOptions || []}
            mapaAreas={mapaAreas || {}}
            onGerirLista={onGerirLista}
            onFechar={() => setPreencher(false)}
            onAplicar={(alteracoes) => {
              onUpdateFindings(alteracoes);
              setPreencher(false);
            }}
          />
        )}
        {audit.findings.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Ainda sem constatações registadas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {audit.findings.map((f) => {
              const cm = CLASSIFICATION_META[f.classification] || { color: COLORS.slate, bg: COLORS.paperSunken };
              const repetida = rep.mapa[f.id];
              const sugIso = f.iso ? null : sugerirRequisitoISO(f);
              return (
                <div key={f.id} style={{ padding: "11px 13px", background: COLORS.paper, borderRadius: 4, border: `1px solid ${f.classification ? COLORS.rule : COLORS.warn}` }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <select
                      value={f.classification || ""}
                      title="Mudar o tipo"
                      onChange={(e) => onUpdateFinding(audit.id, f.id, { classification: e.target.value })}
                      style={{ fontSize: 10.5, fontWeight: 700, color: cm.color, background: cm.bg, border: `1px solid ${cm.color}`, borderRadius: 3, padding: "2px 4px", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {!f.classification && <option value="">Sem tipo</option>}
                      {Object.keys(CLASSIFICATION_META).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                        <select
                          value={f.area || ""}
                          onChange={(e) => onUpdateFinding(audit.id, f.id, { area: e.target.value })}
                          aria-label="Área / departamento"
                          title="Área / departamento"
                          style={{ fontSize: 11, color: f.area ? COLORS.ink2 : COLORS.warn, background: "transparent", border: `1px solid ${f.area ? COLORS.rule : COLORS.warn}`, borderRadius: 4, padding: "1px 4px", fontFamily: "inherit", maxWidth: 190 }}
                        >
                          <option value="">Sem área</option>
                          {[...new Set([...(areaOptions || []), f.area].filter(Boolean))].map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                        <select
                          value={f.category || ""}
                          onChange={(e) => onUpdateFinding(audit.id, f.id, { category: e.target.value })}
                          aria-label="Categoria"
                          title="Categoria"
                          style={{ fontSize: 11, color: f.category ? COLORS.ink2 : COLORS.warn, background: "transparent", border: `1px solid ${f.category ? COLORS.rule : COLORS.warn}`, borderRadius: 4, padding: "1px 4px", fontFamily: "inherit", maxWidth: 220 }}
                        >
                          <option value="">Sem categoria</option>
                          {[...new Set([...(auditCategoryOptions || []), f.category].filter(Boolean))].map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <SeletorISO
                          valor={f.iso}
                          onChange={(v) => onUpdateFinding(audit.id, f.id, { iso: v, isoOrigem: v ? "manual" : null })}
                          vazio="Sem requisito ISO"
                          style={{ fontSize: 11, color: f.iso ? COLORS.ink2 : COLORS.slate, background: "transparent", border: `1px solid ${COLORS.rule}`, borderRadius: 4, padding: "1px 4px", fontFamily: "inherit", maxWidth: 230 }}
                        />
                        {f.iso && f.isoOrigem === "auto" && (
                          <span className="semFoto" title="Associado automaticamente (certeza alta). Muda no seletor se não estiver certo." style={{ fontSize: 10.5, color: COLORS.slate, alignSelf: "center" }}>
                            auto
                          </span>
                        )}
                        {sugIso && sugIso.c && (
                          <button
                            className="semFoto"
                            type="button"
                            onClick={() => onUpdateFinding(audit.id, f.id, { iso: sugIso.c, isoOrigem: "confirmado" })}
                            title={`Sugestão: ${rotuloISO(sugIso.c)}${sugIso.alternativas.length ? ` (alternativas: ${sugIso.alternativas.join(", ")})` : ""}. Carrega para confirmar.`}
                            style={{ fontSize: 10.5, fontWeight: 600, color: sugIso.certeza === "alta" ? COLORS.ok : COLORS.warn, background: "transparent", border: `1px dashed ${sugIso.certeza === "alta" ? COLORS.ok : COLORS.warn}`, borderRadius: 4, padding: "1px 6px", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            {sugIso.certeza === "alta" ? "Sugestão" : "Talvez"} {sugIso.c} · confirmar
                          </button>
                        )}
                        {repetida && (
                          <span
                            title={`Já constava na auditoria de ${dataAud(repetida.audit)}: «${repetida.f.description}»${repetida.f.resolvida ? " (dada como resolvida)" : " (ainda por resolver)"}`}
                            style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.warn, background: COLORS.warnBg, border: `1px solid ${COLORS.warn}`, borderRadius: 4, padding: "1px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            ↻ Repetida
                            <button
                              className="semFoto"
                              type="button"
                              onClick={() => onUpdateFinding(audit.id, f.id, { repetidaManual: false })}
                              title="Não é a mesma constatação: tirar o sinal"
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: COLORS.warn, fontSize: 11, lineHeight: 1 }}
                            >
                              ×
                            </button>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13.5 }}>{f.description}</div>
                      {repetida && (
                        <div style={{ fontSize: 11.5, color: COLORS.warn, marginTop: 3 }}>
                          Já em {dataAud(repetida.audit)}: «{repetida.f.description}»{repetida.f.resolvida ? " · tinha sido dada como resolvida" : " · ainda por resolver"}
                        </div>
                      )}
                      {(f.responsavel || f.resolvidaEm || f.analiseCausas || f.prazo || f.prazoTexto) && (
                        <div style={{ fontSize: 11.5, color: COLORS.ink2, marginTop: 5, lineHeight: 1.5 }}>
                          {f.analiseCausas && (
                            <div>
                              <strong style={{ fontWeight: 600 }}>Análise de causas:</strong> {f.analiseCausas}
                            </div>
                          )}
                          {(f.responsavel || f.resolvidaEm || f.prazo || f.prazoTexto) && (
                            <div style={{ color: COLORS.slate }}>
                              {[
                                f.responsavel ? `Responsável: ${f.responsavel}` : null,
                                f.prazo ? `Prazo: ${fmt(new Date(f.prazo + "T00:00:00"))}${f.prazoTexto ? ` (${f.prazoTexto})` : ""}` : f.prazoTexto ? `Prazo: ${f.prazoTexto}` : null,
                                f.resolvidaEm ? `Fechada a ${fmt(new Date(f.resolvidaEm + "T00:00:00"))}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                              {f.prazo && (f.resolvidaEm ? f.resolvidaEm > f.prazo : !f.resolvida && f.prazo < isoDe(new Date())) && (
                                <strong style={{ color: COLORS.danger, marginLeft: 6 }}>fora do prazo</strong>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button className="semFoto" title="Remover" onClick={() => onRemoveFinding(audit.id, f.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                      <X size={14} />
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 7,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: `1px solid ${COLORS.rule}`,
                    }}
                  >
                    <span style={{ fontSize: 11.5, color: COLORS.slate, fontWeight: 600 }}>Resolvida?</span>
                    {f.fechoEpoca ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.slate }}>Fechada no fim da época {epocaAud(audit)} (sem data de fecho registada)</span>
                    ) : (
                    <button
                      onClick={() =>
                        onUpdateFinding(audit.id, f.id,
                          f.resolvida ? { resolvida: false, eficacia: "", acao: "", resolvidaEm: null } : { resolvida: true, eficacia: f.eficacia || "eficaz", resolvidaEm: isoDe(new Date()) }
                        )
                      }
                      style={{
                        padding: "5px 12px",
                        borderRadius: 20,
                        border: `1.5px solid ${f.resolvida ? COLORS.ok : COLORS.rule}`,
                        background: f.resolvida ? COLORS.okBg : "transparent",
                        color: f.resolvida ? COLORS.ok : COLORS.slate,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {f.resolvida ? "✓ Sim" : "Não"}
                    </button>
                    )}

                    {f.resolvida && !f.fechoEpoca && (
                      <>
                        <span style={{ fontSize: 11.5, color: COLORS.slate, fontWeight: 600, marginLeft: 4 }}>Eficácia</span>
                        {Object.entries(EFICACIA_ACAO_META).map(([k, meta]) => (
                          <button
                            key={k}
                            className={f.eficacia === k ? undefined : "semFoto"}
                            onClick={() => onUpdateFinding(audit.id, f.id, { eficacia: k })}
                            style={{
                              padding: "5px 11px",
                              borderRadius: 20,
                              border: `1.5px solid ${f.eficacia === k ? meta.color : COLORS.rule}`,
                              background: f.eficacia === k ? meta.bg : "transparent",
                              color: f.eficacia === k ? meta.color : COLORS.slate,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {f.eficacia === k ? "✓ " : ""}
                            {meta.label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  {f.resolvida && (
                    <div style={{ marginTop: 10 }}>
                      <SeletorCausa compacto valor={f.causaRaiz || ""} onChange={(v) => onUpdateFinding(audit.id, f.id, { causaRaiz: v })} onGerirLista={onGerirLista} />
                    </div>
                  )}

                  {f.resolvida && (
                    <div className={f.acao ? undefined : "semFoto"} style={{ marginTop: 9 }}>
                      <label style={{ ...labelStyle, marginTop: 0 }}>Ação corretiva / correção aplicada</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <textarea
                          rows={2}
                          placeholder="O que foi feito para resolver..."
                          value={acaoDraft[f.id] !== undefined ? acaoDraft[f.id] : f.acao || ""}
                          onChange={(e) => setAcaoDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", flex: 1 }}
                        />
                        <button
                          className="semFoto"
                          onClick={() => {
                            onUpdateFinding(audit.id, f.id, { acao: (acaoDraft[f.id] !== undefined ? acaoDraft[f.id] : f.acao || "").trim() });
                            setAcaoDraft((d) => {
                              const n = { ...d };
                              delete n[f.id];
                              return n;
                            });
                          }}
                          style={{ ...primaryBtnStyle, flex: "none", padding: "0 14px" }}
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const AUDIT_PARAMS = [
  { key: "catArea", label: "Categoria e área" },
  { key: "clsArea", label: "Classificação por área" },
  { key: "quad", label: "Matriz de quadrantes" },
  { key: "rank", label: "Ranking de escolas" },
  { key: "clsEsc", label: "Classificação por escola" },
  { key: "pend", label: "Por resolver" },
  { key: "estado", label: "Estado e eficácia" },
  { key: "totArea", label: "Total por área" },
];

// ---------- Audits analysis ----------
function AuditsAnalysis({ audits, schoolOptions, areaOptions, auditCategoryOptions }) {
  const [fEsc, setFEsc] = useState("todas");
  const [fArea, setFArea] = useState("todas");
  const [fCls, setFCls] = useState("todas");
  const epocasAud = useMemo(() => [...new Set(audits.map((a) => epocaAud(a)).filter(Boolean))], [audits]);
  const [fEpocas, setFEpocas] = useState(() => selecaoInicial(epocasAud));
  const audsSel = useMemo(() => audits.filter((a) => naSelecao(fEpocas, epocaAud(a))), [audits, fEpocas]);
  const [visible, setVisible] = useState(new Set(AUDIT_PARAMS.map((p) => p.key)));

  const toggle = (k) =>
    setVisible((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  // Cada constatação leva consigo a escola e a data da auditoria a que pertence.
  const all = useMemo(
    () => audsSel.flatMap((a) => (a.findings || []).map((f) => ({ ...f, escola: a.school, data: a.date, auditId: a.id, epoca: epocaAud(a) }))),
    [audsSel]
  );
  const F = useMemo(
    () =>
      all
        .filter((f) => (fEsc === "todas" ? true : f.escola === fEsc))
        .filter((f) => (fArea === "todas" ? true : f.area === fArea))
        .filter((f) => (fCls === "todas" ? true : f.classification === fCls)),
    [all, fEsc, fArea, fCls]
  );

  const escolas = useMemo(() => [...new Set(all.map((f) => f.escola))].sort(), [all]);
  const areas = useMemo(() => {
    const usadas = [...new Set(all.map((f) => f.area).filter(Boolean))];
    return [...new Set([...areaOptions, ...usadas])];
  }, [all, areaOptions]);
  const classes = Object.keys(CLASSIFICATION_META);

  const resolvidas = F.filter((f) => f.resolvida);
  const eficazes = resolvidas.filter((f) => f.eficacia === "eficaz");

  const catAreaData = useMemo(() => {
    const cats = [...new Set(F.map((f) => f.category).filter(Boolean))].slice(0, 10);
    return cats.map((c) => {
      const row = { name: c };
      areas.forEach((a) => (row[a] = F.filter((f) => f.category === c && f.area === a).length));
      return row;
    });
  }, [F, areas]);

  const clsAreaData = useMemo(
    () =>
      areas.map((a) => {
        const row = { name: a };
        classes.forEach((c) => (row[c] = F.filter((f) => f.area === a && f.classification === c).length));
        return row;
      }),
    [F, areas]
  );

  const rankData = useMemo(
    () =>
      escolas
        .map((e) => ({ name: e, value: F.filter((f) => f.escola === e).length }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    [F, escolas]
  );

  const clsEscData = useMemo(
    () =>
      escolas.map((e) => {
        const row = { name: e };
        classes.forEach((c) => (row[c] = F.filter((f) => f.escola === e && f.classification === c).length));
        return row;
      }),
    [F, escolas]
  );

  const pendData = useMemo(
    () =>
      areas.map((a) => ({
        name: a,
        pendentes: F.filter((f) => f.area === a && !f.resolvida).length,
        graves: F.filter((f) => f.area === a && (f.classification === "NCM" || f.classification === "NC")).length,
      })),
    [F, areas]
  );

  const estadoData = useMemo(
    () =>
      classes.map((c) => ({
        name: c,
        eficaz: F.filter((f) => f.classification === c && f.resolvida && f.eficacia === "eficaz").length,
        parcial: F.filter((f) => f.classification === c && f.resolvida && f.eficacia === "parcial").length,
        ineficaz: F.filter((f) => f.classification === c && f.resolvida && f.eficacia === "ineficaz").length,
        pendente: F.filter((f) => f.classification === c && !f.resolvida).length,
      })),
    [F]
  );

  const totAreaData = useMemo(() => areas.map((a) => ({ name: a, value: F.filter((f) => f.area === a).length })), [F, areas]);

  const metrics = useMemo(
    () => ({
      constat: { label: "Nº de constatações", v: (e) => F.filter((f) => f.escola === e).length, fmt: (v) => v },
      graves: {
        label: "Graves (NCM+NC)",
        v: (e) => F.filter((f) => f.escola === e && (f.classification === "NCM" || f.classification === "NC")).length,
        fmt: (v) => v,
      },
      ncm: { label: "Não conformidades maiores", v: (e) => F.filter((f) => f.escola === e && f.classification === "NCM").length, fmt: (v) => v },
      om: { label: "Oportunidades de melhoria", v: (e) => F.filter((f) => f.escola === e && f.classification === "OM").length, fmt: (v) => v },
      as: { label: "Áreas sensíveis", v: (e) => F.filter((f) => f.escola === e && f.classification === "AS").length, fmt: (v) => v },
      pend: { label: "Por resolver", v: (e) => F.filter((f) => f.escola === e && !f.resolvida).length, fmt: (v) => v },
      taxares: {
        label: "Taxa de resolução (%)",
        v: (e) => {
          const t = F.filter((f) => f.escola === e);
          return t.length ? Math.round((t.filter((f) => f.resolvida).length / t.length) * 100) : 0;
        },
        fmt: (v) => v + "%",
      },
      eficacia: {
        label: "Eficácia das resoluções (%)",
        v: (e) => {
          const r = F.filter((f) => f.escola === e && f.resolvida);
          return r.length ? Math.round((r.filter((f) => f.eficacia === "eficaz").length / r.length) * 100) : 0;
        },
        fmt: (v) => v + "%",
      },
      ineficaz: { label: "Resoluções ineficazes", v: (e) => F.filter((f) => f.escola === e && f.resolvida && f.eficacia === "ineficaz").length, fmt: (v) => v },
      nareas: { label: "Nº de áreas afetadas", v: (e) => new Set(F.filter((f) => f.escola === e).map((f) => f.area).filter(Boolean)).size, fmt: (v) => v },
    }),
    [F]
  );

  // Com nomes compridos ou muitas colunas, as barras deitam-se (nomes à esquerda, sem se atropelarem).
  const stackedBars = (data, keys, colors, height) => {
    const deitado = data.length > 6 || data.some((d) => String(d.name).length > 14);
    if (!deitado)
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={<TickEixoX tamanho={11} cor={COLORS.slate} />} height={38} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={k} stackId="a" fill={colors[i]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    const largura = Math.min(210, Math.max(90, Math.max(...data.map((d) => String(d.name).length)) * 6.6 + 14));
    return (
      <ResponsiveContainer width="100%" height={Math.max(height, data.length * 30 + 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4 }}>
          <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={largura} tick={<TickNome largura={largura} tamanho={11.5} cor={COLORS.ink} />} axisLine={false} tickLine={false} interval={0} />
          <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={colors[i]} barSize={16} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const legend = (items) => (
    <div style={{ display: "flex", justifyContent: "center", gap: 14, fontSize: 11.5, marginTop: 6, flexWrap: "wrap" }}>
      {items.map(([l, c]) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: c, display: "inline-block" }} />
          {l}
        </div>
      ))}
    </div>
  );

  const filterStyle = { ...inputStyle, width: 190 };

  return (
    <div>
      <ComparacaoEpocas
        titulo="Comparação entre épocas"
        nota="Respeita o filtro de escola."
        epocas={audits.map((a) => epocaAud(a))}
        selecionadas={fEpocas}
        metricas={[
          { key: "aud", label: "Auditorias realizadas" },
          { key: "n", label: "Constatações", melhor: "baixo" },
          { key: "ncm", label: "Não conformidades maiores", melhor: "baixo" },
          { key: "nc", label: "Não conformidades", melhor: "baixo" },
          { key: "om", label: "Oportunidades de melhoria" },
          { key: "res", label: "Constatações resolvidas", unidade: "%", melhor: "alto" },
          { key: "efic", label: "Resoluções eficazes", unidade: "%", melhor: "alto" },
        ]}
        calcular={(ep, lim) => {
          const auds = audits.filter((a) => (fEsc === "todas" || a.school === fEsc) && epocaAud(a) === ep && (!lim || !a.date || a.date <= lim));
          const fs = auds.flatMap((a) => a.findings || []);
          const resol = fs.filter((f) => f.resolvida);
          return {
            aud: auds.length,
            n: fs.length,
            ncm: fs.filter((f) => f.classification === "NCM").length,
            nc: fs.filter((f) => f.classification === "NC").length,
            om: fs.filter((f) => f.classification === "OM").length,
            res: fs.length ? Math.round((resol.length / fs.length) * 100) : null,
            efic: resol.length ? Math.round((resol.filter((f) => f.eficacia === "eficaz").length / resol.length) * 100) : null,
          };
        }}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <FiltroEpocas epocas={epocasAud} valor={fEpocas} onChange={setFEpocas} />
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={filterStyle}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select value={fArea} onChange={(e) => setFArea(e.target.value)} style={filterStyle}>
          <option value="todas">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select value={fCls} onChange={(e) => setFCls(e.target.value)} style={filterStyle}>
          <option value="todas">Todas as classificações</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c} — {CLASSIFICATION_META[c].label}
            </option>
          ))}
        </select>
      </div>

      <ParamChips params={AUDIT_PARAMS} visible={visible} onToggle={toggle} />

      {F.length === 0 ? (
        <Vazio
          icon={Search}
          titulo="Nenhuma constatação corresponde aos filtros"
          texto="Muda a época ou limpa os filtros de escola, área ou classificação para ver tudo."
        />
      ) : (
        <>
          <Observacoes itens={observacoesAuditorias(F)} />
          <PainelCausas titulo="Causa raiz das constatações resolvidas" itens={itensCausa([], audsSel.filter((a) => fEsc === "todas" || a.school === fEsc))} />

          <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard label="Total de constatações" value={F.length} />
            <StatCard label="Escolas auditadas" value={new Set(F.map((f) => f.escola)).size} />
            <StatCard
              label="Resolvidas"
              value={resolvidas.length}
              color={COLORS.ok}
              subtitle={F.length ? `${Math.round((resolvidas.length / F.length) * 100)}% do total` : ""}
            />
            <StatCard
              label="Eficácia das resoluções"
              value={resolvidas.length ? `${Math.round((eficazes.length / resolvidas.length) * 100)}%` : "—"}
              subtitle="verificadas como eficazes"
              anel={resolvidas.length ? Math.round((eficazes.length / resolvidas.length) * 100) : null}
            />
          </div>

          {visible.has("catArea") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Incidência por categoria e área</div>
              {catAreaData.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.slate }}>Sem categorias registadas nas constatações.</div>
              ) : (
                <>
                  {stackedBars(catAreaData, areas, areas.map((_, i) => SERIES_DISTINTAS[i % SERIES_DISTINTAS.length]), 260)}
                  {legend(areas.map((a, i) => [a, TAG_PALETTE[i % TAG_PALETTE.length].color]))}
                </>
              )}
            </div>
          )}

          {visible.has("clsArea") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Classificações (NCM / NC / OM / AS) por área</div>
              {stackedBars(clsAreaData, classes, classes.map((c) => CLASSIFICATION_META[c].color), 260)}
              {legend(classes.map((c) => [`${c} — ${CLASSIFICATION_META[c].label}`, CLASSIFICATION_META[c].color]))}
            </div>
          )}

          {visible.has("quad") && (
            <div style={{ marginBottom: 16 }}>
              <QuadrantMatrix
                subjects={escolas}
                metrics={metrics}
                defaultX="constat"
                defaultY="taxares"
                label="Matriz de quadrantes — cruzar duas métricas de auditoria por escola"
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {visible.has("rank") && (
              <div style={{ ...panelStyle, flex: "1 1 320px" }}>
                <div style={panelTitle}>Ranking de escolas por constatações</div>
                <ResponsiveContainer width="100%" height={Math.max(180, rankData.length * 34)}>
                  <BarChart data={rankData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={<TickNome largura={130} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                    <Bar dataKey="value" fill={COLORS.navy} radius={[0, 3, 3, 0]} barSize={16} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {visible.has("clsEsc") && (
              <div style={{ ...panelStyle, flex: "1 1 320px" }}>
                <div style={panelTitle}>Classificação por escola</div>
                {stackedBars(clsEscData, classes, classes.map((c) => CLASSIFICATION_META[c].color), 260)}
                {legend(classes.map((c) => [c, CLASSIFICATION_META[c].color]))}
              </div>
            )}
          </div>

          {visible.has("pend") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Constatações por resolver, por área</div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pendData}>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={<TickEixoX tamanho={11} cor={COLORS.slate} />} height={38} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  <Bar dataKey="pendentes" name="Por resolver" fill={COLORS.slate} radius={[3, 3, 0, 0]} animationDuration={800} />
                  <Bar dataKey="graves" name="NCM + NC" fill={COLORS.danger} radius={[3, 3, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
              {legend([
                ["Por resolver", COLORS.slate],
                ["NCM + NC (gravidade)", COLORS.danger],
              ])}
            </div>
          )}

          {visible.has("estado") && (
            <div style={{ ...panelStyle, marginBottom: 16 }}>
              <div style={panelTitle}>Estado das constatações por classificação</div>
              {stackedBars(estadoData, ["eficaz", "parcial", "ineficaz", "pendente"], [COLORS.ok, COLORS.warn, COLORS.danger, COLORS.slate], 250)}
              {legend([
                ["Eficaz", COLORS.ok],
                ["Parcialmente eficaz", COLORS.warn],
                ["Ineficaz", COLORS.danger],
                ["Por resolver", COLORS.slate],
              ])}
            </div>
          )}

          {visible.has("totArea") && (
            <div style={panelStyle}>
              <div style={panelTitle}>Total de constatações por área</div>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={totAreaData}>
                  <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={<TickEixoX tamanho={11} cor={COLORS.slate} />} height={38} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                  <Bar dataKey="value" fill={COLORS.navy} radius={[3, 3, 0, 0]} barSize={34} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Audits page (registo + análise) ----------
// ======================================================================
// ---------- Importar constatações de auditoria (Excel) ----------
// ======================================================================
// Cada linha é uma constatação. As linhas com a mesma escola e a mesma data
// de visita pertencem à mesma auditoria: a app cria as visitas e põe lá dentro
// as constatações. Se a visita já existir, junta-lhes as que faltam.

const COLUNAS_AUDIT_IMP = [
  { chave: "escola", rotulo: "Escola", sinonimos: ["escola", "polo", "recinto", "centro"] },
  { chave: "tipo", rotulo: "Tipo (OM/NC/NCM/AS)", sinonimos: ["tipo", "classificacao", "tipo de constatacao", "tipo (om/nc/ncm/as)"] },
  { chave: "data", rotulo: "Data da visita", sinonimos: ["data da visita", "data visita", "data de visita", "data ocorrencia", "data da ocorrencia", "visita", "data"] },
  { chave: "epoca", rotulo: "Época", opcional: true, sinonimos: ["epoca", "epoca desportiva", "temporada", "season"] },
  { chave: "fecho", rotulo: "Data de fecho", opcional: true, sinonimos: ["data de fecho da ocorrencia", "fecho ocorrencia", "fecho da ocorrencia", "data de fecho", "data fecho", "fecho", "data de resolucao", "resolvido", "data de encerramento"] },
  { chave: "responsavel", rotulo: "Responsável pela resolução", opcional: true, sinonimos: ["responsavel pela resolucao", "responsavel", "resp."] },
  { chave: "assunto", rotulo: "Assunto (categoria)", sinonimos: ["assunto (categoria)", "assunto", "categoria", "constatacao"] },
  { chave: "descricao", rotulo: "Descrição da constatação", opcional: true, sinonimos: ["descricao", "descrição", "descricao da constatacao", "descricao constatacao", "texto", "detalhe", "observacao"] },
  { chave: "causas", rotulo: "Análise de causas", opcional: true, sinonimos: ["analise de causas", "analise de causa", "analise das causas", "causas", "causa"] },
  { chave: "acao", rotulo: "Ações de correção", opcional: true, sinonimos: ["acoes de correcao", "acao de correcao", "acoes corretivas", "acao corretiva", "acoes", "acao", "correcao"] },
  { chave: "prazo", rotulo: "Prazo de resolução", opcional: true, sinonimos: ["prazo de resolucao", "prazo", "data limite", "prazo resolucao"] },
  { chave: "eficacia", rotulo: "Eficácia (E/NE/PE)", opcional: true, sinonimos: ["eficacia", "eficacia (e/ne/sp)", "eficacia da acao", "avaliacao da eficacia"] },
];

// Valores da eficácia na app; o código do Excel escolhe-se no ecrã de importação.
const EFICACIA_IMP_OPCOES = [
  ["eficaz", "Eficaz"],
  ["parcial", "Parcialmente eficaz"],
  ["ineficaz", "Ineficaz"],
  ["", "Por avaliar"],
];
function eficaciaSugerida(codigo) {
  const c = normChave(codigo).replace(/[^a-z]/g, "");
  if (c === "e" || c === "eficaz") return "eficaz";
  if (c === "ne" || c.startsWith("naoeficaz") || c === "ineficaz") return "ineficaz";
  if (c === "pe" || c === "sp" || c.startsWith("parcial")) return "parcial";
  return "";
}

// Prazo do Excel: uma data, ou um prazo relativo à visita ("3 dias úteis", "30 dias").
function prazoConstatacao(v, dataVisita) {
  const s0 = String(v ?? "").trim();
  if (!s0) return null;
  const data = dataDeCelula(s0);
  if (data) return data;
  const m = normChave(s0).match(/(\d+)\s*dias?(\s*uteis)?/);
  if (!m || !dataVisita) return null;
  const n = Number(m[1]);
  const d = new Date(dataVisita + "T00:00:00");
  if (m[2]) {
    let falta = n;
    while (falta > 0) {
      d.setDate(d.getDate() + 1);
      if (!diaNaoUtilPlano(d)) falta--;
    }
  } else d.setDate(d.getDate() + n);
  return isoDe(d);
}

function normEpoca(v) {
  const t = String(v || "").trim();
  let m = t.match(/(\d{4})\s*[/-]\s*(\d{2,4})/);
  if (m) return `${m[1]}/${m[2].slice(-2)}`;
  m = t.match(/^(\d{2})\s*[/-]\s*(\d{2})$/);
  if (m) return `20${m[1]}/${m[2]}`;
  return t;
}

// Visitas que não são de uma escola: eventos realizados e o Sistema de Gestão da Qualidade.
const AMBITOS_AUDITORIA = {
  eventos: { nome: "Eventos", descricao: "Ocorrências em eventos realizados" },
  sgq: { nome: "SGQ geral", descricao: "Sistema de Gestão da Qualidade" },
};

function tipoConstatacao(v) {
  const t = normChave(v).replace(/[^a-z]/g, "");
  if (!t) return null;
  if (t === "ncm" || t.startsWith("ncmaior") || t.startsWith("naoconformidademaior")) return "NCM";
  if (t === "nc" || t.startsWith("naoconformidade")) return "NC";
  if (t === "om" || t.startsWith("oportunidade")) return "OM";
  if (t === "as" || t.startsWith("area") || t.startsWith("sensivel")) return "AS";
  return null;
}

function colunasAuditoria(cab) {
  const c = cab.map(normChave);
  const mapa = {};
  const usadas = new Set();
  COLUNAS_AUDIT_IMP.forEach((col) => {
    // Primeiro procura igualdade, depois títulos que começam pelo sinónimo.
    let i = c.findIndex((h, k) => !usadas.has(k) && col.sinonimos.includes(h));
    if (i < 0) i = c.findIndex((h, k) => !usadas.has(k) && col.sinonimos.some((s) => s.length > 3 && h.startsWith(s)));
    if (i >= 0) {
      mapa[col.chave] = i;
      usadas.add(i);
    }
  });
  return mapa;
}

export function ImportarAuditorias({ audits, escolas, categorias, areas, mapaAreas, onImportar, onFechar }) {
  const [linhas, setLinhas] = useState(null);
  const [folhas, setFolhas] = useState([]);
  const [iFolha, setIFolha] = useState(0);
  const [iCab, setICab] = useState(0);
  const [mapa, setMapa] = useState({});
  const [mapaEscola, setMapaEscola] = useState({});
  const [mapaEficacia, setMapaEficacia] = useState({});
  // Escolas cujo nome novo está a ser escrito à mão.
  const [aEscrever, setAEscrever] = useState({});
  const [erro, setErro] = useState("");
  const [aLer, setALer] = useState(false);

  const carregar = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setALer(true);
    setErro("");
    try {
      const lidas = /\.xlsx?$/i.test(f.name) ? await lerExcelInq(f, { todas: true }) : [{ nome: f.name, oculta: false, linhas: lerCSVInq(await f.text()) }];
      const prep = lidas.map((fo) => ({
        ...fo,
        linhas: fo.linhas
          .map((l, i) => {
            const x = [...l];
            x.__linha = l.__linha || i + 1;
            return x;
          })
          .filter((l) => l.some((c) => String(c ?? "").trim())),
      }));
      // Em cada folha, a linha de títulos é a que reconhece mais colunas (nas 25 primeiras;
      // o Excel pode ter logótipo e título antes da tabela). Fica a folha com melhor tabela.
      const avaliar = (ls) => {
        let melhor = 0;
        let pontos = -1;
        ls.slice(0, 25).forEach((l, i) => {
          const n = Object.keys(colunasAuditoria(l)).length;
          if (n > pontos) {
            pontos = n;
            melhor = i;
          }
        });
        return { melhor, pontos };
      };
      const notas = prep.map((fo) => ({ ...avaliar(fo.linhas), n: fo.linhas.length }));
      let iF = 0;
      notas.forEach((x, i) => {
        if (x.pontos > notas[iF].pontos || (x.pontos === notas[iF].pontos && x.n > notas[iF].n)) iF = i;
      });
      if (!prep[iF].linhas.length) throw new Error("o ficheiro está vazio");
      setFolhas(prep.map((fo, i) => ({ nome: fo.nome, oculta: fo.oculta, linhas: fo.linhas, cab: notas[i].melhor })));
      setIFolha(iF);
      setLinhas(prep[iF].linhas);
      setICab(notas[iF].melhor);
      setMapa(colunasAuditoria(prep[iF].linhas[notas[iF].melhor]));
    } catch (err) {
      setErro(`Não consegui ler o ficheiro: ${err?.message || err}.`);
    } finally {
      setALer(false);
    }
  };

  const cab = linhas ? linhas[iCab] : [];
  const dados = linhas ? linhas.slice(iCab + 1) : [];
  const v = (l, k) => (mapa[k] === undefined ? "" : String(l[mapa[k]] ?? "").trim());

  // Escolas do ficheiro e a escola da app a que correspondem.
  const escolasBrutas = useMemo(() => {
    const c = {};
    dados.forEach((l) => {
      const e = v(l, "escola");
      if (e) c[e] = (c[e] || 0) + 1;
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [linhas, iCab, mapa]); // eslint-disable-line react-hooks/exhaustive-deps

  // Códigos de eficácia do ficheiro (E, NE, SP…).
  const codigosEficacia = useMemo(() => {
    const c = {};
    dados.forEach((l) => {
      const x = v(l, "eficacia").toUpperCase();
      if (x) c[x] = (c[x] || 0) + 1;
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [linhas, iCab, mapa]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setMapaEficacia((atual) => {
      const novo = {};
      codigosEficacia.forEach(([cod]) => (novo[cod] = atual[cod] !== undefined ? atual[cod] : eficaciaSugerida(cod)));
      return novo;
    });
  }, [codigosEficacia]);

  useEffect(() => {
    const novo = {};
    escolasBrutas.forEach(([bruto]) => {
      const semPrefixo = (t) => normChave(t).replace(/^(dragon force|df)\s*[-–·:]?\s*/, "");
      const n = semPrefixo(bruto);
      const exata = escolas.find((e) => normChave(e) === normChave(bruto) || semPrefixo(e) === n);
      const parcial = n.length >= 3 && escolas.find((e) => normChave(e).includes(n));
      const amb = ambitoDoNome(bruto);
      novo[bruto] = amb ? `__ambito__${amb}` : exata || parcial || `__nova__${nomeEscolaProposto(bruto)}`;
    });
    setMapaEscola(novo);
  }, [escolasBrutas]); // eslint-disable-line react-hooks/exhaustive-deps

  const resultado = useMemo(() => {
    if (!linhas) return null;
    const problemas = [];
    const visitas = {};
    dados.forEach((l, i) => {
      const bruto = v(l, "escola");
      const data = dataDeCelula(v(l, "data"));
      const epocaCol = normEpoca(v(l, "epoca"));
      const tipo = tipoConstatacao(v(l, "tipo"));
      const assunto = v(l, "assunto");
      const linhaN = l.__linha || iCab + i + 2;
      // Nada fica de fora: o que estiver incompleto entra e corrige-se depois na app.
      if (!bruto) problemas.push(`Linha ${linhaN}: sem escola`);
      if (!data) problemas.push(`Linha ${linhaN}: sem data da visita${v(l, "data") ? ` ("${v(l, "data")}")` : ""}`);
      if (!tipo) problemas.push(`Linha ${linhaN}: tipo "${v(l, "tipo")}" por classificar`);
      if (!data && !epocaCol) problemas.push(`Linha ${linhaN}: sem data nem época`);
      const alvo = bruto ? mapaEscola[bruto] || `__nova__${nomeEscolaProposto(bruto)}` : "Sem escola";
      const ambito = alvo.startsWith("__ambito__") ? alvo.slice(10) : null;
      const escola = ambito ? AMBITOS_AUDITORIA[ambito].nome : alvo.startsWith("__nova__") ? alvo.slice(8) : alvo;
      const epoca = epocaCol || (data ? epocaDe(data) : "");
      const fecho = dataDeCelula(v(l, "fecho"));
      const codEficacia = v(l, "eficacia").toUpperCase();
      const analise = v(l, "causas");
      const causaLista = (CAUSAS_ATUAIS || []).find((c) => normChave(c) === normChave(analise));
      const areaLista = areaSugerida(assunto, areas, mapaAreas);
      const catLista = categorias.find((c) => normChave(c) === normChave(assunto));
      const chave = data ? `${escola}|${data}` : `${escola}|sem data|${epoca}`;
      visitas[chave] = visitas[chave] || { escola, ambito, data: data || null, epoca, findings: [] };
      visitas[chave].findings.push({
        id: `f_imp_${Date.now().toString(36)}_${i}`,
        classification: tipo || "",
        category: catLista || assunto,
        area: areaLista || "",
        description: v(l, "descricao") || assunto || "(sem assunto)",
        resolvida: !!fecho || !!codEficacia,
        resolvidaEm: fecho || null,
        responsavel: v(l, "responsavel"),
        analiseCausas: causaLista ? "" : analise,
        causaRaiz: causaLista || "",
        eficacia: codEficacia ? mapaEficacia[codEficacia] ?? eficaciaSugerida(codEficacia) : "",
        acao: v(l, "acao"),
        prazo: prazoConstatacao(v(l, "prazo"), data),
        prazoTexto: v(l, "prazo") && !dataDeCelula(v(l, "prazo")) ? v(l, "prazo") : "",
        origem: "importacao",
      });
    });
    const lista = Object.values(visitas).sort((a, b) => String(a.data || a.epoca).localeCompare(String(b.data || b.epoca)));
    const assinatura = (f) => [f.classification, normChave(f.description), f.resolvidaEm || "", normChave(f.responsavel || "")].join("|");
    let novasVisitas = 0;
    let juntas = 0;
    let repetidas = 0;
    let atualizadas = 0;
    lista.forEach((vis) => {
      const existe = audits.find((a) => a.school === vis.escola && (vis.data ? a.date === vis.data : !a.date && epocaAud(a) === vis.epoca));
      if (existe) {
        const ja = new Set((existe.findings || []).map(assinatura));
        const antes = vis.findings.length;
        // Constatações de uma importação anterior sem descrição (tinham só o assunto): preenche-se a descrição em vez de duplicar.
        const sig2 = (f) => [f.classification, normChave(f.category), f.resolvidaEm || "", normChave(f.responsavel || "")].join("|");
        const semDesc = (existe.findings || []).filter((x) => x.origem === "importacao" && (!x.description || x.description === x.category || x.description === "(sem assunto)"));
        const usadas = new Set();
        vis.atualizar = [];
        vis.findings = vis.findings.filter((f) => {
          if (ja.has(assinatura(f))) return false;
          if (f.description && f.description !== f.category && f.description !== "(sem assunto)") {
            const alvo = semDesc.find((x) => !usadas.has(x.id) && sig2(x) === sig2(f));
            if (alvo) {
              usadas.add(alvo.id);
              vis.atualizar.push({ id: alvo.id, description: f.description });
              return false;
            }
          }
          return true;
        });
        atualizadas += vis.atualizar.length;
        repetidas += antes - vis.findings.length - vis.atualizar.length;
        vis.existente = existe.id;
        if (vis.findings.length || vis.atualizar.length) juntas++;
      } else novasVisitas++;
    });
    const total = lista.reduce((n, x) => n + x.findings.length, 0);
    const porEpoca = {};
    lista.forEach((x) => {
      const ep = x.epoca || "sem época";
      porEpoca[ep] = porEpoca[ep] || { visitas: 0, constat: 0 };
      porEpoca[ep].visitas++;
      porEpoca[ep].constat += x.findings.length;
    });
    return { lista, problemas, novasVisitas, juntas, repetidas, atualizadas, total, porEpoca };
  }, [linhas, iCab, mapa, mapaEscola, mapaEficacia, audits]); // eslint-disable-line react-hooks/exhaustive-deps

  const faltam = COLUNAS_AUDIT_IMP.filter((c) => !c.opcional && mapa[c.chave] === undefined && !(c.chave === "data" && mapa.epoca !== undefined));
  const novasEscolas = [...new Set(Object.values(mapaEscola).filter((x) => x.startsWith("__nova__")).map((x) => x.slice(8)))];

  const importar = () => {
    const novas = [];
    const acrescentos = {};
    const atualizacoes = {};
    resultado.lista.forEach((vis, i) => {
      if (vis.existente && vis.atualizar?.length) atualizacoes[vis.existente] = vis.atualizar;
      if (!vis.findings.length) return;
      if (vis.existente) acrescentos[vis.existente] = [...(acrescentos[vis.existente] || []), ...vis.findings];
      else novas.push({ id: `a_imp_${Date.now().toString(36)}_${i}`, school: vis.escola, ambito: vis.ambito || null, date: vis.data, epoca: vis.epoca || null, findings: vis.findings, origem: "importacao" });
    });
    onImportar(novas, acrescentos, novasEscolas, atualizacoes);
  };

  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div
        className="sheet"
        style={{ width: "min(720px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Importar constatações de auditoria</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.55, marginBottom: 14 }}>
          Uma linha por constatação, com as colunas <strong>Escola</strong>, <strong>Tipo</strong> (OM, NC, NCM ou AS), <strong>Data da visita</strong>, <strong>Data de fecho</strong>, <strong>Responsável</strong>, <strong>Assunto</strong>, <strong>Análise de causas</strong>, <strong>Ações de correção</strong>, <strong>Prazo de resolução</strong>, <strong>Eficácia</strong> (E, NE ou PE) e <strong>Época</strong>. Não precisa de estar ordenado: as linhas com a mesma escola e a mesma data ficam na mesma visita, com a época indicada na coluna Época. Linhas incompletas entram na mesma e corriges depois.
        </div>
        <label style={{ ...primaryBtnStyle, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px", width: "auto" }}>
          <Plus size={15} /> {aLer ? "A ler…" : linhas ? "Escolher outro ficheiro" : "Escolher ficheiro Excel ou CSV"}
          <input type="file" accept=".xlsx,.csv" onChange={carregar} style={{ display: "none" }} />
        </label>
        {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.danger }}>{erro}</div>}

        {linhas && (
          <>
            {folhas.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "16px 0 0", fontSize: 12.5, color: COLORS.ink2 }}>
                Folha do Excel
                <select
                  value={iFolha}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setIFolha(n);
                    setLinhas(folhas[n].linhas);
                    setICab(folhas[n].cab);
                    setMapa(colunasAuditoria(folhas[n].linhas[folhas[n].cab] || []));
                  }}
                  style={{ ...inputStyle, width: "auto", padding: "4px 8px" }}
                >
                  {folhas.map((fo, i) => (
                    <option key={i} value={i}>
                      {fo.nome}
                      {fo.oculta ? " (oculta)" : ""} · {fo.linhas.length} linhas
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "10px 0 0", fontSize: 12.5, color: COLORS.ink2 }}>
              Títulos das colunas na linha
              <select
                value={iCab}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setICab(n);
                  setMapa(colunasAuditoria(linhas[n]));
                }}
                style={{ ...inputStyle, width: "auto", padding: "4px 8px" }}
              >
                {linhas.slice(0, 25).map((l, i) => (
                  <option key={i} value={i}>
                    {(l.__linha || i + 1)}: {l.filter((c) => String(c ?? "").trim()).slice(0, 3).join(" · ").slice(0, 50) || "(vazia)"}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>Que coluna é o quê</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {COLUNAS_AUDIT_IMP.map((c) => (
                <div key={c.chave}>
                  <label style={{ ...labelStyle, marginTop: 0 }}>
                    {c.rotulo}
                    {c.opcional && <span style={{ color: COLORS.slate, fontWeight: 400 }}> · opcional</span>}
                  </label>
                  <select
                    value={mapa[c.chave] ?? ""}
                    onChange={(e) => setMapa((m) => ({ ...m, [c.chave]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                    style={{ ...inputStyle, borderColor: !c.opcional && mapa[c.chave] === undefined ? COLORS.danger : undefined }}
                  >
                    <option value="">—</option>
                    {cab.map((h, i) => (
                      <option key={i} value={i}>
                        {String(h || `Coluna ${i + 1}`)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {faltam.length === 0 && escolasBrutas.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 4px" }}>Escolas encontradas no ficheiro</div>
                <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 8, lineHeight: 1.5 }}>
                  Para cada nome do Excel escolhe a escola da app. Se ainda não existir, cria-a antes em Todas as listas com o nome que usas, ou escolhe "Escrever o nome…". Eventos e SGQ ficam fora das escolas.
                </div>
                <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden" }}>
                  {escolasBrutas.map(([bruto, n], i) => (
                    <div key={bruto} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 13 }}>
                      <span style={{ flex: 1 }}>
                        {bruto} <span style={{ color: COLORS.slate }}>· {n} {n === 1 ? "constatação" : "constatações"}</span>
                      </span>
                      <span style={{ color: COLORS.slate }}>→</span>
                      {aEscrever[bruto] ? (
                        <span style={{ display: "flex", gap: 6, width: 260 }}>
                          <input
                            autoFocus
                            value={aEscrever[bruto].texto}
                            onChange={(e) => setAEscrever((x) => ({ ...x, [bruto]: { texto: e.target.value } }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && aEscrever[bruto].texto.trim()) {
                                setMapaEscola((m) => ({ ...m, [bruto]: `__nova__${aEscrever[bruto].texto.trim()}` }));
                                setAEscrever((x) => ({ ...x, [bruto]: null }));
                              }
                            }}
                            placeholder="Nome da escola"
                            style={{ ...inputStyle, padding: "6px 8px" }}
                          />
                          <button
                            onClick={() => {
                              if (aEscrever[bruto].texto.trim()) setMapaEscola((m) => ({ ...m, [bruto]: `__nova__${aEscrever[bruto].texto.trim()}` }));
                              setAEscrever((x) => ({ ...x, [bruto]: null }));
                            }}
                            style={{ ...primaryBtnStyle, width: "auto", padding: "0 10px" }}
                            aria-label="Usar este nome"
                          >
                            <Check size={14} />
                          </button>
                        </span>
                      ) : (
                      <select
                        value={mapaEscola[bruto] || ""}
                        onChange={(e) => {
                          if (e.target.value === "__escrever__") {
                            const atual = mapaEscola[bruto] || "";
                            setAEscrever((x) => ({ ...x, [bruto]: { texto: atual.startsWith("__nova__") ? atual.slice(8) : nomeEscolaProposto(bruto) } }));
                            return;
                          }
                          setMapaEscola((m) => ({ ...m, [bruto]: e.target.value }));
                        }}
                        style={{ ...inputStyle, width: 260, padding: "6px 8px" }}
                      >
                        <optgroup label="Escolas da app">
                        {escolas.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                        </optgroup>
                        <optgroup label="Não é uma escola">
                          {Object.entries(AMBITOS_AUDITORIA).map(([k, a]) => (
                            <option key={k} value={`__ambito__${k}`}>
                              {a.nome} · {a.descricao.toLowerCase()}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Criar escola nova">
                          <option value="__escrever__">Escrever o nome…</option>
                        {/* Escolas novas propostas a partir de todo o ficheiro: permite juntar
                            nomes diferentes da mesma escola (ex.: "CTROFA" e "Colégio da Trofa"). */}
                        {[...new Set(escolasBrutas.map(([b0]) => nomeEscolaProposto(b0)))]
                          .filter((n) => !escolas.includes(n))
                          .sort((a, b) => a.localeCompare(b, "pt"))
                          .map((n) => (
                            <option key={n} value={`__nova__${n}`}>
                              Nova: {n}
                            </option>
                          ))}
                        {/* Nomes escritos à mão também aparecem, para juntar outras linhas a eles. */}
                        {[...new Set(Object.values(mapaEscola).filter((x) => x && x.startsWith("__nova__")).map((x) => x.slice(8)))]
                          .filter((n) => !escolas.includes(n) && !escolasBrutas.some(([b0]) => nomeEscolaProposto(b0) === n))
                          .map((n) => (
                            <option key={`m_${n}`} value={`__nova__${n}`}>
                              Nova: {n}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {faltam.length === 0 && codigosEficacia.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 8px" }}>Eficácia: o que quer dizer cada código</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {codigosEficacia.map(([cod, n]) => (
                    <label key={cod} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, border: `1px solid ${COLORS.rule}`, borderRadius: 10, padding: "6px 10px" }}>
                      <strong>{cod}</strong>
                      <span style={{ color: COLORS.slate }}>({n})</span>
                      <span style={{ color: COLORS.slate }}>→</span>
                      <select value={mapaEficacia[cod] ?? ""} onChange={(e) => setMapaEficacia((m) => ({ ...m, [cod]: e.target.value }))} style={{ ...inputStyle, width: "auto", padding: "5px 8px" }}>
                        {EFICACIA_IMP_OPCOES.map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </>
            )}

            {faltam.length > 0 ? (
              <div style={{ marginTop: 14, fontSize: 12.5, color: COLORS.danger }}>Falta indicar a coluna de: {faltam.map((c) => c.rotulo).join(", ")}.</div>
            ) : (
              resultado && (
                <div style={{ marginTop: 18, padding: "14px 16px", background: COLORS.paperSunken, borderRadius: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {resultado.total} constatações em {resultado.lista.filter((x) => x.findings.length).length} visitas
                  </div>
                  <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 6, lineHeight: 1.6 }}>
                    {resultado.novasVisitas} visitas novas
                    {resultado.lista.some((x) => x.ambito) ? ` (das quais ${resultado.lista.filter((x) => x.ambito).length} de eventos ou SGQ, fora das escolas)` : ""}
                    {resultado.juntas ? ` · ${resultado.juntas} visitas que já existiam recebem constatações` : ""}
                    {resultado.atualizadas ? ` · ${resultado.atualizadas} já existentes recebem a descrição` : ""}
                    {resultado.repetidas ? ` · ${resultado.repetidas} repetidas ignoradas` : ""}
                    <br />
                    {Object.entries(resultado.porEpoca)
                      .sort()
                      .map(([ep, x]) => `Época ${ep}: ${x.visitas} visitas, ${x.constat} constatações`)
                      .join(" · ")}
                    {novasEscolas.length > 0 && (
                      <>
                        <br />
                        Escolas novas a criar: {novasEscolas.join(", ")}
                      </>
                    )}
                  </div>
                  {resultado.problemas.length > 0 && (
                    <details style={{ marginTop: 8, fontSize: 12, color: COLORS.warn }}>
                      <summary style={{ cursor: "pointer" }}>{resultado.problemas.length} dados em falta ou por classificar (entram na mesma; corriges depois na visita)</summary>
                      <div style={{ marginTop: 6, color: COLORS.ink2, lineHeight: 1.6 }}>{resultado.problemas.slice(0, 30).join(" · ")}</div>
                    </details>
                  )}
                </div>
              )
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={onFechar} style={{ ...secondaryBtnStyle, flex: 1 }}>
                Cancelar
              </button>
              <button onClick={importar} disabled={faltam.length > 0 || !resultado || !(resultado.total || resultado.atualizadas)} style={{ ...primaryBtnStyle, flex: 2, opacity: faltam.length > 0 || !resultado || !(resultado.total || resultado.atualizadas) ? 0.5 : 1 }}>
                Importar {resultado && resultado.total ? `${resultado.total} constatações` : resultado && resultado.atualizadas ? `(preencher ${resultado.atualizadas} descrições)` : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Associa a cada assunto (categoria) a sua área / departamento, em todas as constatações de uma vez.
export function AreasConstatacoes({ audits, areas, mapaGuardado, onAplicar, onFechar, onGerirLista }) {
  const assuntos = useMemo(() => {
    const c = {};
    audits.forEach((a) =>
      (a.findings || []).forEach((f) => {
        const k = f.category || f.description || "";
        if (!k) return;
        c[k] = c[k] || { n: 0, areas: {} };
        c[k].n++;
        if (f.area) c[k].areas[f.area] = (c[k].areas[f.area] || 0) + 1;
      })
    );
    return Object.entries(c).sort((x, y) => y[1].n - x[1].n);
  }, [audits]);
  const [mapa, setMapa] = useState(() =>
    Object.fromEntries(
      assuntos.map(([k, x]) => {
        const atual = Object.entries(x.areas).sort((p, q) => q[1] - p[1])[0];
        return [k, atual ? atual[0] : areaSugerida(k, areas, mapaGuardado)];
      })
    )
  );
  const semArea = assuntos.filter(([k]) => !mapa[k]).length;
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(720px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Áreas e categorias</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.55, marginBottom: 12 }}>
          Cada assunto passa a ser uma categoria. Escolhe a área / departamento de cada um e aplica a todas as constatações com esse assunto. A app sugere pelas palavras do assunto; confirma antes de aplicar.{" "}
          <button onClick={() => onGerirLista("auditAreas")} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
            Gerir lista de áreas
          </button>
        </div>
        <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden" }}>
          {assuntos.map(([k, x], i) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {k} <span style={{ color: COLORS.slate }}>· {x.n}</span>
              </span>
              <select value={mapa[k] || ""} onChange={(e) => setMapa((m) => ({ ...m, [k]: e.target.value }))} style={{ ...inputStyle, width: 230, padding: "6px 8px", borderColor: mapa[k] ? undefined : COLORS.warn }}>
                <option value="">Sem área</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
          <span style={{ flex: 1, fontSize: 12, color: semArea ? COLORS.warn : COLORS.slate }}>{semArea ? `${semArea} assuntos sem área` : "Todos os assuntos com área"}</span>
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", padding: "10px 16px" }}>
            Cancelar
          </button>
          <button onClick={() => onAplicar(mapa)} style={{ ...primaryBtnStyle, width: "auto", padding: "10px 16px" }}>
            Aplicar a {assuntos.reduce((n, [, x]) => n + x.n, 0)} constatações
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuditsPage({ audits, onNewAudit, onOpenAudit, onImportar, onApagarTodas, onAreas, onPreencher, onIso, schoolOptions, areaOptions, auditCategoryOptions }) {
  const [view, setView] = useState("registo");
  const [apagarTodas, setApagarTodas] = useState(false);
  const [fEpoca, setFEpoca] = useState([]);
  const [fEscola, setFEscola] = useState("todas");
  const [fTipo, setFTipo] = useState("todos");
  const [fEstado, setFEstado] = useState("todos");
  const [fArea, setFArea] = useState("todas");
  const [fIso, setFIso] = useState("");
  const [fTexto, setFTexto] = useState("");
  // Quantas constatações de cada visita já vinham da visita anterior à mesma escola.
  const repPorAud = useMemo(() => Object.fromEntries(audits.map((a) => [a.id, Object.keys(repetidasDaAnterior(a, audits).mapa).length])), [audits]);

  const epocasLista = [...new Set(audits.map((a) => epocaAud(a)).filter(Boolean))].sort().reverse();
  const escolasLista = [...new Set(audits.map((a) => a.school).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
  const areasLista = [...new Set(audits.flatMap((a) => (a.findings || []).map((f) => f.area)).filter(Boolean))].sort();
  const temFiltroConst = fTipo !== "todos" || fArea !== "todas" || fIso || fTexto.trim();
  const passaConst = (f) =>
    (fTipo === "todos" || (fTipo === "sem" ? !f.classification : f.classification === fTipo)) &&
    (fArea === "todas" || (fArea === "sem" ? !f.area : f.area === fArea)) &&
    (!fIso || (fIso === "sem" ? !f.iso : String(f.iso || "") === fIso || String(f.iso || "").startsWith(`${fIso}.`))) &&
    (!fTexto.trim() || normChave([f.description, f.category, f.area, f.analiseCausas, f.acao, f.responsavel].join(" ")).includes(normChave(fTexto)));
  const filtradas = audits.filter((a) => {
    if (!naSelecao(fEpoca, epocaAud(a))) return false;
    if (fEscola !== "todas" && a.school !== fEscola) return false;
    const fs = a.findings || [];
    if (temFiltroConst && !fs.some(passaConst)) return false;
    if (fEstado === "pendentes" && !fs.some((f) => !f.resolvida && (!temFiltroConst || passaConst(f)))) return false;
    if (fEstado === "resolvidas" && fs.some((f) => !f.resolvida)) return false;
    return true;
  });
  const sorted = [...filtradas].sort((a, b) => String(b.date || `${epocaAud(b)}`).localeCompare(String(a.date || `${epocaAud(a)}`)));
  const nConst = filtradas.reduce((n, a) => n + (a.findings || []).filter((f) => !temFiltroConst || passaConst(f)).length, 0);
  const filtroSel = { ...inputStyle, width: "auto", minWidth: 0, padding: "7px 9px", fontSize: 13 };

  return (
    <div>
      <div
        style={{
          display: "inline-flex",
          gap: 3,
          background: COLORS.segTrack,
          border: "none",
          borderRadius: 9,
          padding: 2,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {[
          ["registo", "Registo"],
          ["analise", "Análise"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className="pill"
            style={{
              background: view === key ? COLORS.paperRaised : "transparent",
              border: "none",
              borderRadius: 7,
              padding: "7px 14px",
              fontSize: 13.5,
              fontWeight: view === key ? 600 : 500,
              color: view === key ? COLORS.ink : COLORS.ink2,
              cursor: "pointer",
              boxShadow: view === key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div key={view} className="pageIn">
      {view === "analise" ? (
        <AuditsAnalysis audits={audits} schoolOptions={schoolOptions} areaOptions={areaOptions} auditCategoryOptions={auditCategoryOptions} />
      ) : (
        <>
          {apagarTodas && (
            <div style={{ border: `1px solid ${COLORS.warn}`, borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 220, fontSize: 13, color: COLORS.ink, lineHeight: 1.5 }}>
                Apagar todas as {audits.length} auditorias e as suas constatações? Não dá para desfazer.
              </span>
              <button onClick={() => setApagarTodas(false)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
                Não
              </button>
              <button
                onClick={() => {
                  onApagarTodas();
                  setApagarTodas(false);
                }}
                style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px", background: COLORS.warn }}
              >
                Sim, apagar tudo
              </button>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {onPreencher && audits.some((a) => (a.findings || []).some((f) => !f.area || !f.category)) && (
              <button onClick={onPreencher} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
                <Sparkles size={15} /> Preencher área e categoria
              </button>
            )}
            {onIso && audits.some((a) => (a.findings || []).some((f) => !f.iso)) && (
              <button onClick={onIso} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
                <Sparkles size={15} /> Requisitos ISO 9001
              </button>
            )}
            {onAreas && audits.length > 0 && (
              <button onClick={onAreas} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "10px 14px" }}>
                Áreas e categorias
              </button>
            )}
            {onImportar && (
              <button onClick={onImportar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "10px 14px", display: "flex", alignItems: "center", gap: 7 }}>
                <FileText size={15} /> Importar Excel
              </button>
            )}
            {onApagarTodas && audits.length > 0 && (
              <button onClick={() => setApagarTodas(true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "10px 14px", display: "flex", alignItems: "center", gap: 7, color: COLORS.warn }}>
                <Trash2 size={15} /> Apagar todas
              </button>
            )}
            <button
              onClick={onNewAudit}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: COLORS.navy,
                color: COLORS.onAccent,
                border: "none",
                borderRadius: 4,
                padding: "10px 16px",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              <Plus size={16} /> Nova auditoria
            </button>
          </div>

          {audits.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              <FiltroEpocas epocas={epocasLista} valor={fEpoca} onChange={setFEpoca} compacto />
              <select value={fEscola} onChange={(e) => setFEscola(e.target.value)} style={{ ...filtroSel, maxWidth: 240 }} aria-label="Escola">
                <option value="todas">Todas as escolas</option>
                {escolasLista.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={filtroSel} aria-label="Tipo">
                <option value="todos">Todos os tipos</option>
                {Object.entries(CLASSIFICATION_META).map(([k, m]) => (
                  <option key={k} value={k}>
                    {k} · {m.label}
                  </option>
                ))}
                <option value="sem">Sem tipo</option>
              </select>
              <select value={fArea} onChange={(e) => setFArea(e.target.value)} style={{ ...filtroSel, maxWidth: 220 }} aria-label="Área">
                <option value="todas">Todas as áreas</option>
                {areasLista.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                <option value="sem">Sem área</option>
              </select>
              <select value={fIso} onChange={(e) => setFIso(e.target.value)} style={{ ...filtroSel, maxWidth: 220 }} aria-label="Requisito ISO">
                <option value="">Todos os requisitos ISO</option>
                {Object.entries(GRUPOS_ISO).map(([g, l]) => (
                  <optgroup key={g} label={l}>
                    <option value={g}>Todo o capítulo {g}</option>
                    {REQUISITOS_ISO.filter((r) => r.c.split(".")[0] === g).map((r) => (
                      <option key={r.c} value={r.c}>
                        {r.c} {r.t}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="sem">Sem requisito ISO</option>
              </select>
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={filtroSel} aria-label="Estado">
                <option value="todos">Todos os estados</option>
                <option value="pendentes">Com constatações por resolver</option>
                <option value="resolvidas">Todas resolvidas</option>
              </select>
              <input value={fTexto} onChange={(e) => setFTexto(e.target.value)} placeholder="Procurar nas constatações…" style={{ ...filtroSel, flex: 1, minWidth: 180 }} />
              <span style={{ fontSize: 12, color: COLORS.slate, whiteSpace: "nowrap" }}>
                {sorted.length} visitas · {nConst} constatações
              </span>
            </div>
          )}

          {audits.length > 0 && sorted.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.slate, padding: "20px 0" }}>Nenhuma visita com estes filtros.</div>
          ) : sorted.length === 0 ? (
            <Vazio
              icon={ClipboardList}
              titulo="Ainda sem auditorias"
              texto="Registas a auditoria e depois vais acrescentando as constatações, com classificação, área e ação corretiva."
              acao="Nova auditoria"
              onAcao={onNewAudit}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {sorted.map((a) => {
                const fs = a.findings || [];
                const pend = fs.filter((f) => !f.resolvida).length;
                return (
                  <div
                    key={a.id}
                    onClick={() => onOpenAudit(a)}
                    style={{
                      background: COLORS.paperRaised,
                      border: `1px solid ${COLORS.rule}`,
                      borderRadius: 6,
                      padding: "13px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
                        {a.school}
                        {ambitoAud(a) !== "escola" && <Tag label={ambitoAud(a) === "eventos" ? "Evento" : "SGQ"} color={COLORS.slate} bg={COLORS.paperSunken} />}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
                        {dataAud(a)} · {fs.length} constatações{a.epoca && a.date && a.epoca !== epocaDe(a.date) ? ` · época ${a.epoca}` : !a.date && a.epoca ? ` · época ${a.epoca}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {Object.keys(CLASSIFICATION_META).map((c) => {
                        const n = fs.filter((f) => f.classification === c).length;
                        if (!n) return null;
                        return <Tag key={c} label={`${n} ${c}`} color={CLASSIFICATION_META[c].color} bg={CLASSIFICATION_META[c].bg} />;
                      })}
                      {fs.some((f) => !f.classification) && <Tag label={`${fs.filter((f) => !f.classification).length} sem tipo`} color={COLORS.warn} bg={COLORS.warnBg} />}
                      {repPorAud[a.id] > 0 && <Tag label={`↻ ${repPorAud[a.id]} ${repPorAud[a.id] === 1 ? "repetida" : "repetidas"}`} color={COLORS.warn} bg={COLORS.warnBg} />}
                      {fs.length > 0 &&
                        (pend ? (
                          <Tag label={`${pend} por resolver`} color={COLORS.warn} bg={COLORS.warnBg} />
                        ) : (
                          <Tag label="todas resolvidas" color={COLORS.ok} bg={COLORS.okBg} />
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
