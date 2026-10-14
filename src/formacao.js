// Plano anual de formação: leitura do Excel, contas do resumo e Excel de saída.

export const FORMATOS_FORM = ["Presencial", "Online", "Híbrida", "E-learning", "Workshop"];
export const ESTADOS_FORM = ["Planeada", "Em curso", "Concluída", "Cancelada"];
export const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const norm = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Época desportiva: agosto a julho.
export function epocaDaData(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})/);
  if (!m) return "";
  const a = Number(m[1]);
  const ini = Number(m[2]) >= 8 ? a : a - 1;
  return `${ini}/${String(ini + 1).slice(2)}`;
}
export const epocaAtualForm = () => epocaDaData(new Date().toISOString().slice(0, 10));
export const anoInicioEpoca = (ep) => Number(String(ep).slice(0, 4));
// Os 12 meses da época, de agosto a julho: [{ano, mes(0-11)}].
export const mesesDaEpoca = (ep) => {
  const a = anoInicioEpoca(ep);
  return Array.from({ length: 12 }, (_, k) => ({ ano: k < 5 ? a : a + 1, mes: (7 + k) % 12 }));
};
export const mesCurtoDe = (iso) => {
  const m = String(iso || "").match(/^\d{4}-(\d{2})/);
  return m ? MESES_CURTOS[Number(m[1]) - 1] : "";
};

// ---------- leitura do Excel ----------
const valorCelula = (c) => {
  let v = c && c.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) v = v.result;
    else if (v.richText) v = v.richText.map((r) => r.text).join("");
    else if ("text" in v) v = v.text;
  }
  return v === undefined ? null : v;
};
const texto = (v) => (v === null || v === undefined ? "" : v instanceof Date ? "" : String(v).replace(/\s+/g, " ").trim());
const dataIso = (v) => {
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : new Date(v.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  const s = texto(v);
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const a = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${a}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};
// Percentagens: 0,65 ou 65 → 0,65.
const fracao = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace("%", "").replace(",", "."));
  if (!isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
};
const numero = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
};

const COLUNAS = [
  ["num", /^id$|^n\.?o?$/],
  ["data", /^data/],
  ["mes", /^mes$/],
  ["conteudo", /^conteudo|^tema|^acao/],
  ["objetivo", /^objetivo/],
  ["formato", /^formato/],
  ["orador", /^orador|^formador/],
  ["local", /^local/],
  ["estado", /^estado/],
  ["participantes", /^participantes/],
  ["adesao", /^adesao/],
  ["satisfacao", /^satisfacao/],
  ["eficacia", /^eficacia/],
  ["observacoes", /^observac/],
  ["publico", /^publico/],
  ["area", /^area/],
];

