// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import { useState, useEffect, useMemo, useRef } from "react";
import { lerFormacaoDoExcel, gerarExcelFormacao, resumoFormacao, epocaDaData, epocaAtualForm, mesesDaEpoca, FORMATOS_FORM, ESTADOS_FORM, MESES_CURTOS, MESES_LONGOS } from "../formacao";
import { Plus, Search, FileText, Printer } from "lucide-react";
import { COLORS, StatCard, Tag, Vazio, iconBtnStyle, inputStyle, isoDe, labelStyle, linkBtnStyle, normChave, panelStyle, panelTitle, primaryBtnStyle, secondaryBtnStyle, segSGQ } from "../nucleo.jsx";
import { BotaoFoto, JanelaSGQ, abrirLivroExcel, chipSGQ, descarregarXlsx, tdStyle, thStyle } from "../partilhado.jsx";

// ======================= PLANO DE FORMAÇÃO =======================
const pctForm = (v) => (v === null || v === undefined || v === "" ? "—" : `${Math.round(Number(v) * 100)}%`);
const corEstadoForm = (e) =>
  ({
    Planeada: [COLORS.progress, COLORS.progressBg],
    "Em curso": [COLORS.warn, COLORS.warnBg],
    Concluída: [COLORS.ok, COLORS.okBg],
    Cancelada: [COLORS.slate, COLORS.doneBg],
  }[e] || [COLORS.slate, COLORS.doneBg]);
const epocaDaAcao = (i) => (i.data ? epocaDaData(i.data) : i.epoca || "");
const dataCurta = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

