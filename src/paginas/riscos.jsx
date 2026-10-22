// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { lerRiscosDoExcel, gerarExcelRiscos, nivelRisco, faixaRisco, aceitacaoSugerida, ACEITACAO, PO_ROTULOS, GR_ROTULOS, PO_DESCRICAO, GR_DESCRICAO, PROCESSOS_PADRAO, DETETORES, codigoProcesso, folhaDaEpoca } from "../riscos";
import { Plus, X, Check, Search, ShieldAlert, Mail, Sparkles, FileText, Printer } from "lucide-react";
import { COLORS, StatCard, Vazio, epocaDe, fmt, iconBtnStyle, inputStyle, isoDe, labelStyle, linkBtnStyle, normChave, panelStyle, panelTitle, primaryBtnStyle, secondaryBtnStyle } from "../nucleo.jsx";
import { Filtros, lerExcelInq, tdStyle, thStyle } from "../partilhado.jsx";

// ---------- Riscos e oportunidades (DFF.151.01) ----------
// ======================================================================
// A tabela do documento "Pensamento baseado no risco e oportunidades", por época,
// editável na app, ligada ao que os dados mostram (auditorias, reclamações, sanções,
// desistências, eventos e inscritos) e exportável para Excel no mesmo formato.

const RISCO_COR = {
  baixo: { fg: "#2F6B1F", bg: "#E3EFD3" },
  medio: { fg: "#7A5A00", bg: "#FFF6BF" },
  alto: { fg: "#A6470B", bg: "#FBE2CF" },
};
const ESTADOS_RISCO = ["Em análise", "Em implementação", "Implementação contínua", "Concluída"];
const epocaSeguinte = (ep) => `${Number(ep.slice(0, 4)) + 1}/${String(Number(ep.slice(0, 4)) + 2).slice(2)}`;
const novoIdRisco = () => `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function ChipNivel({ it }) {
  if (it.tipo === "O") return <span style={{ fontSize: 11.5, color: COLORS.slate }}>—</span>;
  const nr = nivelRisco(it);
  if (nr === null) return <span style={{ fontSize: 11.5, color: COLORS.warn }}>por avaliar</span>;
  const c = RISCO_COR[faixaRisco(nr)];
  return (
    <span style={{ display: "inline-block", minWidth: 26, textAlign: "center", padding: "2px 7px", borderRadius: 6, fontWeight: 700, fontSize: 12.5, color: c.fg, background: c.bg, fontVariantNumeric: "tabular-nums" }} title={`PO ${it.po} × GR ${it.gr}`}>
      {nr}
    </span>
  );
}

function TipoRisco({ tipo }) {
  const o = tipo === "O";
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", padding: "2px 6px", borderRadius: 5, color: o ? "#1F5E78" : "#8A4A12", background: o ? "#DBEEF4" : "#FDEADA" }} title={o ? "Oportunidade" : "Risco"}>
      {o ? "O" : "R"}
    </span>
  );
}

function EditorRisco({ inicial, processos, responsaveis, deteccoes, ocorrenciasLigadas = [], onGuardar, onApagar, onFechar }) {
  const [it, setIt] = useState(() => ({ ...inicial }));
  const muda = (k, v) => setIt((x) => ({ ...x, [k]: v }));
  const [estadoLivre, setEstadoLivre] = useState(false);
  const nr = nivelRisco(it);
  const sug = aceitacaoSugerida(nr);
  const minhas = deteccoes.filter((d) => d.cobertoPor.includes(it.id) || (it.detetores || []).includes(d.id));
  const poSug = Math.max(0, ...minhas.filter((d) => d.po).map((d) => d.po));
  const prov = String(it.proveniencia || "");
  const temProv = (k) => new RegExp(`\\b${k}\\b`).test(prov);
  const alternaProv = (k) => {
    const l = ["QI", "QE", "PI"].filter((x) => (x === k ? !temProv(x) : temProv(x)));
    muda("proveniencia", l.join(" / "));
  };
  const area = (k, rotulo, linhas = 3) => (
    <div>
      <label style={{ ...labelStyle, marginTop: 0 }}>{rotulo}</label>
      <textarea rows={linhas} value={it[k] || ""} onChange={(e) => muda(k, e.target.value)} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
    </div>
  );
  const campo = (k, rotulo, extra = {}) => (
    <div>
      <label style={{ ...labelStyle, marginTop: 0 }}>{rotulo}</label>
      <input value={it[k] ?? ""} onChange={(e) => muda(k, e.target.value)} list={extra.list} style={inputStyle} />
    </div>
  );
  const valido = String(it.identificacao || "").trim();
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(860px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 19, color: COLORS.navy, flex: 1 }}>{inicial.__novo ? "Novo risco ou oportunidade" : `Nº ${it.n}`}</h2>
          <div style={{ display: "inline-flex", gap: 3, background: COLORS.segTrack, borderRadius: 8, padding: 2 }}>
            {[
              ["R", "Risco"],
              ["O", "Oportunidade"],
            ].map(([k, l]) => (
              <button key={k} type="button" onClick={() => muda("tipo", k)} style={{ border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", background: it.tipo === k ? COLORS.paperRaised : "transparent", fontWeight: it.tipo === k ? 600 : 500, color: it.tipo === k ? COLORS.ink : COLORS.ink2 }}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {ocorrenciasLigadas.length > 0 && (
          <div style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.rule}`, marginBottom: 10, fontSize: 12.5, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Ocorrências ligadas a este {it.tipo === "O" ? "item" : "risco"} ({ocorrenciasLigadas.length})</div>
            {ocorrenciasLigadas
              .slice()
              .sort((a, b) => String(b.data).localeCompare(String(a.data)))
              .slice(0, 8)
              .map((o) => (
                <div key={o.id} style={{ color: COLORS.ink2 }}>
                  {String(o.data).slice(0, 10)} · {o.titulo}
                  {o.escola ? ` · ${o.escola.replace(/^Dragon Force\s+/, "")}` : ""}
                  {o.treinosSuspensos ? ` · ${o.treinosSuspensos} treinos suspensos` : ""}
                </div>
              ))}
          </div>
        )}
        {minhas.length > 0 && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: COLORS.paperSunken, marginBottom: 14, fontSize: 12.5, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>O que os dados desta época mostram</div>
            {minhas.map((d) => (
              <div key={d.id} style={{ marginBottom: 6 }}>
                <span style={{ color: COLORS.ink }}>{d.detalhe}</span>
                {d.evidencias.length > 0 && (
                  <details style={{ marginTop: 2 }}>
                    <summary style={{ cursor: "pointer", color: COLORS.ink2, fontSize: 12 }}>Ver exemplos</summary>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18, color: COLORS.ink2, fontSize: 12 }}>
                      {d.evidencias.slice(0, 8).map((e, i) => (
                        <li key={i}>
                          {e.origem}: {e.texto}
                          {e.escola ? ` · ${e.escola.replace(/^Dragon Force\s+/, "")}` : ""}
                          {e.data ? ` · ${String(e.data).slice(0, 10)}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
            {it.tipo !== "O" && poSug > (Number(it.po) || 0) && (
              <div style={{ color: COLORS.warn, fontWeight: 600 }}>
                Pela frequência nos dados, a possibilidade de ocorrência parece {poSug} ({PO_ROTULOS[poSug]}); está {it.po || "por avaliar"}.{" "}
                <button onClick={() => muda("po", poSug)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
                  Usar {poSug}
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 10 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Nº</label>
            <input type="number" min="1" value={it.n ?? ""} onChange={(e) => muda("n", Number(e.target.value) || "")} style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Processo</label>
            <input value={it.processo || ""} onChange={(e) => muda("processo", e.target.value)} list="riscos-processos" style={inputStyle} />
            <datalist id="riscos-processos">
              {processos.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 10 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Proveniência</label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {[
                ["QI", "Questões internas"],
                ["QE", "Questões externas"],
                ["PI", "Partes interessadas"],
              ].map(([k, l]) => (
                <button key={k} type="button" onClick={() => alternaProv(k)} title={l} style={{ border: `1px solid ${temProv(k) ? COLORS.navy : COLORS.rule}`, background: temProv(k) ? COLORS.navy : COLORS.paperRaised, color: temProv(k) ? "#fff" : COLORS.ink, borderRadius: 7, padding: "5px 10px", fontSize: 12.5, cursor: "pointer" }}>
                  {k}
                </button>
              ))}
            </div>
          </div>
          {campo("objetivo", "Objetivo estratégico associado (PI)")}
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {area("identificacao", it.tipo === "O" ? "Identificação da oportunidade" : "Identificação do risco", 2)}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
            {area("causa", "Descrição da causa")}
            {area("impacto", "Descrição do impacto")}
          </div>
        </div>

        {it.tipo !== "O" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 10, alignItems: "end" }}>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Possibilidade de ocorrência</label>
              <select value={it.po || ""} onChange={(e) => muda("po", Number(e.target.value) || null)} style={inputStyle} title={it.po ? PO_DESCRICAO[it.po] : ""}>
                <option value="">Por avaliar</option>
                {[1, 2, 3, 4].map((k) => (
                  <option key={k} value={k}>
                    {k} · {PO_ROTULOS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Gravidade</label>
              <select value={it.gr || ""} onChange={(e) => muda("gr", Number(e.target.value) || null)} style={inputStyle} title={it.gr ? GR_DESCRICAO[it.gr] : ""}>
                <option value="">Por avaliar</option>
                {[1, 2, 3, 4].map((k) => (
                  <option key={k} value={k}>
                    {k} · {GR_ROTULOS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Nível de risco</label>
              <div style={{ padding: "8px 0" }}>
                <ChipNivel it={it} />
                {nr !== null && <span style={{ fontSize: 12, color: COLORS.slate, marginLeft: 8 }}>{ACEITACAO[sug]}</span>}
              </div>
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Aceitação do risco</label>
              <select value={it.aceitacao || ""} onChange={(e) => muda("aceitacao", e.target.value)} style={inputStyle}>
                <option value="">—</option>
                {[...new Set(["A", "AM", "NA", it.aceitacao].filter(Boolean))].map((k) => (
                  <option key={k} value={k}>
                    {k}
                    {ACEITACAO[k] ? ` · ${ACEITACAO[k]}` : ""}
                  </option>
                ))}
              </select>
              {sug && it.aceitacao && it.aceitacao !== sug && ACEITACAO[it.aceitacao] && (
                <button onClick={() => muda("aceitacao", sug)} style={{ ...linkBtnStyle, marginTop: 3, fontSize: 11.5, color: COLORS.warn }}>
                  Pelo nível devia ser {sug}
                </button>
              )}
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 8px" }}>Plano de ações</div>
        {area("acao", it.tipo === "O" ? "Ação para aproveitar a oportunidade" : "Tratamento do risco (ação corretiva, preventiva, medida de mitigação)")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 10 }}>
          {campo("responsavel", "Responsável", { list: "riscos-responsaveis" })}
          <datalist id="riscos-responsaveis">
            {responsaveis.map((r) => (
              <option key={r.sigla} value={r.sigla}>
                {r.nome}
              </option>
            ))}
          </datalist>
          {campo("data", "Data")}
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Estado</label>
            {estadoLivre ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input autoFocus value={it.estado ?? ""} onChange={(e) => muda("estado", e.target.value)} placeholder="Escreve o estado" style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => setEstadoLivre(false)} title="Voltar à lista" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 10px", fontSize: 12 }}>
                  Lista
                </button>
              </div>
            ) : (
              <select
                value={it.estado || ""}
                onChange={(e) => {
                  if (e.target.value === "__outro") {
                    setEstadoLivre(true);
                    muda("estado", "");
                  } else muda("estado", e.target.value);
                }}
                style={inputStyle}
              >
                <option value="">—</option>
                {[...new Set([...ESTADOS_RISCO, it.estado].filter(Boolean))].map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
                <option value="__outro">Outro (escrever)…</option>
              </select>
            )}
          </div>
        </div>
        <div style={{ marginTop: 10 }}>{area("observacoes", "Observações", 2)}</div>

        {it.reavaliacao && (
          <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 10 }}>
            Reavaliação (formato antigo): PO {it.reavaliacao.po || "—"} · GR {it.reavaliacao.gr || "—"} · eficácia {it.reavaliacao.eficacia || "—"}
            {it.reavaliacao.data ? ` · ${it.reavaliacao.data}` : ""}
          </div>
        )}

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 12.5, color: COLORS.ink2 }}>Ligar a temas que a app deteta nos dados</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 4, marginTop: 8 }}>
            {DETETORES.filter((d) => d.tipo === (it.tipo || "R")).map((d) => {
              const on = (it.detetores || []).includes(d.id);
              return (
                <label key={d.id} style={{ display: "flex", gap: 7, alignItems: "flex-start", fontSize: 12.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={on} onChange={() => muda("detetores", on ? (it.detetores || []).filter((x) => x !== d.id) : [...(it.detetores || []), d.id])} style={{ marginTop: 2 }} />
                  {d.titulo}
                </label>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>Assim os avisos deixam de aparecer para esse tema e os dados passam a acompanhar este risco.</div>
        </details>

        <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
          {!inicial.__novo && onApagar && (
            <button onClick={() => onApagar(it.id)} style={{ ...linkBtnStyle, marginTop: 0, color: COLORS.danger, fontSize: 13 }}>
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
              const { __novo, ...limpo } = it;
              if (limpo.tipo === "O") {
                limpo.po = null;
                limpo.gr = null;
                limpo.aceitacao = "";
              }
              onGuardar(limpo);
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

function MatrizRiscos({ itens, filtro, onFiltro }) {
  const conta = {};
  itens.filter((i) => i.tipo !== "O" && i.po && i.gr).forEach((i) => (conta[`${i.po}|${i.gr}`] = (conta[`${i.po}|${i.gr}`] || 0) + 1));
  const cel = { width: 44, height: 34, display: "grid", placeItems: "center", borderRadius: 6, fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ display: "inline-grid", gridTemplateColumns: "auto repeat(4, 44px)", gap: 4, alignItems: "center" }}>
      <span />
      {[1, 2, 3, 4].map((g) => (
        <span key={g} style={{ fontSize: 10.5, color: COLORS.slate, textAlign: "center" }} title={GR_ROTULOS[g]}>
          GR {g}
        </span>
      ))}
      {[4, 3, 2, 1].map((po) => [
        <span key={`l${po}`} style={{ fontSize: 10.5, color: COLORS.slate, paddingRight: 6, textAlign: "right" }} title={PO_ROTULOS[po]}>
          PO {po}
        </span>,
        ...[1, 2, 3, 4].map((gr) => {
          const n = conta[`${po}|${gr}`] || 0;
          const c = RISCO_COR[faixaRisco(po * gr)];
          const sel = filtro === `${po}|${gr}`;
          return (
            <button
              key={`${po}${gr}`}
              type="button"
              onClick={() => onFiltro(sel ? null : `${po}|${gr}`)}
              title={`PO ${po} × GR ${gr} = ${po * gr}`}
              style={{ ...cel, border: sel ? `2px solid ${COLORS.navy}` : "1px solid transparent", background: c.bg, color: n ? c.fg : `${c.fg}55`, cursor: n ? "pointer" : "default" }}
              disabled={!n}
            >
              {n || "·"}
            </button>
          );
        }),
      ])}
    </div>
  );
}

// Radar de oportunidades: o que acontece lá fora (IA, tecnologia desportiva, normas,
// financiamento, contexto escolar) e pode ser oportunidade para a Dragon Force.
// A lista vem de pesquisa periódica (com fontes) e fica em reclamacoes:radar.
// Fontes que o agente usa: as base (oficiais), as que aprendeu com o que aceitas/rejeitas e as que está a testar.
const FONTE_ROTULO = { base: "Oficial", aprendida: "Aprendida", fixa: "Fixada por ti", experiencia: "Em teste", vista: "Vista", evitar: "A evitar", descartada: "Descartada", removida: "Removida por ti" };
const FONTE_GRUPOS = [
  { titulo: "Em uso", estados: ["fixa", "aprendida", "base"] },
  { titulo: "Em teste", estados: ["experiencia"] },
  { titulo: "Fora das pesquisas", estados: ["removida", "evitar", "descartada"] },
];
function FontesDoAgente({ fontes = {}, escolhas = {}, onDefinir }) {
  const [novo, setNovo] = useState("");
  const [verVistas, setVerVistas] = useState(false);
  const lista = [
    ...Object.entries(fontes).map(([d, f]) => ({ dominio: d, ...f })),
    ...Object.keys(escolhas).filter((d) => !fontes[d]).map((d) => ({ dominio: d, categorias: [], estado: "vista" })),
  ].map((f) => ({ ...f, efetivo: escolhas[f.dominio] || f.estado || "vista" }));
  const ordem = (a, b) => (b.aceites || 0) - (a.aceites || 0) || a.dominio.localeCompare(b.dominio);
  const adicionar = () => {
    const d = novo.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return;
    onDefinir(d, "fixa");
    setNovo("");
  };
  const linha = (f) => {
    const contas = [f.aceites ? `${f.aceites} aceite${f.aceites === 1 ? "" : "s"}` : "", f.rejeitadas ? `${f.rejeitadas} rejeitada${f.rejeitadas === 1 ? "" : "s"}` : "", f.testes ? `testada ${f.testes}× · ${f.bons || 0} com sugestões` : ""].filter(Boolean).join(" · ");
    return (
      <div key={f.dominio} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "5px 0", borderBottom: `1px solid ${COLORS.rule}` }}>
        <a href={`https://${f.dominio}`} target="_blank" rel="noreferrer" style={{ color: COLORS.navySoft, fontSize: 12.5, fontWeight: 600 }}>{f.dominio}</a>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: f.efetivo === "fixa" || f.efetivo === "aprendida" ? COLORS.ok : f.efetivo === "experiencia" ? COLORS.warn : COLORS.slate }}>{FONTE_ROTULO[f.efetivo] || f.efetivo}</span>
        {(f.categorias || []).length > 0 && <span style={{ fontSize: 11, color: COLORS.slate }}>{f.categorias.join(", ")}</span>}
        {contas && <span style={{ fontSize: 11, color: COLORS.slate }}>· {contas}</span>}
        {f.porque && f.efetivo === "experiencia" && <span style={{ fontSize: 11, color: COLORS.ink2, flexBasis: "100%" }}>{f.porque}</span>}
        <span style={{ flex: 1 }} />
        {escolhas[f.dominio] ? (
          <button onClick={() => onDefinir(f.dominio, null)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>Deixar o agente decidir</button>
        ) : (
          <>
            {f.efetivo !== "base" && <button onClick={() => onDefinir(f.dominio, "fixa")} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>Fixar</button>}
            <button onClick={() => onDefinir(f.dominio, "removida")} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12, color: COLORS.slate }}>Remover</button>
          </>
        )}
      </div>
    );
  };
  const vistas = lista.filter((f) => f.efetivo === "vista").sort(ordem);
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: COLORS.ink2, lineHeight: 1.5 }}>
        O agente pesquisa nas fontes oficiais e aprende com o que fazes: um site cujas sugestões adicionas passa a ser usado; um site rejeitado duas vezes sai das pesquisas. Em cada pesquisa testa até 2 sites novos — se em 3 testes não der nada, é descartado. Fixar ou remover aqui manda mais que o agente.
      </div>
      {FONTE_GRUPOS.map((g) => {
        const fs = lista.filter((f) => g.estados.includes(f.efetivo)).sort((a, b) => g.estados.indexOf(a.efetivo) - g.estados.indexOf(b.efetivo) || ordem(a, b));
        if (!fs.length) return null;
        return (
          <div key={g.titulo}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: COLORS.slate, marginBottom: 2 }}>{g.titulo} · {fs.length}</div>
            {fs.map(linha)}
          </div>
        );
      })}
      {vistas.length > 0 && (
        <div>
          <button onClick={() => setVerVistas((v) => !v)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
            {verVistas ? "Esconder" : "Ver"} {vistas.length} {vistas.length === 1 ? "site visto" : "sites vistos"} só uma vez
          </button>
          {verVistas && vistas.map(linha)}
        </div>
      )}
      {!lista.length && <div style={{ fontSize: 12.5, color: COLORS.slate }}>A lista aparece depois da próxima pesquisa do agente.</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adicionar()} placeholder="Juntar um site (ex.: sportengland.org)" style={{ ...inputStyle, flex: "1 1 220px", padding: "6px 10px", fontSize: 13 }} />
        <button onClick={adicionar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5 }}>Fixar site</button>
      </div>
    </div>
  );
}

