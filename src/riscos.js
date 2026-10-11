// Pensamento baseado no risco e oportunidades (DFF.151.01).
// Lógica sem React: importar o Excel do documento, detetar nos dados da app riscos e
// oportunidades que a lista ainda não tem, e gerar o Excel no mesmo formato.

// ---------- utilitários ----------
const norm = (t) =>
  String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function epocaDeData(d) {
  const x = new Date(String(d || "").slice(0, 10) + "T00:00:00");
  if (isNaN(x.getTime())) return "";
  const ano = x.getMonth() >= 7 ? x.getFullYear() : x.getFullYear() - 1;
  return `${ano}/${String(ano + 1).slice(2)}`;
}
const epocaAudit = (a) => a.epoca || epocaDeData(a.date);
const epocaAnterior = (ep) => `${Number(ep.slice(0, 4)) - 1}/${ep.slice(2, 4)}`;
// "2026/27" <-> "26.27" (nome das folhas do documento) e "2026/2027" (célula Época).
export const folhaDaEpoca = (ep) => `${ep.slice(2, 4)}.${ep.slice(5, 7)}`;
const epocaLonga = (ep) => `${ep.slice(0, 4)}/${Number(ep.slice(0, 4)) + 1}`;

export const nivelRisco = (it) => (it && it.tipo !== "O" && Number(it.po) > 0 && Number(it.gr) > 0 ? Number(it.po) * Number(it.gr) : null);
export const faixaRisco = (nr) => (nr === null || nr === undefined ? null : nr <= 3 ? "baixo" : nr <= 8 ? "medio" : "alto");
export const aceitacaoSugerida = (nr) => (nr === null || nr === undefined ? "" : nr <= 3 ? "A" : nr <= 8 ? "AM" : "NA");
export const ACEITACAO = {
  A: "Aceitável",
  AM: "Aceitável com monitorização",
  NA: "Não aceitável",
};
export const PO_ROTULOS = { 1: "Baixa", 2: "Média", 3: "Alta", 4: "Muito alta" };
export const GR_ROTULOS = { 1: "Insignificante", 2: "Moderada", 3: "Significativa", 4: "Muito significativa" };
export const PO_DESCRICAO = {
  1: "Não existe histórico de ocorrência do risco; o risco, não sendo impossível, é pouco provável / raro / remoto",
  2: "O risco ocorre esporadicamente; já aconteceu mas não é frequente; a probabilidade de ocorrência do risco é muito baixa, embora não desprezável",
  3: "O risco ocorre com alguma frequência havendo um razoável histórico do mesmo; embora não seja uma certeza existe uma franca probabilidade da ocorrência do risco",
  4: "Risco ocorre sistematicamente estando associado à atividade, operação ou produto; ocorrência em contínuo; probabilidade muito elevada do risco ocorrer",
};
export const GR_DESCRICAO = {
  1: "Falhas/perdas na qualidade de prestação do serviço com consequências desprezáveis, sem importância na organização",
  2: "Falhas/perdas na qualidade de prestação do serviço com consequências pouco graves, pouco representativas na organização",
  3: "Falhas/perdas na qualidade de prestação do serviço com consequências graves, representativas em parte, na organização",
  4: "Falhas/perdas na qualidade de prestação do serviço com consequências muito graves, muito representativas na organização",
};
export const ACEITACAO_DESCRICAO = [
  ["NR ≤ 3", "Aceitável", "Potenciais riscos e danos são aceitáveis sem necessidade de nenhuma ação adicional"],
  ["4 ≤ NR ≤ 8", "Aceitável com Monitorização", "Potenciais riscos e danos são aceitáveis, mas a Organização tem de continuar a monitorizar"],
  ["9 ≤ NR ≤ 16", "Não Aceitável(*)", "Potenciais riscos e danos são inaceitáveis. A Organização é obrigada a implementar uma metodologia de tratamento do risco"],
];
export const NOTA_ACEITACAO = "(*) No caso dos riscos não aceitáveis se os benefícios compensarem os riscos, então os riscos podem ser aceites.";

export const PROCESSOS_PADRAO = [
  { codigo: "PR.01-Gestão e Operacionalizaçao da Escola de futebol", nome: "PR.01 - Gestão e Operacionalização Escola Futebol", responsavel: "" },
  { codigo: "PR.02 - Desenvolvimento da marca", nome: "PR.02 – Desenvolvimento da marca", responsavel: "" },
  { codigo: "PR.03-Recrutamento, Integração e formação", nome: "PR.03 – Recrutamento, Integração e Formação", responsavel: "" },
  { codigo: "PR.04- Sistema de Gestão", nome: "PR.04 – Sistema de Gestão", responsavel: "" },
  { codigo: "PR.05-Gestão de Compras", nome: "PR.05 – Gestão de Compras", responsavel: "" },
];
export const codigoProcesso = (p) => (String(p || "").match(/PR\.?\s*0?(\d+)/i) || [])[1] || "";

