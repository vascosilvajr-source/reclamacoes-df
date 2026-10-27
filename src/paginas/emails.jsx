// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import { useState, useEffect, useMemo, useCallback } from "react";
import { dbStorage, supabase } from "../supabaseClient";
import { Mail, X } from "lucide-react";
import { previaEmail } from "../emailsHtml.js";
import { COLORS, MOTIVOS_EXPERIENCIA_PADRAO, inputStyle, linkBtnStyle, normChave, panelStyle, primaryBtnStyle, secondaryBtnStyle } from "../nucleo.jsx";
import { JanelaSGQ, tdStyle, thStyle } from "../partilhado.jsx";

const lerEmails = (t) => [...new Set(String(t || "").split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))];

export function ContactosEscolas({ escolas, options, onGuardar, onFechar }) {
  const [ops, setOps] = useState(() => Object.fromEntries(escolas.map((e) => [e, ((options.emailsOperacionais || {})[e] || []).join("\n")])));
  const [cts, setCts] = useState(() => Object.fromEntries(escolas.map((e) => [e, ((options.emailsCoordenadores || {})[e] || []).join("\n")])));
  const [responder, setResponder] = useState((options.emailResponderOperacionais || []).join(", "));
  const [motivos, setMotivos] = useState((options.motivosExperiencia || MOTIVOS_EXPERIENCIA_PADRAO).join("\n"));
  const [geral, setGeral] = useState((options.emailsCoordenadorGeral || []).join("\n"));
  const [respAud, setRespAud] = useState((options.emailsResponsavelAuditoria || []).join("\n"));
  const [direcao, setDirecao] = useState((options.emailsDirecaoExecutiva || []).join("\n"));
  const [tecnicos, setTecnicos] = useState(options.temasTecnicos || []);
  const [filtro, setFiltro] = useState("");
  const invalidos = [...Object.values(ops), ...Object.values(cts), responder, geral, respAud, direcao]
    .flatMap((t) => String(t || "").split(/[\s,;]+/).filter(Boolean))
    .filter((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  const guardar = () => {
    const limpa = (m) => Object.fromEntries(Object.entries(m).map(([e, t]) => [e, lerEmails(t)]).filter(([, l]) => l.length));
    onGuardar({
      emailsOperacionais: limpa(ops),
      emailsCoordenadores: limpa(cts),
      emailResponderOperacionais: lerEmails(responder),
      emailsCoordenadorGeral: lerEmails(geral),
      emailsResponsavelAuditoria: lerEmails(respAud),
      emailsDirecaoExecutiva: lerEmails(direcao),
      temasTecnicos: tecnicos.filter((t) => (options.categories || []).includes(t)),
      motivosExperiencia: [...new Set(motivos.split("\n").map((x) => x.trim()).filter(Boolean))],
    });
  };
  const visiveis = escolas.filter((e) => !filtro || normChave(e).includes(normChave(filtro)));
  const ta = { ...inputStyle, padding: "6px 8px", fontSize: 12.5, resize: "vertical", fontFamily: "inherit", minHeight: 34 };
  return (
    <JanelaSGQ
      titulo="Contactos das escolas"
      largura={940}
      onFechar={onFechar}
      rodape={
        <>
          <span style={{ flex: 1, fontSize: 12, color: invalidos.length ? COLORS.warn : COLORS.slate }}>{invalidos.length ? `Não parecem e-mails (ficam de fora): ${invalidos.slice(0, 3).join(", ")}${invalidos.length > 3 ? "…" : ""}` : "Vários e-mails por escola: um por linha ou separados por vírgulas."}</span>
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
            Cancelar
          </button>
          <button onClick={guardar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}>
            Guardar
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.55 }}>
          <strong>Operacionais</strong> recebem à terça-feira o pedido da escola (experiências com mais de 2 semanas e turmas do plano sem alunos). <strong>Coordenador técnico</strong> recebe as experiências que não converteram por motivo técnico e as turmas/equipas com muitas experiências não convertidas, e as reclamações dos temas técnicos, cada uma com link para ver a descrição. <strong>Coordenador técnico geral, responsável de área da auditoria e direção executiva</strong> recebem, à terça-feira, o resumo da rede: escolas que precisam de atenção, escolas em destaque, escolas com mais desistências e todas as reclamações em andamento.
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 260px", display: "grid", gap: 4, fontSize: 12.5, color: COLORS.ink2 }}>
            Respostas aos e-mails vão para (o teu @fcporto.pt)
            <input value={responder} onChange={(e) => setResponder(e.target.value)} placeholder="nome@fcporto.pt" style={{ ...inputStyle, padding: "7px 10px", fontSize: 13 }} />
          </label>
          <label style={{ flex: "1 1 220px", display: "grid", gap: 4, fontSize: 12.5, color: COLORS.ink2 }}>
            Procurar escola
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...inputStyle, padding: "7px 10px", fontSize: 13 }} />
          </label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Escola</th>
                <th style={thStyle}>Operacionais</th>
                <th style={thStyle}>Coordenador técnico</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((e) => (
                <tr key={e}>
                  <td style={{ ...tdStyle, fontWeight: 600, verticalAlign: "top", whiteSpace: "nowrap" }}>{e}</td>
                  <td style={{ ...tdStyle, minWidth: 240 }}>
                    <textarea rows={Math.max(1, String(ops[e] || "").split("\n").length)} value={ops[e] || ""} onChange={(ev) => setOps((m) => ({ ...m, [e]: ev.target.value }))} placeholder="operacional@…" style={{ ...ta, width: "100%" }} />
                  </td>
                  <td style={{ ...tdStyle, minWidth: 240 }}>
                    <textarea rows={Math.max(1, String(cts[e] || "").split("\n").length)} value={cts[e] || ""} onChange={(ev) => setCts((m) => ({ ...m, [e]: ev.target.value }))} placeholder="coordenador@…" style={{ ...ta, width: "100%" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: COLORS.ink2 }}>
          Motivos de não conversão que os operacionais podem escolher (um por linha; os que têm "técnico" vão para o coordenador)
          <textarea rows={5} value={motivos} onChange={(e) => setMotivos(e.target.value)} style={{ ...ta, width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 260px", display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, color: COLORS.slate }}>Resumo semanal da rede (vai igual para os três):</div>
            {[
              ["Coordenador técnico geral", geral, setGeral, "coordenador.geral@…"],
              ["Responsável de área da auditoria", respAud, setRespAud, "auditoria@…"],
              ["Direção executiva", direcao, setDirecao, "direcao@…"],
            ].map(([rot, v, set, ph]) => (
              <label key={rot} style={{ display: "grid", gap: 4, fontSize: 12.5, color: COLORS.ink2 }}>
                {rot} (e-mails)
                <textarea rows={Math.max(2, String(v || "").split("\n").length)} value={v} onChange={(e) => set(e.target.value)} placeholder={ph} style={{ ...ta, width: "100%" }} />
              </label>
            ))}
          </div>
          <div style={{ flex: "1 1 340px", display: "grid", gap: 6, fontSize: 12.5, color: COLORS.ink2 }}>
            <span>Temas de reclamação que contam como técnicos (aparecem no resumo do coordenador geral)</span>
            {(options.categories || []).length === 0 ? (
              <span style={{ color: COLORS.slate }}>Ainda não há temas. Cria-os em Listas › Temas de reclamação.</span>
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(options.categories || []).map((t) => {
                  const on = tecnicos.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTecnicos((l) => (on ? l.filter((x) => x !== t) : [...l, t]))}
                      style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: `1.5px solid ${on ? COLORS.navy : COLORS.rule}`, background: on ? COLORS.navy : "transparent", color: on ? "#fff" : COLORS.ink }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </JanelaSGQ>
  );
}

// Histórico de e-mails por escola: o que foi enviado, aberto, lembrado e respondido.
// Só lê tipos, datas e estados (nunca os dados dos pedidos).
export function HistoricoEmailsEscolas({ escolas }) {
  const [dias, setDias] = useState(90);
  const [linhas, setLinhas] = useState(null);
  const [escolaSel, setEscolaSel] = useState("");
  useEffect(() => {
    let ativo = true;
    (async () => {
      setLinhas(null);
      const desde = new Date(Date.now() - dias * 86400000).toISOString();
      const out = [];
      try {
        const { data } = await supabase
          .from("pedidos_operacionais")
          .select("token,escola,criado,enviado_em,aberto_em,lembrete_em,respondido_em,contactado_em,tipo:itens->>tipo,numero:itens->>numero,papel:itens->>papel")
          .gte("criado", desde)
          .order("criado", { ascending: false })
          .limit(2000);
        (data || []).forEach((p) =>
          out.push({
            id: p.token,
            escola: p.escola,
            em: p.enviado_em || p.criado,
            tipo: p.tipo === "eficacia" ? `Avaliação de eficácia · reclamação nº ${String(p.numero || "").padStart(4, "0")}${p.papel === "coordenador" ? " (coordenador)" : ""}` : p.tipo === "reclamacao" ? "Reclamação técnica" : "Semanal aos operacionais",
            pedido: true,
            enviado: !!p.enviado_em,
            aberto: p.aberto_em,
            lembrete: p.lembrete_em,
            respondido: p.respondido_em,
            contactado: p.contactado_em,
          })
        );
      } catch (e) {
        /* sem acesso */
      }
      try {
        const { data } = await supabase.from("emails_fila").select("id,tipo,escola,criado,enviado_em,erro,tentativas").in("tipo", ["coordenador"]).gte("criado", desde).order("id", { ascending: false }).limit(1000);
        (data || []).forEach((f) => out.push({ id: `f${f.id}`, escola: f.escola, em: f.enviado_em || f.criado, tipo: "Coordenador técnico", pedido: false, enviado: !!f.enviado_em, falhou: !f.enviado_em && f.tentativas >= 6 }));
      } catch (e) {
        /* sem acesso */
      }
      if (ativo) setLinhas(out.sort((a, b) => String(b.em).localeCompare(String(a.em))));
    })();
    return () => {
      ativo = false;
    };
  }, [dias]);

  const data = (iso) => (iso ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
  const resumo = useMemo(() => {
    const r = {};
    (escolas || []).forEach((e) => (r[e] = { escola: e, enviados: 0, pedidos: 0, abertos: 0, respondidos: 0, lembretes: 0, ultimo: "" }));
    (linhas || []).forEach((l) => {
      const x = r[l.escola] || (r[l.escola] = { escola: l.escola, enviados: 0, pedidos: 0, abertos: 0, respondidos: 0, lembretes: 0, ultimo: "" });
      if (!l.enviado) return;
      x.enviados++;
      if (l.em > x.ultimo) x.ultimo = l.em;
      if (!l.pedido) return;
      x.pedidos++;
      if (l.aberto || l.respondido) x.abertos++;
      if (l.respondido) x.respondidos++;
      if (l.lembrete) x.lembretes++;
    });
    return Object.values(r).filter((x) => x.enviados).sort((a, b) => (a.pedidos ? a.abertos / a.pedidos : 2) - (b.pedidos ? b.abertos / b.pedidos : 2) || a.escola.localeCompare(b.escola, "pt"));
  }, [linhas, escolas]);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const th = { textAlign: "left", fontSize: 11, color: COLORS.slate, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "6px 8px", borderBottom: `1px solid ${COLORS.rule}`, whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", borderBottom: `1px solid ${COLORS.ruleSoft}`, fontSize: 12.5, verticalAlign: "top" };
  const daEscola = (linhas || []).filter((l) => l.escola === escolaSel);
  const estado = (l) => {
    if (!l.enviado) return [l.falhou ? "Falhou" : "Na fila", l.falhou ? COLORS.danger : COLORS.slate];
    if (!l.pedido) return ["Enviado", COLORS.ink2];
    if (l.respondido) return [`Respondido ${data(l.respondido)}`, COLORS.ok];
    if (l.aberto) return [`Aberto ${data(l.aberto)}`, COLORS.navySoft];
    if (l.contactado) return [`Sem abrir · contactado ${data(l.contactado)}`, COLORS.warn];
    return [l.lembrete ? `Sem abrir · lembrete ${data(l.lembrete)}` : "Ainda sem abrir", COLORS.warn];
  };

  return (
    <div style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, flex: "1 1 220px" }}>Histórico por escola</div>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Período" style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12.5 }}>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
          <option value={365}>Último ano</option>
        </select>
      </div>
      <div style={{ fontSize: 12, color: COLORS.ink2, marginBottom: 10 }}>Abertura e resposta contam só os e-mails com link (semanais e avaliações de eficácia). As escolas que menos abrem aparecem primeiro. Carrega numa escola para ver cada envio.</div>
      {linhas === null ? (
        <div style={{ fontSize: 12.5, color: COLORS.slate }}>A carregar…</div>
      ) : !resumo.length ? (
        <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem envios neste período.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {["Escola", "Enviados", "Abertos", "Respondidos", "Com lembrete", "Último envio"].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumo.map((x) => (
                <tr key={x.escola} className="rowHover" onClick={() => setEscolaSel(escolaSel === x.escola ? "" : x.escola)} style={{ cursor: "pointer", background: escolaSel === x.escola ? COLORS.paper : undefined }}>
                  <td style={{ ...td, fontWeight: 600 }}>{x.escola}</td>
                  <td style={td}>{x.enviados}</td>
                  <td style={{ ...td, color: x.pedidos && x.abertos / x.pedidos < 0.5 ? COLORS.warn : undefined, fontWeight: x.pedidos && x.abertos / x.pedidos < 0.5 ? 600 : 400 }}>
                    {x.abertos}/{x.pedidos} · {pct(x.abertos, x.pedidos)}
                  </td>
                  <td style={td}>
                    {x.respondidos}/{x.pedidos} · {pct(x.respondidos, x.pedidos)}
                  </td>
                  <td style={td}>{x.lembretes}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{data(x.ultimo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {escolaSel && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.rule}`, paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{escolaSel}</div>
            <button type="button" onClick={() => setEscolaSel("")} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
              Fechar
            </button>
          </div>
          {daEscola.map((l) => {
            const [txt, cor] = estado(l);
            return (
              <div key={l.id} style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, padding: "5px 0", borderTop: `1px solid ${COLORS.ruleSoft}` }}>
                <span style={{ width: 92, color: COLORS.slate, flex: "none" }}>{data(l.em)}</span>
                <span style={{ flex: "1 1 200px", minWidth: 0 }}>{l.tipo}</span>
                <span style={{ color: cor, fontWeight: 600 }}>{txt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Envio individual: só a um destinatário (operacional ou coordenador de uma escola, ou um dos três do resumo da rede).
// Sai em poucos minutos e não gasta o envio semanal.
const DESTINOS_ENVIO = [
  ["operacional", "Operacional de uma escola", true],
  ["coordenador", "Coordenador técnico de uma escola", true],
  ["geral", "Coordenador técnico geral (resumo da rede)", false],
  ["auditoria", "Responsável de área da auditoria (resumo da rede)", false],
  ["direcao", "Direção executiva (resumo da rede)", false],
];
function EnviarEscola({ op, escolas, pedidoEm, envio, quando }) {
  const [papel, setPapel] = useState("operacional");
  const [esc, setEsc] = useState("");
  const c = op.contactos || {};
  const [, , comEscola] = DESTINOS_ENVIO.find((d) => d[0] === papel);
  const chave = { operacional: "emailsOperacionais", coordenador: "emailsCoordenadores" }[papel];
  const chaveGeral = { geral: "emailsCoordenadorGeral", auditoria: "emailsResponsavelAuditoria", direcao: "emailsDirecaoExecutiva" }[papel];
  const comEmail = comEscola ? escolas.filter((e) => ((c[chave] || {})[e] || []).length) : [];
  const nGeral = chaveGeral ? (c[chaveGeral] || []).length : 0;
  const pronto = comEscola ? !!esc : nGeral > 0;
  const [previa, setPrevia] = useState(null); // { a carregar | erro | lista }
  const verPrevia = async () => {
    setPrevia({ aCarregar: true });
    const { data, error } = await supabase.rpc("op_previa", { p_escola: comEscola ? esc : "", p_papel: papel });
    if (error) return setPrevia({ erro: "Não consegui gerar a pré-visualização. Confirma que colaste o operacionais.sql no Supabase." });
    const itens = (data || []).map((x) => ({ ...x, ...previaEmail(x.tipo, x.dados) })).filter((x) => x.html);
    setPrevia(itens.length ? { itens } : { erro: comEscola ? "Esta escola não tem e-mail definido para este destinatário (ver Contactos das escolas)." : "Sem e-mail definido para este destinatário (ver Contactos das escolas)." });
  };
  const [eu, setEu] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEu((data && data.user && data.user.email) || "")).catch(() => {});
  }, []);
  const pe = op.pedidoEnvio;
  const aEsperar = pe && (pe.papeis || pe.escolas) && pedidoEm && (!envio || pedidoEm > (envio.ultimoPedido || ""));
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8, fontSize: 12.5 }}>
      <span style={{ color: COLORS.ink2 }}>Enviar só a:</span>
      <select value={papel} onChange={(e) => { setPapel(e.target.value); setEsc(""); }} aria-label="Destinatário" style={{ ...inputStyle, width: 290, padding: "5px 8px", fontSize: 12.5 }}>
        {DESTINOS_ENVIO.map(([k, rot]) => (
          <option key={k} value={k}>
            {rot}
          </option>
        ))}
      </select>
      {comEscola && (
        <select value={esc} onChange={(e) => setEsc(e.target.value)} aria-label="Escola" style={{ ...inputStyle, width: 200, padding: "5px 8px", fontSize: 12.5 }}>
          <option value="">Escolher escola…</option>
          {comEmail.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      )}
      {!comEscola && nGeral === 0 && <span style={{ color: COLORS.warn }}>Sem e-mail definido em "Contactos das escolas".</span>}
      <button disabled={!pronto || aEsperar} onClick={() => { op.onPedirEnvio(comEscola ? esc : undefined, papel); setEsc(""); }} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5, opacity: pronto && !aEsperar ? 1 : 0.5 }}>
        Enviar agora a este destinatário
      </button>
      <button disabled={!pronto} onClick={verPrevia} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5, opacity: pronto ? 1 : 0.5 }}>
        Ver preview
      </button>
      <button disabled={!pronto || aEsperar || !eu} title={eu ? `Chega só a ${eu}` : "Sem e-mail da conta"} onClick={() => { op.onPedirEnvio(comEscola ? esc : undefined, papel, eu); setEsc(""); }} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5, opacity: pronto && !aEsperar && eu ? 1 : 0.5 }}>
        Enviar preview para mim
      </button>
      {previa && (
        <div role="dialog" aria-modal="true" aria-label="Pré-visualização do e-mail" onClick={() => setPrevia(null)} style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.paperRaised, borderRadius: 14, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.rule}`, display: "flex", alignItems: "center", gap: 10 }}>
              <strong style={{ flex: 1, fontSize: 14 }}>Pré-visualização do e-mail</strong>
              <button onClick={() => setPrevia(null)} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.slate }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 14, overflowY: "auto", display: "grid", gap: 14 }}>
              {previa.aCarregar && <div style={{ color: COLORS.slate }}>A preparar…</div>}
              {previa.erro && <div style={{ color: COLORS.warn, fontWeight: 600 }}>{previa.erro}</div>}
              {(previa.itens || []).map((x, i) => (
                <div key={i} style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12.5 }}>
                    <div>
                      <span style={{ color: COLORS.slate }}>Assunto: </span>
                      <strong>{x.assunto}</strong>
                    </div>
                    <div>
                      <span style={{ color: COLORS.slate }}>Para: </span>
                      {(x.emails || []).join(", ")}
                    </div>
                  </div>
                  <iframe title={`Preview ${i + 1}`} sandbox="" srcDoc={x.html} style={{ width: "100%", height: 520, border: `1px solid ${COLORS.rule}`, borderRadius: 8, background: "#fff" }} />
                </div>
              ))}
              {previa.itens && <div style={{ fontSize: 11.5, color: COLORS.slate }}>É o que seria enviado agora, com os dados de hoje. Nada foi enviado nem gravado. Os links são de exemplo e não abrem.</div>}
            </div>
          </div>
        </div>
      )}
      {aEsperar && <span style={{ color: COLORS.warn, fontWeight: 600 }}>Pedido às {quando(pedidoEm)} · sai em poucos minutos</span>}
    </div>
  );
}

// Painel "Por validar": o que os operacionais preencheram, antes de entrar na app.
function PorValidar({ itens, sel, setSel, aAplicar, onAceitar, onRejeitar }) {
  if (!itens.length) return null;
  const marcado = (i) => (sel[i.key] === undefined ? i.padrao : sel[i.key]);
  const nMarcados = itens.filter(marcado).length;
  const escolas = [...new Set(itens.map((i) => i.escola))].sort((a, b) => a.localeCompare(b, "pt"));
  const nAvisos = itens.filter((i) => i.avisos.length).length;
  return (
    <div style={{ border: `1px solid ${COLORS.warn}`, background: COLORS.warnBg, borderRadius: 10, padding: "10px 12px", marginBottom: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: "1 1 240px" }}>
          Por validar ({itens.length}){nAvisos ? ` · ${nAvisos} com aviso` : ""}
          <div style={{ fontSize: 12, fontWeight: 400, color: COLORS.ink2 }}>Nada entra na app até aceitares. Os itens com aviso vêm desmarcados quando o código não existe.</div>
        </div>
        <button disabled={aAplicar || !nMarcados} onClick={onRejeitar} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12, color: COLORS.slate }}>
          Rejeitar as marcadas
        </button>
        <button disabled={aAplicar || !nMarcados} onClick={onAceitar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "5px 12px", fontSize: 12.5, opacity: nMarcados ? 1 : 0.5 }}>
          {aAplicar ? "A aplicar…" : `Aceitar as marcadas (${nMarcados})`}
        </button>
      </div>
      {escolas.map((e) => (
        <div key={e} style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{e}</div>
          {itens
            .filter((i) => i.escola === e)
            .map((i) => (
              <label key={i.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, cursor: "pointer" }}>
                <input type="checkbox" checked={marcado(i)} onChange={(ev) => setSel((s) => ({ ...s, [i.key]: ev.target.checked }))} style={{ marginTop: 3 }} />
                <span style={{ minWidth: 0 }}>
                  <strong>{i.titulo}</strong> <span style={{ color: COLORS.ink2 }}>{i.detalhe}</span>
                  {i.avisos.map((a, k) => (
                    <div key={k} style={{ color: COLORS.warn, fontWeight: 600 }}>
                      Atenção: {a}
                    </div>
                  ))}
                </span>
              </label>
            ))}
        </div>
      ))}
    </div>
  );
}

