// Sistema de gestão: Mapa de objetivos (DFF.024) e Controlo e gestão documental (DFF.001).
// Lógica sem React: ler os Excel dos documentos, calcular o acompanhamento com os dados
// da app e gerar os Excel no mesmo formato. Recebe o ExcelJS por parâmetro (carregado
// só quando é preciso, como nos riscos).

const norm = (t) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const txt = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.result !== undefined) return txt(v.result);
    return "";
  }
  return String(v);
};
const limpa = (s) => String(s ?? "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
const novoId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Valor de uma célula já calculado (resultado da fórmula, se for fórmula).
function valorDe(cel) {
  const v = cel.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.formula !== undefined || v.sharedFormula !== undefined) {
      const r = v.result;
      if (r === undefined || r === null) return null;
      if (typeof r === "object" && r.error) return null;
      return r;
    }
    if (v.text !== undefined) return v.text;
    if (v.error) return null;
    return null;
  }
  return v;
}
const formulaDe = (cel) => {
  try {
    return cel.type === 6 ? cel.formula || null : null;
  } catch (e) {
    return null;
  }
};
const numOuNull = (v) => (typeof v === "number" && isFinite(v) ? v : null);

// "2025/26" <-> "2025-2026" (nome das folhas) e "2025/2026" (título).
export const folhaObjetivos = (ep) => `${ep.slice(0, 4)}-${Number(ep.slice(0, 4)) + 1}`;
export const epocaLongaObj = (ep) => `${ep.slice(0, 4)}/${Number(ep.slice(0, 4)) + 1}`;
export const epocaSeguinteObj = (ep) => `${Number(ep.slice(0, 4)) + 1}/${String(Number(ep.slice(0, 4)) + 2).slice(2)}`;
function epocaDaFolha(nome) {
  const m = String(nome).trim().match(/^(\d{4})\s*[-/]\s*(\d{2,4})$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2].length === 2 ? `20${m[2]}` : m[2]);
  return b === a + 1 ? `${a}/${String(b).slice(2)}` : null;
}

// ======================================================================
// MAPA DE OBJETIVOS
// ======================================================================
export const MESES_OBJ = ["S", "O", "N", "D", "J", "F", "M", "A", "M", "J", "J", "A"];
export const NOMES_MESES_OBJ = ["set", "out", "nov", "dez", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago"];
// Coluna do acompanhamento (0 = setembro … 11 = agosto) de uma data dentro da época.
// Agosto do início da época conta em setembro (o arranque).
export function colunaMes(dataIso) {
  const m = Number(String(dataIso || "").slice(5, 7));
  if (!m) return null;
  if (m >= 9) return m - 9;
  if (m <= 7) return m + 3;
  return 0;
}

// Fórmulas guardadas relativas à linha: "W{r-2}-W{r-1}". Assim continuam certas quando
// as linhas mudam de sítio no Excel gerado.
function relativa(formula, linha) {
  return String(formula).replace(/(\$?[A-Z]{1,3})(\$?)(\d+)/g, (m, col, d, n) => {
    const k = Number(n) - linha;
    return `${col}${d}{r${k === 0 ? "" : k > 0 ? `+${k}` : k}}`;
  });
}
function absoluta(modelo, linha) {
  return String(modelo).replace(/\{r([+-]\d+)?\}/g, (m, k) => String(linha + (k ? Number(k) : 0)));
}
const refsLonge = (formula, linha) => (String(formula).match(/[A-Z]{1,3}(\d+)/g) || []).some((r) => Math.abs(Number(r.replace(/[A-Z]/g, "")) - linha) > 3) || /#REF!/.test(formula);

// Como se calcula o TOTAL (coluna W) de uma linha.
export const MODOS_TOTAL = {
  soma: "Soma dos meses",
  media: "Média dos meses",
  ultimo: "Último mês com valor",
  diferenca: "Inscrições − desistências (do grupo)",
  porInscritos: "Soma dos meses ÷ alunos ativos",
  razao: "Soma dos meses ÷ valor fixo",
  formula: "Fórmula do documento",
  valor: "Valor escrito à mão",
};
function modoDoTotal(formula, linha, valor) {
  if (!formula) return { totalModo: valor !== null && valor !== undefined && valor !== "" ? "valor" : "soma" };
  const f = formula.replace(/\s+/g, "").toUpperCase();
  if (/^SUM\([A-Z]+\d+:[A-Z]+\d+\)$/.test(f)) return { totalModo: "soma" };
  if (/^(IFERROR\()?AVERAGE\([A-Z]+\d+:[A-Z]+\d+\)(,"*"\))?$/.test(f)) return { totalModo: "media" };
  const dif = f.match(/^W(\d+)-W(\d+)$/);
  if (dif && Number(dif[1]) < linha && Number(dif[2]) < linha) return { totalModo: "diferenca" };
  const raz = f.match(/^SUM\([A-Z]+\d+:[A-Z]+\d+\)\/(.+)$/);
  if (raz) {
    if (/[A-Z]+\d+|#REF/.test(raz[1])) return { totalModo: "porInscritos" };
    let den = null;
    try {
      // Só números e operadores: seguro de avaliar.
      if (/^[\d.()+\-*/ ]+$/.test(raz[1])) den = Function(`"use strict";return (${raz[1]});`)();
    } catch (e) {
      den = null;
    }
    return { totalModo: "razao", totalDenominador: numOuNull(den), totalDenominadorTexto: raz[1] };
  }
  if (refsLonge(formula, linha)) return { totalModo: "valor" };
  return { totalModo: "formula", totalFormula: relativa(formula, linha) };
}
function modoDoX(formula, linha) {
  if (!formula) return null;
  const f = formula.replace(/\s+/g, "").toUpperCase().replace(/^IFERROR\((.*),""\)$/, "$1");
  if (/^W\d+\/SUM\(W\d+:W\d+\)$/.test(f)) return "taxa";
  if (new RegExp(`^W${linha}/D${linha}$`).test(f)) return "cumprimento";
  return null;
}

// Cores do tema do livro (para guardar as cores das linhas tal como estão no documento).
function coresDoTema(wb) {
  const xml = (wb._themes && Object.values(wb._themes)[0]) || "";
  const bloco = (String(xml).match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/) || [""])[0];
  const cor = (n, def) => {
    const m = bloco.match(new RegExp(`<a:${n}>[\\s\\S]*?(?:lastClr|val)="([0-9A-Fa-f]{6})"`));
    return m ? m[1].toUpperCase() : def;
  };
  return [cor("lt1", "FFFFFF"), cor("dk1", "000000"), cor("lt2", "EEECE1"), cor("dk2", "1F497D"), cor("accent1", "4F81BD"), cor("accent2", "C0504D"), cor("accent3", "9BBB59"), cor("accent4", "8064A2"), cor("accent5", "4BACC6"), cor("accent6", "F79646")];
}
const INDEXADAS = { 8: "000000", 9: "FFFFFF", 22: "C0C0C0", 13: "FFFF00", 43: "FFFF99", 44: "99CCFF", 26: "FFFFCC", 27: "CCFFFF", 42: "CCFFCC", 47: "FFCC99", 45: "FF99CC", 46: "CC99FF" };
function corDoPreenchimento(fill, tema) {
  if (!fill || fill.type !== "pattern" || fill.pattern !== "solid" || !fill.fgColor) return null;
  const f = fill.fgColor;
  let hex = null;
  if (f.argb) hex = f.argb.slice(-6);
  else if (f.theme !== undefined) hex = tema[f.theme] || null;
  else if (f.indexed !== undefined) hex = INDEXADAS[f.indexed] || null;
  if (!hex) return null;
  const t = Number(f.tint) || 0;
  const ch = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16)).map((c) => Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t));
  const out = ch.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("").toUpperCase();
  return out === "FFFFFF" ? null : `FF${out}`;
}

