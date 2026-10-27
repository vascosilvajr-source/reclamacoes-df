// Partilhado entre páginas mas não preciso para abrir a app (gráficos, importações, fichas):
// só é descarregado com a primeira página que o usa.
import { useState, useEffect, useRef } from "react";
import { codigoComVersao } from "./sgq";
import { imprimirBalanco } from "./foto";
import { LOGO_BRANCO } from "./imagens";
import { X, Check, AlertTriangle, Inbox, Printer } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ScatterChart, Scatter, ZAxis, ReferenceLine, LabelList } from "recharts";
import { CAUSAS_ATUAIS, COLORS, TEMA_ESCURO, Vazio, colorForLabel, epocaDe, iconBtnStyle, inputStyle, labelStyle, linkBtnStyle, nomeCausa, normChave, panelStyle, panelTitle, resumoContagens, secondaryBtnStyle } from "./nucleo.jsx";

// ---------- Filtro de épocas (uma, várias ou todas) ----------
// Valor: lista de épocas escolhidas; lista vazia = todas as épocas.
export const naSelecao = (sel, ep) => !sel || !sel.length || sel.includes(ep);
export const epocaAtualHoje = () => epocaDe(new Date().toISOString().slice(0, 10));
// Seleção inicial: a época atual, se tiver dados; senão a mais recente; senão todas.
export function selecaoInicial(epocas) {
  const at = epocaAtualHoje();
  if (epocas.includes(at)) return [at];
  const ord = [...epocas].sort().reverse();
  return ord.length ? [ord[0]] : [];
}
export function textoSelecao(sel) {
  if (!sel || !sel.length) return "Todas as épocas";
  if (sel.length === 1) return `Época ${sel[0]}`;
  const ord = [...sel].sort().reverse();
  return ord.length <= 3 ? ord.join(" vs ") : `${ord.length} épocas`;
}
export function FiltroEpocas({ epocas, valor, onChange, largura, compacto }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => ref.current && !ref.current.contains(e.target) && setAberto(false);
    const esc = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  const lista = [...new Set(epocas.filter(Boolean))].sort().reverse();
  const sel = (valor || []).filter((e) => lista.includes(e));
  const alterna = (ep) => onChange(sel.includes(ep) ? sel.filter((x) => x !== ep) : [...sel, ep].sort().reverse());
  const atalho = (l) => onChange(l.filter((e) => lista.includes(e)));
  const at = epocaAtualHoje();
  const btn = { border: `1px solid ${COLORS.rule}`, background: COLORS.paperRaised, color: COLORS.ink, borderRadius: 6, padding: "3px 8px", fontSize: 12, cursor: "pointer" };
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="true"
        aria-expanded={aberto}
        style={{ ...inputStyle, width: largura || "auto", minWidth: compacto ? 0 : 170, padding: compacto ? "6px 10px" : "8px 10px", fontSize: compacto ? 13 : undefined, textAlign: "left", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: sel.length > 1 ? 600 : undefined }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{textoSelecao(sel)}</span>
        <span aria-hidden="true" style={{ fontSize: 10, color: COLORS.slate }}>▾</span>
      </button>
      {aberto && (
        <div className="pageIn" style={{ position: "absolute", zIndex: 40, top: "calc(100% + 4px)", left: 0, minWidth: 230, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 10, boxShadow: COLORS.lift || "0 10px 30px -10px rgba(0,0,0,0.3)", padding: 10 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            <button type="button" onClick={() => atalho([])} style={{ ...btn, fontWeight: sel.length ? 400 : 600 }}>
              Todas
            </button>
            {lista.includes(at) && (
              <button type="button" onClick={() => atalho([at])} style={btn}>
                Atual
              </button>
            )}
            {lista.length > 1 && (
              <button type="button" onClick={() => atalho(lista.slice(0, 2))} style={btn}>
                Últimas 2
              </button>
            )}
            {lista.length > 2 && (
              <button type="button" onClick={() => atalho(lista.slice(0, 3))} style={btn}>
                Últimas 3
              </button>
            )}
          </div>
          <div style={{ display: "grid", gap: 2, maxHeight: 240, overflowY: "auto" }}>
            {lista.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate, padding: 4 }}>Sem épocas com dados.</div>}
            {lista.map((ep) => (
              <label key={ep} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 6px", borderRadius: 6, cursor: "pointer", background: sel.includes(ep) ? COLORS.paperSunken : "transparent" }}>
                <input type="checkbox" checked={sel.includes(ep)} onChange={() => alterna(ep)} />
                {ep}
                {ep === at && <span style={{ fontSize: 11, color: COLORS.slate }}>atual</span>}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 8, lineHeight: 1.4 }}>Escolhe uma ou várias. Com duas ou mais, aparece a comparação entre elas.</div>
        </div>
      )}
    </div>
  );
}

// Lista de épocas para escolher: a atual e as anteriores, mais a seguinte.
export function epocasDisponiveis(extra) {
  const hoje = new Date();
  const anoBase = hoje.getMonth() >= 7 ? hoje.getFullYear() : hoje.getFullYear() - 1;
  const lista = [];
  for (let a = anoBase + 1; a >= anoBase - 8; a--) lista.push(`${a}/${String(a + 1).slice(2)}`);
  (Array.isArray(extra) ? extra : [extra]).forEach((e) => {
    if (e && !lista.includes(e)) lista.push(e);
  });
  return lista.sort().reverse();
}

export const CLASSIFICATION_META = {
  NCM: { label: "Não conformidade maior", color: COLORS.danger, bg: COLORS.dangerBg },
  NC: { label: "Não conformidade", color: COLORS.warn, bg: COLORS.warnBg },
  OM: { label: "Oportunidade de Melhoria", color: COLORS.progress, bg: COLORS.progressBg },
  AS: { label: "Área Sensível", color: COLORS.purple, bg: COLORS.purpleBg },
};

// Mês (aaaa-mm) a partir de uma data ISO, para filtros e agregações.
export function mesDeData(d) {
  return d ? String(d).slice(0, 7) : "";
}

export const PERSON_TYPE_META = {
  familia: { label: "Encarregado de educação" },
  elemento_df: { label: "Elemento Dragon Force" },
  atleta: { label: "Atleta(s)" },
};

export const DF_STAGE_META = {
  ocorrencia: { label: "Ocorrência registada", color: COLORS.slate, bg: COLORS.doneBg },
  inquerito: { label: "Inquérito disciplinar aberto", color: COLORS.warn, bg: COLORS.warnBg },
  proposta: { label: "Sanção proposta (para decisão)", color: COLORS.progress, bg: COLORS.progressBg },
  decisao_suspensao: { label: "Decisão: Suspensão", color: COLORS.danger, bg: COLORS.dangerBg },
  decisao_expulsao: { label: "Decisão: Expulsão do projeto", color: COLORS.danger, bg: COLORS.dangerBg },
  decisao_arquivado: { label: "Decisão: Arquivado / sem sanção", color: COLORS.ok, bg: COLORS.okBg },
};

// Rótulos de eixo que nunca se atropelam.
// Eixo vertical com nomes: corta com "…" quando não cabe e mostra o nome completo ao passar o rato.
export function TickNome({ x, y, payload, largura = 130, tamanho = 12, cor }) {
  const t = String(payload && payload.value != null ? payload.value : "");
  const max = Math.max(4, Math.floor((largura - 12) / (tamanho * 0.6)));
  const curto = t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{t}</title>
      <text x={-6} y={0} dy={4} textAnchor="end" fontSize={tamanho} fill={cor || COLORS.ink}>
        {curto}
      </text>
    </g>
  );
}
// Eixo horizontal com nomes: parte em até duas linhas pelo espaço de cada coluna; se não couber, corta com "…".
export function TickEixoX({ x, y, payload, width, visibleTicksCount, index = 0, tamanho = 11, cor }) {
  const t = String(payload && payload.value != null ? payload.value : "");
  const banda = width && visibleTicksCount ? width / visibleTicksCount : 80;
  // Colunas muito estreitas: mostra só um nome em cada N para não se encavalitarem (o nome completo fica no tooltip).
  const passo = Math.max(1, Math.ceil(44 / Math.max(1, banda)));
  if (index % passo !== 0) return null;
  const porLinha = Math.max(3, Math.floor((banda * passo - 8) / (tamanho * 0.6)));
  const linhas = [];
  let atual = "";
  t.split(/\s+/).forEach((w) => {
    const prox = atual ? `${atual} ${w}` : w;
    if (prox.length <= porLinha) atual = prox;
    else {
      if (atual) linhas.push(atual);
      atual = w;
    }
  });
  if (atual) linhas.push(atual);
  let mostrar = linhas.slice(0, 2).map((l) => (l.length > porLinha ? `${l.slice(0, porLinha - 1)}…` : l));
  if (linhas.length > 2) mostrar[1] = `${mostrar[1].slice(0, Math.max(1, porLinha - 1))}…`.replace(/……$/, "…");
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{t}</title>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={tamanho} fill={cor || COLORS.slate}>
        {mostrar.map((l, i) => (
          <tspan key={i} x={0} dy={i ? tamanho + 2 : 12}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
}

// Tooltip dos gráficos, com o desenho da app em vez do padrão do Recharts.
export function DicaGrafico({ active, payload, label, sufixo }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: COLORS.paperRaised,
        border: `1px solid ${COLORS.rule}`,
        borderRadius: 10,
        padding: "9px 12px",
        boxShadow: COLORS.lift,
        fontSize: 12.5,
      }}
    >
      {label !== undefined && <div style={{ fontWeight: 600, marginBottom: 6, color: COLORS.ink }}>{label}</div>}
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: i ? 3 : 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill, flex: "none" }} />
            <span style={{ color: COLORS.ink2 }}>{p.name}</span>
            <strong style={{ marginLeft: "auto", color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}>
              {typeof p.value === "number" ? Math.abs(p.value).toLocaleString("pt-PT") : p.value}
              {sufixo || ""}
            </strong>
          </div>
        ))}
    </div>
  );
}

