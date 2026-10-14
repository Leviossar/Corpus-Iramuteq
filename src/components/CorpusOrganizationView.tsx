import React, { useState } from 'react';
import {
  FolderTree,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  Users,
  BookOpen,
  Building,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { CorpusMode, DocumentItem } from '../types/corpus';
import { buildIramuteqCommandLine } from '../utils/iramuteqValidator';
import { generateMetadataCsv, downloadFile } from '../utils/exportManager';

interface CorpusOrganizationViewProps {
  documents: DocumentItem[];
  corpusMode: CorpusMode;
  onUpdateCorpusMode: (mode: CorpusMode) => void;
  onUpdateDocuments: (docs: DocumentItem[]) => void;
}

export const CorpusOrganizationView: React.FC<CorpusOrganizationViewProps> = ({
  documents,
  corpusMode,
  onUpdateCorpusMode,
  onUpdateDocuments,
}) => {
  const [newVarKey, setNewVarKey] = useState<string>('');
  const [newVarDefaultVal, setNewVarDefaultVal] = useState<string>('');

  const handleMetadataChange = (
    docId: string,
    field: 'id' | 'year' | 'authors' | 'group' | 'participantId' | 'title',
    value: string
  ) => {
    const updated = documents.map((doc) => {
      if (doc.id === docId) {
        if (field === 'id') {
          return { ...doc, id: value };
        }
        return {
          ...doc,
          metadata: {
            ...doc.metadata,
            [field]: value,
          },
        };
      }
      return doc;
    });
    onUpdateDocuments(updated);
  };

  const handleCustomVarChange = (docId: string, varKey: string, varVal: string) => {
    const updated = documents.map((doc) => {
      if (doc.id === docId) {
        return {
          ...doc,
          metadata: {
            ...doc.metadata,
            customVars: {
              ...doc.metadata.customVars,
              [varKey]: varVal,
            },
          },
        };
      }
      return doc;
    });
    onUpdateDocuments(updated);
  };

  const handleAddGlobalCustomVar = () => {
    if (!newVarKey.trim()) return;
    const cleanKey = newVarKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const updated = documents.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        customVars: {
          ...doc.metadata.customVars,
          [cleanKey]: newVarDefaultVal.trim() || 'geral',
        },
      },
    }));

    onUpdateDocuments(updated);
    setNewVarKey('');
    setNewVarDefaultVal('');
  };

  const handleAutoAnonymizeInterviews = () => {
    const updated = documents.map((doc, idx) => {
      const pId = `P${String(idx + 1).padStart(2, '0')}`;
      return {
        ...doc,
        id: `entrevista_${pId}`,
        metadata: {
          ...doc.metadata,
          participantId: pId,
          authors: 'Participante Anônimo',
        },
      };
    });
    onUpdateDocuments(updated);
    alert('Anonimização de entrevistas concluída: códigos P01, P02... atribuídos.');
  };

  const handleExportCsv = () => {
    const csv = generateMetadataCsv(documents);
    downloadFile(csv, 'metadados_corpuslab.csv', 'text/csv;charset=utf-8');
  };

  // Collect all unique custom variable keys
  const allCustomVarKeys = Array.from(
    new Set(documents.flatMap((d) => Object.keys(d.metadata.customVars || {})))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Organizar Corpus & Variáveis Metodológicas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Estruturação das linhas de comando do IRaMuTeQ (<code className="font-mono text-xs text-blue-600">**** *id *ano_2024 *var_val</code>) e anonimização de participantes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Metadados (CSV)
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
        <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
          Modalidade do Corpus Textual
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => onUpdateCorpusMode('articles')}
            className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
              corpusMode === 'articles'
                ? 'border-blue-500 bg-blue-50/40 text-blue-900 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Artigos Científicos
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Múltiplos artigos com variáveis de ano, autores, revista e foco temático.
            </p>
          </button>

          <button
            onClick={() => onUpdateCorpusMode('interviews')}
            className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
              corpusMode === 'interviews'
                ? 'border-blue-500 bg-blue-50/40 text-blue-900 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Users className="w-4 h-4 text-emerald-600" />
              Entrevistas Semiestruturadas
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Uma unidade textual por entrevistado com códigos anônimos (P01, P02) e filtro de entrevistador.
            </p>
          </button>

          <button
            onClick={() => onUpdateCorpusMode('institutional')}
            className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
              corpusMode === 'institutional'
                ? 'border-blue-500 bg-blue-50/40 text-blue-900 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Building className="w-4 h-4 text-indigo-600" />
              Documentos Institucionais
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Relatórios anuais, atas de reuniões, pareceres e regulamentos organizacionais.
            </p>
          </button>
        </div>

        {corpusMode === 'interviews' && (
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Privacidade e Anonimização:</strong> No modo de entrevistas, os textos não são enviados para provedores externos sem consentimento específico. Cada participante é referenciado por código anônimo.
              </span>
            </div>
            <button
              onClick={handleAutoAnonymizeInterviews}
              className="px-3 py-1.5 font-semibold text-emerald-800 bg-white border border-emerald-300 hover:bg-emerald-100 rounded cursor-pointer whitespace-nowrap shadow-xs"
            >
              Atribuir Códigos Anônimos (P01... P0n)
            </button>
          </div>
        )}
      </div>

      {/* Add Custom Variable Form */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
        <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
          Adicionar Nova Variável Categórica a Todos os Textos
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="Nome da variável (ex: genero, setor, experiencia)"
            value={newVarKey}
            onChange={(e) => setNewVarKey(e.target.value)}
            className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded px-3 py-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
          />
          <input
            type="text"
            placeholder="Valor padrão (ex: masculino, industrial, senior)"
            value={newVarDefaultVal}
            onChange={(e) => setNewVarDefaultVal(e.target.value)}
            className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded px-3 py-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full font-mono"
          />
          <button
            onClick={handleAddGlobalCustomVar}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5 w-full sm:w-auto justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Variável
          </button>
        </div>
      </div>

      {/* Metadata Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Catálogo de Metadados & Linhas de Comando Geradas
          </span>
          <span className="text-xs text-slate-500">
            {documents.length} textos cadastrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">ID do Texto</th>
                <th className="px-4 py-3">Linha de Comando IRaMuTeQ</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">{corpusMode === 'interviews' ? 'Código Participante' : 'Autores'}</th>
                <th className="px-4 py-3">Grupo Categórico</th>
                {allCustomVarKeys.map((k) => (
                  <th key={k} className="px-4 py-3 font-mono">*{k}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5 + allCustomVarKeys.length} className="px-4 py-8 text-center text-slate-400">
                    Nenhum documento carregado.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const cmdLine = buildIramuteqCommandLine(doc);

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        <input
                          type="text"
                          value={doc.id}
                          onChange={(e) => handleMetadataChange(doc.id, 'id', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-28 font-mono"
                        />
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold select-all">
                        {cmdLine}
                      </td>

                      <td className="px-4 py-3 font-mono tabular-nums">
                        <input
                          type="text"
                          value={doc.metadata.year || ''}
                          onChange={(e) => handleMetadataChange(doc.id, 'year', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-16 font-mono"
                          placeholder="2024"
                        />
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {corpusMode === 'interviews' ? (
                          <input
                            type="text"
                            value={doc.metadata.participantId || ''}
                            onChange={(e) => handleMetadataChange(doc.id, 'participantId', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-20 font-mono"
                            placeholder="P01"
                          />
                        ) : (
                          <input
                            type="text"
                            value={doc.metadata.authors || ''}
                            onChange={(e) => handleMetadataChange(doc.id, 'authors', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-32"
                            placeholder="Silva et al."
                          />
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <input
                          type="text"
                          value={doc.metadata.group || ''}
                          onChange={(e) => handleMetadataChange(doc.id, 'group', e.target.value)}
                          className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-28 font-mono"
                          placeholder="geral"
                        />
                      </td>

                      {allCustomVarKeys.map((k) => (
                        <td key={k} className="px-4 py-3 font-mono text-slate-700">
                          <input
                            type="text"
                            value={doc.metadata.customVars[k] || ''}
                            onChange={(e) => handleCustomVarChange(doc.id, k, e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-24 font-mono text-xs"
                            placeholder="valor"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
