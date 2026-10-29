import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { dbStorage, supabase } from "./supabaseClient";
import { STORAGE_APAGADOS_KEY, LISTAS_COM_LIXO, registosRemovidos, aceitaRemocao, rotuloApagado, limparAntigos, reporEm, DIAS_APAGADOS } from "./apagados";
import { LOGO_BRANCO, FOTO_ESTADIO, SIMBOLO_DF } from "./imagens";
import { detetarRiscos, idRecorrencia } from "./riscos";
import { Plus, X, Check, AlertTriangle, Clock, Search, Trash2, Pencil, ShieldAlert, LayoutGrid, BarChart3, Inbox, Play, ClipboardList, Scale, Mail, Sparkles, Users, MessageSquareText, FileText, Sun, Target, GraduationCap, RotateCcw, Star } from "lucide-react";
import { AnalysisDashboard, AreasConstatacoes, AssociarISO, AuditDetail, AuditForm, AuditsPage, AvaliacoesPage, BibliotecaRespostas, CANAL_META, COLORS, ComplaintDetail, ContactosEscolas, DEFAULT_CAUSAS_RAIZ, DEFAULT_ESPACOS, DEFAULT_MOTIVOS_DESISTENCIA, DEFAULT_NIVEIS, DEFAULT_REGRAS_ENVIO, DocumentosPage, EntryForm, EsqueletoPagina, FormacaoPage, HistoricoEmailsEscolas, ImportarAuditorias, InqueritosPage, InscritosPage, MOTIVOS_EXPERIENCIA_PADRAO, MOTIVO_META, ObjetivosPage, OcorrenciasPage, PainelEmailsEscolas, PreencherAreasCategorias, RelatorioEscolaPage, RiscosPage, SEVERITY_META, SanctionDetail, SanctionForm, SanctionsPage, Stamp, StatCard, Tag, Vazio, aplicarTema, balancoSemanal, capacidadeSugerida, classificarCrescimento, colorForLabel, contasEvento, dataAud, dataEnvioPlano, definirCausasAtuais, definirCurvaEpocaAnterior, epAntDe, epocaAud, epocaDaSemanaISO, epocaDe, fmt, iconBtnStyle, indicadoresDaEpoca, inputStyle, isoDe, linkBtnStyle, nomeCausa, nomeOcorrencia, normChave, panelStyle, panelTitle, precarregarPaginas, previsoesEscolas, primaryBtnStyle, satisfacaoDe, secondaryBtnStyle, segSGQ, semana1Padrao, semanaDaEpoca, semanaISO, semanaLabel, tokenize, turmasDoBloco } from "./nucleo.jsx";

// Toda a gravação passa por aqui: guarda a última versão de cada chave para perceber
// o que foi apagado (vai para "Apagados" durante 30 dias).
const ultimoGuardado = {};
let aoRemoverRegistos = null;
// Quem regista o que é apagado (definido pela app principal).
function definirAoRemoverRegistos(fn) {
  aoRemoverRegistos = fn;
}
const armazem = {
  async get(key) {
    const r = await dbStorage.get(key);
    if (r && r.value) {
      try {
        ultimoGuardado[key] = JSON.parse(r.value);
      } catch (e) {
        // valor ilegível: fica sem comparação
      }
    }
    return r;
  },
  async set(key, value) {
    const next = JSON.parse(value);
    if (LISTAS_COM_LIXO[key] && aoRemoverRegistos && ultimoGuardado[key] !== undefined) {
      try {
        const rem = registosRemovidos(ultimoGuardado[key], next);
        if (aceitaRemocao(rem)) aoRemoverRegistos(key, rem);
      } catch (e) {
        console.error("Erro ao registar apagados:", e);
      }
    }
    ultimoGuardado[key] = next;
    return dbStorage.set(key, value);
  },
};
const STORAGE_KEY = "reclamacoes:registo";
const STORAGE_OPTIONS_KEY = "reclamacoes:opcoes";
const STORAGE_AUDITS_KEY = "reclamacoes:auditorias";
const STORAGE_SANCOES_KEY = "reclamacoes:sancoes";
const STORAGE_TRIAGEM_KEY = "reclamacoes:triagem-aprendizagem";
const STORAGE_INSCRITOS_KEY = "reclamacoes:inscritos";
const STORAGE_TURMAS_KEY = "reclamacoes:turmas-alunos";
const STORAGE_EPOCA_ANT_KEY = "reclamacoes:epoca-anterior";
const STORAGE_DESISTENCIAS_KEY = "reclamacoes:desistencias";
const STORAGE_EXPERIENCIAS_KEY = "reclamacoes:experiencias";
const STORAGE_DESVINC_KEY = "reclamacoes:desvinculacoes";
const STORAGE_ESPACOS_KEY = "reclamacoes:espacos";
const STORAGE_EVENTOS_KEY = "reclamacoes:eventos";
const STORAGE_SATISFACAO_KEY = "reclamacoes:satisfacao";
const STORAGE_INQUERITOS_KEY = "reclamacoes:inqueritos-eventos";
const STORAGE_NOTAS_REL_KEY = "reclamacoes:relatorios-notas";
const STORAGE_PLANO_INQ_KEY = "reclamacoes:inqueritos-plano";
const STORAGE_RESPOSTAS_KEY = "reclamacoes:respostas-tipo";
const STORAGE_RISCOS_KEY = "reclamacoes:riscos";
const STORAGE_OCORRENCIAS_KEY = "reclamacoes:ocorrencias";
const STORAGE_AVALIACOES_KEY = "reclamacoes:avaliacoes";
const STORAGE_OBJETIVOS_KEY = "reclamacoes:objetivos";
const STORAGE_DOCUMENTOS_KEY = "reclamacoes:documentos";
const STORAGE_FORMACAO_KEY = "reclamacoes:formacao";
const STORAGE_RADAR_KEY = "reclamacoes:radar";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function deriveStatus(item) {
  if (item.status === "concluido") return "concluido";
  const today = startOfDay(new Date());
  const deadline = startOfDay(new Date(item.deadline));
  if (today > deadline) return "atrasado";
  return item.status === "em_andamento" ? "em_andamento" : "por_pegar";
}

// Categoria da reclamação passa a ser uma lista editável (options.complaintCategories),
// com estas como sugestão inicial — deixou de ser um enum fixo.
const DEFAULT_CATEGORIAS = ["Disciplinar", "Técnico", "Infraestrutura e Equipamentos"];

const DEFAULT_CATEGORIAS_SATISFACAO = [
  "Treinador / equipa técnica",
  "Comunicação com os encarregados",
  "Instalações",
  "Equipamento e material",
  "Horários e organização",
  "Secretaria / atendimento",
];

const DEFAULT_AREAS_AUDITORIA = ["Técnica", "Médica", "Instalações e Equipamentos", "Administrativa", "Escolar e Social"];
const DEFAULT_TURMAS = [
  ...DEFAULT_NIVEIS,
  "Sub-6", "Sub-7", "Sub-8", "Sub-9", "Sub-9B", "Sub-9 B - GR", "Sub-10", "Sub-11", "Sub-11A",
  "Sub-11 - GR", "Sub-12", "Sub-13", "Sub-14", "Sub-15", "Sub-15B", "Sub-16", "Sub-17", "Sub-19",
  "Equipa Competição",
];

const DEFAULT_TIPOS_SANCAO = [
  "Suspensão da pessoa",
  "Treinos à porta fechada",
  "Expulsão",
  "Advertência escrita",
];

// Chamado sempre que uma reclamação é guardada — reforça as associações
// entre as palavras do texto e a classificação escolhida (final, já corrigida
// pelo utilizador se necessário). É assim que a triagem "aprende" ao longo do tempo.
function learnFromEntry(learned, entry) {
  const text = `${entry.description || ""} ${entry.context || ""}`;
  const words = tokenize(text);
  if (words.length === 0) return learned;
  const next = {
    canal: { ...(learned.canal || {}) },
    categoria: { ...(learned.categoria || {}) },
    tema: { ...(learned.tema || {}) },
    gravidade: { ...(learned.gravidade || {}) },
  };
  const bump = (field, value) => {
    if (!value) return;
    words.forEach((w) => {
      next[field][w] = { ...(next[field][w] || {}) };
      next[field][w][value] = (next[field][w][value] || 0) + 1;
    });
  };
  bump("canal", entry.canal);
  bump("categoria", entry.categoria);
  bump("tema", entry.tema);
  bump("gravidade", entry.severity);
  return next;
}