export function lerFormacaoDoExcel(wb) {
  const avisos = [];
  let folha = null;
  let hr = null;
  const folhas = [];
  wb.eachSheet((ws) => folhas.push(ws));
  // A folha do plano: a que tem um cabeçalho com "Conteúdo" (de preferência a chamada "Plano…").
  folhas.sort((a, b) => (/plano/i.test(b.name) ? 1 : 0) - (/plano/i.test(a.name) ? 1 : 0));
  for (const ws of folhas) {
    for (let r = 1; r <= 20 && !hr; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= Math.min(30, ws.columnCount); c++) if (/^conteudo/.test(norm(valorCelula(row.getCell(c))))) hr = r;
    }
    if (hr) {
      folha = ws;
      break;
    }
  }
  if (!folha) return { itens: [], avisos: ["Não encontrei a folha do plano (um cabeçalho com «Conteúdo»)."], titulo: "" };
  const titulo = texto(valorCelula(folha.getRow(1).getCell(1)));
  const col = {};
  const cab = folha.getRow(hr);
  for (let c = 1; c <= folha.columnCount; c++) {
    const t = norm(valorCelula(cab.getCell(c)));
    const k = (COLUNAS.find(([, re]) => re.test(t)) || [])[0];
    if (k && !col[k]) col[k] = c;
  }
  const itens = [];
  for (let r = hr + 1; r <= folha.rowCount; r++) {
    const row = folha.getRow(r);
    const g = (k) => (col[k] ? valorCelula(row.getCell(col[k])) : null);
    const conteudo = texto(g("conteudo"));
    const data = dataIso(g("data"));
    if (!conteudo && !data) continue; // linhas do modelo ainda por preencher
    const estado = texto(g("estado"));
    const formato = texto(g("formato"));
    itens.push({
      id: `form-${Date.now().toString(36)}-${r}`,
      num: numero(g("num")),
      data,
      conteudo,
      objetivo: texto(g("objetivo")),
      formato: FORMATOS_FORM.find((f) => norm(f) === norm(formato)) || formato,
      orador: texto(g("orador")),
      local: texto(g("local")),
      estado: ESTADOS_FORM.find((e) => norm(e) === norm(estado)) || estado || "Planeada",
      participantes: numero(g("participantes")),
      adesao: fracao(g("adesao")),
      satisfacao: fracao(g("satisfacao")),
      eficacia: fracao(g("eficacia")),
      observacoes: texto(g("observacoes")),
      publico: texto(g("publico")),
      area: texto(g("area")),
    });
  }
  const semData = itens.filter((i) => !i.data).length;
  if (semData) avisos.push(`${semData} ${semData === 1 ? "ação ainda não tem" : "ações ainda não têm"} data: ficam no plano, fora do calendário.`);
  // Época: a das datas (a mais frequente), senão a do título ("2026/2027" ou "2026").
  const conta = {};
  itens.forEach((i) => i.data && (conta[epocaDaData(i.data)] = (conta[epocaDaData(i.data)] || 0) + 1));
  let epoca = Object.entries(conta).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  if (!epoca) {
    const m = titulo.match(/(20\d{2})\s*[/-]\s*(20)?(\d{2})/) || titulo.match(/(20\d{2})/);
    if (m) epoca = `${m[1]}/${String(Number(m[1]) + 1).slice(2)}`;
  }
  return { itens, avisos, titulo, epoca: epoca || epocaAtualForm(), folha: folha.name };
}

// ---------- contas ----------
const media = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
export function resumoFormacao(itens) {
  const ativas = itens.filter((i) => i.estado !== "Cancelada");
  const concl = itens.filter((i) => i.estado === "Concluída");
  const val = (k) => concl.map((i) => i[k]).filter((v) => typeof v === "number" && v > 0);
  return {
    total: itens.filter((i) => i.conteudo).length,
    concluidas: concl.length,
    planeadas: itens.filter((i) => i.estado === "Planeada").length,
    emCurso: itens.filter((i) => i.estado === "Em curso").length,
    canceladas: itens.filter((i) => i.estado === "Cancelada").length,
    taxa: ativas.length ? concl.length / ativas.length : null,
    participantes: concl.reduce((a, i) => a + (Number(i.participantes) || 0), 0),
    adesao: media(val("adesao")),
    satisfacao: media(val("satisfacao")),
    eficacia: media(val("eficacia")),
    semData: itens.filter((i) => !i.data).length,
  };
}

// ---------- Excel de saída (como o original: Resumo, Plano, Calendário, Listas) ----------
const AZUL_ESC = "FF17365D";
const AZUL = "FF2F75B5";
const AZUL_MES = "FF1F4E79";
const CINZA_TXT = "FF5B6573";
const FUNDO_KPI = "FFEAF2F8";
const FUNDO_DIAS = "FFD9E1F2";
const FUNDO_ACAO = "FFDDEBF7";
const fonte = (o = {}) => ({ name: "Aptos", size: 10, ...o });
const preencher = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const fina = { style: "thin", color: { argb: "FFBFC9D6" } };
const bordas = { top: fina, left: fina, bottom: fina, right: fina };

