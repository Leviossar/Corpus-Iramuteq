import { DocumentItem, LexicalExpression } from '../types/corpus';

// Default academic dictionary of compound expressions per Section 6 Method A
export const DEFAULT_ACADEMIC_COMPOUND_WORDS: { original: string; normalized: string; category: string }[] = [
  { original: 'segunda-feira', normalized: 'segunda_feira', category: 'temporal' },
  { original: 'terça-feira', normalized: 'terça_feira', category: 'temporal' },
  { original: 'quarta-feira', normalized: 'quarta_feira', category: 'temporal' },
  { original: 'quinta-feira', normalized: 'quinta_feira', category: 'temporal' },
  { original: 'sexta-feira', normalized: 'sexta_feira', category: 'temporal' },
  { original: 'educação empreendedora', normalized: 'educação_empreendedora', category: 'conceitual' },
  { original: 'gestão de processos', normalized: 'gestão_de_processos', category: 'conceitual' },
  { original: 'gestão estratégica de processos', normalized: 'gestão_estratégica_de_processos', category: 'conceitual' },
  { original: 'fluxo informacional', normalized: 'fluxo_informacional', category: 'conceitual' },
  { original: 'tomada de decisão', normalized: 'tomada_de_decisão', category: 'conceitual' },
  { original: 'inteligência artificial', normalized: 'inteligência_artificial', category: 'conceitual' },
  { original: 'desenvolvimento sustentável', normalized: 'desenvolvimento_sustentável', category: 'conceitual' },
  { original: 'ensino superior', normalized: 'ensino_superior', category: 'conceitual' },
  { original: 'meio ambiente', normalized: 'meio_ambiente', category: 'conceitual' },
  { original: 'políticas públicas', normalized: 'políticas_públicas', category: 'conceitual' },
  { original: 'capital humano', normalized: 'capital_humano', category: 'conceitual' },
  { original: 'vantagem competitiva', normalized: 'vantagem_competitiva', category: 'conceitual' },
  { original: 'pesquisa científica', normalized: 'pesquisa_científica', category: 'metodológico' },
  { original: 'análise de dados', normalized: 'análise_de_dados', category: 'metodológico' },
  { original: 'análise de conteúdo', normalized: 'análise_de_conteúdo', category: 'metodológico' },
  { original: 'metodologia qualitativa', normalized: 'metodologia_qualitativa', category: 'metodológico' },
  { original: 'revisão sistemática', normalized: 'revisão_sistemática', category: 'metodológico' },
  { original: 'estudo de caso', normalized: 'estudo_de_caso', category: 'metodológico' },
  { original: 'banco de dados', normalized: 'banco_de_dados', category: 'tecnologia' },
  { original: 'redes sociais', normalized: 'redes_sociais', category: 'tecnologia' },
  { original: 'tecnologia da informação', normalized: 'tecnologia_da_informação', category: 'tecnologia' },
  { original: 'recursos humanos', normalized: 'recursos_humanos', category: 'gestão' },
  { original: 'cultura organizacional', normalized: 'cultura_organizacional', category: 'gestão' },
  { original: 'trabalho em equipe', normalized: 'trabalho_em_equipe', category: 'gestão' },
  { original: 'plano de negócios', normalized: 'plano_de_negócios', category: 'gestão' },
];