// Departamentos a quem se pergunta pelas sugestões do radar. A área é proposta pelo tema e pode mudar-se.
const DEPARTAMENTOS_RADAR = [
  { k: "psicologia", nome: "Psicologia", re: /psic|saude mental|emocion|ansiedad|burnout|resilienc|autoestima|auto-estima|mindfulness|bem-estar|bem estar|stress/ },
  { k: "nutricao", nome: "Nutrição", re: /nutri|aliment|dieta|hidrata|refeic|suplement|composicao corporal/ },
  { k: "saude", nome: "Saúde", re: /saude|medic|lesao|lesoes|fisio|primeiros socorros|desfibril|concuss|cardi|enfermag|rastreio|recuperacao fisica/ },
  { k: "eventos", nome: "Eventos", re: /evento|torneio|campus|cerimonia|gala|open day|festival|jornada|convivio/ },
  // Estratégico (financiamento, parcerias, expansão…): direção executiva, antes de internacional.
  { k: "direcao", nome: "Direção executiva", re: /estrateg|financiamento|fundos|candidatura|parceria|patrocin|investiment|receita|modelo de negocio|expans|novas escolas|franquia|governan|marca|reputac|transformacao digital|plano de negocio|sustentabilidade financeira/ },
  { k: "internacional", nome: "Internacional", re: /internacion|estrangeir|intercambio|no exterior|outros paises|europe|world|global/ },
];
const departamentoRadar = (r) => {
  const t = normChave([r.categoria, r.titulo, r.resumo].join(" "));
  const d = DEPARTAMENTOS_RADAR.find((x) => x.re.test(t));
  return d ? d.k : "";
};
const emailsDe = (txt) =>
  String(txt || "")
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));

