// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Eventos com várias semanas (Foot Camp): inscrições por semana, a partir do Excel das inscrições.
// Só se guardam CONTAGENS (nunca nomes, NIF nem datas de nascimento): o Excel é lido no browser.
import { useState } from "react";
import { Plus, X, Upload, Trash2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from "recharts";
import { COLORS, fmt, iconBtnStyle, inputStyle, isoDe, labelStyle, normChave, panelStyle, primaryBtnStyle, secondaryBtnStyle } from "../nucleo.jsx";
import { fmtNum, lerExcelInq, thStyle, tdStyle } from "../partilhado.jsx";

const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const p2 = (n) => String(n).padStart(2, "0");

// "29 de junho a 3 de Julho" / "6 a 10 de Julho" -> { ini, fim } em ISO.
function intervalo(texto, ano) {
  const t = normChave(texto);
  const m = t.match(/^(\d{1,2})(?:\s+de\s+([a-z]+))?\s+a\s+(\d{1,2})\s+de\s+([a-z]+)/);
  if (!m) return null;
  const mesFim = MESES[m[4]];
  const mesIni = m[2] ? MESES[m[2]] : mesFim;
  if (!mesFim || !mesIni) return null;
  return { ini: `${ano}-${p2(mesIni)}-${p2(m[1])}`, fim: `${ano}-${p2(mesFim)}-${p2(m[3])}` };
}

// Lê o Excel: folha com a coluna "Semana" (uma linha por inscrição numa semana) e, à parte,
// a folha das desistências. Devolve só contagens.
export function lerCamp(folhas, ano) {
  const cabDe = (fo) => {
    for (let i = 0; i < Math.min(10, fo.linhas.length); i++) {
      const cab = (fo.linhas[i] || []).map(normChave);
      if (cab.includes("semana") && (cab.includes("programa") || cab.includes("nif"))) return { i, cab };
    }
    return null;
  };
  const candidatas = folhas.map((fo) => ({ fo, c: cabDe(fo) })).filter((x) => x.c);
  const principal = candidatas.find((x) => /verao|ver.o/i.test(normChave(x.fo.nome))) || candidatas.find((x) => !/desist/i.test(x.fo.nome)) || candidatas[0];
  if (!principal) throw new Error("não encontrei uma folha com a coluna «Semana»");
  const col = (cab, ...nomes) => nomes.map((n) => cab.indexOf(n)).find((j) => j >= 0) ?? -1;
  const { cab, i: iCab } = principal.c;
  const cSem = col(cab, "semana");
  const cCond = col(cab, "aluno df", "condicao df", "condicao");
  const cEsc = col(cab, "escola df", "escola");
  const cProg = col(cab, "programa");
  const cHor = col(cab, "horario");
  const cNif = col(cab, "nif");
  const cNome = col(cab, "nome");
  const cNasc = col(cab, "data de nascimento");
  const cRub = col(cab, "rubrica");
  const semNum = (v) => {
    const m = String(v ?? "").match(/(\d+)/);
    return m ? Number(m[1]) : null;
  };
  const dados = principal.fo.linhas.slice(iCab + 1).filter((l) => semNum(l[cSem]) !== null && String(l[cNome >= 0 ? cNome : 0] ?? "").trim());
  if (!dados.length) throw new Error("a folha não tem inscrições");

  const semanas = {};
  const total = { insc: 0 };
  const unicos = new Set();
  const chavePessoa = (l) => (cNif >= 0 && String(l[cNif] ?? "").trim() ? `n:${String(l[cNif]).trim()}` : `p:${normChave(l[cNome])}|${String(l[cNasc] ?? "")}`);
  const cont = (obj, k) => {
    const nome = String(k ?? "").trim() || "Sem indicação";
    obj[nome] = (obj[nome] || 0) + 1;
  };
  const porCond = {};
  const porProg = {};
  const porHor = {};
  const porEscola = {};
  let melhorLista = [];
  dados.forEach((l) => {
    const n = semNum(l[cSem]);
    const s = (semanas[n] = semanas[n] || { n, insc: 0, pessoas: new Set(), desist: 0 });
    s.insc++;
    s.pessoas.add(chavePessoa(l));
    unicos.add(chavePessoa(l));
    total.insc++;
    if (cCond >= 0) cont(porCond, l[cCond]);
    if (cProg >= 0) cont(porProg, l[cProg]);
    if (cHor >= 0) cont(porHor, l[cHor]);
    const esc = cEsc >= 0 ? String(l[cEsc] ?? "").trim().replace(/^drago(n)?\s+force\s+/i, "") : "";
    if (esc) {
      const e = (porEscola[esc] = porEscola[esc] || { insc: 0, pessoas: new Set() });
      e.insc++;
      e.pessoas.add(chavePessoa(l));
    }
    // Lista de datas das semanas, escrita na rúbrica ("Semanas em que se inscreve (...): 29 de junho a 3 de Julho, 6 a 10 de Julho…").
    if (cRub >= 0) {
      const m = String(l[cRub] ?? "").match(/Semanas em que se inscreve[^:]*:\s*([^|]+)/i);
      if (m) {
        const lista = m[1].split(/,\s*(?=\d)/).map((x) => x.trim()).filter(Boolean);
        if (lista.length > melhorLista.length) melhorLista = lista;
      }
    }
  });
  // Desistências (folha à parte, mesmas colunas).
  let desistencias = 0;
  folhas.forEach((fo) => {
    if (!/desist/i.test(fo.nome)) return;
    const c = cabDe(fo);
    if (!c) return;
    const iSem = c.cab.indexOf("semana");
    fo.linhas.slice(c.i + 1).forEach((l) => {
      const n = semNum(l[iSem]);
      if (n === null) return;
      desistencias++;
      (semanas[n] = semanas[n] || { n, insc: 0, pessoas: new Set(), desist: 0 }).desist++;
    });
  });
  const nums = Object.keys(semanas).map(Number).sort((a, b) => a - b);
  const datas = melhorLista.length === nums.length ? melhorLista.map((t) => intervalo(t, ano)) : [];
  const lista = nums.map((n, i) => ({ rotulo: `Semana ${n}`, n, ini: datas[i] ? datas[i].ini : "", fim: datas[i] ? datas[i].fim : "", inscricoes: semanas[n].insc, pessoas: semanas[n].pessoas.size, desistencias: semanas[n].desist }));
  const soNumeros = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
  return {
    semanas: lista,
    inscricoes: total.insc,
    pessoas: unicos.size,
    desistencias,
    porCondicao: soNumeros(porCond),
    porPrograma: soNumeros(porProg),
    porHorario: soNumeros(porHor),
    porEscola: Object.fromEntries(Object.entries(porEscola).map(([k, v]) => [k, { inscricoes: v.insc, pessoas: v.pessoas.size }]).sort((a, b) => b[1].inscricoes - a[1].inscricoes)),
  };
}

const fmtD = (iso) => (iso ? fmt(new Date(iso + "T00:00:00")).slice(0, 5) : "");

export function PainelCamps({ camps, onSave, onUpdate, onRemove }) {
  const hoje = isoDe(new Date());
  const [aCriar, setACriar] = useState(false);
  const [nome, setNome] = useState("Foot Camp Verão");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [msg, setMsg] = useState("");
  const [aLer, setALer] = useState(false);
  const [aberto, setAberto] = useState(null);
  const [apagar, setApagar] = useState(null);

  const ler = async (f, alvo) => {
    if (!f) return;
    setALer(true);
    setMsg("");
    try {
      const folhas = await lerExcelInq(f, { todas: true });
      const r = lerCamp(folhas, Number(ano) || new Date().getFullYear());
      const ponto = { data: hoje, ficheiro: f.name, inscricoes: r.inscricoes, pessoas: r.pessoas, porSemana: Object.fromEntries(r.semanas.map((s) => [s.n, s.inscricoes])) };
      if (alvo) {
        onUpdate({ ...alvo, ...r, ficheiro: f.name, historico: [...(alvo.historico || []).filter((h) => h.data !== hoje), ponto].sort((a, b) => a.data.localeCompare(b.data)) });
        setMsg(`Atualizado: ${r.inscricoes} inscrições em ${r.semanas.length} semanas.`);
      } else {
        const inicio = (r.semanas.find((s) => s.ini) || {}).ini || `${ano}-07-01`;
        const ev = { id: `ev_${Date.now()}`, v: 2, tipo: "semanas", nome: nome.trim() || "Foot Camp", data: inicio, ano: Number(ano), ...r, ficheiro: f.name, historico: [ponto], satisfacao: null, reclamacoes: 0 };
        onSave(ev);
        setAberto(ev.id);
        setACriar(false);
        setMsg(`Criado: ${r.inscricoes} inscrições em ${r.semanas.length} semanas (${r.pessoas} pessoas diferentes).`);
      }
    } catch (e) {
      setMsg(`Não consegui ler o ficheiro: ${e?.message || e}.`);
    }
    setALer(false);
  };

  const botaoFicheiro = (txt, alvo, primario) => (
    <label className="press" style={{ ...(primario ? primaryBtnStyle : secondaryBtnStyle), width: "auto", flex: "none", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 14px", fontSize: 13 }}>
      <Upload size={14} /> {aLer ? "A ler…" : txt}
      <input
        type="file"
        accept=".xlsx"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = "";
          ler(f, alvo);
        }}
      />
    </label>
  );

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginRight: "auto" }}>Eventos com várias semanas</div>
        {!aCriar && (
          <button className="press" onClick={() => setACriar(true)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Novo (Foot Camp…)
          </button>
        )}
      </div>

      {aCriar && (
        <div className="pageIn" style={{ ...panelStyle, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 600, flex: 1 }}>Novo evento com semanas</div>
            <button onClick={() => setACriar(false)} aria-label="Fechar" style={{ ...iconBtnStyle, color: COLORS.slate }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Evento</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} style={{ ...inputStyle, width: 240 }} />
            </div>
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Ano em que decorre</label>
              <input type="number" value={ano} onChange={(e) => setAno(e.target.value)} style={{ ...inputStyle, width: 100 }} />
            </div>
            {botaoFicheiro("Escolher Excel e criar", null, true)}
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 10, lineHeight: 1.5 }}>
            O Excel tem uma linha por inscrição numa semana (coluna «Semana»). Só ficam guardadas as contagens por semana, programa, condição e escola; nomes, NIF e contactos não saem do browser.
          </div>
        </div>
      )}
      {msg && <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 10 }}>{msg}</div>}

      {camps.length === 0 && !aCriar && <div style={{ fontSize: 13, color: COLORS.slate }}>Ainda sem eventos com semanas. Carrega o Excel do Foot Camp para ver as inscrições semana a semana.</div>}

      {camps.map((ev) => {
        const abertoEste = aberto === ev.id;
        const dadosGraf = (ev.semanas || []).map((s) => ({ name: s.ini ? `${s.rotulo.replace("Semana ", "S")} · ${fmtD(s.ini)}` : s.rotulo, Inscrições: s.inscricoes }));
        const maxSem = Math.max(0, ...(ev.semanas || []).map((s) => s.inscricoes));
        const linhaTab = (obj, tit) => (
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{tit}</div>
            {Object.entries(obj || {}).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "4px 0", borderTop: `1px solid ${COLORS.ruleSoft}` }}>
                <span>{k}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtNum(v)}</span>
              </div>
            ))}
          </div>
        );
        return (
          <div key={ev.id} style={{ ...panelStyle, marginBottom: 10, padding: 0 }}>
            <div onClick={() => setAberto(abertoEste ? null : ev.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", cursor: "pointer", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{ev.nome}</div>
                <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 2 }}>
                  {(ev.semanas || []).length} semanas{ev.semanas && ev.semanas[0] && ev.semanas[0].ini ? ` · ${fmtD(ev.semanas[0].ini)} a ${fmtD(ev.semanas[ev.semanas.length - 1].fim)}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtNum(ev.inscricoes)}</div>
                <div style={{ fontSize: 11.5, color: COLORS.slate }}>inscrições · {fmtNum(ev.pessoas)} pessoas diferentes</div>
              </div>
            </div>
            {abertoEste && (
              <div style={{ padding: "0 16px 16px" }}>
                <div style={{ height: 210, marginTop: 4 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosGraf} margin={{ top: 18, right: 8, bottom: 0, left: -12 }}>
                      <CartesianGrid stroke={COLORS.rule} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.slate }} />
                      <YAxis tick={{ fontSize: 11, fill: COLORS.slate }} domain={[0, Math.ceil((maxSem * 1.1) / 10) * 10 || 10]} />
                      <Tooltip />
                      <Bar dataKey="Inscrições" fill={COLORS.navy} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="Inscrições" position="top" style={{ fontSize: 11, fill: COLORS.ink2 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Semana</th>
                        <th style={thStyle}>Datas</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Inscrições</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Pessoas</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Desistências</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ev.semanas || []).map((s) => (
                        <tr key={s.n}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{s.rotulo}</td>
                          <td style={tdStyle}>{s.ini ? `${fmtD(s.ini)} a ${fmtD(s.fim)}` : "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(s.inscricoes)}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(s.pessoas)}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.desistencias ? fmtNum(s.desistencias) : "—"}</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
                        <td style={tdStyle} />
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmtNum(ev.inscricoes)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmtNum(ev.pessoas)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{ev.desistencias ? fmtNum(ev.desistencias) : "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>Inscrições = uma por semana de cada participante. Pessoas = participantes diferentes (quem vem várias semanas conta uma vez).</div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14 }}>
                  {linhaTab(ev.porCondicao, "Condição")}
                  {linhaTab(ev.porPrograma, "Programa")}
                  {linhaTab(ev.porHorario, "Horário")}
                </div>
                {ev.porEscola && Object.keys(ev.porEscola).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.slate, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Alunos das escolas Dragon Force</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", columnGap: 24 }}>
                      {Object.entries(ev.porEscola).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "4px 0", borderTop: `1px solid ${COLORS.ruleSoft}` }}>
                          <span>{k}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                            {fmtNum(v.pessoas)}
                            <span style={{ color: COLORS.slate, fontWeight: 400 }}> pess. · {fmtNum(v.inscricoes)} insc.</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(ev.historico || []).length > 1 && (
                  <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 12 }}>
                    Evolução: {(ev.historico || []).map((h) => `${fmt(new Date(h.data + "T00:00:00"))} · ${h.inscricoes}`).join("  →  ")}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                  {botaoFicheiro("Atualizar com novo Excel", ev, false)}
                  <span style={{ flex: 1 }} />
                  {apagar === ev.id ? (
                    <>
                      <span style={{ fontSize: 12.5 }}>Apagar este evento?</span>
                      <button onClick={() => onRemove(ev.id)} style={{ ...secondaryBtnStyle, width: "auto", padding: "6px 12px", fontSize: 12.5, color: COLORS.danger }}>
                        Apagar
                      </button>
                      <button onClick={() => setApagar(null)} style={{ ...secondaryBtnStyle, width: "auto", padding: "6px 12px", fontSize: 12.5 }}>
                        Não
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setApagar(ev.id)} style={{ ...iconBtnStyle, color: COLORS.slate }} aria-label="Apagar evento" title="Apagar evento">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
