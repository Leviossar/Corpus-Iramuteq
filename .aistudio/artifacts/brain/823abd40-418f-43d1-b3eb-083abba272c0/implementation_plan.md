# CorpusLab — Preparador Inteligente de Corpus para IRaMuTeQ

O **CorpusLab** é uma plataforma acadêmica para pesquisadores e linguistas computacionais prepararem, limparem, normalizarem e estruturarem corpora textuais científicos (artigos, entrevistas e documentos institucionais) em estrita conformidade com os padrões do software **IRaMuTeQ**. O sistema opera com processamento 100% determinístico local no navegador (extração documental, n-gramas, normalização e validação), integrando opcionalmente assistência de IA (Gemini) de forma auditável e econômica para desambiguação de termos complexos com mecanismo de contingência automática (Plano B).

---

## Decisões Confirmadas e Parâmetros Iniciais

> [!IMPORTANT]
> **Decisões confirmadas na consulta inicial:**
> - **Conjunto de Demonstração Inicial**: O sistema incluirá coleções de exemplo prontas (artigos científicos de gestão/educação e entrevistas semiestruturadas com participantes anônimos) para experimentação imediata sem upload prévio obrigatório.
> - **Política de Ativação do Gemini**: A assistência com IA iniciará **ativa em modo econômico**, com limite diário rigoroso de orçamento e autorização explícita por lote de expressões ambíguas.
> - **OCR para PDFs Digitalizados**: O aplicativo detectará ausência de camadas vetoriais de texto selecionável e solicitará confirmação pontual do pesquisador antes de disparar o motor local Tesseract.js por página.

---

## 1. Visão Geral e Conceito Central

### O que o CorpusLab faz
Permite ao pesquisador conduzir todo o ciclo de preparação metodológica de dados textuais para análise lexicográfica no IRaMuTeQ:
1. **Importação Multiformato**: PDF (incluindo duas colunas e OCR local sob demanda com Tesseract.js), DOCX, DOC e TXT.
2. **Higienização Determinística**: Remoção de quebras artificiais de linha, hifenizações de translineação, espaços redundantes, caracteres incompatíveis e exclusão parametrizada de seções acadêmicas (referências bibliográficas, notas de rodapé, resumos, tabelas).
3. **Módulo Lexical Triplo**: Dicionário de expressões compostas (`segunda_feira`, `educação_empreendedora`, `tomada_de_decisão`), detecção estatística local de n-gramas (2 a 5 palavras com frequência e medidas de associação) e dicionários personalizados por projeto.
4. **Desambiguação Linguística Assistida (Opcional & Econômica)**: `AIUsageDecisionEngine` para consultar Gemini via backend Node.js apenas para expressões com alta ambiguidade contextual, com cache local, limite rígido de tokens e `FallbackManager` (Plano B) automático.
5. **Organização Metodológica de Variáveis**: Atribuição e edição de variáveis categóricas para linhas de comando do IRaMuTeQ (`**** *doc_001 *ano_2024 *tipo_artigo`), tratamento específico para entrevistas (anonimização `*part_P01` e remoção de perguntas do entrevistador) e artigos científicos.
6. **Auditoria Estrutural e Exportação**: Validador pré-exportação que checa codificação UTF-8 sem BOM, quebras LF, formatação de variáveis, ausência de duplicatas e ausência de pontuações proibidas, gerando pacote ZIP com `corpus_iramuteq.txt`, `metadados.csv`, `dicionario_expressoes.csv`, `relatorio_transformacoes.csv`, `relatorio_validacao.txt` e `relatorio_consumo_ia.csv`.

---

## 2. Experiência do Usuário e Design Visual

Seguindo as diretrizes do guia `frontend-design` e a referência `saas_dashboard.md`:

### Identidade Visual e Atmosfera
- **Estilo**: Utilitário acadêmico de alta densidade e precisão científica, sem clichês visuais de IA (sem degradês roxos artificiais, sem cartões dentro de cartões, sem pílulas estáticas).
- **Paleta de Cores (Regra 60-30-10)**:
  - *Canvas (60%)*: Slate neutro claro (`#F8FAFC` em light / `#0F172A` em dark) com superfícies de leitura limpas.
  - *Estrutura (30%)*: Bordas hairline de 1px (`#E2E8F0` / `#1E293B`), superfícies de cartões e painéis com elevação única e contraste nítido.
  - *Acentos (10%)*: Azul petróleo e cobalto acadêmico (`#1D4ED8` / `#2563EB`) para ações primárias, esmeralda (`#16A34A`) para validações positivas, âmbar (`#D97706`) para revisões pendentes e carmesim (`#DC2626`) para erros estruturais.
