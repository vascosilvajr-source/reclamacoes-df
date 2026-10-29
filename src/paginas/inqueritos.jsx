// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import React, { useState } from "react";
import { Plus, X, Search, Trash2, ClipboardList, MessageSquareText } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LineChart, Line, ReferenceLine } from "recharts";
import { COLORS, DEFAULT_REGRAS_ENVIO, StatCard, Tag, dataEnvioPlano, dataLocal, epocaDe, fmt, iconBtnStyle, inputStyle, isoDe, labelStyle, linkBtnStyle, normChave, panelStyle, panelTitle, pergEscala, primaryBtnStyle, resumoContagens, satisfacaoDe, secondaryBtnStyle } from "../nucleo.jsx";
import { ComparacaoEpocas, DicaGrafico, FiltroEpocas, Filtros, Observacoes, ParamChips, SemDados, TickNome, corSatisfacao, dataDeCarimbo, dataDeCelula, epocasDisponiveis, lerCSVInq, lerExcelInq, naEpoca, naSelecao, npsDe, pct } from "../partilhado.jsx";

// Títulos que contêm dados pessoais: nunca são sugeridos e, se forem
// escolhidos à mão, a app avisa.
const CABECALHOS_PESSOAIS = ["nome", "nif", "email", "e-mail", "contacto", "telefone", "telemovel", "morada", "cc", "cartao de cidadao"];
function pareceColunaPessoal(titulo) {
  const t = normChave(titulo);
  return CABECALHOS_PESSOAIS.some((p) => t.includes(p));
}

// Palavras-chave para propor a dimensão de cada pergunta. A primeira que
// bater ganha, por isso as mais específicas vêm primeiro.
const PISTAS_DIMENSAO = [
  ["Alimentação", ["refei", "almoco", "lanche", "aliment", "comida", "jantar"]],
  ["Equipamento e ofertas", ["equipamento", "kit", "oferta", "brinde", "t-shirt", "camisola", "merchandis"]],
  ["Preço", ["preco", "valor pago", "custo", "qualidade/preco", "qualidade-preco", "qualidade preco"]],
  ["Treinadores e staff", ["treinador", "monitor", "staff", "equipa tecnica", "acompanhamento", "coordena", "tecnicos"]],
  ["Instalações", ["instala", "campo", "balneario", "espaco", "infraestrutura", "recinto", "estadio"]],
  ["Comunicação", ["comunica", "informa", "e-mail", "email", "contacto", "divulga", "esclarec"]],
  ["Organização", ["organiza", "horario", "logistic", "inscri", "planeamento", "pontualidade", "check-in", "acolhimento"]],
  ["Atividades", ["atividade", "actividade", "treino", "exercicio", "conteudo", "programa", "jogo", "divers", "experiencia"]],
  ["Satisfação global", ["global", "geral", "no geral", "de forma geral", "globalmente", "satisfacao com o evento", "avaliacao final"]],
];

function dimensaoProvavel(titulo, dimensoes) {
  const t = normChave(titulo);
  for (const [dim, pistas] of PISTAS_DIMENSAO) {
    if (dimensoes.includes(dim) && pistas.some((p) => t.includes(p))) return dim;
  }
  return dimensoes.includes("Outros") ? "Outros" : dimensoes[dimensoes.length - 1] || "Outros";
}

// Escalas escritas por extenso, convertidas para 1 a 5.
const ESCALA_TEXTO = {
  5: ["muito satisfeito", "extremamente satisfeito", "totalmente satisfeito", "excelente", "muito bom", "muito boa", "concordo totalmente", "muito provavel", "extremamente provavel"],
  4: ["satisfeito", "bom", "boa", "concordo", "provavel"],
  3: ["nem satisfeito nem insatisfeito", "indiferente", "neutro", "razoavel", "suficiente", "nem concordo nem discordo", "mais ou menos", "satisfatorio", "satisfatoria"],
  2: ["insatisfeito", "pouco satisfeito", "mau", "ma", "fraco", "fraca", "discordo", "improvavel", "pouco provavel", "insuficiente"],
  1: ["muito insatisfeito", "nada satisfeito", "totalmente insatisfeito", "muito mau", "muito ma", "pessimo", "pessima", "discordo totalmente", "nada provavel", "muito fraco", "muito fraca"],
};
const MAPA_ESCALA_TEXTO = (() => {
  const m = {};
  Object.entries(ESCALA_TEXTO).forEach(([v, ls]) => ls.forEach((l) => (m[l] = Number(v))));
  return m;
})();

const SEM_RESPOSTA = ["", "n/a", "na", "ns/nr", "nsnr", "nao se aplica", "nao sei", "nao sei / nao respondo", "sem opiniao", "-"];

// "4", "4 - Satisfeito", "4 estrelas", "Satisfeito" → número na escala.
function valorEscala(bruto) {
  const t = normChave(bruto);
  if (SEM_RESPOSTA.includes(t)) return null;
  const m = t.match(/^(\d{1,2})(?:[.,]0+)?(?:\s*(?:-|–|—|\.|\)|estrelas?|pontos?|\/\s*\d+).*)?$/);
  if (m) return Number(m[1]);
  const limpo = t.replace(/[.!]+$/, "");
  return MAPA_ESCALA_TEXTO[limpo] !== undefined ? MAPA_ESCALA_TEXTO[limpo] : undefined;
}

const COLUNAS_IGNORAR_INQ = [
  "carimbo", "timestamp", "data/hora", "hora de inicio", "hora de conclusao", "hora da ultima modificacao",
  "start time", "completion time", "last modified", "endereco de email", "email address", "id",
];

// Classifica uma coluna da exportação pelo conteúdo.
function analisarColunaInq(titulo, valores) {
  const t = normChave(titulo);
  if (pareceColunaPessoal(titulo)) return { tipo: "ignorar", pessoal: true };
  if (COLUNAS_IGNORAR_INQ.some((c) => t === c || t.startsWith(c))) return { tipo: "ignorar", tecnica: true };
  const preenchidos = valores.map((v) => String(v ?? "").trim()).filter((v) => !SEM_RESPOSTA.includes(normChave(v)));
  if (preenchidos.length === 0) return { tipo: "ignorar" };

  const nums = preenchidos.map(valorEscala);
  const reconhecidos = nums.filter((n) => n !== undefined && n !== null);
  const recomenda = /recomend|recommend/.test(t);
  if (reconhecidos.length / preenchidos.length >= 0.85) {
    const max = Math.max(...reconhecidos);
    const min = Math.min(...reconhecidos);
    const todosNumericos = preenchidos.every((v) => /^\s*\d/.test(v));
    if (max <= 10 && min >= 0) {
      if (max > 5 || recomenda) {
        const de0 = min === 0 || recomenda;
        return { tipo: recomenda ? "nps" : "escala", min: de0 ? 0 : 1, max: 10 };
      }
      return { tipo: "escala", min: 1, max: todosNumericos && max <= 4 && !preenchidos.some((v) => /5/.test(v)) ? 4 : 5 };
    }
  }

  const norm = preenchidos.map(normChave);
  if (norm.every((v) => ["sim", "nao", "yes", "no"].includes(v))) return { tipo: "simnao" };

  // Perguntas abertas pelo título, mesmo que haja poucas respostas diferentes.
  if (/melhorar|coment|sugest|observac|porque|descrev|o que mais|outro aspeto|gostaria de|deixe|partilhe/.test(t)) return { tipo: "aberta" };

  const distintos = new Set(norm);
  const mediaComp = preenchidos.reduce((s, v) => s + v.length, 0) / preenchidos.length;
  if (distintos.size <= 15 && (distintos.size <= 3 || distintos.size / preenchidos.length <= 0.6) && mediaComp < 60) {
    return { tipo: "escolha" };
  }
  return { tipo: "aberta" };
}

