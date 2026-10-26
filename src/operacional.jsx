// Janela do operacional: abre pelo link do e-mail (?op=<código>), sem conta.
// Só mostra o pedido daquela escola: códigos dos alunos, turmas e datas (nunca nomes).
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { LOGO_BRANCO, FOTO_ESTADIO } from "./imagens";

const AZUL = "#0B2A5B";
const TINTA = "#0F1B2D";
const CINZA = "#5B6577";
const LINHA = "#E3E7EE";
const VERDE = "#0C7A52";
const LARANJA = "#C2570C";
const AMBAR = "#9A6A00";

const OPCOES = [
  ["sucesso", "Converteu", VERDE, "#E6F4EE"],
  ["pendente", "Ainda a decorrer", AMBAR, "#FBF2DE"],
  ["insucesso", "Não converteu", LARANJA, "#FDEEE3"],
];

const AVALIACOES = [
  ["eficaz", "Eficaz", VERDE, "#E6F4EE"],
  ["parcial", "Parcialmente eficaz", AMBAR, "#FBF2DE"],
  ["ineficaz", "Não eficaz", LARANJA, "#FDEEE3"],
];

const dataPT = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : "");
const ehOutro = (m) => /^outr/i.test(String(m || ""));
const ehEquipa = (t) => /^sub[\s-]?\d/i.test(String(t || "")); // equipas de competição: Sub-9, Sub-11 A…
const ROTULO_RES = { sucesso: "Converteu", pendente: "Ainda a decorrer", insucesso: "Não converteu" };
const novaVazia = () => ({ k: Math.random().toString(36).slice(2), id: "", data: "", turma: "", turmaFicou: null, r: "", motivo: "", nota: "" });

