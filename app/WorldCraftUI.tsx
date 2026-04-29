'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import RichTextEditor from '../components/RichTextEditor';
import CreateWorldModal from '../components/Modals/CreateWorldModal';
import CreateEntityModal from '../components/Modals/CreateEntityModal';
import WorldGraph from '../components/WorldGraph';
import FileManager from '../components/FileManager'; 
import EvidenceBoard from '../components/EvidenceBoard';
import CampaignManager from '../components/CampaignManager';
import IdeaBoard from '../components/IdeaBoard';
import Timeline from '../components/Timeline';
import QuickNotes from '../components/QuickNotes';
import ConfirmModal from '../components/Modals/ConfirmModal';
import ExportEntityModal from '../components/Modals/ExportEntityModal';
import { 
  Search, Sparkles, Folder, BookOpen, Share2, Network, Map, LayoutDashboard, Calendar, FileText, Ghost, Shield, Plus,
  ChevronDown, ChevronRight, Wand2, User, X, Loader2, Save, Image as ImageIcon,
  Lightbulb, Bug, Diamond, Building2, ArrowLeft, LogOut, Clock, MonitorPlay, BookMarked, Globe,
  Filter, Tags, ArrowDownAZ, LayoutGrid, List as ListIcon, Camera, History, UserPlus, Trash2, Edit2, Clock3, StickyNote, Copy, Download,
  Users, Lock, Send
} from 'lucide-react';
import { useWorldContext, IRelation, ICharacter, IWorld, IPlayerNote } from './context/WorldContext'; 

const getCategoryStyle = (key: string) => {
  const styles: Record<string, { bg: string, text: string, border: string, hover: string }> = {
    Conceito: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', hover: 'hover:border-amber-500/50' },
    Criatura: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', hover: 'hover:border-rose-500/50' },
    Divindade: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', hover: 'hover:border-yellow-500/50' },
    Evento: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', hover: 'hover:border-sky-500/50' },
    Item: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30', hover: 'hover:border-pink-500/50' },
    Local: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', hover: 'hover:border-emerald-500/50' },
    Organização: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', hover: 'hover:border-orange-500/50' },
    Personagem: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', hover: 'hover:border-purple-500/50' },
    Raças: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30', hover: 'hover:border-teal-500/50' },
  };
  return styles[key] || styles.Personagem;
};

