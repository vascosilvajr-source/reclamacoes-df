// Janela pública de formação (?fm=<código>): teoria em slides, quizz com explicação imediata
// (resposta certa + porquê + documento e artigo) e nota. Sem login; só vê o módulo deste link.
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { LOGO_BRANCO } from "./imagens";

const CSS = `
  .fm { min-height: 100vh; background: radial-gradient(ellipse at 50% 0%, #0e2549 0%, #07142A 60%); color: #E7ECF3; font-family: 'Inter', system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 20px 14px 40px; }
  .fm * { box-sizing: border-box; }
  .fm .topo { width: 100%; max-width: 680px; display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .fm .topo img { height: 34px; }
  .fm .topo span { font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; color: #8FA3BF; }
  .fm .cartao { width: 100%; max-width: 680px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 22px 20px; }
  .fm h1 { margin: 0 0 6px; font: 700 24px 'Sora','Inter',system-ui,sans-serif; }
  .fm h2 { margin: 0 0 10px; font: 600 19px 'Sora','Inter',system-ui,sans-serif; }
  .fm p { margin: 0 0 12px; line-height: 1.6; color: #C5D0E0; font-size: 15px; white-space: pre-wrap; }
  .fm .mini { font-size: 12.5px; color: #8FA3BF; }
  .fm .barra { height: 5px; border-radius: 5px; background: rgba(255,255,255,.1); overflow: hidden; margin-bottom: 16px; }
  .fm .barra i { display: block; height: 100%; background: linear-gradient(90deg, #2196C9, #F08A4B); transition: width .3s; }
  .fm .btn { border: none; border-radius: 11px; padding: 12px 20px; font: 600 14.5px 'Inter',system-ui,sans-serif; cursor: pointer; background: #2196C9; color: #fff; }
  .fm .btn.sec { background: transparent; border: 1px solid rgba(255,255,255,.25); color: #E7ECF3; }
  .fm .btn:disabled { opacity: .5; cursor: default; }
  .fm .linha { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .fm .op { display: block; width: 100%; text-align: left; margin: 0 0 9px; padding: 13px 14px; border-radius: 11px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.04); color: #E7ECF3; font: 500 15px/1.4 'Inter',system-ui,sans-serif; cursor: pointer; }
  .fm .op:hover:not(:disabled) { border-color: #2196C9; background: rgba(33,150,201,.12); }
  .fm .op:disabled { cursor: default; }
  .fm .op.certa { border-color: #4FBF8B; background: rgba(79,191,139,.16); }
  .fm .op.errada { border-color: #F08A4B; background: rgba(240,138,75,.16); }
  .fm .expl { margin-top: 12px; padding: 13px 14px; border-radius: 11px; background: rgba(240,138,75,.1); border-left: 3px solid #F08A4B; font-size: 14.5px; line-height: 1.6; }
  .fm .expl.ok { background: rgba(79,191,139,.1); border-left-color: #4FBF8B; }
  .fm .expl b { display: block; margin-bottom: 4px; }
  .fm .ref { margin-top: 8px; font-size: 13px; color: #9CC8E6; }
  .fm .nota { font: 800 54px/1 'Sora','Inter',system-ui,sans-serif; margin: 6px 0; }
  .fm .rev { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.1); }
`;

function Explicacao({ f }) {
  const ref = f.ref && (f.ref.doc || f.ref.artigo) ? [f.ref.doc, f.ref.artigo].filter(Boolean).join(" · ") : "";
  return (
    <div className={`expl${f.correto ? " ok" : ""}`}>
      <b>{f.correto ? "Certo." : "Não é esta."}</b>
      {!f.correto && f.opcaoCerta !== undefined && <div style={{ marginBottom: 6 }}>Resposta certa: <strong>{f.opcaoCerta}</strong></div>}
      {f.porque && <div>{f.porque}</div>}
      {ref && <div className="ref">📄 {ref}</div>}
    </div>
  );
}