// Datas do Excel (número de série) para texto dd-mm-aaaa; texto fica como está.
function textoData(v) {
  const s = String(v ?? "").trim();
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(s)) * 86400000);
    return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  return s;
}
const limpa = (v) => String(v ?? "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();

// ---------- importação ----------
// folhas: [{ nome, linhas }] como devolve o leitor de Excel da app (cada linha com __linha).
export function lerRiscosDoExcel(folhas) {
  const epocas = {};
  const avisos = [];
  let legendas = null;
  const deEpoca = folhas.filter((f) => /^\d{2}\.\d{2}$/.test(String(f.nome).trim()));
  deEpoca.forEach((f) => {
    const [a, b] = f.nome.trim().split(".");
    const ep = `20${a}/${b}`;
    const linhas = f.linhas;
    // Linha onde começam os dados: a primeira com Nº numérico e texto ao lado.
    const temDados = (l) => /^\d+(\.0+)?$/.test(String(l[0] ?? "").trim()) && l.slice(1, 8).some((c) => String(c ?? "").trim().length > 3);
    const iDados = linhas.findIndex(temDados);
    if (iDados < 0) return avisos.push(`Folha ${f.nome}: não encontrei linhas de dados.`);
    const cab = linhas.slice(0, iDados);
    const largura = Math.max(...cab.map((l) => l.length), 0);
    const textoCol = [];
    for (let j = 0; j < largura; j++) textoCol[j] = norm(cab.map((l) => l[j] ?? "").join(" "));
    // A legenda de critérios à direita não conta como coluna.
    let corte = largura;
    for (let j = 0; j < largura; j++) if (/criterios de possibilidade|avaliacao do risco|criterios de aceitacao/.test(textoCol[j])) { corte = j; break; }
    const col = {};
    const ocorr = { po: 0, gr: 0, nr: 0 };
    for (let j = 0; j < corte; j++) {
      const t = textoCol[j];
      if (!t) continue;
      const marca = (k) => col[k] === undefined && (col[k] = j);
      if (j === 0 || /(^|\s)nº(\s|$)/.test(t)) { if (col.n === undefined) col.n = j; continue; }
      if (/descricao da causa/.test(t)) marca("causa");
      else if (/descricao do impacto/.test(t)) marca("impacto");
      else if (/identificacao do risco/.test(t)) marca("identificacao");
      else if (/objetivos estrategicos/.test(t)) marca("objetivo");
      else if (/questoes internas|proveniencia/.test(t)) marca("proveniencia");
      else if (/processo/.test(t) && !/tratamento/.test(t)) marca("processo");
      else if (/^tipo$|\btipo\b/.test(t)) marca("tipo");
      else if (/possibilidade de ocorrencia/.test(t)) { col[ocorr.po++ ? "reavPo" : "po"] = j; }
      else if (/gravidade/.test(t)) { col[ocorr.gr++ ? "reavGr" : "gr"] = j; }
      else if (/nivel de risco/.test(t)) { col[ocorr.nr++ ? "reavNr" : "nr"] = j; }
      else if (/aceitacao do risco/.test(t)) marca("aceitacao");
      else if (/responsavel/.test(t)) marca("responsavel");
      else if (/tratamento|correctiva|corretiva/.test(t)) marca("acao");
      else if (/^e\/ne$|e\/ne/.test(t)) marca("eficacia");
      else if (/estado/.test(t)) marca("estado");
      else if (/observac/.test(t)) marca("observacoes");
      else if (/^data$|\bdata\b/.test(t)) {
        if (col.acao === undefined) marca("dataIdent");
        else if (col.eficacia === undefined) marca("data");
        else marca("dataEficacia");
      }
    }
    if (col.identificacao === undefined) return avisos.push(`Folha ${f.nome}: não encontrei a coluna "Identificação do Risco / Oportunidade".`);
    // Época e data de aprovação no cabeçalho.
    let aprovacao = "";
    cab.forEach((l) =>
      l.forEach((c, j) => {
        if (/data de aprova/i.test(String(c))) {
          const v = l.slice(j + 1).find((x) => String(x ?? "").trim());
          if (v) aprovacao = textoData(v);
        }
      })
    );
    const val = (l, k) => (col[k] === undefined ? "" : limpa(l[col[k]]));
    const num = (l, k) => {
      const n = Number(String(val(l, k)).replace(",", "."));
      return n >= 1 && n <= 4 ? Math.round(n) : null;
    };
    const itens = [];
    for (let i = iDados; i < linhas.length; i++) {
      const l = linhas[i];
      if (/^processos$/i.test(String(l[1] ?? "").trim())) break;
      if (!temDados(l)) continue;
      const ident = val(l, "identificacao");
      if (!ident) continue;
      let tipo = norm(val(l, "tipo")).toUpperCase();
      const po = num(l, "po");
      const gr = num(l, "gr");
      if (tipo !== "R" && tipo !== "O") tipo = po || gr ? "R" : "O";
      const item = {
        id: `r_${ep.replace("/", "")}_${itens.length + 1}_${Math.random().toString(36).slice(2, 7)}`,
        n: Number(val(l, "n")) || itens.length + 1,
        processo: val(l, "processo"),
        proveniencia: val(l, "proveniencia").replace(/\s*\/\s*/g, " / "),
        objetivo: val(l, "objetivo"),
        tipo,
        identificacao: ident,
        causa: val(l, "causa"),
        impacto: val(l, "impacto"),
        po: tipo === "O" ? null : po,
        gr: tipo === "O" ? null : gr,
        aceitacao: val(l, "aceitacao").toUpperCase().replace(/\s+/g, ""),
        acao: val(l, "acao"),
        responsavel: val(l, "responsavel"),
        data: textoData(val(l, "data")),
        estado: val(l, "estado"),
        observacoes: val(l, "observacoes"),
      };
      // Épocas antigas: reavaliação e eficácia das ações.
      const rPo = num(l, "reavPo");
      const rGr = num(l, "reavGr");
      if (rPo || rGr || val(l, "eficacia")) item.reavaliacao = { po: rPo, gr: rGr, eficacia: val(l, "eficacia"), data: textoData(val(l, "dataEficacia")) };
      if (val(l, "dataIdent")) item.dataIdentificacao = textoData(val(l, "dataIdent"));
      itens.push(item);
    }
    epocas[ep] = { aprovacao, itens, origem: f.nome };
    // Legendas (processos e responsáveis) a partir da folha mais recente.
    const iLeg = linhas.findIndex((l) => /^processos$/i.test(String(l[1] ?? "").trim()));
    if (iLeg >= 0) {
      const processos = [];
      const responsaveis = [];
      for (let i = iLeg; i < Math.min(linhas.length, iLeg + 14); i++) {
        const l = linhas[i];
        const p = String(l[1] ?? "").trim();
        if (/^PR\.\s*\d+/i.test(p)) {
          const resp = l.slice(2, 8).map((x) => String(x ?? "").trim()).find((x) => x && !/ - /.test(x)) || "";
          processos.push({ nome: p, responsavel: resp });
        }
        l.slice(3).forEach((c) => {
          const m = String(c ?? "").trim().match(/^([A-Z][A-Za-z.&\-]{0,7}(?:\s?-\s?[A-Z])?)\s+-\s+(.+)$/);
          if (m && !/^PR\./.test(m[1])) responsaveis.push({ sigla: m[1].trim(), nome: m[2].trim() });
        });
      }
      if (processos.length || responsaveis.length) legendas = { processos, responsaveis, de: ep };
    }
  });
  if (!deEpoca.length) avisos.push('Não encontrei folhas com o nome de uma época (ex.: "26.27").');
  return { epocas, legendas, avisos };
}

// ---------- deteção a partir dos dados da app ----------
// Cada detetor olha para os dados de uma época e devolve quantas vezes o tema apareceu.
// "cobre" diz que palavras, num risco da lista, mostram que o tema já está tratado.
const P1 = "PR.01-Gestão e Operacionalizaçao da Escola de futebol";
const P2 = "PR.02 - Desenvolvimento da marca";
const P4 = "PR.04- Sistema de Gestão";

const constatacoes = (c, filtro) =>
  c.audits
    .filter((a) => epocaAudit(a) === c.ep)
    .flatMap((a) => (a.findings || []).map((f) => ({ ...f, escola: a.school, data: a.date, auditId: a.id })))
    .filter(filtro);
const textoRecl = (r) => norm([r.tema, r.categoria, r.description, r.context].join(" "));
const reclDaEpoca = (c, re) => c.reclamacoes.filter((r) => (r.epoca || epocaDeData(r.receivedDate)) === c.ep && re.test(textoRecl(r)));
const evAud = (fs) => fs.slice(0, 40).map((f) => ({ origem: "Auditoria", texto: `${f.classification || ""} ${f.category || f.area || ""}: ${String(f.description || "").slice(0, 110)}`.trim(), escola: f.escola, data: f.data }));
const evRecl = (rs) => rs.slice(0, 40).map((r) => ({ origem: "Reclamação", texto: `Nº ${String(r.entryNumber || "").padStart(4, "0")} · ${r.tema || r.categoria || ""}`, escola: r.school, data: r.receivedDate }));
const resumo = (partes) => partes.filter(([n]) => n > 0).map(([n, t]) => `${n} ${t}`).join(" · ");
// Ocorrências (registos que não são reclamações nem sanções: clima, infraestruturas, contratos…).
// A categoria escolhida manda; o texto só conta quando a categoria é "Outra" ou está vazia.
const textoOcorr = (o) => norm([o.categoria, o.titulo, o.descricao].join(" "));
const categoriaVaga = (o) => !String(o.categoria || "").trim() || /^outr[ao]s?$/.test(norm(o.categoria));
const ocorrBate = (o, re) => (categoriaVaga(o) ? re.test(textoOcorr(o)) : re.test(norm(o.categoria)));
const ocorrDaEpoca = (c, re) => (c.ocorrencias || []).filter((o) => epocaDeData(o.data) === c.ep && ocorrBate(o, re));
const evOc = (os) => os.slice(0, 40).map((o) => ({ origem: "Ocorrência", texto: `${o.categoria ? `${o.categoria}: ` : ""}${o.titulo || ""}${o.treinosSuspensos ? ` · ${o.treinosSuspensos} treinos suspensos` : ""}`, escola: o.escola, data: o.data }));
const PO_OC = "PR.05-Gestão de Compras";

export const DETETORES = [
  {
    id: "doc-tecnica",
    tipo: "R",
    processo: P1,
    titulo: "Documentação técnica desatualizada nas escolas",
    causa: "Planeamentos, registos de treino e documentação técnica não atualizados pelos treinadores.",
    impacto: "Perda de rastreabilidade do trabalho técnico; não conformidades em auditoria.",
    gr: 2,
    cobre: /documenta|planeamento (de|do|dos|das) (treino|sessao|sessoes|epoca)|planeamentos? tecnic|registos? de treino/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /documenta/.test(norm(f.category)));
      return { n: fs.length, detalhe: resumo([[fs.length, "constatações de documentação técnica nas auditorias"]]), evidencias: evAud(fs) };
    },
  },
  {
    id: "organizacao",
    tipo: "R",
    processo: P1,
    titulo: "Falhas na organização e operacionalização das escolas",
    causa: "Rotinas de organização da escola não cumpridas (receção, entradas e saídas, espaços, materiais).",
    impacto: "Pior serviço ao cliente; não conformidades em auditoria.",
    gr: 2,
    cobre: /organizac|operacionaliza|rececao|entradas e saidas|controlo de (entradas|saidas?)|saida dos alunos/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /organizacao da escola/.test(norm(f.category)));
      return { n: fs.length, detalhe: resumo([[fs.length, "constatações de organização da escola"]]), evidencias: evAud(fs) };
    },
  },
  {
    id: "instalacoes",
    tipo: "R",
    processo: P1,
    titulo: "Instalações com falhas de estrutura, segurança ou limpeza",
    causa: "Manutenção insuficiente ou tardia das infraestruturas e do espaço.",
    impacto: "Risco para a segurança dos alunos; reclamações; não conformidades.",
    gr: 3,
    cobre: /instalac|infraestrutura|manutenc|limpez|higien|vandalismo/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /instalac/.test(norm(f.category)));
      const rs = reclDaEpoca(c, /infraestrutura|instalac|balneari|baliza|limpez/);
      const os = ocorrDaEpoca(c, /infraestrutur|instalac|avaria|vandal|balneari|relvado|piso|vedac|iluminac|baliza/);
      return { n: fs.length + rs.length + os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[fs.length, "constatações de instalações"], [rs.length, "reclamações"], [os.length, "ocorrências"]]), evidencias: [...evOc(os), ...evRecl(rs), ...evAud(fs)] };
    },
  },
  {
    id: "material",
    tipo: "R",
    processo: P1,
    titulo: "Material desportivo em falta ou danificado",
    causa: "Desgaste e reposição tardia do material desportivo e têxtil.",
    impacto: "Treinos com menos qualidade; risco de lesão; imagem da escola.",
    gr: 2,
    cobre: /material|equipamento/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /material|kit/.test(norm(f.category)));
      return { n: fs.length, detalhe: resumo([[fs.length, "constatações de material"]]), evidencias: evAud(fs) };
    },
  },
  {
    id: "treinadores",
    tipo: "R",
    processo: P1,
    titulo: "Falhas no desempenho ou presença dos treinadores",
    causa: "Ausência, atraso ou incumprimento da metodologia pelos treinadores.",
    impacto: "Insatisfação dos encarregados de educação; perda de qualidade do treino.",
    gr: 3,
    cobre: /treinador/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /treinador/.test(norm(f.category)));
      const rs = reclDaEpoca(c, /treinador/);
      return { n: fs.length + rs.length, detalhe: resumo([[fs.length, "constatações sobre treinadores"], [rs.length, "reclamações"]]), evidencias: [...evRecl(rs), ...evAud(fs)] };
    },
  },
  {
    id: "comunicacao",
    tipo: "R",
    processo: P1,
    titulo: "Falhas no atendimento e na comunicação com os encarregados de educação",
    causa: "Informação incompleta ou tardia da secretaria e dos coordenadores.",
    impacto: "Reclamações; má imagem junto dos encarregados de educação.",
    gr: 2,
    cobre: /comunicac|atendimento|secretaria|esclarecimento/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /secretaria|atendimento|comunica/.test(norm(f.category)));
      const rs = c.reclamacoes.filter((r) => (r.epoca || epocaDeData(r.receivedDate)) === c.ep && /comunica/.test(norm(r.causaRaiz)));
      return { n: fs.length + rs.length, detalhe: resumo([[fs.length, "constatações de atendimento/comunicação"], [rs.length, "reclamações com causa na comunicação"]]), evidencias: [...evRecl(rs), ...evAud(fs)] };
    },
  },
  {
    id: "saude",
    tipo: "R",
    processo: P1,
    titulo: "Falhas no acompanhamento de lesões e da saúde dos alunos",
    causa: "Resposta da fisioterapia, nutrição ou psicologia incompleta, ou registos em falta.",
    impacto: "Risco para a saúde dos alunos; reclamações; imagem do FC Porto.",
    gr: 4,
    cobre: /fisio|lesao|lesoes|saude|medic|socorr/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /fisio|nutri|psico/.test(norm(`${f.category} ${f.area}`)));
      const rs = reclDaEpoca(c, /saude|lesao|fisio/);
      const os = ocorrDaEpoca(c, /saude|lesao|lesoes|acidente|ferid|socorr|ambulanc|hospital|inem/);
      return { n: fs.length + rs.length + os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[fs.length, "constatações de fisioterapia, nutrição ou psicologia"], [rs.length, "reclamações de saúde"], [os.length, "ocorrências de saúde ou acidentes"]]), evidencias: [...evOc(os), ...evRecl(rs), ...evAud(fs)] };
    },
  },
  {
    id: "rgpd",
    tipo: "R",
    processo: P4,
    titulo: "Incumprimento do RGPD no tratamento de dados e imagens",
    causa: "Dados de alunos ou imagens tratados ou partilhados fora das regras.",
    impacto: "Coimas; quebra de confiança dos encarregados de educação.",
    gr: 4,
    cobre: /rgpd|dados pessoais|protecao de dados|redes sociais/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /rgpd/.test(norm(f.category)));
      return { n: fs.length, detalhe: resumo([[fs.length, "constatações de RGPD"]]), evidencias: evAud(fs) };
    },
  },
  {
    id: "software",
    tipo: "R",
    processo: P1,
    titulo: "Falha do sistema informático",
    causa: "Software ou rede que falham ou não respondem.",
    impacto: "Mais tempo de espera; registos em falta.",
    gr: 3,
    cobre: /informatic|software|internet/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /software/.test(norm(f.category)));
      const os = ocorrDaEpoca(c, /informatic|software|internet|rede|sistema de gestao|faturac|servidor|computador/);
      return { n: fs.length + os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[fs.length, "constatações de software/internet"], [os.length, "ocorrências"]]), evidencias: [...evOc(os), ...evAud(fs)] };
    },
  },
  {
    id: "parceiro",
    tipo: "R",
    processo: P1,
    titulo: "Incumprimento do contrato pelo clube parceiro",
    causa: "Falta de rigor do parceiro nas suas obrigações (infraestruturas, prazos, pagamentos).",
    impacto: "Não conformidades em auditoria; falta de segurança dos alunos.",
    gr: 4,
    cobre: /parceiro|contrato/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => /parceiro/.test(norm(f.area)));
      const os = ocorrDaEpoca(c, /contrat|parceiro|protocolo/);
      return { n: fs.length + os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[fs.length, "constatações na área do parceiro"], [os.length, "ocorrências contratuais"]]), evidencias: [...evOc(os), ...evAud(fs)] };
    },
  },
  {
    id: "comportamento",
    tipo: "R",
    processo: P1,
    titulo: "Comportamentos agressivos ou má conduta de pais, atletas ou staff",
    causa: "Conflitos em treinos, jogos ou eventos.",
    impacto: "Segurança de alunos e staff; imagem do FC Porto junto das partes interessadas.",
    gr: 4,
    limiar: 1,
    cobre: /agress|violen|ma conduta|comportament|disciplin|conflito/,
    medir: (c) => {
      const ss = (c.sanctions || []).filter((s) => epocaDeData(s.date) === c.ep);
      const os = ocorrDaEpoca(c, /comportament|agress|conduta|conflito|insult|violen|discussao/);
      return { n: ss.length + os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[ss.length, "ocorrências disciplinares"], [os.length, "ocorrências de comportamento"]]), evidencias: [...evOc(os), ...ss.slice(0, 40).map((s) => ({ origem: "Sanção", texto: `${s.motivo || s.sanctionType || "Ocorrência"}${s.personType ? ` · ${s.personType}` : ""}`, escola: s.school, data: s.date }))] };
    },
  },
  {
    id: "desistencias",
    tipo: "R",
    processo: P1,
    titulo: "Desistência de alunos por perda de motivação ou insatisfação",
    causa: "Perda de interesse, insatisfação com as atividades ou com o staff, falta de adaptação.",
    impacto: "Menos alunos; quebra de receita; imagem da escola.",
    gr: 3,
    limiar: 10,
    cobre: /desist|abandon|motivac|retenc|fideliz|perda de alunos/,
    medir: (c) => {
      const ds = (c.desistencias || []).filter((d) => (d.epoca || epocaDeData(d.data)) === c.ep && /interesse|motiva|insatisf|desconfort|adapta|staff/.test(norm(d.motivo)));
      const n = ds.reduce((t, d) => t + (d.n || 1), 0);
      const porMotivo = {};
      ds.forEach((d) => (porMotivo[d.motivo] = (porMotivo[d.motivo] || 0) + (d.n || 1)));
      return { n, detalhe: resumo([[n, "desistências por motivação ou insatisfação"]]), evidencias: Object.entries(porMotivo).sort((a, b) => b[1] - a[1]).map(([m, k]) => ({ origem: "Desistências", texto: `${k} × ${m}` })) };
    },
  },
  {
    id: "prazo-recl",
    tipo: "R",
    processo: P4,
    titulo: "Incumprimento do prazo de resposta a reclamações",
    causa: "Reclamações tratadas fora do prazo, incluindo as do Livro de Reclamações.",
    impacto: "Incumprimento legal; insatisfação do cliente.",
    gr: 3,
    limiar: 1,
    cobre: /reclamac.{0,60}prazo|prazo.{0,60}reclamac|livro de reclama/,
    medir: (c) => {
      const hoje = new Date();
      const rs = c.reclamacoes.filter((r) => (r.epoca || epocaDeData(r.receivedDate)) === c.ep && r.deadline && (r.resolvedDate ? new Date(r.resolvedDate) > new Date(r.deadline) : new Date(r.deadline) < hoje));
      return { n: rs.length, detalhe: resumo([[rs.length, "reclamações fora do prazo"]]), evidencias: evRecl(rs) };
    },
  },
  {
    id: "nc-repetidas",
    tipo: "R",
    processo: P4,
    titulo: "Não conformidades repetidas na mesma escola (ações sem eficácia)",
    causa: "Ações corretivas que não eliminam a causa do problema.",
    impacto: "Problemas recorrentes; risco na certificação.",
    gr: 3,
    cobre: /eficac|repetid|recorrent|reincid/,
    medir: (c) => {
      const fs = constatacoes(c, (f) => (f.classification === "NC" || f.classification === "NCM") && f.category);
      const grupos = {};
      fs.forEach((f) => {
        const k = `${f.escola}||${f.category}`;
        (grupos[k] = grupos[k] || new Set()).add(f.auditId);
      });
      const rep = Object.entries(grupos).filter(([, s]) => s.size >= 2);
      return { n: rep.length, detalhe: resumo([[rep.length, "casos de NC repetida em visitas diferentes (mesma escola e categoria)"]]), evidencias: rep.slice(0, 40).map(([k, s]) => ({ origem: "Auditorias", texto: `${k.split("||")[1]} · ${s.size} visitas`, escola: k.split("||")[0] })) };
    },
  },
  {
    id: "eventos",
    tipo: "R",
    processo: P2,
    titulo: "Falhas no planeamento ou execução de eventos",
    causa: "Incumprimento dos procedimentos do evento ou fraca satisfação dos participantes.",
    impacto: "Insatisfação do cliente; fraca imagem junto dos clientes.",
    gr: 3,
    limiar: 1,
    cobre: /evento/,
    medir: (c) => {
      const evs = (c.eventos || []).filter((e) => epocaDeData(e.data) === c.ep && ((e.satisfacao !== null && e.satisfacao !== undefined && e.satisfacao !== "" && Number(e.satisfacao) < 70) || Number(e.reclamacoes) > 0));
      const rs = reclDaEpoca(c, /evento/);
      return { n: evs.length + rs.length, detalhe: resumo([[evs.length, "eventos com satisfação abaixo de 70% ou reclamações"], [rs.length, "reclamações de eventos"]]), evidencias: [...evs.map((e) => ({ origem: "Evento", texto: `${e.nome}${e.satisfacao !== null && e.satisfacao !== undefined && e.satisfacao !== "" ? ` · ${e.satisfacao}%` : ""}`, data: e.data })), ...evRecl(rs)] };
    },
  },
  {
    id: "pagamentos",
    tipo: "R",
    processo: P1,
    titulo: "Problemas com mensalidades, taxas ou descontos",
    causa: "Erros de cobrança, débitos indevidos ou dúvidas sobre taxas e descontos.",
    impacto: "Mensalidades em atraso; insatisfação do cliente.",
    gr: 3,
    limiar: 1,
    cobre: /pagament|mensalidad|debito|taxa|desconto/,
    medir: (c) => {
      const rs = reclDaEpoca(c, /taxa|desconto|pagament|mensalid|anuid|debito/);
      return { n: rs.length, detalhe: resumo([[rs.length, "reclamações sobre pagamentos, taxas ou descontos"]]), evidencias: evRecl(rs) };
    },
  },
  {
    id: "clima",
    tipo: "R",
    processo: P1,
    titulo: "Condições climatéricas adversas (treinos ou eventos suspensos)",
    causa: "Tempestades, chuva intensa, calor extremo, incêndios ou similares.",
    impacto: "Cancelamento de treinos e eventos; fecho das instalações.",
    gr: 3,
    limiar: 1,
    cobre: /climat|meteorolog|tempestade|chuva|intemperie|calor extremo/,
    medir: (c) => {
      const os = ocorrDaEpoca(c, /climat|meteorolog|tempestade|chuva|vento|intemperie|calor|neve|granizo|incendio|alerta (amarelo|laranja|vermelho)/);
      const tr = os.reduce((t, o) => t + (Number(o.treinosSuspensos) || 0), 0);
      return { n: os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[os.length, "ocorrências por condições climatéricas"], [tr, "treinos suspensos"]]), evidencias: evOc(os) };
    },
  },
  {
    id: "energia",
    tipo: "R",
    processo: P2,
    titulo: "Falhas de energia, água ou outros serviços essenciais",
    causa: "Cortes de eletricidade (incluindo apagões), de água ou de outros serviços nas instalações.",
    impacto: "Suspensão de treinos e atividades; balneários e iluminação sem funcionar.",
    gr: 4,
    limiar: 1,
    cobre: /energ|apagao|eletric|corte de (luz|agua)/,
    medir: (c) => {
      const os = ocorrDaEpoca(c, /energ|apagao|eletric|corte de luz|sem luz|falta de luz|corte de agua|sem agua|falta de agua|gas/);
      return { n: os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[os.length, "ocorrências de energia ou serviços"]]), evidencias: evOc(os) };
    },
  },
  {
    id: "fornecedores",
    tipo: "R",
    processo: PO_OC,
    titulo: "Incumprimento de fornecedores (atrasos ou material defeituoso)",
    causa: "Falha ou erro do fornecedor de materiais ou serviços.",
    impacto: "Atraso na prestação do serviço ou na entrega de materiais; reclamações.",
    gr: 3,
    limiar: 1,
    cobre: /fornecedor/,
    medir: (c) => {
      const os = ocorrDaEpoca(c, /fornecedor|encomenda|entrega|defeituos|material em falta/);
      return { n: os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[os.length, "ocorrências com fornecedores"]]), evidencias: evOc(os) };
    },
  },
  {
    id: "staff",
    tipo: "R",
    processo: P1,
    titulo: "Ausência de treinadores ou staff no treino ou na escola",
    causa: "Falta do treinador, do responsável operacional ou de outro staff, por razões pessoais ou profissionais.",
    impacto: "Alunos sem o treino que pagam; falta de controlo na escola; insatisfação do cliente.",
    gr: 3,
    limiar: 1,
    cobre: /ausencia (do|de) (treinador|responsavel|colaborador|staff)|falta (do|de) (treinador|staff|colaborador)|absentismo/,
    medir: (c) => {
      const os = ocorrDaEpoca(c, /ausencia|faltou|falta do treinador|falta de treinador|sem treinador|absentismo|baixa medica|staff em falta/);
      return { n: os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[os.length, "ocorrências de ausência de staff"]]), evidencias: evOc(os) };
    },
  },
  {
    id: "turmas-cheias",
    tipo: "O",
    processo: P1,
    titulo: "Criação de novas turmas onde a procura já esgotou",
    causa: "Turmas no limite da capacidade.",
    impacto: "Mais alunos, satisfação do cliente e aumento da rentabilidade da escola.",
    limiar: 1,
    cobre: /turma/,
    medir: (c) => {
      const reg = (c.registoAlunos || {})[c.ep];
      if (!reg || !c.capacidadeDe) return { n: 0 };
      const conta = {};
      Object.values(reg.alunos || {}).filter((a) => a.estado === "ativo").forEach((a) => (conta[`${a.escola}||${a.turma}`] = (conta[`${a.escola}||${a.turma}`] || 0) + 1));
      const cheias = Object.entries(conta)
        .map(([k, n]) => {
          const [e, t] = k.split("||");
          const cap = c.capacidadeDe(e, t);
          return { e, t, n, cap };
        })
        .filter((x) => x.cap && x.n / x.cap >= 0.95)
        .sort((a, b) => b.n / b.cap - a.n / a.cap);
      return { n: cheias.length, detalhe: resumo([[cheias.length, "turmas a 95% ou mais da capacidade"]]), evidencias: cheias.slice(0, 40).map((x) => ({ origem: "Inscritos", texto: `${x.t} · ${x.n}/${x.cap}`, escola: x.e })) };
    },
  },
  {
    id: "feminino",
    tipo: "O",
    processo: P1,
    titulo: "Crescimento do futebol feminino",
    causa: "Mais alunas inscritas do que na época anterior.",
    impacto: "Novo público; possibilidade de turmas e equipas femininas.",
    limiar: 1,
    cobre: /feminin|alunas/,
    medir: (c) => {
      const reg = (c.registoAlunos || {})[c.ep];
      const ant = (c.registoAlunos || {})[epocaAnterior(c.ep)];
      if (!reg || !ant) return { n: 0 };
      const f = (r) => Object.values(r.alunos || {}).filter((a) => a.estado === "ativo" && a.genero === "f").length;
      const agora = f(reg);
      const antes = f(ant);
      const cresce = antes >= 5 && agora >= antes * 1.1 && agora - antes >= 10;
      return { n: cresce ? 1 : 0, detalhe: cresce ? `${agora} alunas ativas, contra ${antes} na época anterior (+${Math.round(((agora - antes) / antes) * 100)}%)` : "", evidencias: cresce ? [{ origem: "Inscritos", texto: `${antes} → ${agora} alunas` }] : [] };
    },
  },
];