// Lê todas as folhas de época do Mapa de objetivos.
export function lerObjetivosDoExcel(wb) {
  const epocas = {};
  const avisos = [];
  const tema = coresDoTema(wb);
  wb.eachSheet((ws) => {
    if (ws.state && ws.state !== "visible") return;
    const ep = epocaDaFolha(ws.name);
    if (!ep) return;
    // Linha de cabeçalho: a que tem "Objectivo" e "TOTAL".
    let hr = null;
    for (let r = 1; r <= Math.min(ws.rowCount, 12) && !hr; r++) {
      const vals = [];
      ws.getRow(r).eachCell({ includeEmpty: false }, (c) => vals.push(norm(txt(c.value))));
      if (vals.some((v) => /^objec?tivo$/.test(v)) && vals.includes("total")) hr = r;
    }
    if (!hr) return avisos.push(`Folha ${ws.name}: não encontrei o cabeçalho.`);
    const col = {};
    const cab = ws.getRow(hr);
    const cols = [];
    cab.eachCell({ includeEmpty: true }, (c, j) => (cols[j] = norm(txt(c.value))));
    const largura = Math.max(cols.length, 24);
    for (let j = 1; j < largura; j++) {
      const t = cols[j] || "";
      const marca = (k) => col[k] === undefined && (col[k] = j);
      if (/intencao/.test(t)) marca("intencao");
      else if (/^objec?tivo$/.test(t)) marca("objetivo");
      else if (/^meta 2$/.test(t)) marca("meta2");
      else if (/^meta/.test(t)) marca("meta");
      else if (/processo/.test(t)) marca("processo");
      else if (/responsavel/.test(t)) marca("responsavel");
      else if (/meios/.test(t)) marca("meios");
      else if (/actividades|atividades/.test(t)) marca("atividades");
      else if (/^prazo/.test(t)) marca("prazo");
      else if (/monitoriza/.test(t)) marca("monitorizacao");
      else if (t === "total") marca("total");
    }
    if (col.objetivo === undefined || col.total === undefined) return avisos.push(`Folha ${ws.name}: faltam colunas.`);
    col.indicador = col.objetivo + 1;
    col.mes0 = col.total - 12;
    col.x = col.total + 1;
    const titulo = (() => {
      for (let r = 1; r < hr; r++) {
        let t = "";
        ws.getRow(r).eachCell({ includeEmpty: false }, (c) => {
          if (!t && /mapa de objec?tivos/i.test(txt(c.value))) t = txt(c.value).trim();
        });
        if (t) return t;
      }
      return "";
    })();

    // Células unidas: cada linha sabe a que "bloco" pertence em A (intenção) e B (objetivo).
    const mestre = {};
    Object.values(ws._merges || {}).forEach((m) => {
      const mm = m.model || m;
      for (let r = mm.top; r <= mm.bottom; r++) for (let c = mm.left; c <= mm.right; c++) mestre[`${r}:${c}`] = { r: mm.top, c: mm.left, ate: mm.bottom };
    });
    const doBloco = (r, c) => mestre[`${r}:${c}`] || null;

    const itens = [];
    let intencaoAtual = "";
    let grupoAtual = null;
    let mestreGrupo = null;
    let objetivoAtual = "";
    for (let r = hr + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const g = (c) => (c ? limpa(txt(valorDe(row.getCell(c)) ?? "")) : "");
      // Cabeçalho repetido a meio da folha (quebra de página): ignora.
      if (/^objec?tivo$/i.test(g(col.objetivo)) && /total/i.test(g(col.total))) continue;
      const temTexto = [col.intencao, col.objetivo, col.indicador, col.meta, col.processo, col.responsavel].some((c) => c && g(c));
      if (!temTexto) continue;
      const bA = col.intencao ? doBloco(r, col.intencao) : null;
      if (col.intencao && g(col.intencao) && (!bA || bA.r === r)) intencaoAtual = g(col.intencao);
      // Grupo: as linhas que partilham a célula do objetivo (unida) ou que não têm objetivo próprio.
      const bB = doBloco(r, col.objetivo);
      const chave = bB ? `${bB.r}` : g(col.objetivo) ? `l${r}` : null;
      if (chave === null) {
        if (!grupoAtual) grupoAtual = novoId("g");
      } else if (chave !== mestreGrupo) {
        grupoAtual = novoId("g");
        mestreGrupo = chave;
        objetivoAtual = g(col.objetivo) || (bB ? limpa(txt(valorDe(ws.getRow(bB.r).getCell(col.objetivo)) ?? "")) : "");
      }
      const cel = (c) => row.getCell(c);
      const metaCel = col.meta ? cel(col.meta) : null;
      const metaF = metaCel ? formulaDe(metaCel) : null;
      const metaV = metaCel ? valorDe(metaCel) : null;
      const totalCel = cel(col.total);
      const totalF = formulaDe(totalCel);
      const totalV = valorDe(totalCel);
      const xCel = cel(col.x);
      const xF = formulaDe(xCel);
      const meses = [];
      let mesFmt = "";
      for (let k = 0; k < 12; k++) {
        const c = cel(col.mes0 + k);
        const v = valorDe(c);
        meses.push(v instanceof Date ? v.toISOString().slice(0, 10) : v === "" ? null : v);
        if (!mesFmt && c.numFmt) mesFmt = c.numFmt;
      }
      const item = {
        id: novoId("obj"),
        intencao: intencaoAtual,
        objetivo: g(col.objetivo) || objetivoAtual,
        grupo: grupoAtual,
        indicador: g(col.indicador),
        meta: metaV instanceof Date ? metaV.toISOString().slice(0, 10) : metaV === null ? "" : typeof metaV === "string" ? limpa(metaV) : metaV,
        metaFmt: (metaCel && metaCel.numFmt) || "",
        meta2: col.meta2 ? g(col.meta2) : "",
        processo: g(col.processo),
        responsavel: g(col.responsavel),
        meios: g(col.meios),
        atividades: g(col.atividades),
        prazo: g(col.prazo),
        monitorizacao: g(col.monitorizacao),
        meses,
        mesFmt,
        totalValor: totalV instanceof Date ? null : totalV,
        totalFmt: totalCel.numFmt || "",
        cor: corDoPreenchimento(cel(col.indicador).fill, tema),
        corObjetivo: corDoPreenchimento(cel(col.objetivo).fill, tema),
        corMeses: corDoPreenchimento(cel(col.mes0 + 1).fill, tema),
        corTotal: corDoPreenchimento(totalCel.fill, tema),
        xModo: modoDoX(xF, r),
        xFmt: xCel.numFmt || "",
        fonte: null,
      };
      if (metaF) {
        if (/[A-Z]+\d+/.test(metaF)) {
          if (/^D\d+\/\(1\+D\d+\)$/i.test(metaF.replace(/\s+/g, ""))) item.metaCalc = "ativos";
          else item.metaFormula = relativa(metaF, r);
        } else item.metaFormula = metaF;
      }
      Object.assign(item, modoDoTotal(totalF, r, totalV));
      // Linhas do grupo (sem objetivo próprio) herdam o texto do objetivo para se lerem sozinhas.
      itens.push(item);
    }
    // Campos repetidos nas linhas de um grupo (células unidas no Excel).
    const porGrupo = {};
    itens.forEach((i) => (porGrupo[i.grupo] = porGrupo[i.grupo] || []).push(i));
    Object.values(porGrupo).forEach((l) => {
      if (l.length < 2) return;
      ["processo", "responsavel", "meios", "atividades", "prazo", "monitorizacao", "objetivo"].forEach((k) => {
        const v = l.find((i) => i[k]);
        if (v) l.forEach((i) => !i[k] && (i[k] = v[k]));
      });
    });
    const ano = Number(ep.slice(0, 4));
    epocas[ep] = { titulo: titulo || `MAPA DE OBJECTIVOS ${epocaLongaObj(ep)}`, anos: [ano, ano + 1], itens };
  });
  return { epocas, avisos };
}

