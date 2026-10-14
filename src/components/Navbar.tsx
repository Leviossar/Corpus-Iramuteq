import React from 'react';
import {
  Layers,
  Upload,
  FileEdit,
  BookOpen,
  FolderTree,
  CheckCircle2,
  PlayCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

export type ActiveTab = 'overview' | 'import' | 'prepare' | 'dictionary' | 'organize' | 'validate';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  documentsCount: number;
  corpusMode: string;
  onOpenTests: () => void;
  onOpenClearModal: () => void;
  isValidCorpus: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  documentsCount,
  corpusMode,
  onOpenTests,
  onOpenClearModal,
  isValidCorpus,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão Geral', icon: <Layers className="w-4 h-4" /> },
    { id: 'import', label: 'Importar Documentos', icon: <Upload className="w-4 h-4" /> },
    { id: 'prepare', label: 'Preparar Textos', icon: <FileEdit className="w-4 h-4" /> },
    { id: 'dictionary', label: 'Dicionário Lexical', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'organize', label: 'Organizar Corpus', icon: <FolderTree className="w-4 h-4" /> },
    { id: 'validate', label: 'Validar & Exportar', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('overview');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center font-mono text-sm font-bold shadow-xs">
            C
          </div>
          CorpusLab
        </a>
        <span className="text-xs text-slate-400 font-normal hidden sm:inline">
          IRaMuTeQ Studio · {corpusMode === 'interviews' ? 'Entrevistas' : corpusMode === 'articles' ? 'Artigos Científicos' : 'Documentos'} ({documentsCount} doc{documentsCount === 1 ? '' : 's'})
        </span>
      </div>

      {/* Zone 2: 6 clean single-line text navigation links */}
      <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 text-xs font-semibold ${
                isActive
                  ? 'bg-slate-100 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenClearModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer border border-transparent hover:border-red-200"
          title="Limpar todos os documentos ou reiniciar o projeto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Limpar Informações</span>
        </button>

        <button
          onClick={onOpenTests}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Executar bateria de testes automatizados de extração, normalização e conformidade IRaMuTeQ"
        >
          <PlayCircle className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden xl:inline">Testes do Sistema</span>
        </button>

        <button
          onClick={() => setActiveTab('validate')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs ${
            isValidCorpus
              ? 'text-white bg-blue-600 hover:bg-blue-700'
              : 'text-white bg-slate-900 hover:bg-slate-800'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Exportar Corpus
        </button>
      </div>
    </header>
  );
};