function EditorFormacao({ inicial, sugestoes, onGuardar, onApagar, onFechar }) {
  const [d, setD] = useState(() => ({ ...inicial }));
  const muda = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const valido = String(d.conteudo || "").trim();
  const campo = (k, rotulo, lista, extra = {}) => (
    <div>
      <label style={{ ...labelStyle, marginTop: 0 }}>{rotulo}</label>
      <input value={d[k] ?? ""} onChange={(e) => muda(k, e.target.value)} list={lista && lista.length ? `form-${k}` : undefined} style={inputStyle} {...extra} />
      {lista && lista.length > 0 && (
        <datalist id={`form-${k}`}>
          {lista.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
    </div>
  );
  const campoPct = (k, rotulo) => (
    <div>
      <label style={{ ...labelStyle, marginTop: 0 }}>{rotulo}</label>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          min="0"
          max="100"
          value={d[k] === null || d[k] === undefined || d[k] === "" ? "" : Math.round(Number(d[k]) * 1000) / 10}
          onChange={(e) => muda(k, e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))) / 100)}
          style={{ ...inputStyle, paddingRight: 26 }}
        />
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.slate, fontSize: 13 }}>%</span>
      </div>
    </div>
  );
  const guardar = () => {
    const limpo = { ...d, conteudo: String(d.conteudo).trim(), participantes: d.participantes === "" || d.participantes === null || d.participantes === undefined ? null : Number(d.participantes) };
    delete limpo.__novo;
    if (limpo.data) limpo.epoca = epocaDaData(limpo.data);
    onGuardar(limpo);
  };
  return (
    <JanelaSGQ
      titulo={inicial.__novo ? "Nova ação de formação" : `Ação ${d.num ?? ""}`.trim()}
      largura={780}
      onFechar={onFechar}
      rodape={
        <>
          {!inicial.__novo && (
            <button onClick={() => onApagar(d.id)} style={{ ...linkBtnStyle, marginTop: 0, color: COLORS.danger }}>
              Apagar
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
            Cancelar
          </button>
          <button disabled={!valido} onClick={guardar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px", opacity: valido ? 1 : 0.5 }}>
            Guardar
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Conteúdo</label>
          <input value={d.conteudo || ""} onChange={(e) => muda("conteudo", e.target.value)} placeholder="Ex.: Modelo de Treino" style={inputStyle} autoFocus={inicial.__novo} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data</label>
            <input type="date" value={d.data || ""} onChange={(e) => muda("data", e.target.value)} style={inputStyle} />
          </div>
          {campo("objetivo", "Objetivo", sugestoes.objetivo)}
          {campo("orador", "Orador responsável", sugestoes.orador)}
          {campo("local", "Local", sugestoes.local)}
          {campo("publico", "Público-alvo", sugestoes.publico)}
          {campo("area", "Área responsável", sugestoes.area)}
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Formato</label>
            {segSGQ(
              FORMATOS_FORM.map((f) => [f, f]),
              d.formato || "",
              (v) => muda("formato", d.formato === v ? "" : v)
            )}
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Estado</label>
            {segSGQ(
              ESTADOS_FORM.map((e) => [e, e]),
              d.estado || "Planeada",
              (v) => muda("estado", v)
            )}
          </div>
        </div>
        <div style={{ ...panelStyle, marginBottom: 0, padding: 14, background: COLORS.paperSunken }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10 }}>Avaliação</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Participantes</label>
              <input type="number" min="0" value={d.participantes ?? ""} onChange={(e) => muda("participantes", e.target.value)} style={inputStyle} />
            </div>
            {campoPct("adesao", "Adesão")}
            {campoPct("satisfacao", "Satisfação")}
            {campoPct("eficacia", "Eficácia")}
          </div>
        </div>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Observações</label>
          <textarea value={d.observacoes || ""} onChange={(e) => muda("observacoes", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>
      </div>
    </JanelaSGQ>
  );
}

function CalendarioFormacao({ epoca, itens, onAbrir, onNovaNoDia }) {
  const meses = mesesDaEpoca(epoca);
  const hoje = isoDe(new Date());
  const porDia = useMemo(() => {
    const m = {};
    itens.forEach((i) => i.data && (m[i.data] = m[i.data] || []).push(i));
    return m;
  }, [itens]);
  const contaMes = (ano, mes) => itens.filter((i) => i.data && i.data.startsWith(`${ano}-${String(mes + 1).padStart(2, "0")}`)).length;
  const inicial = () => {
    const k = meses.findIndex(({ ano, mes }) => hoje.startsWith(`${ano}-${String(mes + 1).padStart(2, "0")}`));
    if (k >= 0) return k;
    const comAcoes = meses.findIndex(({ ano, mes }) => contaMes(ano, mes) > 0);
    return comAcoes >= 0 ? comAcoes : 0;
  };
  const [k, setK] = useState(inicial);
  useEffect(() => setK(inicial()), [epoca]); // eslint-disable-line react-hooks/exhaustive-deps
  const { ano, mes } = meses[k];
  const desloc = (new Date(ano, mes, 1).getDay() + 6) % 7;
  const nDias = new Date(ano, mes + 1, 0).getDate();
  const nSemanas = Math.ceil((desloc + nDias) / 7);
  const semData = itens.filter((i) => !i.data);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {meses.map(({ ano: a, mes: m }, j) => {
          const n = contaMes(a, m);
          return (
            <button key={j} type="button" onClick={() => setK(j)} style={{ ...chipSGQ(j === k), display: "inline-flex", alignItems: "center", gap: 6 }}>
              {MESES_CURTOS[m]}
              {n > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: j === k ? COLORS.navy : COLORS.slate }}>{n}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ ...panelStyle, marginBottom: 0, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${COLORS.rule}` }}>
          <button type="button" disabled={k === 0} onClick={() => setK(k - 1)} aria-label="Mês anterior" style={{ ...iconBtnStyle, opacity: k === 0 ? 0.3 : 1 }}>
            ‹
          </button>
          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.navy, flex: 1, textAlign: "center", textTransform: "capitalize" }}>
            {MESES_LONGOS[mes]} {ano}
          </div>
          <button type="button" disabled={k === 11} onClick={() => setK(k + 1)} aria-label="Mês seguinte" style={{ ...iconBtnStyle, opacity: k === 11 ? 0.3 : 1 }}>
            ›
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 640 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: COLORS.paperSunken, borderBottom: `1px solid ${COLORS.rule}` }}>
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((dia) => (
                <div key={dia} style={{ padding: "6px 8px", fontSize: 11.5, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {dia}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {Array.from({ length: nSemanas * 7 }, (_, j) => {
                const dia = j - desloc + 1;
                const fora = dia < 1 || dia > nDias;
                const iso = fora ? "" : `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                const acoes = fora ? [] : porDia[iso] || [];
                return (
                  <div
                    key={j}
                    onDoubleClick={() => !fora && onNovaNoDia(iso)}
                    title={fora ? undefined : "Duplo clique para marcar uma ação neste dia"}
                    style={{ minHeight: 96, padding: 6, borderRight: j % 7 === 6 ? "none" : `1px solid ${COLORS.ruleSoft}`, borderBottom: `1px solid ${COLORS.ruleSoft}`, background: fora ? COLORS.paperSunken : j % 7 >= 5 ? COLORS.paper : COLORS.paperRaised, minWidth: 0 }}
                  >
                    {!fora && (
                      <>
                        <div style={{ fontSize: 12, fontWeight: iso === hoje ? 700 : 500, color: iso === hoje ? COLORS.onAccent : COLORS.ink2, background: iso === hoje ? COLORS.navy : "transparent", borderRadius: 999, width: 22, height: 22, display: "grid", placeItems: "center", marginBottom: 4 }}>{dia}</div>
                        <div style={{ display: "grid", gap: 3 }}>
                          {acoes.map((i) => {
                            const [cor, fundo] = corEstadoForm(i.estado);
                            return (
                              <button
                                key={i.id}
                                type="button"
                                onClick={() => onAbrir(i)}
                                title={[i.conteudo, i.orador, i.local, i.estado].filter(Boolean).join(" · ")}
                                style={{ textAlign: "left", border: "none", borderLeft: `3px solid ${cor}`, background: fundo, color: COLORS.ink, borderRadius: 4, padding: "3px 6px", fontSize: 11.5, lineHeight: 1.3, cursor: "pointer", fontFamily: "inherit", textDecoration: i.estado === "Cancelada" ? "line-through" : "none" }}
                              >
                                <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{i.conteudo}</span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: COLORS.slate }}>
        {ESTADOS_FORM.map((e) => (
          <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: corEstadoForm(e)[0] }} /> {e}
          </span>
        ))}
        <span style={{ marginLeft: "auto" }}>Duplo clique num dia para marcar uma ação.</span>
      </div>
      {semData.length > 0 && (
        <div style={{ ...panelStyle, marginBottom: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>
            Sem data <span style={{ color: COLORS.slate, fontWeight: 400 }}>· {semData.length}</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {semData.map((i) => (
              <button key={i.id} type="button" onClick={() => onAbrir(i)} style={chipSGQ(false)}>
                {i.conteudo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FormacaoPage({ dados, onGuardar, notificar }) {
  const itens = (dados && dados.itens) || [];
  const epocas = useMemo(() => {
    const s = new Set([epocaAtualForm(), ...itens.map(epocaDaAcao).filter(Boolean)]);
    return [...s].sort().reverse();
  }, [itens]);
  const [epoca, setEpoca] = useState(() => {
    const atual = epocaAtualForm();
    return itens.some((i) => epocaDaAcao(i) === atual) || !itens.length ? atual : epocaDaAcao(itens[0]) || atual;
  });
  const [vista, setVista] = useState("calendario");
  const [editar, setEditar] = useState(null);
  const [importado, setImportado] = useState(null);
  const [aLer, setALer] = useState(false);
  const [aGerar, setAGerar] = useState(false);
  const [texto, setTexto] = useState("");
  const [fEstado, setFEstado] = useState("todos");
  const fotoRef = useRef(null);

  const doAno = itens.filter((i) => epocaDaAcao(i) === epoca);
  const r = resumoFormacao(doAno);
  const sugestoes = Object.fromEntries(["objetivo", "orador", "local", "publico", "area"].map((k) => [k, [...new Set(itens.map((i) => i[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"))]));

  const guardarItem = (d) => {
    const existe = itens.some((x) => x.id === d.id);
    onGuardar({ ...(dados || {}), itens: existe ? itens.map((x) => (x.id === d.id ? d : x)) : [...itens, d] });
    setEditar(null);
    if (d.data && epocaDaData(d.data) !== epoca) setEpoca(epocaDaData(d.data));
    notificar(existe ? "Ação atualizada." : "Ação criada.");
  };
  const apagar = (id) => {
    const d = itens.find((x) => x.id === id);
    if (!window.confirm(`Apagar "${d ? d.conteudo : "esta ação"}"? Se não se vai fazer, marca como cancelada.`)) return;
    onGuardar({ ...(dados || {}), itens: itens.filter((x) => x.id !== id) });
    setEditar(null);
  };
  const novo = (data = "") =>
    setEditar({ __novo: true, id: `form-${Date.now().toString(36)}`, num: Math.max(0, ...doAno.map((i) => Number(i.num) || 0)) + 1, epoca, data, conteudo: "", objetivo: "", formato: "Presencial", orador: "", local: "", estado: "Planeada", participantes: null, adesao: null, satisfacao: null, eficacia: null, observacoes: "", publico: "", area: "" });

  const importar = async (f) => {
    if (!f) return;
    setALer(true);
    try {
      const wb = await abrirLivroExcel(f);
      const res = lerFormacaoDoExcel(wb);
      if (!res.itens.length) throw new Error(res.avisos.join(" ") || "não encontrei ações");
      setImportado(res);
    } catch (e) {
      notificar(`Não consegui ler o ficheiro: ${e?.message || e}`, "erro");
    } finally {
      setALer(false);
    }
  };
  const confirmar = () => {
    const ep = importado.epoca;
    const novos = importado.itens.map((i) => ({ ...i, epoca: i.data ? epocaDaData(i.data) : ep }));
    onGuardar({ ...(dados || {}), itens: [...itens.filter((i) => epocaDaAcao(i) !== ep), ...novos] });
    setEpoca(ep);
    notificar(`Importadas ${novos.length} ações para ${ep}.`);
    setImportado(null);
  };
  const descarregar = async () => {
    setAGerar(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const buf = await gerarExcelFormacao(ExcelJS, { itens: doAno, epoca });
      await descarregarXlsx(buf, `PLANO ANUAL DE FORMACAO ${epoca.replace("/", "-")}.xlsx`);
    } catch (e) {
      notificar(`Não foi possível gerar o Excel: ${e?.message || e}`, "erro");
    } finally {
      setAGerar(false);
    }
  };

  const q = normChave(texto);
  const visiveis = doAno
    .filter((i) => fEstado === "todos" || i.estado === fEstado)
    .filter((i) => !q || normChave([i.conteudo, i.objetivo, i.orador, i.local, i.publico, i.area].join(" ")).includes(q))
    .sort((a, b) => String(a.data || "9999").localeCompare(String(b.data || "9999")) || (Number(a.num) || 0) - (Number(b.num) || 0));
  const th = { ...thStyle, whiteSpace: "nowrap" };
  const btn = { ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 };

  // Resumo mensal (agosto a julho)
  const porMes = mesesDaEpoca(epoca).map(({ ano, mes }) => {
    const l = doAno.filter((i) => i.data && i.data.startsWith(`${ano}-${String(mes + 1).padStart(2, "0")}`));
    return { mes: MESES_CURTOS[mes], total: l.length, concl: l.filter((i) => i.estado === "Concluída").length, part: l.filter((i) => i.estado === "Concluída").reduce((a, i) => a + (Number(i.participantes) || 0), 0) };
  });
  const maxMes = Math.max(1, ...porMes.map((m) => m.total));
  const porFormato = FORMATOS_FORM.map((f) => ({ f, n: doAno.filter((i) => i.formato === f).length })).filter((x) => x.n);

  return (
    <div ref={fotoRef}>
      {editar && <EditorFormacao inicial={editar} sugestoes={sugestoes} onGuardar={guardarItem} onApagar={apagar} onFechar={() => setEditar(null)} />}
      {importado && (
        <JanelaSGQ
          titulo="Importar o plano de formação"
          largura={560}
          onFechar={() => setImportado(null)}
          rodape={
            <>
              <span style={{ flex: 1 }} />
              <button onClick={() => setImportado(null)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
                Cancelar
              </button>
              <button onClick={confirmar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}>
                {itens.some((i) => epocaDaAcao(i) === importado.epoca) ? `Substituir ${importado.epoca}` : "Importar"}
              </button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: COLORS.ink2, lineHeight: 1.6, display: "grid", gap: 10 }}>
            <div>
              <strong style={{ color: COLORS.ink }}>{importado.itens.length} ações</strong> na folha «{importado.folha}» · {importado.itens.filter((i) => i.estado === "Concluída").length} concluídas
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>Época</span>
              <select value={importado.epoca} onChange={(e) => setImportado({ ...importado, epoca: e.target.value })} style={{ ...inputStyle, width: "auto" }}>
                {[...new Set([importado.epoca, ...epocas])].sort().reverse().map((ep) => (
                  <option key={ep} value={ep}>
                    {ep}
                  </option>
                ))}
              </select>
            </div>
            {importado.avisos.map((a, k) => (
              <div key={k} style={{ color: COLORS.warn }}>
                {a}
              </div>
            ))}
            {itens.some((i) => epocaDaAcao(i) === importado.epoca) && <div>As ações que já estão em {importado.epoca} são substituídas pelas do ficheiro.</div>}
          </div>
        </JanelaSGQ>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <select value={epoca} onChange={(e) => setEpoca(e.target.value)} style={{ ...inputStyle, width: "auto", fontWeight: 600 }}>
          {epocas.map((ep) => (
            <option key={ep} value={ep}>
              Época {ep}
            </option>
          ))}
        </select>
        {segSGQ(
          [
            ["calendario", "Calendário"],
            ["plano", `Plano · ${doAno.length}`],
            ["resumo", "Resumo"],
          ],
          vista,
          setVista
        )}
        <span style={{ flex: 1 }} />
        {doAno.length > 0 && <BotaoFoto alvo={fotoRef} titulo={`Plano de formação · Época ${epoca}`} subtitulo={vista === "calendario" ? "Calendário das formações" : "Plano e execução"} nome={`Plano de formacao ${String(epoca).replace("/", "-")} ${isoDe(new Date())}`} />}
        <label className="press semFoto" style={{ ...btn, cursor: "pointer" }}>
          <FileText size={14} /> {aLer ? "A ler…" : "Importar Excel"}
          <input type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => importar(e.target.files && e.target.files[0])} />
        </label>
        {doAno.length > 0 && (
          <button className="press semFoto" disabled={aGerar} onClick={descarregar} style={btn}>
            <Printer size={14} /> {aGerar ? "A gerar…" : "Descarregar Excel"}
          </button>
        )}
        <button className="press semFoto" onClick={() => novo()} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "7px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nova ação
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Ações no plano" value={r.total} subtitle={r.semData ? `${r.semData} sem data` : undefined} />
        <StatCard label="Concluídas" value={r.concluidas} color={COLORS.ok} subtitle={r.taxa === null ? undefined : `${pctForm(r.taxa)} do plano`} />
        <StatCard label="Presenças" value={r.participantes} subtitle="soma das ações concluídas" />
        <StatCard label="Adesão média" value={pctForm(r.adesao)} />
        <StatCard label="Satisfação média" value={pctForm(r.satisfacao)} />
        <StatCard label="Eficácia média" value={pctForm(r.eficacia)} />
      </div>

      {doAno.length === 0 && vista !== "calendario" ? (
        <Vazio icon={FileText} titulo={`Sem ações em ${epoca}`} texto="Importa o Excel do plano anual de formação ou cria as ações à mão." />
      ) : vista === "calendario" ? (
        <CalendarioFormacao epoca={epoca} itens={doAno} onAbrir={setEditar} onNovaNoDia={(iso) => novo(iso)} />
      ) : vista === "plano" ? (
        <div style={{ ...panelStyle, marginBottom: 0 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 340 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.slate }} />
              <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pesquisar conteúdo, orador, local…" style={{ ...inputStyle, paddingLeft: 32 }} />
            </div>
            {segSGQ([["todos", "Todas"], ...ESTADOS_FORM.map((e) => [e, `${e} · ${doAno.filter((i) => i.estado === e).length}`])], fEstado, setFEstado)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>ID</th>
                  <th style={th}>Data</th>
                  <th style={th}>Conteúdo</th>
                  <th style={th}>Formato</th>
                  <th style={th}>Orador</th>
                  <th style={th}>Local</th>
                  <th style={th}>Público-alvo</th>
                  <th style={th}>Estado</th>
                  <th style={{ ...th, textAlign: "right" }}>Part.</th>
                  <th style={{ ...th, textAlign: "right" }}>Adesão</th>
                  <th style={{ ...th, textAlign: "right" }}>Satisf.</th>
                  <th style={{ ...th, textAlign: "right" }}>Eficácia</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => {
                  const [cor, fundo] = corEstadoForm(i.estado);
                  return (
                    <tr key={i.id} className="rowHover" onClick={() => setEditar(i)} style={{ cursor: "pointer" }}>
                      <td style={{ ...tdStyle, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>{i.num ?? ""}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{i.data ? dataCurta(i.data) : <span style={{ color: COLORS.warn }}>sem data</span>}</td>
                      <td style={{ ...tdStyle, minWidth: 240 }}>
                        <div style={{ fontWeight: 600 }}>{i.conteudo}</div>
                        {i.objetivo && <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 2 }}>{i.objetivo}</div>}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", color: COLORS.ink2 }}>{i.formato || "—"}</td>
                      <td style={{ ...tdStyle, minWidth: 140, color: COLORS.ink2 }}>{i.orador || "—"}</td>
                      <td style={{ ...tdStyle, minWidth: 130, color: COLORS.ink2 }}>{i.local || "—"}</td>
                      <td style={{ ...tdStyle, minWidth: 110, color: COLORS.ink2 }}>{i.publico || "—"}</td>
                      <td style={tdStyle}>
                        <Tag label={i.estado || "Planeada"} color={cor} bg={fundo} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{i.participantes ?? "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pctForm(i.adesao)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pctForm(i.satisfacao)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{pctForm(i.eficacia)}</td>
                    </tr>
                  );
                })}
                {!visiveis.length && (
                  <tr>
                    <td colSpan={12} style={{ ...tdStyle, color: COLORS.slate, textAlign: "center", padding: 20 }}>
                      Nenhuma ação com estes filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
          <div style={{ ...panelStyle, marginBottom: 0 }}>
            <div style={{ ...panelTitle }}>Ações por mês</div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {porMes.map((m) => (
                <div key={m.mes} style={{ display: "grid", gridTemplateColumns: "34px 1fr 64px", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                  <span style={{ color: COLORS.slate }}>{m.mes}</span>
                  <div style={{ height: 14, background: COLORS.paperSunken, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${(m.total / maxMes) * 100}%`, background: COLORS.navyWash }} />
                    <div style={{ position: "absolute", inset: 0, width: `${(m.concl / maxMes) * 100}%`, background: COLORS.navy }} />
                  </div>
                  <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: m.total ? COLORS.ink : COLORS.slate }}>
                    {m.concl}/{m.total}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 10 }}>Escuro: concluídas · claro: no plano</div>
          </div>
          <div style={{ ...panelStyle, marginBottom: 0 }}>
            <div style={{ ...panelTitle }}>Por formato e estado</div>
            <div style={{ display: "grid", gap: 6, marginTop: 8, fontSize: 13 }}>
              {porFormato.map((x) => (
                <div key={x.f} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{x.f}</span>
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>{x.n}</strong>
                </div>
              ))}
              {!porFormato.length && <span style={{ color: COLORS.slate }}>Sem formato indicado.</span>}
              <div style={{ borderTop: `1px solid ${COLORS.ruleSoft}`, margin: "6px 0" }} />
              {ESTADOS_FORM.map((e) => (
                <div key={e} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Tag label={e} color={corEstadoForm(e)[0]} bg={corEstadoForm(e)[1]} />
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>{doAno.filter((i) => (i.estado || "Planeada") === e).length}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
