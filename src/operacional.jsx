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

const dataPT = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : "");
const lerIds = (t) =>
  [...new Set(String(t || "").split(/[\s,;]+/).map((x) => x.trim()).filter((x) => /^[0-9A-Za-z-]{1,20}$/.test(x)))];

export default function Operacional({ token }) {
  const [estado, setEstado] = useState("a carregar");
  const [pedido, setPedido] = useState(null);
  const [exp, setExp] = useState({}); // id → { r, motivo, turma, nota }
  const [ids, setIds] = useState({}); // turma → texto
  const [nota, setNota] = useState("");
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
      setNota(r.nota || "");
      setEstado(data.expirado ? "expirado" : "pronto");
    })();
  }, [token]);

  const itens = (pedido && pedido.itens) || {};
  const experiencias = itens.experiencias || [];
  const turmas = itens.turmas || [];
  const motivos = itens.motivos || [];
  const turmasEscola = itens.turmasEscola || [];
  const faltaMotivo = experiencias.filter((x) => exp[x.id] && exp[x.id].r === "insucesso" && !exp[x.id].motivo);
  const respondidas = experiencias.filter((x) => exp[x.id] && exp[x.id].r).length;
  const comIds = turmas.filter((t) => lerIds(ids[t.turma]).length).length;
  const muda = (id, campos) => setExp((e) => ({ ...e, [id]: { ...(e[id] || {}), ...campos } }));

  const enviar = async () => {
    setErro("");
    if (faltaMotivo.length) return setErro(faltaMotivo.length === 1 ? "Falta o motivo na experiência que não converteu." : `Falta o motivo em ${faltaMotivo.length} experiências que não converteram.`);
    if (!respondidas && !comIds && !nota.trim()) return setErro("Ainda não respondeste a nada.");
    setEstado("a enviar");
    const respostas = {
      experiencias: Object.fromEntries(Object.entries(exp).filter(([, v]) => v && v.r)),
      turmas: Object.fromEntries(turmas.map((t) => [t.turma, lerIds(ids[t.turma])]).filter(([, l]) => l.length)),
      nota: nota.trim(),
    };
    const { data, error } = await supabase.rpc("op_responder", { p_token: token, p_respostas: respostas });
    if (error) {
      setEstado("pronto");
      return setErro(/expirado/.test(error.message) ? "Este pedido já expirou." : "Não foi possível enviar. Tenta outra vez daqui a pouco.");
    }
    setEnviado(data);
    setEstado("enviado");
  };

  const corpo = useMemo(() => {
    if (estado === "a carregar") return <div style={{ color: CINZA, fontSize: 14 }}>A abrir o pedido…</div>;
    if (estado === "invalido") return <Aviso titulo="Link inválido" texto="Este link não existe ou foi copiado incompleto. Abre-o outra vez a partir do e-mail." />;
    if (estado === "expirado") return <Aviso titulo="Pedido expirado" texto="Este pedido já não aceita respostas. O próximo chega no e-mail da semana." />;
    if (estado === "enviado")
      return (
        <Aviso
          titulo="Obrigado, ficou registado"
          texto={`${enviado?.experiencias || 0} experiência(s) atualizadas na app${enviado?.turmas ? ` · códigos de ${enviado.turmas} turma(s)/equipa(s) enviados para confirmação` : ""}. Podes voltar a abrir o link para corrigir até ${dataPT(String(pedido.expira).slice(0, 10))}.`}
          cor={VERDE}
        />
      );
    return null;
  }, [estado, enviado, pedido]);

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
          {corpo || (
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
                                Detalhe (opcional)
                                <input value={v.nota || ""} maxLength={300} onChange={(e) => muda(x.id, { nota: e.target.value })} placeholder="Sem nomes. Ex.: achou o treino muito exigente" />
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
                  <p className="opNota">Estão no plano semanal, mas a app não tem alunos inscritos nelas. Escreve os códigos (ID) dos alunos que treinam em cada uma, separados por vírgulas. Vão para confirmação antes de mudarem na app.</p>
                  <div className="opLista">
                    {turmas.map((t) => {
                      const n = lerIds(ids[t.turma]).length;
                      return (
                        <div key={t.turma} className="opItem">
                          <div className="opItemCab">
                            <strong>{t.turma}</strong>
                            <span>{(t.horarios || []).join(" · ")}</span>
                            {n > 0 && <span className="opConta">{n} {n === 1 ? "código" : "códigos"}</span>}
                          </div>
                          <textarea rows={2} value={ids[t.turma] || ""} onChange={(e) => setIds((s) => ({ ...s, [t.turma]: e.target.value }))} placeholder="Ex.: 22534, 22987, 23011" inputMode="numeric" />
                        </div>
                      );
                    })}
                  </div>
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
                {respondidas} de {experiencias.length} experiências respondidas{turmas.length ? ` · ${comIds} de ${turmas.length} turmas com códigos` : ""}
              </div>
            </>
          )}
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