// ---------- leitura das metas ("Inferior a 5%", ">= 95%", 450, "0 não conformidades") ----------
export function lerMeta(item) {
  const m = item.meta;
  const pct = /%/.test(item.metaFmt || "");
  if (typeof m === "number") return { op: (item.indicador && /desist/i.test(item.indicador)) || m === 0 ? "<=" : ">=", v: m, pct };
  const t = norm(m);
  if (!t) return null;
  const n = t.match(/(\d+(?:[.,]\d+)?)\s*(%)?/);
  if (!n) return null;
  let v = Number(n[1].replace(",", "."));
  const ePct = !!n[2];
  if (ePct) v /= 100;
  let op = ">=";
  if (/inferior|menos de|abaixo|<(?!=)/.test(t)) op = "<";
  else if (/<=|igual ou inferior|ate |maximo|no maximo/.test(t)) op = "<=";
  else if (/superior a(?! ou)|mais de|acima|>(?!=)/.test(t) && !/igual ou superior/.test(t)) op = ">";
  else if (/^0\b|^zero|nao conformidades|paragem/.test(t) && v === 0) op = "<=";
  return { op, v, pct: ePct };
}

// ---------- cálculo do acompanhamento ----------
const somaDe = (l) => l.reduce((t, v) => t + (numOuNull(v) || 0), 0);
const numeros = (l) => l.filter((v) => numOuNull(v) !== null);

// Total (coluna W) e coluna X de cada linha, com os meses já preenchidos.
export function calcularTotais(itens, contexto = {}) {
  const out = {};
  const idx = Object.fromEntries(itens.map((i, k) => [i.id, k]));
  const grupoDe = {};
  itens.forEach((i) => (grupoDe[i.grupo] = grupoDe[i.grupo] || []).push(i));
  const total = (i) => {
    if (out[i.id] && out[i.id].total !== undefined) return out[i.id].total;
    const meses = i.mesesEfetivos || i.meses || [];
    let t = null;
    switch (i.totalModo) {
      case "soma":
        t = numeros(meses).length ? somaDe(meses) : null;
        break;
      case "media": {
        const n = numeros(meses);
        t = n.length ? somaDe(n) / n.length : null;
        break;
      }
      case "ultimo": {
        const n = numeros(meses);
        t = n.length ? n[n.length - 1] : null;
        break;
      }
      case "diferenca": {
        const g = grupoDe[i.grupo] || [];
        const k = g.indexOf(i);
        if (k >= 2) {
          const a = total(g[k - 2]);
          const b = total(g[k - 1]);
          t = a === null && b === null ? null : (a || 0) - (b || 0);
        }
        break;
      }
      case "porInscritos": {
        const ativos = contexto.ativosDe ? contexto.ativosDe(i) : null;
        t = numeros(meses).length && ativos ? somaDe(meses) / ativos : numeros(meses).length ? null : null;
        break;
      }
      case "razao":
        t = numeros(meses).length && i.totalDenominador ? somaDe(meses) / i.totalDenominador : null;
        break;
      default:
        t = numOuNull(i.totalValor);
    }
    out[i.id] = { ...(out[i.id] || {}), total: t };
    return t;
  };
  itens.forEach((i) => total(i));
  itens.forEach((i) => {
    let x = null;
    if (i.xModo === "taxa") {
      const g = grupoDe[i.grupo] || [];
      const k = g.indexOf(i);
      const ant = k > 0 ? out[g[k - 1].id].total : null;
      const t = out[i.id].total;
      x = t !== null && (ant || 0) + t > 0 ? t / ((ant || 0) + t) : null;
    } else if (i.xModo === "cumprimento") {
      const m = numOuNull(typeof i.meta === "number" ? i.meta : lerMeta(i) && lerMeta(i).v);
      x = m && out[i.id].total !== null ? out[i.id].total / m : null;
    }
    out[i.id].x = x;
    void idx;
  });
  return out;
}

// Meta numérica de uma linha (com as metas calculadas, como os ativos do grupo).
export function metaNumerica(item, itens) {
  if (item.metaCalc === "ativos") {
    const g = itens.filter((i) => i.grupo === item.grupo);
    const k = g.indexOf(item);
    if (k >= 2) {
      const ins = numOuNull(g[k - 2].meta);
      const des = numOuNull(g[k - 1].meta);
      if (ins !== null) return ins / (1 + (des || 0));
    }
    return null;
  }
  return numOuNull(item.meta);
}

// Estado face à meta: "ok", "risco" (ainda não atingiu, a época decorre), "falha", ou null.
export function estadoMeta(item, total, x, itens, fimEpoca) {
  if (total === null || total === undefined) return null;
  const desist = /desist/i.test(item.indicador || "");
  const meta = item.metaCalc ? { op: ">=", v: metaNumerica(item, itens), pct: false } : lerMeta(item);
  if (!meta || meta.v === null || meta.v === undefined) return null;
  // Desistências: a meta é uma taxa; compara-se a coluna X (taxa) ou o total se já for taxa.
  let valor = total;
  if (desist && meta.pct !== false && /%/.test(item.metaFmt || "") && x !== null && x !== undefined) valor = x;
  else if (meta.pct && !/%/.test(item.totalFmt || "") && x !== null && x !== undefined && /%/.test(item.xFmt || "")) valor = x;
  const cumpre = { "<": valor < meta.v, "<=": valor <= meta.v, ">": valor > meta.v, ">=": valor >= meta.v }[meta.op];
  if (cumpre) return "ok";
  // Metas "ao alto" ainda podem ser atingidas enquanto a época decorre.
  if ((meta.op === ">=" || meta.op === ">") && !fimEpoca) return "risco";
  return "falha";
}

// ---------- fontes automáticas: o que a app já sabe ----------
export const FONTES_OBJ = {
  reclamacoes: { rotulo: "Reclamações registadas (por mês)", fmt: "0", total: "soma", escola: true, filtro: "Só reclamações cujo tema, canal ou categoria contém" },
  reclamacoesPorInscritos: { rotulo: "Reclamações das escolas ÷ alunos ativos", fmt: "0", total: "porInscritos", escola: true, filtro: "Só reclamações cujo tema, canal ou categoria contém" },
  reclamacoesEventos: { rotulo: "Reclamações nos eventos ÷ participantes", fmt: "0%", total: "media", filtro: "Só eventos cujo nome contém" },
  satisfacao: { rotulo: "Satisfação nos inquéritos (% satisfeitos)", fmt: "0%", total: "media", filtro: "Só inquéritos cujo evento/tipologia contém" },
  inscricoes: { rotulo: "Inscrições (alunos novos por mês)", fmt: "0", total: "soma", escola: true },
  desistencias: { rotulo: "Desistências (por mês)", fmt: "0", total: "soma", escola: true },
  retencao: { rotulo: "Retenção entre épocas (anual)", fmt: "0.00%", total: "ultimo", escola: true, anual: true },
  participantes: { rotulo: "Participantes nos eventos", fmt: "0", total: "soma", filtro: "Só eventos cujo nome contém" },
  paragens: { rotulo: "Ocorrências que pararam a atividade", fmt: "0", total: "soma", escola: true, filtro: "Só ocorrências cuja categoria contém" },
  ocorrencias: { rotulo: "Ocorrências registadas", fmt: "0", total: "soma", escola: true, filtro: "Só ocorrências cuja categoria contém" },
  ncAuditorias: { rotulo: "Não conformidades em auditorias", fmt: "0", total: "soma", escola: true, filtro: "Só auditorias cuja origem/âmbito contém" },
};