export default function WorldCraftUI({ session }: { session?: any }) {
  const { 
    worlds, selectedWorld, setSelectedWorld, characters, selectedCharacter, setSelectedCharacter, currentCharacterData, loadCharacterData,
    charBio, setCharBio, avatarUrl, handleAvatarUpload, isUploading, fileInputRef,
    entityAttributes, setEntityAttributes, entityTags, setEntityTags, isPublic, setIsPublic, sortOrder, setSortOrder,
    handleSaveCharacterInfo, isSavingChar, wikiCounts, searchQuery, setSearchQuery,
    fetchRelations, createRelation, deleteRelation, handleDeleteWorld, handleDeleteEntity, fetchWorlds, duplicateEntity,
    
    // --- Funções da Fase 3 (Censura e Notas) ---
    isGM, getVisibleEntities, getRevealedFields, selectedCampaign,
    playerNotes, fetchPlayerNotes, createPlayerNote, deletePlayerNote
  } = useWorldContext();

  const [activeView, setActiveView] = useState('dashboard');
  const [isWikiOpen, setIsWikiOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [entityTypeToCreate, setEntityTypeToCreate] = useState<any>(null);
  const [newTagInput, setNewTagInput] = useState('');

  // ESTADO DAS ABAS DA FICHA (Adicionada 'mesa' para as Notas dos Jogadores)
  const [activeTab, setActiveTab] = useState<'geral' | 'atributos' | 'conexoes' | 'mesa' | 'leitura'>('geral');

  // ESTADO DAS CONEXÕES E NOTAS
  const [relations, setRelations] = useState<IRelation[]>([]);
  const [newRelationTarget, setNewRelationTarget] = useState('');
  const [newRelationLabel, setNewRelationLabel] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isNotePrivate, setIsNotePrivate] = useState(false);

  // Dropdown e Busca
  const [isWorldDropdownOpen, setIsWorldDropdownOpen] = useState(false);
  const worldDropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editingWorldId, setEditingWorldId] = useState<string | null>(null);
  const [editWorldName, setEditWorldName] = useState('');
  const [isSavingWorld, setIsSavingWorld] = useState(false);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const [confirmModalConfig, setConfirmModalConfig] = useState<{ isOpen: boolean; title: string; message: string; action: () => Promise<void>; isLoading: boolean; }>({ isOpen: false, title: '', message: '', action: async () => {}, isLoading: false });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // FILTRO MÁGICO: Aplica o "Filtro de Realidade" (Só vê o que o GM deixa)
  const visibleEntitiesList = getVisibleEntities();
  const filteredCharacters = useMemo(() => {
    return visibleEntitiesList.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.category?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()));
  }, [visibleEntitiesList, searchQuery]);

  // CENSURA: Campos revelados da entidade selecionada
  const revealedFields = selectedCharacter ? getRevealedFields(selectedCharacter) : [];
  const canViewBio = revealedFields.includes('biography');
  const canViewAttributes = revealedFields.includes('attributes');
  const canViewAvatar = revealedFields.includes('avatar');
  const canViewTags = revealedFields.includes('tags');
  const canViewRelations = revealedFields.includes('relations');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (worldDropdownRef.current && !worldDropdownRef.current.contains(event.target as Node)) { setIsWorldDropdownOpen(false); setEditingWorldId(null); }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) { setIsSearchDropdownOpen(false); }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [worldDropdownRef, searchContainerRef]);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const isCategoryView = wikiCategories.some(cat => cat.id === activeView);
    setIsSearchDropdownOpen(debouncedSearch.length >= 2 && !isCategoryView);
  }, [debouncedSearch, activeView]);

  useEffect(() => {
    if (selectedCharacter && activeTab === 'conexoes') fetchRelations(selectedCharacter).then(setRelations);
    if (selectedCharacter && activeTab === 'mesa' && selectedCampaign) fetchPlayerNotes(selectedCampaign.id, selectedCharacter);
  }, [selectedCharacter, activeTab, fetchRelations, fetchPlayerNotes, selectedCampaign]);

  const handleAddRelation = async () => {
    if (!selectedCharacter || !newRelationTarget || !newRelationLabel) return;
    await createRelation(selectedCharacter, newRelationTarget, newRelationLabel);
    fetchRelations(selectedCharacter).then(setRelations);
    setNewRelationTarget(''); setNewRelationLabel('');
  };

  const handleAddNote = async () => {
    if (!selectedCampaign || !selectedCharacter || !newNoteContent.trim()) return;
    await createPlayerNote(selectedCampaign.id, selectedCharacter, newNoteContent, isNotePrivate);
    setNewNoteContent('');
  };

  const handleRemoveRelation = async (id: string) => { await deleteRelation(id); fetchRelations(selectedCharacter!).then(setRelations); };

  const onWorldDeleteClick = (e: React.MouseEvent, worldId: string, worldName: string) => {
    e.stopPropagation(); 
    setConfirmModalConfig({
      isOpen: true, title: 'Excluir Mundo', message: `Tem a certeza que deseja excluir o mundo "${worldName}"? Toda a história, personagens e itens serão perdidos para sempre!`,
      action: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
        try { await handleDeleteWorld(worldId); setIsWorldDropdownOpen(false); setActiveView('dashboard'); } 
        catch (err: any) { alert("Erro ao excluir mundo: " + err.message); } 
        finally { setConfirmModalConfig(prev => ({ ...prev, isOpen: false, isLoading: false })); }
      }, isLoading: false
    });
  };

  const onEntityDeleteClick = () => {
    if(!selectedCharacter) return;
    setConfirmModalConfig({
      isOpen: true, title: 'Excluir Entidade', message: `Tem a certeza que deseja apagar os registos de ${currentCharacterData?.name}? Esta ação é irreversível.`,
      action: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isLoading: true }));
        try { await handleDeleteEntity(selectedCharacter); } 
        catch (err: any) { alert("Erro ao excluir entidade: " + err.message); } 
        finally { setConfirmModalConfig(prev => ({ ...prev, isOpen: false, isLoading: false })); }
      }, isLoading: false
    });
  };

  const handleDuplicate = async () => {
    if(!selectedCharacter) return;
    const newEntity = await duplicateEntity(selectedCharacter);
    if(newEntity) { setToastMessage("Cópia criada!"); setTimeout(() => setToastMessage(null), 2000); }
  };

  const handleInlineWorldEditStart = (e: React.MouseEvent, world: IWorld) => { e.stopPropagation(); setEditingWorldId(world.id); setEditWorldName(world.name); };
  const handleInlineWorldSave = async (worldId: string) => {
    if (!editWorldName.trim() || isSavingWorld) return;
    setIsSavingWorld(true);
    try {
      const { error } = await supabase.from('worlds').update({ name: editWorldName }).eq('id', worldId);
      if (error) throw error;
      await fetchWorlds(); setEditingWorldId(null);
    } catch (error) { console.error(error); } 
    finally { setIsSavingWorld(false); }
  };
  const handleInlineWorldKeyDown = (e: React.KeyboardEvent, worldId: string) => {
    if (e.key === 'Enter') handleInlineWorldSave(worldId); else if (e.key === 'Escape') setEditingWorldId(null);
  };

  const handleGlobalSearchResultClick = (char: ICharacter) => {
    const categoryId = wikiCategories.find(c => c.key === char.category)?.id || 'personagens';
    setActiveView(categoryId); loadCharacterData(char); setIsSearchDropdownOpen(false); setSearchQuery('');
  };

  const groupedSearchResults = useMemo(() => {
    if (!debouncedSearch) return {};
    const results = filteredCharacters.filter(c => c.name.toLowerCase().includes(debouncedSearch.toLowerCase()));
    return results.reduce((acc, char) => {
      const cat = char.category || 'Personagem';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(char); return acc;
    }, {} as Record<string, ICharacter[]>);
  }, [debouncedSearch, filteredCharacters]);

  const recentActivity = useMemo(() => { return [...filteredCharacters].sort((a,b) => -1).slice(0, 5); }, [filteredCharacters]);

 // CALCULO DO SCORE DA FICHA
  const calcCompletionScore = (char: ICharacter | undefined, bio: string): { score: number, missing: string[] } => {
    let score = 0; 
    const missing: string[] = [];
    
    if (!char) return { score, missing };
    
    if (avatarUrl) score += 20; else missing.push("Capa Visual");
    if (bio && bio.replace(/<[^>]*>/g, '').trim().length > 100) score += 30; else missing.push("Arquivos");
    if (Object.keys(entityAttributes || {}).length > 0) score += 20; else missing.push("Ficha Técnica");
    if ((entityTags || []).length > 0) score += 15; else missing.push("Etiquetas (Tags)");
    if (relations.length > 0) score += 15; else missing.push("Vínculos Ativos");
    
    return { score, missing };
  };
  const { score: completionScore, missing: missingScoreItems } = calcCompletionScore(currentCharacterData, charBio);

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.reload(); };

  // MENUS
  const navItemsTop = [ 
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, 
    { id: 'campanhas', label: 'Mesa & Campanha', icon: Users, badge: 'Mesa' }, 
    { id: 'ideias', label: 'Ideias', icon: Lightbulb, badge: 'Novo' }, 
    { id: 'notas', label: 'Grimório', icon: StickyNote }, 
    { id: 'arquivos', label: 'Arquivos', icon: Folder } 
  ];
  const wikiCategories = [
    { id: 'personagens', label: 'Personagens', icon: User, key: 'Personagem' }, { id: 'locais', label: 'Locais', icon: Map, key: 'Local' },
    { id: 'organizacoes', label: 'Organizações', icon: Building2, key: 'Organização' }, { id: 'eventos', label: 'Eventos', icon: Calendar, key: 'Evento' },
    { id: 'itens', label: 'Itens', icon: Diamond, key: 'Item' }, { id: 'conceitos', label: 'Conceitos', icon: Lightbulb, key: 'Conceito' },
    { id: 'criaturas', label: 'Criaturas', icon: Bug, key: 'Criatura' }, { id: 'divindades', label: 'Divindades', icon: Wand2, key: 'Divindade' },
    { id: 'racas', label: 'Raças', icon: Share2, key: 'Raças' },
  ];
  const navItemsBottom = [
    { id: 'grafo', label: 'Grafo', icon: Network }, { id: 'genealogia', label: 'Genealogia', icon: Share2 },
    { id: 'cartografia', label: 'Cartografia', icon: Map }, { id: 'evidencias', label: 'Modo de Evidências', icon: Camera, badge: 'Investigação' },
    { id: 'mesa', label: 'Mesa Virtual', icon: MonitorPlay, badge: 'VTT' }, { id: 'cronos', label: 'Cronos', icon: Clock },
    { id: 'calendario', label: 'Calendário', icon: Calendar }, { id: 'fichas', label: 'Fichas', icon: FileText },
    { id: 'bestiario', label: 'Bestiário', icon: Ghost }, { id: 'guildas', label: 'Guildas', icon: Shield },
    { id: 'compendio', label: 'Compêndio', icon: BookMarked },
  ];

  return (
    <div className="flex h-screen bg-[#090D14] text-slate-300 font-sans overflow-hidden">
      
      {/* ── SIDEBAR ── */}
      <aside className="w-64 bg-[#05080C] border-r border-slate-800/50 flex flex-col h-full shrink-0 z-40 relative">
        <div className="p-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.4)]"><Wand2 className="w-5 h-5 text-slate-950" /></div>
          <h1 className="text-xl font-bold text-white tracking-wide font-serif">WorldCraft</h1>
        </div>
        
        <div className="px-4 pb-4 relative" ref={worldDropdownRef}>
          <button onClick={() => setIsWorldDropdownOpen(!isWorldDropdownOpen)} className={`w-full flex items-center justify-between bg-[#090D14] border ${isWorldDropdownOpen ? 'border-emerald-500/50' : 'border-slate-800'} rounded-lg px-3 py-2.5 text-sm transition-all hover:border-slate-700`}>
             <div className="flex flex-col items-start truncate pr-2">
                <span className="font-bold text-slate-200 truncate">{selectedWorld ? selectedWorld.name : 'Selecione um mundo'}</span>
                {selectedWorld?.genre && <span className="text-[10px] text-emerald-400 font-medium truncate">{selectedWorld.genre}</span>}
             </div>
             <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isWorldDropdownOpen ? 'rotate-180 text-emerald-400' : ''}`} />
          </button>
          {isWorldDropdownOpen && (
             <div className="absolute top-full left-4 right-4 mt-2 bg-[#0B1018] border border-slate-700 rounded-xl shadow-2xl z-50 py-2 overflow-hidden animate-in fade-in zoom-in duration-200">
                <p className="px-3 pb-2 pt-1 text-[10px] font-bold text-slate-500 tracking-wider uppercase border-b border-slate-800/50 mb-2">Os Seus Universos</p>
                <div className="max-h-60 overflow-y-auto custom-scrollbar px-2 space-y-1">
                  {worlds.map(w => (
                    <div key={w.id} className="relative group">
                       <div onClick={() => { if(editingWorldId !== w.id) { setSelectedWorld(w); setIsWorldDropdownOpen(false); } }} className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${selectedWorld?.id === w.id ? 'bg-emerald-500/10 border border-emerald-500/20' : 'hover:bg-slate-800 border border-transparent'}`}>
                         <div className="min-w-0 pr-12 flex-1">
                           {editingWorldId === w.id ? (
                             <input autoFocus type="text" value={editWorldName} onChange={e => setEditWorldName(e.target.value)} onKeyDown={e => handleInlineWorldKeyDown(e, w.id)} onBlur={() => handleInlineWorldSave(w.id)} className="w-full bg-[#05080C] border border-emerald-500/50 text-white text-sm px-2 py-1 rounded outline-none" />
                           ) : (
                             <><p className={`font-bold truncate text-sm ${selectedWorld?.id === w.id ? 'text-emerald-400' : 'text-slate-300 group-hover:text-white'}`}>{w.name}</p><p className="text-[10px] text-slate-500 truncate">{w.genre || 'Sem gênero definido'}</p></>
                           )}
                         </div>
                         {!editingWorldId && selectedWorld?.id === w.id && <Globe className="w-4 h-4 text-emerald-500 shrink-0 opacity-50" />}
                       </div>
                       {!editingWorldId && isGM && ( // Jogadores não podem editar o nome ou deletar o mundo
                         <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-10 bg-[#0B1018] shadow-[-10px_0_10px_#0B1018]">
                           <button onClick={(e) => handleInlineWorldEditStart(e, w)} className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-900 rounded-md transition-colors" title="Editar Nome"><Edit2 className="w-3.5 h-3.5" /></button>
                           <button onClick={(e) => onWorldDeleteClick(e, w.id, w.name)} className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-slate-900 rounded-md transition-colors" title="Excluir Mundo"><Trash2 className="w-3.5 h-3.5" /></button>
                         </div>
                       )}
                    </div>
                  ))}
                </div>
                {isGM && <div className="px-2 pt-2 mt-2 border-t border-slate-800/50"><button onClick={() => { setIsModalOpen(true); setIsWorldDropdownOpen(false); }} className="w-full flex items-center gap-2 justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg text-xs font-bold transition-colors"><Plus className="w-3 h-3 text-emerald-400" /> Criar Novo Mundo</button></div>}
             </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6 custom-scrollbar">
          <p className="text-[10px] font-bold text-slate-500 mb-2 px-3 mt-2 tracking-wider uppercase">Navegação</p>
          <ul className="space-y-0.5">
            {navItemsTop.map((item) => (
              <li key={item.id}><button onClick={() => setActiveView(item.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeView === item.id ? 'bg-slate-800/80 text-white font-medium border border-slate-700/50' : 'hover:bg-slate-900/50 hover:text-white text-slate-400 border border-transparent'}`}><item.icon className="w-4 h-4" /> <span className="flex-1 text-left">{item.label}</span>{item.badge && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded font-medium">{item.badge}</span>}</button></li>
            ))}
            <li className="pt-1 pb-1">
              <div className={`w-full flex items-center rounded-lg text-sm transition-colors ${activeView === 'wiki' ? 'bg-slate-800/80 text-white border border-slate-700/50' : 'hover:bg-slate-900/50 text-slate-400 border border-transparent'}`}>
                <button onClick={() => setActiveView('wiki')} className="flex items-center gap-3 px-3 py-2 flex-1 text-left font-medium"><BookOpen className="w-4 h-4" /> Wiki</button>
                <button onClick={() => setIsWikiOpen(!isWikiOpen)} className="px-3 py-2 hover:bg-slate-700/50 rounded-r-lg text-slate-500 hover:text-white transition-colors">{isWikiOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
              </div>
              {isWikiOpen && (
                <ul className="mt-1 ml-4 pl-4 border-l border-slate-800/50 space-y-0.5">
                  {wikiCategories.map((sub) => (
                    <li key={sub.id}><button onClick={() => setActiveView(sub.id)} className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${activeView === sub.id ? 'bg-emerald-500/10 text-emerald-400 font-medium' : 'hover:bg-slate-900/50 hover:text-white text-slate-400'}`}><sub.icon className="w-4 h-4" /> <span>{sub.label}</span></button></li>
                  ))}
                </ul>
              )}
            </li>
            {navItemsBottom.map((item) => (
              <li key={item.id}><button onClick={() => setActiveView(item.id)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${activeView === item.id ? 'bg-slate-800/80 text-white font-medium border border-slate-700/50' : 'hover:bg-slate-900/50 hover:text-white text-slate-400 border border-transparent'}`}><item.icon className="w-4 h-4" /> <span className="flex-1 text-left">{item.label}</span>{item.badge && <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-medium">{item.badge}</span>}</button></li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#090D14]">
        <header className="h-14 border-b border-slate-800/50 flex items-center justify-between px-6 bg-[#0B1018] z-30 shrink-0 relative">
          <div className="flex items-center gap-4 flex-1">
             <div className="relative max-w-md w-full" ref={searchContainerRef}>
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${debouncedSearch !== searchQuery ? 'text-emerald-500 animate-pulse' : 'text-slate-500'}`} />
              <input 
                type="text" 
                value={searchQuery || ''} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                onFocus={() => { if(debouncedSearch.length >= 2) setIsSearchDropdownOpen(true); }}
                placeholder="Buscar ficheiros visíveis..." 
                className="w-full bg-[#05080C] border border-slate-800/80 text-slate-200 text-sm rounded-lg pl-10 pr-12 py-1.5 focus:outline-none focus:border-emerald-500/50 transition-all placeholder-slate-600" 
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"><X className="w-4 h-4"/></button>}

              {isSearchDropdownOpen && Object.keys(groupedSearchResults).length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-full min-w-[400px] bg-[#0B1018] border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-96 overflow-y-auto custom-scrollbar p-2">
                    {Object.entries(groupedSearchResults).map(([category, items]) => (
                      <div key={category} className="mb-4 last:mb-0">
                        <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2 px-2 border-b border-slate-800/50 pb-1 flex items-center justify-between">
                          {category} <span className="opacity-60">{items.length} {items.length === 1 ? 'resultado' : 'resultados'}</span>
                        </p>
                        <div className="space-y-1">
                          {items.map(char => (
                            <button key={char.id} onClick={() => handleGlobalSearchResultClick(char)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/80 transition-colors text-left group">
                              <div className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                {char.avatar_url && getRevealedFields(char.id).includes('avatar') ? <img src={char.avatar_url} className="w-full h-full object-cover" /> : <Search className="w-4 h-4 text-slate-500" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-sm text-slate-300 group-hover:text-white truncate">{char.name}</p>
                                <p className="text-[10px] text-slate-500 truncate">{char.role || char.category}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isSearchDropdownOpen && debouncedSearch.length >= 2 && Object.keys(groupedSearchResults).length === 0 && (
                <div className="absolute top-full left-0 mt-2 w-full bg-[#0B1018] border border-slate-700 rounded-xl shadow-2xl z-50 p-4 text-center">
                  <p className="text-slate-500 text-sm">Nenhuma entidade visível encontrada para "{debouncedSearch}".</p>
                </div>
              )}

            </div>
          </div>
          <div className="flex items-center gap-4">
             {!isGM && <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-widest"><Shield size={14}/> Jogador</div>}
             <div className="h-8 px-3 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center gap-3">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-300 font-medium hidden sm:block">{session?.user?.email}</span>
                <button onClick={handleLogout} className="text-slate-500 hover:text-rose-400 transition-colors ml-1" title="Sair"><LogOut className="w-4 h-4" /></button>
             </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
          {(() => {
            const shortcutMap: Record<string, string> = { 'fichas': 'personagens', 'bestiario': 'criaturas', 'guildas': 'organizacoes', 'compendio': 'wiki' };
            const resolvedView = shortcutMap[activeView] || activeView;

            if (resolvedView === 'dashboard') {
              if (!selectedWorld) {
                return (
                  <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center justify-center p-8 animate-in fade-in duration-300 relative">
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>
                     <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] border border-emerald-500/20 relative z-10"><Sparkles className="w-8 h-8 text-emerald-400" /></div>
                     <h2 className="text-4xl font-serif text-white mb-4 relative z-10">Bem-vindo ao WorldCraft</h2>
                     <p className="text-slate-400 text-center max-w-md mb-10 text-lg relative z-10">Crie o seu primeiro universo ou aguarde que o Mestre o convide.</p>
                     {isGM && <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 py-3 rounded-lg transition-all relative z-10"><Plus className="w-5 h-5" /> Criar mundo</button>}
                  </div>
                );
              }

              return (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 bg-[#090D14] animate-in fade-in duration-300">
                  <div className="max-w-6xl mx-auto space-y-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <Globe className="w-6 h-6 text-emerald-500" />
                          <span className="text-xs font-bold uppercase tracking-widest text-emerald-500/80">{selectedWorld.genre || 'Mundo Ativo'}</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">{selectedWorld.name}</h1>
                        <p className="text-slate-400 max-w-2xl leading-relaxed">{selectedWorld.description || 'Nenhuma premissa definida.'}</p>
                      </div>
                      {isGM && (
                        <div className="flex items-center gap-3 shrink-0">
                          <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2">
                            <Edit2 size={16} /> Editar Mundo
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-slate-800/50 w-full"></div>

                    {isGM && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-4">Ações Rápidas</p>
                        <div className="flex flex-wrap gap-4">
                          <button onClick={() => { setEntityTypeToCreate(null); setIsEntityModalOpen(true); }} className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"><Plus size={18}/> Nova Entidade</button>
                          <button onClick={() => setActiveView('grafo')} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"><Network size={18}/> Ver Grafo</button>
                          <button onClick={() => setActiveView('cronos')} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"><Clock size={18}/> Linha do Tempo</button>
                          <button onClick={() => setActiveView('ideias')} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all"><Lightbulb size={18}/> Quadro de Ideias</button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2 space-y-6">
                        <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Estatísticas Visíveis</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {Object.entries(wikiCounts).filter(([_, count]) => count > 0).map(([cat, count]) => {
                            const style = getCategoryStyle(cat);
                            const categoryDef = wikiCategories.find(c => c.key === cat);
                            const Icon = categoryDef?.icon || BookOpen;
                            return (
                              <button key={cat} onClick={() => setActiveView(categoryDef?.id || 'wiki')} className={`flex flex-col p-5 rounded-2xl border transition-all text-left group ${style.bg} ${style.border} hover:border-slate-500 shadow-sm`}>
                                <div className="flex justify-between items-start mb-4">
                                  <div className={`p-2 rounded-lg bg-slate-900/50 border border-white/5`}><Icon className={`w-5 h-5 ${style.text}`} /></div>
                                  <span className="text-2xl font-mono font-bold text-white">{count}</span>
                                </div>
                                <span className={`font-bold text-sm ${style.text} uppercase tracking-wider`}>{cat}</span>
                              </button>
                            );
                          })}
                          {Object.entries(wikiCounts).every(([_, count]) => count === 0) && (
                             <div className="col-span-full p-8 border border-dashed border-slate-700 rounded-2xl text-center"><p className="text-slate-500 italic">O seu compêndio está vazio ou os documentos ainda não lhe foram revelados pelo Mestre.</p></div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Atividade Recente</p>
                        <div className="bg-[#0B1018] border border-slate-800 rounded-2xl p-2">
                           {recentActivity.length === 0 ? (
                             <p className="text-slate-500 italic p-6 text-center text-sm">Sem atividade recente.</p>
                           ) : (
                             recentActivity.map((char, idx) => (
                               <div key={char.id} className={`flex items-center gap-4 p-3 hover:bg-slate-800/50 rounded-xl transition-colors cursor-pointer ${idx !== recentActivity.length -1 ? 'border-b border-slate-800/50' : ''}`} onClick={() => { loadCharacterData(char); setActiveView(wikiCategories.find(c => c.key === char.category)?.id || 'personagens'); }}>
                                  <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                                    {char.avatar_url && getRevealedFields(char.id).includes('avatar') ? <img src={char.avatar_url} className="w-full h-full object-cover"/> : <User className="w-5 h-5 m-2.5 text-slate-500"/>}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-sm text-slate-200 truncate">{char.name}</p>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${getCategoryStyle(char.category || '').text}`}>{char.category}</p>
                                  </div>
                                  <div className="shrink-0 text-slate-600"><Clock3 size={14} /></div>
                               </div>
                             ))
                           )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              );
            }

            if (resolvedView === 'wiki') {
              return (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="p-6 md:p-8 animate-in fade-in duration-300 max-w-[1600px] mx-auto w-full">
                    <div className="flex items-start justify-between mb-6">
                        <div><h1 className="text-4xl font-serif font-bold text-white mb-2">Wiki Geral</h1><p className="text-slate-400 text-lg">Enciclopédia Visível</p></div>
                        {isGM && <button onClick={() => { setEntityTypeToCreate(null); setIsEntityModalOpen(true); }} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.3)]"><Plus className="w-5 h-5" /> Nova Entidade</button>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-2 pb-12">
                       {filteredCharacters.map(char => (
                         <div key={char.id} onClick={() => { loadCharacterData(char); setActiveView(wikiCategories.find(c => c.key === char.category)?.id || 'personagens'); }} className="bg-[#0B1018] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 hover:border-slate-600 transition-colors cursor-pointer group">
                            <div className="w-full aspect-[4/5] bg-[#05080C] rounded-xl border border-slate-800/50 flex items-center justify-center overflow-hidden relative">
                               {char.avatar_url && getRevealedFields(char.id).includes('avatar') ? <img src={char.avatar_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <User className="w-8 h-8 text-slate-700" />}
                               <div className={`absolute bottom-3 left-3 border text-[10px] font-medium px-2 py-1 rounded-md backdrop-blur-md ${getCategoryStyle(char.category || 'Personagem').bg} ${getCategoryStyle(char.category || 'Personagem').text} ${getCategoryStyle(char.category || 'Personagem').border}`}>{char.category || 'Personagem'}</div>
                            </div>
                            <h4 className="text-white font-medium text-base truncate">{char.name}</h4>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              );
            }

            // ── 3. FICHA DA ENTIDADE COM CENSURA E NOTAS ──
            const activeWikiCategory = wikiCategories.find(c => c.id === resolvedView);
            if (activeWikiCategory) {
              
              let categoryEntities = filteredCharacters.filter(c => c.category === activeWikiCategory.key || (!c.category && activeWikiCategory.key === 'Personagem'));
              if (activeTagFilter) categoryEntities = categoryEntities.filter(c => c.tags?.includes(activeTagFilter));

              const currentCatStyle = getCategoryStyle(currentCharacterData?.category || activeWikiCategory.key);

              return (
                <div className="absolute inset-0 flex flex-col lg:flex-row p-6 gap-6 animate-in fade-in duration-300 bg-[#090D14]">
                  {/* Lista Lateral */}
                  <div className="w-64 flex flex-col gap-4 shrink-0 bg-[#0B1018] border border-slate-800/80 rounded-2xl p-4 z-20">
                     <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-2">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><activeWikiCategory.icon className={`w-5 h-5 ${getCategoryStyle(activeWikiCategory.key).text}`} /> {activeWikiCategory.label}</h2>
                        {isGM && <button className="text-slate-400 hover:text-white" onClick={() => { setEntityTypeToCreate(activeWikiCategory); setIsEntityModalOpen(true); }}><Plus className="w-4 h-4" /></button>}
                     </div>

                     {activeTagFilter && (
                       <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg mb-2 text-xs font-medium">
                         <span className="flex items-center gap-1.5"><Filter size={12} /> Tag: {activeTagFilter}</span>
                         <button onClick={() => setActiveTagFilter(null)} className="hover:text-emerald-300"><X size={14} /></button>
                       </div>
                     )}

                     <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                        {categoryEntities.length === 0 && <p className="text-xs text-slate-500 text-center mt-4 italic">Nenhum registo encontrado.</p>}
                        {categoryEntities.map(char => {
                          const thisCharRevealed = getRevealedFields(char.id);
                          return (
                            <button 
                              key={char.id} onClick={() => loadCharacterData(char)} 
                              className={`w-full flex flex-col p-2.5 rounded-xl text-left transition-all ${selectedCharacter === char.id ? `${getCategoryStyle(char.category || '').bg} border ${getCategoryStyle(char.category || '').border}` : 'hover:bg-slate-900/80 border border-transparent'}`}
                            >
                                <div className="flex items-start gap-3 w-full mb-2">
                                  <div className={`w-10 h-10 rounded-md bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-slate-700 ${selectedCharacter === char.id ? 'opacity-100' : 'opacity-80'}`}>
                                    {char.avatar_url && thisCharRevealed.includes('avatar') ? <img src={char.avatar_url} className="w-full h-full object-cover" /> : <activeWikiCategory.icon className="w-5 h-5 text-slate-500" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className={`font-bold text-sm truncate ${selectedCharacter === char.id ? getCategoryStyle(char.category || '').text : 'text-slate-200'}`}>{char.name}</h3>
                                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{char.role}</p>
                                  </div>
                                </div>
                                {char.tags && char.tags.length > 0 && thisCharRevealed.includes('tags') && (
                                  <div className="flex flex-wrap gap-1.5 w-full">
                                    {char.tags.slice(0, 2).map(tag => (
                                      <span key={tag} onClick={(e) => { e.stopPropagation(); setActiveTagFilter(activeTagFilter === tag ? null : tag); }} className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${activeTagFilter === tag ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}`}>{tag}</span>
                                    ))}
                                    {char.tags.length > 2 && <span className="text-[9px] px-1.5 py-0.5 rounded border bg-slate-800/50 text-slate-500 border-slate-700/50">+{char.tags.length - 2}</span>}
                                  </div>
                                )}
                            </button>
                          );
                        })}
                     </div>
                  </div>

                  {/* ÁREA DA FICHA */}
                  {selectedCharacter && currentCharacterData?.category === activeWikiCategory.key ? (
                    <div className="flex-1 bg-[#0B1018] border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
                       <div className={`absolute top-0 right-0 w-[500px] h-[300px] rounded-full blur-[150px] pointer-events-none opacity-20 ${currentCatStyle.bg.replace('/10', '')}`}></div>

                       {/* HEADER DA FICHA */}
                       <div className="p-4 border-slate-800 flex items-center justify-between bg-[#0B1018] z-10 flex-wrap gap-4">
                           <div className="flex items-center gap-4 relative">
                             <button className="text-slate-400 hover:text-white" onClick={() => setSelectedCharacter(null)}><ArrowLeft className="w-5 h-5"/></button>
                             <div className="flex flex-col relative">
                               <h2 className="text-2xl font-serif font-bold text-white leading-none flex items-center gap-3">
                                 {currentCharacterData?.name}
                                 {!isGM && !currentCharacterData?.is_public && <span title="Acesso Restrito"><Lock size={16} className="text-slate-500" /></span>}
                               </h2>
                               <div className="flex items-center gap-2 mt-1">
                                 <span className={`text-[9px] font-sans px-1.5 py-0.5 rounded border ${currentCatStyle.bg} ${currentCatStyle.text} ${currentCatStyle.border} uppercase font-bold tracking-widest`}>{currentCharacterData?.category}</span>
                               </div>
                               {toastMessage && <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-xs px-2 py-1 rounded shadow-lg animate-in fade-in slide-in-from-bottom-2">{toastMessage}</div>}
                             </div>
                           </div>

                           <div className="flex items-center gap-2 ml-auto">
                             <button onClick={() => setIsExportModalOpen(true)} className="p-2.5 rounded-lg font-bold text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all border border-transparent shadow-sm" title="Exportar Entidade"><Download className="w-4 h-4"/></button>
                             {isGM && (
                               <>
                                <button onClick={handleDuplicate} className="p-2.5 rounded-lg font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all border border-transparent shadow-sm" title="Duplicar Entidade"><Copy className="w-4 h-4"/></button>
                                <button onClick={onEntityDeleteClick} className="p-2.5 rounded-lg font-bold text-slate-500 hover:text-white hover:bg-rose-600 transition-all border border-transparent shadow-sm" title="Excluir Registos"><Trash2 className="w-4 h-4"/></button>
                                <button onClick={handleSaveCharacterInfo} disabled={isSavingChar} className={`p-2.5 px-4 rounded-lg font-bold flex items-center gap-2 transition-all shadow-md ${currentCatStyle.bg} ${currentCatStyle.text} border ${currentCatStyle.border} hover:brightness-110 disabled:opacity-50`}>{isSavingChar ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} <span className="text-sm hidden md:inline">Gravar</span></button>
                               </>
                             )}
                           </div>
                       </div>
                       
                       {isGM && (
                         <div className="px-4 py-2 border-b border-slate-800/50 bg-[#0B1018] z-10" title={`Em falta:\n${missingScoreItems.join('\n')}`}>
                           <div className="flex items-center gap-3">
                             <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                               <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${completionScore}%` }} />
                             </div>
                             <span className="text-[10px] font-mono text-slate-500 shrink-0">{completionScore}%</span>
                           </div>
                         </div>
                       )}

                       {/* NAVEGAÇÃO DE ABAS */}
                       <div className="flex bg-[#05080C] p-1 rounded-xl border border-slate-800 shadow-inner overflow-x-auto custom-scrollbar m-4 mt-2 z-10">
                         <button onClick={() => setActiveTab('geral')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'geral' ? 'bg-[#1E2532] text-white shadow-sm border border-slate-700/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}><FileText size={14}/> Arquivos {(!isGM && !canViewBio) && <Lock size={12} className="ml-1"/>}</button>
                         <button onClick={() => setActiveTab('atributos')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'atributos' ? 'bg-[#1E2532] text-white shadow-sm border border-slate-700/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}><LayoutGrid size={14}/> Ficha Técnica {(!isGM && !canViewAttributes) && <Lock size={12} className="ml-1"/>}</button>
                         <button onClick={() => setActiveTab('conexoes')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'conexoes' ? 'bg-[#1E2532] text-white shadow-sm border border-slate-700/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}><Share2 size={14}/> Vínculos {(!isGM && !canViewRelations) && <Lock size={12} className="ml-1"/>}</button>
                         {selectedCampaign && <button onClick={() => setActiveTab('mesa')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'mesa' ? 'bg-[#1E2532] text-emerald-400 shadow-sm border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}><Users size={14}/> Notas da Mesa</button>}
                         <button onClick={() => setActiveTab('leitura')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'leitura' ? 'bg-[#1E2532] text-white shadow-sm border border-slate-700/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'}`}><BookOpen size={14}/> Leitura</button>
                       </div>

                       <div className="flex-1 flex overflow-hidden z-10">
                          {/* CONTEÚDO DINÂMICO POR ABAS */}
                          <div className={`flex-1 overflow-y-auto custom-scrollbar bg-[#090D14] ${activeTab === 'leitura' ? '' : 'p-6 md:p-8'}`}>
                              
                              {activeTab === 'geral' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-4xl h-full flex flex-col">
                                  {isGM ? (
                                     <RichTextEditor key={selectedCharacter + '_bio'} initialContent={charBio || ''} onChange={(val) => setCharBio(val)} />
                                  ) : canViewBio ? (
                                     <div className="prose prose-invert prose-emerald max-w-none bg-[#0B1018] p-8 rounded-2xl border border-slate-800" dangerouslySetInnerHTML={{ __html: charBio }} />
                                  ) : (
                                     <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl bg-[#0B1018]">
                                        <Lock size={40} className="text-slate-700 mb-4" />
                                        <h3 className="text-xl font-bold text-slate-500">DADOS CONFIDENCIAIS</h3>
                                        <p className="text-sm text-slate-600 mt-2">O Mestre ainda não revelou estes arquivos para a sua classificação.</p>
                                     </div>
                                  )}
                                </div>
                              )}

                              {activeTab === 'atributos' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-5xl">
                                  {isGM ? (
                                    <>
                                       <div className="space-y-6">
                                          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                            <LayoutGrid className="w-4 h-4 text-slate-500" />
                                            <p className="text-xs font-bold text-white uppercase tracking-widest">Características</p>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {Object.entries(entityAttributes).map(([key, value]) => (
                                              <div key={key} className="bg-[#0B1018] border border-slate-800/80 p-3 rounded-xl focus-within:border-emerald-500/30 transition-colors">
                                                <label className="text-[9px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">{key}</label>
                                                <input type="text" value={value || ''} onChange={(e) => setEntityAttributes({ ...entityAttributes, [key]: e.target.value })} className="w-full bg-transparent text-sm text-white focus:outline-none font-medium" placeholder={`Definir ${key}...`} />
                                              </div>
                                            ))}
                                          </div>
                                       </div>
                                       <div className="space-y-6">
                                          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                                            <Shield className="w-4 h-4 text-slate-500" />
                                            <p className="text-xs font-bold text-white uppercase tracking-widest">Sistema</p>
                                          </div>
                                          <div className="bg-[#0B1018] border border-slate-800/80 rounded-2xl p-5 space-y-5">
                                             <div>
                                                <label className="text-[10px] font-bold text-slate-500 mb-2 block tracking-wider uppercase">Ordem de Exibição na Lista</label>
                                                <input type="number" value={sortOrder || 0} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-full bg-[#05080C] border border-slate-800 text-white rounded-lg px-3 py-2 outline-none focus:border-emerald-500/30 text-sm" />
                                             </div>
                                             <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                                                <div>
                                                  <span className="text-xs font-bold text-white block">Acesso Público</span>
                                                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">Desativa o filtro de censura (todos veem tudo).</span>
                                                </div>
                                                <div onClick={() => setIsPublic(!isPublic)} className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors shadow-inner ${isPublic ? 'bg-emerald-500' : 'bg-slate-700'}`}><div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${isPublic ? 'right-1' : 'left-1'}`}></div></div>
                                             </div>
                                          </div>
                                       </div>
                                    </>
                                  ) : canViewAttributes ? (
                                    <div className="col-span-full">
                                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-6">
                                        <LayoutGrid className="w-4 h-4 text-slate-500" />
                                        <p className="text-xs font-bold text-white uppercase tracking-widest">Características Reveladas</p>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(entityAttributes).map(([key, value]) => (
                                          <div key={key} className="bg-[#0B1018] border border-slate-800/80 p-4 rounded-xl">
                                            <p className="text-[10px] text-emerald-500/70 font-bold mb-1.5 uppercase tracking-wider">{key}</p>
                                            <p className="text-sm text-white font-medium">{value || '—'}</p>
                                          </div>
                                        ))}
                                        {Object.keys(entityAttributes).length === 0 && <p className="text-sm text-slate-500 italic">Sem atributos registados.</p>}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="col-span-full h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl bg-[#0B1018]">
                                        <Lock size={40} className="text-slate-700 mb-4" />
                                        <h3 className="text-xl font-bold text-slate-500">FICHA TÉCNICA BLOQUEADA</h3>
                                    </div>
                                  )}
                                </div>
                              )}

                              {activeTab === 'conexoes' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8 max-w-5xl">
                                  {isGM && (
                                    <div className="bg-[#0B1018] border border-slate-800/80 rounded-2xl p-6">
                                      <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                          <Share2 className="text-emerald-500 w-5 h-5" />
                                        </div>
                                        <div>
                                          <h3 className="text-lg font-bold text-white">Forjar Vínculo</h3>
                                          <p className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">Conecte {currentCharacterData?.name} a outra entidade</p>
                                        </div>
                                      </div>
                                      <div className="flex flex-col md:flex-row gap-4">
                                        <div className="flex-1">
                                          <select value={newRelationTarget} onChange={e => setNewRelationTarget(e.target.value)} className="w-full bg-[#05080C] border border-slate-800 text-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-colors shadow-inner">
                                             <option value="">Selecione a entidade alvo...</option>
                                             {characters.filter(c => c.id !== selectedCharacter).map(c => (
                                               <option key={c.id} value={c.id}>{c.name} — {c.category}</option>
                                             ))}
                                          </select>
                                        </div>
                                        <div className="flex-1">
                                          <input type="text" value={newRelationLabel} onChange={e => setNewRelationLabel(e.target.value)} placeholder="Como se relacionam? (Ex: É mestre de...)" className="w-full bg-[#05080C] border border-slate-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500/50 transition-colors shadow-inner" />
                                        </div>
                                        <button onClick={handleAddRelation} disabled={!newRelationTarget || !newRelationLabel} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl text-sm transition-all disabled:opacity-50 shadow-md shrink-0">
                                           Conectar
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {isGM || canViewRelations ? (
                                    <div>
                                      <div className="flex items-center gap-2 mb-4 border-b border-slate-800/50 pb-2">
                                        <Network className="w-4 h-4 text-slate-500" />
                                        <p className="text-xs font-bold text-white uppercase tracking-widest">Teia de Relações Ativas</p>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                         {relations.length === 0 && <div className="col-span-full py-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">Nenhum vínculo estabelecido ainda.</div>}
                                         {relations.map(rel => {
                                           const isFromMe = rel.from_entity_id === selectedCharacter;
                                           const target = isFromMe ? rel.to_entity : rel.from_entity;
                                           if (!target) return null;
                                           const targetStyle = getCategoryStyle(target.role || 'Personagem');
                                           
                                           // Se for jogador, e o 'target' não estiver visível para ele, ocultamos o nome para manter segredo.
                                           const isTargetVisible = isGM || visibleEntitiesList.some(v => v.id === target.id);

                                           return (
                                             <div key={rel.id} className="flex items-center justify-between p-4 bg-[#0B1018] border border-slate-800/80 hover:border-slate-600 rounded-2xl transition-all group shadow-sm">
                                                <div className="flex items-center gap-4 min-w-0">
                                                   <div className={`w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-[10px] font-bold overflow-hidden border ${targetStyle.border} shrink-0`}>
                                                     {target.avatar_url && isTargetVisible ? <img src={target.avatar_url} className="w-full h-full object-cover"/> : <User className="w-5 h-5 text-slate-500" />}
                                                   </div>
                                                   <div className="min-w-0">
                                                      <p className="text-sm font-bold text-white truncate">{isTargetVisible ? target.name : '??? (Desconhecido)'}</p>
                                                      <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${targetStyle.bg} ${targetStyle.text} ${targetStyle.border}`}>{target.role}</span>
                                                        <span className="text-[10px] text-slate-500 truncate">{rel.relation_label} {isFromMe ? '→' : '←'}</span>
                                                      </div>
                                                   </div>
                                                </div>
                                                {isGM && <button onClick={() => handleRemoveRelation(rel.id)} className="text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition-colors p-2 rounded-lg opacity-0 group-hover:opacity-100 shrink-0 ml-2" title="Cortar Vínculo"><X size={16}/></button>}
                                             </div>
                                           );
                                         })}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="col-span-full h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl bg-[#0B1018]">
                                        <Lock size={40} className="text-slate-700 mb-4" />
                                        <h3 className="text-xl font-bold text-slate-500">VÍNCULOS OCULTOS</h3>
                                    </div>
                                  )}
                                </div>
                              )}

                              {activeTab === 'mesa' && selectedCampaign && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-full max-w-4xl">
                                   <div className="bg-[#0B1018] border border-emerald-500/20 rounded-2xl p-4 mb-6 shadow-sm">
                                      <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                          <Users className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div className="flex-1">
                                          <textarea 
                                            value={newNoteContent} onChange={e => setNewNoteContent(e.target.value)} 
                                            placeholder="Partilhe uma teoria, anote pistas ou faça perguntas à party sobre este sujeito..." 
                                            className="w-full bg-[#05080C] border border-slate-800 text-sm text-white rounded-xl p-3 outline-none focus:border-emerald-500/50 resize-none min-h-[80px]"
                                          />
                                          <div className="flex items-center justify-between mt-3">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                               <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isNotePrivate ? 'bg-amber-500 border-amber-500' : 'bg-slate-800 border-slate-700'}`}>
                                                 {isNotePrivate && <Check size={12} className="text-black" />}
                                               </div>
                                               <span className={`text-xs font-bold uppercase tracking-widest ${isNotePrivate ? 'text-amber-500' : 'text-slate-500 group-hover:text-slate-400'}`}>Nota Privada (Só para mim)</span>
                                            </label>
                                            <button onClick={handleAddNote} disabled={!newNoteContent.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2">
                                              <Send size={14}/> Gravar Nota
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                   </div>

                                   <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                                      {playerNotes.length === 0 && <p className="text-center text-slate-500 text-sm italic py-10">Nenhuma anotação sobre esta entidade ainda.</p>}
                                      {playerNotes.map(note => {
                                        const isMine = note.author_id === session?.user?.id;
                                        // Na fase 2 adicionamos cores aos membros, procuramos o autor:
                                        const authorMember = isGM && isMine ? { display_name: 'Mestre', avatar_color: '#10b981' } : campaignMembers.find(m => m.user_id === note.author_id);
                                        
                                        return (
                                          <div key={note.id} className={`p-4 rounded-xl border relative ${note.is_private ? 'bg-amber-500/5 border-amber-500/20' : 'bg-[#0B1018] border-slate-800'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm" style={{ backgroundColor: authorMember?.avatar_color || '#334155' }}>
                                                  {authorMember?.display_name?.substring(0,2).toUpperCase() || '??'}
                                                </div>
                                                <span className="text-xs font-bold text-slate-300">{authorMember?.display_name || 'Jogador Desconhecido'}</span>
                                                <span className="text-[10px] text-slate-600 font-mono">• {new Date(note.created_at).toLocaleDateString()}</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                {note.is_private && <span className="text-[9px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded uppercase font-bold tracking-widest"><Lock size={8} className="inline mr-1 -mt-0.5"/> Privado</span>}
                                                {(isMine || isGM) && (
                                                  <button onClick={() => deletePlayerNote(note.id, selectedCampaign.id, selectedCharacter)} className="text-slate-600 hover:text-rose-500 transition-colors" title="Apagar Nota"><Trash2 size={14}/></button>
                                                )}
                                              </div>
                                            </div>
                                            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed pl-8">{note.content}</p>
                                          </div>
                                        );
                                      })}
                                   </div>
                                </div>
                              )}

                              {activeTab === 'leitura' && (
                                <div className="animate-in fade-in duration-300 max-w-3xl mx-auto py-8 px-6">
                                  {avatarUrl && canViewAvatar && (
                                    <div className="w-full aspect-video rounded-2xl overflow-hidden mb-8 shadow-2xl border border-slate-800 relative">
                                      <img src={avatarUrl} className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  {!canViewAvatar && !isGM && (
                                     <div className="w-full aspect-video rounded-2xl bg-[#05080C] mb-8 shadow-2xl border-2 border-dashed border-slate-800 flex items-center justify-center">
                                       <div className="text-center"><ImageIcon size={30} className="mx-auto text-slate-700 mb-2"/><p className="text-xs font-bold text-slate-600 uppercase tracking-widest">IMAGEM CONFIDENCIAL</p></div>
                                     </div>
                                  )}
                                  
                                  <div className="mb-10 pb-6 border-b border-slate-800">
                                    <h1 className="text-5xl font-serif text-white mb-4">{currentCharacterData?.name}</h1>
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${currentCatStyle.bg} ${currentCatStyle.text} ${currentCatStyle.border}`}>
                                        {currentCharacterData?.category}
                                      </span>
                                      {canViewTags && entityTags.map(tag => (
                                        <span key={tag} className="text-xs font-medium text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">{tag}</span>
                                      ))}
                                    </div>
                                  </div>

                                  {Object.keys(entityAttributes).length > 0 && canViewAttributes && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                                      {Object.entries(entityAttributes).map(([key, value]) => (
                                        <div key={key} className="bg-[#0B1018] border border-slate-800/80 rounded-xl p-4 shadow-sm">
                                          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1.5">{key}</p>
                                          <p className="text-sm text-white font-medium">{value || '—'}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {canViewBio ? (
                                    <div 
                                      className="prose prose-invert prose-emerald max-w-none prose-headings:font-serif prose-headings:text-white prose-p:text-slate-300 prose-p:leading-relaxed prose-hr:border-slate-800/50"
                                      dangerouslySetInnerHTML={{ __html: charBio }}
                                    />
                                  ) : (
                                    <div className="text-center py-12 border border-slate-800 bg-[#0B1018] rounded-xl"><Lock className="mx-auto text-slate-600 mb-2"/><p className="text-slate-500 text-sm font-medium">Os arquivos biográficos não foram revelados.</p></div>
                                  )}
                                </div>
                              )}
                          </div>

                          {/* PAINEL DIREITO: FOTO E TAGS (Só visível se estiver a editar, ou seja, se for GM) */}
                          {activeTab !== 'leitura' && isGM && (
                            <div className="w-80 border-l border-slate-800 bg-[#0B1018] p-6 flex flex-col gap-8 shrink-0 overflow-y-auto custom-scrollbar z-10">
                                <div>
                                   <div className="flex items-center justify-between mb-3">
                                     <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Registo Visual</p>
                                     {avatarUrl && <button onClick={() => setAvatarUrl(null)} className="text-[10px] text-rose-500 hover:underline uppercase font-bold">Remover</button>}
                                   </div>
                                   <div onClick={() => fileInputRef.current?.click()} className={`w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-700 bg-[#05080C] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all overflow-hidden relative group shadow-inner`}>
                                      <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} />
                                      {isUploading ? <Loader2 className="w-8 h-8 animate-spin text-emerald-500" /> : avatarUrl ? <><img src={avatarUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2"><Camera size={16}/> Trocar</div></> : <><ImageIcon className="w-8 h-8 text-slate-600 mb-3 group-hover:text-emerald-500 transition-colors" /><span className="text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-emerald-500 transition-colors">Fazer Upload</span></>}
                                   </div>
                                </div>
                                <div className="w-full h-px bg-slate-800/50"></div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 tracking-widest mb-4 uppercase">Etiquetas (Tags)</p>
                                  <div className="flex gap-2 mb-4">
                                    <input type="text" value={newTagInput || ''} onChange={(e) => setNewTagInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && newTagInput.trim()) { setEntityTags([...new Set([...entityTags, newTagInput.trim()])]); setNewTagInput(''); } }} placeholder="Adicionar tag..." className="flex-1 bg-[#05080C] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 shadow-inner transition-colors" />
                                    <button onClick={() => { if(newTagInput.trim()) { setEntityTags([...new Set([...entityTags, newTagInput.trim()])]); setNewTagInput(''); } }} className="px-3 py-2 bg-slate-800 hover:bg-emerald-600 text-white rounded-xl transition-colors shadow-sm"><Plus size={16}/></button>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {entityTags.length === 0 && <span className="text-xs text-slate-600 italic">Nenhuma tag definida.</span>}
                                    {entityTags.map(tag => (
                                      <span key={tag} className="bg-slate-900 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700/50 flex items-center gap-1.5 shadow-sm font-medium">{tag} <X className="w-3.5 h-3.5 cursor-pointer text-slate-500 hover:text-rose-400 transition-colors" onClick={() => setEntityTags(entityTags.filter(t => t !== tag))} /></span>
                                    ))}
                                  </div>
                                </div>
                            </div>
                          )}
                       </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border border-slate-800/30 rounded-3xl bg-slate-900/10 shadow-inner m-4">
                      <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 text-slate-600 border border-slate-700"><BookOpen size={24}/></div>
                      <p className="text-slate-400 font-medium">Selecione um registo na biblioteca para visualizar.</p>
                    </div>
                  )}
                </div>
              );
            }

            if (resolvedView === 'grafo') return <WorldGraph />;
            if (resolvedView === 'arquivos') return <FileManager />;
            if (resolvedView === 'evidencias') return <EvidenceBoard />;
            if (resolvedView === 'campanhas') return <CampaignManager />; 
            if (resolvedView === 'ideias') return <IdeaBoard />;
            if (resolvedView === 'cronos') return <Timeline />;
            if (resolvedView === 'notas') return <QuickNotes />;

            const pendingModules: Record<string, any> = {
              'cartografia': { title: 'Cartografia Mapeada', icon: Map, desc: 'Criação de mapas com marcações de entidades.' },
              'mesa': { title: 'Mesa Virtual (VTT)', icon: MonitorPlay, desc: 'Grid tático, rolagem de dados e iniciativa.' },
              'calendario': { title: 'Calendário Cósmico', icon: Calendar, desc: 'Dias, luas e eventos celestes.' },
            };
            const pending = pendingModules[resolvedView];
            if (pending) {
              return (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 animate-in fade-in duration-300 bg-[#090D14]">
                   <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-lg z-10"><pending.icon className="w-10 h-10 text-emerald-500" /></div>
                   <h2 className="text-3xl font-serif text-white mb-3 z-10">{pending.title}</h2>
                   <p className="text-slate-400 text-center max-w-md mb-8 z-10">{pending.desc}</p>
                   <button className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-semibold px-6 py-2.5 rounded-lg z-10 flex items-center gap-2"><Wand2 className="w-4 h-4 text-emerald-500"/> Módulo em Construção</button>
                </div>
              );
            }

            return null;
          })()}
        </div>
      </main>

      <CreateWorldModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <CreateEntityModal isOpen={isEntityModalOpen} onClose={() => setIsEntityModalOpen(false)} defaultType={entityTypeToCreate} />
      <ExportEntityModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} entity={currentCharacterData} world={selectedWorld} bioHtml={charBio} />
      
      <ConfirmModal 
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        onConfirm={confirmModalConfig.action}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
        confirmVariant="danger"
        confirmLabel="Excluir"
        isLoading={confirmModalConfig.isLoading}
      />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #1e293b; border-radius: 20px; border: 2px solid #090D14; } 
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #334155; }
      `}} />
    </div>
  );
}