export default function FormacaoPublica({ token }) {
  const [estado, setEstado] = useState("a-carregar"); // a-carregar | invalido | expirado | pronto
  const [dados, setDados] = useState(null);
  const [etapa, setEtapa] = useState("intro"); // intro | slides | quizz | fim
  const [slide, setSlide] = useState(0);
  const [q, setQ] = useState(0);
  const [fb, setFb] = useState({}); // id -> { opcao, certa, correto, porque, ref }
  const [res, setRes] = useState(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = async () => {
    const { data, error } = await supabase.rpc("fm_obter", { p_token: token });
    if (error || !data) return setEstado("invalido");
    if (data.expirado) return setEstado("expirado");
    setDados(data);
    setFb(data.feedback || {});
    const perguntas = data.modulo.perguntas || [];
    const feitas = perguntas.filter((p) => (data.feedback || {})[p.id]).length;
    setRes(data.resultado || null);
    if (data.resultado) setEtapa("fim");
    else if (feitas) {
      setEtapa("quizz");
      setQ(Math.min(feitas, perguntas.length - 1));
    } else setEtapa("intro");
    setSlide(0);
    setEstado("pronto");
  };
  useEffect(() => {
    document.title = "Dragon Force · Formação";
    carregar();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const topo = (
    <div className="topo">
      <img src={LOGO_BRANCO} alt="Dragon Force" />
      <span>Formação</span>
    </div>
  );
  const caixa = (titulo, texto) => (
    <div className="fm">
      <style>{CSS}</style>
      {topo}
      <div className="cartao">
        <h2>{titulo}</h2>
        <p>{texto}</p>
      </div>
    </div>
  );
  if (estado === "a-carregar") return caixa("A carregar…", "");
  if (estado === "invalido") return caixa("Link inválido", "Este link não existe. Pede um novo a quem to enviou.");
  if (estado === "expirado") return caixa("Link expirado", "Este link já não está ativo. Pede um novo a quem to enviou.");

  const mod = dados.modulo;
  const slides = mod.slides || [];
  const perguntas = mod.perguntas || [];
  const p = perguntas[q];
  const f = p && fb[p.id];
  const textoCerta = (perg, certa) => (perg.opcoes || [])[certa];

  const responder = async (i) => {
    if (f || aEnviar) return;
    setAEnviar(true);
    setErro("");
    const { data, error } = await supabase.rpc("fm_responder", { p_token: token, p_pergunta: p.id, p_opcao: i });
    setAEnviar(false);
    if (error || !data) return setErro("Não consegui guardar a resposta. Tenta outra vez.");
    setFb((x) => ({ ...x, [p.id]: data }));
  };
  const seguinte = async () => {
    if (q < perguntas.length - 1) return setQ(q + 1);
    setAEnviar(true);
    const { data, error } = await supabase.rpc("fm_concluir", { p_token: token });
    setAEnviar(false);
    if (error || !data) return setErro("Não consegui fechar o teste. Tenta outra vez.");
    setRes(data);
    setEtapa("fim");
  };
  const repetir = async () => {
    setAEnviar(true);
    const { error } = await supabase.rpc("fm_repetir", { p_token: token });
    setAEnviar(false);
    if (error) return setErro("Não consegui reiniciar o teste.");
    setQ(0);
    setSlide(0);
    await carregar();
  };

  return (
    <div className="fm">
      <style>{CSS}</style>
      {topo}
      <div className="cartao">
        {etapa === "intro" && (
          <>
            <h1>{mod.nome}</h1>
            <p>{dados.iniciais ? `Formação de ${dados.iniciais}. ` : ""}Primeiro a teoria ({slides.length} {slides.length === 1 ? "slide" : "slides"}), depois um teste com {perguntas.length} {perguntas.length === 1 ? "pergunta" : "perguntas"}. Se errares, vês logo porquê e em que documento está. Precisas de {mod.notaMinima}% para passar.</p>
            <div className="linha">
              <button className="btn" onClick={() => setEtapa(slides.length ? "slides" : "quizz")}>
                Começar
              </button>
            </div>
          </>
        )}
        {etapa === "slides" && slides[slide] && (
          <>
            <div className="barra">
              <i style={{ width: `${((slide + 1) / slides.length) * 100}%` }} />
            </div>
            <div className="mini">
              Teoria · {slide + 1} de {slides.length}
            </div>
            <h2 style={{ marginTop: 6 }}>{slides[slide].titulo}</h2>
            <p>{slides[slide].texto}</p>
            <div className="linha">
              <button className="btn sec" disabled={slide === 0} onClick={() => setSlide(slide - 1)}>
                Anterior
              </button>
              {slide < slides.length - 1 ? (
                <button className="btn" onClick={() => setSlide(slide + 1)}>
                  Seguinte
                </button>
              ) : (
                <button className="btn" onClick={() => setEtapa("quizz")}>
                  Fazer o teste
                </button>
              )}
            </div>
          </>
        )}
        {etapa === "quizz" && p && (
          <>
            <div className="barra">
              <i style={{ width: `${(Object.keys(fb).length / perguntas.length) * 100}%` }} />
            </div>
            <div className="mini">
              Pergunta {q + 1} de {perguntas.length}
            </div>
            <h2 style={{ marginTop: 6 }}>{p.enunciado}</h2>
            {(p.opcoes || []).map((o, i) => (
              <button key={i} className={`op${f ? (i === f.certa ? " certa" : i === f.opcao ? " errada" : "") : ""}`} disabled={!!f || aEnviar} onClick={() => responder(i)}>
                {o}
              </button>
            ))}
            {f && <Explicacao f={{ ...f, opcaoCerta: textoCerta(p, f.certa) }} />}
            {erro && <p style={{ color: "#F08A4B", marginTop: 10 }}>{erro}</p>}
            {f && (
              <div className="linha">
                <button className="btn" disabled={aEnviar} onClick={seguinte}>
                  {q < perguntas.length - 1 ? "Seguinte" : "Ver a nota"}
                </button>
              </div>
            )}
          </>
        )}
        {etapa === "fim" && res && (
          <>
            <div className="mini">{mod.nome}</div>
            <div className="nota" style={{ color: res.passou ? "#4FBF8B" : "#F08A4B" }}>
              {res.nota}%
            </div>
            <h2>{res.passou ? "Passaste." : "Ainda não passaste."}</h2>
            <p>
              {res.certas} de {res.total} certas · mínimo {mod.notaMinima}%.{res.passou ? " O resultado já ficou registado." : " Revê o que falhaste e tenta outra vez."}
            </p>
            {perguntas
              .filter((x) => fb[x.id] && !fb[x.id].correto)
              .map((x) => (
                <div key={x.id} className="rev">
                  <strong>{x.enunciado}</strong>
                  <Explicacao f={{ ...fb[x.id], opcaoCerta: textoCerta(x, fb[x.id].certa) }} />
                </div>
              ))}
            {erro && <p style={{ color: "#F08A4B" }}>{erro}</p>}
            {!res.passou && (
              <div className="linha">
                <button className="btn" disabled={aEnviar} onClick={repetir}>
                  Tentar outra vez
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
