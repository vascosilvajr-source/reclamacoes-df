// Quizz de formação: módulos (teoria + perguntas com o "porquê" e o artigo), links por pessoa e resultados.
// O módulo é copiado para o servidor no momento de atribuir (formacao_pedidos); a pessoa abre ?fm=<código>.
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, ArrowUp, ArrowDown, Copy, Check, BookOpen } from "lucide-react";
import { citacao, gruposPara, procurar, temTrechos, useConhecimento } from "../conhecimento";
import { supabase } from "../supabaseClient";
import { aplicarFormacoes, formacoesEmFalta, rhCompleto, saiu } from "../rh";
import { COLORS, Tag, Vazio, iconBtnStyle, inputStyle, labelStyle, linkBtnStyle, panelStyle, panelTitle, primaryBtnStyle, secondaryBtnStyle } from "../nucleo.jsx";
import { JanelaSGQ, chipSGQ, tdStyle, thStyle } from "../partilhado.jsx";

const novoId = (p) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
const novoToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
const linkDe = (token) => `${window.location.origin}/?fm=${token}`;
const rotDoc = (x) => [x.codigo && x.codigo !== "-" ? x.codigo : "", x.identificacao].filter(Boolean).join(" — ");
const dataPT = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

const MODULO_NOVO = () => ({
  id: novoId("mod"),
  nome: "",
  tipo: "integracao",
  funcoes: [],
  notaMinima: 80,
  validadeMeses: 12,
  passo: "formacao",
  slides: [{ titulo: "", texto: "" }],
  perguntas: [{ id: novoId("p"), enunciado: "", opcoes: ["", ""], certa: 0, porque: "", ref: { docId: "", artigo: "" } }],
});

// Sugestões a partir da documentação (pasta do Obsidian): o pedido vai para o teu Claude (copiar/colar) e a resposta volta como rascunho.
const pedidoParaClaude = (trechos, nSlides, nPerguntas) =>
  `Vais ajudar a criar um módulo de formação para o pessoal da Dragon Force (FC Porto). Usa APENAS o texto das fontes abaixo, sem inventar nada. Escreve em português de Portugal.

Cria ${nSlides} slides de teoria curtos e ${nPerguntas} perguntas de escolha múltipla (3 a 4 opções, só uma certa). Cada pergunta leva "porque" (explica a resposta certa) e "ref" com a fonte e o artigo ou secção de onde vem.

Responde só com JSON válido, neste formato:
{"slides":[{"titulo":"...","texto":"..."}],"perguntas":[{"enunciado":"...","opcoes":["...","...","..."],"certa":0,"porque":"...","ref":{"doc":"nome da fonte","artigo":"artigo ou secção"}}]}
("certa" é a posição da opção certa, a começar em 0.)

FONTES:
${trechos.map((t, i) => `[${i + 1}] ${citacao(t)}\n${t.texto}`).join("\n\n")}`;

