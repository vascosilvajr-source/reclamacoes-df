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

// "Inês Moreira (N)" -> "I.M." (primeiro e último nome). Nada do nome completo é guardado.
export function iniciaisDe(nome) {
  const limpo = String(nome || "")
    .replace(/\(.*?\)/g, "")
    .replace(/\bDep\b.*$/i, "")
    .trim();
  const p = limpo.split(/\s+/).filter((w) => w && !PARTICULAS.has(w.toLowerCase()));
  if (!p.length) return "";
  const letra = (w) => (w.match(/\p{L}/u) || [""])[0].toLocaleUpperCase("pt-PT");
  return (p.length === 1 ? letra(p[0]) : letra(p[0]) + "." + letra(p[p.length - 1])) + ".";
}
// "Pedro Pinto, Ana Cunha e Rafaela Dep. Psicologia" -> ["P.P.", "A.C.", "R."]
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

// Lê o Excel dos operacionais: uma folha por escola (a primeira é a lista geral e é ignorada).
export function lerAvaliacoesOperacionais(folhas, trocarDatas) {
  const res = [];
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
    // Visitas (coluna K) e quem as acompanhou (coluna L, abaixo de "REGISTO ACOMPANHAMENTO").
    const visitas = [];
    for (let n = nCab + 1; n <= nCab + 5; n++) {
      const l = porLinha(n);
      const d = dataDoExcel(l[10], trocarDatas);
      if (d) visitas.push({ linha: n, data: d });
    }
    const cabAc = L.find((l) => normChave(l[11]) === normChave("REGISTO ACOMPANHAMENTO"));
    const acompanham = {};
    if (cabAc) {
      L.filter((l) => l.__linha > cabAc.__linha && l.__linha <= cabAc.__linha + 14).forEach((l) => {
        const d = dataDoExcel(l[10], trocarDatas);
        if (d && String(l[11] || "").trim()) acompanham[d] = iniciaisDeLista(l[11]);
      });
    }
    for (let n = nCab + 1; n <= nCab + 4; n++) {
      const l = porLinha(n);
      const nome = String(l[0] || "").trim();
      if (!nome) continue;
      const notas = {};
      colunas.forEach(([c, k]) => {
        const v = nota(l[c]);
        if (v !== null) notas[k] = v;
      });
      const v = visitas.find((x) => x.linha === n) || visitas[0];
      res.push({ folha: f.nome, titulo, avaliado: iniciaisDe(nome), notas, data: Object.keys(notas).length && v ? v.data : "", avaliadores: v ? acompanham[v.data] || [] : [] });
    }
  });
  return res;
}

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

