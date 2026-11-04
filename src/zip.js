// Zip sem compressão ("store"), sem bibliotecas: chega para juntar documentos num só ficheiro.
// ficheiros: [{ nome, dados: Uint8Array | string }] → Blob application/zip.

const TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABELA[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// Data e hora no formato MS-DOS.
function dataDos(d) {
  const t = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const a = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return [t, a];
}

export function zipDe(ficheiros) {
  const enc = new TextEncoder();
  const [hora, dia] = dataDos(new Date());
  const partes = [];
  const central = [];
  let pos = 0;
  const usados = new Set();
  ficheiros.forEach((f) => {
    // Nomes repetidos ficam "nome (2).pdf".
    let nome = String(f.nome || "ficheiro").replace(/[\\:*?"<>|]/g, "-");
    if (usados.has(nome)) {
      const m = nome.match(/^(.*?)(\.[^.]*)?$/);
      let i = 2;
      while (usados.has(`${m[1]} (${i})${m[2] || ""}`)) i++;
      nome = `${m[1]} (${i})${m[2] || ""}`;
    }
    usados.add(nome);
    const nb = enc.encode(nome);
    const dados = typeof f.dados === "string" ? enc.encode(f.dados) : f.dados;
    const crc = crc32(dados);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true);
    loc.setUint16(4, 20, true);
    loc.setUint16(6, 0x0800, true); // nomes em UTF-8
    loc.setUint16(8, 0, true);
    loc.setUint16(10, hora, true);
    loc.setUint16(12, dia, true);
    loc.setUint32(14, crc, true);
    loc.setUint32(18, dados.length, true);
    loc.setUint32(22, dados.length, true);
    loc.setUint16(26, nb.length, true);
    loc.setUint16(28, 0, true);
    partes.push(new Uint8Array(loc.buffer), nb, dados);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, hora, true);
    cen.setUint16(14, dia, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, dados.length, true);
    cen.setUint32(24, dados.length, true);
    cen.setUint16(28, nb.length, true);
    cen.setUint32(42, pos, true);
    central.push(new Uint8Array(cen.buffer), nb);
    pos += 30 + nb.length + dados.length;
  });
  const tamCentral = central.reduce((n, b) => n + b.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, ficheiros.length, true);
  fim.setUint16(10, ficheiros.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, pos, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: "application/zip" });
}
