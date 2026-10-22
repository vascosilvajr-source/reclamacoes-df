// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Gerado a partir do App.jsx: o partilhado vem de ../nucleo.jsx.
import { useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { lerDocumentosDoExcel, gerarExcelDocumentos, TIPOS_DOC, normalizarCodigo, codigoComVersao, proximoCodigo, codigosDuplicados, naListaInt } from "../sgq";
import { Plus, X, AlertTriangle, Search, FileText, Printer, Paperclip, ExternalLink, Link2 } from "lucide-react";
import { COLORS, StatCard, Vazio, fmt, iconBtnStyle, inputStyle, isoDe, labelStyle, linkBtnStyle, normChave, panelStyle, primaryBtnStyle, secondaryBtnStyle, segSGQ } from "../nucleo.jsx";
import { JanelaSGQ, abrirLivroExcel, chipSGQ, descarregarXlsx, nomeComVersao, tdStyle, thStyle } from "../partilhado.jsx";

// ======================= CONTROLO DOCUMENTAL =======================
// ---------- ficheiros dos documentos: pasta privada no Supabase, só descarregados ao abrir ----------
const BUCKET_DOCS = "documentos";
const nomeFicheiroSeguro = (n) =>
  String(n || "ficheiro")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .slice(-120);
// Um documento pode ter vários ficheiros (ex.: ficha de inscrição + dados médicos).
const ficheirosDoc = (d) => (d && Array.isArray(d.ficheiros) ? d.ficheiros : d && d.ficheiro && d.ficheiro.path ? [d.ficheiro] : []).filter((f) => f && f.path);
const temAnexo = (d) => !!(ficheirosDoc(d).length || d.link);
const urlLink = (l) => (/^https?:\/\//i.test(l) ? l : `https://${l}`);
async function abrirFicheiroDoc(f, notificar) {
  // A janela abre já (senão o browser bloqueia) e recebe o endereço temporário a seguir.
  const w = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(BUCKET_DOCS).createSignedUrl(f.path, 300);
  if (error || !data) {
    if (w) w.close();
    if (notificar) notificar(`Não consegui abrir o ficheiro: ${error?.message || "sem resposta"}`, "erro");
    return;
  }
  if (w) w.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}
// Só um anexo: abre logo. Vários: quem chama mostra a escolha.
async function abrirDocumento(d, notificar) {
  const fs = ficheirosDoc(d);
  if (fs.length) return abrirFicheiroDoc(fs[0], notificar);
  if (d.link) window.open(urlLink(d.link), "_blank", "noopener");
}
const apagarFicheiroDoc = async (path) => {
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET_DOCS).remove([path]);
  } catch (e) {
    console.error("Erro ao apagar ficheiro:", e);
  }
};
const tamanhoLegivel = (b) => (!b ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function AnexoDocumento({ d, setD, notificar }) {
  const [aEnviar, setAEnviar] = useState(false);
  const inputRef = useRef(null);
  const lista = ficheirosDoc(d);
  const enviar = async (files) => {
    const l = [...(files || [])];
    if (!l.length) return;
    const grandes = l.filter((f) => f.size > 50 * 1024 * 1024);
    if (grandes.length && notificar) notificar(`${grandes.map((f) => f.name).join(", ")}: mais de 50 MB, ficou de fora.`, "erro");
    setAEnviar(true);
    try {
      for (const f of l.filter((x) => x.size <= 50 * 1024 * 1024)) {
        const path = `${d.id}/${Date.now()}-${nomeFicheiroSeguro(f.name)}`;
        const { error } = await supabase.storage.from(BUCKET_DOCS).upload(path, f, { contentType: f.type || undefined, upsert: false });
        if (error) throw error;
        const novo = { path, nome: f.name, tamanho: f.size, tipo: f.type || "", em: isoDe(new Date()) };
        setD((x) => {
          const { ficheiro, ...resto } = x;
          return { ...resto, ficheiros: [...ficheirosDoc(x), novo] };
        });
      }
    } catch (e) {
      if (notificar) notificar(`Não consegui enviar o ficheiro: ${e?.message || e}`, "erro");
    } finally {
      setAEnviar(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const tirar = (path) =>
    setD((x) => {
      const { ficheiro, ...resto } = x;
      return { ...resto, ficheiros: ficheirosDoc(x).filter((f) => f.path !== path) };
    });
  return (
    <div style={{ ...panelStyle, marginBottom: 0, padding: 14, background: COLORS.paperSunken }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>
          Ficheiros {lista.length > 0 && <span style={{ color: COLORS.slate, fontWeight: 400 }}>· {lista.length}</span>}
        </div>
        <button type="button" disabled={aEnviar} onClick={() => inputRef.current && inputRef.current.click()} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 10px", fontSize: 12.5, display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Paperclip size={13} /> {aEnviar ? "A enviar…" : lista.length ? "Juntar ficheiro" : "Anexar ficheiro"}
        </button>
        <input ref={inputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => enviar(e.target.files)} />
      </div>
      {lista.length > 0 && (
        <div style={{ display: "grid", gap: 4 }}>
          {lista.map((f) => (
            <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 8, padding: "6px 10px" }}>
              <button type="button" onClick={() => abrirFicheiroDoc(f, notificar)} style={{ ...linkBtnStyle, marginTop: 0, display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <Paperclip size={13} /> {f.nome}
              </button>
              <span style={{ fontSize: 12, color: COLORS.slate, flex: "none" }}>{tamanhoLegivel(f.tamanho)}</span>
              <button type="button" onClick={() => tirar(f.path)} aria-label={`Tirar ${f.nome}`} title="Tirar" style={{ ...iconBtnStyle, padding: 2, color: COLORS.slate }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label style={{ ...labelStyle, marginTop: 10 }}>Link (SharePoint, OneDrive, Drive…)</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={d.link || ""} onChange={(e) => setD((x) => ({ ...x, link: e.target.value.trim() }))} placeholder="https://…" style={{ ...inputStyle, flex: 1 }} />
        {d.link && (
          <button type="button" title="Abrir link" onClick={() => window.open(urlLink(d.link), "_blank", "noopener")} style={iconBtnStyle}>
            <ExternalLink size={15} />
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 6, lineHeight: 1.4 }}>
        Os ficheiros ficam numa pasta privada e só são descarregados quando se abrem. Anexa os modelos em branco, não fichas preenchidas.
      </div>
    </div>
  );
}

function EditorDocumento({ inicial, todos, colaboradores, locais, sugestoes, onGuardar, onApagar, onFechar, notificar }) {
  const [d, setD] = useState(() => ({ ...inicial, versoes: [...(inicial.versoes || [])], colaboradores: [...(inicial.colaboradores || [])], locais: [...(inicial.locais || [])] }));
  const [codigoManual, setCodigoManual] = useState(!inicial.__novo);
  const muda = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const mudaTipo = (t) =>
    setD((x) => {
      const n = { ...x, tipo: t };
      if (inicial.__novo && !codigoManual) n.codigo = t === "-" ? "-" : proximoCodigo(todos, t);
      return n;
    });
  const nc = normalizarCodigo(d.codigo);
  const repetidos = d.tipo === "-" || !nc.valido ? [] : todos.filter((x) => x.id !== d.id && normalizarCodigo(x.codigo).codigo === nc.codigo);
  const prefixoCerto = d.tipo === "-" || !nc.valido || nc.prefixo === (TIPOS_DOC[d.tipo] || {}).prefixo;
  const valido = String(d.identificacao || "").trim() && (d.tipo === "-" || nc.valido) && !repetidos.length;
  const alterna = (k, v) => setD((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const hoje = isoDe(new Date());
  const versaoAtual = d.tipo === "-" ? null : codigoComVersao({ ...d, codigo: nc.valido ? nc.codigo : d.codigo });
  const campo = (k, rotulo, lista) => (
    <div>
      <label style={{ ...labelStyle, marginTop: 0 }}>{rotulo}</label>
      <input value={d[k] ?? ""} onChange={(e) => muda(k, e.target.value)} list={lista ? `sgq-${k}` : undefined} style={inputStyle} />
      {lista && (
        <datalist id={`sgq-${k}`}>
          {lista.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      )}
    </div>
  );
  const pathsIni = ficheirosDoc(inicial).map((f) => f.path);
  const pathsNovos = ficheirosDoc(d).map((f) => f.path);
  const guardar = () => {
    const limpo = { ...d, codigo: d.tipo === "-" ? "-" : nc.valido ? nc.codigo : d.codigo, versoes: [...d.versoes].filter(Boolean).sort() };
    delete limpo.__novo;
    if (!limpo.link) delete limpo.link;
    delete limpo.ficheiro;
    if (pathsNovos.length) limpo.ficheiros = ficheirosDoc(d);
    else delete limpo.ficheiros;
    pathsIni.filter((p) => !pathsNovos.includes(p)).forEach(apagarFicheiroDoc);
    onGuardar(limpo);
  };
  // Ficheiro enviado nesta janela e não guardado: não fica perdido na pasta.
  const fechar = () => {
    pathsNovos.filter((p) => !pathsIni.includes(p)).forEach(apagarFicheiroDoc);
    onFechar();
  };
  return (
    <JanelaSGQ
      titulo={inicial.__novo ? "Novo documento" : `${versaoAtual || "Documento"}`}
      largura={860}
      onFechar={fechar}
      rodape={
        <>
          {!inicial.__novo && (
            <button onClick={() => onApagar(d.id)} style={{ ...linkBtnStyle, marginTop: 0, color: COLORS.danger }}>
              Apagar
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={fechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
            Cancelar
          </button>
          <button disabled={!valido} onClick={guardar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px", opacity: valido ? 1 : 0.5 }}>
            Guardar
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {segSGQ(
            Object.entries(TIPOS_DOC).map(([k, v]) => [k, k === "-" ? "Sem código" : `${k} · ${v.rotulo.split(" ")[0]}`]),
            d.tipo,
            mudaTipo
          )}
          {segSGQ(
            [
              ["DF", "Lista DF"],
              ["AMBAS", "DF e INT"],
              ["INT", "Só INT"],
            ],
            (d.lista || "DF") === "INT" ? "INT" : d.int ? "AMBAS" : "DF",
            (v) => setD((x) => ({ ...x, lista: v === "INT" ? "INT" : "DF", int: v === "AMBAS" }))
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 200px) 1fr", gap: 12 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Código</label>
            <input
              value={d.codigo || ""}
              disabled={d.tipo === "-"}
              onChange={(e) => {
                setCodigoManual(true);
                muda("codigo", e.target.value.toUpperCase());
              }}
              style={{ ...inputStyle, fontWeight: 600, borderColor: repetidos.length ? COLORS.danger : undefined }}
            />
            <div style={{ fontSize: 11.5, marginTop: 4, color: repetidos.length || !prefixoCerto ? COLORS.danger : COLORS.slate, lineHeight: 1.4 }}>
              {d.tipo === "-"
                ? "Pastas e arquivos não têm código."
                : repetidos.length
                ? `Já existe: ${repetidos[0].identificacao}`
                : !nc.valido
                ? "Formato: DFF.123"
                : !prefixoCerto
                ? `Um ${TIPOS_DOC[d.tipo].rotulo.toLowerCase()} costuma ser ${TIPOS_DOC[d.tipo].prefixo}.`
                : inicial.__novo
                ? "Gerado: o próximo número livre."
                : "Sem duplicados."}
            </div>
            {inicial.__novo && codigoManual && d.tipo !== "-" && (
              <button
                onClick={() => {
                  setCodigoManual(false);
                  muda("codigo", proximoCodigo(todos, d.tipo));
                }}
                style={{ ...linkBtnStyle, marginTop: 2, fontSize: 12 }}
              >
                Voltar ao código gerado
              </button>
            )}
          </div>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Identificação</label>
            <input value={d.identificacao || ""} onChange={(e) => muda("identificacao", e.target.value)} placeholder="Ex.: FICHA DE ATENDIMENTO" style={inputStyle} autoFocus={inicial.__novo} />
          </div>
        </div>

        <div style={{ ...panelStyle, marginBottom: 0, padding: 14, background: COLORS.paperSunken }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, flex: 1 }}>
              Versões {versaoAtual && <span style={{ color: COLORS.navy, marginLeft: 6 }}>· em vigor: {versaoAtual}</span>}
            </div>
            <button onClick={() => muda("versoes", [...d.versoes, hoje])} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "5px 10px", fontSize: 12.5, display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Plus size={13} /> Nova versão
            </button>
          </div>
          {d.versoes.length === 0 ? (
            <div style={{ fontSize: 12.5, color: COLORS.slate }}>Sem datas. A primeira versão conta como 01.</div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {d.versoes.map((v, k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${k === d.versoes.length - 1 ? COLORS.navy : COLORS.rule}`, borderRadius: 8, padding: "3px 4px 3px 8px", background: COLORS.paperRaised }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>{String(k + 1).padStart(2, "0")}</span>
                  <input type="date" value={v || ""} onChange={(e) => muda("versoes", d.versoes.map((x, j) => (j === k ? e.target.value : x)))} style={{ ...inputStyle, width: 136, padding: "3px 6px", fontSize: 12, border: "none", background: "transparent" }} />
                  <button onClick={() => muda("versoes", d.versoes.filter((_, j) => j !== k))} aria-label="Tirar esta versão" style={{ ...iconBtnStyle, padding: 2, color: COLORS.slate }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ ...labelStyle, marginTop: 0 }}>Registo</label>
            {segSGQ(
              [
                ["Sim", "Sim"],
                ["Não", "Não"],
              ],
              /^s/i.test(d.registo || "") ? "Sim" : /^n/i.test(d.registo || "") ? "Não" : "",
              (v) => muda("registo", v)
            )}
          </div>
          {campo("elaborado", "Elaborado por", sugestoes.elaborado)}
          {campo("aprovado", "Aprovado por", sugestoes.aprovado)}
          {campo("armazenagem", "Armazenagem", sugestoes.armazenagem)}
          {campo("protecao", "Proteção e recuperação", sugestoes.protecao)}
          {campo("retencao", "Tempo de retenção e destino", sugestoes.retencao)}
        </div>

        {[
          ["colaboradores", "Colaboradores", colaboradores],
          ["locais", "Locais", locais],
        ].map(([k, rotulo, lista]) => (
          <div key={k}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <label style={{ ...labelStyle, margin: 0, flex: 1 }}>
                {rotulo} <span style={{ color: COLORS.slate, fontWeight: 400 }}>· {d[k].length} de {lista.length}</span>
              </label>
              <button onClick={() => muda(k, d[k].length === lista.length ? [] : [...lista])} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                {d[k].length === lista.length ? "Nenhum" : "Todos"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {lista.map((v) => (
                <button key={v} type="button" onClick={() => alterna(k, v)} style={chipSGQ(d[k].includes(v))}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}

        <AnexoDocumento d={d} setD={setD} notificar={notificar} />

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: `1px solid ${d.obsoleto ? COLORS.warn : COLORS.rule}`, background: d.obsoleto ? COLORS.warnBg : "transparent" }}>
          <input type="checkbox" checked={!!d.obsoleto} onChange={(e) => muda("obsoleto", e.target.checked)} />
          <span>
            <strong>Obsoleto</strong> <span style={{ color: COLORS.ink2 }}>· deixa de estar em vigor, mas fica no histórico e no Excel (a laranja)</span>
          </span>
        </label>
      </div>
    </JanelaSGQ>
  );
}

export function DocumentosPage({ dados, onGuardar, notificar }) {
  const itens = (dados && dados.itens) || [];
  const colaboradores = (dados && dados.colaboradores) || [];
  const locais = (dados && dados.locais) || [];
  const [texto, setTexto] = useState("");
  const [fTipo, setFTipo] = useState("todos");
  const [fEstado, setFEstado] = useState("vigor");
  const [fLista, setFLista] = useState("todas");
  const [fLocal, setFLocal] = useState("");
  const [fColab, setFColab] = useState("");
  const [ordem, setOrdem] = useState("codigo");
  const [editar, setEditar] = useState(null);
  const [importado, setImportado] = useState(null);
  const [aLer, setALer] = useState(false);
  const [aGerar, setAGerar] = useState(false);
  const [menuAnexos, setMenuAnexos] = useState(null);

  const duplicados = codigosDuplicados(itens);
  const idsDup = new Set(duplicados.flatMap((x) => x.itens.map((i) => i.id)));
  const sugestoes = Object.fromEntries(["elaborado", "aprovado", "armazenagem", "protecao", "retencao"].map((k) => [k, [...new Set(itens.map((i) => i[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"))]));

  const guardarItens = (novos) => onGuardar({ ...(dados || {}), colaboradores, locais, itens: novos });
  const guardarItem = (d) => {
    const existe = itens.some((x) => x.id === d.id);
    const ordemNova = existe ? d.ordem : Math.max(0, ...itens.filter((x) => (x.lista || "DF") === (d.lista || "DF")).map((x) => x.ordem || 0)) + 1;
    guardarItens(existe ? itens.map((x) => (x.id === d.id ? d : x)) : [...itens, { ...d, ordem: ordemNova }]);
    setEditar(null);
    notificar(existe ? `${codigoComVersao(d)} atualizado.` : `${codigoComVersao(d)} criado.`);
  };
  const apagar = (id) => {
    const d = itens.find((x) => x.id === id);
    if (!window.confirm(`Apagar ${d ? `${d.codigo} · ${d.identificacao}` : "este documento"}? Se só deixou de se usar, marca como obsoleto.`)) return;
    guardarItens(itens.filter((x) => x.id !== id));
    // Os ficheiros ficam na pasta: o documento pode ser reposto em "Apagados".
    setEditar(null);
  };
  const novo = () => setEditar({ __novo: true, id: `doc-${Date.now().toString(36)}`, lista: "DF", int: fLista === "INT", tipo: "F", codigo: proximoCodigo(itens, "F"), identificacao: "", registo: "Sim", armazenagem: "SGQ - Suporte Informático", protecao: "Backup semanal / cópia de segurança", retencao: "Enquanto em Vigor", elaborado: "GQ", aprovado: "DE", colaboradores: [], locais: [], obsoleto: false, versoes: [isoDe(new Date())] });
  const novoCodigoPara = (d) => {
    const c = proximoCodigo(itens, d.tipo);
    guardarItens(itens.map((x) => (x.id === d.id ? { ...x, codigo: c } : x)));
    notificar(`"${d.identificacao}" passa a ${c}.`);
  };

  const importar = async (f) => {
    if (!f) return;
    setALer(true);
    try {
      const wb = await abrirLivroExcel(f);
      const r = lerDocumentosDoExcel(wb);
      if (!r.itens.length) throw new Error(r.avisos.join(" ") || "não encontrei documentos");
      setImportado(r);
    } catch (e) {
      notificar(`Não consegui ler o ficheiro: ${e?.message || e}`, "erro");
    } finally {
      setALer(false);
    }
  };
  const confirmar = () => {
    // Os ficheiros e links não vêm no Excel: passam para o documento com o mesmo código e nome.
    const chaveDoc = (x) => `${x.codigo}|${normChave(x.identificacao || "")}`;
    const anexos = new Map();
    itens.filter(temAnexo).forEach((x) => {
      anexos.set(chaveDoc(x), x);
      if (!anexos.has(x.codigo)) anexos.set(x.codigo, x);
    });
    const usados = new Set();
    const comAnexos = importado.itens.map((x) => {
      const a = anexos.get(chaveDoc(x)) || (x.codigo !== "-" ? anexos.get(x.codigo) : null);
      if (!a || usados.has(a.id)) return x;
      usados.add(a.id);
      return { ...x, ...(ficheirosDoc(a).length ? { ficheiros: ficheirosDoc(a) } : {}), ...(a.link ? { link: a.link } : {}) };
    });
    onGuardar({ itens: comAnexos, colaboradores: importado.colaboradores, locais: importado.locais, rodape: importado.rodape, importadoEm: isoDe(new Date()) });
    notificar(`Importados ${importado.itens.length} documentos.`);
    setImportado(null);
  };
  const descarregar = async () => {
    setAGerar(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const proprio = itens.find((x) => x.codigo === "DFF.001" && (x.lista || "DF") === "DF");
      const buf = await gerarExcelDocumentos(ExcelJS, { itens, colaboradores, locais, rodape: proprio ? codigoComVersao(proprio) : "DFF.001" });
      await descarregarXlsx(buf, nomeComVersao(dados, "DFF.001", "CONTROLO E GESTÃO DOCUMENTAL"));
    } catch (e) {
      notificar(`Não foi possível gerar o Excel: ${e?.message || e}`, "erro");
    } finally {
      setAGerar(false);
    }
  };

  const q = normChave(texto);
  const visiveis = itens
    .filter((d) => fTipo === "todos" || (d.tipo || "-") === fTipo)
    .filter((d) => (fEstado === "todos" ? true : fEstado === "obsoletos" ? d.obsoleto : !d.obsoleto))
    .filter((d) => fLista === "todas" || (fLista === "INT" ? naListaInt(d) : (d.lista || "DF") === fLista))
    .filter((d) => !fLocal || (d.locais || []).includes(fLocal))
    .filter((d) => !fColab || (d.colaboradores || []).includes(fColab))
    .filter((d) => !q || normChave([d.codigo, codigoComVersao(d), d.identificacao, d.elaborado, d.aprovado, d.armazenagem].join(" ")).includes(q))
    .sort((a, b) => {
      if (ordem === "recentes") return String((b.versoes || []).slice(-1)[0] || "").localeCompare(String((a.versoes || []).slice(-1)[0] || ""));
      if (ordem === "nome") return String(a.identificacao).localeCompare(String(b.identificacao), "pt");
      const na = normalizarCodigo(a.codigo);
      const nb = normalizarCodigo(b.codigo);
      return (a.lista || "DF").localeCompare(b.lista || "DF") || String(na.prefixo || "~").localeCompare(String(nb.prefixo || "~")) || (na.numero || 0) - (nb.numero || 0) || (a.ordem || 0) - (b.ordem || 0);
    });
  const emVigor = itens.filter((d) => !d.obsoleto);
  const nTipo = (t) => emVigor.filter((d) => d.tipo === t).length;
  const ultimaRevisao = emVigor.map((d) => (d.versoes || []).slice(-1)[0]).filter(Boolean).sort().slice(-1)[0];
  const selF = { ...inputStyle, width: "auto", padding: "6px 10px", fontSize: 13 };
  const th = { ...thStyle, whiteSpace: "nowrap" };

  const botoes = (
    <>
      <label className="press" style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <FileText size={14} /> {aLer ? "A ler…" : "Importar Excel"}
        <input type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => importar(e.target.files && e.target.files[0])} />
      </label>
      {itens.length > 0 && (
        <button className="press" disabled={aGerar} onClick={descarregar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "7px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Printer size={14} /> {aGerar ? "A gerar…" : "Descarregar Excel"}
        </button>
      )}
    </>
  );

  return (
    <div>
      {importado && (
        <JanelaSGQ
          titulo="Importar o controlo documental"
          largura={560}
          onFechar={() => setImportado(null)}
          rodape={
            <>
              <span style={{ flex: 1 }} />
              <button onClick={() => setImportado(null)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
                Cancelar
              </button>
              <button onClick={confirmar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}>
                {itens.length ? "Importar e substituir" : "Importar"}
              </button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: COLORS.ink2, lineHeight: 1.6 }}>
            <div>{importado.lidas.join(" · ")} documentos</div>
            <div>
              {importado.itens.filter((d) => d.obsoleto).length} obsoletos · {importado.colaboradores.length} cargos · {importado.locais.length} locais
            </div>
            {codigosDuplicados(importado.itens).length > 0 && (
              <div style={{ color: COLORS.danger }}>
                Códigos repetidos: {codigosDuplicados(importado.itens).map((x) => `${x.codigo} (${x.itens.length}×)`).join(", ")}. Ficam assinalados para corrigires.
              </div>
            )}
            {importado.avisos.map((a) => (
              <div key={a} style={{ color: COLORS.warn }}>
                {a}
              </div>
            ))}
            {itens.length > 0 && <div style={{ marginTop: 8, color: COLORS.ink }}>Substitui os {itens.length} documentos que estão na app.</div>}
          </div>
        </JanelaSGQ>
      )}
      {editar && <EditorDocumento inicial={editar} todos={itens} colaboradores={colaboradores} locais={locais} sugestoes={sugestoes} onGuardar={guardarItem} onApagar={apagar} onFechar={() => setEditar(null)} notificar={notificar} />}

      {itens.length === 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          <Vazio icon={FileText} titulo="Ainda sem documentos" texto="Importa o Excel DFF.001 (Controlo e gestão documental). A app lê as duas listas (DF e INT), as versões e os obsoletos." />
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>{botoes}</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: COLORS.slate }} />
              <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pesquisar código ou nome" style={{ ...inputStyle, paddingLeft: 32 }} />
            </div>
            {segSGQ(
              [
                ["vigor", "Em vigor"],
                ["obsoletos", `Obsoletos · ${itens.filter((d) => d.obsoleto).length}`],
                ["todos", "Todos"],
              ],
              fEstado,
              setFEstado
            )}
            <span style={{ flex: 1 }} />
            {botoes}
            <button className="press" onClick={novo} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "7px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Novo documento
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <StatCard label="Em vigor" value={emVigor.length} subtitle={`${itens.length - emVigor.length} obsoletos`} />
            <StatCard label="Formulários" value={nTipo("F")} subtitle={`próximo: ${proximoCodigo(itens, "F")}`} />
            <StatCard label="Normativas" value={nTipo("N")} subtitle={`próximo: ${proximoCodigo(itens, "N")}`} />
            <StatCard label="Processos e manuais" value={nTipo("P") + nTipo("M")} subtitle={`${proximoCodigo(itens, "P")} · ${proximoCodigo(itens, "M")}`} />
            <StatCard label="Última revisão" value={ultimaRevisao ? fmt(new Date(`${ultimaRevisao}T00:00:00`)) : "—"} />
          </div>

          {duplicados.length > 0 && (
            <div style={{ ...panelStyle, marginBottom: 14, borderColor: COLORS.danger, background: COLORS.dangerBg }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} color={COLORS.danger} />
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {duplicados.length === 1 ? "1 código repetido" : `${duplicados.length} códigos repetidos`}
                </div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {duplicados.map((x) => (
                  <div key={x.codigo} style={{ fontSize: 12.5 }}>
                    <strong>{x.codigo}</strong>:{" "}
                    {x.itens.map((d, k) => (
                      <span key={d.id}>
                        {k > 0 && " · "}
                        <button onClick={() => setEditar(d)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5 }}>
                          {d.identificacao}
                        </button>
                        {k > 0 && (
                          <button onClick={() => novoCodigoPara(d)} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "1px 8px", fontSize: 11.5, marginLeft: 6 }}>
                            Dar {proximoCodigo(itens, d.tipo)}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...panelStyle, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${COLORS.ruleSoft}` }}>
              <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={selF} aria-label="Tipo">
                <option value="todos">Todos os tipos</option>
                {Object.entries(TIPOS_DOC).map(([k, v]) => (
                  <option key={k} value={k}>
                    {k === "-" ? v.rotulo : `${k} · ${v.rotulo}`}
                  </option>
                ))}
              </select>
              <select value={fLista} onChange={(e) => setFLista(e.target.value)} style={selF} aria-label="Lista">
                <option value="todas">Listas DF e INT</option>
                <option value="DF">Só DF</option>
                <option value="INT">Só INT</option>
              </select>
              <select value={fLocal} onChange={(e) => setFLocal(e.target.value)} style={{ ...selF, maxWidth: 210 }} aria-label="Local">
                <option value="">Todos os locais</option>
                {locais.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select value={fColab} onChange={(e) => setFColab(e.target.value)} style={{ ...selF, maxWidth: 230 }} aria-label="Colaborador">
                <option value="">Todos os cargos</option>
                {colaboradores.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <span style={{ flex: 1 }} />
              <select value={ordem} onChange={(e) => setOrdem(e.target.value)} style={selF} aria-label="Ordenar">
                <option value="codigo">Por código</option>
                <option value="recentes">Revistos há menos tempo</option>
                <option value="nome">Por nome</option>
              </select>
              <span style={{ fontSize: 12, color: COLORS.slate }}>{visiveis.length} documentos</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Código</th>
                    <th style={th}>Identificação</th>
                    <th style={th}>Tipo</th>
                    <th style={th}>Última versão</th>
                    <th style={th}>Elab. / Aprov.</th>
                    <th style={{ ...th, textAlign: "right" }}>Locais</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.slice(0, 400).map((d) => {
                    const ult = (d.versoes || []).slice(-1)[0];
                    return (
                      <tr key={d.id} className="rowHover" onClick={() => setEditar(d)} style={{ cursor: "pointer", background: d.obsoleto ? COLORS.warnBg : undefined }}>
                        <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: idsDup.has(d.id) ? COLORS.danger : COLORS.ink }}>
                          {temAnexo(d) ? (
                            <span style={{ position: "relative", display: "inline-block" }}>
                              <button
                                title={ficheirosDoc(d).length + (d.link ? 1 : 0) > 1 ? "Escolher o ficheiro" : ficheirosDoc(d).length ? `Abrir ${ficheirosDoc(d)[0].nome}` : "Abrir link"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (ficheirosDoc(d).length + (d.link ? 1 : 0) > 1) {
                                    const r = e.currentTarget.getBoundingClientRect();
                                    setMenuAnexos(menuAnexos && menuAnexos.id === d.id ? null : { id: d.id, x: r.left, y: r.bottom + 4 });
                                  }
                                  else abrirDocumento(d, notificar);
                                }}
                                style={{ ...linkBtnStyle, marginTop: 0, fontWeight: 600, fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: 4, color: idsDup.has(d.id) ? COLORS.danger : COLORS.navy }}
                              >
                                {d.tipo === "-" ? "—" : codigoComVersao(d)}
                                {ficheirosDoc(d).length ? <Paperclip size={12} /> : <Link2 size={12} />}
                                {ficheirosDoc(d).length + (d.link ? 1 : 0) > 1 && <span style={{ fontSize: 11 }}>{ficheirosDoc(d).length + (d.link ? 1 : 0)}</span>}
                              </button>
                              {menuAnexos && menuAnexos.id === d.id && (
                                <>
                                  <span onClick={(e) => { e.stopPropagation(); setMenuAnexos(null); }} onWheel={() => setMenuAnexos(null)} style={{ position: "fixed", inset: 0, zIndex: 20, cursor: "default" }} />
                                  <span onClick={(e) => e.stopPropagation()} style={{ position: "fixed", top: Math.min(menuAnexos.y, window.innerHeight - 160), left: menuAnexos.x, zIndex: 21, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 10, boxShadow: "0 10px 30px -10px rgba(8,14,24,0.35)", padding: 4, display: "grid", minWidth: 240, cursor: "default" }}>
                                    {ficheirosDoc(d).map((f) => (
                                      <button key={f.path} onClick={() => { setMenuAnexos(null); abrirFicheiroDoc(f, notificar); }} className="rowHover" style={{ border: "none", background: "transparent", textAlign: "left", padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500, color: COLORS.ink, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                                        <Paperclip size={13} color={COLORS.slate} /> {f.nome}
                                      </button>
                                    ))}
                                    {d.link && (
                                      <button onClick={() => { setMenuAnexos(null); window.open(urlLink(d.link), "_blank", "noopener"); }} className="rowHover" style={{ border: "none", background: "transparent", textAlign: "left", padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500, color: COLORS.ink, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
                                        <Link2 size={13} color={COLORS.slate} /> Abrir link
                                      </button>
                                    )}
                                  </span>
                                </>
                              )}
                            </span>
                          ) : d.tipo === "-" ? (
                            "—"
                          ) : (
                            codigoComVersao(d)
                          )}
                          {naListaInt(d) && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: COLORS.purple, border: `1px solid ${COLORS.purple}`, borderRadius: 4, padding: "0 4px" }}>INT</span>}
                        </td>
                        <td style={{ ...tdStyle, minWidth: 260 }}>
                          {d.identificacao}
                          {d.obsoleto && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: COLORS.warn }}>obsoleto</span>}
                        </td>
                        <td style={{ ...tdStyle, color: COLORS.ink2, whiteSpace: "nowrap" }}>{d.tipo === "-" ? "—" : d.tipo}</td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", color: COLORS.ink2, fontVariantNumeric: "tabular-nums" }}>{ult ? fmt(new Date(`${ult}T00:00:00`)) : "—"}</td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", color: COLORS.ink2 }}>
                          {d.elaborado || "—"} / {d.aprovado || "—"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", color: COLORS.ink2, fontVariantNumeric: "tabular-nums" }}>{(d.locais || []).length || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visiveis.length === 0 && <div style={{ padding: 18, fontSize: 13, color: COLORS.slate }}>Nenhum documento com estes filtros.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