- **Tipografia**:
  - Títulos e Navegação: `Plus Jakarta Sans` ou `DM Sans`.
  - Corpo de texto e editores: `Plus Jakarta Sans` / `Source Serif 4` para leitura confortável de parágrafos.
  - Dados analíticos, linhas de comando IRaMuTeQ, diffs e tokens: `JetBrains Mono` com `font-variant-numeric: tabular-nums`.
- **Top Bar Contract**:
  - Zona 1: Título de marca `CorpusLab` com indicador sutil do projeto e modalidade ativa.
  - Zona 2: Links de navegação entre as 6 áreas de trabalho (`Visão Geral`, `Importar Documentos`, `Preparar Textos`, `Dicionário Lexical`, `Organizar Corpus`, `Validar e Exportar`).
  - Zona 3: Botão de ação de validação/exportação rápida.

### As 6 Áreas da Interface
1. **Visão Geral**:
   - Painel de controle com métricas do corpus: contagem total de palavras, documentos importados/revisados, expressões identificadas/aprovadas, barra de progresso da preparação metodológica.
   - Monitor de consumo de IA: saldo diário de tokens (limite inicial de 5.000 tokens), consultas executadas vs. poupadas pelo cache, estado operacional e botão "Pausar Utilização da IA".
2. **Importar Documentos**:
   - Zona drag-and-drop para múltiplos arquivos (.pdf, .docx, .doc, .txt).
   - Botão para carregar amostras acadêmicas prontas (artigos e entrevistas).
   - Lista detalhada de arquivos com progresso, detecção de PDF digitalizado (alerta com oferta de OCR Tesseract por página) e exclusão/gerenciamento de arquivos.
3. **Preparar Textos (Editor Lado a Lado)**:
   - Visualização comparativa: Texto Original extraído vs. Texto Tratado normalizado.
   - Ferramentas de exclusão acadêmica com confirmação: remoção de referências, resumos/abstracts, cabeçalhos de revista, notas e legendas de figuras/tabelas.
   - Controles de edição manual direta, histórico de desfazer/refazer (Undo/Redo), destaque de diferenças (Diff view) e aprovação explícita do pesquisador.
4. **Dicionário Lexical**:
   - Lista consolidada de palavras compostas: Método A (dicionário padrão), Método B (detecção por n-gramas e frequência), Método C (termos customizados do projeto).
   - Tabela de expressões candidatas com contexto resumido (1-2 frases), contagem documental, sugestão de unificação (`palavra_composta`), justificativa e estado de aprovação.
   - Painel de desambiguação assistida por IA (Gemini): envio de lotes de expressões ambíguas mediante autorização do pesquisador.
5. **Organizar Corpus**:
   - Seletor de Modo: Artigos Científicos vs. Entrevistas Semi-Estruturadas vs. Documentos Institucionais.
   - Tabela de metadados: ID do documento, título, ano, autores, variáveis categóricas (`*ano_2024`, `*grupo_G1`, etc.).
   - Modo Entrevistas: anonimização automática de participantes (`*part_P01`), identificação de perguntas do entrevistador e opção de exclusão mantendo apenas as respostas.
6. **Validar e Exportar**:
   - Diagnóstico estrutural automatizado contra as regras do IRaMuTeQ: codificação UTF-8, linhas de comando `****`, formato dos rótulos de variáveis, ausência de duplicatas ou linhas órfãs.
   - Pré-visualização ao vivo do arquivo TXT integral gerado.
   - Exportação em arquivos individuais (`corpus_iramuteq.txt`, `metadados.csv`, `dicionario_expressoes.csv`, `relatorio_transformacoes.csv`, `relatorio_validacao.txt`, `relatorio_consumo_ia.csv`) ou pacote ZIP completo.

---

## 3. Decisões Arquiteturais e Trade-Offs

### 1. Processamento Determinístico como Pilar Central vs. IA
- **Abordagem**: Toda a pipeline de extração (PDF.js, Mammoth.js, Tesseract.js), limpeza com Regex Unicode, cálculo de n-gramas e substituição de palavras compostas é 100% determinística no frontend.
- **Por quê**: Garante reprodutibilidade científica indispensável para pesquisas acadêmicas, custo zero para uso diário, privacidade total e independência de serviços externos.
- **Papel da IA**: O Gemini atua estritamente como um classificador linguístico complementar para desambiguação pontual de expressões polissêmicas aprovadas pelo usuário.

