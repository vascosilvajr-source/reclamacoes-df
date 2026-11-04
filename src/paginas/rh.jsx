// Página carregada à medida (ver CARREGAR_PAGINA em src/nucleo.jsx).
// Recursos humanos: todos os colaboradores Dragon Force (treinadores, coordenadores, ROs, armazém…).
// Quem sai fica 2 anos; quem sai por motivo grave ou com avaliações muito negativas fica impedido
// para sempre (só com o mínimo para o reconhecer). Estes dados nunca saem em e-mails.
import { useMemo, useState } from "react";
import { Plus, Search, UserX, AlertTriangle } from "lucide-react";
import { ANOS_GUARDAR, coincideImpedido, estadoColaborador, iniciaisDoNome, notaBaixa, porIntegrar, rhCompleto, saiu, semHorario, ultimaNota } from "../rh";
import { COLORS, StatCard, Vazio, inputStyle, isoDe, labelStyle, linkBtnStyle, panelStyle, primaryBtnStyle, secondaryBtnStyle, segSGQ } from "../nucleo.jsx";
import { JanelaSGQ, chipSGQ, tdStyle, thStyle } from "../partilhado.jsx";

const novoId = () => `rh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const dataPT = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};
const f1 = (n) => (n === null || n === undefined ? "—" : n.toFixed(1).replace(".", ","));

function Etiqueta({ cor, fundo, children, titulo }) {
  return (
    <span title={titulo} style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, color: cor, background: fundo, marginRight: 4, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function EditorColaborador({ inicial, d, escolas, onGuardar, onApagar, onFechar }) {
  const [c, setC] = useState(() => ({ ...inicial }));
  const [iniTocadas, setIniTocadas] = useState(!inicial.__novo);
  const muda = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const impedido = coincideImpedido(c, d.colaboradores);
  const valido = String(c.nome || "").trim() && String(c.iniciais || "").trim();
  const guardar = () => {
    if (impedido && !window.confirm(`ATENÇÃO: ${impedido.nome} (nascido a ${dataPT(impedido.nascimento)}) está impedido de voltar ao projeto.\nMotivo: ${impedido.motivoImpedido || impedido.motivoSaida || "—"}\n\nGuardar mesmo assim?`)) return;
    const { __novo, ...limpo } = c;
    onGuardar({ ...limpo, nome: String(c.nome).trim(), iniciais: String(c.iniciais).trim().toUpperCase() });
  };
  const campo = (k, rotulo, extra = {}) => (
    <div>
      <label style={{ ...labelStyle, marginTop: 0 }}>{rotulo}</label>
      <input value={c[k] ?? ""} onChange={(e) => muda(k, e.target.value)} style={inputStyle} {...extra} />
    </div>
  );
  return (
    <JanelaSGQ
      titulo={inicial.__novo ? "Novo colaborador" : c.nome}
      largura={720}
      onFechar={onFechar}
      rodape={
        <>
          {!inicial.__novo && (
            <button onClick={() => onApagar(c.id)} style={{ ...linkBtnStyle, marginTop: 0, color: COLORS.danger, marginRight: "auto" }}>
              Apagar
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
            Cancelar
          </button>
          <button disabled={!valido} onClick={guardar} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px", opacity: valido ? 1 : 0.5 }}>
            Guardar
          </button>
        </>
      }
    >
      {impedido && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: COLORS.dangerBg, color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>
          <AlertTriangle size={16} style={{ flex: "none", marginTop: 1 }} />
          <div>
            <b>Mesmo nome e data de nascimento de alguém impedido de voltar.</b> Saiu a {dataPT(impedido.saida)} · {impedido.motivoImpedido || impedido.motivoSaida || "sem motivo registado"}.
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Nome</label>
          <input
            value={c.nome || ""}
            onChange={(e) => {
              const v = e.target.value;
              setC((x) => ({ ...x, nome: v, ...(iniTocadas ? {} : { iniciais: iniciaisDoNome(v) }) }));
            }}
            style={inputStyle}
            autoFocus={!!inicial.__novo}
          />
        </div>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Iniciais / sigla</label>
          <input
            value={c.iniciais || ""}
            maxLength={4}
            onChange={(e) => {
              setIniTocadas(true);
              muda("iniciais", e.target.value.toUpperCase());
            }}
            title="As mesmas siglas dos Espaços e das Avaliações do staff"
            style={{ ...inputStyle, textTransform: "uppercase" }}
          />
        </div>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Função</label>
          <select value={c.funcao || ""} onChange={(e) => muda("funcao", e.target.value)} style={inputStyle}>
            <option value="">Escolher…</option>
            {[...new Set([...d.funcoes, ...(c.funcao ? [c.funcao] : [])])].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        {campo("nascimento", "Data de nascimento", { type: "date" })}
        {campo("email", "E-mail", { type: "email" })}
        {campo("telefone", "Telefone", { type: "tel" })}
        {campo("entrada", "Entrada no projeto", { type: "date" })}
      </div>
      <label style={{ ...labelStyle }}>Escolas</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {escolas.map((e) => {
          const on = (c.escolas || []).includes(e);
          return (
            <button key={e} type="button" onClick={() => muda("escolas", on ? c.escolas.filter((x) => x !== e) : [...(c.escolas || []), e])} style={chipSGQ(on)}>
              {e}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 12, lineHeight: 1.5 }}>
        Estes dados ficam só na app (nunca saem nos e-mails às escolas). Quem sai fica {ANOS_GUARDAR} anos; quem sai por motivo grave fica impedido de voltar, só com o nome, as iniciais, a data de nascimento e o motivo.
      </div>
    </JanelaSGQ>
  );
}

function RegistarSaida({ c, avaliacoes, minimo, onGuardar, onFechar }) {
  const baixa = notaBaixa(c, avaliacoes, minimo);
  const [s, setS] = useState({ saida: isoDe(new Date()), motivoSaida: "", gravoso: false });
  const impedir = s.gravoso || baixa;
  return (
    <JanelaSGQ
      titulo={`Saída · ${c.nome}`}
      largura={560}
      onFechar={onFechar}
      rodape={
        <>
          <span style={{ flex: 1 }} />
          <button onClick={onFechar} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "9px 14px" }}>
            Cancelar
          </button>
          <button
            disabled={!s.saida}
            onClick={() => onGuardar({ ...c, ...s, impedido: impedir, motivoImpedido: impedir ? (s.gravoso ? s.motivoSaida || "Saída por motivo grave" : `Avaliação do staff muito negativa (${f1(ultimaNota(c, avaliacoes))})`) : undefined })}
            style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "9px 16px" }}
          >
            Registar saída
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Data de saída</label>
          <input type="date" value={s.saida} onChange={(e) => setS({ ...s, saida: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Motivo</label>
          <input value={s.motivoSaida} onChange={(e) => setS({ ...s, motivoSaida: e.target.value })} placeholder="ex.: fim de contrato, mudança de cidade, expulsão…" style={inputStyle} />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, cursor: "pointer" }}>
          <input type="checkbox" checked={s.gravoso} onChange={(e) => setS({ ...s, gravoso: e.target.checked })} />
          Motivo grave ou expulsão (fica impedido de voltar ao projeto)
        </label>
        {baixa && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: COLORS.dangerBg, color: COLORS.danger, fontSize: 13 }}>
            A última avaliação do staff de {c.iniciais} tem média {f1(ultimaNota(c, avaliacoes))} (limite {f1(minimo)}): fica impedido de voltar.
          </div>
        )}
        <div style={{ fontSize: 12, color: COLORS.slate }}>
          {impedir ? "Fica guardado para sempre, só com o mínimo para o reconhecer." : `Fica guardado ${ANOS_GUARDAR} anos e depois sai da lista sozinho.`}
        </div>
      </div>
    </JanelaSGQ>
  );
}

export function RecursosHumanosPage({ dados, escolas, avaliacoes, espacos, onGuardar, notificar }) {
  const d = rhCompleto(dados);
  const [vista, setVista] = useState("ativos");
  const [procura, setProcura] = useState("");
  const [fFuncao, setFFuncao] = useState("todas");
  const [fEscola, setFEscola] = useState("todas");
  const [editar, setEditar] = useState(null);
  const [aSair, setASair] = useState(null);

  const semHor = useMemo(() => new Set((escolas || []).flatMap((e) => semHorario(d, espacos, e).map((c) => `${c.id}|${e}`))), [d, espacos, escolas]);
  const porInt = useMemo(() => new Set(porIntegrar(d).map((c) => c.id)), [d]);
  const lista = d.colaboradores
    .filter((c) => (vista === "ativos" ? !saiu(c) : vista === "saidas" ? saiu(c) && !c.impedido : c.impedido))
    .filter((c) => fFuncao === "todas" || c.funcao === fFuncao)
    .filter((c) => fEscola === "todas" || (c.escolas || []).includes(fEscola))
    .filter((c) => !procura.trim() || `${c.nome} ${c.iniciais} ${c.email || ""}`.toLowerCase().includes(procura.trim().toLowerCase()))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt"));
  const ativos = d.colaboradores.filter((c) => !saiu(c));

  const guardarColab = (c) => {
    const existe = d.colaboradores.some((x) => x.id === c.id);
    onGuardar({ ...d, colaboradores: existe ? d.colaboradores.map((x) => (x.id === c.id ? c : x)) : [...d.colaboradores, c] });
    setEditar(null);
    setASair(null);
    notificar(existe ? "Colaborador atualizado." : `${c.nome} acrescentado. Aparece na integração até a checklist estar feita.`);
  };
  const apagar = (id) => {
    const c = d.colaboradores.find((x) => x.id === id);
    if (!window.confirm(`Apagar ${c ? c.nome : "este colaborador"}? Se saiu do projeto, usa "Registar saída" (fica guardado ${ANOS_GUARDAR} anos).`)) return;
    onGuardar({ ...d, colaboradores: d.colaboradores.filter((x) => x.id !== id) });
    setEditar(null);
  };
  const guardarConfig = (campos) => onGuardar({ ...d, ...campos });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        <StatCard label="Colaboradores ativos" value={ativos.length} />
        <StatCard label="Por integrar" value={porInt.size} color={porInt.size ? COLORS.warn : undefined} subtitle="checklist por fazer" />
        <StatCard label="Sem horário nos Espaços" value={new Set([...semHor].map((k) => k.split("|")[0])).size} color={semHor.size ? COLORS.warn : undefined} subtitle="treinadores por alocar" />
        <StatCard label="Impedidos" value={d.colaboradores.filter((c) => c.impedido).length} subtitle="não podem voltar" />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {segSGQ(
          [
            ["ativos", `Ativos · ${ativos.length}`],
            ["saidas", `Saídas · ${d.colaboradores.filter((c) => saiu(c) && !c.impedido).length}`],
            ["impedidos", `Impedidos · ${d.colaboradores.filter((c) => c.impedido).length}`],
            ["config", "Configuração"],
          ],
          vista,
          setVista
        )}
        <span style={{ flex: 1 }} />
        {vista !== "config" && (
          <>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: COLORS.slate }} />
              <input value={procura} onChange={(e) => setProcura(e.target.value)} placeholder="Procurar…" style={{ ...inputStyle, width: 170, padding: "7px 8px 7px 28px" }} />
            </div>
            <select value={fFuncao} onChange={(e) => setFFuncao(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 8px" }}>
              <option value="todas">Todas as funções</option>
              {d.funcoes.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <select value={fEscola} onChange={(e) => setFEscola(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 8px" }}>
              <option value="todas">Todas as escolas</option>
              {escolas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <button onClick={() => setEditar({ __novo: true, id: novoId(), nome: "", iniciais: "", funcao: "", escolas: fEscola !== "todas" ? [fEscola] : [], entrada: isoDe(new Date()), integracao: {} })} style={{ ...primaryBtnStyle, width: "auto", flex: "none", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={15} /> Colaborador
            </button>
          </>
        )}
      </div>

      {vista === "config" ? (
        <div style={{ ...panelStyle, display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: COLORS.ink2 }}>
            Funções (uma por linha)
            <textarea
              rows={6}
              defaultValue={d.funcoes.join("\n")}
              onBlur={(e) => guardarConfig({ funcoes: [...new Set(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))] })}
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          </label>
          <div style={{ fontSize: 12.5, color: COLORS.ink2 }}>
            Funções que dão treinos (têm de estar num horário dos Espaços, pela sigla):
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {d.funcoes.map((f) => {
                const on = d.funcoesEspacos.includes(f);
                return (
                  <button key={f} type="button" onClick={() => guardarConfig({ funcoesEspacos: on ? d.funcoesEspacos.filter((x) => x !== f) : [...d.funcoesEspacos, f] })} style={chipSGQ(on)}>
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, color: COLORS.ink2 }}>
            Avaliação do staff igual ou abaixo de
            <input type="number" min="1" max="5" step="0.1" defaultValue={d.notaMinima} onBlur={(e) => Number(e.target.value) > 0 && guardarConfig({ notaMinima: Number(e.target.value) })} style={{ ...inputStyle, width: 70, padding: "5px 8px" }} />
            (média de 1 a 5) impede o regresso quando a pessoa sai.
          </label>
        </div>
      ) : lista.length === 0 ? (
        <Vazio icon={UserX} titulo={vista === "ativos" ? "Sem colaboradores" : vista === "saidas" ? "Sem saídas" : "Ninguém impedido"} texto={vista === "ativos" ? "Acrescenta os colaboradores com o botão + Colaborador." : `As saídas ficam ${ANOS_GUARDAR} anos; as graves ficam para sempre em Impedidos.`} />
      ) : (
        <div style={{ ...panelStyle, padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Nome", "Sigla", "Função", "Escolas", vista === "ativos" ? "Entrada" : "Saída", "Estado", ""].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const nota = ultimaNota(c, avaliacoes);
                const baixa = nota !== null && nota <= d.notaMinima;
                const semH = (c.escolas || []).filter((e) => semHor.has(`${c.id}|${e}`));
                const est = estadoColaborador(c);
                return (
                  <tr key={c.id} onClick={() => setEditar(c)} style={{ cursor: "pointer" }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{c.nome}</td>
                    <td style={tdStyle}>{c.iniciais}</td>
                    <td style={tdStyle}>{c.funcao || "—"}</td>
                    <td style={{ ...tdStyle, fontSize: 12.5 }}>{(c.escolas || []).join(", ") || "—"}</td>
                    <td style={tdStyle}>{dataPT(vista === "ativos" ? c.entrada : c.saida)}</td>
                    <td style={tdStyle}>
                      {est === "impedido" && <Etiqueta cor={COLORS.danger} fundo={COLORS.dangerBg} titulo={c.motivoImpedido || c.motivoSaida}>impedido</Etiqueta>}
                      {est === "saiu" && <Etiqueta cor={COLORS.slate} fundo={COLORS.doneBg} titulo={c.motivoSaida}>saiu</Etiqueta>}
                      {est === "ativo" && porInt.has(c.id) && <Etiqueta cor={COLORS.warn} fundo={COLORS.warnBg}>por integrar</Etiqueta>}
                      {est === "ativo" && semH.length > 0 && <Etiqueta cor={COLORS.warn} fundo={COLORS.warnBg} titulo={`Sem horário nos Espaços: ${semH.join(", ")}`}>sem horário</Etiqueta>}
                      {baixa && <Etiqueta cor={COLORS.danger} fundo={COLORS.dangerBg} titulo="Última avaliação do staff">nota {f1(nota)}</Etiqueta>}
                      {est === "ativo" && !porInt.has(c.id) && !semH.length && !baixa && <Etiqueta cor={COLORS.ok} fundo={COLORS.okBg}>ativo</Etiqueta>}
                      {est !== "ativo" && c.motivoSaida && <div style={{ fontSize: 11.5, color: COLORS.slate, marginTop: 2 }}>{c.motivoImpedido || c.motivoSaida}</div>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      {est === "ativo" && (
                        <button onClick={() => setASair(c)} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                          Registar saída
                        </button>
                      )}
                      {est !== "ativo" && !c.reduzido && (
                        <button onClick={() => (!c.impedido || window.confirm(`${c.nome} está impedido de voltar (${c.motivoImpedido || c.motivoSaida || "motivo grave"}). Readmitir mesmo assim?`)) && guardarColab({ ...c, saida: undefined, motivoSaida: undefined, gravoso: undefined, impedido: undefined, motivoImpedido: undefined })} style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12 }}>
                          Voltou
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editar && <EditorColaborador inicial={editar} d={d} escolas={escolas} onGuardar={guardarColab} onApagar={apagar} onFechar={() => setEditar(null)} />}
      {aSair && <RegistarSaida c={aSair} avaliacoes={avaliacoes} minimo={d.notaMinima} onGuardar={guardarColab} onFechar={() => setASair(null)} />}
    </div>
  );
}