// PO sugerida pela frequência na época: nunca → 1, esporádico → 2, alguma frequência → 3, sistemático → 4.
const poDaFrequencia = (n) => (n <= 0 ? 1 : n <= 2 ? 2 : n < 10 ? 3 : 4);
// Coberto: o tema está na identificação ou na causa do risco (ou foi ligado à mão).
// Talvez relacionado: o tema só aparece no impacto, na ação ou nas observações.
const textoChave = (it) => norm([it.identificacao, it.causa].join(" "));
const textoLargo = (it) => norm([it.identificacao, it.causa, it.impacto, it.acao, it.observacoes].join(" "));

// Devolve, para a época, os temas que os dados mostram, se a lista já os cobre, e a PO sugerida.
// Riscos a que as ocorrências foram ligadas à mão.
const ligadosPor = (ctx, ids) => {
  const set = new Set(ids || []);
  return new Set((ctx.ocorrencias || []).filter((o) => set.has(o.id)).flatMap((o) => o.riscos || []));
};
const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Ocorrências de categorias que nenhum tema acima apanha: um tema por categoria.
function detetoresDinamicos(ctx, usadas) {
  const grupos = {};
  (ctx.ocorrencias || [])
    .filter((o) => epocaDeData(o.data) === ctx.ep && !usadas.has(o.id))
    .forEach((o) => {
      const cat = String(o.categoria || "Outra").trim() || "Outra";
      (grupos[cat] = grupos[cat] || []).push(o);
    });
  return Object.entries(grupos)
    .filter(([, os]) => os.length >= 2 || os.some((o) => o.gravidade === "alta"))
    .map(([cat, os]) => {
      const palavras = norm(cat)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 5 && !["outra", "outro", "outros", "questoes", "problemas"].includes(w))
        .map((w) => escapar(w.slice(0, Math.max(5, w.length - 2))));
      const altas = os.filter((o) => o.gravidade === "alta").length;
      return {
        id: `oc:${norm(cat)}`,
        tipo: "R",
        processo: P1,
        titulo: `Ocorrências recorrentes: ${cat}`,
        causa: os[0].descricao || os[0].titulo || "",
        impacto: os.find((o) => o.impacto)?.impacto || "",
        gr: altas ? 4 : 3,
        limiar: 1,
        cobre: palavras.length ? new RegExp(palavras.join("|")) : /^$/,
        medir: () => ({ n: os.length, ocorrIds: os.map((o) => o.id), detalhe: resumo([[os.length, `ocorrências de ${cat.toLowerCase()}`], [altas, "de gravidade alta"]]), evidencias: evOc(os) }),
      };
    });
}

