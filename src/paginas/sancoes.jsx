// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import { useState, useMemo } from "react";
import { Plus, X, Trash2, Pencil, ShieldAlert, Scale, Users } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { COLORS, MOTIVO_META, StatCard, Tag, Vazio, colorForLabel, epocaDe, fmt, iconBtnStyle, inputStyle, labelStyle, linkBtnStyle, nomeOcorrencia, panelStyle, panelTitle, primaryBtnStyle, secondaryBtnStyle } from "../nucleo.jsx";
import { ComparacaoEpocas, DF_STAGE_META, DicaGrafico, PERSON_TYPE_META, TickNome, naEpoca } from "../partilhado.jsx";

// ---------- Sanções: novo registo de ocorrência ----------
export function SanctionForm({ onCancel, onSave, schoolOptions, complaints, sanctionTypes, onGerirLista, turmas, turmasPorEscola, inicial, registoAlunos }) {
  const [form, setForm] = useState(() => inicial ? {
    ...inicial,
    personName: inicial.personName || "",
    atletas: inicial.atletas && inicial.atletas.length ? inicial.atletas : [""],
    idsFilhos: inicial.idsFilhos && inicial.idsFilhos.length ? inicial.idsFilhos : [""],
    semCodigo: inicial.personType === "familia" && !(inicial.idsFilhos || []).some(Boolean) && !!inicial.personName,
    escalao: inicial.escalao || "",
    school: inicial.school || "",
    description: inicial.description || "",
    relatedComplaintId: inicial.relatedComplaintId || "",
  } : {
    personType: "familia",
    personName: "",
    atletas: [""],
    idsFilhos: [""],
    semCodigo: false,
    escalao: "",
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
  const eAtleta = form.personType === "atleta";
  const escaloes = (form.school && turmasPorEscola?.[form.school]?.length ? turmasPorEscola[form.school] : turmas) || [];
  const eFamilia = form.personType === "familia";
  const nomesValidos = form.atletas.map((n) => n.trim()).filter(Boolean);
  const filhosValidos = (form.idsFilhos || []).map((n) => n.trim()).filter(Boolean);
  const familiaPorCodigo = eFamilia && !form.semCodigo;
  const podeGuardar = eAtleta ? nomesValidos.length >= 1 : familiaPorCodigo ? filhosValidos.length >= 1 : !!form.personName.trim();

  // Procura o código nos inscritos (época mais recente primeiro) para mostrar turma e escola.
  const procurarCodigo = (cod) => {
    const c = String(cod || "").trim();
    if (!c) return null;
    for (const ep of Object.keys(registoAlunos || {}).sort().reverse()) {
      const a = registoAlunos[ep]?.alunos?.[c];
      if (a) return { ...a, epoca: ep };
    }
    return null;
  };
  // Se a escola ou a turma estão vazias, preenche-as pelo primeiro código reconhecido.
  const aoMudarCodigo = (campo, i, v) =>
    setForm((f) => {
      const lista = f[campo].map((n, j) => (j === i ? v : n));
      const a = procurarCodigo(v);
      return {
        ...f,
        [campo]: lista,
        school: f.school || (a && (schoolOptions || []).includes(a.escola) ? a.escola : f.school),
        escalao: campo === "atletas" && !f.escalao && a ? a.turma || f.escalao : f.escalao,
      };
    });

  // Lista de códigos de aluno (um ou vários), com a turma e a escola de cada código reconhecido.
  const listaCodigos = (campo, rotulo, rotuloMais) => (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {form[campo].map((cod, i) => {
          const a = procurarCodigo(cod);
          return (
            <div key={i}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={i === 0 ? rotulo : `${rotulo} ${i + 1}`}
                  value={cod}
                  autoFocus={i > 0 && i === form[campo].length - 1 && !cod}
                  onChange={(e) => aoMudarCodigo(campo, i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (cod.trim()) setForm((f) => ({ ...f, [campo]: [...f[campo], ""] }));
                    }
                  }}
                  style={{ ...inputStyle, flex: 1, fontVariantNumeric: "tabular-nums" }}
                />
                {form[campo].length > 1 && (
                  <button type="button" title="Remover" onClick={() => setForm((f) => ({ ...f, [campo]: f[campo].filter((_, j) => j !== i) }))} style={{ ...iconBtnStyle, flex: "none" }}>
                    <X size={16} />
                  </button>
                )}
              </div>
              {cod.trim() && (
                <div style={{ fontSize: 11.5, marginTop: 3, color: a ? COLORS.slate : COLORS.warn }}>
                  {a ? `${a.turma || "sem turma"} · ${a.escola}${a.ano ? ` · ${a.ano}` : ""}${a.estado === "desistiu" ? " · desistiu" : ""}` : "Código não encontrado nos inscritos (guarda-se na mesma)"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => setForm((f) => ({ ...f, [campo]: [...f[campo], ""] }))} style={{ ...linkBtnStyle, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Plus size={14} /> {rotuloMais}
      </button>
    </>
  );

  return (
    <div
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onCancel}
    >
      <div
        className="sheet"
        style={{ width: "min(460px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>{inicial ? "Editar ocorrência" : "Nova ocorrência"}</h2>
          <button onClick={onCancel} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        <label style={{ ...labelStyle, marginTop: 0 }}>Quem está envolvido</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {Object.entries(PERSON_TYPE_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setForm((f) => ({ ...f, personType: key }))}
              style={{
                flex: "1 1 30%",
                padding: "10px 8px",
                borderRadius: 4,
                border: `1.5px solid ${form.personType === key ? COLORS.navy : COLORS.rule}`,
                background: form.personType === key ? COLORS.navy : "transparent",
                color: form.personType === key ? COLORS.onAccent : COLORS.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        {eAtleta ? (
          <>
            <label style={{ ...labelStyle, marginTop: 0 }}>{form.atletas.length > 1 ? `Códigos dos alunos (${form.atletas.length})` : "Código do aluno"}</label>
            {listaCodigos("atletas", "Código do aluno", "Adicionar outro aluno")}
            <label style={labelStyle}>Turma / equipa</label>
            <select value={form.escalao} onChange={set("escalao")} style={inputStyle}>
              <option value="">Sem escalão indicado</option>
              {escaloes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </>
        ) : eFamilia ? (
          <>
            {!form.semCodigo && (
              <>
                <label style={{ ...labelStyle, marginTop: 0 }}>{form.idsFilhos.length > 1 ? `Códigos dos educandos (${form.idsFilhos.length})` : "Código do educando"}</label>
                <div style={{ fontSize: 11.5, color: COLORS.slate, marginBottom: 6 }}>O EE fica identificado pelo código do aluno de quem é encarregado.</div>
                {listaCodigos("idsFilhos", "Código do educando", "Adicionar outro educando")}
              </>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: COLORS.ink2, marginTop: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form.semCodigo} onChange={(e) => setForm((f) => ({ ...f, semCodigo: e.target.checked }))} />
              Não é possível identificar pelo código do aluno
            </label>
            {form.semCodigo && (
              <>
                <label style={labelStyle}>Identificação</label>
                <input type="text" placeholder="Ex.: iniciais ou referência interna" value={form.personName} onChange={set("personName")} style={inputStyle} />
              </>
            )}
          </>
        ) : (
          <>
            <label style={labelStyle}>Nome</label>
            <input type="text" placeholder="Nome da pessoa envolvida" value={form.personName} onChange={set("personName")} style={inputStyle} />
          </>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={{ ...labelStyle }}>Escola (opcional)</label>
          <button type="button" onClick={() => onGerirLista("schools")} style={linkBtnStyle}>
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

        {form.personType !== "elemento_df" && (
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
                    color: form.sanctionApplied === opt.key ? COLORS.onAccent : COLORS.ink,
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
                  <button type="button" onClick={() => onGerirLista("sanctionTypes")} style={linkBtnStyle}>
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
              if (!podeGuardar) return;
              onSave({
                ...form,
                personName: eAtleta || familiaPorCodigo ? "" : form.personName.trim(),
                atletas: eAtleta ? nomesValidos : undefined,
                idsFilhos: familiaPorCodigo ? filhosValidos : undefined,
                semCodigo: eFamilia ? !!form.semCodigo : undefined,
                nAtletas: eAtleta ? nomesValidos.length : undefined,
                escalao: eAtleta ? form.escalao : undefined,
                id: inicial ? inicial.id : `s_${Date.now()}`,
                stage: form.personType === "elemento_df" ? (inicial && inicial.personType === "elemento_df" ? inicial.stage : "ocorrencia") : inicial ? inicial.stage ?? null : null,
                notes: inicial ? inicial.notes || [] : [],
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
export function SanctionDetail({ sanction, onClose, onUpdate, onAddNote, onRemove, complaints, sanctionTypes, onEdit }) {
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
      className="veil"
      style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }}
      onClick={onClose}
    >
      <div
        className="sheet"
        style={{ width: "min(540px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate, letterSpacing: "0.08em" }}>
            {fmt(new Date(sanction.date + "T00:00:00"))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {onEdit && (
              <button title="Editar" onClick={() => onEdit(sanction)} style={iconBtnStyle}>
                <Pencil size={16} />
              </button>
            )}
            <button title="Eliminar" onClick={() => onRemove(sanction.id)} style={iconBtnStyle}>
              <Trash2 size={16} color={COLORS.danger} />
            </button>
            <button onClick={onClose} style={iconBtnStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
        <h2 style={{ margin: "6px 0 6px", fontSize: 20, color: COLORS.navy }}>{nomeOcorrencia(sanction)}</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <Tag label={(PERSON_TYPE_META[sanction.personType] || PERSON_TYPE_META.familia).label} color={COLORS.navy} bg={COLORS.rule} />
          <Tag label={motivoMeta.label} color={motivoMeta.color} bg={motivoMeta.bg} />
          {sanction.school && <Tag label={sanction.school} color={COLORS.slate} bg={COLORS.doneBg} />}
          {sanction.personType === "atleta" && sanction.escalao && <Tag label={sanction.escalao} color={COLORS.slate} bg={COLORS.doneBg} />}
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

        {sanction.personType !== "elemento_df" ? (
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
                    color: sanction.sanctionApplied === opt.key ? COLORS.onAccent : COLORS.ink,
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
              <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>
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

// ---------- Sanções: página (lista + análise) ----------
export function SanctionsPage({ sanctions, onNew, onOpen }) {
  const familia = sanctions.filter((s) => s.personType === "familia");
  const elementosDF = sanctions.filter((s) => s.personType === "elemento_df");
  const atletas = sanctions.filter((s) => s.personType === "atleta");
  const nAtletasEnvolvidos = atletas.reduce((t, s) => t + (Number(s.nAtletas) || 1), 0);
  const sancoesAplicadasAtletas = atletas.filter((s) => s.sanctionApplied === true).length;

  const escalaoData = useMemo(() => {
    const counts = {};
    atletas.forEach((s) => {
      const k = s.escalao || "Sem escalão";
      counts[k] = (counts[k] || 0) + (Number(s.nAtletas) || 1);
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [atletas]);

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
    [...familia, ...atletas].forEach((s) => {
      if (s.sanctionApplied === true && s.sanctionType) counts[s.sanctionType] = (counts[s.sanctionType] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, color: colorForLabel(name).color }));
  }, [familia, atletas]);

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
        <div style={{ fontWeight: 600, fontSize: 14 }}>{nomeOcorrencia(s)}</div>
        <div style={{ fontSize: 12, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
          {fmt(new Date(s.date + "T00:00:00"))}
          {s.school ? ` · ${s.school}` : ""}
          {s.personType === "atleta" && s.escalao ? ` · ${s.escalao}` : ""}
          {s.relatedComplaintId ? " · associada a reclamação" : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Tag label={MOTIVO_META[s.motivo].label} color={MOTIVO_META[s.motivo].color} bg={MOTIVO_META[s.motivo].bg} />
        {s.personType !== "elemento_df" ? (
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
      <ComparacaoEpocas
        titulo="Comparação entre épocas"
        epocas={sanctions.map((x) => epocaDe(x.date))}
        metricas={[
          { key: "n", label: "Ocorrências", melhor: "baixo" },
          { key: "graves", label: "Ameaças e agressões", melhor: "baixo" },
          { key: "familia", label: "Com EE", melhor: "baixo" },
          { key: "atletas", label: "Atletas envolvidos", melhor: "baixo" },
          { key: "df", label: "Com elementos DF", melhor: "baixo" },
        ]}
        calcular={(ep, lim) => {
          const l = naEpoca(sanctions, "date", ep, lim);
          return {
            n: l.length,
            graves: l.filter((x) => x.motivo === "ameacas" || x.motivo === "agressao").length,
            familia: l.filter((x) => x.personType === "familia").length,
            atletas: l.filter((x) => x.personType === "atleta").reduce((t, x) => t + (Number(x.nAtletas) || 1), 0),
            df: l.filter((x) => x.personType === "elemento_df").length,
          };
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", flex: 1 }}>
          <StatCard label="Total de ocorrências" value={sanctions.length} />
          <StatCard label="Sanções aplicadas (EE)" value={sancoesAplicadasFamilia} color={COLORS.danger} />
          <StatCard label="Sem sanção (EE)" value={semSancaoFamilia} color={COLORS.ok} />
          <StatCard label="Suspensão/Expulsão (DF)" value={sancoesFinaisDF} color={COLORS.danger} />
          <StatCard
            label="Atletas envolvidos"
            value={nAtletasEnvolvidos}
            color={COLORS.warn}
            subtitle={atletas.length ? `${atletas.length} ocorrência${atletas.length === 1 ? "" : "s"} · ${sancoesAplicadasAtletas} com sanção` : undefined}
          />
        </div>
        <button
          onClick={onNew}
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
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={100} tick={<TickNome largura={100} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
              <Bar dataKey="value" fill={COLORS.navySoft} radius={[0, 3, 3, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tipoSancaoData.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 24 }}>
          <div style={panelTitle}>Sanções aplicadas por tipo (Pais / EE e atletas)</div>
          <ResponsiveContainer width="100%" height={Math.max(160, tipoSancaoData.length * 34)}>
            <BarChart data={tipoSancaoData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140} tick={<TickNome largura={140} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
              <Bar dataKey="value" fill={COLORS.danger} radius={[0, 3, 3, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {escalaoData.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 24 }}>
          <div style={panelTitle}>Atletas envolvidos por escalão</div>
          <ResponsiveContainer width="100%" height={Math.max(160, escalaoData.length * 34)}>
            <BarChart data={escalaoData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={<TickNome largura={120} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
              <Bar dataKey="value" fill={COLORS.warn} radius={[0, 3, 3, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={panelTitle}>Sanções a Pais / Encarregados de Educação</div>
      {familia.length === 0 ? (
        <div style={{ marginBottom: 26 }}>
          <Vazio icon={Scale} titulo="Sem ocorrências com pais ou encarregados" texto="As que registares aparecem aqui, com o motivo e a sanção aplicada." />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {[...familia].sort((a, b) => new Date(b.date) - new Date(a.date)).map((s) => <Row key={s.id} s={s} />)}
        </div>
      )}

      <div style={panelTitle}>Atletas</div>
      {atletas.length === 0 ? (
        <div style={{ marginBottom: 26 }}>
          <Vazio icon={Users} titulo="Sem ocorrências com atletas" texto="Regista um ou vários atletas na mesma ocorrência, com o nome e o escalão." />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
          {[...atletas].sort((a, b) => new Date(b.date) - new Date(a.date)).map((s) => <Row key={s.id} s={s} />)}
        </div>
      )}

      <div style={panelTitle}>Elementos Dragon Force (processo disciplinar)</div>
      {elementosDF.length === 0 ? (
        <Vazio icon={ShieldAlert} titulo="Sem ocorrências com elementos Dragon Force" texto="Aqui acompanhas o processo disciplinar: inquérito, proposta e decisão." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...elementosDF].sort((a, b) => new Date(b.date) - new Date(a.date)).map((s) => <Row key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}