function lerSugestao(texto) {
  const m = String(texto || "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("não encontrei JSON na resposta");
  const j = JSON.parse(m[0]);
  const perguntas = (Array.isArray(j.perguntas) ? j.perguntas : [])
    .filter((p) => p && String(p.enunciado || "").trim() && Array.isArray(p.opcoes) && p.opcoes.filter((o) => String(o).trim()).length >= 2)
    .map((p) => ({
      id: novoId("p"),
      enunciado: String(p.enunciado).trim(),
      opcoes: p.opcoes.map((o) => String(o).trim()),
      certa: Number.isInteger(p.certa) && p.certa >= 0 && p.certa < p.opcoes.length ? p.certa : 0,
      porque: String(p.porque || "").trim(),
      ref: { docId: "", doc: String((p.ref && p.ref.doc) || "").trim(), artigo: String((p.ref && p.ref.artigo) || "").trim() },
    }));
  const slides = (Array.isArray(j.slides) ? j.slides : []).filter((s) => s && (String(s.titulo || "").trim() || String(s.texto || "").trim())).map((s) => ({ titulo: String(s.titulo || "").trim(), texto: String(s.texto || "").trim() }));
  if (!perguntas.length && !slides.length) throw new Error("sem slides nem perguntas válidos");
  return { perguntas, slides };
}

function SugerirDocumentacao({ onImportar }) {
  const { indice } = useConhecimento();
  const [aberto, setAberto] = useState(false);
  const [tema, setTema] = useState("");
  const [sel, setSel] = useState({});
  const [nSlides, setNSlides] = useState(3);
  const [nPerg, setNPerg] = useState(5);
  const [colado, setColado] = useState("");
  const [msg, setMsg] = useState("");
  const [copiado, setCopiado] = useState(false);
  const pronto = temTrechos(indice);
  const res = useMemo(() => (pronto && tema.trim() ? procurar(indice, tema, { grupos: gruposPara(indice, "quizzes"), n: 8 }) : []), [indice, pronto, tema]);
  const chave = (t) => `${t.nota}|${t.seccao}`;
  const escolhidos = res.filter((t) => sel[chave(t)]);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(pedidoParaClaude(escolhidos, nSlides, nPerg));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {
      window.prompt("Copia o pedido:", pedidoParaClaude(escolhidos, nSlides, nPerg));
    }
  };
  const importar = () => {
    try {
      const r = lerSugestao(colado);
      onImportar(r);
      setMsg(`Acrescentei ${r.slides.length} slides e ${r.perguntas.length} perguntas. Revê-os abaixo antes de guardar.`);
      setColado("");
    } catch (e) {
      setMsg(`Não consegui importar: ${e?.message || e}`);
    }
  };
  return (
    <div style={{ border: `1px dashed ${COLORS.navySoft}`, borderRadius: 10, padding: 12, background: COLORS.navyWash }}>
      <button type="button" onClick={() => setAberto((v) => !v)} style={{ ...linkBtnStyle, marginTop: 0, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <BookOpen size={14} /> Sugerir a partir da documentação {aberto ? "▾" : "▸"}
      </button>
      {aberto && (
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {!pronto ? (
            <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>Liga primeiro a pasta do Obsidian em Controlo documental → Base de conhecimento.</div>
          ) : (
            <>
              <input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Tema a pesquisar (ex.: uniforme, sinalização, primeiros socorros)" style={inputStyle} />
              {res.map((t) => (
                <label key={chave(t)} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!sel[chave(t)]} onChange={() => setSel((x) => ({ ...x, [chave(t)]: !x[chave(t)] }))} />
                  <span>
                    <b>{citacao(t)}</b> <span style={{ color: COLORS.slate }}>· {t.grupo}</span>
                    <div style={{ color: COLORS.ink2, marginTop: 2 }}>{t.excerto}</div>
                  </span>
                </label>
              ))}
              {tema.trim() && res.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>Nada encontrado nos grupos de quizzes.</div>}
              {escolhidos.length > 0 && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12.5 }}>
                  <span>Slides</span>
                  <input type="number" min="0" max="10" value={nSlides} onChange={(e) => setNSlides(Number(e.target.value) || 0)} style={{ ...inputStyle, width: 64, padding: "4px 6px" }} />
                  <span>Perguntas</span>
                  <input type="number" min="1" max="20" value={nPerg} onChange={(e) => setNPerg(Number(e.target.value) || 1)} style={{ ...inputStyle, width: 64, padding: "4px 6px" }} />
                  <button type="button" onClick={copiar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5 }}>
                    {copiado ? "Copiado" : `Copiar pedido para o Claude (${escolhidos.length} fontes)`}
                  </button>
                </div>
              )}
              <div style={{ fontSize: 12, color: COLORS.slate }}>Cola o pedido no teu Claude, copia a resposta (JSON) e cola-a aqui:</div>
              <textarea value={colado} onChange={(e) => setColado(e.target.value)} rows={4} placeholder='{"slides":[...],"perguntas":[...]}' style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
              <div>
                <button type="button" disabled={!colado.trim()} onClick={importar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "6px 14px", fontSize: 12.5, opacity: colado.trim() ? 1 : 0.5 }}>
                  Importar sugestão
                </button>
              </div>
            </>
          )}
          {msg && <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}