// Sugere a fonte de uma linha pelo texto do indicador e do objetivo.
export function sugerirFonte(item, escolas = []) {
  const ind = norm(item.indicador);
  const obj = norm(item.objetivo);
  // Objetivo de uma escola: só com a escola reconhecida (senão contaria todas).
  // "Dragon Force FC" é a escola Dragon Force FC (Porto + Maia), não a Dragon Force toda.
  const dffc = /dragon force fc\b|dragon force futebol clube/.test(obj) && !/dffc\s*-/.test(obj);
  const especifica = /inscricoes (na|no|em)\s/.test(obj);
  const escolaDFFC = () => escolas.find((e) => /^(dragon force fc|dragon force futebol clube|dffc)$/.test(norm(e).trim())) || "";
  const escola = especifica ? (dffc ? escolaDFFC() : escolaDoTexto(item.objetivo, escolas)) : "";
  if ((/n.? ?de inscric/.test(ind) || /desistenc/.test(ind)) && (/dffc/.test(obj) || (especifica && !escola))) return null;
  if (/n.? ?de inscric/.test(ind)) return { tipo: "inscricoes", escola };
  if (/desistenc/.test(ind)) return { tipo: "desistencias", escola };
  if (/reclamac.*participantes/.test(ind)) return { tipo: "reclamacoesEventos" };
  if (/reclamac.*inscritos/.test(ind)) return { tipo: "reclamacoesPorInscritos" };
  if (/retenc/.test(ind)) return { tipo: "retencao" };
  if (/satisfac/.test(ind) || /satisfac/.test(obj)) {
    if (/eventos|campos de ferias|participantes/.test(obj)) return { tipo: "satisfacao", filtro: "" };
    return null;
  }
  if (/participantes no evento/.test(ind)) {
    const m = String(item.indicador).match(/evento\s+(.+?)(\(|$)/i);
    return { tipo: "participantes", filtro: m ? m[1].trim() : "" };
  }
  if (/manutenc.*paragem|paragem/.test(ind)) return { tipo: "paragens", filtro: "infra" };
  return null;
}
const chaveEscola = (s) =>
  norm(s)
    .replace(/garantir o numero de inscricoes (na|no|em)\s*/, "")
    .replace(/^dragon force\s+/, "df ")
    .replace(/[^a-z0-9]/g, "")
    .replace(/^df(fc)?/, "");
const PALAVRAS_VAZIAS = new Set(["de", "do", "da", "dos", "das", "df", "dffc", "colegio", "academia", "escola", "e"]);
const tokensEscola = (s) =>
  norm(s)
    .replace(/garantir o numero de inscricoes (na|no|em)\s*/, "")
    .replace(/^dragon force\s+/, "df ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !PALAVRAS_VAZIAS.has(w));
export function escolaDoTexto(texto, escolas = []) {
  const k = chaveEscola(texto);
  if (!k || k.length < 3) return "";
  const lista = escolas.map((e) => ({ e, k: chaveEscola(e), t: tokensEscola(e) })).filter((x) => x.k.length >= 3);
  const exata = lista.find((x) => x.k === k);
  if (exata) return exata.e;
  const parcial = lista.filter((x) => k.startsWith(x.k) || x.k.startsWith(k)).sort((a, b) => b.k.length - a.k.length);
  if (parcial.length) return parcial[0].e;
  // Por palavras: "Marco de Canaveses" = "Marco Canaveses", "Academia Ramos Pinto" = "Ramos Pinto".
  const tt = tokensEscola(texto);
  const contem = (a, b) => a.length && a.every((w) => b.includes(w));
  const porPalavras = lista.filter((x) => contem(tt, x.t) || (x.t.length >= 2 && contem(x.t, tt)));
  return porPalavras.length === 1 ? porPalavras[0].e : "";
}

// Meses (12 valores) de uma fonte numa época, com os dados da app.
export function mesesDaFonte(fonte, ep, dados) {
  if (!fonte || !FONTES_OBJ[fonte.tipo]) return null;
  const vazio = () => Array(12).fill(null);
  const naEpoca = (d) => d && epocaDe(d) === ep;
  const filtro = norm(fonte.filtro || "");
  const passa = (t) => !filtro || norm(t).includes(filtro);
  const daEscola = (e) => !fonte.escola || e === fonte.escola;
  const conta = (lista, dataDe, ok = () => true) => {
    const m = vazio();
    let algum = false;
    lista.forEach((x) => {
      const d = dataDe(x);
      if (!naEpoca(d) || !ok(x)) return;
      const k = colunaMes(d);
      if (k === null) return;
      m[k] = (m[k] || 0) + 1;
      algum = true;
    });
    return { meses: m, algum };
  };
  const ateHoje = (m, cobre = true) => {
    // Sem registos nenhuns nesta época, a app não sabe: não preenche.
    if (!cobre) return null;
    // Meses já passados sem registos contam 0 (há dados, só não houve casos).
    const hoje = new Date().toISOString().slice(0, 10);
    const kHoje = epocaDe(hoje) === ep ? colunaMes(hoje) : epocaDe(hoje) > ep ? 10 : -1;
    return m.map((v, k) => (v === null && k <= kHoje ? 0 : v));
  };
  const cobre = (lista, dataDe) => lista.some((x) => naEpoca(dataDe(x)));
  switch (fonte.tipo) {
    case "reclamacoes":
    case "reclamacoesPorInscritos": {
      const r = conta(dados.reclamacoes || [], (x) => x.receivedDate, (x) => daEscola(x.school) && passa([x.tema, x.canal, x.categoria].join(" ")));
      return ateHoje(r.meses, cobre(dados.reclamacoes || [], (x) => x.receivedDate));
    }
    case "inscricoes":
    case "desistencias": {
      const reg = (dados.registoAlunos || {})[ep];
      if (!reg) return null;
      const al = Object.values(reg.alunos || {}).filter((a) => daEscola(a.escola));
      const r =
        fonte.tipo === "inscricoes"
          ? conta(al, (a) => a.entrada)
          : conta(
              al.filter((a) => a.estado === "desistiu"),
              (a) => a.saida
            );
      return ateHoje(r.meses);
    }
    case "participantes": {
      const m = vazio();
      (dados.eventos || []).forEach((ev) => {
        if (!naEpoca(ev.data) || !passa(ev.nome)) return;
        const n = dados.participantesDe ? dados.participantesDe(ev) : null;
        if (n === null || n === undefined) return;
        const k = colunaMes(ev.data);
        m[k] = (m[k] || 0) + n;
      });
      return m;
    }
    case "reclamacoesEventos": {
      const rec = vazio();
      const part = vazio();
      (dados.eventos || []).forEach((ev) => {
        if (!naEpoca(ev.data) || !passa(ev.nome)) return;
        const n = dados.participantesDe ? dados.participantesDe(ev) : null;
        if (!n) return;
        const k = colunaMes(ev.data);
        rec[k] = (rec[k] || 0) + (Number(ev.reclamacoes) || 0);
        part[k] = (part[k] || 0) + n;
      });
      return rec.map((v, k) => (part[k] ? (v || 0) / part[k] : null));
    }
    case "satisfacao": {
      const somas = vazio();
      const ns = vazio();
      (dados.inqueritos || []).forEach((i) => {
        if (!naEpoca(i.data) || !passa([i.tipoEvento, i.edicao, i.tipologia].join(" "))) return;
        const s = dados.satisfacaoDe ? dados.satisfacaoDe(i) : null;
        if (!s || s.pct === null || s.pct === undefined) return;
        const k = colunaMes(i.data);
        somas[k] = (somas[k] || 0) + s.pct * (s.n || 1);
        ns[k] = (ns[k] || 0) + (s.n || 1);
      });
      return somas.map((v, k) => (ns[k] ? v / ns[k] / 100 : null));
    }
    case "paragens":
    case "ocorrencias": {
      const r = conta(
        dados.ocorrencias || [],
        (o) => o.data,
        (o) => daEscola(o.escola) && passa([o.categoria, o.titulo].join(" ")) && (fonte.tipo !== "paragens" || o.afetouAtividade || Number(o.treinosSuspensos) > 0)
      );
      return ateHoje(r.meses, cobre(dados.ocorrencias || [], (o) => o.data));
    }
    case "ncAuditorias": {
      const m = vazio();
      (dados.audits || []).forEach((a) => {
        if (!naEpoca(a.date) || !daEscola(a.school) || !passa([a.origem, a.ambito].join(" "))) return;
        const k = colunaMes(a.date);
        const n = (a.findings || []).filter((f) => /^NC/.test(String(f.classification || f.classificacao || f.tipo || ""))).length;
        m[k] = (m[k] || 0) + n;
      });
      return ateHoje(m, cobre(dados.audits || [], (a) => a.date));
    }
    case "retencao": {
      const v = dados.retencaoDe ? dados.retencaoDe(ep, fonte.escola || null) : null;
      if (v === null || v === undefined) return null;
      const m = vazio();
      m[10] = v; // julho: fecho da época
      return m;
    }
    default:
      return null;
  }
}
function epocaDe(d) {
  const x = new Date(String(d || "").slice(0, 10) + "T00:00:00");
  if (isNaN(x.getTime())) return "";
  const ano = x.getMonth() >= 7 ? x.getFullYear() : x.getFullYear() - 1;
  return `${ano}/${String(ano + 1).slice(2)}`;
}

// Acompanhamento de uma época: meses (escritos + dados da app nos meses vazios), totais e estado.
export function acompanhamento(ep, dadosEp, dados = {}) {
  const itens = ((dadosEp && dadosEp.itens) || []).map((i) => {
    const escritos = i.meses || Array(12).fill(null);
    const auto = i.fonte ? mesesDaFonte(i.fonte, ep, dados) : null;
    const vazio = (v) => v === null || v === undefined || v === "";
    const mesesEfetivos = escritos.map((v, k) => (vazio(v) && auto && auto[k] !== null && auto[k] !== undefined ? auto[k] : v));
    const autoK = escritos.map((v, k) => !!(vazio(v) && auto && auto[k] !== null && auto[k] !== undefined));
    const F = i.fonte && FONTES_OBJ[i.fonte.tipo];
    const totalModo = F && !i.totalFixo && i.totalModo !== "diferenca" ? F.total : i.totalModo;
    return { ...i, mesesEfetivos, autoK, temAuto: !!auto, totalModo, mesFmt: i.mesFmt || (F ? F.fmt : "") };
  });
  const ativosDe = (i) => (dados.ativosDe ? dados.ativosDe(ep, (i.fonte && i.fonte.escola) || null) : null);
  const calc = calcularTotais(itens, { ativosDe });
  const fim = new Date().toISOString().slice(0, 10) > `${Number(ep.slice(0, 4)) + 1}-07-31`;
  itens.forEach((i) => {
    if (i.totalModo === "porInscritos") calc[i.id].ativos = ativosDe(i);
    calc[i.id].estado = estadoMeta(i, calc[i.id].total, calc[i.id].x, itens, fim);
  });
  return { itens, calc, fim };
}

// Valor para mostrar (percentagens, inteiros, texto).
export function mostrarValor(v, fmt) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v !== "number") return String(v);
  if (/%/.test(fmt || "")) {
    const dec = ((fmt.split(".")[1] || "").match(/0/g) || []).length;
    return `${(v * 100).toFixed(dec).replace(".", ",")}%`;
  }
  if (fmt === "0" || Number.isInteger(v)) return String(Math.round(v));
  return String(Math.round(v * 100) / 100).replace(".", ",");
}
// Texto escrito numa célula do acompanhamento → valor.
export function lerValorEscrito(t, fmt) {
  const s = String(t ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace("%", "").replace(/\s/g, "").replace(",", "."));
  if (!isFinite(n)) return s;
  if (/%$/.test(s)) return n / 100;
  if (/%/.test(fmt || "") && n > 1) return n / 100;
  return n;
}

