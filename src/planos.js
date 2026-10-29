// Planos semanais de atividades (DFF.013) em PDF → horários dos Espaços.
// Lê o texto com posições (pdf.js), percebe as colunas dos dias, as horas de cada bloco,
// as secções (turmas, seleções, equipas de competição, guarda-redes…) e devolve uma linha
// por treino. A correspondência com as turmas da app faz-se depois, e pode ser corrigida.

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const DIAS_PLANO = ["2ª feira", "3ª feira", "4ª feira", "5ª feira", "6ª feira", "Sábado"];
export const DIA_APP = { "2ª feira": "Segunda", "3ª feira": "Terça", "4ª feira": "Quarta", "5ª feira": "Quinta", "6ª feira": "Sexta", Sábado: "Sábado" };
const TURMA = /^(RA[IÍ]Z|INICIA|INCIA|B[ÁA]SICO|INTERM|AVAN|EXPERT|SUB\s?\/?\s?\d|TURMAS|WALKING|FOOTBALL|YOUTH)/i;
const SEC = /(TREINO OPTIMIZA|TREINO DE OPTIMIZA|TREINO DE OTIMIZA|GUARDA|CAPACIDADES|SELE[ÇC][ÕO]ES|EQUIPAS DE COMPETI|OUTRAS ATIVIDADES)/i;
const HORA = /^(\d{1,2})[Hh:](\d{2})(\s*-\s*\d{1,2}[Hh:]\d{2})?$/;
// Sessões extra (os mesmos alunos de outras turmas) ficam desligadas por omissão.
export const SECAO_EXTRA = /GUARDA|OPTIMIZA|OTIMIZA|CAPACIDADES|OUTRAS/i;

// Texto da 1.ª página em linhas com posição (y a crescer para baixo, como no papel).
export async function linhasDoPdf(dados) {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const doc = await pdfjs.getDocument({ data: dados, isEvalSupported: false }).promise;
  const pg = await doc.getPage(1);
  const H = pg.getViewport({ scale: 1 }).height;
  const tc = await pg.getTextContent();
  return linhasDeItens(tc.items, H);
}
export function linhasDeItens(items, H) {
  const itens = items
    .filter((i) => i.str && i.str.trim() && Math.abs(i.transform[1]) < 0.01)
    .map((i) => {
      const h = Math.abs(i.transform[3]) || i.height || 4;
      const base = H - i.transform[5];
      return { x0: i.transform[4], x1: i.transform[4] + i.width, y0: base - h, y1: base + h * 0.2, h, t: i.str.replace(/\s+/g, " ").trim() };
    });
  return juntarLinhas(itens);
}

// Junta pedaços na mesma linha de base e encostados (palavras partidas pelo PDF).
function juntarLinhas(itens) {
  const ord = [...itens].sort((a, b) => a.y1 - b.y1 || a.x0 - b.x0);
  const out = [];
  ord.forEach((i) => {
    const ult = out[out.length - 1];
    if (ult && Math.abs(ult.y1 - i.y1) < 0.6 && i.x0 - ult.x1 < Math.max(1.2, i.h * 0.35) && i.x0 >= ult.x0) {
      ult.t = `${ult.t}${i.x0 - ult.x1 > 0.4 ? " " : ""}${i.t}`;
      ult.x1 = Math.max(ult.x1, i.x1);
      ult.y0 = Math.min(ult.y0, i.y0);
      ult.h = Math.max(ult.h, i.h);
    } else out.push({ ...i });
  });
  return out;
}

