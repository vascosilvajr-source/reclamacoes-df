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
// ("Guardar como PDF"). O texto fica nítido (não é imagem) e a largura ajusta-se à folha A4 deitada.
export function imprimirBalanco(no, { titulo, subtitulo, fundo = "#ffffff", tinta = "#0B1B33", cinza = "#5B6577", azul = "#0B2A5B", nome = "balanco", vertical = false }) {
  if (!no) return;
  const largura = Math.max(no.scrollWidth, no.offsetWidth, 600);
  const util = vertical ? 718 : 1047; // px úteis da folha A4 com 10 mm de margem
  const escala = Math.min(1, util / largura);
  const folha = document.createElement("div");
  folha.id = "folhaBalanco";
  folha.style.cssText = `background:${fundo};color:${tinta};width:${largura}px;zoom:${escala};font-family:${getComputedStyle(no).fontFamily};font-size:${getComputedStyle(no).fontSize};`;
  const hoje = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const cab = document.createElement("div");
  cab.style.cssText = `display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:0 0 12px;margin:0 0 16px;border-bottom:2px solid ${azul}`;
  cab.innerHTML = `<div><div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${azul}">FC Porto · Dragon Force · Gestão da Qualidade</div><div style="font-size:22px;font-weight:700;margin-top:6px"></div><div style="font-size:13px;color:${cinza};margin-top:2px"></div></div><div style="font-size:12px;color:${cinza};white-space:nowrap">${hoje}</div>`;
  cab.children[0].children[1].textContent = titulo || "";
  cab.children[0].children[2].textContent = subtitulo || "";
  folha.appendChild(cab);
  const copia = no.cloneNode(true);
  // Os menus e campos passam a texto (a cópia não guarda o valor escolhido).
  const origSel = no.querySelectorAll("select, input, textarea");
  copia.querySelectorAll("select, input, textarea").forEach((el, i) => {
    const o = origSel[i];
    const span = document.createElement("span");
    const v = o ? (o.tagName === "SELECT" ? (o.options[o.selectedIndex] || {}).text || "" : o.type === "checkbox" ? "" : o.value) : "";
    if (!v) return el.remove();
    span.textContent = v;
    span.style.cssText = `font-weight:600;font-size:13px;padding:4px 8px;border:1px solid #D5DBE5;border-radius:6px;display:inline-block`;
    el.replaceWith(span);
  });
  copia.querySelectorAll(".semFoto").forEach((el) => el.remove());
  copia.querySelectorAll('[style*="overflow"]').forEach((el) => {
    el.style.overflow = "visible";
    el.style.maxHeight = "none";
  });
  folha.appendChild(copia);
  const estilo = document.createElement("style");
  estilo.textContent = `@media print {
    @page { size: A4 ${vertical ? "portrait" : "landscape"}; margin: 10mm; }
    body > *:not(#folhaBalanco):not(style) { display: none !important; }
    html, body { background: ${fundo} !important; height: auto !important; overflow: visible !important; }
    #folhaBalanco { display: block !important; }
    #folhaBalanco tr, #folhaBalanco .semQuebra { break-inside: avoid; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media screen { #folhaBalanco { position: fixed; left: -30000px; top: 0; } }`;
  document.body.appendChild(folha);
  // Depois das regras de impressão da app, para a folha A4 deitada e com margens prevalecer.
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
  }, 50);
}
