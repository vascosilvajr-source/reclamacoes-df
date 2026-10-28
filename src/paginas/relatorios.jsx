// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import React, { useState, useEffect } from "react";
import { LOGO_BRANCO } from "../imagens";
import { FileText, Printer } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ReferenceLine, AreaChart, Area, LabelList } from "recharts";
import { CANAL_META, COLORS, DEFAULT_NIVEIS, MOTIVO_META, SEVERITY_META, STATUS_META, alunosNaData, capacidadeSugerida, classificarCrescimento, ehEscolinha, epAntDe, epocaAud, epocaDaSemanaISO, epocaDe, escalaoDaTurma, fimEpocaISO, fmt, inputStyle, isoDe, labelStyle, nomeOcorrencia, panelStyle, preverEscola, satisfacaoDe, semanaLabel } from "../nucleo.jsx";
import { BarrasRel, CLASSIFICATION_META, DF_STAGE_META, DicaGrafico, FiltroEpocas, MESES_EPOCA, MES_CURTO, PERSON_TYPE_META, REL_AZUL2, SemDados, TickEixoX, TickNome, ambitoAud, azulRel, corSatisfacao, fmtNum, itensCausa, mesDeData, npsDe, observacoesAuditorias, observacoesReclamacoes, pct } from "../partilhado.jsx";

function audNoPeriodo(periodo, a) {
  if (periodo.startsWith("epoca:")) return epocaAud(a) === periodo.slice(6);
  if (periodo === "tudo") return true;
  return dentroPeriodo(periodo, a.date);
}

// ======================================================================
// ---------- Relatório de escola ----------
// ======================================================================
// Junta, para uma escola e um período, tudo o que a app sabe: reclamações,
// auditorias, inscritos, movimentos, satisfação e sanções. Compara sempre
// com a média das restantes escolas e normaliza por cada 100 alunos.

const SECCOES_RELATORIO = [
  { key: "resumo", label: "Resumo e comparação" },
  { key: "reclamacoes", label: "Reclamações" },
  { key: "auditorias", label: "Auditorias" },
  { key: "inscritos", label: "Inscritos e turmas" },
  { key: "movimentos", label: "Desistências, experiências e desvinculações" },
  { key: "satisfacao", label: "Satisfação e inquéritos" },
  { key: "avaliacoes", label: "Avaliações do staff" },
  { key: "causas", label: "Causa raiz" },
  { key: "sancoes", label: "Sanções" },
  { key: "acompanhar", label: "Pontos a acompanhar" },
  { key: "notas", label: "Notas e conclusões" },
];

const PERIODOS_FIXOS = [
  ["dias:30", "Últimos 30 dias"],
  ["dias:90", "Últimos 90 dias"],
  ["dias:365", "Últimos 12 meses"],
  ["tudo", "Todo o histórico"],
];

// Período à escolha: "intervalo:aaaa-mm-dd:aaaa-mm-dd" (ex.: um trimestre).
const intervaloDe = (periodo) => {
  const [, ini, fim] = String(periodo).split(":");
  return { ini, fim };
};
const umAnoAntesISO = (iso) => {
  const x = new Date(String(iso).slice(0, 10) + "T00:00:00");
  x.setFullYear(x.getFullYear() - 1);
  return isoDe(x);
};
const dataCurtaISO = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

function dentroPeriodo(periodo, data) {
  if (!data) return false;
  const d = String(data).slice(0, 10);
  if (periodo === "tudo") return true;
  if (periodo.startsWith("intervalo:")) {
    const { ini, fim } = intervaloDe(periodo);
    return d >= ini && d <= fim;
  }
  if (periodo.startsWith("epoca:")) return epocaDe(d) === periodo.slice(6);
  if (periodo.startsWith("dias:")) {
    const lim = new Date();
    lim.setDate(lim.getDate() - Number(periodo.slice(5)));
    return new Date(d + "T00:00:00") >= lim;
  }
  return true;
}

// O mesmo período, um ano antes: para comparar com a época passada.
function noPeriodoHomologo(periodo, data) {
  if (!data) return false;
  const d = String(data).slice(0, 10);
  const umAnoDepois = (iso) => {
    const x = new Date(iso + "T00:00:00");
    x.setFullYear(x.getFullYear() + 1);
    return x;
  };
  if (periodo.startsWith("epoca:")) {
    const ano = Number(periodo.slice(6, 10));
    if (epocaDe(d) !== `${ano - 1}/${String(ano).slice(2)}`) return false;
    // Época em curso: só até à mesma data do ano passado.
    return epocaDe(isoDe(new Date())) === periodo.slice(6) ? umAnoDepois(d) <= new Date() : true;
  }
  if (periodo.startsWith("intervalo:")) {
    const { ini, fim } = intervaloDe(periodo);
    return d >= umAnoAntesISO(ini) && d <= umAnoAntesISO(fim);
  }
  if (periodo.startsWith("dias:")) {
    const fim = new Date();
    fim.setFullYear(fim.getFullYear() - 1);
    const ini = new Date(fim);
    ini.setDate(ini.getDate() - Number(periodo.slice(5)));
    const x = new Date(d + "T00:00:00");
    return x >= ini && x <= fim;
  }
  return false;
}

function nomeHomologo(periodo) {
  if (periodo.startsWith("epoca:")) {
    const ano = Number(periodo.slice(6, 10));
    return `${ano - 1}/${String(ano).slice(2)}`;
  }
  if (periodo.startsWith("dias:")) return "há um ano";
  if (periodo.startsWith("intervalo:")) {
    const { ini, fim } = intervaloDe(periodo);
    return `${dataCurtaISO(umAnoAntesISO(ini))} a ${dataCurtaISO(umAnoAntesISO(fim))}`;
  }
  return null;
}

function nomePeriodo(periodo) {
  if (periodo.startsWith("epoca:")) return `Época ${periodo.slice(6)}`;
  if (periodo.startsWith("intervalo:")) {
    const { ini, fim } = intervaloDe(periodo);
    return `${dataCurtaISO(ini)} a ${dataCurtaISO(fim)}`;
  }
  const f = PERIODOS_FIXOS.find(([k]) => k === periodo);
  return f ? f[1] : periodo;
}
const por100 = (n, alunos) => (alunos ? Math.round((n / alunos) * 1000) / 10 : null);
const ordinal = (n) => `${n}.º`;

// Época a que um período se refere: a escolhida, ou a atual para "últimos dias" e "tudo".
const epocaDoPeriodo = (periodo) => (periodo.startsWith("epoca:") ? periodo.slice(6) : epocaDe(dataRefPeriodo(periodo)));
// Data a que se contam os alunos do período: o fim da época (passada), o fim do intervalo, ou hoje.
function dataRefPeriodo(periodo) {
  const hoje = isoDe(new Date());
  if (periodo.startsWith("epoca:")) {
    const fim = fimEpocaISO(periodo.slice(6));
    return fim < hoje ? fim : hoje;
  }
  if (periodo.startsWith("intervalo:")) {
    const { fim } = intervaloDe(periodo);
    return fim && fim < hoje ? fim : hoje;
  }
  return hoje;
}

// Alunos no fim do período e no mesmo dia da época passada (mesmo período).
// Se nesse dia a época passada tinha menos de metade dos alunos com que acabou (listas carregadas
// mais tarde), essa base não é fiável: compara com o fim da época passada e diz isso.
function alunosComparados(e, periodo, d) {
  const ref = dataRefPeriodo(periodo);
  const ep = epocaDe(ref);
  const epAnt = epAntDe(ep);
  const reg = (d.registoAlunos || {})[ep];
  const regAnt = (d.registoAlunos || {})[epAnt];
  const daEscola = (a) => !e || a.escola === e;
  const atual = reg && Object.keys(reg.alunos || {}).length ? alunosNaData(reg, ref).filter(daEscola).length : null;
  const refAnt = umAnoAntesISO(ref);
  if (!regAnt || !Object.keys(regAnt.alunos || {}).length) {
    const ant = e ? alunosEpocaAnterior(e, periodo, d) : null;
    return { atual, ant, base: ant ? "fim" : null, refAnt, epAnt };
  }
  const fimAnt = Object.values(regAnt.alunos).filter((a) => daEscola(a) && a.estado === "ativo").length;
  const homo = alunosNaData(regAnt, refAnt).filter(daEscola).length;
  if (fimAnt && homo < fimAnt * 0.5 && refAnt < fimEpocaISO(epAnt)) return { atual, ant: fimAnt, base: "fim", refAnt, epAnt };
  return { atual, ant: homo || null, base: homo ? "homologo" : null, refAnt, epAnt };
}
const textoBaseAnt = (c) => (!c || !c.ant ? null : c.base === "homologo" ? `${fmtNum(c.ant)} a ${dataCurtaISO(c.refAnt)} (${c.epAnt})` : `${fmtNum(c.ant)} no fim de ${c.epAnt} (sem dados completos do mesmo período)`);

// Turmas de uma escola na época do período, no formato das turmas da app
// ({ turma, m, f, cap, renov, novos, extra }). Vêm do registo de alunos dessa época;
// sem registo, só a época atual usa as turmas atuais (uma época passada fica sem dados).
function turmasDoPeriodo(e, periodo, d) {
  const ep = epocaDoPeriodo(periodo);
  const reg = (d.registoAlunos || {})[ep];
  const atuais = d.turmasAlunos.filter((t) => t.escola === e);
  const alunosReg = reg ? Object.values(reg.alunos || {}).filter((a) => a.escola === e) : [];
  if (alunosReg.length) {
    const cap = Object.fromEntries(atuais.filter((t) => t.cap).map((t) => [t.turma, t.cap]));
    const por = {};
    alunosReg.forEach((a) => {
      const x = (por[a.turma || "Sem turma"] = por[a.turma || "Sem turma"] || { escola: e, turma: a.turma || "Sem turma", m: 0, f: 0, renov: 0, novos: 0, extra: 0, cap: cap[a.turma] || null });
      if (a.rubrica === "renov") x.renov++;
      else if (a.rubrica === "extra") x.extra++;
      else x.novos++;
      if (a.estado !== "ativo") return;
      if (a.genero === "f") x.f++;
      else x.m++;
    });
    return { fonte: "registo", ep, turmas: Object.values(por) };
  }
  if (ep !== epocaDe(isoDe(new Date()))) return { fonte: "sem", ep, turmas: [] };
  return { fonte: "atual", ep, turmas: atuais };
}

// Alunos de uma escola na época anterior à do período.
function alunosEpocaAnterior(e, periodo, d) {
  const ep = epocaDoPeriodo(periodo);
  const regAnt = (d.registoAlunos || {})[epAntDe(ep)];
  const n = regAnt ? Object.values(regAnt.alunos || {}).filter((a) => a.escola === e && a.estado === "ativo").length : 0;
  if (n) return n;
  return ep === epocaDe(isoDe(new Date())) ? (d.epocaAnterior[e] || {}).inscritos || null : null;
}

// Uma constatação estava em aberto no fim do período (época) ou está em aberto hoje.
function abertaNoFim(f, a, periodo) {
  if (periodo.startsWith("intervalo:")) {
    const { fim } = intervaloDe(periodo);
    if (a.date && a.date > fim) return false;
    return !f.resolvida || (f.resolvidaEm && String(f.resolvidaEm).slice(0, 10) > fim);
  }
  if (periodo.startsWith("epoca:")) {
    const ep = periodo.slice(6);
    if (epocaAud(a) > ep) return false;
    const fim = `${Number(ep.slice(0, 4)) + 1}-07-31`;
    return !f.resolvida || (f.resolvidaEm && String(f.resolvidaEm).slice(0, 10) > fim);
  }
  return !f.resolvida;
}

// Métricas de uma escola, usadas para o relatório e para a comparação com as outras.
function metricasEscola(e, periodo, d) {
  const tp = turmasDoPeriodo(e, periodo, d);
  const turmas = tp.turmas;
  const alunosTurmas = turmas.reduce((n, t) => n + t.m + t.f, 0);
  const serie = [...(d.inscritos[e] || [])].filter((x) => epocaDaSemanaISO(x.semana) === tp.ep).sort((a, b) => a.semana.localeCompare(b.semana));
  const cmp = alunosComparados(e, periodo, d);
  // Num intervalo que já acabou, os alunos são os desse dia.
  const alunos = periodo.startsWith("intervalo:") && cmp.atual !== null ? cmp.atual : alunosTurmas || (serie.length ? serie[serie.length - 1].total : tp.fonte === "sem" ? null : 0);
  const ant = cmp.ant;
  const alunosRef = cmp.atual !== null ? cmp.atual : alunos;

  const recl = d.reclamacoes.filter((r) => r.school === e && dentroPeriodo(periodo, r.receivedDate));
  const resolvidas = recl.filter((r) => r.status === "concluido" && r.resolvedDate);
  const noPrazo = resolvidas.filter((r) => new Date(r.resolvedDate) <= new Date(r.deadline)).length;

  const ncAbertas = d.audits
    .filter((a) => a.school === e)
    .flatMap((a) => (a.findings || []).filter((f) => abertaNoFim(f, a, periodo)))
    .filter((f) => f.classification === "NC" || f.classification === "NCM").length;

  const sat = d.satisfacao.filter((s) => s.escola === e && dentroPeriodo(periodo, `${s.periodo}-15`));
  let pesoSat = 0;
  let somaSat = 0;
  sat.forEach((s) => {
    const vs = Object.values(s.valores || {}).filter((v) => v !== null && !isNaN(v));
    if (!vs.length) return;
    const m = vs.reduce((a, b) => a + b, 0) / vs.length;
    somaSat += m * (s.respostas || 1);
    pesoSat += s.respostas || 1;
  });
  // Inquéritos de eventos com esta escola como segmento.
  let nInq = 0;
  let satInq = 0;
  d.inqueritos
    .filter((i) => dentroPeriodo(periodo, i.data) && i.segmentos && i.segmentos[e])
    .forEach((i) => {
      const s = satisfacaoDe(i.perguntas || [], e);
      if (s.n) {
        nInq += s.n;
        satInq += (s.pct / 100) * s.n;
      }
    });
  const satisfacaoPct = pesoSat ? Math.round(somaSat / pesoSat) : nInq ? Math.round((satInq / nInq) * 100) : null;

  const desist = d.desistencias.filter((x) => x.escola === e && dentroPeriodo(periodo, x.data)).reduce((n, x) => n + x.n, 0);
  const xp = d.experiencias.filter((x) => x.escola === e && dentroPeriodo(periodo, x.data));
  const xpSuc = xp.filter((x) => x.resultado === "sucesso").reduce((n, x) => n + x.n, 0);
  const xpAval = xp.filter((x) => x.resultado !== "pendente").reduce((n, x) => n + x.n, 0);

  const comRubrica = turmas.reduce((n, t) => n + (t.renov || 0) + (t.novos || 0) + (t.extra || 0), 0);
  return {
    alunos,
    ant,
    fonteAlunos: tp.fonte,
    renovPct: comRubrica ? Math.round((turmas.reduce((n, t) => n + (t.renov || 0), 0) / comRubrica) * 100) : null,
    novos: comRubrica ? turmas.reduce((n, t) => n + (t.novos || 0), 0) : null,
    crescimento: ant && alunosRef ? Math.round(((alunosRef - ant) / ant) * 1000) / 10 : null,
    cmp,
    desist,
    reclamacoes: recl.length,
    reclPor100: por100(recl.length, alunos),
    prazo: pct(noPrazo, resolvidas.length),
    ncAbertas,
    satisfacao: satisfacaoPct,
    desistPct: alunos ? Math.round((desist / alunos) * 1000) / 10 : null,
    conversao: pct(xpSuc, xpAval),
  };
}