export const SAMPLE_ARTICLES: DocumentItem[] = [
  {
    id: 'artigo_001',
    name: 'artigo_gestao_processos_sustentabilidade.pdf',
    size: 245000,
    type: 'pdf',
    corpusMode: 'articles',
    rawText: `UNIVERSIDADE FEDERAL DE MINAS GERAIS
REVISTA BRASILEIRA DE ADMINISTRAÇÃO E GESTÃO
Vol. 18, Nº 2, 2024 - ISSN 1984-3245

A Gestão de Processos como Vetor para o Desenvolvimento Sustentável
Silva, Marcos Vinícius; Oliveira, Camila Helena; Santos, Rodrigo Alencar

RESUMO
Este artigo analisa como a gestão de processos contribui decisivamente para o desenvolvimento sustentável em organizações industriais contemporâneas. A pesquisa científica adotou uma metodologia qualitativa baseada em estudo de caso múltiplo. Os resultados revelam que o fluxo informacional estruturado e a tomada de decisão ágil potencializam a vantagem competitiva e minimizam impactos ao meio ambiente. A inteligência artificial desponta como ferramenta de suporte analítico.

1. INTRODUÇÃO
No cenário corporativo global, a gestão de processos consolida-se como premissa indispensável para a eficiência operacional. O desenvolvimento sustentável não constitui mais um atributo periférico, mas o próprio núcleo da vantagem competitiva duradoura. Quando as organizações alinham a gestão estratégica de processos com diretrizes ecológicas rigorosas, observa-se uma redução substancial no consumo de insumos fósseis e desperdícios.

2. FLUXO INFORMACIONAL E TOMADA DE DECISÃO
A comunicação corporativa e a análise de dados desempenham função axial na estruturação dos fluxos operacionais. O fluxo informacional contínuo entre diretorias e equipes de chão de fábrica viabiliza a rápida tomada de decisão frente a oscilações regulatórias. A inteligência artificial aplicada ao monitoramento em tempo real subsidia os gestores com indicadores preditivos confiáveis. Conforme apontam estudos recentes sobre capital humano, o treinamento continuado em tecnologia da informação fomenta a cultura organizacional orientada a resultados e respeito ao meio ambiente.

3. CONSIDERAÇÕES FINAIS
Conclui-se que a simbiose entre gestão de processos e desenvolvimento sustentável redefine os parâmetros de produtividade. Recomenda-se que futuras pesquisas examinem a maturidade digital das pequenas empresas brasileiras.

REFERÊNCIAS
ALVES, J. R. Gestão estratégica de processos. São Paulo: Atlas, 2021.
BARBOSA, T. Desenvolvimento sustentável e inovação. Rio de Janeiro: FGV, 2022.
COSTA, M. Inteligência artificial nas organizações. Porto Alegre: Bookman, 2023.`,
    cleanedText: `A gestão_de_processos consolida-se como premissa indispensável para a eficiência operacional. O desenvolvimento_sustentável não constitui mais um atributo periférico, mas o próprio núcleo da vantagem_competitiva duradoura. Quando as organizações alinham a gestão_estratégica_de_processos com diretrizes ecológicas rigorosas, observa-se uma redução substancial no consumo de insumos fósseis e desperdícios.

A comunicação corporativa e a análise_de_dados desempenham função axial na estruturação dos fluxos operacionais. O fluxo_informacional contínuo entre diretorias e equipes de chão de fábrica viabiliza a rápida tomada_de_decisão frente a oscilações regulatórias. A inteligência_artificial aplicada ao monitoramento em tempo real subsidia os gestores com indicadores preditivos confiáveis. Conforme apontam estudos recentes sobre capital_humano, o treinamento continuado em tecnologia_da_informação fomenta a cultura_organizacional orientada a resultados e respeito ao meio_ambiente.

Conclui-se que a simbiose entre gestão_de_processos e desenvolvimento_sustentável redefine os parâmetros de produtividade. Recomenda-se que futuras pesquisas examinem a maturidade digital das pequenas empresas brasileiras.`,
    reviewedText: `A gestão_de_processos consolida-se como premissa indispensável para a eficiência operacional. O desenvolvimento_sustentável não constitui mais um atributo periférico, mas o próprio núcleo da vantagem_competitiva duradoura. Quando as organizações alinham a gestão_estratégica_de_processos com diretrizes ecológicas rigorosas, observa-se uma redução substancial no consumo de insumos fósseis e desperdícios.

A comunicação corporativa e a análise_de_dados desempenham função axial na estruturação dos fluxos operacionais. O fluxo_informacional contínuo entre diretorias e equipes de chão de fábrica viabiliza a rápida tomada_de_decisão frente a oscilações regulatórias. A inteligência_artificial aplicada ao monitoramento em tempo real subsidia os gestores com indicadores preditivos confiáveis. Conforme apontam estudos recentes sobre capital_humano, o treinamento continuado em tecnologia_da_informação fomenta a cultura_organizacional orientada a resultados e respeito ao meio_ambiente.

Conclui-se que a simbiose entre gestão_de_processos e desenvolvimento_sustentável redefine os parâmetros de produtividade. Recomenda-se que futuras pesquisas examinem a maturidade digital das pequenas empresas brasileiras.`,
    status: 'reviewed',
    metadata: {
      title: 'A Gestão de Processos como Vetor para o Desenvolvimento Sustentável',
      year: '2024',
      authors: 'Silva et al.',
      group: 'gestao_ambiental',
      language: 'pt-BR',
      docType: 'artigo',
      customVars: {
        foco: 'sustentabilidade',
        setor: 'industrial',
      },
    },
    detectedSections: {
      title: 'A Gestão de Processos como Vetor para o Desenvolvimento Sustentável',
      abstract: 'Este artigo analisa como a gestão de processos contribui decisivamente para o desenvolvimento sustentável em organizações industriais contemporâneas...',
      references: 'ALVES, J. R. Gestão estratégica de processos...',
    },
    exclusionSettings: {
      excludeReferences: true,
      excludeAbstract: true,
      excludeTables: true,
      excludeFootnotes: true,
      excludeInterviewerQuestions: false,
    },
    extractedAt: '2026-10-14T05:00:00Z',
  },
  {
    id: 'artigo_002',
    name: 'artigo_educacao_empreendedora_superior.docx',
    size: 188000,
    type: 'docx',
    corpusMode: 'articles',
    rawText: `Educação Empreendedora e Inovação no Ensino Superior
Ferreira, Luciana P.; Ribeiro, Gustavo M.

RESUMO
A educação empreendedora vem ganhando proeminência no ensino superior latino-americano. O presente estudo de caso investigou como metodologias ativas fomentam competências socioemocionais e a criação de planos de negócios consistentes. Verificou-se que a interdisciplinaridade acelera a tomada de decisão e a resolução criativa de problemas.

1. CONTEXTUALIZAÇÃO
A consolidação da educação empreendedora nas universidades públicas estimula o surgimento de empreendimentos de base tecnológica. O ensino superior não pode se restringir à transmissão passiva de conteúdos teóricos, exigindo vivências práticas com simulações de plano de negócios e contato direto com incubadoras e parques tecnológicos.

2. METODOLOGIA E DISCUSSÃO
Por meio de metodologia qualitativa com análise de conteúdo, mapearam-se cinquenta projetos interdisciplinares. Os alunos demonstraram avanços expressivos no trabalho em equipe e no gerenciamento de incertezas. A tomada de decisão em ambientes competitivos simulados fortaleceu a autoconfiança e a consciência crítica sobre o impacto socioambiental dos negócios. As políticas públicas de fomento à inovação acadêmica mostraram-se vitais para a sustentabilidade dos laboratórios de ideação.

3. CONCLUSÕES
Evidenciou-se que a educação empreendedora no ensino superior constitui um catalisador de emancipação social e desenvolvimento socioeconômico regional.

REFERÊNCIAS
DORNELAS, J. Empreendedorismo corporativo. Rio de Janeiro: Elsevier, 2020.
FARIAS, P. Metodologias ativas no ensino superior. Curitiba: Appris, 2022.`,
    cleanedText: `A consolidação da educação_empreendedora nas universidades públicas estimula o surgimento de empreendimentos de base tecnológica. O ensino_superior não pode se restringir à transmissão passiva de conteúdos teóricos, exigindo vivências práticas com simulações de plano_de_negócios e contato direto com incubadoras e parques tecnológicos.

Por meio de metodologia_qualitativa com análise_de_conteúdo, mapearam-se cinquenta projetos interdisciplinares. Os alunos demonstraram avanços expressivos no trabalho_em_equipe e no gerenciamento de incertezas. A tomada_de_decisão em ambientes competitivos simulados fortaleceu a autoconfiança e a consciência crítica sobre o impacto socioambiental dos negócios. As políticas_públicas de fomento à inovação acadêmica mostraram-se vitais para a sustentabilidade dos laboratórios de ideação.

Evidenciou-se que a educação_empreendedora no ensino_superior constitui um catalisador de emancipação social e desenvolvimento socioeconômico regional.`,
    reviewedText: `A consolidação da educação_empreendedora nas universidades públicas estimula o surgimento de empreendimentos de base tecnológica. O ensino_superior não pode se restringir à transmissão passiva de conteúdos teóricos, exigindo vivências práticas com simulações de plano_de_negócios e contato direto com incubadoras e parques tecnológicos.

Por meio de metodologia_qualitativa com análise_de_conteúdo, mapearam-se cinquenta projetos interdisciplinares. Os alunos demonstraram avanços expressivos no trabalho_em_equipe e no gerenciamento de incertezas. A tomada_de_decisão em ambientes competitivos simulados fortaleceu a autoconfiança e a consciência crítica sobre o impacto socioambiental dos negócios. As políticas_públicas de fomento à inovação acadêmica mostraram-se vitais para a sustentabilidade dos laboratórios de ideação.

Evidenciou-se que a educação_empreendedora no ensino_superior constitui um catalisador de emancipação social e desenvolvimento socioeconômico regional.`,
    status: 'reviewed',
    metadata: {
      title: 'Educação Empreendedora e Inovação no Ensino Superior',
      year: '2023',
      authors: 'Ferreira & Ribeiro',
      group: 'educacao_superior',
      language: 'pt-BR',
      docType: 'artigo',
      customVars: {
        foco: 'empreendedorismo',
        setor: 'academico',
      },
    },
    detectedSections: {
      title: 'Educação Empreendedora e Inovação no Ensino Superior',
      abstract: 'A educação empreendedora vem ganhando proeminência no ensino superior latino-americano...',
      references: 'DORNELAS, J. Empreendedorismo corporativo...',
    },
    exclusionSettings: {
      excludeReferences: true,
      excludeAbstract: true,
      excludeTables: true,
      excludeFootnotes: true,
      excludeInterviewerQuestions: false,
    },
    extractedAt: '2026-10-14T05:00:00Z',
  },
  {
    id: 'artigo_003',
    name: 'artigo_fluxo_informacao_decisao.txt',
    size: 142000,
    type: 'txt',
    corpusMode: 'articles',
    rawText: `O Fluxo Informacional e a Tomada de Decisão Estratégica
Menezes, Beatriz; Castro, Daniel

A dinamização do fluxo informacional representa o alicerce para a tomada de decisão qualificada em ecossistemas de alta complexidade. Em organizações com estrutura hierárquica rígida, a assimetria de informações retarda respostas a crises emergenciais.

A implantação de ferramentas modernas de tecnologia da informação e banco de dados distribuídos assegura transparência operacional. Quando as lideranças cultivam uma cultura organizacional aberta ao diálogo, o capital humano engaja-se ativamente no aperfeiçoamento dos procedimentos de gestão de processos.

A pesquisa científica realizada em dez empresas de médio porte demonstrou correlação direta entre o fluxo informacional integrado e a agilidade nas rotinas de tomada de decisão. A inteligência artificial desponta como aliada na classificação prévia de dados não estruturados, permitindo que a vantagem competitiva seja preservada mesmo em cenários de incerteza mercadológica.`,
    cleanedText: `A dinamização do fluxo_informacional representa o alicerce para a tomada_de_decisão qualificada em ecossistemas de alta complexidade. Em organizações com estrutura hierárquica rígida, a assimetria de informações retarda respostas a crises emergenciais.

A implantação de ferramentas modernas de tecnologia_da_informação e banco_de_dados distribuídos assegura transparência operacional. Quando as lideranças cultivam uma cultura_organizacional aberta ao diálogo, o capital_humano engaja-se ativamente no aperfeiçoamento dos procedimentos de gestão_de_processos.

A pesquisa_científica realizada em dez empresas de médio porte demonstrou correlação direta entre o fluxo_informacional integrado e a agilidade nas rotinas de tomada_de_decisão. A inteligência_artificial desponta como aliada na classificação prévia de dados não estruturados, permitindo que a vantagem_competitiva seja preservada mesmo em cenários de incerteza mercadológica.`,
    reviewedText: `A dinamização do fluxo_informacional representa o alicerce para a tomada_de_decisão qualificada em ecossistemas de alta complexidade. Em organizações com estrutura hierárquica rígida, a assimetria de informações retarda respostas a crises emergenciais.

A implantação de ferramentas modernas de tecnologia_da_informação e banco_de_dados distribuídos assegura transparência operacional. Quando as lideranças cultivam uma cultura_organizacional aberta ao diálogo, o capital_humano engaja-se ativamente no aperfeiçoamento dos procedimentos de gestão_de_processos.

A pesquisa_científica realizada em dez empresas de médio porte demonstrou correlação direta entre o fluxo_informacional integrado e a agilidade nas rotinas de tomada_de_decisão. A inteligência_artificial desponta como aliada na classificação prévia de dados não estruturados, permitindo que a vantagem_competitiva seja preservada mesmo em cenários de incerteza mercadológica.`,
    status: 'reviewed',
    metadata: {
      title: 'O Fluxo Informacional e a Tomada de Decisão Estratégica',
      year: '2024',
      authors: 'Menezes & Castro',
      group: 'sistemas_informacao',
      language: 'pt-BR',
      docType: 'artigo',
      customVars: {
        foco: 'informacao',
        setor: 'corporativo',
      },
    },
    detectedSections: {},
    exclusionSettings: {
      excludeReferences: false,
      excludeAbstract: false,
      excludeTables: false,
      excludeFootnotes: false,
      excludeInterviewerQuestions: false,
    },
    extractedAt: '2026-10-14T05:00:00Z',
  },
];