// E-mails dos departamentos, definidos uma vez no topo do radar.
function ContactosDepartamentos({ contactos, onGuardar }) {
  const [rasc, setRasc] = useState(contactos);
  const [guardado, setGuardado] = useState(false);
  useEffect(() => setRasc(contactos), [contactos]);
  const mudou = DEPARTAMENTOS_RADAR.some((d) => (rasc[d.k] || "") !== (contactos[d.k] || ""));
  const invalidos = DEPARTAMENTOS_RADAR.filter((d) => String(rasc[d.k] || "").trim() && !emailsDe(rasc[d.k]).length);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {DEPARTAMENTOS_RADAR.map((d) => (
        <label key={d.k} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
          <span style={{ width: 110, color: COLORS.ink2, fontWeight: 600 }}>{d.nome}</span>
          <input
            type="text"
            value={rasc[d.k] || ""}
            onChange={(e) => setRasc((x) => ({ ...x, [d.k]: e.target.value }))}
            placeholder="e-mail (vários separados por vírgula)"
            style={{ ...inputStyle, flex: "1 1 240px", padding: "6px 9px", fontSize: 12.5 }}
          />
        </label>
      ))}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {invalidos.length > 0 && <span style={{ fontSize: 12, color: COLORS.warn }}>E-mail inválido em {invalidos.map((d) => d.nome).join(", ")}.</span>}
        <span style={{ flex: 1 }} />
        {guardado && !mudou && <span style={{ fontSize: 12, color: COLORS.ok }}>Guardado</span>}
        <button
          type="button"
          disabled={!mudou || invalidos.length > 0}
          onClick={() => {
            onGuardar(Object.fromEntries(DEPARTAMENTOS_RADAR.map((d) => [d.k, emailsDe(rasc[d.k]).join(", ")])));
            setGuardado(true);
          }}
          style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "6px 14px", fontSize: 12.5, opacity: !mudou || invalidos.length ? 0.5 : 1 }}
        >
          Guardar e-mails
        </button>
      </div>
    </div>
  );
}