export async function gerarExcelFormacao(ExcelJS, { itens, epoca }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Auditoria e Gestão de Qualidade DF";
  wb.created = new Date();
  const a = anoInicioEpoca(epoca);
  const lista = [...itens].sort((x, y) => String(x.data || "9999").localeCompare(String(y.data || "9999")) || (x.num || 0) - (y.num || 0));
  const nLinhas = Math.max(lista.length, 1);
  const ult = 5 + nLinhas;

  const resumo = wb.addWorksheet("Resumo Anual", { views: [{ showGridLines: false }] });
  const plano = wb.addWorksheet("Plano de Formação", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
  const cal = wb.addWorksheet("Calendário", { views: [{ showGridLines: false }] });
  const listas = wb.addWorksheet("Listas");

  // Listas
  listas.getRow(1).values = ["Formato", "Estado", "Eficácia", "Mês"];
  listas.getRow(1).font = fonte({ bold: true });
  FORMATOS_FORM.forEach((f, k) => (listas.getCell(k + 2, 1).value = f));
  ESTADOS_FORM.forEach((e, k) => (listas.getCell(k + 2, 2).value = e));
  MESES_CURTOS.forEach((m, k) => (listas.getCell(k + 2, 4).value = m));
  listas.columns.forEach((c) => (c.width = 14));

  // Plano
  const cab = ["ID", "Data", "Mês", "Conteúdo", "Objetivo", "Formato da formação", "Orador responsável", "Local", "Estado", "Participantes", "Adesão (%)", "Satisfação (%)", "Eficácia", "Observações", "Público-alvo", "Área responsável"];
  const larg = [6.5, 12, 7, 38, 32, 18, 28, 26, 12, 13, 11, 13, 10, 36, 20, 18];
  larg.forEach((w, k) => (plano.getColumn(k + 1).width = w));
  plano.mergeCells(1, 1, 1, 16);
  plano.mergeCells(2, 1, 2, 16);
  plano.getCell(1, 1).value = `PLANO ANUAL DE FORMAÇÃO ${a}/${a + 1}`;
  plano.getCell(1, 1).font = fonte({ size: 20, bold: true, color: { argb: "FFFFFFFF" } });
  plano.getCell(1, 1).fill = preencher(AZUL_ESC);
  plano.getRow(1).height = 32;
  plano.getCell(2, 1).value = "Registo, calendarização e avaliação das ações de formação";
  plano.getCell(2, 1).font = fonte({ color: { argb: CINZA_TXT } });
  cab.forEach((t, k) => {
    const c = plano.getCell(5, k + 1);
    c.value = t;
    c.font = fonte({ bold: true, color: { argb: "FFFFFFFF" } });
    c.fill = preencher(AZUL);
    c.alignment = { vertical: "middle", wrapText: true };
    c.border = bordas;
  });
  plano.getRow(5).height = 30;
  lista.forEach((i, k) => {
    const r = 6 + k;
    const vals = [
      i.num ?? k + 1,
      i.data ? new Date(`${i.data}T00:00:00Z`) : null,
      mesCurtoDe(i.data) || null,
      i.conteudo || null,
      i.objetivo || null,
      i.formato || null,
      i.orador || null,
      i.local || null,
      i.estado || null,
      i.participantes ?? null,
      i.adesao ?? null,
      i.satisfacao ?? null,
      i.eficacia ?? null,
      i.observacoes || null,
      i.publico || null,
      i.area || null,
    ];
    vals.forEach((v, j) => {
      const c = plano.getCell(r, j + 1);
      c.value = v;
      c.font = fonte();
      c.border = bordas;
      c.alignment = { vertical: "top", wrapText: [3, 4, 6, 7, 13, 14].includes(j) };
      if (k % 2 === 1) c.fill = preencher("FFF4F8FC");
    });
    plano.getCell(r, 2).numFmt = "dd/mm/yyyy";
    [11, 12, 13].forEach((j) => (plano.getCell(r, j).numFmt = "0%"));
  });
  plano.autoFilter = { from: { row: 5, column: 1 }, to: { row: ult, column: 16 } };
  for (let r = 6; r <= ult; r++) {
    plano.getCell(r, 6).dataValidation = { type: "list", allowBlank: true, formulae: [`Listas!$A$2:$A$${FORMATOS_FORM.length + 1}`] };
    plano.getCell(r, 9).dataValidation = { type: "list", allowBlank: true, formulae: [`Listas!$B$2:$B$${ESTADOS_FORM.length + 1}`] };
    [11, 12, 13].forEach((j) => (plano.getCell(r, j).dataValidation = { type: "decimal", operator: "between", allowBlank: true, formulae: [0, 1] }));
  }

  // Resumo (fórmulas sobre o plano, como no original)
  const P = (col) => `'Plano de Formação'!$${col}$6:$${col}$${ult}`;
  resumo.getColumn(1).width = 22;
  resumo.getColumn(2).width = 12;
  resumo.getColumn(3).width = 12;
  resumo.getColumn(4).width = 22;
  resumo.getColumn(5).width = 12;
  resumo.getColumn(6).width = 10;
  resumo.mergeCells(1, 1, 1, 12);
  resumo.mergeCells(2, 1, 2, 12);
  resumo.getCell(1, 1).value = "MONITORIZAÇÃO DO PLANO ANUAL DE FORMAÇÃO";
  resumo.getCell(1, 1).font = fonte({ size: 20, bold: true, color: { argb: "FFFFFFFF" } });
  resumo.getCell(1, 1).fill = preencher(AZUL_ESC);
  resumo.getRow(1).height = 32;
  resumo.getCell(2, 1).value = `Época ${a}/${a + 1} | Atualização automática a partir do plano`;
  resumo.getCell(2, 1).font = fonte({ color: { argb: CINZA_TXT } });
  const kpi = (r, c, rotulo, formula, fmt) => {
    const l = resumo.getCell(r, c);
    l.value = rotulo;
    l.font = fonte({ bold: true });
    l.fill = preencher(FUNDO_KPI);
    const v = resumo.getCell(r, c + 1);
    v.value = { formula };
    v.font = fonte({ bold: true, size: 12, color: { argb: AZUL_ESC } });
    v.fill = preencher(FUNDO_KPI);
    v.numFmt = fmt;
  };
  kpi(4, 1, "Ações planeadas", `COUNTIF(${P("D")},"?*")`, "0");
  kpi(6, 1, "Concluídas", `COUNTIF(${P("I")},"Concluída")`, "0");
  kpi(4, 4, "Taxa de conclusão", "IFERROR(B6/(B4-COUNTIF(" + P("I") + ',"Cancelada")),0)', "0%");
  kpi(6, 4, "Eficácia média", `IFERROR(AVERAGEIF(${P("M")},">0"),0)`, "0%");
  kpi(8, 1, "Participantes", `SUM(${P("J")})`, "0");
  kpi(8, 4, "Satisfação média", `IFERROR(AVERAGEIF(${P("L")},">0"),0)`, "0%");
  const th = (r, c, t) => {
    const x = resumo.getCell(r, c);
    x.value = t;
    x.font = fonte({ bold: true, color: { argb: "FFFFFFFF" } });
    x.fill = preencher(AZUL);
    x.border = bordas;
  };
  th(10, 1, "Mês");
  th(10, 2, "Ações");
  th(10, 3, "Concluídas");
  th(10, 5, "Formato");
  th(10, 6, "Ações");
  mesesDaEpoca(epoca).forEach(({ mes }, k) => {
    const r = 11 + k;
    resumo.getCell(r, 1).value = MESES_CURTOS[mes];
    resumo.getCell(r, 2).value = { formula: `COUNTIF(${P("C")},A${r})` };
    resumo.getCell(r, 3).value = { formula: `COUNTIFS(${P("C")},A${r},${P("I")},"Concluída")` };
    [1, 2, 3].forEach((c) => {
      resumo.getCell(r, c).font = fonte();
      resumo.getCell(r, c).border = bordas;
    });
  });
  FORMATOS_FORM.forEach((f, k) => {
    const r = 11 + k;
    resumo.getCell(r, 5).value = f;
    resumo.getCell(r, 6).value = { formula: `COUNTIF(${P("F")},E${r})` };
    [5, 6].forEach((c) => {
      resumo.getCell(r, c).font = fonte();
      resumo.getCell(r, c).border = bordas;
    });
  });

  // Calendário: 12 meses da época, 3 por linha, com as ações escritas nos dias.
  for (let c = 1; c <= 23; c++) cal.getColumn(c).width = c % 8 === 0 ? 2 : 15;
  cal.mergeCells(1, 1, 1, 23);
  cal.mergeCells(2, 1, 2, 23);
  cal.getCell(1, 1).value = `CALENDÁRIO DA ÉPOCA DESPORTIVA ${a}/${a + 1}`;
  cal.getCell(1, 1).font = fonte({ size: 18, bold: true, color: { argb: "FFFFFFFF" } });
  cal.getCell(1, 1).fill = preencher(AZUL_ESC);
  cal.getCell(1, 1).alignment = { horizontal: "center" };
  cal.getRow(1).height = 30;
  const comData = lista.filter((i) => i.data);
  cal.getCell(2, 1).value = `Agosto de ${a} a julho de ${a + 1} | ${comData.filter((i) => epocaDaData(i.data) === epoca).length} ações calendarizadas`;
  cal.getCell(2, 1).font = fonte({ color: { argb: CINZA_TXT } });
  cal.getCell(2, 1).alignment = { horizontal: "center" };
  const porDia = {};
  comData.forEach((i) => (porDia[i.data] = porDia[i.data] || []).push(i));
  mesesDaEpoca(epoca).forEach(({ ano, mes }, k) => {
    const r0 = 4 + Math.floor(k / 3) * 9;
    const c0 = 1 + (k % 3) * 8;
    cal.mergeCells(r0, c0, r0, c0 + 6);
    const t = cal.getCell(r0, c0);
    t.value = `${MESES_LONGOS[mes].toUpperCase()} ${ano}`;
    t.font = fonte({ size: 11, bold: true, color: { argb: "FFFFFFFF" } });
    t.fill = preencher(AZUL_MES);
    t.alignment = { horizontal: "center" };
    ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].forEach((d, j) => {
      const x = cal.getCell(r0 + 1, c0 + j);
      x.value = d;
      x.font = fonte({ size: 11, bold: true });
      x.fill = preencher(FUNDO_DIAS);
      x.alignment = { horizontal: "center" };
    });
    const prim = new Date(Date.UTC(ano, mes, 1));
    const desloc = (prim.getUTCDay() + 6) % 7;
    const nDias = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    for (let s = 0; s < 6; s++) {
      for (let j = 0; j < 7; j++) {
        const dia = s * 7 + j - desloc + 1;
        const x = cal.getCell(r0 + 2 + s, c0 + j);
        x.border = bordas;
        x.alignment = { vertical: "top", wrapText: true };
        x.font = fonte();
        if (dia < 1 || dia > nDias) continue;
        const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
        const acoes = porDia[iso] || [];
        x.value = [String(dia), ...acoes.map((i) => i.conteudo)].join("\n");
        if (acoes.length) x.fill = preencher(FUNDO_ACAO);
      }
    }
    for (let s = 0; s < 6; s++) {
      const r = cal.getRow(r0 + 2 + s);
      r.height = Math.max(r.height || 0, 48);
    }
  });

  [resumo, plano, cal].forEach((ws) => (ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }));
  return wb.xlsx.writeBuffer();
}
