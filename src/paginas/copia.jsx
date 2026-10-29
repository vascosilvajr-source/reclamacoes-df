// Cópia de segurança: descarrega todos os dados da app (tabela app_storage) num ficheiro cifrado
// com uma palavra-passe (AES-GCM 256, chave derivada com PBKDF2-SHA256). Sem a palavra-passe o ficheiro
// não se lê, por isso pode ficar guardado no computador ou numa pen sem expor dados de menores.
// Também repõe uma cópia (com confirmação e cópia automática do estado atual antes de repor).
import React, { useState } from "react";
import { Download, Upload, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "../supabaseClient";
import { COLORS, fmt, inputStyle, labelStyle, panelStyle, panelTitle, primaryBtnStyle, secondaryBtnStyle } from "../nucleo.jsx";

export const CHAVE_ULTIMA_COPIA = "reclamacoes:ultima-copia";
const ITERACOES = 310000;
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u8) => {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const deB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

async function chaveDe(senha, sal, iter) {
  const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function lerTudo() {
  const linhas = [];
  for (let de = 0; ; de += 500) {
    const { data, error } = await supabase.from("app_storage").select("key, value, updated_at").order("key").range(de, de + 499);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return linhas.filter((l) => l.key !== "keep-alive:heartbeat");
}

async function cifrar(linhas, senha) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chave = await chaveDe(senha, sal, ITERACOES);
  const corpo = enc.encode(JSON.stringify({ criado: new Date().toISOString(), linhas }));
  const cif = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, corpo));
  return JSON.stringify({ formato: "df-qualidade-copia-v1", criado: new Date().toISOString(), chaves: linhas.length, kdf: { nome: "PBKDF2-SHA256", iteracoes: ITERACOES, sal: b64(sal) }, iv: b64(iv), dados: b64(cif) });
}

async function decifrar(texto, senha) {
  let f;
  try {
    f = JSON.parse(texto);
  } catch (e) {
    throw new Error("Este ficheiro não é uma cópia da app.");
  }
  if (f.formato !== "df-qualidade-copia-v1") throw new Error("Este ficheiro não é uma cópia da app.");
  const chave = await chaveDe(senha, deB64(f.kdf.sal), f.kdf.iteracoes);
  try {
    const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(f.iv) }, chave, deB64(f.dados));
    return JSON.parse(dec.decode(claro));
  } catch (e) {
    throw new Error("Palavra-passe errada (ou ficheiro danificado).");
  }
}