export function PainelEmailsEscolas({ op, escolas }) {
  const [pedidos, setPedidos] = useState(null);
  const [envio, setEnvio] = useState(null);
  const [aAplicar, setAAplicar] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const [fila, setFila] = useState(null);
  const [alteracoes, setAlteracoes] = useState([]);
  const carregar = useCallback(async () => {
    // Fila de e-mails (só tipo, escola e estado): o que ainda não saiu e o que falhou.
    try {
      const desde = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data, error } = await supabase.from("emails_fila").select("id,tipo,escola,criado,enviado_em,tentativas,erro,proxima").gte("criado", desde).order("id", { ascending: false }).limit(300);
      setFila(error ? null : data || []);
    } catch (e) {
      setFila(null);
    }
    try {
      const { data } = await supabase.from("pedidos_operacionais").select("*").order("criado", { ascending: false }).limit(80);
      setPedidos((data || []).filter((p) => !p.itens?.preview));
    } catch (e) {
      setPedidos([]);
    }
    try {
      const { data } = await supabase.from("alteracoes_turma").select("id,escola,epoca,aluno,de,para,criado").eq("estado", "pendente").order("id");
      setAlteracoes(data || []);
    } catch (e) {
      setAlteracoes([]);
    }
    try {
      const r = await dbStorage.get("reclamacoes:operacionais-envio");
      setEnvio(r ? JSON.parse(r.value) : null);
    } catch (e) {
      setEnvio(null);
    }
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);
  const comOp = escolas.filter((e) => ((op.contactos.emailsOperacionais || {})[e] || []).length).length;
  const comCt = escolas.filter((e) => ((op.contactos.emailsCoordenadores || {})[e] || []).length).length;
  const comGeral = [...(op.contactos.emailsCoordenadorGeral || []), ...(op.contactos.emailsResponsavelAuditoria || []), ...(op.contactos.emailsDirecaoExecutiva || [])].length;
  const pedidoEm = op.pedidoEnvio && op.pedidoEnvio.em;
  const pendente = pedidoEm && (!envio || (!envio.ultimo && !envio.ultimoPedido) || (pedidoEm > (envio.ultimo || "") && pedidoEm > (envio.ultimoPedido || "")));
  const hojeISO = new Date().toISOString();
  const lista = (pedidos || []).filter((p) => p.itens?.tipo !== "eficacia").filter((p) => verTodos || !p.respondido_em || (p.respostas?.turmas && Object.keys(p.respostas.turmas).length && !p.ids_aplicados_em) || p.criado > new Date(Date.now() - 14 * 86400000).toISOString());
  const porConfirmar = (pedidos || []).filter((p) => !p.validar && p.respostas?.turmas && Object.values(p.respostas.turmas).some((l) => (l || []).length) && !p.ids_aplicados_em);
  const quando = (iso) => (iso ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—");
  const aplicar = async (p) => {
    setAAplicar(p.token);
    try {
      const r = op.onAplicarIds(p);
      await supabase.from("pedidos_operacionais").update({ ids_aplicados_em: new Date().toISOString() }).eq("token", p.token);
      op.notificar(`${r.mudados} ${r.mudados === 1 ? "aluno mudou" : "alunos mudaram"} de turma em ${p.escola}${r.naoEncontrados.length ? ` · ${r.naoEncontrados.length} códigos não existem na app: ${r.naoEncontrados.slice(0, 6).join(", ")}${r.naoEncontrados.length > 6 ? "…" : ""}` : ""}.`, r.naoEncontrados.length ? "aviso" : "ok", 9000);
      await carregar();
    } finally {
      setAAplicar(null);
    }
  };
  // Tudo o que os operacionais preencheram fica aqui até aceitares. Cada item vale pelo conteúdo: se o operacional
  // corrigir a resposta depois, volta a aparecer.
  const ROT_RES = { sucesso: "Converteu", pendente: "Ainda a decorrer", insucesso: "Não converteu" };
  const porValidar = [];
  (pedidos || [])
    .filter((p) => p.validar && !p.itens?.tipo && p.respostas)
    .forEach((p) => {
      const ep = p.itens?.epoca;
      const reg = (op.registoAlunos || {})[ep] || {};
      const alunos = reg.alunos || {};
      const val = p.validado || {};
      const exps = op.experiencias || [];
      const novoItem = (key, c, extra) => {
        if (val[key] && val[key].v === c) return;
        porValidar.push({ key, c, pedido: p.token, validado: val, escola: p.escola, epoca: ep, quando: p.respondido_em, ...extra });
      };
      Object.entries(p.respostas.experiencias || {}).forEach(([id, v0]) => {
        const v = typeof v0 === "string" ? { r: v0 } : v0;
        const avisos = exps.some((x) => x.alunoId === id && x.epoca === ep && x.escola === p.escola) ? [] : ["esta experiência não existe na app (o código pode estar errado)"];
        novoItem(`exp:${id}`, JSON.stringify(v), { tipo: "exp", id, valor: v, titulo: `Experiência ${id}`, detalhe: [ROT_RES[v.r] || v.r, v.motivo, v.turmaFicou && `ficou em ${v.turmaFicou}`, v.nota && `“${v.nota}”`].filter(Boolean).join(" · "), avisos, padrao: !avisos.length });
      });
      (p.respostas.novas || []).forEach((n) => {
        const a = alunos[n.id];
        const avisos = [];
        if (a && a.escola !== p.escola) avisos.push(`este código é de um aluno de ${a.escola}`);
        if (!a && !(reg.experiencias || {})[n.id] && !exps.some((x) => x.alunoId === n.id)) avisos.push("código desconhecido na app (não é aluno nem tem experiência)");
        if (exps.some((x) => x.alunoId === n.id && x.epoca === ep && x.escola === p.escola)) avisos.push("já existe uma experiência deste código: vai ser atualizada");
        const v = { r: n.r, motivo: n.motivo, nota: n.nota, turma: n.turma, turmaFicou: n.turmaFicou, data: n.data };
        novoItem(`nova:${n.id}`, JSON.stringify(v), { tipo: "nova", id: n.id, valor: v, titulo: `Experiência acrescentada ${n.id}`, detalhe: [`${n.turma}`, n.data, ROT_RES[n.r] || n.r, n.motivo, n.turmaFicou && `ficou em ${n.turmaFicou}`, n.nota && `“${n.nota}”`].filter(Boolean).join(" · "), avisos, padrao: !(a && a.escola !== p.escola) });
      });
      Object.entries(p.respostas.turmas || {}).forEach(([turma, ids]) => {
        if (!(ids || []).length) return;
        const falta = ids.filter((id) => !alunos[id]);
        const avisos = [];
        if (falta.length) avisos.push(`${falta.length === ids.length ? "nenhum dos códigos existe" : `não existem: ${falta.join(", ")}`} na app (ignorados)`);
        const doutra = ids.filter((id) => alunos[id] && alunos[id].escola !== p.escola);
        if (doutra.length) avisos.push(`de outra escola: ${doutra.join(", ")}`);
        novoItem(`turma:${turma}`, ids.join(","), { tipo: "turma", turma, ids, titulo: `Turma sem alunos: ${turma}`, detalhe: `códigos ${ids.join(", ")}`, avisos, padrao: ids.some((id) => alunos[id]) });
      });
    });
  alteracoes.forEach((x) => {
    const a = ((op.registoAlunos || {})[x.epoca]?.alunos || {})[x.aluno];
    const avisos = a ? (a.escola !== x.escola ? [`o aluno está em ${a.escola}: passa para ${x.escola}`] : []) : ["este código não existe na app"];
    porValidar.push({ key: `alt:${x.id}`, tipo: "alteracao", linha: x.id, id: x.aluno, turma: x.para, escola: x.escola, epoca: x.epoca, quando: x.criado, titulo: `Mudança de turma ${x.aluno}`, detalhe: `${x.de || "—"} → ${x.para}`, avisos, padrao: !!a });
  });
  const [sel, setSel] = useState({});
  const decidir = async (aceitar) => {
    const marcados = porValidar.filter((i) => (sel[i.key] === undefined ? i.padrao : sel[i.key]));
    if (!marcados.length) return;
    setAAplicar("validar");
    try {
      let msg = `${marcados.length} ${marcados.length === 1 ? "item rejeitado" : "itens rejeitados"}.`;
      let nivel = "ok";
      if (aceitar) {
        const r = op.onAplicarRespostas(marcados.map((i) => ({ tipo: i.tipo, epoca: i.epoca, escola: i.escola, id: i.id, valor: i.valor, turma: i.turma, ids: i.ids })));
        msg = `Validado: ${r.exp + r.nova} experiências, ${r.mudados} mudanças de turma.${r.naoEncontrados.length ? ` Códigos que não existem: ${r.naoEncontrados.slice(0, 8).join(", ")}.` : ""}`;
        if (r.naoEncontrados.length) nivel = "aviso";
      }
      const estado = aceitar ? "aceite" : "rejeitada";
      const porPedido = {};
      marcados.filter((i) => i.tipo !== "alteracao").forEach((i) => ((porPedido[i.pedido] = porPedido[i.pedido] || { ...i.validado })[i.key] = { v: i.c, estado }));
      for (const [token, validado] of Object.entries(porPedido)) await supabase.from("pedidos_operacionais").update({ validado }).eq("token", token);
      const alt = marcados.filter((i) => i.tipo === "alteracao").map((i) => i.linha);
      if (alt.length) await supabase.from("alteracoes_turma").update({ estado, decidido_em: new Date().toISOString() }).in("id", alt);
      setSel({});
      op.notificar(msg, nivel, 8000);
      await carregar();
    } finally {
      setAAplicar(null);
    }
  };
  const ignorar = async (p) => {
    await supabase.from("pedidos_operacionais").update({ ids_aplicados_em: new Date().toISOString() }).eq("token", p.token);
    carregar();
  };
  return (
    <div style={{ ...panelStyle, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Mail size={16} color={COLORS.navySoft} />
        <div style={{ fontWeight: 600, fontSize: 14, flex: "1 1 220px" }}>E-mails às escolas</div>
        <button onClick={op.onAbrirContactos} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5 }}>
          Contactos das escolas
        </button>
        {pendente ? (
          <span style={{ fontSize: 12.5, color: COLORS.warn, fontWeight: 600 }}>Envio pedido às {quando(pedidoEm)} · sai em poucos minutos</span>
        ) : (
          <button onClick={() => op.onPedirEnvio()} disabled={!comOp && !comCt && !comGeral} className="press" style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5, opacity: comOp || comCt || comGeral ? 1 : 0.5 }}>
            Enviar agora
          </button>
        )}
      </div>
      <EnviarEscola op={op} escolas={escolas} pedidoEm={pedidoEm} envio={envio} quando={quando} />
      <div style={{ fontSize: 12, color: COLORS.ink2, margin: "6px 0 10px", lineHeight: 1.5 }}>
        À terça-feira (à segunda atualizam-se os dados): aos operacionais, experiências com mais de 2 semanas por decidir e turmas do plano sem alunos; ao coordenador técnico, reclamações técnicas em aberto e o resumo da época; ao coordenador técnico geral, à responsável de área da auditoria e à direção executiva, o resumo da rede com todas as reclamações em andamento. Os pedidos de avaliação de eficácia saem quando os envias numa reclamação. Quem não abrir o link recebe um lembrete no dia seguinte. {comOp} de {escolas.length} escolas com e-mail de operacionais · {comCt} com coordenador técnico · {comGeral ? "resumo da rede com destinatários" : "resumo da rede sem destinatários"}.
        {envio && envio.ultimoResumo ? ` Último envio: ${quando(envio.ultimoResumo.em || envio.ultimo)} · ${envio.ultimoResumo.operacionais} ${envio.ultimoResumo.operacionais === 1 ? "escola" : "escolas"}, ${envio.ultimoResumo.coordenadores} ${envio.ultimoResumo.coordenadores === 1 ? "aviso" : "avisos"} ao coordenador técnico${envio.ultimoResumo.geral ? ", resumo ao coordenador geral" : ""}.` : " Ainda sem envios."}
      </div>
      {(() => {
        // Controlo: não abriram o e-mail nem o lembrete (enviado há mais de 1 dia). Para ligar e confirmar se receberam.
        const umDia = new Date(Date.now() - 86400000).toISOString();
        const semAbrir = (pedidos || []).filter((p) => p.lembrete_em && p.lembrete_em < umDia && !p.aberto_em && !p.respondido_em && !p.contactado_em && p.expira > hojeISO);
        if (!semAbrir.length) return null;
        return (
          <div style={{ border: `1px solid ${COLORS.warn}`, background: COLORS.warnBg, borderRadius: 10, padding: "10px 12px", marginBottom: 10, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Controlo de e-mails: {semAbrir.length} sem abrir o e-mail nem o lembrete</div>
            <div style={{ fontSize: 12, color: COLORS.ink2 }}>Liga a confirmar se receberam (pode estar no lixo eletrónico) e marca quando estiver tratado.</div>
            {semAbrir.map((p) => (
              <div key={p.token} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12.5, borderTop: `1px solid ${COLORS.rule}`, paddingTop: 6 }}>
                <div style={{ flex: "1 1 260px", minWidth: 0, lineHeight: 1.5 }}>
                  <strong>{p.escola}</strong> · {p.itens?.tipo === "eficacia" ? `avaliação de eficácia da reclamação nº ${String(p.itens.numero || "").padStart(4, "0")} (${p.itens.papel === "coordenador" ? "coordenador" : "operacional"})` : "pedido semanal (experiências e turmas)"}
                  <div style={{ color: COLORS.slate, fontSize: 12 }}>
                    {(p.emails || []).join(", ") || "sem e-mail"} · enviado {quando(p.enviado_em || p.criado)} · lembrete {quando(p.lembrete_em)}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await supabase.from("pedidos_operacionais").update({ contactado_em: new Date().toISOString() }).eq("token", p.token);
                    carregar();
                  }}
                  style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "4px 10px", fontSize: 12 }}
                >
                  Já contactei
                </button>
              </div>
            ))}
          </div>
        );
      })()}
      {fila && fila.some((f) => !f.enviado_em) && (() => {
        const porEnviar = fila.filter((f) => !f.enviado_em);
        const desistidos = porEnviar.filter((f) => f.tentativas >= 6);
        const comErro = porEnviar.filter((f) => f.erro && f.tentativas < 6);
        const tipoNome = { operacional: "operacionais", coordenador: "coordenador técnico", geral: "coordenador geral", eficacia: "avaliação de eficácia" };
        return (
          <div style={{ border: `1px solid ${desistidos.length ? COLORS.warn : COLORS.rule}`, borderRadius: 10, padding: "9px 12px", marginBottom: 10, fontSize: 12.5, lineHeight: 1.55 }}>
            <strong>{porEnviar.length - desistidos.length}</strong> e-mails na fila
            {comErro.length > 0 && <> · {comErro.length} voltam a ser tentados (quota diária do Gmail ou erro)</>}
            {desistidos.length > 0 && <strong style={{ color: COLORS.warn }}> · {desistidos.length} falharam 6 vezes e não vão sair</strong>}
            {[...desistidos, ...comErro].slice(0, 8).map((f) => (
              <div key={f.id} style={{ color: COLORS.slate, fontSize: 12 }}>
                {tipoNome[f.tipo] || f.tipo}
                {f.escola ? ` · ${f.escola}` : ""} · {f.erro}
              </div>
            ))}
          </div>
        );
      })()}
      <PorValidar itens={porValidar} sel={sel} setSel={setSel} aAplicar={aAplicar === "validar"} onAceitar={() => decidir(true)} onRejeitar={() => decidir(false)} />
      {porConfirmar.length > 0 && (
        <div style={{ border: `1px solid ${COLORS.warn}`, background: COLORS.warnBg, borderRadius: 10, padding: "10px 12px", marginBottom: 10, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Códigos dos alunos para confirmar</div>
          {porConfirmar.map((p) => (
            <div key={p.token} style={{ display: "grid", gap: 4, fontSize: 12.5 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{p.escola}</strong>
                <span style={{ color: COLORS.slate }}>respondido a {quando(p.respondido_em)}</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => ignorar(p)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12, color: COLORS.slate }}>
                  Ignorar
                </button>
                <button disabled={aAplicar === p.token} onClick={() => aplicar(p)} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "4px 10px", fontSize: 12 }}>
                  {aAplicar === p.token ? "A mudar…" : "Confirmar e mudar na app"}
                </button>
              </div>
              {Object.entries(p.respostas.turmas)
                .filter(([, l]) => (l || []).length)
                .map(([t, l]) => (
                  <div key={t} style={{ color: COLORS.ink2 }}>
                    <strong style={{ color: COLORS.ink }}>{t}</strong>: {l.join(", ")}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
      {pedidos === null ? (
        <div style={{ fontSize: 12.5, color: COLORS.slate }}>A carregar…</div>
      ) : pedidos.length === 0 ? (
        <div style={{ fontSize: 12.5, color: COLORS.slate }}>Ainda não foram enviados pedidos.</div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Escola", "Enviado", "Experiências", "Turmas sem alunos", "Estado"].map((h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const nx = (p.itens?.experiencias || []).length;
                  const rx = Object.keys(p.respostas?.experiencias || {}).length;
                  const nt = (p.itens?.turmas || []).length;
                  const rt = Object.values(p.respostas?.turmas || {}).filter((l) => (l || []).length).length + (p.respostas?.turmasVazias || []).length;
                  const expirado = p.expira < hojeISO;
                  return (
                    <tr key={p.token}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{p.escola}</td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>{quando(p.criado)}</td>
                      <td style={tdStyle}>{nx ? `${rx} de ${nx} respondidas` : "—"}</td>
                      <td style={tdStyle}>
                        {nt ? `${rt} de ${nt} tratadas` : "—"}
                        {(p.respostas?.turmasVazias || []).length > 0 && <div style={{ fontSize: 11.5, color: COLORS.slate }}>sem alunos por agora: {p.respostas.turmasVazias.join(", ")}</div>}
                      </td>
                      <td style={{ ...tdStyle, color: p.respondido_em ? COLORS.ok : expirado ? COLORS.slate : COLORS.warn, fontWeight: 600, fontSize: 12.5 }}>
                        {p.respondido_em ? `Respondido ${quando(p.respondido_em)}` : expirado ? "Expirou sem resposta" : p.aberto_em ? "Abriu, sem resposta" : "Ainda não abriu o link"}
                        {!p.respondido_em && (p.aberto_em || p.lembrete_em) && (
                          <div style={{ fontSize: 11.5, fontWeight: 400, color: COLORS.slate }}>
                            {[p.aberto_em && `aberto ${quando(p.aberto_em)}`, p.lembrete_em && `lembrete ${quando(p.lembrete_em)}`].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            <button onClick={() => setVerTodos((v) => !v)} style={{ ...linkBtnStyle, fontSize: 12 }}>
              {verTodos ? "Só os recentes" : `Ver todos (${pedidos.length})`}
            </button>
            <button onClick={carregar} style={{ ...linkBtnStyle, fontSize: 12 }}>
              Atualizar
            </button>
          </div>
          {pedidos.some((p) => p.respondido_em && p.respondido_em > (op.carregadoEm || "")) && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 4 }}>Há respostas novas desde que abriste a app: recarrega a página para as veres nas experiências.</div>}
        </>
      )}
    </div>
  );
}
