'use client';

import React from 'react';
import {
  Wand2, BookOpen, Folder, LayoutDashboard, Calendar,
  ChevronDown, ChevronRight, Plus, LogOut,
  Lightbulb, Bug, Diamond, Building2, Map, Share2, User,
} from 'lucide-react';
import { useWorldContext } from '../app/context/WorldContext';

export const wikiCategories = [
  { id: 'conceitos', label: 'Conceito', icon: Lightbulb, key: 'Conceito', desc: 'Leis mágicas, teorias, dogmas' },
  { id: 'criaturas', label: 'Criatura', icon: Bug, key: 'Criatura', desc: 'Monstros, feras, bestas' },
  { id: 'divindades', label: 'Divindade', icon: Wand2, key: 'Divindade', desc: 'Deuses, panteões' },
  { id: 'eventos', label: 'Evento', icon: Calendar, key: 'Evento', desc: 'Guerras, cataclismas' },
  { id: 'itens', label: 'Item', icon: Diamond, key: 'Item', desc: 'Artefatos, relíquias' },
  { id: 'locais', label: 'Local', icon: Map, key: 'Local', desc: 'Reinos, cidades, masmorras' },
  { id: 'organizacoes', label: 'Organização', icon: Building2, key: 'Organização', desc: 'Guildas, reinos, cultos' },
  { id: 'personagens', label: 'Personagem', icon: User, key: 'Personagem', desc: 'Raça, Idade, Classe, Status' },
  { id: 'racas', label: 'Raças', icon: Share2, key: 'Raças', desc: 'Elfos, anões, humanos' },
];

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  isWikiOpen: boolean;
  setIsWikiOpen: (open: boolean) => void;
  onCreateWorld: () => void;
  onLogout: () => void;
}

export default function Sidebar({ activeView, setActiveView, isWikiOpen, setIsWikiOpen, onCreateWorld, onLogout }: SidebarProps) {
  const { selectedWorld, worlds, setSelectedWorld, wikiCounts } = useWorldContext();
  const [worldsDropdownOpen, setWorldsDropdownOpen] = React.useState(false);

  return (
    <aside className="w-64 bg-[#05080C] border-r border-slate-800/50 flex flex-col h-full shrink-0 z-20">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]">
          <Wand2 className="w-5 h-5 text-slate-950" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-wide font-serif">WorldCraft</h1>
      </div>

      {/* World Selector */}
      <div className="px-4 pb-4 relative">
        <button
          onClick={() => setWorldsDropdownOpen(o => !o)}
          className="w-full flex items-center justify-between bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-lg px-3 py-2 text-sm transition-colors"
        >
          <span className="truncate pr-2 font-medium text-slate-200">
            {selectedWorld ? selectedWorld.name : 'Selecionar mundo'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${worldsDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {worldsDropdownOpen && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-[#0B1018] border border-slate-800 rounded-lg shadow-xl z-50 overflow-hidden">
            {worlds.map(w => (
              <button
                key={w.id}
                onClick={() => { setSelectedWorld(w); setWorldsDropdownOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors ${selectedWorld?.id === w.id ? 'text-emerald-400' : 'text-slate-300'}`}
              >
                {w.name}
              </button>
            ))}
            <div className="border-t border-slate-800">
              <button
                onClick={() => { setWorldsDropdownOpen(false); onCreateWorld(); }}
                className="w-full text-left px-3 py-2 text-sm text-emerald-500 hover:bg-slate-800 flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Novo Mundo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 custom-scrollbar">
        <p className="text-xs font-semibold text-slate-600 mb-2 px-3 mt-2 tracking-wider">NAVEGAÇÃO</p>
        <ul className="space-y-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'arquivos', label: 'Arquivos', icon: Folder },
          ].map(item => (
            <li key={item.id}>
              <button
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeView === item.id ? 'bg-slate-800 text-white font-medium shadow-sm border border-slate-700' : 'hover:bg-slate-900 hover:text-white text-slate-400 border border-transparent'}`}
              >
                <item.icon className="w-4 h-4" /> <span>{item.label}</span>
              </button>
            </li>
          ))}

          {/* Wiki collapsible */}
          <li className="pt-2">
            <div className={`w-full flex items-center rounded-lg text-sm transition-colors ${activeView === 'wiki' ? 'bg-slate-800 text-white border border-slate-700' : 'hover:bg-slate-900 text-slate-400 border border-transparent'}`}>
              <button onClick={() => setActiveView('wiki')} className="flex items-center gap-3 px-3 py-2 flex-1 text-left font-medium">
                <BookOpen className="w-4 h-4" /> Wiki
              </button>
              <button onClick={() => setIsWikiOpen(!isWikiOpen)} className="px-3 py-2 hover:bg-slate-700/50 rounded-r-lg text-slate-500 hover:text-white">
                {isWikiOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
            {isWikiOpen && (
              <ul className="mt-1 ml-4 pl-4 border-l border-slate-800 space-y-1">
                {wikiCategories.map(sub => (
                  <li key={sub.id}>
                    <button
                      onClick={() => setActiveView(sub.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${activeView === sub.id ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'hover:bg-slate-900 hover:text-white text-slate-400'}`}
                    >
                      <span className="flex items-center gap-2"><sub.icon className="w-4 h-4" />{sub.label}</span>
                      <span className="text-[10px] text-slate-600 font-mono">{wikiCounts[sub.key as keyof typeof wikiCounts]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-slate-800/50">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all"
        >
          <LogOut className="w-4 h-4" /> Sair do Portal
        </button>
      </div>
    </aside>
  );
}
