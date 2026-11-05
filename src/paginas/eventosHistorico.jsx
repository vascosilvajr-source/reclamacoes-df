// Eventos ao longo do tempo: quem voltou de época para época, quem saiu por idade, externos que converteram
// (outro evento, inscrição, extrainscrição; turmas ou equipas de competição) e inscritos por turma e treinador.
// Só códigos de aluno, turmas e siglas: nunca nomes.
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { COLORS, DEFAULT_NIVEIS, StatCard, compactoTurma, epocaDe, escalaoDaTurma, inputStyle, linkBtnStyle, normChave, turmasDoBloco } from "../nucleo.jsx";
import { DicaGrafico, fmtNum, tdStyle, thStyle } from "../partilhado.jsx";

export const TIPOS_EVENTO = [
  ["interno", "Alunos DF"],
  ["externo", "Com externos (camps…)"],
  ["captacao", "Captação / caça talentos"],
];
export const tipoDoEvento = (ev) => ev.tipoPublico || (/camp/i.test(ev.nome || "") ? "externo" : /ca[cç]a|capta/i.test(ev.nome || "") ? "captacao" : "interno");

// Equipas de competição: tudo o que é Sub-qualquer coisa (ou competição sem escalão). O resto são turmas.
export const eCompeticao = (escalao) => /^sub-|^competi/i.test(String(escalao || ""));
const numSub = (k) => {
  const m = String(k || "").match(/sub[\s-]*(\d+)/i);
  return m ? Number(m[1]) : null;
};
// Escalão Sub-N de um ano de nascimento numa época ("2025/26" → nascidos em 2013 são Sub-13).
export const subDeAno = (ano, ep) => Number(String(ep).slice(0, 4)) + 1 - Number(ano);
// Nome do evento sem o ano, para juntar as edições ("Torneio das Lendas 2025" = "Torneio das Lendas").
export const chaveEvento = (nome) => normChave(String(nome || "").replace(/\b(19|20)\d{2}(\s*\/\s*\d{2,4})?\b/g, "")).replace(/\s+/g, " ").trim();

// Códigos do evento já com as decisões da revisão (corrigir / ignorar).
export function idsDoEvento(ev) {
  const dec = (ev.participantes && ev.participantes.decisoes) || {};
  const out = new Set();
  ((ev.participantes && ev.participantes.ids) || []).map(String).forEach((raw) => {
    const d = dec[raw];
    if (d && d.acao === "ignorar") return;
    out.add(d && d.acao === "corrigir" && d.novo ? String(d.novo) : raw);
  });
  return out;
}

// Alunos DF na data do evento (mesma regra de contasEvento: as escolas importadas depois contam todas).
function dfNaData(reg, data) {
  const todos = Object.values((reg && reg.alunos) || {});
  const ativo = (a) => a.estado === "ativo" || !a.saida || a.saida > data;
  const naData = todos.filter((a) => (!a.entrada || a.entrada <= data) && ativo(a));
  const comAlunos = new Set(naData.map((a) => a.escola));
  return [...naData, ...todos.filter((a) => !comAlunos.has(a.escola) && a.entrada > data && ativo(a))];
}

const anoDe = (id, registoAlunos, ev) => {
  for (const r of Object.values(registoAlunos || {})) if (r && r.alunos && r.alunos[id] && r.alunos[id].ano) return Number(r.alunos[id].ano);
  const a = ev && ev.participantes && ev.participantes.anos && ev.participantes.anos[id];
  return a ? Number(a) : null;
};