export const SAMPLE_INTERVIEWS: DocumentItem[] = [
  {
    id: 'entrevista_P01',
    name: 'transcricao_entrevista_participante_01.docx',
    size: 156000,
    type: 'docx',
    corpusMode: 'interviews',
    rawText: `Entrevistador: Boa tarde. Poderia relatar como a educação empreendedora foi introduzida na sua formação acadêmica?
P01: Boa tarde. A educação empreendedora foi introduzida no terceiro ano da graduação por meio de oficinas interdisciplinares. Nós tivemos que formular um plano de negócios completo, com pesquisa científica de mercado e validação com clientes reais. Isso transformou totalmente a nossa tomada de decisão e a percepção de trabalho em equipe.
Entrevistador: E quais foram os principais desafios enfrentados na gestão de processos do projeto?
P01: O maior obstáculo foi articular o fluxo informacional entre os colegas de cursos diferentes. A gestão de processos exigia reuniões constantes, e nem todo mundo compreendia a importância do cronograma. Mas com o apoio dos professores do ensino superior, conseguimos estabelecer uma cultura organizacional sólida e alcançar os objetivos traçados.`,
    cleanedText: `A educação_empreendedora foi introduzida no terceiro ano da graduação por meio de oficinas interdisciplinares. Nós tivemos que formular um plano_de_negócios completo, com pesquisa_científica de mercado e validação com clientes reais. Isso transformou totalmente a nossa tomada_de_decisão e a percepção de trabalho_em_equipe.

O maior obstáculo foi articular o fluxo_informacional entre os colegas de cursos diferentes. A gestão_de_processos exigia reuniões constantes, e nem todo mundo compreendia a importância do cronograma. Mas com o apoio dos professores do ensino_superior, conseguimos estabelecer uma cultura_organizacional sólida e alcançar os objetivos traçados.`,
    reviewedText: `A educação_empreendedora foi introduzida no terceiro ano da graduação por meio de oficinas interdisciplinares. Nós tivemos que formular um plano_de_negócios completo, com pesquisa_científica de mercado e validação com clientes reais. Isso transformou totalmente a nossa tomada_de_decisão e a percepção de trabalho_em_equipe.

O maior obstáculo foi articular o fluxo_informacional entre os colegas de cursos diferentes. A gestão_de_processos exigia reuniões constantes, e nem todo mundo compreendia a importância do cronograma. Mas com o apoio dos professores do ensino_superior, conseguimos estabelecer uma cultura_organizacional sólida e alcançar os objetivos traçados.`,
    status: 'reviewed',
    metadata: {
      title: 'Entrevista Semiestruturada - Participante 01',
      year: '2024',
      authors: 'Equipe de Pesquisa',
      group: 'grupo_veteranos',
      language: 'pt-BR',
      docType: 'entrevista',
      participantId: 'P01',
      customVars: {
        genero: 'feminino',
        experiencia: 'avancada',
      },
    },
    detectedSections: {
      interviewerQuestionsCount: 2,
    },
    exclusionSettings: {
      excludeReferences: false,
      excludeAbstract: false,
      excludeTables: false,
      excludeFootnotes: false,
      excludeInterviewerQuestions: true, // interviewer questions excluded per methodology
    },
    extractedAt: '2026-10-14T05:00:00Z',
  },
  {
    id: 'entrevista_P02',
    name: 'transcricao_entrevista_participante_02.txt',
    size: 138000,
    type: 'txt',
    corpusMode: 'interviews',
    rawText: `Entrevistador: Como você percebe a relação entre a sustentabilidade e a estratégia empresarial?
P02: Para mim, o desenvolvimento sustentável é central. Não é apenas discurso verde. Ele impacta diretamente a vantagem competitiva porque os consumidores exigem transparência e respeito ao meio ambiente. Quando alinhamos a tomada de decisão com princípios ecológicos, reduzimos custos de matéria-prima.
Entrevistador: A tecnologia tem auxiliado nesse processo?
P02: Sem dúvida. O fluxo informacional baseado em banco de dados moderno nos dá visibilidade em tempo real. A inteligência artificial já começa a indicar padrões de desperdício em nossa gestão de processos fabris.`,
    cleanedText: `Para mim, o desenvolvimento_sustentável é central. Não é apenas discurso verde. Ele impacta diretamente a vantagem_competitiva porque os consumidores exigem transparência e respeito ao meio_ambiente. Quando alinhamos a tomada_de_decisão com princípios ecológicos, reduzimos custos de matéria-prima.

Sem dúvida. O fluxo_informacional baseado em banco_de_dados moderno nos dá visibilidade em tempo real. A inteligência_artificial já começa a indicar padrões de desperdício em nossa gestão_de_processos fabris.`,
    reviewedText: `Para mim, o desenvolvimento_sustentável é central. Não é apenas discurso verde. Ele impacta diretamente a vantagem_competitiva porque os consumidores exigem transparência e respeito ao meio_ambiente. Quando alinhamos a tomada_de_decisão com princípios ecológicos, reduzimos custos de matéria-prima.

Sem dúvida. O fluxo_informacional baseado em banco_de_dados moderno nos dá visibilidade em tempo real. A inteligência_artificial já começa a indicar padrões de desperdício em nossa gestão_de_processos fabris.`,
    status: 'reviewed',
    metadata: {
      title: 'Entrevista Semiestruturada - Participante 02',
      year: '2024',
      authors: 'Equipe de Pesquisa',
      group: 'grupo_gestores',
      language: 'pt-BR',
      docType: 'entrevista',
      participantId: 'P02',
      customVars: {
        genero: 'masculino',
        experiencia: 'senior',
      },
    },
    detectedSections: {
      interviewerQuestionsCount: 2,
    },
    exclusionSettings: {
      excludeReferences: false,
      excludeAbstract: false,
      excludeTables: false,
      excludeFootnotes: false,
      excludeInterviewerQuestions: true,
    },
    extractedAt: '2026-10-14T05:00:00Z',
  },
  {
    id: 'entrevista_P03',
    name: 'transcricao_entrevista_participante_03.docx',
    size: 149000,
    type: 'docx',
    corpusMode: 'interviews',
    rawText: `Entrevistador: De que maneira as políticas públicas influenciam o capital humano nas pequenas empresas?
P03: As políticas públicas direcionadas à qualificação técnica criam um capital humano muito mais preparado. Nas pequenas organizações, o ensino superior nem sempre é acessível, então cursos de extensão sobre educação empreendedora e tecnologia da informação preenchem essa lacuna crítica.
Entrevistador: Você observa reflexos na organização das equipes?
P03: Sim, o trabalho em equipe se torna mais colaborativo e a cultura organizacional passa a valorizar a inovação aberta e a tomada de decisão participativa.`,
    cleanedText: `As políticas_públicas direcionadas à qualificação técnica criam um capital_humano muito mais preparado. Nas pequenas organizações, o ensino_superior nem sempre é acessível, então cursos de extensão sobre educação_empreendedora e tecnologia_da_informação preenchem essa lacuna crítica.

Sim, o trabalho_em_equipe se torna mais colaborativo e a cultura_organizacional passa a valorizar a inovação aberta e a tomada_de_decisão participativa.`,
    reviewedText: `As políticas_públicas direcionadas à qualificação técnica criam um capital_humano muito mais preparado. Nas pequenas organizações, o ensino_superior nem sempre é acessível, então cursos de extensão sobre educação_empreendedora e tecnologia_da_informação preenchem essa lacuna crítica.

Sim, o trabalho_em_equipe se torna mais colaborativo e a cultura_organizacional passa a valorizar a inovação aberta e a tomada_de_decisão participativa.`,
    status: 'reviewed',
    metadata: {
      title: 'Entrevista Semiestruturada - Participante 03',
      year: '2024',
      authors: 'Equipe de Pesquisa',
      group: 'grupo_empreendedores',
      language: 'pt-BR',
      docType: 'entrevista',
      participantId: 'P03',
      customVars: {
        genero: 'feminino',
        experiencia: 'intermediaria',
      },
    },
    detectedSections: {
      interviewerQuestionsCount: 2,
    },
    exclusionSettings: {
      excludeReferences: false,
      excludeAbstract: false,
      excludeTables: false,
      excludeFootnotes: false,
      excludeInterviewerQuestions: true,
    },
    extractedAt: '2026-10-14T05:00:00Z',
  },
  {
    id: 'entrevista_P04',
    name: 'transcricao_entrevista_participante_04.txt',
    size: 151000,
    type: 'txt',
    corpusMode: 'interviews',
    rawText: `Entrevistador: Como os dados guiam a tomada de decisão na sua rotina diária?
P04: Nós dependemos integralmente de análise de dados e pesquisa científica aplicada. O fluxo informacional precisa ser limpo, sem ruídos. Quando a gestão de processos é clara, a tomada de decisão não fica travada em dúvidas operacionais.
Entrevistador: Qual é a perspectiva para os próximos anos em relação à sustentabilidade?
P04: Acredito que o desenvolvimento sustentável será critério mandatório em todos os setores. Quem não adaptar seu plano de negócios e não investir em capital humano perderá relevância rapidamente no mercado.`,
    cleanedText: `Nós dependemos integralmente de análise_de_dados e pesquisa_científica aplicada. O fluxo_informacional precisa ser limpo, sem ruídos. Quando a gestão_de_processos é clara, a tomada_de_decisão não fica travada em dúvidas operacionais.

Acredito que o desenvolvimento_sustentável será critério mandatório em todos os setores. Quem não adaptar seu plano_de_negócios e não investir em capital_humano perderá relevância rapidamente no mercado.`,
    reviewedText: `Nós dependemos integralmente de análise_de_dados e pesquisa_científica aplicada. O fluxo_informacional precisa ser limpo, sem ruídos. Quando a gestão_de_processos é clara, a tomada_de_decisão não fica travada em dúvidas operacionais.

Acredito que o desenvolvimento_sustentável será critério mandatório em todos os setores. Quem não adaptar seu plano_de_negócios e não investir em capital_humano perderá relevância rapidamente no mercado.`,
    status: 'reviewed',
    metadata: {
      title: 'Entrevista Semiestruturada - Participante 04',
      year: '2024',
      authors: 'Equipe de Pesquisa',
      group: 'grupo_gestores',
      language: 'pt-BR',
      docType: 'entrevista',
      participantId: 'P04',
      customVars: {
        genero: 'masculino',
        experiencia: 'senior',
      },
    },
    detectedSections: {
      interviewerQuestionsCount: 2,
    },
    exclusionSettings: {
      excludeReferences: false,
      excludeAbstract: false,
      excludeTables: false,
      excludeFootnotes: false,
      excludeInterviewerQuestions: true,
    },
    extractedAt: '2026-10-14T05:00:00Z',
  },
];
