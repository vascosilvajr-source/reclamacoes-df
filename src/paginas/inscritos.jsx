// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { linhasDoPdf, lerPlanoSemanal, escolaDoTitulo, unidadesDoNome, sugerirTurmasApp, sufixoDoRecinto, chavePlano, SECAO_EXTRA, DIA_APP } from "../planos";
import { imprimirBalanco } from "../foto";
import { lerMapaInscritosAtuais, epocaDoMapa, compararInscritosAtuais, corteDoAcompanhamento } from "../inscritosAtuais";
import { LOGO_BRANCO } from "../imagens";
import { Plus, X, Check, AlertTriangle, Trash2, Pencil, Sparkles, Users, FileText, Printer, Target } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ReferenceLine, Area, ComposedChart, LabelList } from "recharts";
import { COLORS, DEFAULT_ESPACOS, DEFAULT_MOTIVOS_DESISTENCIA, DEFAULT_NIVEIS, LIMITES_CRESC_PADRAO, MOTIVOS_EXPERIENCIA_PADRAO, SEMANAS_RITMO, StatCard, Tag, Vazio, alunosNaData, balancoSemanal, capacidadeSugerida, classificarCrescimento, contasEvento, epAntDe, epocaDe, escalaoDaTurma, fimDeEpoca, fmt, iconBtnStyle, indicadoresDaEpoca, inputStyle, isoDe, labelStyle, linkBtnStyle, niveisTurmas, normChave, panelStyle, panelTitle, pctDe, previsoesEscolas, primaryBtnStyle, secondaryBtnStyle, segSGQ, semana1Padrao, semanaDaEpoca, semanaLabel, turmasDoBloco, valorCurva } from "../nucleo.jsx";
import { BarrasRel, BotaoFoto, ComparacaoEpocas, DicaGrafico, FiltroEpocas, Filtros, JanelaSGQ, MESES_EPOCA, MES_CURTO, QuadrantMatrix, SemDados, TickEixoX, corSatisfacao, dataDeCelula, epocasDisponiveis, fmtNum, lerCSVInq, lerExcelInq, mesDeData, naSelecao, nomeEscolaProposto, selecaoInicial, tdStyle, textoSelecao, thStyle } from "../partilhado.jsx";

const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const QUEM_PEDIU = ["Encarregado de educação", "Outro clube", "Iniciativa da escola"];

const XP_RESULTADO_META = {
  pendente: { label: "Por avaliar", color: COLORS.warn, bg: COLORS.warnBg },
  sucesso: { label: "Converteu", color: COLORS.ok, bg: COLORS.okBg },
  insucesso: { label: "Não converteu", color: COLORS.danger, bg: COLORS.dangerBg },
};

// Turmas/equipas que treinam juntas (no mesmo horário, nos Espaços) partilham uma só lotação:
// se B1 e D1 treinam juntas, as vagas são para as duas, não para cada uma.
// A lotação do grupo é a definida para o grupo; se não houver, a mais baixa entre as turmas.
// Quando uma turma treina com turmas diferentes em dias diferentes, fica no grupo mais frequente.
function gruposLotacao(escola, nomesTurmas, espacos, capacidades, niveis) {
  const caps = capacidades || {};
  const nomes = [...new Set((nomesTurmas || []).filter(Boolean))];
  const porCompacto = {};
  nomes.forEach((n) => (porCompacto[compactoTurma(n)] = n));
  const resolve = (t) => (nomes.includes(t) ? t : porCompacto[compactoTurma(t)] || null);
  const eEsc = normChave(escola);
  const conjuntos = {};
  (espacos || [])
    .filter((b) => normChave(b.escola) === eEsc)
    .forEach((b) => {
      const ts = [...new Set(turmasDoBloco(b).map(resolve).filter(Boolean))].sort((x, y) => x.localeCompare(y, "pt", { numeric: true }));
      if (ts.length < 2) return;
      const k = ts.join(" + ");
      conjuntos[k] = conjuntos[k] || { turmas: ts, n: 0 };
      conjuntos[k].n++;
    });
  const capTurma = (t) => caps[`${escola}|${t}`] || capacidadeSugerida(t, niveis);
  const grupoDe = {};
  const grupos = [];
  Object.values(conjuntos)
    .sort((a, b) => b.n - a.n || b.turmas.length - a.turmas.length)
    .forEach((c) => {
      if (c.turmas.some((t) => grupoDe[t])) return;
      const chave = `grupo:${c.turmas.join(" + ")}`;
      const propria = caps[`${escola}|${chave}`];
      const g = { chave, turmas: c.turmas, cap: propria || Math.min(...c.turmas.map(capTurma)), propria: !!propria, horarios: c.n };
      grupos.push(g);
      c.turmas.forEach((t) => (grupoDe[t] = g));
    });
  nomes.forEach((t) => {
    if (grupoDe[t]) return;
    const g = { chave: t, turmas: [t], cap: capTurma(t), propria: !!caps[`${escola}|${t}`], horarios: 0, sozinha: true };
    grupos.push(g);
    grupoDe[t] = g;
  });
  return {
    grupos,
    grupoDe,
    // Parte da lotação do grupo que cabe a uma turma (para somas por escalão).
    parte: (t) => (grupoDe[t] ? grupoDe[t].cap / grupoDe[t].turmas.length : capTurma(t)),
    // Lotação de um conjunto de turmas: cada grupo conta uma vez.
    total: (ts) => [...new Set(ts.map((t) => grupoDe[t]).filter(Boolean))].reduce((n, g) => n + g.cap, 0),
  };
}

// Cor da barra de lotação consoante a ocupação.
function corLotacao(pct) {
  if (pct >= 95) return COLORS.danger;
  if (pct >= 80) return COLORS.ok;
  if (pct >= 50) return COLORS.warn;
  return COLORS.slate;
}

// ---------- Componentes partilhados das secções de gestão ----------

// Barra de lotação reutilizada nas turmas e no mapa de espaços.
function BarraLotacao({ pct, largura }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ height: 7, width: largura || 80, background: COLORS.doneBg, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: corLotacao(pct) }} />
      </div>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, color: COLORS.slate }}>{pct}%</span>
    </div>
  );
}

// Época de um registo de desistência ou experiência (a guardada ou a da data).
const epocaRegisto = (x) => x.epoca || epocaDe(x.data);
// Épocas presentes nos registos, da mais recente para a mais antiga, e a escolhida por defeito.
function epocasDosRegistos(lista) {
  const eps = [...new Set(lista.map(epocaRegisto).filter(Boolean))].sort().reverse();
  const atual = epocaDe(isoDe(new Date()));
  return { eps, defeito: eps.includes(atual) ? atual : eps[0] || "todas" };
}

// ---------- Desistências ----------
function SecaoDesistencias({ escolas, turmas, niveis, motivos, desistencias, onSave, onRemove, onGerirLista, procurarAluno }) {
  const [codigo, setCodigo] = useState("");
  const [escola, setEscola] = useState(escolas[0] || "");
  const [turma, setTurma] = useState("");
  const [motivo, setMotivo] = useState(motivos[0] || "");
  const [n, setN] = useState("1");
  const [erro, setErro] = useState("");

  const [fEsc, setFEsc] = useState("todas");
  const [fEsca, setFEsca] = useState("todos");
  const [fMot, setFMot] = useState("todos");
  const epDes = epocasDosRegistos(desistencias);
  const [fEp, setFEp] = useState(() => selecaoInicial(epDes.eps));

  const turmasEscola = [...new Set(turmas.filter((t) => t.escola === escola).map((t) => t.turma))];
  const escaloes = [...new Set(desistencias.map((d) => escalaoDaTurma(d.turma, niveis)))].sort();

  // Sem o filtro de época: serve a comparação entre épocas.
  const semEpoca = desistencias
    .filter((d) => (fEsc === "todas" ? true : d.escola === fEsc))
    .filter((d) => (fEsca === "todos" ? true : escalaoDaTurma(d.turma, niveis) === fEsca))
    .filter((d) => (fMot === "todos" ? true : d.motivo === fMot));
  const porEpoca = epDes.eps.filter((ep) => naSelecao(fEp.length > 1 ? fEp : [], ep)).map((ep) => {
    const doEp = semEpoca.filter((d) => epocaRegisto(d) === ep);
    const mot = {};
    doEp.forEach((d) => (mot[d.motivo] = (mot[d.motivo] || 0) + d.n));
    const top = Object.entries(mot).sort((a, b) => b[1] - a[1])[0];
    return { ep, total: doEp.reduce((t, d) => t + d.n, 0), registos: doEp.length, top };
  });

  const lista = desistencias
    .filter((d) => naSelecao(fEp, epocaRegisto(d)))
    .filter((d) => (fEsc === "todas" ? true : d.escola === fEsc))
    .filter((d) => (fEsca === "todos" ? true : escalaoDaTurma(d.turma, niveis) === fEsca))
    .filter((d) => (fMot === "todos" ? true : d.motivo === fMot))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const total = lista.reduce((s, d) => s + d.n, 0);
  const porMotivo = motivos
    .map((m) => ({ m, n: lista.filter((d) => d.motivo === m).reduce((s, d) => s + d.n, 0) }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);

  const guardar = () => {
    const cod = codigo.trim();
    if (!cod) {
      setErro("Indica o código do atleta.");
      return;
    }
    if (!turma) {
      setErro("Escolhe a turma.");
      return;
    }
    const hojeIso = isoDe(new Date());
    if (desistencias.some((d) => String(d.alunoId) === cod && d.epoca === epocaDe(hojeIso))) {
      setErro(`O atleta ${cod} já tem uma desistência registada nesta época.`);
      return;
    }
    setErro("");
    onSave({ id: `d_${Date.now()}`, alunoId: cod, epoca: epocaDe(hojeIso), escola, turma, motivo, n: 1, data: hojeIso, origem: "manual" });
    setCodigo("");
  };

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Registar desistência</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Código do atleta</label>
            <input
              value={codigo}
              onChange={(e) => {
                const v = e.target.value;
                setCodigo(v);
                setErro("");
                const a = procurarAluno && procurarAluno(v.trim());
                if (a) {
                  setEscola(a.escola);
                  setTurma(a.turma || "");
                }
              }}
              placeholder="ex.: 22534"
              style={{ ...inputStyle, width: 140 }}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={escola} onChange={(e) => { setEscola(e.target.value); setTurma(""); }} style={{ ...inputStyle, width: 170 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Turma / equipa</label>
            <select value={turma} onChange={(e) => setTurma(e.target.value)} style={{ ...inputStyle, width: 165 }}>
              <option value="">{turmasEscola.length ? "Selecionar..." : "Sem turmas nesta escola"}</option>
              {turmasEscola.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <label style={{ ...labelStyle, marginTop: 0 }}>Motivo</label>
              <button type="button" onClick={() => onGerirLista("motivosDesistencia")} style={{ ...linkBtnStyle, marginTop: 0 }}>Gerir</button>
            </div>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ ...inputStyle, width: 230 }}>
              {motivos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <button onClick={guardar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>Registar</button>
        </div>
        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erro}</div>}
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 9 }}>
          Ao escrever um código que já está nos inscritos, a escola e a turma preenchem-se sozinhas e o atleta passa a contar como desistência.
        </div>
      </div>

      <Filtros>
        <FiltroEpocas epocas={epDes.eps} valor={fEp} onChange={setFEp} />
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={fEsca} onChange={(e) => setFEsca(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="todos">Todos os escalões</option>
          {escaloes.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <select value={fMot} onChange={(e) => setFMot(e.target.value)} style={{ ...inputStyle, width: 230 }}>
          <option value="todos">Todos os motivos</option>
          {motivos.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Filtros>

      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Desistências" value={total} color={COLORS.danger} subtitle={textoSelecao(fEp).toLowerCase()} />
        <StatCard label="Registos" value={lista.length} />
        <StatCard label="Motivo mais frequente" value={porMotivo.length ? porMotivo[0].n : "—"} subtitle={porMotivo.length ? porMotivo[0].m : ""} />
      </div>

      {porEpoca.length > 1 && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={panelTitle}>Por época</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Época", "Desistências", "Registos", "Motivo mais frequente"].map((h, i) => (
                    <th key={h} style={{ ...thStyle, textAlign: i === 1 || i === 2 ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porEpoca.map((x) => (
                  <tr key={x.ep} onClick={() => setFEp([x.ep])} style={{ cursor: "pointer", background: fEp.length === 1 && fEp[0] === x.ep ? COLORS.paperSunken : "transparent" }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{x.ep}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{x.total}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{x.registos}</td>
                    <td style={{ ...tdStyle, fontSize: 12.5 }}>{x.top ? `${x.top[0]} (${x.top[1]})` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <SemDados texto="Sem desistências para os filtros selecionados." />
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ ...panelStyle, flex: "1 1 300px" }}>
            <div style={panelTitle}>Por motivo</div>
            {porMotivo.map((x) => (
              <div key={x.m} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 13 }}>{x.m}</div>
                <div style={{ height: 7, width: 110, background: COLORS.doneBg, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(x.n / porMotivo[0].n) * 100}%`, background: COLORS.danger }} />
                </div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, width: 24, textAlign: "right" }}>{x.n}</div>
              </div>
            ))}
          </div>
          <div style={{ ...panelStyle, flex: "1 1 380px" }}>
            <div style={panelTitle}>Registos ({lista.length})</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Data", "Código", "Escola", "Turma", "Escalão", "Motivo", "Nº", ""].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((d) => (
                    <tr key={d.id}>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{d.data}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{d.alunoId || "—"}</td>
                      <td style={tdStyle}>{d.escola}</td>
                      <td style={tdStyle}>{d.turma}</td>
                      <td style={tdStyle}>{escalaoDaTurma(d.turma, niveis)}</td>
                      <td style={{ ...tdStyle, fontSize: 12.5 }}>{d.motivo}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{d.n}</td>
                      <td style={tdStyle}>
                        <button title="Remover" onClick={() => onRemove(d.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const ehMotivoTecnico = (m) => /t[eé]cnic/i.test(String(m || ""));

// Não conversões: motivos e turmas/equipas com muitas experiências não convertidas.
function PainelNaoConversoes({ lista, motivos }) {
  const nao = lista.filter((x) => x.resultado === "insucesso");
  if (!lista.length) return null;
  const porMotivo = {};
  nao.forEach((x) => (porMotivo[x.motivo || "Sem motivo"] = (porMotivo[x.motivo || "Sem motivo"] || 0) + (x.n || 1)));
  const turmas = {};
  lista
    .filter((x) => x.turma && (x.resultado === "sucesso" || x.resultado === "insucesso"))
    .forEach((x) => {
      const k = `${x.escola}|${x.turma}`;
      const t = (turmas[k] = turmas[k] || { escola: x.escola, turma: x.turma, dec: 0, nao: 0, tec: 0 });
      t.dec += x.n || 1;
      if (x.resultado === "insucesso") {
        t.nao += x.n || 1;
        if (ehMotivoTecnico(x.motivo)) t.tec += x.n || 1;
      }
    });
  const alerta = Object.values(turmas)
    .filter((t) => t.nao >= 3 && t.nao * 2 >= t.dec)
    .sort((a, b) => b.nao - a.nao);
  const tecnicos = nao.filter((x) => ehMotivoTecnico(x.motivo));
  const ordem = [...(motivos || []), "Sem motivo"];
  const linhasMotivo = Object.entries(porMotivo).sort((a, b) => b[1] - a[1] || ordem.indexOf(a[0]) - ordem.indexOf(b[0]));
  const totalNao = nao.reduce((n, x) => n + (x.n || 1), 0);
  return (
    <div style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={panelTitle}>Porque não converteram</div>
      {!totalNao ? (
        <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem experiências não convertidas nestes filtros.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
            {linhasMotivo.map(([m, n]) => (
              <div key={m} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 40px", gap: 8, alignItems: "center", fontSize: 12.5 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontWeight: ehMotivoTecnico(m) ? 600 : 500, color: ehMotivoTecnico(m) ? COLORS.danger : COLORS.ink }}>{m}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: COLORS.ruleSoft, marginTop: 3 }}>
                    <div style={{ width: `${(n / totalNao) * 100}%`, height: "100%", borderRadius: 3, background: ehMotivoTecnico(m) ? COLORS.danger : m === "Sem motivo" ? COLORS.slate : COLORS.navy }} />
                  </div>
                </div>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n}</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: COLORS.slate }}>{totalNao} não convertidas · {tecnicos.length} por motivo técnico (vão para o coordenador técnico)</div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Turmas e equipas com muitas não conversões</div>
            {alerta.length === 0 ? (
              <div style={{ fontSize: 12.5, color: COLORS.slate }}>Nenhuma: o alerta aparece com 3 ou mais não convertidas e pelo menos metade das decididas na turma.</div>
            ) : (
              <div style={{ display: "grid", gap: 4 }}>
                {alerta.map((t) => (
                  <div key={`${t.escola}|${t.turma}`} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, borderLeft: `3px solid ${COLORS.danger}`, background: COLORS.dangerBg, padding: "5px 8px", borderRadius: 4 }}>
                    <strong>{t.turma}</strong>
                    <span style={{ color: COLORS.ink2 }}>{t.escola}</span>
                    <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                      {t.nao} de {t.dec} não converteram{t.tec ? ` · ${t.tec} técnico` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Experiências ----------
function SecaoExperiencias({ escolas, turmas, niveis, experiencias, onSave, onUpdate, onRemove, procurarAluno, op = null }) {
  const [codigo, setCodigo] = useState("");
  const [fCod, setFCod] = useState("");
  const [aviso, setAviso] = useState("");
  const avaliar = (id, resultado) => setAviso(onUpdate(id, resultado) || "");
  const [escola, setEscola] = useState(escolas[0] || "");
  const [turma, setTurma] = useState("");
  const [n, setN] = useState("1");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [erro, setErro] = useState("");

  const [fEsc, setFEsc] = useState("todas");
  const [fRes, setFRes] = useState("todos");
  const [fMes, setFMes] = useState("todos");
  const epXp = epocasDosRegistos(experiencias);
  const [fEp, setFEpRaw] = useState(() => selecaoInicial(epXp.eps));
  const setFEp = (v) => {
    setFEpRaw(v);
    setFMes("todos");
  };
  const daEpoca = experiencias.filter((x) => naSelecao(fEp, epocaRegisto(x)));

  const turmasEscola = [...new Set(turmas.filter((t) => t.escola === escola).map((t) => t.turma))];
  const meses = [...new Set(daEpoca.map((x) => mesDeData(x.data)).filter(Boolean))].sort().reverse();

  const somaN = (arr) => arr.reduce((t, x) => t + x.n, 0);
  const porEpocaXp = epXp.eps.filter((ep) => naSelecao(fEp.length > 1 ? fEp : [], ep)).map((ep) => {
    const doEp = experiencias.filter((x) => epocaRegisto(x) === ep && (fEsc === "todas" || x.escola === fEsc));
    const conv = somaN(doEp.filter((x) => x.resultado === "sucesso"));
    const aval = somaN(doEp.filter((x) => x.resultado !== "pendente"));
    return { ep, realizadas: somaN(doEp), conv, pend: somaN(doEp.filter((x) => x.resultado === "pendente")), taxa: aval ? Math.round((conv / aval) * 100) : null };
  });

  const lista = daEpoca
    .filter((x) => (fEsc === "todas" ? true : x.escola === fEsc))
    .filter((x) => !fCod.trim() || String(x.alunoId || "").includes(fCod.trim()))
    .filter((x) => (fRes === "todos" ? true : x.resultado === fRes))
    .filter((x) => (fMes === "todos" ? true : mesDeData(x.data) === fMes))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const soma = (arr) => arr.reduce((s, x) => s + x.n, 0);
  const realizadas = soma(lista);
  const sucesso = soma(lista.filter((x) => x.resultado === "sucesso"));
  const fechadas = soma(lista.filter((x) => x.resultado !== "pendente"));
  const pendentes = soma(lista.filter((x) => x.resultado === "pendente"));
  const fidelizacao = fechadas ? Math.round((sucesso / fechadas) * 100) : null;

  // Evolução mensal da conversão, para se ver a tendência.
  const porMes = [...new Set(daEpoca.map((x) => mesDeData(x.data)).filter(Boolean))].sort().map((m) => {
    const doMes = daEpoca.filter((x) => mesDeData(x.data) === m && (fEsc === "todas" || x.escola === fEsc));
    const f = soma(doMes.filter((x) => x.resultado !== "pendente"));
    const s = soma(doMes.filter((x) => x.resultado === "sucesso"));
    return { name: `${MES_CURTO[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`, realizadas: soma(doMes), convertidas: s, taxa: f ? Math.round((s / f) * 100) : 0 };
  });

  const guardar = () => {
    const cod = codigo.trim();
    if (!cod) {
      setErro("Indica o código do atleta.");
      return;
    }
    if (experiencias.some((x) => String(x.alunoId) === cod && x.epoca === epocaDe(data))) {
      setErro(`Já existe uma experiência do atleta ${cod} nesta época.`);
      return;
    }
    setErro("");
    onSave({ id: `x_${Date.now()}`, alunoId: cod, epoca: epocaDe(data), escola, turma, n: 1, resultado: "pendente", data, origem: "manual" });
    setCodigo("");
  };

  return (
    <div>
      {op && op.irParaEmails && (
        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 12 }}>
          Os e-mails às escolas (experiências, turmas, reclamações e eficácia) estão em{" "}
          <button type="button" onClick={op.irParaEmails} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
            Gestão › E-mails às escolas
          </button>
          .
        </div>
      )}
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Registar experiência</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={escola} onChange={(e) => { setEscola(e.target.value); setTurma(""); }} style={{ ...inputStyle, width: 170 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Turma / equipa</label>
            <select value={turma} onChange={(e) => setTurma(e.target.value)} style={{ ...inputStyle, width: 165 }}>
              <option value="">{turmasEscola.length ? "Selecionar..." : "Sem turmas nesta escola"}</option>
              {turmasEscola.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Código do atleta</label>
            <input
              value={codigo}
              onChange={(e) => {
                const v = e.target.value;
                setCodigo(v);
                setErro("");
                const a = procurarAluno && procurarAluno(v.trim());
                if (a) {
                  setEscola(a.escola);
                  setTurma(a.turma || "");
                }
              }}
              placeholder="ex.: 22534"
              style={{ ...inputStyle, width: 140 }}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, width: 160 }} />
          </div>
          <button onClick={guardar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>Registar</button>
        </div>
        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erro}</div>}
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 9 }}>
          Ao marcar como convertida, os atletas entram na turma e passam a contar nos inscritos.
        </div>
      </div>

      <Filtros>
        <FiltroEpocas epocas={epXp.eps} valor={fEp} onChange={setFEp} />
        <input value={fCod} onChange={(e) => setFCod(e.target.value)} placeholder="Procurar código" style={{ ...inputStyle, width: 160 }} />
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={fRes} onChange={(e) => setFRes(e.target.value)} style={{ ...inputStyle, width: 180 }}>
          <option value="todos">Todos os resultados</option>
          {Object.entries(XP_RESULTADO_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
        <select value={fMes} onChange={(e) => setFMes(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="todos">Todos os meses</option>
          {meses.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Filtros>

      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Experiências" value={realizadas} />
        <StatCard label="Convertidas" value={sucesso} color={COLORS.ok} />
        <StatCard label="Por avaliar" value={pendentes} color={COLORS.warn} />
        <StatCard
          label="Taxa de fidelização"
          value={fidelizacao === null ? "—" : `${fidelizacao}%`}
          color={COLORS.ok}
          subtitle={`${sucesso} de ${fechadas} avaliadas`}
          anel={fidelizacao}
        />
      </div>

      {aviso && (
        <div
          style={{
            background: COLORS.warnBg,
            border: `1px solid ${COLORS.warn}`,
            color: COLORS.warn,
            borderRadius: 5,
            padding: "10px 13px",
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span>{aviso}</span>
          <button onClick={() => setAviso("")} style={{ ...iconBtnStyle, padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {porEpocaXp.length > 1 && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={panelTitle}>Por época</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Época", "Experiências", "Convertidas", "Por avaliar", "Fidelização"].map((h, i) => (
                    <th key={h} style={{ ...thStyle, textAlign: i ? "right" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {porEpocaXp.map((x) => (
                  <tr key={x.ep} onClick={() => setFEp([x.ep])} style={{ cursor: "pointer", background: fEp.length === 1 && fEp[0] === x.ep ? COLORS.paperSunken : "transparent" }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{x.ep}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{x.realizadas}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", color: COLORS.ok }}>{x.conv}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{x.pend}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{x.taxa === null ? "—" : `${x.taxa}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {porMes.length > 1 && (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <div style={panelTitle}>Experiências e conversão por mês · {textoSelecao(fEp)}</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porMes}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
              <Bar dataKey="realizadas" name="Realizadas" fill={COLORS.slate} radius={[3, 3, 0, 0]} animationDuration={800} />
              <Bar dataKey="convertidas" name="Convertidas" fill={COLORS.ok} radius={[3, 3, 0, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, fontSize: 11.5, marginTop: 6 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS.slate }} /> Realizadas
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS.ok }} /> Convertidas
            </span>
          </div>
        </div>
      )}

      <PainelNaoConversoes lista={lista} motivos={op ? op.motivos : MOTIVOS_EXPERIENCIA_PADRAO} />

      {lista.length === 0 ? (
        <SemDados texto="Sem experiências para os filtros selecionados." />
      ) : (
        <div style={panelStyle}>
          <div style={panelTitle}>Registos ({lista.length})</div>
          {[...new Set(lista.filter((x) => x.resultado === "sucesso").map((x) => x.escola))].map((e) => (
            <datalist key={e} id={`turmas-ficou-${e}`}>
              {[...new Set([...turmas.filter((t) => t.escola === e).map((t) => t.turma), ...experiencias.filter((x) => x.escola === e).flatMap((x) => [x.turma, x.turmaFicou])].filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, "pt", { numeric: true }))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          ))}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Data", "Código", "Escola", "Turma da experiência", "Resultado", "Motivo", "Avaliar", ""].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((x) => {
                  const meta = XP_RESULTADO_META[x.resultado] || XP_RESULTADO_META.pendente;
                  return (
                    <tr key={x.id}>
                      <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{x.data ? fmt(new Date(x.data + "T00:00:00")) : "—"}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{x.alunoId || (x.n > 1 ? `${x.n} atletas` : "—")}</td>
                      <td style={tdStyle}>{x.escola}</td>
                      <td style={tdStyle}>{x.turma || "—"}</td>
                      <td style={tdStyle}>
                        <Tag label={meta.label} color={meta.color} bg={meta.bg} />
                        {x.decididoPor === "operacional" && <div style={{ fontSize: 10.5, color: COLORS.slate, marginTop: 2 }}>pelo operacional</div>}
                        {x.resultado === "sucesso" && (() => {
                          const doMapa = x.alunoId && procurarAluno ? procurarAluno(x.alunoId) : null;
                          const turmaMapa = doMapa && doMapa.escola === x.escola ? doMapa.turma : "";
                          return (
                            <div style={{ marginTop: 4 }}>
                              {op && op.onTurmaFicou ? (
                                <input
                                  key={`${x.id}|${x.turmaFicou || ""}`}
                                  defaultValue={x.turmaFicou || ""}
                                  list={`turmas-ficou-${x.escola}`}
                                  placeholder={turmaMapa || "Ficou em…"}
                                  title="Turma ou equipa em que o atleta ficou"
                                  aria-label="Turma ou equipa em que ficou"
                                  onBlur={(e) => e.target.value.trim() !== (x.turmaFicou || "") && op.onTurmaFicou(x.id, e.target.value.trim())}
                                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                                  style={{ ...inputStyle, width: 150, padding: "3px 6px", fontSize: 12 }}
                                />
                              ) : (
                                x.turmaFicou && <div style={{ fontSize: 11.5 }}>Ficou em {x.turmaFicou}</div>
                              )}
                              {!x.turmaFicou && turmaMapa && <div style={{ fontSize: 10.5, color: COLORS.slate, marginTop: 2 }}>no mapa: {turmaMapa}</div>}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>
                        {x.resultado === "insucesso" && op ? (
                          <select value={x.motivo || ""} onChange={(e) => op.onMotivo(x.id, e.target.value)} style={{ ...inputStyle, width: "auto", maxWidth: 190, padding: "3px 6px", fontSize: 12, color: ehMotivoTecnico(x.motivo) ? COLORS.danger : COLORS.ink }}>
                            <option value="">Sem motivo</option>
                            {[...new Set([...(op.motivos || []), ...(x.motivo ? [x.motivo] : [])])].map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : (
                          x.motivo || ""
                        )}
                        {x.nota && <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 2 }}>{x.nota}</div>}
                      </td>
                      <td style={tdStyle}>
                        {x.resultado === "pendente" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => avaliar(x.id, "sucesso")}
                              style={{ ...secondaryBtnStyle, flex: "none", padding: "5px 11px", fontSize: 12, borderColor: COLORS.ok, color: COLORS.ok }}
                            >
                              Converteu
                            </button>
                            <button
                              onClick={() => avaliar(x.id, "insucesso")}
                              style={{ ...secondaryBtnStyle, flex: "none", padding: "5px 11px", fontSize: 12, borderColor: COLORS.danger, color: COLORS.danger }}
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => avaliar(x.id, "pendente")} style={{ ...secondaryBtnStyle, flex: "none", padding: "5px 11px", fontSize: 12 }}>
                            Reverter
                          </button>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <button title="Remover" onClick={() => onRemove(x.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Desvinculações ----------
function SecaoDesvinculacoes({ escolas, desvinculacoes, onSave, onUpdate, onRemove }) {
  const [escola, setEscola] = useState(escolas[0] || "");
  const [quem, setQuem] = useState(QUEM_PEDIU[0]);
  const [clube, setClube] = useState("");
  const [decisao, setDecisao] = useState("");
  const [cedida, setCedida] = useState("0");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  const [fEsc, setFEsc] = useState("todas");
  const [fQuem, setFQuem] = useState("todos");
  const [fClube, setFClube] = useState("todos");
  const [fCed, setFCed] = useState("todos");

  const clubes = [...new Set(desvinculacoes.map((v) => v.clubeDestino).filter(Boolean))].sort();

  const lista = desvinculacoes
    .filter((v) => (fEsc === "todas" ? true : v.escola === fEsc))
    .filter((v) => (fQuem === "todos" ? true : v.quemPediu === fQuem))
    .filter((v) => (fClube === "todos" ? true : v.clubeDestino === fClube))
    .filter((v) => (fCed === "todos" ? true : fCed === "sim" ? v.cedida === true : v.cedida !== true))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const aceites = lista.filter((v) => v.aceite === true).length;
  const recusados = lista.filter((v) => v.aceite === false).length;
  const cedidos = lista.filter((v) => v.cedida === true).length;

  const guardar = () => {
    onSave({
      id: `v_${Date.now()}`,
      escola,
      quemPediu: quem,
      clubeDestino: clube.trim(),
      aceite: decisao === "" ? null : decisao === "1",
      cedida: cedida === "1",
      data,
    });
    setClube("");
    setDecisao("");
    setCedida("0");
  };

  return (
    <div>
      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={panelTitle}>Registar pedido de desvinculação</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
            <select value={escola} onChange={(e) => setEscola(e.target.value)} style={{ ...inputStyle, width: 165 }}>
              {escolas.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Pedido por</label>
            <select value={quem} onChange={(e) => setQuem(e.target.value)} style={{ ...inputStyle, width: 195 }}>
              {QUEM_PEDIU.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Clube de destino</label>
            <input
              type="text"
              value={clube}
              onChange={(e) => setClube(e.target.value)}
              placeholder="Nome do clube"
              list="lista-clubes"
              style={{ ...inputStyle, width: 190 }}
            />
            <datalist id="lista-clubes">
              {clubes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Decisão</label>
            <select value={decisao} onChange={(e) => setDecisao(e.target.value)} style={{ ...inputStyle, width: 140 }}>
              <option value="">Pendente</option>
              <option value="1">Aceite</option>
              <option value="0">Recusado</option>
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Passe cedido</label>
            <select value={cedida} onChange={(e) => setCedida(e.target.value)} style={{ ...inputStyle, width: 110 }}>
              <option value="0">Não</option>
              <option value="1">Sim</option>
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, width: 155 }} />
          </div>
          <button onClick={guardar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 16px" }}>Registar</button>
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 9 }}>
          Sem identificação do atleta — apenas o pedido, o destino, a decisão e se houve cedência.
        </div>
      </div>

      <Filtros>
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={{ ...inputStyle, width: 170 }}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={fQuem} onChange={(e) => setFQuem(e.target.value)} style={{ ...inputStyle, width: 195 }}>
          <option value="todos">Pedido por (todos)</option>
          {QUEM_PEDIU.map((q) => (
            <option key={q} value={q}>{q}</option>
          ))}
        </select>
        <select value={fClube} onChange={(e) => setFClube(e.target.value)} style={{ ...inputStyle, width: 190 }}>
          <option value="todos">Todos os clubes de destino</option>
          {clubes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={fCed} onChange={(e) => setFCed(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="todos">Cedido ou não</option>
          <option value="sim">Apenas cedidos</option>
          <option value="nao">Apenas não cedidos</option>
        </select>
      </Filtros>

      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard label="Pedidos" value={lista.length} />
        <StatCard label="Aceites" value={aceites} color={COLORS.ok} subtitle={lista.length ? `${Math.round((aceites / lista.length) * 100)}% dos pedidos` : ""} />
        <StatCard label="Recusados" value={recusados} color={COLORS.danger} />
        <StatCard label="Passes cedidos" value={cedidos} color={COLORS.progress} />
      </div>

      {lista.length === 0 ? (
        <SemDados texto="Sem pedidos para os filtros selecionados." />
      ) : (
        <div style={panelStyle}>
          <div style={panelTitle}>Pedidos ({lista.length})</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Data", "Escola", "Pedido por", "Clube de destino", "Decisão", "Passe cedido", ""].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id}>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{v.data}</td>
                    <td style={tdStyle}>{v.escola}</td>
                    <td style={{ ...tdStyle, fontSize: 12.5 }}>{v.quemPediu}</td>
                    <td style={tdStyle}>{v.clubeDestino || "—"}</td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => onUpdate(v.id, { aceite: v.aceite === null ? true : v.aceite ? false : null })}
                        title="Clica para alternar"
                        style={{
                          border: "none",
                          cursor: "pointer",
                          borderRadius: 3,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 600,
                          background: v.aceite === null ? COLORS.doneBg : v.aceite ? COLORS.okBg : COLORS.dangerBg,
                          color: v.aceite === null ? COLORS.slate : v.aceite ? COLORS.ok : COLORS.danger,
                        }}
                      >
                        {v.aceite === null ? "Pendente" : v.aceite ? "Aceite" : "Recusado"}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => onUpdate(v.id, { cedida: !v.cedida })}
                        title="Clica para alternar"
                        style={{
                          border: "none",
                          cursor: "pointer",
                          borderRadius: 3,
                          padding: "3px 9px",
                          fontSize: 11,
                          fontWeight: 600,
                          background: v.cedida ? COLORS.progressBg : COLORS.doneBg,
                          color: v.cedida ? COLORS.progress : COLORS.slate,
                        }}
                      >
                        {v.cedida ? "Sim" : "Não"}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button title="Remover" onClick={() => onRemove(v.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Com mais treinadores, o horário aguenta alguns alunos acima da lotação.
// Cada regra diz: a partir de N treinadores, aceitam-se X alunos a mais.
const DEFAULT_REGRAS_TREINADORES = [
  { treinadores: 1, tolerancia: 0 },
  { treinadores: 2, tolerancia: 3 },
  { treinadores: 3, tolerancia: 6 },
];
function toleranciaTreinadores(n, regras) {
  const r = [...(regras || DEFAULT_REGRAS_TREINADORES)].filter((x) => Number(x.treinadores) <= (Number(n) || 1)).sort((a, b) => b.treinadores - a.treinadores)[0];
  return r ? Math.max(0, Number(r.tolerancia) || 0) : 0;
}

// Alertas de turmas: horários acima da lotação (mesmo com a tolerância dos treinadores) e turmas
// com alunos abaixo do mínimo (percentagem da lotação, ajustável).
function alertasTurmas({ escolas, turmasAlunos, espacos, capacidades, niveis, regras, minimoPct = 50 }) {
  const caps = capacidades || {};
  const acima = [];
  const abaixo = [];
  const ord = (a, b) => a.localeCompare(b, "pt", { numeric: true });
  (escolas || []).forEach((esc) => {
    const pt = {};
    (turmasAlunos || [])
      .filter((t) => t.escola === esc)
      .forEach((t) => {
        const x = pt[t.turma] || (pt[t.turma] = { turma: t.turma, total: 0, cap: caps[`${esc}|${t.turma}`] || t.cap || capacidadeSugerida(t.turma, niveis) });
        x.total += (Number(t.m) || 0) + (Number(t.f) || 0);
      });
    const comHorario = new Set();
    const grupos = {};
    (espacos || [])
      .filter((b) => b.escola === esc)
      .forEach((b) => {
        const ts = [...new Set(turmasDoBloco(b))].map((n) => pt[n]).filter(Boolean);
        if (!ts.length) return;
        ts.forEach((x) => comHorario.add(x.turma));
        const nomes = ts.map((x) => x.turma).sort(ord);
        const total = ts.reduce((n, x) => n + x.total, 0);
        const limite = (nomes.length > 1 && caps[`${esc}|grupo:${nomes.join(" + ")}`]) || Math.min(...ts.map((x) => x.cap));
        const tol = toleranciaTreinadores(b.treinadores || 1, regras);
        if (!limite || total <= limite + tol) return;
        const k = nomes.join(" + ");
        const g = grupos[k] || (grupos[k] = { escola: esc, turmas: nomes, total, limite, tol, horarios: [] });
        g.tol = Math.min(g.tol, tol);
        g.horarios.push(`${String(b.dia || "").slice(0, 3)} ${horaFmt(b.hora)}`.trim());
      });
    Object.values(grupos).forEach((g) => acima.push({ ...g, excesso: g.total - g.limite - g.tol }));
    Object.values(pt).forEach((x) => {
      if (!comHorario.has(x.turma) && x.cap && x.total > x.cap) acima.push({ escola: esc, turmas: [x.turma], total: x.total, limite: x.cap, tol: 0, horarios: [], excesso: x.total - x.cap });
      const minimo = Math.ceil((x.cap * minimoPct) / 100);
      if (x.total > 0 && x.cap && x.total < minimo) abaixo.push({ escola: esc, turma: x.turma, total: x.total, minimo, cap: x.cap });
    });
  });
  acima.sort((a, b) => b.excesso - a.excesso || ord(a.escola, b.escola));
  abaixo.sort((a, b) => a.total / a.minimo - b.total / b.minimo || ord(a.escola, b.escola));
  return { acima, abaixo };
}

function AlertasTurmas({ alertas, minimoPct, onMinimoPct, onVerEspacos }) {
  const [aberto, setAberto] = useState(false);
  const [pct, setPct] = useState(String(minimoPct));
  useEffect(() => setPct(String(minimoPct)), [minimoPct]);
  const { acima, abaixo } = alertas;
  if (!acima.length && !abaixo.length) return null;
  const grave = acima.length > 0;
  const cor = grave ? COLORS.danger : COLORS.warn;
  const linha = { display: "grid", gridTemplateColumns: "minmax(110px, 1fr) minmax(120px, 1.4fr) auto", gap: 10, padding: "6px 0", borderTop: `1px solid ${COLORS.ruleSoft}`, fontSize: 12.5, alignItems: "baseline" };
  return (
    <div style={{ ...panelStyle, marginBottom: 16, borderLeft: `3px solid ${cor}`, padding: "10px 14px" }}>
      <button type="button" onClick={() => setAberto((x) => !x)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", flexWrap: "wrap" }}>
        <AlertTriangle size={15} color={cor} />
        <span style={{ fontWeight: 600, fontSize: 13.5, flex: "1 1 240px" }}>
          {[acima.length && `${acima.length} ${acima.length === 1 ? "horário ou turma acima" : "horários ou turmas acima"} da capacidade`, abaixo.length && `${abaixo.length} ${abaixo.length === 1 ? "turma abaixo" : "turmas abaixo"} do mínimo`].filter(Boolean).join(" · ")}
        </span>
        <span style={{ fontSize: 12, color: COLORS.navySoft, fontWeight: 600 }}>{aberto ? "Esconder" : "Ver"}</span>
      </button>
      {aberto && (
        <div style={{ marginTop: 10 }}>
          {acima.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.danger, textTransform: "uppercase", letterSpacing: "0.05em", flex: 1 }}>Acima da capacidade</span>
                {onVerEspacos && (
                  <button type="button" onClick={onVerEspacos} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                    Abrir Espaços
                  </button>
                )}
              </div>
              {acima.map((a, i) => (
                <div key={i} style={linha}>
                  <span style={{ fontWeight: 600 }}>{a.escola}</span>
                  <span>
                    {a.turmas.join(" + ")}
                    <span style={{ color: COLORS.slate }}> · {a.horarios.length ? a.horarios.join(", ") : "sem horário nos Espaços"}</span>
                  </span>
                  <span style={{ color: COLORS.danger, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {a.total}/{a.limite}
                    {a.tol ? ` (+${a.tol} trein.)` : ""} · +{a.excesso}
                  </span>
                </div>
              ))}
            </div>
          )}
          {abaixo.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.warn, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Abaixo do mínimo</div>
              {abaixo.map((a, i) => (
                <div key={i} style={linha}>
                  <span style={{ fontWeight: 600 }}>{a.escola}</span>
                  <span>{a.turma}</span>
                  <span style={{ color: COLORS.warn, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {a.total} {a.total === 1 ? "aluno" : "alunos"} · mínimo {a.minimo}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12, color: COLORS.slate, flexWrap: "wrap" }}>
            <span>Mínimo por turma:</span>
            <input type="number" min="1" max="100" value={pct} onChange={(e) => setPct(e.target.value)} onBlur={() => { const v = Math.min(100, Math.max(1, Math.round(Number(pct) || 50))); setPct(String(v)); if (v !== minimoPct) onMinimoPct(v); }} aria-label="Mínimo em percentagem da lotação" style={{ ...inputStyle, width: 64, padding: "4px 8px" }} />
            <span>% da lotação da turma. A capacidade conta com a tolerância dos treinadores de cada horário.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function RegrasTreinadores({ regras, onGuardar, onFechar }) {
  const [linhas, setLinhas] = useState(() => [...regras].sort((a, b) => a.treinadores - b.treinadores).map((r) => ({ ...r })));
  const muda = (i, k, v) => setLinhas((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const validas = linhas.filter((x) => Number(x.treinadores) >= 1);
  const repetidas = new Set(validas.map((x) => Number(x.treinadores))).size !== validas.length;
  return (
    <div className="pageIn" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ ...panelTitle, marginBottom: 0 }}>Regras de lotação por treinadores</div>
        <button onClick={onFechar} aria-label="Fechar regras" style={{ ...iconBtnStyle, color: COLORS.slate }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.ink2, margin: "8px 0 12px", lineHeight: 1.5 }}>
        Quantos alunos acima da lotação são aceitáveis consoante o número de treinadores no horário. Vale a regra com o maior número de treinadores que o horário tem.
      </div>
      <div style={{ display: "grid", gap: 8, maxWidth: 460 }}>
        {linhas.map((x, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, flexWrap: "wrap" }}>
            <span>Com</span>
            <input type="number" min="1" value={x.treinadores} onChange={(e) => muda(i, "treinadores", e.target.value)} aria-label="Treinadores" style={{ ...inputStyle, width: 64, padding: "5px 8px" }} />
            <span>{Number(x.treinadores) === 1 ? "treinador" : "treinadores"} ou mais, aceitar até</span>
            <input type="number" min="0" value={x.tolerancia} onChange={(e) => muda(i, "tolerancia", e.target.value)} aria-label="Alunos a mais" style={{ ...inputStyle, width: 64, padding: "5px 8px" }} />
            <span>alunos acima</span>
            <button onClick={() => setLinhas((l) => l.filter((_, j) => j !== i))} aria-label="Remover regra" style={{ ...iconBtnStyle, padding: 2, color: COLORS.slate }}>
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setLinhas((l) => [...l, { treinadores: (Math.max(0, ...l.map((x) => Number(x.treinadores) || 0)) || 0) + 1, tolerancia: 0 }])}
        style={{ ...linkBtnStyle, marginTop: 10, fontSize: 12.5 }}
      >
        + Adicionar regra
      </button>
      {repetidas && <div style={{ color: COLORS.danger, fontSize: 12.5, marginTop: 8 }}>Há duas regras para o mesmo número de treinadores.</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          disabled={repetidas}
          onClick={() => onGuardar(validas.map((x) => ({ treinadores: Number(x.treinadores), tolerancia: Math.max(0, Number(x.tolerancia) || 0) })).sort((a, b) => a.treinadores - b.treinadores))}
          style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "8px 16px" }}
        >
          Guardar regras
        </button>
        <button onClick={() => setLinhas(DEFAULT_REGRAS_TREINADORES.map((r) => ({ ...r })))} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "8px 14px" }}>
          Repor sugestão
        </button>
      </div>
    </div>
  );
}

// Horas sempre no formato 18:15 (24 horas), de 15 em 15 minutos.
const HORAS_TREINO = (() => {
  const l = [];
  for (let h = 7; h <= 23; h++) for (const m of [0, 15, 30, 45]) l.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return l;
})();
const horaFmt = (h) => {
  const m = String(h || "").match(/(\d{1,2})\D?(\d{2})?/);
  return m ? `${String(Number(m[1])).padStart(2, "0")}:${m[2] || "00"}` : String(h || "");
};

// ---------- Importar o plano semanal (PDF DFF.013) para os Espaços ----------
// Lê o PDF, propõe a correspondência de cada turma/equipa do plano com as turmas da app
// e deixa corrigir tudo antes de guardar. As correções ficam guardadas para a semana seguinte.
// O mesmo nome pode ser uma equipa ou uma sessão extra (ex.: "SUB 7" nas equipas e na otimização): ficam separados.
const chaveNomePlano = (t) => `${chavePlano(t.nome)}${SECAO_EXTRA.test(t.secao) ? " ·extra" : ""}`;
function ImportarPlanoSemanal({ escolas, turmas, espacos, recintosUsados, normalizacao, onImportar, onGuardarNormalizacao, onFechar }) {
  const [aLer, setALer] = useState(false);
  const [erro, setErro] = useState("");
  const [plano, setPlano] = useState(null);
  const [escola, setEscola] = useState("");
  const [recinto, setRecinto] = useState("");
  const [nomes, setNomes] = useState({}); // chave do nome → { escola, turmas, incluir }
  const [locais, setLocais] = useState({}); // texto do local → recinto
  const [horasEd, setHorasEd] = useState({}); // índice do treino → hora corrigida
  const [substituir, setSubstituir] = useState(true);
  const [editarNome, setEditarNome] = useState(null);
  const norm0 = normalizacao || {};

  const turmasDe = (e) => [...new Set(turmas.filter((t) => t.escola === e).map((t) => t.turma))].sort((a, b) => a.localeCompare(b, "pt", { numeric: true }));
  const alunosDe = (e, t) => turmas.filter((x) => x.escola === e && x.turma === t).reduce((n, x) => n + (x.m || 0) + (x.f || 0), 0);

  const ler = async (f) => {
    if (!f) return;
    setErro("");
    setALer(true);
    try {
      if (!/\.pdf$/i.test(f.name)) throw new Error("escolhe o PDF do plano semanal");
      const linhas = await linhasDoPdf(new Uint8Array(await f.arrayBuffer()));
      const r = lerPlanoSemanal(linhas);
      if (!r.treinos.length) throw new Error("não encontrei turmas nem equipas no PDF");
      const guardadoTit = (norm0.titulos || {})[chavePlano(r.titulo)] || {};
      const esc = guardadoTit.escola || escolaDoTitulo(r.titulo, escolas) || "";
      // Escolas com dois planos com o mesmo título (ex.: Dragon Force FC NB e UM): o recinto que aparece no nome do ficheiro.
      const nomeF = ` ${norm(f.name).replace(/[^a-z0-9]+/g, " ")} `;
      const recDoFicheiro = (guardadoTit.recintos || []).find((x) => x && nomeF.includes(` ${norm(x).replace(/[^a-z0-9]+/g, " ").trim()} `));
      const rec = recDoFicheiro || guardadoTit.recinto || String(r.titulo).replace(/^.*?-\s*/, "").replace(/^dragon force\s+/i, "").trim();
      setPlano({ ...r, ficheiro: f.name });
      setEscola(esc);
      setRecinto(rec);
      prepararNomes(r, esc, rec);
      const ls = {};
      // Local já conhecido → o recinto guardado; senão, se o local aponta para outro recinto que já existe (ex.: ISMAI → Maia), propõe-o.
      [...new Set(r.treinos.map((t) => t.local).filter(Boolean))].forEach((l) => {
        const g = (norm0.locais || {})[chavePlano(l)];
        if (g !== undefined) return (ls[l] = g);
        const suf = sufixoDoRecinto(l);
        const outro = suf && suf !== sufixoDoRecinto(rec) ? recintosUsados.find((x) => sufixoDoRecinto(x) === suf) : "";
        ls[l] = outro || "";
      });
      setLocais(ls);
      setHorasEd({});
    } catch (e) {
      setErro(`Não consegui ler o plano: ${e?.message || e}`);
    } finally {
      setALer(false);
    }
  };
  // Correspondência de cada nome do plano: a guardada, senão uma sugestão.
  const prepararNomes = (r, esc, rec) => {
    const out = {};
    r.treinos.forEach((t) => {
      const k = chaveNomePlano(t);
      if (out[k]) return;
      const g = (norm0.nomes || {})[`${chavePlano(esc)}|${chavePlano(rec)}|${k}`];
      if (g) {
        out[k] = { escola: g.escola, turmas: g.turmas || [], incluir: !g.ignorar, guardado: true };
        return;
      }
      // Sugestão: primeiro na escola do plano, senão na escola onde o nome encaixa (ex.: turmas DF Porto no plano do Dragon Force FC).
      let e = esc;
      let ts = esc ? sugerirTurmasApp(t.nome, turmasDe(esc), rec) : [];
      if (!ts.length) {
        const tok = norm(rec).split(/\s+/)[0] || "§";
        const suf = sufixoDoRecinto(rec);
        const cands = escolas
          .filter((o) => o !== esc)
          .map((o) => ({ o, s: sugerirTurmasApp(t.nome, turmasDe(o), rec) }))
          .filter((c) => c.s.length)
          .map((c) => ({ ...c, pts: (norm(c.o).includes(tok) ? 2 : 0) + (suf && c.s.some((x) => norm(x).endsWith(`(${suf})`)) ? 3 : 0) }))
          .sort((a, b) => b.pts - a.pts);
        if (cands.length && (cands[0].pts > 0 || cands.length === 1)) {
          e = cands[0].o;
          ts = cands[0].s;
        }
      }
      const extra = SECAO_EXTRA.test(t.secao) || /ros[aá]rio/i.test(t.nome) || /^TURMAS\b/i.test(t.nome);
      out[k] = { escola: e, turmas: ts, incluir: !extra && unidadesDoNome(t.nome).length > 0, guardado: false };
    });
    setNomes(out);
  };
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const mudaNome = (k, campos) => setNomes((n) => ({ ...n, [k]: { ...n[k], ...campos } }));
  const recintoDe = (t) => (t.local && locais[t.local]) || recinto;
  const horaDe = (t, i) => horasEd[i] ?? t.hora;
  const linhas = plano ? plano.treinos.map((t, i) => ({ ...t, i, k: chaveNomePlano(t), n: nomes[chaveNomePlano(t)] })) : [];
  const incluidas = linhas.filter((l) => l.n && l.n.incluir && !(l.dia === "Sábado" && /competi|sele/i.test(l.secao)));
  const semTurmas = [...new Set(incluidas.filter((l) => !l.n.turmas.length).map((l) => l.nome))];
  const semHora = incluidas.filter((l) => !horaDe(l, l.i));
  const incertas = linhas.filter((l) => l.n && l.n.incluir && l.horaIncerta);
  const nomesUnicos = Object.keys(nomes).map((k) => ({ k, ...nomes[k], exemplo: linhas.find((l) => l.k === k), dias: [...new Set(linhas.filter((l) => l.k === k).map((l) => DIA_APP[l.dia].slice(0, 3)))] }));
  const porSecao = {};
  nomesUnicos.forEach((x) => (porSecao[x.exemplo.secao] = porSecao[x.exemplo.secao] || []).push(x));

  // Horários que este plano substitui: os que vieram antes do mesmo plano (mesmo título), da mesma escola e do mesmo recinto.
  // Assim uma escola com dois planos (ex.: Dragon Force FC NB e UM) importa os dois sem um apagar o outro.
  const doMesmoPlano = plano ? espacos.filter((s) => s.origem === "plano" && s.plano && chavePlano(s.plano.titulo || "") === chavePlano(plano.titulo) && (!escola || (s.plano.escola || s.escola) === escola)) : [];
  const aSubstituir = doMesmoPlano.filter((s) => s.plano.recinto === undefined || chavePlano(s.plano.recinto) === chavePlano(recinto));
  const outrosRecintos = [...new Set(doMesmoPlano.filter((s) => !aSubstituir.includes(s)).map((s) => s.plano.recinto || "sem recinto"))];
  const idsSub = new Set(substituir ? aSubstituir.map((s) => s.id) : []);
  // Treinos que já estão nos Espaços (vindos de outro plano, ex.: a mesma equipa no plano do Porto e no da Maia) não se repetem.
  const chaveBloco = (b) => `${b.escola}|${b.recinto || ""}|${b.dia}|${horaFmt(b.hora)}|${[...b.turmas].sort().join("+")}`;
  const jaExistem = new Set(espacos.filter((s) => !idsSub.has(s.id)).map((s) => chaveBloco({ ...s, turmas: turmasDoBloco(s) })));

  // Sem turma correspondente na app: entra com o nome do plano (fica no aviso de turmas sem alunos).
  const turmasDaLinha = (l) => {
    if (l.n.turmas.length) return l.n.turmas;
    const us = unidadesDoNome(l.nome).map((u) => u.nome);
    return us.length ? us : [String(l.nome).replace(/\(\s*\d{1,2}[hH:]\d{2}\s*\)/g, "").replace(/\s+/g, " ").trim()];
  };
  const construir = () => {
    const vistos = new Set(jaExistem);
    return incluidas
      .filter((l) => horaDe(l, l.i) && (l.n.escola || escola))
      .map((l, j) => ({
        id: `p_${Date.now().toString(36)}_${j}`,
        escola: l.n.escola || escola,
        recinto: recintoDe(l),
        dia: DIA_APP[l.dia],
        hora: horaDe(l, l.i),
        treinadores: Math.max(1, l.treinadores || 1),
        turmas: turmasDaLinha(l),
        turma: turmasDaLinha(l).join(" + "),
        ...(l.n.turmas.length ? {} : { semTurmaApp: true }),
        origem: "plano",
        plano: { nome: l.nome, semana: plano.semana, ficheiro: plano.ficheiro, secao: l.secao, titulo: plano.titulo, escola, recinto },
      }))
      .filter((b) => {
        const k = chaveBloco(b);
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      });
  };
  const previstos = plano ? construir() : [];
  const repetidos = incluidas.filter((l) => horaDe(l, l.i) && (l.n.escola || escola)).length - previstos.length;
  const importar = () => {
    const novos = construir();
    // Guarda as correções para o próximo plano desta escola.
    const nomesG = { ...(norm0.nomes || {}) };
    Object.entries(nomes).forEach(([k, v]) => (nomesG[`${chavePlano(escola)}|${chavePlano(recinto)}|${k}`] = { escola: v.escola, turmas: v.turmas, ignorar: !v.incluir }));
    const locaisG = { ...(norm0.locais || {}) };
    Object.entries(locais).forEach(([l, r]) => r && (locaisG[chavePlano(l)] = r));
    onGuardarNormalizacao({ ...norm0, nomes: nomesG, locais: locaisG, titulos: { ...(norm0.titulos || {}), [chavePlano(plano.titulo)]: { escola, recinto, recintos: [...new Set([...(((norm0.titulos || {})[chavePlano(plano.titulo)] || {}).recintos || []), recinto].filter(Boolean))] } } });
    onImportar(novos, substituir ? aSubstituir.map((s) => s.id) : []);
  };

  const sel = { ...inputStyle, padding: "5px 8px", fontSize: 12.5 };
  return (
    <JanelaSGQ
      titulo={plano ? `Plano semanal · ${plano.titulo.replace(/^.*?-\s*/, "")}` : "Importar plano semanal"}
      largura={1080}
      onFechar={onFechar}
      rodape={
        plano ? (
          <>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12.5, color: COLORS.ink2 }}>
              <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
              Substituir os {aSubstituir.length} horários importados antes deste plano{recinto ? ` em ${recinto}` : ""}
            </label>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: semTurmas.length ? COLORS.warn : COLORS.slate }}>{[semTurmas.length ? `${semTurmas.length} sem turma na app (entram com o nome do plano e ficam no aviso de turmas sem alunos)` : "", repetidos > 0 ? `${repetidos} já estão nos Espaços` : ""].filter(Boolean).join(" · ")}</span>
            <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
              Cancelar
            </button>
            <button disabled={!escola} onClick={importar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px", opacity: escola ? 1 : 0.5 }}>
              Importar {previstos.length} treinos
            </button>
          </>
        ) : null
      }
    >
      {!plano ? (
        <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
          <div style={{ fontSize: 13, color: COLORS.ink2, lineHeight: 1.6, maxWidth: 640 }}>
            Escolhe o PDF do plano semanal de atividades (DFF.013) de uma escola. A app lê os dias, as horas, as turmas e as equipas, propõe as turmas correspondentes e deixa-te corrigir antes de guardar. As correções ficam guardadas para os planos seguintes.
          </div>
          <label className="press" style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FileText size={15} /> {aLer ? "A ler…" : "Escolher PDF"}
            <input type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => ler(e.target.files && e.target.files[0])} />
          </label>
          {erro && <div style={{ color: COLORS.danger, fontSize: 13 }}>{erro}</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Escola do plano</label>
              <select
                value={escola}
                onChange={(e) => {
                  setEscola(e.target.value);
                  prepararNomes(plano, e.target.value, recinto);
                }}
                style={{ ...inputStyle, width: 220 }}
              >
                <option value="">Escolher…</option>
                {escolas.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Recinto</label>
              <input value={recinto} onChange={(e) => setRecinto(e.target.value)} list="recintos-plano" style={{ ...inputStyle, width: 200 }} />
              <datalist id="recintos-plano">
                {recintosUsados.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.slate, paddingBottom: 8 }}>
              Semana {plano.semana || "?"} · {plano.ano} · {plano.treinos.length} linhas lidas
            </div>
          </div>
          {outrosRecintos.length > 0 && (
            <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5, marginTop: -6 }}>
              Esta escola já tem um plano com este título em <strong>{outrosRecintos.join(", ")}</strong>. Esses horários ficam: este plano só substitui os de <strong>{recinto || "sem recinto"}</strong>. Se for o mesmo recinto, escreve-o igual.
            </div>
          )}

          {Object.keys(locais).length > 0 && (
            <div style={{ ...panelStyle, marginBottom: 0, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Locais escritos no plano</div>
              <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 8 }}>Treinos com outro local por baixo. Diz em que recinto contam (vazio = {recinto || "o recinto do plano"}).</div>
              <div style={{ display: "grid", gap: 6 }}>
                {Object.entries(locais).map(([l, r]) => (
                  <div key={l} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                    <span style={{ flex: "1 1 260px", minWidth: 0 }}>{l}</span>
                    <input value={r} onChange={(e) => setLocais((x) => ({ ...x, [l]: e.target.value }))} list="recintos-plano" placeholder={recinto} style={{ ...sel, width: 200 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {incertas.length > 0 && (
            <div style={{ ...panelStyle, marginBottom: 0, padding: 12, borderColor: COLORS.warn, background: COLORS.warnBg }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Horas a confirmar</div>
              <div style={{ display: "grid", gap: 6 }}>
                {incertas.map((l) => (
                  <div key={l.i} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, flexWrap: "wrap" }}>
                    <span style={{ minWidth: 200 }}>
                      {DIA_APP[l.dia]} · {l.nome}
                    </span>
                    <select value={horaDe(l, l.i) || ""} onChange={(e) => setHorasEd((h) => ({ ...h, [l.i]: e.target.value }))} style={{ ...sel, width: 100 }}>
                      <option value="">—</option>
                      {HORAS_TREINO.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <span style={{ color: COLORS.slate }}>o plano não indica a hora desta linha; a proposta é a do bloco</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.entries(porSecao).map(([secao, lista]) => (
            <div key={secao}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                {secao} {SECAO_EXTRA.test(secao) && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>· sessões extra com alunos de outras turmas, desligadas por omissão</span>}
              </div>
              <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden" }}>
                {lista.map((x, idx) => {
                  const ts = turmasDe(x.escola);
                  const total = x.turmas.reduce((t, n) => t + alunosDe(x.escola, n), 0);
                  return (
                    <div key={x.k} style={{ display: "grid", gridTemplateColumns: "28px minmax(150px, 1.1fr) 70px minmax(150px, 0.9fr) minmax(200px, 2fr)", gap: 10, alignItems: "center", padding: "7px 10px", borderTop: idx ? `1px solid ${COLORS.ruleSoft}` : "none", background: x.incluir ? "transparent" : COLORS.paperSunken, opacity: x.incluir ? 1 : 0.7, fontSize: 12.5 }}>
                      <input type="checkbox" checked={x.incluir} onChange={(e) => mudaNome(x.k, { incluir: e.target.checked })} aria-label={`Incluir ${x.exemplo.nome}`} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{x.exemplo.nome}</div>
                        <div style={{ fontSize: 11, color: COLORS.slate }}>
                          {x.dias.join(", ")}
                          {x.guardado ? " · correspondência guardada" : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>{x.turmas.length ? `${total} alunos` : ""}</div>
                      <select value={x.escola} onChange={(e) => mudaNome(x.k, { escola: e.target.value, turmas: sugerirTurmasApp(x.exemplo.nome, turmasDe(e.target.value), recinto) })} style={sel} aria-label="Escola das turmas">
                        {escolas.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
                        {x.turmas.map((t) => (
                          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 3, border: `1px solid ${COLORS.rule}`, borderRadius: 6, padding: "1px 4px 1px 7px", background: COLORS.paperRaised }}>
                            {t} <span style={{ color: COLORS.slate, fontSize: 11 }}>{alunosDe(x.escola, t)}</span>
                            <button onClick={() => mudaNome(x.k, { turmas: x.turmas.filter((y) => y !== t) })} aria-label={`Tirar ${t}`} style={{ ...iconBtnStyle, padding: 1 }}>
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        {editarNome === x.k ? (
                          <select
                            autoFocus
                            value=""
                            onBlur={() => setEditarNome(null)}
                            onChange={(e) => {
                              if (e.target.value) mudaNome(x.k, { turmas: [...x.turmas, e.target.value] });
                              setEditarNome(null);
                            }}
                            style={{ ...sel, width: 170 }}
                          >
                            <option value="">Turma da app…</option>
                            {ts
                              .filter((t) => !x.turmas.includes(t))
                              .map((t) => (
                                <option key={t} value={t}>
                                  {t} ({alunosDe(x.escola, t)})
                                </option>
                              ))}
                          </select>
                        ) : (
                          <button onClick={() => setEditarNome(x.k)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                            {x.turmas.length ? "+ turma" : "Escolher turma"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: COLORS.slate, lineHeight: 1.5 }}>
            Cada linha do plano passa a um horário nos Espaços (dia, hora, turmas que treinam juntas e nº de treinadores pelas siglas do plano). Os jogos de sábado não entram. O que corrigires aqui fica guardado para o próximo plano desta escola.
          </div>
        </div>
      )}
    </JanelaSGQ>
  );
}

// Recintos usados nos Espaços: mudar o nome ou juntar dois (ex.: "Maia" e "ISMAI"), e ver/apagar
// as correspondências guardadas dos planos semanais.
function GerirRecintos({ espacos, recintos, normalizacao, onRenomear, onGuardarNormalizacao, onFechar }) {
  const [novo, setNovo] = useState({});
  const n0 = normalizacao || {};
  const nomes = Object.entries(n0.nomes || {}).sort((a, b) => a[0].localeCompare(b[0], "pt"));
  const [filtro, setFiltro] = useState("");
  const tirarNome = (k) => {
    const x = { ...(n0.nomes || {}) };
    delete x[k];
    onGuardarNormalizacao({ ...n0, nomes: x });
  };
  const tirarLocal = (k) => {
    const x = { ...(n0.locais || {}) };
    delete x[k];
    onGuardarNormalizacao({ ...n0, locais: x });
  };
  const vis = nomes.filter(([k]) => !filtro || k.includes(filtro.toLowerCase()));
  return (
    <div className="pageIn" style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ ...panelTitle, marginBottom: 0, flex: 1 }}>Recintos e correspondências</div>
        <button onClick={onFechar} aria-label="Fechar" style={{ ...iconBtnStyle, color: COLORS.slate }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 8 }}>Para juntar dois recintos, muda o nome de um para o nome do outro.</div>
      <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
        {recintos.map((r) => {
          const n = espacos.filter((s) => s.recinto === r).length;
          const esc = [...new Set(espacos.filter((s) => s.recinto === r).map((s) => s.escola))];
          const alvo = (novo[r] || "").trim();
          return (
            <div key={r} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
              <strong style={{ minWidth: 160 }}>{r}</strong>
              <span style={{ color: COLORS.slate, flex: "1 1 200px", fontSize: 12 }}>
                {n} horários · {esc.join(", ")}
              </span>
              <input value={novo[r] || ""} onChange={(e) => setNovo((x) => ({ ...x, [r]: e.target.value }))} list="recintos-renomear" placeholder="Novo nome" style={{ ...inputStyle, width: 180, padding: "5px 8px", fontSize: 12.5 }} />
              <button
                disabled={!alvo || alvo === r}
                onClick={() => {
                  onRenomear(r, alvo);
                  setNovo((x) => ({ ...x, [r]: "" }));
                }}
                style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 10px", fontSize: 12.5, opacity: alvo && alvo !== r ? 1 : 0.5 }}
              >
                {recintos.includes(alvo) && alvo !== r ? "Juntar" : "Mudar nome"}
              </button>
            </div>
          );
        })}
        <datalist id="recintos-renomear">
          {recintos.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>
      {nomes.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Correspondências dos planos ({nomes.length})</div>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Procurar" style={{ ...inputStyle, width: 180, padding: "5px 8px", fontSize: 12.5 }} />
          </div>
          <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 6 }}>O nome no plano → as turmas da app. Ao importar o próximo plano usam-se estas; muda-as no ecrã de importação. Apagar uma faz a app voltar a sugerir.</div>
          <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${COLORS.rule}`, borderRadius: 8 }}>
            {vis.map(([k, v], i) => {
              const partes = k.split("|");
              const esc = partes[0];
              const nome = `${partes.length > 2 ? `${partes[1]} · ` : ""}${partes[partes.length - 1].replace(" ·extra", " (sessão extra)")}`;
              return (
                <div key={k} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 10px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 12.5 }}>
                  <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <span style={{ color: COLORS.slate }}>{esc} · </span>
                    {nome.toUpperCase()}
                  </span>
                  <span style={{ flex: "2 1 260px", minWidth: 0, color: v.ignorar ? COLORS.slate : COLORS.ink }}>{v.ignorar ? "não importar" : `${v.escola}: ${(v.turmas || []).join(", ") || "—"}`}</span>
                  <button onClick={() => tirarNome(k)} aria-label="Apagar correspondência" style={{ ...iconBtnStyle, color: COLORS.slate }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {Object.keys(n0.locais || {}).length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12.5 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Locais escritos nos planos</div>
          {Object.entries(n0.locais).map(([l, r]) => (
            <div key={l} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ flex: 1 }}>{l}</span>
              <span>→ {r}</span>
              <button onClick={() => tirarLocal(l)} aria-label="Apagar" style={{ ...iconBtnStyle, color: COLORS.slate }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecaoEspacos({ escolas, turmas, niveis, espacos, listaEspacos, capacidades, regras, onSave, onUpdate, onRemove, onGerirLista, onGuardarRegras, normalizacao, onImportarPlano, onGuardarNormalizacao, onRenomearRecinto }) {
  const regrasT = regras && regras.length ? regras : DEFAULT_REGRAS_TREINADORES;
  // "escola" pode ser uma escola ou um recinto ("rec:Porto"), que junta os treinos de várias escolas no mesmo campo.
  const [escolaSel, setEscola] = useState(escolas[0] || "");
  const modoRecinto = String(escolaSel).startsWith("rec:");
  const recintoSel = modoRecinto ? escolaSel.slice(4) : "";
  const escola = modoRecinto ? "" : escolaSel;
  const [fRecinto, setFRecinto] = useState("");
  const [importar, setImportar] = useState(false);
  const [verRecintos, setVerRecintos] = useState(false);
  const [recintoNovo, setRecintoNovo] = useState("");
  const [editRec, setEditRec] = useState(null);
  const [semAlunosTodas, setSemAlunosTodas] = useState(false);
  const [verVistosSA, setVerVistosSA] = useState(false);
  const recintosUsados = [...new Set(espacos.map((s) => s.recinto).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
  const [dia, setDia] = useState(DIAS_SEMANA[0]);
  const [hora, setHora] = useState("18:00");
  const [outraHora, setOutraHora] = useState(false);
  const [treinadores, setTreinadores] = useState(1);
  const [escolhidas, setEscolhidas] = useState([]);
  const [erro, setErro] = useState("");
  const [acima, setAcima] = useState(false);
  const [aCriar, setACriar] = useState(false);
  const [verRegras, setVerRegras] = useState(false);

  // Alunos e lotação de cada turma de uma escola (os registos vêm separados por ano de nascimento).
  const porTurmaDe = (esc) => {
    const out = {};
    turmas
      .filter((t) => t.escola === esc)
      .forEach((t) => {
        const x = out[t.turma] || { turma: t.turma, total: 0, cap: (capacidades || {})[`${esc}|${t.turma}`] || t.cap || capacidadeSugerida(t.turma, niveis) };
        x.total += t.m + t.f;
        out[t.turma] = x;
      });
    return out;
  };
  const porTurma = porTurmaDe(escola);
  const cachePorTurma = { [escola]: porTurma };
  const turmasDaEscola = (esc) => cachePorTurma[esc] || (cachePorTurma[esc] = porTurmaDe(esc));
  const listaTurmas = Object.values(porTurma).sort((a, b) => a.turma.localeCompare(b.turma, "pt", { numeric: true }));
  const recintosDaEscola = [...new Set(espacos.filter((s) => s.escola === escola).map((s) => s.recinto).filter(Boolean))];
  const doEscola = modoRecinto ? espacos.filter((s) => s.recinto === recintoSel) : espacos.filter((s) => s.escola === escola && (!fRecinto || (s.recinto || "") === fRecinto));
  // Linhas do mapa: as horas com treinos nesta escola.
  const horas = [...new Set(doEscola.map((s) => horaFmt(s.hora)))].sort();
  // Lista curta: das 15:00 às 21:00 de 15 em 15 minutos, mais as horas que esta escola já usa (ex.: 18:50, sábados de manhã).
  const horasLista = [...new Set([...HORAS_TREINO.filter((h) => h >= "15:00" && h <= "21:00"), ...horas, hora].filter(Boolean))].sort();

  // Turmas que treinam juntas: a soma dos alunos não pode passar a lotação mais baixa entre elas,
  // mais a tolerância que os treinadores do horário permitem.
  const grupo = (nomes, nTreinadores = 1, escBloco) => {
    const pt = escBloco ? turmasDaEscola(escBloco) : porTurma;
    const ts = nomes.map((n) => pt[n]).filter(Boolean);
    const total = ts.reduce((t, x) => t + x.total, 0);
    // Lotação definida para o grupo (na página de Inscritos) manda; senão, a mais baixa das turmas.
    const chaveGrupo = `${escBloco || escola}|grupo:${[...new Set(ts.map((x) => x.turma))].sort((a, b) => a.localeCompare(b, "pt", { numeric: true })).join(" + ")}`;
    const capGrupo = ts.length > 1 ? (capacidades || {})[chaveGrupo] : null;
    const limite = capGrupo || (ts.length ? Math.min(...ts.map((x) => x.cap)) : 0);
    const daTurma = ts.find((x) => x.cap === limite);
    const tol = toleranciaTreinadores(nTreinadores, regrasT);
    const estado = !limite ? "sem" : total <= limite ? "ok" : total <= limite + tol ? "tolerado" : "acima";
    return { total, limite, tol, estado, nivel: daTurma ? escalaoDaTurma(daTurma.turma, niveis) : "", semRegisto: nomes.filter((n) => !pt[n]), pct: limite ? Math.round((total / limite) * 100) : 0 };
  };
  const atual = grupo(escolhidas, treinadores);

  // Turmas/equipas que estão nos horários (planos semanais) mas sem alunos na app:
  // pista para alunos inscritos na turma errada. Confirmar com cada escola.
  const vistosSemAlunos = (normalizacao && normalizacao.semAlunosVistos) || {};
  const escolasSemAlunos = semAlunosTodas ? [...new Set(espacos.map((s) => s.escola))] : modoRecinto ? [...new Set(doEscola.map((s) => s.escola))] : [escola];
  const semAlunos = (() => {
    const out = {};
    espacos
      .filter((s) => escolasSemAlunos.includes(s.escola) && (!modoRecinto || semAlunosTodas || s.recinto === recintoSel))
      .forEach((s) => {
        const pt = turmasDaEscola(s.escola);
        turmasDoBloco(s).forEach((t) => {
          if (pt[t] && pt[t].total > 0) return;
          const k = `${s.escola}|${t}`;
          const x = (out[k] = out[k] || { k, escola: s.escola, turma: t, horarios: [], naoExiste: !pt[t] });
          x.horarios.push(`${String(s.dia).slice(0, 3)} ${horaFmt(s.hora)}${s.recinto ? ` (${s.recinto})` : ""}`);
        });
      });
    return Object.values(out)
      .map((x) => ({ ...x, visto: vistosSemAlunos[x.k] }))
      .sort((a, b) => a.escola.localeCompare(b.escola, "pt") || a.turma.localeCompare(b.turma, "pt", { numeric: true }));
  })();
  const semAlunosPorVer = semAlunos.filter((x) => !x.visto);
  const marcarVisto = (k, sim) => {
    const v = { ...vistosSemAlunos };
    if (sim) v[k] = new Date().toISOString().slice(0, 10);
    else delete v[k];
    onGuardarNormalizacao({ ...(normalizacao || {}), semAlunosVistos: v });
  };
  const estados = doEscola.map((b) => grupo(turmasDoBloco(b), b.treinadores || 1, b.escola).estado);
  const nAcima = estados.filter((e) => e === "acima").length;
  const nTolerados = estados.filter((e) => e === "tolerado").length;
  const nOk = estados.filter((e) => e === "ok").length;
  // Equipas distintas a treinar (turmas que treinam juntas contam cada uma).
  const equipasTreino = new Set(doEscola.flatMap((b) => turmasDoBloco(b).map((t) => `${b.escola}|${t}`)));
  const equipasJuntas = new Set(doEscola.filter((b) => turmasDoBloco(b).length > 1).flatMap((b) => turmasDoBloco(b).map((t) => `${b.escola}|${t}`)));
  const corEstado = { ok: COLORS.ok, tolerado: COLORS.warn, acima: COLORS.danger, sem: COLORS.rule };
  const fundoEstado = { ok: COLORS.paper, tolerado: COLORS.warnBg, acima: COLORS.dangerBg, sem: COLORS.paper };

  const guardar = (forcar) => {
    if (!escolhidas.length) {
      setErro(listaTurmas.length ? "Escolhe a turma ou as turmas que treinam neste horário." : "Esta escola não tem turmas com alunos importados.");
      return;
    }
    const repetidas = escolhidas.filter((t) => doEscola.some((s) => s.dia === dia && horaFmt(s.hora) === hora && turmasDoBloco(s).includes(t)));
    if (repetidas.length) {
      setErro(`${repetidas.join(", ")} já ${repetidas.length === 1 ? "tem" : "têm"} treino ${dia} às ${hora}.`);
      return;
    }
    if (!forcar && atual.estado === "acima") {
      setAcima(true);
      setErro(`${escolhidas.length > 1 ? "Juntas, estas turmas têm" : "Esta turma tem"} ${atual.total} alunos. O limite é ${atual.limite} (${atual.nivel})${atual.tol ? `, até ${atual.limite + atual.tol} com ${treinadores} treinadores` : ""}.`);
      return;
    }
    setErro("");
    setAcima(false);
    onSave({ id: `s_${Date.now()}`, escola, dia, hora, treinadores: Number(treinadores) || 1, turmas: escolhidas, turma: escolhidas.join(" + "), ...(fRecinto || recintoNovo ? { recinto: fRecinto || recintoNovo } : {}) });
    setEscolhidas([]);
  };

  const alternar = (t) => {
    setErro("");
    setAcima(false);
    setEscolhidas((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  };
  const textoRegras = regrasT
    .filter((r) => r.tolerancia > 0)
    .map((r) => `${r.treinadores}+ treinadores: até +${r.tolerancia}`)
    .join(" · ");

  // PDF do mapa: uma versão compacta (só dias com treinos), desenhada fora do ecrã e impressa.
  const fotoRef = useRef(null);
  const [fotoEsp, setFotoEsp] = useState(false);
  useEffect(() => {
    if (!fotoEsp) return undefined;
    const t = setTimeout(async () => {
      try {
        const nomeEsc = modoRecinto ? `recinto ${recintoSel}` : `${escola}${fRecinto ? ` · ${fRecinto}` : ""}`;
        imprimirBalanco(fotoRef.current, { titulo: `Espaços · ${nomeEsc}`, subtitulo: `${doEscola.length} horários · ${nAcima} acima da lotação · ${nTolerados} aceitáveis pelos treinadores`, nome: `Espacos ${nomeEsc} ${isoDe(new Date())}`, logo: LOGO_BRANCO });
      } finally {
        setFotoEsp(false);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [fotoEsp]); // eslint-disable-line react-hooks/exhaustive-deps
  const diasFoto = DIAS_SEMANA.filter((d) => doEscola.some((x) => x.dia === d));
  const fotoEspacos = fotoEsp ? (
    <div style={{ position: "fixed", left: -20000, top: 0, width: Math.max(700, 150 + diasFoto.length * 190), background: COLORS.paper }}>
      <div ref={fotoRef} style={{ background: COLORS.paper }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 54, padding: "6px 4px" }}>Hora</th>
              {diasFoto.map((d) => (
                <th key={d} style={{ ...thStyle, padding: "6px 4px" }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horas.map((h) => (
              <tr key={h}>
                <td style={{ ...tdStyle, padding: "4px", fontWeight: 600, verticalAlign: "top", fontVariantNumeric: "tabular-nums" }}>{h}</td>
                {diasFoto.map((d) => (
                  <td key={d} style={{ ...tdStyle, padding: "3px 4px", verticalAlign: "top" }}>
                    {doEscola
                      .filter((x) => horaFmt(x.hora) === h && x.dia === d)
                      .map((b) => {
                        const nomes = turmasDoBloco(b);
                        const g = grupo(nomes, b.treinadores || 1, b.escola);
                        return (
                          <div key={b.id} style={{ borderLeft: `3px solid ${corEstado[g.estado]}`, background: fundoEstado[g.estado], borderRadius: 2, padding: "2px 5px", marginBottom: 3, lineHeight: 1.3 }}>
                            <div style={{ fontWeight: 600 }}>
                              {nomes.join(" + ")}
                              {nomes.length > 1 ? <span style={{ fontWeight: 400, color: COLORS.slate }}> ({nomes.length} equipas)</span> : null}
                            </div>
                            <div style={{ color: g.estado === "acima" ? COLORS.danger : g.estado === "tolerado" ? COLORS.warn : COLORS.slate }}>
                              {g.limite ? `${g.total}/${g.limite}` : "sem lotação"}
                              {[modoRecinto ? b.escola : null, !modoRecinto && b.recinto ? b.recinto : null, (b.treinadores || 1) > 1 ? `${b.treinadores} trein.` : null].filter(Boolean).map((x) => ` · ${x}`).join("")}
                            </div>
                            {g.limite ? (
                              <div style={{ marginTop: 3 }}>
                                <BarraLotacao pct={g.pct} largura={90} />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;
  return (
    <div>
      {fotoEspacos}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <select
          value={escolaSel}
          onChange={(e) => {
            setEscola(e.target.value);
            setFRecinto("");
            setEscolhidas([]);
            setErro("");
            setACriar(false);
          }}
          aria-label="Escola ou recinto"
          style={{ ...inputStyle, width: "auto", minWidth: 200, padding: "6px 10px", fontSize: 13 }}
        >
          <optgroup label="Escolas">
            {escolas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </optgroup>
          {recintosUsados.length > 0 && (
            <optgroup label="Recintos (todas as escolas)">
              {recintosUsados.map((r) => (
                <option key={r} value={`rec:${r}`}>
                  {r}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {!modoRecinto && recintosDaEscola.length > 1 && (
          <select value={fRecinto} onChange={(e) => setFRecinto(e.target.value)} aria-label="Recinto" style={{ ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 }}>
            <option value="">Todos os recintos</option>
            {recintosDaEscola.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        <span style={{ fontSize: 12.5, color: COLORS.slate, marginRight: "auto" }}>{textoRegras || "Sem tolerância por treinadores"}</span>
        <button
          type="button"
          className="press semFoto"
          disabled={!!fotoEsp || !doEscola.length}
          onClick={() => setFotoEsp(true)}
          title="Imagem do mapa semanal, compacta (só os dias com treinos)"
          style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Printer size={14} /> {fotoEsp ? "A preparar…" : "PDF do balanço"}
        </button>
        <button className="semFoto" onClick={() => setVerRegras((v) => !v)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13 }}>
          Regras dos treinadores
        </button>
        {recintosUsados.length > 0 && (
          <button onClick={() => setVerRecintos((v) => !v)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13 }}>
            Recintos
          </button>
        )}
        <button className="press" onClick={() => setImportar(true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FileText size={14} /> Importar plano semanal
        </button>
        {!aCriar && !modoRecinto && (
          <button className="press" onClick={() => setACriar(true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Novo horário
          </button>
        )}
      </div>

      {importar && (
        <ImportarPlanoSemanal
          escolas={escolas}
          turmas={turmas}
          espacos={espacos}
          recintosUsados={recintosUsados}
          normalizacao={normalizacao}
          onGuardarNormalizacao={onGuardarNormalizacao}
          onImportar={(novos, remover) => {
            onImportarPlano(novos, remover);
            setImportar(false);
          }}
          onFechar={() => setImportar(false)}
        />
      )}
      {verRecintos && (
        <GerirRecintos
          espacos={espacos}
          recintos={recintosUsados}
          normalizacao={normalizacao}
          onRenomear={onRenomearRecinto}
          onGuardarNormalizacao={onGuardarNormalizacao}
          onFechar={() => setVerRecintos(false)}
        />
      )}
      {verRegras && (
        <RegrasTreinadores
          regras={regrasT}
          onFechar={() => setVerRegras(false)}
          onGuardar={(r) => {
            onGuardarRegras(r);
            setVerRegras(false);
          }}
        />
      )}

      {aCriar && (
      <div className="pageIn" style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ ...panelTitle, marginBottom: 0 }}>Quem treina, onde e quando</div>
          <button onClick={() => { setACriar(false); setErro(""); setAcima(false); }} aria-label="Fechar novo horário" style={{ ...iconBtnStyle, color: COLORS.slate }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Dia</label>
            <select value={dia} onChange={(e) => setDia(e.target.value)} style={{ ...inputStyle, width: 130 }}>
              {DIAS_SEMANA.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Hora</label>
            {outraHora ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="time" step="300" value={hora} onChange={(e) => e.target.value && setHora(e.target.value)} autoFocus style={{ ...inputStyle, width: 110, fontVariantNumeric: "tabular-nums" }} />
                <button onClick={() => setOutraHora(false)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                  lista
                </button>
              </div>
            ) : (
              <select
                value={hora}
                onChange={(e) => (e.target.value === "__outra" ? setOutraHora(true) : setHora(e.target.value))}
                style={{ ...inputStyle, width: 110, fontVariantNumeric: "tabular-nums" }}
              >
                {horasLista.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
                <option value="__outra">Outra hora…</option>
              </select>
            )}
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Recinto (opcional)</label>
            <input value={fRecinto || recintoNovo} disabled={!!fRecinto} onChange={(e) => setRecintoNovo(e.target.value)} list="recintos-espacos" placeholder="—" style={{ ...inputStyle, width: 170 }} />
            <datalist id="recintos-espacos">
              {recintosUsados.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Treinadores</label>
            <input type="number" min="1" value={treinadores} onChange={(e) => { setTreinadores(Math.max(1, Number(e.target.value) || 1)); setAcima(false); setErro(""); }} style={{ ...inputStyle, width: 90 }} />
          </div>
        </div>

        <label style={{ ...labelStyle, marginTop: 14 }}>Turmas / equipas que treinam juntas neste horário</label>
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: -2, marginBottom: 8 }}>Se treinam à mesma hora mas separadas, guarda cada uma num horário próprio: a lotação conta-se para cada grupo.</div>
        {listaTurmas.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Esta escola não tem turmas com alunos importados na época atual.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {listaTurmas.map((t) => {
              const sel = escolhidas.includes(t.turma);
              return (
                <button
                  key={t.turma}
                  type="button"
                  onClick={() => alternar(t.turma)}
                  style={{
                    border: `1px solid ${sel ? COLORS.navy : COLORS.rule}`,
                    background: sel ? COLORS.navy : COLORS.paperRaised,
                    color: sel ? "#fff" : t.total > t.cap ? COLORS.danger : COLORS.ink,
                    borderRadius: 7,
                    padding: "5px 10px",
                    fontSize: 12.5,
                    cursor: "pointer",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {t.turma} <span style={{ opacity: 0.75 }}>{t.total}/{t.cap}</span>
                </button>
              );
            })}
          </div>
        )}
        {escolhidas.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>
              {escolhidas.join(" + ")}: <strong style={{ color: corEstado[atual.estado] === COLORS.rule ? COLORS.ink : corEstado[atual.estado] }}>{atual.total}</strong> de {atual.limite} alunos{atual.nivel ? ` (limite ${atual.nivel})` : ""}
              {atual.estado === "tolerado" && ` · aceitável com ${treinadores} treinadores (até ${atual.limite + atual.tol})`}
            </span>
            <BarraLotacao pct={atual.pct} largura={90} />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => guardar(false)} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}>
            Guardar horário
          </button>
          {acima && (
            <button onClick={() => guardar(true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px", color: COLORS.danger }}>
              Guardar mesmo assim
            </button>
          )}
        </div>
        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 8 }}>{erro}</div>}
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 10, lineHeight: 1.5 }}>
          Lotação por turma: Raiz 8 · Iniciação 10 · Básico 12 · Intermédio 14 · Avançado 16 · Expert 18. Turmas que treinam juntas (ex.: B1 + D1) não podem passar o limite do nível mais baixo do grupo, mais a tolerância dos treinadores. A lotação de cada turma pode ser ajustada no Painel.
        </div>
      </div>
      )}

      {doEscola.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <StatCard label="Equipas a treinar" value={equipasTreino.size} subtitle={equipasJuntas.size ? `${equipasJuntas.size} treinam juntas com outra` : "todas treinam sozinhas"} />
          <StatCard label="Treinos por semana" value={doEscola.length} subtitle={`${horas.length} ${horas.length === 1 ? "horário" : "horários"} diferentes`} />
          <StatCard label="Dentro da lotação" value={nOk} color={COLORS.ok} />
          <StatCard label="Aceitáveis pelos treinadores" value={nTolerados} color={nTolerados ? COLORS.warn : undefined} subtitle="acima da lotação, dentro da tolerância" />
          <StatCard label="Acima do limite" value={nAcima} color={nAcima ? COLORS.danger : undefined} subtitle="mesmo com os treinadores" />
        </div>
      )}

      {semAlunos.length > 0 && (
        <div style={{ ...panelStyle, borderColor: semAlunosPorVer.length ? COLORS.warn : COLORS.rule, background: semAlunosPorVer.length ? COLORS.warnBg : COLORS.paperRaised }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <AlertTriangle size={16} color={semAlunosPorVer.length ? COLORS.warn : COLORS.slate} />
            <div style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 220 }}>
              {semAlunosPorVer.length
                ? `${semAlunosPorVer.length} ${semAlunosPorVer.length === 1 ? "turma/equipa do horário sem alunos" : "turmas/equipas do horário sem alunos"}`
                : "Turmas/equipas sem alunos: tudo visto"}
            </div>
            {segSGQ(
              [
                ["esta", modoRecinto ? "Este recinto" : "Esta escola"],
                ["todas", "Todas as escolas"],
              ],
              semAlunosTodas ? "todas" : "esta",
              (v) => setSemAlunosTodas(v === "todas")
            )}
          </div>
          <div style={{ fontSize: 12, color: COLORS.ink2, margin: "6px 0 10px" }}>
            Estão nos horários (planos semanais) mas a app não tem alunos inscritos nelas. Pode haver alunos inscritos na turma ou equipa errada: confirmar com a escola e marcar como visto.
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {semAlunos
              .filter((x) => verVistosSA || !x.visto)
              .map((x) => (
                <div key={x.k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 8, padding: "6px 10px", opacity: x.visto ? 0.65 : 1, flexWrap: "wrap" }}>
                  <strong style={{ minWidth: 110 }}>{x.turma}</strong>
                  <span style={{ fontSize: 11, color: COLORS.slate }}>{x.naoExiste ? "não existe na app" : "0 alunos"}</span>
                  {(semAlunosTodas || modoRecinto) && <span style={{ color: COLORS.ink2 }}>{x.escola}</span>}
                  <span style={{ color: COLORS.slate, flex: 1, minWidth: 160 }}>{x.horarios.join(" · ")}</span>
                  {x.visto ? (
                    <button onClick={() => marcarVisto(x.k, false)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                      visto a {x.visto.split("-").reverse().join("/")} · voltar a avisar
                    </button>
                  ) : (
                    <button onClick={() => marcarVisto(x.k, true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "3px 10px", fontSize: 12 }}>
                      Visto
                    </button>
                  )}
                </div>
              ))}
          </div>
          {semAlunos.some((x) => x.visto) && (
            <button onClick={() => setVerVistosSA((v) => !v)} style={{ ...linkBtnStyle, fontSize: 12 }}>
              {verVistosSA ? "Esconder os vistos" : `Mostrar os vistos (${semAlunos.filter((x) => x.visto).length})`}
            </button>
          )}
        </div>
      )}

      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div style={panelTitle}>Mapa de treinos · {modoRecinto ? `recinto ${recintoSel}` : escola}{!modoRecinto && fRecinto ? ` · ${fRecinto}` : ""}</div>
          <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: COLORS.slate }}>
            {[
              ["ok", "Dentro"],
              ["tolerado", "Aceitável"],
              ["acima", "Acima"],
            ].map(([k, l]) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: corEstado[k] }} /> {l}
              </span>
            ))}
          </div>
        </div>
        {doEscola.length === 0 && (
          <div style={{ fontSize: 13, color: COLORS.slate, marginBottom: 12 }}>
            Ainda sem horários {modoRecinto ? "neste recinto" : "nesta escola"}.{" "}
            {!aCriar && !modoRecinto && (
              <button onClick={() => setACriar(true)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 13 }}>
                Adicionar o primeiro
              </button>
            )}
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Hora</th>
                {DIAS_SEMANA.map((d) => (
                  <th key={d} style={thStyle}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horas.map((h) => (
                <tr key={h}>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top", fontVariantNumeric: "tabular-nums" }}>{h}</td>
                  {DIAS_SEMANA.map((d) => {
                    const blocos = doEscola.filter((x) => horaFmt(x.hora) === h && x.dia === d).sort((a, b) => turmasDoBloco(a).join().localeCompare(turmasDoBloco(b).join(), "pt", { numeric: true }));
                    return (
                      <td key={d} style={{ ...tdStyle, verticalAlign: "top", minWidth: 170 }}>
                        {blocos.length === 0 ? (
                          <span style={{ color: COLORS.rule }}>—</span>
                        ) : (
                          blocos.map((b) => {
                            const nomes = turmasDoBloco(b);
                            const nT = b.treinadores || 1;
                            const g = grupo(nomes, nT, b.escola);
                            return (
                              <div
                                key={b.id}
                                style={{
                                  background: fundoEstado[g.estado],
                                  border: `1px solid ${g.estado === "acima" ? COLORS.danger : g.estado === "tolerado" ? COLORS.warn : COLORS.rule}`,
                                  borderLeft: `3px solid ${corEstado[g.estado]}`,
                                  borderRadius: 3,
                                  padding: "6px 8px",
                                  marginBottom: 5,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontSize: 11, color: COLORS.slate }} title={b.plano ? `Do plano semanal ${b.plano.semana ? `(semana ${b.plano.semana})` : ""}: ${b.plano.nome}` : undefined}>
                                    {[modoRecinto ? b.escola : null, nomes.length > 1 ? `${nomes.length} equipas juntas` : null].filter(Boolean).join(" · ")}
                                    {b.origem === "plano" && <span style={{ marginLeft: 4, color: COLORS.navy }}>●</span>}
                                  </span>
                                  <button title="Remover" onClick={() => onRemove(b.id)} style={{ ...iconBtnStyle, padding: 0 }}>
                                    <X size={11} />
                                  </button>
                                </div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, margin: "2px 0" }}>{nomes.join(" + ")}</div>
                                {!modoRecinto &&
                                  (editRec === b.id ? (
                                    <div style={{ display: "flex", gap: 4, alignItems: "center", margin: "2px 0 4px" }}>
                                      <input
                                        autoFocus
                                        defaultValue={b.recinto || ""}
                                        list="recintos-blocos"
                                        placeholder="Recinto"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            const v = e.currentTarget.value.trim();
                                            onUpdate(b.id, { recinto: v || undefined });
                                            setEditRec(null);
                                          }
                                          if (e.key === "Escape") setEditRec(null);
                                        }}
                                        onBlur={(e) => {
                                          const v = e.currentTarget.value.trim();
                                          if (v !== (b.recinto || "")) onUpdate(b.id, { recinto: v || undefined });
                                          setEditRec(null);
                                        }}
                                        style={{ ...inputStyle, padding: "2px 6px", fontSize: 11.5, width: 120 }}
                                      />
                                      {b.recinto && (
                                        <button
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => {
                                            onUpdate(b.id, { recinto: undefined });
                                            setEditRec(null);
                                          }}
                                          title="Tirar o recinto"
                                          style={{ ...linkBtnStyle, marginTop: 0, fontSize: 11, color: COLORS.danger }}
                                        >
                                          tirar
                                        </button>
                                      )}
                                    </div>
                                  ) : b.recinto ? (
                                    <button onClick={() => setEditRec(b.id)} title="Mudar ou tirar o recinto" style={{ border: `1px solid ${COLORS.rule}`, background: COLORS.paperRaised, borderRadius: 999, padding: "0 7px", fontSize: 10.5, color: COLORS.ink2, cursor: "pointer", margin: "1px 0 4px", fontFamily: "inherit" }}>
                                      {b.recinto}
                                    </button>
                                  ) : (
                                    <button onClick={() => setEditRec(b.id)} title="Pôr recinto" style={{ ...linkBtnStyle, marginTop: 0, fontSize: 10.5, color: COLORS.slate, display: "block", marginBottom: 3 }}>
                                      + recinto
                                    </button>
                                  ))}
                                {g.limite ? (
                                  <>
                                    <div style={{ fontSize: 11, color: g.estado === "acima" ? COLORS.danger : g.estado === "tolerado" ? COLORS.warn : COLORS.slate, marginBottom: 3, fontWeight: g.estado === "ok" ? 400 : 600 }}>
                                      {g.total} de {g.limite} atletas
                                      {g.estado === "tolerado" ? ` · +${g.total - g.limite}, aceitável` : g.estado === "acima" ? ` · +${g.total - g.limite} acima${g.tol ? ` (tolerância ${g.tol})` : ""}` : ""}
                                    </div>
                                    <BarraLotacao pct={g.pct} largura={62} />
                                  </>
                                ) : null}
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 11, color: COLORS.ink2 }}>
                                  <button onClick={() => onUpdate(b.id, { treinadores: Math.max(1, nT - 1) })} disabled={nT <= 1} aria-label="Menos um treinador" style={{ ...iconBtnStyle, padding: "0 5px", fontSize: 12, lineHeight: "16px", border: `1px solid ${COLORS.rule}`, borderRadius: 4, opacity: nT <= 1 ? 0.4 : 1 }}>
                                    −
                                  </button>
                                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                    {nT} {nT === 1 ? "treinador" : "treinadores"}
                                  </span>
                                  <button onClick={() => onUpdate(b.id, { treinadores: nT + 1 })} aria-label="Mais um treinador" style={{ ...iconBtnStyle, padding: "0 5px", fontSize: 12, lineHeight: "16px", border: `1px solid ${COLORS.rule}`, borderRadius: 4 }}>
                                    +
                                  </button>
                                </div>
                                {g.semRegisto.length > 0 && <div style={{ fontSize: 11, color: COLORS.warn }}>sem alunos importados: {g.semRegisto.join(", ")}</div>}
                              </div>
                            );
                          })
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="recintos-blocos">
          {recintosUsados.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 10 }}>Os alunos de cada turma vêm dos ficheiros de inscritos da época atual. Ajusta os treinadores de cada horário com − e +. Clica no recinto de um horário para o mudar ou tirar.</div>
      </div>
    </div>
  );
}

// ---------- Eventos ----------
// Cada evento diz para que escolas e para que turmas/equipas (por nível ou escalão) é.
// Os elegíveis são os alunos inscritos nessas escolas e turmas na data do evento
// (dos ficheiros de inscritos). Os inscritos no evento vêm do Excel do evento
// (pelo código do atleta) ou são escritos à mão por escola. Adesão = inscritos ÷ elegíveis.

const ORDEM_ESCALAO = (k, niveis) => {
  const i = (niveis || DEFAULT_NIVEIS).indexOf(k);
  if (i >= 0) return i;
  const m = String(k).match(/(\d+)/);
  return m ? 100 + Number(m[1]) : 999;
};

// Lê o Excel dos inscritos num evento. Três formatos:
// - folha com o código do atleta e uma coluna "Inscrito…" (Sim) → os códigos marcados;
// - folha só com os inscritos e o código → todos os códigos;
// - folha só com a escola (e o escalão) de cada inscrito → contagem por escola.
const SIM_EVENTO = /^(sim|s|x|1|true|yes|inscrito)$/;
function lerInscritosEvento(folhas) {
  const idAl = COLUNAS_FICHA_ALUNOS.id;
  const escAl = ["escola df", "escola", "recintos do atleta", "recinto do atleta", "recintos", "recinto"];
  const cands = [];
  folhas.forEach((fo) => {
    for (let i = 0; i < Math.min(10, fo.linhas.length); i++) {
      const cab = (fo.linhas[i] || []).map(normChave);
      const id = cab.findIndex((h) => idAl.includes(h));
      const flag = cab.findIndex((h) => /^inscrit/.test(h));
      const esc = escAl.map((a) => cab.indexOf(a)).find((j) => j >= 0);
      const escal = cab.findIndex((h) => h === "escalao" || h === "escalão" || h === "nivel");
      if (id < 0 && esc === undefined) continue;
      const dados = fo.linhas.slice(i + 1).filter((l) => l.some((c) => String(c ?? "").trim()));
      cands.push({ nome: fo.nome, id, flag, esc: esc === undefined ? -1 : esc, escal, dados });
      break;
    }
  });
  const val = (l, j) => (j >= 0 ? String(l[j] ?? "").trim() : "");
  const soInscritos = (c) => /inscrit|particip/i.test(c.nome);
  const contarPorEscola = (c) => {
    const porEscola = {};
    c.dados.forEach((l) => {
      const e = val(l, c.esc);
      if (!e) return;
      const x = (porEscola[e] = porEscola[e] || { total: 0, porEscalao: {} });
      x.total++;
      const k = val(l, c.escal);
      if (k) x.porEscalao[k] = (x.porEscalao[k] || 0) + 1;
    });
    const n = Object.values(porEscola).reduce((t, x) => t + x.total, 0);
    return { modo: "escolas", porEscola, folha: c.nome, explicacao: `folha "${c.nome}": ${n} inscritos, contados por escola (sem código do atleta)` };
  };
  // A folha com a lista dos inscritos (ex.: "Inscritos TL") é a referência: conta todos os que lá estão.
  const lista = cands.find((c) => soInscritos(c) && c.flag < 0 && (c.id >= 0 || c.esc >= 0));
  if (lista) {
    if (lista.id >= 0) {
      const ids = [...new Set(lista.dados.map((l) => val(l, lista.id).replace(/\.0+$/, "")).filter((x) => /\d/.test(x)))];
      if (ids.length) return { modo: "ids", ids, folha: lista.nome, explicacao: `folha "${lista.nome}": ${ids.length} códigos do atleta` };
    }
    if (lista.esc >= 0) return contarPorEscola(lista);
  }
  const comFlag = cands.find((c) => c.id >= 0 && c.flag >= 0);
  if (comFlag) {
    const ids = [...new Set(comFlag.dados.filter((l) => SIM_EVENTO.test(normChave(val(l, comFlag.flag)))).map((l) => val(l, comFlag.id).replace(/\.0+$/, "")).filter((x) => /\d/.test(x)))];
    if (ids.length) return { modo: "ids", ids, folha: comFlag.nome, explicacao: `folha "${comFlag.nome}": ${ids.length} alunos marcados como inscritos` };
  }
  const comId = cands.filter((c) => c.id >= 0).sort((a, b) => soInscritos(b) - soInscritos(a))[0];
  if (comId) {
    const ids = [...new Set(comId.dados.map((l) => val(l, comId.id).replace(/\.0+$/, "")).filter((x) => /\d/.test(x)))];
    if (ids.length) return { modo: "ids", ids, folha: comId.nome, explicacao: `folha "${comId.nome}": ${ids.length} códigos do atleta` };
  }
  const comEsc = cands.filter((c) => c.esc >= 0).sort((a, b) => soInscritos(b) - soInscritos(a) || a.dados.length - b.dados.length)[0];
  if (!comEsc) return null;
  return contarPorEscola(comEsc);
}

function SecaoEventos({ escolas, eventos, registoAlunos, niveis, mapaEscolas, onMapaEscola, onSave, onUpdate, onRemove }) {
  const hoje = isoDe(new Date());
  const [nome, setNome] = useState("");
  const [data, setData] = useState(hoje);
  const [escSel, setEscSel] = useState([]);
  const [modoEsc, setModoEsc] = useState("so");
  const [escalSel, setEscalSel] = useState([]);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(null);
  const [aLer, setALer] = useState(false);
  const [msgImp, setMsgImp] = useState("");
  const [dataAtual, setDataAtual] = useState(hoje);
  const [verAntigos, setVerAntigos] = useState(false);
  const [apagar, setApagar] = useState(null);
  const [novaEscola, setNovaEscola] = useState(null);

  const reg = registoAlunos[epocaDe(data)];
  const escolasReg = [...new Set(Object.values((reg && reg.alunos) || {}).map((a) => a.escola))];
  const listaEscolas = [...new Set([...escolasReg, ...escolas])].sort((a, b) => a.localeCompare(b, "pt"));
  const escaloesReg = [...new Set(alunosNaData(reg, data).map((a) => escalaoDaTurma(a.turma, niveis)))].sort((a, b) => ORDEM_ESCALAO(a, niveis) - ORDEM_ESCALAO(b, niveis));
  const novos = eventos.filter((e) => e.v === 2).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const antigos = eventos.filter((e) => e.v !== 2);
  const [aCriar, setACriar] = useState(false);
  const [fEpRaw, setFEp] = useState(null);
  const [fEv, setFEv] = useState("todos");

  // Análise: por defeito mostra a época atual (ou a mais recente com eventos).
  const epocasEv = [...new Set(novos.map((e) => epocaDe(e.data)).filter(Boolean))].sort().reverse();
  const epAtual = epocaDe(hoje);
  const epSel = fEpRaw ?? selecaoInicial(epocasEv);
  const daEpoca = novos.filter((e) => naSelecao(epSel, epocaDe(e.data)));
  const evSel = fEv !== "todos" && daEpoca.some((e) => e.id === fEv) ? fEv : "todos";
  const visiveis = evSel === "todos" ? daEpoca : daEpoca.filter((e) => e.id === evSel);
  const contaDe = new Map(visiveis.map((ev) => [ev.id, contasEvento(ev, registoAlunos, niveis)]));
  const comAdesao = visiveis.filter((ev) => contaDe.get(ev.id).adesao !== null);
  const somaIns = comAdesao.reduce((t, ev) => t + contaDe.get(ev.id).tot.inscritos, 0);
  const somaEleg = comAdesao.reduce((t, ev) => t + contaDe.get(ev.id).tot.elegiveis, 0);
  const adesaoGlobal = somaEleg ? (somaIns / somaEleg) * 100 : null;
  const totInscritos = visiveis.reduce((t, ev) => t + contaDe.get(ev.id).tot.inscritos, 0);
  const comSatisf = visiveis.filter((ev) => ev.satisfacao !== null && ev.satisfacao !== undefined && ev.satisfacao !== "");
  const satMedia = comSatisf.length ? comSatisf.reduce((t, ev) => t + Number(ev.satisfacao), 0) / comSatisf.length : null;
  const totRecl = visiveis.reduce((t, ev) => t + (Number(ev.reclamacoes) || 0), 0);
  const realizados = visiveis.filter((ev) => ev.data <= hoje).length;
  const dadosGrafico = [...comAdesao]
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
    .map((ev) => ({ name: `${ev.nome} · ${ddmm(ev.data)}`, Adesão: Math.round(contaDe.get(ev.id).adesao * 10) / 10 }));
  const porEscolaAn = {};
  comAdesao.forEach((ev) =>
    contaDe.get(ev.id).linhas.forEach((l) => {
      const x = (porEscolaAn[l.escola] = porEscolaAn[l.escola] || { escola: l.escola, elegiveis: 0, inscritos: 0, eventos: 0 });
      x.elegiveis += l.elegiveis;
      x.inscritos += l.inscritos;
      x.eventos++;
    })
  );
  const rankingEscolas = Object.values(porEscolaAn)
    .filter((x) => x.elegiveis > 0)
    .map((x) => ({ ...x, pct: (x.inscritos / x.elegiveis) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  const chip = (sel, on, txt, key) => (
    <button
      key={key || txt}
      type="button"
      onClick={on}
      style={{ border: `1px solid ${sel ? COLORS.navy : COLORS.rule}`, background: sel ? COLORS.navy : COLORS.paperRaised, color: sel ? "#fff" : COLORS.ink, borderRadius: 7, padding: "4px 9px", fontSize: 12.5, cursor: "pointer" }}
    >
      {txt}
    </button>
  );
  const alterna = (set, v) => set((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));

  const criar = () => {
    if (!nome.trim()) return setErro("Dá um nome ao evento.");
    setErro("");
    const ev = { id: `ev_${Date.now()}`, v: 2, nome: nome.trim(), data, escolas: modoEsc === "so" ? escSel : [], excluidas: modoEsc === "exceto" ? escSel : [], escaloes: escalSel, participantes: { ids: [], manual: {} }, satisfacao: null, reclamacoes: 0 };
    onSave(ev);
    setAberto(ev.id);
    setNome("");
    setEscSel([]);
    setEscalSel([]);
    setACriar(false);
    setFEp([epocaDe(ev.data)]);
  };

  // Excel dos inscritos no evento: códigos do atleta (e escola, para os que não têm código).
  const importar = async (ev, f) => {
    if (!f) return;
    setALer(true);
    setMsgImp("");
    try {
      const lidas = /\.xlsx?$/i.test(f.name) ? await lerExcelInq(f, { todas: true }) : [{ nome: f.name, linhas: lerCSVInq(await f.text()) }];
      const r = lerInscritosEvento(lidas);
      if (!r) throw new Error("não encontrei o código do atleta nem a escola dos inscritos");
      let participantes = { ids: [], manual: {} };
      if (r.modo === "ids") participantes.ids = r.ids;
      else {
        // Nome da escola no Excel ("Porto", "CN Gaia") → escola da app.
        // Procura primeiro nas escolas com alunos na época do evento.
        const comAlunos = [...new Set(Object.values(registoAlunos[epocaDe(ev.data)]?.alunos || {}).map((a) => a.escola))];
        const alvo = ev.escolas && ev.escolas.length ? ev.escolas : comAlunos.length ? comAlunos : listaEscolas;
        const mapa = {};
        Object.keys(r.porEscola).forEach((raw) => {
          // A escolha feita antes (neste evento ou noutro ficheiro) vale outra vez.
          const anterior = ev.participantes && ev.participantes.mapa && ev.participantes.mapa[raw];
          if (anterior) return (mapa[raw] = anterior);
          const guardada = (mapaEscolas || {})[normChave(raw)];
          if (guardada) return (mapa[raw] = guardada);
          const melhor = alvo.map((e) => ({ e, s: semelhancaEscolas(raw, e) })).sort((x, y) => y.s - x.s)[0];
          mapa[raw] = melhor && melhor.s >= 0.6 ? melhor.e : "";
        });
        participantes = { ids: [], manual: {}, porEscola: r.porEscola, mapa };
      }
      // Cada atualização fica guardada pela data exata, para se ver a evolução das inscrições.
      const novo = { ...ev, participantes, ficheiro: f.name, leitura: r.explicacao };
      const c = contasEvento(novo, registoAlunos, niveis);
      const ponto = { data: dataAtual, ficheiro: f.name, inscritos: c.tot.inscritos, elegiveis: c.tot.elegiveis, porEscola: Object.fromEntries(c.linhas.map((l) => [l.escola, l.inscritos])) };
      novo.historico = [...(ev.historico || []).filter((h) => h.data !== dataAtual), ponto].sort((a, b) => a.data.localeCompare(b.data));
      onUpdate(novo);
      setMsgImp(`Lido: ${r.explicacao}.`);
    } catch (e) {
      setMsgImp(`Não consegui ler o ficheiro: ${e?.message || e}.`);
    } finally {
      setALer(false);
    }
  };

  const th = { ...thStyle, whiteSpace: "nowrap" };
  const fecharForm = () => {
    setACriar(false);
    setErro("");
  };
  const formulario = aCriar && (
      <div className="pageIn" style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ ...panelTitle, marginBottom: 0 }}>Novo evento</div>
          <button onClick={fecharForm} title="Fechar" aria-label="Fechar novo evento" style={{ ...iconBtnStyle, color: COLORS.slate }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Evento</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Torneio de Natal" list="lista-eventos" style={{ ...inputStyle, width: 240 }} />
            <datalist id="lista-eventos">
              {[...new Set(eventos.map((e) => e.nome))].map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, width: 160 }} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <label style={{ ...labelStyle, margin: 0 }}>Escolas {escSel.length ? (modoEsc === "so" ? `(só ${escSel.length})` : `(todas menos ${escSel.length})`) : "(todas)"}</label>
          <div style={{ display: "inline-flex", gap: 3, background: COLORS.segTrack, borderRadius: 8, padding: 2 }}>
            {[
              ["so", "Só as escolhidas"],
              ["exceto", "Todas menos as escolhidas"],
            ].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setModoEsc(k)} style={{ border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", background: modoEsc === k ? COLORS.paperRaised : "transparent", fontWeight: modoEsc === k ? 600 : 500, color: modoEsc === k ? COLORS.ink : COLORS.ink2 }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {chip(!escSel.length, () => setEscSel([]), "Todas", "__todas")}
          {listaEscolas.map((e) => chip(escSel.includes(e), () => alterna(setEscSel, e), e.replace(/^Dragon Force\s+/, ""), e))}
        </div>
        <label style={{ ...labelStyle, marginTop: 14 }}>Turmas / equipas {escalSel.length ? `(${escalSel.length})` : "(todas)"}</label>
        {escaloesReg.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {chip(!escalSel.length, () => setEscalSel([]), "Todas", "__todos")}
            {escaloesReg.map((k) => chip(escalSel.includes(k), () => alterna(setEscalSel, k), k))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem alunos importados na época desta data: importa os inscritos no Painel para escolher as turmas e calcular a adesão.</div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
          <button onClick={criar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}>
            Criar evento
          </button>
          <button onClick={fecharForm} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
            Cancelar
          </button>
          {erro && <span style={{ color: COLORS.danger, fontSize: 13 }}>{erro}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 10, lineHeight: 1.5 }}>
          Elegíveis: alunos inscritos nessas escolas e turmas/equipas na data do evento. Depois importa o Excel dos inscritos no evento (pelo código do atleta) ou escreve os números por escola.
        </div>
      </div>
  );

  const fmtPct = (v) => (v === null || v === undefined ? "—" : `${fmtNum(v, 1)}%`);
  return (
    <div>
      {novos.length === 0 ? (
        formulario || (
          <Vazio
            icon={Sparkles}
            titulo="Ainda sem eventos"
            texto="Cria um evento para acompanhar a adesão das escolas, a satisfação e as reclamações."
            acao="Adicionar evento"
            onAcao={() => setACriar(true)}
          />
        )
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginRight: "auto" }}>Análise dos eventos</div>
            <select
              value={evSel}
              onChange={(e) => {
                setFEv(e.target.value);
                if (e.target.value !== "todos") setAberto(e.target.value);
              }}
              aria-label="Evento"
              style={{ ...inputStyle, width: "auto", maxWidth: 260, padding: "6px 10px", fontSize: 13 }}
            >
              <option value="todos">Todos os eventos ({daEpoca.length})</option>
              {daEpoca.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.nome} · {ddmm(ev.data)}
                </option>
              ))}
            </select>
            <FiltroEpocas
              compacto
              epocas={epocasEv}
              valor={epSel}
              onChange={(v) => {
                setFEp(v);
                setFEv("todos");
              }}
            />
            {!aCriar && (
              <button className="press" onClick={() => setACriar(true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Novo evento
              </button>
            )}
          </div>

          {formulario}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <StatCard label="Eventos" value={visiveis.length} subtitle={`${realizados} realizados · ${visiveis.length - realizados} por realizar`} />
            <StatCard label="Adesão média" value={fmtPct(adesaoGlobal)} color={COLORS.navy} anel={adesaoGlobal === null ? null : Math.round(adesaoGlobal)} subtitle={somaEleg ? `${fmtNum(somaIns)} de ${fmtNum(somaEleg)} elegíveis` : "sem elegíveis calculados"} />
            <StatCard label="Inscritos" value={totInscritos} subtitle="somando todos os eventos" />
            <StatCard label="Satisfação média" value={fmtPct(satMedia)} color={corSatisfacao(satMedia)} subtitle={`${comSatisf.length} de ${visiveis.length} com resultado`} />
            <StatCard label="Reclamações" value={totRecl} color={totRecl ? COLORS.danger : undefined} subtitle="associadas a eventos" />
          </div>

          {epSel.length >= 2 && evSel === "todos" && (
            <ComparacaoEpocas
              titulo="Eventos: comparação entre épocas"
              epocas={epocasEv}
              selecionadas={epSel}
              metricas={[
                { key: "n", label: "Eventos" },
                { key: "adesao", label: "Adesão média", unidade: "%", dec: 1, melhor: "alto" },
                { key: "inscritos", label: "Inscritos nos eventos", melhor: "alto" },
                { key: "sat", label: "Satisfação média", unidade: "%", dec: 1, melhor: "alto" },
                { key: "recl", label: "Reclamações", melhor: "baixo" },
              ]}
              calcular={(ep, lim) => {
                const evs = novos.filter((e) => epocaDe(e.data) === ep && (!lim || e.data <= lim));
                const cs = evs.map((e) => contasEvento(e, registoAlunos, niveis));
                const com = cs.filter((c) => c.adesao !== null);
                const el = com.reduce((t, c) => t + c.tot.elegiveis, 0);
                const sats = evs.filter((e) => e.satisfacao !== null && e.satisfacao !== undefined && e.satisfacao !== "");
                return {
                  n: evs.length,
                  adesao: el ? (com.reduce((t, c) => t + c.tot.inscritos, 0) / el) * 100 : null,
                  inscritos: cs.reduce((t, c) => t + c.tot.inscritos, 0),
                  sat: sats.length ? sats.reduce((t, e) => t + Number(e.satisfacao), 0) / sats.length : null,
                  recl: evs.reduce((t, e) => t + (Number(e.reclamacoes) || 0), 0),
                };
              }}
            />
          )}

          {dadosGrafico.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12, marginBottom: 20 }}>
              {evSel !== "todos" && (visiveis[0].historico || []).length > 1 ? (
              <div style={{ ...panelStyle, marginBottom: 0 }}>
                <div style={panelTitle}>Evolução da adesão</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={visiveis[0].historico.map((h) => ({ name: ddmm(h.data), Adesão: h.elegiveis ? Math.round((h.inscritos / h.elegiveis) * 1000) / 10 : null }))} margin={{ left: -18, right: 12, top: 10 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                    <Tooltip content={<DicaGrafico sufixo="%" />} />
                    <Line type="monotone" dataKey="Adesão" stroke={COLORS.navy} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              ) : (
              <div style={{ ...panelStyle, marginBottom: 0 }}>
                <div style={panelTitle}>Adesão por evento</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dadosGrafico} margin={{ left: -18, right: 8, top: 18 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={<TickEixoX tamanho={10.5} cor={COLORS.slate} />} height={38} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                    <Tooltip content={<DicaGrafico sufixo="%" />} cursor={{ fill: COLORS.paperSunken }} />
                    <Bar dataKey="Adesão" fill={COLORS.navy} radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                      <LabelList dataKey="Adesão" position="top" formatter={(v) => `${fmtNum(v, 1)}%`} style={{ fontSize: 10.5, fill: COLORS.ink2 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
              <div style={{ ...panelStyle, marginBottom: 0 }}>
                <div style={panelTitle}>Adesão por escola</div>
                {rankingEscolas.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem elegíveis por escola nesta época.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                    {rankingEscolas.map((x) => (
                      <div key={x.escola} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 110px 52px", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${x.escola} · ${x.inscritos} de ${x.elegiveis} em ${x.eventos} ${x.eventos === 1 ? "evento" : "eventos"}`}>
                          {x.escola.replace(/^Dragon Force\s+/, "")}
                        </span>
                        <div style={{ height: 7, background: COLORS.paperSunken, borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(x.pct, 100)}%`, background: COLORS.navy, borderRadius: 4 }} />
                        </div>
                        <span style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtNum(x.pct, 1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink2, margin: "4px 0 8px" }}>
            {evSel === "todos" ? `Eventos · ${textoSelecao(epSel)} (${visiveis.length})` : "Evento selecionado"}
            {evSel !== "todos" && (
              <button onClick={() => setFEv("todos")} style={{ ...linkBtnStyle, marginTop: 0, marginLeft: 8, fontSize: 12.5 }}>
                Ver todos
              </button>
            )}
          </div>
        </>
      )}
      {visiveis.map((ev) => {
        const c = contaDe.get(ev.id);
        const ab = aberto === ev.id;
        const manual = (ev.participantes && ev.participantes.manual) || {};
        return (
          <div key={ev.id} style={{ ...panelStyle, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", cursor: "pointer" }} onClick={() => setAberto(ab ? null : ev.id)}>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{ev.nome}</div>
                <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 2 }}>
                  {fmt(new Date(ev.data + "T00:00:00"))} · {ev.escolas && ev.escolas.length ? `${ev.escolas.length} ${ev.escolas.length === 1 ? "escola" : "escolas"}` : "todas as escolas"}
                  {ev.excluidas && ev.excluidas.length ? ` menos ${ev.excluidas.map((e) => e.replace(/^Dragon Force\s+/, "")).join(", ")}` : ""} · {ev.escaloes && ev.escaloes.length ? ev.escaloes.join(", ") : "todas as turmas e equipas"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{c.adesao === null ? "—" : `${fmtNum(c.adesao, 1)}%`}</div>
                <div style={{ fontSize: 11.5, color: COLORS.slate }}>
                  {fmtNum(c.tot.inscritos)} de {fmtNum(c.tot.elegiveis)} elegíveis
                  {c.lidos > c.tot.inscritos ? ` · ${fmtNum(c.lidos)} no Excel` : ""}
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {apagar === ev.id ? (
                  <>
                    <span style={{ fontSize: 12.5, color: COLORS.danger }}>Apagar este evento?</span>
                    <button
                      onClick={() => {
                        onRemove(ev.id);
                        setApagar(null);
                      }}
                      style={{ ...primaryBtnStyle, width: "auto", padding: "5px 10px", fontSize: 12, background: COLORS.danger }}
                    >
                      Apagar
                    </button>
                    <button onClick={() => setApagar(null)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 10px", fontSize: 12 }}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button onClick={() => setApagar(ev.id)} title="Apagar evento" aria-label={`Apagar ${ev.nome}`} style={{ ...iconBtnStyle, color: COLORS.slate }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            {ab && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.ruleSoft}`, paddingTop: 12 }}>
                {!c.temRegisto && <div style={{ fontSize: 12.5, color: COLORS.warn, marginBottom: 8 }}>Sem alunos importados em {c.ep}: não dá para saber quantos eram elegíveis.</div>}
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                  <label style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <FileText size={14} /> {aLer ? "A ler…" : ev.ficheiro ? "Substituir Excel dos inscritos" : "Importar Excel dos inscritos"}
                    <input type="file" accept=".xlsx,.csv" style={{ display: "none" }} onChange={(e) => importar(ev, e.target.files && e.target.files[0])} />
                  </label>
                  <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                    Ficheiro de
                    <input type="date" value={dataAtual} onChange={(e) => setDataAtual(e.target.value || hoje)} style={{ ...inputStyle, width: "auto", padding: "5px 8px" }} aria-label="Data do ficheiro" />
                  </label>
                  {ev.ficheiro && <span style={{ fontSize: 12, color: COLORS.slate }}>{ev.ficheiro}</span>}
                  <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                    Satisfação (%)
                    <input type="number" min="0" max="100" value={ev.satisfacao ?? ""} onChange={(e) => onUpdate({ ...ev, satisfacao: e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))) })} style={{ ...inputStyle, width: 80, padding: "5px 8px" }} />
                  </label>
                  <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                    Reclamações
                    <input type="number" min="0" value={ev.reclamacoes ?? 0} onChange={(e) => onUpdate({ ...ev, reclamacoes: Number(e.target.value) || 0 })} style={{ ...inputStyle, width: 70, padding: "5px 8px" }} />
                  </label>
                  <button onClick={() => setApagar(ev.id)} style={{ ...linkBtnStyle, marginTop: 0, marginLeft: "auto", color: COLORS.danger, fontSize: 12.5 }}>
                    Apagar evento
                  </button>
                </div>
                {msgImp ? <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 8 }}>{msgImp}</div> : ev.leitura ? <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 8 }}>Última leitura: {ev.leitura}.</div> : null}
                {(ev.historico || []).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink2, marginBottom: 6 }}>Evolução das inscrições</div>
                    {ev.historico.length > 1 && (
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={ev.historico.map((h) => ({ name: ddmm(h.data), Inscritos: h.inscritos }))} margin={{ left: -18, right: 12, top: 6 }}>
                          <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                          <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<DicaGrafico />} />
                          <Line type="monotone" dataKey="Inscritos" stroke={COLORS.navy} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {ev.historico.map((h, i) => {
                        const ant = ev.historico[i - 1];
                        return (
                          <span key={h.data} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 7, background: COLORS.paperSunken, fontVariantNumeric: "tabular-nums" }}>
                            <strong>{ddmm(h.data)}</strong> · {h.inscritos} inscritos{ant ? ` (${h.inscritos - ant.inscritos >= 0 ? "+" : ""}${h.inscritos - ant.inscritos})` : ""} · {h.elegiveis ? `${fmtNum((h.inscritos / h.elegiveis) * 100, 1)}%` : "—"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {ev.participantes && ev.participantes.porEscola && (() => {
                  const mapa = ev.participantes.mapa || {};
                  const linhasMapa = Object.entries(ev.participantes.porEscola).sort((x, y) => y[1].total - x[1].total);
                  const porResolver = linhasMapa.filter(([raw]) => !mapa[raw]);
                  const escolher = (raw, escola) => {
                    onUpdate({ ...ev, participantes: { ...ev.participantes, mapa: { ...mapa, [raw]: escola } } });
                    if (escola && onMapaEscola) onMapaEscola(raw, escola);
                  };
                  const linhaMapa = ([raw, x]) => (
                    <div key={raw} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                      <span style={{ flex: "0 0 42%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={raw}>
                        {raw} <span style={{ color: COLORS.slate }}>· {x.total}</span>
                      </span>
                      {novaEscola && novaEscola.raw === raw ? (
                        <>
                          <input autoFocus value={novaEscola.nome} onChange={(e) => setNovaEscola({ raw, nome: e.target.value })} placeholder="Nome da escola" style={{ ...inputStyle, padding: "4px 7px", fontSize: 12.5 }} />
                          <button
                            disabled={!novaEscola.nome.trim()}
                            onClick={() => {
                              escolher(raw, novaEscola.nome.trim());
                              setNovaEscola(null);
                            }}
                            style={{ ...primaryBtnStyle, width: "auto", padding: "4px 10px", fontSize: 12 }}
                          >
                            Criar
                          </button>
                        </>
                      ) : (
                        <select
                          value={mapa[raw] || ""}
                          onChange={(e) => (e.target.value === "__nova__" ? setNovaEscola({ raw, nome: `Dragon Force ${raw}` }) : escolher(raw, e.target.value))}
                          style={{ ...inputStyle, padding: "4px 7px", fontSize: 12.5, borderColor: mapa[raw] ? COLORS.rule : COLORS.warn }}
                          aria-label={`Escola de ${raw}`}
                        >
                          <option value="">Escolher escola</option>
                          {[...new Set([...listaEscolas, ...Object.values(mapa).filter(Boolean)])].map((e) => (
                            <option key={e} value={e}>
                              {e}
                            </option>
                          ))}
                          <option value="__nova__">+ Nova escola…</option>
                        </select>
                      )}
                    </div>
                  );
                  return (
                    <div style={{ marginBottom: 12 }}>
                      {porResolver.length > 0 && (
                        <div style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${COLORS.warn}`, background: COLORS.warnBg, marginBottom: 8 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
                            A app não reconheceu {porResolver.length === 1 ? "1 escola" : `${porResolver.length} escolas`} do Excel ({porResolver.reduce((t, [, x]) => t + x.total, 0)} inscritos). Diz de que escola {porResolver.length === 1 ? "é" : "são"}:
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 6 }}>{porResolver.map(linhaMapa)}</div>
                        </div>
                      )}
                      <details>
                        <summary style={{ fontSize: 12.5, cursor: "pointer", color: COLORS.ink2 }}>Escolas do Excel → escolas da app ({linhasMapa.length})</summary>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 6, marginTop: 8 }}>{linhasMapa.map(linhaMapa)}</div>
                        <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>As escolhas ficam guardadas para as próximas atualizações do Excel.</div>
                      </details>
                    </div>
                  );
                })()}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={th}>Escola</th>
                        <th style={{ ...th, textAlign: "right" }}>Elegíveis</th>
                        <th style={{ ...th, textAlign: "right" }}>Inscritos no evento</th>
                        <th style={{ ...th, textAlign: "right" }}>Adesão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.linhas.map((l) => (
                        <tr key={l.escola}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>
                            <button title="Esta escola não participa: tirar do evento" onClick={() => onUpdate({ ...ev, excluidas: [...new Set([...(ev.excluidas || []), l.escola])] })} style={{ ...iconBtnStyle, padding: 0, marginRight: 6, verticalAlign: "-2px" }} aria-label={`Tirar ${l.escola} do evento`}>
                              <X size={12} />
                            </button>
                            {l.escola}
                            {l.fora > 0 && <span style={{ fontSize: 11, color: COLORS.slate, fontWeight: 400 }}> · +{l.fora} de outras turmas/equipas (não contam)</span>}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(l.elegiveis)}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            <input
                              type="number"
                              min="0"
                              value={manual[l.escola] ?? l.inscritos}
                              onChange={(e) => onUpdate({ ...ev, participantes: { ...(ev.participantes || {}), manual: { ...manual, [l.escola]: e.target.value } } })}
                              style={{ ...inputStyle, width: 80, padding: "4px 7px", textAlign: "right" }}
                              aria-label={`Inscritos de ${l.escola}`}
                            />
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{l.elegiveis ? `${fmtNum((l.inscritos / l.elegiveis) * 100, 1)}%` : "—"}</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmtNum(c.tot.elegiveis)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmtNum(c.tot.inscritos)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{c.adesao === null ? "—" : `${fmtNum(c.adesao, 1)}%`}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {ev.excluidas && ev.excluidas.length > 0 && (
                  <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 8 }}>
                    Não participam: {ev.excluidas.join(", ")}.{" "}
                    <button onClick={() => onUpdate({ ...ev, excluidas: [] })} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                      Repor
                    </button>
                  </div>
                )}
                {c.lidos > c.tot.inscritos && (
                  <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 10, padding: "8px 10px", borderRadius: 8, background: COLORS.paperSunken }}>
                    <strong>{fmtNum(c.lidos)}</strong> inscritos no Excel, <strong>{fmtNum(c.tot.inscritos)}</strong> contam na adesão. Os outros {fmtNum(c.lidos - c.tot.inscritos)}:{" "}
                    {[
                      c.semEscola && `${c.semEscola} sem escola atribuída (escolhe-a acima)`,
                      c.semElegiveis && `${c.semElegiveis} de escolas sem alunos elegíveis importados`,
                      c.tot.fora && `${c.tot.fora} de outras turmas/equipas`,
                      c.foraEscolas && `${c.foraEscolas} de escolas que não participam`,
                      c.semCorrespondencia && `${c.semCorrespondencia} códigos que não estão nos inscritos de ${c.ep}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    .
                  </div>
                )}
                {c.foraEscolas > 0 && <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 8 }}>{c.foraEscolas} inscritos no evento são de escolas fora do público definido (não contam na adesão).</div>}
                {c.semCorrespondencia > 0 && <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 8 }}>{c.semCorrespondencia} códigos do Excel não estão nos inscritos de {c.ep} (não contam na adesão).</div>}
                <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>Os números da coluna "Inscritos no evento" vêm do Excel; podes corrigi-los à mão.</div>
              </div>
            )}
          </div>
        );
      })}

      {antigos.length > 0 && (
        <div style={{ ...panelStyle, marginTop: 16 }}>
          <button onClick={() => setVerAntigos((v) => !v)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 13 }}>
            {verAntigos ? "Esconder" : "Ver"} registos antigos ({antigos.length}, sem público definido)
          </button>
          {verAntigos && (
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Evento", "Data", "Escola", "Turmas", "Competição", "Satisfação", "Reclamações", ""].map((h) => (
                      <th key={h} style={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {antigos
                    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
                    .map((e) => (
                      <tr key={e.id}>
                        <td style={tdStyle}>{e.nome}</td>
                        <td style={tdStyle}>{e.data}</td>
                        <td style={tdStyle}>{e.escola}</td>
                        <td style={tdStyle}>{e.nTurmas || 0}</td>
                        <td style={tdStyle}>{e.nComp || 0}</td>
                        <td style={tdStyle}>{e.satisfacao ?? "—"}</td>
                        <td style={tdStyle}>{e.reclamacoes || 0}</td>
                        <td style={tdStyle}>
                          <button onClick={() => onRemove(e.id)} style={{ ...iconBtnStyle, padding: 0 }} aria-label="Remover">
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Ano de nascimento a partir de "2016", "12/03/2016", "2016-03-12" ou "12-03-16".
function anoNascimento(valor) {
  const t = String(valor || "").trim();
  if (!t) return null;
  if (/^\d{5}(\.\d+)?$/.test(t)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000).getUTCFullYear();
  const soDigitos = t.replace(/\D/g, "");
  if (/^\d{4}$/.test(t)) return Number(t);
  const iso = t.match(/^(\d{4})[-/.]\d{1,2}[-/.]\d{1,2}/);
  if (iso) return Number(iso[1]);
  const pt = t.match(/^\d{1,2}[-/.]\d{1,2}[-/.](\d{2,4})$/);
  if (pt) {
    const a = Number(pt[1]);
    return a < 100 ? 2000 + a : a;
  }
  if (soDigitos.length === 8) return Number(soDigitos.slice(4));
  const qualquer = t.match(/(19|20)\d{2}/);
  return qualquer ? Number(qualquer[0]) : null;
}

// Género a partir de M/F, Masculino/Feminino, H/M, 1/2.
function generoDe(valor) {
  const t = normChave(valor);
  if (!t) return null;
  if (["m", "masculino", "masc", "h", "homem", "male", "rapaz", "1"].includes(t)) return "m";
  if (["f", "feminino", "fem", "mulher", "female", "rapariga", "2"].includes(t)) return "f";
  if (t.startsWith("masc") || t.startsWith("homem")) return "m";
  if (t.startsWith("fem") || t.startsWith("mulher")) return "f";
  return null;
}

const SECOES_GESTAO = [
  ["registo", "Painel"],
  ["analise", "Análise"],
  ["experiencias", "Experiências"],
  ["desistencias", "Desistências"],
  ["desvinc", "Desvinculações"],
  ["espacos", "Espaços"],
  ["eventos", "Eventos"],
];

export function InscritosPage({
  op = null,
  inscritos,
  turmasAlunos,
  epocaAnterior,
  options,
  desistencias,
  experiencias,
  desvinculacoes,
  espacos,
  eventos,
  satisfacao,
  onSaveSemana,
  onRetrato,
  onImportarTurmas,
  registoAlunos,
  onImportarInscritos,
  onAplicarAtuais,
  onCapacidade,
  onMudarTurma,
  gestaoDados,
  onGuardarMapaEscaloes,
  notificar,
  onSaveTurma,
  onRemoveTurma,
  onSaveEpocaAnterior,
  onToggleTurmaEscola,
  onAddOption,
  onRemoveOption,
  onSaveDesistencia,
  onRemoveDesistencia,
  onSaveExperiencia,
  onUpdateExperiencia,
  onRemoveExperiencia,
  onSaveDesvinc,
  onUpdateDesvinc,
  onRemoveDesvinc,
  onSaveEspaco,
  onUpdateEspaco,
  onRemoveEspaco,
  onImportarPlano,
  onRenomearRecinto,
  onGuardarNormalizacao,
  onGuardarRegrasTreinadores,
  onGuardarMinimoTurma,
  onSaveEvento,
  onRemoveEvento,
  onUpdateEvento,
  onMapaEscolaEvento,
  onSaveSatisfacao,
  onRemoveSatisfacao,
  onGerirLista,
}) {
  const [view, setView] = useState("registo");
  const escolas = options.schools || [];
  const niveis = options.niveis || DEFAULT_NIVEIS;
  const minimoPct = Number(options.minimoTurmaPct) || 50;
  const alertasT = useMemo(
    () => alertasTurmas({ escolas: escolas.filter((e) => !(options.estadoEscolas || {})[e]?.encerrada), turmasAlunos, espacos, capacidades: options.capacidades, niveis, regras: options.regrasTreinadores, minimoPct }),
    [escolas, turmasAlunos, espacos, options.capacidades, options.estadoEscolas, niveis, options.regrasTreinadores, minimoPct]
  );
  // Procura um atleta pelo código: primeiro na época mais recente.
  const procurarAluno = (cod) => {
    if (!cod) return null;
    for (const ep of Object.keys(registoAlunos || {}).sort().reverse()) {
      const a = registoAlunos[ep].alunos?.[cod];
      if (a) return a;
    }
    return null;
  };

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
        {SECOES_GESTAO.map(([key, label], i) => [
          i === 2 && <span key="sep" aria-hidden="true" style={{ width: 1, alignSelf: "stretch", margin: "5px 6px", background: COLORS.rule }} />,
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
          </button>,
        ])}
      </div>

      {(view === "registo" || view === "espacos") && escolas.length > 0 && (
        <AlertasTurmas alertas={alertasT} minimoPct={minimoPct} onMinimoPct={(v) => onGuardarMinimoTurma && onGuardarMinimoTurma(v)} onVerEspacos={view === "espacos" ? null : () => setView("espacos")} />
      )}
      <div key={view} className="pageIn">
      {escolas.length === 0 ? (
        <Vazio
          icon={Users}
          titulo="Ainda não há escolas"
          texto="As escolas são partilhadas por toda a app. Cria-as primeiro e depois atribuis turmas a cada uma."
          acao="Escolas e listas"
          onAcao={() => onGerirLista("schools")}
        />
      ) : view === "experiencias" ? (
        <SecaoExperiencias
          procurarAluno={procurarAluno}
          escolas={escolas}
          turmas={turmasAlunos}
          niveis={niveis}
          experiencias={experiencias}
          onSave={onSaveExperiencia}
          onUpdate={onUpdateExperiencia}
          onRemove={onRemoveExperiencia}
          op={op}
        />
      ) : view === "desistencias" ? (
        <SecaoDesistencias
          procurarAluno={procurarAluno}
          escolas={escolas}
          turmas={turmasAlunos}
          niveis={niveis}
          motivos={options.motivosDesistencia || DEFAULT_MOTIVOS_DESISTENCIA}
          desistencias={desistencias}
          onSave={onSaveDesistencia}
          onRemove={onRemoveDesistencia}
          onGerirLista={onGerirLista}
        />
      ) : view === "desvinc" ? (
        <SecaoDesvinculacoes
          escolas={escolas}
          desvinculacoes={desvinculacoes}
          onSave={onSaveDesvinc}
          onUpdate={onUpdateDesvinc}
          onRemove={onRemoveDesvinc}
        />
      ) : view === "espacos" ? (
        <SecaoEspacos
          escolas={escolas}
          turmas={turmasAlunos}
          niveis={niveis}
          espacos={espacos}
          listaEspacos={options.espacosLista || DEFAULT_ESPACOS}
          capacidades={options.capacidades || {}}
          regras={options.regrasTreinadores}
          onSave={onSaveEspaco}
          onUpdate={onUpdateEspaco}
          onRemove={onRemoveEspaco}
          onGerirLista={onGerirLista}
          onGuardarRegras={onGuardarRegrasTreinadores}
          normalizacao={options.planosNormalizacao || {}}
          onImportarPlano={onImportarPlano}
          onRenomearRecinto={onRenomearRecinto}
          onGuardarNormalizacao={onGuardarNormalizacao}
        />
      ) : view === "eventos" ? (
        <SecaoEventos escolas={escolas} eventos={eventos} registoAlunos={registoAlunos || {}} niveis={niveis} mapaEscolas={options.mapaEscolasAlunos || {}} onMapaEscola={onMapaEscolaEvento} onSave={onSaveEvento} onUpdate={onUpdateEvento} onRemove={onRemoveEvento} />
      ) : view === "registo" ? (
        <InscritosRegisto
          escolas={escolas}
          inscritos={inscritos}
          turmasAlunos={turmasAlunos}
          epocaAnterior={epocaAnterior}
          options={options}
          registoAlunos={registoAlunos}
          onImportarInscritos={onImportarInscritos}
          onAplicarAtuais={onAplicarAtuais}
          onCapacidade={onCapacidade}
          onSaveEpocaAnterior={onSaveEpocaAnterior}
          gestaoDados={gestaoDados}
          espacos={espacos}
          onMudarTurma={onMudarTurma}
        />
      ) : (
        <AnaliseInscritos registoAlunos={registoAlunos} options={options} escolas={escolas} inscritos={inscritos} epocaAnterior={epocaAnterior} experiencias={experiencias} turmasAlunos={turmasAlunos} gestaoDados={gestaoDados} />
      )}
      </div>
    </div>
  );
}

// "26/27 BÁSICO B1" → "Básico B1"; "B1 - Intermédio (3ª/6ª 18:30)" → "Intermédio B1";
// "SUB 15A" → "Sub-15 A"; "SUB 13 - FUT11" → "Sub-13 Fut11"; "SUB 17B. NB" → "Sub-17 B (NB)".
function nomeTurmaProposto(bruto, niveis) {
  let t = String(bruto || "")
    .replace(/\([^)]*\)?/g, " ")
    .replace(/^\s*\d{2}\s*\/\s*\d{2}\s*-?\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  const sub = t.match(/sub\s*-?\s*(\d{1,2})\s*([a-z])?(?![a-z0-9])(.*)$/i);
  if (sub) {
    let nome = `Sub-${Number(sub[1])}`;
    if (sub[2]) nome += ` ${sub[2].toUpperCase()}`;
    const resto = sub[3] || "";
    const fut = resto.match(/fut\s*(\d+)/i);
    if (fut) nome += ` Fut${fut[1]}`;
    if (/(^|[^a-z])gr([^a-z]|$)/i.test(resto)) nome += " GR";
    const local = resto.match(/\.\s*([A-Z]{2,3})\b/);
    if (local) nome += ` (${local[1]})`;
    return nome;
  }
  const n = normChave(t);
  const nivel = (niveis || DEFAULT_NIVEIS).find((x) => new RegExp(`(^|[^a-z])${normChave(x)}([^a-z]|$)`).test(n));
  if (nivel) {
    const cod = t.match(/(?:^|[^A-Za-z0-9])([A-Ea-e]\d{1,2}(?:\.\d+)?)(?![0-9])/);
    return cod ? `${nivel} ${cod[1].toUpperCase()}` : nivel;
  }
  return t
    .toLocaleLowerCase("pt-PT")
    .replace(/(^|\s)(\p{L})/gu, (x, a, b) => a + b.toLocaleUpperCase("pt-PT"));
}

const rubricaDe = (v) => {
  const r = normChave(v);
  if (/renov|reinscri/.test(r)) return "renov";
  if (/extra/.test(r)) return "extra";
  if (/experi/.test(r)) return "experiencia";
  if (/inscri|^nova/.test(r)) return "novo";
  return "";
};
const ROTULO_RUBRICA = { renov: "Renovação", novo: "Inscrição", extra: "Extrainscrição", experiencia: "Experiência" };
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Renovações entre épocas: inscritos no fim da época anterior que voltaram
// (o mesmo código) com a rubrica Renovação. Por escola da época anterior.
function renovacoesEntreEpocas(regAnt, regAtual, escola) {
  if (!regAnt || !regAtual) return null;
  const base = Object.values(regAnt.alunos || {}).filter((a) => a.estado === "ativo" && !a.semCodigo && (!escola || a.escola === escola));
  if (!base.length) return null;
  const atual = regAtual.alunos || {};
  const voltaram = base.filter((a) => atual[a.id]);
  const renovaram = voltaram.filter((a) => atual[a.id].rubrica === "renov");
  // Renovação pelo código do atleta: conta quem voltou, na mesma escola ou noutra escola DF.
  return { base: base.length, voltaram: voltaram.length, renovaram: renovaram.length, taxa: Math.round((voltaram.length / base.length) * 100), mudaramEscola: voltaram.filter((a) => atual[a.id].escola !== a.escola).length };
}

// Colunas reconhecidas nas folhas do ficheiro de inscritos.
const COLUNAS_FICHA_ALUNOS = {
  escola: ["recintos do atleta", "recinto do atleta", "recintos", "recinto", "escola"],
  id: ["codigo atleta no clube", "codigo do atleta", "codigo atleta", "id do aluno", "id aluno", "id", "codigo", "n atleta", "numero de atleta"],
  nascimento: ["data de nascimento", "ano de nascimento", "nascimento", "data nasc", "ano"],
  genero: ["genero", "sexo", "genero (m ou f)", "genero (m/f)"],
  rubrica: ["rubricas/artigos", "rubricas/artigos filtrados", "rubricas", "rubrica", "artigos", "tipo de inscricao"],
  equipa: ["equipas do atleta", "equipa do atleta", "equipa/turma", "turma/equipa", "equipas", "equipa", "turma", "escalao"],
  data: ["data de entrada", "data de inscricao", "data", "data entrada"],
  motivo: ["motivo desistencia", "motivo de desistencia", "motivo da desistencia", "tipo", "motivo"],
  saida: ["data de desistencia", "data desistencia", "data da desistencia", "data de saida", "data saida"],
  semana: ["semana", "semana da epoca", "n semana"],
  mes: ["mes", "mês", "mes - inscricao", "mes inscricao", "mes de inscricao", "mes - entrada", "mes de entrada"],
  estado: ["estado da experiencia", "estado experiencia", "situacao da experiencia", "situacao", "estado", "status"],
  mesSaida: ["mes desistencia", "mes de desistencia", "mes da desistencia", "mes - desistencia", "mes saida", "mes de saida", "mes - saida"],
};

// Mês de uma célula: 9, "Setembro", "7.2024" (mês e ano), "Julho Época 21/22".
const MESES_NOMES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function mesDeCelula(v) {
  const t = normChave(v);
  if (!t) return { mes: null, ano: null };
  const m1 = t.match(/^(\d{1,2})(?:[./-](\d{4}))?$/);
  if (m1 && Number(m1[1]) >= 1 && Number(m1[1]) <= 12) return { mes: Number(m1[1]), ano: m1[2] ? Number(m1[2]) : null };
  const i = MESES_NOMES.findIndex((n) => t.startsWith(n) || t.startsWith(n.slice(0, 3) + " ") || t === n.slice(0, 3));
  return { mes: i >= 0 ? i + 1 : null, ano: null };
}

function lerFichaAlunos(linhas) {
  // Linha de títulos: a que reconhece mais colunas nas 10 primeiras.
  let iCab = -1;
  let melhor = 0;
  let mapa = {};
  linhas.slice(0, 10).forEach((l, i) => {
    const cab = l.map(normChave);
    const m = {};
    const usadas = new Set();
    Object.entries(COLUNAS_FICHA_ALUNOS).forEach(([k, sins]) => {
      for (const s0 of sins) {
        const j = cab.findIndex((h, idx) => !usadas.has(idx) && h === s0);
        if (j >= 0) {
          m[k] = j;
          usadas.add(j);
          return;
        }
      }
    });
    if (Object.keys(m).length > melhor) {
      melhor = Object.keys(m).length;
      iCab = i;
      mapa = m;
    }
  });
  // Sem código do atleta só se aceita uma folha de desistências (contam por escola).
  const semId = mapa.id === undefined;
  if (iCab < 0 || mapa.escola === undefined || (semId && mapa.motivo === undefined && mapa.mesSaida === undefined)) return null;
  const dados = linhas.slice(iCab + 1);
  // Nascimento: se a coluna escolhida tem erros (#VALUE!), usa outra com "nasc".
  const valida = (j) => {
    const vs = dados.slice(0, 300).map((l) => String(l[j] ?? "").trim()).filter(Boolean);
    return vs.length ? vs.filter((v) => (anoNascimento(v) || 0) > 1990).length / vs.length : 0;
  };
  if (mapa.nascimento !== undefined && valida(mapa.nascimento) < 0.6) {
    const alt = linhas[iCab].map((h, j) => ({ h: normChave(h), j })).find((x) => x.j !== mapa.nascimento && /nasc/.test(x.h) && valida(x.j) >= 0.6);
    if (alt) mapa.nascimento = alt.j;
  }
  const v = (l, k) => (mapa[k] === undefined ? "" : String(l[mapa[k]] ?? "").trim());
  const registos = dados
    .map((l) => ({
      id: v(l, "id").replace(/\.0+$/, ""),
      escola: v(l, "escola"),
      ano: anoNascimento(v(l, "nascimento")) || null,
      genero: generoDe(v(l, "genero")) || "",
      rubrica: rubricaDe(v(l, "rubrica")),
      equipa: v(l, "equipa"),
      data: dataDeCelula(v(l, "data")) || null,
      motivo: v(l, "motivo"),
      saida: mapa.saida !== undefined ? dataDeCelula(v(l, "saida")) || null : null,
      semana: Number(v(l, "semana")) || null,
      estado: v(l, "estado"),
      mes: mesDeCelula(v(l, "mes")).mes,
      mesAno: mesDeCelula(v(l, "mes")).ano,
      mesSaida: mesDeCelula(v(l, "mesSaida")).mes,
      mesSaidaAno: mesDeCelula(v(l, "mesSaida")).ano,
      linha: l.__linha,
    }))
    // Linhas de títulos repetidas a meio da folha não são alunos.
    // Linhas sem código (mas com escola e turma ou rubrica) também contam.
    .filter((r) => r.escola && normChave(r.escola) !== normChave(linhas[iCab][mapa.escola]) && (r.id ? /\d/.test(r.id) : semId || r.equipa || r.rubrica))
    .map((r) => (r.id && /\d/.test(r.id) ? r : { ...r, id: "" }));
  return { mapa, registos, titulos: linhas[iCab], semId };
}

function ImportarInscritos({ escolas, niveis, registoAtual, mapaTurmasGuardado, mapaEscolasGuardado, onImportar, onFechar, epocaInicial }) {
  const [folhas, setFolhas] = useState(null);
  const [papel, setPapel] = useState({ alunos: -1, desist: -1, exp: -1 });
  const [mapaEscola, setMapaEscola] = useState({});
  const [mapaTurma, setMapaTurma] = useState({});
  const [aEscrever, setAEscrever] = useState({});
  const [procuraTurma, setProcuraTurma] = useState("");
  const [faltaComo, setFaltaComo] = useState("manter");
  const [copiadoFalta, setCopiadoFalta] = useState(false);
  const [erro, setErro] = useState("");
  const [aLer, setALer] = useState(false);
  const [nomeFicheiro, setNomeFicheiro] = useState("");
  const [epocaManual, setEpocaManual] = useState(epocaInicial || "");

  const carregar = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setALer(true);
    setErro("");
    setNomeFicheiro(f.name);
    try {
      const lidas = /\.xlsx?$/i.test(f.name) ? await lerExcelInq(f, { todas: true }) : [{ nome: f.name, linhas: lerCSVInq(await f.text()) }];
      const fichas = lidas.map((fo) => ({ nome: fo.nome, oculta: fo.oculta, ficha: lerFichaAlunos(fo.linhas) })).filter((x) => x.ficha && x.ficha.registos.length);
      if (!fichas.length) throw new Error("não encontrei nenhuma folha com código do atleta e escola");
      // Papel de cada folha: desistências têm motivo; experiências têm "experi" no nome ou na rubrica; o resto são alunos.
      // Ficheiro com várias épocas (ex.: "Época 22-23", "23-24 Desistências"): usa as da mais recente.
      const tagDe = (nome) => {
        const m = String(nome).match(/(\d{2})\s*[-./]\s*(\d{2})/);
        return m && Number(m[2]) === (Number(m[1]) + 1) % 100 ? m[1] : null;
      };
      const tags = [...new Set(fichas.map((x) => tagDe(x.nome)).filter(Boolean))].sort();
      const tagEscolhida = tags.length > 1 ? tags[tags.length - 1] : null;
      const p = { alunos: -1, desist: -1, exp: -1 };
      fichas.forEach((x, i) => {
        if (tagEscolhida && tagDe(x.nome) !== tagEscolhida) return;
        const regs = x.ficha.registos;
        const ehExp = /experi/i.test(x.nome) || regs.filter((r) => r.rubrica === "experiencia").length > regs.length / 2;
        if (x.ficha.mapa.motivo !== undefined && p.desist < 0) p.desist = i;
        else if (ehExp && p.exp < 0) p.exp = i;
        else if (x.ficha.mapa.equipa !== undefined && (p.alunos < 0 || regs.length > fichas[p.alunos].ficha.registos.length)) p.alunos = i;
      });
      setFolhas(fichas);
      setPapel(p);
      // Ficheiro sem datas: a época vem do nome da folha (ex.: "Época 23-24").
      const tagAlunos = p.alunos >= 0 ? tagDe(fichas[p.alunos].nome) : null;
      if (tagAlunos && !fichas[p.alunos].ficha.registos.some((r) => r.data)) setEpocaManual(`20${tagAlunos}/${String(Number(tagAlunos) + 1).padStart(2, "0")}`);
    } catch (err) {
      setErro(`Não consegui ler o ficheiro: ${err?.message || err}.`);
    } finally {
      setALer(false);
    }
  };

  const regs = (k) => (folhas && papel[k] >= 0 ? folhas[papel[k]].ficha.registos : []);
  const alunosF = regs("alunos");
  const desistF = regs("desist");
  const expF = regs("exp");

  // ---- escolas ----
  const escolasBrutas = useMemo(() => {
    const c = {};
    [...alunosF, ...desistF, ...expF].forEach((r) => (c[r.escola] = (c[r.escola] || 0) + 1));
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [folhas, papel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const semPrefixo = (t) => normChave(t).replace(/^(dragon force|df)\s*[-–·:]?\s*/, "");
    setMapaEscola((atual) => {
      const novo = {};
      escolasBrutas.forEach(([b]) => {
        if (atual[b]) return (novo[b] = atual[b]);
        // Correspondência usada nas importações anteriores (vale para todas as épocas).
        const guardada = (mapaEscolasGuardado || {})[normChave(b)];
        if (guardada) return (novo[b] = escolas.includes(guardada) ? guardada : `__nova__${guardada}`);
        const exata = escolas.find((e) => normChave(e) === normChave(b) || semPrefixo(e) === semPrefixo(b));
        novo[b] = exata || `__nova__${nomeEscolaProposto(b)}`;
      });
      return novo;
    });
  }, [escolasBrutas]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- turmas ----
  const turmasBrutas = useMemo(() => {
    const c = {};
    [...alunosF, ...desistF].forEach((r) => r.equipa && (c[r.equipa] = (c[r.equipa] || 0) + 1));
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [folhas, papel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setMapaTurma((atual) => {
      const novo = {};
      turmasBrutas.forEach(([b]) => {
        novo[b] = atual[b] || (mapaTurmasGuardado || {})[normChave(b)] || nomeTurmaProposto(b, niveis);
      });
      return novo;
    });
  }, [turmasBrutas]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolaDe = (b) => {
    const x = mapaEscola[b] || "";
    return x.startsWith("__nova__") ? x.slice(8) : x;
  };

  // ---- resultado ----
  const resultado = useMemo(() => {
    if (!folhas) return null;
    const hoje = isoDe(new Date());
    const datas = alunosF.map((r) => r.data).filter(Boolean).sort();
    const epocaDetetada = datas.length ? epocaDe(datas[Math.floor(datas.length / 2)]) : epocaDe(hoje);
    const epoca = epocaManual || epocaDetetada;
    const anterior = (registoAtual || {})[epoca] || { alunos: {}, experiencias: {}, importacoes: [] };
    const s1 = semana1Padrao(epoca);
    const emCurso = epoca === epocaDe(hoje);
    // Ficheiros antigos só com o mês (sem data): conta como dia 1 desse mês da época.
    const anoIni = Number(epoca.slice(0, 4));
    // Entradas em junho/julho sem ano são pré-época (renovações antes de agosto); "7.2024" traz o ano.
    const comMes = (lista) =>
      lista.map((r) => {
        if (r.data || !(r.mes >= 1 && r.mes <= 12)) return r;
        const ano = r.mesAno || (r.mes >= 6 ? anoIni : anoIni + 1);
        return { ...r, data: `${ano}-${String(r.mes).padStart(2, "0")}-01`, soMes: true };
      });
    // Alunos sem código no Excel: contam com um código só desta importação (não entram na renovação).
    const aF = comMes(alunosF).map((r, i) => (r.id ? r : { ...r, id: `sem-codigo-${epoca}-a${i + 1}`, semCodigo: true }));
    const dataDoMes = (m, ano) => `${ano || (m >= 8 ? anoIni : anoIni + 1)}-${String(m).padStart(2, "0")}-01`;
    // Desistências sem código do atleta: contam na escola com um código só desta importação.
    const dF = comMes(desistF).map((r, i) => {
      const x = !r.saida && r.mesSaida >= 1 && r.mesSaida <= 12 ? { ...r, saida: dataDoMes(r.mesSaida, r.mesSaidaAno), saidaSoMes: true } : r;
      return x.id ? x : { ...x, id: `sem-codigo-${epoca}-${i + 1}`, semCodigo: true };
    });
    const eF = comMes(expF).map((r, i) => (r.id ? r : { ...r, id: `sem-codigo-${epoca}-x${i + 1}`, semCodigo: true }));
    // Sem data nenhuma: na época em curso conta hoje; numa época passada, o início da época.
    const semData = emCurso ? hoje : s1;
    // O que o ficheiro não traz, para avisar quem vê os números desta época.
    const avisos = {
      entradasSoMes: aF.filter((r) => r.soMes).length,
      // Poucas linhas: guarda quais são, para se poderem corrigir no Excel.
      linhasSoMes: aF.filter((r) => r.soMes).length <= 15 ? aF.filter((r) => r.soMes).map((r) => ({ id: r.id, linha: r.linha })) : [],
      entradasSemData: aF.filter((r) => !r.data).length,
      desistSoMes: dF.filter((r) => r.saidaSoMes || (r.soMes && !r.saida)).length,
      desistSemData: dF.filter((r) => !r.data && !r.saida).length,
      expSoMes: eF.filter((r) => r.soMes).length,
      expSemData: eF.filter((r) => !r.data).length,
      desistSemCodigo: dF.filter((r) => r.semCodigo).length,
      alunosSemCodigo: aF.filter((r) => r.semCodigo).length,
      semGenero: aF.length > 0 && !aF.some((r) => r.genero),
      alunos: aF.length,
      desist: dF.length,
      exps: eF.length,
    };
    const semHoje = semanaDaEpoca(hoje, s1);
    const alunos = {};
    // Alunos de importações anteriores que não estão neste ficheiro (podem ter saído).
    const vistos = new Set();
    aF.forEach((r) => {
      const prev = anterior.alunos[r.id];
      vistos.add(r.id);
      const turmaFicheiro = mapaTurma[r.equipa] || nomeTurmaProposto(r.equipa, niveis) || "Sem turma";
      // Turma mudada à mão (ou pelo operacional): mantém-se enquanto o ficheiro trouxer a mesma turma de antes.
      const manter = prev && (prev.turmaManual || prev.mudadoPor) && (prev.turmaFicheiro || prev.turmaAntes) === turmaFicheiro;
      alunos[r.id] = {
        id: r.id,
        escola: manter ? prev.escola : escolaDe(r.escola),
        turma: manter ? prev.turma : turmaFicheiro,
        ...(manter ? { turmaManual: true, turmaFicheiro, ...(prev.mudadoPor ? { mudadoPor: prev.mudadoPor } : {}) } : {}),
        ano: r.ano || prev?.ano || null,
        genero: r.genero || prev?.genero || "",
        rubrica: r.rubrica || prev?.rubrica || "",
        entrada: [prev?.entrada, r.data].filter(Boolean).sort()[0] || semData,
        semEntrada: semanaDaEpoca([prev?.entrada, r.data].filter(Boolean).sort()[0] || semData, s1),
        estado: "ativo",
        semCodigo: !!r.semCodigo,
        saida: null,
        motivo: null,
      };
    });
    let desistNovas = 0;
    // Folha com "Data de inscrição" e "Data de desistência" (25/26): cada uma no seu sítio.
    // Folha só com "Data" (26/27): é a data da desistência.
    const saidaDe = (r) => (r.saida !== null && r.saida !== undefined ? r.saida : r.data);
    const entradaDe = (r) => (r.saida !== null && r.saida !== undefined ? r.data : null);
    const fimEpoca = `${Number(epoca.slice(0, 4)) + 1}-07-31`;
    const foraEpoca = dF.filter((r) => saidaDe(r) && (saidaDe(r) < s1 || saidaDe(r) > fimEpoca));
    dF.forEach((r) => {
      const prev = alunos[r.id] || anterior.alunos[r.id];
      if (!(prev && prev.estado === "desistiu")) desistNovas++;
      alunos[r.id] = {
        id: r.id,
        escola: escolaDe(r.escola),
        turma: mapaTurma[r.equipa] || prev?.turma || nomeTurmaProposto(r.equipa, niveis) || "Sem turma",
        ano: r.ano || prev?.ano || null,
        genero: r.genero || prev?.genero || "",
        rubrica: r.rubrica || prev?.rubrica || "",
        // Na folha das desistências a Data é a da desistência; a entrada vem das importações
        // anteriores (pelo código) ou, sem elas, conta desde o início da época.
        entrada: prev?.entrada || entradaDe(r) || s1,
        semEntrada: semanaDaEpoca(prev?.entrada || entradaDe(r) || s1, s1),
        estado: "desistiu",
        semCodigo: !!r.semCodigo,
        // Sem data: na época em curso conta hoje; numa época passada, o fim da época.
        saida: saidaDe(r) || (prev && prev.estado === "desistiu" && prev.saida) || (emCurso ? hoje : fimEpoca),
        semSaida: semanaDaEpoca(saidaDe(r) || (prev && prev.estado === "desistiu" && prev.saida) || (emCurso ? hoje : fimEpoca), s1),
        motivo: r.motivo || "Não definido",
      };
    });
    const emFalta = Object.values(anterior.alunos).filter((a) => a.estado === "ativo" && !vistos.has(a.id) && !alunos[a.id]);
    emFalta.forEach((a) => {
      alunos[a.id] =
        faltaComo === "desistencia"
          ? { ...a, estado: "desistiu", saida: hoje, semSaida: semHoje, motivo: "Saiu sem registo (não consta do ficheiro)" }
          : { ...a, emFalta: hoje };
    });
    // Desistências antigas que não voltaram a aparecer mantêm-se.
    Object.values(anterior.alunos).forEach((a) => {
      if (!alunos[a.id]) alunos[a.id] = a;
    });
    // Experiências: quem converte sai da página das experiências e entra na época como
    // Extrainscrição. As das 3 últimas semanas do ficheiro ainda estão por decidir; as
    // mais antigas que não passaram para a época contam como não convertidas. Em épocas
    // passadas não há pendentes.
    const ultimaSemana = Math.max(0, ...[...aF, ...eF].filter((r) => r.data).map((r) => semanaDaEpoca(r.data, s1)), ...dF.filter((r) => saidaDe(r) && saidaDe(r) <= fimEpoca).map((r) => semanaDaEpoca(saidaDe(r), s1)));
    // Uma data no ficheiro depois de hoje (erro ou inscrição futura) não pode empurrar as experiências recentes para "não converteu".
    const limitePendente = emCurso ? Math.min(ultimaSemana || semHoje, semHoje) - 2 : Infinity;
    // Estado escrito no ficheiro: "em curso", "a decorrer", "pendente"… fica por decidir, seja de que semana for.
    const emCursoNoFicheiro = (r) => /curso|decorrer|pendente|aguard|por decidir|a fazer/.test(normChave(r.estado || ""));
    const experiencias = { ...anterior.experiencias };
    eF.forEach((r) => {
      const turmaXp = r.equipa ? mapaTurma[r.equipa] || (mapaTurmasGuardado || {})[normChave(r.equipa)] || nomeTurmaProposto(r.equipa, niveis) : (anterior.experiencias[r.id] || {}).turma;
      experiencias[r.id] = { id: r.id, escola: escolaDe(r.escola), ano: r.ano, genero: r.genero, ...(turmaXp ? { turma: turmaXp } : {}), data: r.data || (emCurso ? hoje : null), semana: r.data || emCurso ? semanaDaEpoca(r.data || hoje, s1) : null, ...(emCurso && emCursoNoFicheiro(r) ? { emCurso: true } : {}) };
    });
    Object.values(alunos).forEach((a) => {
      if (a.rubrica === "extra" && !experiencias[a.id]) experiencias[a.id] = { id: a.id, escola: a.escola, ano: a.ano, genero: a.genero, data: a.entrada, semana: a.semEntrada, origem: "extrainscricao" };
    });
    Object.values(experiencias).forEach((x) => {
      x.resultado = alunos[x.id] ? "sucesso" : x.emCurso || (x.semana || 0) >= limitePendente ? "pendente" : "insucesso";
    });
    const convertidas = Object.values(experiencias).filter((x) => x.resultado === "sucesso").length;
    const novos = aF.filter((r) => !anterior.alunos[r.id]).length;
    const ativos = Object.values(alunos).filter((a) => a.estado === "ativo").length;
    const turmasFinais = new Set(Object.values(alunos).map((a) => `${a.escola}|${a.turma}`));
    return {
      epoca,
      semana1: s1,
      avisos,
      alunos,
      experiencias,
      ativos,
      novos,
      desistNovas,
      emFalta: emFalta.length,
      // Quem são, para se poder confirmar à mão no sistema de inscrições.
      emFaltaLista: emFalta
        .map((a) => ({ id: a.id, escola: a.escola, turma: a.turma, semCodigo: !!a.semCodigo }))
        .sort((a, b) => (a.escola || "").localeCompare(b.escola || "", "pt") || String(a.id).localeCompare(String(b.id), "pt", { numeric: true })),
      convertidas,
      pendentesExp: Object.values(experiencias).filter((x) => x.resultado === "pendente").length,
      foraEpoca: foraEpoca.map((r) => ({ id: r.id, data: saidaDe(r), linha: r.linha })),
      primeira: !Object.keys(anterior.alunos).length,
      nTurmas: turmasFinais.size,
      importacoes: [...(anterior.importacoes || []), { data: hoje, ficheiro: nomeFicheiro, ativos, novos, desist: desistNovas, exp: eF.length }],
    };
  }, [folhas, papel, mapaEscola, mapaTurma, faltaComo, registoAtual, epocaManual]); // eslint-disable-line react-hooks/exhaustive-deps

  const novasEscolas = [...new Set(Object.values(mapaEscola).filter((x) => x.startsWith("__nova__")).map((x) => x.slice(8)))];
  const opcoesNovas = [...new Set([...escolasBrutas.map(([b]) => nomeEscolaProposto(b)), ...novasEscolas])].filter((n) => !escolas.includes(n)).sort((a, b) => a.localeCompare(b, "pt"));
  const nomesTurma = [...new Set(Object.values(mapaTurma))].filter(Boolean);
  const turmasVisiveis = turmasBrutas.filter(([b]) => !procuraTurma.trim() || normChave(`${b} ${mapaTurma[b] || ""}`).includes(normChave(procuraTurma)));

  const confirmar = () => {
    const mapaGuardar = {};
    Object.entries(mapaTurma).forEach(([b, t]) => t && (mapaGuardar[normChave(b)] = t));
    const mapaEsc = {};
    escolasBrutas.forEach(([b]) => escolaDe(b) && (mapaEsc[normChave(b)] = escolaDe(b)));
    onImportar({ ...resultado, novasEscolas, mapaTurmas: mapaGuardar, mapaEscolas: mapaEsc, motivos: [...new Set(desistF.map((r) => r.motivo).filter(Boolean))] });
  };

  const titulo = { fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 6px" };

  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(860px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>{epocaInicial ? `Importar época ${epocaInicial}` : "Importar inscritos da época"}</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.55, marginBottom: 14 }}>
          O Excel completo da semana: a folha dos alunos (escola, código do atleta, nascimento, género, rubrica, equipa e data) e, se existirem, as folhas de <strong>desistências</strong> e de <strong>experiências</strong>. Pelo código do atleta a app percebe quem entrou, quem saiu e que experiências passaram a inscrição. Guarda só o código, a escola, a turma, o ano de nascimento, o género, a rubrica e as datas.
        </div>
        <label style={{ ...primaryBtnStyle, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px", width: "auto" }}>
          <Plus size={15} /> {aLer ? "A ler…" : folhas ? "Escolher outro ficheiro" : "Escolher ficheiro Excel"}
          <input type="file" accept=".xlsx,.csv" onChange={carregar} style={{ display: "none" }} />
        </label>
        {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.danger }}>{erro}</div>}

        {folhas && (
          <>
            <div style={titulo}>Folhas do ficheiro</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {[
                ["alunos", "Alunos inscritos"],
                ["desist", "Desistências"],
                ["exp", "Experiências"],
              ].map(([k, l]) => (
                <div key={k}>
                  <label style={{ ...labelStyle, marginTop: 0 }}>{l}</label>
                  <select value={papel[k]} onChange={(e) => setPapel((p) => ({ ...p, [k]: Number(e.target.value) }))} style={inputStyle}>
                    <option value={-1}>— nenhuma —</option>
                    {folhas.map((fo, i) => (
                      <option key={i} value={i}>
                        {fo.nome} · {fo.ficha.registos.length} linhas
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12.5, color: COLORS.ink2 }}>
              Época dos dados
              <select value={epocaManual || (resultado ? resultado.epoca : "")} onChange={(e) => setEpocaManual(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "5px 8px" }}>
                {epocasDisponiveis([resultado?.epoca].filter(Boolean)).map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <span style={{ color: COLORS.slate }}>detetada pelas datas de entrada; muda se for de outra época</span>
            </div>

            <div style={titulo}>Escolas</div>
            <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 6 }}>Escolhe a escola da app para cada nome do Excel, ou cria-a com o nome que usas.</div>
            <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
              {escolasBrutas.map(([b, n], i) => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 13 }}>
                  <span style={{ flex: 1 }}>
                    {b} <span style={{ color: COLORS.slate }}>· {n}</span>
                  </span>
                  {aEscrever[b] ? (
                    <span style={{ display: "flex", gap: 6, width: 270 }}>
                      <input
                        autoFocus
                        value={aEscrever[b]}
                        onChange={(e) => setAEscrever((x) => ({ ...x, [b]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && aEscrever[b].trim()) {
                            setMapaEscola((m) => ({ ...m, [b]: `__nova__${aEscrever[b].trim()}` }));
                            setAEscrever((x) => ({ ...x, [b]: "" }));
                          }
                        }}
                        style={{ ...inputStyle, padding: "6px 8px" }}
                      />
                      <button
                        onClick={() => {
                          if (aEscrever[b].trim()) setMapaEscola((m) => ({ ...m, [b]: `__nova__${aEscrever[b].trim()}` }));
                          setAEscrever((x) => ({ ...x, [b]: "" }));
                        }}
                        style={{ ...primaryBtnStyle, width: "auto", padding: "0 10px" }}
                        aria-label="Usar este nome"
                      >
                        <Check size={14} />
                      </button>
                    </span>
                  ) : (
                    <select
                      value={mapaEscola[b] || ""}
                      onChange={(e) => {
                        if (e.target.value === "__escrever__") return setAEscrever((x) => ({ ...x, [b]: escolaDe(b) || nomeEscolaProposto(b) }));
                        setMapaEscola((m) => ({ ...m, [b]: e.target.value }));
                      }}
                      style={{ ...inputStyle, width: 270, padding: "6px 8px" }}
                    >
                      <optgroup label="Escolas da app">
                        {escolas.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Criar escola nova">
                        <option value="__escrever__">Escrever o nome…</option>
                        {opcoesNovas.map((n2) => (
                          <option key={n2} value={`__nova__${n2}`}>
                            Nova: {n2}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  )}
                </div>
              ))}
            </div>

            <div style={{ ...titulo, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span>
                Turmas e equipas · {turmasBrutas.length} nomes no Excel → {nomesTurma.length} turmas
              </span>
              <input value={procuraTurma} onChange={(e) => setProcuraTurma(e.target.value)} placeholder="Procurar…" style={{ ...inputStyle, width: 180, padding: "5px 8px", textTransform: "none", letterSpacing: 0, fontWeight: 400 }} />
            </div>
            <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 6 }}>
              À direita fica o nome da turma na app (ex.: Básico B1, Sub-15 A). Nomes iguais juntam-se na mesma turma. As correspondências ficam guardadas para a próxima importação.
            </div>
            <datalist id="lista-turmas-imp">
              {nomesTurma.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
              {turmasVisiveis.map(([b, n], i) => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 12px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 12.5 }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b}>
                    {b} <span style={{ color: COLORS.slate }}>· {n}</span>
                  </span>
                  <span style={{ color: COLORS.slate }}>→</span>
                  <input list="lista-turmas-imp" value={mapaTurma[b] || ""} onChange={(e) => setMapaTurma((m) => ({ ...m, [b]: e.target.value }))} style={{ ...inputStyle, width: 200, padding: "5px 8px", fontSize: 12.5 }} />
                </div>
              ))}
            </div>

            {resultado && (
              <>
                {resultado.emFalta > 0 && (
                  <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, border: `1px solid ${COLORS.warn}`, background: COLORS.warnBg, fontSize: 13 }}>
                    <strong>{resultado.emFalta === 1 ? "1 aluno" : `${resultado.emFalta} alunos`}</strong> da importação anterior {resultado.emFalta === 1 ? "não está" : "não estão"} neste ficheiro nem nas desistências.
                    {resultado.emFaltaLista && resultado.emFaltaLista.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: COLORS.ink2, flex: 1 }}>Para confirmares no sistema de inscrições:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const txt = resultado.emFaltaLista.map((a) => (a.semCodigo ? `(sem código) ${a.escola} · ${a.turma}` : String(a.id))).join("\n");
                              try {
                                navigator.clipboard.writeText(txt);
                                setCopiadoFalta(true);
                                setTimeout(() => setCopiadoFalta(false), 1600);
                              } catch (e) {
                                // sem acesso à área de transferência: os IDs ficam visíveis na lista
                              }
                            }}
                            style={{ background: "transparent", border: `1px solid ${COLORS.rule}`, borderRadius: 7, padding: "4px 10px", fontSize: 12, color: COLORS.ink, cursor: "pointer" }}
                          >
                            {copiadoFalta ? "Copiado" : resultado.emFaltaLista.length === 1 ? "Copiar ID" : "Copiar IDs"}
                          </button>
                        </div>
                        <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${COLORS.rule}`, borderRadius: 8, background: COLORS.paperRaised }}>
                          {resultado.emFaltaLista.map((a, i) => (
                            <div key={a.id} style={{ display: "flex", gap: 10, padding: "5px 10px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 12.5 }}>
                              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 90, userSelect: "all" }}>{a.semCodigo ? "sem código" : a.id}</span>
                              <span style={{ color: COLORS.ink2, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {a.escola} · {a.turma}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                        <input type="radio" checked={faltaComo === "manter"} onChange={() => setFaltaComo("manter")} /> Manter como inscritos (assinalados "em falta")
                      </label>
                      <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                        <input type="radio" checked={faltaComo === "desistencia"} onChange={() => setFaltaComo("desistencia")} /> Registar como desistência
                      </label>
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 16, padding: "14px 16px", background: COLORS.paperSunken, borderRadius: 10, fontSize: 13, lineHeight: 1.7 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    Época {resultado.epoca}: {resultado.ativos} alunos inscritos em {resultado.nTurmas} turmas
                  </div>
                  <div style={{ color: COLORS.ink2 }}>Época de 01/08/{resultado.epoca.slice(0, 4)} a 31/07/{Number(resultado.epoca.slice(0, 4)) + 1}; a semana 1 começa a 1 de agosto.</div>
                  {resultado.primeira ? "Primeira importação desta época." : `${resultado.novos} entradas novas desde a última importação.`} {resultado.desistNovas} desistências novas · {expF.length} experiências na folha · {resultado.convertidas} convertidas (extrainscrições) · {resultado.pendentesExp} por decidir (últimas 3 semanas).
                  {novasEscolas.length > 0 && <div>Escolas novas a criar: {novasEscolas.join(", ")}</div>}
                  {textosAvisoEpoca(resultado.avisos, resultado.epoca).map((x) => (
                    <div key={x} style={{ color: COLORS.warn }}>
                      {x}
                    </div>
                  ))}
                  {resultado.foraEpoca.length > 0 && (
                    <div style={{ color: COLORS.warn }}>
                      {resultado.foraEpoca.length === 1 ? "1 desistência tem" : `${resultado.foraEpoca.length} desistências têm`} data fora da época (provável engano no Excel):{" "}
                      {resultado.foraEpoca.map((x) => `${x.id} · ${ddmm(x.data)}/${x.data.slice(2, 4)}${x.linha ? ` (linha ${x.linha})` : ""}`).join("; ")}.
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={onFechar} style={{ ...secondaryBtnStyle, flex: 1 }}>
                Cancelar
              </button>
              <button onClick={confirmar} disabled={!resultado || papel.alunos < 0} style={{ ...primaryBtnStyle, flex: 2, opacity: !resultado || papel.alunos < 0 ? 0.5 : 1 }}>
                Importar {resultado ? `${resultado.ativos} alunos` : ""}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Escola em detalhe: turmas (lotação) e alunos pelo código.
function EscolaAlunos({ escola, reg, niveis, capacidades, onCapacidade, onFechar, espacos, epoca, onMudarTurma }) {
  const [aEditar, setAEditar] = useState(null);
  const [aba, setAba] = useState("turmas");
  const [procura, setProcura] = useState("");
  const [fEstado, setFEstado] = useState("ativo");
  const [fTurma, setFTurma] = useState("todas");
  const alunos = Object.values(reg?.alunos || {}).filter((a) => a.escola === escola);
  const ativos = alunos.filter((a) => a.estado === "ativo");
  const turmas = [...new Set(alunos.map((a) => a.turma))].sort((a, b) => a.localeCompare(b, "pt", { numeric: true }));
  // Turmas/equipas para onde se pode mudar um aluno: as da escola e as que aparecem nos espaços.
  const turmasPossiveis = [...new Set([...turmas, ...(espacos || []).filter((b) => normChave(b.escola) === normChave(escola)).flatMap(turmasDoBloco)])]
    .filter((t) => t && t !== "Sem turma")
    .sort((a, b) => a.localeCompare(b, "pt", { numeric: true }));
  const lot = gruposLotacao(escola, turmas, espacos, capacidades, niveis);
  const exps = Object.values(reg?.experiencias || {}).filter((x) => x.escola === escola);
  const lista = alunos
    .filter((a) => fEstado === "todos" || a.estado === fEstado || (fEstado === "emFalta" && a.emFalta && a.estado === "ativo"))
    .filter((a) => fTurma === "todas" || a.turma === fTurma)
    .filter((a) => !procura.trim() || String(a.id).includes(procura.trim()))
    .sort((a, b) => a.turma.localeCompare(b.turma, "pt", { numeric: true }) || String(a.id).localeCompare(String(b.id)));
  const th = { textAlign: "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.slate, padding: "7px 8px", borderBottom: `1px solid ${COLORS.rule}`, whiteSpace: "nowrap" };
  const td = { padding: "7px 8px", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontSize: 12.5, fontVariantNumeric: "tabular-nums" };
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(860px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>{escola}</h2>
            <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 4 }}>
              {ativos.length} inscritos · {ativos.filter((a) => a.rubrica === "renov").length} renovações · {alunos.filter((a) => a.estado === "desistiu").length} desistências · {exps.length} experiências ({exps.filter((x) => x.resultado === "sucesso" || reg.alunos[x.id]).length} convertidas)
            </div>
          </div>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div style={{ display: "inline-flex", gap: 3, background: COLORS.segTrack, borderRadius: 9, padding: 2, margin: "14px 0" }}>
          {[
            ["turmas", "Turmas e lotação"],
            ["alunos", "Alunos"],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setAba(k)} className="pill" style={{ background: aba === k ? COLORS.paperRaised : "transparent", border: "none", borderRadius: 7, padding: "6px 12px", fontSize: 13, fontWeight: aba === k ? 600 : 500, color: aba === k ? COLORS.ink : COLORS.ink2, cursor: "pointer" }}>
              {l}
            </button>
          ))}
        </div>
        {aba === "turmas" ? (
          <>
          {lot.grupos.some((g) => g.turmas.length > 1) && (
            <div style={{ fontSize: 12, color: COLORS.ink2, marginBottom: 10, lineHeight: 1.5 }}>
              As turmas e equipas que treinam no mesmo horário (aba Espaços) partilham a lotação: o número do grupo é para todas juntas, não para cada uma.
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Turma / equipa", "Escalão", "M", "F", "Alunos", "Capacidade", "Ocupação"].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lot.grupos
                .filter((g) => g.turmas.some((t) => ativos.some((a) => a.turma === t)))
                .sort((x, y) => x.turmas[0].localeCompare(y.turmas[0], "pt", { numeric: true }))
                .map((g) => {
                  const atG = ativos.filter((a) => g.turmas.includes(a.turma));
                  const p = g.cap ? Math.round((atG.length / g.cap) * 100) : null;
                  const junto = g.turmas.length > 1;
                  const celCap = (
                    <input
                      key={`${g.chave}|${g.cap}`}
                      type="number"
                      min="1"
                      defaultValue={g.cap}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && v !== g.cap) onCapacidade(escola, g.chave, v);
                      }}
                      style={{ ...inputStyle, width: 70, padding: "4px 6px" }}
                      aria-label={`Lotação de ${g.turmas.join(" + ")}`}
                      title={junto ? `Lotação para ${g.turmas.join(" + ")} juntas${g.propria ? "" : " (a mais baixa das turmas; muda aqui se for outra)"}` : undefined}
                    />
                  );
                  const celOcup = (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: COLORS.ruleSoft, borderRadius: 3 }}>
                        <div style={{ width: `${Math.min(100, p || 0)}%`, height: "100%", borderRadius: 3, background: p >= 95 ? COLORS.warn : p < 50 ? COLORS.slate : COLORS.navy }} />
                      </div>
                      <span style={{ fontSize: 12, width: 38, textAlign: "right", color: p >= 95 ? COLORS.warn : COLORS.ink2, fontWeight: p >= 95 ? 700 : 500 }}>{p}%</span>
                    </div>
                  );
                  const contagem = (at) => (
                    <>
                      <td style={td}>{at.filter((a) => a.genero !== "f").length}</td>
                      <td style={td}>{at.filter((a) => a.genero === "f").length}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{at.length}</td>
                    </>
                  );
                  if (!junto) {
                    const t = g.turmas[0];
                    return (
                      <tr key={g.chave}>
                        <td style={{ ...td, fontWeight: 600 }}>{t}</td>
                        <td style={{ ...td, color: COLORS.slate }}>{escalaoDaTurma(t, niveis)}</td>
                        {contagem(atG)}
                        <td style={td}>{celCap}</td>
                        <td style={{ ...td, minWidth: 140 }}>{celOcup}</td>
                      </tr>
                    );
                  }
                  return (
                    <React.Fragment key={g.chave}>
                      <tr style={{ background: COLORS.paperSunken }}>
                        <td style={{ ...td, fontWeight: 700 }}>
                          {g.turmas.join(" + ")}
                          <div style={{ fontSize: 11, fontWeight: 500, color: COLORS.slate }}>
                            treinam juntas · {g.horarios} {g.horarios === 1 ? "horário" : "horários"} nos espaços
                          </div>
                        </td>
                        <td style={{ ...td, color: COLORS.slate }}>{[...new Set(g.turmas.map((t) => escalaoDaTurma(t, niveis)))].join(" / ")}</td>
                        {contagem(atG)}
                        <td style={td}>{celCap}</td>
                        <td style={{ ...td, minWidth: 140 }}>{celOcup}</td>
                      </tr>
                      {g.turmas.map((t) => {
                        const at = ativos.filter((a) => a.turma === t);
                        return (
                          <tr key={t}>
                            <td style={{ ...td, paddingLeft: 22, color: COLORS.ink2 }}>{t}</td>
                            <td style={{ ...td, color: COLORS.slate }}>{escalaoDaTurma(t, niveis)}</td>
                            {contagem(at)}
                            <td style={{ ...td, color: COLORS.slate, fontSize: 11.5 }}>no grupo</td>
                            <td style={td} />
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <input value={procura} onChange={(e) => setProcura(e.target.value)} placeholder="Procurar pelo código do atleta" style={{ ...inputStyle, width: 230, padding: "7px 9px" }} />
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 9px" }}>
                <option value="ativo">Inscritos</option>
                <option value="desistiu">Desistiram</option>
                <option value="emFalta">Em falta na última importação</option>
                <option value="todos">Todos</option>
              </select>
              <select value={fTurma} onChange={(e) => setFTurma(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 9px" }}>
                <option value="todas">Todas as turmas</option>
                {turmas.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span style={{ alignSelf: "center", fontSize: 12, color: COLORS.slate }}>{lista.length} alunos</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Código", "Turma", "Ano", "Género", "Rubrica", "Entrada", "Estado"].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.slice(0, 400).map((a) => (
                  <tr key={a.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{a.id}</td>
                    <td style={td}>
                      {onMudarTurma && aEditar === a.id ? (
                        <select
                          autoFocus
                          value={a.turma}
                          onChange={(e) => {
                            onMudarTurma(epoca, a.id, e.target.value);
                            setAEditar(null);
                          }}
                          onBlur={() => setAEditar(null)}
                          aria-label={`Turma do aluno ${a.id}`}
                          style={{ ...inputStyle, width: "auto", padding: "3px 6px", fontSize: 12.5 }}
                        >
                          {[...new Set([a.turma, ...turmasPossiveis])].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {a.turma}
                          {(a.turmaManual || a.mudadoPor) && (
                            <span title={`${a.mudadoPor === "mapa" ? "Acertado pelo mapa de inscritos atuais" : "Mudado à mão"}${a.mudadoPor === "operacional" ? " (pelo operacional)" : ""}. No ficheiro: ${a.turmaFicheiro || a.turmaAntes || "—"}`} style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.navySoft }}>
                              mudado
                            </span>
                          )}
                          {onMudarTurma && (
                            <button type="button" onClick={() => setAEditar(a.id)} title="Mudar turma / equipa" aria-label={`Mudar a turma do aluno ${a.id}`} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: COLORS.slate, display: "inline-flex" }}>
                              <Pencil size={12} />
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    <td style={td}>{a.ano || "—"}</td>
                    <td style={td}>{a.genero ? a.genero.toUpperCase() : "—"}</td>
                    <td style={td}>{ROTULO_RUBRICA[a.rubrica] || "—"}</td>
                    <td style={td}>{a.entrada ? fmt(new Date(a.entrada + "T00:00:00")) : "—"}</td>
                    <td style={{ ...td, color: a.estado === "desistiu" ? COLORS.danger : a.emFalta ? COLORS.warn : COLORS.ok }}>
                      {a.estado === "desistiu" ? `Desistiu a ${fmt(new Date(a.saida + "T00:00:00"))} · ${a.motivo}` : a.emFalta ? "Em falta na última importação" : "Inscrito"}
                    </td>
                  </tr>
                ))}
                {lista.length > 400 && (
                  <tr>
                    <td colSpan={7} style={{ ...td, color: COLORS.slate }}>
                      A mostrar 400 de {lista.length}. Usa a procura ou o filtro de turma.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Escolher o tipo de documento a importar nos Inscritos ----------
function EscolherDocumentoInscritos({ onEscolher, onFechar }) {
  const opcoes = [
    { k: "acompanhamento", titulo: "Mapa de acompanhamento", texto: "O ficheiro da semana: alunos, desistências e experiências. Cria escolas, turmas e o balanço semanal." },
    { k: "atuais", titulo: "Inscritos atualmente", texto: "Centro, número, turma, início e término. Só acerta a equipa de cada aluno e avisa de quem já saiu." },
    { k: "controlo", titulo: "Mapa de controlo", texto: "Chega mais à frente.", desativado: true },
  ];
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(520px, 100%)", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Que documento queres importar?</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opcoes.map((o) => (
            <button
              key={o.k}
              type="button"
              disabled={o.desativado}
              onClick={() => onEscolher(o.k)}
              style={{ textAlign: "left", padding: "13px 15px", borderRadius: 10, border: `1px solid ${COLORS.rule}`, background: COLORS.paper, cursor: o.desativado ? "default" : "pointer", opacity: o.desativado ? 0.55 : 1, fontFamily: "inherit" }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.navy }}>{o.titulo}</div>
              <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 3, lineHeight: 1.5 }}>{o.texto}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Inscritos atualmente: acerta a equipa de cada aluno ----------
// Casos do mapa "Inscritos atualmente" que pedem decisão, um a um.
const TIPOS_CASO_INSCR = {
  desistidosNoMapa: { titulo: ["desistido na app que aparece inscrito no mapa", "desistidos na app que aparecem inscritos no mapa"], acoes: [["manter", "Manter como desistido"], ["reativar", "Reativar com a equipa do mapa"]] },
  terminados: { titulo: ["com término já passado no mapa", "com término já passado no mapa"], acoes: [["manter", "Manter ativo"], ["desistiu", "Dar como desistido na data de término"]] },
  foraDoMapa: { titulo: ["ativo na app que não consta do mapa", "ativos na app que não constam do mapa"], nota: "Só se contam as escolas que o mapa traz.", acoes: [["manter", "Manter ativo"], ["desistiu", "Dar como desistido hoje"]] },
  escolaDiferente: { titulo: ["com escola diferente no mapa", "com escola diferente no mapa"], acoes: [["manter", "Manter a escola da app"], ["mudarEscola", "Passar para a escola do mapa"]] },
  variasTurmas: { titulo: ["em duas equipas no mapa, nenhuma igual à da app", "em duas equipas no mapa, nenhuma igual à da app"], acoes: [["manter", "Manter a equipa da app"], ["turma", "Passar para a equipa escolhida"]] },
  semRegisto: { titulo: ["no mapa sem registo na app, com início até ao corte", "no mapa sem registo na app, com início até ao corte"], acoes: [["manter", "Não fazer nada"], ["adicionar", "Adicionar como ativo"]] },
};
const ACOES_COM_TURMA = ["reativar", "mudarEscola", "turma", "adicionar"];

function escolaAlvoCaso(c, d) {
  if (d.acao === "adicionar") return d.escola || c.escolaMapa || "";
  if (d.acao === "mudarEscola") return c.escolaMapa || "";
  if (d.acao === "reativar") return c.escolaMapa || c.escolaApp;
  return c.escolaApp;
}

function GrupoCasosInscritos({ tipo, casos, decisoes, setDecisoes, turmasDe, escolas }) {
  const [mais, setMais] = useState(false);
  const meta = TIPOS_CASO_INSCR[tipo];
  if (!casos.length) return null;
  const visiveis = mais ? casos : casos.slice(0, 25);
  const decisao = (c) => decisoes[c.id] || { acao: "manter" };
  const turmaPadrao = (c) => (c.turmas && c.turmas[0] ? c.turmas[0].alvo || c.turmas[0].proposta : c.turmaApp || "");
  const definir = (c, patch) =>
    setDecisoes((d) => {
      const atual = d[c.id] || { acao: "manter" };
      const novo = { ...atual, ...patch };
      if (patch.acao && ACOES_COM_TURMA.includes(patch.acao) && !atual.turma) novo.turma = turmaPadrao(c);
      return { ...d, [c.id]: novo };
    });
  const todos = (acao) => setDecisoes((d) => ({ ...d, ...Object.fromEntries(casos.map((c) => [c.id, { ...(d[c.id] || {}), acao, ...(ACOES_COM_TURMA.includes(acao) && !(d[c.id] || {}).turma ? { turma: turmaPadrao(c) } : {}) }])) }));
  const nAlterar = casos.filter((c) => decisao(c).acao !== "manter").length;
  return (
    <details open={casos.length <= 25} style={{ marginTop: 10, border: `1px solid ${COLORS.rule}`, borderRadius: 10, padding: "8px 12px" }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: COLORS.warn }}>
        {casos.length} {casos.length === 1 ? "aluno" : "alunos"} {meta.titulo[casos.length === 1 ? 0 : 1]}
        {nAlterar > 0 && <span style={{ color: COLORS.navy }}> · {nAlterar} a alterar</span>}
      </summary>
      {meta.nota && <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 6 }}>{meta.nota}</div>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "8px 0 4px" }}>
        {meta.acoes.map(([k, rot]) => (
          <button key={k} type="button" onClick={() => todos(k)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
            Todos: {rot.toLowerCase()}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {visiveis.map((c) => {
          const d = decisao(c);
          const escolaAlvo = escolaAlvoCaso(c, d);
          const opcoesTurma = [...new Set([...(c.turmas || []).map((t) => t.alvo || t.proposta), ...[...(turmasDe[escolaAlvo] || [])].sort()])].filter(Boolean);
          const indisponivel = (k) => (k === "mudarEscola" && !c.escolaMapa) || (k === "adicionar" && c.ativo === false);
          return (
            <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderTop: `1px solid ${COLORS.ruleSoft || COLORS.rule}`, fontSize: 12.5 }}>
              <div style={{ flex: "1 1 260px", minWidth: 0, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{c.id}</div>
                {c.escolaApp && (
                  <div style={{ color: COLORS.ink2 }}>
                    App: {c.escolaApp} · {c.turmaApp || "sem turma"}
                    {c.estado === "desistiu" ? ` · desistiu${c.saida ? ` a ${fmt(new Date(c.saida + "T00:00:00"))}` : ""}` : ""}
                  </div>
                )}
                {(c.centro || (c.turmas || []).length > 0 || c.termino) && (
                  <div style={{ color: COLORS.slate }}>
                    Mapa: {[c.centro, (c.turmas || []).map((t) => t.turmaFicheiro).join(" + "), c.inicio ? `início ${fmt(new Date(c.inicio + "T00:00:00"))}` : null, c.termino ? `término ${fmt(new Date(c.termino + "T00:00:00"))}` : null].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <select value={d.acao} onChange={(e) => definir(c, { acao: e.target.value })} style={{ ...inputStyle, width: 230, fontSize: 12.5 }}>
                {meta.acoes.map(([k, rot]) => (
                  <option key={k} value={k} disabled={indisponivel(k)}>
                    {rot}
                  </option>
                ))}
              </select>
              {d.acao === "adicionar" && !c.escolaMapa && (
                <select value={d.escola || ""} onChange={(e) => definir(c, { escola: e.target.value })} style={{ ...inputStyle, width: 190, fontSize: 12.5 }}>
                  <option value="">Escola…</option>
                  {escolas.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              )}
              {ACOES_COM_TURMA.includes(d.acao) && (
                <select value={d.turma || ""} onChange={(e) => definir(c, { turma: e.target.value })} style={{ ...inputStyle, width: 190, fontSize: 12.5 }}>
                  <option value="">Equipa…</option>
                  {[...new Set([d.turma, ...opcoesTurma])].filter(Boolean).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
      {casos.length > 25 && (
        <button type="button" onClick={() => setMais((v) => !v)} style={{ ...linkBtnStyle, fontSize: 12 }}>
          {mais ? "Mostrar menos" : `Mostrar os ${casos.length}`}
        </button>
      )}
    </details>
  );
}

function ImportarInscritosAtuais({ registoAlunos, escolas, niveis, options, onAplicar, onFechar }) {
  const [lido, setLido] = useState(null);
  const [epoca, setEpoca] = useState("");
  const [assoc, setAssoc] = useState({});
  const [decisoes, setDecisoes] = useState({});
  const [corteManual, setCorteManual] = useState("");
  const [aLer, setALer] = useState(false);
  const [erro, setErro] = useState("");
  const hoje = isoDe(new Date());
  const epocasReg = Object.keys(registoAlunos || {}).sort().reverse();

  const carregar = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setALer(true);
    setErro("");
    try {
      const folhas = /\.xlsx?$/i.test(f.name) ? await lerExcelInq(f, { todas: true }) : [{ nome: f.name, linhas: lerCSVInq(await f.text()) }];
      let achado = null;
      for (const fo of folhas) {
        const m = lerMapaInscritosAtuais(fo.linhas);
        if (m && m.registos.length && (!achado || m.registos.length > achado.registos.length)) achado = m;
      }
      if (!achado) throw new Error("não encontrei as colunas Centro, Numero e Turma");
      setLido({ nome: f.name, registos: achado.registos });
      setEpoca(epocaDoMapa(achado.registos, epocaDe(hoje)));
      setAssoc({});
      setDecisoes({});
      setCorteManual("");
    } catch (err) {
      setErro(`Não consegui ler o ficheiro: ${err?.message || err}.`);
    } finally {
      setALer(false);
    }
  };

  const reg = epoca ? registoAlunos[epoca] : null;
  const corteAuto = useMemo(() => corteDoAcompanhamento(reg), [reg]);
  const corte = corteManual || corteAuto;
  const resultado = useMemo(() => {
    if (!lido || !reg) return null;
    return compararInscritosAtuais({
      registos: lido.registos,
      reg,
      escolas,
      mapaTurmasGuardado: options.mapaTurmasAlunos || {},
      mapaEscolasGuardado: options.mapaEscolasAlunos || {},
      associacoes: assoc,
      nomeProposto: (t) => nomeTurmaProposto(t, niveis),
      hoje,
      corte,
    });
  }, [lido, reg, assoc, corte]); // eslint-disable-line react-hooks/exhaustive-deps

  const turmasDe = useMemo(() => {
    const m = {};
    Object.values((reg && reg.alunos) || {}).forEach((a) => (m[a.escola] = m[a.escola] || new Set()).add(a.turma));
    return m;
  }, [reg]);

  // Decisões dos casos que mexem nos dados (as "manter" ficam de fora).
  const acoes = useMemo(() => {
    if (!resultado) return [];
    return resultado.casos
      .map((c) => {
        const d = decisoes[c.id];
        if (!d || d.acao === "manter") return null;
        const escola = escolaAlvoCaso(c, d);
        if (ACOES_COM_TURMA.includes(d.acao) && (!d.turma || !escola)) return null;
        return { id: c.id, acao: d.acao, escola, turma: d.turma || null, saida: d.acao === "desistiu" ? (c.tipo === "terminados" && c.termino ? c.termino : hoje) : null, entrada: c.inicio || null, motivo: c.tipo === "terminados" ? "Término no mapa de inscritos" : "Saiu sem registo (não consta do mapa de inscritos)" };
      })
      .filter(Boolean);
  }, [resultado, decisoes]); // eslint-disable-line react-hooks/exhaustive-deps
  const incompletas = resultado ? resultado.casos.filter((c) => decisoes[c.id] && ACOES_COM_TURMA.includes(decisoes[c.id].acao) && (!decisoes[c.id].turma || !escolaAlvoCaso(c, decisoes[c.id]))).length : 0;

  const aplicar = () => {
    const mapaTurmas = {};
    Object.entries(assoc).forEach(([k, v]) => {
      if (!v || v === "__skip__") return;
      mapaTurmas[normChave(k.split("|").slice(1).join("|"))] = v;
    });
    onAplicar(epoca, resultado.mudar, mapaTurmas, acoes);
  };

  const nAplicar = resultado ? resultado.mudar.length + acoes.length : 0;

  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(860px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Inscritos atualmente</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.55, marginBottom: 14 }}>
          Compara a equipa de cada aluno (pelo código) com o que a app já tem e acerta-a. Os casos que não batem certo ficam em baixo para decidires um a um. Nada muda sem carregares em aplicar.
        </div>

        <label style={{ ...secondaryBtnStyle, width: "auto", display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", cursor: "pointer" }}>
          <FileText size={15} /> {aLer ? "A ler…" : lido ? "Trocar ficheiro" : "Escolher o Excel"}
          <input type="file" accept=".xlsx,.csv" onChange={carregar} style={{ display: "none" }} />
        </label>
        {lido && <span style={{ marginLeft: 10, fontSize: 12, color: COLORS.slate }}>{lido.nome}</span>}
        {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.warn }}>{erro}</div>}

        {lido && (
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, color: COLORS.ink2 }}>
            <label>Época</label>
            <select value={epoca} onChange={(e) => setEpoca(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              {[...new Set([epoca, ...epocasReg])].filter(Boolean).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            {reg && (
              <>
                <label style={{ marginLeft: 8 }}>Último acompanhamento cobre inscrições até</label>
                <input type="date" value={corte || ""} onChange={(e) => setCorteManual(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
              </>
            )}
          </div>
        )}

        {lido && !reg && (
          <div style={{ marginTop: 12, fontSize: 13, color: COLORS.warn, lineHeight: 1.5 }}>
            A app ainda não tem alunos na época {epoca}. Importa primeiro o mapa de acompanhamento dessa época.
          </div>
        )}

        {resultado && (
          <>
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, background: COLORS.paperSunken, fontSize: 13, lineHeight: 1.7 }}>
              <strong>{resultado.ids}</strong> alunos no mapa ({resultado.linhas} linhas) · <strong>{resultado.iguais}</strong> já na equipa certa · <strong style={{ color: COLORS.navy }}>{resultado.mudar.length}</strong> mudam de equipa
              {resultado.porAssociar.length > 0 && <> · {resultado.semAssociacao} à espera de associação de turma</>}
              {resultado.ignorados > 0 && <> · {resultado.ignorados} deixados como estão</>}
              {resultado.casos.length > 0 && <> · <strong style={{ color: COLORS.warn }}>{resultado.casos.length}</strong> casos para rever</>}
              {resultado.recentes.length > 0 && (
                <div style={{ color: COLORS.slate, fontSize: 12.5 }}>
                  {resultado.recentes.length} inscritos depois de {corte ? fmt(new Date(corte + "T00:00:00")) : "o último acompanhamento"}: é normal ainda não estarem na app, entram com o próximo mapa de acompanhamento.
                </div>
              )}
            </div>

            {resultado.porAssociar.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.navy, flex: 1, minWidth: 220 }}>{resultado.porAssociar.length} turmas do mapa que a app não reconhece</div>
                  <button
                    type="button"
                    onClick={() => setAssoc((a) => ({ ...a, ...Object.fromEntries(resultado.porAssociar.map((x) => [x.chave, nomeTurmaProposto(x.turmaFicheiro, niveis) || x.turmaFicheiro])) }))}
                    style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}
                  >
                    Criar todas como novas
                  </button>
                  <button type="button" onClick={() => setAssoc((a) => ({ ...a, ...Object.fromEntries(resultado.porAssociar.map((x) => [x.chave, "__skip__"])) }))} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                    Não mexer em nenhuma
                  </button>
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto", border: `1px solid ${COLORS.rule}`, borderRadius: 8 }}>
                  {resultado.porAssociar.slice(0, 200).map((x) => {
                    const existentes = [...(turmasDe[x.escola] || [])].sort();
                    const prop = nomeTurmaProposto(x.turmaFicheiro, niveis) || x.turmaFicheiro;
                    return (
                      <div key={x.chave} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderBottom: `1px solid ${COLORS.rule}`, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 200, fontSize: 12.5 }}>
                          <div style={{ fontWeight: 600 }}>{x.turmaFicheiro}</div>
                          <div style={{ color: COLORS.slate, fontSize: 11.5 }}>
                            {x.escola} · {x.n} {x.n === 1 ? "aluno" : "alunos"}
                          </div>
                        </div>
                        <select value={assoc[x.chave] || ""} onChange={(e) => setAssoc((a) => ({ ...a, [x.chave]: e.target.value }))} style={{ ...inputStyle, width: 230, fontSize: 12.5 }}>
                          <option value="">Escolher…</option>
                          <option value="__skip__">Não mexer nestes alunos</option>
                          <option value={prop}>Criar «{prop}»</option>
                          {existentes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                  {resultado.porAssociar.length > 200 && <div style={{ padding: 8, fontSize: 12, color: COLORS.slate }}>Mostra as 200 com mais alunos; as outras ficam por associar.</div>}
                </div>
              </div>
            )}

            {resultado.mudar.length > 0 && (
              <details style={{ marginTop: 12, fontSize: 12.5 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, color: COLORS.navy }}>Ver as {resultado.mudar.length} mudanças de equipa</summary>
                <div style={{ marginTop: 6, maxHeight: 220, overflowY: "auto", lineHeight: 1.7, fontVariantNumeric: "tabular-nums", color: COLORS.ink2 }}>
                  {resultado.mudar.slice(0, 400).map((m) => (
                    <div key={m.id}>
                      {m.id} · {m.escola}: {m.de} → <strong>{m.para}</strong>
                    </div>
                  ))}
                  {resultado.mudar.length > 400 && <div>… e mais {resultado.mudar.length - 400}</div>}
                </div>
              </details>
            )}

            {resultado.casos.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${COLORS.rule}` }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy }}>Casos para rever</div>
                <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 2 }}>Só códigos, turmas e datas. Por defeito fica tudo como está.</div>
                {Object.keys(TIPOS_CASO_INSCR).map((t) => (
                  <GrupoCasosInscritos key={t} tipo={t} casos={resultado[t]} decisoes={decisoes} setDecisoes={setDecisoes} turmasDe={turmasDe} escolas={escolas} />
                ))}
              </div>
            )}
          </>
        )}

        {incompletas > 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: COLORS.warn }}>{incompletas} casos sem equipa ou escola escolhida: ficam como estão.</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, flex: 1 }}>
            Cancelar
          </button>
          <button onClick={aplicar} disabled={!resultado || !nAplicar} style={{ ...primaryBtnStyle, flex: 2, opacity: !resultado || !nAplicar ? 0.5 : 1 }}>
            {nAplicar ? `Aplicar ${nAplicar} ${nAplicar === 1 ? "alteração" : "alterações"}` : "Sem alterações a aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InscritosRegisto({ escolas, inscritos, turmasAlunos, epocaAnterior, options, registoAlunos, onImportarInscritos, onAplicarAtuais, onCapacidade, onSaveEpocaAnterior, gestaoDados, espacos = [], onMudarTurma }) {
  const [gerir, setGerir] = useState(false);
  const niveis = options.niveis || DEFAULT_NIVEIS;
  const epocaHoje = epocaDe(isoDe(new Date()));
  const epocasReg = Object.keys(registoAlunos || {}).sort().reverse();
  const [epoca, setEpoca] = useState(epocasReg.includes(epocaHoje) ? epocaHoje : epocasReg[0] || epocaHoje);
  const reg = (registoAlunos || {})[epoca];
  const epAnt = `${Number(epoca.slice(0, 4)) - 1}/${epoca.slice(2, 4)}`;
  const regAnt = (registoAlunos || {})[epAnt];
  const [escolherDoc, setEscolherDoc] = useState(false);
  const [importarAtuais, setImportarAtuais] = useState(false);
  const [importar, setImportar] = useState(null);
  const [aba, setAba] = useState("escolas");
  const fotoRef = useRef(null);
  const [escolaSel, setEscolaSel] = useState("");
  const [escolaAberta, setEscolaAberta] = useState(null);
  const [ordem, setOrdem] = useState("inscritos");
  const [hEsc, setHEsc] = useState(escolas[0] || "");
  const [hIns, setHIns] = useState("");
  const [hDes, setHDes] = useState("");
  const [fMotDes, setFMotDes] = useState("todos");

  const capacidades = options.capacidades || {};
  const todos = Object.values(reg?.alunos || {});
  const alunos = todos.filter((a) => !escolaSel || a.escola === escolaSel);
  const ativos = alunos.filter((a) => a.estado === "ativo");
  const desist = alunos.filter((a) => a.estado === "desistiu");
  const exps = Object.values(reg?.experiencias || {}).filter((x) => !escolaSel || x.escola === escolaSel);
  const convertidas = exps.filter((x) => x.resultado === "sucesso" || reg?.alunos?.[x.id]).length;
  const pendentesExp = exps.filter((x) => x.resultado === "pendente").length;
  const ultima = reg?.importacoes?.[reg.importacoes.length - 1];
  const escolasReg = [...new Set(todos.map((a) => a.escola))].sort((a, b) => a.localeCompare(b, "pt"));

  const balanco = useMemo(() => balancoSemanal(reg, escolaSel || null, epoca), [reg, escolaSel, epoca]);
  const balancoAnt = useMemo(() => balancoSemanal(regAnt, escolaSel || null, epAnt), [regAnt, escolaSel, epAnt]);
  // Semana atual; se ainda não tem movimento, mostra a última que teve.
  const atualSem = (() => {
    const ult = balanco[balanco.length - 1];
    if (!ult || ult.entradas || ult.desist || ult.exp) return ult;
    return [...balanco].reverse().find((b) => b.entradas || b.desist || b.exp) || ult;
  })();
  // Mesma semana da época passada, para comparar com justiça.
  const homologo = atualSem && balancoAnt.find((b) => b.k === atualSem.k);
  const renov = renovacoesEntreEpocas(regAnt, reg, escolaSel || null);

  // Evolução: esta época e a anterior, pela semana da época.
  const serie = (() => {
    const ks = [...new Set([...balanco.map((b) => b.k), ...balancoAnt.map((b) => b.k)])].sort((a, b) => a - b);
    return ks.map((k) => ({ name: `S${k}`, [epoca]: balanco.find((b) => b.k === k)?.ativos ?? null, [epAnt]: balancoAnt.find((b) => b.k === k)?.ativos ?? null }));
  })();

  const linhaEscola = (e) => {
    const al = todos.filter((a) => a.escola === e);
    const at = al.filter((a) => a.estado === "ativo");
    const ex = Object.values(reg.experiencias || {}).filter((x) => x.escola === e);
    const ts = [...new Set(at.map((a) => a.turma))];
    // Turmas que treinam juntas contam uma só lotação.
    const capT = gruposLotacao(e, ts, espacos, capacidades, niveis).total(ts);
    const bal = balancoSemanal(reg, e, epoca);
    const k = bal.length ? bal[bal.length - 1].k : null;
    const antK = regAnt ? balancoSemanal(regAnt, e, epAnt).find((b) => b.k === k) : null;
    const ant = antK ? antK.ativos : (epocaAnterior[e] || {}).inscritos || null;
    const rv = renovacoesEntreEpocas(regAnt, reg, e);
    return {
      e,
      inscritos: at.length,
      variacao: ant ? Math.round(((at.length - ant) / ant) * 1000) / 10 : null,
      antTxt: antK ? `na semana ${k} de ${epAnt}` : ant ? `no fim de ${epAnt}` : "",
      renovacao: rv ? rv.taxa : null,
      novos: at.filter((a) => a.rubrica !== "renov").length,
      desist: al.filter((a) => a.estado === "desistiu").length,
      exp: ex.length,
      conv: ex.filter((x) => x.resultado === "sucesso" || reg.alunos[x.id]).length,
      ocupacao: capT ? Math.round((at.length / capT) * 100) : null,
    };
  };
  const linhasEscolas = reg ? escolasReg.map(linhaEscola) : [];
  const ordenar = {
    inscritos: (a, b) => b.inscritos - a.inscritos,
    variacao: (a, b) => (a.variacao ?? 999) - (b.variacao ?? 999),
    renovacao: (a, b) => (a.renovacao ?? 999) - (b.renovacao ?? 999),
    desist: (a, b) => b.desist - a.desist,
    ocupacao: (a, b) => (a.ocupacao ?? 999) - (b.ocupacao ?? 999),
    nome: (a, b) => a.e.localeCompare(b.e, "pt"),
  };

  // Escalões: inscritos, género, turmas e ocupação.
  const porEscalao = (() => {
    const g = {};
    ativos.forEach((a) => {
      const k = escalaoDaTurma(a.turma, niveis);
      g[k] = g[k] || { k, n: 0, f: 0, turmas: new Set(), cap: 0, desist: 0, renov: 0 };
      g[k].n++;
      if (a.genero === "f") g[k].f++;
      if (a.rubrica === "renov") g[k].renov++;
      g[k].turmas.add(`${a.escola}|${a.turma}`);
    });
    desist.forEach((a) => {
      const k = escalaoDaTurma(a.turma, niveis);
      if (g[k]) g[k].desist++;
    });
    // Lotação por escalão: nas turmas que treinam juntas, cada uma leva a sua parte da lotação do grupo.
    const lotEsc = {};
    const lotDe = (esc) => (lotEsc[esc] = lotEsc[esc] || gruposLotacao(esc, ativos.filter((a) => a.escola === esc).map((a) => a.turma), espacos, capacidades, niveis));
    Object.values(g).forEach((x) => (x.cap = Math.round([...x.turmas].reduce((n, k) => n + lotDe(k.split("|")[0]).parte(k.split("|").slice(1).join("|")), 0))));
    const ordemEsc = (k) => {
      const i = niveis.indexOf(k);
      if (i >= 0) return i;
      const m = String(k).match(/(\d+)/);
      return m ? 100 + Number(m[1]) : 999;
    };
    return Object.values(g).sort((a, b) => ordemEsc(a.k) - ordemEsc(b.k));
  })();

  const motivos = (() => {
    const c = {};
    desist.forEach((a) => (c[a.motivo || "Não definido"] = (c[a.motivo || "Não definido"] || 0) + 1));
    return Object.entries(c)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  })();

  const listaDesist = desist
    .filter((a) => fMotDes === "todos" || (a.motivo || "Não definido") === fMotDes)
    .sort((a, b) => String(b.saida || "").localeCompare(String(a.saida || "")));

  const th = { textAlign: "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.slate, padding: "8px 9px", borderBottom: `1px solid ${COLORS.rule}`, whiteSpace: "nowrap" };
  const td = { padding: "8px 9px", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontSize: 13, fontVariantNumeric: "tabular-nums" };
  const corVar = (v) => (v === null || v === undefined ? COLORS.slate : v >= 0 ? COLORS.ok : COLORS.danger);
  const fmtVar = (v) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${fmtNum(v, 1)}%`);
  const Kpi = ({ l, v, sub, cor }) => (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: COLORS.ink2, fontWeight: 600 }}>{l}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, letterSpacing: "-0.02em", color: cor || COLORS.ink, fontVariantNumeric: "tabular-nums" }}>{v}</div>
      {sub && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
  const variacaoHomologa = homologo && homologo.ativos ? Math.round(((atualSem.ativos - homologo.ativos) / homologo.ativos) * 1000) / 10 : null;

  return (
    <div ref={fotoRef}>
      {/* ---- cabeçalho ---- */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select value={epoca} onChange={(e) => setEpoca(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "8px 10px", fontWeight: 600 }} aria-label="Época">
            {[...new Set([epocaHoje, ...epocasReg])].sort().reverse().map((e) => (
              <option key={e} value={e}>
                Época {e}
              </option>
            ))}
          </select>
          {reg && (
            <select value={escolaSel} onChange={(e) => setEscolaSel(e.target.value)} style={{ ...inputStyle, width: "auto", maxWidth: 260, padding: "8px 10px" }} aria-label="Escola">
              <option value="">Todas as escolas</option>
              {escolasReg.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          )}
          <span style={{ fontSize: 12, color: COLORS.slate }}>{ultima ? `Atualizado a ${fmt(new Date(ultima.data + "T00:00:00"))}` : ""}</span>
        </div>
        <div className="semFoto" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {reg && <BotaoFoto alvo={fotoRef} titulo={`Balanço de inscritos · ${escolaSel || "Todas as escolas"}`} subtitulo={`Época ${epoca}`} nome={`Balanço inscritos ${escolaSel || "geral"} ${isoDe(new Date())}`} />}
          {gestaoDados && (
            <>
              <button className="press" onClick={() => setGerir("nomes")} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Pencil size={14} /> Nomes das turmas
              </button>
              <button className="press" onClick={() => setGerir("apagar")} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
                Gerir dados
              </button>
            </>
          )}
          <button className="press" onClick={() => setImportar(epAntDe(epocaHoje))} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
            Importar época anterior
          </button>
          <button className="press" onClick={() => setEscolherDoc(true)} style={{ ...primaryBtnStyle, width: "auto", padding: "9px 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={15} /> Importar documento
          </button>
        </div>
      </div>

      {reg && <AvisoDadosEpoca registos={[[epoca, reg]]} />}
      {!reg ? (
        <div style={{ ...panelStyle, marginBottom: 16 }}>
          <Vazio icon={Users} titulo={`Ainda sem alunos em ${epoca}`} texto="Importa o Excel da semana: a app cria as escolas, as turmas e o balanço semanal a partir dele. Para comparar com épocas anteriores, importa também os ficheiros dessas épocas." acao="Importar documento" onAcao={() => setEscolherDoc(true)} />
        </div>
      ) : (
        <>
          {/* ---- estado atual ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
            <Kpi l="Inscritos" v={fmtNum(ativos.length)} sub={variacaoHomologa !== null ? <span style={{ color: corVar(variacaoHomologa), fontWeight: 600 }}>{fmtVar(variacaoHomologa)} vs semana {atualSem.k} de {epAnt}</span> : `${escolaSel ? "" : `${escolasReg.length} escolas · `}${new Set(ativos.map((a) => `${a.escola}|${a.turma}`)).size} turmas`} />
            {renov ? (
              <Kpi l={`Renovaram de ${epAnt}`} v={`${renov.taxa}%`} sub={`${renov.voltaram} de ${renov.base} inscritos no fim de ${epAnt}${renov.mudaramEscola ? ` · ${renov.mudaramEscola} noutra escola DF` : ""}`} cor={renov.taxa >= 70 ? COLORS.ok : renov.taxa >= 50 ? COLORS.warn : COLORS.danger} />
            ) : (
              <Kpi l="Renovações" v={`${ativos.length ? Math.round((ativos.filter((a) => a.rubrica === "renov").length / ativos.length) * 100) : 0}%`} sub={`dos inscritos são renovações · importa ${epAnt} para a taxa de renovação`} />
            )}
            <Kpi l="Inscrições novas" v={fmtNum(ativos.filter((a) => a.rubrica !== "renov").length)} sub={`${ativos.filter((a) => a.rubrica === "extra").length} extrainscrições`} />
            <Kpi l="Desistências" v={fmtNum(desist.length)} sub={`${alunos.length ? fmtNum((desist.length / alunos.length) * 100, 1) : 0}%${motivos[0] ? ` · mais frequente: ${motivos[0].name.toLowerCase()}` : ""}`} cor={desist.length ? COLORS.danger : COLORS.ink} />
            <Kpi l="Experiências" v={fmtNum(exps.length)} sub={`${convertidas} convertidas (${exps.length - pendentesExp ? Math.round((convertidas / (exps.length - pendentesExp)) * 100) : 0}% das decididas) · ${pendentesExp} por decidir`} />
            {atualSem && <Kpi l={`Semana ${atualSem.k}`} v={`${atualSem.variacao > 0 ? "+" : ""}${atualSem.variacao}`} sub={`${atualSem.entradas} entradas · ${atualSem.desist} desistências · ${atualSem.exp} experiências`} cor={atualSem.variacao > 0 ? COLORS.ok : atualSem.variacao < 0 ? COLORS.danger : COLORS.ink} />}
          </div>

          {/* ---- evolução ---- */}
          <div style={{ ...panelStyle, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={panelTitle}>Inscritos por semana da época{escolaSel ? ` · ${escolaSel}` : ""}</div>
              <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: COLORS.ink2 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 16, borderTop: `2px solid ${COLORS.navy}` }} /> {epoca}
                </span>
                {balancoAnt.length > 0 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 16, borderTop: `2px dashed ${COLORS.slate}` }} /> {epAnt}
                  </span>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={serie} margin={{ left: 6, right: 10, top: 8 }}>
                <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                <Tooltip content={<DicaGrafico />} />
                {balancoAnt.length > 0 && <Line type="monotone" dataKey={epAnt} name={epAnt} stroke={COLORS.slate} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />}
                <Line type="monotone" dataKey={epoca} name={epoca} stroke={COLORS.navy} strokeWidth={2.4} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ---- análises ---- */}
          <div style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "inline-flex", gap: 3, background: COLORS.segTrack, borderRadius: 9, padding: 2 }}>
                {[
                  ["escolas", "Escolas"],
                  ["semanas", "Semanas"],
                  ["escaloes", "Escalões"],
                  ["desistencias", "Desistências"],
                ].map(([k, l]) => (
                  <button key={k} onClick={() => setAba(k)} className="pill" style={{ background: aba === k ? COLORS.paperRaised : "transparent", border: "none", borderRadius: 7, padding: "6px 13px", fontSize: 13, fontWeight: aba === k ? 600 : 500, color: aba === k ? COLORS.ink : COLORS.ink2, cursor: "pointer", boxShadow: aba === k ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
                    {l}
                  </button>
                ))}
              </div>
              {aba === "escolas" && (
                <select value={ordem} onChange={(e) => setOrdem(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 9px", fontSize: 12.5 }} aria-label="Ordenar">
                  <option value="inscritos">Mais inscritos</option>
                  <option value="variacao">Pior variação</option>
                  <option value="renovacao">Pior renovação</option>
                  <option value="desist">Mais desistências</option>
                  <option value="ocupacao">Menor ocupação</option>
                  <option value="nome">Nome</option>
                </select>
              )}
            </div>

            {aba === "escolas" && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Escola", "Inscritos", `vs ${epAnt}`, "Renovação", "Novos", "Desist.", "Experiências", "Ocupação"].map((h) => (
                        <th key={h} style={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...linhasEscolas].sort(ordenar[ordem]).map((x) => (
                      <tr key={x.e} className="rowHover" style={{ cursor: "pointer" }} onClick={() => setEscolaAberta(x.e)} title="Ver turmas e alunos">
                        <td style={{ ...td, fontWeight: 600 }}>{x.e}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{x.inscritos}</td>
                        <td style={{ ...td, color: corVar(x.variacao), fontWeight: 600 }} title={x.antTxt}>
                          {fmtVar(x.variacao)}
                        </td>
                        <td style={{ ...td, color: x.renovacao === null ? COLORS.slate : x.renovacao >= 70 ? COLORS.ok : x.renovacao >= 50 ? COLORS.warn : COLORS.danger }}>{x.renovacao === null ? "—" : `${x.renovacao}%`}</td>
                        <td style={td}>{x.novos}</td>
                        <td style={{ ...td, color: x.desist ? COLORS.danger : COLORS.ink }}>{x.desist}</td>
                        <td style={td}>
                          {x.exp} <span style={{ color: COLORS.slate }}>({x.conv} conv.)</span>
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, background: COLORS.ruleSoft }}>
                              <div style={{ width: `${Math.min(100, x.ocupacao || 0)}%`, height: "100%", borderRadius: 3, background: x.ocupacao >= 95 ? COLORS.warn : x.ocupacao < 50 ? COLORS.slate : COLORS.navy }} />
                            </div>
                            <span style={{ fontSize: 12, width: 34, textAlign: "right" }}>{x.ocupacao ?? "—"}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {aba === "semanas" && (
              <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Semana", "Entradas", "das quais novas", "Desistências", "Experiências", "Inscritos no fim", "Variação", ...(balancoAnt.length ? [`${epAnt} (mesma semana)`] : [])].map((h) => (
                        <th key={h} style={{ ...th, position: "sticky", top: 0, background: COLORS.paperRaised }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...balanco].reverse().map((b) => {
                      const ant = balancoAnt.find((x) => x.k === b.k);
                      return (
                        <tr key={b.k}>
                          <td style={td}>
                            <strong>Semana {b.k}</strong> <span style={{ color: COLORS.slate }}>{ddmm(b.ini)}–{ddmm(b.fim)}</span>
                          </td>
                          <td style={td}>{b.entradas}</td>
                          <td style={td}>{b.novos}</td>
                          <td style={{ ...td, color: b.desist ? COLORS.danger : COLORS.ink }}>{b.desist}</td>
                          <td style={td}>{b.exp}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{b.ativos}</td>
                          <td style={{ ...td, fontWeight: 600, color: b.variacao > 0 ? COLORS.ok : b.variacao < 0 ? COLORS.danger : COLORS.slate }}>{b.variacao > 0 ? `+${b.variacao}` : b.variacao}</td>
                          {balancoAnt.length > 0 && <td style={{ ...td, color: COLORS.slate }}>{ant ? ant.ativos : "—"}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {aba === "escaloes" && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Escalão", "Inscritos", "Feminino", "Renovações", "Turmas", "Ocupação", "Desist."].map((h) => (
                        <th key={h} style={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porEscalao.map((x) => {
                      const oc = x.cap ? Math.round((x.n / x.cap) * 100) : null;
                      return (
                        <tr key={x.k}>
                          <td style={{ ...td, fontWeight: 600 }}>{x.k}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{x.n}</td>
                          <td style={td}>
                            {x.f} <span style={{ color: COLORS.slate }}>({Math.round((x.f / x.n) * 100)}%)</span>
                          </td>
                          <td style={td}>{Math.round((x.renov / x.n) * 100)}%</td>
                          <td style={td}>{x.turmas.size}</td>
                          <td style={{ ...td, color: oc >= 95 ? COLORS.warn : COLORS.ink }}>{oc ?? "—"}%</td>
                          <td style={{ ...td, color: x.desist ? COLORS.danger : COLORS.ink }}>{x.desist}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {aba === "desistencias" && (
              <div className="relGrelha" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink2, marginBottom: 6 }}>Motivos</div>
                  <BarrasRel dados={motivos} largura={210} cor={COLORS.danger} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink2, marginBottom: 6 }}>Por semana da época</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={balanco.map((b) => ({ name: `S${b.k}`, value: b.desist }))} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                      <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                      <Bar dataKey="value" name="Desistências" fill={COLORS.danger} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink2 }}>Quem desistiu ({desist.length})</div>
                    <select value={fMotDes} onChange={(e) => setFMotDes(e.target.value)} className="semFoto" style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 12 }} aria-label="Filtrar por motivo">
                      <option value="todos">Todos os motivos</option>
                      {motivos.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({m.value})
                        </option>
                      ))}
                    </select>
                  </div>
                  {listaDesist.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem desistências com este filtro.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["Código", ...(escolaSel ? [] : ["Escola"]), "Turma", "Entrada", "Desistiu a", "Motivo"].map((h) => (
                              <th key={h} style={th}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {listaDesist.slice(0, 300).map((a) => (
                            <tr key={a.id}>
                              <td style={{ ...td, fontWeight: 600 }}>{a.id}</td>
                              {!escolaSel && <td style={td}>{a.escola}</td>}
                              <td style={td}>{a.turma || "—"}</td>
                              <td style={td}>{a.entrada ? fmt(new Date(a.entrada + "T00:00:00")) : "—"}</td>
                              <td style={td}>{a.saida ? fmt(new Date(a.saida + "T00:00:00")) : "—"}</td>
                              <td style={{ ...td, fontSize: 12.5 }}>{a.motivo || "Não definido"}</td>
                            </tr>
                          ))}
                          {listaDesist.length > 300 && (
                            <tr>
                              <td colSpan={6} style={{ ...td, color: COLORS.slate }}>
                                A mostrar 300 de {listaDesist.length}. Filtra por motivo ou por escola.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- referência manual, só quando não há ficheiro da época passada ---- */}
      {!regAnt && (
        <details style={{ ...panelStyle, marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: COLORS.ink2 }}>Referência da época passada sem ficheiro (escrever à mão)</summary>
          <div style={{ fontSize: 12.5, color: COLORS.slate, margin: "10px 0 12px" }}>Só é preciso se não tiveres o Excel de {epAnt}. Com o ficheiro importado, a comparação é feita semana a semana e pelo código dos alunos.</div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Escola</label>
              <select value={hEsc} onChange={(e) => setHEsc(e.target.value)} style={{ ...inputStyle, width: 220 }}>
                {escolas.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Inscritos no final</label>
              <input type="number" min="0" value={hIns} onChange={(e) => setHIns(e.target.value)} style={{ ...inputStyle, width: 140 }} placeholder={String((epocaAnterior[hEsc] || {}).inscritos ?? "112")} />
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Desistências na época</label>
              <input type="number" min="0" value={hDes} onChange={(e) => setHDes(e.target.value)} style={{ ...inputStyle, width: 155 }} placeholder={String((epocaAnterior[hEsc] || {}).desist ?? "18")} />
            </div>
            <button
              onClick={() => {
                if (!hEsc || hIns === "") return;
                onSaveEpocaAnterior(hEsc, { inscritos: Number(hIns), ...(hDes !== "" ? { desist: Number(hDes) } : {}) });
                setHIns("");
                setHDes("");
              }}
              style={{ ...secondaryBtnStyle, flex: "none", width: "auto", padding: "9px 16px" }}
            >
              Guardar
            </button>
          </div>
        </details>
      )}

      {escolherDoc && (
        <EscolherDocumentoInscritos
          onFechar={() => setEscolherDoc(false)}
          onEscolher={(k) => {
            setEscolherDoc(false);
            if (k === "acompanhamento") setImportar("semana");
            else if (k === "atuais") setImportarAtuais(true);
          }}
        />
      )}
      {importarAtuais && (
        <ImportarInscritosAtuais
          registoAlunos={registoAlunos}
          escolas={escolas}
          niveis={niveis}
          options={options}
          onFechar={() => setImportarAtuais(false)}
          onAplicar={(ep, mudancas, mapaTurmas, acoes) => {
            onAplicarAtuais(ep, mudancas, mapaTurmas, acoes);
            setEpoca(ep);
            setImportarAtuais(false);
          }}
        />
      )}
      {importar && (
        <ImportarInscritos
          escolas={escolas}
          niveis={niveis}
          registoAtual={registoAlunos}
          epocaInicial={importar === "semana" ? "" : importar}
          mapaTurmasGuardado={options.mapaTurmasAlunos || {}}
          mapaEscolasGuardado={options.mapaEscolasAlunos || {}}
          onFechar={() => setImportar(null)}
          onImportar={(r) => {
            onImportarInscritos(r);
            setEpoca(r.epoca);
            setImportar(null);
          }}
        />
      )}
      {escolaAberta && reg && <EscolaAlunos escola={escolaAberta} reg={reg} niveis={niveis} capacidades={capacidades} onCapacidade={onCapacidade} espacos={espacos} epoca={epoca} onMudarTurma={onMudarTurma} onFechar={() => setEscolaAberta(null)} />}
      {gerir && <GerirDadosAlunos registoAlunos={registoAlunos} options={options} g={gestaoDados} epocaInicial={epoca} abaInicial={typeof gerir === "string" ? gerir : "apagar"} onFechar={() => setGerir(false)} />}
    </div>
  );
}

// Semelhança entre dois nomes de turma (0 a 1). Ignora maiúsculas, acentos, espaços,
// hífenes e a época no nome ("26/27 SUB-10 A" ≈ "Sub-10A"); números diferentes
// (Sub-14 vs Sub-15) contam como turmas diferentes.
const compactoTurma = (t) =>
  normChave(String(t || "").replace(/\b\d{2}\s*\/\s*\d{2}\b/g, ""))
    .replace(/\bepoca\b/g, "")
    .replace(/[^a-z0-9]/g, "");
function distanciaTexto(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let ant = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, ant + (a[i - 1] === b[j - 1] ? 0 : 1));
      ant = tmp;
    }
  }
  return d[b.length];
}
function semelhancaTurmas(a, b) {
  const x = compactoTurma(a);
  const y = compactoTurma(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  let s = 1 - distanciaTexto(x, y) / Math.max(x.length, y.length);
  if ((x.match(/\d+/g) || []).join(",") !== (y.match(/\d+/g) || []).join(",")) s *= 0.4;
  if (x.includes(y) || y.includes(x)) s = Math.max(s, 0.75);
  return s;
}

// Semelhança entre nomes de escolas (0 a 1). Ignora "Dragon Force"/"DF" e reconhece
// siglas: "CNMaia" ≈ "Colégio Novo da Maia".
const compactoEscola = (t) =>
  normChave(t)
    .replace(/^(dragon force|df)\s*[-–·:]?\s*/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();
function semelhancaEscolas(a, b) {
  const x = compactoEscola(a).replace(/ /g, "");
  const y = compactoEscola(b).replace(/ /g, "");
  if (!x || !y) return 0;
  if (x === y) return 1;
  const sigla = (t) => {
    const p = compactoEscola(t)
      .split(" ")
      .filter((w) => w && !["da", "de", "do", "das", "dos", "e"].includes(w));
    return p.length > 1 ? p.slice(0, -1).map((w) => w[0]).join("") + p[p.length - 1] : "";
  };
  if ((sigla(b) && x === sigla(b)) || (sigla(a) && y === sigla(a))) return 0.95;
  let r = 1 - distanciaTexto(x, y) / Math.max(x.length, y.length);
  if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) r = Math.max(r, 0.8);
  return r;
}

function GerirDadosAlunos({ registoAlunos, options, g, epocaInicial, abaInicial, onFechar }) {
  const [aba, setAba] = useState(abaInicial || "apagar");
  const epocasReg = Object.keys(registoAlunos || {}).sort().reverse();

  // ---- nomes das turmas ----
  const epHojeN = epocaDe(isoDe(new Date()));
  const epocasNomes = [...new Set([...epocasReg, ...((g.turmasAtuais || []).length ? [epHojeN] : [])])].sort().reverse();
  const [nEp, setNEp] = useState(epocaInicial && epocasNomes.includes(epocaInicial) ? epocaInicial : epocasNomes[0] || "todas");
  const [nEsc, setNEsc] = useState("");
  const [aEditar, setAEditar] = useState(null);
  const [novoNome, setNovoNome] = useState("");
  const nEpocas = nEp === "todas" ? epocasNomes : [nEp];
  const contagemTurmas = {};
  nEpocas.forEach((ep) => {
    const al = registoAlunos[ep] ? Object.values(registoAlunos[ep].alunos || {}) : ep === epHojeN ? [] : [];
    if (al.length) {
      al.filter((a) => !nEsc || a.escola === nEsc).forEach((a) => {
        const t = a.turma || "Sem turma";
        const x = (contagemTurmas[t] = contagemTurmas[t] || { n: 0, escolas: new Set(), epocas: new Set() });
        if (a.estado === "ativo") x.n++;
        x.escolas.add(a.escola);
        x.epocas.add(ep);
      });
    } else if (ep === epHojeN) {
      (g.turmasAtuais || []).filter((t) => !nEsc || t.escola === nEsc).forEach((t) => {
        const x = (contagemTurmas[t.turma] = contagemTurmas[t.turma] || { n: 0, escolas: new Set(), epocas: new Set() });
        x.n += (t.m || 0) + (t.f || 0);
        x.escolas.add(t.escola);
        x.epocas.add(ep);
      });
    }
  });
  const nomesTurmas = Object.keys(contagemTurmas).sort((a, b) => a.localeCompare(b, "pt", { numeric: true }));
  const escolasNomes = [...new Set(nEpocas.flatMap((ep) => [...Object.values(registoAlunos[ep]?.alunos || {}).map((a) => a.escola), ...(ep === epHojeN ? (g.turmasAtuais || []).map((t) => t.escola) : [])]))].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt"));

  // ---- escolas entre épocas ----
  const [eA, setEA] = useState(epocasReg[1] || epocasReg[0] || "");
  const [eB, setEB] = useState(epocasReg[0] || "");
  const [escEscolha, setEscEscolha] = useState({});
  const escolasDe = (ep) => {
    const c = {};
    Object.values(registoAlunos[ep]?.alunos || {}).forEach((a) => (c[a.escola] = (c[a.escola] || 0) + (a.estado === "ativo" ? 1 : 0)));
    return c;
  };
  const escA = eA ? escolasDe(eA) : {};
  const escB = eB ? escolasDe(eB) : {};
  const nomesEscB = Object.keys(escB).sort((a, b) => a.localeCompare(b, "pt"));
  const estadoEsc = options.estadoEscolas || {};
  const soEscA = Object.keys(escA)
    .filter((e) => escB[e] === undefined)
    .map((e) => {
      const cands = nomesEscB.filter((b) => escA[b] === undefined).map((b) => ({ b, s: semelhancaEscolas(e, b) })).sort((x, y) => y.s - x.s);
      return { e, n: escA[e], cands, melhor: cands[0] && cands[0].s >= 0.6 ? cands[0] : null };
    })
    .sort((x, y) => (y.melhor ? y.melhor.s : 0) - (x.melhor ? x.melhor.s : 0) || x.e.localeCompare(y.e, "pt"));
  const soEscB = nomesEscB.filter((b) => escA[b] === undefined);

  // ---- apagar ----
  const [fEpoca, setFEpoca] = useState(epocaInicial && g.epocas.includes(epocaInicial) ? epocaInicial : "todas");
  const [fEscola, setFEscola] = useState("");
  const [fTipo, setFTipo] = useState("tudo");
  const [fTurma, setFTurma] = useState("");
  const [fId, setFId] = useState("");
  const [retirar, setRetirar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const epocasAlvo = fEpoca === "todas" ? g.epocas : [fEpoca];
  const turmasAlvo = [...new Set(epocasAlvo.flatMap((ep) => Object.values(registoAlunos[ep]?.alunos || {}).filter((a) => !fEscola || a.escola === fEscola).map((a) => a.turma)))].sort((a, b) => a.localeCompare(b, "pt", { numeric: true }));
  const filtro = { epocas: epocasAlvo, escola: fEscola, tipo: fTipo, turma: fTurma, id: fId, retirarEscola: retirar };
  const incompleto = (fTipo === "turma" && !fTurma) || (fTipo === "aluno" && !fId.trim());
  const conta = incompleto ? null : g.apagar(filtro, true);
  const nadaApagar = !conta || conta.alunos + conta.desist + conta.exps + conta.semanas === 0;
  const epocaAtual = epocaDe(isoDe(new Date()));
  const semAlunosAgora = (e) => !Object.values(registoAlunos[epocaAtual]?.alunos || {}).some((a) => a.escola === e);
  const escolaTodaFora = fEscola && fTipo === "tudo" && fEpoca === "todas";

  // ---- turmas entre épocas ----
  const [epA, setEpA] = useState(epocasReg[1] || epocasReg[0] || "");
  const [epB, setEpB] = useState(epocasReg[0] || "");
  const [escolha, setEscolha] = useState({});
  const [verIguais, setVerIguais] = useState(false);
  const distintas = new Set(options.turmasDistintas || []);
  const chaveDist = (a, b) => [normChave(a), normChave(b)].sort().join("|");
  const nomesDe = (ep) => {
    const c = {};
    Object.values(registoAlunos[ep]?.alunos || {}).forEach((a) => {
      c[a.turma] = c[a.turma] || { n: 0, escolas: new Set() };
      c[a.turma].n++;
      c[a.turma].escolas.add(a.escola);
    });
    return c;
  };
  const nomesA = epA ? nomesDe(epA) : {};
  const nomesB = epB ? nomesDe(epB) : {};
  const listaB = Object.keys(nomesB).sort((a, b) => a.localeCompare(b, "pt", { numeric: true }));
  const soEmA = Object.keys(nomesA)
    .filter((t) => !nomesB[t])
    .map((t) => {
      const cands = listaB
        .filter((b) => !distintas.has(chaveDist(t, b)))
        .map((b) => ({ b, s: semelhancaTurmas(t, b) }))
        .sort((x, y) => y.s - x.s);
      const melhor = cands[0] && cands[0].s >= 0.55 ? cands[0] : null;
      const marcadas = listaB.filter((b) => distintas.has(chaveDist(t, b)));
      return { t, ...nomesA[t], melhor, cands, marcadas };
    })
    .sort((x, y) => (y.melhor ? y.melhor.s : 0) - (x.melhor ? x.melhor.s : 0) || y.n - x.n);
  const comSugestao = soEmA.filter((x) => x.melhor);
  const semSugestao = soEmA.filter((x) => !x.melhor);
  const soEmB = listaB.filter((b) => !nomesA[b]);
  const iguais = Object.keys(nomesA).filter((t) => nomesB[t]);

  // ---- semana 1 ----

  const seg = (k, l) => (
    <button key={k} onClick={() => setAba(k)} className="pill" style={{ background: aba === k ? COLORS.paperRaised : "transparent", border: "none", borderRadius: 7, padding: "6px 13px", fontSize: 13, fontWeight: aba === k ? 600 : 500, color: aba === k ? COLORS.ink : COLORS.ink2, cursor: "pointer", boxShadow: aba === k ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
      {l}
    </button>
  );
  const radio = (k, l) => (
    <label key={k} style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer", fontSize: 13 }}>
      <input
        type="radio"
        checked={fTipo === k}
        onChange={() => {
          setFTipo(k);
          setConfirmar(false);
        }}
      />
      {l}
    </label>
  );
  const linhaTurma = (x) => {
    const alvo = escolha[x.t] !== undefined ? escolha[x.t] : x.melhor ? x.melhor.b : "";
    return (
      <div key={x.t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: `1px solid ${COLORS.ruleSoft}`, fontSize: 13, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{x.t}</div>
          <div style={{ fontSize: 11.5, color: COLORS.slate }}>
            {x.n} alunos em {epA} · {x.escolas.size} {x.escolas.size === 1 ? "escola" : "escolas"}
          </div>
        </div>
        <span style={{ color: COLORS.slate }}>→</span>
        <select value={alvo} onChange={(e) => setEscolha((m) => ({ ...m, [x.t]: e.target.value }))} style={{ ...inputStyle, width: 190, padding: "5px 8px", fontSize: 12.5 }} aria-label={`Nome em ${epB}`}>
          <option value="">Escolher turma de {epB}</option>
          {x.cands.map(({ b, s }) => (
            <option key={b} value={b}>
              {b}
              {s >= 0.55 ? ` · ${Math.round(s * 100)}%` : ""}
            </option>
          ))}
        </select>
        <button disabled={!alvo} onClick={() => g.renomear(epA, x.t, alvo)} style={{ ...primaryBtnStyle, width: "auto", padding: "6px 12px", fontSize: 12.5, opacity: alvo ? 1 : 0.5 }} title={`Em ${epA}, "${x.t}" passa a chamar-se "${alvo}"`}>
          Igualar
        </button>
        <button disabled={!alvo} onClick={() => g.distintas(x.t, alvo)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5, opacity: alvo ? 1 : 0.5 }}>
          São diferentes
        </button>
      </div>
    );
  };

  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(820px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Gerir dados de inscritos</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div style={{ display: "inline-flex", gap: 3, background: COLORS.segTrack, borderRadius: 9, padding: 2, margin: "14px 0 16px" }}>
          {seg("nomes", "Nomes das turmas")}
          {seg("apagar", "Apagar dados")}
          {seg("escolas", "Escolas entre épocas")}
          {seg("turmas", "Turmas entre épocas")}
        </div>

        {aba === "nomes" && (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
              <select value={nEp} onChange={(e) => { setNEp(e.target.value); setAEditar(null); }} aria-label="Época" style={{ ...inputStyle, width: "auto", padding: "6px 9px" }}>
                {epocasNomes.map((ep) => (
                  <option key={ep} value={ep}>
                    Época {ep}
                  </option>
                ))}
                {epocasNomes.length > 1 && <option value="todas">Todas as épocas</option>}
              </select>
              <select value={nEsc} onChange={(e) => { setNEsc(e.target.value); setAEditar(null); }} aria-label="Escola" style={{ ...inputStyle, width: "auto", padding: "6px 9px" }}>
                <option value="">Todas as escolas</option>
                {escolasNomes.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: COLORS.slate, margin: "8px 0 12px", lineHeight: 1.5 }}>
              O nome muda nos alunos, desistências, experiências, horários dos espaços e lotações {nEp === "todas" ? "de todas as épocas" : `de ${nEp}`}{nEsc ? `, só em ${nEsc}` : ", em todas as escolas"}.
              {!nEsc && " Os próximos ficheiros com o nome antigo passam a usar o novo."} Se escolheres um nome que já existe, as duas turmas juntam-se.
            </div>
            {nomesTurmas.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.ink2 }}>Sem turmas nesta seleção.</div>
            ) : (
              <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden" }}>
                {nomesTurmas.map((t, i) => {
                  const x = contagemTurmas[t];
                  const edita = aEditar === t;
                  const limpo = novoNome.trim();
                  const junta = edita && limpo && limpo !== t && nomesTurmas.includes(limpo);
                  const guardar = () => {
                    if (!limpo || limpo === t) return setAEditar(null);
                    g.renomearTurma({ de: t, para: limpo, epocas: nEpocas, escola: nEsc || null });
                    setAEditar(null);
                  };
                  return (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 13, flexWrap: "wrap" }}>
                      {edita ? (
                        <>
                          <input
                            autoFocus
                            value={novoNome}
                            onChange={(e) => setNovoNome(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") guardar();
                              if (e.key === "Escape") setAEditar(null);
                            }}
                            aria-label={`Novo nome de ${t}`}
                            style={{ ...inputStyle, width: 200, padding: "5px 8px" }}
                          />
                          <button onClick={guardar} disabled={!limpo} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5, background: junta ? COLORS.warn : undefined }}>
                            {junta ? `Juntar com ${limpo}` : "Guardar"}
                          </button>
                          <button onClick={() => setAEditar(null)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5 }}>
                            Cancelar
                          </button>
                          <span style={{ fontSize: 11.5, color: COLORS.slate }}>era "{t}"</span>
                        </>
                      ) : (
                        <>
                          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{t}</div>
                            <div style={{ fontSize: 11.5, color: COLORS.slate }}>
                              {x.n} alunos ativos · {x.escolas.size} {x.escolas.size === 1 ? "escola" : "escolas"}
                              {nEp === "todas" ? ` · ${[...x.epocas].sort().join(", ")}` : ""}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setAEditar(t);
                              setNovoNome(t);
                            }}
                            style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            <Pencil size={13} /> Mudar nome
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {aba === "apagar" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="ap-epoca">
                  Época
                </label>
                <select
                  id="ap-epoca"
                  value={fEpoca}
                  onChange={(e) => {
                    setFEpoca(e.target.value);
                    setConfirmar(false);
                  }}
                  style={inputStyle}
                >
                  <option value="todas">Todas as épocas</option>
                  {g.epocas.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="ap-escola">
                  Escola
                </label>
                <select
                  id="ap-escola"
                  value={fEscola}
                  onChange={(e) => {
                    setFEscola(e.target.value);
                    setFTurma("");
                    setConfirmar(false);
                  }}
                  style={inputStyle}
                >
                  <option value="">Todas as escolas</option>
                  {g.escolasComDados.map((e) => (
                    <option key={e} value={e}>
                      {e}
                      {semAlunosAgora(e) ? ` (sem alunos em ${epocaAtual})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ ...labelStyle, marginTop: 16 }}>O que apagar</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {radio("tudo", "Tudo: alunos, turmas, balanço semanal, desistências e experiências")}
              {radio("desist", "Só as desistências")}
              {radio("exp", "Só as experiências")}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {radio("turma", "Os alunos de uma turma")}
                {fTipo === "turma" && (
                  <select value={fTurma} onChange={(e) => setFTurma(e.target.value)} style={{ ...inputStyle, width: 220, padding: "5px 8px", fontSize: 12.5 }} aria-label="Turma">
                    <option value="">Escolher turma</option>
                    {turmasAlvo.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {radio("aluno", "Um aluno")}
                {fTipo === "aluno" && <input value={fId} onChange={(e) => setFId(e.target.value)} placeholder="Código do atleta" style={{ ...inputStyle, width: 180, padding: "5px 8px", fontSize: 12.5 }} aria-label="Código do atleta" />}
              </div>
            </div>
            {escolaTodaFora && (
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={retirar} onChange={(e) => setRetirar(e.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  Retirar também {fEscola} da lista de escolas
                  <span style={{ display: "block", fontSize: 11.5, color: COLORS.slate }}>As reclamações, auditorias e inquéritos já registados com esta escola mantêm-se.</span>
                </span>
              </label>
            )}
            <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: nadaApagar ? COLORS.paperSunken : COLORS.dangerBg, fontSize: 13, color: nadaApagar ? COLORS.ink2 : COLORS.danger }}>
              {incompleto
                ? fTipo === "turma"
                  ? "Escolhe a turma."
                  : "Escreve o código do atleta."
                : nadaApagar
                ? "Não há dados com estes filtros."
                : `Vai apagar ${[conta.alunos && (conta.alunos === 1 ? "1 aluno" : `${conta.alunos} alunos`), conta.desist && (conta.desist === 1 ? "1 desistência" : `${conta.desist} desistências`), conta.exps && (conta.exps === 1 ? "1 experiência" : `${conta.exps} experiências`), conta.semanas && (conta.semanas === 1 ? "1 semana do registo semanal" : `${conta.semanas} semanas do registo semanal`)].filter(Boolean).join(" · ")}${fEscola ? ` de ${fEscola}` : ""}${fEpoca === "todas" ? " em todas as épocas" : ` em ${fEpoca}`}. Não dá para desfazer.`}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              {!confirmar ? (
                <button disabled={nadaApagar || incompleto} onClick={() => setConfirmar(true)} style={{ ...primaryBtnStyle, width: "auto", padding: "9px 18px", background: COLORS.danger, opacity: nadaApagar || incompleto ? 0.5 : 1 }}>
                  Apagar
                </button>
              ) : (
                <>
                  <button onClick={() => setConfirmar(false)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}>
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      g.apagar(filtro);
                      setConfirmar(false);
                      setFId("");
                      setFTurma("");
                    }}
                    style={{ ...primaryBtnStyle, width: "auto", padding: "9px 18px", background: COLORS.danger }}
                  >
                    Confirmar: apagar
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {aba === "escolas" && (
          <div>
            {epocasReg.length < 2 ? (
              <div style={{ fontSize: 13, color: COLORS.ink2 }}>Importa pelo menos duas épocas para comparar as escolas.</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                  Escolas de
                  <select value={eA} onChange={(e) => setEA(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 9px" }} aria-label="Época anterior">
                    {epocasReg.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                  sem alunos em
                  <select value={eB} onChange={(e) => setEB(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 9px" }} aria-label="Época seguinte">
                    {epocasReg.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 6, lineHeight: 1.5 }}>
                  Se é a mesma escola com outro nome, "Igualar" passa os dados de {eA} para o nome de {eB}, e os próximos ficheiros já entram com esse nome. Se fechou, marca "Encerrou": continua a contar nos números de {eA} e aparece como encerrada nas épocas seguintes.
                </div>
                {eA === eB ? (
                  <div style={{ fontSize: 13, marginTop: 14 }}>Escolhe duas épocas diferentes.</div>
                ) : (
                  <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden", marginTop: 12 }}>
                    {!soEscA.length && <div style={{ padding: "10px 12px", fontSize: 13, color: COLORS.slate }}>Todas as escolas de {eA} têm alunos em {eB}.</div>}
                    {soEscA.map((x, i) => {
                      const alvo = escEscolha[x.e] !== undefined ? escEscolha[x.e] : x.melhor ? x.melhor.b : "";
                      const fechada = estadoEsc[x.e]?.encerrada;
                      return (
                        <div key={x.e} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none", fontSize: 13, flexWrap: "wrap" }}>
                          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>
                              {x.e}
                              {fechada && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: COLORS.slate, border: `1px solid ${COLORS.rule}`, borderRadius: 5, padding: "1px 5px" }}>encerrada em {fechada}</span>}
                            </div>
                            <div style={{ fontSize: 11.5, color: COLORS.slate }}>
                              {x.n} alunos no fim de {eA}
                            </div>
                          </div>
                          {!fechada && (
                            <>
                              <span style={{ color: COLORS.slate }}>→</span>
                              <select value={alvo} onChange={(e) => setEscEscolha((m) => ({ ...m, [x.e]: e.target.value }))} style={{ ...inputStyle, width: 220, padding: "5px 8px", fontSize: 12.5 }} aria-label={`Escola em ${eB}`}>
                                <option value="">É outra escola de {eB}?</option>
                                {x.cands.map(({ b, s: sc }) => (
                                  <option key={b} value={b}>
                                    {b}
                                    {sc >= 0.6 ? ` · ${Math.round(sc * 100)}%` : ""}
                                  </option>
                                ))}
                              </select>
                              <button disabled={!alvo} onClick={() => g.renomearEscola(eA, x.e, alvo)} style={{ ...primaryBtnStyle, width: "auto", padding: "6px 12px", fontSize: 12.5, opacity: alvo ? 1 : 0.5 }}>
                                Igualar
                              </button>
                            </>
                          )}
                          <button onClick={() => g.estadoEscola(x.e, fechada ? null : eB)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5 }}>
                            {fechada ? "Reabrir" : "Encerrou"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {eA !== eB && soEscB.length > 0 && (
                  <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 14, lineHeight: 1.6 }}>
                    <strong>Novas em {eB}:</strong> {soEscB.join(" · ")}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {aba === "turmas" && (
          <div>
            {epocasReg.length < 2 ? (
              <div style={{ fontSize: 13, color: COLORS.ink2 }}>Importa pelo menos duas épocas para comparar os nomes das turmas.</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                  Nomes de
                  <select value={epA} onChange={(e) => setEpA(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 9px" }} aria-label="Época a corrigir">
                    {epocasReg.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                  que não existem em
                  <select value={epB} onChange={(e) => setEpB(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 9px" }} aria-label="Época de referência">
                    {epocasReg.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 6, lineHeight: 1.5 }}>
                  "Igualar" muda o nome em {epA} (em todas as escolas) para o de {epB}, e os próximos ficheiros já entram com esse nome. "São diferentes" deixa de sugerir os dois como a mesma turma. {iguais.length} nomes já são iguais nas duas épocas.
                </div>
                {epA === epB ? (
                  <div style={{ fontSize: 13, marginTop: 14 }}>Escolhe duas épocas diferentes.</div>
                ) : (
                  <>
                    <div style={{ ...panelTitle, marginTop: 16 }}>Parecidas, por confirmar ({comSugestao.length})</div>
                    <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden", marginTop: 6 }}>{comSugestao.length ? comSugestao.map(linhaTurma) : <div style={{ padding: "10px 12px", fontSize: 13, color: COLORS.slate }}>Nenhuma.</div>}</div>
                    <div style={{ ...panelTitle, marginTop: 16 }}>Só em {epA}, sem nome parecido ({semSugestao.length})</div>
                    <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 2 }}>Turmas ou equipas que podem ter acabado, ou ter mudado muito de nome.</div>
                    <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden", marginTop: 6 }}>{semSugestao.length ? semSugestao.map(linhaTurma) : <div style={{ padding: "10px 12px", fontSize: 13, color: COLORS.slate }}>Nenhuma.</div>}</div>
                    {soEmB.length > 0 && (
                      <div style={{ fontSize: 12.5, color: COLORS.ink2, marginTop: 14, lineHeight: 1.6 }}>
                        <strong>Só em {epB}:</strong> {soEmB.join(" · ")}
                      </div>
                    )}
                    {(options.turmasDistintas || []).length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <button onClick={() => setVerIguais((v) => !v)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
                          {verIguais ? "Esconder" : "Ver"} pares marcados como diferentes ({options.turmasDistintas.length})
                        </button>
                        {verIguais && (
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                            {options.turmasDistintas.map((k) => {
                              const [a, b] = k.split("|");
                              return (
                                <div key={k} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5 }}>
                                  <span>
                                    {a} ≠ {b}
                                  </span>
                                  <button onClick={() => g.distintas(a, b, true)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                                    Desfazer
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// Aviso sobre o que o ficheiro de uma época não trazia (ex.: 23/24 só com o mês de
// entrada, experiências sem data), para quem lê os números saber porque faltam.
function textosAvisoEpoca(av, ep) {
  if (!av) return [];
  const t = [];
  const parte = (n, total) => (n >= total ? "todos os" : `${n} de ${total}`);
  if (av.entradasSoMes && av.linhasSoMes && av.linhasSoMes.length && av.entradasSoMes < av.alunos / 10)
    t.push(
      `${av.entradasSoMes} ${av.entradasSoMes === 1 ? "aluno" : "alunos"} de ${ep} sem data de entrada válida no Excel (contam a partir do dia 1 do mês indicado): ${av.linhasSoMes
        .map((x) => `${x.id}${x.linha ? ` (linha ${x.linha})` : ""}`)
        .join(", ")}.`
    );
  else if (av.entradasSoMes) t.push(`O ficheiro de ${ep} só tem o mês de entrada (sem o dia) em ${parte(av.entradasSoMes, av.alunos)} alunos: contam a partir do dia 1 desse mês, por isso as semanas de entrada e a evolução semanal são aproximadas.`);
  if (av.entradasSemData) t.push(`${av.entradasSemData} ${av.entradasSemData === 1 ? "aluno não tem" : "alunos não têm"} data nem mês de entrada em ${ep}: contam desde o início da época.`);
  if (av.desistSoMes) t.push(`As desistências de ${ep} só têm o mês (${parte(av.desistSoMes, av.desist)}): a semana da desistência é aproximada.`);
  if (av.desistSemData) t.push(`${av.desistSemData} ${av.desistSemData === 1 ? "desistência não tem data" : "desistências não têm data"} em ${ep}: ${av.desistSemData === 1 ? "conta" : "contam"} como ${av.desistSemData === 1 ? "saída" : "saídas"} no fim da época.`);
  if (av.expSemData) t.push(`O ficheiro de ${ep} não tem a data das experiências${av.expSemData < av.exps ? ` (${av.expSemData} de ${av.exps})` : ""}: contam nos totais e na conversão, mas não aparecem por semana nem por mês.`);
  else if (av.expSoMes) t.push(`As experiências de ${ep} só têm o mês: a semana é aproximada.`);
  if (av.desistSemCodigo) t.push(`${av.desistSemCodigo === av.desist ? "As desistências" : `${av.desistSemCodigo} desistências`} de ${ep} não têm código do atleta: contam no total e por escola, mas não se sabe quem foi.`);
  if (av.alunosSemCodigo) t.push(`${av.alunosSemCodigo} ${av.alunosSemCodigo === 1 ? "aluno" : "alunos"} de ${ep} sem código do atleta no Excel: contam nos inscritos, mas não na renovação entre épocas.`);
  if (av.semGenero) t.push(`O ficheiro de ${ep} não tem o género dos alunos: a percentagem do género feminino não está disponível.`);
  return t;
}
function AvisoDadosEpoca({ registos }) {
  const textos = registos.flatMap(([ep, reg]) => textosAvisoEpoca(reg && reg.avisos, ep));
  if (!textos.length) return null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderRadius: 10, border: `1px solid ${COLORS.warn}`, background: COLORS.warnBg, fontSize: 12.5, lineHeight: 1.55, marginBottom: 14 }}>
      <AlertTriangle size={15} style={{ color: COLORS.warn, flex: "none", marginTop: 2 }} />
      <div>
        {textos.map((x) => (
          <div key={x}>{x}</div>
        ))}
      </div>
    </div>
  );
}

// ======================================================================
// ---------- Análise de inscritos (a partir dos alunos importados) ----------
// ======================================================================
// Tudo sai do registo de alunos de cada época (os ficheiros importados):
// por época, comparação de épocas, escolas por época e cada escola ao longo das épocas.
// Numa época a decorrer, as comparações com épocas passadas fazem-se na mesma semana
// da época (homóloga), para não comparar meia época com uma inteira.

const CORES_EPOCAS = ["#0b4ea2", "#6f86a8", "#a9b7cc", "#cfd7e3", "#e3e8ef"];

// Números de uma época (todas as escolas ou uma): alunos, movimentos e curva semanal.
function numerosEpoca(reg, ep, escola, niveis) {
  if (!reg) return null;
  const al = Object.values(reg.alunos || {}).filter((a) => !escola || a.escola === escola);
  const ex = Object.values(reg.experiencias || {}).filter((x) => !escola || x.escola === escola);
  if (!al.length && !ex.length) return null;
  const ativos = al.filter((a) => a.estado === "ativo");
  const desist = al.filter((a) => a.estado === "desistiu");
  const conv = ex.filter((x) => x.resultado === "sucesso" || (reg.alunos || {})[x.id]).length;
  const pend = ex.filter((x) => x.resultado === "pendente").length;
  const porEscalao = {};
  ativos.forEach((a) => {
    const k = escalaoDaTurma(a.turma, niveis);
    porEscalao[k] = (porEscalao[k] || 0) + 1;
  });
  const motivos = {};
  desist.forEach((a) => (motivos[a.motivo || "Não definido"] = (motivos[a.motivo || "Não definido"] || 0) + 1));
  const curva = Object.fromEntries(balancoSemanal(reg, escola || null, ep).map((b) => [b.k, b.ativos]));
  const entradasMes = {};
  const desistMes = {};
  al.forEach((a) => a.entrada && (entradasMes[a.entrada.slice(5, 7)] = (entradasMes[a.entrada.slice(5, 7)] || 0) + 1));
  desist.forEach((a) => a.saida && (desistMes[a.saida.slice(5, 7)] = (desistMes[a.saida.slice(5, 7)] || 0) + 1));
  return {
    ep,
    inscritos: ativos.length,
    entradas: al.length,
    renov: al.filter((a) => a.rubrica === "renov").length,
    novos: al.filter((a) => a.rubrica !== "renov").length,
    extra: al.filter((a) => a.rubrica === "extra").length,
    desist: desist.length,
    taxaDesist: al.length ? (desist.length / al.length) * 100 : null,
    exps: ex.length,
    conv,
    taxaConv: ex.length - pend ? (conv / (ex.length - pend)) * 100 : null,
    raparigas: ativos.length && ativos.some((a) => a.genero) ? (ativos.filter((a) => a.genero === "f").length / ativos.length) * 100 : null,
    turmas: new Set(ativos.map((a) => `${a.escola}|${a.turma}`)).size,
    escolas: new Set(al.map((a) => a.escola)).size,
    porEscalao,
    motivos,
    curva,
    entradasMes,
    desistMes,
  };
}

// Inscritos de uma época na semana k (homóloga) ou no fim.
const naSemana = (n, k) => (n ? (k ? valorCurva(n.curva, k) ?? 0 : n.inscritos) : null);
const pctVar = (a, b) => (a !== null && b ? Math.round(((a - b) / b) * 1000) / 10 : null);

// Para onde foram os alunos de uma escola no fim de uma época, na época seguinte.
function destinosAlunos(regAnt, regAtual, escola) {
  if (!regAnt || !regAtual) return null;
  const base = Object.values(regAnt.alunos || {}).filter((a) => a.estado === "ativo" && !a.semCodigo && (!escola || a.escola === escola));
  if (!base.length) return null;
  const atual = regAtual.alunos || {};
  const mesma = base.filter((a) => atual[a.id] && atual[a.id].escola === a.escola).length;
  const outras = {};
  base.forEach((a) => {
    const n = atual[a.id];
    if (n && n.escola !== a.escola) outras[n.escola] = (outras[n.escola] || 0) + 1;
  });
  const voltaram = base.filter((a) => atual[a.id]).length;
  return {
    base: base.length,
    voltaram,
    taxa: Math.round((voltaram / base.length) * 1000) / 10,
    mesma,
    outras: Object.entries(outras).sort((a, b) => b[1] - a[1]),
    naoVoltaram: base.length - voltaram,
  };
}

function IndicadoresInscritos({ registoAlunos, niveis, capacidades, epocas, sel, escola }) {
  const cols = (sel && sel.length ? sel : epocas).filter((e) => registoAlunos[e]).sort().reverse();
  const I = Object.fromEntries(cols.map((ep) => [ep, indicadoresDaEpoca(ep, registoAlunos, niveis, capacidades, escola)]));
  const [aberto, setAberto] = useState(null);
  // Mapa das escolas: os indicadores calculados escola a escola, só quando o mapa está aberto.
  const epMapa = cols[0];
  const porEscola = useMemo(() => {
    if (aberto !== "mapa" || !epMapa || !registoAlunos[epMapa]) return null;
    const nomes = [...new Set(Object.values(registoAlunos[epMapa].alunos || {}).map((a) => a.escola).filter(Boolean))];
    return Object.fromEntries(nomes.map((e) => [e, indicadoresDaEpoca(epMapa, registoAlunos, niveis, capacidades, e)]));
  }, [aberto, epMapa, registoAlunos, niveis, capacidades]);
  if (!cols.length) return <Vazio icon={Users} titulo="Sem alunos importados nas épocas escolhidas" texto="Importa os ficheiros de inscritos no Painel ou escolhe outras épocas." />;

  const th = { ...thStyle, textAlign: "right" };
  const td = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 13 };
  const tdL = { ...tdStyle, fontSize: 12.5, color: COLORS.ink2 };
  const P = (v, d = 1) => (v === null || v === undefined || isNaN(v) ? "—" : `${fmtNum(v, d)}%`);
  const N = (v) => (v === null || v === undefined ? "—" : fmtNum(v));
  const ordEsc = (ks) => [...ks].sort((a, b) => ORDEM_ESCALAO(a, niveis) - ORDEM_ESCALAO(b, niveis));
  const cab = (titulo) => (
    <thead>
      <tr>
        <th style={thStyle}>{titulo}</th>
        {cols.map((ep) => (
          <th key={ep} style={th}>
            {ep}
          </th>
        ))}
      </tr>
    </thead>
  );
  const linha = (label, f, chave) => (
    <tr key={chave || label}>
      <td style={tdL}>{label}</td>
      {cols.map((ep) => (
        <td key={ep} style={td}>
          {I[ep] ? f(I[ep]) : "—"}
        </td>
      ))}
    </tr>
  );
  // Só o detalhe do cartão escolhido aparece.
  const Bloco = ({ k, titulo, nota, children }) =>
    aberto !== k ? null : (
      <div className="pageIn" style={{ ...panelStyle, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ ...panelTitle, marginBottom: 0, flex: 1 }}>{titulo.replace(/^\d+\.\s*/, "")}</div>
          <button onClick={() => setAberto(null)} aria-label="Fechar detalhe" style={{ ...iconBtnStyle, color: COLORS.slate }}>
            <X size={16} />
          </button>
        </div>
        {nota && <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 10, lineHeight: 1.5 }}>{nota}</div>}
        <div style={{ overflowX: "auto" }}>{children}</div>
      </div>
    );

  // Cartões: o número principal de cada indicador, na época mais recente escolhida, e as outras ao lado.
  const nOuNull = (v) => (v === null || v === undefined || isNaN(v) ? null : v);
  const CARTOES = [
    { k: "ret", titulo: "Retenção", v: (x) => nOuNull(x.ret && x.ret.taxa), un: "%", melhor: "alto", sub: (x) => (x.ret ? `${fmtNum(x.ret.voltaram)} de ${fmtNum(x.ret.base)} voltaram · ${fmtNum(x.ret.mudaram)} noutra escola` : "sem a época anterior importada") },
    { k: "desist", titulo: "Saem nas 4 primeiras semanas", v: (x) => nOuNull(pctDe(x.semanas.ate4, x.desist)), un: "%", melhor: "baixo", sub: (x) => `${fmtNum(x.desist)} desistências${x.medianaSemanas !== null ? ` · mediana ${fmtNum(x.medianaSemanas, 0)} semanas` : ""}` },
    { k: "novos", titulo: "Desistência dos novos", v: (x) => nOuNull(pctDe(x.novosRen.novosDes, x.novosRen.novos)), un: "%", melhor: "baixo", sub: (x) => `renovados: ${P(pctDe(x.novosRen.renovDes, x.novosRen.renov))}` },
    { k: "ocup", titulo: "Ocupação", v: (x) => nOuNull(pctDe(x.ocupados, x.lugares)), un: "%", melhor: "alto", sub: (x) => `${fmtNum(Math.max(0, x.lugares - x.ocupados))} lugares livres` },
    { k: "exp", titulo: "Conversão das experiências", v: (x) => nOuNull(pctDe(x.conv, x.exps)), un: "%", melhor: "alto", sub: (x) => (x.mediana !== null ? `mediana de ${x.mediana} dias até à inscrição` : `${fmtNum(x.exps)} experiências`) },
    { k: "fem", titulo: "Feminino", v: (x) => nOuNull(x.fem), un: "%", melhor: "alto", sub: () => "dos alunos ativos com género" },
    { k: "trans", titulo: "Passam para competição", v: (x) => nOuNull(x.trans ? x.trans.paraCompeticao : null), un: "", melhor: "alto", sub: (x) => (x.trans ? `alunos das turmas de ${epAntDe(x.ep)} agora em equipas de competição · ${P(pctDe(x.trans.paraCompeticao, x.trans.deTurmas), 1)} das turmas` : "sem a época anterior importada") },
    { k: "conc", titulo: "Turmas abaixo de 50%", v: (x) => x.baixas.length, un: "", melhor: "baixo", sub: () => "só turmas (sem equipas de competição) · há 4 ou mais semanas seguidas" },
  ];
  const fmtC = (c, v) => (v === null || v === undefined ? "—" : c.un === "%" ? `${fmtNum(v, 0)}%` : fmtNum(v));
  const cartoes = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
      {CARTOES.map((c) => {
        const ref = I[cols[0]];
        const v = ref ? c.v(ref) : null;
        const sel = aberto === c.k;
        return (
          <button
            key={c.k}
            type="button"
            onClick={() => setAberto(sel ? null : c.k)}
            aria-expanded={sel}
            className="liftable"
            style={{ textAlign: "left", cursor: "pointer", background: COLORS.paperRaised, border: `1px solid ${sel ? COLORS.navy : COLORS.rule}`, boxShadow: sel ? `0 0 0 1px ${COLORS.navy}` : COLORS.shadow, borderRadius: 12, padding: "12px 14px", fontFamily: "inherit", color: COLORS.ink }}
          >
            <div style={{ fontSize: 12, color: COLORS.ink2, fontWeight: 500 }}>{c.titulo}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmtC(c, v)}</span>
              {cols.length > 1 && <span style={{ fontSize: 11, color: COLORS.slate }}>{cols[0]}</span>}
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4, lineHeight: 1.4, minHeight: 16 }}>{ref ? c.sub(ref) : ""}</div>
            {cols.length > 1 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLORS.ruleSoft}` }}>
                {cols.slice(1).map((ep) => {
                  const o = I[ep] ? c.v(I[ep]) : null;
                  const dif = v !== null && o !== null ? v - o : null;
                  const bom = !dif ? null : c.melhor === "alto" ? dif > 0 : dif < 0;
                  return (
                    <span key={ep} style={{ fontSize: 11.5, color: COLORS.ink2, fontVariantNumeric: "tabular-nums" }} title={dif ? `${cols[0]} ${dif > 0 ? "acima" : "abaixo"} de ${ep}` : undefined}>
                      <span style={{ color: COLORS.slate }}>{ep}</span> {fmtC(c, o)}
                      {dif ? <span style={{ color: bom ? COLORS.ok : COLORS.danger, marginLeft: 3 }}>{dif > 0 ? "▲" : "▼"}</span> : null}
                    </span>
                  );
                })}
              </div>
            )}
          </button>
        );
      })}
      {!escola && (
        <button
          type="button"
          onClick={() => setAberto(aberto === "mapa" ? null : "mapa")}
          aria-expanded={aberto === "mapa"}
          className="liftable"
          style={{ textAlign: "left", cursor: "pointer", background: COLORS.paperRaised, border: `1px solid ${aberto === "mapa" ? COLORS.navy : COLORS.rule}`, boxShadow: aberto === "mapa" ? `0 0 0 1px ${COLORS.navy}` : COLORS.shadow, borderRadius: 12, padding: "12px 14px", fontFamily: "inherit", color: COLORS.ink }}
        >
          <div style={{ fontSize: 12, color: COLORS.ink2, fontWeight: 500 }}>Mapa das escolas</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, color: COLORS.navy }}>
            <Target size={22} strokeWidth={1.8} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Cruzar dois indicadores</span>
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4, lineHeight: 1.4 }}>cada escola é uma bola, do tamanho do nº de alunos</div>
        </button>
      )}
    </div>
  );
  const tabela = (titulo, linhas) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      {cab(titulo)}
      <tbody>{linhas}</tbody>
    </table>
  );
  const uniao = (f) => [...new Set(cols.flatMap((ep) => (I[ep] ? Object.keys(f(I[ep]) || {}) : [])))];

  return (
    <div>
      {cartoes}
      {!aberto && <div style={{ fontSize: 12, color: COLORS.slate, marginTop: -4 }}>Carrega num indicador para ver o detalhe por escola, escalão ou mês.</div>}
      {aberto === "mapa" && porEscola && (
        <Bloco k="mapa" titulo={`Mapa das escolas · ${epMapa}`} nota="Cruza dois indicadores para ver que escolas estão bem nos dois, quais precisam de atenção e quais estão a meio caminho. Passa o rato por uma bola para ver a escola.">
          <QuadrantMatrix
            semCaixa
            subjects={Object.keys(porEscola)}
            defaultX="ocup"
            defaultY="ret"
            tamanho={{ label: "Alunos ativos", v: (e) => porEscola[e]?.ativos || 0, fmt: (v) => fmtNum(v), nome: (e) => e.replace(/^Dragon Force\s+/, "") }}
            metrics={{
              ocup: { label: "Ocupação", melhor: "alto", pct: true, v: (e) => nOuNull(porEscola[e] && pctDe(porEscola[e].ocupados, porEscola[e].lugares)), fmt: (v) => P(v, 0) },
              ret: { label: "Retenção", melhor: "alto", pct: true, v: (e) => nOuNull(porEscola[e]?.ret?.taxa), fmt: (v) => P(v, 0) },
              desistTotal: { label: "Taxa de desistência", melhor: "baixo", pct: true, v: (e) => nOuNull(porEscola[e] && pctDe(porEscola[e].desist, porEscola[e].entradas)), fmt: (v) => P(v, 0) },
              novos: { label: "Desistência dos novos", melhor: "baixo", pct: true, v: (e) => nOuNull(porEscola[e] && pctDe(porEscola[e].novosRen.novosDes, porEscola[e].novosRen.novos)), fmt: (v) => P(v, 0) },
              cedo: { label: "Saem nas 4 primeiras semanas", melhor: "baixo", pct: true, v: (e) => nOuNull(porEscola[e] && pctDe(porEscola[e].semanas.ate4, porEscola[e].desist)), fmt: (v) => P(v, 0) },
              exp: { label: "Conversão das experiências", melhor: "alto", pct: true, v: (e) => nOuNull(porEscola[e] && pctDe(porEscola[e].conv, porEscola[e].exps)), fmt: (v) => P(v, 0) },
              fem: { label: "Feminino", melhor: "alto", pct: true, v: (e) => nOuNull(porEscola[e]?.fem), fmt: (v) => P(v, 0) },
              trans: { label: "Passam para competição (% das turmas)", melhor: "alto", pct: true, v: (e) => nOuNull(porEscola[e]?.trans?.deTurmas ? pctDe(porEscola[e].trans.paraCompeticao, porEscola[e].trans.deTurmas) : null), fmt: (v) => P(v, 1) },
            }}
          />
        </Bloco>
      )}
      <Bloco k="ret" titulo="1. Retenção entre épocas" nota="Dos alunos ativos no fim da época anterior, quantos voltaram nesta e quantos voltaram noutra escola.">
        {tabela("Dragon Force" + (escola ? ` · ${escola}` : ""), [
          linha("Ativos no fim da época anterior", (x) => N(x.ret && x.ret.base)),
          linha("Voltaram", (x) => (x.ret ? `${N(x.ret.voltaram)} · ${P(x.ret.taxa)}` : "sem época anterior")),
          linha("Voltaram noutra escola", (x) => (x.ret ? `${N(x.ret.mudaram)} · ${P(pctDe(x.ret.mudaram, x.ret.base))}` : "—")),
          <tr key="sep1">
            <td colSpan={cols.length + 1} style={{ ...tdStyle, fontSize: 10.5, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 14 }}>
              Retenção por escalão (escalão na época anterior)
            </td>
          </tr>,
          ...ordEsc(uniao((x) => x.ret && x.ret.porEscalao)).map((k) => linha(k, (x) => (x.ret && x.ret.porEscalao[k] ? `${P(pctDe(x.ret.porEscalao[k].voltaram, x.ret.porEscalao[k].base), 0)} de ${x.ret.porEscalao[k].base}` : "—"), `e-${k}`)),
          ...(!escola
            ? [
                <tr key="sep2">
                  <td colSpan={cols.length + 1} style={{ ...tdStyle, fontSize: 10.5, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 14 }}>
                    Retenção por escola
                  </td>
                </tr>,
                ...uniao((x) => x.ret && x.ret.porEscola)
                  .sort((a, b) => a.localeCompare(b, "pt"))
                  .map((e) => linha(e.replace(/^Dragon Force\s+/, ""), (x) => (x.ret && x.ret.porEscola[e] ? `${P(pctDe(x.ret.porEscola[e].voltaram, x.ret.porEscola[e].base), 0)}${x.ret.porEscola[e].mudaram ? ` · ${x.ret.porEscola[e].mudaram} mudaram` : ""}` : "—"), `s-${e}`)),
              ]
            : []),
        ])}
      </Bloco>

      <Bloco k="desist" titulo="2. Momento da desistência" nota="Quanto tempo estiveram inscritos antes de desistir e em que mês saíram.">
        {tabela("Desistências", [
          linha("Total", (x) => `${N(x.desist)} · ${P(pctDe(x.desist, x.entradas))} das entradas`),
          linha("Mediana de semanas inscritos", (x) => (x.medianaSemanas === null ? "—" : fmtNum(x.medianaSemanas, 0))),
          linha("Até 4 semanas", (x) => `${N(x.semanas.ate4)} · ${P(pctDe(x.semanas.ate4, x.desist), 0)}`),
          linha("5 a 12 semanas", (x) => `${N(x.semanas.ate12)} · ${P(pctDe(x.semanas.ate12, x.desist), 0)}`),
          linha("13 a 24 semanas", (x) => `${N(x.semanas.ate24)} · ${P(pctDe(x.semanas.ate24, x.desist), 0)}`),
          linha("Mais de 24 semanas", (x) => `${N(x.semanas.mais)} · ${P(pctDe(x.semanas.mais, x.desist), 0)}`),
          ...(cols.some((ep) => I[ep] && I[ep].semanas.sem) ? [linha("Sem datas de entrada ou saída", (x) => N(x.semanas.sem))] : []),
          <tr key="sepm">
            <td colSpan={cols.length + 1} style={{ ...tdStyle, fontSize: 10.5, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 14 }}>
              Mês da saída
            </td>
          </tr>,
          ...MESES_EPOCA.filter((m) => cols.some((ep) => I[ep] && I[ep].meses[m])).map((m) => linha(MES_CURTO[m], (x) => N(x.meses[m] || 0), `m-${m}`)),
        ])}
      </Bloco>

      <Bloco k="novos" titulo="3. Desistência de novos e de quem renovou" nota="Novos: primeira inscrição (inclui extra-inscrições). Renovados: já estavam inscritos na época anterior.">
        {tabela("Taxa de desistência", [
          linha("Novos", (x) => `${P(pctDe(x.novosRen.novosDes, x.novosRen.novos))} · ${x.novosRen.novosDes} de ${x.novosRen.novos}`),
          linha("Renovados", (x) => `${P(pctDe(x.novosRen.renovDes, x.novosRen.renov))} · ${x.novosRen.renovDes} de ${x.novosRen.renov}`),
          linha("Novos desistem … vezes mais", (x) => {
            const a = pctDe(x.novosRen.novosDes, x.novosRen.novos);
            const b = pctDe(x.novosRen.renovDes, x.novosRen.renov);
            return a !== null && b ? `${fmtNum(a / b, 1)}×` : "—";
          }),
        ])}
      </Bloco>

      <Bloco k="ocup" titulo="4. Ocupação face à capacidade" nota="Só turmas (as equipas de competição ficam de fora). Alunos ativos face aos lugares das turmas com alunos (capacidade de cada turma no Painel, ou a sugerida pelo nível). Nas épocas passadas usa a capacidade atual.">
        {tabela("Lugares", [
          linha("Ocupação", (x) => `${P(pctDe(x.ocupados, x.lugares), 0)} · ${N(x.ocupados)} de ${N(x.lugares)}`),
          linha("Lugares livres", (x) => N(Math.max(0, x.lugares - x.ocupados))),
          <tr key="sepe">
            <td colSpan={cols.length + 1} style={{ ...tdStyle, fontSize: 10.5, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 14 }}>
              Lugares livres por escalão
            </td>
          </tr>,
          ...ordEsc(uniao((x) => x.ocupEscalao)).map((k) => linha(k, (x) => (x.ocupEscalao[k] ? `${N(Math.max(0, x.ocupEscalao[k].cap - x.ocupEscalao[k].n))} · ${P(pctDe(x.ocupEscalao[k].n, x.ocupEscalao[k].cap), 0)}` : "—"), `oe-${k}`)),
          ...(!escola
            ? [
                <tr key="sepes">
                  <td colSpan={cols.length + 1} style={{ ...tdStyle, fontSize: 10.5, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 14 }}>
                    Por escola (ocupação · livres)
                  </td>
                </tr>,
                ...uniao((x) => x.ocupEscola)
                  .sort((a, b) => a.localeCompare(b, "pt"))
                  .map((e) => linha(e.replace(/^Dragon Force\s+/, ""), (x) => (x.ocupEscola[e] ? `${P(pctDe(x.ocupEscola[e].n, x.ocupEscola[e].cap), 0)} · ${N(Math.max(0, x.ocupEscola[e].cap - x.ocupEscola[e].n))}` : "—"), `os-${e}`)),
              ]
            : []),
        ])}
      </Bloco>

      <Bloco k="exp" titulo="5. Conversão das experiências" nota="Dias entre a experiência e a inscrição, para os que se inscreveram. A conversão conta quem ficou inscrito na época.">
        {tabela("Experiências", [
          linha("Experiências", (x) => N(x.exps)),
          linha("Converteram", (x) => `${N(x.conv)} · ${P(pctDe(x.conv, x.exps))}`),
          linha("Mediana de dias até à inscrição", (x) => (x.mediana === null ? "—" : `${x.mediana} dias`)),
          linha("Inscritos na 1.ª semana", (x) => (x.comDias ? P(pctDe(x.ate7, x.comDias), 0) : "—")),
          ...(!escola
            ? [
                <tr key="sepxe">
                  <td colSpan={cols.length + 1} style={{ ...tdStyle, fontSize: 10.5, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 14 }}>
                    Conversão por escola
                  </td>
                </tr>,
                ...uniao((x) => x.expEscola)
                  .sort((a, b) => a.localeCompare(b, "pt"))
                  .map((e) => linha(e.replace(/^Dragon Force\s+/, ""), (x) => (x.expEscola[e] ? `${P(pctDe(x.expEscola[e].conv, x.expEscola[e].n), 0)} de ${x.expEscola[e].n}` : "—"), `xe-${e}`)),
              ]
            : []),
          <tr key="sepxm">
            <td colSpan={cols.length + 1} style={{ ...tdStyle, fontSize: 10.5, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: 14 }}>
              Conversão por mês da experiência
            </td>
          </tr>,
          ...MESES_EPOCA.filter((m) => cols.some((ep) => I[ep] && I[ep].expMes[m])).map((m) => linha(MES_CURTO[m], (x) => (x.expMes[m] ? `${P(pctDe(x.expMes[m].conv, x.expMes[m].n), 0)} de ${x.expMes[m].n}` : "—"), `xm-${m}`)),
        ])}
      </Bloco>

      <Bloco k="fem" titulo="6. Peso do feminino" nota="Alunas ativas sobre os alunos ativos com género indicado.">
        {tabela("Feminino", [
          linha("Total", (x) => P(x.fem)),
          ...ordEsc(uniao((x) => x.femEscalao)).map((k) => linha(k, (x) => (x.femEscalao[k] ? `${P(pctDe(x.femEscalao[k].f, x.femEscalao[k].n))} · ${x.femEscalao[k].f} de ${x.femEscalao[k].n}` : "—"), `f-${k}`)),
        ])}
      </Bloco>

      <Bloco k="trans" titulo="7. Passagem de turma para equipa de competição" nota="Para onde foram os alunos ativos no fim da época anterior: turmas (níveis) ou equipas de competição.">
        {tabela("Da época anterior", [
          linha("Turma → turma", (x) => (x.trans ? N(x.trans.t.turma.turma) : "sem época anterior")),
          linha("Turma → competição", (x) => (x.trans ? N(x.trans.t.turma.competicao) : "—")),
          linha("Turma → não voltou", (x) => (x.trans ? `${N(x.trans.t.turma.saiu)} · ${P(pctDe(x.trans.t.turma.saiu, x.trans.t.turma.turma + x.trans.t.turma.competicao + x.trans.t.turma.saiu), 0)}` : "—")),
          linha("Competição → competição", (x) => (x.trans ? N(x.trans.t.competicao.competicao) : "—")),
          linha("Competição → turma", (x) => (x.trans ? N(x.trans.t.competicao.turma) : "—")),
          linha("Competição → não voltou", (x) => (x.trans ? `${N(x.trans.t.competicao.saiu)} · ${P(pctDe(x.trans.t.competicao.saiu, x.trans.t.competicao.turma + x.trans.t.competicao.competicao + x.trans.t.competicao.saiu), 0)}` : "—")),
          linha("Turmas → competição (% dos alunos de turmas)", (x) => (x.trans ? `${N(x.trans.paraCompeticao)} · ${P(pctDe(x.trans.paraCompeticao, x.trans.deTurmas), 1)}` : "—")),
          ...niveisTurmas(niveis).map((nv) =>
            linha(`${nv} → competição`, (x) => {
              const z = x.trans && x.trans.porNivel[nv];
              return z && z.base ? `${N(z.passaram)} de ${N(z.base)} · ${P(pctDe(z.passaram, z.base), 0)}` : "—";
            }, `tn-${nv}`)
          ),
          linha("Último nível de turmas: passaram para competição", (x) => (x.trans && x.trans.doUltimo ? `${x.trans.passaram} de ${x.trans.doUltimo} (${x.trans.ultimo})` : "—")),
          linha("Último nível de turmas: perderam-se", (x) => (x.trans && x.trans.doUltimo ? `${x.trans.perdidos} · ${P(pctDe(x.trans.perdidos, x.trans.doUltimo), 0)}` : "—")),
        ])}
      </Bloco>

      <Bloco k="conc" titulo="8. Concentração e turmas com pouca gente" nota="Só turmas (as equipas de competição ficam de fora). Peso das 3 maiores turmas de cada escola, e turmas abaixo de 50% da capacidade há 4 ou mais semanas seguidas (nas últimas 8 semanas; numa época passada, as últimas 8 da época).">
        {tabela("Peso das 3 maiores turmas", [
          ...[...new Set(cols.flatMap((ep) => (I[ep] ? I[ep].concentracao.map((c) => c.escola) : [])))]
            .sort((a, b) => a.localeCompare(b, "pt"))
            .map((e) =>
              linha(e.replace(/^Dragon Force\s+/, ""), (x) => {
                const c = x.concentracao.find((y) => y.escola === e);
                return c ? <span title={c.top.map((t) => `${t.turma}: ${t.n}`).join(" · ")}>{`${P(c.pct, 0)} · ${c.turmas} turmas`}</span> : "—";
              }, `c-${e}`)
            ),
          linha("Turmas abaixo de 50% há 4+ semanas", (x) => N(x.baixas.length), "nbaixas"),
        ])}
        {cols.some((ep) => I[ep] && I[ep].baixas.length) && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`, gap: 12, marginTop: 12 }}>
            {cols
              .filter((ep) => I[ep] && I[ep].baixas.length)
              .map((ep) => (
                <div key={ep}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.ink2, marginBottom: 6 }}>{ep}</div>
                  {I[ep].baixas.slice(0, 15).map((b) => (
                    <div key={`${b.escola}|${b.turma}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "4px 0", borderBottom: `1px solid ${COLORS.ruleSoft}` }}>
                      <span>
                        {b.turma} <span style={{ color: COLORS.slate }}>· {b.escola.replace(/^Dragon Force\s+/, "")}</span>
                      </span>
                      <span style={{ fontVariantNumeric: "tabular-nums", color: COLORS.warn, whiteSpace: "nowrap" }}>
                        {b.n}/{b.cap} · {b.seguidas} sem.
                      </span>
                    </div>
                  ))}
                  {I[ep].baixas.length > 15 && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>e mais {I[ep].baixas.length - 15}</div>}
                </div>
              ))}
          </div>
        )}
      </Bloco>
    </div>
  );
}

function AnaliseInscritos({ registoAlunos, options, escolas, inscritos, epocaAnterior, experiencias, turmasAlunos, gestaoDados }) {
  const niveis = options.niveis || DEFAULT_NIVEIS;
  const epocas = Object.keys(registoAlunos || {}).sort();
  const epHoje = epocaDe(isoDe(new Date()));
  const fotoRef = useRef(null);
  const [vista, setVista] = useState("epoca");
  // Um só filtro de épocas para todas as vistas: uma época mostra o detalhe, várias comparam.
  const [eps, setEps] = useState(() => selecaoInicial(epocas));
  const epUnico = eps.length === 1 ? eps[0] : null;
  const ep = epUnico || epocas[epocas.length - 1] || epHoje;
  const [escola, setEscola] = useState("");
  const [ordem, setOrdem] = useState("inscritos");
  const [homologa, setHomologa] = useState(true);
  const [escInd, setEscInd] = useState("");

  // Números por época e por escola (calculados uma vez).
  const dados = useMemo(() => {
    const d = {};
    epocas.forEach((e) => {
      const reg = registoAlunos[e];
      const nomes = [...new Set(Object.values(reg.alunos || {}).map((a) => a.escola))].sort((a, b) => a.localeCompare(b, "pt"));
      d[e] = { total: numerosEpoca(reg, e, null, niveis), escolas: Object.fromEntries(nomes.map((n) => [n, numerosEpoca(reg, e, n, niveis)])) };
    });
    return d;
  }, [registoAlunos]); // eslint-disable-line react-hooks/exhaustive-deps

  const todasEscolas = [...new Set(epocas.flatMap((e) => Object.keys(dados[e].escolas)))].sort((a, b) => a.localeCompare(b, "pt"));
  // Estado de cada escola: encerrada (marcada por ti) e nova (primeira época com alunos).
  const estadoEsc = options.estadoEscolas || {};
  const encerradaEm = (e) => estadoEsc[e]?.encerrada || null;
  const primeiraEpoca = (e) => epocas.find((x) => dados[x].escolas[e]);
  const etiqueta = (txt, cor) => <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: cor, border: `1px solid ${cor}`, borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap" }}>{txt}</span>;
  const etiquetas = (e) => (
    <>
      {primeiraEpoca(e) !== epocas[0] && etiqueta(`nova em ${primeiraEpoca(e)}`, COLORS.ok)}
      {encerradaEm(e) && etiqueta(`encerrada em ${encerradaEm(e)}`, COLORS.slate)}
    </>
  );
  // Semana de comparação: a de hoje, se a época escolhida está a decorrer.
  const kHoje = epHoje === epUnico || ((!epUnico || vista !== "epoca") && epocas.includes(epHoje) && naSelecao(eps, epHoje)) ? semanaDaEpoca(isoDe(new Date()), semana1Padrao(epHoje)) : null;
  const kComp = homologa ? kHoje : null;

  const th = { textAlign: "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.slate, padding: "8px 9px", borderBottom: `1px solid ${COLORS.rule}`, whiteSpace: "nowrap", fontWeight: 600 };
  const td = { padding: "8px 9px", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontSize: 13, fontVariantNumeric: "tabular-nums" };
  const corVar = (v) => (v === null || v === undefined ? COLORS.slate : v >= 0 ? COLORS.ok : COLORS.danger);
  const fmtVar = (v) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${fmtNum(v, 1)}%`);
  const fmtPct = (v) => (v === null || v === undefined ? "—" : `${fmtNum(v, 1)}%`);
  const Kpi = ({ l, v, sub, cor }) => (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: COLORS.ink2, fontWeight: 600 }}>{l}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, letterSpacing: "-0.02em", color: cor || COLORS.ink, fontVariantNumeric: "tabular-nums" }}>{v}</div>
      {sub && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
  const seg = (atual, set, ops) => (
    <div style={{ display: "inline-flex", gap: 3, background: COLORS.segTrack, borderRadius: 9, padding: 2 }}>
      {ops.map(([k, l]) => (
        <button key={k} onClick={() => set(k)} className="pill" style={{ background: atual === k ? COLORS.paperRaised : "transparent", border: "none", borderRadius: 7, padding: "6px 13px", fontSize: 13, fontWeight: atual === k ? 600 : 500, color: atual === k ? COLORS.ink : COLORS.ink2, cursor: "pointer", boxShadow: atual === k ? "0 1px 3px rgba(0,0,0,0.12)" : "none" }}>
          {l}
        </button>
      ))}
    </div>
  );
  // Curvas semanais de várias épocas, sobrepostas pela semana da época.
  const graficoCurvas = (series, altura = 260) => {
    const ks = [...new Set(series.flatMap((s) => Object.keys(s.curva).map(Number)))].sort((a, b) => a - b);
    if (!ks.length) return <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem semanas.</div>;
    const linhas = ks.map((k) => Object.fromEntries([["name", `S${k}`], ...series.map((s) => [s.ep, s.curva[k] ?? null])]));
    return (
      <>
        <ResponsiveContainer width="100%" height={altura}>
          <LineChart data={linhas} margin={{ left: 4, right: 16, top: 8 }}>
            <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={3} />
            <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} />
            <Tooltip content={<DicaGrafico />} />
            {series.map((s, i) => (
              <Line key={s.ep} type="monotone" dataKey={s.ep} stroke={CORES_EPOCAS[Math.min(i, CORES_EPOCAS.length - 1)]} strokeWidth={i ? 1.6 : 2.4} strokeDasharray={i ? "5 4" : undefined} dot={false} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: COLORS.ink2, flexWrap: "wrap", marginTop: 4 }}>
          {series.map((s, i) => (
            <span key={s.ep} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, borderTop: `${i ? 2 : 3}px ${i ? "dashed" : "solid"} ${CORES_EPOCAS[Math.min(i, CORES_EPOCAS.length - 1)]}` }} /> {s.ep}
            </span>
          ))}
        </div>
      </>
    );
  };
  const tabelaEscaloes = (lista) => {
    const ordemEsc = (k) => {
      const i = niveis.indexOf(k);
      if (i >= 0) return i;
      const m = String(k).match(/(\d+)/);
      return m ? 100 + Number(m[1]) : 999;
    };
    const ks = [...new Set(lista.flatMap((n) => Object.keys(n.porEscalao)))].sort((a, b) => ordemEsc(a) - ordemEsc(b));
    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Escalão / nível</th>
              {lista.map((n) => (
                <th key={n.ep} style={{ ...th, textAlign: "right" }}>
                  {n.ep}
                </th>
              ))}
              {lista.length > 1 && <th style={{ ...th, textAlign: "right" }}>Variação</th>}
            </tr>
          </thead>
          <tbody>
            {ks.map((k) => {
              const a = lista[lista.length - 1].porEscalao[k] || 0;
              const b = lista.length > 1 ? lista[lista.length - 2].porEscalao[k] || 0 : null;
              return (
                <tr key={k}>
                  <td style={{ ...td, fontWeight: 600 }}>{k}</td>
                  {lista.map((n) => (
                    <td key={n.ep} style={{ ...td, textAlign: "right" }}>
                      {fmtNum(n.porEscalao[k] || 0)}
                    </td>
                  ))}
                  {lista.length > 1 && <td style={{ ...td, textAlign: "right", color: corVar(pctVar(a, b)), fontWeight: 600 }}>{fmtVar(pctVar(a, b))}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };
  const listaMotivos = (n) => {
    const m = Object.entries(n.motivos).sort((a, b) => b[1] - a[1]);
    if (!m.length) return <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem desistências.</div>;
    return m.slice(0, 8).map(([k, v]) => (
      <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, marginBottom: 7 }}>
        <span style={{ flex: "0 0 46%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={k}>
          {k}
        </span>
        <span style={{ flex: 1, height: 8, borderRadius: 4, background: COLORS.paperSunken, overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${(v / m[0][1]) * 100}%`, background: COLORS.danger, opacity: 0.75 }} />
        </span>
        <span style={{ width: 70, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {v} · {fmtNum((v / n.desist) * 100)}%
        </span>
      </div>
    ));
  };
  // Movimento por mês da época (entradas e desistências).
  const graficoMeses = (n) => {
    const meses = ["08", "09", "10", "11", "12", "01", "02", "03", "04", "05", "06", "07"];
    const linhas = meses.map((m) => ({ name: MES_CURTO[Number(m) - 1], Entradas: n.entradasMes[m] || 0, Desistências: n.desistMes[m] || 0 }));
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={linhas} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
          <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} />
          <Tooltip content={<DicaGrafico />} />
          <Bar dataKey="Entradas" fill={COLORS.navy} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="Desistências" fill={COLORS.danger} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  if (!epocas.length)
    return (
      <div style={panelStyle}>
        <Vazio icon={Users} titulo="Ainda sem alunos importados" texto="A análise sai dos ficheiros de inscritos. Importa-os no Painel (a época atual e as anteriores)." />
      </div>
    );

  const epAnt = epAntDe(ep);
  const temAnt = !!dados[epAnt];
  const tituloFoto = `Análise de inscritos · ${vista === "escola" ? escola || "escola" : vista === "indicadores" ? `indicadores${escInd ? ` · ${escInd}` : ""}` : "épocas"}`;
  const cab = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <span className="semFoto" style={{ order: 99, marginLeft: "auto" }}>
        <BotaoFoto alvo={fotoRef} titulo={tituloFoto} subtitulo={(eps && eps.length ? eps : [ep]).join(" · ")} nome={`${tituloFoto} ${isoDe(new Date())}`} />
      </span>
      {seg(vista, setVista, [
        ["epoca", "Épocas"],
        ["escola", "Por escola"],
        ["indicadores", "Indicadores"],
      ])}
      <FiltroEpocas compacto epocas={epocas} valor={eps} onChange={setEps} />
      {vista === "indicadores" && (
        <>
          <select value={escInd} onChange={(e) => setEscInd(e.target.value)} style={{ ...inputStyle, width: "auto", maxWidth: 280, padding: "7px 10px" }} aria-label="Escola">
            <option value="">Todas as escolas</option>
            {todasEscolas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </>
      )}
      {vista === "epoca" && <span style={{ fontSize: 12, color: COLORS.slate }}>{epUnico ? "Escolhe várias épocas para as comparar." : "Escolhe uma só época para ver o detalhe."}</span>}
      {vista === "escola" && (
        <select value={escola} onChange={(e) => setEscola(e.target.value)} style={{ ...inputStyle, width: "auto", maxWidth: 280, padding: "7px 10px", fontWeight: 600 }} aria-label="Escola">
          <option value="">Escolher escola</option>
          {todasEscolas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      )}
      {kHoje && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.ink2, cursor: "pointer" }}>
          <input type="checkbox" checked={homologa} onChange={(e) => setHomologa(e.target.checked)} />
          Comparar na mesma semana (S{kHoje}) — {epHoje} ainda está a decorrer
        </label>
      )}
    </div>
  );

  // ---------------- por época (uma só época escolhida) ----------------
  if (vista === "epoca" && epUnico) {
    const D = dados[ep];
    const T = D.total;
    const A = temAnt ? dados[epAnt].total : null;
    const k = ep === epHoje ? kComp : null;
    const totalAnt = A ? naSemana(A, k) : null;
    const renovGeral = temAnt ? destinosAlunos(registoAlunos[epAnt], registoAlunos[ep], null) : null;
    const nomes = Object.keys(D.escolas);
    const linhas = nomes.map((e) => {
      const n = D.escolas[e];
      const a = temAnt ? dados[epAnt].escolas[e] : null;
      const antV = a ? naSemana(a, k) : null;
      const rv = temAnt ? destinosAlunos(registoAlunos[epAnt], registoAlunos[ep], e) : null;
      return { e, n, antV, variacao: pctVar(n.inscritos, antV), nova: temAnt && !a, renov: rv ? rv.taxa : null };
    });
    const ord = {
      inscritos: (a, b) => b.n.inscritos - a.n.inscritos,
      variacao: (a, b) => (a.variacao ?? 999) - (b.variacao ?? 999),
      renov: (a, b) => (a.renov ?? 999) - (b.renov ?? 999),
      desist: (a, b) => (b.n.taxaDesist ?? 0) - (a.n.taxaDesist ?? 0),
      nome: (a, b) => a.e.localeCompare(b.e, "pt"),
    };
    // Escolas da época anterior que não têm alunos nesta: para onde foram os alunos.
    const fechadas = temAnt ? Object.keys(dados[epAnt].escolas).filter((e) => !D.escolas[e]) : [];
    return (
      <div className="vistaTroca" ref={fotoRef}>
        {cab}
        <AvisoDadosEpoca registos={[[ep, registoAlunos[ep]], ...(temAnt ? [[epAnt, registoAlunos[epAnt]]] : [])]} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 14 }}>
          <Kpi l={ep === epHoje ? "Inscritos agora" : "Inscritos no fim"} v={fmtNum(T.inscritos)} sub={A ? <span style={{ color: corVar(pctVar(T.inscritos, totalAnt)), fontWeight: 600 }}>{fmtVar(pctVar(T.inscritos, totalAnt))} vs {fmtNum(totalAnt)} {k ? `na semana ${k} de ${epAnt}` : `no fim de ${epAnt}`}</span> : `${T.escolas} escolas · ${T.turmas} turmas e equipas`} />
          {renovGeral ? (
            <Kpi l={`Renovação de ${epAnt}`} v={`${fmtNum(renovGeral.taxa, 1)}%`} sub={`${fmtNum(renovGeral.voltaram)} de ${fmtNum(renovGeral.base)} · ${fmtNum(renovGeral.voltaram - renovGeral.mesma)} noutra escola DF`} cor={renovGeral.taxa >= 70 ? COLORS.ok : renovGeral.taxa >= 50 ? COLORS.warn : COLORS.danger} />
          ) : (
            <Kpi l="Renovações" v={fmtNum(T.renov)} sub={`${fmtPct((T.renov / Math.max(1, T.entradas)) * 100)} das entradas · importa ${epAnt} para a taxa`} />
          )}
          <Kpi l="Inscrições novas" v={fmtNum(T.novos)} sub={`${fmtNum(T.extra)} extrainscrições${A ? ` · ${fmtNum(A.novos)} em ${epAnt}` : ""}`} />
          <Kpi l="Desistências" v={fmtNum(T.desist)} sub={`${fmtPct(T.taxaDesist)} de quem entrou${A ? ` · ${fmtPct(A.taxaDesist)} em ${epAnt}` : ""}`} cor={T.desist ? COLORS.danger : COLORS.ink} />
          <Kpi l="Experiências convertidas" v={fmtPct(T.taxaConv)} sub={`${fmtNum(T.conv)} de ${fmtNum(T.exps)} experiências${A ? ` · ${fmtPct(A.taxaConv)} em ${epAnt}` : ""}`} />
          <Kpi l="Género feminino" v={fmtPct(T.raparigas)} sub={A ? `${fmtPct(A.raparigas)} em ${epAnt}` : ""} />
        </div>

        <div style={{ ...panelStyle, marginBottom: 14 }}>
          <div style={panelTitle}>Inscritos por semana da época</div>
          <div style={{ marginTop: 8 }}>{graficoCurvas([T, ...(A ? [A] : [])])}</div>
        </div>

        {ep === epHoje && (
          <PrevisaoFimEpoca escolas={nomes} inscritos={inscritos} epocaAnterior={epocaAnterior} experiencias={experiencias} turmasAlunos={turmasAlunos} niveis={niveis} limites={options.limitesCrescimento || LIMITES_CRESC_PADRAO} fEsc="todas" />
        )}

        <div style={{ ...panelStyle, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <div style={panelTitle}>Escolas em {ep}</div>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 9px", fontSize: 12.5 }} aria-label="Ordenar">
              <option value="inscritos">Mais inscritos</option>
              <option value="variacao">Pior variação</option>
              <option value="renov">Pior renovação</option>
              <option value="desist">Mais desistências</option>
              <option value="nome">Nome</option>
            </select>
          </div>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Escola", "Inscritos", temAnt ? (k ? `${epAnt} (S${k})` : epAnt) : null, temAnt ? "Variação" : null, temAnt ? "Renovação" : null, "Novos", "Desist.", "Exp. conv.", "Feminino"]
                    .filter((x) => x !== null)
                    .map((c, i) => (
                      <th key={c} style={{ ...th, textAlign: i ? "right" : "left" }}>
                        {c}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {[...linhas].sort(ord[ordem]).map((l) => (
                  <tr key={l.e} onClick={() => { setEscola(l.e); setVista("escola"); }} style={{ cursor: "pointer" }} title="Ver a escola ao longo das épocas">
                    <td style={{ ...td, fontWeight: 600 }}>
                      {l.e}
                      {l.nova && etiqueta(`nova em ${ep}`, COLORS.ok)}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtNum(l.n.inscritos)}</td>
                    {temAnt && <td style={{ ...td, textAlign: "right", color: COLORS.ink2 }}>{l.antV === null ? "—" : fmtNum(l.antV)}</td>}
                    {temAnt && <td style={{ ...td, textAlign: "right", color: corVar(l.variacao), fontWeight: 600 }}>{fmtVar(l.variacao)}</td>}
                    {temAnt && <td style={{ ...td, textAlign: "right" }}>{fmtPct(l.renov)}</td>}
                    <td style={{ ...td, textAlign: "right" }}>{fmtNum(l.n.novos)}</td>
                    <td style={{ ...td, textAlign: "right", color: l.n.desist ? COLORS.danger : COLORS.ink }}>
                      {fmtNum(l.n.desist)} <span style={{ color: COLORS.slate }}>({fmtPct(l.n.taxaDesist)})</span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{fmtPct(l.n.taxaConv)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fmtPct(l.n.raparigas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 8, lineHeight: 1.5 }}>
            Renovação: alunos inscritos no fim de {epAnt} nessa escola que estão inscritos em {ep}, nela ou noutra escola DF (pelo código do atleta). Clica numa escola para a ver ao longo das épocas.
          </div>
        </div>

        {fechadas.length > 0 && (
          <div style={{ ...panelStyle, marginBottom: 14 }}>
            <div style={panelTitle}>
              Escolas de {epAnt} sem alunos em {ep}
            </div>
            <div style={{ fontSize: 12, color: COLORS.slate, margin: "4px 0 10px" }}>Os alunos destas escolas contam para a renovação se se inscreveram noutra escola DF. Se for a mesma escola com outro nome, iguala os nomes em Painel → Gerir dados → Escolas entre épocas.</div>
            {fechadas.map((e) => {
              const d = destinosAlunos(registoAlunos[epAnt], registoAlunos[ep], e);
              if (!d) return null;
              return (
                <div key={e} style={{ padding: "8px 0", borderTop: `1px solid ${COLORS.ruleSoft}`, fontSize: 13 }}>
                  <strong>{e}</strong>
                  {encerradaEm(e) ? etiqueta(`encerrada em ${encerradaEm(e)}`, COLORS.slate) : etiqueta("por confirmar", COLORS.warn)}
                  {gestaoDados && (
                    <button onClick={() => gestaoDados.estadoEscola(e, encerradaEm(e) ? null : ep)} style={{ ...linkBtnStyle, marginTop: 0, marginLeft: 10, fontSize: 12 }}>
                      {encerradaEm(e) ? "Reabrir" : "Marcar como encerrada"}
                    </button>
                  )}
                  <span style={{ color: COLORS.ink2 }}> · {fmtNum(d.base)} alunos no fim de {epAnt} · renovaram {fmtNum(d.voltaram)} ({fmtPct(d.taxa)})</span>
                  {d.outras.length > 0 && <div style={{ color: COLORS.ink2, fontSize: 12.5, marginTop: 2 }}>Para: {d.outras.map(([x, v]) => `${x} (${v})`).join(" · ")}</div>}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
          <div style={panelStyle}>
            <div style={panelTitle}>Entradas e desistências por mês</div>
            <div style={{ marginTop: 8 }}>{graficoMeses(T)}</div>
          </div>
          <div style={panelStyle}>
            <div style={panelTitle}>Motivos de desistência</div>
            <div style={{ marginTop: 10 }}>{listaMotivos(T)}</div>
          </div>
        </div>
        <div style={{ ...panelStyle, marginTop: 14 }}>
          <div style={panelTitle}>Inscritos por escalão / nível</div>
          <div style={{ marginTop: 6 }}>{tabelaEscaloes(A ? [A, T] : [T])}</div>
        </div>
      </div>
    );
  }

  // ---------------- indicadores ----------------
  if (vista === "indicadores") {
    return (
      <div className="vistaTroca" ref={fotoRef}>
        {cab}
        <IndicadoresInscritos registoAlunos={registoAlunos} niveis={niveis} capacidades={options.capacidades || {}} epocas={epocas} sel={eps} escola={escInd} />
      </div>
    );
  }

  // ---------------- comparar épocas (várias ou todas) ----------------
  if (vista === "epoca") {
    const lista = epocas.filter((e) => naSelecao(eps, e)).map((e) => dados[e].total).filter(Boolean);
    const recentes = [...lista].reverse();
    const k = kComp;
    const valor = (n) => naSemana(n, n.ep === epHoje ? null : k);
    return (
      <div className="vistaTroca" ref={fotoRef}>
        {cab}
        <AvisoDadosEpoca registos={recentes.map((n) => [n.ep, registoAlunos[n.ep]])} />
        <div style={{ ...panelStyle, marginBottom: 14 }}>
          <div style={panelTitle}>Dragon Force por época{k ? ` · comparação na semana ${k}` : ""}</div>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Época", "Escolas", k ? `Inscritos (S${k})` : "Inscritos", "Variação", "Inscritos no fim", "Renovação", "Novos", "Desist.", "Exp. conv.", "Feminino"].map((c, i) => (
                    <th key={c} style={{ ...th, textAlign: i ? "right" : "left" }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentes.map((n) => {
                  const ant = dados[epAntDe(n.ep)]?.total;
                  const v = valor(n);
                  const rv = ant ? destinosAlunos(registoAlunos[epAntDe(n.ep)], registoAlunos[n.ep], null) : null;
                  return (
                    <tr key={n.ep} onClick={() => setEps([n.ep])} style={{ cursor: "pointer" }} title={`Ver o detalhe de ${n.ep}`}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {n.ep}
                        {n.ep === epHoje ? <span style={{ color: COLORS.slate, fontWeight: 400 }}> (a decorrer)</span> : ""}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{n.escolas}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtNum(v)}</td>
                      <td style={{ ...td, textAlign: "right", color: corVar(ant ? pctVar(v, valor(ant)) : null), fontWeight: 600 }}>{ant ? fmtVar(pctVar(v, valor(ant))) : "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{n.ep === epHoje ? "—" : fmtNum(n.inscritos)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{rv ? fmtPct(rv.taxa) : "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtNum(n.novos)}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {fmtNum(n.desist)} <span style={{ color: COLORS.slate }}>({fmtPct(n.taxaDesist)})</span>
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtPct(n.taxaConv)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmtPct(n.raparigas)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {k && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 8 }}>Desistências, novos e experiências das épocas passadas são da época inteira.</div>}
        </div>

        <div style={{ ...panelStyle, marginBottom: 14 }}>
          <div style={panelTitle}>Inscritos por semana, época a época</div>
          <div style={{ marginTop: 8 }}>{graficoCurvas(recentes.slice(0, 5))}</div>
        </div>

        <div style={{ ...panelStyle, marginBottom: 14 }}>
          <div style={panelTitle}>Escolas por época{k ? ` (semana ${k}; épocas fechadas no fim se desmarcares a mesma semana)` : ""}</div>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Escola</th>
                  {lista.map((n) => (
                    <th key={n.ep} style={{ ...th, textAlign: "right" }}>
                      {n.ep}
                    </th>
                  ))}
                  {lista.length > 1 && <th style={{ ...th, textAlign: "right" }}>Última variação</th>}
                </tr>
              </thead>
              <tbody>
                {todasEscolas.map((e) => {
                  const vals = lista.map((n) => {
                    const x = dados[n.ep].escolas[e];
                    return x ? naSemana(x, n.ep === epHoje ? null : k) : null;
                  });
                  const presentes = vals.filter((v) => v !== null).length;
                  const ult = vals[vals.length - 1];
                  const pen = vals[vals.length - 2];
                  return (
                    <tr key={e} onClick={() => { setEscola(e); setVista("escola"); }} style={{ cursor: "pointer" }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {e}
                        {etiquetas(e)}
                        {presentes === 1 && lista.length > 1 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: COLORS.slate }}>só em {lista[vals.findIndex((v) => v !== null)].ep}</span>}
                      </td>
                      {vals.map((v, i) => (
                        <td key={i} style={{ ...td, textAlign: "right", color: v === null ? COLORS.slate : COLORS.ink }}>
                          {v === null ? "—" : fmtNum(v)}
                        </td>
                      ))}
                      {lista.length > 1 && <td style={{ ...td, textAlign: "right", color: corVar(pctVar(ult, pen)), fontWeight: 600 }}>{ult !== null && pen ? fmtVar(pctVar(ult, pen)) : ult !== null && pen === null ? "nova" : ult === null && pen !== null ? (encerradaEm(e) ? "encerrada" : "sem alunos") : "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ ...panelStyle, marginBottom: 14 }}>
          <div style={panelTitle}>Inscritos por escalão / nível, época a época (no fim de cada época; a atual, agora)</div>
          <div style={{ marginTop: 6 }}>{tabelaEscaloes(lista)}</div>
        </div>
      </div>
    );
  }

  // ---------------- por escola ----------------
  const lista = escola ? epocas.filter((e) => naSelecao(eps, e)).map((e) => dados[e].escolas[escola]).filter(Boolean) : [];
  const ausentes = escola ? epocas.filter((e) => !dados[e].escolas[escola]) : [];
  const recentes = [...lista].reverse();
  const k = kComp;
  const valor = (n) => naSemana(n, n.ep === epHoje ? null : k);
  return (
    <div className="vistaTroca" ref={fotoRef}>
      {cab}
      {!escola ? (
        <div style={panelStyle}>
          <div style={{ fontSize: 13, color: COLORS.ink2 }}>Escolhe uma escola para a ver em todas as épocas importadas.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: COLORS.ink2, marginBottom: 10, padding: "9px 12px", borderRadius: 9, background: COLORS.paperSunken }}>
            <span>
              <strong style={{ color: COLORS.ink }}>{escola}</strong>
              {etiquetas(escola)}
            </span>
            <span>{ausentes.length > 0 ? `Sem alunos em ${ausentes.join(", ")}.${lista.length === 1 ? ` Só existe em ${lista[0].ep}.` : ""}` : `Com alunos em todas as épocas importadas.`}</span>
            {gestaoDados && (
              <button
                onClick={() => {
                  if (encerradaEm(escola)) return gestaoDados.estadoEscola(escola, null);
                  const ultima = lista[lista.length - 1]?.ep;
                  const seguinte = ultima ? `${Number(ultima.slice(0, 4)) + 1}/${String(Number(ultima.slice(0, 4)) + 2).slice(2)}` : epHoje;
                  gestaoDados.estadoEscola(escola, seguinte);
                }}
                style={{ ...linkBtnStyle, marginTop: 0, marginLeft: "auto", fontSize: 12 }}
              >
                {encerradaEm(escola) ? "Reabrir escola" : "Marcar como encerrada"}
              </button>
            )}
          </div>
          <AvisoDadosEpoca registos={recentes.map((n) => [n.ep, registoAlunos[n.ep]])} />
          <div style={{ ...panelStyle, marginBottom: 14 }}>
            <div style={panelTitle}>
              {escola} por época{k ? ` · comparação na semana ${k}` : ""}
            </div>
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Época", k ? `Inscritos (S${k})` : "Inscritos", "Variação", "Inscritos no fim", "Renovação", "Novos", "Desist.", "Exp. conv.", "Feminino", "Turmas e equipas"].map((c, i) => (
                      <th key={c} style={{ ...th, textAlign: i ? "right" : "left" }}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((n) => {
                    const ant = dados[epAntDe(n.ep)]?.escolas[escola];
                    const v = valor(n);
                    const rv = dados[epAntDe(n.ep)] ? destinosAlunos(registoAlunos[epAntDe(n.ep)], registoAlunos[n.ep], escola) : null;
                    return (
                      <tr key={n.ep}>
                        <td style={{ ...td, fontWeight: 600 }}>{n.ep}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmtNum(v)}</td>
                        <td style={{ ...td, textAlign: "right", color: corVar(ant ? pctVar(v, valor(ant)) : null), fontWeight: 600 }}>{ant ? fmtVar(pctVar(v, valor(ant))) : dados[epAntDe(n.ep)] ? "nova" : "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{n.ep === epHoje ? "—" : fmtNum(n.inscritos)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{rv ? fmtPct(rv.taxa) : "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmtNum(n.novos)}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {fmtNum(n.desist)} <span style={{ color: COLORS.slate }}>({fmtPct(n.taxaDesist)})</span>
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>{fmtPct(n.taxaConv)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmtPct(n.raparigas)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{n.turmas}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Para onde foram os alunos do fim de cada época */}
          {lista.length > 0 && epocas.length > 1 && (
            <div style={{ ...panelStyle, marginBottom: 14 }}>
              <div style={panelTitle}>Renovação dos alunos de {escola}</div>
              <div style={{ fontSize: 12, color: COLORS.slate, margin: "4px 0 8px" }}>Alunos inscritos no fim de uma época e onde estão na seguinte (pelo código do atleta).</div>
              {epocas.slice(0, -1).map((e, i) => {
                const seg2 = epocas[i + 1];
                if (seg2 !== `${Number(e.slice(0, 4)) + 1}/${String(Number(e.slice(0, 4)) + 2).slice(2)}`) return null;
                const d = destinosAlunos(registoAlunos[e], registoAlunos[seg2], escola);
                if (!d) return null;
                return (
                  <div key={e} style={{ padding: "8px 0", borderTop: `1px solid ${COLORS.ruleSoft}`, fontSize: 13, lineHeight: 1.6 }}>
                    <strong>
                      {e} → {seg2}
                    </strong>
                    : {fmtNum(d.base)} alunos · {fmtNum(d.mesma)} ficaram em {escola} · {fmtNum(d.voltaram - d.mesma)} foram para outra escola DF · {fmtNum(d.naoVoltaram)} não renovaram ({fmtPct(d.taxa)} de renovação)
                    {d.outras.length > 0 && <div style={{ color: COLORS.ink2, fontSize: 12.5 }}>Para: {d.outras.map(([x, v]) => `${x} (${v})`).join(" · ")}</div>}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ ...panelStyle, marginBottom: 14 }}>
            <div style={panelTitle}>Inscritos por semana, época a época</div>
            <div style={{ marginTop: 8 }}>{graficoCurvas(recentes.slice(0, 5))}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
            {recentes[0] && (
              <div style={panelStyle}>
                <div style={panelTitle}>Entradas e desistências por mês · {recentes[0].ep}</div>
                <div style={{ marginTop: 8 }}>{graficoMeses(recentes[0])}</div>
              </div>
            )}
            {recentes[0] && (
              <div style={panelStyle}>
                <div style={panelTitle}>Motivos de desistência · {recentes[0].ep}</div>
                <div style={{ marginTop: 10 }}>{listaMotivos(recentes[0])}</div>
              </div>
            )}
          </div>
          <div style={{ ...panelStyle, marginTop: 14 }}>
            <div style={panelTitle}>Por escalão / nível</div>
            <div style={{ marginTop: 6 }}>{tabelaEscaloes(lista)}</div>
          </div>
        </>
      )}
    </div>
  );
}

function PrevisaoFimEpoca({ escolas, inscritos, epocaAnterior, experiencias, turmasAlunos, niveis, limites, fEsc }) {
  const hoje = isoDe(new Date());
  const todas = previsoesEscolas({ escolas, inscritos, epocaAnterior, experiencias, turmasAlunos, niveis, hoje });
  const lista = todas.filter((p) => fEsc === "todas" || p.escola === fEsc);
  const validas = lista.filter((p) => !p.insuficiente);
  const fim = fimDeEpoca(epocaDe(hoje));
  const fimTxt = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" }).format(new Date(fim + "T00:00:00"));

  // Gráfico: soma das escolas visíveis, semana a semana (real + projeção). Cada escola
  // conta em todas as semanas com o último valor que tem, para a soma não cair quando
  // uma escola tem menos semanas do que outra.
  const ateSemana = (lista, w, campo) => {
    let v = null;
    lista.forEach((r) => {
      if (r.semana <= w) v = r[campo];
    });
    return v;
  };
  const semanasReais = [...new Set(validas.flatMap((p) => p.serie.map((r) => r.semana)))].sort();
  const ultimaReal = semanasReais[semanasReais.length - 1];
  const semanasProj = [...new Set(validas.flatMap((p) => p.trajetoria.map((t) => t.semana)))].filter((w) => w > ultimaReal).sort();
  const projDe = (p, w, campo) => {
    const ultSerie = p.serie[p.serie.length - 1];
    if (w <= ultSerie.semana) return ateSemana(p.serie, w, "total") || 0;
    const t = ateSemana(p.trajetoria, w, campo);
    return t !== null ? t : ultSerie.total;
  };
  const dadosGraf = [
    ...semanasReais.map((w) => {
      const real = validas.reduce((t, p) => t + (ateSemana(p.serie, w, "total") || 0), 0);
      return w === ultimaReal ? { semana: w, real, central: real, faixa: [real, real] } : { semana: w, real };
    }),
    ...semanasProj.map((w) => ({
      semana: w,
      central: validas.reduce((t, p) => t + projDe(p, w, "central"), 0),
      faixa: [validas.reduce((t, p) => t + projDe(p, w, "baixo"), 0), validas.reduce((t, p) => t + projDe(p, w, "alto"), 0)],
    })),
  ].map((x) => ({ ...x, name: semanaLabel(x.semana) }));
  const antSoma = validas.reduce((t, p) => t + (p.ant || 0), 0);
  const total = validas.reduce(
    (t, p) => ({ atual: t.atual + p.atual, previsao: t.previsao + p.previsao, baixo: t.baixo + p.baixo, alto: t.alto + p.alto }),
    { atual: 0, previsao: 0, baixo: 0, alto: 0 }
  );
  const varTotal = antSoma ? Math.round(((total.previsao - antSoma) / antSoma) * 1000) / 10 : null;

  return (
    <div style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={panelTitle}>Previsão de fim de época ({fimTxt})</div>
        {validas.length > 0 && (
          <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>
            {fEsc === "todas" ? "Total previsto" : "Previsto"}: <strong style={{ color: COLORS.ink }}>{total.previsao}</strong> alunos (entre {total.baixo} e {total.alto})
            {varTotal !== null && (
              <span style={{ color: varTotal >= 0 ? COLORS.ok : COLORS.danger, fontWeight: 600 }}>
                {" "}
                · {varTotal > 0 ? "+" : ""}
                {varTotal.toLocaleString("pt-PT")}% face à época passada
              </span>
            )}
          </div>
        )}
      </div>

      {validas.length === 0 ? (
        <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 6 }}>
          São precisas pelo menos 3 semanas desta época para prever o fim de época. Importa o ficheiro de inscritos no Painel.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={dadosGraf} margin={{ left: 6, right: 16, top: 10 }}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={Math.max(0, Math.ceil(dadosGraf.length / 10) - 1)} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={44} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload && payload.length ? (
                    <DicaGrafico
                      active
                      label={label}
                      payload={payload
                        .filter((x) => x.dataKey !== "faixa")
                        .concat(payload.find((x) => x.dataKey === "faixa") ? [{ name: "Intervalo", value: payload.find((x) => x.dataKey === "faixa").value.join(" – "), color: COLORS.rule }] : [])}
                    />
                  ) : null
                }
              />
              <Area type="monotone" dataKey="faixa" name="Intervalo" stroke="none" fill={COLORS.navy} fillOpacity={0.1} isAnimationActive={false} />
              {antSoma > 0 && <ReferenceLine y={antSoma} stroke={COLORS.slate} strokeDasharray="4 4" label={{ value: "Época passada", position: "insideTopLeft", fontSize: 10.5, fill: COLORS.slate }} />}
              <Line type="monotone" dataKey="real" name="Inscritos" stroke={COLORS.navy} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="central" name="Previsão" stroke={COLORS.navy} strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: COLORS.ink2, marginTop: 2 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 2, background: COLORS.navy }} /> Inscritos
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 16, height: 0, borderTop: `2px dashed ${COLORS.navy}` }} /> Previsão
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 10, background: COLORS.navy, opacity: 0.15, borderRadius: 2 }} /> {validas.some((p) => p.metodo === "epocaPassada") ? `Intervalo: evolução da escola e do total DF em ${epAntDe(epocaDe(hoje))}, desta semana a 31 de julho` : "Intervalo: sem novas inscrições a ritmo atual mantido"}
            </span>
          </div>
        </>
      )}

      {lista.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
            <thead>
              <tr>
                {["Escola", "Agora", "Época passada", "Previsão em julho", "Variação", "", "Para igualar a época passada", "Ritmo semanal"].map((c, i) => (
                  <th key={i} style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: COLORS.slate, padding: "6px 8px", borderBottom: `1px solid ${COLORS.rule}`, whiteSpace: "nowrap" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                if (p.insuficiente)
                  return (
                    <tr key={p.escola}>
                      <td style={{ padding: "7px 8px", fontWeight: 600 }}>{p.escola}</td>
                      <td colSpan={7} style={{ padding: "7px 8px", color: COLORS.slate }}>
                        {p.semanasComDados ? `Só ${p.semanasComDados === 1 ? "1 semana" : `${p.semanasComDados} semanas`} com alunos nesta época; são precisas 3 para prever.` : "Sem alunos importados nesta época."}
                      </td>
                    </tr>
                  );
                const cls = p.variacao !== null ? classificarCrescimento(p.variacao, limites) : null;
                return (
                  <tr key={p.escola} style={{ borderTop: `1px solid ${COLORS.ruleSoft}` }}>
                    <td style={{ padding: "7px 8px", fontWeight: 600 }}>{p.escola}</td>
                    <td style={{ padding: "7px 8px", fontVariantNumeric: "tabular-nums" }}>{p.atual}</td>
                    <td style={{ padding: "7px 8px", fontVariantNumeric: "tabular-nums" }}>{p.ant ?? "—"}</td>
                    <td style={{ padding: "7px 8px", fontVariantNumeric: "tabular-nums" }}>
                      <strong>{p.previsao}</strong> <span style={{ color: COLORS.slate }}>({p.baixo}–{p.alto})</span>
                    </td>
                    <td style={{ padding: "7px 8px", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: p.variacao === null ? COLORS.slate : p.variacao >= 0 ? COLORS.ok : COLORS.danger }}>
                      {p.variacao === null ? "—" : `${p.variacao > 0 ? "+" : ""}${p.variacao.toLocaleString("pt-PT")}%`}
                    </td>
                    <td style={{ padding: "7px 8px" }}>{cls && <Tag label={cls.label} color={cls.color} bg={cls.bg} />}</td>
                    <td style={{ padding: "7px 8px", fontVariantNumeric: "tabular-nums" }}>
                      {p.falta === null ? "—" : p.falta === 0 ? <span style={{ color: COLORS.ok }}>Previsão acima ({p.previsao - p.ant >= 0 ? "+" : ""}{p.previsao - p.ant})</span> : `faltam ${p.falta} (≈ ${p.porSemana}/semana)`}
                    </td>
                    <td style={{ padding: "7px 8px", fontSize: 12, color: COLORS.slate, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      +{p.entradas.toLocaleString("pt-PT")} / −{p.saidas.toLocaleString("pt-PT")}
                      {p.deExperiencias ? ` · +${p.deExperiencias} exp.` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 8, lineHeight: 1.5 }}>
            Ritmo das últimas {SEMANAS_RITMO} semanas: novas inscrições e desistências por semana, e as experiências por avaliar que deverão converter. As novas inscrições abrandam ao longo da época; nenhuma escola passa a capacidade das suas turmas.
          </div>
        </div>
      )}
    </div>
  );
}