// Nova época a partir de outra: mesmas linhas, metas e fontes; acompanhamento vazio.
export function copiarEpocaObjetivos(base, epNova) {
  const ano = Number(epNova.slice(0, 4));
  const grupos = {};
  const antiga = base.titulo && base.titulo.match(/\d{4}\/\d{4}/) ? base.titulo.match(/\d{4}\/\d{4}/)[0] : null;
  const trocaEpoca = (s) => String(s || "").replace(/(\d{4})\s*([/-])\s*(\d{2,4})/g, (m, a, sep, b) => (Number(a) === ano - 1 ? `${ano}${sep}${b.length === 2 ? String(ano + 1).slice(2) : ano + 1}` : m));
  return {
    titulo: `MAPA DE OBJECTIVOS ${epocaLongaObj(epNova)}`,
    anos: [ano, ano + 1],
    copiadaDe: antiga,
    itens: (base.itens || []).map((i) => ({
      ...i,
      id: novoId("obj"),
      grupo: grupos[i.grupo] || (grupos[i.grupo] = novoId("g")),
      prazo: trocaEpoca(i.prazo),
      indicador: trocaEpoca(i.indicador),
      meses: Array(12).fill(null),
      totalValor: i.totalModo === "formula" || i.totalModo === "valor" ? null : i.totalValor,
    })),
  };
}

// ---------- Excel do Mapa de objetivos ----------
const fino = { style: "thin", color: { argb: "FF000000" } };
const caixa = { top: fino, left: fino, bottom: fino, right: fino };
const preencher = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const COR_OBJ = { cab: "FFC0C0C0", cinzaClaro: "FFF2F2F2", acomp: "FFD9D9D9", total: "FFEDEDED", amarelo: "FFFFFF00", cabSec: "FFAEAAAA" };
const swiss = (sz, bold) => ({ name: "Swis721 BT", size: sz, bold: !!bold, color: { argb: "FF000000" } });
const calibri = (sz, bold) => ({ name: "Calibri", size: sz, bold: !!bold, color: { argb: "FF000000" } });
const COLS_OBJ = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const LARG_OBJ = { A: 15.55, B: 19.55, C: 19.55, D: 15.55, E: 15.55, F: 15.55, G: 15.55, H: 22, I: 15.55, J: 15.55, K: 7, L: 5.66, M: 5.66, N: 8.33, O: 6.66, P: 6.44, Q: 7.44, R: 7.66, S: 7, T: 5.66, U: 7.44, V: 5.66, W: 9, X: 8.9 };
const letraCol = (n) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

