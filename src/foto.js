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
