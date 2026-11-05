// Base de conhecimento (pasta do Obsidian): painel de sugestões e janela para ligar a pasta.
// Pesquisa local, sem IA. Partilhado por Documentos, Reclamações, Sanções e Quizzes (ver conhecimento.js).
import { useMemo, useState } from "react";
import { BookOpen, FolderOpen, RefreshCw } from "lucide-react";
import { USOS, atualizarIndice, citacao, esquecerPasta, gruposDe, gruposPara, guardarPrefs, lerPrefs, ligarPasta, pedirPermissao, procurar, temTrechos, useConhecimento } from "./conhecimento";
import { COLORS, linkBtnStyle, panelTitle, primaryBtnStyle, secondaryBtnStyle } from "./nucleo.jsx";
import { JanelaSGQ, tdStyle, thStyle } from "./partilhado.jsx";

// Trechos da documentação parecidos com o texto (reclamação, sanção…). onUsar(texto, trecho) é opcional.
export function PainelDocumentacao({ consulta, uso, onUsar, titulo = "Documentação relacionada", rotuloUsar = "Usar citação" }) {
  const { estado, indice } = useConhecimento();
  const [aberto, setAberto] = useState(null);
  const [copiado, setCopiado] = useState(null);
  const res = useMemo(() => (indice && temTrechos(indice) ? procurar(indice, consulta, { grupos: gruposPara(indice, uso), n: 5 }) : []), [indice, consulta, uso]);
  if (estado === "sem-suporte" || estado === "a-ver") return null;
  const caixa = { marginBottom: 18, padding: "12px 14px", borderRadius: 10, background: COLORS.paperSunken, border: `1px solid ${COLORS.rule}` };
  const cab = (
    <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <BookOpen size={13} /> {titulo}
    </div>
  );
  if (!temTrechos(indice)) {
    return (
      <div style={caixa}>
        {cab}
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5 }}>Liga a pasta do Obsidian em Controlo documental → Base de conhecimento para veres aqui os artigos e procedimentos relacionados.</div>
      </div>
    );
  }
  const copiar = async (t, k) => {
    try {
      await navigator.clipboard.writeText(`Conforme ${citacao(t)}: «${t.excerto}»`);
      setCopiado(k);
      setTimeout(() => setCopiado(null), 2000);
    } catch (e) {
      // sem permissão de área de transferência
    }
  };
  return (
    <div style={caixa}>
      {cab}
      {res.length === 0 ? (
        <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>Nada nos grupos escolhidos parecido com este texto.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {res.map((t, i) => {
            const k = `${t.nota}|${t.seccao}|${i}`;
            const exp = aberto === k;
            return (
              <div key={k} style={{ background: COLORS.paperRaised, borderRadius: 8, padding: "9px 12px", border: `1px solid ${COLORS.rule}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.navySoft, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.grupo}</div>
                <div style={{ fontSize: 13, fontWeight: 600, margin: "2px 0 4px" }}>{citacao(t)}</div>
                <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{exp ? t.texto : t.excerto}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  {onUsar && (
                    <button type="button" onClick={() => onUsar(`Conforme ${citacao(t)}: «${t.excerto}»`, t)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                      {rotuloUsar}
                    </button>
                  )}
                  <button type="button" onClick={() => copiar(t, k)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                    {copiado === k ? "Copiado" : "Copiar citação"}
                  </button>
                  <button type="button" onClick={() => setAberto(exp ? null : k)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                    {exp ? "Menos" : "Ver trecho completo"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 8 }}>Sugestões por palavras parecidas, não substituem a leitura do documento.</div>
    </div>
  );
}

// Janela para ligar a pasta do Obsidian, atualizar o índice e escolher onde vale cada grupo.
export function JanelaConhecimento({ onFechar, notificar }) {
  const c = useConhecimento();
  const [prog, setProg] = useState(null);
  const [erros, setErros] = useState([]);
  const [prefs, setPrefs] = useState(lerPrefs);
  const grupos = gruposDe(c.indice);
  const doGrupo = (g) => Object.values((c.indice && c.indice.ficheiros) || {}).filter((f) => f.grupo === g);
  const atualizar = async (handle) => {
    setErros([]);
    try {
      if (c.estado === "permissao" && !(await pedirPermissao(handle))) return notificar("Sem permissão para ler a pasta.", "aviso");
      const r = await atualizarIndice(handle, setProg);
      setErros(r.erros);
      notificar(`Índice atualizado: ${r.ficheiros} ficheiros.`, r.erros.length ? "aviso" : "ok");
    } catch (e) {
      notificar(`Não consegui ler a pasta: ${e?.message || e}`, "erro");
    } finally {
      setProg(null);
    }
  };
  const ligar = async () => {
    try {
      const h = await ligarPasta();
      await c.recarregar();
      await atualizar(h);
    } catch (e) {
      if (e?.name !== "AbortError") notificar(`Não consegui ligar a pasta: ${e?.message || e}`, "erro");
    }
  };
  const marca = (g, uso) => {
    const n = { ...prefs, [g]: { ...(prefs[g] || {}), [uso]: (prefs[g] || {})[uso] === false } };
    setPrefs(n);
    guardarPrefs(n);
  };
  const btn = { ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 };
  return (
    <JanelaSGQ titulo="Base de conhecimento (Obsidian)" largura={720} onFechar={onFechar}>
      {c.estado === "sem-suporte" ? (
        <div style={{ fontSize: 13.5, color: COLORS.ink2, lineHeight: 1.6 }}>Este browser não deixa ler pastas do computador. Usa o Chrome ou o Edge.</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ fontSize: 13, color: COLORS.ink2, lineHeight: 1.6 }}>
            Liga a pasta do teu vault do Obsidian. Os ficheiros (.md, .txt, .pdf, .docx) <b>não saem do computador</b>: a app guarda só um índice de pesquisa neste browser. Cada pasta de 1.º nível é um grupo. Funciona só neste computador e browser.
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={ligar} className="press" style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "7px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FolderOpen size={14} /> {c.estado === "sem-pasta" ? "Ligar pasta do Obsidian" : "Mudar de pasta"}
            </button>
            {c.handle && (
              <button disabled={!!prog} onClick={() => atualizar(c.handle)} style={btn}>
                <RefreshCw size={14} /> {prog ? `A ler ${prog.feitos}/${prog.total}…` : "Atualizar índice"}
              </button>
            )}
            {c.handle && (
              <button
                onClick={async () => {
                  if (window.confirm("Desligar a pasta e apagar o índice deste browser? Os ficheiros não são tocados.")) {
                    await esquecerPasta();
                    c.recarregar();
                  }
                }}
                style={{ ...linkBtnStyle, marginTop: 0 }}
              >
                Desligar
              </button>
            )}
          </div>
          {c.handle && (
            <div style={{ fontSize: 12.5, color: COLORS.slate }}>
              Pasta: <b style={{ color: COLORS.ink }}>{c.nome}</b>
              {c.indice && c.indice.atualizado ? ` · índice de ${new Date(c.indice.atualizado).toLocaleString("pt-PT")}` : " · ainda sem índice"}
              {c.estado === "permissao" ? " · o browser volta a pedir permissão quando carregares em Atualizar" : ""}
            </div>
          )}
          {prog && <div style={{ fontSize: 12, color: COLORS.slate, wordBreak: "break-all" }}>{prog.ficheiro}</div>}
          {erros.length > 0 && (
            <div style={{ fontSize: 12, color: COLORS.warn }}>
              Não consegui ler: {erros.slice(0, 5).join(" · ")}
              {erros.length > 5 ? ` e mais ${erros.length - 5}` : ""}
            </div>
          )}
          {grupos.length > 0 && (
            <div>
              <div style={{ ...panelTitle, marginBottom: 6 }}>Grupos e onde valem</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Grupo (pasta)</th>
                      <th style={thStyle}>Ficheiros</th>
                      <th style={thStyle}>Trechos</th>
                      {USOS.map(([k, r]) => (
                        <th key={k} style={thStyle}>
                          {r}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((g) => (
                      <tr key={g}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{g}</td>
                        <td style={tdStyle}>{doGrupo(g).length}</td>
                        <td style={tdStyle}>{doGrupo(g).reduce((a, f) => a + f.trechos.length, 0)}</td>
                        {USOS.map(([k]) => (
                          <td key={k} style={tdStyle}>
                            <input type="checkbox" checked={(prefs[g] || {})[k] !== false} onChange={() => marca(g, k)} aria-label={`${g}: ${k}`} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6 }}>Não ligues pastas com dados pessoais de menores.</div>
            </div>
          )}
        </div>
      )}
    </JanelaSGQ>
  );
}