// Que métricas entram na comparação e em que sentido é melhor.
const METRICAS_COMP = [
  { key: "crescimento", label: "Crescimento face ao mesmo período da época passada", unidade: "%", melhor: "alto", limiar: 3 },
  { key: "reclPor100", label: "Reclamações por 100 alunos", unidade: "", melhor: "baixo", limiar: 0.5, dec: 1 },
  { key: "prazo", label: "Reclamações resolvidas no prazo", unidade: "%", melhor: "alto", limiar: 8 },
  { key: "ncAbertas", label: "Não conformidades em aberto", unidade: "", melhor: "baixo", limiar: 1 },
  { key: "satisfacao", label: "Satisfação", unidade: "%", melhor: "alto", limiar: 5 },
  { key: "desistPct", label: "Taxa de desistência", unidade: "%", melhor: "baixo", limiar: 1, dec: 1 },
  { key: "conversao", label: "Conversão de experiências", unidade: "%", melhor: "alto", limiar: 8 },
];

// Identidade do relatório: papel branco, azul institucional, tipografia serifada
// nos títulos e números. Sóbrio, ao estilo de um relatório de clube.
const REL_AZUL = "#0B2A5B";
// Títulos e números dos relatórios: Sora (geométrica, algarismos fortes). Texto: Manrope.
const REL_SERIFA = "'Sora', 'Manrope', 'Inter', system-ui, sans-serif";
const REL_VERDE = "#1E7A4C";
// Sem vermelho na app: o "mau" é laranja.
const REL_VERMELHO = "#C2570C";

// Logótipo DF na cor que se quiser (o ficheiro é branco; usa-se como máscara).
function LogoRel({ altura = 44, cor = REL_AZUL }) {
  return (
    <span
      role="img"
      aria-label="Dragon Force"
      style={{
        display: "inline-block",
        height: altura,
        width: altura * 0.83,
        background: cor,
        WebkitMaskImage: `url(${LOGO_BRANCO})`,
        maskImage: `url(${LOGO_BRANCO})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        flex: "none",
      }}
    />
  );
}

const corRel = (cor) => (cor === COLORS.ok ? REL_VERDE : cor === COLORS.danger ? REL_VERMELHO : cor === COLORS.warn ? "#9A6200" : null);

function KpiRel({ label, valor, unidade, comparacao, cor, extra }) {
  const destaque = cor && cor !== COLORS.ink && cor !== COLORS.slate ? corRel(cor) || cor : null;
  return (
    <div className="relKpi">
      <div className="relRotulo">{label}</div>
      <div style={{ fontFamily: REL_SERIFA, fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em", color: destaque || COLORS.ink, marginTop: 6, lineHeight: 1, fontVariantNumeric: "lining-nums tabular-nums" }}>
        {valor}
        {valor !== "—" && unidade ? <span style={{ fontSize: 16, fontWeight: 500, marginLeft: 2 }}>{unidade}</span> : null}
      </div>
      {comparacao && <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 7, lineHeight: 1.45 }}>{comparacao}</div>}
      {extra}
    </div>
  );
}

function SeccaoRel({ titulo, nota, children }) {
  return (
    <section className="relSeccao" style={{ marginTop: 46 }}>
      <div className="relSeccaoTopo" style={{ display: "flex", alignItems: "baseline", gap: 14, paddingBottom: 10, marginBottom: 20, borderBottom: `1px solid ${COLORS.ink}` }}>
        <span className="relNum" style={{ fontFamily: REL_SERIFA, fontSize: 15, fontWeight: 600, color: azulRel(), fontVariantNumeric: "lining-nums tabular-nums", minWidth: 22 }} />
        <h3 style={{ margin: 0, fontFamily: REL_SERIFA, fontSize: 24, fontWeight: 600, color: COLORS.ink, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{titulo}</h3>
        {nota && <div style={{ marginLeft: "auto", fontSize: 11.5, color: COLORS.slate, textAlign: "right", maxWidth: 380 }}>{nota}</div>}
      </div>
      {children}
    </section>
  );
}

// Uma linha do quadro de comparação: valor, posição entre as escolas e diferença para a média.
function LinhaComparacaoRel({ c, comparar }) {
  const tom = !comparar || !c.estado || c.estado === "igual" ? COLORS.ink : c.estado === "melhor" ? REL_VERDE : REL_VERMELHO;
  const n = c.p ? c.p.de : 0;
  const dif = c.v !== null && c.v !== undefined && c.med !== null ? c.v - c.med : null;
  const unidadeDif = c.unidade === "%" ? " p.p." : "";
  const texto =
    dif === null || !comparar
      ? null
      : c.estado === "igual"
      ? "Em linha com a média"
      : `${dif > 0 ? "+" : "−"}${fmtNum(Math.abs(dif), c.dec ?? (c.unidade === "%" ? 0 : 1))}${unidadeDif} ${dif > 0 ? "acima" : "abaixo"} da média`;
  return (
    <tr className="relLinhaComp">
      <td style={{ padding: "13px 0", fontSize: 13, color: COLORS.ink }}>{c.label}</td>
      <td style={{ padding: "13px 12px", textAlign: "right", fontFamily: REL_SERIFA, fontSize: 22, fontWeight: 600, color: tom, fontVariantNumeric: "lining-nums tabular-nums", whiteSpace: "nowrap" }}>
        {fmtNum(c.v, c.dec ?? 0)}
        {c.v !== null && c.v !== undefined && c.unidade ? <span style={{ fontSize: 14, fontWeight: 500 }}>{c.unidade}</span> : null}
      </td>
      <td style={{ padding: "13px 12px", width: 190 }}>
        {comparar && c.p && n > 1 ? (
          <div>
            <div style={{ position: "relative", height: 12 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 5.5, height: 1, background: COLORS.rule }} />
              {Array.from({ length: n }).map((_, i) => {
                const eu = i + 1 === c.p.pos;
                const tam = eu ? 12 : 6;
                return (
                  <span
                    key={i}
                    style={{
                      position: "absolute",
                      left: `calc(${(i / (n - 1)) * 100}% - ${tam / 2}px)`,
                      top: 6 - tam / 2,
                      width: tam,
                      height: tam,
                      borderRadius: "50%",
                      background: eu ? azulRel() : COLORS.paperRaised,
                      border: eu ? "none" : `1px solid ${COLORS.slate}`,
                      boxSizing: "border-box",
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.slate, marginTop: 5, letterSpacing: "0.02em" }}>
              <span>1.º</span>
              <span style={{ color: COLORS.ink, fontWeight: 600 }}>
                {ordinal(c.p.pos)} de {n}
              </span>
              <span>{ordinal(n)}</span>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: COLORS.slate }}>{c.v === null || c.v === undefined ? "Sem dados" : ""}</span>
        )}
      </td>
      <td style={{ padding: "13px 0", textAlign: "right", fontSize: 12, fontWeight: 600, color: c.estado === "igual" ? COLORS.slate : tom, whiteSpace: "nowrap", width: 170 }}>{texto}</td>
    </tr>
  );
}

// Variação face a outro valor. "bom" diz para que lado é bom subir.
function VariacaoRel({ atual, anterior, bom = "alto", rotulo }) {
  if (atual === null || atual === undefined || anterior === null || anterior === undefined) return null;
  const dif = atual - anterior;
  const positivo = bom === "alto" ? dif > 0 : dif < 0;
  const cor = dif === 0 ? COLORS.slate : positivo ? REL_VERDE : REL_VERMELHO;
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: cor, marginTop: 6 }}>
      {dif === 0 ? "Igual" : `${dif > 0 ? "+" : "−"}${fmtNum(Math.abs(dif))}`} {rotulo}
    </div>
  );
}

// Uma barra dividida em partes, com legenda.
function BarraPartesRel({ partes, total }) {
  const soma = total ?? partes.reduce((n, p) => n + (p.valor || 0), 0);
  if (!soma) return <div className="relVazio">Sem registos no período.</div>;
  return (
    <div>
      <div style={{ display: "flex", height: 8, background: COLORS.ruleSoft, gap: 2 }}>
        {partes
          .filter((p) => p.valor > 0)
          .map((p) => (
            <div key={p.label} title={`${p.label}: ${p.valor}`} style={{ width: `${(p.valor / soma) * 100}%`, background: p.cor }} />
          ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 10 }}>
        {partes.map((p) => (
          <div key={p.label} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, background: p.cor, alignSelf: "center" }} />
            <span style={{ color: COLORS.ink2 }}>{p.label}</span>
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{p.valor}</strong>
            <span style={{ color: COLORS.slate }}>{Math.round((p.valor / soma) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Ocupação de cada turma: alunos face à capacidade.
function LotacaoRel({ lotacao }) {
  if (!lotacao.length) return <div className="relVazio">Sem turmas registadas.</div>;
  const corDe = (p) => (p >= 95 ? "#9A6200" : p < 50 ? COLORS.slate : azulRel());
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "9px 26px" }}>
      {lotacao.map((t) => (
        <div key={t.turma} style={{ display: "grid", gridTemplateColumns: "86px 1fr 44px", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: COLORS.ink2 }}>{t.turma}</span>
          <div style={{ height: 5, background: COLORS.ruleSoft }}>
            <div style={{ width: `${Math.min(100, t.pct || 0)}%`, height: "100%", background: corDe(t.pct || 0) }} />
          </div>
          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: t.pct >= 95 ? "#9A6200" : COLORS.ink, fontWeight: t.pct >= 95 ? 700 : 500 }}>
            {t.n}/{t.cap || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// Indicador de percentagem em anel fino.
function AnelRel({ valor, rotulo, cor, tamanho = 88 }) {
  const r = tamanho / 2 - 4;
  const c = 2 * Math.PI * r;
  const v = valor === null || valor === undefined ? null : Math.max(0, Math.min(100, valor));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: tamanho, height: tamanho, flex: "none" }}>
        <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden="true">
          <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={COLORS.ruleSoft} strokeWidth="3" />
          {v !== null && <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={corRel(cor) || cor || azulRel()} strokeWidth="3" strokeDasharray={`${(c * v) / 100} ${c}`} transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`} />}
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: REL_SERIFA, fontSize: 24, fontWeight: 600, color: COLORS.ink, fontVariantNumeric: "lining-nums" }}>
          {v === null ? "—" : `${Math.round(v)}%`}
        </div>
      </div>
      {rotulo && <div style={{ fontSize: 12, color: COLORS.ink2, lineHeight: 1.5 }}>{rotulo}</div>}
    </div>
  );
}

// "O que salta à vista", em versão de documento.
function DestaquesRel({ itens }) {
  if (!itens || !itens.length) return null;
  const ordem = { alarme: 0, atencao: 1, bom: 2 };
  const cor = { alarme: REL_VERMELHO, atencao: "#9A6200", bom: REL_VERDE };
  return (
    <div style={{ marginTop: 26 }}>
      <div className="relRotulo" style={{ marginBottom: 6 }}>Em destaque</div>
      {[...itens]
        .sort((a, b) => (ordem[a.nivel] ?? 1) - (ordem[b.nivel] ?? 1))
        .map((o, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "10px 1fr", gap: 12, padding: "10px 0", borderBottom: `1px solid ${COLORS.ruleSoft}` }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: cor[o.nivel] || COLORS.slate, marginTop: 7 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{o.titulo}</div>
              <div style={{ fontSize: 12, color: COLORS.ink2, marginTop: 2, lineHeight: 1.5 }}>{o.texto}</div>
            </div>
          </div>
        ))}
    </div>
  );
}