### 2. Motor de Decisão (`AIUsageDecisionEngine`) e Fallback (`FallbackManager`)
- **Abordagem**: Antes de qualquer requisição ao Gemini, o sistema avalia 9 critérios rigorosos (dicionário prévio, regras locais, decisões em cache, nível de ambiguidade, autorização do usuário, orçamento de tokens, saúde da API e política de privacidade). Se qualquer critério falhar ou se houver erro (429, timeout, offline), o `FallbackManager` assume sem travar a navegação e marca a expressão para revisão manual humana.
- **Por quê**: Elimina riscos de cobrança indesejada, evita dependência da nuvem e mantém a integridade do trabalho do pesquisador.

### 3. Armazenamento Local no IndexedDB
- **Abordagem**: Utilização do IndexedDB do navegador com fallback para localStorage e exportação em formato de projeto `.json`.
- **Por quê**: Permite armazenar com segurança documentos volumosos e dezenas de páginas sem sobrecarregar a memória nem exigir banco de dados em nuvem.

---

## 4. Arquitetura Técnica e Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CorpusLab Frontend                             │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ Extração de Documentos│  │ Normalização Textual  │  │ Análise Lexical │  │
│  │ - PDF.js (colunas/ord)│  │ - Regex Unicode NFC   │  │ - N-gramas (2-5)│  │
│  │ - Mammoth.js (DOCX)   │  │ - Parágrafos / Hífen  │  │ - Frequência/PMI│  │
│  │ - Tesseract.js (OCR)  │  │ - Filtro de Seções    │  │ - Dicionários   │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └────────┬────────┘  │
│              │                          │                       │           │
│              ▼                          ▼                       ▼           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 AIUsageDecisionEngine & FallbackManager               │  │
│  │  - Verificação de Dicionário / Regras Locais                          │  │
│  │  - Cache Local de Desambiguações (IndexedDB)                          │  │
│  │  - Checagem de Orçamento de Tokens (< 5.000 tokens diários)           │  │
│  │  - Autorização Explícita do Lote pelo Usuário                         │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                ┌────────────────────┴───────────────────┐                   │
│                ▼                                        ▼                   │
│      [Plano B: Contingência Local]        [Backend Proxy: Express]          │
│      - Marcação para Revisão Manual        POST /api/gemini/classify        │
│      - Continuidade da Preparação          (SDK @google/genai Flash-Lite)   │
│                                                         │                   │
│  ┌──────────────────────────────────────────────────────┴────────────────┐  │
│  │                  Validação IRaMuTeQ & Exportador Central              │  │
│  │  - Verificação de Linhas **** *var_val                                │  │
│  │  - UTF-8 LF sem BOM                                                   │  │
│  │  - Geração de Pacote ZIP (Corpus TXT + CSVs + Relatórios)              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entidades de Dados Principais
- **DocumentItem**: `id`, `name`, `type` (article | interview | institutional), `rawText`, `cleanedText`, `metadata` (author, year, group, title, customVars), `status` (imported | cleaned | reviewed), `sections` (detected references, abstract, etc.), `reviewHistory`.
- **LexicalExpression**: `id`, `originalText`, `suggestedText` (ex: `educação_empreendedora`), `source` (dictionary | statistical | gemini | manual), `frequency`, `docCount`, `contexts` (array de snippets curtos), `status` (pending | approved | rejected), `ambiguityScore`, `aiClassification`, `justification`.
- **AITransactionLog**: `id`, `timestamp`, `model`, `batchSize`, `inputTokens`, `outputTokens`, `cached`, `fallbackTriggered`, `costEstimated`.
- **IRaMuTeQProfile**: Configuração conservadora de pontuação, prefixo de comando (`****`), separador de variáveis (`*`).

### Roteiro de Implementação
1. **Fase 1**: Servidor backend Express para proxy seguro do Gemini (`/api/gemini/classify`) com `@google/genai` + Estrutura base de componentes e layout SaaS com 6 abas funcionais.
2. **Fase 2**: Motores de extração determinística (PDF.js, Mammoth.js, Tesseract.js, TXT) e normalização textual com preservação de acentos e higienização de quebras.
3. **Fase 3**: Módulo lexical completo (n-gramas 2-5, cálculo estatístico de coocorrência, dicionário padrão embutido, editor de termos, aplicação segura de substituições com prevenção de sobreposição).
4. **Fase 4**: Integração controlada com Gemini, `AIUsageDecisionEngine`, controle rígido de tokens, cache persistente e teste ativo do `FallbackManager` (Plano B).
5. **Fase 5**: Modos especializados de corpus (Artigos e Entrevistas com anonimização), validador estrito para IRaMuTeQ e gerador de relatórios e exportação ZIP (JSZip).
6. **Fase 6**: Testes automatizados incorporados na interface (testes de extração, normalização, palavras compostas, fallback de IA e validação IRaMuTeQ) para assegurar conformidade total.
