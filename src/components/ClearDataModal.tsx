import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, RotateCcw } from 'lucide-react';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClear: (clearOptions: { clearDocuments: boolean; resetDictionary: boolean; clearHistory: boolean }) => void;
  documentsCount: number;
  expressionsCount: number;
}

export const ClearDataModal: React.FC<ClearDataModalProps> = ({
  isOpen,
  onClose,
  onConfirmClear,
  documentsCount,
  expressionsCount,
}) => {
  const [clearDocuments, setClearDocuments] = useState(true);
  const [resetDictionary, setResetDictionary] = useState(false);
  const [clearHistory, setClearHistory] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirmClear({
      clearDocuments,
      resetDictionary,
      clearHistory,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Trash2 className="w-4 h-4 text-red-600" />
            Limpar Informações do Projeto
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold">Atenção:</strong> Esta ação removerá os dados do navegador e reiniciará o espaço de trabalho. Escolha os itens que deseja limpar:
            </div>
          </div>

          <div className="space-y-3 pt-1 text-xs">
            <label className="flex items-start gap-2.5 text-slate-700 cursor-pointer p-2 rounded hover:bg-slate-50 border border-slate-100">
              <input
                type="checkbox"
                checked={clearDocuments}
                onChange={(e) => setClearDocuments(e.target.checked)}
                className="mt-0.5 rounded text-red-600 focus:ring-red-500"
              />
              <div>
                <span className="font-semibold text-slate-900">Limpar todos os documentos ({documentsCount} carregados)</span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Exclui textos brutos, textos tratados e metadados de artigos ou entrevistas.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 text-slate-700 cursor-pointer p-2 rounded hover:bg-slate-50 border border-slate-100">
              <input
                type="checkbox"
                checked={clearHistory}
                onChange={(e) => setClearHistory(e.target.checked)}
                className="mt-0.5 rounded text-red-600 focus:ring-red-500"
              />
              <div>
                <span className="font-semibold text-slate-900">Limpar histórico de transformações e logs</span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Zera o registro de auditoria de substituições realizadas nos textos.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 text-slate-700 cursor-pointer p-2 rounded hover:bg-slate-50 border border-slate-100">
              <input
                type="checkbox"
                checked={resetDictionary}
                onChange={(e) => setResetDictionary(e.target.checked)}
                className="mt-0.5 rounded text-red-600 focus:ring-red-500"
              />
              <div>
                <span className="font-semibold text-slate-900">Reiniciar dicionário lexical</span>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Restaura o dicionário de palavras compostas para a lista acadêmica padrão de fábrica.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded cursor-pointer"
          >
            Cancelar
          </button>
          <button
            disabled={!clearDocuments && !resetDictionary && !clearHistory}
            onClick={handleConfirm}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Confirmar e Limpar
          </button>
        </div>
      </div>
    </div>
  );
};
