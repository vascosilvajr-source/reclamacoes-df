// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import React, { useState, useMemo, useRef } from "react";
import { lerObjetivosDoExcel, gerarExcelObjetivos, acompanhamento, sugerirFonte, mesesDaFonte, copiarEpocaObjetivos, epocaSeguinteObj, folhaObjetivos, FONTES_OBJ, MODOS_TOTAL, NOMES_MESES_OBJ, lerMeta, metaNumerica, mostrarValor, lerValorEscrito } from "../sgq";
import { Plus, Search, Sparkles, FileText, Printer, Target } from "lucide-react";
import { COLORS, StatCard, Vazio, epocaDe, inputStyle, isoDe, labelStyle, linkBtnStyle, normChave, panelStyle, primaryBtnStyle, secondaryBtnStyle } from "../nucleo.jsx";
import { BotaoFoto, JanelaSGQ, abrirLivroExcel, descarregarXlsx, fmtNum, nomeComVersao, thStyle } from "../partilhado.jsx";

// ======================= MAPA DE OBJETIVOS =======================
const ESTADO_OBJ = {
  ok: { rotulo: "Atingido", cor: () => COLORS.ok, bg: () => COLORS.okBg },
  quase: { rotulo: "Quase atingido", cor: () => COLORS.warn, bg: () => COLORS.warnBg },
  risco: { rotulo: "Ainda não", cor: () => COLORS.slate, bg: () => COLORS.paperSunken },
  falha: { rotulo: "Não atingido", cor: () => COLORS.danger, bg: () => COLORS.dangerBg },
};
function EstadoObjetivo({ estado, fim }) {
  if (!estado) return <span style={{ fontSize: 11.5, color: COLORS.slate }}>—</span>;
  const e = ESTADO_OBJ[estado];
  const rotulo = estado === "ok" && !fim ? "Na meta" : estado === "quase" && !fim ? "Quase na meta" : e.rotulo;
  return <span style={{ fontSize: 11, fontWeight: 600, color: e.cor(), background: e.bg(), borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{rotulo}</span>;
}

function CelulaMes({ valor, auto, fmt, onGuardar, desligada }) {
  const [aEditar, setAEditar] = useState(false);
  const [t, setT] = useState("");
  const mostrado = mostrarValor(valor, fmt);
  if (aEditar)
    return (
      <input
        autoFocus
        value={t}
        onChange={(e) => setT(e.target.value)}
        onBlur={() => {
          setAEditar(false);
          onGuardar(lerValorEscrito(t, fmt));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setAEditar(false);
        }}
        style={{ width: "100%", minWidth: 44, boxSizing: "border-box", border: `1px solid ${COLORS.navy}`, borderRadius: 5, padding: "3px 4px", fontSize: 12, textAlign: "center", background: COLORS.paperRaised, color: COLORS.ink, fontFamily: "inherit" }}
      />
    );
  return (
    <button
      type="button"
      disabled={desligada}
      onClick={() => {
        setT(auto ? "" : mostrado);
        setAEditar(true);
      }}
      title={auto ? "Dos dados da app. Escreve um valor para o substituir." : "Escrever valor"}
      style={{ width: "100%", minWidth: 34, minHeight: 24, border: "1px solid transparent", borderRadius: 5, background: "transparent", cursor: desligada ? "default" : "text", fontSize: 12, fontVariantNumeric: "tabular-nums", color: auto ? COLORS.navy : COLORS.ink, fontWeight: auto ? 500 : 600, padding: "3px 2px", fontFamily: "inherit" }}
    >
      {mostrado || <span style={{ color: COLORS.rule }}>·</span>}
    </button>
  );
}

function EditorObjetivo({ inicial, ep, intencoes, objetivosLista, escolas, previa, onGuardar, onApagar, onFechar }) {
  const [it, setIt] = useState(() => ({ ...inicial, meses: [...(inicial.meses || Array(12).fill(null))] }));
  const muda = (k, v) => setIt((x) => ({ ...x, [k]: v }));
  const fonte = it.fonte || null;
  const F = fonte && FONTES_OBJ[fonte.tipo];
  const mudaFonte = (k, v) => setIt((x) => ({ ...x, fonte: { ...(x.fonte || {}), [k]: v } }));
  const area = (k, rotulo, linhas = 2, lista) => (
    <div>
      <label style={{ ...labelStyle, marginTop: 0 }}>{rotulo}</label>
      {lista ? (
        <>
          <input value={it[k] || ""} onChange={(e) => muda(k, e.target.value)} list={`obj-${k}`} style={inputStyle} />
          <datalist id={`obj-${k}`}>
            {lista.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </>
      ) : (
        <textarea rows={linhas} value={it[k] ?? ""} onChange={(e) => muda(k, e.target.value)} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
      )}
    </div>
  );
  const auto = previa ? mesesDaFonte(it.fonte, ep, previa) : null;
  const metaTexto = typeof it.meta === "number" ? mostrarValor(it.meta, it.metaFmt) : it.meta || "";
  const valido = String(it.indicador || "").trim() || String(it.objetivo || "").trim();
  return (
    <JanelaSGQ
      titulo={inicial.__novo ? "Novo indicador" : it.indicador || it.objetivo || "Indicador"}
      largura={900}
      onFechar={onFechar}
      rodape={
        <>
          {!inicial.__novo && (
            <button onClick={() => onApagar(it.id)} style={{ ...linkBtnStyle, marginTop: 0, color: COLORS.danger }}>
              Apagar linha
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
            Cancelar
          </button>
          <button
            disabled={!valido}
            onClick={() => {
              const x = { ...it };
              delete x.__novo;
              if (x.fonte && !x.fonte.tipo) x.fonte = null;
              onGuardar(x);
            }}
            style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px", opacity: valido ? 1 : 0.5 }}
          >
            Guardar
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {area("intencao", "Intenção da política", 2, intencoes)}
          {area("objetivo", "Objetivo", 2, objetivosLista)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          {area("indicador", "Indicador (KPI)", 2)}
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Meta</label>
            <input
              value={metaTexto}
              disabled={it.metaCalc === "ativos"}
              onChange={(e) => {
                const v = e.target.value;
                const n = lerValorEscrito(v, it.metaFmt);
                setIt((x) => ({ ...x, meta: typeof n === "number" && /^[\d.,\s%]+$/.test(v.trim()) ? n : v, metaFormula: undefined, metaFmt: /%$/.test(v.trim()) ? "0.00%" : x.metaFmt }));
              }}
              placeholder="Ex.: Inferior a 5% · 450 · Igual ou superior a 75%"
              style={inputStyle}
            />
            <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>
              {it.metaCalc === "ativos"
                ? "Calculada: inscrições ÷ (1 + desistências) do grupo."
                : (() => {
                    const m = lerMeta(it);
                    return m ? `A app lê: ${{ "<": "abaixo de", "<=": "até", ">": "acima de", ">=": "pelo menos" }[m.op]} ${m.pct ? `${fmtNum(m.v * 100, 2)}%` : fmtNum(m.v, 2)}` : "Sem número: não dá para dizer se foi atingida.";
                  })()}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          {area("processo", "Processo associado", 1)}
          {area("responsavel", "Responsável", 1)}
          {area("meios", "Meios associados", 1)}
          {area("prazo", "Prazo", 1)}
          {area("monitorizacao", "Monitorização", 1)}
        </div>
        {area("atividades", "Atividades a desenvolver", 3)}

        <div style={{ ...panelStyle, marginBottom: 0, padding: 14, background: COLORS.paperSunken }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Dados da app</div>
          <div style={{ fontSize: 12, color: COLORS.ink2, marginBottom: 10 }}>Os meses que não escreveres são preenchidos com os dados da app e atualizam-se sozinhos (ex.: cada importação semanal de inscritos).</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Fonte</label>
              <select value={(fonte && fonte.tipo) || ""} onChange={(e) => setIt((x) => ({ ...x, fonte: e.target.value ? { ...(x.fonte || {}), tipo: e.target.value } : null }))} style={inputStyle}>
                <option value="">Sem ligação (escrito à mão)</option>
                {Object.entries(FONTES_OBJ).map(([k, f]) => (
                  <option key={k} value={k}>
                    {f.rotulo}
                  </option>
                ))}
              </select>
            </div>
            {F && F.escola && (
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
                <select value={fonte.escola || ""} onChange={(e) => mudaFonte("escola", e.target.value)} style={inputStyle}>
                  <option value="">Todas as escolas</option>
                  {escolas.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {F && F.filtro && (
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>{F.filtro}</label>
                <input value={fonte.filtro || ""} onChange={(e) => mudaFonte("filtro", e.target.value)} placeholder="(opcional)" style={inputStyle} />
              </div>
            )}
          </div>
          {F && (
            <div style={{ fontSize: 12, marginTop: 10, color: auto ? COLORS.navy : COLORS.slate }}>
              {auto
                ? `Na época ${ep}: ${auto
                    .map((v, k) => (v === null || v === undefined ? null : `${NOMES_MESES_OBJ[k]} ${mostrarValor(v, it.mesFmt || F.fmt)}`))
                    .filter(Boolean)
                    .join(" · ") || "sem valores"}`
                : `A app ainda não tem dados disto em ${ep}.`}
            </div>
          )}
        </div>

        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Acompanhamento escrito à mão</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(48px, 1fr))", gap: 4, overflowX: "auto" }}>
            {NOMES_MESES_OBJ.map((m, k) => (
              <div key={k} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: COLORS.slate, textTransform: "uppercase", marginBottom: 2 }}>{m}</div>
                <input
                  defaultValue={mostrarValor(it.meses[k], it.mesFmt || (F && F.fmt))}
                  placeholder={auto && auto[k] !== null && auto[k] !== undefined ? mostrarValor(auto[k], it.mesFmt || (F && F.fmt)) : ""}
                  onBlur={(e) => {
                    const v = lerValorEscrito(e.target.value, it.mesFmt || (F && F.fmt));
                    setIt((x) => ({ ...x, meses: x.meses.map((y, j) => (j === k ? v : y)) }));
                  }}
                  style={{ ...inputStyle, padding: "5px 4px", fontSize: 12, textAlign: "center" }}
                />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Total (coluna TOTAL)</label>
            <select
              value={F && !it.totalFixo && it.totalModo !== "diferenca" ? "__fonte" : it.totalModo || "soma"}
              onChange={(e) => (e.target.value === "__fonte" ? setIt((x) => ({ ...x, totalFixo: false })) : setIt((x) => ({ ...x, totalModo: e.target.value, totalFixo: true })))}
              style={inputStyle}
            >
              {F && <option value="__fonte">Como a fonte ({MODOS_TOTAL[F.total].toLowerCase()})</option>}
              {Object.entries(MODOS_TOTAL)
                .filter(([k]) => k !== "formula" || it.totalFormula)
                .map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
            </select>
          </div>
          {(it.totalModo === "valor" || it.totalModo === "formula") && !(F && !it.totalFixo) && (
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Valor do total</label>
              <input defaultValue={mostrarValor(it.totalValor, it.totalFmt)} onBlur={(e) => muda("totalValor", lerValorEscrito(e.target.value, it.totalFmt))} style={inputStyle} />
            </div>
          )}
          {it.totalModo === "razao" && (
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Dividir por</label>
              <input defaultValue={it.totalDenominador ?? ""} onBlur={(e) => setIt((x) => ({ ...x, totalDenominador: Number(String(e.target.value).replace(",", ".")) || null, totalDenominadorTexto: undefined }))} style={inputStyle} />
            </div>
          )}
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Coluna ao lado do total</label>
            <select value={it.xModo || ""} onChange={(e) => muda("xModo", e.target.value || null)} style={inputStyle}>
              <option value="">Nada</option>
              <option value="taxa">Taxa (desistências ÷ inscrições + desistências)</option>
              <option value="cumprimento">% da meta (total ÷ meta)</option>
            </select>
          </div>
        </div>
      </div>
    </JanelaSGQ>
  );
}

export function ObjetivosPage({ objetivos, onGuardar, notificar, contexto, escolas, documentos }) {
  const epocasO = Object.keys((objetivos && objetivos.epocas) || {}).sort().reverse();
  const epAtual = epocaDe(isoDe(new Date()));
  const [ep, setEp] = useState(() => (epocasO.includes(epAtual) ? epAtual : epocasO[0] || epAtual));
  const epSel = epocasO.includes(ep) ? ep : epocasO[0] || ep;
  const dadosEp = ((objetivos && objetivos.epocas) || {})[epSel] || { itens: [] };
  const [editar, setEditar] = useState(null);
  const [importado, setImportado] = useState(null);
  const [aLer, setALer] = useState(false);
  const [aGerar, setAGerar] = useState(false);
  const fotoRef = useRef(null);
  const [texto, setTexto] = useState("");
  const [fEstado, setFEstado] = useState("todos");
  const [fResp, setFResp] = useState("");

  const acomp = useMemo(() => acompanhamento(epSel, dadosEp, contexto), [epSel, dadosEp, contexto]);
  const { itens, calc } = acomp;
  const guardarEpoca = (mud) => onGuardar({ ...(objetivos || {}), epocas: { ...((objetivos && objetivos.epocas) || {}), [epSel]: { ...dadosEp, ...mud } } });
  const guardarItens = (novos) => guardarEpoca({ itens: novos });
  const original = (id) => (dadosEp.itens || []).find((i) => i.id === id);
  const mudaMes = (id, k, v) => guardarItens((dadosEp.itens || []).map((i) => (i.id === id ? { ...i, meses: (i.meses || Array(12).fill(null)).map((x, j) => (j === k ? v : x)) } : i)));
  const guardarItem = (item) => {
    const lista = dadosEp.itens || [];
    const existe = lista.some((i) => i.id === item.id);
    let nova;
    if (existe) nova = lista.map((i) => (i.id === item.id ? item : i));
    else {
      // Fica junto das linhas da mesma intenção (ou no fim).
      const ult = lista.map((i, k) => (i.intencao === item.intencao ? k : -1)).filter((k) => k >= 0).pop();
      nova = ult === undefined ? [...lista, item] : [...lista.slice(0, ult + 1), item, ...lista.slice(ult + 1)];
    }
    guardarItens(nova);
    setEditar(null);
    notificar(existe ? "Indicador atualizado." : "Indicador acrescentado.");
  };
  const apagar = (id) => {
    if (!window.confirm("Apagar esta linha do mapa de objetivos?")) return;
    guardarItens((dadosEp.itens || []).filter((i) => i.id !== id));
    setEditar(null);
  };
  const novo = (base = {}) =>
    setEditar({ __novo: true, id: `obj-${Date.now().toString(36)}`, grupo: `g-${Date.now().toString(36)}`, intencao: "", objetivo: "", indicador: "", meta: "", metaFmt: "", processo: "", responsavel: "", meios: "", atividades: "", prazo: `Final da época ${epSel}`, monitorizacao: "Mensal", meses: Array(12).fill(null), totalModo: "soma", fonte: null, ...base });

  // Sugestões de ligação aos dados da app (linhas sem fonte).
  // Só sugere ligar quando a app tem mesmo dados disso nesta época.
  const temDados = (f, e) => {
    const m = f ? mesesDaFonte(f, e, contexto) : null;
    return !!(m && m.some((v) => v !== null && v !== undefined));
  };
  const sugestoes = (dadosEp.itens || []).map((i) => (!i.fonte && !i.semFonte ? { id: i.id, f: sugerirFonte(i, escolas) } : null)).filter((x) => x && x.f && temDados(x.f, epSel));
  const aplicarSugestoes = () => {
    const por = Object.fromEntries(sugestoes.map((s) => [s.id, s.f]));
    guardarItens((dadosEp.itens || []).map((i) => (por[i.id] ? { ...i, fonte: por[i.id] } : i)));
    notificar(`${sugestoes.length} indicadores ligados aos dados da app.`);
  };

  const importar = async (f) => {
    if (!f) return;
    setALer(true);
    try {
      const wb = await abrirLivroExcel(f);
      const r = lerObjetivosDoExcel(wb);
      const eps = Object.keys(r.epocas).sort();
      if (!eps.length) throw new Error(r.avisos.join(" ") || "não encontrei folhas de época");
      setImportado({ ...r, eps, sobrepoe: eps.filter((e) => ((objetivos && objetivos.epocas) || {})[e]) });
    } catch (e) {
      notificar(`Não consegui ler o ficheiro: ${e?.message || e}`, "erro");
    } finally {
      setALer(false);
    }
  };
  const confirmar = (substituir) => {
    const epocas = { ...((objetivos && objetivos.epocas) || {}) };
    const ultima = importado.eps[importado.eps.length - 1];
    importado.eps.forEach((e) => {
      if (epocas[e] && !substituir) return;
      const d = importado.epocas[e];
      // Ao atualizar uma época, as ligações aos dados que já existiam mantêm-se.
      const chave = (i) => normChave(`${i.objetivo}|${i.indicador}`);
      const antes = Object.fromEntries((((epocas[e] || {}).itens) || []).filter((i) => i.fonte).map((i) => [chave(i), i.fonte]));
      const liga = (i) => {
        if (antes[chave(i)]) return antes[chave(i)];
        const f = sugerirFonte(i, escolas);
        return f && temDados(f, e) ? f : null;
      };
      epocas[e] = { ...d, itens: d.itens.map((i) => ({ ...i, fonte: i.fonte || liga(i) })) };
    });
    onGuardar({ ...(objetivos || {}), epocas });
    setEp(ultima);
    notificar(`Importadas ${importado.eps.length} épocas do mapa de objetivos.`);
    setImportado(null);
  };
  const novaEpoca = () => {
    const seg = epocaSeguinteObj(epocasO[0] || epSel);
    if (((objetivos && objetivos.epocas) || {})[seg]) return setEp(seg);
    // A época nova começa vazia: os objetivos entram pelo Excel ou à mão.
    const ano = Number(seg.slice(0, 4));
    onGuardar({ ...(objetivos || {}), epocas: { ...((objetivos && objetivos.epocas) || {}), [seg]: { titulo: `MAPA DE OBJECTIVOS ${ano}/${ano + 1}`, anos: [ano, ano + 1], itens: [] } } });
    setEp(seg);
    notificar(`Época ${seg} criada, vazia. Importa o Excel ou acrescenta os indicadores.`);
  };
  // Opcional: trazer as linhas de outra época (sem valores) para servir de base.
  const anteriorComLinhas = epocasO.filter((e) => e < epSel && (((objetivos && objetivos.epocas) || {})[e] || {}).itens?.length)[0];
  const copiarEstrutura = () => {
    const base = objetivos.epocas[anteriorComLinhas];
    const copia = copiarEpocaObjetivos(base, epSel);
    copia.itens = copia.itens.map((i) => ({ ...i, fonte: i.fonte || sugerirFonte(i, escolas) }));
    guardarEpoca({ itens: copia.itens });
    notificar(`${copia.itens.length} indicadores copiados de ${anteriorComLinhas}, sem valores. Revê as metas e os responsáveis.`);
  };
  const descarregar = async (apenas) => {
    setAGerar(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const eps = apenas || epocasO;
      const epocas = {};
      const calculos = {};
      eps.forEach((e) => {
        const a = e === epSel ? acomp : acompanhamento(e, objetivos.epocas[e], contexto);
        epocas[e] = { ...objetivos.epocas[e], itens: a.itens };
        calculos[e] = a.calc;
      });
      const buf = await gerarExcelObjetivos(ExcelJS, { epocas, calculos });
      const nome = nomeComVersao(documentos, "DFF.024", "MAPA DE OBJECTIVOS").replace(/\.xlsx$/, apenas && apenas.length === 1 ? ` ${folhaObjetivos(apenas[0])}.xlsx` : ".xlsx");
      await descarregarXlsx(buf, nome);
    } catch (e) {
      notificar(`Não foi possível gerar o Excel: ${e?.message || e}`, "erro");
    } finally {
      setAGerar(false);
    }
  };

  const comMeta = itens.filter((i) => calc[i.id] && calc[i.id].estado);
  const n = (e) => comMeta.filter((i) => calc[i.id].estado === e).length;
  const nAuto = itens.filter((i) => i.temAuto).length;
  const responsaveis = [...new Set(itens.flatMap((i) => String(i.responsavel || "").split(/\n|,| - /).map((x) => x.trim())).filter((x) => x && x.length > 2))].sort((a, b) => a.localeCompare(b, "pt"));
  const q = normChave(texto);
  const visivel = (i) =>
    (!q || normChave([i.intencao, i.objetivo, i.indicador, i.responsavel, i.processo].join(" ")).includes(q)) &&
    (!fResp || String(i.responsavel || "").includes(fResp)) &&
    (fEstado === "todos" || (fEstado === "sem" ? !calc[i.id].estado : fEstado === "auto" ? i.temAuto : calc[i.id].estado === fEstado));
  const vis = itens.filter(visivel);
  // Blocos: intenção → grupos (objetivo) → linhas.
  const blocos = [];
  vis.forEach((i) => {
    let b = blocos[blocos.length - 1];
    if (!b || b.intencao !== i.intencao) blocos.push((b = { intencao: i.intencao, grupos: [] }));
    let g = b.grupos[b.grupos.length - 1];
    if (!g || g.id !== i.grupo) b.grupos.push((g = { id: i.grupo, objetivo: i.objetivo, linhas: [] }));
    g.linhas.push(i);
  });
  const selF = { ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 };
  const th = { ...thStyle, whiteSpace: "nowrap", padding: "8px 6px", fontSize: 10.5 };
  const metaMostrada = (i) => {
    if (i.metaCalc === "ativos") {
      const v = metaNumerica(i, itens);
      return v === null ? "—" : fmtNum(v, 0);
    }
    return typeof i.meta === "number" ? mostrarValor(i.meta, i.metaFmt || "0") : i.meta || "—";
  };
  const anos = dadosEp.anos || [Number(epSel.slice(0, 4)), Number(epSel.slice(0, 4)) + 1];

  const botoes = (
    <span className="semFoto" style={{ display: "contents" }}>
      {(((objetivos && objetivos.epocas) || {})[epSel]?.itens || []).length > 0 && <BotaoFoto alvo={fotoRef} titulo={`Mapa de objetivos · Época ${epSel}`} subtitulo="Balanço face às metas" nome={`Objetivos ${String(epSel).replace("/", "-")} ${isoDe(new Date())}`} />}
      <label className="press" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <FileText size={14} /> {aLer ? "A ler…" : "Importar Excel"}
        <input type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => importar(e.target.files && e.target.files[0])} />
      </label>
      {epocasO.length > 0 && (
        <button className="press" disabled={aGerar} onClick={() => descarregar(null)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Printer size={14} /> {aGerar ? "A gerar…" : "Descarregar Excel"}
        </button>
      )}
    </span>
  );

  return (
    <div ref={fotoRef}>
      {importado && (
        <JanelaSGQ
          titulo="Importar o mapa de objetivos"
          largura={560}
          onFechar={() => setImportado(null)}
          rodape={
            <>
              <span style={{ flex: 1 }} />
              <button onClick={() => setImportado(null)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
                Cancelar
              </button>
              {importado.sobrepoe.length > 0 && importado.sobrepoe.length < importado.eps.length && (
                <button onClick={() => confirmar(false)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
                  Só as épocas novas
                </button>
              )}
              <button onClick={() => confirmar(true)} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}>
                {importado.sobrepoe.length ? "Importar e substituir" : "Importar"}
              </button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: COLORS.ink2, lineHeight: 1.6 }}>
            <div>
              {importado.eps.length} épocas, de {importado.eps[0]} a {importado.eps[importado.eps.length - 1]}.
            </div>
            <div>Na mais recente ({importado.eps[importado.eps.length - 1]}): {importado.epocas[importado.eps[importado.eps.length - 1]].itens.length} indicadores. Nas épocas em que a app tem dados (inscrições, desistências, reclamações, satisfação…), os meses vazios passam a ser preenchidos com eles.</div>
            {importado.avisos.map((a) => (
              <div key={a} style={{ color: COLORS.warn }}>
                {a}
              </div>
            ))}
            {importado.sobrepoe.length > 0 && <div style={{ marginTop: 6, color: COLORS.ink }}>Já existem na app: {importado.sobrepoe.join(", ")}.</div>}
          </div>
        </JanelaSGQ>
      )}
      {editar && (
        <EditorObjetivo
          inicial={editar}
          ep={epSel}
          intencoes={[...new Set((dadosEp.itens || []).map((i) => i.intencao).filter(Boolean))]}
          objetivosLista={[...new Set((dadosEp.itens || []).map((i) => i.objetivo).filter(Boolean))]}
          escolas={escolas}
          previa={contexto}
          onGuardar={guardarItem}
          onApagar={apagar}
          onFechar={() => setEditar(null)}
        />
      )}

      {epocasO.length === 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          <Vazio icon={Target} titulo="Ainda sem mapa de objetivos" texto="Importa o Excel DFF.024 (todas as épocas de uma vez). Os indicadores que a app conhece passam a atualizar-se com os dados de cada semana." />
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
              {epocasO.map((e) => (
                <option key={e} value={e}>
                  Época {e}
                </option>
              ))}
            </select>
            <span style={{ flex: 1 }} />
            {botoes}
            {((((objetivos && objetivos.epocas) || {})[epocasO[0]] || {}).itens || []).length > 0 && <button className="semFoto" onClick={novaEpoca} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13 }} title="Cria a época seguinte, vazia">
              {((objetivos && objetivos.epocas) || {})[epocaSeguinteObj(epocasO[0])] ? "Ir para a época seguinte" : `Criar ${epocaSeguinteObj(epocasO[0])}`}
            </button>}
            <button className="press semFoto" onClick={() => novo()} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "7px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Novo indicador
            </button>
          </div>

          {itens.length === 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              <Vazio icon={Target} titulo={`Época ${epSel} ainda sem objetivos`} texto="Importa o Excel do mapa de objetivos com esta época (atualiza-a) ou acrescenta os indicadores um a um." />
              {anteriorComLinhas && (
                <div style={{ textAlign: "center" }}>
                  <button onClick={copiarEstrutura} style={{ ...linkBtnStyle, fontSize: 12.5 }}>
                    Ou copiar os indicadores de {anteriorComLinhas}, sem valores
                  </button>
                </div>
              )}
            </div>
          ) : (
          <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <StatCard label="Indicadores" value={itens.length} subtitle={`${comMeta.length} com meta e dados`} />
            <StatCard label={acomp.fim ? "Objetivos atingidos" : "Objetivos na meta"} value={comMeta.length ? `${Math.round((n("ok") / comMeta.length) * 100)}%` : "—"} color={n("ok") ? COLORS.ok : undefined} subtitle={`${n("ok")} de ${comMeta.length} com meta e dados`} />
            <StatCard label={acomp.fim ? "Quase atingidos" : "Quase na meta"} value={n("quase")} color={n("quase") ? COLORS.warn : undefined} subtitle="a menos de 10% (ou 3 p.p.) da meta" />
            <StatCard label={acomp.fim ? "Não atingidos" : "Ainda por atingir"} value={n("risco") + n("falha")} color={n("falha") ? COLORS.danger : undefined} subtitle={n("falha") ? `${n("falha")} já sem margem` : undefined} />
            <StatCard label="Com dados da app" value={nAuto} subtitle="atualizam-se sozinhos" />
          </div>

          {sugestoes.length > 0 && (
            <div className="semFoto" style={{ ...panelStyle, marginBottom: 14, borderColor: COLORS.navy, background: COLORS.navyWash, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <Sparkles size={16} color={COLORS.navy} />
              <div style={{ flex: "1 1 300px", fontSize: 13 }}>
                <strong>{sugestoes.length === 1 ? "1 indicador pode" : `${sugestoes.length} indicadores podem`} ser preenchidos com os dados da app</strong>
                <div style={{ fontSize: 12, color: COLORS.ink2, marginTop: 2 }}>{[...new Set(sugestoes.map((s) => FONTES_OBJ[s.f.tipo].rotulo.split(" (")[0]))].join(" · ")}</div>
              </div>
              <button onClick={aplicarSugestoes} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "7px 14px", fontSize: 13 }}>
                Ligar
              </button>
            </div>
          )}

          <div style={{ ...panelStyle, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${COLORS.ruleSoft}` }}>
              <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320 }}>
                <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.slate }} />
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pesquisar objetivo, indicador, escola" style={{ ...inputStyle, paddingLeft: 32, padding: "6px 10px 6px 32px", fontSize: 13 }} />
              </div>
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={selF} aria-label="Estado">
                <option value="todos">Todos os estados</option>
                <option value="ok">Na meta / atingidos</option>
                <option value="quase">Quase atingidos</option>
                <option value="risco">Ainda por atingir</option>
                <option value="falha">Não atingidos</option>
                <option value="sem">Sem meta ou sem dados</option>
                <option value="auto">Com dados da app</option>
              </select>
              <select value={fResp} onChange={(e) => setFResp(e.target.value)} style={{ ...selF, maxWidth: 220 }} aria-label="Responsável">
                <option value="">Todos os responsáveis</option>
                {responsaveis.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: COLORS.slate, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: COLORS.navy, fontWeight: 600 }}>azul</span> = dados da app · carrega num mês para escrever
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1040 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left", paddingLeft: 14 }} rowSpan={2}>
                      Objetivo
                    </th>
                    <th style={{ ...th, textAlign: "left" }} rowSpan={2}>
                      Indicador
                    </th>
                    <th style={{ ...th, textAlign: "left" }} rowSpan={2}>
                      Meta
                    </th>
                    <th style={{ ...th, textAlign: "center", borderBottom: "none" }} colSpan={4}>
                      {anos[0]}
                    </th>
                    <th style={{ ...th, textAlign: "center", borderBottom: "none" }} colSpan={8}>
                      {anos[1]}
                    </th>
                    <th style={{ ...th, textAlign: "center" }} rowSpan={2}>
                      Total
                    </th>
                    <th style={{ ...th, textAlign: "center" }} rowSpan={2}>
                      Estado
                    </th>
                  </tr>
                  <tr>
                    {NOMES_MESES_OBJ.map((m) => (
                      <th key={m} style={{ ...th, textAlign: "center", textTransform: "capitalize" }}>
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blocos.map((b, bi) => (
                    <React.Fragment key={`b${bi}`}>
                      <tr>
                        <td colSpan={17} style={{ padding: "12px 14px 6px", fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", background: COLORS.paperSunken, borderBottom: `1px solid ${COLORS.ruleSoft}` }}>
                          {String(b.intencao || "Sem intenção").replace(/^[\s"“”]+|[\s"“”]+$/g, "")}
                        </td>
                      </tr>
                      {b.grupos.map((g) =>
                        g.linhas.map((i, li) => {
                          const c = calc[i.id] || {};
                          const fmtT = i.totalFmt || (i.totalModo === "porInscritos" || i.totalModo === "razao" ? "0.00%" : i.mesFmt);
                          const ultimo = li === g.linhas.length - 1;
                          const borda = ultimo ? `1px solid ${COLORS.rule}` : `1px solid ${COLORS.ruleSoft}`;
                          return (
                            <tr key={i.id} className="rowHover">
                              {li === 0 && (
                                <td rowSpan={g.linhas.length} style={{ padding: "8px 10px 8px 14px", fontSize: 12.5, fontWeight: 600, verticalAlign: "top", borderBottom: `1px solid ${COLORS.rule}`, maxWidth: 200, minWidth: 150 }}>
                                  {g.objetivo || "—"}
                                  <div style={{ fontSize: 11, fontWeight: 400, color: COLORS.slate, marginTop: 3, whiteSpace: "pre-line" }}>{String(i.responsavel || "").trim().split("\n").filter(Boolean).slice(0, 3).join(", ")}</div>
                                </td>
                              )}
                              <td style={{ padding: "6px 8px", fontSize: 12.5, borderBottom: borda, minWidth: 140, maxWidth: 200 }}>
                                <button onClick={() => setEditar(original(i.id))} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: COLORS.ink, fontSize: 12.5, fontFamily: "inherit" }}>
                                  {i.indicador || "—"}
                                </button>
                                {i.fonte && FONTES_OBJ[i.fonte.tipo] && (
                                  <div style={{ fontSize: 10.5, color: i.temAuto ? COLORS.navy : COLORS.slate, marginTop: 2 }} title={FONTES_OBJ[i.fonte.tipo].rotulo}>
                                    ● {FONTES_OBJ[i.fonte.tipo].rotulo.split(" (")[0]}
                                    {i.fonte.escola ? ` · ${i.fonte.escola}` : ""}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "6px 8px", fontSize: 12, color: COLORS.ink2, borderBottom: borda, maxWidth: 120 }}>{metaMostrada(i)}</td>
                              {(i.mesesEfetivos || []).map((v, k) => (
                                <td key={k} style={{ padding: "2px 1px", borderBottom: borda, textAlign: "center" }}>
                                  <CelulaMes valor={v} auto={i.autoK && i.autoK[k]} fmt={i.mesFmt} onGuardar={(nv) => mudaMes(i.id, k, nv)} desligada={i.totalModo === "diferenca"} />
                                </td>
                              ))}
                              <td style={{ padding: "6px 8px", fontSize: 12.5, fontWeight: 700, textAlign: "center", borderBottom: borda, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                {mostrarValor(c.total, fmtT) || "—"}
                                {c.x !== null && c.x !== undefined && <div style={{ fontSize: 10.5, fontWeight: 500, color: COLORS.slate }}>{i.xModo === "taxa" ? "taxa " : ""}{mostrarValor(c.x, i.xFmt || "0.0%")}</div>}
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "center", borderBottom: borda }}>
                                <EstadoObjetivo estado={c.estado} fim={acomp.fim} />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {vis.length === 0 && <div style={{ padding: 18, fontSize: 13, color: COLORS.slate }}>Nenhum indicador com estes filtros.</div>}
            </div>
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
