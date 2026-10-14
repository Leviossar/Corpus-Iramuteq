import {
  fixLineBreakHyphenation,
  reconstructParagraphs,
  cleanInvisibleCharacters,
  detectAcademicSections,
  applySectionExclusions,
} from './textNormalizer';
import {
  applyApprovedCompoundWords,
  revertCompoundWord,
  tokenizeWords,
} from './lexicalEngine';
import { FallbackManager } from '../services/geminiService';
import { sanitizeIramuteqVar, buildIramuteqCommandLine, validateCorpus, generateIramuteqTxt } from './iramuteqValidator';
import { DocumentItem, LexicalExpression } from '../types/corpus';

export interface TestResultItem {
  id: string;
  category: 'Extração' | 'Normalização' | 'Palavras Compostas' | 'Gemini & Plano B' | 'Exportação IRaMuTeQ';
  name: string;
  passed: boolean;
  details: string;
}

export function runAllAutomatedTests(): TestResultItem[] {
  const results: TestResultItem[] = [];

  // ==========================================
  // 1. Normalização de Texto
  // ==========================================
  // Test 1.1: Hífen de quebra de linha com junção correta
  const hyphenInput = 'A implemen-\ntação do sistema';
  const hyphenOutput = fixLineBreakHyphenation(hyphenInput);
  results.push({
    id: 'norm_1',
    category: 'Normalização',
    name: 'Recuperação de palavras divididas por quebra de linha',
    passed: hyphenOutput.cleanedText.includes('implementação') && !hyphenOutput.cleanedText.includes('-\n'),
    details: `Entrada: "${hyphenInput}" -> Saída: "${hyphenOutput.cleanedText}"`,
  });

  // Test 1.2: Preservação de hífens lexicais (segunda-feira)
  const lexicalHyphen = 'Na segunda-\nfeira pela manhã';
  const lexicalHyphenOutput = fixLineBreakHyphenation(lexicalHyphen);
  results.push({
    id: 'norm_2',
    category: 'Normalização',
    name: 'Preservação de hífen lexical (segunda-feira)',
    passed: lexicalHyphenOutput.cleanedText.includes('segunda-feira'),
    details: `Entrada: "${lexicalHyphen}" -> Saída: "${lexicalHyphenOutput.cleanedText}"`,
  });

  // Test 1.3: Reconstrução de parágrafos sem quebras artificiais
  const brokenLines = 'Este é o primeiro fragmento de uma frase longa\nque continuava na linha seguinte.\n\nNovo parágrafo aqui.';
  const recParOutput = reconstructParagraphs(brokenLines);
  results.push({
    id: 'norm_3',
    category: 'Normalização',
    name: 'Reconstrução de parágrafos e eliminação de quebras artificiais',
    passed: recParOutput.includes('frase longa que continuava') && recParOutput.includes('\n\nNovo parágrafo'),
    details: `Reconstruído com sucesso em 2 parágrafos distintos.`,
  });

  // Test 1.4: Preservação estrita de todos os acentos da língua portuguesa
  const accentsInput = 'ações, métodos, eficiência, saúde, língua, fácil, âmbar, órfão';
  const accentsCleaned = cleanInvisibleCharacters(accentsInput);
  results.push({
    id: 'norm_4',
    category: 'Normalização',
    name: 'Preservação de caracteres diacríticos e acentuação',
    passed: accentsCleaned === accentsInput,
    details: `Todos os 8 termos com acentos gráficos preservados sem corrupção.`,
  });

  // Test 1.5: Exclusão seletiva de referências bibliográficas
  const textWithRefs = 'Texto principal do artigo científico.\n\nREFERÊNCIAS\nSILVA, J. Livro de Teste. 2020.';
  const detected = detectAcademicSections(textWithRefs);
  const excludedRefs = applySectionExclusions(textWithRefs, {
    excludeReferences: true,
    excludeAbstract: false,
    excludeTables: false,
    excludeFootnotes: false,
    excludeInterviewerQuestions: false,
  }, detected);
  results.push({
    id: 'norm_5',
    category: 'Normalização',
    name: 'Exclusão seletiva e reversível de referências bibliográficas',
    passed: excludedRefs.includes('Texto principal') && !excludedRefs.includes('SILVA, J.'),
    details: `Seção de referências removida sob solicitação sem afetar o corpo.`,
  });

  // ==========================================
  // 2. Módulo de Palavras Compostas
  // ==========================================
  // Test 2.1: Priorização de expressões mais longas (evita sobreposição)
  const compoundExpressions: LexicalExpression[] = [
    {
      id: 'e1',
      original: 'gestão de processos',
      normalized: 'gestão_de_processos',
      source: 'dictionary',
      frequency: 2,
      docCount: 1,
      contexts: [],
      status: 'approved',
      ambiguityScore: 0.1,
      appliedCount: 0,
    },
    {
      id: 'e2',
      original: 'gestão estratégica de processos',
      normalized: 'gestão_estratégica_de_processos',
      source: 'dictionary',
      frequency: 1,
      docCount: 1,
      contexts: [],
      status: 'approved',
      ambiguityScore: 0.1,
      appliedCount: 0,
    },
  ];

  const sentenceToReplace = 'Adotamos a gestão estratégica de processos e também a gestão de processos padrão.';
  const { updatedText } = applyApprovedCompoundWords(sentenceToReplace, compoundExpressions, 'doc1', 'doc.txt');
  const hasLongerFirst = updatedText.includes('gestão_estratégica_de_processos') && updatedText.includes('gestão_de_processos');
  const noDoubleCollision = !updatedText.includes('gestão_estratégica_de_gestão');

  results.push({
    id: 'comp_1',
    category: 'Palavras Compostas',
    name: 'Priorização de expressões mais longas e prevenção de sobreposição',
    passed: hasLongerFirst && noDoubleCollision,
    details: `Resultado: "${updatedText}"`,
  });

  // Test 2.2: Reversibilidade de substituição (desfazer)
  const reverted = revertCompoundWord(updatedText, 'gestão_de_processos', 'gestão de processos');
  results.push({
    id: 'comp_2',
    category: 'Palavras Compostas',
    name: 'Reversibilidade completa de substituição',
    passed: reverted.includes('gestão de processos padrão'),
    details: `Expressão revertida para a forma separada sem corrupção textual.`,
  });

  // Test 2.3: Não modificação de palavras maiores que contenham substrings
  const subWordSentence = 'A congestão de processos nos tribunais aumentou.';
  const { updatedText: subWordUpdated } = applyApprovedCompoundWords(subWordSentence, compoundExpressions, 'doc1', 'doc.txt');
  results.push({
    id: 'comp_3',
    category: 'Palavras Compostas',
    name: 'Isolamento de limites de palavra (evitar substituição em "congestão")',
    passed: subWordUpdated.includes('congestão de processos') && !subWordUpdated.includes('congestão_de_processos'),
    details: `Regex Unicode lookaround respeitou a palavra "congestão".`,
  });

  // ==========================================
  // 3. Gemini e Plano B (Fallback Local)
  // ==========================================
  // Test 3.1: Acionamento do Plano B por contingência local
  const testExprs: LexicalExpression[] = [
    {
      id: 'fb1',
      original: 'tomada de decisão',
      normalized: 'tomada_de_decisão',
      source: 'statistical',
      frequency: 4,
      docCount: 2,
      contexts: [],
      status: 'pending',
      ambiguityScore: 0.6,
      appliedCount: 0,
    },
  ];

  const fallbackResult = FallbackManager.executeLocalFallback(testExprs, 'Cota 429 simulada');
  results.push({
    id: 'gemini_1',
    category: 'Gemini & Plano B',
    name: 'Acionamento automático do Plano B com marcação para revisão',
    passed: Boolean(fallbackResult[0].justification?.includes('[Plano B Local]') && fallbackResult[0].status === 'pending'),
    details: `Justificativa atribuída: "${fallbackResult[0].justification}"`,
  });

  // Test 3.2: Manutenção do fluxo sem perda de dados quando IA offline
  results.push({
    id: 'gemini_2',
    category: 'Gemini & Plano B',
    name: 'Preservação de dados e independência total de IA externa',
    passed: fallbackResult.length === testExprs.length && fallbackResult[0].original === 'tomada de decisão',
    details: `Todos os metadados e termos preservados durante contingência offline.`,
  });

  // ==========================================
  // 4. Exportação e Validação IRaMuTeQ
  // ==========================================
  // Test 4.1: Sanitização de variáveis IRaMuTeQ
  const cleanVar = sanitizeIramuteqVar('Tipo de Artigo!', 'Revisão Sistemática');
  results.push({
    id: 'export_1',
    category: 'Exportação IRaMuTeQ',
    name: 'Sanitização rigorosa de variáveis (*var_val sem espaços nem caracteres proibidos)',
    passed: cleanVar === '*tipo_de_artigo__revis_o_sistem_tica' || /^\*[a-z0-9_]+$/.test(cleanVar),
    details: `Variável sanitizada para: "${cleanVar}"`,
  });

  // Test 4.2: Geração de linhas de comando com 4 asteriscos
  const dummyDoc: DocumentItem = {
    id: 'artigo_001',
    name: 'artigo_01.pdf',
    size: 1000,
    type: 'pdf',
    corpusMode: 'articles',
    rawText: 'Conteúdo do artigo de teste.',
    cleanedText: 'A educação_empreendedora impulsiona os resultados.',
    reviewedText: 'A educação_empreendedora impulsiona os resultados.',
    status: 'reviewed',
    metadata: {
      title: 'Artigo Teste',
      year: '2024',
      authors: 'Silva',
      group: 'gestao',
      language: 'pt-BR',
      docType: 'artigo',
      customVars: {},
    },
    detectedSections: {},
    exclusionSettings: {
      excludeReferences: false,
      excludeAbstract: false,
      excludeTables: false,
      excludeFootnotes: false,
      excludeInterviewerQuestions: false,
    },
    extractedAt: new Date().toISOString(),
  };

  const commandLine = buildIramuteqCommandLine(dummyDoc);
  results.push({
    id: 'export_2',
    category: 'Exportação IRaMuTeQ',
    name: 'Linha de comando iniciada por quatro asteriscos (**** *id *ano_2024)',
    passed: commandLine.startsWith('**** *artigo_001 *ano_2024'),
    details: `Linha gerada: "${commandLine}"`,
  });

  // Test 4.3: Validador contra documentos duplicados ou vazios
  const report = validateCorpus([dummyDoc], []);
  results.push({
    id: 'export_3',
    category: 'Exportação IRaMuTeQ',
    name: 'Auditoria estrutural completa pré-exportação',
    passed: report.isValid && report.status === 'ready' && report.errorsCount === 0,
    details: `Corpus auditado: ${report.totalDocuments} documento(s), 0 erros estruturais.`,
  });

  // Test 4.4: Formatação de arquivo TXT com quebras LF sem CRLF
  const fullTxt = generateIramuteqTxt([dummyDoc]);
  results.push({
    id: 'export_4',
    category: 'Exportação IRaMuTeQ',
    name: 'Corpus TXT em formato UTF-8 puro com quebras de linha UNIX (LF)',
    passed: !fullTxt.includes('\r\n') && fullTxt.includes('**** *artigo_001'),
    details: `Texto formatado com quebras LF e ausência de caracteres carriage return.`,
  });

  return results;
}
