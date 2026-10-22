// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import { useState } from "react";
import { riscosParaOcorrencia } from "../riscos";
import { Plus, X, AlertTriangle, Sparkles } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { COLORS, StatCard, Vazio, epocaDe, fmt, iconBtnStyle, inputStyle, isoDe, labelStyle, linkBtnStyle, normChave, panelStyle, panelTitle, primaryBtnStyle, secondaryBtnStyle } from "../nucleo.jsx";
import { DicaGrafico, FiltroEpocas, MESES_EPOCA, MES_CURTO, fmtNum, naSelecao, selecaoInicial, textoSelecao } from "../partilhado.jsx";

const GRAVIDADE_OC = {
  baixa: { label: "Baixa", color: "#4B6B2F", bg: "#E6F0DA" },
  media: { label: "Média", color: "#8A6100", bg: "#FFF1C2" },
  alta: { label: "Alta", color: "#A6470B", bg: "#FBE2CF" },
};
const novoIdOc = () => `oc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

function OcorrenciaForm({ inicial, escolas, categorias, riscosDaEpoca, onGuardar, onApagar, onFechar, onGerirLista }) {
  const [o, setO] = useState(() => ({ ...inicial, afetouAtividade: inicial.afetouAtividade ?? (Number(inicial.treinosSuspensos) > 0 || Number(inicial.alunosAfetados) > 0) }));
  const muda = (k, v) => setO((x) => ({ ...x, [k]: v }));
  const itensRisco = riscosDaEpoca(epocaDe(o.data || isoDe(new Date())));
  const sugeridos = itensRisco.length ? riscosParaOcorrencia(o, itensRisco) : [];
  const ligados = o.riscos || [];
  const alternaRisco = (id) => muda("riscos", ligados.includes(id) ? ligados.filter((x) => x !== id) : [...ligados, id]);
  const valido = String(o.titulo || "").trim() && o.data;
  const lbl = { ...labelStyle, marginTop: 0 };
  const listaCat = [...new Set([...categorias, o.categoria].filter(Boolean))];
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(760px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 19, color: COLORS.navy, flex: 1 }}>{inicial.__novo ? "Nova ocorrência" : "Ocorrência"}</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <div>
            <label style={lbl}>Data</label>
            <input type="date" value={o.data || ""} onChange={(e) => muda("data", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Escola</label>
            <select value={o.escola || ""} onChange={(e) => muda("escola", e.target.value)} style={inputStyle}>
              <option value="">Geral / várias escolas</option>
              {[...new Set([...escolas, o.escola].filter(Boolean))].map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={lbl}>Categoria</label>
              <button type="button" onClick={() => onGerirLista("categoriasOcorrencia")} style={{ ...linkBtnStyle, marginTop: 0 }}>
                Gerir
              </button>
            </div>
            <select value={o.categoria || ""} onChange={(e) => muda("categoria", e.target.value)} style={inputStyle}>
              <option value="">Escolher…</option>
              {listaCat.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Gravidade</label>
            <div style={{ display: "flex", gap: 4 }}>
              {Object.entries(GRAVIDADE_OC).map(([k, g]) => (
                <button key={k} type="button" onClick={() => muda("gravidade", k)} style={{ flex: 1, border: `1.5px solid ${o.gravidade === k ? g.color : COLORS.rule}`, background: o.gravidade === k ? g.bg : "transparent", color: o.gravidade === k ? g.color : COLORS.ink2, borderRadius: 7, padding: "7px 4px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={lbl}>O que aconteceu</label>
          <input value={o.titulo || ""} onChange={(e) => muda("titulo", e.target.value)} placeholder="Ex: Parceiro não fez a manutenção do relvado prevista no contrato" style={inputStyle} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={lbl}>Descrição</label>
          <textarea rows={3} value={o.descricao || ""} onChange={(e) => muda("descricao", e.target.value)} placeholder="Contexto, causa e o que se observou." style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px" }}>Impacto</div>
        <input value={o.impacto || ""} onChange={(e) => muda("impacto", e.target.value)} placeholder="Ex: obras atrasadas, custos, evento adiado, imagem junto dos encarregados" style={inputStyle} />
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!o.afetouAtividade}
              onChange={(e) => setO((x) => ({ ...x, afetouAtividade: e.target.checked, ...(e.target.checked ? {} : { treinosSuspensos: "", alunosAfetados: "" }) }))}
            />
            Afetou treinos ou atividades
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={!!o.comunicadoEE} onChange={(e) => muda("comunicadoEE", e.target.checked)} />
            Comunicado aos encarregados
          </label>
        </div>
        {o.afetouAtividade && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 220px))", gap: 10, marginTop: 10 }}>
            <div>
              <label style={lbl}>Treinos suspensos</label>
              <input type="number" min="0" value={o.treinosSuspensos ?? ""} onChange={(e) => muda("treinosSuspensos", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} style={inputStyle} />
            </div>
            <div>
              <label style={lbl}>Alunos afetados</label>
              <input type="number" min="0" value={o.alunosAfetados ?? ""} onChange={(e) => muda("alunosAfetados", e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} style={inputStyle} />
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px" }}>Resposta</div>
        <div>
          <label style={lbl}>Ação tomada</label>
          <textarea rows={2} value={o.acao || ""} onChange={(e) => muda("acao", e.target.value)} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 10, alignItems: "end" }}>
          <div>
            <label style={lbl}>Responsável</label>
            <input value={o.responsavel || ""} onChange={(e) => muda("responsavel", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Estado</label>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                ["aberta", "Aberta"],
                ["resolvida", "Resolvida"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setO((x) => ({ ...x, estado: k, resolvidaEm: k === "resolvida" ? x.resolvidaEm || isoDe(new Date()) : null }))}
                  style={{ flex: 1, border: `1.5px solid ${o.estado === k ? COLORS.navy : COLORS.rule}`, background: o.estado === k ? COLORS.navyWash : "transparent", color: o.estado === k ? COLORS.navySoft : COLORS.ink2, borderRadius: 7, padding: "7px 4px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          {o.estado === "resolvida" && (
            <div>
              <label style={lbl}>Resolvida a</label>
              <input type="date" value={o.resolvidaEm || ""} onChange={(e) => muda("resolvidaEm", e.target.value)} style={inputStyle} />
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, color: COLORS.ink2, margin: "16px 0 0", padding: "8px 10px", borderRadius: 8, background: COLORS.paperSunken, lineHeight: 1.5 }}>
          Ao guardar, a app usa esta ocorrência para propor riscos e oportunidades novos em <strong>Riscos e oportunidades</strong> ({epocaDe(o.data || isoDe(new Date()))}). Escrever a <strong>ação tomada</strong> e marcar como resolvida ajuda a propor oportunidades de melhoria.
        </div>
        {itensRisco.length > 0 && (
          <details style={{ marginTop: 10 }} open={ligados.length > 0}>
            <summary style={{ cursor: "pointer", fontSize: 12.5, color: COLORS.ink2 }}>Já está prevista num risco da lista? (opcional){ligados.length ? ` · ligada a ${ligados.length}` : ""}</summary>
            <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[...new Set([...ligados, ...sugeridos])].map((id) => {
                const it = itensRisco.find((i) => i.id === id);
                if (!it) return null;
                const on = ligados.includes(id);
                return (
                  <button key={id} type="button" onClick={() => alternaRisco(id)} title={it.identificacao} style={{ border: `1px solid ${on ? COLORS.navy : COLORS.rule}`, background: on ? COLORS.navy : COLORS.paperRaised, color: on ? "#fff" : COLORS.ink, borderRadius: 7, padding: "5px 10px", fontSize: 12.5, cursor: "pointer", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {on ? "✓ " : "+ "}Nº {it.n} · {it.identificacao}
                  </button>
                );
              })}
              <select value="" onChange={(e) => e.target.value && alternaRisco(e.target.value)} style={{ ...inputStyle, width: 200, padding: "5px 8px", fontSize: 12.5 }} aria-label="Ligar a outro risco">
                <option value="">Ligar a outro…</option>
                {itensRisco
                  .filter((i) => !ligados.includes(i.id))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      Nº {i.n} · {String(i.identificacao).slice(0, 60)}
                    </option>
                  ))}
              </select>
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>Liga só se a ocorrência concretiza um risco que já existe: deixa de ser proposta como risco novo e passa a contar para a possibilidade de ocorrência desse risco.</div>
            </div>
          </details>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center" }}>
          {!inicial.__novo && (
            <button onClick={() => onApagar(o.id)} style={{ ...linkBtnStyle, marginTop: 0, color: COLORS.danger, fontSize: 13 }}>
              Apagar
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}>
            Cancelar
          </button>
          <button
            disabled={!valido}
            onClick={() => {
              const { __novo, ...limpo } = o;
              onGuardar({ ...limpo, titulo: limpo.titulo.trim(), epoca: epocaDe(limpo.data) });
            }}
            style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 18px", opacity: valido ? 1 : 0.5 }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export function OcorrenciasPage({ ocorrencias, escolas, categorias, riscosDaEpoca, onSave, onRemove, onGerirLista, irParaRiscos, propostas = [], epPropostas, notificar }) {
  const geraProposta = new Set(propostas.flatMap((d) => d.ocorrIds || []));
  const propR = propostas.filter((d) => d.tipo !== "O");
  const propO = propostas.filter((d) => d.tipo === "O");
  const epocasOc = [...new Set(ocorrencias.map((o) => epocaDe(o.data)).filter(Boolean))];
  const [eps, setEps] = useState(() => selecaoInicial(epocasOc));
  const [fEsc, setFEsc] = useState("todas");
  const [fCat, setFCat] = useState("todas");
  const [fEstado, setFEstado] = useState("todos");
  const [texto, setTexto] = useState("");
  const [editar, setEditar] = useState(null);

  const daSelecao = ocorrencias.filter((o) => naSelecao(eps, epocaDe(o.data)));
  const lista = daSelecao
    .filter((o) => fEsc === "todas" || (fEsc === "__geral" ? !o.escola : o.escola === fEsc))
    .filter((o) => fCat === "todas" || o.categoria === fCat)
    .filter((o) => fEstado === "todos" || (o.estado || "aberta") === fEstado)
    .filter((o) => !texto.trim() || normChave([o.titulo, o.descricao, o.acao, o.categoria, o.escola].join(" ")).includes(normChave(texto)))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const abertas = lista.filter((o) => (o.estado || "aberta") === "aberta");
  const treinos = lista.reduce((t, o) => t + (Number(o.treinosSuspensos) || 0), 0);
  const alunos = lista.reduce((t, o) => t + (Number(o.alunosAfetados) || 0), 0);
  const altas = lista.filter((o) => o.gravidade === "alta").length;
  const porCat = Object.entries(lista.reduce((m, o) => ((m[o.categoria || "Sem categoria"] = (m[o.categoria || "Sem categoria"] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const porMes = MESES_EPOCA.map((m) => ({ name: MES_CURTO[m], Ocorrências: lista.filter((o) => Number(String(o.data).slice(5, 7)) - 1 === m).length })).filter((x, i, arr) => arr.slice(i).some((y) => y.Ocorrências) || arr.slice(0, i + 1).some((y) => y.Ocorrências));
  const novo = (base = {}) => setEditar({ __novo: true, id: novoIdOc(), data: isoDe(new Date()), escola: "", categoria: "", gravidade: "media", titulo: "", descricao: "", treinosSuspensos: "", alunosAfetados: "", impacto: "", acao: "", responsavel: "", estado: "aberta", resolvidaEm: null, comunicadoEE: false, riscos: [], ...base });
  const fmtData = (d) => (d ? fmt(new Date(String(d).slice(0, 10) + "T00:00:00")) : "—");
  const nomeRisco = (o) => {
    const itens = riscosDaEpoca(epocaDe(o.data));
    return (o.riscos || []).map((id) => itens.find((i) => i.id === id)).filter(Boolean);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <FiltroEpocas compacto epocas={epocasOc} valor={eps} onChange={setEps} />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Procurar" style={{ ...inputStyle, width: 170, padding: "6px 10px", fontSize: 13 }} />
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={{ ...inputStyle, width: "auto", maxWidth: 220, padding: "6px 10px", fontSize: 13 }}>
          <option value="todas">Todas as escolas</option>
          <option value="__geral">Geral / várias</option>
          {escolas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} style={{ ...inputStyle, width: "auto", maxWidth: 220, padding: "6px 10px", fontSize: 13 }}>
          <option value="todas">Todas as categorias</option>
          {[...new Set([...categorias, ...ocorrencias.map((o) => o.categoria).filter(Boolean)])].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 }}>
          <option value="todos">Abertas e resolvidas</option>
          <option value="aberta">Só abertas</option>
          <option value="resolvida">Só resolvidas</option>
        </select>
        <span style={{ flex: 1 }} />
        <button className="press" onClick={() => novo()} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nova ocorrência
        </button>
      </div>

      {propostas.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 14, borderColor: COLORS.warn, background: COLORS.warnBg, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Sparkles size={17} color={COLORS.warn} style={{ marginTop: 2 }} />
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              As ocorrências de {epPropostas} sugerem {propR.length ? `${propR.length} ${propR.length === 1 ? "risco novo" : "riscos novos"}` : ""}
              {propR.length && propO.length ? " e " : ""}
              {propO.length ? `${propO.length} ${propO.length === 1 ? "oportunidade nova" : "oportunidades novas"}` : ""}
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 4, lineHeight: 1.6 }}>
              {propostas.slice(0, 6).map((d) => (
                <div key={d.id}>
                  <strong style={{ fontWeight: 600, color: d.tipo === "O" ? "#1F5E78" : "#8A4A12" }}>{d.tipo === "O" ? "Oportunidade" : "Risco"}:</strong> {d.titulo}
                </div>
              ))}
              {propostas.length > 6 && <div>e mais {propostas.length - 6}</div>}
            </div>
          </div>
          <button onClick={irParaRiscos} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "8px 14px", fontSize: 13 }}>
            Rever e adicionar
          </button>
        </div>
      )}

      {ocorrencias.length === 0 ? (
        <Vazio
          icon={AlertTriangle}
          titulo="Ainda sem ocorrências"
          texto="Regista aqui o que não é reclamação nem sanção mas importa: treinos suspensos pelo clima, avarias, questões com o clube parceiro, comportamentos, acidentes. Estes registos alimentam os riscos e oportunidades."
          acao="Registar a primeira"
          onAcao={() => novo()}
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <StatCard label="Ocorrências" value={lista.length} subtitle={textoSelecao(eps).toLowerCase()} />
            <StatCard label="Abertas" value={abertas.length} color={abertas.length ? COLORS.warn : undefined} />
            <StatCard label="Gravidade alta" value={altas} color={altas ? COLORS.danger : undefined} />
            {treinos > 0 ? (
              <StatCard label="Treinos suspensos" value={treinos} subtitle={alunos ? `${fmtNum(alunos)} alunos afetados` : "nas ocorrências que afetaram a atividade"} />
            ) : (
              <StatCard label="Resolvidas" value={lista.length - abertas.length} color={COLORS.ok} />
            )}
          </div>

          {lista.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginBottom: 14 }}>
              <div style={{ ...panelStyle, marginBottom: 0 }}>
                <div style={panelTitle}>Por categoria</div>
                <div style={{ display: "grid", gap: 7 }}>
                  {porCat.map(([c, n]) => (
                    <button key={c} type="button" onClick={() => setFCat(fCat === c ? "todas" : c)} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 120px 28px", gap: 10, alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontSize: 12.5, color: COLORS.ink, fontFamily: "inherit" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: fCat === c ? 700 : 400 }}>{c}</span>
                      <span style={{ height: 7, background: COLORS.paperSunken, borderRadius: 4, overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${(n / porCat[0][1]) * 100}%`, background: COLORS.navy, borderRadius: 4 }} />
                      </span>
                      <span style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{n}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ ...panelStyle, marginBottom: 0 }}>
                <div style={panelTitle}>Por mês</div>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={porMes} margin={{ left: -22, right: 6, top: 6 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                    <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.paperSunken }} />
                    <Bar dataKey="Ocorrências" fill={COLORS.navy} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div style={panelStyle}>
            {lista.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.slate, padding: 8 }}>Nada com estes filtros.</div>
            ) : (
              <div style={{ display: "grid" }}>
                {lista.map((o, i) => {
                  const g = GRAVIDADE_OC[o.gravidade] || GRAVIDADE_OC.media;
                  const aberta = (o.estado || "aberta") === "aberta";
                  const rs = nomeRisco(o);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setEditar(o)}
                      className="rowHover"
                      style={{ display: "grid", gridTemplateColumns: "88px minmax(0, 1fr) auto", gap: 12, alignItems: "start", padding: "11px 8px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", background: "transparent", border: "none", borderRadius: 0, cursor: "pointer", textAlign: "left", color: COLORS.ink, fontFamily: "inherit", width: "100%" }}
                    >
                      <span style={{ fontSize: 12, color: COLORS.slate, fontVariantNumeric: "tabular-nums", paddingTop: 2 }}>{fmtData(o.data)}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{o.titulo}</span>
                        <span style={{ display: "block", fontSize: 12, color: COLORS.slate, marginTop: 2 }}>
                          {[o.categoria, o.escola ? o.escola.replace(/^Dragon Force\s+/, "") : "Geral", o.treinosSuspensos ? `${o.treinosSuspensos} treinos suspensos` : null, o.alunosAfetados ? `${o.alunosAfetados} alunos` : null, rs.length ? `risco Nº ${rs.map((r) => r.n).join(", ")}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {geraProposta.has(o.id) && <span title="Esta ocorrência gerou uma proposta de risco ou oportunidade" style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5, color: COLORS.warn, border: `1px solid ${COLORS.warn}` }}>proposta</span>}
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5, color: g.color, background: g.bg }}>{g.label}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: aberta ? COLORS.warn : COLORS.ok }}>{aberta ? "Aberta" : "Resolvida"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 8 }}>
            As ocorrências entram nos avisos de{" "}
            <button onClick={irParaRiscos} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 11.5 }}>
              Riscos e oportunidades
            </button>
            : cada ocorrência pode dar origem a um risco novo (se o tema não estiver na lista) e a uma oportunidade de melhoria (por exemplo, passar a procedimento uma resposta que resultou).
          </div>
        </>
      )}

      {editar && (
        <OcorrenciaForm
          inicial={editar}
          escolas={escolas}
          categorias={categorias}
          riscosDaEpoca={riscosDaEpoca}
          onGerirLista={onGerirLista}
          onFechar={() => setEditar(null)}
          onApagar={(id) => {
            if (!window.confirm("Apagar esta ocorrência?")) return;
            onRemove(id);
            setEditar(null);
          }}
          onGuardar={(o) => {
            onSave(o);
            setEditar(null);
            notificar(editar.__novo ? "Ocorrência registada." : "Ocorrência atualizada.");
          }}
        />
      )}
    </div>
  );
}