// Linhas → treinos do plano.
export function lerPlanoSemanal(L) {
  const titulo = (L.find((l) => /plano semanal/i.test(l.t)) || {}).t || "";
  const semana = (() => {
    const i = L.findIndex((l) => /^SEMANA$/i.test(l.t));
    if (i < 0) return "";
    const s = L[i];
    const n = L.filter((l) => Math.abs(l.y1 - s.y1) < 3 && l.x0 > s.x1 && /^\d{1,2}$/.test(l.t)).sort((a, b) => a.x0 - b.x0)[0];
    return n ? n.t : "";
  })();
  const ano = (L.find((l) => /^\d{4}\s*-\s*\d{4}$/.test(l.t)) || {}).t || "";
  const cab = L.filter((l) => DIAS_PLANO.includes(l.t));
  if (cab.length < 5) throw new Error("não encontrei os dias da semana no PDF (2ª feira … Sábado)");
  const ycab = Math.min(...cab.map((l) => l.y0));
  const trp = L.filter((l) => /^TRP/.test(l.t) && Math.abs(l.y0 - ycab) < 22).sort((a, b) => a.x0 - b.x0);
  const hcol = L.filter((l) => l.t === "H" && Math.abs(l.y0 - ycab) < 22);
  // Há dois modelos: colunas "TRP … H" ou "T | TA | EQUIPA / TURMA | BAL." (um "T" a abrir cada dia).
  const tcol = L.filter((l) => l.t === "T" && Math.abs(l.y0 - ycab) < 22).sort((a, b) => a.x0 - b.x0);
  let inicios;
  if (trp.length >= 5) {
    inicios = trp.slice(0, 5).map((t) => t.x0 - 3);
    inicios.push(hcol.length ? hcol[0].x0 - 3 : trp[5] ? trp[5].x0 - 15 : inicios[4] + (inicios[4] - inicios[3]));
  } else if (tcol.length >= 6) {
    inicios = tcol.slice(0, 6).map((t) => t.x0 - 3);
  } else {
    // Último recurso: o início de cada dia a meio caminho entre os nomes dos dias.
    const cabOrd = [...cab].sort((a, b) => a.x0 - b.x0);
    if (cabOrd.length < 6) throw new Error("não encontrei as colunas dos dias");
    inicios = cabOrd.slice(0, 6).map((c, i) => (i === 0 ? 0 : (cabOrd[i - 1].x1 + c.x0) / 2 - 20));
  }
  const dom = L.find((l) => l.t === "Domingo");
  const fim = dom ? dom.x0 - 25 : Infinity;
  const dia = (x) => {
    if (x >= fim) return null;
    let k = null;
    inicios.forEach((s, i) => {
      if (x >= s) k = i;
    });
    return k;
  };
  const yleg = Math.min(...L.filter((l) => /^TREINADORES/i.test(l.t)).map((l) => l.y0), 99999);
  const corpo = L.filter((l) => l.y0 > ycab + 12 && l.y0 < yleg - 5);
  const secs = corpo.filter((l) => SEC.test(l.t) && (l.x0 + l.x1) / 2 < inicios[5]).sort((a, b) => a.y0 - b.y0);
  const horas = corpo.filter((l) => HORA.test(l.t));
  const ents = corpo.filter((l) => TURMA.test(l.t) && dia(l.x0) !== null);
  const proxima = (e) => {
    const d = dia(e.x0);
    const ys = ents.filter((x) => dia(x.x0) === d && x.y0 > e.y0 + 3).map((x) => x.y0);
    const sy = secs.filter((x) => x.y0 > e.y0 + 3).map((x) => x.y0);
    return Math.min(...ys, ...sy, e.y0 + 45);
  };
  // Horas grandes = cabeçalhos de bloco. O tamanho varia entre modelos: compara com a maior hora do plano.
  const hMax = Math.max(0, ...horas.map((h) => h.h));
  const grande = (h) => h.h >= Math.max(5.5, hMax * 0.8);
  const debaixo = (h) => !grande(h) && ents.some((x) => h.y0 - x.y0 >= 2 && h.y0 < proxima(x) && dia(x.x0) === dia(h.x0) && h.x0 < x.x0 + 5);
  const cabecalhos = horas.filter((h) => grande(h) || !debaixo(h));
  const pequenas = horas.filter((h) => !cabecalhos.includes(h));
  const horaDe = (e) => {
    const d = dia(e.x0);
    const baixo = pequenas.filter((h) => dia(h.x0) === d && h.y0 - e.y0 >= 2 && h.y0 < proxima(e) && h.x0 < e.x0 + 5).sort((a, b) => a.y0 - b.y0);
    if (baixo.length) return [baixo[0].t, "linha"];
    const acima = cabecalhos.filter((h) => h.y0 < e.y0 - 1 && dia(h.x0) !== null && dia(h.x0) < 5);
    const mesmo = acima.filter((h) => dia(h.x0) === d);
    const cand = mesmo.length ? mesmo : acima;
    if (cand.length) return [cand.sort((a, b) => b.y0 - a.y0)[0].t, "bloco"];
    return [null, null];
  };
  // Sábado: horas escritas na vertical (um carácter por linha) na coluna H.
  const xs = inicios[5];
  const chars = corpo.filter((l) => l.t.length === 1 && l.x0 >= xs - 2 && l.x0 <= xs + 12).sort((a, b) => a.y0 - b.y0);
  const grupos = [];
  chars.forEach((c) => {
    const g = grupos[grupos.length - 1];
    if (g && c.y0 - g[g.length - 1].y0 < 9) g.push(c);
    else grupos.push([c]);
  });
  const vert = grupos.filter((g) => g.length >= 4).map((g) => ({ t: g.map((c) => c.t).join(""), y0: g[0].y0, y1: g[g.length - 1].y1 }));

  const treinos = [];
  [...ents]
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
    .forEach((e) => {
      const d = dia(e.x0);
      const marcos = [...secs.filter((s) => s.y0 < e.y0 - 1).map((s) => [s.y0, s.t]), ...cabecalhos.filter((h) => grande(h) && h.y0 < e.y0 - 1).map((h) => [h.y0, "TURMAS"])];
      let sec = marcos.length ? marcos.sort((a, b) => b[0] - a[0])[0][1] : "TURMAS";
      let [hora, origem] = horaDe(e);
      if (d === 5) {
        if (!/SELE|EQUIPAS|OUTRAS/i.test(sec)) sec = "TURMAS";
        if (vert.length && origem !== "linha") {
          const c = vert.filter((v) => v.y1 >= e.y0 - 2);
          hora = (c[0] || vert[vert.length - 1]).t;
          origem = "vertical";
        }
      }
      const local = corpo
        .filter((l) => dia(l.x0) === d && l.y0 > e.y0 + 2 && l.y0 < proxima(e) && l.x1 > e.x0 && l.h < 5 && !HORA.test(l.t) && !TURMA.test(l.t) && l.t.length > 3)
        .map((l) => l.t)
        .join(" ");
      // Treinadores: as siglas (2 letras) à esquerda do nome, na mesma linha do plano.
      const siglas = new Set(corpo.filter((l) => /^[A-ZÇ]{2}$/.test(l.t) && dia(l.x0) === d && l.x1 <= e.x0 + 1 && l.y0 >= e.y0 - 6 && l.y0 < Math.min(proxima(e), e.y0 + 14)).map((l) => `${l.t}@${Math.round(l.x0)}`));
      // Hora escrita no próprio nome ("SUB 11 (18H10)") manda sobre a do bloco.
      const noNome = e.t.match(/\((\d{1,2}[Hh:]\d{2})\)/);
      if (noNome) {
        hora = noNome[1];
        origem = "linha";
      }
      treinos.push({ treinadores: siglas.size, dia: DIAS_PLANO[d], hora: normalizarHora(hora), horaIncerta: !hora || (origem === "bloco" && /^SUB/i.test(e.t) && !/^TURMAS$/i.test(sec)), secao: titulo1(sec), nome: e.t.replace(/\s+/g, " ").trim(), local });
    });
  // Repetidos (mesma turma, dia e hora) ficam uma vez só.
  const vistos = new Set();
  const unicos = treinos.filter((t) => {
    const k = `${t.dia}|${t.hora}|${norm(t.nome)}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  return { titulo, semana, ano, treinos: unicos };
}
const titulo1 = (s) => {
  const t = String(s || "").trim();
  return t.charAt(0) + t.slice(1).toLowerCase();
};
// "18H30", "18h30", "18H30 - 19H40" → "18:30"
export function normalizarHora(h) {
  const m = String(h || "").match(/(\d{1,2})[Hh:](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

// Escola provável a partir do título ("Plano Semanal de Atividades - Dragon Force Valadares").
export function escolaDoTitulo(titulo, escolas) {
  const t = norm(titulo).replace(/^.*?atividades\s*-?\s*/, "").replace(/^dragon force\s+/, "").replace(/^df\s+/, "");
  if (!t) return "";
  const lista = escolas.map((e) => ({ e, k: norm(e).replace(/^dragon force\s+/, "").replace(/^df\s+/, "") }));
  return (lista.find((x) => x.k === t) || lista.find((x) => x.k.startsWith(t) || t.startsWith(x.k)) || {}).e || "";
}

// Nome do plano → códigos de turma ("INICIAÇÃO B1.1/D3" → Iniciação B1.1 e Iniciação D3; Porto: "INICIAÇÃO 1.B1" → B1.1).
const NIV = { raiz: "Raíz", iniciacao: "Iniciação", inciacao: "Iniciação", basico: "Básico", intermedio: "Intermédio", avancado: "Avançado", expert: "Expert" };
export function unidadesDoNome(nome) {
  const n = norm(nome);
  let m = n.match(/^(raiz|iniciacao|inciacao|basico|intermedio|avancado|expert)\s+(.+)$/);
  if (m) {
    const niv = NIV[m[1]];
    return m[2]
      .replace(/\s+/g, "")
      .split("/")
      .filter(Boolean)
      .map((c) => {
        const p = c.match(/^(\d)\.([a-e]\d)$/);
        return { tipo: "turma", nome: `${niv} ${(p ? `${p[2]}.${p[1]}` : c).toUpperCase()}` };
      });
  }
  // Equipas: "SUB 10 B", "SUB 13 / SUB 15 (18H10)", "SUB 12 / 13", "SUB 11 A & B", "SUB 11.1".
  const s = n.replace(/\(\s*\d{1,2}[h:]\d{2}\s*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!/^sub\s?\d/.test(s)) return [];
  const out = [];
  let ult = null;
  for (const p of s.replace(/^sub\s?/, "").split(/\s*[/&,]\s*(?:sub\s?)?/)) {
    const q = p.trim();
    let x = q.match(/^(\d+)(?:\.(\d))?\s*([ab])?\s*(fem)?$/);
    if (x) {
      ult = x[1];
      out.push({ tipo: "equipa", nome: `Sub-${x[1]}${x[2] ? `.${x[2]}` : ""}${x[3] ? ` ${x[3].toUpperCase()}` : ""}${x[4] ? " F" : ""}` });
      continue;
    }
    x = q.match(/^([ab])$/);
    if (x && ult) {
      out.push({ tipo: "equipa", nome: `Sub-${ult} ${x[1].toUpperCase()}` });
      continue;
    }
    if (out.length) break; // o resto já não é nome de equipa (ex.: "A / C / 2" dos guarda-redes)
    return [];
  }
  return out;
}

// Turmas da app que correspondem a um nome do plano (sugestão; o utilizador pode corrigir).
// Nas equipas com o mesmo nome nos dois recintos do Dragon Force FC, o sufixo diz qual é: (NB) Porto, (UM) Maia.
export function sufixoDoRecinto(recinto) {
  const r = norm(recinto);
  if (/porto|new balance/.test(r)) return "nb";
  if (/maia|ismai|universidade/.test(r)) return "um";
  return "";
}
export function sugerirTurmasApp(nome, turmasEscola, recinto = "") {
  const suf = sufixoDoRecinto(recinto);
  const comSufixo = (t) => /\((nb|um)\)$/i.test(t);
  const lista = [...new Set(turmasEscola)];
  if (!suf) return sugerirEm(nome, lista);
  // Primeiro as turmas com o sufixo deste recinto, depois as sem sufixo, e só no fim todas.
  for (const sub of [lista.filter((t) => norm(t).endsWith(`(${suf})`)), lista.filter((t) => !comSufixo(t)), lista]) {
    const r = sugerirEm(nome, sub);
    if (r.length) return r;
  }
  return [];
}
function sugerirEm(nome, lista) {
  const chave = (t) => norm(t).replace("inciacao", "iniciacao");
  const out = new Set();
  unidadesDoNome(nome).forEach((u) => {
    const k = chave(u.nome);
    if (u.tipo === "turma") {
      let hit = lista.filter((t) => chave(t) === k);
      if (!hit.length && k.includes(".")) hit = lista.filter((t) => chave(t) === k.split(".")[0]);
      if (!hit.length && !k.includes(".")) hit = lista.filter((t) => chave(t).startsWith(`${k}.`));
      hit.forEach((t) => out.add(t));
      return;
    }
    // Equipas: "Sub-10 B" também apanha "Sub-10 B GR" e "Sub-10 B (NB)".
    const gr = (t) => /\sgr(\s*\((nb|um)\))?$/.test(chave(t));
    const base = (t) => chave(t).replace(/\s*\((nb|um)\)$/, "").replace(/\s+gr$/, "").replace(/ fem$/, " f");
    const ub = k.replace(/ fem$/, " f");
    const comGR = (bases) => lista.filter((t) => bases.includes(base(t)));
    let bases = [...new Set(lista.filter((t) => !gr(t) && base(t) === ub).map(base))];
    if (!bases.length && !/ [abf]$/.test(ub)) bases = [...new Set(lista.filter((t) => !gr(t) && /^(.*) [ab]$/.test(base(t)) && base(t).slice(0, -2) === ub).map(base))];
    if (!bases.length && / [ab]$/.test(ub)) bases = [...new Set(lista.filter((t) => !gr(t) && base(t) === ub.slice(0, -2)).map(base))];
    comGR(bases).forEach((t) => out.add(t));
  });
  return [...out];
}

export const chavePlano = (nome) => norm(nome).replace(/\s+/g, " ");
