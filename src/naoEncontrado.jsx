// Página 404 ("Fora de jogo"): aparece quando se abre um endereço que não existe (ex.: /xpto).
import { SIMBOLO_DF } from "./imagens";

const CSS = `
  .nf { position: fixed; inset: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px;
    background: radial-gradient(ellipse at 50% 30%, #0e2549 0%, #07142A 62%); color: #E7ECF3; font-family: 'Inter', system-ui, sans-serif; }
  .nf .linhas { position: absolute; inset: 0; opacity: .07; background: repeating-linear-gradient(90deg, #fff 0 2px, transparent 2px 120px); pointer-events: none; }
  .nf .campo { position: absolute; left: 50%; bottom: -120px; width: 900px; height: 360px; transform: translateX(-50%); border: 2px solid rgba(255,255,255,.08); border-radius: 50%; pointer-events: none; }
  .nf .n404 { position: relative; display: flex; align-items: center; gap: 6px; font: 800 clamp(96px, 22vw, 150px)/1 'Sora', 'Inter', system-ui, sans-serif; letter-spacing: -.04em; }
  .nf .n404 span { background: linear-gradient(180deg, #ffffff, #8FB6E8); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .nf .n404 img { width: clamp(76px, 17vw, 118px); height: auto; animation: nfRola 4s ease-in-out infinite; filter: drop-shadow(0 0 26px rgba(240,138,75,.5)); }
  @keyframes nfRola { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-14px) rotate(4deg); } }
  .nf .fora { position: relative; margin-top: 10px; font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #F08A4B; border: 1px solid rgba(240,138,75,.5); border-radius: 99px; padding: 5px 14px; }
  .nf h1 { position: relative; margin: 16px 0 6px; font: 600 28px 'Sora', 'Inter', system-ui, sans-serif; }
  .nf p { position: relative; margin: 0 0 24px; color: #8FA3BF; max-width: 420px; line-height: 1.55; font-size: 15px; }
  .nf a { position: relative; background: #2196C9; color: #fff; text-decoration: none; border-radius: 11px; padding: 12px 22px; font-weight: 600; font-size: 14px; transition: transform .15s; box-shadow: 0 10px 24px -10px rgba(33,150,201,.7); }
  .nf a:hover { transform: translateY(-2px); }
  .nf .rodape { position: absolute; bottom: 18px; font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase; color: #5c7090; }
  @media (prefers-reduced-motion: reduce) { .nf .n404 img { animation: none; } }
`;

export default function NaoEncontrado() {
  return (
    <div className="nf">
      <style>{CSS}</style>
      <div className="linhas" />
      <div className="campo" />
      <div className="n404" aria-label="404">
        <span>4</span>
        <img src={SIMBOLO_DF} alt="" />
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