// ---------- Observações automáticas ----------
// Olha para os dados e escreve em linguagem normal o que é digno de nota.
// Só diz coisas que passam um limiar, para não encher o ecrã de ruído; e
// distingue alarme (exige ação), atenção (vale vigiar) e bom (confirma).
export const NIVEL_OBS = {
  alarme: { cor: () => COLORS.danger, fundo: () => COLORS.dangerBg, rotulo: "Alarme" },
  atencao: { cor: () => COLORS.warn, fundo: () => COLORS.warnBg, rotulo: "Atenção" },
  bom: { cor: () => COLORS.ok, fundo: () => COLORS.okBg, rotulo: "Positivo" },
};

export function Observacoes({ itens }) {
  const [expandido, setExpandido] = useState(false);
  if (!itens || itens.length === 0) return null;

  const ordem = { alarme: 0, atencao: 1, bom: 2 };
  const ordenados = [...itens].sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  const visiveis = expandido ? ordenados : ordenados.slice(0, 4);
  const alarmes = ordenados.filter((o) => o.nivel === "alarme").length;

  return (
    <div style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={panelTitle}>
          O que salta à vista
          {alarmes > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: COLORS.danger }}>
              {alarmes} a exigir ação
            </span>
          )}
        </div>
        {ordenados.length > 4 && (
          <button onClick={() => setExpandido((v) => !v)} style={{ ...linkBtnStyle, marginTop: 0 }}>
            {expandido ? "Mostrar menos" : `Ver todas (${ordenados.length})`}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {visiveis.map((o, i) => {
          const meta = NIVEL_OBS[o.nivel] || NIVEL_OBS.atencao;
          const cor = meta.cor();
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "10px 12px",
                background: COLORS.paperSunken,
                borderLeft: `3px solid ${cor}`,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: meta.fundo(),
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                  marginTop: 1,
                }}
              >
                {o.nivel === "bom" ? <Check size={12} color={cor} /> : <AlertTriangle size={12} color={cor} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{o.titulo}</div>
                <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5 }}>{o.texto}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Observações sobre reclamações.
export function observacoesReclamacoes(lista) {
  const obs = [];
  if (lista.length === 0) return obs;

  const atrasadas = lista.filter((e) => e.derivedStatus === "atrasado");
  if (atrasadas.length > 0) {
    const maisAntiga = [...atrasadas].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
    const dias = Math.round((Date.now() - new Date(maisAntiga.deadline)) / 86400000);
    obs.push({
      nivel: "alarme",
      titulo: `${atrasadas.length} reclamação(ões) fora do prazo legal`,
      texto: `A mais antiga é a nº ${String(maisAntiga.entryNumber).padStart(4, "0")} (${maisAntiga.school || "sem escola"}), com ${dias} dia(s) de atraso.`,
    });
  }

  // Escola com peso desproporcionado face à média.
  const porEscola = {};
  lista.forEach((e) => {
    if (e.school) porEscola[e.school] = (porEscola[e.school] || 0) + 1;
  });
  const escolas = Object.entries(porEscola).sort((a, b) => b[1] - a[1]);
  if (escolas.length >= 3) {
    const media = lista.length / escolas.length;
    const [nome, n] = escolas[0];
    if (n >= media * 1.8 && n >= 3) {
      obs.push({
        nivel: "atencao",
        titulo: `${nome} concentra ${Math.round((n / lista.length) * 100)}% das reclamações`,
        texto: `São ${n} registos, contra uma média de ${media.toFixed(1)} por escola. Vale a pena ver se há uma causa comum.`,
      });
    }
  }

  // Tema recorrente.
  const porTema = {};
  lista.forEach((e) => {
    if (e.tema) porTema[e.tema] = (porTema[e.tema] || 0) + 1;
  });
  const temas = Object.entries(porTema).sort((a, b) => b[1] - a[1]);
  if (temas.length && temas[0][1] >= 3) {
    obs.push({
      nivel: "atencao",
      titulo: `"${temas[0][0]}" repete-se ${temas[0][1]} vezes`,
      texto: "Um tema que reaparece costuma indicar uma causa de fundo, não casos isolados.",
    });
  }

  // Gravidade alta em aberto.
  const altasAbertas = lista.filter((e) => e.severity === "alta" && e.derivedStatus !== "concluido");
  if (altasAbertas.length > 0) {
    obs.push({
      nivel: "alarme",
      titulo: `${altasAbertas.length} reclamação(ões) de gravidade alta ainda em aberto`,
      texto: `Em ${[...new Set(altasAbertas.map((e) => e.school).filter(Boolean))].join(", ") || "escola não indicada"}.`,
    });
  }

  // Eficácia das respostas.
  const comEficacia = lista.filter((e) => e.eficacia);
  const ineficazes = comEficacia.filter((e) => e.eficacia === "ineficaz");
  if (comEficacia.length >= 4 && ineficazes.length / comEficacia.length > 0.25) {
    obs.push({
      nivel: "alarme",
      titulo: `${Math.round((ineficazes.length / comEficacia.length) * 100)}% das respostas foram classificadas como ineficazes`,
      texto: "Fechar dentro do prazo não basta se a resposta não resolve. Vale revisitar estes casos.",
    });
  }

  // Cumprimento do prazo.
  const resolvidas = lista.filter((e) => e.status === "concluido" && e.resolvedDate);
  if (resolvidas.length >= 5) {
    const dentro = resolvidas.filter((e) => new Date(e.resolvedDate) <= new Date(e.deadline)).length;
    const taxa = Math.round((dentro / resolvidas.length) * 100);
    if (taxa >= 95) {
      obs.push({
        nivel: "bom",
        titulo: `${taxa}% resolvidas dentro do prazo`,
        texto: `${dentro} de ${resolvidas.length} fechadas nos 10 dias úteis.`,
      });
    } else if (taxa < 80) {
      obs.push({
        nivel: "alarme",
        titulo: `Só ${taxa}% foram resolvidas dentro do prazo`,
        texto: `${resolvidas.length - dentro} de ${resolvidas.length} passaram os 10 dias úteis. É um risco legal, não só de serviço.`,
      });
    }
  }

  // Canal predominante.
  const livro = lista.filter((e) => e.canal === "livro").length;
  if (livro >= 2 && livro / lista.length > 0.3) {
    obs.push({
      nivel: "atencao",
      titulo: `${livro} reclamações entraram pelo Livro de Reclamações`,
      texto: "Uma proporção alta pelo livro sugere que os canais internos não estão a resolver antes de escalar.",
    });
  }

  return obs;
}

// Observações sobre auditorias.
export function observacoesAuditorias(constatacoes) {
  const obs = [];
  if (constatacoes.length === 0) return obs;

  const ncm = constatacoes.filter((f) => f.classification === "NCM");
  const ncmAbertas = ncm.filter((f) => !f.resolvida);
  if (ncmAbertas.length > 0) {
    obs.push({
      nivel: "alarme",
      titulo: `${ncmAbertas.length} não conformidade(s) maior(es) sem resolução`,
      texto: `Em ${[...new Set(ncmAbertas.map((f) => f.escola))].join(", ")}. São as que pesam mais na certificação.`,
    });
  }

  const resolvidas = constatacoes.filter((f) => f.resolvida);
  const ineficazes = resolvidas.filter((f) => f.eficacia === "ineficaz");
  if (ineficazes.length > 0) {
    obs.push({
      nivel: "alarme",
      titulo: `${ineficazes.length} ação(ões) corretiva(s) classificada(s) como ineficaz(es)`,
      texto: "Foram dadas como resolvidas mas não produziram efeito. Reabrir é mais barato que repetir na próxima auditoria.",
    });
  }

  // Área com mais problemas.
  const porArea = {};
  constatacoes.forEach((f) => {
    if (f.area) porArea[f.area] = (porArea[f.area] || 0) + 1;
  });
  const areas = Object.entries(porArea).sort((a, b) => b[1] - a[1]);
  if (areas.length >= 2 && areas[0][1] >= 3) {
    obs.push({
      nivel: "atencao",
      titulo: `A área "${areas[0][0]}" acumula ${areas[0][1]} constatações`,
      texto: `É ${Math.round((areas[0][1] / constatacoes.length) * 100)}% do total registado.`,
    });
  }

  // Taxa de resolução.
  if (constatacoes.length >= 5) {
    const taxa = Math.round((resolvidas.length / constatacoes.length) * 100);
    if (taxa < 50) {
      obs.push({
        nivel: "atencao",
        titulo: `Apenas ${taxa}% das constatações estão resolvidas`,
        texto: `${constatacoes.length - resolvidas.length} continuam em aberto.`,
      });
    } else if (taxa >= 90) {
      obs.push({
        nivel: "bom",
        titulo: `${taxa}% das constatações já estão resolvidas`,
        texto: "Ritmo de fecho saudável.",
      });
    }
  }

  // Escola com mais constatações graves.
  const porEscolaGrave = {};
  constatacoes
    .filter((f) => f.classification === "NCM" || f.classification === "NC")
    .forEach((f) => {
      porEscolaGrave[f.escola] = (porEscolaGrave[f.escola] || 0) + 1;
    });
  const graves = Object.entries(porEscolaGrave).sort((a, b) => b[1] - a[1]);
  if (graves.length && graves[0][1] >= 3) {
    obs.push({
      nivel: "atencao",
      titulo: `${graves[0][0]} tem ${graves[0][1]} constatações graves`,
      texto: "Não conformidades maiores e menores somadas. Candidata a auditoria de seguimento.",
    });
  }

  return obs;
}

// ---------- Quadrant matrix (shared by audits and enrolment analysis) ----------
export function QuadrantMatrix({ subjects, metrics, defaultX, defaultY, label, tamanho, nota, semCaixa }) {
  const keys = Object.keys(metrics);
  const [mx, setMx] = useState(defaultX && metrics[defaultX] ? defaultX : keys[0]);
  const [my, setMy] = useState(defaultY && metrics[defaultY] ? defaultY : keys[1] || keys[0]);
  const MX = metrics[mx] || metrics[keys[0]];
  const MY = metrics[my] || metrics[keys[0]];

  const finito = (v) => typeof v === "number" && isFinite(v);
  const pts = subjects
    .map((s) => ({ x: MX.v(s), y: MY.v(s), z: tamanho ? tamanho.v(s) || 0 : 1, name: s, rotulo: tamanho && tamanho.nome ? tamanho.nome(s) : s }))
    .filter((p) => finito(p.x) && finito(p.y));
  const semValor = subjects.length - pts.length;
  // Eixo ajustado aos dados (com folga), e percentagens nunca acima de 100%.
  const dominio = (M, eixo) => {
    const vs = pts.map((p) => p[eixo]);
    if (!vs.length) return ["auto", "auto"];
    const lo = Math.max(0, Math.floor((Math.min(...vs) - 2) / 5) * 5);
    let hi = Math.ceil((Math.max(...vs) + 2) / 5) * 5;
    if (M.pct) hi = Math.min(100, hi);
    return [lo, Math.max(hi, lo + 5)];
  };
  const marcas = (d) => {
    if (typeof d[0] !== "number") return undefined;
    const passo = [5, 10, 20, 25, 50, 100, 250, 500, 1000].find((p) => (d[1] - d[0]) / p <= 6) || Math.ceil((d[1] - d[0]) / 5);
    const out = [];
    for (let v = Math.ceil(d[0] / passo) * passo; v <= d[1]; v += passo) out.push(v);
    return out;
  };
  const median = (arr) => {
    if (!arr.length) return 0;
    const v = [...arr].sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  const cx = median(pts.map((p) => p.x));
  const cy = median(pts.map((p) => p.y));

  const quads = [
    { label: `${MX.label} baixo · ${MY.label} alto`, color: COLORS.ok, pts: pts.filter((p) => p.x < cx && p.y >= cy) },
    { label: `${MX.label} alto · ${MY.label} alto`, color: COLORS.warn, pts: pts.filter((p) => p.x >= cx && p.y >= cy) },
    { label: `${MX.label} baixo · ${MY.label} baixo`, color: COLORS.slate, pts: pts.filter((p) => p.x < cx && p.y < cy) },
    { label: `${MX.label} alto · ${MY.label} baixo`, color: COLORS.danger, pts: pts.filter((p) => p.x >= cx && p.y < cy) },
  ];
  let colorFor = (p) => (p.x >= cx && p.y >= cy ? COLORS.warn : p.x < cx && p.y >= cy ? COLORS.ok : p.x >= cx ? COLORS.danger : COLORS.slate);
  // Quando cada métrica diz se "mais" é melhor ou pior, os quadrantes passam a ler-se como bom / misto / a vigiar.
  if (MX.melhor && MY.melhor) {
    const bomX = (p) => (MX.melhor === "alto" ? p.x >= cx : p.x <= cx);
    const bomY = (p) => (MY.melhor === "alto" ? p.y >= cy : p.y <= cy);
    colorFor = (p) => (bomX(p) && bomY(p) ? COLORS.ok : !bomX(p) && !bomY(p) ? COLORS.danger : COLORS.warn);
    const grupo = (bx, by, titulo, color) => ({ label: titulo, color, pts: pts.filter((p) => bomX(p) === bx && bomY(p) === by) });
    quads.splice(
      0,
      4,
      grupo(true, true, `Bem nas duas`, COLORS.ok),
      grupo(false, false, `A vigiar nas duas`, COLORS.danger),
      grupo(true, false, `Bem em ${MX.label.toLowerCase()}, a melhorar em ${MY.label.toLowerCase()}`, COLORS.warn),
      grupo(false, true, `Bem em ${MY.label.toLowerCase()}, a melhorar em ${MX.label.toLowerCase()}`, COLORS.warn),
    );
  }

  return (
    <div style={semCaixa ? undefined : panelStyle}>
      {label && <div style={panelTitle}>{label}</div>}
      {nota && <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 10, lineHeight: 1.5 }}>{nota}</div>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Eixo horizontal (X)</label>
          <select value={mx} onChange={(e) => setMx(e.target.value)} style={{ ...inputStyle, width: 240 }}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {metrics[k].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Eixo vertical (Y)</label>
          <select value={my} onChange={(e) => setMy(e.target.value)} style={{ ...inputStyle, width: 240 }}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {metrics[k].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {pts.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.slate }}>Sem dados para cruzar.</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 14, right: 22, bottom: 30, left: 6 }}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name={MX.label}
                domain={tamanho ? dominio(MX, "x") : undefined}
                ticks={tamanho ? marcas(dominio(MX, "x")) : undefined}
                padding={tamanho ? { left: 14, right: 14 } : undefined}
                allowDataOverflow={!!tamanho}
                tickFormatter={tamanho ? (v) => MX.fmt(v) : undefined}
                tick={{ fontSize: 11, fill: COLORS.slate }}
                label={{ value: MX.label, position: "insideBottom", offset: -18, fontSize: 11, fill: COLORS.slate }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={MY.label}
                domain={tamanho ? dominio(MY, "y") : undefined}
                ticks={tamanho ? marcas(dominio(MY, "y")) : undefined}
                padding={tamanho ? { top: 14, bottom: 10 } : undefined}
                allowDataOverflow={!!tamanho}
                tickFormatter={tamanho ? (v) => MY.fmt(v) : undefined}
                width={tamanho ? 52 : undefined}
                tick={{ fontSize: 11, fill: COLORS.slate }}
                label={{ value: MY.label, angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.slate }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 4, borderColor: COLORS.rule }}
                formatter={(v, n) => [n === "x" ? MX.fmt(v) : MY.fmt(v), n === "x" ? MX.label : MY.label]}
                labelFormatter={() => ""}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.rule}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, boxShadow: COLORS.lift }}>
                      <strong>{d.rotulo}</strong>
                      <div>
                        {MX.label}: {MX.fmt(d.x)}
                      </div>
                      <div>
                        {MY.label}: {MY.fmt(d.y)}
                      </div>
                      {tamanho && (
                        <div style={{ color: COLORS.slate }}>
                          {tamanho.label}: {tamanho.fmt ? tamanho.fmt(d.z) : d.z}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <ReferenceLine x={cx} stroke={COLORS.slate} strokeDasharray="5 4" />
              <ReferenceLine y={cy} stroke={COLORS.slate} strokeDasharray="5 4" />
              {tamanho && <ZAxis type="number" dataKey="z" range={[40, 520]} name={tamanho.label} />}
              <Scatter data={pts}>
                {pts.map((p, i) => (
                  <Cell key={i} fill={colorFor(p)} fillOpacity={tamanho ? 0.7 : 1} stroke={tamanho ? colorFor(p) : undefined} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            {quads.map((q) => (
              <div key={q.label} style={{ border: `1px solid ${COLORS.rule}`, borderLeft: `3px solid ${q.color}`, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: COLORS.slate, marginBottom: 3 }}>{q.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{q.pts.length ? q.pts.map((p) => p.rotulo).join(", ") : "—"}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 8 }}>
            As linhas tracejadas marcam a mediana de cada eixo, por isso os quadrantes são uma comparação relativa entre
            escolas, não um padrão de qualidade absoluto.{tamanho ? ` O tamanho de cada bola é ${tamanho.label.toLowerCase()}.` : ""}
            {semValor > 0 ? ` ${semValor} ${semValor === 1 ? "escola fica" : "escolas ficam"} de fora por não terem valor num dos eixos.` : ""}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Chart parameter toggles ----------
export function ParamChips({ params, visible, onToggle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Parâmetros de análise mostrados
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {params.map((p) => {
          const on = visible.has(p.key);
          return (
            <button
              key={p.key}
              onClick={() => onToggle(p.key)}
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
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export const ambitoDoNome = (t) => {
  const n = normChave(t).replace(/[^a-z ]/g, " ").trim();
  if (/^eventos?\b/.test(n)) return "eventos";
  if (/^sgq\b/.test(n) || n.startsWith("sistema de gestao")) return "sgq";
  return null;
};
export const ambitoAud = (a) => a.ambito || ambitoDoNome(a.school) || "escola";

export const PALAVRAS_PEQUENAS = ["de", "da", "do", "das", "dos", "e"];
export function nomeEscolaProposto(bruto) {
  const t = String(bruto || "").trim();
  const m = t.match(/^(dragon\s*force|df)\s*[-–·:]?\s*(.+)$/i);
  const resto = m ? m[2] : t;
  const tc = resto
    .split(/\s+/)
    .map((w, i) => {
      if (/^[A-Z]{2,4}$/.test(w) && !/[AEIOUÁÉÍÓÚÂÊÔÃÕ]/.test(w)) return w; // siglas sem vogais: FC, SC, SGQ
      const lw = w.toLocaleLowerCase("pt-PT");
      if (i > 0 && PALAVRAS_PEQUENAS.includes(lw)) return lw;
      return lw.replace(/(^|[.\-/])(\p{L})/gu, (x, a, b) => a + b.toLocaleUpperCase("pt-PT"));
    })
    .join(" ");
  return m ? `Dragon Force ${tc}` : tc;
}

export const thStyle = {
  textAlign: "left",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: COLORS.slate,
  padding: "9px 10px",
  borderBottom: `1px solid ${COLORS.rule}`,
  whiteSpace: "nowrap",
};
export const tdStyle = { padding: "9px 10px", borderBottom: "1px solid #EFEDE7", fontSize: 13.5 };

export function Filtros({ children }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>{children}</div>;
}

export function SemDados({ texto, icon, titulo, acao, onAcao }) {
  return <Vazio icon={icon || Inbox} titulo={titulo || "Sem dados para mostrar"} texto={texto} acao={acao} onAcao={onAcao} />;
}

// Leitor de CSV que respeita aspas (o Google Forms exporta assim).
export function lerCSVInq(texto) {
  const src = String(texto).replace(/^﻿/, "");
  const primeira = src.split(/\r?\n/)[0] || "";
  const fora = primeira.replace(/"[^"]*"/g, "");
  const sep = fora.includes("\t") ? "\t" : (fora.match(/;/g) || []).length > (fora.match(/,/g) || []).length ? ";" : ",";
  const linhas = [];
  let linha = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (aspas) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => String(c).trim() !== ""));
}

// Leitor de .xlsx sem dependências: um .xlsx é um zip com XML lá dentro.
// Descomprime com o DecompressionStream do browser e lê a primeira folha.
export async function lerExcelInq(ficheiro, opcoes = {}) {
  if (/\.xls$/i.test(ficheiro.name)) throw new Error("o formato .xls antigo não é suportado; guarda como .xlsx ou CSV");
  const buf = new Uint8Array(await ficheiro.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("não parece um ficheiro Excel válido");
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entradas = {};
  const dec = new TextDecoder();
  for (let k = 0; k < total; k++) {
    const metodo = dv.getUint16(p + 10, true);
    const tamComp = dv.getUint32(p + 20, true);
    const nLen = dv.getUint16(p + 28, true);
    const eLen = dv.getUint16(p + 30, true);
    const cLen = dv.getUint16(p + 32, true);
    const offLocal = dv.getUint32(p + 42, true);
    const nome = dec.decode(buf.subarray(p + 46, p + 46 + nLen));
    entradas[nome] = { metodo, tamComp, offLocal };
    p += 46 + nLen + eLen + cLen;
  }
  const ler = async (nome) => {
    const e = entradas[nome];
    if (!e) return null;
    const ini = e.offLocal + 30 + dv.getUint16(e.offLocal + 26, true) + dv.getUint16(e.offLocal + 28, true);
    const dados = buf.subarray(ini, ini + e.tamComp);
    if (e.metodo === 0) return dec.decode(dados);
    const stream = new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return dec.decode(await new Response(stream).arrayBuffer());
  };
  const xml = (t) => new DOMParser().parseFromString(t, "application/xml");

  const partilhadas = [];
  const sst = await ler("xl/sharedStrings.xml");
  if (sst) {
    [...xml(sst).getElementsByTagName("si")].forEach((si) => {
      partilhadas.push([...si.getElementsByTagName("t")].map((t) => t.textContent).join(""));
    });
  }

  // Folhas pela ordem do livro (não necessariamente sheet1.xml); as ocultas ficam para o fim.
  let folhas = [{ nome: "Folha 1", oculta: false, caminho: "xl/worksheets/sheet1.xml" }];
  const wb = await ler("xl/workbook.xml");
  const rels = await ler("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const relsXml = [...xml(rels).getElementsByTagName("Relationship")];
    const lista = [...xml(wb).getElementsByTagName("sheet")]
      .map((folha) => {
        const rid = folha.getAttribute("r:id") || folha.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
        const rel = relsXml.find((r) => r.getAttribute("Id") === rid);
        if (!rel) return null;
        const alvo = rel.getAttribute("Target").replace(/^\//, "");
        return { nome: folha.getAttribute("name") || "Folha", oculta: /hidden/i.test(folha.getAttribute("state") || ""), caminho: alvo.startsWith("xl/") ? alvo : `xl/${alvo}` };
      })
      .filter(Boolean);
    if (lista.length) folhas = [...lista.filter((f) => !f.oculta), ...lista.filter((f) => f.oculta)];
  }

  const colNum = (ref) => {
    const letras = ref.replace(/\d+/g, "");
    let n = 0;
    for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  // Lê a folha em fluxo, linha a linha, sem montar o XML inteiro na memória:
  // há ficheiros com fórmulas copiadas até à linha 1 048 576 (centenas de MB).
  // Pára quando encontra 3000 linhas seguidas com menos de dois valores.
  const desfazer = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (x, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");
  const lerFolha = async (caminho) => {
    const e = entradas[caminho];
    if (!e) return null;
    const ini = e.offLocal + 30 + dv.getUint16(e.offLocal + 26, true) + dv.getUint16(e.offLocal + 28, true);
    const dados = buf.subarray(ini, ini + e.tamComp);
    const linhas = [];
    let fracas = 0;
    let parar = false;
    const reCel = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    const tratarLinha = (rowXml) => {
      const mR = rowXml.match(/^<row\b[^>]*?\br="(\d+)"/);
      const linha = [];
      let cheias = 0;
      let m;
      reCel.lastIndex = 0;
      while ((m = reCel.exec(rowXml))) {
        const attrs = m[1];
        const ref = (attrs.match(/\br="([A-Z]+)\d*"/) || [])[1];
        const t = (attrs.match(/\bt="(\w+)"/) || [])[1];
        const corpo = m[2] || "";
        let valor = "";
        if (t === "inlineStr") valor = desfazer([...corpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
        else {
          const v = (corpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          if (v !== undefined) valor = t === "s" ? partilhadas[Number(v)] ?? "" : desfazer(v);
        }
        if (ref) linha[colNum(ref)] = valor;
        else linha.push(valor);
        if (String(valor).trim() !== "") cheias++;
      }
      for (let i = 0; i < linha.length; i++) if (linha[i] === undefined) linha[i] = "";
      linha.__linha = mR ? Number(mR[1]) : undefined;
      linha.__cheias = cheias;
      linhas.push(linha);
      fracas = cheias < 2 ? fracas + 1 : 0;
      if (fracas >= 3000) parar = true;
    };
    let resto = "";
    const consumir = (texto, fim) => {
      resto += texto;
      let i = 0;
      for (;;) {
        const ab = resto.indexOf("<row", i);
        if (ab < 0) {
          resto = fim ? "" : resto.slice(Math.max(i, resto.length - 10));
          return;
        }
        const fechoTag = resto.indexOf(">", ab);
        if (fechoTag < 0) break;
        let fimRow;
        if (resto[fechoTag - 1] === "/") fimRow = fechoTag + 1;
        else {
          const f = resto.indexOf("</row>", fechoTag);
          if (f < 0) break;
          fimRow = f + 6;
        }
        tratarLinha(resto.slice(ab, fimRow));
        i = fimRow;
        if (parar) return;
      }
      resto = resto.slice(i);
    };
    if (e.metodo === 0) consumir(dec.decode(dados), true);
    else {
      const leitor = new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw")).pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) {
          consumir("", true);
          break;
        }
        consumir(value, false);
        if (parar) {
          leitor.cancel().catch(() => {});
          break;
        }
      }
    }
    // Tira o lixo do fim (linhas só com uma fórmula por preencher) e as vazias.
    while (linhas.length && linhas[linhas.length - 1].__cheias < 2) linhas.pop();
    return linhas.filter((l) => l.__cheias > 0);
  };

  if (opcoes.todas) {
    const todas = [];
    for (const f of folhas) {
      const linhas = await lerFolha(f.caminho);
      if (linhas) todas.push({ nome: f.nome, oculta: f.oculta, linhas });
    }
    if (!todas.length) throw new Error("não encontrei a folha de cálculo dentro do ficheiro");
    return todas;
  }
  const primeira = await lerFolha(folhas[0].caminho);
  if (!primeira) throw new Error("não encontrei a folha de cálculo dentro do ficheiro");
  return primeira;
}

// Datas do carimbo do formulário (dd/mm/aaaa ou aaaa-mm-dd), para sugerir a data do inquérito.
export function dataDeCarimbo(v) {
  const s = String(v || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}
export const pergNps = (q) => q.tipo === "nps";

export function npsDe(inqueritos) {
  let n = 0;
  let prom = 0;
  let detr = 0;
  inqueritos.forEach((i) =>
    (i.perguntas || []).filter(pergNps).forEach((q) => {
      const r = resumoContagens(q, q.contagens);
      n += r.n;
      prom += r.prom;
      detr += r.detr;
    })
  );
  return n ? { n, prom, detr, neutros: n - prom - detr, valor: Math.round(((prom - detr) / n) * 100) } : null;
}

export const corSatisfacao = (pct) => (pct === null || pct === undefined ? COLORS.slate : pct >= 80 ? COLORS.ok : pct >= 70 ? COLORS.warn : COLORS.danger);

// Datas do Excel chegam como número de série (dias desde 1899-12-30).
export function dataDeCelula(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return dataDeCarimbo(s) || "";
}

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
export const fmtNum = (v, dec = 0) => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const f = 10 ** dec;
  const r = Math.round(Number(v) * f) / f;
  return (r === 0 ? 0 : r).toLocaleString("pt-PT", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
};
export const REL_AZUL2 = "#1D4F9A";
// Azul institucional no papel claro; no tema escuro usa o azul da app, que se lê melhor.
export const azulRel = () => (COLORS.paper === TEMA_ESCURO.paper ? COLORS.navy : REL_AZUL2);

export function BarrasRel({ dados, cor, largura = 150, sufixo = "" }) {
  if (!dados.length) return <div className="relVazio">Sem registos no período.</div>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(80, dados.length * 26 + 8)}>
      <BarChart data={dados} layout="vertical" margin={{ left: 0, right: 34, top: 2, bottom: 2 }}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="name" width={largura} tick={<TickNome largura={largura} tamanho={11.5} cor={COLORS.ink2} />} axisLine={false} tickLine={false} />
        <Tooltip content={<DicaGrafico sufixo={sufixo} />} cursor={{ fill: COLORS.ruleSoft }} />
        <Bar dataKey="value" name="Total" fill={cor || azulRel()} barSize={9} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" formatter={(v) => `${v}${sufixo}`} style={{ fontSize: 11.5, fontWeight: 600, fill: COLORS.ink }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Ordem dos meses numa época (agosto a julho).
export const MESES_EPOCA = [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6];
export const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// ======================================================================
// ---------- Comparação entre épocas ----------
// ======================================================================
// Painel reutilizável: escolhe duas épocas e mostra cada métrica lado a lado.
// Com a época atual em curso compara, por defeito, até à mesma data em ambas
// (ex.: 1 ago–2 out de cada época), para não comparar meia época com uma inteira.

export const inicioEpoca = (ep) => `${String(ep).slice(0, 4)}-08-01`;

// Data limite para a época `ep` quando se compara "até à mesma data".
export function limiteEpoca(ep, epAtual) {
  const hoje = new Date();
  const ini = new Date(inicioEpoca(epAtual) + "T00:00:00");
  const dias = Math.floor((hoje - ini) / 86400000);
  const d = new Date(inicioEpoca(ep) + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Filtra uma lista por época (pela data indicada) e, opcionalmente, até ao limite.
export function naEpoca(lista, campoData, ep, limite) {
  return lista.filter((x) => {
    const d = String(typeof campoData === "function" ? campoData(x) : x[campoData] || "").slice(0, 10);
    if (!d || epocaDe(d) !== ep) return false;
    return !limite || d <= limite;
  });
}

export function ComparacaoEpocas({ titulo, epocas, metricas, calcular, nota, selecionadas }) {
  const epAtual = epocaDe(new Date().toISOString().slice(0, 10));
  const lista = [...new Set([epAtual, ...epocas])].filter(Boolean).sort().reverse();
  const daPagina = (selecionadas || []).filter((e) => lista.includes(e));
  const [sel, setSel] = useState(() => (daPagina.length >= 2 ? daPagina : lista.slice(0, 2)));
  // Quando se escolhem várias épocas no filtro da página, a comparação segue-as.
  const chavePag = daPagina.join("|");
  useEffect(() => {
    if (daPagina.length >= 2) setSel(daPagina);
  }, [chavePag]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mesmaData, setMesmaData] = useState(true);
  const [aberto, setAberto] = useState(true);

  if (lista.length < 2) return null;
  const cols = [...sel].filter((e) => lista.includes(e)).sort().reverse();
  const ref = cols[0];
  const parcial = mesmaData && cols.includes(epAtual);
  const valores = Object.fromEntries(cols.map((ep) => [ep, calcular(ep, parcial ? limiteEpoca(ep, epAtual) : null)]));
  const limTxt = parcial ? new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" }).format(new Date(limiteEpoca(epAtual, epAtual) + "T00:00:00")) : null;
  const fmtV = (m, v) => (v === null || v === undefined || isNaN(v) ? "—" : `${Number(v).toLocaleString("pt-PT", { maximumFractionDigits: m.dec ?? 0 })}${m.unidade || ""}`);
  const variacao = (m, x, y) => {
    const temAmbos = x !== null && x !== undefined && y !== null && y !== undefined && !isNaN(x) && !isNaN(y);
    if (!temAmbos) return null;
    const dif = x - y;
    const bom = dif === 0 || !m.melhor ? null : m.melhor === "alto" ? dif > 0 : dif < 0;
    return { dif, cor: bom === null ? COLORS.slate : bom ? COLORS.ok : COLORS.danger };
  };
  const alterna = (ep) => setSel((l) => (l.includes(ep) ? (l.length > 1 ? l.filter((x) => x !== ep) : l) : [...l, ep]));
  const th = { ...thStyle, textAlign: "right" };

  return (
    <div style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => setAberto((v) => !v)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", ...panelTitle, marginBottom: 0, display: "flex", alignItems: "center", gap: 6 }} aria-expanded={aberto}>
          <span style={{ display: "inline-block", transform: aberto ? "rotate(90deg)" : "none", transition: "transform 160ms ease" }}>›</span>
          {titulo || "Comparação entre épocas"}
        </button>
        <div style={{ flex: 1 }} />
        {aberto && (
          <>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {lista.map((e) => {
                const on = sel.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => alterna(e)}
                    aria-pressed={on}
                    style={{ border: `1px solid ${on ? COLORS.navy : COLORS.rule}`, background: on ? COLORS.navy : "transparent", color: on ? COLORS.onAccent || "#fff" : COLORS.ink2, borderRadius: 14, padding: "3px 9px", fontSize: 12, cursor: "pointer", fontVariantNumeric: "tabular-nums" }}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
            {cols.includes(epAtual) && cols.length > 1 && (
              <label style={{ fontSize: 12, color: COLORS.ink2, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={mesmaData} onChange={(e) => setMesmaData(e.target.checked)} /> Até à mesma data
              </label>
            )}
          </>
        )}
      </div>
      {aberto && (
        <>
          {cols.length < 2 ? (
            <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 10 }}>Escolhe pelo menos duas épocas para comparar.</div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Indicador</th>
                    {cols.map((ep, i) => (
                      <th key={ep} style={{ ...th, color: i === 0 ? COLORS.ink : COLORS.slate }}>
                        {ep}
                        {parcial && ep !== epAtual ? "*" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricas.map((m) => (
                    <tr key={m.key}>
                      <td style={{ ...tdStyle, fontSize: 12.5, color: COLORS.ink2 }}>{m.label}</td>
                      {cols.map((ep, i) => {
                        const v = valores[ep][m.key];
                        const va = i > 0 ? variacao(m, valores[ref][m.key], v) : null;
                        return (
                          <td key={ep} style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: i === 0 ? 600 : 400 }}>
                            {fmtV(m, v)}
                            {va && va.dif !== 0 && (
                              <div style={{ fontSize: 10.5, fontWeight: 600, color: va.cor }} title={`${ref} face a ${ep}`}>
                                {ref} {va.dif > 0 ? "▲" : "▼"} {Math.abs(va.dif).toLocaleString("pt-PT", { maximumFractionDigits: m.dec ?? 0 })}
                                {m.unidade === "%" ? " p.p." : m.unidade || ""}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 10 }}>
            {cols.length >= 2 && (parcial ? `* Até ${limTxt} de cada época, para comparar com ${epAtual} na mesma altura.` : "Épocas completas.")}
            {cols.length >= 2 ? ` As setas dizem como ${ref} está face a cada época.` : ""}
            {nota ? ` ${nota}` : ""}
          </div>
        </>
      )}
    </div>
  );
}
export const AJUDA_CAUSA = {
  Pessoas: "Comportamento ou competência de alguém",
  Processo: "Procedimento em falta, mal definido ou não cumprido",
  Comunicação: "Informação que não chegou, chegou tarde ou errada",
  "Instalações e equipamento": "Espaços, material, avarias",
  "Fornecedor ou parceiro": "Entidade externa contratada ou parceira",
  "Fator externo": "Fora do controlo da Dragon Force (meteorologia, arbitragem…)",
  "Sem fundamento": "Analisado: não havia falha da Dragon Force",
};
export const PALETA_CAUSAS = () => [COLORS.danger, COLORS.warn, COLORS.purple, COLORS.progress, COLORS.navySoft, COLORS.slate, COLORS.ok];
export const corCausa = (c) => {
  const i = CAUSAS_ATUAIS.indexOf(c);
  return i >= 0 ? PALETA_CAUSAS()[i % PALETA_CAUSAS().length] : colorForLabel(c).color;
};

export function SeletorCausa({ valor, onChange, compacto, onGerirLista }) {
  const atual = nomeCausa(valor);
  const lista = atual && !CAUSAS_ATUAIS.includes(atual) ? [...CAUSAS_ATUAIS, atual] : CAUSAS_ATUAIS;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: compacto ? 11.5 : 12.5, fontWeight: 600, color: compacto ? COLORS.slate : COLORS.ink }}>
          Porque é que isto aconteceu? <span style={{ fontWeight: 400, color: COLORS.slate }}>(causa raiz)</span>
        </div>
        {onGerirLista && (
          <button type="button" onClick={() => onGerirLista("causasRaiz")} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 11.5 }}>
            Gerir lista
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {lista.map((c) => {
          const ativo = atual === c;
          const cor = corCausa(c);
          return (
            <button
              key={c}
              type="button"
              title={AJUDA_CAUSA[c] || c}
              onClick={() => onChange(ativo ? "" : c)}
              style={{
                padding: compacto ? "4px 10px" : "6px 11px",
                borderRadius: 20,
                border: `1.5px solid ${ativo ? cor : COLORS.rule}`,
                background: ativo ? COLORS.paperSunken : "transparent",
                color: ativo ? cor : COLORS.ink2,
                fontSize: compacto ? 11.5 : 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {ativo ? "✓ " : ""}
              {c}
            </button>
          );
        })}
      </div>
      {atual && AJUDA_CAUSA[atual] && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 5 }}>{AJUDA_CAUSA[atual]}.</div>}
    </div>
  );
}

// Junta reclamações concluídas e constatações resolvidas numa só lista.
export function itensCausa(reclamacoes, audits) {
  const r = (reclamacoes || [])
    .filter((e) => e.status === "concluido")
    .map((e) => ({ origem: "Reclamações", causa: nomeCausa(e.causaRaiz), escola: e.school || "Sem escola", data: e.receivedDate, tema: e.tema || e.categoria || "" }));
  const a = (audits || []).flatMap((au) =>
    (au.findings || []).filter((f) => f.resolvida).map((f) => ({ origem: "Auditorias", causa: nomeCausa(f.causaRaiz), escola: au.school || "Sem escola", data: au.date, tema: f.area || "" }))
  );
  return [...r, ...a];
}

export function PainelCausas({ itens, titulo }) {
  const [vista, setVista] = useState("total");
  const com = itens.filter((i) => i.causa);
  const sem = itens.length - com.length;
  const origens = [...new Set(itens.map((i) => i.origem))];
  const causas = [...CAUSAS_ATUAIS, ...[...new Set(com.map((i) => i.causa))].filter((c) => !CAUSAS_ATUAIS.includes(c))];
  const dados = causas.map((c) => {
    const linha = { name: c, key: c };
    origens.forEach((o) => (linha[o] = com.filter((i) => i.causa === c && i.origem === o).length));
    linha.total = com.filter((i) => i.causa === c).length;
    return linha;
  }).filter((l) => l.total > 0);
  const escolas = [...new Set(com.map((i) => i.escola))].sort();
  const colunas = causas.filter((c) => com.some((i) => i.causa === c));
  const maxCel = Math.max(1, ...escolas.flatMap((e) => colunas.map((c) => com.filter((i) => i.escola === e && i.causa === c).length)));
  const corOrigem = { Reclamações: COLORS.navy, Auditorias: COLORS.warn };

  return (
    <div style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={panelTitle}>{titulo || "Causa raiz"}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: COLORS.slate }}>
            {com.length} classificados{sem ? ` · ${sem} sem causa` : ""}
          </span>
          {escolas.length > 1 && (
            <div style={{ display: "inline-flex", gap: 2, background: COLORS.segTrack, borderRadius: 8, padding: 2 }}>
              {[
                ["total", "Total"],
                ["escola", "Por escola"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setVista(k)}
                  className="pill"
                  style={{ border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: vista === k ? 600 : 500, background: vista === k ? COLORS.paperRaised : "transparent", color: vista === k ? COLORS.ink : COLORS.ink2, cursor: "pointer" }}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {com.length === 0 ? (
        <div style={{ fontSize: 12.5, color: COLORS.slate }}>
          Ainda não há casos com causa. A pergunta "Porque é que isto aconteceu?" aparece ao concluir uma reclamação e ao resolver uma constatação.
        </div>
      ) : vista === "total" ? (
        <>
          <ResponsiveContainer width="100%" height={Math.max(150, dados.length * 34)}>
            <BarChart data={dados} layout="vertical" margin={{ left: 4, right: 20 }}>
              <CartesianGrid stroke={COLORS.ruleSoft} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={170} tick={<TickNome largura={170} tamanho={12} cor={COLORS.ink} />} axisLine={false} tickLine={false} />
              <Tooltip content={<DicaGrafico />} cursor={{ fill: COLORS.ruleSoft }} />
              {origens.map((o, i) => (
                <Bar key={o} dataKey={o} name={o} stackId="c" fill={corOrigem[o] || COLORS.navySoft} radius={i === origens.length - 1 ? [0, 4, 4, 0] : 0} barSize={16} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          {origens.length > 1 && (
            <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: COLORS.ink2, marginTop: 4 }}>
              {origens.map((o) => (
                <span key={o} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: corOrigem[o] }} />
                  {o}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 3, fontSize: 12, minWidth: 560 }}>
            <thead>
              <tr>
                <th />
                {colunas.map((c) => (
                  <th key={c} style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.slate, padding: "2px 4px", textAlign: "center", maxWidth: 90 }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {escolas.map((e) => (
                <tr key={e}>
                  <td style={{ padding: "4px 8px 4px 0", fontWeight: 600, whiteSpace: "nowrap" }}>{e}</td>
                  {colunas.map((c) => {
                    const n = com.filter((i) => i.escola === e && i.causa === c).length;
                    const op = n ? 0.15 + 0.85 * (n / maxCel) : 0;
                    return (
                      <td key={c} title={`${e} · ${c}: ${n}`} style={{ textAlign: "center", padding: "6px 4px", borderRadius: 6, background: n ? `color-mix(in srgb, ${COLORS.navy} ${Math.round(op * 100)}%, transparent)` : COLORS.paperSunken, color: op > 0.55 ? COLORS.onAccent : COLORS.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 44 }}>
                        {n || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Main App ----------
// ======================================================================
// ---------- Sistema de gestão: Controlo documental (DFF.001) e Mapa de objetivos (DFF.024) ----------
export async function descarregarXlsx(buf, nome) {
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  // Sem acentos no nome: alguns browsers trocam o nome por "download".
  a.download = String(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export async function abrirLivroExcel(ficheiro) {
  if (!/\.xlsx$/i.test(ficheiro.name)) throw new Error("escolhe um ficheiro .xlsx");
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await ficheiro.arrayBuffer());
  return wb;
}
// Nome do ficheiro com a versão atual do documento na lista (ex.: "DFF.024.03 - MAPA DE OBJECTIVOS").
export function nomeComVersao(documentos, codigo, titulo) {
  const d = ((documentos && documentos.itens) || []).find((x) => x.codigo === codigo && (x.lista || "DF") === "DF");
  return `${d ? codigoComVersao(d) : codigo} - ${titulo}.xlsx`;
}

export function JanelaSGQ({ titulo, largura = 760, onFechar, children, rodape }) {
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: `min(${largura}px, 100%)`, maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", background: COLORS.paperRaised, borderRadius: 14, border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 22px 10px" }}>
          <h2 style={{ margin: 0, fontSize: 19, color: COLORS.navy, flex: 1, minWidth: 0 }}>{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar" style={{ ...iconBtnStyle, color: COLORS.slate }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "4px 22px 18px", overflowY: "auto", minHeight: 0 }}>{children}</div>
        {rodape && <div style={{ display: "flex", gap: 8, padding: "12px 22px 18px", borderTop: `1px solid ${COLORS.ruleSoft}`, flexWrap: "wrap", alignItems: "center" }}>{rodape}</div>}
      </div>
    </div>
  );
}
export const chipSGQ = (ativo) => ({ border: `1px solid ${ativo ? COLORS.navy : COLORS.rule}`, background: ativo ? COLORS.navyWash : "transparent", color: ativo ? COLORS.navy : COLORS.ink2, borderRadius: 999, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontWeight: ativo ? 600 : 500, fontFamily: "inherit" });

// Botão "Foto": imagem do balanço que está à vista (o elemento de alvo), com cabeçalho e data.
export function BotaoFoto({ alvo, titulo, subtitulo, nome, vertical, rotulo, conteudo, tipo }) {
  const [aTirar, setATirar] = useState(false);
  return (
    <button
      type="button"
      className="press semFoto"
      disabled={aTirar}
      title="Abre a impressão: escolhe «Guardar como PDF»"
      onClick={() => {
        setATirar(true);
        // Dois frames para o "A preparar…" aparecer antes do trabalho pesado (cópia da página e impressão).
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            try {
              imprimirBalanco(alvo.current, { titulo, subtitulo, nome: nome || titulo, vertical, logo: LOGO_BRANCO, html: conteudo ? conteudo() : "", tipo });
            } finally {
              setTimeout(() => setATirar(false), 800);
            }
          })
        );
      }}
      style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <Printer size={14} /> {aTirar ? "A preparar…" : rotulo || "PDF do balanço"}
    </button>
  );
}
