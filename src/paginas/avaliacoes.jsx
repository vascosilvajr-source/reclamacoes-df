// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Avaliações do staff feitas por quem visita as escolas: operacionais e área técnica.
// Só se guardam INICIAIS (nunca nomes), escola, data e notas. Os nomes do Excel ficam no browser.
import { useMemo, useState } from "react";
import { Plus, X, Upload, Pencil, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { COLORS, Vazio, StatCard, epocaDe, fmt, iconBtnStyle, inputStyle, isoDe, labelStyle, linkBtnStyle, normChave, panelStyle, primaryBtnStyle, secondaryBtnStyle } from "../nucleo.jsx";
import { dataDeCarimbo, lerExcelInq, nomeEscolaProposto } from "../partilhado.jsx";

export const CRITERIOS_OPERACIONAL = ["Comunicação", "Proatividade", "Responsabilidade", "Organização", "Gestão de Conflitos", "Domínio das Tecnologias", "Cumprimento de Datas"];
const novoId = () => `av_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

export const AVALIADOR_PADRAO = { operacional: "GR", tecnica: "PP" };
export const MOMENTOS = { periodica: "Avaliação", intermedia: "Intermédia" };

// "Inês Moreira (N)" -> "IM" (primeiro e último nome, sem pontos). Nada do nome completo é guardado.
export function iniciaisDe(nome) {
  const limpo = String(nome || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\bDep\b.*$/i, "")
    .trim();
  const p = limpo.split(/\s+/).filter((w) => w && !PARTICULAS.has(w.toLowerCase()));
  if (!p.length) return "";
  const letra = (w) => (w.match(/\p{L}/u) || [""])[0].toLocaleUpperCase("pt-PT");
  return p.length === 1 ? letra(p[0]) : letra(p[0]) + letra(p[p.length - 1]);
}
// "Pedro Pinto, Ana Cunha e Rafaela Dep. Psicologia" -> ["PP", "AC", "R"]
export function iniciaisDeLista(texto) {
  return String(texto || "")
    .split(/,|;|\se\s|\/|\n/)
    .map((x) => iniciaisDe(x))
    .filter(Boolean);
}

// Datas do Excel: número de série. O ficheiro tem o dia e o mês trocados (12/10 lido como 10 de dezembro)
// porque foi escrito em dd/mm e lido em mm/dd; os textos "13/10/2026" vêm certos.
export function dataDoExcel(v, trocar) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    const a = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const dia = d.getUTCDate();
    const p = (n) => String(n).padStart(2, "0");
    return trocar && dia <= 12 ? `${a}-${p(dia)}-${p(m)}` : `${a}-${p(m)}-${p(dia)}`;
  }
  return dataDeCarimbo(s) || "";
}

const nota = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
};
export const mediaDe = (notas) => {
  const v = Object.values(notas || {}).map(nota).filter((x) => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const ABREV = { "Comunicação": "Comun.", Proatividade: "Proat.", Responsabilidade: "Respons.", "Organização": "Organiz.", "Gestão de Conflitos": "Conflitos", "Domínio das Tecnologias": "Tecnol.", "Cumprimento de Datas": "Datas" };
const abrev = (k) => ABREV[k] || (k.length > 12 ? k.slice(0, 11) + "…" : k);
const f1 = (n) => (n === null || n === undefined ? "—" : n.toFixed(1).replace(".", ","));
const corNota = (n) => (n === null || n === undefined ? COLORS.slate : n >= 4 ? COLORS.ok : n >= 3 ? COLORS.warn : COLORS.danger);
const fundoNota = (n) => (n === null || n === undefined ? "transparent" : n >= 4 ? COLORS.okBg : n >= 3 ? COLORS.warnBg : COLORS.dangerBg);
const fmtData = (d) => (d ? fmt(new Date(String(d).slice(0, 10) + "T00:00:00")) : "sem data");

const sim = (v) => /^(1|true|sim|verdadeiro)$/i.test(String(v ?? "").trim());
const vazioOuBarra = (v) => {
  const t = String(v ?? "").trim();
  return !t || t === "/" || t === "-";
};

// Troca nomes de pessoas (conhecidos do ficheiro) por iniciais num texto livre.
function criarMascara(nomes) {
  const pessoas = [...new Set(nomes.map((n) => String(n || "").replace(/\(.*?\)/g, "").replace(/\bDep\b.*$/i, "").trim()).filter((n) => n.length > 2))];
  const primeiros = {};
  pessoas.forEach((n) => {
    const pn = n.split(/\s+/)[0];
    if (pn.length >= 3) (primeiros[normChave(pn)] = primeiros[normChave(pn)] || new Set()).add(n);
  });
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const inicio = "(?<![\\p{L}])";
  const fim = "(?![\\p{L}])";
  const completos = [...pessoas].sort((x, y) => y.length - x.length).map((n) => [new RegExp(inicio + esc(n) + fim, "giu"), iniciaisDe(n)]);
  const soPrimeiro = Object.entries(primeiros)
    .filter(([, set]) => set.size === 1)
    .map(([k, set]) => {
      const n = [...set][0];
      return [new RegExp(inicio + esc(n.split(/\s+/)[0]) + fim, "giu"), iniciaisDe(n)];
    });
  return (texto) => {
    let t = String(texto ?? "");
    completos.concat(soPrimeiro).forEach(([re, ini]) => {
      t = t.replace(re, ini);
    });
    return t;
  };
}

// Lê o Excel dos operacionais: uma folha por escola (a primeira é a lista geral e é ignorada).
// Devolve as avaliações (notas) e, por escola, as visitas e restante informação. Nomes -> iniciais.
export function lerFicheiroOperacionais(folhas, trocarDatas) {
  const avaliacoes = [];
  const escolasInfo = [];
  // Todos os nomes de pessoas do ficheiro (responsáveis, coordenadores, quem acompanhou as visitas),
  // para trocar também os que aparecem em texto livre.
  const nomes = [];
  folhas.forEach((f) => {
    const L = f.linhas;
    L.forEach((l) => {
      if (/^(coordenador t|resp\. operacional)/i.test(String(l[0] || ""))) String(l[1] || "").split(/[;/]/).forEach((x) => nomes.push(x));
    });
    const iCabOp = L.findIndex((l) => normChave(l[0]) === normChave("Responsável Operacional") && normChave(l[2]) === normChave("Comunicação"));
    if (iCabOp >= 0) {
      const n0 = L[iCabOp].__linha;
      L.filter((l) => l.__linha > n0 && l.__linha <= n0 + 4).forEach((l) => nomes.push(l[0]));
    }
    const cabAc = L.find((l) => normChave(l[11]) === normChave("REGISTO ACOMPANHAMENTO"));
    if (cabAc) L.filter((l) => l.__linha > cabAc.__linha && l.__linha <= cabAc.__linha + 14).forEach((l) => !vazioOuBarra(l[11]) && String(l[11]).split(/,|;|\se\s/).forEach((x) => nomes.push(x)));
  });
  folhas.forEach((f) => {
    const L = f.linhas;
    const porLinha = (n) => L.find((l) => l.__linha === n) || [];
    const iCab = L.findIndex((l) => normChave(l[0]) === normChave("Responsável Operacional") && normChave(l[2]) === normChave("Comunicação"));
    if (iCab < 0) return; // folha que não é de escola
    const cab = L[iCab];
    const nCab = cab.__linha;
    const titulo = String((L.find((l) => /dragon\s*force/i.test(String(l[0] || ""))) || [])[0] || f.nome);
    const colunas = [];
    for (let c = 2; c <= 8; c++) {
      const nome = CRITERIOS_OPERACIONAL.find((k) => normChave(k) === normChave(cab[c]));
      if (nome) colunas.push([c, nome]);
    }
    const nomesFolha = [];
    const valor = (rotulo) => L.find((x) => normChave(x[0]) === normChave(rotulo)) || [];
    const lCoord = valor("Coordenador Téc.");
    const lResp = valor("Resp. Operacional");
    String(lCoord[1] || "").split(/[;/]/).forEach((x) => nomesFolha.push(x));
    String(lResp[1] || "").split(/[;/]/).forEach((x) => nomesFolha.push(x));
    for (let n = nCab + 1; n <= nCab + 4; n++) if (String(porLinha(n)[0] || "").trim()) nomesFolha.push(porLinha(n)[0]);
    const mascara = criarMascara([...nomes, ...nomesFolha]);
    // Visitas (a partir da coluna K, até ao «Mapa da Escola») e quem as acompanhou (coluna L, abaixo de «REGISTO ACOMPANHAMENTO»).
    const iMapa = L.findIndex((l) => normChave(l[0]) === normChave("Mapa da Escola"));
    const fimVis = iMapa >= 0 ? L[iMapa].__linha : nCab + 8;
    const rotulosVis = [];
    for (let c = 11; c <= 22; c++) if (String(cab[c] ?? "").trim()) rotulosVis[c] = String(cab[c]).trim();
    const visitas = [];
    for (let n = nCab + 1; n < fimVis; n++) {
      const l = porLinha(n);
      const d = dataDoExcel(l[10], trocarDatas);
      if (!d) continue;
      const campos = {};
      let duracao = "";
      rotulosVis.forEach((rot, c) => {
        if (!rot || vazioOuBarra(l[c])) return;
        if (/dura/i.test(rot)) duracao = String(l[c]).trim();
        else campos[rot] = mascara(String(l[c]).trim());
      });
      visitas.push({ linha: n, data: d, duracao, campos });
    }
    const cabAc = L.find((l) => normChave(l[11]) === normChave("REGISTO ACOMPANHAMENTO"));
    const acompanham = {};
    if (cabAc) {
      L.filter((l) => l.__linha > cabAc.__linha && l.__linha <= cabAc.__linha + 14).forEach((l) => {
        const d = dataDoExcel(l[10], trocarDatas);
        if (d && !vazioOuBarra(l[11])) acompanham[d] = iniciaisDeLista(l[11]);
      });
    }
    visitas.forEach((v) => (v.acompanhantes = acompanham[v.data] || []));
    // Operacionais avaliados (uma linha cada).
    const operacionais = [];
    for (let n = nCab + 1; n <= nCab + 4; n++) {
      const l = porLinha(n);
      const nome = String(l[0] || "").trim();
      if (!nome) continue;
      operacionais.push(iniciaisDe(nome));
      const notas = {};
      colunas.forEach(([c, k]) => {
        const v = nota(l[c]);
        if (v !== null) notas[k] = v;
      });
      const v = visitas.find((x) => x.linha === n) || visitas[0];
      avaliacoes.push({ folha: f.nome, titulo, avaliado: iniciaisDe(nome), notas, data: Object.keys(notas).length && v ? v.data : "", avaliadores: [AVALIADOR_PADRAO.operacional] });
    }
    // Mapa da escola e controlos.
    const local = (L.find((l) => normChave(l[0]) === "local") || [])[1];
    const clube = (L.find((l) => normChave(l[0]) === "clube") || [])[1];
    const bloco = (iCol, parar) => {
      const out = [];
      const iIni = L.findIndex((l) => parar(l));
      if (iIni < 0) return out;
      for (let k = iIni + 1; k < Math.min(L.length, iIni + 16); k++) {
        const l = L[k];
        const mes = String(l[iCol] ?? "").trim();
        if (!mes || !MESES_PT.includes(normChave(mes))) {
          if (out.length) break;
          continue;
        }
        out.push({ mes, a: l[iCol + 1], b: l[iCol + 2] });
      }
      return out;
    };
    const mapas = bloco(0, (l) => /^mapas de controlo/i.test(String(l[0] || ""))).map((x) => ({ mes: x.mes, feito: sim(x.a), quando: String(x.b ?? "").trim() }));
    const mensal = bloco(4, (l) => normChave(l[4]) === normChave("Controlo Mensalidades")).map((x) => ({ mes: x.mes, feito: sim(x.a), quando: String(x.b ?? "").trim() }));
    const diarios = bloco(8, (l) => normChave(l[8]) === "meses" || normChave(l[8]) === "diarios de caixa").map((x) => ({ mes: x.mes, recebidos: String(x.a ?? "").trim(), totais: String(x.b ?? "").trim() }));
    escolasInfo.push({
      folha: f.nome,
      titulo,
      coordenador: iniciaisDe(lCoord[1]) || "",
      operacionais,
      local: String(local || "").trim(),
      clube: String(clube || "").trim(),
      reunioes: Number(String((L.find((l) => normChave(l[2]) === normChave("Reuniões Individuais")) || [])[3] || 0).replace(",", ".")) || 0,
      controlo: {
        mapas: mapas.filter((x) => x.feito || x.quando),
        mensalidades: mensal.filter((x) => x.feito || x.quando),
        diarios: diarios.filter((x) => x.recebidos || x.totais),
      },
      visitas: visitas.map(({ data, duracao, campos, acompanhantes }) => ({ data, duracao, campos, acompanhantes })),
    });
  });
  return { avaliacoes, escolasInfo };
}
const MESES_PT = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Escola da app que mais se parece com o título da folha ("DRAGON FORCE ALA-ARRIBA MIRA").
export function sugerirEscola(texto, escolas) {
  const t = normChave(nomeEscolaProposto(texto).replace(/^dragon force\s*/i, ""));
  if (!t) return "";
  const exata = escolas.find((e) => normChave(e.replace(/^dragon force\s*/i, "")) === t);
  if (exata) return exata;
  const cand = escolas
    .map((e) => ({ e, n: normChave(e.replace(/^dragon force\s*/i, "")) }))
    .filter((x) => x.n && (x.n.includes(t) || t.includes(x.n)))
    .sort((a, b) => Math.abs(a.n.length - t.length) - Math.abs(b.n.length - t.length));
  return cand.length ? cand[0].e : "";
}

function ImportarOperacionais({ escolas, itens, visitasGuardadas, momento, onImportar, onFechar }) {
  const [trocar, setTrocar] = useState(true);
  const [folhas, setFolhas] = useState(null);
  const [erro, setErro] = useState("");
  const [mapa, setMapa] = useState({});
  const [a, setA] = useState(false);
  const lido = useMemo(() => (folhas ? lerFicheiroOperacionais(folhas, trocar) : { avaliacoes: [], escolasInfo: [] }), [folhas, trocar]);
  const escolaDe = (folha, titulo) => (folha in mapa ? mapa[folha] : sugerirEscola(titulo, escolas) || sugerirEscola(folha, escolas));
  const comNotas = lido.avaliacoes.filter((r) => Object.keys(r.notas).length);
  const jaExiste = (r) => itens.some((x) => x.area === "operacional" && (x.momento || "periodica") === momento && x.escola === escolaDe(r.folha, r.titulo) && x.avaliado === r.avaliado && x.data === r.data);
  const novas = comNotas.filter((r) => escolaDe(r.folha, r.titulo) && !jaExiste(r));
  const visitaExiste = (esc, v) => visitasGuardadas.some((x) => x.escola === esc && x.data === v.data && (x.momento || "periodica") === momento);
  const novasVisitas = lido.escolasInfo.flatMap((e) => (escolaDe(e.folha, e.titulo) ? e.visitas.filter((v) => !visitaExiste(escolaDe(e.folha, e.titulo), v)).map((v) => ({ escola: escolaDe(e.folha, e.titulo), ...v })) : []));
  const carregar = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setA(true);
    setErro("");
    try {
      setFolhas(await lerExcelInq(f, { todas: true }));
      setMapa({});
    } catch (x) {
      setErro(x.message || String(x));
    }
    setA(false);
  };
  const confirmar = () => {
    const novos = novas.map((r) => ({ id: novoId(), area: "operacional", momento, escola: escolaDe(r.folha, r.titulo), avaliado: r.avaliado, data: r.data, notas: r.notas, avaliadores: r.avaliadores, origem: "excel" }));
    const visitas = novasVisitas.map((v) => ({ id: novoId(), momento, ...v }));
    const info = {};
    lido.escolasInfo.forEach((e) => {
      const esc = escolaDe(e.folha, e.titulo);
      if (esc) info[esc] = { coordenador: e.coordenador, operacionais: e.operacionais, local: e.local, clube: e.clube, reunioes: e.reunioes, controlo: e.controlo };
    });
    onImportar({ novos, visitas, info, repetidas: comNotas.length - novas.length });
  };
  const th = { padding: "8px 10px", borderBottom: `1px solid ${COLORS.rule}`, whiteSpace: "nowrap" };
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(900px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 19, color: COLORS.navy, flex: 1 }}>{momento === "intermedia" ? "Importar avaliações intermédias" : "Importar avaliações dos operacionais"}</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: COLORS.ink2, lineHeight: 1.55 }}>
          Escolhe o Excel com uma folha por escola. Entra tudo: notas, data de cada avaliação, visitas (duração, sinalética, entradas e saídas, documentação, placard, pack de treino, observações), quem acompanhou, reuniões e controlos. Os nomes são lidos aqui no browser e <strong>só ficam as iniciais</strong> (também nos textos livres). Avaliador: {AVALIADOR_PADRAO.operacional}. Quem ainda não tem notas fica "por avaliar", sem valores.
        </p>
        <label className="press" style={{ ...secondaryBtnStyle, width: "auto", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 14px", fontSize: 13 }}>
          <Upload size={14} /> {a ? "A ler…" : folhas ? "Escolher outro ficheiro" : "Escolher ficheiro .xlsx"}
          <input type="file" accept=".xlsx" onChange={carregar} style={{ display: "none" }} />
        </label>
        {erro && <div style={{ marginTop: 10, color: COLORS.danger, fontSize: 13 }}>{erro}</div>}
        {folhas && (
          <>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "14px 0 10px", fontSize: 13, color: COLORS.ink2, lineHeight: 1.5 }}>
              <input type="checkbox" checked={trocar} onChange={(e) => setTrocar(e.target.checked)} style={{ marginTop: 3 }} />
              <span>Trocar dia e mês das datas guardadas como data no Excel (o ficheiro mostra 12/10 como 10 de dezembro). Confirma na tabela: as datas têm de ficar no passado.</span>
            </label>
            <div style={{ overflowX: "auto", border: `1px solid ${COLORS.rule}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: COLORS.slate, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {["Folha", "Escola na app", "Avaliados", "Avaliações · datas", "Visitas", ""].map((h) => (
                      <th key={h} style={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lido.escolasInfo.map((e) => {
                    const esc = escolaDe(e.folha, e.titulo);
                    const av = comNotas.filter((r) => r.folha === e.folha);
                    const hoje = isoDe(new Date());
                    return (
                      <tr key={e.folha} style={{ borderBottom: `1px solid ${COLORS.ruleSoft}` }}>
                        <td style={{ padding: "7px 10px" }}>{e.folha}</td>
                        <td style={{ padding: "7px 10px" }}>
                          <select value={esc} onChange={(x) => setMapa((m) => ({ ...m, [e.folha]: x.target.value }))} style={{ ...inputStyle, padding: "4px 8px", fontSize: 12.5, width: "auto", maxWidth: 190, borderColor: esc ? undefined : COLORS.danger }}>
                            <option value="">— escolher —</option>
                            {escolas.map((x) => (
                              <option key={x} value={x}>
                                {x}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "7px 10px", fontWeight: 600 }}>{e.operacionais.join(", ") || "—"}</td>
                        <td style={{ padding: "7px 10px", color: COLORS.ink2 }}>
                          {av.length ? av.map((r, i) => <span key={i} style={{ marginRight: 10, whiteSpace: "nowrap", color: r.data > hoje ? COLORS.danger : undefined }}>{`${r.avaliado} ${fmtData(r.data)} · ${f1(mediaDe(r.notas))}`}</span>) : <span style={{ color: COLORS.slate }}>por avaliar</span>}
                        </td>
                        <td style={{ padding: "7px 10px" }}>{e.visitas.length || "—"}</td>
                        <td style={{ padding: "7px 10px", fontSize: 12, color: esc ? COLORS.ok : COLORS.danger }}>{esc ? "ligada" : "falta escola"}</td>
                      </tr>
                    );
                  })}
                  {!lido.escolasInfo.length && (
                    <tr>
                      <td colSpan={6} style={{ padding: 14, color: COLORS.slate }}>
                        Não encontrei folhas de escola neste ficheiro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 8 }}>
              Vão entrar {novas.length} avaliações novas e {novasVisitas.length} visitas novas{comNotas.length - novas.length > 0 ? ` (${comNotas.length - novas.length} avaliações já existiam)` : ""}.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", padding: "8px 14px", fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={confirmar} disabled={!lido.escolasInfo.length} style={{ ...primaryBtnStyle, width: "auto", padding: "8px 16px", fontSize: 13 }}>
                Importar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FormAvaliacao({ inicial, area, criterios, escolas, onGuardar, onApagar, onFechar }) {
  const [a, setA] = useState(() => ({ ...inicial, avaliadoriosTxt: (inicial.avaliadores || []).join(", ") }));
  const muda = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const valido = a.escola && String(a.avaliado || "").trim() && a.data;
  const guardar = () => {
    const notas = {};
    criterios.forEach((k) => {
      const v = nota(a.notas && a.notas[k]);
      if (v !== null) notas[k] = v;
    });
    const { avaliadoriosTxt, __novo, ...resto } = a;
    onGuardar({ ...resto, area, avaliado: String(a.avaliado).trim().toUpperCase(), notas, avaliadores: String(avaliadoriosTxt || "").split(/[,;]/).map((x) => x.trim().toUpperCase()).filter(Boolean) });
  };
  const lbl = { ...labelStyle, marginTop: 0 };
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(640px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: 22, border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 19, color: COLORS.navy, flex: 1 }}>{inicial.__novo ? "Nova avaliação" : "Avaliação"}</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <div>
            <label style={lbl}>Escola</label>
            <select value={a.escola || ""} onChange={(e) => muda("escola", e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {escolas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Avaliado (só iniciais)</label>
            <input value={a.avaliado || ""} maxLength={8} onChange={(e) => muda("avaliado", e.target.value)} placeholder="ex.: NS" style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Tipo</label>
            <select value={a.momento || "periodica"} onChange={(e) => muda("momento", e.target.value)} style={inputStyle}>
              {Object.entries(MOMENTOS).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Data da avaliação</label>
            <input type="date" value={a.data || ""} onChange={(e) => muda("data", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Quem avaliou (iniciais)</label>
            <input value={a.avaliadoriosTxt} onChange={(e) => muda("avaliadoriosTxt", e.target.value)} placeholder={`ex.: ${AVALIADOR_PADRAO[area]}`} style={inputStyle} />
          </div>
        </div>
        <div style={{ ...labelStyle, marginTop: 14, marginBottom: 6 }}>Notas (1 a 5; deixa vazio o que não foi avaliado)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
          {criterios.map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontSize: 13 }}>{k}</span>
              <select value={(a.notas && a.notas[k]) || ""} onChange={(e) => muda("notas", { ...(a.notas || {}), [k]: e.target.value })} style={{ ...inputStyle, width: 64, padding: "5px 8px" }}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={lbl}>Notas livres (sem nomes)</label>
          <textarea value={a.obs || ""} onChange={(e) => muda("obs", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
          {!inicial.__novo && (
            <button onClick={onApagar} style={{ ...linkBtnStyle, color: COLORS.danger, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Trash2 size={14} /> Apagar
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", padding: "8px 14px", fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={!valido} style={{ ...primaryBtnStyle, width: "auto", padding: "8px 16px", fontSize: 13, opacity: valido ? 1 : 0.5 }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Progressao({ grupo, criterios, visitas, onEditar, onNova, onFechar }) {
  const hist = [...grupo.itens].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const datas = [...new Set(hist.filter((h) => h.data).map((h) => h.data))];
  const serie = datas.map((d) => {
    const linha = { data: fmtData(d) };
    ["periodica", "intermedia"].forEach((m) => {
      const x = hist.find((h) => h.data === d && (h.momento || "periodica") === m);
      const v = x ? mediaDe(x.notas) : null;
      linha[MOMENTOS[m]] = v === null ? null : Math.round(v * 10) / 10;
    });
    return linha;
  });
  const temInter = hist.some((h) => h.momento === "intermedia");
  const minhas = (visitas || []).filter((v) => v.escola === grupo.escola).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(860px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: 22, border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 19, color: COLORS.navy, flex: 1 }}>
            {grupo.avaliado} · {grupo.escola}
          </h2>
          <button onClick={() => onNova(grupo)} className="press" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Nova avaliação
          </button>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {serie.length > 1 && (
          <div style={{ height: 190, marginBottom: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 0, left: -18 }}>
                <CartesianGrid stroke={COLORS.rule} vertical={false} />
                <XAxis dataKey="data" tick={{ fontSize: 11, fill: COLORS.slate }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: COLORS.slate }} />
                <Tooltip />
                <Line type="monotone" dataKey={MOMENTOS.periodica} stroke={COLORS.navy} strokeWidth={2.2} dot={{ r: 4 }} connectNulls />
                {temInter && <Line type="monotone" dataKey={MOMENTOS.intermedia} stroke={COLORS.warn} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4 }} connectNulls />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: COLORS.slate, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "8px 8px" }}>Data</th>
                <th style={{ padding: "8px 6px" }}>Tipo</th>
                {criterios.map((k) => (
                  <th key={k} title={k} style={{ padding: "8px 4px", textAlign: "center" }}>
                    {abrev(k)}
                  </th>
                ))}
                <th style={{ padding: "8px 6px", textAlign: "center" }}>Média</th>
                <th style={{ padding: "8px 8px" }}>Avaliou</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...hist].reverse().map((h) => (
                <tr key={h.id} style={{ borderTop: `1px solid ${COLORS.ruleSoft}` }}>
                  <td style={{ padding: "7px 8px", whiteSpace: "nowrap", color: h.data ? undefined : COLORS.danger }}>{fmtData(h.data)}</td>
                  <td style={{ padding: "7px 6px" }}>
                    <span style={{ fontSize: 11.5, padding: "2px 7px", borderRadius: 6, background: h.momento === "intermedia" ? COLORS.warnBg : COLORS.navyWash, color: h.momento === "intermedia" ? COLORS.warn : COLORS.navy, fontWeight: 600, whiteSpace: "nowrap" }}>{MOMENTOS[h.momento || "periodica"]}</span>
                  </td>
                  {criterios.map((k) => {
                    const v = nota(h.notas && h.notas[k]);
                    return (
                      <td key={k} style={{ padding: "5px 6px", textAlign: "center" }}>
                        <span style={{ display: "inline-block", minWidth: 26, padding: "2px 0", borderRadius: 6, background: fundoNota(v), color: corNota(v), fontWeight: 600 }}>{v === null ? "" : v}</span>
                      </td>
                    );
                  })}
                  <td style={{ padding: "7px 6px", textAlign: "center", fontWeight: 700, color: corNota(mediaDe(h.notas)) }}>{f1(mediaDe(h.notas))}</td>
                  <td style={{ padding: "7px 8px", color: COLORS.ink2 }}>{(h.avaliadores || []).join(", ") || "—"}</td>
                  <td style={{ padding: "7px 4px" }}>
                    <button onClick={() => onEditar(h)} style={iconBtnStyle} aria-label="Editar">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hist.some((h) => h.obs) && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.6 }}>
            {[...hist].reverse().filter((h) => h.obs).map((h) => (
              <div key={h.id}>
                <strong>{fmtData(h.data)}:</strong> {h.obs}
              </div>
            ))}
          </div>
        )}
        {minhas.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Visitas a esta escola</div>
            {minhas.map((v) => (
              <div key={v.id} style={{ fontSize: 12.5, padding: "6px 0", borderTop: `1px solid ${COLORS.ruleSoft}`, lineHeight: 1.55 }}>
                <strong>{fmtData(v.data)}</strong>
                {v.duracao ? ` · ${v.duracao}` : ""}
                {(v.acompanhantes || []).length ? ` · com ${v.acompanhantes.join(", ")}` : ""}
                {Object.entries(v.campos || {}).map(([k, t]) => (
                  <div key={k} style={{ color: COLORS.ink2 }}>
                    <span style={{ color: COLORS.slate }}>{k}:</span> {t}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PainelVisitas({ visitas, info, escolas, epoca, fEsc }) {
  const lista = visitas.filter((v) => (epoca === "todas" || epocaDe(v.data) === epoca) && (fEsc === "todas" || v.escola === fEsc)).sort((a, b) => String(b.data).localeCompare(String(a.data)) || a.escola.localeCompare(b.escola, "pt"));
  const chaves = [];
  lista.forEach((v) => Object.keys(v.campos || {}).forEach((k) => !chaves.includes(k) && chaves.push(k)));
  const escolasInfo = Object.entries(info || {}).filter(([e]) => fEsc === "todas" || e === fEsc).sort((a, b) => a[0].localeCompare(b[0], "pt"));
  const nVis = (e) => visitas.filter((v) => v.escola === e).length;
  const ultima = (e) => visitas.filter((v) => v.escola === e).map((v) => v.data).sort().pop();
  const th = { padding: "9px 10px", textAlign: "left", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em", color: COLORS.slate, whiteSpace: "nowrap" };
  const td = { padding: "7px 10px", verticalAlign: "top", fontSize: 12.5, borderTop: `1px solid ${COLORS.ruleSoft}` };
  if (!lista.length && !escolasInfo.length) return <Vazio icon={Upload} titulo="Ainda sem visitas" texto="Importa o Excel dos operacionais: as visitas e as informações de cada escola entram juntas com as avaliações." />;
  return (
    <>
      {escolasInfo.length > 0 && (
        <div style={{ ...panelStyle, padding: 0, overflowX: "auto", marginBottom: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Escola", "Coord. técnico", "Operacionais", "Local · Clube", "Visitas", "Última", "Reuniões ind.", "Mapas de controlo", "Mensalidades"].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {escolasInfo.map(([e, i]) => (
                <tr key={e}>
                  <td style={{ ...td, fontWeight: 600 }}>{e}</td>
                  <td style={td}>{i.coordenador || "—"}</td>
                  <td style={td}>{(i.operacionais || []).join(", ") || "—"}</td>
                  <td style={td}>{[i.local, i.clube].filter(Boolean).join(" · ") || "—"}</td>
                  <td style={td}>{nVis(e) || "—"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{ultima(e) ? fmtData(ultima(e)) : "—"}</td>
                  <td style={td}>{i.reunioes || "—"}</td>
                  <td style={td}>{((i.controlo || {}).mapas || []).filter((m) => m.feito).length || "—"}</td>
                  <td style={td}>{((i.controlo || {}).mensalidades || []).filter((m) => m.feito).length || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ ...panelStyle, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Data", "Escola", "Duração", "Com", ...chaves].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v.id}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  {fmtData(v.data)}
                  {v.momento === "intermedia" && <span style={{ marginLeft: 6, fontSize: 11, color: COLORS.warn, fontWeight: 600 }}>interm.</span>}
                </td>
                <td style={{ ...td, fontWeight: 600 }}>{v.escola}</td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{v.duracao || "—"}</td>
                <td style={td}>{(v.acompanhantes || []).join(", ") || "—"}</td>
                {chaves.map((k) => (
                  <td key={k} style={{ ...td, minWidth: k === "Observações" ? 220 : 110 }}>
                    {(v.campos || {})[k] || ""}
                  </td>
                ))}
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={4} style={{ ...td, color: COLORS.slate }}>
                  Sem visitas com estes filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AvaliacoesPage({ dados, escolas, onGuardar, notificar }) {
  const itens = dados.itens || [];
  const visitas = dados.visitas || [];
  const info = dados.escolasInfo || {};
  const roster = dados.roster || {};
  const [area, setArea] = useState("operacional");
  const [epoca, setEpoca] = useState("todas");
  const [fEsc, setFEsc] = useState("todas");
  const [fMom, setFMom] = useState("todos");
  const [editar, setEditar] = useState(null);
  const [ver, setVer] = useState(null);
  const [importar, setImportar] = useState(null); // "periodica" | "intermedia"
  const [defCrit, setDefCrit] = useState(false);
  const criterios = area === "tecnica" ? dados.criteriosTecnica || [] : CRITERIOS_OPERACIONAL;
  const daArea = itens.filter((i) => i.area === (area === "tecnica" ? "tecnica" : "operacional"));
  const epocas = [...new Set([...daArea, ...visitas].map((i) => epocaDe(i.data)).filter(Boolean))].sort().reverse();
  const filtradas = daArea.filter((i) => (epoca === "todas" || epocaDe(i.data) === epoca) && (fEsc === "todas" || i.escola === fEsc) && (fMom === "todos" || (i.momento || "periodica") === fMom));

  const grupos = useMemo(() => {
    const m = {};
    filtradas.forEach((i) => {
      const k = `${i.escola}|${i.avaliado}`;
      (m[k] = m[k] || { chave: k, escola: i.escola, avaliado: i.avaliado, itens: [] }).itens.push(i);
    });
    return Object.values(m)
      .map((g) => {
        const ord = [...g.itens].sort((a, b) => String(b.data).localeCompare(String(a.data)));
        const ult = ord[0];
        const ant = ord[1];
        const mu = mediaDe(ult.notas);
        const ma = ant ? mediaDe(ant.notas) : null;
        return { ...g, ult, n: ord.filter((x) => x.momento !== "intermedia").length, nInter: ord.filter((x) => x.momento === "intermedia").length, media: mu, delta: mu !== null && ma !== null ? mu - ma : null };
      })
      .sort((a, b) => a.escola.localeCompare(b.escola, "pt") || a.avaliado.localeCompare(b.avaliado));
  }, [filtradas]);

  // Operacionais conhecidos (da importação) que ainda não têm nenhuma avaliação: ficam sem valores.
  const porAvaliar =
    area === "operacional"
      ? Object.entries(roster)
          .filter(([esc]) => !daArea.some((i) => i.escola === esc) && (fEsc === "todas" || fEsc === esc))
          .sort((a, b) => a[0].localeCompare(b[0], "pt"))
      : [];

  const guardar = (a) => {
    const lista = itens.some((x) => x.id === a.id) ? itens.map((x) => (x.id === a.id ? a : x)) : [...itens, a];
    const r = { ...roster };
    if (a.area === "operacional" && a.escola && a.avaliado) r[a.escola] = a.avaliado;
    onGuardar({ ...dados, itens: lista, roster: r });
    setEditar(null);
    notificar && notificar("Avaliação guardada.");
  };
  const apagar = (id) => {
    onGuardar({ ...dados, itens: itens.filter((x) => x.id !== id) });
    setEditar(null);
    setVer(null);
  };
  const areaDados = area === "tecnica" ? "tecnica" : "operacional";
  const nova = (base = {}) => setEditar({ __novo: true, id: novoId(), area: areaDados, momento: "periodica", escola: "", avaliado: "", data: isoDe(new Date()), notas: {}, avaliadores: [AVALIADOR_PADRAO[areaDados]], obs: "", ...base });
  const importado = ({ novos, visitas: vs, info: inf, repetidas }) => {
    const rost = {};
    Object.entries(inf).forEach(([esc, i]) => {
      if ((i.operacionais || []).length) rost[esc] = i.operacionais[0];
    });
    onGuardar({ ...dados, itens: [...itens, ...novos], visitas: [...visitas, ...vs], escolasInfo: { ...info, ...inf }, roster: { ...roster, ...rost } });
    setImportar(null);
    notificar && notificar(`${novos.length} avaliações e ${vs.length} visitas importadas${repetidas ? ` (${repetidas} avaliações já existiam)` : ""}.`);
  };

  const comMedia = grupos.filter((g) => g.media !== null);
  const mediaGeral = comMedia.length ? comMedia.reduce((t, g) => t + g.media, 0) / comMedia.length : null;
  const sobem = grupos.filter((g) => g.delta !== null && g.delta > 0.05).length;
  const descem = grupos.filter((g) => g.delta !== null && g.delta < -0.05).length;
  const sel = { ...inputStyle, width: "auto", maxWidth: 220, padding: "6px 10px", fontSize: 13 };
  const aba = (k, t) => (
    <button key={k} onClick={() => setArea(k)} className="press" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 14px", fontSize: 13, fontWeight: area === k ? 700 : 500, background: area === k ? COLORS.navyWash : undefined, color: area === k ? COLORS.navy : undefined, borderColor: area === k ? COLORS.navy : undefined }}>
      {t}
    </button>
  );
  const botaoImp = (txt, mom) => (
    <button key={mom} onClick={() => setImportar(mom)} className="press" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Upload size={14} /> {txt}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {aba("operacional", "Operacionais")}
        {aba("tecnica", "Área técnica")}
        {aba("visitas", "Visitas às escolas")}
        <span style={{ width: 8 }} />
        <select value={epoca} onChange={(e) => setEpoca(e.target.value)} style={sel}>
          <option value="todas">Todas as épocas</option>
          {epocas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select value={fEsc} onChange={(e) => setFEsc(e.target.value)} style={sel}>
          <option value="todas">Todas as escolas</option>
          {escolas.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {area !== "visitas" && (
          <select value={fMom} onChange={(e) => setFMom(e.target.value)} style={sel}>
            <option value="todos">Avaliações e intermédias</option>
            <option value="periodica">Só avaliações</option>
            <option value="intermedia">Só intermédias</option>
          </select>
        )}
        <span style={{ flex: 1 }} />
        {area === "tecnica" && (
          <button onClick={() => setDefCrit(true)} className="press" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13 }}>
            Critérios
          </button>
        )}
        {area !== "tecnica" && [botaoImp("Importar Excel", "periodica"), botaoImp("Importar intermédias", "intermedia")]}
        {area !== "visitas" && (
          <button onClick={() => (criterios.length ? nova() : setDefCrit(true))} className="press" style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Nova avaliação
          </button>
        )}
      </div>

      {area === "visitas" ? (
        <PainelVisitas visitas={visitas} info={info} escolas={escolas} epoca={epoca} fEsc={fEsc} />
      ) : area === "tecnica" && !criterios.length ? (
        <Vazio icon={Pencil} titulo="Define os critérios da área técnica" texto={`Diz quais são os critérios (ex.: planeamento, comunicação, relação com os atletas…) e depois carrega as avaliações à mão (avaliador ${AVALIADOR_PADRAO.tecnica}). Se me enviares o Excel, faço a importação como nos operacionais.`} acao="Definir critérios" onAcao={() => setDefCrit(true)} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 14 }}>
            <StatCard label="Avaliados" value={grupos.length} subtitle={area === "operacional" ? `${porAvaliar.length} ainda por avaliar` : "com pelo menos 1 avaliação"} />
            <StatCard label="Avaliações" value={filtradas.length} subtitle={`${filtradas.filter((x) => x.momento === "intermedia").length} intermédias`} />
            <StatCard label="Média atual" value={f1(mediaGeral)} color={corNota(mediaGeral)} subtitle="última avaliação de cada um" />
            <StatCard label="Evolução" value={`${sobem} ↑  ${descem} ↓`} subtitle="face à avaliação anterior" />
          </div>

          {!grupos.length && !porAvaliar.length ? (
            <Vazio icon={Plus} titulo="Ainda não há avaliações" texto={area === "operacional" ? "Importa o Excel dos operacionais ou junta uma avaliação à mão." : "Junta a primeira avaliação à mão."} />
          ) : (
            <div style={{ ...panelStyle, padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: COLORS.slate, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>
                    <th style={{ padding: "10px 12px" }}>Escola</th>
                    <th style={{ padding: "10px 8px" }}>Avaliado</th>
                    <th style={{ padding: "10px 8px" }}>Última</th>
                    <th style={{ padding: "10px 8px", textAlign: "center" }}>Nº</th>
                    {criterios.map((k) => (
                      <th key={k} title={k} style={{ padding: "10px 4px", textAlign: "center" }}>
                        {abrev(k)}
                      </th>
                    ))}
                    <th style={{ padding: "10px 8px", textAlign: "center" }}>Média</th>
                    <th style={{ padding: "10px 8px", textAlign: "center" }}>vs anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr key={g.chave} onClick={() => setVer(g.chave)} style={{ borderTop: `1px solid ${COLORS.ruleSoft}`, cursor: "pointer" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{g.escola}</td>
                      <td style={{ padding: "8px" }}>{g.avaliado}</td>
                      <td style={{ padding: "8px", whiteSpace: "nowrap", color: g.ult.data ? undefined : COLORS.danger }}>
                        {fmtData(g.ult.data)}
                        {g.ult.momento === "intermedia" && <span style={{ marginLeft: 6, fontSize: 11, color: COLORS.warn, fontWeight: 600 }}>interm.</span>}
                      </td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        {g.n}
                        {g.nInter > 0 && <span style={{ color: COLORS.warn, fontSize: 11.5 }}> +{g.nInter}</span>}
                      </td>
                      {criterios.map((k) => {
                        const v = nota(g.ult.notas && g.ult.notas[k]);
                        return (
                          <td key={k} style={{ padding: "5px 4px", textAlign: "center" }}>
                            <span style={{ display: "inline-block", minWidth: 26, padding: "2px 0", borderRadius: 6, background: fundoNota(v), color: corNota(v), fontWeight: 600 }}>{v === null ? "" : v}</span>
                          </td>
                        );
                      })}
                      <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, color: corNota(g.media) }}>{f1(g.media)}</td>
                      <td style={{ padding: "8px", textAlign: "center", color: g.delta === null ? COLORS.slate : g.delta > 0.05 ? COLORS.ok : g.delta < -0.05 ? COLORS.danger : COLORS.slate }}>
                        {g.delta === null ? "—" : g.delta > 0.05 ? <TrendingUp size={15} /> : g.delta < -0.05 ? <TrendingDown size={15} /> : <Minus size={15} />}
                      </td>
                    </tr>
                  ))}
                  {porAvaliar.map(([esc, ini]) => (
                    <tr key={esc} style={{ borderTop: `1px solid ${COLORS.ruleSoft}`, color: COLORS.slate }}>
                      <td style={{ padding: "8px 12px" }}>{esc}</td>
                      <td style={{ padding: "8px" }}>{ini}</td>
                      <td colSpan={criterios.length + 4} style={{ padding: "8px", fontSize: 12.5 }}>
                        por avaliar{" "}
                        <button onClick={() => nova({ escola: esc, avaliado: ini })} style={{ ...linkBtnStyle, marginLeft: 8, fontSize: 12.5 }}>
                          + avaliação
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {ver && grupos.find((g) => g.chave === ver) && (
        <Progressao
          grupo={grupos.find((g) => g.chave === ver)}
          criterios={criterios}
          visitas={visitas}
          onEditar={(h) => setEditar({ ...h })}
          onNova={(g) => nova({ escola: g.escola, avaliado: g.avaliado })}
          onFechar={() => setVer(null)}
        />
      )}
      {editar && <FormAvaliacao inicial={editar} area={editar.area || areaDados} criterios={(editar.area || areaDados) === "tecnica" ? dados.criteriosTecnica || [] : CRITERIOS_OPERACIONAL} escolas={escolas} onGuardar={guardar} onApagar={() => apagar(editar.id)} onFechar={() => setEditar(null)} />}
      {importar && <ImportarOperacionais escolas={escolas} itens={itens} visitasGuardadas={visitas} momento={importar} onImportar={importado} onFechar={() => setImportar(null)} />}
      {defCrit && (
        <DefinirCriterios
          atual={dados.criteriosTecnica || []}
          onGuardar={(l) => {
            onGuardar({ ...dados, criteriosTecnica: l });
            setDefCrit(false);
          }}
          onFechar={() => setDefCrit(false)}
        />
      )}
    </div>
  );
}

function DefinirCriterios({ atual, onGuardar, onFechar }) {
  const [t, setT] = useState(atual.join("\n"));
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(480px, 100%)", background: COLORS.paperRaised, borderRadius: 14, padding: 22, border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, color: COLORS.navy }}>Critérios da área técnica</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: COLORS.ink2 }}>Um por linha. Mudar o nome de um critério não apaga as notas antigas, mas deixam de aparecer.</p>
        <textarea value={t} onChange={(e) => setT(e.target.value)} rows={8} style={{ ...inputStyle, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", padding: "8px 14px", fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={() => onGuardar([...new Set(t.split("\n").map((x) => x.trim()).filter(Boolean))])} style={{ ...primaryBtnStyle, width: "auto", padding: "8px 16px", fontSize: 13 }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