// Época a época de um evento (edições com o mesmo nome). passa(id, ep): filtro de análise (escola/escalão).
export function historicoEventos(edicoes, registoAlunos, passa = () => true) {
  const porEp = {};
  [...edicoes]
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
    .forEach((ev) => {
      const ep = epocaDe(ev.data);
      const x = (porEp[ep] = porEp[ep] || { ep, ids: new Set(), max: null, evs: [] });
      idsDoEvento(ev).forEach((id) => passa(id, ep) && x.ids.add(id));
      if (ev.escalaoMax) x.max = numSub(ev.escalaoMax);
      x.evs.push(ev);
    });
  const eps = Object.values(porEp).sort((a, b) => a.ep.localeCompare(b.ep));
  const max = [...eps].reverse().find((e) => e.max)?.max || null;
  return eps.slice(1).map((B, i) => {
    const A = eps[i];
    const regB = registoAlunos[B.ep];
    const repetiram = [...A.ids].filter((id) => B.ids.has(id));
    const novos = [...B.ids].filter((id) => !A.ids.has(id));
    const porIdade = [];
    const deixaramDF = [];
    const outros = [];
    [...A.ids]
      .filter((id) => !B.ids.has(id))
      .forEach((id) => {
        const ano = anoDe(id, registoAlunos, A.evs[0]);
        if (max && ano && subDeAno(ano, B.ep) > max) return porIdade.push(id);
        const eraDF = registoAlunos[A.ep] && registoAlunos[A.ep].alunos && registoAlunos[A.ep].alunos[id];
        if (eraDF && regB && (!regB.alunos || !regB.alunos[id] || regB.alunos[id].estado !== "ativo")) return deixaramDF.push(id);
        outros.push(id);
      });
    const podiam = A.ids.size - porIdade.length;
    return { de: A.ep, para: B.ep, antes: A.ids.size, agora: B.ids.size, repetiram, novos, porIdade, deixaramDF, outros, retorno: podiam ? (repetiram.length / podiam) * 100 : null };
  });
}

// Externos de um evento (não eram alunos DF na data) e o que fizeram depois.
export function conversoes(ev, eventos, registoAlunos, niveis) {
  const ep = epocaDe(ev.data);
  const ids = [...idsDoEvento(ev)];
  const df = new Map(dfNaData(registoAlunos[ep], ev.data).map((a) => [String(a.id), a]));
  const externos = ids.filter((id) => !df.has(id));
  const epsDepois = Object.keys(registoAlunos || {})
    .filter((e) => e >= ep)
    .sort();
  // Primeiro registo como aluno DF depois do evento.
  const depois = (id) => {
    for (const e of epsDepois) {
      const a = registoAlunos[e] && registoAlunos[e].alunos && registoAlunos[e].alunos[id];
      if (a && (e > ep || !a.entrada || a.entrada > ev.data)) return a;
    }
    return null;
  };
  const outrosEv = eventos.filter((o) => o.id !== ev.id && o.v === 2 && o.data > ev.data).map(idsDoEvento);
  const r = { ids, externos, outroEvento: [], inscricao: [], extra: [], paraTurmas: [], paraEquipas: [], subiramEquipa: [] };
  externos.forEach((id) => {
    if (outrosEv.some((s) => s.has(id))) r.outroEvento.push(id);
    const a = depois(id);
    if (!a) return;
    (a.rubrica === "extra" ? r.extra : r.inscricao).push(id);
    (eCompeticao(escalaoDaTurma(a.turma, niveis)) ? r.paraEquipas : r.paraTurmas).push(id);
  });
  // Alunos DF que estavam numa turma e passaram a uma equipa de competição (o último registo conhecido).
  ids
    .filter((id) => df.has(id) && !eCompeticao(escalaoDaTurma(df.get(id).turma, niveis)))
    .forEach((id) => {
      const ult = [...epsDepois].reverse().map((e) => registoAlunos[e]?.alunos?.[id]).find(Boolean);
      if (ult && eCompeticao(escalaoDaTurma(ult.turma, niveis))) r.subiramEquipa.push(id);
    });
  return r;
}

