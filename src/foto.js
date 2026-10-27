// "Foto" de um ecrã: imagem PNG do que está à vista, com cabeçalho Dragon Force e data.
// Os elementos com a classe "semFoto" (botões, menus) ficam de fora.
export async function tirarFoto(no, { titulo, subtitulo, fundo = "#ffffff", tinta = "#0B1B33", cinza = "#5B6577", azul = "#0B2A5B", nome = "balanco" }) {
  if (!no) return;
  const { toPng } = await import("html-to-image");
  const cab = document.createElement("div");
  cab.setAttribute("data-foto-cab", "1");
  cab.style.cssText = `display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:0 0 14px;margin:0 0 16px;border-bottom:2px solid ${azul};font-family:inherit`;
  const hoje = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  cab.innerHTML = `<div><div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${azul}">FC Porto · Dragon Force · Gestão da Qualidade</div>
    <div style="font-size:22px;font-weight:700;color:${tinta};margin-top:6px;letter-spacing:-.01em"></div>
    <div style="font-size:13px;color:${cinza};margin-top:2px"></div></div>
    <div style="font-size:12px;color:${cinza};white-space:nowrap">${hoje}</div>`;
  cab.children[0].children[1].textContent = titulo || "";
  cab.children[0].children[2].textContent = subtitulo || "";
  no.prepend(cab);
  no.classList.add("modoFoto");
  const padAntes = no.style.padding;
  no.style.padding = "24px";
  try {
    const largura = Math.max(no.scrollWidth, no.offsetWidth);
    const url = await toPng(no, {
      backgroundColor: fundo,
      pixelRatio: 2,
      width: largura,
      cacheBust: true,
      filter: (n) => !(n.classList && n.classList.contains("semFoto")),
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\\/:*?"<>|]/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    cab.remove();
    no.classList.remove("modoFoto");
    no.style.padding = padAntes;
  }
}

// PDF do balanço: copia o que está à vista para uma folha própria e abre a impressão
// ("Guardar como PDF"). Margem zero na folha (o browser deixa de imprimir data e endereço);
// a moldura (faixa azul, título e rodapé em todas as páginas) é feita aqui. O texto fica nítido.
export function imprimirBalanco(no, { titulo, subtitulo, nome = "balanco", vertical = false, logo = "", html = "", tipo = "Balanço" }) {
  if (!no && !html) return;
  const AZUL = "#0B2A5B";
  const AZUL2 = "#1D4F9A";
  const TINTA = "#0F1B2D";
  const CINZA = "#5B6577";
  const LINHA = "#D5DBE5";
  const pagina = vertical ? 794 : 1123; // largura A4 em px (96 dpi)
  const margem = 40;
  const util = pagina - margem * 2;
  // Com html próprio (ex.: auditorias) o conteúdo já é feito para papel: sem cópia do ecrã nem escala.
  const largura = html ? util : Math.max(no.scrollWidth, no.offsetWidth, 600);
  const escala = Math.min(1, util / largura);
  const hoje = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const txt = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const folha = document.createElement("div");
  folha.id = "folhaBalanco";
  folha.style.cssText = `background:#fff;color:${TINTA};width:${pagina}px;font-family:${no ? getComputedStyle(no).fontFamily : "system-ui, sans-serif"};`;
  folha.innerHTML = `
    <table class="fbPag">
      <thead><tr><td><div class="fbEspaco"></div></td></tr></thead>
      <tfoot><tr><td><div class="fbRodape"><span>FC Porto · Dragon Force · Gestão da Qualidade</span><span>${txt(titulo)} · ${hoje}</span></div></td></tr></tfoot>
      <tbody><tr><td>
        <div class="fbFaixa">
          ${logo ? `<span class="fbLogo" style="-webkit-mask-image:url(${logo});mask-image:url(${logo})"></span>` : ""}
          <div class="fbMarca">FC Porto · Dragon Force<div>Gestão da Qualidade</div></div>
          <div class="fbTipo">${txt(tipo)}</div>
        </div>
        <div class="fbCapa">
          <h1>${txt(titulo)}</h1>
          <div class="fbSub">${txt(subtitulo)}${subtitulo ? " · " : ""}emitido a ${hoje}</div>
        </div>
        <div class="fbConteudo"></div>
      </td></tr></tbody>
    </table>`;
  const caixa = folha.querySelector(".fbConteudo");
  caixa.style.cssText = `zoom:${escala};width:${largura}px;`;
  if (html) {
    caixa.style.cssText = `width:${util}px;`;
    caixa.innerHTML = html;
  }
  const copia = html ? null : no.cloneNode(true);
  if (copia) {
    // Os menus e campos passam a texto (a cópia não guarda o valor escolhido).
    const origSel = no.querySelectorAll("select, input, textarea");
    copia.querySelectorAll("select, input, textarea").forEach((el, i) => {
      const o = origSel[i];
      const v = o ? (o.tagName === "SELECT" ? (o.options[o.selectedIndex] || {}).text || "" : o.type === "checkbox" || o.type === "radio" ? "" : o.value) : "";
      if (!v) return el.remove();
      const span = document.createElement("span");
      span.textContent = v;
      span.className = "fbCampo";
      el.replaceWith(span);
    });
    copia.querySelectorAll(".semFoto, [hidden], script, style[data-anim]").forEach((el) => el.remove());
    // Gráficos e ícones animados pesam na impressão: ficam parados.
    copia.querySelectorAll("[class*='anim'], [style*='animation']").forEach((el) => { el.style.animation = "none"; });
    copia.querySelectorAll('[style*="overflow"]').forEach((el) => {
      el.style.overflow = "visible";
      el.style.maxHeight = "none";
    });
    caixa.appendChild(copia);
  }

  const estilo = document.createElement("style");
  estilo.textContent = `
  #folhaBalanco .fbPag { width: 100%; border-collapse: collapse; }
  #folhaBalanco .fbPag > thead > tr > td, #folhaBalanco .fbPag > tfoot > tr > td, #folhaBalanco .fbPag > tbody > tr > td { padding: 0; }
  #folhaBalanco .fbEspaco { height: 12mm; }
  #folhaBalanco .fbRodape { height: 12mm; margin: 0 ${margem}px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid ${LINHA}; font-size: 10px; letter-spacing: .04em; color: #6B7A90; }
  #folhaBalanco .fbFaixa { background: ${AZUL}; color: #fff; display: flex; align-items: center; gap: 14px; padding: 12px ${margem}px; margin-top: -12mm; }
  #folhaBalanco .fbLogo { width: 24px; height: 29px; background: #fff; -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; flex: none; }
  #folhaBalanco .fbMarca { font-size: 10.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; line-height: 1.5; }
  #folhaBalanco .fbMarca div { font-weight: 500; opacity: .7; letter-spacing: .12em; }
  #folhaBalanco .fbTipo { margin-left: auto; font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; opacity: .8; }
  #folhaBalanco .fbCapa { padding: 22px ${margem}px 14px; margin-bottom: 16px; border-bottom: 2px solid ${AZUL}; margin-left: ${margem}px; margin-right: ${margem}px; padding-left: 0; padding-right: 0; }
  #folhaBalanco .fbCapa h1 { margin: 0; font-family: 'Sora', 'Manrope', 'Inter', system-ui, sans-serif; font-size: 28px; font-weight: 600; letter-spacing: -.015em; color: ${TINTA}; }
  #folhaBalanco .fbSub { margin-top: 6px; font-size: 12.5px; color: ${CINZA}; }
  #folhaBalanco .fbConteudo { margin: 0 ${margem}px; }
  #folhaBalanco .fbCampo { display: inline-block; font-weight: 600; font-size: 13px; padding: 5px 10px; border: 1px solid ${LINHA}; border-radius: 6px; background: #F7F9FC; color: ${AZUL2}; }
  /* Sem animações de entrada: na cópia ficavam a meio (esbatidas). */
  #folhaBalanco *, #folhaBalanco *::before, #folhaBalanco *::after { animation: none !important; transition: none !important; }
  @media print {
    @page { size: A4 ${vertical ? "portrait" : "landscape"}; margin: 0; }
    body > *:not(#folhaBalanco):not(style) { display: none !important; }
    html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
    #folhaBalanco { display: block !important; }
    #folhaBalanco .fbPag > thead { display: table-header-group; }
    #folhaBalanco .fbPag > tfoot { display: table-footer-group; }
    #folhaBalanco .fbConteudo tr, #folhaBalanco .fbConteudo svg { break-inside: avoid; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media screen { #folhaBalanco { position: fixed; left: -30000px; top: 0; } }`;
  document.body.appendChild(folha);
  // Depois das regras de impressão da app, para a folha A4 deitada prevalecer.
  document.body.appendChild(estilo);
  const tituloAntes = document.title;
  document.title = String(nome).replace(/[\\/:*?"<>|]/g, "-");
  const limpar = () => {
    window.removeEventListener("afterprint", limpar);
    folha.remove();
    estilo.remove();
    document.title = tituloAntes;
  };
  window.addEventListener("afterprint", limpar);
  setTimeout(() => {
    try {
      window.print();
    } finally {
      // Alguns browsers não disparam "afterprint".
      setTimeout(() => document.getElementById("folhaBalanco") && limpar(), 1500);
    }
  }, 80);
}