function descarregar(texto, nome) {
  const url = URL.createObjectURL(new Blob([texto], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

export function CopiaSegurancaPage({ ultima, onFeita, notificar }) {
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [aFazer, setAFazer] = useState(false);
  const [ficheiro, setFicheiro] = useState(null);
  const [senhaR, setSenhaR] = useState("");
  const [lida, setLida] = useState(null);
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");

  const fraca = senha.length < 10;
  const exportar = async () => {
    setErro("");
    setAFazer(true);
    try {
      const linhas = await lerTudo();
      descarregar(await cifrar(linhas, senha), `copia-qualidade-DF-${hojeISO()}.dfcopia`);
      const reg = { em: new Date().toISOString(), chaves: linhas.length };
      await supabase.from("app_storage").upsert({ key: CHAVE_ULTIMA_COPIA, value: reg, updated_at: reg.em });
      onFeita && onFeita(reg);
      notificar && notificar(`Cópia descarregada (${linhas.length} conjuntos de dados). Guarda o ficheiro e a palavra-passe em sítios diferentes.`);
      setSenha("");
      setSenha2("");
    } catch (e) {
      setErro(e.message || String(e));
    }
    setAFazer(false);
  };

  const abrir = async () => {
    setErro("");
    setLida(null);
    setAFazer(true);
    try {
      setLida(await decifrar(await ficheiro.text(), senhaR));
    } catch (e) {
      setErro(e.message || String(e));
    }
    setAFazer(false);
  };

  const repor = async () => {
    setErro("");
    setAFazer(true);
    try {
      // Antes de repor, guarda o estado atual com a mesma palavra-passe (para poder voltar atrás).
      const atuais = await lerTudo();
      descarregar(await cifrar(atuais, senhaR), `copia-antes-de-repor-${hojeISO()}.dfcopia`);
      const linhas = (lida.linhas || []).filter((l) => l.key && l.key !== "keep-alive:heartbeat");
      for (let i = 0; i < linhas.length; i += 50) {
        const lote = linhas.slice(i, i + 50).map((l) => ({ key: l.key, value: l.value, updated_at: new Date().toISOString() }));
        const { error } = await supabase.from("app_storage").upsert(lote);
        if (error) throw error;
      }
      notificar && notificar(`Cópia reposta (${linhas.length} conjuntos). A app vai recarregar.`, "ok", 3000);
      setTimeout(() => window.location.reload(), 1800);
    } catch (e) {
      setErro(e.message || String(e));
      setAFazer(false);
    }
  };

  const dias = ultima && ultima.em ? Math.floor((Date.now() - new Date(ultima.em).getTime()) / 86400000) : null;
  const caixa = { ...panelStyle, padding: 20, marginBottom: 16 };
  const lbl = { ...labelStyle, marginTop: 10 };
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ ...caixa, display: "flex", gap: 12, alignItems: "flex-start", borderColor: dias === null || dias > 7 ? COLORS.warn : undefined }}>
        {dias === null || dias > 7 ? <AlertTriangle size={20} color={COLORS.warn} /> : <ShieldCheck size={20} color={COLORS.ok} />}
        <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
          {dias === null ? <strong>Ainda não foi feita nenhuma cópia nesta app.</strong> : <strong>Última cópia: {fmt(new Date(ultima.em))} ({dias === 0 ? "hoje" : `há ${dias} ${dias === 1 ? "dia" : "dias"}`}).</strong>}
          <div style={{ color: COLORS.ink2 }}>Faz uma por semana. O ficheiro vai cifrado: sem a palavra-passe ninguém o consegue ler. Guarda o ficheiro e a palavra-passe em sítios diferentes, e não a percas: sem ela a cópia não se recupera.</div>
        </div>
      </div>

      <div style={caixa}>
        <div style={panelTitle}>Fazer cópia agora</div>
        <label style={lbl}>Palavra-passe da cópia (mínimo 10 caracteres)</label>
        <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} style={inputStyle} />
        <label style={lbl}>Repete a palavra-passe</label>
        <input type="password" autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} style={inputStyle} />
        {senha && fraca && <div style={{ fontSize: 12.5, color: COLORS.warn, marginTop: 6 }}>Usa pelo menos 10 caracteres.</div>}
        {senha2 && senha !== senha2 && <div style={{ fontSize: 12.5, color: COLORS.warn, marginTop: 6 }}>As palavras-passe não coincidem.</div>}
        <button onClick={exportar} disabled={aFazer || fraca || senha !== senha2} className="press" style={{ ...primaryBtnStyle, width: "auto", marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, opacity: aFazer || fraca || senha !== senha2 ? 0.55 : 1 }}>
          <Download size={15} /> {aFazer ? "A preparar…" : "Descarregar cópia cifrada"}
        </button>
        <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 10 }}>Inclui todos os dados da app (reclamações, auditorias, inscritos, sanções, avaliações, definições…). Os ficheiros do controlo documental não vão na cópia: esses já têm o original fora da app.</div>
      </div>

      <div style={caixa}>
        <div style={panelTitle}>Repor uma cópia</div>
        <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 6 }}>Só para recuperar de um problema. Substitui os dados atuais pelos da cópia. Antes de repor, a app descarrega automaticamente uma cópia do estado atual.</div>
        <label style={lbl}>Ficheiro da cópia (.dfcopia)</label>
        <input type="file" accept=".dfcopia,application/octet-stream" onChange={(e) => { setFicheiro(e.target.files && e.target.files[0]); setLida(null); }} style={{ fontSize: 13 }} />
        <label style={lbl}>Palavra-passe da cópia</label>
        <input type="password" autoComplete="off" value={senhaR} onChange={(e) => setSenhaR(e.target.value)} style={inputStyle} />
        <button onClick={abrir} disabled={!ficheiro || !senhaR || aFazer} className="press" style={{ ...secondaryBtnStyle, width: "auto", marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Upload size={15} /> Abrir e verificar
        </button>
        {lida && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: COLORS.warnBg, fontSize: 13, lineHeight: 1.55 }}>
            Cópia de <strong>{fmt(new Date(lida.criado))}</strong> com <strong>{(lida.linhas || []).length}</strong> conjuntos de dados. Para repor, escreve <strong>REPOR</strong>:
            <input value={confirma} onChange={(e) => setConfirma(e.target.value)} style={{ ...inputStyle, marginTop: 8 }} />
            <button onClick={repor} disabled={confirma !== "REPOR" || aFazer} className="press" style={{ ...primaryBtnStyle, width: "auto", marginTop: 10, background: COLORS.warn, opacity: confirma !== "REPOR" ? 0.5 : 1 }}>
              {aFazer ? "A repor…" : "Repor esta cópia"}
            </button>
          </div>
        )}
      </div>
      {erro && <div style={{ color: COLORS.warn, fontSize: 13.5, fontWeight: 600 }}>{erro}</div>}
    </div>
  );
}
