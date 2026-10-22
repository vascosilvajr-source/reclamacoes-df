// Mapa "Inscritos atualmente": uma linha por aluno e turma (Centro, Numero, Turma, Inicio, Termino).
// Serve só para acertar a turma/equipa de cada aluno no registo da app; o resto não se mexe.
// Devolve também avisos (sempre por código de aluno, nunca por nome).

const norm = (t) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const semPrefixo = (t) => norm(t).replace(/^(dragon force|df)\s*[-–·:]?\s*/, "");

// Nome de turma sem a época e sem pontuação: "26/27 - BÁSICO B1" → "basicob1".
const compacto = (t) =>
  norm(String(t || "").replace(/\b\d{2}\s*\/\s*\d{2}\b/g, ""))
    .replace(/\bepoca\b/g, "")
    .replace(/[^a-z0-9]/g, "");

function distancia(a, b) {
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
function semelhanca(a, b) {
  const x = compacto(a);
  const y = compacto(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  let s = 1 - distancia(x, y) / Math.max(x.length, y.length);
  // Números diferentes (B1 vs B2) são turmas diferentes.
  if ((x.match(/\d+/g) || []).join(",") !== (y.match(/\d+/g) || []).join(",")) s *= 0.4;
  return s;
}

const SINONIMOS = {
  centro: ["centro", "escola", "recinto", "polo"],
  id: ["numero", "n", "codigo", "codigo atleta", "id", "id aluno", "numero atleta"],
  turma: ["turma", "equipa", "turma/equipa", "escalao"],
  inicio: ["inicio", "data inicio", "data de inicio", "entrada"],
  termino: ["termino", "fim", "data fim", "data de termino", "saida"],
};

// "30-06-2027", "30/06/2027" ou data do Excel → "2027-06-30".
export function dataDeMapa(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

export function lerMapaInscritosAtuais(linhas) {
  let iCab = -1;
  let melhor = 0;
  let mapa = {};
  (linhas || []).slice(0, 10).forEach((l, i) => {
    const cab = (l || []).map(norm);
    const m = {};
    Object.entries(SINONIMOS).forEach(([k, sins]) => {
      const j = cab.findIndex((h) => sins.includes(h));
      if (j >= 0) m[k] = j;
    });
    if (Object.keys(m).length > melhor) {
      melhor = Object.keys(m).length;
      iCab = i;
      mapa = m;
    }
  });
  if (iCab < 0 || mapa.id === undefined || mapa.turma === undefined) return null;
  const registos = linhas
    .slice(iCab + 1)
    .map((l) => ({
      centro: String(l[mapa.centro] ?? "").trim(),
      id: String(l[mapa.id] ?? "").trim(),
      turma: String(l[mapa.turma] ?? "").trim(),
      inicio: dataDeMapa(l[mapa.inicio]),
      termino: dataDeMapa(l[mapa.termino]),
    }))
    .filter((r) => r.id && /\d/.test(r.id) && r.turma);
  return { mapa, registos };
}

// Época a que o mapa se refere: a mais frequente no prefixo das turmas ("26/27" → "2026/27").
export function epocaDoMapa(registos, hojeEpoca) {
  const c = {};
  registos.forEach((r) => {
    const m = r.turma.match(/\b(\d{2})\s*\/\s*(\d{2})\b/);
    if (m && Number(m[2]) === (Number(m[1]) + 1) % 100) c[`20${m[1]}/${m[2]}`] = (c[`20${m[1]}/${m[2]}`] || 0) + 1;
  });
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : hojeEpoca;
}

// reg = registo da época ({ alunos: { id: { escola, turma, estado, ... } } }).
export function compararInscritosAtuais({ registos, reg, escolas = [], mapaTurmasGuardado = {}, mapaEscolasGuardado = {}, associacoes = {}, nomeProposto = (t) => t, hoje }) {
  const alunos = (reg && reg.alunos) || {};
  const out = {
    linhas: registos.length,
    ids: 0,
    iguais: 0,
    mudar: [], // { id, escola, de, para, turmaFicheiro }
    porAssociar: [], // { turmaFicheiro, escola, n }
    desistidosNoMapa: [], // app diz que desistiu, mas aparece como inscrito
    terminados: [], // todas as linhas com término já passado
    escolaDiferente: [], // { id, escolaApp, centro }
    variasTurmas: [], // { id, turmas }
    semRegisto: [], // no mapa, mas a app não conhece o código
    foraDoMapa: [], // ativos na app, ausentes do mapa (escolas que o mapa cobre)
    semAssociacao: 0,
    ignorados: 0,
  };

  const escolaDoCentro = (centro) => {
    const n = norm(centro);
    if (!n) return null;
    const g = mapaEscolasGuardado[n];
    if (g && escolas.includes(g)) return g;
    const exata = escolas.find((e) => norm(e) === n || semPrefixo(e) === semPrefixo(centro));
    if (exata) return exata;
    const p = semPrefixo(centro);
    if (p.length >= 4) return escolas.find((e) => semPrefixo(e).includes(p) || p.includes(semPrefixo(e))) || null;
    return null;
  };

  // Turmas que a app já tem em cada escola nesta época.
  const turmasDaEscola = {};
  Object.values(alunos).forEach((a) => {
    (turmasDaEscola[a.escola] = turmasDaEscola[a.escola] || new Set()).add(a.turma);
  });

  const cacheTurma = {};
  const resolverTurma = (turmaFicheiro, escola) => {
    const k = `${escola}|${turmaFicheiro}`;
    if (k in cacheTurma) return cacheTurma[k];
    let alvo = null;
    const kn = norm(turmaFicheiro);
    if (associacoes[k] !== undefined) alvo = associacoes[k] || null;
    else {
      const existentes = [...(turmasDaEscola[escola] || [])];
      const guardada = mapaTurmasGuardado[kn];
      if (guardada && existentes.includes(guardada)) alvo = guardada;
      if (!alvo) alvo = existentes.find((t) => compacto(t) === compacto(turmaFicheiro)) || null;
      if (!alvo) {
        const prop = nomeProposto(turmaFicheiro);
        alvo = (prop && existentes.find((t) => compacto(t) === compacto(prop))) || null;
      }
      if (!alvo) {
        const melhor = existentes.map((t) => [t, semelhanca(t, turmaFicheiro)]).sort((a, b) => b[1] - a[1])[0];
        if (melhor && melhor[1] >= 0.85) alvo = melhor[0];
      }
    }
    cacheTurma[k] = alvo;
    return alvo;
  };

  const porId = {};
  registos.forEach((r) => (porId[r.id] = porId[r.id] || []).push(r));
  const ids = Object.keys(porId);
  out.ids = ids.length;
  const centrosNoMapa = new Set();
  const pendentes = {};

  ids.forEach((id) => {
    const linhasId = porId[id];
    linhasId.forEach((r) => {
      const e = escolaDoCentro(r.centro);
      if (e) centrosNoMapa.add(e);
    });
    const a = alunos[id];
    if (!a) return out.semRegisto.push(id);
    const ativas = linhasId.filter((r) => !r.termino || r.termino >= hoje);
    if (a.estado === "desistiu") {
      if (ativas.length) out.desistidosNoMapa.push(id);
      return;
    }
    if (!ativas.length) return out.terminados.push(id);
    const turmasF = [...new Set(ativas.map((r) => r.turma))];
    const escolaF = escolaDoCentro(ativas[0].centro);
    if (escolaF && escolaF !== a.escola) return out.escolaDiferente.push({ id, escolaApp: a.escola, centro: ativas[0].centro });
    // Duas turmas ao mesmo tempo: se uma delas já é a da app, está certo; senão, avisa.
    if (turmasF.length > 1) {
      const alvos = turmasF.map((t) => resolverTurma(t, a.escola));
      if (alvos.includes(a.turma)) return out.iguais++;
      return out.variasTurmas.push({ id, turmas: turmasF });
    }
    const tf = turmasF[0];
    const alvo = resolverTurma(tf, a.escola);
    if (alvo === "__skip__") return out.ignorados++;
    if (alvo === null) {
      const k = `${a.escola}|${tf}`;
      pendentes[k] = pendentes[k] || { turmaFicheiro: tf, escola: a.escola, n: 0, chave: k };
      pendentes[k].n++;
      out.semAssociacao++;
      return;
    }
    if (alvo === a.turma) return out.iguais++;
    out.mudar.push({ id, escola: a.escola, de: a.turma, para: alvo, turmaFicheiro: tf });
  });

  out.porAssociar = Object.values(pendentes).sort((x, y) => y.n - x.n);
  // Alunos ativos na app, de escolas que o mapa cobre, que não aparecem no mapa.
  Object.values(alunos).forEach((a) => {
    if (a.estado === "ativo" && centrosNoMapa.has(a.escola) && !porId[a.id]) out.foraDoMapa.push(a.id);
  });
  return out;
}
