// Animação de carregamento: a bola do emblema salta uma vez, pousa no sítio dela e o emblema abre-se
// em círculo à volta; a barra corre por baixo. Usada no arranque e na verificação da sessão.
import { useEffect, useState } from "react";
import { BOLA_DF, SIMBOLO_DF } from "./imagens";

const FRASES = ["A aquecer…", "A entrar em campo…", "A carregar os dados…"];

const CSS = `
  .cdf { display: flex; flex-direction: column; align-items: center; }
  .cdf .combo { position: relative; width: 170px; height: 200px; --t: 4.2s; }
  .cdf .chao { position: absolute; left: 25px; right: 25px; bottom: 6px; height: 2px; border-radius: 2px; background: rgba(255,255,255,.10); animation: cdfChao var(--t) ease-in-out infinite; }
  .cdf .bola { position: absolute; left: 50%; top: 0; width: 46px; height: 46px; margin-left: -23px; border-radius: 50%; background: url(${BOLA_DF}) center / contain no-repeat; animation: cdfBola var(--t) infinite; z-index: 2; will-change: transform, opacity; }
  .cdf .sombra { position: absolute; left: 50%; bottom: 3px; width: 44px; height: 7px; margin-left: -22px; border-radius: 50%; background: rgba(0,0,0,.5); animation: cdfSombra var(--t) infinite; }
  .cdf .simb { position: absolute; left: 50%; bottom: 14px; width: 120px; margin-left: -60px; animation: cdfSimb var(--t) infinite; will-change: clip-path, opacity; }
  .cdf .simb img { width: 100%; height: auto; display: block; filter: drop-shadow(0 0 22px rgba(240,138,75,.45)); }
  .cdf .halo { position: absolute; left: 50%; top: 134px; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50%; background: radial-gradient(circle, rgba(240,138,75,.5), rgba(240,138,75,0) 70%); opacity: 0; animation: cdfHalo var(--t) ease-out infinite; }
  .cdf .prog { margin-top: 20px; width: 210px; height: 4px; border-radius: 4px; background: rgba(255,255,255,.1); overflow: hidden; }
  .cdf .prog i { display: block; height: 100%; width: 40%; border-radius: 4px; background: linear-gradient(90deg, #2196C9, #F08A4B); animation: cdfCorre 1.5s ease-in-out infinite; }
  .cdf .tx { margin-top: 18px; min-height: 16px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #8FA3BF; transition: opacity .22s; }
  @keyframes cdfBola {
    0%   { transform: translateY(-40px) rotate(-200deg); opacity: 0; animation-timing-function: cubic-bezier(.55,0,1,.45); }
    4%   { opacity: 1; }
    15%  { transform: translateY(148px) rotate(-60deg) scale(1.08, .9); animation-timing-function: cubic-bezier(0,.55,.45,1); }
    28%  { transform: translateY(40px) rotate(60deg) scale(1); animation-timing-function: cubic-bezier(.45,0,.25,1); }
    42%  { transform: translateY(111px) rotate(360deg); opacity: 1; }
    54%  { transform: translateY(111px) rotate(360deg); opacity: 0; }
    100% { transform: translateY(111px) rotate(360deg); opacity: 0; }
  }
  @keyframes cdfSombra { 0% { opacity: 0; transform: scaleX(.3); } 15% { opacity: .5; transform: scaleX(1); } 28% { opacity: .15; transform: scaleX(.55); } 38%,100% { opacity: 0; transform: scaleX(.4); } }
  @keyframes cdfChao { 0%,30% { opacity: 1; } 42%,100% { opacity: 0; } }
  @keyframes cdfSimb {
    0%,41% { opacity: 0; clip-path: circle(23px at 50% 65.4%); animation-timing-function: cubic-bezier(.22,1,.36,1); }
    42%    { opacity: 1; clip-path: circle(23px at 50% 65.4%); animation-timing-function: cubic-bezier(.22,1,.36,1); }
    60%    { opacity: 1; clip-path: circle(140px at 50% 65.4%); }
    88%    { opacity: 1; clip-path: circle(140px at 50% 65.4%); animation-timing-function: ease-in; }
    100%   { opacity: 0; clip-path: circle(140px at 50% 65.4%); }
  }
  @keyframes cdfHalo { 0%,40% { opacity: 0; transform: scale(.5); } 44% { opacity: 1; transform: scale(1); } 62% { opacity: 0; transform: scale(3.2); } 100% { opacity: 0; } }
  @keyframes cdfCorre { 0% { transform: translateX(-110%); } 100% { transform: translateX(270%); } }
  @media (prefers-reduced-motion: reduce) {
    .cdf .chao, .cdf .bola, .cdf .sombra, .cdf .halo, .cdf .prog i { animation: none; }
    .cdf .bola, .cdf .sombra, .cdf .chao, .cdf .halo { display: none; }
    .cdf .simb { animation: none; opacity: 1; clip-path: none; }
  }
`;

export default function CarregamentoDF({ frases = FRASES }) {
  const [i, setI] = useState(0);
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setVisivel(false);
      setTimeout(() => {
        setI((x) => (x + 1) % frases.length);
        setVisivel(true);
      }, 220);
    }, 1800);
    return () => clearInterval(t);
  }, [frases.length]);
  return (
    <div className="cdf">
      <style>{CSS}</style>
      <div className="combo" aria-hidden="true">
        <div className="chao" />
        <div className="sombra" />
        <div className="halo" />
        <div className="simb">
          <img src={SIMBOLO_DF} alt="" />
        </div>
        <div className="bola" />
      </div>
      <div className="prog" aria-hidden="true">
        <i />
      </div>
      <div className="tx" style={{ opacity: visivel ? 1 : 0 }}>
        {frases[i]}
      </div>
    </div>
  );
}