function TabelaRel({ colunas, linhas, vazio }) {
  if (!linhas.length) return <div className="relVazio">{vazio}</div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="relTabela" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c} className="relRotulo" style={{ textAlign: "left", padding: "0 10px 8px 0", borderBottom: `1px solid ${COLORS.ink}`, whiteSpace: "nowrap" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>
              {l.map((v, j) => (
                <td key={j} style={{ padding: "9px 10px 9px 0", borderBottom: `1px solid ${COLORS.ruleSoft}`, verticalAlign: "top", fontVariantNumeric: "tabular-nums", lineHeight: 1.45, color: COLORS.ink }}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const contar = (lista, chave) => {
  const c = {};
  lista.forEach((x) => {
    const k = typeof chave === "function" ? chave(x) : x[chave];
    if (k) c[k] = (c[k] || 0) + (x.__peso || 1);
  });
  return Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
};

const LS_RELATORIO = "df-relatorio-seccoes-v3";

// ======================================================================
// ---------- Relatório geral Dragon Force (todas as escolas) ----------
// ======================================================================

const SECCOES_GERAL = [
  { key: "epocas", label: "Evolução entre épocas" },
  { key: "momentos", label: "Ao longo da época" },
  { key: "escolas", label: "Escolas lado a lado" },
  { key: "auditorias", label: "Auditorias" },
  { key: "reclamacoes", label: "Reclamações" },
  { key: "satisfacao", label: "Satisfação" },
  { key: "causas", label: "Causa raiz" },
  { key: "acompanhar", label: "Pontos a acompanhar" },
  { key: "notas", label: "Notas e conclusões" },
];
const LS_REL_GERAL = "df-relatorio-geral-seccoes";

const diasEntreRel = (a, b) => Math.round((new Date(String(b).slice(0, 10) + "T00:00:00") - new Date(String(a).slice(0, 10) + "T00:00:00")) / 86400000);
const mediaDe = (vs) => (vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : null);

// Indicadores da rede numa época. "ate" (opcional) corta na mesma data do ano.
function indicadoresEpoca(ep, d, ate) {
  const dentro = (data) => {
    if (!data) return false;
    const x = String(data).slice(0, 10);
    if (epocaDe(x) !== ep) return false;
    return ate ? x <= ate : true;
  };
  const recl = d.reclamacoes.filter((r) => dentro(r.receivedDate));
  const res = recl.filter((r) => r.status === "concluido" && r.resolvedDate);
  const visitas = d.audits.filter((a) => epocaAud(a) === ep && (ate ? !a.date || a.date <= ate : true));
  const constat = visitas.flatMap((a) => (a.findings || []).map((f) => ({ ...f, data: a.date })));
  const fechadas = constat.filter((f) => f.resolvida && !f.fechoEpoca);
  const temposFecho = fechadas.filter((f) => f.resolvidaEm).map((f) => diasEntreRel(f.data, f.resolvidaEm)).filter((x) => x >= 0);
  const inq = d.inqueritos.filter((i) => dentro(i.data));
  const sat = inq.length ? satisfacaoDe(inq.flatMap((i) => i.perguntas || [])).pct : null;
  const nps = inq.length ? npsDe(inq) : null;
  const porCls = (c) => constat.filter((f) => f.classification === c).length;
  const comPrazo = fechadas.filter((f) => f.prazo && f.resolvidaEm);
  const avaliadas = fechadas.filter((f) => f.eficacia);
  return {
    fechoNoPrazo: comPrazo.length ? Math.round((comPrazo.filter((f) => f.resolvidaEm <= f.prazo).length / comPrazo.length) * 100) : null,
    eficazes: avaliadas.length ? Math.round((avaliadas.filter((f) => f.eficacia === "eficaz").length / avaliadas.length) * 100) : null,
    recl: recl.length,
    prazo: res.length ? Math.round((res.filter((r) => new Date(r.resolvedDate) <= new Date(r.deadline)).length / res.length) * 100) : null,
    tempoResp: res.length ? Math.round(mediaDe(res.map((r) => diasEntreRel(r.receivedDate, r.resolvedDate)))) : null,
    visitas: visitas.length,
    constat: constat.length,
    NCM: porCls("NCM"),
    NC: porCls("NC"),
    OM: porCls("OM"),
    AS: porCls("AS"),
    porVisita: visitas.length ? Math.round((constat.length / visitas.length) * 10) / 10 : null,
    fechoEpoca: constat.filter((f) => f.fechoEpoca).length,
    fechadasPct: constat.length ? Math.round((fechadas.length / constat.length) * 100) : null,
    tempoFecho: temposFecho.length ? Math.round(mediaDe(temposFecho)) : null,
    sancoes: d.sanctions.filter((s) => dentro(s.date)).length,
    satisfacao: sat,
    nps: nps ? nps.valor : null,
    inqueritos: inq.length,
    desistencias: d.desistencias.filter((x) => dentro(x.data)).reduce((n, x) => n + x.n, 0),
  };
}

const LINHAS_EPOCA = [
  { k: "recl", label: "Reclamações recebidas", bom: "baixo", grupo: "Reclamações" },
  { k: "prazo", label: "Resolvidas no prazo", un: "%", bom: "alto", grupo: "Reclamações" },
  { k: "tempoResp", label: "Tempo médio de resposta", un: " dias", bom: "baixo", grupo: "Reclamações" },
  { k: "visitas", label: "Visitas de auditoria", grupo: "Auditorias" },
  { k: "constat", label: "Constatações", bom: "baixo", grupo: "Auditorias" },
  { k: "NCM", label: "Não conformidades maiores", bom: "baixo", grupo: "Auditorias", sub: true },
  { k: "NC", label: "Não conformidades", bom: "baixo", grupo: "Auditorias", sub: true },
  { k: "OM", label: "Oportunidades de melhoria", grupo: "Auditorias", sub: true },
  { k: "AS", label: "Áreas sensíveis", bom: "baixo", grupo: "Auditorias", sub: true },
  { k: "porVisita", label: "Constatações por visita", bom: "baixo", dec: 1, grupo: "Auditorias" },
  { k: "fechadasPct", label: "Fechadas durante a época", un: "%", bom: "alto", grupo: "Auditorias" },
  { k: "fechoEpoca", label: "Encerradas na passagem de época", bom: "baixo", grupo: "Auditorias", sub: true },
  { k: "tempoFecho", label: "Tempo médio de fecho", un: " dias", bom: "baixo", grupo: "Auditorias" },
  { k: "fechoNoPrazo", label: "Fechadas dentro do prazo", un: "%", bom: "alto", grupo: "Auditorias" },
  { k: "eficazes", label: "Ações eficazes", un: "%", bom: "alto", grupo: "Auditorias" },
  { k: "satisfacao", label: "Satisfação nos eventos", un: "%", bom: "alto", grupo: "Satisfação e disciplina" },
  { k: "nps", label: "NPS dos eventos", bom: "alto", grupo: "Satisfação e disciplina" },
  { k: "sancoes", label: "Ocorrências disciplinares", bom: "baixo", grupo: "Satisfação e disciplina" },
  { k: "desistencias", label: "Desistências registadas", bom: "baixo", grupo: "Satisfação e disciplina" },
];

function RelatorioGeral({ escolas, periodo, comparar, dados, niveis, notas, onGuardarNota, seccoes, epocasComparar }) {
  const { reclamacoes, audits, sanctions, inscritos, turmasAlunos, epocaAnterior, desistencias, experiencias, satisfacao, inqueritos } = dados;
  const ver = (k) => seccoes.has(k);
  const hoje = isoDe(new Date());
  const epocaAtual = epocaDe(hoje);
  const chaveNota = `__geral__|${periodo}`;
  const [nota, setNota] = useState(notas[chaveNota] || "");
  useEffect(() => setNota(notas[chaveNota] || ""), [chaveNota]); // eslint-disable-line react-hooks/exhaustive-deps
  const geradoEm = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  // ---- Épocas com dados (no máximo as três mais recentes) ----
  const todasEpocas = [...new Set([epocaAtual, ...reclamacoes.map((r) => epocaDe(r.receivedDate)), ...audits.map((a) => epocaAud(a)), ...inqueritos.map((i) => epocaDe(i.data))].filter(Boolean))]
    .filter((e) => e <= epocaAtual)
    .sort();
  // As épocas escolhidas em "Comparar épocas"; sem escolha, as três mais recentes.
  const epocas = epocasComparar && epocasComparar.length >= 2 ? [...epocasComparar].sort() : todasEpocas.slice(-3);
  const anoAtual = Number(epocaAtual.slice(0, 4));
  const epocaPassada = `${anoAtual - 1}/${String(anoAtual).slice(2)}`;
  const hojeUmAnoAntes = (() => {
    const x = new Date();
    x.setFullYear(x.getFullYear() - 1);
    return isoDe(x);
  })();
  const ind = Object.fromEntries(epocas.map((e) => [e, indicadoresEpoca(e, dados)]));
  const homologo = epocas.includes(epocaPassada) && epocas.includes(epocaAtual) ? indicadoresEpoca(epocaPassada, dados, hojeUmAnoAntes) : null;
  const dataCurta = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit" }).format(new Date());

  // ---- Período escolhido ----
  const recl = reclamacoes.filter((r) => dentroPeriodo(periodo, r.receivedDate));
  const visitas = audits.filter((a) => audNoPeriodo(periodo, a));
  const constat = visitas.flatMap((a) => (a.findings || []).map((f) => ({ ...f, escola: a.school, data: a.date })));
  const todasConstat = audits.flatMap((a) => (a.findings || []).map((f) => ({ ...f, escola: a.school, data: a.date, epoca: epocaAud(a) })));
  const abertas = audits.flatMap((a) => (a.findings || []).filter((f) => abertaNoFim(f, a, periodo)).map((f) => ({ ...f, escola: a.school, data: a.date, epoca: epocaAud(a) })));
  const inqPeriodo = inqueritos.filter((i) => dentroPeriodo(periodo, i.data));
  const satPeriodo = inqPeriodo.length ? satisfacaoDe(inqPeriodo.flatMap((i) => i.perguntas || [])).pct : null;
  const npsPeriodo = inqPeriodo.length ? npsDe(inqPeriodo) : null;
  const porEscola = escolas.map((e) => ({ e, m: metricasEscola(e, periodo, dados), constat: constat.filter((f) => f.escola === e).length, abertas: abertas.filter((f) => f.escola === e).length }));
  const alunosTotal = porEscola.reduce((n, x) => n + (x.m.alunos || 0), 0);
  // Face ao mesmo período da época passada (escola a escola; as que não têm base fiável no mesmo dia usam o fim da época).
  const comBase = porEscola.filter((x) => x.m.cmp && x.m.cmp.ant);
  const antTotal = comBase.reduce((n, x) => n + x.m.cmp.ant, 0);
  const atualComBase = comBase.reduce((n, x) => n + (x.m.cmp.atual !== null ? x.m.cmp.atual : x.m.alunos || 0), 0);
  const crescRede = antTotal && atualComBase ? Math.round(((atualComBase - antTotal) / antTotal) * 1000) / 10 : null;
  const escolasBaseFim = comBase.filter((x) => x.m.cmp.base === "fim").length;
  const homologoP = nomeHomologo(periodo);
  const desistPeriodo = desistencias.filter((x) => dentroPeriodo(periodo, x.data)).reduce((n, x) => n + x.n, 0);
  const desistHom = homologoP ? desistencias.filter((x) => noPeriodoHomologo(periodo, x.data)).reduce((n, x) => n + x.n, 0) : null;

  // ---- Momentos: série mensal por época ----
  const serieMensal = (lista, dataDe) =>
    MESES_EPOCA.map((m) => {
      const linha = { name: MES_CURTO[m] };
      epocas.forEach((ep) => {
        const ano = m >= 6 ? Number(ep.slice(0, 4)) : Number(ep.slice(0, 4)) + 1;
        const prefixo = `${ano}-${String(m + 1).padStart(2, "0")}`;
        // Meses ainda por vir na época em curso ficam em branco.
        linha[ep] = ep === epocaAtual && prefixo > hoje.slice(0, 7) ? null : lista.filter((x) => String(dataDe(x)).slice(0, 7) === prefixo).length;
      });
      return linha;
    });
  // A mais recente em azul forte; as anteriores vão clareando.
  const PALETA_EP = ["#C9CED6", COLORS.slate, "#6E8CC0", "#9DB5DD", azulRel()];
  const coresEpoca = (i) => (epocas.length <= 3 ? [COLORS.slate, "#9DB5DD", azulRel()][i + (3 - epocas.length)] : PALETA_EP[Math.max(0, PALETA_EP.length - epocas.length + i)]) || azulRel();

  const corDif = (dif, bom) => (dif === 0 || !bom ? COLORS.slate : (bom === "alto" ? dif > 0 : dif < 0) ? REL_VERDE : REL_VERMELHO);
  const fmtDif = (dif, l) => (dif === null ? "—" : dif === 0 ? "=" : `${dif > 0 ? "+" : "−"}${fmtNum(Math.abs(dif), l.dec ?? 0)}${l.un === "%" ? " p.p." : l.un === " dias" ? " d" : ""}`);

  // ---- Melhor e pior por coluna (escolas lado a lado) ----
  const COL_ESC = [
    { k: "alunos", label: "Alunos", v: (x) => x.m.alunos || null },
    { k: "crescimento", label: "Cresc.", v: (x) => x.m.crescimento, un: "%", dec: 1, bom: "alto" },
    { k: "renovPct", label: "Renov.", v: (x) => x.m.renovPct, un: "%", bom: "alto" },
    { k: "reclPor100", label: "Recl./100", v: (x) => x.m.reclPor100, dec: 1, bom: "baixo" },
    { k: "prazo", label: "No prazo", v: (x) => x.m.prazo, un: "%", bom: "alto" },
    { k: "constat", label: "Constat.", v: (x) => x.constat, bom: "baixo" },
    { k: "abertas", label: "Por fechar", v: (x) => x.abertas, bom: "baixo" },
    { k: "satisfacao", label: "Satisf.", v: (x) => x.m.satisfacao, un: "%", bom: "alto" },
    { k: "desistPct", label: "Desist.", v: (x) => x.m.desistPct, un: "%", dec: 1, bom: "baixo" },
    { k: "conversao", label: "Conversão", v: (x) => x.m.conversao, un: "%", bom: "alto" },
  ];
  const extremos = Object.fromEntries(
    COL_ESC.filter((c) => c.bom).map((c) => {
      const vs = porEscola.map(c.v).filter((v) => v !== null && v !== undefined && !isNaN(v));
      if (vs.length < 2) return [c.k, null];
      const max = Math.max(...vs);
      const min = Math.min(...vs);
      if (max === min) return [c.k, null];
      return [c.k, c.bom === "alto" ? { melhor: max, pior: min } : { melhor: min, pior: max }];
    })
  );

  // ---- Auditorias: assuntos, responsáveis e escolas ----
  const assuntoDe = (f) => f.category || f.area || f.description || "Sem assunto";
  const ultimasDuas = (lista) => {
    const e = [...new Set(lista.filter(Boolean))].filter((x) => x <= epocaAtual).sort();
    return [e[e.length - 2], e[e.length - 1]];
  };
  const [epA, epB] = ultimasDuas(todasConstat.map((f) => f.epoca));
  const [epRA, epRB] = ultimasDuas(reclamacoes.map((r) => epocaDe(r.receivedDate)));
  const assuntos = (() => {
    const c = {};
    todasConstat.forEach((f) => {
      const ep = f.epoca;
      if (ep !== epA && ep !== epB) return;
      const k = assuntoDe(f);
      c[k] = c[k] || { a: 0, b: 0 };
      if (ep === epA) c[k].a++;
      else c[k].b++;
    });
    return Object.entries(c)
      .map(([name, x]) => ({ name, ...x, total: x.a + x.b }))
      .sort((x, y) => y.total - x.total)
      .slice(0, 10);
  })();
  const responsaveis = (() => {
    const c = {};
    constat.forEach((f) => {
      const k = (f.responsavel || "").trim();
      if (!k) return;
      c[k] = c[k] || { n: 0, fechadas: 0, tempos: [], comPrazo: 0, noPrazo: 0 };
      c[k].n++;
      if (f.resolvida) {
        c[k].fechadas++;
        if (f.prazo && f.resolvidaEm) {
          c[k].comPrazo++;
          if (f.resolvidaEm <= f.prazo) c[k].noPrazo++;
        }
        if (f.resolvidaEm) c[k].tempos.push(diasEntreRel(f.data, f.resolvidaEm));
      }
    });
    return Object.entries(c)
      .map(([nome, x]) => ({ nome, ...x, tempo: x.tempos.length ? Math.round(mediaDe(x.tempos)) : null }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);
  })();
  const fechoPorEscola = escolas
    .map((e) => {
      const ts = constat.filter((f) => f.escola === e && f.resolvidaEm).map((f) => diasEntreRel(f.data, f.resolvidaEm)).filter((x) => x >= 0);
      return { name: e.replace(/^Dragon Force\s+/i, ""), value: ts.length ? Math.round(mediaDe(ts)) : null };
    })
    .filter((x) => x.value !== null)
    .sort((a, b) => b.value - a.value);
  const empilhado = epocas.map((ep) => ({ name: ep, NCM: ind[ep].NCM, NC: ind[ep].NC, OM: ind[ep].OM, AS: ind[ep].AS }));
  const CORES_CLS = { NCM: REL_VERMELHO, NC: "#C58A1A", OM: azulRel(), AS: "#9DB5DD" };

  // ---- Reclamações: temas por época ----
  const temas = (() => {
    const c = {};
    reclamacoes.forEach((r) => {
      const ep = epocaDe(r.receivedDate);
      if (ep !== epRA && ep !== epRB) return;
      const k = r.tema || r.categoria || "Sem tema";
      c[k] = c[k] || { a: 0, b: 0 };
      if (ep === epRA) c[k].a++;
      else c[k].b++;
    });
    return Object.entries(c)
      .map(([name, x]) => ({ name, ...x, total: x.a + x.b }))
      .sort((x, y) => y.total - x.total)
      .slice(0, 10);
  })();

  // ---- Pontos a acompanhar ----
  const acompanhar = [];
  porEscola.forEach(({ e }) => {
    const atrasadas = reclamacoes.filter((r) => r.school === e && r.derivedStatus === "atrasado").length;
    if (atrasadas) acompanhar.push({ nivel: "alto", t: `${e}: ${atrasadas} ${atrasadas === 1 ? "reclamação" : "reclamações"} fora do prazo` });
  });
  porEscola.forEach(({ e }) => {
    const nc = abertas.filter((f) => f.escola === e && (f.classification === "NC" || f.classification === "NCM"));
    const velhas = nc.filter((f) => diasEntreRel(f.data, hoje) > 60).length;
    const foraPrazo = abertas.filter((f) => f.escola === e && f.prazo && f.prazo < hoje).length;
    if (foraPrazo) acompanhar.push({ nivel: "alto", t: `${e}: ${foraPrazo} ${foraPrazo === 1 ? "constatação" : "constatações"} com o prazo de resolução ultrapassado` });
    if (nc.length) acompanhar.push({ nivel: nc.some((f) => f.classification === "NCM") || velhas ? "alto" : "medio", t: `${e}: ${nc.length} não conformidade${nc.length === 1 ? "" : "s"} por fechar${velhas ? ` (${velhas} há mais de 60 dias)` : ""}` });
  });
  porEscola
    .filter((x) => x.m.crescimento !== null && x.m.crescimento < 0)
    .forEach((x) => acompanhar.push({ nivel: "medio", t: `${x.e}: ${fmtNum(x.m.crescimento, 1)}% de alunos face ao mesmo período da época passada` }));
  porEscola
    .filter((x) => x.m.satisfacao !== null && x.m.satisfacao < 75)
    .forEach((x) => acompanhar.push({ nivel: "medio", t: `${x.e}: satisfação de ${x.m.satisfacao}%` }));
  if (homologo && ind[epocaAtual].recl > homologo.recl)
    acompanhar.push({ nivel: "medio", t: `Reclamações acima do mesmo período da época passada (${ind[epocaAtual].recl} contra ${homologo.recl})` });
  inqPeriodo
    .map((i) => ({ i, s: satisfacaoDe(i.perguntas || []) }))
    .filter((x) => x.s.pct !== null && x.s.pct < 70)
    .forEach((x) => acompanhar.push({ nivel: "medio", t: `${x.i.edicao}: ${x.s.pct}% de satisfação` }));
  const ordemN = { alto: 0, medio: 1, baixo: 2 };
  acompanhar.sort((a, b) => ordemN[a.nivel] - ordemN[b.nivel]);
  const corN = { alto: REL_VERMELHO, medio: "#C58A1A", baixo: COLORS.slate };

  const thR = (al = "right") => ({ textAlign: al, padding: "0 0 8px 10px", borderBottom: `1px solid ${COLORS.ink}`, whiteSpace: "nowrap" });
  const tdR = { textAlign: "right", padding: "8px 0 8px 10px", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

  return (
    <article className="relFolha" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 4, maxWidth: 880, margin: "0 auto", boxShadow: "0 1px 2px rgba(10,20,40,0.06), 0 12px 40px -12px rgba(10,20,40,0.18)", overflow: "hidden" }}>
      <table className="relPaginas">
        <thead>
          <tr>
            <td>
              <div className="relEspaco" />
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td>
              <div className="relRodapeImp">
                <span>FC Porto · Dragon Force · Gestão da Qualidade</span>
                <span>Relatório geral · {nomePeriodo(periodo)}</span>
              </div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td>
              <header className="relCapa">
                <div style={{ background: REL_AZUL, color: "#fff", display: "flex", alignItems: "center", gap: 14, padding: "14px 44px" }}>
                  <LogoRel altura={30} cor="#fff" />
                  <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", lineHeight: 1.5 }}>
                    FC Porto · Dragon Force
                    <div style={{ fontWeight: 500, opacity: 0.7, letterSpacing: "0.12em" }}>Gestão da Qualidade</div>
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.8 }}>Relatório geral</div>
                </div>
                <div style={{ padding: "44px 44px 0" }}>
                  <div className="relRotulo" style={{ color: azulRel() }}>
                    {nomePeriodo(periodo)} · {escolas.length} escolas
                  </div>
                  <h2 style={{ margin: "10px 0 10px", fontFamily: REL_SERIFA, fontSize: 40, fontWeight: 600, color: COLORS.ink, letterSpacing: "-0.015em", lineHeight: 1.05 }}>Dragon Force</h2>
                  <div style={{ fontSize: 13, color: COLORS.ink2 }}>
                    Relatório da rede de escolas · emitido a {geradoEm}
                    {epocas.length > 1 ? ` · compara as épocas ${epocas.join(", ")}` : ""}
                  </div>
                  <div className="relCapaNumeros" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", marginTop: 34, borderTop: `2px solid ${REL_AZUL}`, borderBottom: `1px solid ${COLORS.rule}` }}>
                    {[
                      ["Alunos", fmtNum(alunosTotal), crescRede === null ? null : `${crescRede > 0 ? "+" : ""}${fmtNum(crescRede, 1)}% face ao mesmo período de ${epAntDe(epocaDoPeriodo(periodo))}${escolasBaseFim ? ` · ${escolasBaseFim} ${escolasBaseFim === 1 ? "escola" : "escolas"} com o fim da época (sem dados do mesmo período)` : ""}`],
                      ["Desistências", fmtNum(desistPeriodo), [alunosTotal ? `${fmtNum((desistPeriodo / alunosTotal) * 100, 1)}% dos alunos` : "", desistHom !== null ? `${fmtNum(desistHom)} em ${homologoP}` : ""].filter(Boolean).join(" · ") || null],
                      ["Reclamações", fmtNum(recl.length), alunosTotal ? `${fmtNum(por100(recl.length, alunosTotal), 1)} por 100 alunos` : null],
                      ["Visitas de auditoria", fmtNum(visitas.length), `${constat.length} constatações`],
                      ["Por fechar", fmtNum(abertas.length), "constatações em aberto"],
                      ["Satisfação", satPeriodo === null ? "—" : `${satPeriodo}%`, npsPeriodo ? `NPS ${npsPeriodo.valor > 0 ? "+" : ""}${npsPeriodo.valor}` : "eventos e campos"],
                    ].map(([l, v, sub], i) => (
                      <div key={l} style={{ padding: "16px 16px", paddingLeft: i ? 16 : 0, borderLeft: i ? `1px solid ${COLORS.rule}` : "none", minWidth: 0 }}>
                        <div className="relRotulo">{l}</div>
                        <div style={{ fontFamily: REL_SERIFA, fontSize: 26, fontWeight: 600, color: COLORS.ink, marginTop: 8, lineHeight: 1, fontVariantNumeric: "lining-nums tabular-nums" }}>{v}</div>
                        {sub && <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 6 }}>{sub}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </header>

              <div className="relCorpo" style={{ padding: "0 44px 40px" }}>
                {ver("epocas") && (
                  <SeccaoRel titulo="Evolução entre épocas" nota={homologo ? `A coluna ${epocaPassada} até ${dataCurta} conta só até à mesma data do ano passado` : "Épocas completas"}>
                    <table className="relQuadro" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th className="relRotulo" style={thR("left")}>Indicador</th>
                          {epocas.map((e) => (
                            <th key={e} className="relRotulo" style={{ ...thR(), color: e === epocaAtual ? azulRel() : undefined }}>
                              {e}
                              {e === epocaAtual ? " *" : ""}
                            </th>
                          ))}
                          {homologo && (
                            <th className="relRotulo" style={thR()}>
                              {epocaPassada} até {dataCurta}
                            </th>
                          )}
                          <th className="relRotulo" style={thR()}>
                            Variação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {LINHAS_EPOCA.map((l, i) => {
                          const atual = ind[epocas[epocas.length - 1]][l.k];
                          const base = homologo ? homologo[l.k] : epocas.length > 1 ? ind[epocas[epocas.length - 2]][l.k] : null;
                          const dif = atual !== null && base !== null && base !== undefined ? atual - base : null;
                          const novoGrupo = i === 0 || LINHAS_EPOCA[i - 1].grupo !== l.grupo;
                          return (
                            <React.Fragment key={l.k}>
                              {novoGrupo && (
                                <tr>
                                  <td colSpan={epocas.length + (homologo ? 3 : 2)} style={{ padding: "16px 0 6px", fontFamily: REL_SERIFA, fontSize: 14, fontWeight: 600, color: COLORS.ink }}>
                                    {l.grupo}
                                  </td>
                                </tr>
                              )}
                              <tr className="relLinhaComp">
                                <td style={{ padding: "8px 0", paddingLeft: l.sub ? 14 : 0, color: l.sub ? COLORS.ink2 : COLORS.ink, borderBottom: `1px solid ${COLORS.ruleSoft}` }}>{l.label}</td>
                                {epocas.map((e) => (
                                  <td key={e} style={{ ...tdR, fontWeight: e === epocaAtual ? 600 : 400, color: COLORS.ink }}>
                                    {fmtNum(ind[e][l.k], l.dec ?? 0)}
                                    {ind[e][l.k] !== null && l.un ? <span style={{ color: COLORS.slate }}>{l.un}</span> : null}
                                  </td>
                                ))}
                                {homologo && (
                                  <td style={{ ...tdR, color: COLORS.ink2 }}>
                                    {fmtNum(homologo[l.k], l.dec ?? 0)}
                                    {homologo[l.k] !== null && l.un ? <span style={{ color: COLORS.slate }}>{l.un}</span> : null}
                                  </td>
                                )}
                                <td style={{ ...tdR, fontWeight: 600, color: dif === null ? COLORS.slate : corDif(dif, l.bom) }}>{fmtDif(dif, l)}</td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{ fontSize: 10.5, color: COLORS.slate, marginTop: 10 }}>
                      * Época em curso, com dados até {fmt(new Date())}.{homologo ? ` A variação compara com ${epocaPassada} até à mesma data.` : ""}
                    </div>
                  </SeccaoRel>
                )}

                {ver("momentos") && (
                  <SeccaoRel titulo="Ao longo da época" nota="Por mês, de agosto a julho">
                    <div className="relGrelha">
                      {[
                        ["Reclamações recebidas", serieMensal(reclamacoes, (r) => r.receivedDate)],
                        ["Constatações de auditoria", serieMensal(todasConstat, (f) => f.data)],
                      ].map(([titulo, serie]) => (
                        <div key={titulo}>
                          <div className="relSub">{titulo}</div>
                          <ResponsiveContainer width="100%" height={190}>
                            <LineChart data={serie} margin={{ left: -22, right: 8, top: 6 }}>
                              <CartesianGrid stroke={COLORS.ruleSoft} vertical={false} />
                              <XAxis dataKey="name" tick={<TickEixoX tamanho={10} cor={COLORS.slate} />} height={38} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={0} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                              <Tooltip content={<DicaGrafico />} />
                              {epocas.map((ep, i) => (
                                <Line key={ep} type="linear" dataKey={ep} name={ep} stroke={coresEpoca(i)} strokeWidth={ep === epocaAtual ? 2.2 : 1.4} strokeDasharray={ep === epocaAtual ? undefined : i === 0 && epocas.length === 3 ? "2 3" : "5 3"} dot={false} connectNulls={false} isAnimationActive={false} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 18, fontSize: 11.5, color: COLORS.ink2, marginTop: -12 }}>
                      {epocas.map((ep, i) => (
                        <span key={ep} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 18, height: 0, borderTop: `${ep === epocaAtual ? 2.2 : 1.4}px ${ep === epocaAtual ? "solid" : "dashed"} ${coresEpoca(i)}` }} />
                          {ep}
                        </span>
                      ))}
                    </div>
                  </SeccaoRel>
                )}

                {ver("escolas") && (
                  <SeccaoRel titulo="Escolas lado a lado" nota={`${nomePeriodo(periodo)} · a verde o melhor valor, a laranja o pior`}>
                    <div style={{ overflowX: "auto" }}>
                      <table className="relQuadro" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr>
                            <th className="relRotulo" style={thR("left")}>Escola</th>
                            {COL_ESC.map((c) => (
                              <th key={c.k} className="relRotulo" style={thR()}>
                                {c.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...porEscola]
                            .sort((a, b) => (b.m.alunos || 0) - (a.m.alunos || 0))
                            .map((x) => (
                              <tr key={x.e} className="relLinhaComp">
                                <td style={{ padding: "9px 0", borderBottom: `1px solid ${COLORS.ruleSoft}`, color: COLORS.ink, whiteSpace: "nowrap" }}>{x.e.replace(/^Dragon Force\s+/i, "")}</td>
                                {COL_ESC.map((c) => {
                                  const v = c.v(x);
                                  const ex = extremos[c.k];
                                  const cor = ex && v === ex.melhor ? REL_VERDE : ex && v === ex.pior ? REL_VERMELHO : COLORS.ink;
                                  return (
                                    <td key={c.k} style={{ ...tdR, color: cor, fontWeight: cor !== COLORS.ink ? 700 : 400 }}>
                                      {fmtNum(v, c.dec ?? 0)}
                                      {v !== null && v !== undefined && c.un ? c.un : ""}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </SeccaoRel>
                )}

                {ver("auditorias") && (
                  <SeccaoRel
                    titulo="Auditorias"
                    nota={`${visitas.length} visitas e ${constat.length} constatações no período${
                      visitas.some((a) => ambitoAud(a) !== "escola")
                        ? `, incluindo ${visitas.filter((a) => ambitoAud(a) !== "escola").reduce((n, a) => n + (a.findings || []).length, 0)} de eventos e SGQ`
                        : ""
                    }`}
                  >
                    <div className="relGrelha">
                      <div>
                        <div className="relSub">Constatações por tipo e época</div>
                        {empilhado.some((x) => x.NCM + x.NC + x.OM + x.AS) ? (
                          <>
                            <ResponsiveContainer width="100%" height={Math.max(90, epocas.length * 44)}>
                              <BarChart data={empilhado} layout="vertical" margin={{ left: 0, right: 30 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={62} tick={<TickNome largura={62} tamanho={11.5} cor={COLORS.ink2} />} axisLine={false} tickLine={false} />
                                <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                                {["NCM", "NC", "OM", "AS"].map((c, i, arr) => (
                                  <Bar key={c} dataKey={c} stackId="t" fill={CORES_CLS[c]} barSize={14} isAnimationActive={false}>
                                    {i === arr.length - 1 && <LabelList valueAccessor={(e) => e.payload.NCM + e.payload.NC + e.payload.OM + e.payload.AS} position="right" style={{ fontSize: 11.5, fontWeight: 600, fill: COLORS.ink }} />}
                                  </Bar>
                                ))}
                              </BarChart>
                            </ResponsiveContainer>
                            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: COLORS.ink2, marginTop: 6 }}>
                              {["NCM", "NC", "OM", "AS"].map((c) => (
                                <span key={c} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <span style={{ width: 8, height: 8, background: CORES_CLS[c] }} />
                                  {c}
                                </span>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="relVazio">Sem constatações registadas.</div>
                        )}
                      </div>
                      <div>
                        <div className="relSub">Tempo médio de fecho por escola (dias)</div>
                        <BarrasRel dados={fechoPorEscola} largura={110} />
                      </div>
                    </div>
                    <div className="relGrelha">
                      <div>
                        <div className="relSub">Assuntos mais frequentes</div>
                        {assuntos.length ? (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                            <thead>
                              <tr>
                                <th className="relRotulo" style={thR("left")}>Assunto</th>
                                {epA && <th className="relRotulo" style={thR()}>{epA}</th>}
                                <th className="relRotulo" style={thR()}>{epB}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assuntos.map((a) => (
                                <tr key={a.name}>
                                  <td style={{ padding: "7px 0", borderBottom: `1px solid ${COLORS.ruleSoft}`, color: COLORS.ink }}>{a.name}</td>
                                  {epA && <td style={{ ...tdR, color: COLORS.ink2 }}>{a.a}</td>}
                                  <td style={{ ...tdR, fontWeight: 600, color: epA ? corDif(a.b - a.a, "baixo") : COLORS.ink }}>{a.b}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="relVazio">Sem constatações registadas.</div>
                        )}
                      </div>
                      <div>
                        <div className="relSub">Responsáveis pela resolução</div>
                        {responsaveis.length ? (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                            <thead>
                              <tr>
                                <th className="relRotulo" style={thR("left")}>Responsável</th>
                                <th className="relRotulo" style={thR()}>Constat.</th>
                                <th className="relRotulo" style={thR()}>Fechadas</th>
                                <th className="relRotulo" style={thR()}>No prazo</th>
                                <th className="relRotulo" style={thR()}>Dias</th>
                              </tr>
                            </thead>
                            <tbody>
                              {responsaveis.map((r) => (
                                <tr key={r.nome}>
                                  <td style={{ padding: "7px 0", borderBottom: `1px solid ${COLORS.ruleSoft}`, color: COLORS.ink }}>{r.nome}</td>
                                  <td style={tdR}>{r.n}</td>
                                  <td style={tdR}>{Math.round((r.fechadas / r.n) * 100)}%</td>
                                  <td style={tdR}>{r.comPrazo ? `${Math.round((r.noPrazo / r.comPrazo) * 100)}%` : "—"}</td>
                                  <td style={tdR}>{fmtNum(r.tempo)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="relVazio">Sem responsáveis registados no período.</div>
                        )}
                      </div>
                    </div>
                  </SeccaoRel>
                )}

                {ver("reclamacoes") && (
                  <SeccaoRel titulo="Reclamações" nota={`${recl.length} no período`}>
                    <div className="relGrelha">
                      <div>
                        <div className="relSub">Temas mais frequentes</div>
                        {temas.length ? (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                            <thead>
                              <tr>
                                <th className="relRotulo" style={thR("left")}>Tema</th>
                                {epRA && <th className="relRotulo" style={thR()}>{epRA}</th>}
                                <th className="relRotulo" style={thR()}>{epRB}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {temas.map((a) => (
                                <tr key={a.name}>
                                  <td style={{ padding: "7px 0", borderBottom: `1px solid ${COLORS.ruleSoft}`, color: COLORS.ink }}>{a.name}</td>
                                  {epRA && <td style={{ ...tdR, color: COLORS.ink2 }}>{a.a}</td>}
                                  <td style={{ ...tdR, fontWeight: 600, color: epRA ? corDif(a.b - a.a, "baixo") : COLORS.ink }}>{a.b}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="relVazio">Sem reclamações registadas.</div>
                        )}
                      </div>
                      <div>
                        <div className="relSub">Por escola, por 100 alunos</div>
                        <BarrasRel
                          dados={porEscola
                            .filter((x) => x.m.reclPor100 !== null)
                            .map((x) => ({ name: x.e.replace(/^Dragon Force\s+/i, ""), value: x.m.reclPor100 }))
                            .sort((a, b) => b.value - a.value)}
                          largura={110}
                        />
                        <div className="relSub" style={{ marginTop: 18 }}>
                          Gravidade
                        </div>
                        <BarraPartesRel partes={["alta", "media", "baixa"].map((k) => ({ label: SEVERITY_META[k].label, valor: recl.filter((r) => r.severity === k).length, cor: { alta: REL_VERMELHO, media: "#C58A1A", baixa: "#9DB5DD" }[k] }))} />
                      </div>
                    </div>
                  </SeccaoRel>
                )}

                {ver("satisfacao") && (
                  <SeccaoRel titulo="Satisfação" nota={`${inqPeriodo.length} inquéritos de eventos no período`}>
                    <div className="relGrelha">
                      <div>
                        <div className="relSub">Eventos e campos</div>
                        <TabelaRel
                          colunas={["Evento", "Respostas", "Satisfação", "NPS"]}
                          vazio="Sem inquéritos no período."
                          linhas={inqPeriodo
                            .sort((a, b) => String(b.data).localeCompare(String(a.data)))
                            .slice(0, 12)
                            .map((i) => {
                              const s = satisfacaoDe(i.perguntas || []);
                              const n = npsDe([i]);
                              return [i.edicao, i.respostas || s.n || "—", <strong style={{ color: corRel(corSatisfacao(s.pct)) || COLORS.ink }}>{s.pct ?? "—"}%</strong>, n ? n.valor : "—"];
                            })}
                        />
                      </div>
                      <div>
                        <div className="relSub">Satisfação por escola</div>
                        <BarrasRel
                          dados={porEscola
                            .filter((x) => x.m.satisfacao !== null)
                            .map((x) => ({ name: x.e.replace(/^Dragon Force\s+/i, ""), value: x.m.satisfacao }))
                            .sort((a, b) => b.value - a.value)}
                          largura={110}
                          sufixo="%"
                        />
                      </div>
                    </div>
                  </SeccaoRel>
                )}

                {ver("causas") && (
                  <SeccaoRel titulo="Causa raiz" nota="Reclamações concluídas e constatações fechadas no período">
                    {(() => {
                      const itens = itensCausa(recl, visitas);
                      const analises = constat.filter((f) => f.analiseCausas).length;
                      return (
                        <div className="relGrelha">
                          <div>
                            <div className="relSub">Reclamações</div>
                            <BarrasRel dados={contar(itens.filter((i) => i.origem === "Reclamações"), "causa")} largura={170} />
                          </div>
                          <div>
                            <div className="relSub">Constatações de auditoria</div>
                            <BarrasRel dados={contar(itens.filter((i) => i.origem === "Auditorias"), "causa")} largura={170} />
                            {analises > 0 && <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 8 }}>{analises} constatações com análise de causas escrita</div>}
                          </div>
                        </div>
                      );
                    })()}
                  </SeccaoRel>
                )}

                {ver("acompanhar") && (
                  <SeccaoRel titulo="Pontos a acompanhar" nota="Gerados a partir dos dados">
                    {acompanhar.length === 0 ? (
                      <div style={{ fontSize: 13, color: COLORS.ink2 }}>Nada pendente na rede.</div>
                    ) : (
                      <div>
                        {acompanhar.slice(0, 18).map((it, i) => (
                          <div key={i} className="relLinhaComp" style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "10px 0", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontSize: 13, lineHeight: 1.5, color: COLORS.ink }}>
                            <span style={{ width: 13, height: 13, border: `1px solid ${COLORS.ink2}`, flex: "none", marginTop: 3 }} />
                            <span style={{ flex: 1 }}>{it.t}</span>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: corN[it.nivel], flex: "none", marginTop: 6 }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </SeccaoRel>
                )}

                {ver("notas") && (
                  <SeccaoRel titulo="Notas e conclusões" nota="Ficam guardadas para o relatório geral deste período">
                    <textarea
                      className="relSoEcra"
                      rows={5}
                      value={nota}
                      placeholder="Conclusões, próximos passos, responsáveis…"
                      onChange={(e) => setNota(e.target.value)}
                      onBlur={() => {
                        if ((notas[chaveNota] || "") !== nota) onGuardarNota(chaveNota, nota);
                      }}
                      style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.55 }}
                    />
                    <div className="relSoImpressao" style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {nota || Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 30, borderBottom: `1px solid ${COLORS.rule}` }} />)}
                    </div>
                  </SeccaoRel>
                )}

                <div className="relFimEcra" style={{ marginTop: 44, paddingTop: 14, borderTop: `1px solid ${COLORS.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10.5, color: COLORS.slate, letterSpacing: "0.04em" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <LogoRel altura={18} cor={COLORS.slate} />
                    FC Porto · Dragon Force · Gestão da Qualidade
                  </span>
                  <span>Relatório geral · {nomePeriodo(periodo)}</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

export function RelatorioEscolaPage({ escolas, reclamacoes, audits, sanctions, inscritos, turmasAlunos, epocaAnterior, registoAlunos = {}, desistencias, experiencias, desvinculacoes, satisfacao, inqueritos, avaliacoes, niveis, notas, onGuardarNota, notificar, tema, setTema }) {
  const epocaAtual = epocaDe(new Date().toISOString().slice(0, 10));
  const epocasComDados = [...new Set([epocaAtual, ...Object.keys(registoAlunos), ...reclamacoes.map((r) => epocaDe(r.receivedDate)), ...audits.map((a) => epocaAud(a))].filter(Boolean))].sort().reverse();

  const [escola, setEscola] = useState(escolas[0] || "");
  const [periodo, setPeriodo] = useState(`epoca:${epocaAtual}`);
  // Período à escolha (ex.: um trimestre): por omissão os últimos 3 meses.
  const [intIni, setIntIni] = useState(() => {
    const x = new Date();
    x.setMonth(x.getMonth() - 3);
    return isoDe(x);
  });
  const [intFim, setIntFim] = useState(() => isoDe(new Date()));
  const mudaIntervalo = (ini, fim) => {
    setIntIni(ini);
    setIntFim(fim);
    if (ini && fim && ini <= fim) setPeriodo(`intervalo:${ini}:${fim}`);
  };
  // Trimestres da época (agosto a julho) para escolher depressa.
  const trimestres = (() => {
    const ano = Number(epocaAtual.slice(0, 4));
    const ts = [
      [`${ano}-08-01`, `${ano}-10-31`, "Ago–Out"],
      [`${ano}-11-01`, `${ano + 1}-01-31`, "Nov–Jan"],
      [`${ano + 1}-02-01`, `${ano + 1}-04-30`, "Fev–Abr"],
      [`${ano + 1}-05-01`, `${ano + 1}-07-31`, "Mai–Jul"],
    ];
    return ts.filter(([ini]) => ini <= isoDe(new Date()));
  })();
  const [seccoes, setSeccoes] = useState(() => {
    try {
      const g = JSON.parse(window.localStorage.getItem(LS_RELATORIO) || "null");
      if (Array.isArray(g)) return new Set(g);
    } catch (e) {
      // sem preferências guardadas
    }
    return new Set(SECCOES_RELATORIO.map((s) => s.key));
  });
  const [comparar, setComparar] = useState(true);
  const [epocasComp, setEpocasComp] = useState([]);
  const geral = escola === "__geral__";
  const [seccoesGeral, setSeccoesGeral] = useState(() => {
    try {
      const g = JSON.parse(window.localStorage.getItem(LS_REL_GERAL) || "null");
      if (Array.isArray(g)) return new Set(g);
    } catch (e) {
      // sem preferências guardadas
    }
    return new Set(SECCOES_GERAL.map((x) => x.key));
  });
  const toggleGeral = (k) =>
    setSeccoesGeral((s0) => {
      const n = new Set(s0);
      n.has(k) ? n.delete(k) : n.add(k);
      try {
        window.localStorage.setItem(LS_REL_GERAL, JSON.stringify([...n]));
      } catch (e) {
        // preferências só nesta sessão
      }
      return n;
    });
  const chaveNota = `${escola}|${periodo}`;
  const [nota, setNota] = useState(notas[chaveNota] || "");
  useEffect(() => setNota(notas[chaveNota] || ""), [chaveNota]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (k) =>
    setSeccoes((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      try {
        window.localStorage.setItem(LS_RELATORIO, JSON.stringify([...n]));
      } catch (e) {
        // preferências só nesta sessão
      }
      return n;
    });

  if (!escola) return <SemDados icon={FileText} titulo="Sem escolas" texto="Adiciona escolas em Todas as listas para gerar relatórios." />;

  const dados = { reclamacoes, audits, inscritos, turmasAlunos, epocaAnterior, registoAlunos, desistencias, experiencias, satisfacao, inqueritos };
  const m = metricasEscola(escola, periodo, dados);
  const outras = escolas.filter((e) => e !== escola).map((e) => ({ e, m: metricasEscola(e, periodo, dados) }));
  const todas = [{ e: escola, m }, ...outras];

  const mediaOutras = (k) => {
    const vs = outras.map((o) => o.m[k]).filter((v) => v !== null && v !== undefined && !isNaN(v));
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  const posicao = (k, melhor) => {
    const vs = todas.filter((t) => t.m[k] !== null && t.m[k] !== undefined).sort((a, b) => (melhor === "alto" ? b.m[k] - a.m[k] : a.m[k] - b.m[k]));
    const i = vs.findIndex((t) => t.e === escola);
    return i >= 0 ? { pos: i + 1, de: vs.length } : null;
  };

  const comparacoes = METRICAS_COMP.map((c) => {
    const v = m[c.key];
    const med = mediaOutras(c.key);
    const p = posicao(c.key, c.melhor);
    let estado = null;
    if (v !== null && v !== undefined && med !== null) {
      const dif = c.melhor === "alto" ? v - med : med - v;
      estado = dif >= c.limiar ? "melhor" : dif <= -c.limiar ? "pior" : "igual";
    }
    return { ...c, v, med, p, estado };
  });
  const posicaoGeral = (() => {
    const medias = todas
      .map((t) => {
        const ps = METRICAS_COMP.map((c) => {
          const vs = todas.filter((x) => x.m[c.key] !== null && x.m[c.key] !== undefined && !isNaN(x.m[c.key])).sort((a, b) => (c.melhor === "alto" ? b.m[c.key] - a.m[c.key] : a.m[c.key] - b.m[c.key]));
          const i = vs.findIndex((x) => x.e === t.e);
          return i >= 0 && vs.length > 1 ? i / (vs.length - 1) : null;
        }).filter((x) => x !== null);
        return { e: t.e, media: ps.length >= 3 ? ps.reduce((a, b) => a + b, 0) / ps.length : null };
      })
      .filter((x) => x.media !== null)
      .sort((a, b) => a.media - b.media);
    const i = medias.findIndex((x) => x.e === escola);
    return i >= 0 && medias.length > 1 ? { pos: i + 1, de: medias.length } : null;
  })();
  const fortes = comparacoes.filter((c) => c.estado === "melhor");
  const fracos = comparacoes.filter((c) => c.estado === "pior");

  // ---- Reclamações ----
  const recl = reclamacoes.filter((r) => r.school === escola && dentroPeriodo(periodo, r.receivedDate));
  const reclAbertas = recl.filter((r) => r.derivedStatus !== "concluido");
  const reclRes = recl.filter((r) => r.status === "concluido" && r.resolvedDate);
  const tempoRes = reclRes.length ? Math.round(reclRes.reduce((s, r) => s + (new Date(r.resolvedDate) - new Date(r.receivedDate + "T00:00:00")) / 86400000, 0) / reclRes.length) : null;
  const eficazes = pct(reclRes.filter((r) => r.eficacia === "eficaz").length, reclRes.filter((r) => r.eficacia).length);
  const reclMes = contar(recl, (r) => mesDeData(r.receivedDate)).sort((a, b) => a.name.localeCompare(b.name));
  const homologo = nomeHomologo(periodo);
  const reclHom = homologo ? reclamacoes.filter((r) => r.school === escola && noPeriodoHomologo(periodo, r.receivedDate)) : null;
  const reclAtrasadas = reclAbertas.filter((r) => r.derivedStatus === "atrasado");

  // ---- Auditorias ----
  const auds = audits.filter((a) => a.school === escola).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const audsPeriodo = auds.filter((a) => audNoPeriodo(periodo, a));
  const constat = audsPeriodo.flatMap((a) => (a.findings || []).map((f) => ({ ...f, escola: a.school, data: a.date })));
  const porResolver = auds.flatMap((a) => (a.findings || []).filter((f) => abertaNoFim(f, a, periodo)).map((f) => ({ ...f, data: a.date })));
  const ordemCls = { NCM: 0, NC: 1, AS: 2, OM: 3 };

  // ---- Inscritos (da época do período) ----
  const tPeriodo = turmasDoPeriodo(escola, periodo, dados);
  const turmas = tPeriodo.turmas;
  const masc = turmas.reduce((n, t) => n + t.m, 0);
  const fem = turmas.reduce((n, t) => n + t.f, 0);
  const escolinha = turmas.filter((t) => ehEscolinha(t.turma, niveis)).reduce((n, t) => n + t.m + t.f, 0);
  const serie = [...(inscritos[escola] || [])].filter((s) => epocaDaSemanaISO(s.semana) === tPeriodo.ep).sort((a, b) => a.semana.localeCompare(b.semana)).map((s) => ({ name: semanaLabel(s.semana), Inscritos: s.total }));
  const porEscalao = contar(turmas.map((t) => ({ ...t, __peso: t.m + t.f })), (t) => escalaoDaTurma(t.turma, niveis));
  // Uma linha por turma (os registos vêm separados por ano de nascimento).
  const lotacao = Object.values(
    turmas.reduce((acc, t) => {
      const x = acc[t.turma] || { turma: t.turma, n: 0, cap: t.cap || capacidadeSugerida(t.turma, niveis) };
      x.n += t.m + t.f;
      if (t.cap) x.cap = t.cap;
      acc[t.turma] = x;
      return acc;
    }, {})
  )
    .map((x) => ({ ...x, pct: x.cap ? Math.round((x.n / x.cap) * 100) : null }))
    .sort((a, b) => b.pct - a.pct);
  // Só turmas (as equipas de competição não contam para lotação baixa nem sobrelotação).
  const cheias = lotacao.filter((t) => ehEscolinha(t.turma, niveis) && t.pct >= 95);
  const sobrelotadas = lotacao.filter((t) => ehEscolinha(t.turma, niveis) && t.cap && t.n > t.cap);
  const vazias = lotacao.filter((t) => ehEscolinha(t.turma, niveis) && t.pct !== null && t.pct < 50);
  const cls = m.crescimento !== null ? classificarCrescimento(m.crescimento) : null;

  // ---- Movimentos ----
  const desist = desistencias.filter((x) => x.escola === escola && dentroPeriodo(periodo, x.data));
  const nDesist = desist.reduce((n, x) => n + x.n, 0);
  const nDesistHom = homologo ? desistencias.filter((x) => x.escola === escola && noPeriodoHomologo(periodo, x.data)).reduce((n, x) => n + x.n, 0) : null;
  const xps = experiencias.filter((x) => x.escola === escola && dentroPeriodo(periodo, x.data));
  const somaXp = (r) => xps.filter((x) => (r ? x.resultado === r : true)).reduce((n, x) => n + x.n, 0);
  const desv = desvinculacoes.filter((x) => x.escola === escola && dentroPeriodo(periodo, x.data));

  // ---- Satisfação ----
  const satReg = satisfacao.filter((s) => s.escola === escola && dentroPeriodo(periodo, `${s.periodo}-15`));
  const catSat = {};
  satReg.forEach((s) =>
    Object.entries(s.valores || {}).forEach(([c, v]) => {
      catSat[c] = catSat[c] || { soma: 0, peso: 0 };
      catSat[c].soma += v * (s.respostas || 1);
      catSat[c].peso += s.respostas || 1;
    })
  );
  const satCategorias = Object.entries(catSat)
    .map(([name, x]) => ({ name, value: Math.round(x.soma / x.peso) }))
    .sort((a, b) => b.value - a.value);
  const inqEscola = inqueritos
    .filter((i) => dentroPeriodo(periodo, i.data) && i.segmentos && i.segmentos[escola])
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const comentarios = inqEscola.flatMap((i) => (i.comentarios || []).filter((c) => c.segmento === escola).map((c) => ({ ...c, edicao: i.edicao })));

  // ---- Sanções ----
  const sanc = sanctions.filter((s) => s.school === escola && dentroPeriodo(periodo, s.date));

  const ver = (k) => seccoes.has(k);
  const geradoEm = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const corEstado = (e) => (e === "melhor" ? COLORS.ok : e === "pior" ? COLORS.danger : COLORS.slate);
  const txtComp = (c) => {
    if (!comparar || c.med === null) return null;
    const pos = c.p ? `${ordinal(c.p.pos)} de ${c.p.de}` : "";
    return `${pos}${pos ? " · " : ""}média das outras ${fmtNum(c.med, c.dec ?? 0)}${c.unidade}`;
  };
  const kpi = (k) => comparacoes.find((c) => c.key === k);

  const selectStyle = { ...inputStyle, width: "auto", minWidth: 190, padding: "8px 10px" };

  return (
    <div>
      {/* ---- Controlo do relatório (não sai na impressão) ---- */}
      <div className="relControlos" style={{ ...panelStyle, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="rel-escola">
              Escola
            </label>
            <select id="rel-escola" value={escola} onChange={(e) => setEscola(e.target.value)} style={selectStyle}>
              <option value="__geral__">Dragon Force · relatório geral</option>
              {escolas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="rel-periodo">
              Período
            </label>
            <select
              id="rel-periodo"
              value={periodo.startsWith("intervalo:") ? "__intervalo" : periodo}
              onChange={(e) => (e.target.value === "__intervalo" ? mudaIntervalo(intIni, intFim) : setPeriodo(e.target.value))}
              style={selectStyle}
            >
              {epocasComDados.map((ep) => (
                <option key={ep} value={`epoca:${ep}`}>
                  Época {ep}
                </option>
              ))}
              {PERIODOS_FIXOS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
              <option value="__intervalo">Escolher datas (ex.: trimestre)…</option>
            </select>
          </div>
          {periodo.startsWith("intervalo:") && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="rel-ini">
                  De
                </label>
                <input id="rel-ini" type="date" value={intIni} max={intFim} onChange={(e) => mudaIntervalo(e.target.value, intFim)} style={{ ...inputStyle, width: "auto", padding: "7px 9px" }} />
              </div>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="rel-fim">
                  Até
                </label>
                <input id="rel-fim" type="date" value={intFim} min={intIni} onChange={(e) => mudaIntervalo(intIni, e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 9px" }} />
              </div>
              <div style={{ display: "flex", gap: 4, paddingBottom: 6, flexWrap: "wrap" }}>
                {trimestres.map(([ini, fim, l]) => {
                  const on = intIni === ini && intFim === fim;
                  return (
                    <button key={l} type="button" onClick={() => mudaIntervalo(ini, fim)} title={`${dataCurtaISO(ini)} a ${dataCurtaISO(fim)}`} style={{ border: `1px solid ${on ? COLORS.navy : COLORS.rule}`, background: on ? COLORS.navy : "transparent", color: on ? "#fff" : COLORS.ink2, borderRadius: 14, padding: "3px 10px", fontSize: 12, cursor: "pointer" }}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Comparar épocas</label>
            <FiltroEpocas epocas={epocasComDados.filter((e) => e <= epocaAtual)} valor={epocasComp} onChange={setEpocasComp} />
          </div>
          {!geral && (
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, paddingBottom: 9, cursor: "pointer" }}>
              <input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} />
              Comparar com as outras escolas
            </label>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                // O PDF sai sempre em tema claro; se estiver escuro, troca e repõe no fim.
                const imprimir = () => {
                  const tituloAntes = document.title;
                  document.title = `${geral ? "Relatório geral Dragon Force" : `Relatório ${escola}`} - ${nomePeriodo(periodo)}`.replace(/[\\/:*?"<>|]/g, "-");
                  const repor = () => {
                    document.title = tituloAntes;
                    window.removeEventListener("afterprint", repor);
                  };
                  window.addEventListener("afterprint", repor);
                  try {
                    window.print();
                  } catch (e) {
                    notificar("Não foi possível abrir a impressão neste browser.", "erro");
                  }
                };
                if (tema === "dark" && setTema) {
                  setTema("light");
                  setTimeout(() => {
                    imprimir();
                    setTema("dark");
                  }, 350);
                } else imprimir();
              }}
              className="press"
              style={{ display: "flex", alignItems: "center", gap: 7, background: COLORS.navy, color: COLORS.onAccent, border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
            >
              <Printer size={15} /> Descarregar PDF
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", margin: "14px 0 8px" }}>Secções do relatório</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(geral ? SECCOES_GERAL : SECCOES_RELATORIO).map((s) => {
            const on = (geral ? seccoesGeral : seccoes).has(s.key);
            return (
              <button
                key={s.key}
                onClick={() => (geral ? toggleGeral(s.key) : toggle(s.key))}
                className="pill"
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: `1.5px solid ${on ? COLORS.navy : COLORS.rule}`,
                  background: on ? COLORS.navy : "transparent",
                  color: on ? COLORS.onAccent : COLORS.slate,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {on ? "✓ " : "+ "}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {geral && (
        <RelatorioGeral
          escolas={escolas}
          periodo={periodo}
          comparar={comparar}
          dados={{ reclamacoes, audits, sanctions, inscritos, turmasAlunos, epocaAnterior, registoAlunos, desistencias, experiencias, satisfacao, inqueritos }}
          niveis={niveis}
          notas={notas}
          onGuardarNota={onGuardarNota}
          seccoes={seccoesGeral}
          epocasComparar={epocasComp}
        />
      )}
      {/* ---- Folha do relatório ---- */}
      {!geral && (
      <article className="relFolha" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 4, maxWidth: 880, margin: "0 auto", boxShadow: "0 1px 2px rgba(10,20,40,0.06), 0 12px 40px -12px rgba(10,20,40,0.18)", overflow: "hidden" }}>
       {/* A tabela só serve a impressão: repete uma margem no topo e um rodapé em cada página. */}
       <table className="relPaginas">
        <thead>
          <tr>
            <td>
              <div className="relEspaco" />
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td>
              <div className="relRodapeImp">
                <span>FC Porto · Dragon Force · Gestão da Qualidade</span>
                <span>
                  Relatório de escola · {escola} · {nomePeriodo(periodo)}
                </span>
              </div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td>
        <header className="relCapa">
          <div style={{ background: REL_AZUL, color: "#fff", display: "flex", alignItems: "center", gap: 14, padding: "14px 44px" }}>
            <LogoRel altura={30} cor="#fff" />
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", lineHeight: 1.5 }}>
              FC Porto · Dragon Force
              <div style={{ fontWeight: 500, opacity: 0.7, letterSpacing: "0.12em" }}>Gestão da Qualidade</div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.8 }}>Relatório de escola</div>
          </div>
          <div style={{ padding: "44px 44px 0" }}>
            <div className="relRotulo" style={{ color: azulRel() }}>
              {nomePeriodo(periodo)}
            </div>
            <h2 style={{ margin: "10px 0 10px", fontFamily: REL_SERIFA, fontSize: 40, fontWeight: 600, color: COLORS.ink, letterSpacing: "-0.015em", lineHeight: 1.05, textWrap: "balance" }}>{escola}</h2>
            <div style={{ fontSize: 13, color: COLORS.ink2 }}>
              Emitido a {geradoEm}
              {cls ? ` · ${cls.label.toLowerCase()} face ao mesmo período da época passada` : ""}
            </div>
            <div className="relCapaNumeros" style={{ display: "grid", gridTemplateColumns: `repeat(${comparar && posicaoGeral ? 6 : 5}, minmax(0, 1fr))`, marginTop: 34, borderTop: `2px solid ${REL_AZUL}`, borderBottom: `1px solid ${COLORS.rule}` }}>
              {[
                ["Alunos inscritos", fmtNum(m.alunos), null, periodo.startsWith("intervalo:") ? `a ${dataCurtaISO(dataRefPeriodo(periodo))}` : null],
                ["Face ao mesmo período", m.crescimento === null ? "—" : `${m.crescimento > 0 ? "+" : m.crescimento < 0 ? "−" : ""}${fmtNum(Math.abs(m.crescimento), 1)}%`, m.crescimento === null ? null : m.crescimento >= 0 ? REL_VERDE : REL_VERMELHO, textoBaseAnt(m.cmp)],
                ["Desistências", fmtNum(nDesist), null, [m.desistPct !== null ? `${fmtNum(m.desistPct, 1)}% dos alunos` : "", nDesistHom !== null ? `${fmtNum(nDesistHom)} em ${homologo}` : ""].filter(Boolean).join(" · ") || null],
                ["Reclamações", fmtNum(recl.length), null, m.reclPor100 !== null ? `${fmtNum(m.reclPor100, 1)} por 100 alunos` : null],
                ["Satisfação", m.satisfacao === null || m.satisfacao === undefined ? "—" : `${m.satisfacao}%`, null, "inquérito da escola"],
                ...(comparar && posicaoGeral ? [["Posição geral", `${ordinal(posicaoGeral.pos)}`, null, `entre ${posicaoGeral.de} escolas`]] : []),
              ].map(([l, v, c, sub], i) => (
                <div key={l} style={{ padding: "16px 16px 16px", paddingLeft: i ? 16 : 0, borderLeft: i ? `1px solid ${COLORS.rule}` : "none", minWidth: 0 }}>
                  <div className="relRotulo">{l}</div>
                  <div style={{ fontFamily: REL_SERIFA, fontSize: 26, fontWeight: 600, color: c || COLORS.ink, marginTop: 8, lineHeight: 1, fontVariantNumeric: "lining-nums tabular-nums" }}>{v}</div>
                  {sub && <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 6 }}>{sub}</div>}
                </div>
              ))}
            </div>
          </div>
        </header>
        <div className="relCorpo" style={{ padding: "0 44px 40px" }}>

        {ver("resumo") && (
          <SeccaoRel titulo="Resumo" nota={comparar ? `Comparação com as outras ${outras.length} escolas no mesmo período` : null}>
            <table className="relQuadro" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Indicador", "Valor", comparar ? "Posição entre escolas" : "", comparar ? "Face à média" : ""].map((h, i) => (
                    <th key={i} className="relRotulo" style={{ textAlign: i === 0 || i === 2 ? "left" : "right", padding: i === 0 ? "0 0 8px" : i === 3 ? "0 0 8px" : "0 12px 8px", borderBottom: `1px solid ${COLORS.ink}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparacoes.map((c) => (
                  <LinhaComparacaoRel key={c.key} c={c} comparar={comparar} />
                ))}
              </tbody>
            </table>
            {comparar && (fortes.length > 0 || fracos.length > 0) && (
              <div className="relFortes">
                {[
                  ["Pontos fortes", fortes, COLORS.ok],
                  ["A melhorar", fracos, COLORS.danger],
                ].map(([t, lista, cor]) => (
                  <div key={t} style={{ borderTop: `2px solid ${cor === COLORS.ok ? REL_VERDE : REL_VERMELHO}`, paddingTop: 12 }}>
                    <div className="relRotulo" style={{ color: cor === COLORS.ok ? REL_VERDE : REL_VERMELHO, marginBottom: 8 }}>{t}</div>
                    {lista.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: COLORS.slate }}>Nada que se destaque da média.</div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, lineHeight: 1.65, color: COLORS.ink }}>
                        {lista.map((c) => (
                          <li key={c.key}>
                            {c.label}: <strong>{fmtNum(c.v, c.dec ?? 0)}{c.unidade}</strong> contra {fmtNum(c.med, c.dec ?? 0)}
                            {c.unidade} de média{c.p ? ` (${ordinal(c.p.pos)} de ${c.p.de})` : ""}.
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
            <DestaquesRel
                itens={[
                  ...observacoesReclamacoes(recl),
                  ...observacoesAuditorias(constat),
                  ...inqEscola
                    .map((i) => ({ i, s: satisfacaoDe(i.perguntas || [], escola) }))
                    .filter((x) => x.s.pct !== null && x.s.pct < 70)
                    .map((x) => ({ nivel: "alarme", titulo: `${x.i.edicao}: ${x.s.pct}% de satisfação nesta escola`, texto: `Abaixo dos 70%, com ${x.i.segmentos[escola]} respostas de encarregados da escola.` })),
                ].slice(0, 6)}
              />
          </SeccaoRel>
        )}

        {epocasComp.length >= 2 && (() => {
          const cols = [...epocasComp].sort().reverse();
          const ms = Object.fromEntries(cols.map((ep) => [ep, metricasEscola(escola, `epoca:${ep}`, dados)]));
          const linhas = [{ key: "alunos", label: "Alunos inscritos", unidade: "", melhor: "alto" }, { key: "renovPct", label: "Renovaram", unidade: "%", melhor: "alto" }, ...METRICAS_COMP, { key: "reclamacoes", label: "Reclamações recebidas", unidade: "", melhor: "baixo" }];
          return (
            <SeccaoRel titulo="Evolução entre épocas" nota={cols.join(" · ")}>
              <table className="relQuadro" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Indicador", ...cols].map((h, i) => (
                      <th key={h} className="relRotulo" style={{ textAlign: i ? "right" : "left", padding: i ? "0 0 8px 12px" : "0 0 8px", borderBottom: `1px solid ${COLORS.ink}` }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((c) => (
                    <tr key={c.key}>
                      <td style={{ padding: "7px 0", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontSize: 12.5 }}>{c.label}</td>
                      {cols.map((ep, i) => {
                        const v = ms[ep][c.key];
                        const ref = ms[cols[0]][c.key];
                        const dif = i > 0 && v !== null && v !== undefined && ref !== null && ref !== undefined ? ref - v : null;
                        const bom = dif === null || dif === 0 ? null : c.melhor === "alto" ? dif > 0 : dif < 0;
                        return (
                          <td key={ep} style={{ padding: "7px 0 7px 12px", borderBottom: `1px solid ${COLORS.ruleSoft}`, textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: i ? 400 : 600 }}>
                            {v === null || v === undefined ? "—" : `${fmtNum(v, c.dec ?? 0)}${c.unidade}`}
                            {dif !== null && dif !== 0 && (
                              <span style={{ display: "block", fontSize: 10.5, color: bom ? REL_VERDE : REL_VERMELHO }}>
                                {cols[0]} {dif > 0 ? "+" : "−"}
                                {fmtNum(Math.abs(dif), c.dec ?? 0)}
                                {c.unidade === "%" ? " p.p." : ""}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 8 }}>Cada época completa. As diferenças dizem como {cols[0]} está face a cada época.</div>
            </SeccaoRel>
          );
        })()}

        {ver("reclamacoes") && (
          <SeccaoRel titulo="Reclamações" nota={`${recl.length} no período`}>
            <div className="relKpis">
              <KpiRel
                label="Recebidas"
                valor={fmtNum(recl.length)}
                comparacao={`${fmtNum(m.reclPor100, 1)} por 100 alunos`}
                extra={reclHom ? <VariacaoRel atual={recl.length} anterior={reclHom.length} bom="baixo" rotulo={`vs ${homologo}`} /> : null}
              />
              <KpiRel label="Em aberto" valor={fmtNum(reclAbertas.length)} cor={reclAbertas.some((r) => r.derivedStatus === "atrasado") ? COLORS.danger : COLORS.ink} comparacao={`${reclAbertas.filter((r) => r.derivedStatus === "atrasado").length} fora do prazo`} />
              <KpiRel label="Resolvidas no prazo" valor={fmtNum(m.prazo)} unidade="%" comparacao={txtComp(kpi("prazo"))} />
              <KpiRel label="Tempo médio de resolução" valor={fmtNum(tempoRes)} unidade=" dias" />
              <KpiRel label="Respostas eficazes" valor={fmtNum(eficazes)} unidade="%" />
            </div>
            {recl.length > 0 && (
              <div className="relGrelha" style={{ marginBottom: 14 }}>
                <div>
                  <div className="relSub">Gravidade</div>
                  <BarraPartesRel
                    partes={["alta", "media", "baixa"].map((k) => ({ label: SEVERITY_META[k].label, valor: recl.filter((r) => r.severity === k).length, cor: { alta: REL_VERMELHO, media: "#C58A1A", baixa: "#9DB5DD" }[k] }))}
                  />
                </div>
                <div>
                  <div className="relSub">Canal de entrada</div>
                  <BarraPartesRel
                    partes={contar(recl, "canal")
                      .slice(0, 5)
                      .map((x, i) => ({ label: CANAL_META[x.name]?.label || x.name, valor: x.value, cor: [REL_AZUL, REL_AZUL2, "#5C84C2", "#9DB5DD", "#CBD8EE"][i] }))}
                  />
                </div>
              </div>
            )}
            <div className="relGrelha">
              <div>
                <div className="relSub">Por tema</div>
                <BarrasRel dados={contar(recl, "tema").slice(0, 8)} largura={180} />
              </div>
              <div>
                <div className="relSub">Por mês</div>
                {reclMes.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={reclMes.map((x) => ({ ...x, name: x.name.slice(5) + "/" + x.name.slice(2, 4) }))} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} />
                      <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
                      <Bar dataKey="value" name="Reclamações" fill={azulRel()} barSize={16} isAnimationActive={false}>
                        <LabelList dataKey="value" position="top" style={{ fontSize: 11.5, fontWeight: 700, fill: COLORS.ink }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem registos no período.</div>
                )}
              </div>
            </div>
            <div className="relSub" style={{ marginTop: 18 }}>Em aberto</div>
            <TabelaRel
              colunas={["Nº", "Receção", "Tema", "Gravidade", "Estado", "Prazo"]}
              vazio="Nenhuma reclamação em aberto."
              linhas={reclAbertas
                .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
                .map((r) => [
                  String(r.entryNumber).padStart(4, "0"),
                  fmt(new Date(r.receivedDate + "T00:00:00")),
                  r.tema || "—",
                  SEVERITY_META[r.severity]?.label || "—",
                  <span style={{ color: STATUS_META[r.derivedStatus]?.color, fontWeight: 600 }}>{STATUS_META[r.derivedStatus]?.label}</span>,
                  fmt(new Date(r.deadline)),
                ])}
            />
          </SeccaoRel>
        )}

        {ver("auditorias") && (
          <SeccaoRel titulo="Auditorias" nota={auds[0] ? `Última auditoria a ${fmt(new Date(auds[0].date + "T00:00:00"))}` : "Sem auditorias registadas"}>
            <div className="relKpis">
              <KpiRel label="Auditorias no período" valor={fmtNum(audsPeriodo.length)} />
              {["NCM", "NC", "OM", "AS"].map((c) => (
                <KpiRel key={c} label={CLASSIFICATION_META[c].label} valor={fmtNum(constat.filter((f) => f.classification === c).length)} cor={c === "NCM" && constat.some((f) => f.classification === "NCM") ? COLORS.danger : COLORS.ink} />
              ))}
              <KpiRel
                label="Resolvidas"
                valor={fmtNum(pct(constat.filter((f) => f.resolvida).length, constat.length))}
                unidade="%"
                comparacao={constat.length ? `eficazes ${fmtNum(pct(constat.filter((f) => f.eficacia === "eficaz").length, constat.filter((f) => f.resolvida).length))}%` : "Sem constatações no período"}
              />
            </div>
            <div className="relGrelha">
              <div>
                <div className="relSub">Constatações por área</div>
                <BarrasRel dados={contar(constat, "area")} />
              </div>
              <div>
                <div className="relSub">Por resolver (todas as auditorias)</div>
                <TabelaRel
                  colunas={["Classificação", "Área", "Constatação", "Prazo"]}
                  vazio="Todas as constatações estão resolvidas."
                  linhas={porResolver
                    .sort((a, b) => (ordemCls[a.classification] ?? 9) - (ordemCls[b.classification] ?? 9))
                    .slice(0, 10)
                    .map((f) => [
                      <strong style={{ fontSize: 11.5, color: corRel(CLASSIFICATION_META[f.classification]?.color) || CLASSIFICATION_META[f.classification]?.color }}>{f.classification}</strong>,
                      f.area || "—",
                      f.description,
                      f.prazo ? <span style={{ color: f.prazo < isoDe(new Date()) ? REL_VERMELHO : COLORS.ink, fontWeight: f.prazo < isoDe(new Date()) ? 600 : 400 }}>{fmt(new Date(f.prazo + "T00:00:00"))}</span> : "—",
                    ])}
                />
              </div>
            </div>
          </SeccaoRel>
        )}

        {ver("inscritos") && (
          <SeccaoRel titulo="Inscritos e turmas" nota={`${new Set(turmas.map((t) => t.turma)).size} turmas`}>
            <div className="relKpis">
              <KpiRel label="Alunos" valor={fmtNum(m.alunos)} comparacao={tPeriodo.fonte === "sem" ? `sem alunos importados em ${tPeriodo.ep}` : m.ant ? `mesmo período: ${textoBaseAnt(m.cmp)}` : null} />
              <KpiRel label="Em turmas" valor={fmtNum(pct(escolinha, masc + fem))} unidade="%" comparacao={`${fmtNum(escolinha)} alunos · ${fmtNum(masc + fem - escolinha)} em equipas de competição`} />
              <KpiRel label="Género feminino" valor={fmtNum(pct(fem, masc + fem))} unidade="%" comparacao={`${fmtNum(fem)} de ${fmtNum(masc + fem)}`} />
              {m.renovPct !== null && <KpiRel label="Renovaram" valor={fmtNum(m.renovPct)} unidade="%" comparacao={`${fmtNum(m.novos)} inscrições novas`} />}
              <KpiRel label="Turmas cheias" valor={fmtNum(cheias.length)} comparacao={`95% ou mais da capacidade${sobrelotadas.length ? ` · ${sobrelotadas.length} em sobrelotação` : ""}`} cor={cheias.length ? COLORS.warn : COLORS.ink} />
              <KpiRel label="Turmas abaixo de 50%" valor={fmtNum(vazias.length)} comparacao="sem as equipas de competição" cor={vazias.length ? COLORS.warn : COLORS.ink} />
              {tPeriodo.ep === epocaAtual && (() => {
                const pv = preverEscola({ escola, inscritos, epocaAnterior, experiencias, turmasAlunos, niveis: niveis || DEFAULT_NIVEIS, hoje: isoDe(new Date()) });
                if (pv.insuficiente) return <KpiRel label="Previsão para julho" valor="—" comparacao="Faltam semanas desta época" />;
                return (
                  <KpiRel
                    label="Previsão para julho"
                    valor={fmtNum(pv.previsao)}
                    cor={pv.variacao === null ? COLORS.ink : pv.variacao >= 0 ? COLORS.ok : COLORS.danger}
                    comparacao={`entre ${pv.baixo} e ${pv.alto}${pv.variacao !== null ? ` · ${pv.variacao > 0 ? "+" : ""}${fmtNum(pv.variacao, 1)}% vs época passada` : ""}`}
                  />
                );
              })()}
            </div>
            <div className="relGrelha">
              <div>
                <div className="relSub">Evolução semanal</div>
                {serie.length > 1 ? (
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart data={serie} margin={{ left: 0, right: 18, top: 6 }}>
                      <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.rule }} tickLine={false} interval={Math.max(0, Math.ceil(serie.length / 6) - 1)} />
                      <YAxis tick={{ fontSize: 10.5, fill: COLORS.slate }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                      <Tooltip content={<DicaGrafico />} />
                      {m.ant && <ReferenceLine y={m.ant} stroke={COLORS.slate} strokeDasharray="4 4" label={{ value: "Época passada", position: "insideTopLeft", fontSize: 10, fill: COLORS.slate }} />}
                      <Area type="monotone" dataKey="Inscritos" stroke={azulRel()} strokeWidth={1.75} fill={azulRel()} fillOpacity={0.06} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ fontSize: 12.5, color: COLORS.slate }}>Importa o ficheiro de inscritos desta época para ver a evolução.</div>
                )}
              </div>
              <div>
                <div className="relSub">Alunos por escalão</div>
                <BarrasRel dados={porEscalao} largura={90} />
              </div>
            </div>
            <div className="relGrelha" style={{ marginTop: 14, gridTemplateColumns: "minmax(0, 1fr)" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <div className="relSub">Ocupação das turmas</div>
                  <div style={{ display: "flex", gap: 14, fontSize: 11, color: COLORS.slate, marginBottom: 10 }}>
                    {[
                      ["#9A6200", "95% ou mais"],
                      [azulRel(), "50% a 94%"],
                      [COLORS.slate, "abaixo de 50%"],
                    ].map(([c, t]) => (
                      <span key={t} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 8, height: 8, background: c }} />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <LotacaoRel lotacao={lotacao} />
                {masc + fem > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div className="relSub">Género</div>
                    <BarraPartesRel
                      partes={[
                        { label: "Masculino", valor: masc, cor: REL_AZUL },
                        { label: "Feminino", valor: fem, cor: "#9DB5DD" },
                      ]}
                    />
                  </div>
                )}
              </div>
            </div>
          </SeccaoRel>
        )}

        {ver("movimentos") && (
          <SeccaoRel titulo="Desistências, experiências e desvinculações">
            <div className="relKpis">
              <KpiRel label="Desistências" valor={fmtNum(nDesist)} comparacao={`${fmtNum(m.desistPct, 1)}% dos alunos`} cor={kpi("desistPct").estado === "pior" && comparar ? COLORS.danger : COLORS.ink} />
              <KpiRel label="Experiências" valor={fmtNum(somaXp())} comparacao={`${somaXp("sucesso")} converteram · ${somaXp("pendente")} por avaliar`} />
              <KpiRel label="Conversão" valor={fmtNum(m.conversao)} unidade="%" comparacao={txtComp(kpi("conversao"))} />
              <KpiRel label="Pedidos de desvinculação" valor={fmtNum(desv.length)} comparacao={`${desv.filter((v) => v.aceite === true).length} aceites · ${desv.filter((v) => v.cedida).length} cedidos`} />
            </div>
            <div className="relGrelha">
              <div>
                <div className="relSub">Motivos de desistência</div>
                <BarrasRel dados={contar(desist.map((x) => ({ ...x, __peso: x.n })), "motivo")} largura={190} />
              </div>
              <div>
                <div className="relSub">Clubes de destino</div>
                <BarrasRel dados={contar(desv, "clubeDestino")} largura={120} />
              </div>
            </div>
          </SeccaoRel>
        )}

        {ver("satisfacao") && (
          <SeccaoRel titulo="Satisfação e inquéritos" nota={m.satisfacao !== null ? `Satisfação média de ${m.satisfacao}%` : null}>
            {(() => {
              const respostas = inqEscola.reduce((n, i) => n + (i.segmentos[escola] || 0), 0);
              const nps = inqEscola.length ? npsDe(inqEscola.map((i) => ({ perguntas: (i.perguntas || []).map((q) => ({ ...q, contagens: (q.porSegmento || {})[escola] || {} })) }))) : null;
              const satEventos = inqEscola.length ? satisfacaoDe(inqEscola.flatMap((i) => i.perguntas || []), escola).pct : null;
              if (m.satisfacao === null && !inqEscola.length) return null;
              return (
                <div className="relGrelha" style={{ marginBottom: 14 }}>
                  <div>
                    <div className="relSub">Inquérito da escola</div>
                    <AnelRel valor={m.satisfacao} cor={corSatisfacao(m.satisfacao)} rotulo={comparar && kpi("satisfacao").med !== null ? `Média das outras escolas: ${fmtNum(kpi("satisfacao").med)}%${kpi("satisfacao").p ? ` · ${ordinal(kpi("satisfacao").p.pos)} de ${kpi("satisfacao").p.de}` : ""}` : "Satisfação média no período"} />
                  </div>
                  <div>
                    <div className="relSub">Eventos e campos</div>
                    <AnelRel
                      valor={satEventos}
                      cor={corSatisfacao(satEventos)}
                      rotulo={
                        inqEscola.length ? (
                          <>
                            {inqEscola.length} evento{inqEscola.length === 1 ? "" : "s"} · {respostas} respostas de encarregados da escola
                            {nps ? (
                              <>
                                <br />
                                NPS <strong style={{ color: nps.valor >= 50 ? COLORS.ok : nps.valor >= 0 ? COLORS.warn : COLORS.danger }}>{nps.valor > 0 ? "+" : ""}{nps.valor}</strong>
                              </>
                            ) : null}
                          </>
                        ) : (
                          "Sem inquéritos de eventos com esta escola no período"
                        )
                      }
                    />
                  </div>
                </div>
              );
            })()}
            <div className="relGrelha">
              <div>
                <div className="relSub">Inquérito da escola, por categoria</div>
                <BarrasRel dados={satCategorias} largura={190} sufixo="%" />
              </div>
              <div>
                <div className="relSub">Eventos com participantes da escola</div>
                <TabelaRel
                  colunas={["Evento", "Respostas", "Satisfação", "NPS"]}
                  vazio="Nenhum inquérito de evento com esta escola no período."
                  linhas={inqEscola.map((i) => {
                    const s = satisfacaoDe(i.perguntas || [], escola);
                    const n = npsDe([{ perguntas: (i.perguntas || []).map((q) => ({ ...q, contagens: (q.porSegmento || {})[escola] || {} })) }]);
                    return [i.edicao, i.segmentos[escola], <strong style={{ color: corSatisfacao(s.pct) }}>{s.pct ?? "—"}%</strong>, n ? n.valor : "—"];
                  })}
                />
              </div>
            </div>
            {comentarios.length > 0 && (
              <>
                <div className="relSub" style={{ marginTop: 18 }}>O que disseram os encarregados ({comentarios.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 8 }}>
                  {comentarios.slice(0, 8).map((c, i) => (
                    <div key={i} style={{ fontFamily: REL_SERIFA, fontStyle: "italic", fontSize: 14, padding: "4px 0 4px 14px", borderLeft: `2px solid ${azulRel()}`, lineHeight: 1.5, color: COLORS.ink }}>
                      “{c.texto}”
                      <div style={{ fontStyle: "normal", color: COLORS.slate, fontSize: 10.5, marginTop: 2, fontFamily: "'Inter', system-ui, sans-serif" }}>{c.edicao}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SeccaoRel>
        )}

        {ver("avaliacoes") && (() => {
          const av = (avaliacoes && avaliacoes.itens) || [];
          const vis = (avaliacoes && avaliacoes.visitas) || [];
          const dela = av.filter((x) => x.escola === escola && x.data && dentroPeriodo(periodo, x.data)).sort((a, b) => String(a.data).localeCompare(String(b.data)));
          const visEsc = vis.filter((x) => x.escola === escola && dentroPeriodo(periodo, x.data));
          if (!dela.length && !visEsc.length) return null;
          const media = (n) => {
            const v = Object.values(n || {}).map(Number).filter((x) => x > 0);
            return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
          };
          const f = (x) => (x === null ? "—" : x.toFixed(1).replace(".", ","));
          const cor = (x) => (x === null ? COLORS.slate : x >= 4 ? COLORS.ok : x >= 3 ? COLORS.warn : COLORS.danger);
          const th = { textAlign: "left", padding: "6px 8px", borderBottom: `1px solid ${COLORS.ink}`, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: COLORS.slate };
          const td = { padding: "7px 8px", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontSize: 13 };
          const blocos = [["operacional", "Operacionais"], ["tecnica", "Área técnica"]];
          return (
            <SeccaoRel titulo="Avaliações do staff" nota={`${dela.length} ${dela.length === 1 ? "avaliação" : "avaliações"} · ${visEsc.length} ${visEsc.length === 1 ? "visita" : "visitas"} no período`}>
              {blocos.map(([area, rot]) => {
                const l = dela.filter((x) => x.area === area);
                if (!l.length) return null;
                const crit = [...new Set(l.flatMap((x) => Object.keys(x.notas || {})))];
                return (
                  <div key={area} style={{ marginBottom: 18 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: COLORS.navy }}>{rot}</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["Data", "Avaliado", "Tipo", ...crit, "Média", "Avaliou"].map((h) => (
                              <th key={h} style={th}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {l.map((x) => (
                            <tr key={x.id}>
                              <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(new Date(String(x.data).slice(0, 10) + "T00:00:00"))}</td>
                              <td style={{ ...td, fontWeight: 700 }}>{x.avaliado}</td>
                              <td style={td}>{x.momento === "intermedia" ? "Intermédia" : "Avaliação"}</td>
                              {crit.map((k) => (
                                <td key={k} style={{ ...td, textAlign: "center" }}>{(x.notas || {})[k] ?? ""}</td>
                              ))}
                              <td style={{ ...td, textAlign: "center", fontWeight: 700, color: cor(media(x.notas)) }}>{f(media(x.notas))}</td>
                              <td style={td}>{(x.avaliadores || []).join(", ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {visEsc.length > 0 && (
                <div style={{ fontSize: 13, color: COLORS.ink2, lineHeight: 1.6 }}>
                  <strong>Visitas à escola:</strong>{" "}
                  {[...visEsc]
                    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
                    .map((v) => fmt(new Date(String(v.data).slice(0, 10) + "T00:00:00")) + (v.duracao ? ` (${v.duracao})` : ""))
                    .join(" · ")}
                </div>
              )}
            </SeccaoRel>
          );
        })()}

        {ver("causas") && (
          <SeccaoRel titulo="Causa raiz" nota="Reclamações concluídas e constatações resolvidas no período">
            {(() => {
              const itens = itensCausa(recl, audsPeriodo);
              const semCausa = itens.filter((i) => !i.causa).length;
              return (
                <div className="relGrelha">
                  <div>
                    <div className="relSub">Reclamações</div>
                    <BarrasRel dados={contar(itens.filter((i) => i.origem === "Reclamações"), "causa")} largura={170} />
                  </div>
                  <div>
                    <div className="relSub">Constatações de auditoria</div>
                    <BarrasRel dados={contar(itens.filter((i) => i.origem === "Auditorias"), "causa")} largura={170} />
                    {semCausa > 0 && <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 8 }}>{semCausa} sem causa raiz indicada</div>}
                  </div>
                </div>
              );
            })()}
          </SeccaoRel>
        )}

        {ver("sancoes") && (
          <SeccaoRel titulo="Sanções" nota={`${sanc.length} ocorrência${sanc.length === 1 ? "" : "s"} no período`}>
            <TabelaRel
              colunas={["Data", "Envolvido", "Motivo", "Situação"]}
              vazio="Sem ocorrências disciplinares no período."
              linhas={sanc
                .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                .map((s) => [
                  fmt(new Date(s.date + "T00:00:00")),
                  `${(PERSON_TYPE_META[s.personType] || PERSON_TYPE_META.familia).label}: ${nomeOcorrencia(s)}`,
                  (MOTIVO_META[s.motivo] || MOTIVO_META.outro).label,
                  s.personType === "elemento_df" ? DF_STAGE_META[s.stage]?.label || "Ocorrência registada" : s.sanctionApplied === true ? s.sanctionType || "Sanção aplicada" : s.sanctionApplied === false ? "Sem sanção" : "Por decidir",
                ])}
            />
          </SeccaoRel>
        )}

        {ver("acompanhar") &&
          (() => {
            const itens = [];
            reclAtrasadas.forEach((r) => itens.push({ nivel: "alto", t: `Reclamação ${String(r.entryNumber).padStart(4, "0")} (${r.tema || r.categoria || "sem tema"}) fora do prazo desde ${fmt(new Date(r.deadline))}` }));
            reclAbertas
              .filter((r) => r.derivedStatus !== "atrasado")
              .forEach((r) => itens.push({ nivel: "medio", t: `Reclamação ${String(r.entryNumber).padStart(4, "0")} (${r.tema || r.categoria || "sem tema"}) com prazo a ${fmt(new Date(r.deadline))}` }));
            if (porResolver.length) {
              const porCls = ["NCM", "NC", "OM", "AS"].map((c) => [c, porResolver.filter((f) => f.classification === c).length]).filter(([, n]) => n);
              itens.push({ nivel: porResolver.some((f) => f.classification === "NCM" || f.classification === "NC") ? "alto" : "medio", t: `${porResolver.length} ${porResolver.length === 1 ? "constatação" : "constatações"} de auditoria por resolver (${porCls.map(([c, n]) => `${n} ${c}`).join(", ")})` });
            }
            if (comparar) fracos.forEach((c) => itens.push({ nivel: "medio", t: `${c.label}: ${fmtNum(c.v, c.dec ?? 0)}${c.unidade}, contra ${fmtNum(c.med, c.dec ?? 0)}${c.unidade} de média nas outras escolas` }));
            inqEscola
              .map((i) => ({ i, s: satisfacaoDe(i.perguntas || [], escola) }))
              .filter((x) => x.s.pct !== null && x.s.pct < 70)
              .forEach((x) => itens.push({ nivel: "medio", t: `${x.i.edicao}: ${x.s.pct}% de satisfação entre os encarregados da escola` }));
            sobrelotadas.forEach((t) => itens.push({ nivel: "medio", t: `${t.turma} em sobrelotação: ${t.n} alunos para ${t.cap} lugares` }));
            const motivoTop = contar(desist.map((x) => ({ ...x, __peso: x.n })), "motivo")[0];
            if (motivoTop && motivoTop.value >= 2) itens.push({ nivel: "baixo", t: `Principal motivo de desistência: ${motivoTop.name.toLowerCase()} (${motivoTop.value})` });
            const corN = { alto: REL_VERMELHO, medio: "#C58A1A", baixo: COLORS.slate };
            return (
              <SeccaoRel titulo="Pontos a acompanhar" nota="Gerados a partir dos dados do período">
                {itens.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.ink2 }}>Nada pendente nesta escola.</div>
                ) : (
                  <div>
                    {itens.map((it, i) => (
                      <div key={i} className="relLinhaComp" style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "10px 0", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontSize: 13, lineHeight: 1.5, color: COLORS.ink }}>
                        <span style={{ width: 13, height: 13, border: `1px solid ${COLORS.ink2}`, flex: "none", marginTop: 3 }} />
                        <span style={{ flex: 1 }}>{it.t}</span>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: corN[it.nivel], flex: "none", marginTop: 6 }} title={it.nivel} />
                      </div>
                    ))}
                  </div>
                )}
              </SeccaoRel>
            );
          })()}

        {ver("notas") && (
          <SeccaoRel titulo="Notas e conclusões" nota="Ficam guardadas para esta escola e este período">
            <textarea
              id="rel-notas"
              className="relSoEcra"
              rows={5}
              value={nota}
              placeholder="Conclusões, próximos passos, responsáveis…"
              onChange={(e) => setNota(e.target.value)}
              onBlur={() => {
                if ((notas[chaveNota] || "") !== nota) onGuardarNota(chaveNota, nota);
              }}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.55 }}
            />
            <div className="relSoImpressao" style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {nota ||
                Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 30, borderBottom: `1px solid ${COLORS.rule}` }} />)}
            </div>
          </SeccaoRel>
        )}
          <div className="relFimEcra" style={{ marginTop: 44, paddingTop: 14, borderTop: `1px solid ${COLORS.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10.5, color: COLORS.slate, letterSpacing: "0.04em" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LogoRel altura={18} cor={COLORS.slate} />
              FC Porto · Dragon Force · Gestão da Qualidade
            </span>
            <span>
              {escola} · {nomePeriodo(periodo)}
            </span>
          </div>
        </div>
            </td>
          </tr>
        </tbody>
       </table>
      </article>
      )}
    </div>
  );
}