export function detetarRiscos(ctx, itens, ignorados = []) {
  const ign = new Set(ignorados);
  const usadas = new Set();
  const medidas = DETETORES.map((d) => {
    let m;
    try {
      m = d.medir(ctx) || { n: 0 };
    } catch (e) {
      m = { n: 0 };
    }
    (m.ocorrIds || []).forEach((id) => usadas.add(id));
    return [d, m];
  });
  detetoresDinamicos(ctx, usadas).forEach((d) => medidas.push([d, d.medir()]));
  return medidas.map(([d, m]) => {
    if (!m.n || m.n < (d.limiar || 3)) return null;
    const doTipo = itens.filter((it) => (it.tipo || "R") === d.tipo);
    const ligados = ligadosPor(ctx, m.ocorrIds);
    const cobertoPor = doTipo.filter((it) => (it.detetores || []).includes(d.id) || ligados.has(it.id) || d.cobre.test(textoChave(it))).map((it) => it.id);
    const relacionados = cobertoPor.length ? [] : doTipo.filter((it) => d.cobre.test(textoLargo(it))).map((it) => it.id).slice(0, 4);
    return {
      id: d.id,
      tipo: d.tipo,
      processo: d.processo,
      titulo: d.titulo,
      causa: d.causa,
      impacto: d.impacto,
      gr: d.gr || null,
      po: d.tipo === "O" ? null : poDaFrequencia(m.n),
      n: m.n,
      detalhe: m.detalhe,
      evidencias: m.evidencias || [],
      ocorrIds: m.ocorrIds || [],
      cobertoPor,
      relacionados,
      ignorado: ign.has(d.id),
    };
  }).filter(Boolean);
}

