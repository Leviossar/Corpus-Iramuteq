import React, { useState, useEffect } from 'react';
import {
  X,
  PlayCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { runAllAutomatedTests, TestResultItem } from '../utils/automatedTests';

interface TestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestsModal: React.FC<TestsModalProps> = ({ isOpen, onClose }) => {
  const [testResults, setTestResults] = useState<TestResultItem[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const executeTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results = runAllAutomatedTests();
      setTestResults(results);
      setIsRunning(false);
    }, 400);
  };

  useEffect(() => {
    if (isOpen) {
      executeTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const passedCount = testResults.filter((t) => t.passed).length;
  const totalCount = testResults.length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  // Group by category
  const categories = Array.from(new Set(testResults.map((t) => t.category)));

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Bateria de Testes Automatizados do CorpusLab
              </h2>
              <p className="text-xs text-slate-500">
                Verificação real de extração, normalização, palavras compostas, Plano B e regras do IRaMuTeQ.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={executeTests}
              disabled={isRunning}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded cursor-pointer disabled:opacity-50"
              title="Executar testes novamente"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scorecard */}
        <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-700">
              Taxa de Aprovação: <strong className="font-mono text-emerald-700">{passRate}%</strong>
            </span>
            <span>·</span>
            <span>
              Passaram: <strong className="font-mono text-emerald-600">{passedCount}</strong> de {totalCount}
            </span>
          </div>

          <span
            className={`px-2 py-0.5 rounded font-mono font-semibold text-[11px] ${
              passedCount === totalCount ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {passedCount === totalCount ? 'TODOS OS TESTES APROVADOS' : 'FALHAS DETECTADAS'}
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {categories.map((category) => {
            const items = testResults.filter((t) => t.category === category);
            return (
              <div key={category} className="space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {category}
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                  {items.map((item) => (
                    <div key={item.id} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                          )}
                          <span className="font-semibold text-slate-900">{item.name}</span>
                        </div>
                        <div className="text-slate-500 font-mono text-[11px] pl-6">
                          {item.details}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          item.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {item.passed ? 'PASSOU' : 'FALHOU'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded cursor-pointer shadow-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