function RadarOportunidades({ radar, jaNaLista, ignorados, onAdicionar, onIgnorar, pedidoPesquisa = null, onPedirPesquisa, fontesEscolhas = {}, onDefinirFonte, contactos = {}, enviados = {}, onEnviado, onAbrirContactos, notificar }) {
  const [aEnviarOp, setAEnviarOp] = useState(null);
  const enviarOportunidade = async (r, dep, meta, emails) => {
    setAEnviarOp(r.id);
    try {
      const dados = { departamento: meta.nome, titulo: r.titulo, resumo: r.resumo || "", relevancia: r.relevancia || "", acao: r.acao || "", fontes: (r.fontes || []).map((f) => ({ titulo: f.titulo || "", url: f.url || "" })) };
      const { error } = await supabase.rpc("op_enviar_oportunidade", { p_emails: emails, p_dados: dados });
      if (error) throw error;
      onEnviado(r.id, dep);
      notificar && notificar(`E-mail para ${meta.nome.toLowerCase()} na fila. Sai em poucos minutos.`, "ok", 7000);
    } catch (e) {
      notificar && notificar("Não foi possível pôr o e-mail na fila. Confirma que o SQL novo foi corrido no Supabase.", "aviso", 9000);
    } finally {
      setAEnviarOp(null);
    }
  };
  const itens = (radar && radar.itens) || [];
  const [depEscolhido, setDepEscolhido] = useState({});
  // Pedido de nova pesquisa pendente: feito depois da última pesquisa do radar.
  const ultimaPesquisa = (radar && (radar.pesquisadoEm || (radar.atualizadoEm ? `${radar.atualizadoEm}T00:00:00` : ""))) || "";
  const aPesquisar = !!(pedidoPesquisa && pedidoPesquisa.em && String(pedidoPesquisa.em) > ultimaPesquisa);
  const [fCat, setFCat] = useState("todas");
  const [verTodas, setVerTodas] = useState(false);
  const [aberto, setAberto] = useState(true);
  const [verFontes, setVerFontes] = useState(false);
  if (!itens.length) return null;
  const nFontes = Object.keys((radar && radar.fontes) || {}).length;
  const estado = (r) => (jaNaLista.has(r.id) ? "lista" : ignorados.includes(r.id) ? "ignorada" : "nova");
  const novas = itens.filter((r) => estado(r) === "nova");
  const cats = [...new Set(itens.map((r) => r.categoria).filter(Boolean))];
  const visiveis = itens
    .filter((r) => verTodas || estado(r) === "nova")
    .filter((r) => fCat === "todas" || r.categoria === fCat)
    .sort((a, b) => String(b.adicionadoEm).localeCompare(String(a.adicionadoEm)));
  const chip = (on, txt, fn, key) => (
    <button key={key || txt} type="button" onClick={fn} style={{ border: `1px solid ${on ? COLORS.navy : COLORS.rule}`, background: on ? COLORS.navy : "transparent", color: on ? "#fff" : COLORS.ink2, borderRadius: 14, padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>
      {txt}
    </button>
  );
  return (
    <div style={{ ...panelStyle, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => setAberto((v) => !v)} aria-expanded={aberto} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: COLORS.ink, fontFamily: "inherit" }}>
          <span style={{ display: "inline-block", transform: aberto ? "rotate(90deg)" : "none", transition: "transform 160ms ease", color: COLORS.slate }}>›</span>
          <Sparkles size={16} color={COLORS.navySoft} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Radar de oportunidades</span>
          <span style={{ fontSize: 12.5, color: COLORS.slate }}>
            {novas.length ? `${novas.length} ${novas.length === 1 ? "nova" : "novas"}` : "nada de novo"} · do mundo lá fora
          </span>
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: COLORS.slate }}>Pesquisa atualizada a {radar.atualizadoEm ? fmt(new Date(radar.atualizadoEm + "T00:00:00")) : "—"}</span>
        {onPedirPesquisa &&
          (aPesquisar ? (
            <span style={{ fontSize: 12, color: COLORS.warn, fontWeight: 600 }}>A procurar mais sugestões…</span>
          ) : (
            <button onClick={onPedirPesquisa} className="press" style={{ ...(novas.length ? secondaryBtnStyle : primaryBtnStyle), width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Search size={13} /> Procurar mais sugestões
            </button>
          ))}
      </div>
      {aberto && (
        <>
          <div style={{ fontSize: 12, color: COLORS.ink2, margin: "6px 0 10px" }}>IA, tecnologia desportiva, saúde, normas, financiamento e contexto das escolas. Cada sugestão tem a fonte; adiciona à lista as que fizerem sentido.</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {chip(fCat === "todas", "Todas", () => setFCat("todas"), "__t")}
            {cats.map((c) => chip(fCat === c, c, () => setFCat(fCat === c ? "todas" : c)))}
            <span style={{ flex: 1 }} />
            <label style={{ fontSize: 12, color: COLORS.ink2, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="checkbox" checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} /> Mostrar também as já tratadas
            </label>
            {onDefinirFonte && (
              <button onClick={() => setVerFontes((v) => !v)} aria-expanded={verFontes} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                {verFontes ? "Esconder fontes" : `Fontes do agente${nFontes ? ` (${nFontes})` : ""}`}
              </button>
            )}
          </div>
          {verFontes && onDefinirFonte && (
            <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, background: COLORS.paperSunken }}>
              <FontesDoAgente fontes={(radar && radar.fontes) || {}} escolhas={fontesEscolhas} onDefinir={onDefinirFonte} />
            </div>
          )}
          {visiveis.length === 0 ? (
            <div style={{ fontSize: 12.5, color: COLORS.slate }}>
              Sem sugestões novas{fCat !== "todas" ? " nesta categoria" : ""}.{" "}
              {!onPedirPesquisa ? "" : aPesquisar ? "A pesquisa pedida corre na próxima hora; as novas aparecem aqui." : "Carrega em «Procurar mais sugestões» para uma pesquisa nova."}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
              {visiveis.map((r) => {
                const e = estado(r);
                return (
                  <div key={r.id} style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 12, padding: "12px 14px", background: e === "nova" ? COLORS.paperRaised : COLORS.paperSunken, display: "flex", flexDirection: "column", gap: 6, opacity: e === "ignorada" ? 0.7 : 1 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: COLORS.navySoft }}>{r.categoria}</span>
                      {e === "lista" && <span style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.ok }}>· na lista</span>}
                      {e === "ignorada" && <span style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.slate }}>· ignorada</span>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{r.titulo}</div>
                    <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5 }}>{r.resumo}</div>
                    {r.relevancia && (
                      <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                        <strong style={{ fontWeight: 600 }}>Para a Dragon Force: </strong>
                        {r.relevancia}
                      </div>
                    )}
                    {r.acao && (
                      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: COLORS.ink2 }}>
                        <strong style={{ fontWeight: 600, color: COLORS.ink }}>Primeiro passo: </strong>
                        {r.acao}
                      </div>
                    )}
                    {r.explicacao && (
                      <div style={{ fontSize: 12.5, lineHeight: 1.55, background: COLORS.navyWash, borderRadius: 8, padding: "8px 10px" }}>
                        <strong style={{ fontWeight: 600 }}>Mais detalhe: </strong>
                        {r.explicacao}
                      </div>
                    )}
                    <div style={{ fontSize: 11.5, color: COLORS.slate, lineHeight: 1.5 }}>
                      {(r.fontes || []).map((f, i) => (
                        <div key={i}>
                          Fonte:{" "}
                          <a href={/^https?:\/\//i.test(f.url || "") ? f.url : undefined} target="_blank" rel="noreferrer" style={{ color: COLORS.navySoft }}>
                            {f.titulo}
                          </a>
                          {f.data ? ` · ${f.data}` : ""}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 4 }}>
                      {e !== "lista" && (
                        <button onClick={() => onAdicionar(r)} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5 }}>
                          Adicionar como oportunidade
                        </button>
                      )}
                      {e === "nova" && (
                        <button onClick={() => onIgnorar(r.id, true)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5, color: COLORS.slate }}>
                          Não interessa
                        </button>
                      )}

                      {e === "ignorada" && (
                        <button onClick={() => onIgnorar(r.id, false)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
                          Voltar a mostrar
                        </button>
                      )}
                    </div>
                    {onEnviado && (() => {
                      const dep = depEscolhido[r.id] !== undefined ? depEscolhido[r.id] : departamentoRadar(r);
                      const meta = DEPARTAMENTOS_RADAR.find((d) => d.k === dep);
                      const emails = emailsDe(contactos[dep]);
                      const env = enviados[r.id];
                      return (
                        <div style={{ borderTop: `1px solid ${COLORS.ruleSoft}`, paddingTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <select value={dep} onChange={(ev) => setDepEscolhido((x) => ({ ...x, [r.id]: ev.target.value }))} aria-label="Departamento" style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 12.5 }}>
                            <option value="">Departamento…</option>
                            {DEPARTAMENTOS_RADAR.map((d) => (
                              <option key={d.k} value={d.k}>
                                {d.nome}
                              </option>
                            ))}
                          </select>
                          {meta && emails.length ? (
                            <button
                              type="button"
                              disabled={aEnviarOp === r.id}
                              onClick={() => enviarOportunidade(r, dep, meta, emails)}
                              style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6, opacity: aEnviarOp === r.id ? 0.6 : 1 }}
                            >
                              <Mail size={13} /> {aEnviarOp === r.id ? "A enviar…" : env ? "Enviar outra vez" : "Enviar e-mail"}
                            </button>
                          ) : (
                            <span style={{ fontSize: 12, color: COLORS.slate }}>
                              {meta ? (
                                <>
                                  Sem e-mail de {meta.nome.toLowerCase()}.{" "}
                                  {onAbrirContactos && (
                                    <button type="button" onClick={onAbrirContactos} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                                      Definir e-mails
                                    </button>
                                  )}
                                </>
                              ) : (
                                "Escolhe o departamento para enviar."
                              )}
                            </span>
                          )}
                          {env && (
                            <span style={{ fontSize: 11.5, color: COLORS.ok }}>
                              Enviado a {(DEPARTAMENTOS_RADAR.find((d) => d.k === env.dep) || {}).nome || "departamento"} em {fmt(new Date(env.data + "T00:00:00"))}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function RiscosPage({ riscos, onGuardar, deteccoesDe, notificar, ocorrencias = [], radar = null }) {
  const epocasR = Object.keys(riscos.epocas || {}).sort().reverse();
  const epAtual = epocaDe(isoDe(new Date()));
  const [ep, setEp] = useState(() => (epocasR.includes(epAtual) ? epAtual : epocasR[0] || epAtual));
  const epSel = epocasR.includes(ep) ? ep : epocasR[0] || ep;
  const dadosEp = (riscos.epocas || {})[epSel] || { aprovacao: "", itens: [] };
  const itens = dadosEp.itens || [];
  const [editar, setEditar] = useState(null);
  const [fTipo, setFTipo] = useState("todos");
  const [fProc, setFProc] = useState("todos");
  const [fNivel, setFNivel] = useState("todos");
  const [fCel, setFCel] = useState(null);
  const [texto, setTexto] = useState("");
  const [aLer, setALer] = useState(false);
  const [aGerar, setAGerar] = useState(false);
  const [verIgnorados, setVerIgnorados] = useState(false);
  const [importado, setImportado] = useState(null);
  const [verDeps, setVerDeps] = useState(false);

  const ignorados = (riscos.ignorados || {})[epSel] || [];
  const deteccoes = deteccoesDe(epSel, itens, ignorados);
  const porCobrir = deteccoes.filter((d) => !d.cobertoPor.length && !d.ignorado);
  const ignoradasLista = deteccoes.filter((d) => !d.cobertoPor.length && d.ignorado);
  const daItem = (id) => deteccoes.filter((d) => d.cobertoPor.includes(id));
  const poSugeridaDe = (it) => Math.max(0, ...daItem(it.id).filter((d) => d.po).map((d) => d.po));
  const ocorrDe = (id) => ocorrencias.filter((o) => (o.riscos || []).includes(id));

  const legendas = riscos.legendas || null;
  const processos = [...new Set([...PROCESSOS_PADRAO.map((p) => p.codigo), ...Object.values(riscos.epocas || {}).flatMap((e) => (e.itens || []).map((i) => i.processo))].filter(Boolean))];
  const responsaveis = (legendas && legendas.responsaveis) || [];

  const guardarEpoca = (mudancas) => onGuardar({ ...riscos, epocas: { ...(riscos.epocas || {}), [epSel]: { ...dadosEp, ...mudancas } } });
  const guardarItem = (item) => {
    const existe = itens.some((i) => i.id === item.id);
    const lista = existe ? itens.map((i) => (i.id === item.id ? item : i)) : [...itens, item];
    guardarEpoca({ itens: lista.sort((a, b) => (a.n || 0) - (b.n || 0)) });
    setEditar(null);
    notificar(existe ? `Nº ${item.n} atualizado.` : `Nº ${item.n} acrescentado à época ${epSel}.`);
  };
  const apagarItem = (id) => {
    const it = itens.find((i) => i.id === id);
    if (!window.confirm(`Apagar o Nº ${it ? it.n : ""} da época ${epSel}?`)) return;
    guardarEpoca({ itens: itens.filter((i) => i.id !== id) });
    setEditar(null);
  };
  const proximoN = () => Math.max(0, ...itens.map((i) => Number(i.n) || 0)) + 1;
  const novo = (base = {}) => setEditar({ __novo: true, id: novoIdRisco(), n: proximoN(), tipo: "R", processo: "", proveniencia: "", objetivo: "", identificacao: "", causa: "", impacto: "", po: null, gr: null, aceitacao: "", acao: "", responsavel: "", data: "", estado: "Em análise", observacoes: "", ...base });
  const daDeteccao = (d) => novo({ tipo: d.tipo, processo: d.processo, identificacao: d.titulo, causa: d.causa, impacto: d.impacto, acao: d.acao || "", po: d.po, gr: d.gr, aceitacao: aceitacaoSugerida(d.po && d.gr ? d.po * d.gr : null), detetores: [d.id], observacoes: `Identificado a partir dos dados: ${d.detalhe}.` });
  const ligar = (d, idItem) => {
    guardarEpoca({ itens: itens.map((i) => (i.id === idItem ? { ...i, detetores: [...new Set([...(i.detetores || []), d.id])] } : i)) });
    notificar(`"${d.titulo}" ligado ao Nº ${(itens.find((i) => i.id === idItem) || {}).n}.`);
  };
  const ignorar = (d, sim) => {
    const l = sim ? [...new Set([...ignorados, d.id])] : ignorados.filter((x) => x !== d.id);
    onGuardar({ ...riscos, ignorados: { ...(riscos.ignorados || {}), [epSel]: l } });
  };
  const novaEpoca = () => {
    const seg = epocaSeguinte(epocasR[0] || epSel);
    if ((riscos.epocas || {})[seg]) return setEp(seg);
    const base = (riscos.epocas || {})[epocasR[0]] || { itens: [] };
    const copia = (base.itens || []).map((i) => ({ ...i, id: novoIdRisco() }));
    onGuardar({ ...riscos, epocas: { ...(riscos.epocas || {}), [seg]: { aprovacao: "", itens: copia, copiadaDe: epocasR[0] || null } } });
    setEp(seg);
    notificar(`Época ${seg} criada a partir de ${epocasR[0] || "zero"} (${copia.length} linhas). Revê e atualiza o que mudou.`);
  };

  const importar = async (f) => {
    if (!f) return;
    setALer(true);
    try {
      const folhas = await lerExcelInq(f, { todas: true });
      const r = lerRiscosDoExcel(folhas);
      const eps = Object.keys(r.epocas).sort();
      if (!eps.length) throw new Error(r.avisos.join(" ") || "não encontrei folhas de época");
      setImportado({ ...r, eps, sobrepoe: eps.filter((e) => (riscos.epocas || {})[e]) });
    } catch (e) {
      notificar(`Não consegui ler o ficheiro: ${e?.message || e}`, "erro");
    } finally {
      setALer(false);
    }
  };
  const confirmarImportacao = (substituir) => {
    const epocas = { ...(riscos.epocas || {}) };
    importado.eps.forEach((e) => {
      if (!epocas[e] || substituir) epocas[e] = importado.epocas[e];
    });
    onGuardar({ ...riscos, epocas, legendas: importado.legendas || riscos.legendas || null });
    setEp(importado.eps[importado.eps.length - 1]);
    notificar(`Importadas ${importado.eps.length} épocas do documento.`);
    setImportado(null);
  };
  const descarregar = async (apenas) => {
    setAGerar(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const buf = await gerarExcelRiscos(ExcelJS, { epocas: riscos.epocas || {}, legendas, apenas });
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `DFF.151.01 - PENSAMENTO BASEADO NO RISCO E OPORTUNIDADES${apenas && apenas.length === 1 ? ` ${folhaDaEpoca(apenas[0])}` : ""}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      notificar(`Não foi possível gerar o Excel: ${e?.message || e}`, "erro");
    } finally {
      setAGerar(false);
    }
  };

  const visiveis = itens
    .filter((i) => fTipo === "todos" || (i.tipo || "R") === fTipo)
    .filter((i) => fProc === "todos" || codigoProcesso(i.processo) === fProc)
    .filter((i) => {
      if (fNivel === "todos") return true;
      if (fNivel === "rever") return i.tipo !== "O" && poSugeridaDe(i) > (Number(i.po) || 0);
      return faixaRisco(nivelRisco(i)) === fNivel;
    })
    .filter((i) => !fCel || `${i.po}|${i.gr}` === fCel)
    .filter((i) => !texto.trim() || normChave([i.identificacao, i.causa, i.impacto, i.acao, i.responsavel].join(" ")).includes(normChave(texto)));
  const R = itens.filter((i) => i.tipo !== "O");
  const nAlto = R.filter((i) => faixaRisco(nivelRisco(i)) === "alto").length;
  const nMedio = R.filter((i) => faixaRisco(nivelRisco(i)) === "medio").length;
  const nRever = R.filter((i) => poSugeridaDe(i) > (Number(i.po) || 0)).length;
  const codigosProc = [...new Set(itens.map((i) => codigoProcesso(i.processo)).filter(Boolean))].sort();
  const selF = { ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 };

  const radarNaLista = new Set(Object.values(riscos.epocas || {}).flatMap((e) => (e.itens || []).map((i) => i.radar).filter(Boolean)));
  const radarIgnorados = riscos.radarIgnorados || [];
  const contactosDeps = { ...(riscos.radarPsicologia?.email ? { psicologia: riscos.radarPsicologia.email } : {}), ...(riscos.radarContactos || {}) };
  const nDeps = DEPARTAMENTOS_RADAR.filter((d) => emailsDe(contactosDeps[d.k]).length).length;
  const painelRadar = (
    <RadarOportunidades
      radar={radar}
      jaNaLista={radarNaLista}
      ignorados={radarIgnorados}
      onIgnorar={(id, sim) => onGuardar({ ...riscos, radarIgnorados: sim ? [...new Set([...radarIgnorados, id])] : radarIgnorados.filter((x) => x !== id) })}
      pedidoPesquisa={riscos.radarPedidoPesquisa || null}
      fontesEscolhas={riscos.radarFontesUtilizador || {}}
      contactos={contactosDeps}
      enviados={{ ...Object.fromEntries(Object.entries(riscos.radarPsicologia?.enviados || {}).map(([id, data]) => [id, { data, dep: "psicologia" }])), ...(riscos.radarEnviados || {}) }}
      onAbrirContactos={() => setVerDeps(true)}
      notificar={notificar}
      onEnviado={(id, dep) => onGuardar({ ...riscos, radarEnviados: { ...(riscos.radarEnviados || {}), [id]: { data: isoDe(new Date()), dep } } })}
      onDefinirFonte={(dominio, estado) => {
        const atual = { ...(riscos.radarFontesUtilizador || {}) };
        if (estado) atual[dominio] = estado;
        else delete atual[dominio];
        onGuardar({ ...riscos, radarFontesUtilizador: atual });
      }}
      // O agente Gemini (Google Apps Script) vê os pedidos de hora a hora e grava as sugestões no radar.
      onPedirPesquisa={() => {
        onGuardar({ ...riscos, radarPedidoPesquisa: { em: new Date().toISOString() } });
        notificar("Pedido feito. O agente pesquisa na próxima hora e as sugestões novas aparecem aqui.", "ok", 7000);
      }}
      onAdicionar={(r) =>
        novo({
          tipo: "O",
          radar: r.id,
          processo: r.processo || "",
          proveniencia: "QE",
          identificacao: r.titulo,
          causa: r.resumo || "",
          impacto: r.relevancia || "",
          acao: r.acao || "",
          estado: "Em análise",
          observacoes: (r.fontes || []).map((f) => `Fonte: ${f.titulo}${f.url ? ` (${f.url})` : ""}`).join("\n"),
        })
      }
    />
  );
  const linhaProposta = (d) => (
                  <div key={d.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", padding: "10px 12px", borderRadius: 10, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}` }}>
                    <TipoRisco tipo={d.tipo} />
                    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                        {d.titulo}
                        {d.daOcorrencia && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: COLORS.warn, border: `1px solid ${COLORS.warn}`, borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap" }}>das ocorrências</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 2 }}>
                        {d.detalhe}
                        {d.po ? ` · possibilidade de ocorrência sugerida ${d.po} (${PO_ROTULOS[d.po]})` : ""}
                      </div>
                      {d.relacionados.length > 0 && (
                        <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          Talvez já esteja em:
                          {d.relacionados.map((id) => {
                            const it = itens.find((i) => i.id === id);
                            return it ? (
                              <button key={id} onClick={() => ligar(d, id)} title={`Ligar a: ${it.identificacao}`} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "2px 8px", fontSize: 11.5 }}>
                                É o Nº {it.n}
                              </button>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <select value="" onChange={(e) => e.target.value && ligar(d, e.target.value)} aria-label="Já está na lista como" style={{ ...inputStyle, width: 150, padding: "5px 8px", fontSize: 12 }}>
                        <option value="">Já está como…</option>
                        {itens
                          .filter((i) => (i.tipo || "R") === d.tipo)
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              Nº {i.n} · {String(i.identificacao).slice(0, 50)}
                            </option>
                          ))}
                      </select>
                      <button onClick={() => daDeteccao(d)} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5 }}>
                        Adicionar à lista
                      </button>
                      <button onClick={() => ignorar(d, true)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5, color: COLORS.slate }}>
                        Ignorar
                      </button>
                    </div>
                  </div>
  );
  const propR = porCobrir.filter((d) => d.tipo !== "O");
  const propO = porCobrir.filter((d) => d.tipo === "O");
  const painelPropostas = porCobrir.length > 0 && (
    <div style={{ ...panelStyle, marginBottom: 14, borderColor: COLORS.warn, background: COLORS.warnBg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Sparkles size={16} color={COLORS.warn} />
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          Propostas a partir dos dados de {epSel}: {propR.length} {propR.length === 1 ? "risco novo" : "riscos novos"} e {propO.length} {propO.length === 1 ? "oportunidade" : "oportunidades"}
        </div>
      </div>
      <div style={{ fontSize: 12, color: COLORS.ink2, marginBottom: 10 }}>Vêm das ocorrências, auditorias, reclamações, sanções, desistências, eventos e inscritos, e ainda não estão na lista.</div>
      {[
        ["Riscos novos", propR],
        ["Oportunidades novas", propO],
      ]
        .filter(([, l]) => l.length)
        .map(([t, l]) => (
          <div key={t} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "4px 0 6px" }}>{t}</div>
            <div style={{ display: "grid", gap: 8 }}>{l.map(linhaProposta)}</div>
          </div>
        ))}
    </div>
  );
  const botoes = (
    <>
      <button className="press" onClick={() => setVerDeps(true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Mail size={14} /> E-mails dos departamentos{nDeps < DEPARTAMENTOS_RADAR.length ? ` (${nDeps} de ${DEPARTAMENTOS_RADAR.length})` : ""}
      </button>
      {verDeps && (
        <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={() => setVerDeps(false)}>
          <div className="sheet" style={{ width: "min(560px, 100%)", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>E-mails dos departamentos</h2>
              <button onClick={() => setVerDeps(false)} style={iconBtnStyle} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 14, lineHeight: 1.5 }}>Para onde vão as perguntas sobre as sugestões do radar. Cada sugestão propõe o departamento pelo tema e tem só o botão para enviar.</div>
            <ContactosDepartamentos
              contactos={contactosDeps}
              onGuardar={(c) => {
                onGuardar({ ...riscos, radarContactos: c });
                setVerDeps(false);
                notificar("E-mails dos departamentos guardados.", "ok");
              }}
            />
          </div>
        </div>
      )}
      <label className="press" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <FileText size={14} /> {aLer ? "A ler…" : "Importar Excel"}
        <input type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => importar(e.target.files && e.target.files[0])} />
      </label>
      {epocasR.length > 0 && (
        <button className="press" disabled={aGerar} onClick={() => descarregar(null)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Printer size={14} /> {aGerar ? "A gerar…" : "Descarregar Excel"}
        </button>
      )}
    </>
  );

  return (
    <div>
      {importado && (
        <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={() => setImportado(null)}>
          <div className="sheet" style={{ width: "min(560px, 100%)", background: COLORS.paperRaised, borderRadius: 14, padding: 22, border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 10px", fontSize: 19, color: COLORS.navy }}>Importar o documento</h2>
            <div style={{ fontSize: 13, color: COLORS.ink2, lineHeight: 1.6 }}>
              {importado.eps.map((e) => (
                <div key={e}>
                  Época {e}: {importado.epocas[e].itens.filter((i) => i.tipo !== "O").length} riscos e {importado.epocas[e].itens.filter((i) => i.tipo === "O").length} oportunidades
                  {importado.epocas[e].aprovacao ? ` · aprovada a ${importado.epocas[e].aprovacao}` : ""}
                </div>
              ))}
              {importado.legendas && <div style={{ marginTop: 6 }}>Legendas: {importado.legendas.processos.length} processos e {importado.legendas.responsaveis.length} siglas de responsáveis.</div>}
              {importado.avisos.length > 0 && <div style={{ color: COLORS.warn, marginTop: 6 }}>{importado.avisos.join(" ")}</div>}
              {importado.sobrepoe.length > 0 && <div style={{ marginTop: 8, color: COLORS.ink }}>Já existem na app: {importado.sobrepoe.join(", ")}.</div>}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={() => setImportado(null)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
                Cancelar
              </button>
              {importado.sobrepoe.length > 0 && importado.sobrepoe.length < importado.eps.length && (
                <button onClick={() => confirmarImportacao(false)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
                  Só as épocas novas
                </button>
              )}
              <button onClick={() => confirmarImportacao(true)} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}>
                {importado.sobrepoe.length ? "Importar e substituir" : "Importar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {epocasR.length === 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          {painelPropostas}
          {painelRadar}
          <Vazio icon={ShieldAlert} titulo="Ainda sem riscos e oportunidades" texto="Importa o Excel do documento DFF.151.01 (todas as épocas de uma vez) ou começa a lista desta época na app." />
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {botoes}
            <button onClick={novaEpoca} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13 }}>
              Começar {epAtual} do zero
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <select value={epSel} onChange={(e) => setEp(e.target.value)} aria-label="Época" style={{ ...selF, fontWeight: 600 }}>
              {epocasR.map((e) => (
                <option key={e} value={e}>
                  Época {e}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 12.5, color: COLORS.ink2, display: "inline-flex", alignItems: "center", gap: 6 }}>
              Aprovação
              <input value={dadosEp.aprovacao || ""} onChange={(e) => guardarEpoca({ aprovacao: e.target.value })} placeholder="dd-mm-aaaa" style={{ ...inputStyle, width: 110, padding: "5px 8px", fontSize: 12.5 }} />
            </label>
            <span style={{ flex: 1 }} />
            {botoes}
            <button onClick={novaEpoca} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13 }} title="Copia a última época para a seguinte, para atualizares">
              {(riscos.epocas || {})[epocaSeguinte(epocasR[0])] ? "Ir para a época seguinte" : `Criar ${epocaSeguinte(epocasR[0])}`}
            </button>
            <button className="press" onClick={() => novo()} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Novo
            </button>
          </div>

          {painelPropostas}
          {painelRadar}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <StatCard label="Riscos" value={R.length} subtitle={`${itens.length - R.length} oportunidades`} />
            <StatCard label="Não aceitáveis" value={nAlto} color={nAlto ? COLORS.danger : undefined} subtitle="nível 9 a 16" />
            <StatCard label="Aceitáveis com monitorização" value={nMedio} color={nMedio ? COLORS.warn : undefined} subtitle="nível 4 a 8" />
            <StatCard label="A rever pelos dados" value={nRever} color={nRever ? COLORS.warn : undefined} subtitle="possibilidade abaixo do que os dados mostram" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, marginBottom: 14, alignItems: "start" }} className="riscosTopo">
            <div style={{ ...panelStyle, marginBottom: 0 }}>
              <div style={panelTitle}>Matriz de risco</div>
              <MatrizRiscos itens={itens} filtro={fCel} onFiltro={setFCel} />
            </div>
            <div style={{ ...panelStyle, marginBottom: 0 }}>
              <div style={panelTitle}>Temas detetados nos dados de {epSel}</div>
              {deteccoes.length === 0 ? (
                <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem temas com expressão nos dados desta época.</div>
              ) : (
                <div style={{ display: "grid", gap: 5 }}>
                  {deteccoes
                    .filter((d) => d.cobertoPor.length)
                    .map((d) => (
                      <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
                        <Check size={13} color={COLORS.ok} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          {d.titulo} <span style={{ color: COLORS.slate }}>· {d.detalhe}</span>
                        </span>
                        <span style={{ color: COLORS.slate, whiteSpace: "nowrap" }}>Nº {d.cobertoPor.map((id) => (itens.find((i) => i.id === id) || {}).n).join(", ")}</span>
                      </div>
                    ))}
                  {ignoradasLista.length > 0 && (
                    <button onClick={() => setVerIgnorados((v) => !v)} style={{ ...linkBtnStyle, marginTop: 4, fontSize: 12, textAlign: "left" }}>
                      {verIgnorados ? "Esconder" : "Ver"} {ignoradasLista.length} {ignoradasLista.length === 1 ? "tema ignorado" : "temas ignorados"}
                    </button>
                  )}
                  {verIgnorados &&
                    ignoradasLista.map((d) => (
                      <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: COLORS.slate }}>
                        <span style={{ flex: 1 }}>
                          {d.titulo} · {d.detalhe}
                        </span>
                        <button onClick={() => ignorar(d, false)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                          Voltar a avisar
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <Filtros>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Procurar" style={{ ...inputStyle, width: 180 }} />
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={{ ...inputStyle, width: 170 }}>
              <option value="todos">Riscos e oportunidades</option>
              <option value="R">Só riscos</option>
              <option value="O">Só oportunidades</option>
            </select>
            <select value={fProc} onChange={(e) => setFProc(e.target.value)} style={{ ...inputStyle, width: 150 }}>
              <option value="todos">Todos os processos</option>
              {codigosProc.map((c) => (
                <option key={c} value={c}>
                  PR.0{c}
                </option>
              ))}
            </select>
            <select value={fNivel} onChange={(e) => setFNivel(e.target.value)} style={{ ...inputStyle, width: 190 }}>
              <option value="todos">Todos os níveis</option>
              <option value="alto">Não aceitáveis (9–16)</option>
              <option value="medio">Com monitorização (4–8)</option>
              <option value="baixo">Aceitáveis (1–3)</option>
              <option value="rever">A rever pelos dados</option>
            </select>
            {fCel && (
              <button onClick={() => setFCel(null)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
                Limpar célula da matriz (PO {fCel.split("|")[0]} × GR {fCel.split("|")[1]})
              </button>
            )}
          </Filtros>

          <div style={panelStyle}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Nº", "", "Risco / oportunidade", "PO", "GR", "NR", "Aceit.", "Responsável", "Estado", "Dados"].map((h, i) => (
                      <th key={i} style={{ ...thStyle, textAlign: i >= 3 && i <= 6 ? "center" : "left" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((i) => {
                    const ds = daItem(i.id);
                    const ocs = ocorrDe(i.id);
                    const poS = poSugeridaDe(i);
                    const rever = i.tipo !== "O" && poS > (Number(i.po) || 0);
                    return (
                      <tr key={i.id} onClick={() => setEditar(i)} style={{ cursor: "pointer" }} className="linhaClicavel">
                        <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", color: COLORS.slate }}>{i.n}</td>
                        <td style={tdStyle}>
                          <TipoRisco tipo={i.tipo} />
                        </td>
                        <td style={{ ...tdStyle, minWidth: 260 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{i.identificacao}</div>
                          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 2 }}>
                            {i.processo ? `PR.0${codigoProcesso(i.processo)}` : ""}
                            {i.proveniencia ? ` · ${i.proveniencia}` : ""}
                            {i.causa ? ` · ${String(i.causa).slice(0, 90)}${String(i.causa).length > 90 ? "…" : ""}` : ""}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{i.tipo === "O" ? "" : i.po || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{i.tipo === "O" ? "" : i.gr || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <ChipNivel it={i} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center", fontSize: 12, fontWeight: 600, color: i.aceitacao === "NA" ? COLORS.danger : COLORS.ink2 }}>{i.tipo === "O" ? "" : i.aceitacao || "—"}</td>
                        <td style={{ ...tdStyle, fontSize: 12.5 }}>{i.responsavel || "—"}</td>
                        <td style={{ ...tdStyle, fontSize: 12, color: COLORS.ink2 }}>{i.estado || "—"}</td>
                        <td style={{ ...tdStyle, fontSize: 12 }}>
                          {ds.length || ocs.length ? (
                            <span style={{ color: rever ? COLORS.warn : COLORS.ink2, fontWeight: rever ? 600 : 400 }} title={[...ds.map((d) => d.detalhe), ...ocs.map((o) => `Ocorrência: ${o.titulo}`)].join("\n")}>
                              {ds.length ? `${ds.reduce((t, d) => t + d.n, 0)} nos dados` : ""}
                              {ocs.length ? `${ds.length ? " · " : ""}${ocs.length} ocorr.` : ""}
                              {rever ? ` · PO ${poS}?` : ""}
                            </span>
                          ) : (
                            <span style={{ color: COLORS.rule }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {visiveis.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ ...tdStyle, color: COLORS.slate, textAlign: "center", padding: 20 }}>
                        Nada com estes filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 8 }}>NR = PO × GR. Aceitável até 3, aceitável com monitorização de 4 a 8, não aceitável de 9 a 16. Carrega numa linha para a editar.</div>
          </div>
        </>
      )}

      {editar && <EditorRisco inicial={editar} processos={processos} responsaveis={responsaveis} deteccoes={deteccoes} ocorrenciasLigadas={ocorrDe(editar.id)} onGuardar={guardarItem} onApagar={apagarItem} onFechar={() => setEditar(null)} />}
    </div>
  );
}
