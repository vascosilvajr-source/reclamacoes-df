// Critérios Obrigatórios da Certificação FPF (Manual Julho 2025-2026, Futebol Masculino)
// Extraído do Manual de Certificação. Cada item é uma questão de cumprimento
// obrigatório (não pontua, mas o não-cumprimento impede a certificação no nível
// correspondente ou em qualquer nível superior).
//
// nivel:
//   "cbff"  -> obrigatório a partir de CBFF (todos os níveis)
//   "1e2"   -> obrigatório a partir de Escola de Futebol 1 e 2 estrelas
//   "3"     -> obrigatório a partir de Entidade Formadora 3 estrelas
//   "4e5"   -> obrigatório apenas para Entidade Formadora 4 e 5 estrelas
//
// criterio: número do critério FPF (1 a 9) a que a questão pertence.

export const NIVEL_LABEL = {
  cbff: "CBFF",
  "1e2": "Escola 1-2★",
  "3": "3★",
  "4e5": "4-5★",
};

export const CRITERIOS_OBRIGATORIOS = [
  // ---------- Declarações de Compromisso (Dados Gerais) — obrigatório a partir de CBFF ----------
  { criterio: 0, nivel: "cbff", title: "Compromisso: Linhas Orientadoras da Integridade", requirement: "A Entidade declara conhecer e respeitar o documento das Linhas Orientadoras da Integridade, disponibilizado pela FPF." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: Linhas Orientadoras de Recrutamento/Angariação", requirement: "A Entidade declara conhecer e respeitar o documento das Linhas Orientadoras sobre os Procedimentos de Recrutamento e Angariação de Praticantes." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: proteção de menores", requirement: "Cumprir todos os procedimentos de proteção de menores (Lei 147/99), com pelo menos o Diretor da Academia, o Responsável de Acompanhamento Escolar ou o Responsável de Acompanhamento D.R.E. a ter concluído o curso online UEFA de Salvaguarda e Proteção das Crianças e Jovens no Futebol." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: praticantes não-nacionais não residentes", requirement: "Conhecer e cumprir todos os procedimentos exigidos para ações de recrutamento de praticantes não-nacionais, não residentes em Portugal." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: seguro e exame médico-desportivo", requirement: "Todos os praticantes têm Seguro Desportivo e Exame Médico-Desportivo Obrigatório válidos, inscritos na ADR via SCORE e/ou registados na Plataforma de Registo da FPF." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: Etapas de Desenvolvimento do Praticante", requirement: "Conhecer e respeitar o documento das Etapas de Desenvolvimento do(a) Praticante, disponibilizado pela FPF." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: escolaridade obrigatória", requirement: "Todos os praticantes concluíram a escolaridade obrigatória ou frequentam estabelecimento de ensino, regular ou alternativo." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: disponibilidade para Seleções", requirement: "Desenvolver todos os esforços para que praticantes convocados para Seleções Nacionais/Distritais compareçam a treinos, estágios, torneios e jogos." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: registos criminais de todos os RH", requirement: "Para além dos registos criminais dos RH identificados na plataforma, solicitar e validar os registos criminais de todos os demais RH e prestadores de serviços com contacto regular/pontual com menores." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: equipamentos e materiais seguros", requirement: "Nas atividades com os escalões de formação (treino, competição, complementares), usar apenas equipamentos e materiais que respeitem as condições regulamentares e de segurança." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: transportes próprios regulamentares", requirement: "Caso disponha de transportes próprios para as equipas de formação, os mesmos respeitam todas as condições regulamentares exigidas." },
  { criterio: 0, nivel: "cbff", title: "Compromisso: sem dívidas a colaboradores", requirement: "Não existem dívidas vencidas a recursos humanos (área técnica, médica, administrativa) e a Entidade cumprirá os compromissos assumidos durante a época." },

  // ---------- Critério 1 – Planeamento Estratégico e Orçamento ----------
  { criterio: 1, nivel: "1e2", title: "Missão/Visão/Valores/Objetivos comunicados", requirement: "Missão, Visão, Valores e Objetivos definidos, atualizados e conhecidos de todos os colaboradores; pelo menos a Missão comunicada/afixada de forma visível." },
  { criterio: 1, nivel: "1e2", title: "Registo na Bandeira da Ética/IPDJ", requirement: "Registada na plataforma da Bandeira da Ética/IPDJ, com candidatura submetida de 1+ iniciativa sobre Ética e Fair-Play envolvendo os praticantes." },
  { criterio: 1, nivel: "1e2", title: "Orçamento da Formação discriminado", requirement: "Evidenciar as principais rúbricas de proveitos e custos do orçamento para a Formação, por área operacional." },
  { criterio: 1, nivel: "3", title: "Responsável pela Ética e Integridade", requirement: "Dispor de um responsável (exclusivo ou não) identificado e caracterizado que centralize a gestão dos temas de Ética e Integridade." },

  // ---------- Critério 2 – Estrutura Organizacional e Manual de Acolhimento ----------
  { criterio: 2, nivel: "cbff", title: "Manual de Acolhimento conhecido", requirement: "Dispor de Manual de Acolhimento e Boas Práticas, conhecido por todos os praticantes e Pais/Encarregados de Educação." },
  { criterio: 2, nivel: "cbff", title: "Condições de inscrição claras no Manual", requirement: "O Manual evidencia de forma clara as condições exigidas a praticantes e pais (inscrição, mensalidades, equipamentos, etc.)." },
  { criterio: 2, nivel: "cbff", title: "Normas sobre praticantes D.R.E. no Manual", requirement: "O Manual apresenta as normas especiais de acompanhamento de praticantes deslocados das famílias (D.R.E.)." },
  { criterio: 2, nivel: "1e2", title: "Normas sobre relação com Pais/EE", requirement: "O Manual apresenta as normas sobre as relações com Pais/Encarregados de Educação dos praticantes." },
  { criterio: 2, nivel: "1e2", title: "Quadro disciplinar para Pais/EE", requirement: "O Manual apresenta Infrações e Quadro Disciplinar referentes aos comportamentos dos Pais/Encarregados de Educação (incl. bullying, assédio, violência)." },
  { criterio: 2, nivel: "3", title: "Normas de conduta gerais", requirement: "O Manual apresenta normas de conduta entre praticantes, dirigentes e técnicos." },
  { criterio: 2, nivel: "3", title: "Normas de conduta em treino/competição", requirement: "O Manual apresenta normas de conduta específicas para treino e competição." },
  { criterio: 2, nivel: "3", title: "Indicações sobre Apostas e Match Fixing", requirement: "O Manual apresenta indicações sobre Integridade, nomeadamente comportamentos a adotar quanto a Apostas e Match Fixing." },
  { criterio: 2, nivel: "3", title: "Recomendações alimentares/nutrição/hidratação", requirement: "O Manual apresenta recomendações alimentares, de nutrição e hidratação, alinhadas com o Plano Nutricional." },
  { criterio: 2, nivel: "3", title: "Infogramas de emergência médica no Manual", requirement: "O Manual apresenta as normas de Acompanhamento Médico-Desportivo, incluindo os Infogramas de Emergência Médica." },
  { criterio: 2, nivel: "3", title: "Normas de acompanhamento escolar/social", requirement: "O Manual apresenta as normas sobre Acompanhamento Escolar, Pessoal e Social." },
  { criterio: 2, nivel: "3", title: "Quadro disciplinar para praticantes", requirement: "O Manual apresenta Infrações e Quadro Disciplinar referentes aos comportamentos dos praticantes (incl. bullying, assédio, violência)." },

  // ---------- Critério 3 – Recrutamento e/ou Angariação ----------
  { criterio: 3, nivel: "cbff", title: "Legalidade de praticantes não-nacionais", requirement: "Nas ações de recrutamento de não-nacionais não residentes, evidenciar que se encontram legalmente em Portugal." },
  { criterio: 3, nivel: "cbff", title: "Estadia e regresso de praticantes não-nacionais", requirement: "Assegurar a estadia, acompanhamento e garantia de regresso ao país de origem em caso de não concretização da contratação." },
  { criterio: 3, nivel: "cbff", title: "Comunicação à FPF em 48h", requirement: "Informar a FPF em 48h (estrangeiros@fpf.pt) sobre chegada, permanência e regresso de praticantes não-nacionais." },
  { criterio: 3, nivel: "1e2", title: "Política de Recrutamento/Angariação documentada", requirement: "Política de Recrutamento (performance) e/ou Angariação (aumento de nº de praticantes) devidamente definida e documentada." },
  { criterio: 3, nivel: "1e2", title: "Procedimentos de Recrutamento definidos", requirement: "Evidenciar Procedimentos de Recrutamento devidamente definidos e documentados." },
  { criterio: 3, nivel: "1e2", title: "Angariação proativa e documentada", requirement: "Atuar proativamente na Angariação de praticantes, com procedimentos definidos e documentados." },
  { criterio: 3, nivel: "4e5", title: "Formação interna de RH de Recrutamento/Angariação", requirement: "RH com funções de recrutamento/angariação recebem formação interna anual sobre a Política/Procedimentos e as Linhas Orientadoras de Ética da FPF." },
  { criterio: 3, nivel: "4e5", title: "Procedimentos de comunicação com Pais/Clubes", requirement: "Os Procedimentos de Recrutamento definem a comunicação e atuação com Pais/EE, Clubes e demais agentes, respeitando as Linhas Orientadoras de Ética." },

  // ---------- Critério 4 – Formação Desportiva ----------
  { criterio: 4, nivel: "1e2", title: "Documento Orientador: objetivos de ensino do jogo", requirement: "O Documento Orientador define os objetivos no ensino do jogo, respeitando as diferentes etapas de desenvolvimento." },
  { criterio: 4, nivel: "1e2", title: "Dossier de treino padronizado", requirement: "O dossier de treino é padronizado, com conteúdos adequados e estrutura comum para todas as equipas." },
  { criterio: 4, nivel: "1e2", title: "Dossier de treino supervisionado", requirement: "O dossier de treino é supervisionado pelo Diretor/Coordenador Técnico." },
  { criterio: 4, nivel: "1e2", title: "Plano de Transição definido", requirement: "A Entidade tem o Plano de Transição devidamente definido e documentado." },
  { criterio: 4, nivel: "3", title: "Dossier de treino: plantel e fichas individuais", requirement: "O dossier de treino tem o plantel e as fichas individuais, incluindo avaliação comportamental e, a partir da especialização, avaliação de desempenho." },
  { criterio: 4, nivel: "3", title: "Dossier de treino: planeamento e microciclo", requirement: "O dossier de treino tem o planeamento anual (ou mesociclos), o microciclo, e o registo dos conteúdos das unidades de treino e complementares." },
  { criterio: 4, nivel: "4e5", title: "Documento Orientador Técnico completo", requirement: "Evidenciar Documento Orientador Técnico organizado/estruturado, com índice e eventuais referências bibliográficas." },
  { criterio: 4, nivel: "4e5", title: "Modelo de Competências por Posição", requirement: "O Documento Orientador define o Modelo de Competências a desenvolver por Posição." },
  { criterio: 4, nivel: "4e5", title: "Perfil de treinador por escalão", requirement: "O Documento Orientador define o perfil do treinador por escalão." },
  { criterio: 4, nivel: "4e5", title: "Documento Orientador conhecido pela estrutura técnica", requirement: "Evidenciar que o Documento Orientador é do conhecimento de toda a estrutura técnica (Diretor, Coordenadores, Treinadores)." },
  { criterio: 4, nivel: "4e5", title: "Dossier de treino: definição de objetivos", requirement: "O dossier de treino tem definição de objetivos formativos, focados na formação/evolução/desenvolvimento, com controlo/avaliação do cumprimento." },
  { criterio: 4, nivel: "4e5", title: "1 treino semanal em campo inteiro (Sub-15 a Sub-19)", requirement: "Evidenciar, através do MAPA-TIPO, pelo menos 1 treino semanal em campo inteiro/regulamentar para as equipas de Sub-15 a Sub-19." },

  // ---------- Critério 5 – Acompanhamento Médico-Desportivo ----------
  { criterio: 5, nivel: "cbff", title: "Plano de Atividades do Dep. Médico", requirement: "Plano de Atividades definido, documentado, assinado e datado, com Organograma/RH, Orçamento, Horário de alocação a treinos/jogos, e procedimentos D.R.E. (se aplicável)." },
  { criterio: 5, nivel: "cbff", title: "Coordenação Clínica qualificada (mín. SBV+DAE)", requirement: "Direção/Coordenação Clínica assegurada por responsável identificado e caracterizado, submetendo declaração de responsabilidade, sendo pelo menos Técnico de Suporte Básico de Vida e DAE." },
  { criterio: 5, nivel: "cbff", title: "Técnicos de SBV e DAE caracterizados", requirement: "Dispor da colaboração de Técnicos de SBV e DAE, devidamente caracterizados (RC, CV, Cédula/Comprovativo)." },
  { criterio: 5, nivel: "cbff", title: "Infogramas de emergência médica", requirement: "Dispor de Infogramas de Emergência Médica definidos, divulgados e afixados junto às instalações de treinos e jogos." },
  { criterio: 5, nivel: "cbff", title: "Mala de primeiros socorros", requirement: "Dispor de mala de campo com material de primeiros socorros, contenção e imobilização (Talas e Ligaduras) para treinos e jogos." },
  { criterio: 5, nivel: "cbff", title: "Técnico SBV/DAE em todos os treinos e jogos", requirement: "Dispor de Técnico(s) de SBV e DAE presentes em todos os treinos e jogos, de todas as equipas." },
  { criterio: 5, nivel: "cbff", title: "Exames complementares para D.R.E.", requirement: "Para além do Exame Médico-Desportivo obrigatório, realizar Avaliações Nutricionais/Planos Alimentares específicos para praticantes D.R.E." },
  { criterio: 5, nivel: "1e2", title: "Coordenação Clínica por Fisio/Enfermeiro", requirement: "Direção/Coordenação Clínica assegurada por Fisioterapeuta ou Enfermeiro (ou, na ausência de Médico Diretor Clínico, por um destes)." },
  { criterio: 5, nivel: "1e2", title: "Registo de ocorrências organizado", requirement: "Dispor de registo de ocorrências organizado e atualizado, acessível pelo departamento médico, disponível na Visita Técnica." },
  { criterio: 5, nivel: "3", title: "Plano de Atividades: clínica e avaliação pré-participação", requirement: "Plano de Atividades inclui também Horário de alocação a atos clínicos diagnósticos/tratamento/reabilitação e Metodologia de Avaliação Pré-Participação." },
  { criterio: 5, nivel: "3", title: "Coordenação Clínica por Médico", requirement: "Direção/Coordenação Clínica assegurada por Médico (sem especialidade ou pós-graduação obrigatória neste nível)." },
  { criterio: 5, nivel: "3", title: "Fisioterapeutas/Enfermeiros caracterizados", requirement: "Dispor da colaboração de Fisioterapeutas ou Enfermeiros devidamente caracterizados." },
  { criterio: 5, nivel: "3", title: "Solução médica interna+externa", requirement: "Serviços de acompanhamento médico garantidos por combinação de solução interna e externa, ou apenas solução externa." },
  { criterio: 5, nivel: "3", title: "DAE em todos os recintos", requirement: "Dispor de DAE em todos os recintos desportivos (treinos e jogos) em perfeitas condições de utilização." },
  { criterio: 5, nivel: "3", title: "Registos clínicos e ficheiro clínico", requirement: "Dispor de registos clínicos completos (antecedentes, lesões, alergias, exames) e registo de ocorrências organizado e acessível." },
  { criterio: 5, nivel: "4e5", title: "Plano de Atividades: avaliações e formação", requirement: "Plano de Atividades inclui também alocação às Avaliações e Controlo Médico do Treino, Atividades Formativas, canais de comunicação e métricas de desempenho." },
  { criterio: 5, nivel: "4e5", title: "Coordenação Clínica pós-graduada em Medicina Desportiva", requirement: "Direção/Coordenação Clínica assegurada por Médico Pós-Graduado em Medicina Desportiva." },
  { criterio: 5, nivel: "4e5", title: "Nutricionistas caracterizados", requirement: "Dispor da colaboração de Nutricionistas devidamente caracterizados." },
  { criterio: 5, nivel: "4e5", title: "Mala de campo completa", requirement: "Mala de campo com material de primeiros socorros, contenção e imobilização completo, incluindo Canadianas, Plano Duro e Colar Cervical Rígido." },
  { criterio: 5, nivel: "4e5", title: "Fisioterapeuta/Enfermeiro em todos os treinos e jogos", requirement: "Dispor de Fisioterapeuta e/ou Enfermeiro presentes em todos os treinos e jogos, de todas as equipas." },

  // ---------- Critério 6 – Acompanhamento Escolar, Pessoal e Social ----------
  { criterio: 6, nivel: "cbff", title: "Responsável de acompanhamento escolar/social", requirement: "Dispor de responsável pelo acompanhamento escolar e social, devidamente caracterizado (RC, CV)." },
  { criterio: 6, nivel: "cbff", title: "Responsável de acompanhamento D.R.E.", requirement: "Dispor de responsável pelo acompanhamento dos praticantes D.R.E., que supervisiona acompanhamento escolar/alimentar/descanso, contactável em emergência." },
  { criterio: 6, nivel: "1e2", title: "Ação de formação em Ética Desportiva para Pais/EE", requirement: "Assegurar pelo menos 1 ação anual de formação sobre Ética Desportiva para os Pais/EE de todos os escalões (não conta a reunião geral de início de época)." },
  { criterio: 6, nivel: "3", title: "Registo de aproveitamento escolar", requirement: "Dispor de registo organizado e permanente dos indicadores de aproveitamento escolar de todos os praticantes." },
  { criterio: 6, nivel: "3", title: "Mecanismos de incentivo/correção implementados", requirement: "Ter definidos e implementados mecanismos de incentivo e/ou correção ao comportamento e aproveitamento escolar." },
  { criterio: 6, nivel: "3", title: "Curso IPDJ de proteção de crianças", requirement: "O Diretor, Resp. Escolar ou Resp. D.R.E. realizou o curso 'Salvaguardar e Proteger as Crianças e Jovens no Desporto' do IPDJ." },
  { criterio: 6, nivel: "3", title: "Ações de formação anuais (Nutrição, Integridade, Leis do Jogo)", requirement: "Realizar ações de formação anuais para os praticantes nas áreas de Nutrição, Integridade (Sub-15 ou inferior) e Leis do Jogo." },
  { criterio: 6, nivel: "4e5", title: "5-8 ações de formação anuais dos praticantes", requirement: "Realizar 5 a 8 ações de formação anuais dos praticantes, incluindo o tema 'Educar para os Direitos Humanos através do Desporto' (Amnistia Internacional/FPF)." },

  // ---------- Critério 7 – Recursos Humanos ----------
  { criterio: 7, nivel: "cbff", title: "Treinadores identificados e caracterizados", requirement: "Todos os treinadores devidamente identificados (Nome e Função) e caracterizados (RC, CV)." },
  { criterio: 7, nivel: "cbff", title: "TPTDs submetidos", requirement: "Submeter os TPTDs (Título Profissional de Treinador de Desporto) de todos os treinadores." },
  { criterio: 7, nivel: "1e2", title: "Diretor/Coordenador Técnico identificado (TPTD Grau I)", requirement: "Diretor/Coordenador Técnico identificado e caracterizado (RC, CV, TPTD, Cartão Score), com curso de treinador/TPTD mínimo Grau I." },
  { criterio: 7, nivel: "3", title: "Diretor da Academia identificado", requirement: "O Diretor da Academia/Entidade Formadora está devidamente identificado e caracterizado (RC, CV)." },
  { criterio: 7, nivel: "3", title: "Coordenador Técnico com TPTD Grau II", requirement: "O Diretor/Coordenador Técnico tem curso de treinador/TPTD (pelo menos) Grau II ou Estagiário de Grau II." },
  { criterio: 7, nivel: "4e5", title: "Rácio mínimo de treinadores por equipa", requirement: "O rácio de nº de treinadores por equipa reflete um mínimo de 1 treinador para cada 2 equipas (rácio ≥ 0,5)." },

  // ---------- Critério 8 – Instalações e Logística ----------
  { criterio: 8, nivel: "cbff", title: "Iluminação adequada", requirement: "Dispor de iluminação natural ou artificial adequada para os treinos das equipas." },
  { criterio: 8, nivel: "cbff", title: "Vestiários (mínimo)", requirement: "Dispor pelo menos de vestiários (não obrigatoriamente balneários) com capacidade adequada, respeitando normas da DGS." },
  { criterio: 8, nivel: "cbff", title: "Sala/espaço administrativo", requirement: "Dispor de sala/espaço de trabalho para os serviços administrativos." },
  { criterio: 8, nivel: "cbff", title: "Alojamento D.R.E.: condições básicas", requirement: "O alojamento para praticantes D.R.E. dispõe de quartos adequados, casas de banho, sala de refeições, sala de convívio, sala de estudo e boas condições de higiene." },
  { criterio: 8, nivel: "1e2", title: "Campos pelados e relvados", requirement: "Disponibilizar campos pelados e relvados (natural ou sintética) para os treinos, com preferência pelos relvados." },
  { criterio: 8, nivel: "1e2", title: "Vestiários e balneários", requirement: "Dispor de vestiários e balneários de apoio aos treinos, com capacidade adequada, respeitando normas da DGS." },
  { criterio: 8, nivel: "1e2", title: "Sala de trabalho para treinadores", requirement: "Dispor de sala de trabalho com secretárias e mesas de reunião para os treinadores." },
  { criterio: 8, nivel: "3", title: "Apenas campos relvados", requirement: "Disponibilizar apenas campos relvados (natural ou sintética) para os treinos das equipas." },
  { criterio: 8, nivel: "3", title: "Vestiários/balneários com condições completas", requirement: "Vestiários e balneários com capacidade adequada e condições básicas completas: água quente, wc, ventilação, bancos, cabides, separação zona seca/molhada." },
];

// Devolve apenas os itens obrigatórios até (e incluindo) um determinado nível,
// já que os níveis são cumulativos: cbff -> 1e2 -> 3 -> 4e5.
const NIVEL_ORDEM = ["cbff", "1e2", "3", "4e5"];
export function obrigatoriosAteNivel(nivel) {
  const limite = NIVEL_ORDEM.indexOf(nivel);
  return CRITERIOS_OBRIGATORIOS.filter((c) => NIVEL_ORDEM.indexOf(c.nivel) <= limite);
}