function EditorModulo({ inicial, d, docs, onGuardar, onApagar, onFechar }) {
  const [m, setM] = useState(() => JSON.parse(JSON.stringify(inicial)));
  const muda = (k, v) => setM((x) => ({ ...x, [k]: v }));
  const mudaSlide = (i, c) => muda("slides", m.slides.map((s, j) => (j === i ? { ...s, ...c } : s)));
  const mudaPerg = (i, c) => muda("perguntas", m.perguntas.map((s, j) => (j === i ? { ...s, ...c } : s)));
  const mexe = (k, i, dir) => {
    const n = [...m[k]];
    const j = i + dir;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    muda(k, n);
  };
  const perguntasOk = m.perguntas.filter((p) => String(p.enunciado).trim() && p.opcoes.filter((o) => String(o).trim()).length >= 2);
  const valido = String(m.nome).trim() && perguntasOk.length > 0;
  const guardar = () => {
    const limpo = {
      ...m,
      nome: String(m.nome).trim(),
      slides: m.slides.filter((s) => String(s.titulo).trim() || String(s.texto).trim()),
      perguntas: perguntasOk.map((p) => {
        // Só mantém as opções preenchidas; a certa acompanha a opção, não a posição.
        const idx = p.opcoes.map((o, i) => (String(o).trim() ? i : -1)).filter((i) => i >= 0);
        const certa = Math.max(0, idx.indexOf(p.certa));
        return { ...p, enunciado: String(p.enunciado).trim(), opcoes: idx.map((i) => String(p.opcoes[i]).trim()), certa };
      }),
    };
    onGuardar(limpo);
  };
  const mini = { ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 10px", fontSize: 12 };
  return (
    <JanelaSGQ
      titulo={inicial.__novo ? "Novo módulo de formação" : "Módulo de formação"}
      largura={860}
      onFechar={onFechar}
      rodape={
        <>
          {!inicial.__novo && (
            <button onClick={() => onApagar(m.id)} style={{ ...linkBtnStyle, marginTop: 0, color: COLORS.danger }}>
              Apagar
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
            Cancelar
          </button>
          <button disabled={!valido} onClick={guardar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px", opacity: valido ? 1 : 0.5 }}>
            Guardar
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Nome do módulo</label>
          <input value={m.nome} onChange={(e) => muda("nome", e.target.value)} placeholder="Ex.: Integração de treinadores" style={inputStyle} autoFocus={inicial.__novo} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Tipo</label>
            <select value={m.tipo} onChange={(e) => muda("tipo", e.target.value)} style={inputStyle}>
              <option value="integracao">Integração (pessoal novo)</option>
              <option value="continua">Formação contínua (repete)</option>
            </select>
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Nota mínima para passar (%)</label>
            <input type="number" min="1" max="100" value={m.notaMinima} onChange={(e) => muda("notaMinima", Math.max(1, Math.min(100, Number(e.target.value) || 80)))} style={inputStyle} />
          </div>
          {m.tipo === "continua" ? (
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Repetir de (meses)</label>
              <input type="number" min="1" value={m.validadeMeses} onChange={(e) => muda("validadeMeses", Math.max(1, Number(e.target.value) || 12))} style={inputStyle} />
            </div>
          ) : (
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Passo da checklist que marca</label>
              <select value={m.passo} onChange={(e) => muda("passo", e.target.value)} style={inputStyle}>
                {d.passos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Funções a que se aplica (vazio = todas)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {d.funcoes.map((f) => {
              const on = m.funcoes.includes(f);
              return (
                <button key={f} type="button" onClick={() => muda("funcoes", on ? m.funcoes.filter((x) => x !== f) : [...m.funcoes, f])} style={chipSGQ(on)}>
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        <SugerirDocumentacao
          onImportar={(r) => {
            const vazio = (s) => !String(s.titulo).trim() && !String(s.texto).trim();
            const vaziaP = (p) => !String(p.enunciado).trim();
            setM((x) => ({ ...x, slides: [...x.slides.filter((s) => !vazio(s)), ...r.slides], perguntas: [...x.perguntas.filter((p) => !vaziaP(p)), ...r.perguntas] }));
          }}
        />

        <div style={{ ...panelTitle, marginTop: 8 }}>Teoria (slides)</div>
        {m.slides.map((s, i) => (
          <div key={i} style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, padding: 10, display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={s.titulo} onChange={(e) => mudaSlide(i, { titulo: e.target.value })} placeholder={`Slide ${i + 1}: título`} style={{ ...inputStyle, flex: 1, fontWeight: 600 }} />
              <button onClick={() => mexe("slides", i, -1)} aria-label="Subir" style={iconBtnStyle}>
                <ArrowUp size={14} />
              </button>
              <button onClick={() => mexe("slides", i, 1)} aria-label="Descer" style={iconBtnStyle}>
                <ArrowDown size={14} />
              </button>
              <button onClick={() => muda("slides", m.slides.filter((_, j) => j !== i))} aria-label="Tirar slide" style={iconBtnStyle}>
                <X size={14} />
              </button>
            </div>
            <textarea value={s.texto} onChange={(e) => mudaSlide(i, { texto: e.target.value })} rows={4} placeholder="Texto do slide" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
        ))}
        <div>
          <button onClick={() => muda("slides", [...m.slides, { titulo: "", texto: "" }])} style={{ ...linkBtnStyle, marginTop: 0 }}>
            + Slide
          </button>
        </div>

        <div style={{ ...panelTitle, marginTop: 8 }}>Perguntas</div>
        {m.perguntas.map((p, i) => (
          <div key={p.id} style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={p.enunciado} onChange={(e) => mudaPerg(i, { enunciado: e.target.value })} placeholder={`Pergunta ${i + 1}`} style={{ ...inputStyle, flex: 1, fontWeight: 600 }} />
              <button onClick={() => mexe("perguntas", i, -1)} aria-label="Subir" style={iconBtnStyle}>
                <ArrowUp size={14} />
              </button>
              <button onClick={() => mexe("perguntas", i, 1)} aria-label="Descer" style={iconBtnStyle}>
                <ArrowDown size={14} />
              </button>
              <button onClick={() => muda("perguntas", m.perguntas.filter((_, j) => j !== i))} aria-label="Tirar pergunta" style={iconBtnStyle}>
                <X size={14} />
              </button>
            </div>
            {p.opcoes.map((o, k) => (
              <div key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="radio" name={`certa-${p.id}`} checked={p.certa === k} onChange={() => mudaPerg(i, { certa: k })} title="Resposta certa" />
                <input value={o} onChange={(e) => mudaPerg(i, { opcoes: p.opcoes.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Opção ${k + 1}`} style={{ ...inputStyle, flex: 1, padding: "6px 8px" }} />
                {p.opcoes.length > 2 && (
                  <button
                    onClick={() => mudaPerg(i, { opcoes: p.opcoes.filter((_, j) => j !== k), certa: p.certa === k ? 0 : p.certa > k ? p.certa - 1 : p.certa })}
                    aria-label="Tirar opção"
                    style={iconBtnStyle}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
            {p.opcoes.length < 6 && (
              <div>
                <button onClick={() => mudaPerg(i, { opcoes: [...p.opcoes, ""] })} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
                  + Opção
                </button>
              </div>
            )}
            <div>
              <label style={{ ...labelStyle, marginTop: 0 }}>Porquê (aparece quando falham)</label>
              <textarea value={p.porque} onChange={(e) => mudaPerg(i, { porque: e.target.value })} rows={2} placeholder="Explica a resposta certa" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>Documento (Controlo documental)</label>
                <select value={(p.ref && p.ref.docId) || ""} onChange={(e) => mudaPerg(i, { ref: { ...(p.ref || {}), docId: e.target.value } })} style={inputStyle}>
                  <option value="">Sem documento</option>
                  {docs.map((x) => (
                    <option key={x.id} value={x.id}>
                      {rotDoc(x)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>Artigo / secção</label>
                <input value={(p.ref && p.ref.artigo) || ""} onChange={(e) => mudaPerg(i, { ref: { ...(p.ref || {}), artigo: e.target.value } })} placeholder="Ex.: Art. 5.º, ponto 2" style={inputStyle} />
              </div>
            </div>
            {!(p.ref && p.ref.docId) && (
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>Fonte (se não for do Controlo documental)</label>
                <input value={(p.ref && p.ref.doc) || ""} onChange={(e) => mudaPerg(i, { ref: { ...(p.ref || {}), doc: e.target.value } })} placeholder="Ex.: nota do Obsidian" style={inputStyle} />
              </div>
            )}
          </div>
        ))}
        <div>
          <button onClick={() => muda("perguntas", [...m.perguntas, { id: novoId("p"), enunciado: "", opcoes: ["", ""], certa: 0, porque: "", ref: { docId: "", artigo: "" } }])} style={{ ...linkBtnStyle, marginTop: 0 }}>
            + Pergunta
          </button>
        </div>
        {!valido && <div style={{ fontSize: 12, color: COLORS.warn }}>Precisa de nome e de pelo menos uma pergunta com duas opções preenchidas.</div>}
      </div>
    </JanelaSGQ>
  );
}

export function QuizzFormacao({ rh, onGuardarRh, documentos, notificar }) {
  const d = rhCompleto(rh);
  const modulos = d.modulos || [];
  const docs = ((documentos && documentos.itens) || []).filter((x) => !x.obsoleto);
  const [editar, setEditar] = useState(null);
  const [pedidos, setPedidos] = useState(null);
  const [atrib, setAtrib] = useState({ modulo: "", pessoa: "" });
  const [copiado, setCopiado] = useState("");
  const [semTabela, setSemTabela] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("formacao_pedidos").select("token,colaborador_id,iniciais,modulo,criado,expira,aberto_em,resultado,concluido_em,historico,aplicado_em,tentativas").order("criado", { ascending: false }).limit(300);
    if (error) return setSemTabela(true);
    setSemTabela(false);
    setPedidos(data || []);
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  // Resultados novos entram na ficha de cada pessoa (e marcam o passo da integração).
  useEffect(() => {
    if (!pedidos) return;
    const r = aplicarFormacoes(d, pedidos);
    if (!r) return;
    onGuardarRh(r.dados);
    supabase
      .from("formacao_pedidos")
      .update({ aplicado_em: new Date().toISOString() })
      .in("token", r.tokens)
      .then(() => {});
    notificar(`${r.tokens.length === 1 ? "1 resultado de formação entrou" : `${r.tokens.length} resultados de formação entraram`} nas fichas.`, "ok", 6000);
  }, [pedidos]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardarModulo = (m) => {
    const { __novo, ...limpo } = m;
    const existe = modulos.some((x) => x.id === limpo.id);
    onGuardarRh({ ...d, modulos: existe ? modulos.map((x) => (x.id === limpo.id ? limpo : x)) : [...modulos, limpo] });
    setEditar(null);
    notificar(existe ? "Módulo atualizado." : "Módulo criado.");
  };
  const apagarModulo = (id) => {
    const m = modulos.find((x) => x.id === id);
    if (!window.confirm(`Apagar o módulo "${m ? m.nome : ""}"? Os links já enviados continuam a funcionar.`)) return;
    onGuardarRh({ ...d, modulos: modulos.filter((x) => x.id !== id) });
    setEditar(null);
  };

  // Cópia do módulo para o servidor (com a referência ao documento já escrita), sem nomes de pessoas.
  const snapshot = (m) => ({
    id: m.id,
    nome: m.nome,
    tipo: m.tipo,
    notaMinima: m.notaMinima,
    passo: m.passo,
    slides: m.slides,
    perguntas: m.perguntas.map((p) => {
      const doc = docs.find((x) => x.id === (p.ref && p.ref.docId));
      return { id: p.id, enunciado: p.enunciado, opcoes: p.opcoes, certa: p.certa, porque: p.porque, ref: { doc: doc ? rotDoc(doc) : (p.ref && p.ref.doc) || "", artigo: (p.ref && p.ref.artigo) || "" } };
    }),
  });
  const atribuir = async (m, pessoas) => {
    const expira = new Date(Date.now() + 14 * 86400000).toISOString();
    const linhas = pessoas.map((c) => ({ token: novoToken(), colaborador_id: c.id, iniciais: c.iniciais || "", modulo: snapshot(m), expira }));
    const { error } = await supabase.from("formacao_pedidos").insert(linhas);
    if (error) return notificar("Não consegui criar o pedido. Confirma que colaste o formacao.sql no Supabase.", "erro");
    notificar(linhas.length === 1 ? "Link criado (válido 14 dias). Copia-o abaixo." : `${linhas.length} links criados (válidos 14 dias).`, "ok");
    await carregar();
  };
  const copiar = async (token) => {
    try {
      await navigator.clipboard.writeText(linkDe(token));
      setCopiado(token);
      setTimeout(() => setCopiado(""), 2500);
    } catch (e) {
      window.prompt("Copia o link:", linkDe(token));
    }
  };
  const apagarPedido = async (p) => {
    if (!window.confirm("Apagar este pedido? O link deixa de funcionar.")) return;
    await supabase.from("formacao_pedidos").delete().eq("token", p.token);
    carregar();
  };

  const ativos = d.colaboradores.filter((c) => !saiu(c)).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt"));
  const modSel = modulos.find((x) => x.id === atrib.modulo);
  const doModulo = (m) => ativos.filter((c) => !(m.funcoes || []).length || m.funcoes.includes(c.funcao));
  const semAprovacao = (m) => doModulo(m).filter((c) => !(c.formacoes || []).some((f) => f.moduloId === m.id && f.passou));
  const nomeDe = (id) => (d.colaboradores.find((c) => c.id === id) || {}).nome || "(já não está nos RH)";
  const estadoPedido = (p) => {
    if (p.resultado) return p.resultado.passou ? [`Passou · ${p.resultado.nota}%`, COLORS.ok, COLORS.okBg] : [`Não passou · ${p.resultado.nota}%`, COLORS.warn, COLORS.warnBg];
    if (new Date(p.expira) < new Date()) return ["Expirado", COLORS.slate, COLORS.doneBg];
    if (p.aberto_em) return ["Em curso", COLORS.progress, COLORS.progressBg];
    return ["Por abrir", COLORS.slate, COLORS.doneBg];
  };
  const btn = { ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 };
  const emFalta = formacoesEmFalta(d);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {editar && <EditorModulo inicial={editar} d={d} docs={docs} onGuardar={guardarModulo} onApagar={apagarModulo} onFechar={() => setEditar(null)} />}
      {semTabela && (
        <div style={{ ...panelStyle, borderColor: COLORS.warn, background: COLORS.warnBg, marginBottom: 0, fontSize: 13.5 }}>
          Falta a tabela dos quizzes no Supabase. Cola o ficheiro <b>supabase/formacao.sql</b> no SQL Editor (Run) para poderes enviar links.
        </div>
      )}

      {emFalta.length > 0 && (
        <div style={{ ...panelStyle, borderColor: COLORS.warn, background: COLORS.warnBg, marginBottom: 0, fontSize: 13.5 }}>
          <b>Formação contínua em falta ou caducada:</b> {emFalta.slice(0, 8).map((x) => `${x.colaborador.nome} (${x.modulo.nome})`).join(", ")}
          {emFalta.length > 8 ? ` e mais ${emFalta.length - 8}` : ""}.
        </div>
      )}
      <div style={{ ...panelStyle, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ ...panelTitle, flex: 1, margin: 0 }}>Módulos</div>
          <button onClick={() => setEditar({ ...MODULO_NOVO(), __novo: true })} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "7px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Novo módulo
          </button>
        </div>
        {modulos.length === 0 ? (
          <Vazio titulo="Sem módulos" texto="Cria um módulo com a teoria e as perguntas. Cada pergunta leva o “porquê” e o documento e artigo que a sustentam." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Módulo", "Tipo", "Funções", "Slides", "Perguntas", "Mínimo", ""].map((h, i) => (
                    <th key={i} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modulos.map((m) => (
                  <tr key={m.id} className="rowHover" onClick={() => setEditar(m)} style={{ cursor: "pointer" }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{m.nome}</td>
                    <td style={tdStyle}>{m.tipo === "continua" ? `Contínua · ${m.validadeMeses} meses` : "Integração"}</td>
                    <td style={tdStyle}>{(m.funcoes || []).join(", ") || "Todas"}</td>
                    <td style={tdStyle}>{(m.slides || []).length}</td>
                    <td style={tdStyle}>{(m.perguntas || []).length}</td>
                    <td style={tdStyle}>{m.notaMinima}%</td>
                    <td style={tdStyle}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAtrib({ modulo: m.id, pessoa: "" });
                        }}
                        style={btn}
                      >
                        Enviar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modSel && (
        <div style={{ ...panelStyle, marginBottom: 0 }}>
          <div style={{ ...panelTitle, marginBottom: 8 }}>Enviar “{modSel.nome}”</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={atrib.pessoa} onChange={(e) => setAtrib({ ...atrib, pessoa: e.target.value })} style={{ ...inputStyle, width: 260 }}>
              <option value="">Escolher pessoa…</option>
              {doModulo(modSel).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.iniciais ? `(${c.iniciais})` : ""}
                </option>
              ))}
            </select>
            <button disabled={!atrib.pessoa} onClick={() => atribuir(modSel, [d.colaboradores.find((c) => c.id === atrib.pessoa)])} className="press" style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "7px 14px", fontSize: 13, opacity: atrib.pessoa ? 1 : 0.5 }}>
              Criar link
            </button>
            <button
              disabled={!semAprovacao(modSel).length}
              onClick={() => window.confirm(`Criar links para ${semAprovacao(modSel).length} pessoas que ainda não passaram neste módulo?`) && atribuir(modSel, semAprovacao(modSel))}
              style={{ ...btn, opacity: semAprovacao(modSel).length ? 1 : 0.5 }}
            >
              A todos os que faltam ({semAprovacao(modSel).length})
            </button>
            <button onClick={() => setAtrib({ modulo: "", pessoa: "" })} style={linkBtnStyle}>
              Fechar
            </button>
          </div>
          <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 8 }}>O link vale 14 dias e abre no telemóvel ou no computador, sem login. Envia-o por e-mail ou WhatsApp.</div>
        </div>
      )}

      <div style={{ ...panelStyle, marginBottom: 0 }}>
        <div style={{ ...panelTitle, marginBottom: 8 }}>Links e resultados</div>
        {!pedidos || pedidos.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate }}>Ainda não enviaste nenhum quizz.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Pessoa", "Módulo", "Criado", "Estado", ""].map((h, i) => (
                    <th key={i} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const [rot, cor, fundo] = estadoPedido(p);
                  return (
                    <tr key={p.token}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        {nomeDe(p.colaborador_id)} <span style={{ fontWeight: 400, color: COLORS.slate }}>{p.iniciais}</span>
                      </td>
                      <td style={tdStyle}>{(p.modulo || {}).nome}</td>
                      <td style={tdStyle}>{dataPT(p.criado)}</td>
                      <td style={tdStyle}>
                        <Tag label={rot} color={cor} bg={fundo} />
                        {(p.tentativas || 0) > 0 && <span style={{ fontSize: 11.5, color: COLORS.slate, marginLeft: 6 }}>{p.tentativas + 1}.ª tentativa</span>}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        <button onClick={() => copiar(p.token)} style={btn}>
                          {copiado === p.token ? <Check size={13} /> : <Copy size={13} />} {copiado === p.token ? "Copiado" : "Copiar link"}
                        </button>{" "}
                        <button onClick={() => apagarPedido(p)} aria-label="Apagar pedido" style={iconBtnStyle}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