// ---------- exportação para Excel no formato do documento ----------
const COR = {
  verde: "FF92D050",
  amarelo: "FFFFFF00",
  azulObs: "FF93CDDD",
  cinza: "FFF2F2F2",
  cinza2: "FFD9D9D9",
  risco: "FFFDEADA",
  oportunidade: "FFDBEEF4",
  nrBaixo: "FFD7E4BD",
  nrMedio: "FFFFFF99",
  nrAlto: "FFD99694",
  naFundo: "FFFFC7CE",
  naLetra: "FF9C0006",
  matrizVerde: "FF00B050",
  matrizAmarelo: "FFFFFF00",
  matrizVermelho: "FFFF0000",
  matrizCab: "FFA5B6CB",
};
const fino = { style: "thin", color: { argb: "FF000000" } };
const caixa = { top: fino, left: fino, bottom: fino, right: fino };
const preencher = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

function folhaEpoca(wb, ep, dados, legendas) {
  const ws = wb.addWorksheet(folhaDaEpoca(ep), {
    views: [{ state: "frozen", ySplit: 11 }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:11", margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } },
  });
  // Rodapé com o código do impresso, como no documento.
  ws.headerFooter.oddFooter = "&R&8 GIF.116.01";
  const larguras = { A: 3.6, B: 19.3, C: 19.3, D: 12, E: 7.4, F: 18.4, G: 29.3, H: 37.7, I: 5, J: 5, K: 5, L: 5, M: 46.7, N: 12.1, O: 13.6, P: 18, Q: 22 };
  Object.entries(larguras).forEach(([c, w]) => (ws.getColumn(c).width = w));
  const swiss = (sz, bold) => ({ name: "Swis721 Lt BT", size: sz, bold: !!bold });
  const calibri = (sz, bold, italic) => ({ name: "Calibri", size: sz, bold: !!bold, italic: !!italic, color: { argb: "FF000000" } });

  // 1-2: título, época e aprovação
  ws.mergeCells("A1:P1");
  Object.assign(ws.getCell("A1"), { value: "PENSAMENTO BASEADO NO RISCO E OPORTUNIDADES" });
  ws.getCell("A1").font = calibri(22);
  ws.getCell("A1").border = { bottom: fino };
  ws.getRow(1).height = 27;
  ws.getRow(2).height = 27;
  [
    ["B2", "Época:", true, "right"],
    ["C2", epocaLonga(ep), false],
    ["G2", "Data de aprovação:", false],
    ["H2", dados.aprovacao || "", false],
  ].forEach(([ref, v, b, h]) => {
    const c = ws.getCell(ref);
    c.value = v;
    c.font = swiss(10, b);
    c.border = { top: fino, bottom: fino };
    c.alignment = { horizontal: h, vertical: "middle", wrapText: true };
  });

  // 3: secções
  ws.mergeCells("A3:L3");
  ws.mergeCells("M3:P3");
  [
    ["A3", "APRECIAÇÃO DO RISCO E OPORTUNIDADES", COR.verde],
    ["M3", "PLANO DE AÇÕES", COR.amarelo],
    ["Q3", "Observações", COR.azulObs],
  ].forEach(([ref, v, cor]) => {
    const c = ws.getCell(ref);
    c.value = v;
    c.font = calibri(14, true, true);
    c.fill = preencher(cor);
    c.border = caixa;
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(3).height = 18;

  // 4-11: cabeçalho
  const alturas = { 4: 15, 5: 15, 6: 15, 7: 24.6, 8: 21.6, 9: 22.95, 10: 15, 11: 15 };
  Object.entries(alturas).forEach(([r, h]) => (ws.getRow(Number(r)).height = h));
  for (let r = 4; r <= 11; r++) {
    for (let ci = 1; ci <= 17; ci++) {
      const c = ws.getRow(r).getCell(ci);
      c.fill = preencher(COR.cinza);
      c.border = { left: fino, right: fino, top: r === 4 ? fino : undefined, bottom: r === 11 ? fino : undefined };
      c.font = calibri(10, true);
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
  }
  ["A4:A11", "I4:I11", "J4:J11", "K4:K11", "L4:L11", "D7:D8", "F7:F8", "G7:G8", "N7:N8", "P7:P8"].forEach((m) => ws.mergeCells(m));
  const cab = (ref, v, extra = {}) => {
    const c = ws.getCell(ref);
    c.value = v;
    if (extra.font) c.font = extra.font;
    if (extra.rot) c.alignment = { horizontal: "center", vertical: "middle", textRotation: 90, wrapText: true };
  };
  cab("A4", "Nº ");
  cab("I4", "Possibilidade de Ocorrência", { rot: true, font: calibri(10) });
  cab("J4", "Gravidade", { rot: true, font: calibri(10) });
  cab("K4", "Nível de Risco", { rot: true, font: calibri(10) });
  cab("L4", "Aceitação do Risco", { rot: true, font: calibri(10) });
  cab("C6", "Proveniência:");
  cab("M6", "TRATAMENTO DO RISCO");
  cab("B7", "Processo");
  cab("C7", "Questões Internas (QI)", { font: calibri(8, true) });
  cab("C8", "Questões Externas (QE)", { font: calibri(8, true) });
  cab("C9", "Partes Interessadas (PI)", { font: calibri(8, true) });
  cab("D7", "Objetivos estratégicos associados PI", { font: calibri(8, true) });
  cab("F7", "Identificação do Risco / Oportunidade");
  cab("G7", "Descrição da Causa do Risco / Oportunidade");
  cab("H7", "Descrição do Impacto ");
  cab("M7", "(Ação Correctiva, ", { font: calibri(10) });
  cab("M8", "Preventiva, ", { font: calibri(10) });
  cab("M9", "Medida de Mitigação)", { font: calibri(10) });
  cab("N7", "Responsável Tratamento");
  cab("O7", "Data");
  cab("P7", "Estado (em análise, implementada)");
  cab("E10", "TIPO");

  // 12+: linhas
  const letra = { name: "Arial Nova Light", size: 8, color: { argb: "FF000000" } };
  const larg = (c) => larguras[c] || 9;
  const itens = [...(dados.itens || [])].sort((a, b) => (a.n || 0) - (b.n || 0));
  let r = 12;
  itens.forEach((it, i) => {
    const row = ws.getRow(r);
    const nr = nivelRisco(it);
    const valores = {
      A: it.n || i + 1,
      B: it.processo || "",
      C: it.proveniencia || "",
      D: it.objetivo || "",
      E: it.tipo || "R",
      F: it.identificacao || "",
      G: it.causa || "",
      H: it.impacto || "",
      I: it.tipo === "O" ? null : it.po || null,
      J: it.tipo === "O" ? null : it.gr || null,
      K: nr !== null ? { formula: `I${r}*J${r}`, result: nr } : null,
      L: it.tipo === "O" ? "" : it.aceitacao || "",
      M: it.acao || "",
      N: it.responsavel || "",
      O: it.data || "",
      P: it.estado || "",
      Q: it.observacoes || "",
    };
    let linhasMax = 2;
    Object.entries(valores).forEach(([c, v]) => {
      const cel = row.getCell(c);
      cel.value = v;
      cel.font = letra;
      cel.border = { left: fino, right: fino, bottom: fino };
      cel.alignment = { horizontal: c === "B" || c === "M" ? "left" : "center", vertical: "middle", wrapText: true };
      if (typeof v === "string" && v) {
        const porLinha = Math.max(4, larg(c) * 1.25);
        const n = v.split("\n").reduce((t, p) => t + Math.max(1, Math.ceil(p.length / porLinha)), 0);
        linhasMax = Math.max(linhasMax, n);
      }
    });
    row.getCell("F").fill = preencher(it.tipo === "O" ? COR.oportunidade : COR.risco);
    row.height = Math.max(40.2, Math.min(260, linhasMax * 10.5 + 6));
    r++;
  });
  const ultima = Math.max(12, r - 1);
  // Cores do nível de risco e da aceitação (como no documento).
  ws.addConditionalFormatting({
    ref: `K12:K${ultima}`,
    rules: [
      { type: "cellIs", operator: "between", formulae: [1, 3], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.nrBaixo } } }, priority: 1 },
      { type: "cellIs", operator: "between", formulae: [4, 8], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.nrMedio } } }, priority: 2 },
      { type: "cellIs", operator: "between", formulae: [9, 16], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.nrAlto } } }, priority: 3 },
    ],
  });
  ws.addConditionalFormatting({
    ref: `L12:L${ultima}`,
    rules: [{ type: "cellIs", operator: "equal", formulae: ['"NA"'], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.naFundo } }, font: { color: { argb: COR.naLetra } } }, priority: 4 }],
  });

  // Legendas: processos e responsáveis
  r = ultima + 2;
  const processos = (legendas && legendas.processos && legendas.processos.length ? legendas.processos : PROCESSOS_PADRAO.map((p) => ({ nome: p.nome, responsavel: p.responsavel })));
  const resps = (legendas && legendas.responsaveis) || [];
  const topo = ws.getRow(r);
  [["B", "Processos", swiss(10, true)], ["G", "Responsável", calibri(11, true)]].forEach(([c, v, f]) => {
    topo.getCell(c).value = v;
    topo.getCell(c).font = f;
    topo.getCell(c).border = { top: { style: "medium" } };
  });
  // Siglas dos responsáveis em duas colunas (H e L), a começar na linha do título.
  const metade = Math.ceil(resps.length / 2);
  const poeSigla = (row, c, x) => {
    if (!x) return;
    row.getCell(c).value = `${x.sigla} - ${x.nome}`;
    row.getCell(c).font = calibri(11, true);
  };
  const nLeg = Math.max(processos.length + 1, metade);
  for (let i = 0; i < nLeg; i++) {
    const row = ws.getRow(r + i);
    poeSigla(row, "H", resps[i]);
    poeSigla(row, "L", resps[metade + i]);
    const p = i > 0 ? processos[i - 1] : null;
    if (p) {
      row.getCell("B").value = p.nome;
      row.getCell("B").font = swiss(10);
      row.getCell("B").border = { left: { style: "medium" } };
      row.getCell("G").value = p.responsavel || "";
      row.getCell("G").font = swiss(10);
    }
  }
  r = r + nLeg + 2;

  // Critérios e matriz
  const titulo = (ref, v) => {
    ws.getCell(ref).value = v;
    ws.getCell(ref).font = calibri(14, true, true);
    ws.getCell(ref).alignment = { vertical: "middle" };
  };
  titulo(`B${r}`, "Critérios de Possibilidade de Ocorrência (PO) e Gravidade (GR)");
  titulo(`F${r}`, "Avaliação do Risco");
  ws.getRow(r).height = 18;
  const r0 = r + 1;
  [["C", "PO"], ["D", "GR"]].forEach(([c, v]) => {
    const cel = ws.getCell(`${c}${r0}`);
    cel.value = v;
    cel.font = calibri(9);
    cel.fill = preencher(COR.cinza2);
    cel.border = caixa;
  });
  ws.mergeCells(`F${r0}:F${r0 + 5}`);
  const fc = ws.getCell(`F${r0}`);
  fc.value = "POSS. OCORRÊNCIA";
  fc.font = calibri(10);
  fc.fill = preencher(COR.matrizCab);
  fc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  fc.border = caixa;
  ["G", "H", "I", "J", "K"].forEach((c, i) => {
    const cel = ws.getCell(`${c}${r0}`);
    if (i === 0) cel.value = "GRAVIDADE";
    cel.font = calibri(10);
    cel.fill = preencher(COR.matrizCab);
    cel.border = caixa;
  });
  ["H", "I", "J", "K"].forEach((c, i) => {
    const cel = ws.getCell(`${c}${r0 + 1}`);
    cel.value = i + 1;
    cel.font = calibri(11);
    cel.fill = preencher(COR.cinza2);
    cel.border = caixa;
    cel.alignment = { horizontal: "center" };
  });
  ws.getCell(`G${r0 + 1}`).fill = preencher(COR.cinza2);
  ws.getCell(`G${r0 + 1}`).border = caixa;
  for (let po = 1; po <= 4; po++) {
    const rr = r0 + 1 + po;
    const g = ws.getCell(`G${rr}`);
    g.value = po;
    g.font = calibri(11);
    g.fill = preencher(COR.cinza2);
    g.border = caixa;
    ["H", "I", "J", "K"].forEach((c, i) => {
      const v = po * (i + 1);
      const cel = ws.getCell(`${c}${rr}`);
      cel.value = { formula: `${c}$${r0 + 1}*$G${rr}`, result: v };
      cel.font = calibri(11);
      cel.fill = preencher(v <= 3 ? COR.matrizVerde : v <= 8 ? COR.matrizAmarelo : COR.matrizVermelho);
      cel.border = caixa;
      cel.alignment = { horizontal: "center" };
    });
  }
  for (let k = 1; k <= 4; k++) {
    const rr = r0 + k;
    const b = ws.getCell(`B${rr}`);
    b.value = k;
    b.font = calibri(9);
    b.fill = preencher(COR.cinza2);
    b.border = caixa;
    b.alignment = { horizontal: "center" };
    [["C", PO_ROTULOS[k]], ["D", GR_ROTULOS[k]]].forEach(([c, v]) => {
      const cel = ws.getCell(`${c}${rr}`);
      cel.value = v;
      cel.font = calibri(8, true);
      cel.border = caixa;
    });
  }
  const rLeg = r0 + 6;
  ws.getCell(`B${rLeg}`).fill = preencher(COR.oportunidade);
  ws.getCell(`C${rLeg}`).value = "Oportunidade";
  ws.getCell(`C${rLeg}`).font = calibri(8, true);
  ws.getCell(`B${rLeg + 1}`).fill = preencher(COR.risco);
  ws.getCell(`C${rLeg + 1}`).value = "Risco";
  ws.getCell(`C${rLeg + 1}`).font = calibri(8, true);

  r = rLeg + 3;
  titulo(`B${r}`, "Critérios de Aceitação do Risco");
  ws.getRow(r).height = 18;
  [["B", "NÍVEL RISCO"], ["C", "CRITÉRIO DE ACEITAÇÃO"], ["D", "DESCRIÇÃO"]].forEach(([c, v]) => {
    const cel = ws.getCell(`${c}${r + 1}`);
    cel.value = v;
    cel.font = calibri(9);
    cel.fill = preencher(COR.cinza2);
    cel.border = caixa;
    cel.alignment = { horizontal: "center" };
  });
  ws.mergeCells(`D${r + 1}:H${r + 1}`);
  ACEITACAO_DESCRICAO.forEach(([nivel, crit, desc], i) => {
    const rr = r + 2 + i * 2;
    ws.mergeCells(`B${rr}:B${rr + 1}`);
    ws.mergeCells(`C${rr}:C${rr + 1}`);
    ws.mergeCells(`D${rr}:H${rr + 1}`);
    [["B", nivel, swiss(9)], ["C", crit, calibri(8, true)], ["D", desc, calibri(8)]].forEach(([c, v, f]) => {
      const cel = ws.getCell(`${c}${rr}`);
      cel.value = v;
      cel.font = f;
      cel.border = caixa;
      cel.alignment = { vertical: "middle", wrapText: true };
    });
  });
  const rNota = r + 2 + ACEITACAO_DESCRICAO.length * 2;
  ws.getCell(`B${rNota}`).value = NOTA_ACEITACAO;
  ws.getCell(`B${rNota}`).font = calibri(7);
  return ws;
}

