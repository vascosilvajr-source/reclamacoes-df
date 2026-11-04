// Página 404 ("Fora de jogo"): aparece quando se abre um endereço que não existe (ex.: /xpto).
import { BOLA_DF, SIMBOLO_DF } from "./imagens";

const CSS = `
  .nf { position: fixed; inset: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px;
    background: radial-gradient(ellipse at 50% 30%, #0e2549 0%, #07142A 62%); color: #E7ECF3; font-family: 'Inter', system-ui, sans-serif; }
  .nf .linhas { position: absolute; inset: 0; opacity: .07; background: repeating-linear-gradient(90deg, #fff 0 2px, transparent 2px 120px); pointer-events: none; }
  .nf .campo { position: absolute; left: 50%; bottom: -120px; width: 900px; height: 360px; transform: translateX(-50%); border: 2px solid rgba(255,255,255,.08); border-radius: 50%; pointer-events: none; }
  .nf .n404 { position: relative; display: flex; align-items: center; gap: 0; font: 800 clamp(96px, 22vw, 150px)/1 'Sora', 'Inter', system-ui, sans-serif; letter-spacing: -.04em; }
  .nf .n404 span { background: linear-gradient(180deg, #ffffff, #8FB6E8); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .nf .zero { position: relative; width: 150px; height: 200px; margin: 0 -6px; --t: 4.2s; flex: none; }
  .nf .zero .chao { position: absolute; left: 20px; right: 20px; bottom: 6px; height: 2px; border-radius: 2px; background: rgba(255,255,255,.10); animation: nfChao var(--t) ease-in-out infinite; }
  .nf .zero .sombra { position: absolute; left: 50%; bottom: 3px; width: 44px; height: 7px; margin-left: -22px; border-radius: 50%; background: rgba(0,0,0,.5); animation: nfSombra var(--t) infinite; }
  .nf .zero .balanco { position: absolute; inset: 0; animation: nfBalanco var(--t) ease-in-out infinite; }
  .nf .zero .simb { position: absolute; left: 50%; bottom: 14px; width: 118px; margin-left: -59px; animation: nfSimb var(--t) infinite; will-change: clip-path, opacity; }
  .nf .zero .simb img { width: 100%; height: auto; display: block; filter: drop-shadow(0 0 26px rgba(240,138,75,.5)); }
  .nf .zero .halo { position: absolute; left: 50%; top: 134px; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50%; background: radial-gradient(circle, rgba(240,138,75,.5), rgba(240,138,75,0) 70%); opacity: 0; animation: nfHalo var(--t) ease-out infinite; }
  .nf .zero .bola { position: absolute; left: 50%; top: 0; width: 46px; height: 46px; margin-left: -23px; background: url(${BOLA_DF}) center / contain no-repeat; animation: nfBola var(--t) infinite; z-index: 2; will-change: transform, opacity; }
  @keyframes nfBalanco { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-12px) rotate(4deg); } }
  @keyframes nfBola {
    0%   { transform: translateY(-40px) rotate(-200deg); opacity: 0; animation-timing-function: cubic-bezier(.55,0,1,.45); }
    4%   { opacity: 1; }
    15%  { transform: translateY(148px) rotate(-60deg) scale(1.08, .9); animation-timing-function: cubic-bezier(0,.55,.45,1); }
    28%  { transform: translateY(40px) rotate(60deg) scale(1); animation-timing-function: cubic-bezier(.45,0,.25,1); }
    42%  { transform: translateY(111px) rotate(360deg); opacity: 1; }
    54%  { transform: translateY(111px) rotate(360deg); opacity: 0; }
    100% { transform: translateY(111px) rotate(360deg); opacity: 0; }
  }
  @keyframes nfSombra { 0% { opacity: 0; transform: scaleX(.3); } 15% { opacity: .5; transform: scaleX(1); } 28% { opacity: .15; transform: scaleX(.55); } 38%,100% { opacity: 0; transform: scaleX(.4); } }
  @keyframes nfChao { 0%,30% { opacity: 1; } 42%,100% { opacity: 0; } }
  @keyframes nfSimb {
    0%,41% { opacity: 0; clip-path: circle(23px at 50% 65.4%); animation-timing-function: cubic-bezier(.22,1,.36,1); }
    42%    { opacity: 1; clip-path: circle(23px at 50% 65.4%); animation-timing-function: cubic-bezier(.22,1,.36,1); }
    60%    { opacity: 1; clip-path: circle(140px at 50% 65.4%); }
    88%    { opacity: 1; clip-path: circle(140px at 50% 65.4%); animation-timing-function: ease-in; }
    100%   { opacity: 0; clip-path: circle(140px at 50% 65.4%); }
  }
  @keyframes nfHalo { 0%,40% { opacity: 0; transform: scale(.5); } 44% { opacity: 1; transform: scale(1); } 62% { opacity: 0; transform: scale(3.2); } 100% { opacity: 0; } }
  .nf .fora { position: relative; margin-top: 10px; font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #F08A4B; border: 1px solid rgba(240,138,75,.5); border-radius: 99px; padding: 5px 14px; }
  .nf h1 { position: relative; margin: 16px 0 6px; font: 600 28px 'Sora', 'Inter', system-ui, sans-serif; }
  .nf p { position: relative; margin: 0 0 24px; color: #8FA3BF; max-width: 420px; line-height: 1.55; font-size: 15px; }
  .nf a { position: relative; background: #2196C9; color: #fff; text-decoration: none; border-radius: 11px; padding: 12px 22px; font-weight: 600; font-size: 14px; transition: transform .15s; box-shadow: 0 10px 24px -10px rgba(33,150,201,.7); }
  .nf a:hover { transform: translateY(-2px); }
  .nf .rodape { position: absolute; bottom: 18px; font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; color: #5c7090; }
  @media (prefers-reduced-motion: reduce) { .nf .zero * { animation: none !important; } .nf .zero .bola, .nf .zero .halo, .nf .zero .chao, .nf .zero .sombra { display: none; } .nf .zero .simb { opacity: 1; clip-path: none; } }
  @media (max-width: 520px) { .nf .n404 { font-size: 96px; } .nf .zero { transform: scale(.7); margin: 0 -34px; } }
`;

export default function NaoEncontrado() {
  return (
    <div className="nf">
      <style>{CSS}</style>
      <div className="linhas" />
      <div className="campo" />
      <div className="n404" aria-label="404">
        <span>4</span>
        <div className="zero" aria-hidden="true">
          <div className="chao" />
          <div className="sombra" />
          <div className="balanco">
            <div className="halo" />
            <div className="simb">
              <img src={SIMBOLO_DF} alt="" />
            </div>
            <div className="bola" />
          </div>
        </div>
        <span>4</span>
      </div>
      <div className="fora">Fora de jogo</div>
      <h1>Esta página não existe</h1>
      <p>O endereço que abriste não corresponde a nenhuma página da Gestão da Qualidade. Pode ter sido apagada ou o link estar incompleto.</p>
      <a href="/">Voltar ao início</a>
      <div className="rodape">FC Porto · Dragon Force · Gestão da Qualidade</div>
    </div>
  );
}