function ImportarOperacionais({ escolas, itens, onImportar, onFechar }) {
  const [trocar, setTrocar] = useState(true);
  const [folhas, setFolhas] = useState(null);
  const [erro, setErro] = useState("");
  const [mapa, setMapa] = useState({});
  const [a, setA] = useState(false);
  const lido = useMemo(() => (folhas ? lerAvaliacoesOperacionais(folhas, trocar) : []), [folhas, trocar]);
  const escolaDe = (r) => (r.folha in mapa ? mapa[r.folha] : sugerirEscola(r.titulo, escolas) || sugerirEscola(r.folha, escolas));
  const comNotas = lido.filter((r) => Object.keys(r.notas).length);
  const semNotas = lido.filter((r) => !Object.keys(r.notas).length);
  const jaExiste = (r) => itens.some((x) => x.area === "operacional" && x.escola === escolaDe(r) && x.avaliado === r.avaliado && x.data === r.data);
  const novas = comNotas.filter((r) => escolaDe(r) && !jaExiste(r));
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
    const novos = novas.map((r) => ({ id: novoId(), area: "operacional", escola: escolaDe(r), avaliado: r.avaliado, data: r.data, notas: r.notas, avaliadores: r.avaliadores, origem: "excel" }));
    const roster = {};
    lido.forEach((r) => {
      if (escolaDe(r)) roster[escolaDe(r)] = r.avaliado;
    });
    onImportar(novos, roster, comNotas.length - novas.length);
  };
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(860px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: "22px", border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 19, color: COLORS.navy, flex: 1 }}>Importar avaliações dos operacionais</h2>
          <button onClick={onFechar} style={iconBtnStyle} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: COLORS.ink2, lineHeight: 1.55 }}>
          Escolhe o Excel com uma folha por escola. Os nomes são lidos aqui no browser e <strong>só ficam as iniciais</strong>. Quem ainda não tem notas não é importado (aparece como "por avaliar").
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
              <span>
                Trocar dia e mês das datas guardadas como data no Excel (o ficheiro mostra 12/10 como 10 de dezembro). Confirma na tabela: as datas têm de ficar no passado e dentro da época.
              </span>
            </label>
            <div style={{ overflowX: "auto", border: `1px solid ${COLORS.rule}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: COLORS.slate, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em" }}>
                    {["Folha", "Escola na app", "Avaliado", "Data", "Média", "Avaliadores", ""].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.rule}`, whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comNotas.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${COLORS.ruleSoft}` }}>
                      <td style={{ padding: "7px 10px" }}>{r.folha}</td>
                      <td style={{ padding: "7px 10px" }}>
                        <select value={escolaDe(r)} onChange={(e) => setMapa((m) => ({ ...m, [r.folha]: e.target.value }))} style={{ ...inputStyle, padding: "4px 8px", fontSize: 12.5, width: "auto", maxWidth: 200, borderColor: escolaDe(r) ? undefined : COLORS.danger }}>
                          <option value="">— escolher —</option>
                          {escolas.map((e) => (
                            <option key={e} value={e}>
                              {e}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.avaliado}</td>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap", color: r.data && r.data > isoDe(new Date()) ? COLORS.danger : undefined }}>{fmtData(r.data)}</td>
                      <td style={{ padding: "7px 10px" }}>{f1(mediaDe(r.notas))}</td>
                      <td style={{ padding: "7px 10px", color: COLORS.ink2 }}>{r.avaliadores.join(", ") || "—"}</td>
                      <td style={{ padding: "7px 10px", fontSize: 12, color: jaExiste(r) ? COLORS.slate : COLORS.ok }}>{!escolaDe(r) ? "falta escola" : jaExiste(r) ? "já existe" : "nova"}</td>
                    </tr>
                  ))}
                  {!comNotas.length && (
                    <tr>
                      <td colSpan={7} style={{ padding: 14, color: COLORS.slate }}>
                        Não encontrei avaliações com notas neste ficheiro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 8 }}>
              {semNotas.length} escola{semNotas.length === 1 ? "" : "s"} sem notas (ficam como "por avaliar", sem valores). Avaliações sem data podem ser corrigidas depois.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", padding: "8px 14px", fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={confirmar} disabled={!novas.length && !lido.length} style={{ ...primaryBtnStyle, width: "auto", padding: "8px 16px", fontSize: 13 }}>
                Importar {novas.length} avaliações
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
            <input value={a.avaliado || ""} maxLength={8} onChange={(e) => muda("avaliado", e.target.value)} placeholder="ex.: N.S." style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Data da avaliação</label>
            <input type="date" value={a.data || ""} onChange={(e) => muda("data", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Quem avaliou (iniciais)</label>
            <input value={a.avaliadoriosTxt} onChange={(e) => muda("avaliadoriosTxt", e.target.value)} placeholder="ex.: P.P., A.C." style={inputStyle} />
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

function Progressao({ grupo, criterios, onEditar, onNova, onFechar }) {
  const hist = [...grupo.itens].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const serie = hist.filter((h) => h.data).map((h) => ({ data: fmtData(h.data), Média: mediaDe(h.notas) === null ? null : Math.round(mediaDe(h.notas) * 10) / 10 }));
  return (
    <div className="veil" style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onFechar}>
      <div className="sheet" style={{ width: "min(820px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: COLORS.paperRaised, borderRadius: 14, padding: 22, border: `1px solid ${COLORS.rule}` }} onClick={(e) => e.stopPropagation()}>
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
                <Line type="monotone" dataKey="Média" stroke={COLORS.navy} strokeWidth={2.2} dot={{ r: 4 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: COLORS.slate, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>
                <th style={{ padding: "8px 8px" }}>Data</th>
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
      </div>
    </div>
  );
}

export function AvaliacoesPage({ dados, escolas, onGuardar, notificar }) {
  const itens = dados.itens || [];
  const roster = dados.roster || {};
  const [area, setArea] = useState("operacional");
  const [epoca, setEpoca] = useState("todas");
  const [fEsc, setFEsc] = useState("todas");
  const [editar, setEditar] = useState(null);
  const [ver, setVer] = useState(null);
  const [importar, setImportar] = useState(false);
  const [defCrit, setDefCrit] = useState(false);
  const criterios = area === "operacional" ? CRITERIOS_OPERACIONAL : dados.criteriosTecnica || [];
  const daArea = itens.filter((i) => i.area === area);
  const epocas = [...new Set(daArea.map((i) => epocaDe(i.data)).filter(Boolean))].sort().reverse();
  const filtradas = daArea.filter((i) => (epoca === "todas" || epocaDe(i.data) === epoca) && (fEsc === "todas" || i.escola === fEsc));

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
        return { ...g, ult, n: ord.length, media: mu, delta: mu !== null && ma !== null ? mu - ma : null };
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
  const nova = (base = {}) => setEditar({ __novo: true, id: novoId(), area, escola: "", avaliado: "", data: isoDe(new Date()), notas: {}, avaliadores: [], obs: "", ...base });
  const importado = (novos, rost, repetidas) => {
    onGuardar({ ...dados, itens: [...itens, ...novos], roster: { ...roster, ...rost } });
    setImportar(false);
    notificar && notificar(`${novos.length} avaliações importadas${repetidas ? ` (${repetidas} já existiam)` : ""}.`);
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

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {aba("operacional", "Operacionais")}
        {aba("tecnica", "Área técnica")}
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
        <span style={{ flex: 1 }} />
        {area === "tecnica" && (
          <button onClick={() => setDefCrit(true)} className="press" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13 }}>
            Critérios
          </button>
        )}
        {area === "operacional" && (
          <button onClick={() => setImportar(true)} className="press" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} /> Importar Excel
          </button>
        )}
        <button onClick={() => (criterios.length ? nova() : setDefCrit(true))} className="press" style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Nova avaliação
        </button>
      </div>

      {area === "tecnica" && !criterios.length ? (
        <Vazio icon={Pencil} titulo="Define os critérios da área técnica" texto="Diz quais são os critérios (ex.: planeamento, comunicação, relação com os atletas…) e depois carrega as avaliações à mão. Se me enviares o Excel, faço a importação como nos operacionais." acao="Definir critérios" onAcao={() => setDefCrit(true)} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 14 }}>
            <StatCard label="Avaliados" value={grupos.length} subtitle={area === "operacional" ? `${porAvaliar.length} ainda por avaliar` : "com pelo menos 1 avaliação"} />
            <StatCard label="Avaliações" value={filtradas.length} subtitle="registadas" />
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
                      <td style={{ padding: "8px", whiteSpace: "nowrap", color: g.ult.data ? undefined : COLORS.danger }}>{fmtData(g.ult.data)}</td>
                      <td style={{ padding: "8px", textAlign: "center" }}>{g.n}</td>
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
          onEditar={(h) => setEditar({ ...h })}
          onNova={(g) => nova({ escola: g.escola, avaliado: g.avaliado })}
          onFechar={() => setVer(null)}
        />
      )}
      {editar && <FormAvaliacao inicial={editar} area={editar.area || area} criterios={editar.area === "tecnica" || area === "tecnica" ? dados.criteriosTecnica || [] : CRITERIOS_OPERACIONAL} escolas={escolas} onGuardar={guardar} onApagar={() => apagar(editar.id)} onFechar={() => setEditar(null)} />}
      {importar && <ImportarOperacionais escolas={escolas} itens={itens} onImportar={importado} onFechar={() => setImportar(false)} />}
      {defCrit && <DefinirCriterios atual={dados.criteriosTecnica || []} onGuardar={(l) => { onGuardar({ ...dados, criteriosTecnica: l }); setDefCrit(false); }} onFechar={() => setDefCrit(false)} />}
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