function folhaCriterios(wb) {
  const ws = wb.addWorksheet("Critérios");
  ws.getColumn("B").width = 13.1;
  ws.getColumn("C").width = 12.3;
  ws.getColumn("D").width = 18;
  ws.getColumn("E").width = 62;
  const f = (bold) => ({ name: "Swis721 Lt BT", size: 9, bold: !!bold });
  ws.mergeCells("C2:D2");
  [["B2", "Critério"], ["C2", "Ponderação"], ["E2", "Descrição"]].forEach(([ref, v]) => {
    ws.getCell(ref).value = v;
    ws.getCell(ref).font = f(true);
    ws.getCell(ref).border = caixa;
  });
  ws.mergeCells("B3:B6");
  ws.mergeCells("B7:B10");
  ws.getCell("B3").value = "Possibilidade de Ocorrência (PO)";
  ws.getCell("B7").value = "Gravidade (GR)";
  ["B3", "B7"].forEach((ref) => {
    ws.getCell(ref).font = f();
    ws.getCell(ref).alignment = { vertical: "middle", wrapText: true };
    ws.getCell(ref).border = caixa;
  });
  for (let k = 1; k <= 4; k++) {
    [[2 + k, PO_ROTULOS[k] === "Muito alta" ? "Muito Alta" : PO_ROTULOS[k], PO_DESCRICAO[k]], [6 + k, GR_ROTULOS[k] === "Muito significativa" ? "Muito Significativa" : GR_ROTULOS[k], GR_DESCRICAO[k]]].forEach(([rr, rot, desc]) => {
      [["C", k], ["D", rot], ["E", desc]].forEach(([c, v]) => {
        const cel = ws.getCell(`${c}${rr}`);
        cel.value = v;
        cel.font = f();
        cel.border = caixa;
        cel.alignment = { vertical: "middle", wrapText: true, horizontal: c === "C" ? "center" : undefined };
      });
      ws.getRow(rr).height = 36;
    });
  }
  return ws;
}