function folhaObjetivosExcel(wb, ep, dados, calculo) {
  const ws = wb.addWorksheet(folhaObjetivos(ep), {
    views: [{ state: "frozen", xSplit: 2, ySplit: 4, zoomScale: 80, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "4:4", margins: { left: 0.51, right: 0.51, top: 0.79, bottom: 0.79, header: 0.31, footer: 0.31 } },
  });
  Object.entries(LARG_OBJ).forEach(([c, w]) => (ws.getColumn(c).width = w));
  const anos = dados.anos || [Number(ep.slice(0, 4)), Number(ep.slice(0, 4)) + 1];

  ws.mergeCells("A2:J2");
  const t = ws.getCell("A2");
  t.value = dados.titulo || `MAPA DE OBJECTIVOS ${epocaLongaObj(ep)}`;
  t.font = calibri(16, true);
  t.alignment = { horizontal: "center" };
  ws.getRow(2).height = 21;
  ws.mergeCells("K2:V2");
  Object.assign(ws.getCell("K2"), { value: "Acompanhamento" });
  ws.getCell("K2").font = calibri(11, true);
  ws.getCell("K2").fill = preencher(COR_OBJ.acomp);
  ws.getCell("K2").alignment = { horizontal: "center" };
  ws.getCell("K2").border = caixa;
  ws.mergeCells("K3:N3");
  ws.mergeCells("O3:V3");
  [
    ["K3", anos[0]],
    ["O3", anos[1]],
  ].forEach(([ref, v]) => {
    const c = ws.getCell(ref);
    c.value = String(v);
    c.font = calibri(11, true);
    c.alignment = { horizontal: "center" };
    c.border = caixa;
  });

  const cab = ["Intenção da Politica", "Objectivo", "Indicador", "Meta 1", "Processo Associado", "Responsável", "Meios Associados", "Actividades a desenvolver", "Prazo", "Monitorização", ...MESES_OBJ, "TOTAL"];
  const r4 = ws.getRow(4);
  r4.height = 24;
  cab.forEach((v, k) => {
    const c = r4.getCell(k + 1);
    c.value = v;
    c.font = swiss(9, v !== "TOTAL");
    c.fill = preencher(COR_OBJ.cab);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = caixa;
  });

  const itens = dados.itens || [];
  let r = 5;
  const linhaDe = {};
  itens.forEach((i) => {
    linhaDe[i.id] = r;
    r++;
  });
  const ultima = r - 1;
  const grupos = {};
  itens.forEach((i) => (grupos[i.grupo] = grupos[i.grupo] || []).push(i));
  // Linhas de cada grupo e de cada intenção (para unir células como no documento).
  const blocosIntencao = [];
  itens.forEach((i, k) => {
    const ant = blocosIntencao[blocosIntencao.length - 1];
    if (ant && ant.intencao === i.intencao) ant.ate = linhaDe[i.id];
    else blocosIntencao.push({ intencao: i.intencao, de: linhaDe[i.id], ate: linhaDe[i.id] });
    void k;
  });

  const inicioIntencao = new Set(blocosIntencao.map((b) => b.de));
  const altura = (texto, larg) => {
    const linhas = String(texto || "")
      .split("\n")
      .reduce((t, l) => t + Math.max(1, Math.ceil((l.replace(/\s{2,}/g, " ").length * 1.4) / Math.max(4, larg))), 0);
    return linhas * 12.5 + 8;
  };

  itens.forEach((i) => {
    const rr = linhaDe[i.id];
    const row = ws.getRow(rr);
    const g = grupos[i.grupo] || [i];
    const primeiro = g[0] === i;
    const emGrupo = g.length > 1;
    const amarelo = /dragon force fc/i.test(i.objetivo || "") && /inscri/i.test(i.objetivo || "");
    const base = (col, v, extra = {}) => {
      const c = row.getCell(col);
      if (v !== undefined) c.value = v;
      c.font = swiss(9);
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = caixa;
      if (extra.fill) c.fill = preencher(extra.fill);
      if (extra.numFmt) c.numFmt = extra.numFmt;
      return c;
    };
    // Cores: as do documento (guardadas na importação); linhas novas ficam em cinza claro.
    const importada = i.cor !== undefined;
    const cinza = importada ? i.cor : emGrupo ? null : COR_OBJ.cinzaClaro;
    base("A", inicioIntencao.has(rr) ? i.intencao : undefined);
    base("B", primeiro ? i.objetivo : emGrupo ? undefined : i.objetivo, { fill: importada ? i.corObjetivo : amarelo ? COR_OBJ.amarelo : cinza });
    base("C", i.indicador, { fill: cinza });
    // Meta
    let metaV = i.meta === "" || i.meta === null || i.meta === undefined ? null : i.meta;
    if (i.metaCalc === "ativos" && g.indexOf(i) >= 2) {
      const ins = linhaDe[g[g.indexOf(i) - 2].id];
      const des = linhaDe[g[g.indexOf(i) - 1].id];
      const v = metaNumerica(i, itens);
      metaV = { formula: `D${ins}/(1+D${des})`, result: v === null ? undefined : v };
    } else if (i.metaFormula) metaV = { formula: absoluta(i.metaFormula, rr), result: typeof i.meta === "number" ? i.meta : undefined };
    base("D", metaV, { fill: cinza, numFmt: i.metaFmt || undefined });
    // Nas linhas de um grupo, só se escreve uma vez o que é igual em todas (essas células ficam unidas).
    ["processo", "responsavel", "meios", "atividades", "prazo", "monitorizacao"].forEach((k, j) => {
      const igual = g.every((x) => (x[k] || "") === (g[0][k] || ""));
      base(COLS_OBJ[4 + j], primeiro || !emGrupo || !igual ? i[k] : undefined, { fill: cinza });
    });
    // Acompanhamento
    const meses = i.mesesEfetivos || i.meses || [];
    for (let k = 0; k < 12; k++) {
      const c = row.getCell(11 + k);
      const v = meses[k];
      c.value = v === null || v === undefined || v === "" ? null : v;
      c.font = calibri(11, true);
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = caixa;
      const corM = importada ? i.corMeses : cinza;
      if (corM) c.fill = preencher(corM);
      if (i.mesFmt) c.numFmt = i.mesFmt;
      else if (FONTES_OBJ[i.fonte && i.fonte.tipo] && typeof v === "number") c.numFmt = FONTES_OBJ[i.fonte.tipo].fmt;
    }
    // TOTAL
    const tc = row.getCell(23);
    const res = calculo[i.id] ? calculo[i.id].total : null;
    const resultado = res === null || res === undefined ? undefined : res;
    let tv = null;
    switch (i.totalModo) {
      case "soma":
        tv = { formula: `SUM(K${rr}:V${rr})`, result: resultado };
        break;
      case "media":
        tv = { formula: `IFERROR(AVERAGE(K${rr}:V${rr}),"")`, result: resultado ?? "" };
        break;
      case "ultimo":
        tv = resultado === undefined ? null : resultado;
        break;
      case "diferenca": {
        const k = g.indexOf(i);
        tv = k >= 2 ? { formula: `W${linhaDe[g[k - 2].id]}-W${linhaDe[g[k - 1].id]}`, result: resultado } : resultado ?? null;
        break;
      }
      case "porInscritos": {
        const ativos = calculo[i.id] && calculo[i.id].ativos;
        tv = ativos ? { formula: `SUM(K${rr}:V${rr})/${ativos}`, result: resultado } : resultado ?? null;
        break;
      }
      case "razao":
        tv = i.totalDenominadorTexto || i.totalDenominador ? { formula: `SUM(K${rr}:V${rr})/${i.totalDenominadorTexto || i.totalDenominador}`, result: resultado } : resultado ?? null;
        break;
      case "formula":
        tv = i.totalFormula ? { formula: absoluta(i.totalFormula, rr), result: resultado } : resultado ?? null;
        break;
      default:
        tv = resultado ?? (i.totalValor === undefined ? null : i.totalValor);
    }
    tc.value = tv;
    tc.font = calibri(11, true);
    tc.alignment = { horizontal: "center", vertical: "middle" };
    tc.border = caixa;
    const corT = importada ? i.corTotal : COR_OBJ.cinzaClaro;
    if (corT) tc.fill = preencher(corT);
    const fmtFonte = i.fonte && FONTES_OBJ[i.fonte.tipo] ? FONTES_OBJ[i.fonte.tipo].fmt : "";
    if (i.totalFmt) tc.numFmt = i.totalFmt;
    else if (i.totalModo === "porInscritos" || i.totalModo === "razao") tc.numFmt = "0.00%";
    else if (/%/.test(fmtFonte)) tc.numFmt = fmtFonte;
    // Coluna X
    if (i.xModo) {
      const xc = row.getCell(24);
      const xr = calculo[i.id] ? calculo[i.id].x : null;
      const k = g.indexOf(i);
      if (i.xModo === "taxa" && k >= 1) xc.value = { formula: `IFERROR(W${rr}/SUM(W${linhaDe[g[k - 1].id]}:W${rr}),"")`, result: xr ?? "" };
      else if (i.xModo === "cumprimento") xc.value = { formula: `IFERROR(W${rr}/D${rr},"")`, result: xr ?? "" };
      xc.font = calibri(11);
      xc.alignment = { horizontal: "center", vertical: "middle" };
      xc.numFmt = i.xFmt || "0.00%";
    }
    // Altura: só a primeira linha de um grupo tem texto longo; as outras ficam baixas.
    const h = Math.max(altura(i.indicador, 19), emGrupo && !primeiro ? 15 : Math.max(altura(i.atividades, 22), altura(i.objetivo, 19), altura(i.responsavel, 15), altura(i.meios, 15)) / (emGrupo ? g.length : 1));
    row.height = Math.min(160, Math.max(15, Math.round(h)));
  });

  // Células unidas: grupos (B, E–J) e intenção (A).
  Object.values(grupos).forEach((g) => {
    if (g.length < 2) return;
    const de = linhaDe[g[0].id];
    const ate = linhaDe[g[g.length - 1].id];
    if (ate - de !== g.length - 1) return;
    ["B", "E", "F", "G", "H", "I", "J"].forEach((c) => {
      const iguais = c === "B" || g.every((x) => x[{ E: "processo", F: "responsavel", G: "meios", H: "atividades", I: "prazo", J: "monitorizacao" }[c]] === g[0][{ E: "processo", F: "responsavel", G: "meios", H: "atividades", I: "prazo", J: "monitorizacao" }[c]]);
      if (iguais) {
        try {
          ws.mergeCells(`${c}${de}:${c}${ate}`);
        } catch (e) {
          // já unida
        }
      }
    });
  });
  blocosIntencao.forEach((b) => {
    if (b.ate > b.de) {
      try {
        ws.mergeCells(`A${b.de}:A${b.ate}`);
      } catch (e) {
        // intersecta outra união
      }
    }
  });
  void ultima;
  return ws;
}

export async function gerarExcelObjetivos(ExcelJS, { epocas, calculos, apenas }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Auditoria e Gestão de Qualidade DF";
  wb.created = new Date();
  Object.keys(epocas || {})
    .filter((ep) => !apenas || apenas.includes(ep))
    .sort()
    .forEach((ep) => folhaObjetivosExcel(wb, ep, epocas[ep], (calculos && calculos[ep]) || {}));
  return wb.xlsx.writeBuffer();
}

// ======================================================================
// CONTROLO E GESTÃO DOCUMENTAL
// ======================================================================
export const TIPOS_DOC = {
  F: { rotulo: "Formulário ou impresso", prefixo: "DFF" },
  N: { rotulo: "Normativa ou regulamento", prefixo: "DFN" },
  P: { rotulo: "Processo", prefixo: "DFP" },
  M: { rotulo: "Manual", prefixo: "DFM" },
  "-": { rotulo: "Sem código (pastas e arquivos)", prefixo: "" },
};
export const LISTAS_DOC = { DF: "Controlo Doc.", INT: "Controlo Doc. INT" };

// "DFF 164", "DFF,099", "DFM-011", "dff.1" → "DFF.164", "DFF.099", "DFM.011", "DFF.001".
export function normalizarCodigo(c) {
  const s = String(c || "").trim();
  const m = s.match(/^(DF[A-Z])\s*[.,\-_\s]?\s*(\d{1,3})(?:\s*[.,\-]\s*(\d{1,2}))?[.,\s]*$/i);
  if (!m) return { codigo: s, prefixo: "", numero: null, valido: false };
  return { codigo: `${m[1].toUpperCase()}.${m[2].padStart(3, "0")}`, prefixo: m[1].toUpperCase(), numero: Number(m[2]), valido: true };
}
export const codigoComVersao = (d) => (d.codigo && d.codigo !== "-" && normalizarCodigo(d.codigo).valido ? `${d.codigo}.${String(Math.max(1, (d.versoes || []).length)).padStart(2, "0")}` : d.codigo || "");
export function proximoCodigo(itens, tipo) {
  const p = (TIPOS_DOC[tipo] || {}).prefixo;
  if (!p) return "";
  const max = Math.max(0, ...itens.map((d) => normalizarCodigo(d.codigo)).filter((n) => n.prefixo === p).map((n) => n.numero || 0));
  return `${p}.${String(max + 1).padStart(3, "0")}`;
}
// Um documento da DF que também está na lista INT é o mesmo documento com a etiqueta INT (não uma cópia).
export const naListaInt = (d) => (d.lista || "DF") === "INT" || !!d.int;
// Junta as linhas da folha INT aos documentos da DF com o mesmo código e nome.
export function juntarListasDoc(itens) {
  const chave = (d) => {
    const n = normalizarCodigo(d.codigo);
    return n.valido ? `${n.codigo}|${norm(d.identificacao || "").replace(/[^a-z0-9]/g, "")}` : null;
  };
  const df = new Map();
  itens.forEach((d) => {
    const k = chave(d);
    if ((d.lista || "DF") === "DF" && k && !df.has(k)) df.set(k, d);
  });
  const uniao = (a, b) => [...new Set([...(a || []), ...(b || [])])];
  const out = [];
  let juntos = 0;
  itens.forEach((d) => {
    const alvo = (d.lista || "DF") === "INT" && chave(d) ? df.get(chave(d)) : null;
    if (!alvo) return out.push(d);
    alvo.int = true;
    alvo.ordemInt = d.ordem;
    alvo.colaboradores = uniao(alvo.colaboradores, d.colaboradores);
    alvo.locais = uniao(alvo.locais, d.locais);
    juntos++;
  });
  return { itens: out, juntos };
}
// Códigos repetidos: o mesmo código em dois documentos diferentes (em qualquer lista).
export function codigosDuplicados(itens) {
  const por = {};
  itens.forEach((d) => {
    const n = normalizarCodigo(d.codigo);
    if (!n.valido) return;
    (por[n.codigo] = por[n.codigo] || []).push(d);
  });
  return Object.entries(por)
    .filter(([, l]) => l.length > 1)
    .map(([codigo, l]) => ({ codigo, itens: l }));
}
const dataIso = (v) => {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const s = String(v || "").trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const a = m[3].length === 2 ? `20${m[3]}` : m[3];
    let dia = Number(m[1]);
    let mes = Number(m[2]);
    if (mes > 12 && dia <= 12) [dia, mes] = [mes, dia]; // escrito mês-dia-ano
    if (mes > 12 || dia > 31) return null;
    return `${a}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

export function lerDocumentosDoExcel(wb) {
  const itens = [];
  const avisos = [];
  let colaboradores = null;
  let locais = null;
  let rodape = "";
  const lidas = [];
  wb.eachSheet((ws) => {
    const nome = String(ws.name).trim();
    const lista = /int/i.test(nome) && /controlo/i.test(nome) ? "INT" : /controlo/i.test(nome) ? "DF" : null;
    if (!lista) {
      if (ws.rowCount > 0) avisos.push(`A folha "${nome}" não é uma lista de controlo e ficou de fora.`);
      return;
    }
    if (lista === "DF" && ws.headerFooter && ws.headerFooter.oddFooter) rodape = ws.headerFooter.oddFooter;
    // Cabeçalho: linha com "Codificação" e a de baixo com os cargos e locais.
    let hr = null;
    for (let r = 1; r <= 15 && !hr; r++) if (/codifica/i.test(txt(ws.getRow(r).getCell(2).value))) hr = r;
    if (!hr) return avisos.push(`Folha ${nome}: não encontrei o cabeçalho.`);
    const top = ws.getRow(hr);
    const sub = ws.getRow(hr + 1);
    let cColab = null;
    let cLocal = null;
    let cVersao = null;
    let cObs = null;
    for (let c = 1; c <= ws.columnCount; c++) {
      const t = norm(txt(top.getCell(c).value));
      if (t === "colaborador" && !cColab) cColab = c;
      else if (t === "local" && !cLocal) cLocal = c;
      else if (/^vers/.test(t) && !cVersao) cVersao = c;
      if (/^o?b?s?oleto$/.test(norm(txt(sub.getCell(c).value))) && !cObs) cObs = c;
    }
    const rotulos = (de, ate) => {
      const l = [];
      for (let c = de; c < ate; c++) {
        const t = limpa(txt(sub.getCell(c).value));
        if (t) l.push({ c, t });
      }
      return l;
    };
    const colab = cColab && cLocal ? rotulos(cColab, cLocal) : [];
    const loc = cLocal ? rotulos(cLocal, cObs || cVersao || ws.columnCount + 1) : [];
    if (!colaboradores || colab.length > colaboradores.length) colaboradores = colab.map((x) => x.t);
    if (!locais || loc.length > locais.length) locais = loc.map((x) => x.t);
    let n = 0;
    for (let r = hr + 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const g = (c) => limpa(txt(valorDe(row.getCell(c)) ?? ""));
      const tipoRaw = g(1);
      const cod = g(2);
      const ident = g(3);
      if (!tipoRaw && !cod && !ident) continue;
      const tipo = /^[FNPM]$/i.test(tipoRaw) ? tipoRaw.toUpperCase() : "-";
      const nc = normalizarCodigo(cod);
      const marcado = (c) => /x/i.test(g(c));
      const versoes = [];
      if (cVersao) for (let c = cVersao; c <= Math.max(ws.columnCount, cVersao + 15); c++) {
        const v = valorDe(row.getCell(c));
        const d = v === null || v === "" ? null : dataIso(v);
        if (d) versoes.push(d);
      }
      itens.push({
        id: novoId("doc"),
        lista,
        tipo,
        codigo: tipo === "-" || !cod || cod === "-" ? "-" : nc.valido ? nc.codigo : cod,
        codigoOriginal: nc.valido && nc.codigo !== cod ? cod : undefined,
        identificacao: ident,
        registo: g(4),
        armazenagem: g(5),
        protecao: g(6),
        retencao: g(7),
        elaborado: g(8),
        aprovado: g(9),
        colaboradores: colab.filter((x) => marcado(x.c)).map((x) => x.t),
        locais: loc.filter((x) => marcado(x.c)).map((x) => x.t),
        obsoleto: cObs ? !!g(cObs) : false,
        versoes,
        ordem: r,
      });
      n++;
    }
    lidas.push(`${nome}: ${n}`);
  });
  const junto = juntarListasDoc(itens);
  itens.splice(0, itens.length, ...junto.itens);
  const corrigidos = itens.filter((d) => d.codigoOriginal).length;
  if (corrigidos) avisos.push(`${corrigidos} códigos estavam escritos de forma diferente (ex.: "DFF 164") e ficam no formato DFF.164.`);
  return { itens, colaboradores: colaboradores || [], locais: locais || [], rodape, avisos, lidas };
}

const swissLt = (sz, bold) => ({ name: bold ? "Swis721 BT" : "Swis721 BT", size: sz, bold: !!bold, color: { argb: "FF000000" } });
const COR_OBSOLETO = "FFFBE4D5";

function folhaDocumentos(wb, nome, itens, colaboradores, locais, rodape) {
  const ws = wb.addWorksheet(nome, {
    views: [{ state: "frozen", ySplit: 8, showGridLines: false }],
    pageSetup: { paperSize: 8, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "7:8", margins: { left: 0.59, right: 0.59, top: 0.59, bottom: 0.75, header: 0.59, footer: 0 } },
  });
  if (rodape) ws.headerFooter.oddFooter = `&R${rodape}`;
  const nVers = Math.max(16, ...itens.map((d) => (d.versoes || []).length));
  // Colunas: A–I base, cargos, 1 vazia, locais, 1 vazia, Obsoleto, 1 vazia, versões.
  const cColab = 10;
  const cLocal = cColab + colaboradores.length + 1;
  const cObs = cLocal + locais.length + 1;
  const cVer = cObs + 2;
  const larg = [9.1, 11.1, 79.7, 7.1, 39.6, 39.7, 17.4, 9.9, 10.3];
  larg.forEach((w, k) => (ws.getColumn(k + 1).width = w));
  for (let c = cColab; c < cVer; c++) ws.getColumn(c).width = 3;
  ws.getColumn(cObs).width = 3.4;
  for (let c = cVer; c < cVer + nVers; c++) ws.getColumn(c).width = 9.3;
  [
    [2, 4.95],
    [4, 5.4],
    [5, 20.25],
    [7, 32.25],
    [8, 135.75],
  ].forEach(([r, h]) => (ws.getRow(r).height = h));

  const cab = (r, c, v, { bold = true, rot = false, h = "center", borda = caixa } = {}) => {
    const cel = ws.getRow(r).getCell(c);
    cel.value = v;
    cel.font = swissLt(r === 7 && c === 1 ? 7 : 8, bold);
    cel.alignment = { horizontal: h, vertical: "middle", wrapText: true, textRotation: rot ? 90 : undefined };
    cel.border = borda;
    return cel;
  };
  const titulo = ws.getCell("C5");
  titulo.value = "Controlo e Gestão Documental";
  titulo.font = { name: "Swis721 BT", size: 14, bold: true, color: { argb: "FF000000" } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  cab(7, 1, "Formulário ou Impresso (F), Normativa ou Regulamento (N), Processo (P); Manuais (M); ", { bold: false, rot: true });
  ws.mergeCells(7, 1, 8, 1);
  [
    [2, "Codificação"],
    [3, "Identificação"],
    [4, "Registo"],
    [8, "Elaborado por:"],
    [9, "Aprovado\n por:"],
  ].forEach(([c, v]) => {
    cab(7, c, v);
    cab(8, c, null);
    ws.mergeCells(7, c, 8, c);
  });
  cab(7, 5, "Armazenagem, recuperação e retenção");
  ws.mergeCells(7, 5, 7, 7);
  cab(8, 5, "armazenagem", { rot: true });
  cab(8, 6, "Protecção e recuperação", { rot: true });
  cab(8, 7, "Tempo de retenção e destino", { rot: true });
  if (colaboradores.length) {
    cab(7, cColab, "Colaborador");
    for (let c = cColab + 1; c <= cColab + colaboradores.length; c++) cab(7, c, null);
    ws.mergeCells(7, cColab, 7, cColab + colaboradores.length);
    colaboradores.forEach((t, k) => cab(8, cColab + k, t, { bold: false, rot: true }));
    cab(8, cColab + colaboradores.length, null, { bold: false });
  }
  if (locais.length) {
    cab(7, cLocal, "Local");
    for (let c = cLocal + 1; c < cLocal + locais.length; c++) cab(7, c, null);
    ws.mergeCells(7, cLocal, 7, cLocal + locais.length - 1);
    locais.forEach((t, k) => cab(8, cLocal + k, t, { bold: false, rot: true }));
  }
  cab(8, cObs, "Obsoleto", { bold: false, rot: true });
  cab(7, cVer, "Versão");
  for (let c = cVer + 1; c < cVer + nVers; c++) cab(7, c, null);
  ws.mergeCells(7, cVer, 7, cVer + nVers - 1);
  for (let k = 0; k < nVers; k++) cab(8, cVer + k, k + 1, { bold: false, rot: true });

  let r = 10;
  itens.forEach((d) => {
    const row = ws.getRow(r);
    row.height = Math.max(15, Math.ceil(String(d.identificacao || "").length / 95) * 11 + 4);
    const fill = d.obsoleto ? preencher(COR_OBSOLETO) : undefined;
    const cel = (c, v, h = "center") => {
      const x = row.getCell(c);
      x.value = v === "" ? null : v;
      x.font = swissLt(8);
      x.alignment = { horizontal: h, vertical: "middle", wrapText: true };
      x.border = caixa;
      if (fill) x.fill = fill;
      return x;
    };
    cel(1, d.tipo || "-", d.tipo === "-" ? "center" : "left");
    cel(2, d.codigo || "-");
    cel(3, d.identificacao, "left");
    cel(4, d.registo);
    cel(5, d.armazenagem);
    cel(6, d.protecao);
    cel(7, d.retencao);
    cel(8, d.elaborado);
    cel(9, d.aprovado);
    const colab = new Set(d.colaboradores || []);
    colaboradores.forEach((t, k) => cel(cColab + k, colab.has(t) ? "X" : null));
    cel(cColab + colaboradores.length, null);
    const loc = new Set(d.locais || []);
    locais.forEach((t, k) => cel(cLocal + k, loc.has(t) ? "X" : null));
    cel(cObs, d.obsoleto ? "x" : null);
    for (let k = 0; k < nVers; k++) {
      const v = (d.versoes || [])[k];
      const x = cel(cVer + k, v ? new Date(`${v}T00:00:00Z`) : null);
      x.numFmt = "mm-dd-yy";
    }
    r++;
  });
  return ws;
}

export async function gerarExcelDocumentos(ExcelJS, { itens, colaboradores, locais, rodape }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Auditoria e Gestão de Qualidade DF";
  wb.created = new Date();
  const ordem = (a, b) => (a.ordem || 0) - (b.ordem || 0);
  Object.entries(LISTAS_DOC).forEach(([k, nome]) => {
    const l =
      k === "INT"
        ? itens.filter(naListaInt).sort((a, b) => (a.ordemInt ?? a.ordem ?? 0) - (b.ordemInt ?? b.ordem ?? 0))
        : itens.filter((d) => (d.lista || "DF") === k).sort(ordem);
    if (k === "INT" && !l.length) return;
    folhaDocumentos(wb, nome, l, colaboradores, locais, rodape);
  });
  return wb.xlsx.writeBuffer();
}
export { letraCol };
