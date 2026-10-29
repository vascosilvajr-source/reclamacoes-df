// PDF do balanço: copia o que está à vista para uma folha própria e abre a impressão
// ("Guardar como PDF"). Margem zero na folha (o browser deixa de imprimir data e endereço);
// a moldura (faixa azul, título e rodapé em todas as páginas) é feita aqui. O texto fica nítido.
export function imprimirBalanco(no, opcoes) {
  const { titulo, subtitulo, nome = "balanco", vertical = false, logo = "", html = "", tipo = "Balanço", modo = "imprimir" } = opcoes;
  if (!no && !html) return Promise.resolve();
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
  const hoje = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
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
  if (modo === "pdf") {
    // Descarrega o PDF logo (sem janela de impressão). Se algo falhar, cai para a impressão.
    return gerarPdf(folha, { vertical, pagina, margem, titulo, hoje, nome })
      .catch(() => {
        folha.remove();
        estilo.remove();
        return imprimirBalanco(no, { ...opcoes, modo: "imprimir" });
      })
      .finally(() => {
        folha.remove();
        estilo.remove();
      });
  }
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


// PDF feito aqui, sem bibliotecas: a folha é fotografada, cortada em páginas A4 e cada página vai como JPEG para o PDF.
async function gerarPdf(folha, { vertical, pagina, margem, titulo, hoje, nome, larguraFolha }) {
  const { toCanvas } = await import("html-to-image");
  const tf = folha.querySelector("tfoot");
  if (tf) tf.remove();
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const w = larguraFolha || pagina; // largura natural da folha; se for maior que a página, a imagem é reduzida
  const k = pagina / w;
  const h = folha.scrollHeight;
  let escala = 2;
  while (h * escala > 15000 && escala > 1) escala -= 0.25;
  const src = await toCanvas(folha, { backgroundColor: "#ffffff", pixelRatio: escala, width: w, height: h, cacheBust: true, style: { position: "static", left: "0", top: "0" } });
  const altP = vertical ? 1123 : 794;
  const faixa = 45; // 12 mm
  const paginas = [];
  // Blocos que não se podem cortar: linhas, tabelas pequenas, gráficos, cartões e blocos de texto (até 20% da página).
  const topoFolha = folha.getBoundingClientRect().top;
  const livreMax = (altP - faixa * 2) / k;
  const blocos = [];
  folha.querySelectorAll("*").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height < 3 || r.height > livreMax * 0.2) return;
    blocos.push([r.top - topoFolha, r.bottom - topoFolha]);
  });
  const corte = (y, livre) => {
    let limite = y + livre;
    if (limite >= h) return h - y;
    for (let i = 0; i < 400; i++) {
      let mexeu = false;
      for (const [t, b] of blocos) {
        if (t < limite - 0.5 && b > limite + 0.5 && t > y) {
          limite = t;
          mexeu = true;
        }
      }
      if (!mexeu) break;
    }
    return limite - y < livre * 0.4 ? livre : limite - y; // se sobrasse uma página quase vazia, corta onde calhar
  };
  let y = 0;
  let n = 0;
  while (y < h - 1) {
    const primeira = n === 0;
    const livre = (altP - faixa - (primeira ? 0 : faixa)) / k; // altura disponível, em px da folha
    const tomar = corte(y, livre);
    const c = document.createElement("canvas");
    c.width = Math.round(pagina * escala);
    c.height = Math.round(altP * escala);
    const g = c.getContext("2d");
    g.scale(escala, escala);
    g.fillStyle = "#fff";
    g.fillRect(0, 0, pagina, altP);
    g.drawImage(src, 0, y * escala, w * escala, tomar * escala, 0, primeira ? 0 : faixa, w * k, tomar * k);
    g.strokeStyle = "#D5DBE5";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(margem, altP - faixa + 0.5);
    g.lineTo(pagina - margem, altP - faixa + 0.5);
    g.stroke();
    g.fillStyle = "#6B7A90";
    g.font = "10px Arial, sans-serif";
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.fillText("FC Porto · Dragon Force · Gestão da Qualidade", margem, altP - faixa / 2);
    g.textAlign = "right";
    g.fillText(`${titulo} · ${hoje}`, pagina - margem, altP - faixa / 2);
    paginas.push({ url: c.toDataURL("image/jpeg", 0.92), w: c.width, h: c.height });
    y += tomar;
    n++;
  }
  const blob = pdfDeJpegs(paginas, vertical ? 595.28 : 841.89, vertical ? 841.89 : 595.28);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${String(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\\/:*?"<>|]/g, "-")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function pdfDeJpegs(paginas, ptW, ptH) {
  const enc = new TextEncoder();
  const partes = [];
  const pos = [];
  let tam = 0;
  const push = (d) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    partes.push(b);
    tam += b.length;
  };
  const obj = (num, corpo) => {
    pos[num] = tam;
    push(`${num} 0 obj\n${corpo}\nendobj\n`);
  };
  push("%PDF-1.4\n");
  const nP = paginas.length;
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Count ${nP} /Kids [${paginas.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`);
  paginas.forEach((p, i) => {
    const base = 3 + i * 3;
    const bin = atob(p.url.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    obj(base, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW} ${ptH}] /Resources << /XObject << /Im0 ${base + 2} 0 R >> >> /Contents ${base + 1} 0 R >>`);
    const cont = `q ${ptW} 0 0 ${ptH} 0 0 cm /Im0 Do Q`;
    obj(base + 1, `<< /Length ${cont.length} >>\nstream\n${cont}\nendstream`);
    pos[base + 2] = tam;
    push(`${base + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
    push(bytes);
    push("\nendstream\nendobj\n");
  });
  const total = 3 + nP * 3;
  const xref = tam;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += `${String(pos[i]).padStart(10, "0")} 00000 n \n`;
  push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(partes, { type: "application/pdf" });
}


// PDF de uma página já desenhada para papel (relatórios): copia o nó, tira botões e espaços de impressão,
// reduz à largura A4 e descarrega logo. A moldura (rodapé em todas as páginas) é feita em gerarPdf.
export async function pdfDeFolha(no, { titulo, nome, vertical = true, largura = 880 }) {
  if (!no) throw new Error("sem página");
  const pagina = vertical ? 794 : 1123;
  const margem = 40;
  const hoje = new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  const folha = document.createElement("div");
  folha.id = "folhaRel";
  folha.style.cssText = `position:fixed;left:-30000px;top:0;width:${largura}px;background:#fff;overflow:hidden`;
  const c = no.cloneNode(true);
  c.querySelectorAll("button, .naoImprimir, .relSoEcra, .relControlos, .relFimEcra, .semFoto, .relPaginas > thead, .relPaginas > tfoot").forEach((el) => el.remove());
  c.querySelectorAll(".relSoImpressao").forEach((el) => (el.style.display = "block"));
  c.style.cssText += `;width:${largura}px;max-width:none;margin:0;border:none;box-shadow:none;border-radius:0`;
  const origSel = no.querySelectorAll("select, input, textarea");
  c.querySelectorAll("select, input, textarea").forEach((el, i) => {
    const o = origSel[i];
    const v = o ? (o.tagName === "SELECT" ? (o.options[o.selectedIndex] || {}).text || "" : o.type === "checkbox" || o.type === "radio" ? "" : o.value) : "";
    if (!v) return el.remove();
    const span = document.createElement("span");
    span.textContent = v;
    el.replaceWith(span);
  });
  const st = document.createElement("style");
  st.textContent = "#folhaRel .relPaginas { width: 100%; border-collapse: collapse; } #folhaRel td { padding: 0; } #folhaRel *, #folhaRel *::before, #folhaRel *::after { animation: none !important; transition: none !important; }";
  folha.appendChild(st);
  folha.appendChild(c);
  document.body.appendChild(folha);
  try {
    await gerarPdf(folha, { vertical, pagina, margem, titulo, hoje, nome, larguraFolha: largura });
  } finally {
    folha.remove();
  }
}