// ExcelJS chega por parâmetro (carregado só quando se exporta).
export async function gerarExcelRiscos(ExcelJS, { epocas, legendas, apenas }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Auditoria e Gestão de Qualidade DF";
  wb.created = new Date();
  const lista = Object.keys(epocas || {})
    .filter((ep) => !apenas || apenas.includes(ep))
    .sort();
  lista.forEach((ep) => folhaEpoca(wb, ep, epocas[ep], legendas));
  folhaCriterios(wb);
  return wb.xlsx.writeBuffer();
}

// Riscos da lista que parecem tratar o mesmo tema de uma ocorrência (para a ligar).
export function riscosParaOcorrencia(o, itens) {
  const t = textoOcorr(o);
  const porTema = new Set();
  DETETORES.forEach((d) => {
    const ctx = { ep: epocaDeData(o.data), ocorrencias: [o], audits: [], reclamacoes: [], sanctions: [], desistencias: [], eventos: [], registoAlunos: {} };
    let m;
    try {
      m = d.medir(ctx);
    } catch (e) {
      m = null;
    }
    if (m && (m.ocorrIds || []).includes(o.id)) itens.filter((it) => (it.tipo || "R") === "R" && ((it.detetores || []).includes(d.id) || d.cobre.test(textoChave(it)))).forEach((it) => porTema.add(it.id));
  });
  const palavras = new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length >= 5).map((w) => w.slice(0, 6)));
  const porPalavras = itens
    .map((it) => ({ id: it.id, s: textoChave(it).split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && palavras.has(w.slice(0, 6))).length }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.id);
  return [...new Set([...porTema, ...porPalavras])].slice(0, 5);
}