// Retira emails e telefones dos comentários antes de os guardar.
function limparComentario(t) {
  return String(t || "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/(\+?351\s?)?\b9\d{2}[\s.]?\d{3}[\s.]?\d{3}\b/g, "[telefone]")
    .trim();
}

function satisfacaoInqueritos(lista) {
  return satisfacaoDe(lista.flatMap((i) => i.perguntas || []));
}
const nomeInquerito = (i) => i.edicao || i.tipoEvento;

// ---------- Observações automáticas ----------
function observacoesInqueritos(lista, todos) {
  const obs = [];
  if (lista.length === 0) return obs;

  lista.forEach((i) => {
    const s = satisfacaoDe(i.perguntas || []);
    if (s.pct !== null && s.pct < 70) {
      obs.push({ nivel: "alarme", titulo: `${nomeInquerito(i)}: satisfação de ${s.pct}%`, texto: `Abaixo dos 70%. ${s.pctInsat}% das respostas são de insatisfação.` });
    }
    const nps = npsDe([i]);
    if (nps && nps.valor < 0) {
      obs.push({ nivel: "alarme", titulo: `${nomeInquerito(i)}: NPS negativo (${nps.valor})`, texto: `Há mais detratores (${nps.detr}) do que promotores (${nps.prom}).` });
    }
    if (i.enviados && i.respostas / i.enviados < 0.2) {
      obs.push({ nivel: "atencao", titulo: `${nomeInquerito(i)}: taxa de resposta de ${Math.round((i.respostas / i.enviados) * 100)}%`, texto: "Com tão poucas respostas, os resultados podem não representar os participantes." });
    } else if ((i.respostas || 0) < 10) {
      obs.push({ nivel: "atencao", titulo: `${nomeInquerito(i)}: só ${i.respostas} respostas`, texto: "Amostra pequena: uma ou duas respostas mudam muito as percentagens." });
    }

    // Comparação com a edição anterior do mesmo evento.
    const anteriores = todos
      .filter((o) => o.tipoEvento === i.tipoEvento && o.id !== i.id && String(o.data) < String(i.data))
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
    if (anteriores[0] && s.pct !== null) {
      const ant = satisfacaoDe(anteriores[0].perguntas || []);
      if (ant.pct !== null) {
        const dif = s.pct - ant.pct;
        if (dif <= -5) obs.push({ nivel: "atencao", titulo: `${nomeInquerito(i)} caiu ${Math.abs(dif)} p.p.`, texto: `De ${ant.pct}% em "${nomeInquerito(anteriores[0])}" para ${s.pct}%.` });
        if (dif >= 5) obs.push({ nivel: "bom", titulo: `${nomeInquerito(i)} subiu ${dif} p.p.`, texto: `De ${ant.pct}% em "${nomeInquerito(anteriores[0])}" para ${s.pct}%.` });
      }
    }
  });

  // Perguntas com mais insatisfação.
  const perguntas = lista.flatMap((i) => (i.perguntas || []).filter(pergEscala).map((q) => ({ q, i, r: resumoContagens(q, q.contagens) })));
  perguntas
    .filter((x) => x.r.n >= 5 && x.r.pctInsat >= 25)
    .sort((a, b) => b.r.pctInsat - a.r.pctInsat)
    .slice(0, 3)
    .forEach((x) =>
      obs.push({ nivel: "alarme", titulo: `${x.r.pctInsat}% insatisfeitos: "${x.q.texto.slice(0, 70)}${x.q.texto.length > 70 ? "…" : ""}"`, texto: `${nomeInquerito(x.i)} · ${x.q.dimensao}` })
    );

  // Dimensão mais fraca.
  const porDim = {};
  lista.forEach((i) =>
    (i.perguntas || []).filter(pergEscala).forEach((q) => {
      porDim[q.dimensao] = porDim[q.dimensao] || [];
      porDim[q.dimensao].push(q);
    })
  );
  const dims = Object.entries(porDim)
    .map(([d, qs]) => ({ d, s: satisfacaoDe(qs) }))
    .filter((x) => x.s.n >= 10)
    .sort((a, b) => a.s.pct - b.s.pct);
  if (dims.length >= 2 && dims[0].s.pct < 80) {
    obs.push({ nivel: "atencao", titulo: `${dims[0].d} é a dimensão mais fraca (${dims[0].s.pct}%)`, texto: `A melhor é ${dims[dims.length - 1].d}, com ${dims[dims.length - 1].s.pct}%.` });
  }

  // Evento com melhor resultado.
  const porTipo = [...new Set(lista.map((i) => i.tipoEvento))]
    .map((t) => ({ t, s: satisfacaoInqueritos(lista.filter((i) => i.tipoEvento === t)) }))
    .filter((x) => x.s.pct !== null && x.s.n >= 10)
    .sort((a, b) => b.s.pct - a.s.pct);
  if (porTipo[0] && porTipo[0].s.pct >= 90) {
    obs.push({ nivel: "bom", titulo: `${porTipo[0].t}: ${porTipo[0].s.pct}% de satisfação`, texto: "O evento mais bem avaliado no período escolhido." });
  }
  return obs;
}

// ---------- Importação ----------
const TIPOS_COLUNA_INQ = [
  ["escala", "Escala de satisfação"],
  ["nps", "Recomendação (NPS 0–10)"],
  ["simnao", "Sim / Não"],
  ["escolha", "Escolha (ex: escola, turno)"],
  ["aberta", "Comentário"],
  ["ignorar", "Ignorar"],
];

function ImportarInquerito({ tiposEvento, dimensoes, existentes, onGuardar, onFechar, onGerirLista, notificar, plano = [], planoInicial = null }) {
  const nomePlano = (p) => [p.evento, p.edicao].filter(Boolean).join(" · ");
  const [planoId, setPlanoId] = useState(planoInicial ? planoInicial.id : "");
  const [tipoEvento, setTipoEvento] = useState((planoInicial && tipoEventoDoPlano(planoInicial.evento, tiposEvento)) || tiposEvento[0] || "");
  const [edicao, setEdicao] = useState(planoInicial ? nomePlano(planoInicial) : "");
  const [data, setData] = useState(planoInicial ? planoInicial.fim || planoInicial.inicio || "" : "");
  const [enviados, setEnviados] = useState(planoInicial && planoInicial.inscritos ? String(planoInicial.inscritos) : "");
  const escolherPlano = (id) => {
    setPlanoId(id);
    const p = plano.find((x) => x.id === id);
    if (!p) return;
    const t = tipoEventoDoPlano(p.evento, tiposEvento);
    if (t) setTipoEvento(t);
    setEdicao(nomePlano(p));
    setData(p.fim || p.inicio || "");
    if (p.inscritos) setEnviados(String(p.inscritos));
  };
  const [texto, setTexto] = useState("");
  const [tabela, setTabela] = useState(null);
  const [colunas, setColunas] = useState([]);
  const [segmento, setSegmento] = useState("");
  const [guardarComentarios, setGuardarComentarios] = useState(true);
  const [erro, setErro] = useState("");
  const [aLer, setALer] = useState(false);

  const processar = (linhas) => {
    if (!linhas || linhas.length < 2) {
      setErro("Não encontrei respostas. A primeira linha deve ter as perguntas e cada linha seguinte uma resposta.");
      return;
    }
    const [cab, ...dados] = linhas;
    const cols = cab.map((titulo, idx) => {
      const valores = dados.map((l) => l[idx]);
      const a = analisarColunaInq(titulo, valores);
      return { idx, titulo: String(titulo || `Coluna ${idx + 1}`).trim(), ...a, min: a.min ?? 1, max: a.max ?? 5, dimensao: dimensaoProvavel(titulo, dimensoes) };
    });
    setTabela({ cab, dados });
    setColunas(cols);
    setErro("");
    const seg = cols.find((c) => c.tipo === "escolha" && /escola|polo|local|turno|escal|equipa|grupo|semana/.test(normChave(c.titulo)));
    setSegmento(seg ? String(seg.idx) : "");
    if (!data) {
      const iCarimbo = cab.findIndex((c) => /carimbo|timestamp|hora de conclusao|completion time/.test(normChave(c)));
      if (iCarimbo >= 0) {
        const datas = dados.map((l) => dataDeCarimbo(l[iCarimbo])).filter(Boolean).sort();
        if (datas[0]) setData(datas[0]);
      }
    }
  };

  const carregarFicheiro = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!edicao) setEdicao(f.name.replace(/\.(csv|xlsx?|tsv|txt)$/i, "").replace(/[_]+/g, " ").trim());
    setALer(true);
    try {
      if (/\.xlsx?$/i.test(f.name)) processar(await lerExcelInq(f));
      else processar(lerCSVInq(await f.text()));
    } catch (err) {
      setErro(`Não consegui ler o ficheiro (${err?.message || err}). Experimenta exportar como CSV ou copiar e colar as células.`);
    } finally {
      setALer(false);
    }
  };

  const setCol = (idx, patch) => setColunas((cs) => cs.map((c) => (c.idx === idx ? { ...c, ...patch } : c)));

  const respostas = tabela ? tabela.dados.length : 0;
  const usadas = colunas.filter((c) => c.tipo !== "ignorar");
  const duplicado = existentes.find((i) => i.tipoEvento === tipoEvento && normChave(i.edicao) === normChave(edicao) && i.data === data);

  const guardar = () => {
    if (!tipoEvento) return setErro("Escolhe o evento.");
    if (!data) return setErro("Indica a data do evento.");
    if (!tabela) return setErro("Carrega o ficheiro ou cola as respostas.");
    if (!usadas.some((c) => c.tipo === "escala" || c.tipo === "nps")) return setErro("Nenhuma coluna está marcada como escala ou NPS.");

    const segIdx = segmento === "" ? null : Number(segmento);
    const valorSeg = (l) => (segIdx === null ? null : String(l[segIdx] ?? "").trim() || "Sem resposta");
    const segmentos = {};
    if (segIdx !== null) tabela.dados.forEach((l) => (segmentos[valorSeg(l)] = (segmentos[valorSeg(l)] || 0) + 1));

    const perguntas = [];
    const comentarios = [];
    usadas.forEach((c) => {
      if (c.idx === segIdx) return;
      if (c.tipo === "aberta") {
        if (!guardarComentarios) return;
        tabela.dados.forEach((l) => {
          const t = limparComentario(l[c.idx]);
          if (t && !SEM_RESPOSTA.includes(normChave(t)) && t.length > 2) comentarios.push({ pergunta: c.titulo, texto: t, segmento: valorSeg(l) });
        });
        return;
      }
      const contagens = {};
      const porSegmento = {};
      tabela.dados.forEach((l) => {
        const bruto = l[c.idx];
        let chave;
        if (c.tipo === "escala" || c.tipo === "nps") {
          const v = valorEscala(bruto);
          if (v === null || v === undefined || v < c.min || v > c.max) return;
          chave = String(v);
        } else {
          const t = limparComentario(bruto);
          if (!t || SEM_RESPOSTA.includes(normChave(t))) return;
          chave = c.tipo === "simnao" ? (["sim", "yes"].includes(normChave(t)) ? "Sim" : "Não") : t;
        }
        contagens[chave] = (contagens[chave] || 0) + 1;
        if (segIdx !== null) {
          const s = valorSeg(l);
          porSegmento[s] = porSegmento[s] || {};
          porSegmento[s][chave] = (porSegmento[s][chave] || 0) + 1;
        }
      });
      perguntas.push({
        id: `q${c.idx}`,
        texto: c.titulo,
        tipo: c.tipo,
        min: c.tipo === "escala" || c.tipo === "nps" ? Number(c.min) : undefined,
        max: c.tipo === "escala" || c.tipo === "nps" ? Number(c.max) : undefined,
        dimensao: c.tipo === "nps" ? "Recomendação" : c.tipo === "escala" ? c.dimensao : undefined,
        contagens,
        porSegmento: segIdx !== null ? porSegmento : undefined,
      });
    });

    const reg = {
      id: duplicado ? duplicado.id : `inq_${Date.now()}`,
      tipoEvento,
      edicao: edicao.trim() || tipoEvento,
      data,
      epoca: epocaDe(data),
      enviados: enviados === "" ? null : Number(enviados),
      respostas,
      segmentoTitulo: segIdx !== null ? colunas.find((c) => c.idx === segIdx)?.titulo : null,
      segmentos: segIdx !== null ? segmentos : null,
      perguntas,
      comentarios,
      importadoEm: new Date().toISOString(),
    };
    if (planoId) reg.planoId = planoId;
    onGuardar(reg, !!duplicado, planoId || null);
    notificar(`${reg.edicao}: ${respostas} respostas e ${perguntas.length} perguntas importadas.`, "ok");
    onFechar();
  };

  const resumoValores = (c) => {
    if (!tabela) return "";
    const vs = tabela.dados.map((l) => String(l[c.idx] ?? "").trim()).filter(Boolean);
    const unicos = [...new Set(vs)];
    return unicos.slice(0, 4).join(" · ") + (unicos.length > 4 ? ` … (+${unicos.length - 4})` : "");
  };

  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div
        className="sheet"
        style={{ width: "min(860px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Importar inquérito</h2>
          <button onClick={onFechar} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 16, lineHeight: 1.5 }}>
          Exporta as respostas do Google Forms (CSV) ou do Microsoft Forms (Excel). A app só guarda contagens por pergunta; nomes, emails e respostas individuais não ficam gravados.
        </div>

        {plano.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="imp-plano">
              Envio do cronograma
            </label>
            <select id="imp-plano" value={planoId} onChange={(e) => escolherPlano(e.target.value)} style={inputStyle}>
              <option value="">Nenhum (inquérito fora do cronograma)</option>
              {[...plano]
                .filter((p) => !p.inqueritoId || p.id === planoId)
                .sort((a, b) => String(a.fim || a.inicio).localeCompare(String(b.fim || b.inicio)))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {nomePlano(p)}
                    {p.fim ? ` · ${fmt(new Date(p.fim + "T00:00:00"))}` : ""} · {p.estado}
                  </option>
                ))}
            </select>
            <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>Ao guardar, esse envio passa a Analisado e fica com as respostas.</div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={{ ...labelStyle, marginTop: 0 }}>Evento</label>
              <button type="button" onClick={() => onGerirLista("tiposEvento")} style={{ ...linkBtnStyle, marginTop: 0 }}>
                Gerir lista
              </button>
            </div>
            <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)} style={inputStyle}>
              {tiposEvento.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Edição</label>
            <input type="text" placeholder="Ex: Foot-Camp Verão · 1.º turno" value={edicao} onChange={(e) => setEdicao(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Data do evento</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Inquéritos enviados (opcional)</label>
            <input type="number" min={0} placeholder="Para a taxa de resposta" value={enviados} onChange={(e) => setEnviados(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
          <label style={{ ...primaryBtnStyle, flex: "none", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px" }}>
            <Plus size={15} /> {aLer ? "A ler…" : "Escolher ficheiro (CSV ou Excel)"}
            <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv" onChange={carregarFicheiro} style={{ display: "none" }} />
          </label>
          <span style={{ fontSize: 12, color: COLORS.slate }}>ou cola as células (com a linha das perguntas):</span>
        </div>
        <textarea
          rows={3}
          value={texto}
          placeholder="Cola aqui…"
          onChange={(e) => {
            setTexto(e.target.value);
            if (e.target.value.trim()) processar(lerCSVInq(e.target.value));
          }}
          style={{ ...inputStyle, marginTop: 8, resize: "vertical", fontFamily: "inherit" }}
        />

        {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.danger }}>{erro}</div>}

        {tabela && (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", margin: "18px 0 10px" }}>
              <div style={panelTitle}>
                {respostas} respostas · {colunas.filter((c) => c.tipo === "escala" || c.tipo === "nps").length} perguntas de avaliação
              </div>
              {colunas.some((c) => c.pessoal) && (
                <span style={{ fontSize: 12, color: COLORS.warn }}>As colunas com dados pessoais foram ignoradas.</span>
              )}
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              {colunas.map((c) => (
                <div
                  key={c.idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(180px, 2fr) minmax(150px, 1fr) minmax(150px, 1fr)",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: c.tipo === "ignorar" ? "transparent" : COLORS.paperSunken,
                    opacity: c.tipo === "ignorar" ? 0.6 : 1,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.titulo}>
                      {c.titulo}
                    </div>
                    <div style={{ fontSize: 11.5, color: COLORS.slate, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.pessoal ? "Dado pessoal — não é importado" : c.tecnica ? "Data, hora ou ID — não é importado" : resumoValores(c)}
                    </div>
                  </div>
                  <select value={c.tipo} disabled={c.pessoal} onChange={(e) => setCol(c.idx, { tipo: e.target.value, ...(e.target.value === "nps" ? { min: 0, max: 10 } : {}) })} style={{ ...inputStyle, padding: "7px 8px", fontSize: 12.5 }}>
                    {TIPOS_COLUNA_INQ.map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                  {c.tipo === "escala" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <select value={c.dimensao} onChange={(e) => setCol(c.idx, { dimensao: e.target.value })} style={{ ...inputStyle, padding: "7px 8px", fontSize: 12.5, flex: 1, minWidth: 0 }}>
                        {dimensoes.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <select
                        value={`${c.min}-${c.max}`}
                        onChange={(e) => {
                          const [mi, ma] = e.target.value.split("-").map(Number);
                          setCol(c.idx, { min: mi, max: ma });
                        }}
                        title="Escala"
                        style={{ ...inputStyle, padding: "7px 6px", fontSize: 12.5, width: 74, flex: "none" }}
                      >
                        {["1-4", "1-5", "1-10", "0-10"].map((e) => (
                          <option key={e} value={e}>
                            {e.replace("-", "–")}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: COLORS.slate }}>
                      {c.tipo === "nps" ? "0–6 detratores · 9–10 promotores" : c.tipo === "aberta" ? "Mostrado na lista de comentários" : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 14 }}>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>Comparar por (opcional)</label>
                <select value={segmento} onChange={(e) => setSegmento(e.target.value)} style={inputStyle}>
                  <option value="">Sem comparação</option>
                  {colunas
                    .filter((c) => c.tipo === "escolha")
                    .map((c) => (
                      <option key={c.idx} value={c.idx}>
                        {c.titulo}
                      </option>
                    ))}
                </select>
                <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 5 }}>Ex: escola, turno ou escalão, para ver a satisfação de cada um.</div>
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 18, cursor: "pointer" }}>
                <input type="checkbox" checked={guardarComentarios} onChange={(e) => setGuardarComentarios(e.target.checked)} />
                Guardar os comentários (emails e telefones são apagados)
              </label>
            </div>
          </>
        )}

        {duplicado && tabela && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: COLORS.warn }}>Já existe um inquérito com este evento, edição e data. Ao guardar, é substituído.</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onFechar} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={!tabela} style={{ ...primaryBtnStyle, opacity: tabela ? 1 : 0.5 }}>
            {duplicado ? "Substituir inquérito" : "Guardar inquérito"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Barra empilhada insatisfeito / neutro / satisfeito, com legenda por extenso.
function BarraDistribuicao({ r, altura = 10 }) {
  if (!r || !r.n) return null;
  const neutro = r.n - r.sat - r.insat;
  const partes = [
    { v: r.insat, cor: COLORS.danger, nome: "Insatisfeitos" },
    { v: neutro, cor: COLORS.rule, nome: "Neutros" },
    { v: r.sat, cor: COLORS.ok, nome: "Satisfeitos" },
  ].filter((p) => p.v > 0);
  return (
    <div style={{ display: "flex", gap: 2, height: altura, borderRadius: 4, overflow: "hidden", background: COLORS.paperSunken }}>
      {partes.map((p) => (
        <div key={p.nome} title={`${p.nome}: ${p.v} (${Math.round((p.v / r.n) * 100)}%)`} style={{ width: `${(p.v / r.n) * 100}%`, background: p.cor }} />
      ))}
    </div>
  );
}

function LegendaDistribuicao() {
  return (
    <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: COLORS.ink2, flexWrap: "wrap" }}>
      {[
        [COLORS.danger, "Insatisfeitos"],
        [COLORS.rule, "Neutros"],
        [COLORS.ok, "Satisfeitos"],
      ].map(([c, l]) => (
        <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}

// ---------- Detalhe de um inquérito ----------
function InqueritoDetalhe({ inquerito, onFechar, onAtualizar, onRemover }) {
  const [enviados, setEnviados] = useState(inquerito.enviados ?? "");
  const [segAtivo, setSegAtivo] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const s = satisfacaoDe(inquerito.perguntas || [], segAtivo || null);
  const nps = npsDe([segAtivo ? { perguntas: (inquerito.perguntas || []).map((q) => ({ ...q, contagens: (q.porSegmento || {})[segAtivo] || {} })) } : inquerito]);
  const taxa = inquerito.enviados ? Math.round((inquerito.respostas / inquerito.enviados) * 100) : null;
  const segs = inquerito.segmentos ? Object.entries(inquerito.segmentos).sort((a, b) => b[1] - a[1]) : [];
  const contagensDe = (q) => (segAtivo ? (q.porSegmento || {})[segAtivo] || {} : q.contagens);

  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }} onClick={onFechar}>
      <div
        className="sheet"
        style={{ width: "min(720px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 12, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
            {fmt(new Date(inquerito.data + "T00:00:00"))} · Época {inquerito.epoca}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button title="Eliminar" onClick={() => (confirmar ? onRemover(inquerito.id) : setConfirmar(true))} style={iconBtnStyle}>
              <Trash2 size={16} color={COLORS.danger} />
            </button>
            <button onClick={onFechar} style={iconBtnStyle}>
              <X size={18} />
            </button>
          </div>
        </div>
        {confirmar && (
          <div style={{ fontSize: 12.5, color: COLORS.danger, marginTop: 6 }}>Carrega outra vez no caixote para eliminar este inquérito.</div>
        )}
        <h2 style={{ margin: "6px 0 6px", fontSize: 20, color: COLORS.navy }}>{inquerito.edicao}</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          <Tag label={inquerito.tipoEvento} color={COLORS.navy} bg={COLORS.rule} />
          <Tag label={`${inquerito.respostas} respostas`} color={COLORS.slate} bg={COLORS.doneBg} />
          {taxa !== null && <Tag label={`Taxa de resposta ${taxa}%`} color={COLORS.slate} bg={COLORS.doneBg} />}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <StatCard label="Satisfação" value={s.pct ?? "—"} subtitle={s.pct !== null ? `% satisfeitos · ${s.pctInsat}% insatisfeitos` : "Sem perguntas de escala"} color={corSatisfacao(s.pct)} anel={s.pct} />
          {nps && <StatCard label="NPS" value={nps.valor} subtitle={`${nps.prom} promotores · ${nps.detr} detratores`} color={nps.valor >= 30 ? COLORS.ok : nps.valor >= 0 ? COLORS.warn : COLORS.danger} />}
        </div>

        {segs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...labelStyle, marginTop: 0 }}>{inquerito.segmentoTitulo}</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["", "Todos"], ...segs.map(([k, n]) => [k, `${k} (${n})`])].map(([k, l]) => (
                <button
                  key={k || "todos"}
                  onClick={() => setSegAtivo(k)}
                  className="pill"
                  style={{
                    padding: "5px 11px",
                    borderRadius: 20,
                    border: `1.5px solid ${segAtivo === k ? COLORS.navy : COLORS.rule}`,
                    background: segAtivo === k ? COLORS.navy : "transparent",
                    color: segAtivo === k ? COLORS.onAccent : COLORS.ink2,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={panelTitle}>Respostas por pergunta</div>
          <LegendaDistribuicao />
        </div>
        <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
          {(inquerito.perguntas || []).map((q) => {
            const c = contagensDe(q);
            if (q.tipo === "escala" || q.tipo === "nps") {
              const r = resumoContagens(q, c);
              return (
                <div key={q.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, marginBottom: 5 }}>
                    <span style={{ minWidth: 0 }}>
                      {q.texto}
                      <span style={{ color: COLORS.slate, fontSize: 11.5 }}> · {q.tipo === "nps" ? "NPS" : q.dimensao}</span>
                    </span>
                    <strong style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {q.tipo === "nps" ? `NPS ${r.nps ?? "—"}` : r.pctSat !== null ? `${r.pctSat}%` : "—"}
                    </strong>
                  </div>
                  <BarraDistribuicao r={q.tipo === "nps" ? { n: r.n, sat: r.prom, insat: r.detr } : r} />
                  <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 3 }}>
                    {r.n} respostas · média {r.media !== null ? r.media.toFixed(1).replace(".", ",") : "—"} em {q.min}–{q.max}
                  </div>
                </div>
              );
            }
            const total = Object.values(c).reduce((a, b) => a + b, 0);
            return (
              <div key={q.id}>
                <div style={{ fontSize: 13, marginBottom: 5 }}>{q.texto}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(c)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => (
                      <span key={k} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 12, background: COLORS.paperSunken, color: COLORS.ink2 }}>
                        {k} <strong style={{ color: COLORS.ink }}>{total ? Math.round((n / total) * 100) : 0}%</strong>
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>

        {(inquerito.comentarios || []).length > 0 && (
          <>
            <div style={{ ...panelTitle, marginBottom: 8 }}>Comentários ({inquerito.comentarios.filter((cm) => !segAtivo || cm.segmento === segAtivo).length})</div>
            <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
              {inquerito.comentarios
                .filter((cm) => !segAtivo || cm.segmento === segAtivo)
                .map((cm, i) => (
                  <div key={i} style={{ fontSize: 13, padding: "8px 11px", background: COLORS.paperSunken, borderRadius: 8, lineHeight: 1.5 }}>
                    {cm.texto}
                    <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 3 }}>
                      {cm.pergunta}
                      {cm.segmento ? ` · ${cm.segmento}` : ""}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}

        <label style={labelStyle}>Inquéritos enviados</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" min={0} value={enviados} onChange={(e) => setEnviados(e.target.value)} placeholder="Para calcular a taxa de resposta" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={() => onAtualizar(inquerito.id, { enviados: enviados === "" ? null : Number(enviados) })} style={{ ...primaryBtnStyle, flex: "none", padding: "0 14px" }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Análise ----------
const INQ_PARAMS = [
  { key: "evento", label: "Satisfação por evento" },
  { key: "evolucao", label: "Evolução por edição" },
  { key: "dimensao", label: "Por dimensão" },
  { key: "nps", label: "NPS por evento" },
  { key: "perguntas", label: "Melhores e piores perguntas" },
  { key: "segmento", label: "Por escola / turno" },
  { key: "comentarios", label: "Comentários" },
];

const CORES_SERIE = () => [COLORS.navy, COLORS.progress, COLORS.purple, COLORS.warn, COLORS.ok, COLORS.navySoft];

function InqueritosAnalise({ inqueritos, tiposEvento }) {
  const epocas = [...new Set(inqueritos.map((i) => i.epoca).filter(Boolean))].sort().reverse();
  const [fEpoca, setFEpoca] = useState([]);
  const [fTipo, setFTipo] = useState("todos");
  const [visiveis, setVisiveis] = useState(new Set(INQ_PARAMS.map((p) => p.key)));
  const [procura, setProcura] = useState("");
  const toggle = (k) =>
    setVisiveis((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const lista = inqueritos
    .filter((i) => naSelecao(fEpoca, i.epoca))
    .filter((i) => fTipo === "todos" || i.tipoEvento === fTipo)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));

  // Cada tipo de evento tem sempre a mesma cor, pela ordem da lista.
  const ordemTipos = [...tiposEvento, ...[...new Set(inqueritos.map((i) => i.tipoEvento))].filter((t) => !tiposEvento.includes(t))];
  const corTipo = (t) => CORES_SERIE()[ordemTipos.indexOf(t) % CORES_SERIE().length];

  const respostas = lista.reduce((s, i) => s + (i.respostas || 0), 0);
  const comEnviados = lista.filter((i) => i.enviados);
  const taxa = comEnviados.length ? Math.round((comEnviados.reduce((s, i) => s + i.respostas, 0) / comEnviados.reduce((s, i) => s + i.enviados, 0)) * 100) : null;
  const global = satisfacaoInqueritos(lista);
  const nps = npsDe(lista);

  const tiposPresentes = ordemTipos.filter((t) => lista.some((i) => i.tipoEvento === t));
  const porEvento = tiposPresentes.map((t) => {
    const l = lista.filter((i) => i.tipoEvento === t);
    const s = satisfacaoInqueritos(l);
    return { name: t, valor: s.pct, respostas: l.reduce((a, i) => a + i.respostas, 0), edicoes: l.length };
  });

  const evolucao = lista.map((i) => {
    const linha = { name: `${i.edicao} (${fmt(new Date(i.data + "T00:00:00"))})` };
    linha[i.tipoEvento] = satisfacaoDe(i.perguntas || []).pct;
    return linha;
  });

  const porDim = {};
  lista.forEach((i) =>
    (i.perguntas || []).filter(pergEscala).forEach((q) => {
      (porDim[q.dimensao] = porDim[q.dimensao] || []).push(q);
    })
  );
  const dimData = Object.entries(porDim)
    .map(([d, qs]) => ({ name: d, valor: satisfacaoDe(qs).pct, n: satisfacaoDe(qs).n }))
    .sort((a, b) => b.valor - a.valor);

  const npsData = tiposPresentes
    .map((t) => {
      const v = npsDe(lista.filter((i) => i.tipoEvento === t));
      if (!v) return null;
      return { name: t, Promotores: Math.round((v.prom / v.n) * 100), Neutros: Math.round((v.neutros / v.n) * 100), Detratores: Math.round((v.detr / v.n) * 100), nps: v.valor };
    })
    .filter(Boolean);

  const perguntas = lista
    .flatMap((i) => (i.perguntas || []).filter(pergEscala).map((q) => ({ q, i, r: resumoContagens(q, q.contagens) })))
    .filter((x) => x.r.n >= 3);
  const melhores = [...perguntas].sort((a, b) => b.r.pctSat - a.r.pctSat).slice(0, 5);
  const piores = [...perguntas].sort((a, b) => a.r.pctSat - b.r.pctSat || b.r.pctInsat - a.r.pctInsat).slice(0, 5);

  // Junta segmentos com o mesmo nome entre inquéritos (ex: a mesma escola em várias edições).
  const segAgg = {};
  lista.forEach((i) =>
    Object.keys(i.segmentos || {}).forEach((sg) => {
      const s = satisfacaoDe(i.perguntas || [], sg);
      if (!s.n) return;
      segAgg[sg] = segAgg[sg] || { n: 0, sat: 0, respostas: 0 };
      segAgg[sg].n += s.n;
      segAgg[sg].sat += Math.round((s.pct / 100) * s.n);
      segAgg[sg].respostas += i.segmentos[sg];
    })
  );
  const segData = Object.entries(segAgg)
    .map(([k, v]) => ({ name: k, valor: Math.round((v.sat / v.n) * 100), respostas: v.respostas }))
    .sort((a, b) => b.valor - a.valor);

  const comentarios = lista
    .flatMap((i) => (i.comentarios || []).map((c) => ({ ...c, evento: i.tipoEvento, edicao: i.edicao, data: i.data })))
    .filter((c) => !procura || normChave(c.texto).includes(normChave(procura)))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const selectFiltro = { ...inputStyle, width: "auto", minWidth: 160, padding: "8px 10px" };
  const eixoPct = { type: "number", domain: [0, 100], tick: { fontSize: 11, fill: COLORS.slate }, axisLine: false, tickLine: false, tickFormatter: (v) => `${v}%` };

  if (inqueritos.length === 0) {
    return <SemDados icon={MessageSquareText} titulo="Ainda sem inquéritos" texto="Importa as respostas de um evento no separador Registo para ver a análise aqui." />;
  }

  return (
    <div>
      <ComparacaoEpocas
        titulo="Comparação entre épocas"
        nota="Respeita o filtro de evento."
        epocas={inqueritos.map((i) => i.epoca)}
        selecionadas={fEpoca}
        metricas={[
          { key: "n", label: "Inquéritos" },
          { key: "resp", label: "Respostas", melhor: "alto" },
          { key: "taxa", label: "Taxa de resposta", unidade: "%", melhor: "alto" },
          { key: "sat", label: "Satisfação", unidade: "%", melhor: "alto" },
          { key: "nps", label: "NPS", melhor: "alto" },
        ]}
        calcular={(ep, lim) => {
          const l = naEpoca(inqueritos.filter((i) => fTipo === "todos" || i.tipoEvento === fTipo), "data", ep, lim);
          const comEnv = l.filter((i) => i.enviados);
          const n = npsDe(l);
          return {
            n: l.length,
            resp: l.reduce((t, i) => t + (i.respostas || 0), 0),
            taxa: comEnv.length ? Math.round((comEnv.reduce((t, i) => t + i.respostas, 0) / comEnv.reduce((t, i) => t + i.enviados, 0)) * 100) : null,
            sat: satisfacaoInqueritos(l).pct,
            nps: n ? n.valor : null,
          };
        }}
      />
      <Filtros>
        <FiltroEpocas epocas={epocas} valor={fEpoca} onChange={setFEpoca} />
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={selectFiltro}>
          <option value="todos">Todos os eventos</option>
          {ordemTipos
            .filter((t) => inqueritos.some((i) => i.tipoEvento === t))
            .map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
        </select>
      </Filtros>

      {lista.length === 0 ? (
        <SemDados texto="Não há inquéritos com estes filtros." />
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
            <StatCard label="Satisfação" value={global.pct ?? "—"} subtitle={global.pct !== null ? `% satisfeitos · ${global.pctInsat}% insatisfeitos` : undefined} color={corSatisfacao(global.pct)} anel={global.pct} />
            <StatCard label="NPS" value={nps ? nps.valor : "—"} subtitle={nps ? `${nps.n} respostas à recomendação` : "Sem pergunta de recomendação"} color={!nps ? COLORS.slate : nps.valor >= 30 ? COLORS.ok : nps.valor >= 0 ? COLORS.warn : COLORS.danger} />
            <StatCard label="Respostas" value={respostas} subtitle={`${lista.length} inquérito${lista.length === 1 ? "" : "s"}`} />
            <StatCard label="Taxa de resposta" value={taxa ?? "—"} subtitle={taxa !== null ? `% · em ${comEnviados.length} com envios registados` : "Indica os enviados em cada inquérito"} anel={taxa} color={COLORS.navySoft} />
          </div>

          <Observacoes itens={observacoesInqueritos(lista, inqueritos)} />
          <ParamChips params={INQ_PARAMS} visible={visiveis} onToggle={toggle} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
            {visiveis.has("evento") && porEvento.length > 0 && (
              <div style={panelStyle}>
                <div style={panelTitle}>Satisfação por evento</div>
                <ResponsiveContainer width="100%" height={Math.max(170, porEvento.length * 38)}>
                  <BarChart data={porEvento} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                    <XAxis {...eixoPct} />
                    <YAxis type="category" dataKey="name" width={130} tick={<TickNome largura={130} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
                    <Tooltip content={<DicaGrafico sufixo="%" />} cursor={{ fill: COLORS.ruleSoft }} />
                    <ReferenceLine x={70} stroke={COLORS.danger} strokeDasharray="4 4" label={{ value: "70%", position: "top", fontSize: 10, fill: COLORS.danger }} />
                    <Bar dataKey="valor" name="Satisfeitos" radius={[0, 4, 4, 0]} barSize={18}>
                      {porEvento.map((d) => (
                        <Cell key={d.name} fill={corTipo(d.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {visiveis.has("evolucao") && evolucao.length > 1 && (
              <div style={panelStyle}>
                <div style={panelTitle}>Evolução por edição</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={evolucao} margin={{ left: -10, right: 16, top: 8 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={false} axisLine={{ stroke: COLORS.rule }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip content={<DicaGrafico sufixo="%" />} />
                    <ReferenceLine y={70} stroke={COLORS.danger} strokeDasharray="4 4" />
                    {tiposPresentes.map((t) => (
                      <Line key={t} type="monotone" dataKey={t} name={t} stroke={corTipo(t)} strokeWidth={2} dot={{ r: 4, fill: corTipo(t), stroke: COLORS.paperRaised, strokeWidth: 2 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                {tiposPresentes.length > 1 && (
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11.5, color: COLORS.ink2, marginTop: 6 }}>
                    {tiposPresentes.map((t) => (
                      <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 3, borderRadius: 2, background: corTipo(t) }} />
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {visiveis.has("dimensao") && dimData.length > 0 && (
              <div style={panelStyle}>
                <div style={panelTitle}>Satisfação por dimensão</div>
                <ResponsiveContainer width="100%" height={Math.max(170, dimData.length * 34)}>
                  <BarChart data={dimData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                    <XAxis {...eixoPct} />
                    <YAxis type="category" dataKey="name" width={140} tick={<TickNome largura={140} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
                    <Tooltip content={<DicaGrafico sufixo="%" />} cursor={{ fill: COLORS.ruleSoft }} />
                    <ReferenceLine x={70} stroke={COLORS.danger} strokeDasharray="4 4" />
                    <Bar dataKey="valor" name="Satisfeitos" fill={COLORS.navySoft} radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {visiveis.has("nps") && npsData.length > 0 && (
              <div style={panelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <div style={panelTitle}>NPS por evento</div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: COLORS.ink2 }}>
                    {[
                      [COLORS.danger, "Detratores (0–6)"],
                      [COLORS.rule, "Neutros (7–8)"],
                      [COLORS.ok, "Promotores (9–10)"],
                    ].map(([c, l]) => (
                      <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {npsData.map((d) => (
                    <div key={d.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                        <span>{d.name}</span>
                        <strong style={{ fontVariantNumeric: "tabular-nums" }}>NPS {d.nps}</strong>
                      </div>
                      <div style={{ display: "flex", gap: 2, height: 12, borderRadius: 4, overflow: "hidden" }}>
                        {[
                          ["Detratores", COLORS.danger],
                          ["Neutros", COLORS.rule],
                          ["Promotores", COLORS.ok],
                        ]
                          .filter(([k]) => d[k] > 0)
                          .map(([k, c]) => (
                            <div key={k} title={`${k}: ${d[k]}%`} style={{ width: `${d[k]}%`, background: c }} />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {visiveis.has("segmento") && segData.length > 1 && (
              <div style={panelStyle}>
                <div style={panelTitle}>Por escola / turno</div>
                <ResponsiveContainer width="100%" height={Math.max(170, segData.length * 32)}>
                  <BarChart data={segData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
                    <XAxis {...eixoPct} />
                    <YAxis type="category" dataKey="name" width={150} tick={<TickNome largura={150} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
                    <Tooltip content={<DicaGrafico sufixo="%" />} cursor={{ fill: COLORS.ruleSoft }} />
                    <ReferenceLine x={70} stroke={COLORS.danger} strokeDasharray="4 4" />
                    <Bar dataKey="valor" name="Satisfeitos" fill={COLORS.navySoft} radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>Agrupa pelos valores da coluna escolhida em "Comparar por" ao importar.</div>
              </div>
            )}
          </div>

          {visiveis.has("perguntas") && perguntas.length > 0 && (
            <div style={{ ...panelStyle, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={panelTitle}>Melhores e piores perguntas</div>
                <LegendaDistribuicao />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 22 }}>
                {[
                  ["A melhorar", piores],
                  ["Pontos fortes", melhores],
                ].map(([titulo, itens]) => (
                  <div key={titulo}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.slate, marginBottom: 8 }}>{titulo}</div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {itens.map((x) => (
                        <div key={`${x.i.id}-${x.q.id}`}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginBottom: 4 }}>
                            <span style={{ minWidth: 0 }}>{x.q.texto}</span>
                            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{x.r.pctSat}%</strong>
                          </div>
                          <BarraDistribuicao r={x.r} altura={8} />
                          <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 3 }}>
                            {nomeInquerito(x.i)} · {x.q.dimensao} · {x.r.n} respostas
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visiveis.has("comentarios") && lista.some((i) => (i.comentarios || []).length) && (
            <div style={{ ...panelStyle, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <div style={panelTitle}>Comentários ({comentarios.length})</div>
                <div style={{ position: "relative" }}>
                  <Search size={14} color={COLORS.slate} style={{ position: "absolute", left: 10, top: 10 }} />
                  <input value={procura} onChange={(e) => setProcura(e.target.value)} placeholder="Procurar palavra…" style={{ ...inputStyle, paddingLeft: 30, width: 220 }} />
                </div>
              </div>
              <div style={{ display: "grid", gap: 6, maxHeight: 420, overflowY: "auto" }}>
                {comentarios.slice(0, 200).map((c, i) => (
                  <div key={i} style={{ fontSize: 13, padding: "8px 11px", background: COLORS.paperSunken, borderRadius: 8, lineHeight: 1.5 }}>
                    {c.texto}
                    <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 3 }}>
                      {c.edicao}
                      {c.segmento ? ` · ${c.segmento}` : ""} · {c.pergunta}
                    </div>
                  </div>
                ))}
                {comentarios.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate }}>Nenhum comentário com essa palavra.</div>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ======================================================================
// ---------- Planeamento dos inquéritos (cronograma anual) ----------
// ======================================================================
// Cada linha do cronograma é um envio planeado: evento, edição, datas,
// público, responsável e estado. A data de envio calcula-se pela regra da
// tipologia (dias depois do fim), recuando para o último dia do evento quando
// cai num dia não útil, como no Excel original.

const ESTADOS_PLANO = {
  "Por enviar": { color: COLORS.slate, bg: COLORS.doneBg },
  Enviado: { color: COLORS.progress, bg: COLORS.progressBg },
  Fechado: { color: COLORS.warn, bg: COLORS.warnBg },
  Analisado: { color: COLORS.ok, bg: COLORS.okBg },
};
const JANELA_ALERTA_DIAS = 21;

function hojeISO() {
  return isoDe(new Date());
}

// Situação visível: o estado guardado, ou "Atrasado" se já devia ter saído.
function situacaoPlano(item, envio) {
  if (item.estado === "Por enviar" && envio && envio < hojeISO()) return { label: "Atrasado", color: COLORS.danger, bg: COLORS.dangerBg };
  const m = ESTADOS_PLANO[item.estado] || ESTADOS_PLANO["Por enviar"];
  return { label: item.estado || "Por enviar", ...m };
}

const MESES_PLANO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Lê o Excel do cronograma: procura a linha com "Evento" e "Tipologia".
function lerCronograma(linhas) {
  const titulo = linhas.slice(0, 5).flat().join(" ");
  const ep = (titulo.match(/(\d{4}\/\d{2})/) || [])[1] || null;
  const iCab = linhas.findIndex((l) => l.some((c) => normChave(c) === "evento") && l.some((c) => normChave(c) === "tipologia"));
  if (iCab < 0) throw new Error('não encontrei a linha de cabeçalho com "Evento" e "Tipologia"');
  const cab = linhas[iCab].map(normChave);
  const col = (...nomes) => cab.findIndex((c) => nomes.some((n) => c === n || c.startsWith(n)));
  const C = {
    evento: col("evento"),
    edicao: col("edicao", "edição"),
    tipologia: col("tipologia"),
    publico: col("publico"),
    inicio: col("inicio"),
    fim: col("fim"),
    responsavel: col("responsavel"),
    estado: col("estado"),
    inscritos: col("inscritos"),
    respostas: col("respostas"),
    obs: col("observacoes", "obs"),
  };
  const v = (l, k) => (C[k] >= 0 ? String(l[C[k]] ?? "").trim() : "");
  const num = (s) => (s === "" || isNaN(Number(s)) ? null : Math.round(Number(s)));
  const itens = [];
  linhas.slice(iCab + 1).forEach((l, k) => {
    const evento = v(l, "evento");
    if (!evento) return;
    const estado = Object.keys(ESTADOS_PLANO).find((e) => normChave(e) === normChave(v(l, "estado"))) || "Por enviar";
    const inicio = dataDeCelula(v(l, "inicio"));
    itens.push({
      id: `pl_${Date.now()}_${k}`,
      evento,
      edicao: v(l, "edicao"),
      tipologia: v(l, "tipologia") || "Evento 1 dia",
      publico: v(l, "publico"),
      inicio,
      fim: dataDeCelula(v(l, "fim")) || inicio,
      responsavel: v(l, "responsavel"),
      estado,
      inscritos: num(v(l, "inscritos")),
      respostas: num(v(l, "respostas")),
      obs: v(l, "obs"),
      epoca: ep || (inicio ? epocaDe(inicio) : epocaDe(hojeISO())),
    });
  });
  return { epoca: ep, itens };
}

// Associa o nome do evento do cronograma ao tipo de evento usado nos resultados.
function tipoEventoDoPlano(evento, tiposEvento) {
  const e = normChave(evento);
  return tiposEvento.find((t) => {
    const n = normChave(t).replace(/s$/, "");
    return e.includes(n) || n.includes(e);
  });
}

function PlanoForm({ inicial, epoca, tipologias, tiposEvento, eventosUsados, publicosUsados, regras, onGuardar, onRemover, onFechar, onGerirLista }) {
  const [f, setF] = useState(
    inicial || {
      id: `pl_${Date.now()}`,
      evento: "",
      edicao: "",
      tipologia: tipologias[0] || "Evento 1 dia",
      publico: "",
      inicio: "",
      fim: "",
      envioManual: "",
      responsavel: "",
      estado: "Por enviar",
      inscritos: null,
      respostas: null,
      obs: "",
      epoca,
    }
  );
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setNum = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))) }));
  const calculada = dataEnvioPlano({ ...f, envioManual: "" }, regras);
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };

  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div
        className="sheet"
        style={{ width: "min(640px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}`, boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>{inicial ? "Editar envio" : "Novo envio no cronograma"}</h2>
          <button onClick={onFechar} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>

        <div style={grid}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-evento">Evento</label>
            <input id="pl-evento" list="pl-eventos" value={f.evento} onChange={set("evento")} placeholder="Ex: Foot-Camp Natal" style={inputStyle} />
            <datalist id="pl-eventos">
              {[...new Set([...eventosUsados, ...tiposEvento])].map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-edicao">Edição / local</label>
            <input id="pl-edicao" value={f.edicao} onChange={set("edicao")} placeholder="Ex: Semana 1 · New Balance Park" style={inputStyle} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-tipologia">Tipologia</label>
              <button type="button" onClick={() => onGerirLista("tipologiasInq")} style={{ ...linkBtnStyle, marginTop: 0 }}>
                Gerir lista
              </button>
            </div>
            <select id="pl-tipologia" value={f.tipologia} onChange={set("tipologia")} style={inputStyle}>
              {[...new Set([...tipologias, f.tipologia])].filter(Boolean).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-publico">Público</label>
            <input id="pl-publico" list="pl-publicos" value={f.publico} onChange={set("publico")} placeholder="Ex: U7–U14 Outros Locais" style={inputStyle} />
            <datalist id="pl-publicos">
              {publicosUsados.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-inicio">Início</label>
            <input id="pl-inicio" type="date" value={f.inicio} onChange={(e) => setF((x) => ({ ...x, inicio: e.target.value, fim: x.fim && x.fim >= e.target.value ? x.fim : e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-fim">Fim</label>
            <input id="pl-fim" type="date" value={f.fim} min={f.inicio || undefined} onChange={set("fim")} style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-envio">Envio do inquérito</label>
            <input id="pl-envio" type="date" value={f.envioManual || ""} onChange={set("envioManual")} style={inputStyle} />
            <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>
              {calculada ? `Pela regra: ${fmt(dataLocal(calculada))}. Preenche só para mudar.` : "Calculada quando houver data de fim."}
            </div>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-resp">Responsável</label>
            <input id="pl-resp" value={f.responsavel} onChange={set("responsavel")} placeholder="Iniciais" style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-estado">Estado</label>
            <select id="pl-estado" value={f.estado} onChange={set("estado")} style={inputStyle}>
              {Object.keys(ESTADOS_PLANO).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-inscritos">Inscritos</label>
            <input id="pl-inscritos" type="number" min={0} value={f.inscritos ?? ""} onChange={setNum("inscritos")} style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-respostas">Respostas</label>
            <input id="pl-respostas" type="number" min={0} value={f.respostas ?? ""} onChange={setNum("respostas")} style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="pl-epoca">Época</label>
            <select id="pl-epoca" value={f.epoca} onChange={set("epoca")} style={inputStyle}>
              {epocasDisponiveis([f.epoca]).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label style={labelStyle} htmlFor="pl-obs">Observações</label>
        <textarea id="pl-obs" rows={2} value={f.obs} onChange={set("obs")} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />

        {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.danger }}>{erro}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20, alignItems: "center", flexWrap: "wrap" }}>
          {inicial && (
            <button
              onClick={() => (confirmar ? onRemover(f.id) : setConfirmar(true))}
              style={{ ...secondaryBtnStyle, flex: "none", color: COLORS.danger, borderColor: confirmar ? COLORS.danger : COLORS.rule }}
            >
              {confirmar ? "Confirmar: apagar" : "Apagar"}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, flex: "none" }}>
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!f.evento.trim()) return setErro("Indica o evento.");
              if (f.inicio && f.fim && f.fim < f.inicio) return setErro("O fim não pode ser antes do início.");
              onGuardar({ ...f, evento: f.evento.trim(), edicao: f.edicao.trim(), envioManual: f.envioManual || "" });
            }}
            style={{ ...primaryBtnStyle, flex: "none", padding: "10px 18px" }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function RegrasEnvio({ tipologias, regras, onGuardar, onFechar }) {
  const [r, setR] = useState({ ...DEFAULT_REGRAS_ENVIO, ...regras });
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div
        className="sheet"
        style={{ width: "min(460px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Regras de envio</h2>
          <button onClick={onFechar} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.55, marginBottom: 14 }}>
          Quantos dias depois do fim do evento sai o inquérito. Com 0, sai no último dia. Se o dia calculado for fim de semana, feriado ou tolerância (24/12, 31/12, Carnaval, São João), sai no último dia do evento.
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {tipologias.map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13.5 }}>{t}</span>
              <input
                type="number"
                min={0}
                max={30}
                value={r[t] ?? 1}
                onChange={(e) => setR((x) => ({ ...x, [t]: Math.max(0, Math.round(Number(e.target.value || 0))) }))}
                style={{ ...inputStyle, width: 80, textAlign: "center" }}
                aria-label={`Dias depois do fim para ${t}`}
              />
              <span style={{ fontSize: 12.5, color: COLORS.slate, width: 40 }}>dias</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onFechar} style={secondaryBtnStyle}>
            Cancelar
          </button>
          <button
            onClick={() => {
              onGuardar(r);
              onFechar();
            }}
            style={primaryBtnStyle}
          >
            Guardar regras
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportarCronograma({ existentes, onImportar, onFechar, notificar }) {
  const [res, setRes] = useState(null);
  const [erro, setErro] = useState("");
  const [aLer, setALer] = useState(false);

  const carregar = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setALer(true);
    setErro("");
    try {
      const linhas = /\.xlsx?$/i.test(f.name) ? await lerExcelInq(f) : lerCSVInq(await f.text());
      const r = lerCronograma(linhas);
      if (!r.itens.length) throw new Error("não encontrei linhas com evento");
      setRes(r);
    } catch (err) {
      setErro(`Não consegui ler o cronograma: ${err?.message || err}.`);
    } finally {
      setALer(false);
    }
  };
  const epocaRes = res && (res.epoca || res.itens[0]?.epoca);
  const jaHa = res ? existentes.filter((p) => p.epoca === epocaRes).length : 0;

  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div
        className="sheet"
        style={{ width: "min(560px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px 22px 24px", border: `1px solid ${COLORS.rule}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: COLORS.navy }}>Importar cronograma</h2>
          <button onClick={onFechar} style={iconBtnStyle}>
            <X size={18} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.55, marginBottom: 14 }}>
          Usa o Excel do cronograma anual (colunas Evento, Edição / Local, Tipologia, Público, Início, Fim, Responsável, Estado…). As linhas de mês são ignoradas e a data de envio é recalculada pelas regras da app.
        </div>
        <label style={{ ...primaryBtnStyle, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "10px 16px", width: "auto" }}>
          <Plus size={15} /> {aLer ? "A ler…" : "Escolher ficheiro Excel"}
          <input type="file" accept=".xlsx,.csv" onChange={carregar} style={{ display: "none" }} />
        </label>
        {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.danger }}>{erro}</div>}
        {res && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>
              {res.itens.length} envios encontrados · Época {epocaRes}
            </div>
            <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 4 }}>
              {[...new Set(res.itens.map((i) => i.evento))].join(" · ")}
            </div>
            {jaHa > 0 && <div style={{ fontSize: 12.5, color: COLORS.warn, marginTop: 10 }}>Já tens {jaHa} envios planeados nesta época.</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              {jaHa > 0 && (
                <button
                  onClick={() => {
                    onImportar(res.itens, epocaRes, true);
                    notificar(`Cronograma da época ${epocaRes} substituído: ${res.itens.length} envios.`);
                    onFechar();
                  }}
                  style={{ ...secondaryBtnStyle, flex: "none" }}
                >
                  Substituir os da época
                </button>
              )}
              <button
                onClick={() => {
                  onImportar(res.itens, epocaRes, false);
                  notificar(`${res.itens.length} envios importados para a época ${epocaRes}.`);
                  onFechar();
                }}
                style={{ ...primaryBtnStyle, flex: "none", padding: "10px 18px" }}
              >
                {jaHa > 0 ? "Acrescentar" : "Importar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaneamentoInqueritos({ plano, regras, tipologias, tiposEvento, inqueritos, onGuardarItem, onRemoverItem, onImportarPlano, onGuardarRegras, onImportarResultados, onAbrirInquerito, onGerirLista, notificar }) {
  const epocas = [...new Set([epocaDe(hojeISO()), ...plano.map((p) => p.epoca).filter(Boolean)])].sort().reverse();
  const comDados = epocas.find((e) => plano.some((p) => p.epoca === e));
  const [epoca, setEpoca] = useState(plano.some((p) => p.epoca === epocaDe(hojeISO())) ? epocaDe(hojeISO()) : comDados || epocaDe(hojeISO()));
  const [fEstado, setFEstado] = useState("todos");
  const [fPublico, setFPublico] = useState("todos");
  const [editar, setEditar] = useState(null);
  const [verRegras, setVerRegras] = useState(false);
  const [importar, setImportar] = useState(false);

  const hoje = hojeISO();
  const daEpoca = plano
    .filter((p) => p.epoca === epoca)
    .map((p) => ({ ...p, envio: dataEnvioPlano(p, regras) }))
    .sort((a, b) => String(a.envio || a.inicio || "9999").localeCompare(String(b.envio || b.inicio || "9999")));

  // Mesmo público com outro envio a menos de 21 dias: risco de cansar quem responde.
  const proximos = (p) =>
    p.envio
      ? daEpoca.filter((o) => o.id !== p.id && o.publico && o.publico === p.publico && o.envio && Math.abs(dataLocal(o.envio) - dataLocal(p.envio)) / 86400000 <= JANELA_ALERTA_DIAS)
      : [];

  const lista = daEpoca
    .filter((p) => fEstado === "todos" || (fEstado === "Atrasado" ? situacaoPlano(p, p.envio).label === "Atrasado" : p.estado === fEstado))
    .filter((p) => fPublico === "todos" || p.publico === fPublico);

  // Envios futuros do mesmo público a menos de 21 dias uns dos outros, agrupados.
  const gruposSeguidos = [];
  [...new Set(daEpoca.map((p) => p.publico).filter(Boolean))].forEach((pub) => {
    const fut = daEpoca.filter((p) => p.publico === pub && p.envio && p.envio >= hoje && p.estado === "Por enviar").sort((a, b) => a.envio.localeCompare(b.envio));
    let atual = [];
    fut.forEach((p) => {
      if (atual.length && (dataLocal(p.envio) - dataLocal(atual[atual.length - 1].envio)) / 86400000 > JANELA_ALERTA_DIAS) {
        if (atual.length > 1) gruposSeguidos.push(atual);
        atual = [];
      }
      atual.push(p);
    });
    if (atual.length > 1) gruposSeguidos.push(atual);
  });
  gruposSeguidos.sort((a, b) => a[0].envio.localeCompare(b[0].envio));

  const enviados = daEpoca.filter((p) => p.estado !== "Por enviar").length;
  const futuro = daEpoca.filter((p) => p.envio && p.envio >= hoje && p.estado === "Por enviar");
  const prox = futuro[0];
  const comResp = daEpoca.filter((p) => p.respostas !== null && p.respostas !== undefined && p.inscritos);
  const taxa = comResp.length ? Math.round((comResp.reduce((n, p) => n + p.respostas, 0) / comResp.reduce((n, p) => n + p.inscritos, 0)) * 100) : null;
  const atrasados = daEpoca.filter((p) => situacaoPlano(p, p.envio).label === "Atrasado");
  const em14 = futuro.filter((p) => (dataLocal(p.envio) - dataLocal(hoje)) / 86400000 <= 14);
  const porFechar = daEpoca.filter((p) => p.estado === "Enviado" && p.envio && (dataLocal(hoje) - dataLocal(p.envio)) / 86400000 > 14);
  const semResultados = daEpoca.filter((p) => p.estado === "Fechado" && !p.inqueritoId);

  // Agrupa por mês de envio (ou de início, se ainda não houver data).
  const grupos = [];
  lista.forEach((p) => {
    const ref = p.envio || p.inicio;
    const chave = ref ? ref.slice(0, 7) : "sem-data";
    let g = grupos.find((x) => x.chave === chave);
    if (!g) {
      g = { chave, titulo: ref ? `${MESES_PLANO[Number(ref.slice(5, 7)) - 1]} ${ref.slice(0, 4)}` : "Data a definir", itens: [] };
      grupos.push(g);
    }
    g.itens.push(p);
  });
  grupos.sort((a, b) => (a.chave === "sem-data" ? 1 : b.chave === "sem-data" ? -1 : a.chave.localeCompare(b.chave)));

  // Ocupação por mês, para a faixa do topo.
  const meses = [...new Set(daEpoca.map((p) => (p.envio || p.inicio || "").slice(0, 7)).filter(Boolean))].sort();

  const publicos = [...new Set(daEpoca.map((p) => p.publico).filter(Boolean))].sort();
  const selectFiltro = { ...inputStyle, width: "auto", minWidth: 150, padding: "8px 10px" };
  const numeroDe = (p) => daEpoca.findIndex((x) => x.id === p.id) + 1;
  const dataCurta = (iso) => (iso ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(dataLocal(iso)) : "—");

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select value={epoca} onChange={(e) => setEpoca(e.target.value)} style={selectFiltro} aria-label="Época">
          {epocas.map((e) => (
            <option key={e} value={e}>
              Época {e}
            </option>
          ))}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={selectFiltro} aria-label="Estado">
          <option value="todos">Todos os estados</option>
          {["Atrasado", ...Object.keys(ESTADOS_PLANO)].map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select value={fPublico} onChange={(e) => setFPublico(e.target.value)} style={selectFiltro} aria-label="Público">
          <option value="todos">Todos os públicos</option>
          {publicos.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setVerRegras(true)} style={{ ...secondaryBtnStyle, flex: "none", padding: "8px 12px" }}>
          Regras de envio
        </button>
        <button onClick={() => setImportar(true)} style={{ ...secondaryBtnStyle, flex: "none", padding: "8px 12px" }}>
          Importar cronograma
        </button>
        <button
          onClick={() => setEditar("novo")}
          className="press"
          style={{ display: "flex", alignItems: "center", gap: 7, background: COLORS.navy, color: COLORS.onAccent, border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
        >
          <Plus size={15} /> Novo envio
        </button>
      </div>

      {daEpoca.length === 0 ? (
        <SemDados
          icon={ClipboardList}
          titulo={`Sem cronograma para ${epoca}`}
          texto="Importa o Excel do cronograma anual ou acrescenta os envios um a um."
          acao="Importar cronograma"
          onAcao={() => setImportar(true)}
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
            <StatCard label="Inquéritos na época" value={daEpoca.length} subtitle={`${daEpoca.filter((p) => p.estado === "Analisado").length} já analisados`} />
            <StatCard label="Já enviados" value={enviados} subtitle={`${pct(enviados, daEpoca.length)}% do plano`} anel={pct(enviados, daEpoca.length)} color={COLORS.progress} />
            <StatCard
              label="Próximo envio"
              value={prox ? dataCurta(prox.envio) : "—"}
              subtitle={prox ? `${prox.evento} · ${prox.edicao}` : "Nada por enviar"}
              color={COLORS.navy}
            />
            <StatCard label="Taxa de resposta global" value={taxa ?? "—"} subtitle={taxa !== null ? `% · ${comResp.length} inquéritos com respostas` : "Preenche inscritos e respostas"} anel={taxa} color={COLORS.ok} />
          </div>

          <Observacoes
            itens={[
              ...atrasados.map((p) => ({ nivel: "alarme", titulo: `${p.evento} · ${p.edicao}: envio atrasado`, texto: `Devia ter saído a ${fmt(dataLocal(p.envio))} e continua por enviar.` })),
              ...em14.map((p) => ({ nivel: "atencao", titulo: `Enviar a ${fmt(dataLocal(p.envio))}: ${p.evento} · ${p.edicao}`, texto: `${p.publico || "Público por definir"}${p.responsavel ? ` · responsável ${p.responsavel}` : " · sem responsável atribuído"}.` })),
              ...porFechar.map((p) => ({ nivel: "atencao", titulo: `${p.evento} · ${p.edicao} enviado há mais de 2 semanas`, texto: "Fecha o inquérito e importa os resultados para entrarem na análise." })),
              ...semResultados.map((p) => ({ nivel: "atencao", titulo: `${p.evento} · ${p.edicao} fechado sem resultados importados`, texto: "Usa “Importar resultados” na linha do cronograma." })),
              ...gruposSeguidos.slice(0, 4).map((g) => ({
                nivel: "atencao",
                titulo: `${g[0].publico}: ${g.length} envios com menos de 3 semanas entre si`,
                texto: `${g.map((o) => `${o.evento} · ${o.edicao} (${fmt(dataLocal(o.envio))})`).join(", ")}. Confirma se as mesmas famílias vão receber mais de um inquérito.`,
              })),
            ]}
          />

          {/* Faixa de meses: quantos envios em cada mês e em que estado. */}
          <div style={{ ...panelStyle, marginBottom: 16, padding: "14px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${meses.length}, minmax(64px, 1fr))`, gap: 6, overflowX: "auto" }}>
              {meses.map((mm) => {
                const doMes = daEpoca.filter((p) => (p.envio || p.inicio || "").slice(0, 7) === mm);
                const atual = mm === hoje.slice(0, 7);
                return (
                  <div key={mm} style={{ padding: "8px 8px 10px", borderRadius: 8, background: atual ? COLORS.navyWash : COLORS.paperSunken, border: `1px solid ${atual ? COLORS.navy : "transparent"}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: atual ? COLORS.navy : COLORS.ink2 }}>
                      {MESES_PLANO[Number(mm.slice(5)) - 1].slice(0, 3)} {mm.slice(2, 4)}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, margin: "2px 0 6px", fontVariantNumeric: "tabular-nums" }}>{doMes.length}</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {doMes.map((p) => {
                        const s = situacaoPlano(p, p.envio);
                        return <span key={p.id} title={`${p.evento} · ${p.edicao} — ${s.label}`} style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: COLORS.ink2, marginTop: 10 }}>
              {[["Por enviar", COLORS.slate], ["Enviado", COLORS.progress], ["Fechado", COLORS.warn], ["Analisado", COLORS.ok], ["Atrasado", COLORS.danger]].map(([l, c]) => (
                <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: c }} />
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* Cronograma agrupado por mês. */}
          <div style={{ ...panelStyle, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 980 }}>
                <thead>
                  <tr style={{ background: COLORS.paperSunken }}>
                    {["Nº", "Evento", "Público", "Datas", "Envio", "Resp.", "Estado", "Inscritos", "Respostas", "Taxa", ""].map((c, i) => (
                      <th key={i} style={{ textAlign: "left", fontSize: 11, fontWeight: 600, color: COLORS.slate, padding: "9px 10px", whiteSpace: "nowrap" }}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <React.Fragment key={g.chave}>
                      <tr>
                        <td colSpan={11} style={{ padding: "12px 10px 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.navy, borderTop: `1px solid ${COLORS.rule}` }}>
                          {g.titulo}
                        </td>
                      </tr>
                      {g.itens.map((p) => {
                        const s = situacaoPlano(p, p.envio);
                        const alerta = proximos(p);
                        const tx = p.inscritos && p.respostas !== null && p.respostas !== undefined ? Math.round((p.respostas / p.inscritos) * 100) : null;
                        const ligado = p.inqueritoId && inqueritos.find((i) => i.id === p.inqueritoId);
                        return (
                          <tr key={p.id} className="rowHover" style={{ borderTop: `1px solid ${COLORS.ruleSoft}` }}>
                            <td style={{ padding: "9px 10px", color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>{numeroDe(p)}</td>
                            <td style={{ padding: "9px 10px", minWidth: 200 }}>
                              <button onClick={() => setEditar(p)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: COLORS.ink, font: "inherit" }}>
                                <div style={{ fontWeight: 600 }}>{p.evento}</div>
                                <div style={{ fontSize: 12, color: COLORS.slate }}>
                                  {p.edicao}
                                  {p.tipologia ? ` · ${p.tipologia}` : ""}
                                </div>
                              </button>
                              {p.obs && <div style={{ fontSize: 11.5, color: COLORS.ink2, marginTop: 3, maxWidth: 280 }}>{p.obs}</div>}
                            </td>
                            <td style={{ padding: "9px 10px", fontSize: 12.5 }}>{p.publico || "—"}</td>
                            <td style={{ padding: "9px 10px", fontSize: 12.5, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                              {p.inicio ? (p.fim && p.fim !== p.inicio ? `${dataCurta(p.inicio)} – ${dataCurta(p.fim)}` : dataCurta(p.inicio)) : "a definir"}
                            </td>
                            <td style={{ padding: "9px 10px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                              <strong style={{ fontWeight: 600 }}>{p.envio ? dataCurta(p.envio) : "a definir"}</strong>
                              {p.envioManual && <span title="Data definida à mão" style={{ fontSize: 10.5, color: COLORS.slate }}> · manual</span>}
                              {alerta.length > 0 && (
                                <div title={alerta.map((o) => `${o.evento} · ${o.edicao} (${fmt(dataLocal(o.envio))})`).join("\n")} style={{ fontSize: 11, color: COLORS.warn, fontWeight: 600, marginTop: 2 }}>
                                  ⚠ {alerta.length} próx.
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "9px 10px", fontSize: 12.5 }}>{p.responsavel || <span style={{ color: COLORS.slate }}>—</span>}</td>
                            <td style={{ padding: "9px 10px" }}>
                              <select
                                value={p.estado}
                                onChange={(e) => onGuardarItem({ ...p, estado: e.target.value, envio: undefined })}
                                aria-label={`Estado de ${p.evento} ${p.edicao}`}
                                style={{ border: `1.5px solid ${s.color}`, background: s.bg, color: s.color, borderRadius: 6, padding: "4px 6px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                              >
                                {Object.keys(ESTADOS_PLANO).map((e) => (
                                  <option key={e} value={e}>
                                    {e}
                                  </option>
                                ))}
                              </select>
                              {s.label === "Atrasado" && <div style={{ fontSize: 11, color: COLORS.danger, fontWeight: 600, marginTop: 3 }}>Atrasado</div>}
                            </td>
                            <td style={{ padding: "9px 10px", fontVariantNumeric: "tabular-nums" }}>{p.inscritos ?? "—"}</td>
                            <td style={{ padding: "9px 10px", fontVariantNumeric: "tabular-nums" }}>{p.respostas ?? "—"}</td>
                            <td style={{ padding: "9px 10px", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: tx === null ? COLORS.slate : tx < 20 ? COLORS.danger : tx < 35 ? COLORS.warn : COLORS.ok }}>{tx === null ? "—" : `${tx}%`}</td>
                            <td style={{ padding: "9px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
                              {ligado ? (
                                <button onClick={() => onAbrirInquerito(ligado.id)} style={{ ...linkBtnStyle, marginTop: 0 }}>
                                  Ver resultados
                                </button>
                              ) : p.estado !== "Por enviar" ? (
                                <button onClick={() => onImportarResultados(p)} style={{ ...linkBtnStyle, marginTop: 0 }}>
                                  Importar resultados
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editar && (
        <PlanoForm
          inicial={editar === "novo" ? null : editar}
          epoca={epoca}
          tipologias={tipologias}
          tiposEvento={tiposEvento}
          eventosUsados={[...new Set(plano.map((p) => p.evento))]}
          publicosUsados={[...new Set(plano.map((p) => p.publico).filter(Boolean))]}
          regras={regras}
          onGerirLista={onGerirLista}
          onFechar={() => setEditar(null)}
          onGuardar={(item) => {
            const { envio, ...limpo } = item;
            onGuardarItem(limpo);
            setEditar(null);
            notificar(editar === "novo" ? "Envio acrescentado ao cronograma." : "Envio atualizado.");
          }}
          onRemover={(id) => {
            onRemoverItem(id);
            setEditar(null);
            notificar("Envio apagado do cronograma.", "aviso");
          }}
        />
      )}
      {verRegras && <RegrasEnvio tipologias={tipologias} regras={regras} onGuardar={onGuardarRegras} onFechar={() => setVerRegras(false)} />}
      {importar && <ImportarCronograma existentes={plano} onImportar={onImportarPlano} onFechar={() => setImportar(false)} notificar={notificar} />}
    </div>
  );
}

// ---------- Página ----------
export function InqueritosPage({ inqueritos, tiposEvento, dimensoes, onGuardar, onAtualizar, onRemover, onGerirLista, notificar, plano, regrasEnvio, tipologias, onGuardarItemPlano, onRemoverItemPlano, onImportarPlano, onGuardarRegras }) {
  const [view, setView] = useState("planeamento");
  const [importar, setImportar] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [fTipo, setFTipo] = useState("todos");

  const ordenados = [...inqueritos]
    .filter((i) => fTipo === "todos" || i.tipoEvento === fTipo)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const atual = aberto ? inqueritos.find((i) => i.id === aberto) : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "inline-flex", gap: 3, background: COLORS.segTrack, borderRadius: 9, padding: 2 }}>
          {[
            ["planeamento", "Planeamento"],
            ["registo", "Resultados"],
            ["analise", "Análise"],
          ].map(([key, label]) => (
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
            </button>
          ))}
        </div>
        {view !== "planeamento" && <button
          onClick={() => setImportar(true)}
          className="press"
          style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.navy, color: COLORS.onAccent, border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
        >
          <Plus size={16} /> Importar inquérito
        </button>}
      </div>

      <div key={view} className="pageIn">
        {view === "planeamento" ? (
          <PlaneamentoInqueritos
            plano={plano}
            regras={regrasEnvio}
            tipologias={tipologias}
            tiposEvento={tiposEvento}
            inqueritos={inqueritos}
            onGuardarItem={onGuardarItemPlano}
            onRemoverItem={onRemoverItemPlano}
            onImportarPlano={onImportarPlano}
            onGuardarRegras={onGuardarRegras}
            onImportarResultados={(p) => setImportar(p)}
            onAbrirInquerito={(id) => setAberto(id)}
            onGerirLista={onGerirLista}
            notificar={notificar}
          />
        ) : view === "analise" ? (
          <InqueritosAnalise inqueritos={inqueritos} tiposEvento={tiposEvento} />
        ) : inqueritos.length === 0 ? (
          <SemDados
            icon={MessageSquareText}
            titulo="Ainda sem inquéritos"
            texto="Exporta as respostas do Google Forms ou Microsoft Forms e importa-as aqui. Só ficam guardadas as contagens."
            acao="Importar inquérito"
            onAcao={() => setImportar(true)}
          />
        ) : (
          <>
            <Filtros>
              <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 180, padding: "8px 10px" }}>
                <option value="todos">Todos os eventos</option>
                {tiposEvento.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Filtros>
            <div style={{ display: "grid", gap: 8 }}>
              {ordenados.map((i) => {
                const s = satisfacaoDe(i.perguntas || []);
                const n = npsDe([i]);
                return (
                  <div
                    key={i.id}
                    onClick={() => setAberto(i.id)}
                    className="liftable"
                    style={{ ...panelStyle, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", cursor: "pointer" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{i.edicao}</div>
                      <div style={{ fontSize: 12, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
                        {i.tipoEvento} · {fmt(new Date(i.data + "T00:00:00"))} · {i.respostas} respostas
                        {i.enviados ? ` · ${Math.round((i.respostas / i.enviados) * 100)}% de resposta` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {n && <Tag label={`NPS ${n.valor}`} color={n.valor >= 30 ? COLORS.ok : n.valor >= 0 ? COLORS.warn : COLORS.danger} bg={n.valor >= 30 ? COLORS.okBg : n.valor >= 0 ? COLORS.warnBg : COLORS.dangerBg} />}
                      {s.pct !== null && (
                        <Tag
                          label={`${s.pct}% satisfeitos`}
                          color={corSatisfacao(s.pct)}
                          bg={s.pct >= 80 ? COLORS.okBg : s.pct >= 70 ? COLORS.warnBg : COLORS.dangerBg}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {importar && (
        <ImportarInquerito
          tiposEvento={tiposEvento}
          dimensoes={dimensoes}
          existentes={inqueritos}
          onGuardar={onGuardar}
          plano={plano}
          planoInicial={importar && importar !== true ? importar : null}
          onFechar={() => setImportar(false)}
          onGerirLista={onGerirLista}
          notificar={notificar}
        />
      )}
      {atual && (
        <InqueritoDetalhe
          key={atual.id}
          inquerito={atual}
          onFechar={() => setAberto(null)}
          onAtualizar={onAtualizar}
          onRemover={(id) => {
            onRemover(id);
            setAberto(null);
          }}
        />
      )}
    </div>
  );
}