// Inscritos por turma (face aos elegíveis dessa turma) e por sigla de treinador (dos Espaços).
export function turmasETreinadores(ev, registoAlunos, niveis, espacos, passa = () => true) {
  const ep = epocaDe(ev.data);
  const ids = idsDoEvento(ev);
  const excl = new Set(ev.excluidas || []);
  const escolasEv = ev.escolas && ev.escolas.length ? new Set(ev.escolas) : null;
  const escaloes = ev.escaloes && ev.escaloes.length ? new Set(ev.escaloes) : null;
  const linhas = {};
  dfNaData(registoAlunos[ep], ev.data).forEach((a) => {
    const id = String(a.id);
    const inscrito = ids.has(id);
    const elegivel = !excl.has(a.escola) && (!escolasEv || escolasEv.has(a.escola)) && (!escaloes || escaloes.has(escalaoDaTurma(a.turma, niveis)));
    if ((!elegivel && !inscrito) || !passa(id, ep)) return;
    const k = `${a.escola}|${a.turma}`;
    const l = (linhas[k] = linhas[k] || { escola: a.escola, turma: a.turma || "—", elegiveis: 0, inscritos: 0 });
    if (elegivel) l.elegiveis++;
    if (inscrito) l.inscritos++;
  });
  const siglasDe = (escola, turma) => {
    const e = normChave(escola);
    const t = compactoTurma(turma);
    return [...new Set((espacos || []).filter((b) => normChave(b.escola) === e && turmasDoBloco(b).some((x) => compactoTurma(x) === t)).flatMap((b) => b.siglasTreinadores || []))];
  };
  const turmas = Object.values(linhas)
    .map((l) => ({ ...l, siglas: siglasDe(l.escola, l.turma) }))
    .sort((a, b) => b.inscritos - a.inscritos || a.escola.localeCompare(b.escola, "pt") || a.turma.localeCompare(b.turma, "pt", { numeric: true }));
  const porSigla = {};
  turmas.forEach((l) =>
    (l.siglas.length ? l.siglas : ["(sem sigla)"]).forEach((s) => {
      const x = (porSigla[s] = porSigla[s] || { sigla: s, inscritos: 0, elegiveis: 0, turmas: 0 });
      x.inscritos += l.inscritos;
      x.elegiveis += l.elegiveis;
      x.turmas++;
    })
  );
  const treinadores = Object.values(porSigla).sort((a, b) => b.inscritos - a.inscritos || a.sigla.localeCompare(b.sigla));
  return { turmas, treinadores };
}

const pct = (a, b) => (b ? `${fmtNum((a / b) * 100, 1)}%` : "—");
const copiar = (lista) => navigator.clipboard && navigator.clipboard.writeText(lista.join("\n"));