// ---------- Notificações flutuantes ----------
function Notificacoes({ lista, onFechar }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        gap: 9,
        maxWidth: "min(380px, calc(100vw - 40px))",
      }}
    >
      {lista.map((n) => {
        const cor = n.tipo === "erro" ? COLORS.danger : n.tipo === "aviso" ? COLORS.warn : COLORS.ok;
        const fundo = n.tipo === "erro" ? COLORS.dangerBg : n.tipo === "aviso" ? COLORS.warnBg : COLORS.okBg;
        const Icone = n.tipo === "erro" ? AlertTriangle : n.tipo === "aviso" ? AlertTriangle : Check;
        return (
          <div
            key={n.id}
            className="toastIn"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: COLORS.paperRaised,
              border: `1px solid ${COLORS.rule}`,
              borderRadius: 12,
              padding: "11px 13px",
              boxShadow: COLORS.lift,
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 7, background: fundo, display: "grid", placeItems: "center", flex: "none", marginTop: 1 }}>
              <Icone size={13} color={cor} />
            </div>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>{n.texto}</div>
            {n.acao && (
              <button
                onClick={() => {
                  n.acao.fn();
                  onFechar(n.id);
                }}
                style={{ ...linkBtnStyle, marginTop: 0, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}
              >
                {n.acao.rotulo}
              </button>
            )}
            <button onClick={() => onFechar(n.id)} style={{ ...iconBtnStyle, padding: 0, marginTop: 2 }} aria-label="Fechar">
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Gestor de uma lista ----------
// Abre a partir de cada "Gerir lista", mostrando apenas a lista daquele campo.
// Evita o menu único gigante com todas as listas da app lá dentro.
function GestorLista({ titulo, nota, itens, placeholder, emUso, onAdd, onRemove, onClose }) {
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState("");
  const lista = itens || [];

  const adicionar = () => {
    const v = novo.trim();
    if (!v) {
      setErro("Escreve o nome antes de adicionar.");
      return;
    }
    if (lista.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setErro("Esse item já existe na lista.");
      return;
    }
    setErro("");
    onAdd(v);
    setNovo("");
  };

  const remover = (x) => {
    const usos = emUso ? emUso(x) : 0;
    if (usos > 0) {
      setErro(`"${x}" está a ser usado em ${usos} registo(s) e não pode ser removido.`);
      return;
    }
    setErro("");
    onRemove(x);
  };

  return (
    <div
      className="veil"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,14,24,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 70,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="sheet"
        style={{
          width: "min(460px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          background: COLORS.paperRaised,
          border: `1px solid ${COLORS.rule}`,
          borderRadius: 14,
          padding: "20px 22px 22px",
          boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em" }}>{titulo}</div>
          <button onClick={onClose} style={{ ...iconBtnStyle, padding: 0 }} aria-label="Fechar">
            <X size={17} />
          </button>
        </div>
        {nota && <div style={{ fontSize: 12.5, color: COLORS.ink2, lineHeight: 1.5, marginBottom: 16 }}>{nota}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            type="text"
            autoFocus
            placeholder={placeholder || "Novo item"}
            value={novo}
            onChange={(e) => {
              setNovo(e.target.value);
              setErro("");
            }}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
            style={inputStyle}
          />
          <button className="press" onClick={adicionar} style={{ ...primaryBtnStyle, flex: "none", padding: "9px 15px" }}>
            Adicionar
          </button>
        </div>

        {lista.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.slate, padding: "14px 0" }}>Lista vazia. Acrescenta o primeiro item acima.</div>
        ) : (
          <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden" }}>
            {lista.map((x, i) => (
              <div
                key={x}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none",
                  fontSize: 13.5,
                }}
              >
                <span style={{ flex: 1 }}>{x}</span>
                {emUso && emUso(x) > 0 && (
                  <span style={{ fontSize: 11, color: COLORS.slate }}>{emUso(x)} em uso</span>
                )}
                <button onClick={() => remover(x)} style={{ ...iconBtnStyle, padding: 0 }} title="Remover">
                  <Trash2 size={14} color={COLORS.danger} />
                </button>
              </div>
            ))}
          </div>
        )}

        {erro && <div style={{ color: COLORS.danger, fontSize: 13, marginTop: 12 }}>{erro}</div>}
      </div>
    </div>
  );
}

// ======================================================================
// ---------- Registo de alunos por ID (inscritos da época) ----------
// ======================================================================
// Cada importação traz a lista de alunos da época com o código do atleta.
// Guardamos, por aluno: código, escola, turma, ano de nascimento, género,
// rubrica (renovação/inscrição), data de entrada e, se desistiu, a data e o
// motivo. Nada mais (sem nomes nem datas de nascimento completas). Com o
// código, cada importação nova sabe quem entrou, quem saiu e que experiências
// passaram a inscrição.

const STORAGE_ALUNOS_KEY = "reclamacoes:alunos";

// ---------- Paleta de comandos (⌘K) ----------
// Salta entre secções e procura reclamações sem tocar no rato.
// ======================================================================
// ---------- Inquéritos de satisfação de eventos ----------
// ======================================================================
// Importa a exportação do Google Forms / Microsoft Forms (CSV ou Excel) e
// guarda apenas contagens por pergunta. As respostas individuais, nomes,
// emails e carimbos de hora nunca são gravados.

const DEFAULT_TIPOS_EVENTO = ["Super Treinos", "Little Dragons", "Foot-Camps", "Super Camps", "Torneio das Lendas", "Taça dos Campeões"];

const DEFAULT_DIMENSOES_INQ = [
  "Satisfação global",
  "Organização",
  "Treinadores e staff",
  "Atividades",
  "Instalações",
  "Comunicação",
  "Alimentação",
  "Equipamento e ofertas",
  "Preço",
  "Outros",
];
const DEFAULT_TIPOLOGIAS_INQ = ["Evento 1 dia", "Camp"];

// Banco de Respostas Institucionais por E-mail (Anexo ao Manual de Atendimento).
// Os campos "[a preencher]" vêm dos espaços em branco do modelo original.
const RESPOSTAS_ANEXO = [
  {
    "id": "a1",
    "situacao": "O meu filho joga pouco",
    "assunto": "Esclarecimento sobre a participação desportiva do atleta",
    "texto": "Antes de mais, agradecemos o seu contacto e a confiança que deposita na Dragon Force e na equipa técnica que acompanha o seu educando.\n\nCompreendemos a preocupação manifestada relativamente ao tempo de utilização do seu filho nas competições, sendo natural que todos os encarregados de educação desejem vê-los participar o maior número de minutos possível.\n\nGostaríamos, contudo, de esclarecer que as decisões relativas à constituição das equipas, convocatórias, tempo de jogo, posições ocupadas em campo e restantes opções técnicas são da exclusiva responsabilidade da equipa técnica, sendo tomadas com base em diversos fatores, designadamente o processo de desenvolvimento do atleta, o seu empenho, assiduidade, evolução técnica, necessidades pedagógicas e objetivos definidos para cada momento da época.\n\nA Dragon Force privilegia uma formação sustentada e equilibrada, procurando que cada atleta evolua ao seu ritmo, num ambiente de aprendizagem, responsabilidade e respeito.\n\nEstamos certos de que o seu educando continuará a beneficiar do trabalho desenvolvido pelos nossos treinadores e que a sua evolução será acompanhada de forma permanente.\n\nPermanecemos naturalmente disponíveis para qualquer esclarecimento adicional relacionado com o seu percurso formativo.",
    "capitulo": "Desportivo",
    "palavras": [
      "joga pouco",
      "tempo de jogo",
      "minutos",
      "nao joga",
      "pouco tempo",
      "entra pouco"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 1
  },
  {
    "id": "a2",
    "situacao": "O meu filho foi enquadrado na equipa B",
    "assunto": "Esclarecimento sobre o enquadramento desportivo do atleta",
    "texto": "A constituição das equipas é definida pela Coordenação Técnica da Dragon Force, com base em critérios técnicos, pedagógicos e organizacionais. Este processo tem sempre como principais objetivos o desenvolvimento individual de cada atleta e o equilíbrio dos respetivos grupos.\n\nA integração numa equipa A ou B não deve ser entendida como uma avaliação definitiva, nem como uma desvalorização do atleta. Trata-se do enquadramento que a Coordenação Técnica considera mais adequado neste momento, tendo em conta o seu perfil, evolução, necessidades formativas e o contexto competitivo.\n\nImporta ainda esclarecer que estas decisões não são permanentes e podem ser revistas ao longo da época, sempre que a Coordenação Técnica identifique benefícios para o desenvolvimento do atleta.\n\nContinuaremos, naturalmente, a acompanhar de perto a sua evolução, adaptação e bem-estar, mantendo- nos disponíveis para qualquer esclarecimento adicional.",
    "capitulo": "Desportivo",
    "palavras": [
      "equipa b",
      "equipa a",
      "enquadrado",
      "enquadramento",
      "segunda equipa",
      "descido"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 2
  },
  {
    "id": "a3",
    "situacao": "O treinador não gosta do meu filho",
    "assunto": "Esclarecimento relativamente à situação comunicada",
    "texto": "Agradecemos a mensagem que nos dirigiu.\n\nCompreendemos a preocupação demonstrada relativamente ao acompanhamento do seu educando.\n\nA Dragon Force pauta toda a sua atuação pelos princípios da igualdade de tratamento, imparcialidade, respeito e promoção do desenvolvimento individual de cada atleta.\n\nOs treinadores são orientados para fundamentar todas as decisões em critérios exclusivamente técnicos, pedagógicos e comportamentais, não sendo admissíveis decisões baseadas em preferências pessoais.\n\nCaso considere existirem factos concretos que justifiquem uma análise mais aprofundada, teremos todo o gosto em recolher a informação necessária junto dos intervenientes, garantindo uma apreciação objetiva e imparcial da situação.\n\nA nossa prioridade será sempre assegurar o bem-estar do atleta e a qualidade do processo formativo.\n\nContinuaremos inteiramente disponíveis para prestar qualquer esclarecimento que considere necessário.",
    "capitulo": "Desportivo",
    "palavras": [
      "nao gosta",
      "perseguido",
      "implica",
      "antipatia",
      "trata diferente"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 3
  },
  {
    "id": "a4",
    "situacao": "Não concordo com a convocatória",
    "assunto": "Convocatória para competição",
    "texto": "Agradecemos o seu contacto.\n\nRelativamente à situação apresentada, importa esclarecer que as convocatórias para jogos e torneios constituem uma competência exclusiva da equipa técnica.\n\nNa definição das convocatórias são considerados diversos fatores, nomeadamente a gestão do processo de formação, os objetivos pedagógicos, a evolução individual dos atletas, a assiduidade, o empenho demonstrado, o equilíbrio da equipa e as necessidades específicas de cada competição.\n\nEstas decisões inserem-se na autonomia técnica atribuída aos treinadores, pelo que não são objeto de reapreciação administrativa.\n\nAgradecemos a compreensão e reiteramos o compromisso da Dragon Force em proporcionar um ambiente de aprendizagem justo, equilibrado e orientado para o desenvolvimento de todos os atletas.",
    "capitulo": "Desportivo",
    "palavras": [
      "convocatoria",
      "nao concordo com a convocatoria",
      "lista de convocados"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 4
  },
  {
    "id": "a5",
    "situacao": "O treinador gritou com o meu filho",
    "assunto": "Situação reportada em contexto de treino",
    "texto": "Agradecemos a confiança demonstrada ao comunicar a situação ocorrida.\n\nA Dragon Force considera que o respeito pela dignidade dos atletas constitui um princípio fundamental da sua missão educativa.\n\nTodos os treinadores são incentivados a manter uma comunicação exigente, mas sempre respeitadora, pedagógica e adequada à idade dos alunos.\n\nPerante a situação descrita, iremos proceder à respetiva análise, ouvindo os intervenientes e recolhendo toda a informação necessária, de forma a compreender o contexto em que ocorreu.\n\nCaso sejam identificadas oportunidades de melhoria ou a necessidade de adoção de medidas internas, as mesmas serão implementadas de acordo com os procedimentos da instituição.\n\nAgradecemos novamente o seu contacto e reiteramos a nossa total disponibilidade.",
    "capitulo": "Desportivo",
    "palavras": [
      "gritou",
      "grita",
      "berrou",
      "humilhou",
      "falou mal",
      "tom de voz",
      "agressivo"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 5
  },
  {
    "id": "a6",
    "situacao": "Pedido de reunião porque o atleta joga pouco",
    "assunto": "Pedido de reunião",
    "texto": "Agradecemos o seu contacto.\n\nRelativamente ao pedido de reunião apresentado, informamos que as decisões relativas ao tempo de jogo, convocatórias, posições em campo e restantes opções técnicas são da responsabilidade da equipa técnica, integrando o processo pedagógico e formativo desenvolvido pela Dragon Force.\n\nPor esse motivo, estas matérias não são, por norma, objeto de reunião para reapreciação de decisões técnicas.\n\nCaso existam outras situações relacionadas com o bem-estar, integração, comportamento ou desenvolvimento global do atleta, teremos todo o gosto em analisar a situação consigo e, se necessário, agendar uma reunião com o responsável competente.\n\nAgradecemos a compreensão e permanecemos ao dispor.",
    "capitulo": "Desportivo",
    "palavras": [
      "reuniao",
      "falar com o treinador",
      "marcar reuniao",
      "joga pouco"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 6
  },
  {
    "id": "a7",
    "situacao": "Não existem vagas",
    "assunto": "Pedido de inscrição",
    "texto": "Agradecemos o interesse demonstrado na Dragon Force e a confiança que deposita no nosso projeto de formação desportiva.\n\nInformamos que, de momento, o escalão pretendido atingiu o limite de vagas definido para garantir a qualidade do acompanhamento técnico e pedagógico dos atletas.\n\nSempre que exista disponibilidade futura, ou caso seja criada uma vaga, entraremos em contacto pela ordem da lista de espera.\n\nAgradecemos a compreensão e esperamos poder receber o seu educando numa próxima oportunidade.",
    "capitulo": "Inscrições",
    "palavras": [
      "vaga",
      "vagas",
      "lista de espera",
      "turma cheia",
      "nao ha lugar",
      "inscricao"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 7
  },
  {
    "id": "a8",
    "situacao": "Documentação incompleta",
    "assunto": "Documentação em falta",
    "texto": "No seguimento do processo de inscrição do seu educando, verificámos que ainda se encontra em falta alguma documentação necessária para concluir o processo administrativo.\n\nSolicitamos, sempre que possível, o envio ou entrega dos seguintes documentos:\n\n• [a preencher]\n\n• [a preencher]\n\nAssim que a documentação estiver completa, procederemos à validação definitiva da inscrição.\n\nPermanecemos inteiramente disponíveis para qualquer esclarecimento.",
    "capitulo": "Inscrições",
    "palavras": [
      "documentacao",
      "documentos",
      "documento em falta",
      "atestado",
      "cartao de cidadao",
      "ficha"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 8
  },
  {
    "id": "a9",
    "situacao": "Pedido de período experimental",
    "assunto": "Pedido de treino experimental",
    "texto": "Agradecemos o interesse demonstrado pela Dragon Force.\n\nSempre que existam condições organizativas e técnicas, poderá ser autorizado um período experimental, permitindo ao atleta conhecer a metodologia de treino e integrar temporariamente a equipa.\n\nA data será comunicada oportunamente pela Secretaria em articulação com a Coordenação Técnica.\n\nFicamos ao dispor para qualquer esclarecimento adicional.",
    "capitulo": "Inscrições",
    "palavras": [
      "experimental",
      "treino experimental",
      "experimentar",
      "aula experimental",
      "treino de experiencia"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 9
  },
  {
    "id": "a10",
    "situacao": "Mensalidade em atraso",
    "assunto": "Regularização de mensalidade",
    "texto": "Esperamos que se encontre bem.\n\nVerificámos que, até à presente data, continua pendente a regularização da mensalidade referente ao mês de [a preencher].\n\nCaso o pagamento já tenha sido efetuado, agradecemos que desconsidere esta comunicação.\n\nCaso contrário, solicitamos a sua regularização logo que possível, evitando eventuais constrangimentos administrativos.\n\nSe existir alguma dificuldade temporária, agradecemos que entre em contacto connosco para podermos analisar a situação.\n\nAgradecemos a colaboração.",
    "capitulo": "Pagamentos",
    "palavras": [
      "mensalidade em atraso",
      "em atraso",
      "divida",
      "pagamento em falta",
      "regularizar"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 10
  },
  {
    "id": "a11",
    "situacao": "Pedido de pagamento em prestações",
    "assunto": "Pedido de plano de pagamento",
    "texto": "Agradecemos o seu contacto.\n\nCompreendemos a situação exposta e informamos que o seu pedido será analisado pela Direção, tendo em consideração as normas internas da Dragon Force e as circunstâncias apresentadas.\n\nAssim que a análise estiver concluída, entraremos novamente em contacto.\n\nAgradecemos a confiança.",
    "capitulo": "Pagamentos",
    "palavras": ["prestacoes", "plano de pagamento", "pagar em partes", "fasear", "faseado", "em tres vezes", "em duas vezes", "em vezes", "dificuldades financeiras", "dificuldades economicas"],
    "temas": [],
    "origem": "anexo",
    "modelo": 11
  },
  {
    "id": "a12",
    "situacao": "Pedido de isenção de mensalidade",
    "assunto": "Pedido de isenção",
    "texto": "Agradecemos a mensagem enviada.\n\nTodos os pedidos relacionados com reduções ou isenções de pagamentos são analisados individualmente, tendo em consideração os critérios definidos pela Direção da Dragon Force.\n\nO seu pedido será apreciado e posteriormente comunicaremos a decisão.\n\nAgradecemos a compreensão.",
    "capitulo": "Pagamentos",
    "palavras": [
      "isencao",
      "isento",
      "nao pagar",
      "dispensa de pagamento",
      "desconto"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 12
  },
  {
    "id": "a13",
    "situacao": "Pedido de devolução de valores pagos",
    "assunto": "Pedido de reembolso",
    "texto": "Acusamos a receção do seu pedido.\n\nO mesmo será analisado de acordo com o Regulamento da Dragon Force e com as condições aplicáveis ao serviço em causa.\n\nApós conclusão da análise, comunicaremos a decisão fundamentada.\n\nPermanecemos ao dispor.",
    "capitulo": "Pagamentos",
    "palavras": [
      "devolucao",
      "reembolso",
      "devolver",
      "valores pagos",
      "restituicao"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 13
  },
  {
    "id": "a14",
    "situacao": "Equipamento ainda não chegou",
    "assunto": "Estado da encomenda do equipamento",
    "texto": "Agradecemos o seu contacto.\n\nInformamos que a encomenda do equipamento do seu educando se encontra em processamento.\n\nAssim que o material for rececionado nas nossas instalações, entraremos imediatamente em contacto para proceder à respetiva entrega.\n\nPedimos desculpa por qualquer demora que possa ocorrer e agradecemos a compreensão.",
    "capitulo": "Equipamentos",
    "palavras": [
      "equipamento nao chegou",
      "encomenda",
      "ainda nao recebeu",
      "kit",
      "atraso na entrega",
      "equipamento de jogo"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 14
  },
  {
    "id": "a15",
    "situacao": "Pedido de troca de tamanho",
    "assunto": "Troca de equipamento",
    "texto": "Agradecemos o seu contacto.\n\nIremos verificar a disponibilidade do tamanho solicitado e as condições previstas para a respetiva substituição.\n\nAssim que tivermos essa confirmação, entraremos novamente em contacto.",
    "capitulo": "Equipamentos",
    "palavras": [
      "troca",
      "tamanho",
      "trocar",
      "tamanho errado",
      "nao serve"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 15
  },
  {
    "id": "a16",
    "situacao": "Equipamento danificado",
    "assunto": "Equipamento",
    "texto": "Lamentamos a situação comunicada.\n\nSolicitamos, sempre que possível, o envio de fotografias do equipamento ou a sua apresentação na Secretaria para que possamos avaliar a situação e verificar a melhor solução.\n\nAssim que a análise estiver concluída, entraremos em contacto.",
    "capitulo": "Equipamentos",
    "palavras": ["danificad", "rasgad", "defeito", "estragad", "descos", "furad", "partid"],
    "temas": [],
    "origem": "anexo",
    "modelo": 16
  },
  {
    "id": "a17",
    "situacao": "Cancelamento de treino",
    "assunto": "Cancelamento de treino",
    "texto": "Informamos que, por motivos de [a preencher], o treino previsto para o dia [a preencher] não poderá realizar-se.\n\nLamentamos qualquer inconveniente que esta alteração possa causar e agradecemos a compreensão.\n\nQualquer informação adicional será comunicada através dos canais oficiais da Dragon Force.",
    "capitulo": "Treinos",
    "palavras": [
      "cancelamento",
      "treino cancelado",
      "cancelaram",
      "nao houve treino",
      "chuva"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 17
  },
  {
    "id": "a18",
    "situacao": "Alteração de horário",
    "assunto": "Alteração de horário de treino",
    "texto": "Informamos que, por razões organizativas, o horário do treino do escalão [a preencher] será alterado a partir de [a preencher].\n\nNovo horário:\n\nAgradecemos a compreensão e permanecemos disponíveis para qualquer esclarecimento.",
    "capitulo": "Treinos",
    "palavras": [
      "alteracao de horario",
      "mudanca de horario",
      "horario",
      "mudaram o horario",
      "sem aviso"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 18
  },
  {
    "id": "a19",
    "situacao": "Faltas frequentes",
    "assunto": "Assiduidade aos treinos",
    "texto": "Esperamos que se encontre bem.\n\nVerificámos que o seu educando tem registado algumas ausências aos treinos.\n\nA assiduidade constitui um fator importante para o processo de aprendizagem, integração no grupo e evolução desportiva.\n\nCaso exista algum motivo que esteja a dificultar a participação, estaremos inteiramente disponíveis para o analisar consigo.\n\nAgradecemos a colaboração.",
    "capitulo": "Treinos",
    "palavras": [
      "faltas",
      "falta muito",
      "assiduidade",
      "faltas frequentes",
      "nao aparece"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 19
  },
  {
    "id": "a20",
    "situacao": "O meu filho não foi convocado",
    "assunto": "Esclarecimento sobre convocatória",
    "texto": "Agradecemos o seu contacto e a confiança demonstrada ao partilhar a sua preocupação.\n\nCompreendemos que a não convocatória do seu educando possa gerar alguma desilusão, quer para o atleta, quer para a família.\n\nGostaríamos de esclarecer que as convocatórias são definidas pela equipa técnica, tendo em consideração diversos fatores relacionados com o processo de formação, nomeadamente a assiduidade, empenho, evolução, gestão do grupo, objetivos pedagógicos e características da competição.\n\nEstas decisões inserem-se na autonomia técnica dos treinadores e pretendem contribuir para o desenvolvimento global de todos os atletas.\n\nEstamos certos de que o seu educando continuará a trabalhar com dedicação e que surgirão novas oportunidades de participação.\n\nAgradecemos a compreensão e permanecemos disponíveis para qualquer esclarecimento adicional.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "nao foi convocado",
      "nao convocou",
      "ficou de fora",
      "nao foi chamado"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 20
  },
  {
    "id": "a21",
    "situacao": "O meu filho foi suplente",
    "assunto": "Participação do atleta em competição",
    "texto": "Agradecemos o seu contacto.\n\nCompreendemos a preocupação manifestada relativamente à utilização do seu educando.\n\nA definição dos atletas que iniciam cada jogo resulta de uma avaliação técnica efetuada pelo treinador, considerando o momento de desenvolvimento dos atletas, os objetivos pedagógicos e as necessidades específicas da equipa.\n\nAo longo da época, todos os atletas são acompanhados de forma individualizada, procurando proporcionar experiências diversificadas que contribuam para a sua evolução.\n\nAgradecemos a confiança na metodologia de formação da Dragon Force.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "suplente",
      "banco",
      "titular",
      "nao foi titular",
      "onze inicial"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 21
  },
  {
    "id": "a22",
    "situacao": "O treinador mudou o meu filho de posição",
    "assunto": "Esclarecimento sobre posição em campo",
    "texto": "Agradecemos a sua mensagem.\n\nDurante a formação desportiva é frequente que os atletas sejam utilizados em diferentes posições, permitindo-lhes desenvolver competências técnicas, táticas e cognitivas mais abrangentes.\n\nEstas decisões fazem parte da metodologia de formação da Dragon Force e são tomadas pela equipa técnica em função das características e necessidades de desenvolvimento de cada atleta.\n\nAgradecemos a compreensão e a confiança depositada na nossa equipa técnica.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "posicao",
      "mudou de posicao",
      "defesa",
      "avancado",
      "lateral",
      "guarda-redes"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 22
  },
  {
    "id": "a23",
    "situacao": "O treinador favorece determinados atletas",
    "assunto": "Situação comunicada",
    "texto": "Agradecemos o contacto efetuado.\n\nA Dragon Force rege-se por princípios de igualdade, respeito e imparcialidade.\n\nAs decisões técnicas são tomadas procurando assegurar o desenvolvimento equilibrado dos atletas e não assentam em critérios de natureza pessoal.\n\nA situação comunicada será analisada internamente junto da equipa técnica, garantindo uma apreciação objetiva e imparcial.\n\nAgradecemos a confiança demonstrada ao partilhar esta preocupação.",
    "capitulo": "Jogos e competição",
    "palavras": ["favorece", "favoritos", "preferidos", "privilegia", "so joga quem", "so poe a jogar", "filhos dos amigos", "sempre os mesmos", "cunha"],
    "temas": [],
    "origem": "anexo",
    "modelo": 23
  },
  {
    "id": "a24",
    "situacao": "O treinador não cumprimentou os pais",
    "assunto": "Atendimento da equipa técnica",
    "texto": "Agradecemos a sua mensagem.\n\nA Dragon Force incentiva todos os colaboradores a manterem uma relação cordial e respeitadora com os Encarregados de Educação.\n\nIremos transmitir a observação efetuada à equipa técnica, reforçando a importância da comunicação e do relacionamento institucional com as famílias.\n\nAgradecemos o contributo para a melhoria contínua dos nossos serviços.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "nao cumprimentou",
      "cumprimentar",
      "antipatico",
      "mal-educado",
      "nao fala com os pais"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 24
  },
  {
    "id": "a25",
    "situacao": "O treinador não respondeu ao cumprimento",
    "assunto": "Comunicação com a equipa técnica",
    "texto": "Agradecemos a informação transmitida.\n\nÉ possível que, no momento referido, o treinador estivesse concentrado na preparação ou acompanhamento da atividade desportiva.\n\nAinda assim, reforçaremos junto da equipa técnica a importância de manter uma comunicação cordial e próxima com todas as famílias.\n\nObrigado pelo seu contributo.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "nao respondeu ao cumprimento",
      "ignorou",
      "cumprimento",
      "bom dia"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 25
  },
  {
    "id": "a26",
    "situacao": "Não concordo com as substituições",
    "assunto": "Esclarecimento sobre decisões técnicas",
    "texto": "Agradecemos o seu contacto.\n\nAs substituições efetuadas durante uma competição constituem decisões técnicas tomadas em função do desenvolvimento do jogo, dos objetivos pedagógicos definidos e das necessidades da equipa.\n\nA Dragon Force respeita a autonomia dos seus treinadores na gestão destes momentos competitivos.\n\nAgradecemos a compreensão.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "substituicoes",
      "substituiu",
      "tirou do jogo",
      "substituicao",
      "mudancas no jogo"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 26
  },
  {
    "id": "a27",
    "situacao": "O árbitro prejudicou a equipa",
    "assunto": "Situação ocorrida durante o jogo",
    "texto": "Compreendemos a frustração que determinadas decisões de arbitragem possam gerar.\n\nContudo, a Dragon Force promove uma cultura de respeito por todos os agentes desportivos, incluindo árbitros, adversários e dirigentes.\n\nProcuramos transmitir aos nossos atletas que o respeito pelas decisões de arbitragem constitui um valor essencial da prática desportiva.\n\nAgradecemos a compreensão.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "arbitro",
      "arbitragem",
      "prejudicou",
      "penalti mal marcado",
      "roubados"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 27
  },
  {
    "id": "a28",
    "situacao": "O treinador discutiu com o árbitro",
    "assunto": "Situação reportada",
    "texto": "Agradecemos o seu contacto.\n\nTodas as situações relacionadas com o comportamento dos nossos colaboradores são analisadas internamente.\n\nCaso se confirme qualquer comportamento desconforme com os princípios da Dragon Force, serão adotadas as medidas consideradas adequadas.\n\nObrigado por nos transmitir a situação.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "discutiu com o arbitro",
      "treinador discutiu",
      "expulso",
      "protestou"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 28
  },
  {
    "id": "a29",
    "situacao": "Não gostei da atitude dos pais da outra equipa",
    "assunto": "Comportamento do público",
    "texto": "Lamentamos a situação descrita.\n\nA Dragon Force promove um ambiente de respeito entre todos os intervenientes na atividade desportiva.\n\nSempre que ocorram comportamentos inadequados, procuramos comunicar os factos à organização da competição e às entidades competentes, quando tal se justifique.\n\nAgradecemos a informação prestada.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "pais da outra equipa",
      "adversario",
      "bancada",
      "atitude dos pais",
      "insultaram",
      "publico"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 29
  },
  {
    "id": "a30",
    "situacao": "O jogo terminou muito tarde",
    "assunto": "Horário da competição",
    "texto": "Agradecemos o seu contacto.\n\nOs horários das competições são definidos pelas entidades organizadoras, podendo sofrer alterações por motivos alheios à Dragon Force.\n\nSempre que possível, procuramos comunicar antecipadamente qualquer alteração e minimizar os inconvenientes causados às famílias.\n\nAgradecemos a compreensão.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "terminou tarde",
      "muito tarde",
      "horario do jogo",
      "acabou tarde",
      "hora do jogo"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 30
  },
  {
    "id": "a31",
    "situacao": "O meu filho não teve oportunidade de marcar um penálti",
    "assunto": "Decisões durante a competição",
    "texto": "Agradecemos a sua mensagem.\n\nAs decisões tomadas durante o decorrer de um jogo, incluindo a escolha dos atletas para executar bolas paradas ou grandes penalidades, inserem-se na gestão técnica da equipa e são da responsabilidade do treinador.\n\nEstas opções são efetuadas em função do contexto competitivo e dos objetivos definidos para cada momento.\n\nAgradecemos a compreensão e a confiança no trabalho desenvolvido pela nossa equipa técnica.",
    "capitulo": "Jogos e competição",
    "palavras": [
      "penalti",
      "penalty",
      "marcar",
      "grande penalidade",
      "nao deixaram marcar"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 31
  },
  {
    "id": "a32",
    "situacao": "Vou escrever nas redes sociais",
    "assunto": "Acompanhamento da situação comunicada",
    "texto": "Agradecemos o seu contacto e lamentamos que a situação vivida tenha motivado a sua insatisfação.\n\nA Dragon Force respeita plenamente o direito de todos os Encarregados de Educação expressarem a sua opinião.\n\nNo entanto, acreditamos que as situações são mais eficazmente resolvidas através do diálogo direto e dos canais institucionais, permitindo uma análise rigorosa dos factos e a identificação de soluções adequadas.\n\nPermanecemos inteiramente disponíveis para esclarecer qualquer questão ou analisar consigo a situação apresentada.\n\nO nosso objetivo é sempre encontrar soluções construtivas que contribuam para o bem-estar dos atletas e para uma relação de confiança com as famílias.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "redes sociais",
      "facebook",
      "instagram",
      "publicacao",
      "expor",
      "publicar"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 32
  },
  {
    "id": "a33",
    "situacao": "Vou apresentar uma queixa na Federação",
    "assunto": "Situação comunicada",
    "texto": "Agradecemos a sua mensagem.\n\nNaturalmente, qualquer cidadão pode recorrer às entidades que considere competentes.\n\nDa nossa parte, reiteramos a total disponibilidade para prestar todos os esclarecimentos que sejam necessários, colaborando de forma transparente e responsável com qualquer entidade que venha a solicitar informação.\n\nEntretanto, mantemo-nos igualmente disponíveis para analisar diretamente consigo a situação apresentada, procurando um esclarecimento adequado.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "federacao",
      "fpf",
      "associacao de futebol",
      "queixa na federacao"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 33
  },
  {
    "id": "a34",
    "situacao": "Vou apresentar uma reclamação no Livro de Reclamações",
    "assunto": "Reclamação apresentada",
    "texto": "A Dragon Force respeita plenamente o direito dos utentes à apresentação de reclamações através dos mecanismos legalmente previstos.\n\nParalelamente, gostaríamos de manifestar a nossa total disponibilidade para analisar a situação diretamente consigo, procurando esclarecer os factos e, sempre que possível, encontrar uma solução adequada.\n\nTodas as reclamações são objeto de análise cuidada e constituem uma oportunidade para melhorar continuamente os nossos serviços.\n\nAgradecemos o seu contacto.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "livro de reclamacoes",
      "livro amarelo",
      "reclamacao formal",
      "livro"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 34
  },
  {
    "id": "a35",
    "situacao": "Vou processar a Dragon Force",
    "assunto": "Situação comunicada",
    "texto": "Agradecemos a sua comunicação.\n\nA Dragon Force pauta toda a sua atuação pelo cumprimento da legislação aplicável, dos seus regulamentos internos e dos princípios de transparência e boa-fé.\n\nRespeitamos naturalmente todas as decisões que entenda tomar relativamente aos mecanismos legais disponíveis.\n\nContinuamos, contudo, totalmente disponíveis para prestar os esclarecimentos necessários e analisar consigo a situação apresentada, procurando uma solução através do diálogo institucional.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "processar",
      "tribunal",
      "advogado",
      "acao judicial",
      "processo"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 35
  },
  {
    "id": "a36",
    "situacao": "Vou chamar a Polícia",
    "assunto": "Situação reportada",
    "texto": "Lamentamos que a situação descrita tenha originado essa preocupação.\n\nSempre que ocorram factos suscetíveis de intervenção das autoridades competentes, a Dragon Force colaborará integralmente com as mesmas, disponibilizando toda a informação necessária ao respetivo esclarecimento.\n\nMantemo-nos igualmente disponíveis para analisar a situação internamente e prestar todos os esclarecimentos que considere necessários.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "policia",
      "psp",
      "gnr",
      "autoridades",
      "chamar a policia"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 36
  },
  {
    "id": "a37",
    "situacao": "Vou retirar o meu filho",
    "assunto": "Pedido de cancelamento da inscrição",
    "texto": "Recebemos com pesar a informação relativa à intenção de retirar o seu educando da Dragon Force.\n\nAntes de qualquer decisão definitiva, gostaríamos de manifestar a nossa disponibilidade para analisar consigo as razões que motivam essa intenção, procurando esclarecer eventuais dúvidas ou encontrar soluções que possam corresponder às suas expectativas.\n\nCaso mantenha a decisão, a Secretaria prestará todo o apoio necessário ao cumprimento dos procedimentos administrativos aplicáveis.\n\nAgradecemos a confiança que depositou na Dragon Force durante o período em que integrou o nosso projeto.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "retirar o meu filho",
      "tirar o filho",
      "desistir",
      "sair da dragon force",
      "cancelar a inscricao",
      "anular"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 37
  },
  {
    "id": "a38",
    "situacao": "O treinador é incompetente",
    "assunto": "Situação comunicada",
    "texto": "Agradecemos a sua mensagem.\n\nA Dragon Force valoriza o trabalho desenvolvido pelos seus treinadores, os quais exercem funções de acordo com a metodologia definida pela Coordenação Técnica e beneficiam de acompanhamento contínuo.\n\nSempre que sejam comunicadas preocupações relativas ao desempenho de um colaborador, as mesmas são analisadas internamente de forma objetiva e imparcial.\n\nAgradecemos o seu contributo e garantimos que a situação será devidamente apreciada.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "incompetente",
      "nao sabe treinar",
      "mau treinador",
      "incapaz"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 38
  },
  {
    "id": "a39",
    "situacao": "O Coordenador não faz nada",
    "assunto": "Situação apresentada",
    "texto": "Agradecemos a partilha da sua preocupação.\n\nA Coordenação Técnica acompanha regularmente a atividade desenvolvida pelos treinadores e assegura a implementação da metodologia da Dragon Force.\n\nA situação comunicada será analisada de acordo com os procedimentos internos, garantindo uma apreciação rigorosa dos factos apresentados.\n\nAgradecemos a confiança e permanecemos disponíveis para qualquer esclarecimento.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "coordenador nao faz nada",
      "coordenador",
      "coordenacao",
      "ninguem faz nada"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 39
  },
  {
    "id": "a40",
    "situacao": "Vocês só querem receber mensalidades",
    "assunto": "Esclarecimento",
    "texto": "Lamentamos que tenha ficado com essa perceção.\n\nA missão da Dragon Force centra-se na formação desportiva e humana dos seus atletas, procurando proporcionar um serviço de qualidade através de uma equipa técnica qualificada, instalações adequadas e acompanhamento permanente.\n\nAs mensalidades destinam-se a assegurar a continuidade deste projeto educativo e desportivo, permitindo manter as condições necessárias ao seu funcionamento.\n\nPermanecemos naturalmente disponíveis para esclarecer qualquer questão relacionada com este tema.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "so querem receber",
      "dinheiro",
      "mensalidades",
      "negocio",
      "so pensam no dinheiro"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 40
  },
  {
    "id": "a41",
    "situacao": "Exijo falar hoje com a Direção",
    "assunto": "Pedido de reunião",
    "texto": "Agradecemos o seu contacto.\n\nA Direção procura estar disponível para todos os Encarregados de Educação, conciliando essa disponibilidade com as responsabilidades de gestão da instituição.\n\nSempre que a natureza da situação o justifique, será agendada uma reunião com a maior brevidade possível.\n\nEntretanto, caso seja possível prestar algum esclarecimento através da Secretaria ou da Coordenação Técnica, teremos todo o gosto em fazê-lo.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "direcao",
      "falar hoje",
      "exijo",
      "diretor",
      "administracao"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 41
  },
  {
    "id": "a42",
    "situacao": "Quero o contacto pessoal do Diretor",
    "assunto": "Pedido de contacto",
    "texto": "Agradecemos o seu contacto.\n\nPor razões de organização interna, proteção de dados e igualdade de tratamento entre todos os Encarregados de Educação, os contactos pessoais dos colaboradores e dirigentes da Dragon Force não são divulgados.\n\nSempre que seja necessária a intervenção da Direção, a Secretaria assegurará o respetivo encaminhamento e o agendamento de uma reunião ou contacto pelos meios institucionais.\n\nAgradecemos a compreensão.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "contacto pessoal",
      "numero do diretor",
      "telemovel do diretor",
      "contacto direto"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 42
  },
  {
    "id": "a43",
    "situacao": "O meu filho vai mudar para outro clube",
    "assunto": "Acompanhamento do atleta",
    "texto": "Recebemos a sua comunicação com respeito pela decisão que entende ser a mais adequada para o percurso do seu educando.\n\nGostaríamos de agradecer a confiança depositada na Dragon Force durante o período em que integrou a nossa Escola.\n\nCaso considere útil, teremos todo o gosto em reunir consigo para recolher o seu feedback, identificar eventuais oportunidades de melhoria e prestar qualquer esclarecimento adicional.\n\nDesejamos ao seu educando os maiores sucessos pessoais, académicos e desportivos.",
    "capitulo": "Reclamações complexas",
    "palavras": [
      "outro clube",
      "mudar de clube",
      "vai sair",
      "transferencia",
      "sporting",
      "benfica",
      "boavista"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 43
  },
  {
    "id": "a44",
    "situacao": "Alegado comentário racista entre atletas",
    "assunto": "Situação comunicada",
    "texto": "Agradecemos o seu contacto e a confiança demonstrada ao comunicar esta situação.\n\nA Dragon Force encara com a máxima seriedade qualquer alegação relacionada com comportamentos discriminatórios, incluindo comentários de natureza racista, xenófoba ou ofensiva.\n\nA nossa Escola promove um ambiente assente no respeito pela dignidade de todas as pessoas, na igualdade de oportunidades e na inclusão, não tolerando qualquer comportamento que possa colocar em causa estes princípios.\n\nNa sequência da informação recebida, será realizada uma análise interna, ouvindo os intervenientes e recolhendo os elementos necessários para o adequado esclarecimento dos factos.\n\nCaso se confirmem comportamentos incompatíveis com os valores da Dragon Force, serão adotadas as medidas educativas e disciplinares consideradas adequadas, de acordo com o Regulamento Interno e o Código de Conduta.\n\nAgradecemos novamente a comunicação desta situação e permanecemos inteiramente disponíveis para qualquer esclarecimento adicional.",
    "capitulo": "Discriminação e inclusão",
    "palavras": [
      "racista",
      "racismo",
      "comentario racista",
      "cor da pele",
      "preto"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 44
  },
  {
    "id": "a45",
    "situacao": "Pai acusa outro Encarregado de Educação de racismo",
    "assunto": "Situação comunicada",
    "texto": "Agradecemos a informação que nos transmitiu.\n\nA Dragon Force rejeita qualquer forma de discriminação, incluindo comportamentos relacionados com origem étnica, nacionalidade, cor da pele, religião, sexo, deficiência, orientação sexual ou qualquer outra característica pessoal.\n\nA situação será analisada com imparcialidade, ouvindo todas as partes envolvidas e garantindo o respeito pelos direitos de todos os intervenientes.\n\nO nosso objetivo será sempre promover um ambiente seguro, respeitador e adequado ao desenvolvimento dos atletas.",
    "capitulo": "Discriminação e inclusão",
    "palavras": [
      "acusa de racismo",
      "outro encarregado",
      "pai racista",
      "racismo"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 45
  },
  {
    "id": "a46",
    "situacao": "Comentários racistas vindos da bancada",
    "assunto": "Situação ocorrida durante a competição",
    "texto": "Lamentamos profundamente a situação descrita.\n\nA Dragon Force condena de forma inequívoca qualquer manifestação de racismo, discriminação ou discurso de ódio.\n\nSempre que ocorram comportamentos desta natureza durante atividades desportivas, serão analisados os factos e, quando aplicável, comunicados às entidades organizadoras da competição e às autoridades competentes.\n\nContinuaremos empenhados em promover um ambiente de respeito, inclusão e fair play para todos os participantes.\n\nAgradecemos o seu contacto.",
    "capitulo": "Discriminação e inclusão",
    "palavras": [
      "bancada",
      "comentarios racistas",
      "adeptos",
      "insultos racistas",
      "publico"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 46
  },
  {
    "id": "a47",
    "situacao": "Atleta sente-se discriminado por ser estrangeiro",
    "assunto": "Situação comunicada",
    "texto": "Agradecemos a confiança demonstrada ao partilhar esta preocupação.\n\nA Dragon Force promove um ambiente inclusivo, onde todos os atletas são tratados com igualdade, respeito e dignidade, independentemente da sua nacionalidade, origem, língua ou cultura.\n\nA situação comunicada será analisada cuidadosamente, procurando compreender o contexto e assegurar que todos os atletas beneficiam de um ambiente seguro e acolhedor.\n\nCaso sejam identificadas situações inadequadas, serão adotadas as medidas educativas e disciplinares previstas nas normas internas da instituição.\n\nPermanecemos inteiramente disponíveis para acompanhar esta situação.",
    "capitulo": "Discriminação e inclusão",
    "palavras": [
      "estrangeiro",
      "nacionalidade",
      "imigrante",
      "brasileiro",
      "sotaque",
      "discriminado"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 47
  },
  {
    "id": "a48",
    "situacao": "Alegação de discriminação por deficiência",
    "assunto": "Esclarecimento sobre a situação comunicada",
    "texto": "A Dragon Force agradece o seu contacto.\n\nA nossa Escola compromete-se a promover uma prática desportiva inclusiva e respeitadora das características individuais de cada atleta.\n\nQualquer alegação de tratamento discriminatório é analisada com a máxima atenção, procurando assegurar que todos os alunos beneficiam das mesmas oportunidades de participação e desenvolvimento, dentro das condições técnicas e de segurança aplicáveis.\n\nIremos analisar cuidadosamente a situação comunicada e manteremos o contacto consigo sempre que se revele necessário.",
    "capitulo": "Discriminação e inclusão",
    "palavras": [
      "deficiencia",
      "necessidades especiais",
      "autismo",
      "limitacao",
      "incapacidade",
      "inclusao"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 48
  },
  {
    "id": "a49",
    "situacao": "Alegação de discriminação por religião",
    "assunto": "Situação comunicada",
    "texto": "Agradecemos a informação transmitida.\n\nA Dragon Force respeita plenamente a liberdade religiosa e de consciência de todos os seus atletas, colaboradores e famílias.\n\nQualquer situação suscetível de constituir discriminação por motivos religiosos será objeto de análise rigorosa e imparcial, sendo adotadas as medidas adequadas caso se confirmem comportamentos incompatíveis com os valores da instituição.\n\nAgradecemos a confiança demonstrada ao comunicar esta situação.",
    "capitulo": "Discriminação e inclusão",
    "palavras": [
      "religiao",
      "religioso",
      "crenca",
      "muculmano",
      "ramadao",
      "fe"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 49
  },
  {
    "id": "a50",
    "situacao": "Política Institucional de Igualdade",
    "assunto": "Princípios de Igualdade e Inclusão da Dragon Force",
    "texto": "A Dragon Force assume o compromisso de proporcionar um ambiente seguro, inclusivo e respeitador para todos os atletas, colaboradores e famílias.\n\nNão é tolerada qualquer forma de discriminação, assédio, intimidação ou violência baseada, entre outros fatores, na origem étnica, cor da pele, nacionalidade, sexo, identidade ou expressão de género, orientação\n\nsexual, religião, deficiência, condição socioeconómica ou qualquer outra característica pessoal protegida pela lei.\n\nSempre que seja comunicada uma situação desta natureza, a mesma será analisada com imparcialidade, confidencialidade e respeito pelos direitos de todos os intervenientes, sendo adotadas as medidas consideradas adequadas.\n\nAcreditamos que o desporto deve constituir um espaço de aprendizagem, respeito, inclusão e desenvolvimento humano.",
    "capitulo": "Discriminação e inclusão",
    "palavras": [
      "igualdade",
      "discriminacao",
      "inclusao",
      "politica",
      "tratamento igual"
    ],
    "temas": [],
    "origem": "anexo",
    "modelo": 50
  }
];

// Só os modelos do Anexo; o resto a app aprende com as respostas dadas.
const RESPOSTAS_PADRAO = RESPOSTAS_ANEXO;

// Junta à biblioteca guardada as respostas-padrão que ainda não lá estão
// (ex.: modelos novos), sem repor as que foram arquivadas.
function juntarRespostasPadrao(guardadas) {
  const lista = (Array.isArray(guardadas) ? guardadas : []).filter((x) => x.origem !== "manual");
  return [...lista, ...RESPOSTAS_PADRAO.filter((d) => !lista.some((x) => x.id === d.id))];
}

// ======================================================================
// ---------- Hoje: página inicial ----------
// ======================================================================
// Junta o que precisa de atenção hoje e nos próximos 7 dias. Cada área da
// app contribui com uma "fonte" que devolve itens; para acrescentar uma área
// nova basta juntar mais uma fonte a FONTES_HOJE.

const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function diasEntre(aISO, bISO) {
  return Math.round((new Date(bISO + "T00:00:00") - new Date(aISO + "T00:00:00")) / 86400000);
}

// Cada fonte recebe o contexto e devolve itens:
// { id, area, quando: "atraso" | "hoje" | "semana", data, nivel, titulo, detalhe, abrir }
const FONTES_HOJE = [
  // Radar: oportunidades do mundo lá fora ainda por avaliar.
  (c) =>
    c.radarNovas && c.radarNovas.length
      ? [
          {
            id: "radar-novas",
            area: "Riscos",
            quando: "semana",
            data: c.hoje,
            nivel: "info",
            titulo: `${c.radarNovas.length} ${c.radarNovas.length === 1 ? "oportunidade nova" : "oportunidades novas"} no radar`,
            detalhe: c.radarNovas.slice(0, 3).map((r) => r.titulo).join(" · ") + (c.radarNovas.length > 3 ? " …" : ""),
            abrir: () => c.irPara && c.irPara("riscos"),
          },
        ]
      : [],

  // Ocorrências abertas: as de gravidade alta pedem atenção hoje; as outras ao fim de 14 dias.
  (c) =>
    (c.ocorrencias || [])
      .filter((o) => (o.estado || "aberta") === "aberta")
      .map((o) => {
        const dias = diasEntre(String(o.data).slice(0, 10), c.hoje);
        const base = { id: `oc-${o.id}`, area: "Ocorrências", data: o.data, detalhe: [o.categoria, o.escola || "Geral", dias > 0 ? `aberta há ${dias} dia${dias === 1 ? "" : "s"}` : "de hoje"].filter(Boolean).join(" · "), abrir: () => c.irPara && c.irPara("ocorrencias") };
        if (o.gravidade === "alta") return { ...base, quando: "hoje", nivel: "alarme", titulo: `Ocorrência grave em aberto: ${o.titulo}` };
        if (dias >= 14) return { ...base, quando: "semana", nivel: "atencao", titulo: `Ocorrência por fechar: ${o.titulo}` };
        return null;
      })
      .filter(Boolean),

  // Riscos e oportunidades: temas que os dados mostram e que a lista ainda não tem.
  (c) =>
    c.avisosRiscos && c.avisosRiscos.n
      ? [
          {
            id: "riscos-avisos",
            area: "Riscos",
            quando: "hoje",
            data: c.hoje,
            nivel: "atencao",
            titulo: `${c.avisosRiscos.n} ${c.avisosRiscos.n === 1 ? "proposta nova" : "propostas novas"} de riscos e oportunidades (${c.avisosRiscos.ep})`,
            detalhe: c.avisosRiscos.titulos.slice(0, 3).join(" · ") + (c.avisosRiscos.n > 3 ? " …" : ""),
            abrir: () => c.irPara && c.irPara("riscos"),
          },
        ]
      : [],

  // Reclamações: fora do prazo, prazo hoje, prazo nos próximos 7 dias, por iniciar há dias.
  (c) =>
    c.reclamacoes
      .filter((e) => e.derivedStatus !== "concluido")
      .map((e) => {
        const prazo = isoDe(new Date(e.deadline));
        const d = diasEntre(c.hoje, prazo);
        const num = `Nº ${String(e.entryNumber).padStart(4, "0")}`;
        const base = { id: `r-${e.id}`, area: "Reclamações", data: prazo, abrir: () => c.abrirReclamacao(e) };
        if (d < 0) return { ...base, quando: "atraso", nivel: "alarme", titulo: `${num} fora do prazo há ${-d} dia${d === -1 ? "" : "s"}`, detalhe: `${e.complainant} · ${e.school || "sem escola"} · ${e.tema || "sem tema"}` };
        if (d === 0) return { ...base, quando: "hoje", nivel: "alarme", titulo: `${num}: o prazo termina hoje`, detalhe: `${e.complainant} · ${e.school || "sem escola"}` };
        if (d <= 7) return { ...base, quando: "semana", nivel: e.status === "por_pegar" ? "atencao" : "info", titulo: `${num}: prazo a ${fmt(new Date(e.deadline))}`, detalhe: `${e.status === "por_pegar" ? "Ainda por iniciar · " : ""}${e.complainant} · ${e.school || "sem escola"}` };
        return null;
      })
      .filter(Boolean),

  // Reclamações recebidas há 2+ dias e ainda não iniciadas.
  (c) =>
    c.reclamacoes
      .filter((e) => e.status === "por_pegar" && e.derivedStatus !== "atrasado" && diasEntre(e.receivedDate, c.hoje) >= 2 && diasEntre(c.hoje, isoDe(new Date(e.deadline))) > 7)
      .map((e) => ({
        id: `ri-${e.id}`,
        area: "Reclamações",
        quando: "hoje",
        data: c.hoje,
        nivel: "atencao",
        titulo: `Nº ${String(e.entryNumber).padStart(4, "0")} por iniciar há ${diasEntre(e.receivedDate, c.hoje)} dias`,
        detalhe: `${e.complainant} · ${e.school || "sem escola"}`,
        abrir: () => c.abrirReclamacao(e),
      })),

  // Cronograma de inquéritos: envios atrasados, de hoje e da semana; eventos a decorrer.
  (c) =>
    c.plano.flatMap((p) => {
      const envio = dataEnvioPlano(p, c.regrasEnvio);
      const nome = [p.evento, p.edicao].filter(Boolean).join(" · ");
      const out = [];
      if (envio && p.estado === "Por enviar") {
        const d = diasEntre(c.hoje, envio);
        const base = { id: `pl-${p.id}`, area: "Inquéritos", data: envio, abrir: () => c.irPara("inqueritos") };
        if (d < 0) out.push({ ...base, quando: "atraso", nivel: "alarme", titulo: `Inquérito por enviar: ${nome}`, detalhe: `Devia ter saído a ${fmt(new Date(envio + "T00:00:00"))}${p.responsavel ? ` · ${p.responsavel}` : ""}` });
        else if (d === 0) out.push({ ...base, quando: "hoje", nivel: "atencao", titulo: `Enviar hoje o inquérito: ${nome}`, detalhe: `${p.publico || "Público por definir"}${p.responsavel ? ` · ${p.responsavel}` : ""}` });
        else if (d <= 7) out.push({ ...base, quando: "semana", nivel: "info", titulo: `Enviar inquérito: ${nome}`, detalhe: `${p.publico || "Público por definir"}${p.responsavel ? ` · ${p.responsavel}` : ""}` });
      }
      if (p.estado === "Enviado" && envio && diasEntre(envio, c.hoje) > 14) {
        out.push({ id: `plf-${p.id}`, area: "Inquéritos", quando: "hoje", data: c.hoje, nivel: "atencao", titulo: `Fechar o inquérito: ${nome}`, detalhe: `Enviado há ${diasEntre(envio, c.hoje)} dias. Fecha e importa os resultados.`, abrir: () => c.irPara("inqueritos") });
      } else if (p.estado === "Enviado") {
        out.push({ id: `plc-${p.id}`, area: "Inquéritos", quando: "semana", data: null, nivel: "info", titulo: `A recolher respostas: ${nome}`, detalhe: `${envio ? `Enviado a ${fmt(new Date(envio + "T00:00:00"))}` : "Enviado"}${p.inscritos ? ` · ${p.inscritos} inscritos` : ""}`, abrir: () => c.irPara("inqueritos") });
      }
      if (p.estado === "Fechado" && !p.inqueritoId) {
        out.push({ id: `pla-${p.id}`, area: "Inquéritos", quando: "hoje", data: c.hoje, nivel: "atencao", titulo: `Analisar o inquérito: ${nome}`, detalhe: "Fechado. Importa as respostas para entrarem na análise.", abrir: () => c.irPara("inqueritos") });
      }
      if (p.inicio) {
        const di = diasEntre(c.hoje, p.inicio);
        const df = diasEntre(c.hoje, p.fim || p.inicio);
        if (di <= 0 && df >= 0) out.push({ id: `ev-${p.id}`, area: "Eventos", quando: "hoje", data: c.hoje, nivel: "info", titulo: `A decorrer: ${nome}`, detalhe: p.fim && p.fim !== p.inicio ? `Até ${fmt(new Date(p.fim + "T00:00:00"))}` : "Hoje", abrir: () => c.irPara("inqueritos") });
        else if (di > 0 && di <= 7) out.push({ id: `ev-${p.id}`, area: "Eventos", quando: "semana", data: p.inicio, nivel: "info", titulo: `Evento: ${nome}`, detalhe: p.publico || "", abrir: () => c.irPara("inqueritos") });
      }
      return out;
    }),

  // Auditorias: não conformidades maiores em aberto.
  (c) => {
    const ncm = c.audits.flatMap((a) => (a.findings || []).filter((f) => f.classification === "NCM" && !f.resolvida).map((f) => ({ ...f, escola: a.school, data: a.date })));
    if (!ncm.length) return [];
    return [
      {
        id: "ncm",
        area: "Auditorias",
        quando: "hoje",
        data: c.hoje,
        nivel: "alarme",
        titulo: `${ncm.length} não conformidade${ncm.length === 1 ? "" : "s"} maior${ncm.length === 1 ? "" : "es"} por resolver`,
        detalhe: [...new Set(ncm.map((f) => f.escola))].join(", "),
        abrir: () => c.irPara("auditorias"),
      },
    ];
  },

  // Experiências por avaliar há mais de 7 dias.
  (c) => {
    const pend = c.experiencias.filter((x) => x.resultado === "pendente" && x.data && diasEntre(x.data, c.hoje) > 7);
    if (!pend.length) return [];
    const n = pend.reduce((s, x) => s + x.n, 0);
    return [
      {
        id: "xp",
        area: "Inscritos",
        quando: "hoje",
        data: c.hoje,
        nivel: "atencao",
        titulo: `${n} experiência${n === 1 ? "" : "s"} por avaliar há mais de uma semana`,
        detalhe: [...new Set(pend.map((x) => x.escola))].join(", "),
        abrir: () => c.irPara("inscritos"),
      },
    ];
  },

  // Retrato semanal de inscritos ainda não feito esta semana.
  (c) => {
    if (!c.turmasAlunos.length) return [];
    const semana = semanaISO(new Date());
    const feito = Object.values(c.inscritos).some((l) => (l || []).some((r) => r.semana === semana));
    if (feito) return [];
    return [{ id: "retrato", area: "Inscritos", quando: "semana", data: c.hoje, nivel: "info", titulo: "Importar o ficheiro de inscritos da semana", detalhe: `Semana ${semanaLabel(semana)} ainda sem importação`, abrir: () => c.irPara("inscritos") }];
  },

  // Pedidos de desvinculação ainda sem decisão.
  (c) =>
    (c.desvinculacoes || [])
      .filter((v) => v.aceite === null || v.aceite === undefined)
      .map((v) => ({
        id: `dv-${v.id}`,
        area: "Inscritos",
        quando: "hoje",
        data: c.hoje,
        nivel: "atencao",
        titulo: `Desvinculação por decidir: ${v.escola}`,
        detalhe: `${v.quemPediu}${v.clubeDestino ? ` · ${v.clubeDestino}` : ""} · pedido a ${fmt(new Date(v.data + "T00:00:00"))}`,
        abrir: () => c.irPara("inscritos"),
      })),

  // Experiências marcadas para hoje ou para os próximos dias.
  (c) =>
    c.experiencias
      .filter((x) => x.resultado === "pendente" && x.data && diasEntre(c.hoje, x.data) >= 0 && diasEntre(c.hoje, x.data) <= 7)
      .map((x) => ({
        id: `xpf-${x.id}`,
        area: "Inscritos",
        quando: x.data === c.hoje ? "hoje" : "semana",
        data: x.data,
        nivel: "info",
        titulo: `Experiência: ${x.n} atleta${x.n === 1 ? "" : "s"} em ${x.turma}`,
        detalhe: x.escola,
        abrir: () => c.irPara("inscritos"),
      })),

  // Previsão de fim de época abaixo da época passada.
  (c) =>
    observacoesPrevisao(previsoesEscolas({ escolas: c.escolas || [], inscritos: c.inscritos, epocaAnterior: c.epocaAnterior || {}, experiencias: c.experiencias, turmasAlunos: c.turmasAlunos, hoje: c.hoje })).map((o, k) => ({
      id: `prev-${k}`,
      area: "Inscritos",
      quando: "semana",
      data: null,
      nivel: o.nivel,
      titulo: o.titulo,
      detalhe: o.texto,
      abrir: () => c.irPara("inscritos"),
    })),

  // Sanções por decidir.
  (c) =>
    c.sanctions
      .filter((s) => (s.personType === "elemento_df" ? !String(s.stage || "").startsWith("decisao") : s.sanctionApplied === null || s.sanctionApplied === undefined))
      .map((s) => ({
        id: `s-${s.id}`,
        area: "Sanções",
        quando: "hoje",
        data: c.hoje,
        nivel: s.motivo === "agressao" || s.motivo === "ameacas" ? "alarme" : "atencao",
        titulo: `Ocorrência por decidir: ${nomeOcorrencia(s)}`,
        detalhe: `${(MOTIVO_META[s.motivo] || MOTIVO_META.outro).label} · ${s.school || "sem escola"} · ${fmt(new Date(s.date + "T00:00:00"))}`,
        abrir: () => c.irPara("sancoes"),
      })),
];

const COR_AREA = () => ({
  Reclamações: COLORS.danger,
  Inquéritos: COLORS.purple,
  Eventos: COLORS.progress,
  Auditorias: COLORS.warn,
  Inscritos: COLORS.ok,
  Sanções: COLORS.navySoft,
  Ocorrências: COLORS.warn,
  Riscos: COLORS.danger,
});

function ItemHoje({ it }) {
  const cor = it.nivel === "alarme" ? COLORS.danger : it.nivel === "atencao" ? COLORS.warn : COLORS.navySoft;
  return (
    <button
      onClick={it.abrir}
      className="rowHover"
      style={{ display: "flex", gap: 10, alignItems: "flex-start", width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 8, padding: "9px 10px", cursor: "pointer", color: COLORS.ink, font: "inherit" }}
    >
      <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: cor, flex: "none" }} aria-hidden="true" />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{it.titulo}</span>
        {it.detalhe && <span style={{ display: "block", fontSize: 12, color: COLORS.slate, marginTop: 2 }}>{it.detalhe}</span>}
      </span>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: COR_AREA()[it.area] || COLORS.slate, textTransform: "uppercase", letterSpacing: "0.04em", flex: "none", marginTop: 3 }}>{it.area}</span>
    </button>
  );
}

function HojePage(props) {
  const hoje = isoDe(new Date());
  const ctx = { ...props, hoje };
  const itens = FONTES_HOJE.flatMap((f) => {
    try {
      return f(ctx) || [];
    } catch (e) {
      return [];
    }
  });
  const ordemNivel = { alarme: 0, atencao: 1, info: 2 };
  const atrasos = itens.filter((i) => i.quando === "atraso").sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const deHoje = itens.filter((i) => i.quando === "hoje").sort((a, b) => ordemNivel[a.nivel] - ordemNivel[b.nivel]);
  const semana = itens.filter((i) => i.quando === "semana").sort((a, b) => String(a.data).localeCompare(String(b.data)));

  // Próximos 7 dias, um bloco por dia com itens.
  const dias = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() + k + 1);
    return isoDe(d);
  });

  // Números da semana: últimos 7 dias contra os 7 anteriores.
  const entre = (d, a, b) => d && d >= a && d <= b;
  const menos = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return isoDe(d);
  };
  const recebidas7 = props.reclamacoes.filter((e) => entre(e.receivedDate, menos(6), hoje)).length;
  const recebidasAnt = props.reclamacoes.filter((e) => entre(e.receivedDate, menos(13), menos(7))).length;
  const concluidas7 = props.reclamacoes.filter((e) => e.resolvedDate && entre(isoDe(new Date(e.resolvedDate)), menos(6), hoje)).length;
  const desist7 = props.desistencias.filter((x) => entre(x.data, menos(6), hoje)).reduce((n, x) => n + x.n, 0);
  const xp7 = props.experiencias.filter((x) => entre(x.data, menos(6), hoje)).reduce((n, x) => n + x.n, 0);

  const dataLonga = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

  const bloco = (titulo, lista, vazio, destaque) => (
    <div style={{ ...panelStyle, padding: "14px 10px 10px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 6px", marginBottom: 6 }}>
        <div style={{ ...panelTitle, marginBottom: 0, color: destaque || COLORS.ink }}>{titulo}</div>
        <div style={{ fontSize: 12, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>{lista.length}</div>
      </div>
      {lista.length === 0 ? <div style={{ fontSize: 12.5, color: COLORS.slate, padding: "8px 6px 10px" }}>{vazio}</div> : lista.map((it) => <ItemHoje key={it.id} it={it} />)}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 26, letterSpacing: "-0.02em", color: COLORS.ink }}>{dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)}</h2>
        <div style={{ fontSize: 14, color: COLORS.ink2, marginTop: 4 }}>
          {atrasos.length + deHoje.length === 0 ? "Nada urgente para hoje." : `${atrasos.length + deHoje.length} ${atrasos.length + deHoje.length === 1 ? "assunto" : "assuntos"} para tratar hoje.`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="Em atraso" value={atrasos.length} color={atrasos.length ? COLORS.danger : COLORS.ok} subtitle={atrasos.length ? "Prazos e envios já ultrapassados" : "Tudo dentro do prazo"} />
        <StatCard label="Para hoje" value={deHoje.length} color={COLORS.warn} subtitle="Prazos, envios e pendentes" />
        <StatCard label="Próximos 7 dias" value={semana.length} color={COLORS.navy} subtitle="Prazos, envios e eventos" />
        <StatCard label="Reclamações nos últimos 7 dias" value={recebidas7} subtitle={`${recebidasAnt} na semana anterior · ${concluidas7} concluídas`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          {atrasos.length > 0 && bloco("Em atraso", atrasos, "", COLORS.danger)}
          {bloco("Hoje", deHoje, "Sem tarefas para hoje.")}
        </div>
        <div style={{ ...panelStyle, padding: "14px 10px 10px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "0 6px", marginBottom: 6 }}>
            <div style={{ ...panelTitle, marginBottom: 0 }}>Próximos 7 dias</div>
            <div style={{ fontSize: 12, color: COLORS.slate }}>{semana.length}</div>
          </div>
          {semana.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.slate, padding: "8px 6px 10px" }}>Nada marcado para os próximos dias.</div>}
          {dias.map((d) => {
            const doDia = semana.filter((i) => i.data === d);
            if (!doDia.length) return null;
            const dt = new Date(d + "T00:00:00");
            return (
              <div key={d} style={{ marginTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.navy, textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 6px 2px" }}>
                  {DIAS_SEMANA_CURTO[dt.getDay()]} {dt.getDate()}
                  {diasEntre(hoje, d) === 1 ? " · amanhã" : ""}
                </div>
                {doDia.map((it) => (
                  <ItemHoje key={it.id} it={it} />
                ))}
              </div>
            );
          })}
          {/* Itens da semana sem dia exato (ex.: retrato semanal) */}
          {semana.filter((i) => !dias.includes(i.data)).map((it) => (
            <ItemHoje key={it.id} it={it} />
          ))}
        </div>
      </div>

      {(() => {
        const comEnvio = props.plano.map((p) => ({ ...p, envio: dataEnvioPlano(p, props.regrasEnvio) }));
        const nome = (p) => [p.evento, p.edicao].filter(Boolean).join(" · ");
        const colunas = [
          {
            titulo: "Para enviar",
            nota: "atrasados e próximos 7 dias",
            cor: COLORS.slate,
            itens: comEnvio
              .filter((p) => p.estado === "Por enviar" && p.envio && diasEntre(hoje, p.envio) <= 7)
              .sort((a, b) => a.envio.localeCompare(b.envio))
              .map((p) => ({ p, linha: diasEntre(hoje, p.envio) < 0 ? `atrasado desde ${fmt(new Date(p.envio + "T00:00:00"))}` : diasEntre(hoje, p.envio) === 0 ? "hoje" : fmt(new Date(p.envio + "T00:00:00")), alerta: diasEntre(hoje, p.envio) < 0 })),
          },
          {
            titulo: "A recolher respostas",
            nota: "enviados",
            cor: COLORS.progress,
            itens: comEnvio.filter((p) => p.estado === "Enviado").map((p) => ({ p, linha: p.envio ? `enviado há ${Math.max(0, diasEntre(p.envio, hoje))} dias` : "enviado", alerta: p.envio && diasEntre(p.envio, hoje) > 14 })),
          },
          {
            titulo: "Para analisar",
            nota: "fechados sem resultados",
            cor: COLORS.warn,
            itens: comEnvio.filter((p) => p.estado === "Fechado" && !p.inqueritoId).map((p) => ({ p, linha: "importar respostas", alerta: true })),
          },
          {
            titulo: "Analisados esta época",
            nota: "com resultados",
            cor: COLORS.ok,
            itens: comEnvio
              .filter((p) => p.estado === "Analisado" && p.epoca === epocaDe(hoje))
              .slice(-4)
              .map((p) => ({ p, linha: p.inscritos && p.respostas != null ? `${Math.round((p.respostas / p.inscritos) * 100)}% de resposta` : "analisado" })),
          },
        ];
        const proximoEnvio = comEnvio.filter((p) => p.estado === "Por enviar" && p.envio && p.envio >= hoje).sort((a, b) => a.envio.localeCompare(b.envio))[0];
        if (!props.plano.length) return null;
        return (
          <div style={{ ...panelStyle, marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={panelTitle}>Inquéritos de satisfação</div>
              <button onClick={() => props.irPara("inqueritos")} style={{ ...linkBtnStyle, marginTop: 0 }}>
                Abrir planeamento
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {colunas.map((col) => (
                <div key={col.titulo} style={{ background: COLORS.paperSunken, borderRadius: 10, padding: "10px 12px", borderTop: `3px solid ${col.cor}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{col.titulo}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{col.itens.length}</div>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.slate, marginBottom: 6 }}>{col.nota}</div>
                  {col.itens.length === 0 ? (
                    col.titulo === "Para enviar" && proximoEnvio ? (
                      <div style={{ fontSize: 12, color: COLORS.slate, padding: "2px 0" }}>
                        Nada nos próximos 7 dias. Próximo: <strong style={{ color: COLORS.ink }}>{nome(proximoEnvio)}</strong> a {fmt(new Date(proximoEnvio.envio + "T00:00:00"))}.
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: COLORS.slate }}>Nada.</div>
                    )
                  ) : (
                    col.itens.slice(0, 5).map(({ p, linha, alerta }) => (
                      <button
                        key={p.id}
                        onClick={() => props.irPara("inqueritos")}
                        className="rowHover"
                        style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 6, padding: "5px 6px", cursor: "pointer", color: COLORS.ink, font: "inherit" }}
                      >
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{nome(p)}</span>
                        <span style={{ display: "block", fontSize: 11.5, color: alerta ? COLORS.danger : COLORS.slate }}>{linha}</span>
                      </button>
                    ))
                  )}
                  {col.itens.length > 5 && <div style={{ fontSize: 11.5, color: COLORS.slate, padding: "2px 6px" }}>e mais {col.itens.length - 5}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={{ ...panelStyle, marginTop: 16 }}>
        <div style={panelTitle}>Últimos 7 dias</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {[
            ["Reclamações recebidas", recebidas7, recebidasAnt],
            ["Reclamações concluídas", concluidas7, null],
            ["Desistências", desist7, null],
            ["Experiências", xp7, null],
          ].map(([l, v, ant]) => (
            <div key={l} style={{ padding: "10px 12px", borderRadius: 10, background: COLORS.paperSunken }}>
              <div style={{ fontSize: 11.5, color: COLORS.ink2 }}>{l}</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{v}</div>
              {ant !== null && <div style={{ fontSize: 11, color: COLORS.slate }}>{ant} na semana anterior</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function curvaEpocaAnterior(reg, ep) {
  if (!reg) return null;
  const paraMapa = (bal) => Object.fromEntries(bal.map((b) => [b.k, b.ativos]));
  const escolas = {};
  [...new Set(Object.values(reg.alunos || {}).map((a) => a.escola))].forEach((e) => (escolas[e] = paraMapa(balancoSemanal(reg, e, ep))));
  return { epoca: ep, escolas, total: paraMapa(balancoSemanal(reg, null, ep)) };
}

function observacoesPrevisao(previsoes, limites) {
  return previsoes
    .filter((p) => !p.insuficiente && p.variacao !== null)
    .map((p) => {
      const cls = classificarCrescimento(p.variacao, limites);
      if (cls.key !== "critico" && cls.key !== "declinio") return null;
      return {
        nivel: cls.key === "critico" ? "alarme" : "atencao",
        titulo: `A este ritmo, ${p.escola} acaba ${Math.abs(p.variacao).toLocaleString("pt-PT")}% abaixo da época passada`,
        texto: `Previsão de ${p.previsao} alunos no fim de julho (entre ${p.baixo} e ${p.alto}), contra ${p.ant}. Para igualar, faltam ${p.falta} inscrições, cerca de ${p.porSemana} por semana.`,
      };
    })
    .filter(Boolean);
}

// Navega-se com as setas, confirma-se com Enter e sai-se com Escape.
function PaletaComandos({ aberta, onFechar, comandos }) {
  const [busca, setBusca] = useState("");
  const [indice, setIndice] = useState(0);
  const campoRef = useRef(null);

  useEffect(() => {
    if (aberta) {
      setBusca("");
      setIndice(0);
      // Espera o painel montar antes de focar o campo.
      const id = setTimeout(() => campoRef.current && campoRef.current.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [aberta]);

  const norm = (t) =>
    String(t || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const filtrados = useMemo(() => {
    const q = norm(busca).trim();
    if (!q) return comandos.slice(0, 12);
    const termos = q.split(/\s+/);
    return comandos
      .filter((c) => termos.every((t) => norm(`${c.titulo} ${c.grupo} ${c.detalhe || ""}`).includes(t)))
      .slice(0, 12);
  }, [busca, comandos]);

  useEffect(() => {
    setIndice(0);
  }, [busca]);

  if (!aberta) return null;

  const executar = (c) => {
    if (!c) return;
    onFechar();
    c.acao();
  };

  const teclas = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executar(filtrados[indice]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onFechar();
    }
  };

  // Agrupa mantendo a ordem em que os grupos aparecem nos resultados.
  const grupos = [];
  filtrados.forEach((c) => {
    const g = grupos.find((x) => x.nome === c.grupo);
    if (g) g.itens.push(c);
    else grupos.push({ nome: c.grupo, itens: [c] });
  });

  return (
    <div
      className="veil"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,14,24,0.4)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 80,
        padding: "14vh 16px 16px",
      }}
      onClick={onFechar}
    >
      <div
        className="sheet"
        style={{
          width: "min(560px, 100%)",
          maxHeight: "calc(100vh - 20vh)",
          display: "flex",
          flexDirection: "column",
          background: COLORS.paperRaised,
          border: `1px solid ${COLORS.rule}`,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 60px -16px rgba(8,14,24,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: `1px solid ${COLORS.rule}` }}>
          <Search size={16} color={COLORS.slate} />
          <input
            ref={campoRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={teclas}
            placeholder="Ir para uma secção ou procurar uma reclamação..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14.5,
              color: COLORS.ink,
              padding: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.slate,
              border: `1px solid ${COLORS.rule}`,
              borderRadius: 5,
              padding: "2px 6px",
            }}
          >
            esc
          </span>
        </div>

        <div style={{ overflowY: "auto", padding: 6 }}>
          {filtrados.length === 0 ? (
            <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: COLORS.slate }}>
              Nada encontrado para "{busca}".
            </div>
          ) : (
            grupos.map((g) => (
              <div key={g.nome}>
                <div style={{ padding: "8px 10px 4px", fontSize: 11, fontWeight: 600, color: COLORS.slate }}>{g.nome}</div>
                {g.itens.map((c) => {
                  const i = filtrados.indexOf(c);
                  const activo = i === indice;
                  const Icone = c.icon;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setIndice(i)}
                      onClick={() => executar(c)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 10px",
                        background: activo ? COLORS.navyWash : "transparent",
                        color: activo ? COLORS.navySoft : COLORS.ink,
                        cursor: "pointer",
                        fontSize: 13.5,
                        fontWeight: 500,
                      }}
                    >
                      {Icone && <Icone size={15} />}
                      <span style={{ flex: 1 }}>{c.titulo}</span>
                      {c.detalhe && (
                        <span style={{ fontSize: 11.5, color: activo ? COLORS.navySoft : COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
                          {c.detalhe}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            padding: "9px 16px",
            borderTop: `1px solid ${COLORS.rule}`,
            fontSize: 11.5,
            color: COLORS.slate,
            background: COLORS.paperSunken,
          }}
        >
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span style={{ marginLeft: "auto" }}>{filtrados.length} resultado(s)</span>
        </div>
      </div>
    </div>
  );
}

// ======================= APAGADOS =======================
function ApagadosPage({ lista, onRepor, onApagarDeVez }) {
  const [fModulo, setFModulo] = useState("todos");
  const ord = [...lista].sort((a, b) => String(b.em).localeCompare(String(a.em)));
  const modulos = [...new Set(ord.map((a) => a.chave))];
  const vis = ord.filter((a) => fModulo === "todos" || a.chave === fModulo);
  const diasRestam = (em) => Math.max(0, DIAS_APAGADOS - Math.floor((Date.now() - new Date(em).getTime()) / 86400000));
  const quando = (em) => {
    const d = new Date(em);
    return `${fmt(d)} às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  if (!lista.length) return <Vazio icon={RotateCcw} titulo="Nada apagado" texto={`O que apagares nas listas da app (reclamações, riscos, documentos, auditorias, espaços…) fica aqui ${DIAS_APAGADOS} dias e pode ser reposto.`} />;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        {segSGQ([["todos", `Tudo · ${lista.length}`], ...modulos.map((m) => [m, `${LISTAS_COM_LIXO[m] || m} · ${lista.filter((a) => a.chave === m).length}`])], fModulo, setFModulo)}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: COLORS.slate }}>Cada registo fica {DIAS_APAGADOS} dias e depois sai sozinho.</span>
      </div>
      <div style={{ ...panelStyle, marginBottom: 0, padding: 0, overflow: "hidden" }}>
        {vis.map((a, k) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: k ? `1px solid ${COLORS.ruleSoft}` : "none", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.rotulo}</div>
              <div style={{ fontSize: 12, color: COLORS.slate, marginTop: 2 }}>
                {LISTAS_COM_LIXO[a.chave] || a.chave} · apagado a {quando(a.em)} · sai daqui a {diasRestam(a.em)} {diasRestam(a.em) === 1 ? "dia" : "dias"}
              </div>
            </div>
            <button className="press" onClick={() => onRepor([a])} style={{ ...secondaryBtnStyle, width: "auto", flex: "none", padding: "6px 12px", fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RotateCcw size={13} /> Repor
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Apagar de vez "${a.rotulo}"? Deixa de poder ser reposto.`)) onApagarDeVez(a.id);
              }}
              style={{ ...linkBtnStyle, marginTop: 0, fontSize: 12.5, color: COLORS.danger }}
            >
              Apagar de vez
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================================================================
// ---------- Ocorrências ----------
// ======================================================================
// Registos importantes que não são reclamações nem sanções: treinos suspensos pelo
// clima, avarias e problemas nas instalações, questões contratuais com parceiros,
// comportamentos, acidentes, falhas de fornecedores ou de sistemas. Alimentam os
// riscos e oportunidades.

const DEFAULT_CATEGORIAS_OCORRENCIA = [
  "Condições climatéricas",
  "Infraestruturas e equipamentos",
  "Energia e serviços (luz, água)",
  "Contratual / clube parceiro",
  "Comportamento",
  "Segurança e acidentes",
  "Saúde e lesões",
  "Recursos humanos / staff",
  "Fornecedores",
  "Sistemas informáticos",
  "Outra",
];

function AppPrincipal({ onSair }) {
  // Depois de a app abrir, as outras páginas descarregam em segundo plano: mudar de página fica instantâneo.
  useEffect(() => {
    const t = setTimeout(precarregarPaginas, 2500);
    return () => clearTimeout(t);
  }, []);
  const [entries, setEntries] = useState([]);
  const [options, setOptions] = useState({ schools: [], categories: [], auditCategories: [], complaintCategories: DEFAULT_CATEGORIAS, sanctionTypes: DEFAULT_TIPOS_SANCAO, auditAreas: DEFAULT_AREAS_AUDITORIA, turmas: DEFAULT_TURMAS, niveis: DEFAULT_NIVEIS, turmasPorEscola: {}, motivosDesistencia: DEFAULT_MOTIVOS_DESISTENCIA, categoriasSatisfacao: DEFAULT_CATEGORIAS_SATISFACAO, espacosLista: DEFAULT_ESPACOS, mapaEscaloes: {}, tiposEvento: DEFAULT_TIPOS_EVENTO, dimensoesInquerito: DEFAULT_DIMENSOES_INQ, tipologiasInq: DEFAULT_TIPOLOGIAS_INQ, causasRaiz: DEFAULT_CAUSAS_RAIZ, categoriasOcorrencia: DEFAULT_CATEGORIAS_OCORRENCIA });
  const [audits, setAudits] = useState([]);
  // Na passagem de época tudo o que ficou por resolver dá-se como fechado.
  // Os dados guardados não mudam: a app só passa a tratá-las como fechadas.
  const auditsVista = useMemo(() => {
    const epocaHoje = epocaDe(isoDe(new Date()));
    return audits.map((a) => {
      const ep = epocaAud(a);
      if (!ep || ep >= epocaHoje || !(a.findings || []).some((f) => !f.resolvida)) return a;
      return { ...a, findings: a.findings.map((f) => (f.resolvida ? f : { ...f, resolvida: true, fechoEpoca: true })) };
    });
  }, [audits]);
  const [sanctions, setSanctions] = useState([]);
  const [learned, setLearned] = useState({ canal: {}, categoria: {}, tema: {}, gravidade: {} });
  const [inscritos, setInscritos] = useState({});
  const [turmasAlunos, setTurmasAlunos] = useState([]);
  const [registoAlunos, setRegistoAlunos] = useState({});
  // Curva da época passada para a previsão de fim de época.
  const curvaAnt = useMemo(() => {
    const epA = epAntDe(epocaDe(isoDe(new Date())));
    return curvaEpocaAnterior(registoAlunos[epA], epA);
  }, [registoAlunos]);
  definirCurvaEpocaAnterior(curvaAnt);

  // Evolução semanal: na época em curso sai sempre dos alunos importados.
  const inscritosVista = useMemo(() => {
    const ep = epocaDe(isoDe(new Date()));
    const reg = registoAlunos[ep];
    if (!reg) return inscritos;
    const prox = { ...inscritos };
    [...new Set(Object.values(reg.alunos || {}).map((a) => a.escola))].forEach((e) => {
      const bal = balancoSemanal(reg, e, ep);
      const antes = (prox[e] || []).filter((x) => epocaDaSemanaISO(x.semana) !== ep);
      prox[e] = [...antes, ...bal.map((b) => ({ semana: b.semana, total: b.ativos, novas: b.entradas, desist: b.desist }))].sort((x, y) => x.semana.localeCompare(y.semana));
    });
    return prox;
  }, [inscritos, registoAlunos]);

  const [epocaAnterior, setEpocaAnterior] = useState({});
  const [desistencias, setDesistencias] = useState([]);
  const [experiencias, setExperiencias] = useState([]);
  const [desvinculacoes, setDesvinculacoes] = useState([]);
  const [espacos, setEspacos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [riscos, setRiscos] = useState({ epocas: {} });
  const [objetivos, setObjetivos] = useState({ epocas: {} });
  const [documentos, setDocumentos] = useState({ itens: [], colaboradores: [], locais: [] });
  const [formacao, setFormacao] = useState({ itens: [] });
  const [apagados, setApagados] = useState([]);
  const apagadosRef = useRef([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState({ itens: [], roster: {}, criteriosTecnica: [] });
  const [radar, setRadar] = useState(null);
  const [inqueritos, setInqueritos] = useState([]);
  const [notasRelatorio, setNotasRelatorio] = useState({});
  const [planoInq, setPlanoInq] = useState([]);
  const [respostasTipo, setRespostasTipo] = useState(RESPOSTAS_PADRAO);
  const [satisfacao, setSatisfacao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [importarAud, setImportarAud] = useState(false);
  const [areasAud, setAreasAud] = useState(false);
  const [preencherAud, setPreencherAud] = useState(false);
  const [isoAud, setIsoAud] = useState(false);
  const [viewingAudit, setViewingAudit] = useState(null);
  const [viewingDetail, setViewingDetail] = useState(null);
  const [showSanctionForm, setShowSanctionForm] = useState(false);
  const [viewingSanction, setViewingSanction] = useState(null);
  const [editingSanction, setEditingSanction] = useState(null);
  const [page, setPage] = useState("hoje");
  // A página nova abre sempre no topo (o conteúdo desliza dentro da sua coluna).
  const conteudoRef = useRef(null);
  useEffect(() => {
    if (conteudoRef.current) conteudoRef.current.scrollTop = 0;
  }, [page]);
  // Tema claro/escuro. Fica guardado no browser para não se perder ao recarregar.
  // Notificações flutuantes: substituem o banner de erro, que só aparecia
  // numa das páginas e passava despercebido nas outras.
  const [paletaAberta, setPaletaAberta] = useState(false);
  // Qual lista está a ser gerida: cada campo abre só a sua, em vez de um
  // único menu com todas as listas da app.
  const [listaAberta, setListaAberta] = useState(null);
  const [contactosAbertos, setContactosAbertos] = useState(false);
  const carregadoEm = useRef(new Date().toISOString());
  const [notificacoes, setNotificacoes] = useState([]);
  const notificar = useCallback((texto, tipo = "ok", duracao = 4200, acao = null) => {
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setNotificacoes((l) => [...l, { id, texto, tipo, acao }]);
    if (duracao) setTimeout(() => setNotificacoes((l) => l.filter((n) => n.id !== id)), duracao);
  }, []);
  // Saída suave dos popups e avisos: quando um é retirado, fica uma cópia a desvanecer durante 200 ms.
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const obs = new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.removedNodes.forEach((n) => {
          if (n.nodeType !== 1 || !m.target.isConnected || n.dataset.saida) return;
          const classe = n.classList.contains("veil") ? "veilSai" : n.classList.contains("toastIn") ? "toastSai" : "";
          if (!classe) return;
          const c = n.cloneNode(true);
          c.dataset.saida = "1";
          c.classList.add(classe);
          c.setAttribute("aria-hidden", "true");
          c.querySelectorAll("input, textarea, select, button").forEach((el) => (el.tabIndex = -1));
          m.target.appendChild(c);
          setTimeout(() => c.remove(), 260);
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  // Aviso de nova versão: compara a versão desta página com /versao.json (de 5 em 5 minutos e ao voltar ao separador).
  const avisouVersao = useRef(false);
  useEffect(() => {
    if (typeof __VERSAO__ === "undefined" || __VERSAO__ === "dev") return;
    const ver = async () => {
      if (avisouVersao.current) return;
      try {
        const r = await fetch(`/versao.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (j && j.v && j.v !== __VERSAO__) {
          avisouVersao.current = true;
          notificar("Há uma nova versão da app. Atualiza quando acabares o que estás a fazer.", "aviso", 0, { rotulo: "Atualizar", fn: () => window.location.reload() });
        }
      } catch (e) {
        // sem rede: tenta na próxima
      }
    };
    const t = setInterval(ver, 5 * 60 * 1000);
    const foco = () => document.visibilityState === "visible" && ver();
    document.addEventListener("visibilitychange", foco);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", foco);
    };
  }, [notificar]);
  const fecharNotificacao = (id) => setNotificacoes((l) => l.filter((n) => n.id !== id));

  const [tema, setTemaState] = useState(() => {
    try {
      return window.localStorage.getItem("df-tema") === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  });
  const setTema = (t) => {
    // Durante um instante as cores passam a ter transição, para a troca não ser seca.
    try {
      const raiz = document.documentElement;
      raiz.classList.add("temaTransicao");
      clearTimeout(setTema.t);
      setTema.t = setTimeout(() => raiz.classList.remove("temaTransicao"), 380);
    } catch (e) {
      // sem DOM: troca direta
    }
    setTemaState(t);
    try {
      window.localStorage.setItem("df-tema", t);
    } catch (e) {
      // sem localStorage disponível: o tema só vale nesta sessão
    }
  };
  // Aplica as cores antes de qualquer componente renderizar neste ciclo.
  aplicarTema(tema);

  // ⌘K (ou Ctrl+K) abre a paleta de comandos em qualquer página.
  useEffect(() => {
    const aoTeclar = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletaAberta((v) => !v);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);
  const [reclamacoesView, setReclamacoesView] = useState("registo");
  const [editing, setEditing] = useState(null);
  const [filterCanal, setFilterCanal] = useState("todos");
  const [filterEpoca, setFilterEpoca] = useState("todas");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");

  const persist = useCallback(async (next) => {
    setEntries(next);
    try {
      await armazem.set(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar reclamações:", e);
      notificar(`Não foi possível guardar as reclamações: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistOptions = useCallback(async (next) => {
    setOptions(next);
    try {
      await armazem.set(STORAGE_OPTIONS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar listas:", e);
      notificar(`Não foi possível guardar as listas: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistAudits = useCallback(async (next) => {
    setAudits(next);
    try {
      await armazem.set(STORAGE_AUDITS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar auditorias:", e);
      notificar(`Não foi possível guardar as auditorias: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistSanctions = useCallback(async (next) => {
    setSanctions(next);
    try {
      await armazem.set(STORAGE_SANCOES_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar sanções:", e);
      notificar(`Não foi possível guardar as sanções: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  // Gravação das listas simples da gestão. Função normal (não hook) para não
  // violar as regras dos hooks ao ser usada várias vezes.
  const fazPersist = (setter, chave, nome) => async (next) => {
    setter(next);
    try {
      await armazem.set(chave, JSON.stringify(next));
    } catch (e) {
      console.error(`Erro ao guardar ${nome}:`, e);
      notificar(`Não foi possível guardar ${nome}: ${e?.message || e}`, "erro", 0);
    }
  };

  const persistDesistencias = fazPersist(setDesistencias, STORAGE_DESISTENCIAS_KEY, "as desistências");
  const persistExperiencias = fazPersist(setExperiencias, STORAGE_EXPERIENCIAS_KEY, "as experiências");
  const persistRegistoAlunos = fazPersist(setRegistoAlunos, STORAGE_ALUNOS_KEY, "os alunos");
  const persistDesvinc = fazPersist(setDesvinculacoes, STORAGE_DESVINC_KEY, "as desvinculações");
  const persistEspacos = fazPersist(setEspacos, STORAGE_ESPACOS_KEY, "os espaços");
  const persistEventos = fazPersist(setEventos, STORAGE_EVENTOS_KEY, "os eventos");
  const persistRiscos = fazPersist(setRiscos, STORAGE_RISCOS_KEY, "os riscos e oportunidades");
  const persistObjetivos = fazPersist(setObjetivos, STORAGE_OBJETIVOS_KEY, "o mapa de objetivos");
  const persistDocumentos = fazPersist(setDocumentos, STORAGE_DOCUMENTOS_KEY, "o controlo documental");
  const persistFormacao = fazPersist(setFormacao, STORAGE_FORMACAO_KEY, "o plano de formação");
  const persistOcorrencias = fazPersist(setOcorrencias, STORAGE_OCORRENCIAS_KEY, "as ocorrências");
  const persistAvaliacoes = fazPersist(setAvaliacoes, STORAGE_AVALIACOES_KEY, "as avaliações");
  const guardarOcorrencia = (o) => persistOcorrencias(ocorrencias.some((x) => x.id === o.id) ? ocorrencias.map((x) => (x.id === o.id ? o : x)) : [...ocorrencias, o]);
  const apagarOcorrencia = (id) => persistOcorrencias(ocorrencias.filter((x) => x.id !== id));
  const riscosDaEpoca = (ep) => ((riscos.epocas || {})[ep] || {}).itens || [];
  // Dados da app que alimentam o acompanhamento do mapa de objetivos.
  const contextoObjetivos = useMemo(() => {
    const niveisO = options.niveis || DEFAULT_NIVEIS;
    const capacidadesO = options.capacidades || {};
    return {
      reclamacoes: entries,
      registoAlunos,
      eventos,
      inqueritos,
      ocorrencias,
      audits,
      participantesDe: (ev) => {
        try {
          if (ev && ev.tipo === "semanas") return ev.inscricoes || null;
          const c = contasEvento(ev, registoAlunos || {}, niveisO);
          return c ? c.lidos : null;
        } catch (e) {
          return null;
        }
      },
      satisfacaoDe: (i) => satisfacaoDe(i.perguntas || []),
      retencaoDe: (ep, escola) => {
        const x = indicadoresDaEpoca(ep, registoAlunos || {}, niveisO, capacidadesO, escola || undefined);
        return x && x.ret && x.ret.taxa !== null && x.ret.taxa !== undefined ? x.ret.taxa / 100 : null;
      },
      ativosDe: (ep, escola) => {
        const reg = (registoAlunos || {})[ep];
        if (!reg) return null;
        const n = Object.values(reg.alunos || {}).filter((a) => a.estado === "ativo" && (!escola || a.escola === escola)).length;
        return n || null;
      },
    };
  }, [entries, registoAlunos, eventos, inqueritos, ocorrencias, audits, options.niveis, options.capacidades]);
  const persistSatisfacao = fazPersist(setSatisfacao, STORAGE_SATISFACAO_KEY, "a satisfação");
  const persistInqueritos = fazPersist(setInqueritos, STORAGE_INQUERITOS_KEY, "os inquéritos");
  const persistNotasRel = fazPersist(setNotasRelatorio, STORAGE_NOTAS_REL_KEY, "as notas do relatório");
  const persistPlanoInq = fazPersist(setPlanoInq, STORAGE_PLANO_INQ_KEY, "o cronograma de inquéritos");
  const persistRespostas = fazPersist(setRespostasTipo, STORAGE_RESPOSTAS_KEY, "as respostas-tipo");

  // ---------- Apagados: 30 dias para repor ----------
  apagadosRef.current = apagados;
  const guardarApagados = (lista) => {
    apagadosRef.current = lista;
    setApagados(lista);
    armazem.set(STORAGE_APAGADOS_KEY, JSON.stringify(lista)).catch((e) => notificar(`Não foi possível guardar os apagados: ${e?.message || e}`, "erro", 0));
  };
  const persistDe = {
    [STORAGE_KEY]: persist,
    [STORAGE_AUDITS_KEY]: persistAudits,
    [STORAGE_SANCOES_KEY]: persistSanctions,
    [STORAGE_OCORRENCIAS_KEY]: persistOcorrencias,
    [STORAGE_AVALIACOES_KEY]: persistAvaliacoes,
    [STORAGE_RISCOS_KEY]: persistRiscos,
    [STORAGE_OBJETIVOS_KEY]: persistObjetivos,
    [STORAGE_DOCUMENTOS_KEY]: persistDocumentos,
    [STORAGE_FORMACAO_KEY]: persistFormacao,
    [STORAGE_ESPACOS_KEY]: persistEspacos,
    [STORAGE_EVENTOS_KEY]: persistEventos,
    [STORAGE_DESISTENCIAS_KEY]: persistDesistencias,
    [STORAGE_EXPERIENCIAS_KEY]: persistExperiencias,
    [STORAGE_DESVINC_KEY]: persistDesvinc,
    [STORAGE_PLANO_INQ_KEY]: persistPlanoInq,
    [STORAGE_INQUERITOS_KEY]: persistInqueritos,
    [STORAGE_RESPOSTAS_KEY]: persistRespostas,
  };
  const reporApagados = (entradas) => {
    const porChave = {};
    entradas.forEach((a) => (porChave[a.chave] = porChave[a.chave] || []).push(a));
    const repostos = [];
    Object.entries(porChave).forEach(([chave, l]) => {
      const gravar = persistDe[chave];
      if (!gravar) return;
      let valor = ultimoGuardado[chave];
      [...l].sort((a, b) => (a.posicao || 0) - (b.posicao || 0)).forEach((a) => {
        const v = reporEm(valor, a.caminho || [], a.item, a.posicao);
        if (v) valor = v;
        repostos.push(a.id);
      });
      gravar(valor);
    });
    guardarApagados(apagadosRef.current.filter((a) => !repostos.includes(a.id)));
    notificar(repostos.length === 1 ? "Reposto." : `${repostos.length} registos repostos.`);
  };
  definirAoRemoverRegistos((chave, rem) => {
    const em = new Date().toISOString();
    const novos = rem.map((r, k) => ({ id: `ap_${Date.now().toString(36)}_${k}_${Math.random().toString(36).slice(2, 6)}`, chave, caminho: r.caminho, posicao: r.posicao, item: r.item, rotulo: rotuloApagado(chave, r.item, r.caminho), em }));
    guardarApagados(limparAntigos([...novos, ...apagadosRef.current]));
    const txt = novos.length === 1 ? `Apagado: ${novos[0].rotulo}` : `${novos.length} registos apagados (${LISTAS_COM_LIXO[chave]}).`;
    notificar(txt, "ok", 9000, { rotulo: "Desfazer", fn: () => reporApagados(novos) });
  });

  const persistInscritos = useCallback(async (next) => {
    setInscritos(next);
    try {
      await armazem.set(STORAGE_INSCRITOS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar inscritos:", e);
      notificar(`Não foi possível guardar os inscritos: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistTurmas = useCallback(async (next) => {
    setTurmasAlunos(next);
    try {
      await armazem.set(STORAGE_TURMAS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar turmas:", e);
      notificar(`Não foi possível guardar as turmas: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistEpocaAnterior = useCallback(async (next) => {
    setEpocaAnterior(next);
    try {
      await armazem.set(STORAGE_EPOCA_ANT_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Erro ao guardar época anterior:", e);
      notificar(`Não foi possível guardar a época anterior: ${e?.message || e}`, "erro", 0);
    }
  }, []);

  const persistLearned = useCallback(async (next) => {
    setLearned(next);
    try {
      await armazem.set(STORAGE_TRIAGEM_KEY, JSON.stringify(next));
    } catch (e) {
      // falha silenciosa — não é crítico, a triagem só fica sem aprender desta vez
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await armazem.get(STORAGE_KEY);
        if (res && res.value) setEntries(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await armazem.get(STORAGE_OPTIONS_KEY);
        if (res && res.value) setOptions({ schools: [], categories: [], auditCategories: [], complaintCategories: DEFAULT_CATEGORIAS, sanctionTypes: DEFAULT_TIPOS_SANCAO, auditAreas: DEFAULT_AREAS_AUDITORIA, turmas: DEFAULT_TURMAS, niveis: DEFAULT_NIVEIS, turmasPorEscola: {}, motivosDesistencia: DEFAULT_MOTIVOS_DESISTENCIA, categoriasSatisfacao: DEFAULT_CATEGORIAS_SATISFACAO, espacosLista: DEFAULT_ESPACOS, mapaEscaloes: {}, tiposEvento: DEFAULT_TIPOS_EVENTO, dimensoesInquerito: DEFAULT_DIMENSOES_INQ, tipologiasInq: DEFAULT_TIPOLOGIAS_INQ, causasRaiz: DEFAULT_CAUSAS_RAIZ, categoriasOcorrencia: DEFAULT_CATEGORIAS_OCORRENCIA, ...JSON.parse(res.value) });
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await armazem.get(STORAGE_AUDITS_KEY);
        if (res && res.value) setAudits(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await armazem.get(STORAGE_SANCOES_KEY);
        if (res && res.value) setSanctions(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await armazem.get(STORAGE_INSCRITOS_KEY);
        if (res && res.value) setInscritos(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await armazem.get(STORAGE_TURMAS_KEY);
        if (res && res.value) setTurmasAlunos(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      try {
        const res = await armazem.get(STORAGE_EPOCA_ANT_KEY);
        if (res && res.value) setEpocaAnterior(JSON.parse(res.value));
      } catch (e) {
        // chave ainda não existe — arranque limpo
      }
      for (const [chave, setter] of [
        [STORAGE_DESISTENCIAS_KEY, setDesistencias],
        [STORAGE_EXPERIENCIAS_KEY, setExperiencias],
        [STORAGE_ALUNOS_KEY, setRegistoAlunos],
        [STORAGE_DESVINC_KEY, setDesvinculacoes],
        [STORAGE_ESPACOS_KEY, setEspacos],
        [STORAGE_EVENTOS_KEY, setEventos],
        [STORAGE_RISCOS_KEY, setRiscos],
        [STORAGE_OBJETIVOS_KEY, setObjetivos],
        [STORAGE_DOCUMENTOS_KEY, setDocumentos],
        [STORAGE_FORMACAO_KEY, setFormacao],
        [STORAGE_APAGADOS_KEY, (v) => setApagados(limparAntigos(v))],
        [STORAGE_OCORRENCIAS_KEY, setOcorrencias],
        [STORAGE_AVALIACOES_KEY, setAvaliacoes],
        [STORAGE_RADAR_KEY, setRadar],
        [STORAGE_SATISFACAO_KEY, setSatisfacao],
        [STORAGE_INQUERITOS_KEY, setInqueritos],
        [STORAGE_NOTAS_REL_KEY, setNotasRelatorio],
        [STORAGE_PLANO_INQ_KEY, setPlanoInq],
        [STORAGE_RESPOSTAS_KEY, (v) => setRespostasTipo(juntarRespostasPadrao(v))],
      ]) {
        try {
          const r = await armazem.get(chave);
          if (r && r.value) setter(JSON.parse(r.value));
        } catch (e) {
          // chave ainda não existe — arranque limpo
        }
      }
      try {
        const res = await armazem.get(STORAGE_TRIAGEM_KEY);
        if (res && res.value) setLearned({ canal: {}, categoria: {}, tema: {}, gravidade: {}, ...JSON.parse(res.value) });
      } catch (e) {
        // chave ainda não existe — arranque limpo, aprende a partir de agora
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addOption = (kind, value) => {
    const lista = options[kind] || [];
    if (lista.includes(value)) return;
    persistOptions({ ...options, [kind]: [...lista, value] });
  };

  const removeOption = (kind, value) => {
    const lista = options[kind] || [];
    persistOptions({ ...options, [kind]: lista.filter((v) => v !== value) });
  };

  const addAudit = (audit) => {
    persistAudits([...audits, audit]);
    setShowAuditForm(false);
  };

  const updateAudit = (auditId, patch) => {
    const next = audits.map((a) => (a.id === auditId ? { ...a, ...patch } : a));
    persistAudits(next);
    setViewingAudit(next.find((a) => a.id === auditId));
  };

  const removeAudit = (auditId) => {
    persistAudits(audits.filter((a) => a.id !== auditId));
    setViewingAudit(null);
  };

  const addFinding = (auditId, finding) => {
    const next = audits.map((a) => (a.id === auditId ? { ...a, findings: [...a.findings, finding] } : a));
    persistAudits(next);
    setViewingAudit(next.find((a) => a.id === auditId));
  };

  const updateFinding = (auditId, findingId, patch) => {
    const next = audits.map((a) =>
      a.id === auditId ? { ...a, findings: a.findings.map((f) => (f.id === findingId ? { ...f, ...patch } : f)) } : a
    );
    persistAudits(next);
    setViewingAudit(next.find((a) => a.id === auditId));
  };

  // Várias constatações de uma vez (ex.: preencher área e categoria), numa só gravação.
  const updateFindings = (alteracoes) => {
    const porAud = {};
    alteracoes.forEach(({ auditId, findingId, patch }) => ((porAud[auditId] = porAud[auditId] || {})[findingId] = patch));
    const next = audits.map((a) => (porAud[a.id] ? { ...a, findings: (a.findings || []).map((f) => (porAud[a.id][f.id] ? { ...f, ...porAud[a.id][f.id] } : f)) } : a));
    persistAudits(next);
    if (viewingAudit) setViewingAudit(next.find((a) => a.id === viewingAudit.id) || null);
    // A área escolhida para cada categoria fica a servir de pista para as próximas.
    const guardar = {};
    alteracoes.forEach(({ patch }) => patch.category && patch.area && (guardar[normChave(patch.category)] = patch.area));
    if (Object.keys(guardar).length) persistOptions({ ...options, mapaAreasAud: { ...(options.mapaAreasAud || {}), ...guardar } });
    notificar(`Área e categoria atualizadas em ${alteracoes.length} ${alteracoes.length === 1 ? "constatação" : "constatações"}.`);
  };

  const removeFinding = (auditId, findingId) => {
    const next = audits.map((a) => (a.id === auditId ? { ...a, findings: a.findings.filter((f) => f.id !== findingId) } : a));
    persistAudits(next);
    setViewingAudit(next.find((a) => a.id === auditId));
  };

  const addNote = (entryId, text) => {
    const next = entries.map((e) =>
      e.id === entryId ? { ...e, notes: [...(e.notes || []), { id: `n_${Date.now()}`, text, date: new Date().toISOString() }] } : e
    );
    persist(next);
    setViewingDetail(next.find((e) => e.id === entryId));
  };

  const saveSanction = (sanction) => {
    const exists = sanctions.some((s) => s.id === sanction.id);
    const next = exists ? sanctions.map((s) => (s.id === sanction.id ? sanction : s)) : [...sanctions, sanction];
    persistSanctions(next);
    setShowSanctionForm(false);
  };

  const removeSanction = (id) => {
    persistSanctions(sanctions.filter((s) => s.id !== id));
    setViewingSanction(null);
  };

  const updateSanction = (id, patch) => {
    const next = sanctions.map((s) => (s.id === id ? { ...s, ...patch } : s));
    persistSanctions(next);
    setViewingSanction(next.find((s) => s.id === id));
  };

  const addSanctionNote = (id, text) => {
    const next = sanctions.map((s) =>
      s.id === id ? { ...s, notes: [...(s.notes || []), { id: `n_${Date.now()}`, text, date: new Date().toISOString() }] } : s
    );
    persistSanctions(next);
    setViewingSanction(next.find((s) => s.id === id));
  };

  const saveSemanaInscritos = (escola, semana, dados) => {
    const lista = inscritos[escola] || [];
    const existe = lista.some((r) => r.semana === semana);
    const nova = existe ? lista.map((r) => (r.semana === semana ? { ...r, ...dados, semana } : r)) : [...lista, { semana, ...dados }];
    persistInscritos({ ...inscritos, [escola]: nova });
  };

  // Retrato semanal: os totais vêm das turmas, as desistências dos registos
  // dessa semana e as novas inscrições das experiências convertidas. Nada é
  // escrito à mão, para não haver dois sítios a dizer coisas diferentes.
  const guardarRetrato = (semana) => {
    const [ano, sem] = String(semana).split("-W");
    const inicio = new Date(Date.UTC(+ano, 0, 4));
    inicio.setUTCDate(inicio.getUTCDate() - ((inicio.getUTCDay() + 6) % 7) + (+sem - 1) * 7);
    const fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + 6);
    const naSemana = (d) => {
      if (!d) return false;
      const x = new Date(d + "T00:00:00Z");
      return x >= inicio && x <= fim;
    };

    // Constrói o estado completo e grava uma única vez: gravar escola a escola
    // partiria sempre do estado antigo e só a última sobreviveria.
    const proximo = { ...inscritos };
    let guardadas = 0;
    (options.schools || []).forEach((escola) => {
      const doEscola = turmasAlunos.filter((t) => t.escola === escola);
      if (doEscola.length === 0) return;
      const total = doEscola.reduce((n, t) => n + t.m + t.f, 0);
      const desist = desistencias.filter((d) => d.escola === escola && naSemana(d.data)).reduce((n, d) => n + d.n, 0);
      const novas = experiencias
        .filter((x) => x.escola === escola && x.resultado === "sucesso" && naSemana(x.data))
        .reduce((n, x) => n + (x.entraram || x.n), 0);
      const lista = proximo[escola] || [];
      const existe = lista.some((r) => r.semana === semana);
      proximo[escola] = existe
        ? lista.map((r) => (r.semana === semana ? { ...r, semana, total, novas, desist } : r))
        : [...lista, { semana, total, novas, desist }];
      guardadas += 1;
    });

    if (guardadas === 0) {
      notificar("Não há turmas com alunos registados para fazer o retrato.", "aviso");
      return;
    }
    persistInscritos(proximo);
    notificar(`Retrato guardado para ${guardadas} escola(s).`);
  };

  // Guarda as correspondências entre as nomenclaturas do Excel e as turmas da
  // app, para a importação seguinte já vir resolvida.
  const guardarMapaEscaloes = (mapa) => {
    persistOptions({ ...options, mapaEscaloes: { ...(options.mapaEscaloes || {}), ...mapa } });
  };

  // Estado que sai do registo de alunos, para recalcular de uma vez.
  const estadoAlunos = () => ({ registo: registoAlunos, turmas: turmasAlunos, inscritos, desist: desistencias, exps: experiencias, epAnt: epocaAnterior });
  const gravarEstadoAlunos = (st) => {
    if (st.registo !== registoAlunos) persistRegistoAlunos(st.registo);
    if (st.turmas !== turmasAlunos) persistTurmas(st.turmas);
    if (st.inscritos !== inscritos) persistInscritos(st.inscritos);
    if (st.desist !== desistencias) persistDesistencias(st.desist);
    if (st.exps !== experiencias) persistExperiencias(st.exps);
    if (st.epAnt !== epocaAnterior) persistEpocaAnterior(st.epAnt);
  };

  // Recalcula o que sai do registo de uma época: turmas e balanço semanal (época em curso),
  // totais da época passada, desistências e experiências importadas. reg null = época apagada.
  const derivarEpoca = (st0, ep, reg) => {
    const st = { ...st0 };
    const regAntigo = st0.registo[ep];
    st.registo = { ...st0.registo };
    if (reg) st.registo[ep] = reg;
    else delete st.registo[ep];
    const al = Object.values(reg?.alunos || {});
    const tocadas = new Set([...Object.values(regAntigo?.alunos || {}).map((a) => a.escola), ...al.map((a) => a.escola)]);
    const capacidades = options.capacidades || {};
    const epHoje = epocaDe(isoDe(new Date()));

    // Época passada: os totais finais de cada escola passam a ser a referência homóloga.
    if (ep === epAntDe(epHoje)) {
      st.epAnt = { ...st0.epAnt };
      tocadas.forEach((e) => {
        const daEscola = al.filter((a) => a.escola === e);
        if (daEscola.length) st.epAnt[e] = { ...(st.epAnt[e] || {}), inscritos: daEscola.filter((a) => a.estado === "ativo").length, desist: daEscola.filter((a) => a.estado === "desistiu").length };
        else if (st.epAnt[e]) {
          const { inscritos: _i, desist: _d, ...resto } = st.epAnt[e];
          st.epAnt[e] = resto;
        }
      });
    }

    // Época em curso: as contagens por turma e o balanço semanal saem dos alunos.
    if (ep === epHoje) {
      const grupos = new Map();
      al.filter((a) => a.estado === "ativo").forEach((a) => {
        const chave = `${a.escola}||${a.turma}||${a.ano || 0}`;
        const g = grupos.get(chave) || { escola: a.escola, turma: a.turma, ano: a.ano || 0, m: 0, f: 0, renov: 0, novos: 0, extra: 0 };
        if (a.genero === "f") g.f += 1;
        else g.m += 1;
        if (a.rubrica === "renov") g.renov += 1;
        else if (a.rubrica === "extra") g.extra += 1;
        else g.novos += 1;
        const cap = capacidades[`${a.escola}|${a.turma}`];
        if (cap) g.cap = cap;
        grupos.set(chave, g);
      });
      st.turmas = [...st0.turmas.filter((t) => !tocadas.has(t.escola)), ...grupos.values()];
      const inicios = [reg?.semana1, regAntigo?.semana1, semana1Padrao(ep)].filter(Boolean).sort();
      const ini = semanaISO(new Date(inicios[0] + "T12:00:00"));
      st.inscritos = { ...st0.inscritos };
      tocadas.forEach((e) => {
        const bal = reg ? balancoSemanal(reg, e, ep) : [];
        const antes = (st.inscritos[e] || []).filter((x) => x.semana < ini);
        st.inscritos[e] = [...antes, ...bal.map((b) => ({ semana: b.semana, total: b.ativos, novas: b.entradas, desist: b.desist }))].sort((x, y) => x.semana.localeCompare(y.semana));
      });
    }

    // Desistências e experiências importadas (substituem as anteriores desta época).
    const desistNovas = al
      .filter((a) => a.estado === "desistiu")
      .map((a) => ({ id: `d_${ep}_${a.id}`, alunoId: a.id, epoca: ep, escola: a.escola, turma: a.turma, n: 1, motivo: a.motivo || "Não definido", data: a.saida, origem: "importacao" }));
    const idsDesist = new Set(desistNovas.map((d) => String(d.alunoId)));
    st.desist = [...st0.desist.filter((d) => !(d.origem === "importacao" && d.epoca === ep) && !(d.alunoId && idsDesist.has(String(d.alunoId)) && d.epoca === ep)), ...desistNovas];
    const antigas = Object.fromEntries(st0.exps.filter((x) => x.alunoId && x.epoca === ep).map((x) => [String(x.alunoId), x]));
    const expNovas = Object.values(reg?.experiencias || {}).map((x) => {
      const aluno = reg.alunos[x.id];
      const ant = antigas[x.id];
      return {
        id: `x_${ep}_${x.id}`,
        alunoId: x.id,
        epoca: ep,
        escola: x.escola,
        turma: aluno ? aluno.turma : x.turma || (ant && ant.turma) || "",
        n: 1,
        data: x.data,
        // Uma decisão tomada à mão (não converteu) mantém-se; a decidida pela importação anterior não.
        resultado: x.resultado === "pendente" && ant && ant.manual && ant.resultado !== "pendente" && ant.resultado !== "sucesso" ? ant.resultado : x.resultado || (aluno ? "sucesso" : "pendente"),
        ...(ant && ant.manual ? { manual: true } : {}),
        // O que o operacional ou a app registaram (motivo, detalhe, aviso ao coordenador) não se perde na importação.
        ...Object.fromEntries(["motivo", "nota", "decididoPor", "coordAvisado", "turmaFicou"].filter((k) => ant && ant[k] !== undefined).map((k) => [k, ant[k]])),
        entraram: aluno ? 1 : 0,
        origem: "importacao",
      };
    });
    const idsExp = new Set(expNovas.map((x) => String(x.alunoId)));
    st.exps = [...st0.exps.filter((x) => !(x.origem === "importacao" && x.epoca === ep) && !(x.alunoId && x.epoca === ep && idsExp.has(String(x.alunoId)))), ...expNovas];
    return st;
  };

  const importarInscritos = (r) => {
    const ep = r.epoca;
    // Experiências registadas à mão: convertem-se se o código aparecer nos inscritos.
    const expManuais = experiencias.filter((x) => (x.origem === "manual" || x.origem === "operacional") && x.epoca === ep && x.alunoId && !r.experiencias[x.alunoId]);
    expManuais.forEach(
      (x) => (r.experiencias[x.alunoId] = { id: x.alunoId, escola: x.escola, data: x.data, ...(x.turma ? { turma: x.turma } : {}), ...(x.resultado && x.resultado !== "pendente" ? { resultado: x.resultado } : {}) })
    );
    const reg = { semana1: r.semana1, avisos: r.avisos, alunos: r.alunos, experiencias: r.experiencias, importacoes: r.importacoes };
    const al = Object.values(r.alunos);

    // Listas: escolas novas, nomes de turmas, turmas de cada escola, motivos e correspondências.
    const listaTurmas = options.turmas || DEFAULT_TURMAS;
    const tpe = { ...(options.turmasPorEscola || {}) };
    al.forEach((a) => {
      const l = tpe[a.escola] || [];
      if (!l.includes(a.turma)) tpe[a.escola] = [...l, a.turma];
    });
    const motivosAtuais = options.motivosDesistencia || DEFAULT_MOTIVOS_DESISTENCIA;
    persistOptions({
      ...options,
      schools: [...options.schools, ...r.novasEscolas.filter((e) => !options.schools.includes(e))],
      turmas: [...listaTurmas, ...[...new Set(al.map((a) => a.turma))].filter((t) => !listaTurmas.includes(t))],
      turmasPorEscola: tpe,
      mapaTurmasAlunos: { ...(options.mapaTurmasAlunos || {}), ...r.mapaTurmas },
      mapaEscolasAlunos: { ...(options.mapaEscolasAlunos || {}), ...(r.mapaEscolas || {}) },
      motivosDesistencia: [...motivosAtuais, ...r.motivos.filter((m) => !motivosAtuais.includes(m))],
    });
    const st = derivarEpoca(estadoAlunos(), ep, reg);
    gravarEstadoAlunos(st);
    const expNovas = st.exps.filter((x) => x.origem === "importacao" && x.epoca === ep);
    notificar(`${r.ativos} alunos importados · ${r.desistNovas} desistências novas · ${expNovas.length} experiências.`);
  };

  // "Inscritos atualmente": acerta só a equipa. A mudança fica marcada e a importação semanal
  // respeita-a enquanto o mapa de acompanhamento continuar a trazer a turma antiga.
  const aplicarInscritosAtuais = (ep, mudancas, mapaTurmas = {}, acoes = []) => {
    const reg = registoAlunos[ep];
    if (!reg || (!mudancas.length && !acoes.length)) return;
    const alunos = { ...reg.alunos };
    const tpe = { ...(options.turmasPorEscola || {}) };
    const novasTurmas = [];
    const motivos = [];
    const s1 = reg.semana1 || semana1Padrao(ep);
    const hoje = isoDe(new Date());
    const conta = { equipa: 0, desistiu: 0, reativar: 0, escola: 0, adicionar: 0 };
    const registaTurma = (escola, turma) => {
      const l = tpe[escola] || [];
      if (!l.includes(turma)) tpe[escola] = [...l, turma];
      novasTurmas.push(turma);
    };
    // Equipa nova marcada: a importação semanal respeita-a enquanto o acompanhamento trouxer a antiga.
    const comEquipa = (a, escola, turma) =>
      a.turma === turma && a.escola === escola ? a : { ...a, escola, turma, turmaManual: true, turmaFicheiro: a.turmaFicheiro || a.turmaAntes || a.turma, turmaAntes: a.turma, mudadoPor: "mapa" };
    mudancas.forEach((m) => {
      const a = alunos[m.id];
      if (!a || a.turma === m.para) return;
      alunos[m.id] = comEquipa(a, a.escola, m.para);
      registaTurma(a.escola, m.para);
      conta.equipa++;
    });
    acoes.forEach((x) => {
      const a = alunos[x.id];
      if (x.acao === "adicionar") {
        if (a) return;
        const entrada = x.entrada || hoje;
        alunos[x.id] = { id: x.id, escola: x.escola, turma: x.turma, ano: null, genero: "", rubrica: "", entrada, semEntrada: semanaDaEpoca(entrada, s1), estado: "ativo", semCodigo: false, saida: null, motivo: null, origem: "mapa" };
        registaTurma(x.escola, x.turma);
        conta.adicionar++;
        return;
      }
      if (!a) return;
      if (x.acao === "desistiu") {
        alunos[x.id] = { ...a, estado: "desistiu", saida: x.saida || hoje, semSaida: semanaDaEpoca(x.saida || hoje, s1), motivo: x.motivo };
        motivos.push(x.motivo);
        conta.desistiu++;
      } else if (x.acao === "reativar") {
        const { semSaida: _s, ...resto } = a; // eslint-disable-line no-unused-vars
        alunos[x.id] = comEquipa({ ...resto, estado: "ativo", saida: null, motivo: null }, x.escola, x.turma);
        registaTurma(x.escola, x.turma);
        conta.reativar++;
      } else if (x.acao === "mudarEscola" || x.acao === "turma") {
        alunos[x.id] = comEquipa(a, x.escola, x.turma);
        registaTurma(x.escola, x.turma);
        conta[x.acao === "mudarEscola" ? "escola" : "equipa"]++;
      }
    });
    const listaTurmas = options.turmas || DEFAULT_TURMAS;
    const motivosAtuais = options.motivosDesistencia || DEFAULT_MOTIVOS_DESISTENCIA;
    persistOptions({
      ...options,
      turmas: [...listaTurmas, ...[...new Set(novasTurmas)].filter((t) => !listaTurmas.includes(t))],
      turmasPorEscola: tpe,
      mapaTurmasAlunos: { ...(options.mapaTurmasAlunos || {}), ...mapaTurmas },
      motivosDesistencia: [...motivosAtuais, ...[...new Set(motivos)].filter((m) => m && !motivosAtuais.includes(m))],
    });
    gravarEstadoAlunos(derivarEpoca(estadoAlunos(), ep, { ...reg, alunos }));
    const partes = [
      conta.equipa && `${conta.equipa} mudaram de equipa`,
      conta.escola && `${conta.escola} mudaram de escola`,
      conta.desistiu && `${conta.desistiu} dados como desistidos`,
      conta.reativar && `${conta.reativar} reativados`,
      conta.adicionar && `${conta.adicionar} adicionados`,
    ].filter(Boolean);
    notificar(`Mapa de inscritos atuais: ${partes.join(" · ") || "sem alterações"}.`);
  };

  // Apagar dados de forma seletiva. f = { epocas, escola, tipo, turma, id, retirarEscola }.
  // tipo: "tudo" | "desist" | "exp" | "turma" | "aluno". Com simular devolve só as contagens.
  const apagarDadosAlunos = (f, simular) => {
    const { epocas, escola, tipo, turma, id, retirarEscola } = f;
    const naEpoca = (x) => epocas.includes(x.epoca);
    const daEscola = (x) => !escola || x.escola === escola;
    const idOk = (v) => String(v) === String(id).trim();
    const alvoAluno = (a) => daEscola(a) && (tipo === "tudo" || (tipo === "desist" && a.estado === "desistiu") || (tipo === "turma" && a.turma === turma) || (tipo === "aluno" && idOk(a.id)));
    const alvoExp = (x) => daEscola(x) && (tipo === "tudo" || tipo === "exp" || (tipo === "aluno" && idOk(x.id)));
    const alvoDesistReg = (d) => naEpoca(d) && daEscola(d) && (tipo === "tudo" || tipo === "desist" || (tipo === "turma" && d.turma === turma) || (tipo === "aluno" && idOk(d.alunoId)));
    const alvoExpReg = (x) => naEpoca(x) && daEscola(x) && (tipo === "tudo" || tipo === "exp" || (tipo === "aluno" && idOk(x.alunoId)));
    // Semanas do registo semanal antigo (antes dos ficheiros) só saem quando se apaga tudo.
    const alvoSemana = (e, w) => tipo === "tudo" && (!escola || e === escola) && epocas.includes(epocaDaSemanaISO(w));

    const conta = { alunos: 0, desist: 0, exps: 0, semanas: 0 };
    epocas.forEach((ep) => {
      const r = registoAlunos[ep];
      if (!r) return;
      conta.alunos += Object.values(r.alunos || {}).filter(alvoAluno).length;
      conta.exps += Object.values(r.experiencias || {}).filter(alvoExp).length;
    });
    conta.desist = desistencias.filter((d) => d.origem !== "importacao" && alvoDesistReg(d)).length + epocas.reduce((n, ep) => n + Object.values(registoAlunos[ep]?.alunos || {}).filter((a) => a.estado === "desistiu" && alvoAluno(a)).length, 0);
    conta.exps += experiencias.filter((x) => x.origem !== "importacao" && alvoExpReg(x)).length;
    Object.entries(inscritos).forEach(([e, l]) => (conta.semanas += (l || []).filter((x) => alvoSemana(e, x.semana)).length));
    if (simular) return conta;

    let st = estadoAlunos();
    st = {
      ...st,
      desist: st.desist.filter((d) => !alvoDesistReg(d)),
      exps: st.exps.filter((x) => !alvoExpReg(x)),
      inscritos: Object.fromEntries(Object.entries(st.inscritos).map(([e, l]) => [e, (l || []).filter((x) => !alvoSemana(e, x.semana))])),
    };
    epocas.forEach((ep) => {
      const r = st.registo[ep];
      if (!r) return;
      const alunos = Object.fromEntries(Object.entries(r.alunos || {}).filter(([, a]) => !alvoAluno(a)));
      const exps = Object.fromEntries(
        Object.entries(r.experiencias || {})
          .filter(([, x]) => !alvoExp(x))
          .map(([k, x]) => [k, x.resultado === "sucesso" && !alunos[x.id] ? { ...x, resultado: "insucesso" } : x])
      );
      const vazio = !Object.keys(alunos).length && !Object.keys(exps).length;
      st = derivarEpoca(st, ep, vazio ? null : { ...r, alunos, experiencias: exps });
    });
    // Escola que deixou de existir: sai de todo o lado (as reclamações e auditorias ficam).
    if (escola && tipo === "tudo" && epocas.length === epocasComDados.length) {
      const { [escola]: _i, ...insc } = st.inscritos;
      const { [escola]: _a, ...epA } = st.epAnt;
      st = { ...st, inscritos: insc, epAnt: epA, turmas: st.turmas.filter((t) => t.escola !== escola) };
      if (retirarEscola) {
        const { [escola]: _t, ...tpe } = options.turmasPorEscola || {};
        persistOptions({ ...options, schools: options.schools.filter((e) => e !== escola), turmasPorEscola: tpe });
      }
    }
    gravarEstadoAlunos(st);
    notificar(`Apagado: ${conta.alunos} alunos · ${conta.desist} desistências · ${conta.exps} experiências.`);
    return conta;
  };

  // Igualar o nome de uma turma numa época (em todas as escolas). Os próximos ficheiros
  // passam a usar o nome novo.
  const renomearTurmaEpoca = (ep, de, para) => {
    const r = registoAlunos[ep];
    if (!r || !para || de === para) return;
    const alunos = Object.fromEntries(Object.entries(r.alunos).map(([k, a]) => [k, a.turma === de ? { ...a, turma: para } : a]));
    let st = estadoAlunos();
    st = { ...st, desist: st.desist.map((d) => (d.epoca === ep && d.turma === de ? { ...d, turma: para } : d)) };
    st = derivarEpoca(st, ep, { ...r, alunos });
    gravarEstadoAlunos(st);
    const mapa = Object.fromEntries(Object.entries(options.mapaTurmasAlunos || {}).map(([k, v]) => [k, v === de ? para : v]));
    const tpe = Object.fromEntries(Object.entries(options.turmasPorEscola || {}).map(([e, l]) => [e, [...new Set(l.map((t) => (t === de ? para : t)))]]));
    const caps = { ...(options.capacidades || {}) };
    Object.keys(caps).forEach((k) => {
      const [e, t] = k.split("|");
      if (t === de) {
        if (!caps[`${e}|${para}`]) caps[`${e}|${para}`] = caps[k];
        delete caps[k];
      }
    });
    const lista = options.turmas || DEFAULT_TURMAS;
    persistOptions({ ...options, mapaTurmasAlunos: mapa, turmasPorEscola: tpe, capacidades: caps, turmas: lista.includes(para) ? lista : [...lista, para] });
    notificar(`"${de}" passou a "${para}" em ${ep}.`);
  };

  // Mudar o nome de uma turma, a qualquer momento: nas épocas escolhidas e, se indicada,
  // só numa escola. Passa para os alunos, desistências, experiências, horários dos espaços,
  // lotações e para a correspondência dos próximos ficheiros. Se o nome novo já existir, as turmas juntam-se.
  const renomearTurmaLivre = ({ de, para, epocas, escola }) => {
    const novo = String(para || "").trim();
    if (!de || !novo || de === novo) return;
    const bate = (o) => o && o.turma === de && (!escola || o.escola === escola);
    const troca = (o) => (bate(o) ? { ...o, turma: novo } : o);
    const eps = new Set(epocas);
    let st = estadoAlunos();
    st = {
      ...st,
      desist: st.desist.map((d) => (eps.has(d.epoca || epocaDe(d.data)) ? troca(d) : d)),
      exps: st.exps.map((x) => (eps.has(x.epoca || epocaDe(x.data)) ? troca(x) : x)),
    };
    epocas
      .filter((ep) => st.registo[ep])
      .forEach((ep) => {
        const r = st.registo[ep];
        const alunos = Object.fromEntries(Object.entries(r.alunos || {}).map(([k, a]) => [k, troca(a)]));
        const experiencias = Object.fromEntries(Object.entries(r.experiencias || {}).map(([k, x]) => [k, troca(x)]));
        st = derivarEpoca(st, ep, { ...r, alunos, experiencias });
      });
    // Turmas escritas à mão (época atual sem ficheiro de alunos).
    const epHoje = epocaDe(isoDe(new Date()));
    if (eps.has(epHoje) && !st.registo[epHoje]) st = { ...st, turmas: st.turmas.map(troca) };
    gravarEstadoAlunos(st);

    if (eps.has(epHoje)) {
      const blocos = espacos.map((b) => {
        const ts = turmasDoBloco(b);
        if ((escola && b.escola !== escola) || !ts.includes(de)) return b;
        const novas = [...new Set(ts.map((t) => (t === de ? novo : t)))];
        return { ...b, turmas: novas, turma: novas.join(" + ") };
      });
      if (blocos.some((b, i) => b !== espacos[i])) persistEspacos(blocos);
    }

    const caps = { ...(options.capacidades || {}) };
    Object.keys(caps).forEach((k) => {
      const [e, t] = k.split("|");
      if (t === de && (!escola || e === escola)) {
        if (!caps[`${e}|${novo}`]) caps[`${e}|${novo}`] = caps[k];
        delete caps[k];
      }
    });
    const tpe = Object.fromEntries(Object.entries(options.turmasPorEscola || {}).map(([e, l]) => [e, !escola || e === escola ? [...new Set(l.map((t) => (t === de ? novo : t)))] : l]));
    const mapa = escola ? options.mapaTurmasAlunos || {} : Object.fromEntries(Object.entries(options.mapaTurmasAlunos || {}).map(([k, v]) => [k, v === de ? novo : v]));
    // Os próximos ficheiros com o nome antigo também passam a usar o novo (quando é para todas as escolas).
    if (!escola) mapa[normChave(de)] = novo;
    const lista = options.turmas || DEFAULT_TURMAS;
    persistOptions({ ...options, mapaTurmasAlunos: mapa, turmasPorEscola: tpe, capacidades: caps, turmas: lista.includes(novo) ? lista : [...lista, novo] });
    notificar(`"${de}" passou a "${novo}"${escola ? ` em ${escola}` : ""}${epocas.length === 1 ? ` (${epocas[0]})` : ""}.`);
  };

  // Dois nomes de turma que são mesmo turmas diferentes (deixa de sugerir igualá-los).
  // Igualar o nome de uma escola numa época: os alunos, experiências e desistências
  // dessa época passam para o nome novo, e os próximos ficheiros também.
  const renomearEscolaEpoca = (ep, de, para) => {
    const r = registoAlunos[ep];
    if (!r || !para || de === para) return;
    const troca = (o) => (o.escola === de ? { ...o, escola: para } : o);
    const alunos = Object.fromEntries(Object.entries(r.alunos || {}).map(([k, a]) => [k, troca(a)]));
    const exps = Object.fromEntries(Object.entries(r.experiencias || {}).map(([k, x]) => [k, troca(x)]));
    let st = estadoAlunos();
    st = { ...st, desist: st.desist.map((d) => (d.epoca === ep ? troca(d) : d)), exps: st.exps.map((x) => (x.epoca === ep ? troca(x) : x)) };
    st = derivarEpoca(st, ep, { ...r, alunos, experiencias: exps });
    gravarEstadoAlunos(st);
    const caps = { ...(options.capacidades || {}) };
    Object.keys(caps).forEach((k) => {
      const [e, t] = k.split("|");
      if (e === de) {
        if (!caps[`${para}|${t}`]) caps[`${para}|${t}`] = caps[k];
        delete caps[k];
      }
    });
    const tpe = { ...(options.turmasPorEscola || {}) };
    if (tpe[de]) {
      tpe[para] = [...new Set([...(tpe[para] || []), ...tpe[de]])];
      delete tpe[de];
    }
    persistOptions({
      ...options,
      schools: options.schools.includes(para) ? options.schools : [...options.schools, para],
      capacidades: caps,
      turmasPorEscola: tpe,
      mapaEscolasAlunos: Object.fromEntries(Object.entries(options.mapaEscolasAlunos || {}).map(([k, v]) => [k, v === de ? para : v])),
    });
    notificar(`Em ${ep}, "${de}" passou a "${para}".`);
  };

  // Escola encerrada a partir de uma época (ou reaberta). Fica nos números das épocas em que existiu.
  const definirEstadoEscola = (escola, encerradaEm) => {
    const atual = { ...(options.estadoEscolas || {}) };
    if (encerradaEm) atual[escola] = { ...(atual[escola] || {}), encerrada: encerradaEm };
    else delete atual[escola];
    persistOptions({ ...options, estadoEscolas: atual });
  };

  const marcarTurmasDistintas = (a, b, desfazer) => {
    const k = [normChave(a), normChave(b)].sort().join("|");
    const atual = options.turmasDistintas || [];
    persistOptions({ ...options, turmasDistintas: desfazer ? atual.filter((x) => x !== k) : [...new Set([...atual, k])] });
  };

  const epocasComDados = [...new Set([...Object.keys(registoAlunos), ...desistencias.map((d) => d.epoca), ...experiencias.map((x) => x.epoca), ...Object.values(inscritos).flatMap((l) => (l || []).map((x) => epocaDaSemanaISO(x.semana)))].filter(Boolean))].sort().reverse();
  const escolasComDados = [...new Set([...Object.values(registoAlunos).flatMap((r) => Object.values(r.alunos || {}).map((a) => a.escola)), ...desistencias.map((d) => d.escola), ...experiencias.map((x) => x.escola), ...Object.keys(inscritos).filter((e) => (inscritos[e] || []).length), ...turmasAlunos.map((t) => t.escola)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));

  const definirCapacidade = (escola, turma, cap) => {
    persistOptions({ ...options, capacidades: { ...(options.capacidades || {}), [`${escola}|${turma}`]: cap } });
    persistTurmas(turmasAlunos.map((t) => (t.escola === escola && t.turma === turma ? { ...t, cap } : t)));
  };

  const importarTurmas = (linhas, extra = {}) => {
    const substituir = new Set(extra.substituirEscolas || []);
    let atual = turmasAlunos.filter((r) => !substituir.has(r.escola));
    linhas.forEach((reg) => {
      const i = atual.findIndex((r) => r.escola === reg.escola && r.turma === reg.turma && r.ano === reg.ano);
      if (i >= 0) atual[i] = reg;
      else atual.push(reg);
    });
    persistTurmas(atual);
    // Evolução semanal a partir das datas de entrada (mantém as desistências já registadas).
    if (extra.serie && Object.keys(extra.serie).length) {
      const proximo = { ...inscritos };
      Object.entries(extra.serie).forEach(([escola, semanas]) => {
        const lista = [...(proximo[escola] || [])];
        semanas.forEach((x) => {
          const i = lista.findIndex((r) => r.semana === x.semana);
          if (i >= 0) lista[i] = { ...lista[i], total: x.total, novas: x.novas };
          else lista.push({ semana: x.semana, total: x.total, novas: x.novas, desist: 0 });
        });
        proximo[escola] = lista.sort((a, b) => a.semana.localeCompare(b.semana));
      });
      persistInscritos(proximo);
    }
  };

  const saveTurmaAlunos = (registo) => {
    const i = turmasAlunos.findIndex((r) => r.escola === registo.escola && r.turma === registo.turma && r.ano === registo.ano);
    const next = i >= 0 ? turmasAlunos.map((r, k) => (k === i ? registo : r)) : [...turmasAlunos, registo];
    persistTurmas(next);
  };

  const removeTurmaAlunos = (registo) => {
    persistTurmas(turmasAlunos.filter((r) => !(r.escola === registo.escola && r.turma === registo.turma && r.ano === registo.ano)));
  };

  const saveEpocaAnterior = (escola, dados) => {
    persistEpocaAnterior({ ...epocaAnterior, [escola]: { ...(epocaAnterior[escola] || {}), ...dados } });
  };

  const toggleTurmaEscola = (escola, turma) => {
    const mapa = options.turmasPorEscola || {};
    const atual = mapa[escola] || [];
    const nova = atual.includes(turma) ? atual.filter((t) => t !== turma) : [...atual, turma];
    persistOptions({ ...options, turmasPorEscola: { ...mapa, [escola]: nova } });
  };

  // Desistência desconta da turma: tira primeiro das femininas e o resto das
  // masculinas, porque não guardamos o género de quem saiu.
  const saveDesistencia = (reg) => {
    persistDesistencias([...desistencias, reg]);
    // Se o atleta está nos inscritos da época, passa a desistente.
    const r0 = reg.alunoId && registoAlunos[reg.epoca];
    if (r0 && r0.alunos[reg.alunoId]) {
      persistRegistoAlunos({
        ...registoAlunos,
        [reg.epoca]: { ...r0, alunos: { ...r0.alunos, [reg.alunoId]: { ...r0.alunos[reg.alunoId], estado: "desistiu", saida: reg.data, semSaida: semanaDaEpoca(reg.data, semana1Padrao(reg.epoca)), motivo: reg.motivo } } },
      });
    }
    const t = turmasAlunos.find((x) => x.escola === reg.escola && x.turma === reg.turma);
    if (t) {
      let resta = Math.min(reg.n, t.m + t.f);
      const tiraF = Math.min(t.f, resta);
      resta -= tiraF;
      saveTurmaAlunos({ ...t, f: t.f - tiraF, m: Math.max(0, t.m - resta) });
    }
  };
  const removeDesistencia = (id) => persistDesistencias(desistencias.filter((d) => d.id !== id));

  // Experiência convertida soma à turma, respeitando a capacidade.
  const updateExperiencia = (id, resultado) => {
    const x = experiencias.find((e) => e.id === id);
    if (!x) return;
    const t = turmasAlunos.find((y) => y.escola === x.escola && y.turma === x.turma);
    let entraram = x.entraram || 0;
    let aviso = null;

    if (resultado === "sucesso" && x.resultado !== "sucesso" && t) {
      const cap = t.cap || capacidadeSugerida(t.turma, options.niveis);
      const vagas = Math.max(0, cap - (t.m + t.f));
      entraram = Math.min(x.n, vagas);
      if (entraram > 0) saveTurmaAlunos({ ...t, m: t.m + entraram });
      if (entraram < x.n) {
        aviso = `A turma ${t.turma} tinha ${vagas} vaga(s): entraram ${entraram} de ${x.n}. Ajusta a capacidade se for preciso.`;
      }
    }
    if (x.resultado === "sucesso" && resultado !== "sucesso" && t && x.entraram) {
      saveTurmaAlunos({ ...t, m: Math.max(0, t.m - x.entraram) });
      entraram = 0;
    }
    persistExperiencias(experiencias.map((e) => (e.id === id ? { ...e, resultado, entraram, manual: true } : e)));
    return aviso;
  };
  const saveExperiencia = (reg) => {
    persistExperiencias([...experiencias, reg]);
    if (reg.alunoId && reg.epoca) {
      const r0 = registoAlunos[reg.epoca] || { alunos: {}, experiencias: {}, importacoes: [] };
      persistRegistoAlunos({ ...registoAlunos, [reg.epoca]: { ...r0, experiencias: { ...r0.experiencias, [reg.alunoId]: { id: reg.alunoId, escola: reg.escola, data: reg.data } } } });
    }
  };
  const removeExperiencia = (id) => persistExperiencias(experiencias.filter((e) => e.id !== id));
  const turmaFicouExperiencia = (id, turma) => persistExperiencias(experiencias.map((e) => (e.id === id ? { ...e, turmaFicou: turma || undefined } : e)));
  const motivoExperiencia = (id, motivo) => persistExperiencias(experiencias.map((e) => (e.id === id ? { ...e, motivo: motivo || undefined, manual: true } : e)));
  // Códigos que os operacionais indicaram para as turmas sem alunos: o aluno passa para essa turma (e escola).
  const aplicarIdsOperacional = (pedido) => {
    const ep = (pedido.itens && pedido.itens.epoca) || epocaDe(isoDe(new Date()));
    const reg = registoAlunos[ep];
    const naoEncontrados = [];
    let mudados = 0;
    if (!reg) return { mudados, naoEncontrados: Object.values(pedido.respostas.turmas || {}).flat() };
    const alunos = { ...reg.alunos };
    Object.entries(pedido.respostas.turmas || {}).forEach(([turma, ids]) =>
      (ids || []).forEach((id) => {
        const a = alunos[id];
        if (!a) return naoEncontrados.push(id);
        if (a.turma === turma && a.escola === pedido.escola) return;
        alunos[id] = { ...a, turma, escola: pedido.escola, turmaAntes: a.turma, mudadoPor: "operacional" };
        mudados++;
      })
    );
    if (mudados) gravarEstadoAlunos(derivarEpoca(estadoAlunos(), ep, { ...reg, alunos }));
    return { mudados, naoEncontrados };
  };

  // Respostas dos operacionais já validadas no painel "Por validar". Cada item:
  // { tipo: "exp" | "nova" | "turma" | "alteracao", epoca, escola, id, valor, turma, ids }.
  // Tudo numa só gravação, para as mudanças não se atropelarem.
  const aplicarRespostasOperacionais = (itens) => {
    const r = { exp: 0, nova: 0, mudados: 0, naoEncontrados: [] };
    let st = estadoAlunos();
    let exps = [...st.exps];
    [...new Set(itens.map((i) => i.epoca))].forEach((ep) => {
      const reg = st.registo[ep] || { alunos: {}, experiencias: {}, importacoes: [] };
      const alunos = { ...(reg.alunos || {}) };
      const regExp = { ...(reg.experiencias || {}) };
      const mudaTurma = (id, turma, escola) => {
        const a = alunos[id];
        if (!a) return r.naoEncontrados.push(id);
        if (a.turma === turma && a.escola === escola) return;
        alunos[id] = { ...a, turma, escola, turmaAntes: a.turma, mudadoPor: "operacional" };
        r.mudados++;
      };
      itens
        .filter((i) => i.epoca === ep)
        .forEach((i) => {
          const v = i.valor || {};
          if (i.tipo === "exp" || i.tipo === "nova") {
            const res = v.r;
            const manual = res !== "pendente";
            const existe = exps.some((x) => x.alunoId === i.id && x.epoca === ep && x.escola === i.escola);
            if (existe) {
              exps = exps.map((x) =>
                x.alunoId === i.id && x.epoca === ep && x.escola === i.escola
                  ? { ...x, resultado: res, manual, decididoPor: "operacional", motivo: v.motivo || undefined, nota: v.nota || undefined, turma: x.turma || v.turma || undefined, turmaFicou: res === "sucesso" ? v.turmaFicou || x.turmaFicou || undefined : undefined }
                  : x
              );
            } else {
              exps.push({ id: `x_${ep}_${i.id}`, alunoId: i.id, epoca: ep, escola: i.escola, turma: v.turma, n: 1, data: v.data, resultado: res, manual, origem: "operacional", decididoPor: "operacional", motivo: v.motivo || undefined, nota: v.nota || undefined, entraram: 0, turmaFicou: res === "sucesso" ? v.turmaFicou || undefined : undefined });
            }
            regExp[i.id] = regExp[i.id] ? { ...regExp[i.id], resultado: res, motivo: v.motivo || undefined, turma: regExp[i.id].turma || v.turma } : { id: i.id, escola: i.escola, data: v.data, turma: v.turma, resultado: res, motivo: v.motivo || undefined };
            r[i.tipo]++;
          } else if (i.tipo === "turma") (i.ids || []).forEach((id) => mudaTurma(id, i.turma, i.escola));
          else if (i.tipo === "alteracao") mudaTurma(i.id, i.turma, i.escola);
        });
      st = derivarEpoca({ ...st, exps }, ep, { ...reg, alunos, experiencias: regExp });
    });
    gravarEstadoAlunos(st);
    return r;
  };

  // Mudanças de turma propostas pelos operacionais e validadas na app: [{ epoca, escola, aluno, para }].
  // Uma só gravação por época, para várias mudanças seguidas não se atropelarem.
  const aplicarAlteracoesOperacional = (lista) => {
    let mudados = 0;
    const naoEncontrados = [];
    [...new Set(lista.map((x) => x.epoca))].forEach((ep) => {
      const reg = registoAlunos[ep];
      const alunos = { ...((reg && reg.alunos) || {}) };
      let mudou = false;
      lista.filter((x) => x.epoca === ep).forEach((x) => {
        const a = alunos[x.aluno];
        if (!a) return naoEncontrados.push(x.aluno);
        if (a.turma === x.para && a.escola === x.escola) return;
        alunos[x.aluno] = { ...a, turma: x.para, escola: x.escola, turmaAntes: a.turma, mudadoPor: "operacional" };
        mudados++;
        mudou = true;
      });
      if (mudou) gravarEstadoAlunos(derivarEpoca(estadoAlunos(), ep, { ...reg, alunos }));
    });
    return { mudados, naoEncontrados };
  };

  // Mudança de turma/equipa à mão. Fica marcada e a importação semanal respeita-a enquanto
  // o ficheiro continuar a trazer a turma antiga; se o ficheiro mudar, vale o ficheiro.
  const mudarTurmaAluno = (ep, id, turma) => {
    const reg = registoAlunos[ep];
    const a = reg && reg.alunos[id];
    if (!a || !turma || a.turma === turma) return;
    const doFicheiro = a.turmaFicheiro || a.turmaAntes || a.turma;
    let novo;
    if (turma === doFicheiro) {
      const { turmaManual, turmaFicheiro, mudadoPor, turmaAntes, ...resto } = a; // eslint-disable-line no-unused-vars
      novo = { ...resto, turma };
    } else novo = { ...a, turma, turmaManual: true, turmaFicheiro: doFicheiro };
    gravarEstadoAlunos(derivarEpoca(estadoAlunos(), ep, { ...reg, alunos: { ...reg.alunos, [id]: novo } }));
    notificar(`Aluno ${id} passou para ${turma}.`);
  };

  // Género corrigido à mão: a importação semanal respeita-o.
  const mudarGeneroAluno = (ep, id, genero) => {
    const reg = registoAlunos[ep];
    const a = reg && reg.alunos[id];
    if (!a || (a.genero || "") === genero) return;
    gravarEstadoAlunos(derivarEpoca(estadoAlunos(), ep, { ...reg, alunos: { ...reg.alunos, [id]: { ...a, genero, generoManual: true } } }));
    notificar(`Género do aluno ${id} alterado.`);
  };

  const saveDesvinc = (reg) => persistDesvinc([...desvinculacoes, reg]);
  const updateDesvinc = (id, patch) =>
    persistDesvinc(
      desvinculacoes.map((v) => {
        if (v.id !== id) return v;
        const nv = { ...v, ...patch };
        if (nv.aceite !== true) nv.cedida = false;
        return nv;
      })
    );
  const removeDesvinc = (id) => persistDesvinc(desvinculacoes.filter((v) => v.id !== id));

  const saveEspaco = (reg) => persistEspacos([...espacos, reg]);
  const removeEspaco = (id) => persistEspacos(espacos.filter((s2) => s2.id !== id));
  const updateEspaco = (id, campos) => persistEspacos(espacos.map((s2) => (s2.id === id ? { ...s2, ...campos } : s2)));

  const saveEvento = (reg) => persistEventos([...eventos, reg]);
  const removeEvento = (id) => persistEventos(eventos.filter((e) => e.id !== id));
  const updateEvento = (reg) => persistEventos(eventos.map((e) => (e.id === reg.id ? reg : e)));
  const guardarInquerito = (reg, substituir, planoId) => {
    persistInqueritos(substituir ? inqueritos.map((i) => (i.id === reg.id ? reg : i)) : [...inqueritos, reg]);
    if (planoId) {
      persistPlanoInq(
        planoInq.map((p) =>
          p.id === planoId ? { ...p, estado: "Analisado", respostas: reg.respostas, inscritos: p.inscritos ?? reg.enviados ?? null, inqueritoId: reg.id } : p
        )
      );
    }
  };
  const guardarItemPlano = (item) => {
    const { envio, ...limpo } = item;
    persistPlanoInq(planoInq.some((p) => p.id === limpo.id) ? planoInq.map((p) => (p.id === limpo.id ? limpo : p)) : [...planoInq, limpo]);
  };
  const removerItemPlano = (id) => persistPlanoInq(planoInq.filter((p) => p.id !== id));
  const importarPlano = (itens, epoca, substituir) =>
    persistPlanoInq([...(substituir ? planoInq.filter((p) => p.epoca !== epoca) : planoInq), ...itens]);
  const atualizarInquerito = (id, patch) => persistInqueritos(inqueritos.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removerInquerito = (id) => {
    persistInqueritos(inqueritos.filter((i) => i.id !== id));
    notificar("Inquérito eliminado.", "aviso");
  };

  const saveSatisfacao = (reg) => persistSatisfacao([...satisfacao, reg]);
  const removeSatisfacao = (id) => persistSatisfacao(satisfacao.filter((x) => x.id !== id));

  const nextNumber = entries.length ? Math.max(...entries.map((e) => e.entryNumber)) + 1 : 1;

  const withStatus = entries.map((e) => ({ ...e, derivedStatus: deriveStatus(e) }));

  const filtered = withStatus
    .filter((e) => (filterCanal === "todos" ? true : e.canal === filterCanal))
    .filter((e) => (filterEpoca === "todas" ? true : e.epoca === filterEpoca))
    .filter((e) => (filterStatus === "todos" ? true : e.derivedStatus === filterStatus))
    .filter((e) => (search ? (e.complainant + e.description).toLowerCase().includes(search.toLowerCase()) : true))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const stats = {
    porPegar: withStatus.filter((e) => e.derivedStatus === "por_pegar").length,
    emAndamento: withStatus.filter((e) => e.derivedStatus === "em_andamento").length,
    atrasadas: withStatus.filter((e) => e.derivedStatus === "atrasado").length,
    concluidas: withStatus.filter((e) => e.derivedStatus === "concluido").length,
  };

  const handleSave = (item) => {
    const exists = entries.some((e) => e.id === item.id);
    const next = exists ? entries.map((e) => (e.id === item.id ? item : e)) : [...entries, item];
    persist(next);
    persistLearned(learnFromEntry(learned, item));
    setShowForm(false);
    setEditing(null);
    notificar(exists ? "Reclamação atualizada." : `Reclamação nº ${String(item.entryNumber).padStart(4, "0")} registada.`);
  };

  const startWork = (id) => {
    persist(
      entries.map((e) => (e.id === id ? { ...e, status: "em_andamento", startedDate: e.startedDate || new Date().toISOString() } : e))
    );
  };

  const markDone = (id, { responseText, eficacia, resolvedDate, startedDate, respostaTipoId, causaRaiz } = {}) => {
    persist(
      entries.map((e) => {
        if (e.id !== id) return e;
        // Data escolhida no formulário (yyyy-mm-dd) ou, se não vier, o momento atual.
        const resolvedISO = resolvedDate ? new Date(resolvedDate + "T12:00:00").toISOString() : new Date().toISOString();
        // Data de início: usa a que vier do formulário (mesmo que seja para
        // apagar, passando null); se não vier nada no argumento, mantém a que
        // já existia. Sem data de início, a Análise exclui esta reclamação do
        // "Tempo médio de resposta" — o "Tempo médio de resolução" usa sempre
        // a data de conclusão, essa nunca fica em falta.
        const startedISO = startedDate === undefined ? e.startedDate || null : startedDate ? new Date(startedDate + "T12:00:00").toISOString() : null;
        return {
          ...e,
          status: "concluido",
          resolvedDate: resolvedISO,
          startedDate: startedISO,
          responseText: responseText !== undefined ? responseText : e.responseText || "",
          respostaTipoId: respostaTipoId !== undefined ? respostaTipoId : e.respostaTipoId || null,
          causaRaiz: causaRaiz !== undefined ? causaRaiz : e.causaRaiz || "",
          eficacia: eficacia !== undefined ? eficacia : e.eficacia || "",
        };
      })
    );
  };

  const reopen = (id) => {
    persist(entries.map((e) => (e.id === id ? { ...e, status: "em_andamento", resolvedDate: null } : e)));
  };

  const remove = (id) => {
    persist(entries.filter((e) => e.id !== id));
  };

  const areaDaPagina = {
    registo: "Reclamações",
    auditorias: "Auditorias",
    sancoes: "Sanções",
    inscritos: "Inscritos",
    inqueritos: "Inquéritos",
    relatorio: "Geral",
    hoje: "Geral",
    riscos: "Geral",
    ocorrencias: "Ocorrências",
    avaliacoes: "Geral",
    emails: "Geral",
  }[page];

  const titulo =
    page === "auditorias"
      ? "Auditorias"
      : page === "sancoes"
      ? "Sanções"
      : page === "inscritos"
      ? "Gestão de inscritos"
      : page === "inqueritos"
      ? "Inquéritos de satisfação"
      : page === "relatorio"
      ? "Relatórios"
      : page === "hoje"
      ? "Hoje"
      : page === "riscos"
      ? "Riscos e oportunidades"
      : page === "objetivos"
      ? "Mapa de objetivos"
      : page === "documentos"
      ? "Controlo documental"
      : page === "formacao"
      ? "Plano de formação"
      : page === "apagados"
      ? "Apagados"
      : page === "avaliacoes"
      ? "Avaliações do staff"
      : page === "ocorrencias"
      ? "Ocorrências"
      : page === "emails"
      ? "E-mails às escolas"
      : "Reclamações";

  // Catálogo das listas geríveis: título, onde vivem e onde são usadas.
  const LISTAS = {
    schools: {
      area: "Geral",
      titulo: "Escolas",
      nota: "As escolas são partilhadas por toda a app: reclamações, auditorias, sanções e inscritos.",
      placeholder: "Ex: Dragon Force Gondomar",
      emUso: (x) =>
        entries.filter((e) => e.school === x).length +
        audits.filter((a) => a.school === x).length +
        turmasAlunos.filter((t) => t.escola === x).length,
    },
    categories: {
      area: "Reclamações",
      titulo: "Temas de reclamação",
      nota: "Mais específicos que a categoria. Ex: comportamento de treinador, mensalidades, balneários.",
      placeholder: "Ex: Convocatórias",
      emUso: (x) => entries.filter((e) => e.tema === x).length,
    },
    causasRaiz: {
      area: "Geral",
      titulo: "Causas raiz",
      nota: "Respondem a \"porque é que aconteceu?\". São as mesmas para reclamações e auditorias, para se poderem somar. Não confundir com o tema (de que se queixam).",
      placeholder: "Ex: Formação insuficiente",
      emUso: (x) =>
        withStatus.filter((e) => nomeCausa(e.causaRaiz) === x).length +
        audits.reduce((n, a) => n + (a.findings || []).filter((f) => nomeCausa(f.causaRaiz) === x).length, 0),
    },
    complaintCategories: {
      area: "Reclamações",
      titulo: "Categorias de reclamação",
      nota: "O agrupamento geral: disciplinar, técnico, infraestrutura e o que mais precisares.",
      placeholder: "Ex: Administrativo",
      emUso: (x) => entries.filter((e) => e.categoria === x).length,
    },
    auditAreas: {
      area: "Auditorias",
      titulo: "Áreas e departamentos",
      nota: "Usadas nas constatações das auditorias, para saber onde se concentram os problemas.",
      placeholder: "Ex: Técnica",
      emUso: (x) => audits.reduce((n, a) => n + (a.findings || []).filter((f) => f.area === x).length, 0),
    },
    auditCategories: {
      area: "Auditorias",
      titulo: "Categorias de constatação",
      nota: "O tipo de constatação encontrada em auditoria. Ex: documentação, equipamento, registos.",
      placeholder: "Ex: Documentação",
      emUso: (x) => audits.reduce((n, a) => n + (a.findings || []).filter((f) => f.category === x).length, 0),
    },
    categoriasOcorrencia: {
      area: "Ocorrências",
      titulo: "Categorias de ocorrência",
      nota: "Para registos que não são reclamações nem sanções. A categoria decide a que tema dos riscos a ocorrência pertence; categorias novas que se repitam geram avisos próprios.",
      placeholder: "Ex: Transportes",
      emUso: (x) => ocorrencias.filter((o) => o.categoria === x).length,
    },
    sanctionTypes: {
      area: "Sanções",
      titulo: "Tipos de sanção",
      nota: "Aplicáveis a pais e encarregados de educação.",
      placeholder: "Ex: Suspensão por 3 jogos",
      emUso: (x) => sanctions.filter((v) => v.sanctionType === x).length,
    },
    motivosDesistencia: {
      area: "Inscritos",
      titulo: "Motivos de desistência",
      nota: "Lista fechada, para as estatísticas serem comparáveis. Não escrevas nomes de atletas.",
      placeholder: "Ex: Mudança de escola",
      emUso: (x) => desistencias.filter((d) => d.motivo === x).length,
    },
    categoriasSatisfacao: {
      area: "Inscritos",
      titulo: "Categorias do inquérito de satisfação",
      nota: "As dimensões que perguntas no inquérito. Cada uma recebe uma percentagem.",
      placeholder: "Ex: Comunicação",
      emUso: (x) => satisfacao.filter((sa) => (sa.valores || {})[x] !== undefined).length,
    },
    espacosLista: {
      area: "Inscritos",
      titulo: "Espaços de treino",
      nota: "Campos, meios-campos e pavilhões usados no mapa de ocupação.",
      placeholder: "Ex: Campo 3",
      emUso: (x) => espacos.filter((sp) => sp.espaco === x).length,
    },
    tiposEvento: {
      area: "Inquéritos",
      titulo: "Eventos",
      nota: "Os eventos com inquérito de satisfação. Cada edição é associada a um destes.",
      placeholder: "Ex: Dragon Cup",
      emUso: (x) => inqueritos.filter((i) => i.tipoEvento === x).length,
    },
    tipologiasInq: {
      area: "Inquéritos",
      titulo: "Tipologias de evento (cronograma)",
      nota: "Cada tipologia tem a sua regra de envio, em Planeamento → Regras de envio.",
      placeholder: "Ex: Torneio 2 dias",
      emUso: (x) => planoInq.filter((p) => p.tipologia === x).length,
    },
    dimensoesInquerito: {
      area: "Inquéritos",
      titulo: "Dimensões das perguntas",
      nota: "Agrupam perguntas diferentes de vários formulários, para se poderem comparar entre eventos.",
      placeholder: "Ex: Segurança",
      emUso: (x) => inqueritos.reduce((n, i) => n + (i.perguntas || []).filter((q) => q.dimensao === x).length, 0),
    },
    turmas: {
      area: "Inscritos",
      titulo: "Turmas e equipas",
      nota: 'As que começam por "Sub" contam como competição; as restantes como turmas.',
      placeholder: "Ex: Sub-20",
      emUso: (x) => turmasAlunos.filter((t) => t.turma === x).length,
    },
  };

  // Comandos da paleta: secções, ações e as reclamações abertas.
  const comandosPaleta = [
    { id: "p-hoje", grupo: "Ir para", titulo: "Hoje", icon: Sun, acao: () => setPage("hoje") },
    { id: "p-registo", grupo: "Ir para", titulo: "Reclamações", icon: LayoutGrid, acao: () => setPage("registo") },
    { id: "p-auditorias", grupo: "Ir para", titulo: "Auditorias", icon: ClipboardList, acao: () => setPage("auditorias") },
    { id: "p-sancoes", grupo: "Ir para", titulo: "Sanções", icon: Scale, acao: () => setPage("sancoes") },
    { id: "p-inscritos", grupo: "Ir para", titulo: "Inscritos", icon: Users, acao: () => setPage("inscritos") },
    { id: "p-relatorio", grupo: "Ir para", titulo: "Relatórios (escola e geral)", icon: FileText, acao: () => setPage("relatorio") },
    { id: "p-inqueritos", grupo: "Ir para", titulo: "Inquéritos de satisfação", icon: MessageSquareText, acao: () => setPage("inqueritos") },
    { id: "p-riscos", grupo: "Ir para", titulo: "Riscos e oportunidades", icon: ShieldAlert, acao: () => setPage("riscos") },
    { id: "p-objetivos", grupo: "Ir para", titulo: "Mapa de objetivos", icon: Target, acao: () => setPage("objetivos") },
    { id: "p-documentos", grupo: "Ir para", titulo: "Controlo documental", icon: FileText, acao: () => setPage("documentos") },
    { id: "p-formacao", grupo: "Ir para", titulo: "Plano de formação", icon: GraduationCap, acao: () => setPage("formacao") },
    { id: "p-ocorrencias", grupo: "Ir para", titulo: "Ocorrências", icon: AlertTriangle, acao: () => setPage("ocorrencias") },
    { id: "p-avaliacoes", grupo: "Ir para", titulo: "Avaliações do staff", icon: Star, acao: () => setPage("avaliacoes") },
    { id: "p-emails", grupo: "Ir para", titulo: "E-mails às escolas", icon: Mail, acao: () => setPage("emails") },
    {
      id: "a-nova",
      grupo: "Ações",
      titulo: "Nova reclamação",
      icon: Plus,
      acao: () => {
        setPage("registo");
        setReclamacoesView("registo");
        setEditing(null);
        setShowForm(true);
      },
    },
    { id: "a-auditoria", grupo: "Ações", titulo: "Nova auditoria", icon: Plus, acao: () => { setPage("auditorias"); setShowAuditForm(true); } },
    { id: "a-ocorrencia", grupo: "Ações", titulo: "Nova ocorrência disciplinar", icon: Plus, acao: () => { setPage("sancoes"); setShowSanctionForm(true); } },
    { id: "a-listas", grupo: "Ações", titulo: "Escolas e listas", icon: ShieldAlert, acao: () => setShowManage(true) },
    { id: "a-analise", grupo: "Ações", titulo: "Análise de reclamações", icon: BarChart3, acao: () => { setPage("registo"); setReclamacoesView("analise"); } },
    {
      id: "a-tema",
      grupo: "Ações",
      titulo: tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro",
      icon: Sparkles,
      acao: () => setTema(tema === "dark" ? "light" : "dark"),
    },
    ...withStatus
      .filter((e) => e.derivedStatus !== "concluido")
      .slice(0, 30)
      .map((e) => ({
        id: `r-${e.id}`,
        grupo: "Reclamações abertas",
        titulo: `Nº ${String(e.entryNumber).padStart(4, "0")} · ${e.complainant}`,
        detalhe: [e.school, e.tema].filter(Boolean).join(" · "),
        icon: Inbox,
        acao: () => {
          setPage("registo");
          setReclamacoesView("registo");
          setViewingDetail(e);
        },
      })),
  ];

  // A lista de causas é lida pelos componentes de causa raiz.
  definirCausasAtuais(options.causasRaiz && options.causasRaiz.length ? options.causasRaiz : DEFAULT_CAUSAS_RAIZ);

  // Riscos e oportunidades: o que os dados mostram em cada época, face à lista.
  const deteccoesDe = (ep, itensEp, ign) =>
    detetarRiscos(
      {
        ep,
        audits: auditsVista,
        reclamacoes: withStatus,
        sanctions,
        desistencias,
        eventos,
        registoAlunos,
        ocorrencias,
        capacidadeDe: (e, t) => (options.capacidades || {})[`${e}|${t}`] || capacidadeSugerida(t, options.niveis || DEFAULT_NIVEIS),
      },
      itensEp || [],
      ign || []
    );
  const avisosRiscos = (() => {
    const eps = Object.keys(riscos.epocas || {}).sort();
    const epHoje = epocaDe(isoDe(new Date()));
    const ep = eps.includes(epHoje) || !eps.length ? epHoje : eps[eps.length - 1];
    try {
      const ds = deteccoesDe(ep, ((riscos.epocas || {})[ep] || {}).itens || [], (riscos.ignorados || {})[ep]).filter((d) => !d.cobertoPor.length && !d.ignorado);
      return { ep, n: ds.length, titulos: ds.map((d) => d.titulo), lista: ds };
    } catch (e) {
      return null;
    }
  })();

  // Sugestões do radar que ainda ninguém tratou (nem na lista, nem ignoradas).
  const radarNovas = (() => {
    const naLista = new Set(Object.values(riscos.epocas || {}).flatMap((e) => (e.itens || []).map((i) => i.radar).filter(Boolean)));
    const ign = new Set(riscos.radarIgnorados || []);
    return ((radar && radar.itens) || []).filter((r) => !naLista.has(r.id) && !ign.has(r.id));
  })();

  const contagemHoje = (() => {
    try {
      const ctx = { avisosRiscos, radarNovas, ocorrencias, reclamacoes: withStatus, plano: planoInq, regrasEnvio: { ...DEFAULT_REGRAS_ENVIO, ...(options.regrasEnvioInq || {}) }, audits: auditsVista, experiencias, desvinculacoes, turmasAlunos, inscritos: inscritosVista, epocaAnterior, escolas: options.schools || [], sanctions, hoje: isoDe(new Date()), abrirReclamacao: () => {}, irPara: () => {} };
      return FONTES_HOJE.flatMap((f) => f(ctx) || []).filter((i) => i.quando !== "semana").length;
    } catch (e) {
      return 0;
    }
  })();

  // Contactos e ações dos e-mails às escolas (página própria e experiências).
  const opEmails = {
    irParaEmails: () => setPage("emails"),
    contactos: options,
    motivos: options.motivosExperiencia || MOTIVOS_EXPERIENCIA_PADRAO,
    pedidoEnvio: options.pedidoEnvioOperacionais || null,
    carregadoEm: carregadoEm.current,
    notificar,
    onAbrirContactos: () => setContactosAbertos(true),
    // Envio manual: a todos, ou só a quem escolheres (papel: operacional | coordenador | geral | auditoria | direcao; escola quando é de uma escola).
    onPedirEnvio: (escola, papel, previa) => {
      persistOptions({ ...options, pedidoEnvioOperacionais: { em: new Date().toISOString(), ...(escola ? { escolas: [escola] } : {}), ...(papel ? { papeis: [papel] } : {}), ...(previa ? { preview: true, para: previa } : {}) } });
      const quem = { operacional: "operacional", coordenador: "coordenador técnico", geral: "coordenador técnico geral", auditoria: "responsável de área da auditoria", direcao: "direção executiva" }[papel || "operacional"];
      if (previa) return notificar(`Pré-visualização pedida: chega a ${previa} em poucos minutos. Ninguém mais recebe nada.`, "ok", 8000);
      notificar(papel || escola ? `Pedido feito para ${quem}${escola ? ` de ${escola}` : ""}. O e-mail sai em poucos minutos.` : "Pedido feito. Os e-mails saem em poucos minutos.", "ok", 7000);
    },
    // Envio a vários destinatários escolhidos: destinos = [{ escola?, papel }]. Se o pedido anterior ainda não saiu, juntam-se.
    onPedirEnvioA: (destinos, previa, juntar) => {
      const pe = options.pedidoEnvioOperacionais || {};
      const base = juntar && !previa && !pe.preview && Array.isArray(pe.destinos) ? pe.destinos : [];
      const todos = [...base, ...destinos].filter((d, i, l) => l.findIndex((x) => x.papel === d.papel && (x.escola || "") === (d.escola || "")) === i);
      persistOptions({ ...options, pedidoEnvioOperacionais: { em: new Date().toISOString(), destinos: todos, ...(previa ? { preview: true, para: previa } : {}) } });
      notificar(previa ? `Pré-visualização pedida: chega a ${previa} em poucos minutos. Ninguém mais recebe nada.` : `Pedido feito para ${todos.length} ${todos.length === 1 ? "destinatário" : "destinatários"}. Os e-mails saem em poucos minutos.`, "ok", 8000);
    },
    onAplicarIds: aplicarIdsOperacional,
    onAplicarAlteracoes: aplicarAlteracoesOperacional,
    onAplicarRespostas: aplicarRespostasOperacionais,
    registoAlunos,
    experiencias,
    onMotivo: motivoExperiencia,
    onTurmaFicou: turmaFicouExperiencia,
  };

  const secoes = [
    {
      grupo: "Início",
      itens: [{ key: "hoje", label: "Hoje", icon: Sun, contador: contagemHoje || null }],
    },
    {
      grupo: "Gestão",
      itens: [
        { key: "registo", label: "Reclamações", icon: LayoutGrid, contador: withStatus.filter((e) => e.derivedStatus !== "concluido").length },
        { key: "auditorias", label: "Auditorias", icon: ClipboardList, contador: audits.length || null },
        { key: "sancoes", label: "Sanções", icon: Scale, contador: sanctions.length || null },
        { key: "inscritos", label: "Inscritos", icon: Users, contador: null },
        { key: "inqueritos", label: "Inquéritos", icon: MessageSquareText, contador: inqueritos.length || null },
        { key: "ocorrencias", label: "Ocorrências", icon: AlertTriangle, contador: ocorrencias.filter((o) => (o.estado || "aberta") === "aberta").length || null },
        { key: "avaliacoes", label: "Avaliações do staff", icon: Star, contador: null },
        { key: "emails", label: "E-mails às escolas", icon: Mail, contador: null },
      ],
    },
    {
      grupo: "Sistema de gestão",
      itens: [
        { key: "riscos", label: "Riscos e oportunidades", icon: ShieldAlert, contador: avisosRiscos && avisosRiscos.n ? `${avisosRiscos.n} ⚠` : null },
        { key: "objetivos", label: "Objetivos", icon: Target, contador: null },
        { key: "documentos", label: "Controlo documental", icon: FileText, contador: (documentos.itens || []).length ? (documentos.itens || []).filter((d) => !d.obsoleto).length : null },
        { key: "formacao", label: "Plano de formação", icon: GraduationCap, contador: null },
      ],
    },
    {
      grupo: "Relatórios",
      itens: [{ key: "relatorio", label: "Relatórios", icon: FileText, contador: null }],
    },
  ];

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        background: COLORS.paper,
        height: "100dvh",
        overflow: "hidden",
        color: COLORS.ink,
        display: "flex",
        WebkitFontSmoothing: "antialiased",
      }}
      className="appEcra"
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap');
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .navItem:hover { background: ${COLORS.paperSunken}; }
        .rowHover:hover { background: ${COLORS.paperSunken}; }
        select, input, textarea, button { font-family: inherit; }
        ::placeholder { color: ${COLORS.slate}; }

        /* ---- transições suaves, ao estilo iOS ---- */
        /* Curva de saída do iOS: arranca depressa e assenta devagar. */
        :root { --ease: cubic-bezier(0.32, 0.72, 0, 1); }

        .navItem, button, select, input, textarea, a, tr { transition: background 200ms ease, border-color 200ms ease, color 200ms ease, opacity 200ms ease, box-shadow 200ms ease; }
        .navItem:active, .btnPress:active { transform: scale(0.975); }

        /* Conteúdo da página: entra com um fade curto e um deslize mínimo. */
        @keyframes pageIn { from { opacity: 0; } to { opacity: 1; } }
        .pageIn { animation: pageIn 320ms ease backwards; }

        /* Fundo escurecido dos modais. */
        @keyframes veilIn { from { opacity: 0; } to { opacity: 1; } }
        .veil { animation: veilIn 260ms ease both; backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
        /* Saída: o fundo e a caixa desvanecem em vez de desaparecerem de repente (ver o observador no AppPrincipal). */
        @keyframes veilOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes sheetOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px) scale(0.98); } }
        @keyframes drawerOut { from { transform: none; } to { transform: translateX(100%); } }
        @keyframes toastOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px) scale(0.97); } }
        .veilSai { animation: veilOut 200ms ease forwards !important; pointer-events: none !important; }
        .veilSai .sheet { animation: sheetOut 200ms ease forwards !important; }
        .veilSai .drawer { animation: drawerOut 240ms ease forwards !important; }
        .toastSai { animation: toastOut 200ms ease forwards !important; pointer-events: none !important; }

        /* Caixa centrada: sobe e cresce ligeiramente, como uma folha do iOS. */
        @keyframes sheetIn { from { opacity: 0; transform: translateY(18px) scale(0.965); } to { opacity: 1; transform: none; } }
        .sheet { animation: sheetIn 380ms cubic-bezier(0.22, 1, 0.36, 1) both; box-sizing: border-box; }
        .drawer { box-sizing: border-box; }

        /* Painel lateral: desliza da direita. */
        @keyframes drawerIn { from { transform: translateX(100%); } to { transform: none; } }
        .drawer { animation: drawerIn 320ms var(--ease) both; }

        /* Linhas de tabela e cartões que aparecem depois de filtrar. */
        @keyframes softIn { from { opacity: 0; } to { opacity: 1; } }
        .softIn { animation: softIn 200ms ease both; }
        /* Ao trocar de vista (ex.: Épocas → Por escola) o conteúdo novo entra com um fade. */
        .vistaTroca > *:not(:first-child) { animation: softIn 240ms ease both; }

        /* Entrada na app depois do login e saída ao terminar sessão. */
        .appEcra { transition: opacity 260ms ease, transform 260ms var(--ease); }
        /* Textos escritos com parágrafos (notas, contexto, respostas) mostram as mudanças de linha. */
        .appEcra { white-space: pre-line; }
        .modoFoto [style*="overflow"] { overflow: visible !important; max-height: none !important; }
        .appEcra svg, .appEcra input, .appEcra select { white-space: normal; }
        html.aSair .appEcra { opacity: 0; transform: scale(0.985); }

        /* Troca de tema claro/escuro: as cores mudam em 320 ms em vez de saltarem. */
        html.temaTransicao *, html.temaTransicao *::before, html.temaTransicao *::after {
          transition: background-color 320ms ease, color 320ms ease, border-color 320ms ease, fill 320ms ease, stroke 320ms ease, box-shadow 320ms ease !important;
        }

        /* Respeita quem desativou animações no sistema. */
        @media (prefers-reduced-motion: reduce) {
          .pageIn, .veil, .sheet, .drawer, .softIn, .vistaTroca > * { animation: none; }
          .veilSai, .veilSai .sheet, .veilSai .drawer, .toastSai { animation: none !important; }
          html.temaTransicao *, html.temaTransicao *::before, html.temaTransicao *::after { transition: none !important; }
          .navItem, button, select, input, textarea { transition: none; }
          .navItem:active, .btnPress:active { transform: none; }
        }

        /* Nada deve sair do ecrã: barras de deslocamento discretas dentro dos painéis. */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.rule}; border-radius: 6px; border: 3px solid transparent; background-clip: content-box; }
        ::-webkit-scrollbar-thumb:hover { background: ${COLORS.slate}; background-clip: content-box; }

        /* ================= molas e toques ================= */
        /* iOS clássico: saída suave, sem ressalto. */
        :root { --spring: cubic-bezier(0.25, 0.1, 0.25, 1); }

        .press { transition: transform 180ms var(--spring), background 140ms ease, box-shadow 180ms ease; }
        .press:active { opacity: 0.6; }

        /* Cartões levantam-se ligeiramente ao passar o rato. */
        .liftable { transition: background 180ms ease; }
        .liftable:hover { background: ${COLORS.paperSunken}; }

        /* Pastilha do separador ativo, com mola ao mudar. */
        .pill { transition: background 200ms var(--ease), color 160ms ease, transform 220ms var(--spring); }
        .pill:active { opacity: 0.75; }

        /* ================= entrada escalonada ================= */
        /* Os blocos de cada página entram em cascata, com poucos milissegundos
           de diferença. Dá a sensação de fluidez sem atrasar a leitura. */
        @keyframes riseIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .pageIn > * { animation: riseIn 380ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        .pageIn > *:nth-child(1) { animation-delay: 0ms; }
        .pageIn > *:nth-child(2) { animation-delay: 45ms; }
        .pageIn > *:nth-child(3) { animation-delay: 90ms; }
        .pageIn > *:nth-child(4) { animation-delay: 130ms; }
        .pageIn > *:nth-child(5) { animation-delay: 165ms; }
        .pageIn > *:nth-child(n+6) { animation-delay: 195ms; }

        /* ================= esqueletos e notificações ================= */
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        .shimmer {
          background: linear-gradient(90deg, ${COLORS.ruleSoft} 25%, ${COLORS.rule} 37%, ${COLORS.ruleSoft} 63%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        @keyframes toastIn { from { opacity: 0; transform: translateY(14px) scale(0.97); } to { opacity: 1; transform: none; } }
        .toastIn { animation: toastIn 300ms var(--ease) both; }

        /* ================= foco acessível ================= */
        :focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px ${COLORS.paper}, 0 0 0 4px ${COLORS.navy}55;
          border-radius: 8px;
        }

        /* ================= respeito pelas preferências ================= */
        @media (prefers-reduced-motion: reduce) {
          .press, .liftable, .pill { transition: none; }
          .press:active, .pill:active { opacity: 1; }
          .pageIn > * { animation: none; }
          .shimmer { animation: none; }
          .toastIn { animation: none; }
        }
        /* Quem pede mais contraste não deve ficar com chrome translúcido. */

        html, body { margin: 0; padding: 0; background: ${COLORS.paper}; height: 100%; overflow: hidden; overscroll-behavior: none; }
        .appConteudo { overscroll-behavior: contain; }
        .appConteudo > * { flex-shrink: 0; }
        [style*="overflow-x: auto"], [style*="overflow: auto"] { overscroll-behavior-x: contain; overscroll-behavior-y: auto; }
        .registoTabela th, .registoTabela td { padding: 9px 10px !important; }
        .registoTabela th { white-space: nowrap; }
        .registoTabela td:last-child > div { gap: 2px !important; }
        .registoTabela td:last-child button { padding: 5px !important; }
        .registoTabela td.quebra { white-space: normal; max-width: 190px; }
        .registoTabela .sub { display: block; margin-top: 3px; font-size: 12px; font-weight: 450; color: ${COLORS.slate}; }

        /* ---- relatório: o que aparece no ecrã e o que sai no PDF ---- */
        .relSoImpressao { display: none; }
        .relFolha { counter-reset: relSec; font-family: 'Manrope', 'Inter', system-ui, sans-serif; font-feature-settings: "tnum" 1, "lnum" 1; }
        .relFolha h2, .relFolha h3 { letter-spacing: -0.02em; }
        .relSeccao { counter-increment: relSec; }
        .relNum::before { content: counter(relSec, decimal-leading-zero); }
        .relRotulo { font-size: 10px; font-weight: 600; color: ${COLORS.slate}; text-transform: uppercase; letter-spacing: 0.12em; }
        .relVazio { font-size: 12.5px; color: ${COLORS.slate}; font-style: italic; padding: 4px 0; }
        .relLinhaComp td { border-bottom: 1px solid ${COLORS.ruleSoft}; }
        @media (max-width: 760px) {
          .relLinhaComp { grid-template-columns: minmax(0, 1fr) auto !important; row-gap: 8px !important; }
          .relLinhaComp > div:nth-child(3), .relLinhaComp > div:nth-child(4) { grid-column: span 1; }
        }
        .relPaginas, .relPaginas > tbody, .relPaginas > tbody > tr, .relPaginas > tbody > tr > td { display: block; width: 100%; border-collapse: collapse; padding: 0; }
        .relPaginas > thead, .relPaginas > tfoot { display: none; }
        .relKpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); margin-bottom: 26px; border-top: 1px solid ${COLORS.rule}; border-bottom: 1px solid ${COLORS.rule}; }
        .relKpi { padding: 14px 14px 14px 16px; border-left: 1px solid ${COLORS.rule}; min-width: 0; display: grid; grid-row: span 4; grid-template-rows: subgrid; row-gap: 0; align-content: start; }
        .relKpi > .relRotulo { align-self: start; }
        .relKpi:first-child { border-left: none; padding-left: 0; }
        .relGrelha { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 34px; align-items: start; margin-bottom: 26px; }
        .relGrelha > div { min-width: 0; }
        .relFortes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 34px; margin-top: 26px; }
        .relSub { font-size: 10px; font-weight: 600; color: ${COLORS.ink2}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid ${COLORS.ruleSoft}; }
        @media (max-width: 760px) {
          .relKpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .relGrelha, .relFortes { grid-template-columns: 1fr; }
          .relCapaNumeros { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; row-gap: 14px; }
          .relCorpo { padding: 0 18px 24px !important; }
          .relCapa > div { padding-left: 18px !important; padding-right: 18px !important; }
          .relQuadro td:nth-child(3), .relQuadro th:nth-child(3) { display: none; }
        }
        @media print {
          /* Margem zero: o browser deixa de imprimir data, título e link. As margens
             passam a ser feitas pela própria folha (espaço repetido em cada página). */
          @page { size: A4; margin: 0; }
          .naoImprimir, .relControlos, .relSoEcra, .demoFaixa, .relFolha button, .relFimEcra { display: none !important; }
          .relSoImpressao { display: block !important; }
          .pageIn, .pageIn > * { animation: none !important; }
          .appConteudo > .pageIn { padding: 0 !important; max-width: none !important; }
          .appEcra, .appConteudo, .appConteudo > .pageIn { background: #fff !important; }
          .relFolha { width: 880px !important; max-width: none !important; margin: 0 auto !important; zoom: 0.8; border: none !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; background: #fff !important; }
          .relPaginas { display: table !important; width: 100%; border-collapse: collapse; }
          .relPaginas > thead { display: table-header-group !important; }
          .relPaginas > tfoot { display: table-footer-group !important; }
          .relPaginas > tbody { display: table-row-group !important; }
          .relPaginas > tbody > tr { display: table-row !important; }
          .relPaginas > tbody > tr > td, .relPaginas > thead td, .relPaginas > tfoot td { display: table-cell !important; padding: 0; }
          .relEspaco { height: 16mm; }
          .relRodapeImp { height: 16mm; display: flex; justify-content: space-between; align-items: center; margin: 0 44px; border-top: 1px solid #D5DBE5; font-size: 10px; letter-spacing: 0.04em; color: #6B7A90; }
          .relCapa { margin: 0; }
          .relSeccaoTopo, .relSub { break-after: avoid; }
          .relKpi, .relKpis, .relGrelha, .relGrelha > div, .relFortes, .relTabela tr, .relLinhaComp { break-inside: avoid; }
          .relSeccaoTopo + * { break-before: avoid; }
          .relSeccao { break-inside: auto; }
          body, html { background: #fff !important; height: auto !important; overflow: visible !important; }
          .appEcra, .appConteudo { height: auto !important; overflow: visible !important; display: block !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }

        /* ---- splash de arranque (enquanto os dados carregam) ---- */
        @keyframes splashSai { from { opacity: 1; } to { opacity: 0; pointer-events: none; } }
        @keyframes splashPulso { 0%, 100% { opacity: 0.6; transform: scale(0.97); } 50% { opacity: 1; transform: scale(1.03); } }
        @keyframes splashChama { 0%, 100% { transform: scaleY(1) translateY(0); } 40% { transform: scaleY(1.08) translateY(-2px); } 70% { transform: scaleY(0.96) translateY(1px); } }
        @keyframes splashTexto { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        .splashOverlay {
          position: fixed; inset: 0; z-index: 200;
          background: #07142A;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
          font-family: 'Inter', system-ui, sans-serif;
          transition: opacity 500ms ease;
        }
        .splashOverlay.sair { animation: splashSai 500ms ease forwards; }
        .splashOverlay img { animation: splashPulso 2s ease-in-out infinite; filter: drop-shadow(0 0 22px rgba(33,150,201,0.45)); }
        .splashChama { transform-origin: center bottom; animation: splashChama 2s ease-in-out infinite; }
        .splashTexto { font-size: 12px; color: #8FA3BF; letter-spacing: 0.14em; text-transform: uppercase; animation: splashTexto 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .splashOverlay img, .splashChama, .splashTexto { animation: none; opacity: 1; }
          .splashOverlay.sair { animation: none; opacity: 0; }
        }
      `}</style>

      {/* ---- splash enquanto os dados carregam do Supabase ---- */}
      {loading && (
        <div className="splashOverlay naoImprimir" aria-live="polite" aria-label="A carregar dados…">
          <img src={SIMBOLO_DF} alt="" width="110" height="129" />
          <span className="splashTexto">A carregar…</span>
        </div>
      )}

      {/* ---------- barra lateral ---------- */}
      <div
        className="naoImprimir"
        style={{
          width: 248,
          flex: "none",
          background: COLORS.sideBg,
          borderRight: `1px solid ${COLORS.rule}`,
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100%",
          boxSizing: "border-box",
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          padding: "14px 0",
          zIndex: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 16px" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: COLORS.navy,
              display: "grid",
              placeItems: "center",
              flex: "none",
              overflow: "hidden",
            }}
          >
            <img src={LOGO_BRANCO} alt="Dragon Force" style={{ height: 24, width: "auto" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.25 }}>Qualidade</div>
            <div style={{ fontSize: 11.5, color: COLORS.slate }}>Dragon Force</div>
          </div>
        </div>

        {secoes.map((sec) => (
          <div key={sec.grupo}>
            <div style={{ padding: "12px 16px 5px", fontSize: 11, fontWeight: 600, color: COLORS.slate }}>{sec.grupo}</div>
            {sec.itens.map(({ key, label, icon: Icon, contador }) => {
              const ativo = page === key;
              return (
                <button
                  key={key}
                  className="navItem press"
                  onClick={() => setPage(key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    width: "calc(100% - 16px)",
                    margin: "1px 8px",
                    padding: "8px 9px",
                    borderRadius: 7,
                    border: "none",
                    background: ativo ? COLORS.navyWash : "transparent",
                    color: ativo ? COLORS.navySoft : COLORS.ink2,
                    fontWeight: ativo ? 600 : 450,
                    fontSize: 13.5,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Icon size={15} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {contador ? (
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: ativo ? COLORS.navySoft : COLORS.slate }}>{contador}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}

        <div style={{ padding: "12px 16px 5px", fontSize: 11, fontWeight: 600, color: COLORS.slate }}>Configuração</div>
        <button
          className="navItem press"
          onClick={() => setListaAberta("__indice")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            width: "calc(100% - 16px)",
            margin: "1px 8px",
            padding: "8px 9px",
            borderRadius: 7,
            border: "none",
            background: "transparent",
            color: COLORS.ink2,
            fontWeight: 450,
            fontSize: 13.5,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <ShieldAlert size={15} />
          <span>Todas as listas</span>
        </button>
        <button
          className="navItem press"
          onClick={() => setPage("apagados")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            width: "calc(100% - 16px)",
            margin: "1px 8px",
            padding: "8px 9px",
            borderRadius: 7,
            border: "none",
            background: page === "apagados" ? COLORS.navyWash : "transparent",
            color: page === "apagados" ? COLORS.navy : COLORS.ink2,
            fontWeight: page === "apagados" ? 600 : 450,
            fontSize: 13.5,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <RotateCcw size={15} />
          <span style={{ flex: 1 }}>Apagados</span>
          {apagados.length > 0 && <span style={{ fontSize: 11.5, color: COLORS.slate }}>{apagados.length}</span>}
        </button>

        {/* alternador de tema */}
        <div style={{ marginTop: "auto", padding: "12px 16px 0", borderTop: `1px solid ${COLORS.rule}` }}>
          <div style={{ display: "flex", background: COLORS.segTrack, borderRadius: 9, padding: 2, gap: 2 }}>
            {[
              ["light", "Claro"],
              ["dark", "Escuro"],
            ].map(([t, l]) => (
              <button
                key={t}
                className="press"
                onClick={() => setTema(t)}
                style={{
                  flex: 1,
                  background: tema === t ? COLORS.paperRaised : "transparent",
                  border: "none",
                  borderRadius: 7,
                  padding: "5px 4px",
                  fontSize: 11.5,
                  fontWeight: tema === t ? 600 : 500,
                  color: tema === t ? COLORS.ink : COLORS.ink2,
                  cursor: "pointer",
                  boxShadow: tema === t ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                }}
              >
                {l}
              </button>
            ))}
          </div>
          {onSair && (
            <button
              onClick={onSair}
              className="navItem"
              style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", borderRadius: 7, padding: "6px 8px", fontSize: 12, color: COLORS.ink2, cursor: "pointer", textAlign: "left" }}
            >
              Sair
            </button>
          )}
        </div>
      </div>

      {/* ---------- conteúdo ---------- */}
      <div ref={conteudoRef} className="appConteudo" style={{ flex: 1, minWidth: 0, maxWidth: "100%", height: "100%", overflowX: "hidden", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div
          className="naoImprimir"
          style={{
            height: 52,
            background: COLORS.paperRaised,
            borderBottom: `1px solid ${COLORS.rule}`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 22px",
            position: "sticky",
            top: 0,
            zIndex: 5,
          }}
        >
          <div style={{ fontSize: 13.5, color: COLORS.slate }}>
            {page === "apagados" ? "Configuração" : (secoes.find((sx) => sx.itens.some((x) => x.key === page)) || { grupo: "Gestão" }).grupo} · <strong style={{ color: COLORS.ink, fontWeight: 600 }}>{titulo}</strong>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {areaDaPagina && (
              <button
                className="press"
                onClick={() => setListaAberta(`__indice:${areaDaPagina}`)}
                title={`Listas de ${areaDaPagina}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: COLORS.paperSunken,
                  border: `1px solid ${COLORS.rule}`,
                  borderRadius: 8,
                  padding: "6px 11px",
                  fontSize: 12.5,
                  color: COLORS.ink2,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                <ShieldAlert size={14} />
                <span>Listas</span>
              </button>
            )}
            <button
              className="press"
              onClick={() => setPaletaAberta(true)}
              title="Procurar (⌘K)"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: COLORS.paperSunken,
                border: `1px solid ${COLORS.rule}`,
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12.5,
                color: COLORS.slate,
                cursor: "pointer",
              }}
            >
              <Search size={14} />
              <span>Procurar</span>
              <span style={{ display: "flex", gap: 3 }}>
                <kbd style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 4, padding: "1px 5px" }}>⌘</kbd>
                <kbd style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 600, background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 4, padding: "1px 5px" }}>K</kbd>
              </span>
            </button>
            {page === "registo" && reclamacoesView === "registo" && (
              <button
                className="press"
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: COLORS.navy,
                  color: COLORS.onAccent,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <Plus size={15} /> Nova reclamação
              </button>
            )}
          </div>
        </div>

      <div key={page} className="pageIn" style={{ padding: "20px 22px 56px", maxWidth: 1360, minWidth: 0 }}>
        {page === "auditorias" ? (
          <AuditsPage
            audits={auditsVista}
            onNewAudit={() => setShowAuditForm(true)}
            onImportar={() => setImportarAud(true)}
            onApagarTodas={() => {
              persistAudits([]);
              notificar("Todas as auditorias foram apagadas.");
            }}
            onAreas={() => setAreasAud(true)}
            onPreencher={() => setPreencherAud(true)}
            onIso={() => setIsoAud(true)}
            onOpenAudit={(a) => setViewingAudit(a)}
            schoolOptions={options.schools}
            areaOptions={options.auditAreas}
            auditCategoryOptions={options.auditCategories}
          />
        ) : page === "emails" ? (
          <>
            <PainelEmailsEscolas op={opEmails} escolas={options.schools || []} />
            <HistoricoEmailsEscolas escolas={options.schools || []} />
          </>
        ) : page === "inscritos" ? (
          <InscritosPage
            op={opEmails}
            inscritos={inscritosVista}
            turmasAlunos={turmasAlunos}
            epocaAnterior={epocaAnterior}
            options={options}
            desistencias={desistencias}
            experiencias={experiencias}
            desvinculacoes={desvinculacoes}
            espacos={espacos}
            eventos={eventos}
            satisfacao={satisfacao}
            onSaveDesistencia={saveDesistencia}
            onRemoveDesistencia={removeDesistencia}
            onSaveExperiencia={saveExperiencia}
            onUpdateExperiencia={updateExperiencia}
            onRemoveExperiencia={removeExperiencia}
            onSaveDesvinc={saveDesvinc}
            onUpdateDesvinc={updateDesvinc}
            onRemoveDesvinc={removeDesvinc}
            onSaveEspaco={saveEspaco}
            onUpdateEspaco={updateEspaco}
            onRemoveEspaco={removeEspaco}
            onImportarPlano={(novos, remover) => {
              persistEspacos([...espacos.filter((x) => !remover.includes(x.id)), ...novos]);
              notificar(`${novos.length} treinos importados do plano semanal${remover.length ? ` (${remover.length} antigos substituídos)` : ""}.`);
            }}
            onRenomearRecinto={(de, para) => {
              persistEspacos(espacos.map((x) => (x.recinto === de ? { ...x, recinto: para } : x)));
              const n0 = options.planosNormalizacao || {};
              const locais = Object.fromEntries(Object.entries(n0.locais || {}).map(([k, v]) => [k, v === de ? para : v]));
              const titulos = Object.fromEntries(Object.entries(n0.titulos || {}).map(([k, v]) => [k, v.recinto === de ? { ...v, recinto: para } : v]));
              persistOptions({ ...options, planosNormalizacao: { ...n0, locais, titulos } });
              notificar(`"${de}" passa a "${para}".`);
            }}
            onGuardarNormalizacao={(n) => persistOptions({ ...options, planosNormalizacao: n })}
            onGuardarMinimoTurma={(v) => persistOptions({ ...options, minimoTurmaPct: v })}
            onGuardarRegrasTreinadores={(r) => {
              persistOptions({ ...options, regrasTreinadores: r });
              notificar("Regras dos treinadores guardadas.");
            }}
            onSaveEvento={saveEvento}
            onRemoveEvento={removeEvento}
            onUpdateEvento={updateEvento}
            onMapaEscolaEvento={(raw, escola) =>
              persistOptions({
                ...options,
                schools: options.schools.includes(escola) ? options.schools : [...options.schools, escola],
                mapaEscolasAlunos: { ...(options.mapaEscolasAlunos || {}), [normChave(raw)]: escola },
              })
            }
            onSaveSatisfacao={saveSatisfacao}
            onRemoveSatisfacao={removeSatisfacao}
            onGerirLista={setListaAberta}
            onSaveSemana={saveSemanaInscritos}
            onRetrato={guardarRetrato}
            onImportarTurmas={importarTurmas}
            registoAlunos={registoAlunos}
            onImportarInscritos={importarInscritos}
            onAplicarAtuais={aplicarInscritosAtuais}
            onCapacidade={definirCapacidade}
            onMudarTurma={mudarTurmaAluno}
            onMudarGenero={mudarGeneroAluno}
            gestaoDados={{ apagar: apagarDadosAlunos, renomear: renomearTurmaEpoca, renomearTurma: renomearTurmaLivre, turmasAtuais: turmasAlunos, distintas: marcarTurmasDistintas, renomearEscola: renomearEscolaEpoca, estadoEscola: definirEstadoEscola, epocas: epocasComDados, escolasComDados }}
            onGuardarMapaEscaloes={guardarMapaEscaloes}
            notificar={notificar}
            onSaveTurma={saveTurmaAlunos}
            onRemoveTurma={removeTurmaAlunos}
            onSaveEpocaAnterior={saveEpocaAnterior}
            onToggleTurmaEscola={toggleTurmaEscola}
            onAddOption={addOption}
            onRemoveOption={removeOption}
          />
        ) : page === "riscos" ? (
          <RiscosPage riscos={riscos} onGuardar={persistRiscos} deteccoesDe={deteccoesDe} notificar={notificar} ocorrencias={ocorrencias} radar={radar} />
        ) : page === "objetivos" ? (
          <ObjetivosPage objetivos={objetivos} onGuardar={persistObjetivos} notificar={notificar} contexto={contextoObjetivos} escolas={options.schools || []} documentos={documentos} />
        ) : page === "documentos" ? (
          <DocumentosPage dados={documentos} onGuardar={persistDocumentos} notificar={notificar} />
        ) : page === "formacao" ? (
          <FormacaoPage dados={formacao} onGuardar={persistFormacao} notificar={notificar} />
        ) : page === "apagados" ? (
          <ApagadosPage lista={apagados} onRepor={reporApagados} onApagarDeVez={(id) => guardarApagados(apagadosRef.current.filter((a) => a.id !== id))} />
        ) : page === "avaliacoes" ? (
          <AvaliacoesPage dados={avaliacoes} escolas={options.schools || []} onGuardar={persistAvaliacoes} notificar={notificar} />
        ) : page === "ocorrencias" ? (
          <OcorrenciasPage
            ocorrencias={ocorrencias}
            escolas={options.schools || []}
            categorias={options.categoriasOcorrencia || DEFAULT_CATEGORIAS_OCORRENCIA}
            riscosDaEpoca={riscosDaEpoca}
            onSave={guardarOcorrencia}
            onRemove={apagarOcorrencia}
            onGerirLista={setListaAberta}
            irParaRiscos={() => setPage("riscos")}
            propostas={(avisosRiscos && avisosRiscos.lista ? avisosRiscos.lista : []).filter((d) => d.daOcorrencia)}
            epPropostas={avisosRiscos ? avisosRiscos.ep : null}
            notificar={notificar}
          />
        ) : page === "hoje" ? (
          <HojePage
            avisosRiscos={avisosRiscos}
            radarNovas={radarNovas}
            ocorrencias={ocorrencias}
            reclamacoes={withStatus}
            plano={planoInq}
            regrasEnvio={{ ...DEFAULT_REGRAS_ENVIO, ...(options.regrasEnvioInq || {}) }}
            audits={auditsVista}
            experiencias={experiencias}
            desistencias={desistencias}
            desvinculacoes={desvinculacoes}
            turmasAlunos={turmasAlunos}
            inscritos={inscritosVista}
            epocaAnterior={epocaAnterior}
            escolas={options.schools || []}
            sanctions={sanctions}
            abrirReclamacao={(e) => {
              setPage("registo");
              setReclamacoesView("registo");
              setViewingDetail(e);
            }}
            irPara={(pg) => setPage(pg)}
          />
        ) : page === "relatorio" ? (
          <RelatorioEscolaPage
            escolas={options.schools || []}
            reclamacoes={withStatus}
            audits={auditsVista}
            sanctions={sanctions}
            inscritos={inscritosVista}
            turmasAlunos={turmasAlunos}
            epocaAnterior={epocaAnterior}
            avaliacoes={avaliacoes}
            registoAlunos={registoAlunos}
            desistencias={desistencias}
            experiencias={experiencias}
            desvinculacoes={desvinculacoes}
            satisfacao={satisfacao}
            inqueritos={inqueritos}
            niveis={options.niveis}
            notas={notasRelatorio}
            onGuardarNota={(k, v) => {
              persistNotasRel({ ...notasRelatorio, [k]: v });
              notificar("Notas guardadas.");
            }}
            notificar={notificar}
            tema={tema}
            setTema={setTema}
          />
        ) : page === "inqueritos" ? (
          <InqueritosPage
            inqueritos={inqueritos}
            tiposEvento={options.tiposEvento || DEFAULT_TIPOS_EVENTO}
            dimensoes={options.dimensoesInquerito || DEFAULT_DIMENSOES_INQ}
            onGuardar={guardarInquerito}
            onAtualizar={atualizarInquerito}
            onRemover={removerInquerito}
            onGerirLista={setListaAberta}
            notificar={notificar}
            plano={planoInq}
            regrasEnvio={{ ...DEFAULT_REGRAS_ENVIO, ...(options.regrasEnvioInq || {}) }}
            tipologias={options.tipologiasInq || DEFAULT_TIPOLOGIAS_INQ}
            onGuardarItemPlano={guardarItemPlano}
            onRemoverItemPlano={removerItemPlano}
            onImportarPlano={importarPlano}
            onGuardarRegras={(r) => {
              persistOptions({ ...options, regrasEnvioInq: r });
              notificar("Regras de envio guardadas. As datas foram recalculadas.");
            }}
          />
        ) : page === "sancoes" ? (
          <SanctionsPage
            sanctions={sanctions}
            onNew={() => setShowSanctionForm(true)}
            onOpen={(s) => setViewingSanction(s)}
          />
        ) : (
        <>
        <div
          style={{
            display: "inline-flex",
            gap: 3,
            padding: 3,
            marginBottom: 20,
            background: COLORS.segTrack,
            border: "none",
            borderRadius: 9,
          }}
        >
          {[
            { key: "registo", label: "Registo", icon: LayoutGrid },
            { key: "analise", label: "Análise", icon: BarChart3 },
            { key: "respostas", label: "Respostas-tipo", icon: MessageSquareText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className="pill"
              onClick={() => setReclamacoesView(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                border: "none",
                borderRadius: 7,
                background: reclamacoesView === key ? COLORS.paperRaised : "transparent",
                color: reclamacoesView === key ? COLORS.ink : COLORS.ink2,
                fontWeight: reclamacoesView === key ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: reclamacoesView === key ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {reclamacoesView === "respostas" ? (
          <BibliotecaRespostas
            biblioteca={respostasTipo.filter((r) => !r.arquivada)}
            historico={withStatus}
            notificar={notificar}
            onGuardar={(r) => persistRespostas(respostasTipo.some((x) => x.id === r.id) ? respostasTipo.map((x) => (x.id === r.id ? r : x)) : [...respostasTipo, r])}
            onRemover={(id) =>
              persistRespostas(
                respostasTipo
                  .map((x) => (x.id === id && (x.origem === "manual" || x.origem === "anexo") ? { ...x, arquivada: true } : x))
                  .filter((x) => x.id !== id || x.origem === "manual" || x.origem === "anexo")
              )
            }
          />
        ) : reclamacoesView === "analise" ? (
          <AnalysisDashboard withStatus={withStatus} audits={auditsVista} schoolOptions={options.schools} categoryOptions={options.categories} categoriaOptions={options.complaintCategories} />
        ) : (
        <>
        <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard label="Por iniciar" value={stats.porPegar} color={COLORS.warn} />
          <StatCard label="Em andamento" value={stats.emAndamento} color={COLORS.progress} />
          <StatCard label="Atrasadas" value={stats.atrasadas} color={COLORS.danger} />
          <StatCard label="Concluídas" value={stats.concluidas} color={COLORS.ok} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: COLORS.slate }} />
            <input
              placeholder="Pesquisar reclamante ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 32 }}
            />
          </div>
          <select value={filterEpoca} onChange={(e) => setFilterEpoca(e.target.value)} style={{ ...inputStyle, width: 150 }}>
            <option value="todas">Todas as épocas</option>
            {[...new Set(entries.map((e) => e.epoca).filter(Boolean))].sort().reverse().map((ep) => (
              <option key={ep} value={ep}>
                {ep}
              </option>
            ))}
          </select>
          <select value={filterCanal} onChange={(e) => setFilterCanal(e.target.value)} style={{ ...inputStyle, width: 190 }}>
            <option value="todos">Todos os canais</option>
            {Object.entries(CANAL_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 190 }}>
            <option value="todos">Todos os estados</option>
            <option value="por_pegar">Por iniciar</option>
            <option value="em_andamento">Em andamento</option>
            <option value="atrasado">Atrasado</option>
            <option value="concluido">Concluído</option>
          </select>
        </div>

        {loading ? (
          <EsqueletoPagina />
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
              color: COLORS.slate,
              border: `1.5px dashed ${COLORS.rule}`,
              borderRadius: 6,
            }}
          >
            Sem reclamações a mostrar. Cria a primeira entrada com "Nova reclamação".
          </div>
        ) : (
          <div style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.rule}`, borderRadius: 6, overflowX: "auto" }}>
            <table className="registoTabela" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 880 }}>
              <thead>
                <tr style={{ background: COLORS.paperSunken, textAlign: "left" }}>
                  {[["Nº", "Receção"], ["Canal", "Gravidade"], ["Categoria", "Tema"], ["Reclamante", "Escola"], ["Prazo"], ["Estado"], [""]].map(([h, h2]) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        fontSize: 11,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: COLORS.slate,
                        fontWeight: 600,
                        borderBottom: `1.5px solid ${COLORS.rule}`,
                      }}
                    >
                      {h}
                      {h2 && <span style={{ display: "block", marginTop: 2, fontWeight: 500, opacity: 0.75 }}>{h2}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${COLORS.rule}` }}>
                    <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums", color: COLORS.slate }}>
                      {String(e.entryNumber).padStart(4, "0")}
                      <span className="sub" style={{ color: COLORS.ink }}>{fmt(new Date(e.receivedDate + "T00:00:00"))}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "grid", justifyItems: "start", gap: 4 }}>
                        {e.canal && CANAL_META[e.canal] && <Tag label={CANAL_META[e.canal].label} color={CANAL_META[e.canal].color} bg={CANAL_META[e.canal].bg} />}
                        {e.severity && <Tag label={SEVERITY_META[e.severity].label} color={SEVERITY_META[e.severity].color} bg={SEVERITY_META[e.severity].bg} />}
                      </div>
                    </td>
                    <td className="quebra" style={{ padding: "10px 14px" }}>
                      {e.categoria && <Tag label={e.categoria} color={colorForLabel(e.categoria).color} bg={colorForLabel(e.categoria).bg} />}
                      <span className="sub">{e.tema || "—"}</span>
                    </td>
                    <td className="quebra" style={{ padding: "10px 14px", fontWeight: 600 }}>
                      {e.complainant}
                      <span className="sub">{(e.school || "—").replace(/^Dragon Force\s+/i, "")}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontVariantNumeric: "tabular-nums" }}>{fmt(new Date(e.deadline))}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <Stamp statusKey={e.derivedStatus} onClick={() => setViewingDetail(e)} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {e.status === "por_pegar" && (
                          <button title="Iniciar" onClick={() => startWork(e.id)} style={iconBtnStyle}>
                            <Play size={16} color={COLORS.progress} />
                          </button>
                        )}
                        {e.derivedStatus === "concluido" ? (
                          <button title="Reabrir" onClick={() => reopen(e.id)} style={iconBtnStyle}>
                            <Clock size={16} />
                          </button>
                        ) : (
                          <button title="Marcar concluído" onClick={() => setViewingDetail(e)} style={iconBtnStyle}>
                            <Check size={16} color={COLORS.ok} />
                          </button>
                        )}
                        <button
                          title="Editar"
                          onClick={() => {
                            setEditing(e);
                            setShowForm(true);
                          }}
                          style={iconBtnStyle}
                        >
                          <Pencil size={16} />
                        </button>
                        <button title="Eliminar" onClick={() => remove(e.id)} style={iconBtnStyle}>
                          <Trash2 size={16} color={COLORS.danger} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        </>
        )}
        </>
        )}
        </div>
      </div>

      {showForm && (
        <EntryForm
          initial={editing}
          nextNumber={nextNumber}
          schoolOptions={options.schools}
          categoryOptions={options.categories}
          categoriaOptions={options.complaintCategories}
          onGerirLista={setListaAberta}
          learned={learned}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}


      {viewingDetail && (
        <ComplaintDetail
          entry={withStatus.find((e) => e.id === viewingDetail.id) || viewingDetail}
          onClose={() => setViewingDetail(null)}
          onAddNote={addNote}
          biblioteca={respostasTipo.filter((r) => !r.arquivada)}
          historico={withStatus}
          onGerirLista={setListaAberta}
          notificar={notificar}
          recorrencia={(() => {
            const e = withStatus.find((x) => x.id === viewingDetail.id) || viewingDetail;
            const temaDe = (x) => String(x.tema || x.categoria || "").trim();
            const epDe = (x) => x.epoca || epocaDe(x.receivedDate);
            const tema = temaDe(e);
            if (!tema || !e.school) return null;
            const ep = epDe(e);
            const n = withStatus.filter((x) => x.school === e.school && temaDe(x) === tema && epDe(x) === ep).length;
            if (n < 3) return null;
            const id = idRecorrencia(e.school, tema);
            const it = (((riscos.epocas || {})[ep] || {}).itens || []).find((i) => (i.detetores || []).includes(id));
            return { n, tema, escola: e.school, ligado: it ? it.n : null };
          })()}
          onIrRiscos={() => {
            setViewingDetail(null);
            setPage("riscos");
          }}
          contactosEscola={{
            op: (options.emailsOperacionais || {})[(withStatus.find((e) => e.id === viewingDetail.id) || viewingDetail).school] || [],
            ct: (options.emailsCoordenadores || {})[(withStatus.find((e) => e.id === viewingDetail.id) || viewingDetail).school] || [],
          }}
          onStart={(id) => {
            startWork(id);
            setViewingDetail(null);
          }}
          onDone={(id, extra, keepOpen) => {
            markDone(id, extra);
            if (!keepOpen) setViewingDetail(null);
          }}
          onReopen={(id) => {
            reopen(id);
            setViewingDetail(null);
          }}
        />
      )}

      {preencherAud && (
        <PreencherAreasCategorias
          itens={audits
            .slice()
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .flatMap((a) => (a.findings || []).filter((f) => !f.area || !f.category).map((f) => ({ auditId: a.id, f, rotulo: `${a.school} · ${dataAud(a)}` })))}
          areas={options.auditAreas || []}
          categorias={options.auditCategories || []}
          mapaAreas={options.mapaAreasAud || {}}
          onGerirLista={setListaAberta}
          onFechar={() => setPreencherAud(false)}
          onAplicar={(alteracoes) => {
            updateFindings(alteracoes);
            setPreencherAud(false);
          }}
        />
      )}

      {isoAud && (
        <AssociarISO
          itens={audits
            .slice()
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .flatMap((a) => (a.findings || []).filter((f) => !f.iso).map((f) => ({ auditId: a.id, f, rotulo: `${a.school} · ${dataAud(a)}` })))}
          onFechar={() => setIsoAud(false)}
          onAplicar={(alteracoes) => {
            updateFindings(alteracoes);
            setIsoAud(false);
            notificar(`Requisito ISO associado a ${alteracoes.length} ${alteracoes.length === 1 ? "constatação" : "constatações"}.`);
          }}
        />
      )}

      {areasAud && (
        <AreasConstatacoes
          audits={audits}
          areas={options.auditAreas || []}
          mapaGuardado={options.mapaAreasAud || {}}
          onGerirLista={setListaAberta}
          onFechar={() => setAreasAud(false)}
          onAplicar={(mapa) => {
            let n = 0;
            persistAudits(
              audits.map((a) => ({
                ...a,
                findings: (a.findings || []).map((f) => {
                  const k = f.category || f.description || "";
                  if (!k || mapa[k] === undefined) return f;
                  n++;
                  return { ...f, category: f.category || k, area: mapa[k] };
                }),
              }))
            );
            const cats = Object.keys(mapa).filter((k) => !(options.auditCategories || []).includes(k));
            const guardar = Object.fromEntries(Object.entries(mapa).filter(([, v]) => v).map(([k, v]) => [normChave(k), v]));
            persistOptions({ ...options, auditCategories: [...(options.auditCategories || []), ...cats], mapaAreasAud: { ...(options.mapaAreasAud || {}), ...guardar } });
            setAreasAud(false);
            notificar(`Área e categoria atualizadas em ${n} constatações.`);
          }}
        />
      )}

      {importarAud && (
        <ImportarAuditorias
          audits={audits}
          escolas={options.schools}
          categorias={options.auditCategories || []}
          areas={options.auditAreas || []}
          mapaAreas={options.mapaAreasAud || {}}
          onFechar={() => setImportarAud(false)}
          onImportar={(novas, acrescentos, novasEscolas, atualizacoes = {}) => {
            const n = novas.reduce((t, a) => t + a.findings.length, 0) + Object.values(acrescentos).reduce((t, l) => t + l.length, 0);
            persistAudits([
              ...audits.map((a) => {
                if (!acrescentos[a.id] && !atualizacoes[a.id]) return a;
                const desc = Object.fromEntries((atualizacoes[a.id] || []).map((u) => [u.id, u.description]));
                return { ...a, findings: [...(a.findings || []).map((f) => (desc[f.id] ? { ...f, description: desc[f.id] } : f)), ...(acrescentos[a.id] || [])] };
              }),
              ...novas,
            ]);
            // Os assuntos do Excel passam a fazer parte da lista de categorias.
            const assuntos = [...new Set([...novas.flatMap((a) => a.findings), ...Object.values(acrescentos).flat()].map((f) => f.category).filter(Boolean))];
            persistOptions({
              ...options,
              schools: [...options.schools, ...novasEscolas.filter((e) => !options.schools.includes(e))],
              auditCategories: [...(options.auditCategories || []), ...assuntos.filter((x) => !(options.auditCategories || []).includes(x))],
            });
            setImportarAud(false);
            const nAtual = Object.values(atualizacoes).reduce((t, l) => t + l.length, 0);
            notificar(`${n} constatações importadas em ${novas.length} visitas novas${Object.keys(acrescentos).length ? ` e ${Object.keys(acrescentos).length} já existentes` : ""}${nAtual ? ` · ${nAtual} descrições preenchidas` : ""}.`);
          }}
        />
      )}

      {showAuditForm && (
        <AuditForm
          schoolOptions={options.schools}
          onCancel={() => setShowAuditForm(false)}
          onSave={addAudit}
          onGerirLista={setListaAberta}
        />
      )}

      {viewingAudit && (
        <AuditDetail
          audit={auditsVista.find((a) => a.id === viewingAudit.id) || viewingAudit}
          auditCategoryOptions={options.auditCategories}
          areaOptions={options.auditAreas}
          onClose={() => setViewingAudit(null)}
          onAddFinding={addFinding}
          onRemoveFinding={removeFinding}
          onUpdateFinding={updateFinding}
          onUpdateFindings={updateFindings}
          mapaAreas={options.mapaAreasAud || {}}
          onRemoveAudit={removeAudit}
          onUpdateAudit={updateAudit}
          schoolOptions={options.schools}
          onGerirLista={setListaAberta}
          audits={audits}
        />
      )}

      {String(listaAberta || "").startsWith("__indice") && (
        <div
          className="veil"
          style={{ position: "fixed", inset: 0, background: "rgba(8,14,24,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}
          onClick={() => setListaAberta(null)}
        >
          <div
            className="sheet"
            style={{
              width: "min(520px, 100%)",
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
              background: COLORS.paperRaised,
              border: `1px solid ${COLORS.rule}`,
              borderRadius: 14,
              padding: "20px 22px 22px",
              boxShadow: "0 20px 50px -12px rgba(8,14,24,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em" }}>
                {listaAberta === "__indice" ? "Listas da app" : `Listas de ${listaAberta.split(":")[1]}`}
              </div>
              <button onClick={() => setListaAberta(null)} style={{ ...iconBtnStyle, padding: 0 }} aria-label="Fechar">
                <X size={17} />
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.ink2, marginBottom: 16, lineHeight: 1.5 }}>
              Também podes gerir cada lista onde ela é usada, no link "Gerir" junto ao campo.
            </div>
            {listaAberta === "__indice" && (
              <button
                onClick={() => {
                  setListaAberta(null);
                  setContactosAbertos(true);
                }}
                className="liftable"
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: `1px solid ${COLORS.rule}`, borderRadius: 10, background: "transparent", padding: "11px 13px", cursor: "pointer", color: COLORS.ink, fontSize: 13.5, marginBottom: 16 }}
              >
                <Mail size={15} color={COLORS.navySoft} />
                <span style={{ flex: 1, fontWeight: 500 }}>Contactos das escolas (e-mails)</span>
                <span style={{ fontSize: 11.5, color: COLORS.slate }}>{Object.keys(options.emailsOperacionais || {}).length} escolas</span>
              </button>
            )}
            {(listaAberta === "__indice"
              ? ["Geral", "Reclamações", "Auditorias", "Sanções", "Inscritos", "Inquéritos"]
              : [listaAberta.split(":")[1]]
            ).map((areaNome) => {
              const doGrupo = Object.entries(LISTAS).filter(([, m]) => m.area === areaNome);
              if (doGrupo.length === 0) return null;
              return (
                <div key={areaNome} style={{ marginBottom: 16 }}>
                  {listaAberta === "__indice" && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.slate, marginBottom: 7 }}>{areaNome}</div>
                  )}
                  <div style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 10, overflow: "hidden" }}>
                    {doGrupo.map(([chave, meta], i) => (
                      <button
                        key={chave}
                        onClick={() => setListaAberta(chave)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderTop: i ? `1px solid ${COLORS.ruleSoft}` : "none",
                    background: "transparent",
                    padding: "11px 13px",
                    cursor: "pointer",
                    color: COLORS.ink,
                    fontSize: 13.5,
                  }}
                        className="liftable"
                      >
                        <span style={{ flex: 1, fontWeight: 500 }}>{meta.titulo}</span>
                        <span style={{ fontSize: 11.5, color: COLORS.slate, fontVariantNumeric: "tabular-nums" }}>
                          {(options[chave] || []).length} item(s)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {contactosAbertos && (
        <ContactosEscolas
          escolas={options.schools || []}
          options={options}
          onFechar={() => setContactosAbertos(false)}
          onGuardar={(c) => {
            persistOptions({ ...options, ...c });
            setContactosAbertos(false);
            notificar("Contactos das escolas guardados.");
          }}
        />
      )}

      {listaAberta && listaAberta !== "__indice" && LISTAS[listaAberta] && (
        <GestorLista
          titulo={LISTAS[listaAberta].titulo}
          nota={LISTAS[listaAberta].nota}
          placeholder={LISTAS[listaAberta].placeholder}
          itens={options[listaAberta] || []}
          emUso={LISTAS[listaAberta].emUso}
          onAdd={(v) => addOption(listaAberta, v)}
          onRemove={(v) => removeOption(listaAberta, v)}
          onClose={() => setListaAberta(null)}
        />
      )}

      <PaletaComandos aberta={paletaAberta} onFechar={() => setPaletaAberta(false)} comandos={comandosPaleta} />

      <Notificacoes lista={notificacoes} onFechar={fecharNotificacao} />

      {showSanctionForm && (
        <SanctionForm
          onCancel={() => setShowSanctionForm(false)}
          onSave={saveSanction}
          schoolOptions={options.schools}
          complaints={entries}
          sanctionTypes={options.sanctionTypes}
          onGerirLista={setListaAberta}
          turmas={options.turmas || DEFAULT_TURMAS}
          turmasPorEscola={options.turmasPorEscola || {}}
          registoAlunos={registoAlunos}
        />
      )}

      {viewingSanction && (
        <SanctionDetail
          sanction={sanctions.find((s) => s.id === viewingSanction.id) || viewingSanction}
          onClose={() => setViewingSanction(null)}
          onUpdate={updateSanction}
          onAddNote={addSanctionNote}
          onRemove={removeSanction}
          complaints={entries}
          sanctionTypes={options.sanctionTypes}
          onEdit={(s) => setEditingSanction(s)}
        />
      )}

      {editingSanction && (
        <SanctionForm
          inicial={editingSanction}
          onCancel={() => setEditingSanction(null)}
          onSave={(s) => {
            const { id, ...resto } = s;
            updateSanction(editingSanction.id, resto);
            setEditingSanction(null);
            notificar("Ocorrência atualizada.");
          }}
          schoolOptions={options.schools}
          complaints={entries}
          sanctionTypes={options.sanctionTypes}
          onGerirLista={setListaAberta}
          turmas={options.turmas || DEFAULT_TURMAS}
          turmasPorEscola={options.turmasPorEscola || {}}
          registoAlunos={registoAlunos}
        />
      )}
    </div>
  );
}

// ======================================================================
// ---------- Entrada com palavra-passe ----------
// ======================================================================
// A app só carrega dados depois de iniciar sessão no Supabase. A proteção
// real está nas regras da base de dados (só utilizadores autenticados leem e
// escrevem); este ecrã é a porta de entrada.

// Conta partilhada da equipa: cria este utilizador no Supabase
// (Authentication → Users → Add user) com a palavra-passe que quiseres.
const EMAIL_ENTRADA = "equipa@qualidade-df.app";

// Fotografia do muro "Foot-Ball Club do Porto", em monocromático azul, para o fundo do ecrã de entrada.

function EcraEntrada({ onEntrar, aVerificar }) {
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState(EMAIL_ENTRADA);
  const [outroEmail, setOutroEmail] = useState(false);
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState("");
  const [aEntrar, setAEntrar] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    if (!pass) return setErro("Escreve a palavra-passe.");
    setAEntrar(true);
    setErro("");
    try {
      const { error } = await onEntrar(email.trim(), pass);
      if (error) setErro(/invalid/i.test(error.message || "") ? "Palavra-passe incorreta." : `Não foi possível entrar: ${error.message}`);
    } catch (err) {
      setErro("Sem ligação ao servidor. Tenta de novo daqui a pouco.");
    } finally {
      setAEntrar(false);
    }
  };

  return (
    <div className="entrada">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        html, body { margin: 0; padding: 0; background: #07142A; overscroll-behavior: none; }
        .entrada {
          position: fixed; inset: 0; z-index: 100; overflow-y: auto; overscroll-behavior: contain;
          display: grid; place-items: center; padding: 24px 16px; box-sizing: border-box;
          font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #EAF0F8;
          background: #0A1D38;
          -webkit-font-smoothing: antialiased;
          isolation: isolate;
        }
        /* Fundo: o muro "Foot-Ball Club do Porto" em monocromático azul.
           No computador o formulário fica à esquerda e o letreiro à direita,
           inteiro; no telemóvel o letreiro fica em cima e o formulário em baixo. */
        .entradaFundo { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; background: #07142A; }
        .entradaFundo .foto { position: absolute; inset: 0; background-size: cover; background-position: 62% 16%; }
        .entradaFundo .veu {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(5, 14, 30, 0.1) 0%, rgba(5, 14, 30, 0.45) 34%, rgba(5, 14, 30, 0.9) 56%, #07142A 100%);
        }
        @media (max-width: 899px) {
          .entrada { place-items: end center; padding-bottom: 40px; }
          /* Só a metade de cima tem a foto, para o letreiro não ficar por trás do símbolo. */
          .entradaFundo .foto { background-size: auto 58vh; background-repeat: no-repeat; background-position: 58% 0; }
          .entradaFundo .veu { background: linear-gradient(180deg, rgba(5, 14, 30, 0.05) 0%, rgba(5, 14, 30, 0.35) 30%, rgba(7, 20, 42, 0.95) 50%, #07142A 58%, #07142A 100%); }
        }
        @media (min-width: 900px) {
          .entrada { place-items: center start; padding-left: clamp(48px, 8vw, 140px); }
          .entradaFundo .foto {
            left: 32%; background-position: 50% 30%;
            -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 26%);
            mask-image: linear-gradient(90deg, transparent 0%, #000 26%);
          }
          .entradaFundo .veu {
            background:
              linear-gradient(90deg, #07142A 0%, rgba(7, 20, 42, 0.9) 30%, rgba(7, 20, 42, 0.2) 62%, rgba(7, 20, 42, 0.05) 100%),
              linear-gradient(180deg, transparent 60%, rgba(5, 14, 30, 0.6) 100%);
          }
        }
        .entradaCaixa { width: min(360px, 100%); display: flex; flex-direction: column; align-items: center; text-align: center; }
        .entradaLogo { height: 92px; width: auto; opacity: 0; animation: entradaLogo 1000ms cubic-bezier(0.32, 0.72, 0, 1) 80ms forwards; }
        .entradaLogoHalo { position: relative; display: grid; place-items: center; width: 150px; height: 130px; margin-bottom: 10px; }
        .entradaTitulo { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -0.01em; opacity: 0; animation: entradaSobe 700ms cubic-bezier(0.32, 0.72, 0, 1) 380ms forwards; }
        .entradaSub { margin: 6px 0 26px; font-size: 13px; color: #8FA3BF; opacity: 0; animation: entradaSobe 700ms cubic-bezier(0.32, 0.72, 0, 1) 460ms forwards; }
        .entradaForm { width: 100%; display: grid; gap: 10px; opacity: 0; animation: entradaSobe 700ms cubic-bezier(0.32, 0.72, 0, 1) 560ms forwards; }
        .entradaCampo { position: relative; }
        .entradaInput {
          width: 100%; box-sizing: border-box; height: 46px; border-radius: 12px; padding: 0 44px 0 14px;
          border: 1px solid rgba(160, 190, 230, 0.22); background: rgba(255, 255, 255, 0.06); color: #F3F6FB;
          font: inherit; font-size: 15px; outline: none; transition: border-color 160ms ease, background 160ms ease;
        }
        .entradaInput::placeholder { color: #7D8FA8; }
        .entradaInput:focus { border-color: rgba(120, 170, 255, 0.7); background: rgba(255, 255, 255, 0.09); }
        .entradaOlho { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #8FA3BF; font: inherit; font-size: 12px; cursor: pointer; padding: 6px; border-radius: 6px; }
        .entradaOlho:focus-visible, .entradaLink:focus-visible { outline: 2px solid rgba(120, 170, 255, 0.8); }
        .entradaBotao {
          height: 46px; border-radius: 12px; border: none; cursor: pointer; font: inherit; font-size: 15px; font-weight: 600;
          color: #08172B; background: #F3F6FB; transition: transform 120ms ease, opacity 160ms ease;
        }
        .entradaBotao:hover { opacity: 0.92; }
        .entradaBotao:active { transform: scale(0.985); }
        .entradaBotao:disabled { opacity: 0.6; cursor: default; }
        .entradaBotao:focus-visible { outline: 2px solid rgba(120, 170, 255, 0.9); outline-offset: 2px; }
        .entradaErro { font-size: 13px; color: #FF9C9C; min-height: 18px; }
        .entradaLink { background: none; border: none; color: #8FA3BF; font: inherit; font-size: 12px; cursor: pointer; margin-top: 4px; text-decoration: underline; text-underline-offset: 3px; }
        .entradaRodape { margin-top: 34px; font-size: 11px; color: #5F7391; letter-spacing: 0.04em; }
        @keyframes entradaLogo { from { opacity: 0; transform: translateY(10px) scale(0.94); } to { opacity: 1; transform: none; } }
        @keyframes entradaSobe { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        /* Depois de entrar: o ecrã de login desvanece por cima da app. */
        @keyframes entradaSai { from { opacity: 1; } to { opacity: 0; transform: scale(1.02); } }
        .entradaSaida .entrada { pointer-events: none; animation: entradaSai 600ms cubic-bezier(0.32, 0.72, 0, 1) forwards; }
        /* Animação de loading enquanto verifica sessão */
        @keyframes dfPulso { 0%, 100% { opacity: 0.55; transform: scale(0.97); } 50% { opacity: 1; transform: scale(1.03); } }
        @keyframes dfBrilho { 0% { stop-color: #F5A623; stop-opacity: 0.6; } 50% { stop-color: #FFD580; stop-opacity: 1; } 100% { stop-color: #F5A623; stop-opacity: 0.6; } }
        @keyframes dfChama { 0%, 100% { transform: scaleY(1) translateY(0); } 40% { transform: scaleY(1.08) translateY(-2px); } 70% { transform: scaleY(0.96) translateY(1px); } }
        @keyframes dfHalo { 0%, 100% { opacity: 0; r: 52px; } 50% { opacity: 0.18; r: 62px; } }
        @keyframes dfTexto { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .dfLoading { display: flex; flex-direction: column; align-items: center; gap: 18px; margin-top: 8px; }
        .dfLoading img { animation: dfPulso 2s ease-in-out infinite; filter: drop-shadow(0 0 18px rgba(33, 150, 201, 0.45)); }
        .dfLoading .chama { transform-origin: center bottom; animation: dfChama 2s ease-in-out infinite; }
        .dfCarregando { font-size: 12px; color: #8FA3BF; letter-spacing: 0.12em; text-transform: uppercase; animation: dfTexto 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .entradaLogo, .entradaTitulo, .entradaSub, .entradaForm { animation: none; opacity: 1; }
          .entradaSaida .entrada { animation: none; opacity: 0; }
          .dfLoading img, .dfLoading .chama, .dfCarregando { animation: none; opacity: 1; }
        }
      `}</style>
      <div className="entradaFundo" aria-hidden="true">
        <div className="foto" style={{ backgroundImage: `url(${FOTO_ESTADIO})` }} />
        <div className="veu" />
      </div>
      <div className="entradaCaixa">
        <div className="entradaLogoHalo">
          <img className="entradaLogo" src={LOGO_BRANCO} alt="Dragon Force" />
        </div>
        <h1 className="entradaTitulo">Auditoria e Gestão de Qualidade</h1>
        <div className="entradaSub">Dragon Force · acesso reservado</div>
        {aVerificar ? (
          <div className="dfLoading" aria-label="A verificar sessão…">
            <img src={SIMBOLO_DF} alt="" width="100" height="118" />
            <span className="dfCarregando">A carregar…</span>
          </div>
        ) : (
          <form className="entradaForm" onSubmit={entrar}>
            {outroEmail && (
              <input className="entradaInput" type="email" autoComplete="username" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" />
            )}
            {!outroEmail && <input type="hidden" autoComplete="username" value={email} readOnly />}
            <div className="entradaCampo">
              <input
                className="entradaInput"
                type={ver ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Palavra-passe"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoFocus
                aria-label="Palavra-passe"
              />
              <button type="button" className="entradaOlho" onClick={() => setVer((v) => !v)} aria-label={ver ? "Esconder palavra-passe" : "Mostrar palavra-passe"}>
                {ver ? "Esconder" : "Mostrar"}
              </button>
            </div>
            <button className="entradaBotao" type="submit" disabled={aEntrar}>
              {aEntrar ? "A entrar…" : "Entrar"}
            </button>
            <div className="entradaErro" role="alert">
              {erro}
            </div>
            <button type="button" className="entradaLink" onClick={() => setOutroEmail((v) => !v)}>
              {outroEmail ? "Usar a conta da equipa" : "Entrar com outro e-mail"}
            </button>
          </form>
        )}
        <div className="entradaRodape">FC PORTO · DRAGON FORCE</div>
      </div>
    </div>
  );
}

// Porta de entrada: mostra o ecrã de entrada até haver sessão.
export default function App() {
  const [sessao, setSessao] = useState(undefined);
  // Ao entrar, o ecrã de login fica por cima uns instantes e desvanece enquanto a app aparece por baixo.
  // "verificar" = já havia sessão ao abrir (mostra só o logótipo); "login" = acabou de entrar.
  const [cortina, setCortina] = useState(false);
  const atual = useRef(undefined);

  useEffect(() => {
    let ativo = true;
    const recebe = (s) => {
      const novo = s || null;
      if (novo && !atual.current) setCortina(atual.current === undefined ? "verificar" : "login");
      if (!novo) setCortina(false);
      atual.current = novo;
      setSessao(novo);
    };
    supabase.auth.getSession().then(({ data }) => ativo && recebe(data?.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => recebe(s));
    return () => {
      ativo = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  // A app monta primeiro por baixo do ecrã de login (ainda opaco); só depois de pintada é que o login desvanece.
  // Assim o trabalho pesado do primeiro render não "come" a animação.
  const [aDesvanecer, setADesvanecer] = useState(false);
  useEffect(() => {
    if (!cortina) {
      setADesvanecer(false);
      return undefined;
    }
    let t;
    let r2;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        setADesvanecer(true);
        t = setTimeout(() => setCortina(false), 650);
      });
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(t);
    };
  }, [cortina]);

  // Ao sair, a app desvanece primeiro e só depois termina a sessão.
  const sair = () => {
    const raiz = document.documentElement;
    raiz.classList.add("aSair");
    setTimeout(async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        raiz.classList.remove("aSair");
      }
    }, 260);
  };

  const mostrarEntrada = !sessao || cortina;
  return (
    <>
      {sessao && <AppPrincipal onSair={sair} />}
      {mostrarEntrada && (
        <div className={sessao && aDesvanecer ? "entradaSaida" : undefined}>
          <EcraEntrada aVerificar={sessao === undefined || cortina === "verificar"} onEntrar={(email, password) => supabase.auth.signInWithPassword({ email, password })} />
        </div>
      )}
    </>
  );
}