// Opções de turmas e equipas de competição da escola (para escolher onde o atleta ficou).
function OpcoesTurmas({ equipas, turmas }) {
  return (
    <>
      {equipas.length > 0 && (
        <optgroup label="Equipas de competição">
          {equipas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </optgroup>
      )}
      {turmas.length > 0 && (
        <optgroup label="Turmas">
          {turmas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
const faltaNova = (n) => {
  if (!/^[0-9A-Za-z-]{1,20}$/.test(n.id.trim())) return "o código do atleta";
  if (!n.data) return "a data";
  if (!n.turma) return "a turma ou equipa";
  if (!n.r) return "o resultado";
  if (n.r === "insucesso" && !n.motivo) return "o motivo";
  if (n.r === "insucesso" && ehOutro(n.motivo) && !n.nota.trim()) return "o detalhe do motivo";
  return "";
};
const lerIds = (t) =>
  [...new Set(String(t || "").split(/[\s,;]+/).map((x) => x.trim()).filter((x) => /^[0-9A-Za-z-]{1,20}$/.test(x)))];


// Lotação de cada turma/equipa. Ao clicar abre os códigos dos alunos dessa turma, onde se pode propor
// a mudança de turma. As propostas ficam sempre pendentes até a gestão da qualidade as validar.
function LotacaoTurmas({ token, itens, propostas: iniciais }) {
  const lotacao = itens.lotacao || [];
  const alunosTurmas = itens.alunosTurmas || {};
  const turmasEscola = itens.turmasEscola || [];
  const [aberta, setAberta] = useState(null);
  const [alt, setAlt] = useState({}); // código → turma de destino
  const [extra, setExtra] = useState("");
  const [pend, setPend] = useState(iniciais || []);
  const [msg, setMsg] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const pendDe = (id) => pend.find((x) => x.id === id);
  const nAlt = Object.keys(alt).length;
  const enviar = async () => {
    setAEnviar(true);
    setMsg("");
    const lista = Object.entries(alt).map(([id, para]) => ({ id, para }));
    const { data, error } = await supabase.rpc("op_propor_alteracoes", { p_token: token, p_alt: lista });
    setAEnviar(false);
    if (error) return setMsg("Não consegui enviar. Tenta outra vez.");
    setPend((l) => [...l.filter((x) => !alt[x.id]), ...lista.map((x) => ({ id: x.id, de: null, para: x.para }))]);
    setAlt({});
    setMsg(`${data.propostas} alteração(ões) enviada(s) para validação${data.invalidas ? ` · ${data.invalidas} ignorada(s) (código que não existe na app)` : ""}.`);
  };
  const ids = aberta ? alunosTurmas[aberta] || [] : [];
  const opcoes = (atual) => turmasEscola.filter((t) => t !== atual);
  const juntarExtra = () => {
    const id = extra.trim();
    if (!/^[0-9A-Za-z-]{1,20}$/.test(id)) return setMsg("Código inválido.");
    setAlt((a) => ({ ...a, [id]: aberta }));
    setExtra("");
    setMsg("");
  };
  return (
    <section className="opSeccao">
      <h2>Lotação das turmas e equipas</h2>
      <p className="opNota">Alunos inscritos e lotação de cada turma. Carrega numa turma para ver os códigos e propor mudanças. Nada muda na app até a gestão da qualidade validar.</p>
      <div style={{ display: "grid", gap: 6 }}>
        {lotacao.map((l) => {
          const cheia = l.cap && l.alunos > l.cap;
          return (
            <button key={l.turma} type="button" onClick={() => setAberta(l.turma)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${LINHA}`, borderRadius: 10, background: "#fff", cursor: "pointer", textAlign: "left", font: "inherit", color: TINTA }}>
              <strong style={{ flex: 1 }}>{l.turma}</strong>
              <span style={{ fontVariantNumeric: "tabular-nums", color: cheia ? LARANJA : CINZA, fontWeight: cheia ? 700 : 500 }}>
                {l.alunos}
                {l.cap ? ` / ${l.cap}` : ""} alunos
              </span>
              <span style={{ color: AZUL, fontSize: 12.5, fontWeight: 600 }}>Ver códigos</span>
            </button>
          );
        })}
      </div>
      {pend.length > 0 && (
        <p className="opNota" style={{ marginTop: 10 }}>
          Pendentes de validação: {pend.map((x) => `${x.id} → ${x.para}`).join(" · ")}
        </p>
      )}
      {msg && <p className="opNota" style={{ color: VERDE, marginTop: 8 }}>{msg}</p>}
      {aberta && (
        <div role="dialog" aria-modal="true" aria-label={`Alunos da turma ${aberta}`} onClick={() => setAberta(null)} style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 520, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${LINHA}`, display: "flex", alignItems: "center", gap: 10 }}>
              <strong style={{ flex: 1, fontSize: 16 }}>
                {aberta} · {ids.length} {ids.length === 1 ? "aluno" : "alunos"}
              </strong>
              <button type="button" onClick={() => setAberta(null)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: CINZA }} aria-label="Fechar">
                ×
              </button>
            </div>
            <div style={{ padding: 16, overflowY: "auto", display: "grid", gap: 8 }}>
              {ids.length === 0 && <div style={{ color: CINZA, fontSize: 13 }}>Sem alunos inscritos nesta turma.</div>}
              {ids.map((id) => {
                const p = pendDe(id);
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ minWidth: 70 }}>{id}</strong>
                    <select value={alt[id] || ""} onChange={(e) => setAlt((a) => { const n = { ...a }; if (e.target.value) n[id] = e.target.value; else delete n[id]; return n; })} aria-label={`Mudar o aluno ${id} para`} style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${LINHA}`, font: "inherit", fontSize: 13 }}>
                      <option value="">Fica nesta turma</option>
                      {opcoes(aberta).map((t) => (
                        <option key={t} value={t}>
                          Mudar para {t}
                        </option>
                      ))}
                    </select>
                    {p && !alt[id] && <span style={{ fontSize: 12, color: AMBAR }}>pendente: {p.para}</span>}
                  </div>
                );
              })}
              {Object.entries(alt).filter(([id, para]) => para === aberta && !ids.includes(id)).map(([id]) => (
                <div key={id} style={{ fontSize: 13, color: AZUL }}>
                  <strong>{id}</strong> passa para esta turma{" "}
                  <button type="button" onClick={() => setAlt((a) => { const n = { ...a }; delete n[id]; return n; })} style={{ border: "none", background: "none", color: CINZA, cursor: "pointer", textDecoration: "underline" }}>
                    tirar
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: `1px solid ${LINHA}`, paddingTop: 10 }}>
                <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={20} placeholder="Código de um aluno a juntar a esta turma" inputMode="numeric" style={{ flex: "1 1 220px", padding: "7px 9px", borderRadius: 8, border: `1px solid ${LINHA}`, font: "inherit", fontSize: 13 }} />
                <button type="button" onClick={juntarExtra} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${LINHA}`, background: "#fff", cursor: "pointer", font: "inherit", fontSize: 13 }}>
                  Juntar
                </button>
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${LINHA}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ flex: 1, fontSize: 12.5, color: CINZA }}>{nAlt ? `${nAlt} alteração(ões) por enviar` : "Sem alterações"}</span>
              <button type="button" disabled={!nAlt || aEnviar} onClick={async () => { await enviar(); setAberta(null); }} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: nAlt ? AZUL : "#B8C0CE", color: "#fff", fontWeight: 600, cursor: nAlt ? "pointer" : "default", font: "inherit" }}>
                {aEnviar ? "A enviar…" : "Enviar para validação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Operacional({ token }) {
  const [estado, setEstado] = useState("a carregar");
  const [pedido, setPedido] = useState(null);
  const [exp, setExp] = useState({}); // id → { r, motivo, turma, nota }
  const [ids, setIds] = useState({}); // turma → texto
  const [vazias, setVazias] = useState({}); // turma → true ("ainda não há alunos")
  const [novas, setNovas] = useState([]); // experiências acrescentadas pelo operacional (ex.: equipas de competição)
  const [nota, setNota] = useState("");
  const [av, setAv] = useState(""); // avaliação da eficácia de uma reclamação
  const [avNota, setAvNota] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(null);

  useEffect(() => {
    document.title = "Dragon Force · Pedido da escola";
    (async () => {
      const { data, error } = await supabase.rpc("op_pedido", { p_token: token });
      if (error || !data) return setEstado("invalido");
      setPedido(data);
      const r = data.respostas || {};
      const e0 = {};
      Object.entries(r.experiencias || {}).forEach(([k, v]) => (e0[k] = typeof v === "string" ? { r: v } : v));
      setExp(e0);
      const i0 = {};
      Object.entries(r.turmas || {}).forEach(([k, v]) => (i0[k] = (v || []).join(", ")));
      setIds(i0);
      setVazias(Object.fromEntries((r.turmasVazias || []).map((t) => [t, true])));
      setNota(r.nota || "");
      if (r.avaliacao) {
        setAv(r.avaliacao);
        setAvNota(r.nota || "");
      }
      setEstado(data.expirado ? "expirado" : "pronto");
    })();
  }, [token]);

  const itens = (pedido && pedido.itens) || {};
  const ehEficacia = itens.tipo === "eficacia";
  const experiencias = itens.experiencias || [];
  const turmas = itens.turmas || [];
  const motivos = itens.motivos || [];
  const turmasEscola = itens.turmasEscola || [];
  const faltaMotivo = experiencias.filter((x) => exp[x.id] && exp[x.id].r === "insucesso" && !exp[x.id].motivo);
  const faltaDetalhe = experiencias.filter((x) => exp[x.id] && exp[x.id].r === "insucesso" && ehOutro(exp[x.id].motivo) && !(exp[x.id].nota || "").trim());
  const respondidas = experiencias.filter((x) => exp[x.id] && exp[x.id].r).length;
  const nVazias = turmas.filter((t) => vazias[t.turma]).length;
  const guardadas = (pedido && pedido.respostas && pedido.respostas.novas) || [];
  const novasPreenchidas = novas.filter((n) => n.id.trim() || n.data || n.turma || n.r);
  const hojeISO = new Date().toISOString().slice(0, 10);
  const equipas = turmasEscola.filter(ehEquipa);
  const turmasNormais = turmasEscola.filter((t) => !ehEquipa(t));
  const mudaNova = (k, campos) => setNovas((l) => l.map((n) => (n.k === k ? { ...n, ...campos } : n)));
  const comIds = turmas.filter((t) => !vazias[t.turma] && lerIds(ids[t.turma]).length).length;
  const muda = (id, campos) => setExp((e) => ({ ...e, [id]: { ...(e[id] || {}), ...campos } }));

  const enviarAvaliacao = async () => {
    setErro("");
    if (!av) return setErro("Escolhe como ficou a situação.");
    setEstado("a enviar");
    const { data, error } = await supabase.rpc("op_responder", { p_token: token, p_respostas: { avaliacao: av, nota: avNota.trim() } });
    if (error) {
      setEstado("pronto");
      return setErro(/expirado/.test(error.message) ? "Este pedido já expirou." : /detalhe/.test(error.message) ? "Falta o detalhe." : "Não foi possível enviar. Tenta outra vez daqui a pouco.");
    }
    setEnviado(data);
    setEstado("enviado");
  };

  const enviar = async () => {
    if (ehEficacia) return enviarAvaliacao();
    setErro("");
    if (faltaMotivo.length) return setErro(faltaMotivo.length === 1 ? "Falta o motivo na experiência que não converteu." : `Falta o motivo em ${faltaMotivo.length} experiências que não converteram.`);
    if (faltaDetalhe.length) return setErro(faltaDetalhe.length === 1 ? "Quando o motivo é «Outro», explica-o no detalhe." : `Quando o motivo é «Outro», explica-o no detalhe (faltam ${faltaDetalhe.length}).`);
    const malNova = novasPreenchidas.find((n) => faltaNova(n));
    if (malNova) return setErro(`Numa experiência acrescentada falta ${faltaNova(malNova)}.`);
    if (!respondidas && !comIds && !nVazias && !novasPreenchidas.length && !nota.trim()) return setErro("Ainda não respondeste a nada.");
    setEstado("a enviar");
    const respostas = {
      novas: novasPreenchidas.map((n) => ({ id: n.id.trim(), data: n.data, turma: n.turma, r: n.r, ...(n.r === "insucesso" ? { motivo: n.motivo } : {}), ...(n.r === "sucesso" && (n.turmaFicou ?? n.turma) ? { turmaFicou: n.turmaFicou ?? n.turma } : {}), ...(n.nota.trim() ? { nota: n.nota.trim() } : {}) })),
      experiencias: Object.fromEntries(Object.entries(exp).filter(([, v]) => v && v.r)),
      turmas: Object.fromEntries(turmas.filter((t) => !vazias[t.turma]).map((t) => [t.turma, lerIds(ids[t.turma])]).filter(([, l]) => l.length)),
      turmasVazias: turmas.filter((t) => vazias[t.turma]).map((t) => t.turma),
      nota: nota.trim(),
    };
    const { data, error } = await supabase.rpc("op_responder", { p_token: token, p_respostas: respostas });
    if (error) {
      setEstado("pronto");
      return setErro(/expirado/.test(error.message) ? "Este pedido já expirou." : /detalhe/.test(error.message) ? "Falta o detalhe numa experiência com o motivo «Outro»." : /inválid|motivo/.test(error.message) ? "Há um dado inválido ou em falta numa experiência acrescentada (código, data, turma ou motivo)." : "Não foi possível enviar. Tenta outra vez daqui a pouco.");
    }
    setEnviado(data);
    setEstado("enviado");
  };

  const corpo = useMemo(() => {
    if (estado === "a carregar") return <div style={{ color: CINZA, fontSize: 14 }}>A abrir o pedido…</div>;
    if (estado === "invalido") return <Aviso titulo="Link inválido" texto="Este link não existe ou foi copiado incompleto. Abre-o outra vez a partir do e-mail." />;
    if (estado === "expirado") return <Aviso titulo="Pedido expirado" texto="Este pedido já não aceita respostas. O próximo chega no e-mail da semana." />;
    if (estado === "enviado" && pedido && pedido.itens && pedido.itens.tipo === "eficacia")
      return <Aviso titulo="Obrigado, a avaliação ficou registada" texto={`Podes voltar a abrir o link para a corrigir até ${dataPT(String(pedido.expira).slice(0, 10))}.`} cor={VERDE} />;
    if (estado === "enviado")
      return (
        <Aviso
          titulo="Obrigado, ficou registado"
          texto={`${enviado?.experiencias || 0} experiência(s) atualizadas na app${enviado?.turmas ? ` · códigos de ${enviado.turmas} turma(s)/equipa(s) enviados para confirmação` : ""}${enviado?.vazias ? ` · ${enviado.vazias} turma(s)/equipa(s) sem alunos por agora` : ""}${enviado?.novas ? ` · ${enviado.novas} experiência(s) acrescentada(s)` : ""}. Podes voltar a abrir o link para corrigir até ${dataPT(String(pedido.expira).slice(0, 10))}.`}
          cor={VERDE}
        />
      );
    return null;
  }, [estado, enviado, pedido]);

  useEffect(() => {
    if (ehEficacia) document.title = "Dragon Force · Avaliação de reclamação";
  }, [ehEficacia]);

  return (
    <div className="opEcra">
      <style>{CSS}</style>
      <div className="opFundo" aria-hidden="true">
        <div className="foto" style={{ backgroundImage: `url(${FOTO_ESTADIO})` }} />
        <div className="veu" />
      </div>
      <div className="opColuna">
        <div className="opMarca">
          <img src={LOGO_BRANCO} alt="" />
          <div>
            <div className="opMarcaTitulo">Dragon Force</div>
            <div className="opMarcaSub">Gestão da Qualidade · pedido à escola</div>
          </div>
        </div>
        <div className="opCartao">
          {corpo ||
            (itens.tipo === "reclamacao" ? (
              <>
                <div className="opRotulo">Reclamação para acompanhamento técnico</div>
                <h1 className="opTitulo">{pedido.escola}</h1>
                <div className="opMeta">
                  <span>Reclamação</span>
                  <strong>nº {String(itens.numero || "").padStart(4, "0")}</strong>
                  {itens.tema && (
                    <>
                      <span>Tema</span>
                      <strong>{itens.tema}</strong>
                    </>
                  )}
                  {itens.categoria && (
                    <>
                      <span>Categoria</span>
                      <strong>{itens.categoria}</strong>
                    </>
                  )}
                  {itens.recebida && (
                    <>
                      <span>Recebida</span>
                      <strong>{dataPT(itens.recebida)}</strong>
                    </>
                  )}
                  <span>Estado</span>
                  <strong>{itens.estado}</strong>
                </div>
                <section className="opSeccao">
                  <h2>O que aconteceu e onde</h2>
                  <p className="opNota" style={{ color: TINTA, whiteSpace: "pre-wrap" }}>{itens.descricao || "Sem descrição registada."}</p>
                  {itens.contexto && (
                    <>
                      <h2>Contexto adicional</h2>
                      <p className="opNota" style={{ color: TINTA, whiteSpace: "pre-wrap" }}>{itens.contexto}</p>
                    </>
                  )}
                </section>
                <div className="opRodape" style={{ textAlign: "left" }}>Página só de consulta. O link é pessoal e vale até {dataPT(String(pedido.expira).slice(0, 10))}. Não o reencaminhes.</div>
              </>
            ) : ehEficacia ? (
              <>
                <div className="opRotulo">Avaliação da resposta a uma reclamação</div>
                <h1 className="opTitulo">{pedido.escola}</h1>
                <div className="opMeta">
                  <span>Reclamação</span>
                  <strong>nº {String(itens.numero || "").padStart(4, "0")}</strong>
                  {itens.tema && (
                    <>
                      <span>Tema</span>
                      <strong>{itens.tema}</strong>
                    </>
                  )}
                  {itens.recebida && (
                    <>
                      <span>Recebida</span>
                      <strong>{dataPT(itens.recebida)}</strong>
                    </>
                  )}
                  {itens.concluida && (
                    <>
                      <span>Concluída</span>
                      <strong>{dataPT(itens.concluida)}</strong>
                    </>
                  )}
                  <span>Responde até</span>
                  <strong>{dataPT(String(pedido.expira).slice(0, 10))}</strong>
                </div>
                <section className="opSeccao">
                  {itens.resumo && (
                    <>
                      <h2>O que foi feito</h2>
                      <p className="opNota" style={{ color: TINTA }}>{itens.resumo}</p>
                    </>
                  )}
                  <h2>A resolução foi eficaz?</h2>
                  <p className="opNota">
                    Avalia {itens.papel === "coordenador" ? "do ponto de vista técnico" : "no dia a dia da escola"}: eficaz, parcialmente eficaz ou não eficaz.
                  </p>
                  <div className="opEscolha" role="radiogroup" aria-label="Eficácia da resposta">
                    {AVALIACOES.map(([k, l, cor, fundo]) => (
                      <button key={k} type="button" role="radio" aria-checked={av === k} onClick={() => setAv(k)} style={av === k ? { borderColor: cor, color: cor, background: fundo } : undefined}>
                        <span className="opBola" style={av === k ? { borderColor: cor, background: cor } : undefined} />
                        {l}
                      </button>
                    ))}
                  </div>
                  <label className="opLargo" style={{ marginTop: 12 }}>
                    <span className="opRotuloCampo">Comentário (opcional)</span>
                    <textarea
                      rows={3}
                      value={avNota}
                      maxLength={600}
                      onChange={(e) => setAvNota(e.target.value)}
                      placeholder="Não escrevas nomes nem dados de saúde."
                    />
                  </label>
                </section>
                {erro && <div className="opErro">{erro}</div>}
                <button type="button" className="opEnviar" onClick={enviar} disabled={estado === "a enviar"}>
                  {estado === "a enviar" ? "A enviar…" : "Enviar avaliação"}
                </button>
              </>
            ) : (
            <>
              <div className="opRotulo">Pedido da semana</div>
              <h1 className="opTitulo">{pedido.escola}</h1>
              <div className="opMeta">
                <span>Responde até</span>
                <strong>{dataPT(String(pedido.expira).slice(0, 10))}</strong>
                {pedido.respondido_em && (
                  <>
                    <span>Última resposta</span>
                    <strong>{dataPT(String(pedido.respondido_em).slice(0, 10))}</strong>
                  </>
                )}
              </div>

              {experiencias.length > 0 && (
                <section className="opSeccao">
                  <h2>Experiências com mais de 2 semanas</h2>
                  <p className="opNota">Ainda não aparecem inscritos. Diz como ficou cada uma. Se não converteu, indica o motivo.</p>
                  <div className="opLista">
                    {experiencias.map((x) => {
                      const v = exp[x.id] || {};
                      return (
                        <div key={x.id} className="opItem">
                          <div className="opItemCab">
                            <strong className="opCodigo">{x.id}</strong>
                            <span>experiência a {dataPT(x.data)}</span>
                            {x.turma && <span>· {x.turma}</span>}
                          </div>
                          <div className="opEscolha" role="radiogroup" aria-label={`Resultado da experiência ${x.id}`}>
                            {OPCOES.map(([k, l, cor, fundo]) => (
                              <button
                                key={k}
                                type="button"
                                role="radio"
                                aria-checked={v.r === k}
                                onClick={() => muda(x.id, { r: k })}
                                style={v.r === k ? { borderColor: cor, color: cor, background: fundo } : undefined}
                              >
                                <span className="opBola" style={v.r === k ? { borderColor: cor, background: cor } : undefined} />
                                {l}
                              </button>
                            ))}
                          </div>
                          {v.r === "sucesso" && turmasEscola.length > 0 && (
                            <div className="opDetalhe">
                              <label className="opLargo">
                                Turma ou equipa onde ficou
                                <select value={v.turmaFicou || ""} onChange={(e) => muda(x.id, { turmaFicou: e.target.value })}>
                                  <option value="">Ainda não sei</option>
                                  <OpcoesTurmas equipas={equipas} turmas={turmasNormais} />
                                </select>
                              </label>
                            </div>
                          )}
                          {v.r === "insucesso" && (
                            <div className="opDetalhe">
                              <label>
                                Motivo
                                <select value={v.motivo || ""} onChange={(e) => muda(x.id, { motivo: e.target.value })} className={!v.motivo ? "opFalta" : ""}>
                                  <option value="">Escolher…</option>
                                  {motivos.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {!x.turma && turmasEscola.length > 0 && (
                                <label>
                                  Turma ou equipa da experiência
                                  <select value={v.turma || ""} onChange={(e) => muda(x.id, { turma: e.target.value })}>
                                    <option value="">Não sei</option>
                                    {turmasEscola.map((t) => (
                                      <option key={t} value={t}>
                                        {t}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                              <label className="opLargo">
                                {ehOutro(v.motivo) ? "Detalhe (obrigatório: explica o motivo)" : "Detalhe (opcional)"}
                                <input
                                  value={v.nota || ""}
                                  maxLength={300}
                                  onChange={(e) => muda(x.id, { nota: e.target.value })}
                                  className={ehOutro(v.motivo) && !(v.nota || "").trim() ? "opFalta" : ""}
                                  placeholder="Sem nomes. Ex.: achou o treino muito exigente"
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {turmas.length > 0 && (
                <section className="opSeccao">
                  <h2>Turmas e equipas do plano sem alunos na app</h2>
                  <p className="opNota">Estão no plano semanal, mas a app não tem alunos inscritos nelas. Escreve os códigos (ID) dos alunos que treinam em cada uma, separados por vírgulas, ou assinala que ainda não há alunos. Os códigos vão para confirmação antes de mudarem na app.</p>
                  <div className="opLista">
                    {turmas.map((t) => {
                      const vazia = !!vazias[t.turma];
                      const n = vazia ? 0 : lerIds(ids[t.turma]).length;
                      return (
                        <div key={t.turma} className="opItem">
                          <div className="opItemCab">
                            <strong>{t.turma}</strong>
                            <span>{(t.horarios || []).join(" · ")}</span>
                            {n > 0 && <span className="opConta">{n} {n === 1 ? "código" : "códigos"}</span>}
                          </div>
                          <label className="opCheck">
                            <input type="checkbox" checked={vazia} onChange={(e) => setVazias((s) => ({ ...s, [t.turma]: e.target.checked }))} />
                            Ainda não há alunos nesta turma/equipa
                          </label>
                          <textarea
                            rows={2}
                            value={vazia ? "" : ids[t.turma] || ""}
                            disabled={vazia}
                            onChange={(e) => setIds((s) => ({ ...s, [t.turma]: e.target.value }))}
                            placeholder={vazia ? "Sem alunos por agora" : "Ex.: 22534, 22987, 23011"}
                            inputMode="numeric"
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {(itens.lotacao || []).length > 0 && <LotacaoTurmas token={token} itens={itens} propostas={pedido.propostas} />}

              {turmasEscola.length > 0 && (
                <section className="opSeccao">
                  <h2>Experiências que faltam na lista</h2>
                  <p className="opNota">Fizeste experiências que não aparecem acima, por exemplo em equipas de competição (Sub-…)? Acrescenta-as: código do atleta, data, turma ou equipa e como ficou.</p>
                  {guardadas.length > 0 && (
                    <div className="opLista">
                      {guardadas.map((g) => (
                        <div key={g.id} className="opItem opBloqueado">
                          <div className="opItemCab">
                            <strong className="opCodigo">{g.id}</strong>
                            <span>experiência a {dataPT(g.data)}</span>
                            <span>· {g.turma}</span>
                            <span className="opConta" style={{ color: CINZA }}>{ROTULO_RES[g.r] || g.r}{g.motivo ? ` · ${g.motivo}` : ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="opLista">
                    {novas.map((n) => (
                      <div key={n.k} className="opItem">
                        <div className="opItemCab">
                          <strong>Nova experiência</strong>
                          <button type="button" className="opRemover" onClick={() => setNovas((l) => l.filter((x) => x.k !== n.k))}>
                            Remover
                          </button>
                        </div>
                        <div className="opDetalhe">
                          <label>
                            Código do atleta (ID)
                            <input value={n.id} maxLength={20} onChange={(e) => mudaNova(n.k, { id: e.target.value })} placeholder="Ex.: 22534" />
                          </label>
                          <label>
                            Data da experiência
                            <input type="date" value={n.data} max={hojeISO} onChange={(e) => mudaNova(n.k, { data: e.target.value })} />
                          </label>
                          <label className="opLargo">
                            Turma ou equipa
                            <select value={n.turma} onChange={(e) => mudaNova(n.k, { turma: e.target.value })}>
                              <option value="">Escolher…</option>
                              {equipas.length > 0 && (
                                <optgroup label="Equipas de competição">
                                  {equipas.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {turmasNormais.length > 0 && (
                                <optgroup label="Turmas">
                                  {turmasNormais.map((t) => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </label>
                        </div>
                        <div className="opEscolha" role="radiogroup" aria-label="Resultado da experiência acrescentada">
                          {OPCOES.map(([k, l, cor, fundo]) => (
                            <button key={k} type="button" role="radio" aria-checked={n.r === k} onClick={() => mudaNova(n.k, { r: k })} style={n.r === k ? { borderColor: cor, color: cor, background: fundo } : undefined}>
                              <span className="opBola" style={n.r === k ? { borderColor: cor, background: cor } : undefined} />
                              {l}
                            </button>
                          ))}
                        </div>
                        {n.r === "sucesso" && (
                          <div className="opDetalhe">
                            <label className="opLargo">
                              Turma ou equipa onde ficou
                              <select value={n.turmaFicou ?? n.turma} onChange={(e) => mudaNova(n.k, { turmaFicou: e.target.value })}>
                                <option value="">Ainda não sei</option>
                                <OpcoesTurmas equipas={equipas} turmas={turmasNormais} />
                              </select>
                            </label>
                          </div>
                        )}
                        {n.r === "insucesso" && (
                          <div className="opDetalhe">
                            <label>
                              Motivo
                              <select value={n.motivo} onChange={(e) => mudaNova(n.k, { motivo: e.target.value })} className={!n.motivo ? "opFalta" : ""}>
                                <option value="">Escolher…</option>
                                {motivos.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              {ehOutro(n.motivo) ? "Detalhe (obrigatório)" : "Detalhe (opcional)"}
                              <input value={n.nota} maxLength={300} onChange={(e) => mudaNova(n.k, { nota: e.target.value })} className={ehOutro(n.motivo) && !n.nota.trim() ? "opFalta" : ""} placeholder="Sem nomes" />
                            </label>
                          </div>
                        )}
                        {n.r !== "insucesso" && (
                          <label className="opLargo">
                            Detalhe (opcional)
                            <input value={n.nota} maxLength={300} onChange={(e) => mudaNova(n.k, { nota: e.target.value })} placeholder="Sem nomes" />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" className="opMais" onClick={() => setNovas((l) => [...l, novaVazia()])}>
                    + Acrescentar experiência
                  </button>
                </section>
              )}

              <section className="opSeccao">
                <label className="opLargo">
                  <span className="opRotuloCampo">Observações (opcional)</span>
                  <textarea rows={3} value={nota} maxLength={1000} onChange={(e) => setNota(e.target.value)} placeholder="Vão para a gestão da qualidade. Não escrevas nomes nem dados de saúde." />
                </label>
              </section>

              {erro && <div className="opErro">{erro}</div>}
              <button type="button" className="opEnviar" onClick={enviar} disabled={estado === "a enviar"}>
                {estado === "a enviar" ? "A enviar…" : "Enviar respostas"}
              </button>
              <div className="opRodape">
                {respondidas} de {experiencias.length} experiências respondidas{novasPreenchidas.length ? ` · ${novasPreenchidas.length} acrescentada(s)` : ""}{turmas.length ? ` · ${comIds + nVazias} de ${turmas.length} turmas tratadas` : ""}
              </div>
            </>
            ))}
        </div>
      </div>
    </div>
  );
}

function Aviso({ titulo, texto, cor = TINTA }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <h1 className="opTitulo" style={{ color: cor }}>
        {titulo}
      </h1>
      <p style={{ color: CINZA, fontSize: 14.5, lineHeight: 1.55, margin: "8px 0 0" }}>{texto}</p>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
html, body { margin: 0; background: #07142A; }
.opEcra { min-height: 100vh; font-family: 'Inter', system-ui, -apple-system, sans-serif; color: ${TINTA}; -webkit-font-smoothing: antialiased; position: relative; isolation: isolate; }
.opFundo { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: #07142A; }
.opFundo .foto { position: absolute; inset: 0 0 0 40%; background-size: cover; background-position: 50% 30%; filter: grayscale(1); opacity: .55; }
.opFundo .veu { position: absolute; inset: 0; background: linear-gradient(90deg, #07142A 0%, rgba(7,20,42,.92) 38%, rgba(11,42,91,.72) 70%, rgba(11,42,91,.55) 100%); mix-blend-mode: normal; }
.opColuna { max-width: 560px; margin: 0 auto; padding: 40px 16px 56px; }
.opMarca { display: flex; align-items: center; gap: 12px; color: #fff; margin-bottom: 18px; }
.opMarca img { height: 38px; }
.opMarcaTitulo { font-weight: 700; font-size: 16px; }
.opMarcaSub { font-size: 12px; color: #B9C6DA; margin-top: 2px; }
.opCartao { background: #fff; border-radius: 18px; padding: 24px 22px 22px; box-shadow: 0 24px 60px -20px rgba(0,0,0,.55); }
.opRotulo { font-size: 12.5px; color: ${CINZA}; }
.opTitulo { margin: 4px 0 14px; font-size: 26px; line-height: 1.15; letter-spacing: -.02em; font-weight: 700; }
.opMeta { display: grid; grid-template-columns: auto 1fr; gap: 8px 20px; font-size: 14px; padding-bottom: 16px; border-bottom: 1px solid ${LINHA}; }
.opMeta span { color: ${CINZA}; }
.opSeccao { padding: 18px 0 4px; border-bottom: 1px solid ${LINHA}; }
.opSeccao:last-of-type { border-bottom: none; }
.opSeccao h2 { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${CINZA}; margin: 0 0 6px; }
.opNota { font-size: 13.5px; color: ${CINZA}; line-height: 1.5; margin: 0 0 12px; }
.opLista { display: grid; gap: 10px; margin-bottom: 14px; }
.opItem { border: 1px solid ${LINHA}; border-radius: 12px; padding: 12px; display: grid; gap: 10px; }
.opItemCab { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: baseline; font-size: 13.5px; color: ${CINZA}; }
.opItemCab strong { color: ${TINTA}; font-size: 15px; }
.opCodigo { font-variant-numeric: tabular-nums; }
.opConta { margin-left: auto; color: ${VERDE}; font-weight: 600; }
.opEscolha { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.opEscolha button { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; border: 1.5px solid ${LINHA}; background: #fff; border-radius: 10px; font: inherit; font-size: 13px; font-weight: 600; color: ${CINZA}; cursor: pointer; padding: 6px; text-align: center; }
.opBola { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid #B5BDCA; flex: none; box-sizing: border-box; }
.opDetalhe { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.opDetalhe label, .opLargo { display: grid; gap: 4px; font-size: 12.5px; color: ${CINZA}; font-weight: 500; }
.opLargo { grid-column: 1 / -1; }
.opRotuloCampo { font-size: 14px; color: ${TINTA}; font-weight: 600; }
.opCartao select, .opCartao input, .opCartao textarea { font: inherit; font-size: 14px; color: ${TINTA}; border: 1px solid #CDD4DF; border-radius: 9px; padding: 9px 10px; background: #fff; width: 100%; box-sizing: border-box; }
.opCartao textarea { resize: vertical; }
.opBloqueado { background: #F7F9FC; }
.opRemover { margin-left: auto; border: none; background: none; color: ${CINZA}; font: inherit; font-size: 12.5px; text-decoration: underline; cursor: pointer; padding: 4px; }
.opMais { width: 100%; min-height: 44px; border: 1.5px dashed #B5BDCA; background: #fff; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 600; color: ${AZUL}; cursor: pointer; margin-bottom: 14px; }
.opCartao textarea:disabled { background: #F3F5F9; color: #8A93A3; }
.opCheck { display: flex; align-items: center; gap: 9px; font-size: 14px; color: ${TINTA}; font-weight: 500; cursor: pointer; min-height: 32px; }
.opCartao .opCheck input { width: 18px; height: 18px; padding: 0; flex: none; accent-color: ${AZUL}; }
.opCartao .opFalta { border-color: ${LARANJA}; }
.opErro { color: ${LARANJA}; font-size: 13.5px; margin: 12px 0 0; font-weight: 600; }
.opEnviar { margin-top: 16px; width: 100%; min-height: 48px; border: none; border-radius: 12px; background: ${AZUL}; color: #fff; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
.opEnviar:disabled { opacity: .6; cursor: default; }
.opRodape { text-align: center; font-size: 12px; color: ${CINZA}; margin-top: 10px; }
@media (max-width: 480px) {
  .opColuna { padding-top: 24px; }
  .opFundo .foto { inset: 0; opacity: .35; }
  .opEscolha { grid-template-columns: 1fr; }
  .opDetalhe { grid-template-columns: 1fr; }
}
`;