function Codigos({ titulo, lista }) {
  if (!lista.length) return null;
  return (
    <details style={{ fontSize: 12.5, marginTop: 4 }}>
      <summary style={{ cursor: "pointer", color: COLORS.ink2 }}>
        {titulo} ({lista.length})
      </summary>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
        {lista.map((id) => (
          <span key={id} style={{ padding: "2px 6px", borderRadius: 5, background: COLORS.paperSunken }}>
            {id}
          </span>
        ))}
        <button type="button" onClick={() => copiar(lista)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
          Copiar códigos
        </button>
      </div>
    </details>
  );
}

const SUBS = Array.from({ length: 15 }, (_, i) => `Sub-${i + 5}`);

// Painel dentro de um evento aberto: tipo, escalão máximo, histórico entre épocas, externos e turmas/treinadores.
export function AnaliseAlunosEvento({ ev, eventos, registoAlunos, niveis = DEFAULT_NIVEIS, espacos, passa, onUpdate }) {
  const [verTurmas, setVerTurmas] = useState(false);
  const tipo = tipoDoEvento(ev);
  const edicoes = eventos.filter((o) => o.v === 2 && o.tipo !== "semanas" && chaveEvento(o.nome) === chaveEvento(ev.nome));
  const hist = edicoes.length > 1 ? historicoEventos(edicoes, registoAlunos, passa) : [];
  const conv = conversoes(ev, eventos, registoAlunos, niveis);
  const tt = turmasETreinadores(ev, registoAlunos, niveis, espacos, passa);
  const temIds = conv.ids.length > 0;
  const th = { ...thStyle, whiteSpace: "nowrap" };
  const num = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${COLORS.ruleSoft}`, paddingTop: 12, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Tipo
          <select value={tipo} onChange={(e) => onUpdate({ ...ev, tipoPublico: e.target.value })} style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12.5 }}>
            {TIPOS_EVENTO.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }} title="Quem passa este escalão na época seguinte já não pode participar (conta como 'saiu por idade')">
          Escalão máximo
          <select value={ev.escalaoMax || ""} onChange={(e) => onUpdate({ ...ev, escalaoMax: e.target.value || null })} style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12.5 }}>
            <option value="">sem limite</option>
            {SUBS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!temIds && <div style={{ fontSize: 12.5, color: COLORS.slate }}>O histórico, os externos e as turmas precisam do Excel com o código do atleta.</div>}

      {hist.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Histórico de {ev.nome.replace(/\s*\b(19|20)\d{2}.*$/, "")} entre épocas</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hist.map((h) => ({ name: `${h.de} → ${h.para}`, Repetiram: h.repetiram.length, Novos: h.novos.length, "Saíram por idade": h.porIdade.length, "Deixaram a DF": h.deixaramDF.length, "Não voltaram": h.outros.length }))} margin={{ left: -18, right: 8, top: 8 }}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
              <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.paperSunken }} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Bar dataKey="Repetiram" stackId="a" fill={COLORS.navy} isAnimationActive={false} />
              <Bar dataKey="Novos" stackId="a" fill={COLORS.ok} isAnimationActive={false} />
              <Bar dataKey="Saíram por idade" stackId="b" fill={COLORS.slate} isAnimationActive={false} />
              <Bar dataKey="Deixaram a DF" stackId="b" fill={COLORS.warn} isAnimationActive={false} />
              <Bar dataKey="Não voltaram" stackId="b" fill={COLORS.rule} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Épocas", "Antes", "Agora", "Repetiram", "Novos", "Saíram por idade", "Deixaram a DF", "Não voltaram", "Retorno*"].map((h, i) => (
                    <th key={h} style={{ ...th, textAlign: i ? "right" : "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hist.map((h) => (
                  <tr key={h.para}>
                    <td style={tdStyle}>
                      {h.de} → {h.para}
                    </td>
                    <td style={num}>{h.antes}</td>
                    <td style={num}>{h.agora}</td>
                    <td style={num}>{h.repetiram.length}</td>
                    <td style={num}>{h.novos.length}</td>
                    <td style={num}>{h.porIdade.length}</td>
                    <td style={num}>{h.deixaramDF.length}</td>
                    <td style={num}>{h.outros.length}</td>
                    <td style={{ ...num, fontWeight: 600 }}>{h.retorno === null ? "—" : `${fmtNum(h.retorno, 1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>
            * Retorno = repetiram ÷ (participantes da época anterior − saídos por idade). {ev.escalaoMax ? `Saem por idade os que na época seguinte passam de ${ev.escalaoMax} (pelo ano de nascimento).` : "Escolhe o escalão máximo para separar os que saíram por idade."}
          </div>
          {hist.slice(-1).map((h) => (
            <div key={h.para}>
              <Codigos titulo={`Repetiram em ${h.para}`} lista={h.repetiram} />
              <Codigos titulo={`Saíram por idade em ${h.para}`} lista={h.porIdade} />
              <Codigos titulo={`Deixaram a DF em ${h.para}`} lista={h.deixaramDF} />
              <Codigos titulo={`Não voltaram em ${h.para}`} lista={h.outros} />
            </div>
          ))}
        </div>
      )}

      {temIds && (tipo !== "interno" || conv.externos.length > 0) && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{tipo === "captacao" ? "Captação: para onde foram" : "Externos e conversão"}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatCard label="Externos" value={conv.externos.length} subtitle={`de ${conv.ids.length} participantes`} />
            <StatCard label="Outro evento" value={conv.outroEvento.length} subtitle={pct(conv.outroEvento.length, conv.externos.length)} />
            <StatCard label="Inscrição DF" value={conv.inscricao.length} subtitle={pct(conv.inscricao.length, conv.externos.length)} color={COLORS.ok} />
            <StatCard label="Extrainscrição" value={conv.extra.length} subtitle={pct(conv.extra.length, conv.externos.length)} color={COLORS.ok} />
            {tipo === "captacao" && <StatCard label="Para turmas" value={conv.paraTurmas.length} subtitle={pct(conv.paraTurmas.length, conv.externos.length)} />}
            {tipo === "captacao" && <StatCard label="Para equipas de competição" value={conv.paraEquipas.length + conv.subiramEquipa.length} subtitle={`${conv.paraEquipas.length} externos · ${conv.subiramEquipa.length} vindos de turmas DF`} color={COLORS.navy} />}
          </div>
          <Codigos titulo="Externos" lista={conv.externos} />
          <Codigos titulo="Foram a outro evento" lista={conv.outroEvento} />
          <Codigos titulo="Inscreveram-se" lista={conv.inscricao} />
          <Codigos titulo="Extrainscrição" lista={conv.extra} />
          {tipo === "captacao" && <Codigos titulo="Passaram de turma DF a equipa de competição" lista={conv.subiramEquipa} />}
        </div>
      )}

      {temIds && tt.turmas.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Inscritos por treinador e por turma</div>
          <div style={{ display: "grid", gap: 6, maxWidth: 520 }}>
            {tt.treinadores.slice(0, 12).map((t, i) => (
              <div key={t.sigla} style={{ display: "grid", gridTemplateColumns: "70px minmax(0,1fr) 110px", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                <strong>{t.sigla}</strong>
                <div style={{ height: 7, background: COLORS.paperSunken, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(t.inscritos / (tt.treinadores[0].inscritos || 1)) * 100}%`, background: i === 0 ? COLORS.navy : COLORS.navySoft, borderRadius: 4 }} />
                </div>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {t.inscritos} · {pct(t.inscritos, t.elegiveis)}
                </span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setVerTurmas((v) => !v)} style={{ ...linkBtnStyle, fontSize: 12.5 }}>
            {verTurmas ? "Esconder" : "Ver"} as {tt.turmas.length} turmas e equipas
          </button>
          {verTurmas && (
            <div style={{ overflowX: "auto", marginTop: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Escola", "Turma / equipa", "Treinador", "Elegíveis", "Inscritos", "Adesão"].map((h, i) => (
                      <th key={h} style={{ ...th, textAlign: i > 2 ? "right" : "left" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tt.turmas.map((l) => (
                    <tr key={`${l.escola}|${l.turma}`}>
                      <td style={tdStyle}>{l.escola.replace(/^Dragon Force\s+/, "")}</td>
                      <td style={tdStyle}>{l.turma}</td>
                      <td style={tdStyle}>{l.siglas.join(", ") || "—"}</td>
                      <td style={num}>{l.elegiveis}</td>
                      <td style={num}>{l.inscritos}</td>
                      <td style={{ ...num, fontWeight: 600 }}>{pct(l.inscritos, l.elegiveis)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>O treinador vem das siglas nos Espaços (turma no mesmo horário da escola). Uma turma com dois treinadores conta para os dois.</div>
        </div>
      )}
    </div>
  );
}

// Autoverificação com dados sintéticos (só em desenvolvimento).
if (import.meta.env && import.meta.env.DEV) {
  const reg = {
    "2024/25": { alunos: { 1: { id: "1", escola: "A", turma: "Sub-11 A", ano: 2014, estado: "ativo" }, 2: { id: "2", escola: "A", turma: "Básico B1", ano: 2012, estado: "ativo" }, 3: { id: "3", escola: "A", turma: "Básico B1", ano: 2015, estado: "ativo" } } },
    "2025/26": { alunos: { 1: { id: "1", escola: "A", turma: "Sub-12 A", ano: 2014, estado: "ativo" }, 9: { id: "9", escola: "A", turma: "Sub-13 A", ano: 2013, estado: "ativo", entrada: "2025-09-10", rubrica: "novo" } } },
  };
  const e1 = { id: "a", v: 2, nome: "Torneio das Lendas 2024", data: "2025-03-01", escalaoMax: "Sub-13", participantes: { ids: ["1", "2", "3"] } };
  const e2 = { id: "b", v: 2, nome: "Torneio das Lendas 2025", data: "2026-03-01", participantes: { ids: ["1", "7"] } };
  const [h] = historicoEventos([e1, e2], reg);
  console.assert(subDeAno(2013, "2025/26") === 13, "subDeAno");
  console.assert(h.repetiram.join() === "1" && h.novos.join() === "7" && h.porIdade.join() === "2" && h.deixaramDF.join() === "3", "historicoEventos", h);
  const camp = { id: "c", v: 2, nome: "Foot Camp", data: "2025-07-10", participantes: { ids: ["1", "9"] } };
  const c = conversoes(camp, [camp, e2], reg, DEFAULT_NIVEIS);
  console.assert(c.externos.join() === "9" && c.inscricao.join() === "9" && c.paraEquipas.join() === "9", "conversoes", c);
}
