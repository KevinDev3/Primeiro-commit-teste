'use client';

import React, { useState } from 'react';
import { User, ImageIcon, Loader2, Save, CheckCircle2, Network, Plus, Users, LayoutGrid, Tags, X, ChevronDown } from 'lucide-react';
import { useWorldContext } from '../app/context/WorldContext';
import RichTextEditor from './RichTextEditor';
import RelationsPanel from './RelationsPanel';

export default function EntitySheet() {
  const {
    selectedCharacter, currentCharacterData, charBio, setCharBio,
    avatarUrl, handleAvatarUpload, isUploading, fileInputRef,
    entityAttributes, setEntityAttributes, entityTags, setEntityTags,
    isPublic, setIsPublic, sortOrder, setSortOrder,
    handleSaveCharacterInfo, isSavingChar
  } = useWorldContext();

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const handleSave = async () => {
    await handleSaveCharacterInfo();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleUpdateAttribute = (key: string, value: string) => setEntityAttributes({ ...entityAttributes, [key]: value });
  const handleAddCustomAttribute = () => { const keyName = prompt('Nome do novo atributo (ex: Facção, Fraqueza):'); if (keyName) setEntityAttributes({ ...entityAttributes, [keyName]: '' }); };
  const handleAddTag = () => { if (newTagInput.trim()) { setEntityTags([...entityTags, newTagInput.trim()]); setNewTagInput(''); }};
  const handleRemoveTag = (t: string) => setEntityTags(entityTags.filter(tag => tag !== t));

  if (!selectedCharacter) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border border-slate-800/50 rounded-2xl bg-slate-900/10 gap-4">
        <User className="w-12 h-12 text-slate-700" />
        <p className="text-slate-500 text-sm">Selecione uma entidade na lateral.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0B1018] border border-slate-800/80 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#0B1018]">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-serif font-bold text-white">{currentCharacterData?.name}</h2>
          <span className="bg-emerald-500/10 px-2 py-0.5 rounded text-xs text-emerald-400 border border-emerald-500/20">
            {currentCharacterData?.category || 'Personagem'}
          </span>
        </div>
        <button
          onClick={handleSave} disabled={isSavingChar}
          className={`flex items-center gap-2 font-semibold px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50 ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'}`}
        >
          {isSavingChar ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar Ficha</>}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Tiptap */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#090D14]">
          <RichTextEditor key={selectedCharacter} initialContent={charBio} onChange={setCharBio} />
        </div>

        {/* Right Sidebar (Atributos, Imagem, Conexões) */}
        <div className="w-80 border-l border-slate-800 bg-[#0B1018] overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6">
          
          {/* IMAGEM DE CAPA */}
          <div>
             <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-2 uppercase flex items-center gap-1"><ImageIcon className="w-3 h-3"/> Capa da Entidade</p>
             <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video rounded-xl border-2 border-dashed border-slate-700 bg-[#090D14] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-all overflow-hidden relative group">
                <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleAvatarUpload} />
                {isUploading ? <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /> : avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover group-hover:opacity-50" /> : <><ImageIcon className="w-6 h-6 text-slate-500 mb-2" /><span className="text-xs text-slate-500 text-center px-4">Arraste uma imagem ou clique</span></>}
             </div>
          </div>

          <div className="w-full h-px bg-slate-800/50"></div>

          {/* ATRIBUTOS DINÂMICOS */}
          <div>
             <div className="flex items-center justify-between mb-4">
               <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-2"><LayoutGrid className="w-4 h-4"/> Atributos</p>
               <button onClick={handleAddCustomAttribute} className="text-slate-500 hover:text-emerald-400"><Plus className="w-4 h-4" /></button>
             </div>
             <div className="space-y-3">
               {Object.entries(entityAttributes).length === 0 && <p className="text-xs text-slate-500 italic">Sem atributos.</p>}
               {Object.entries(entityAttributes).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-[11px] font-bold text-slate-400 mb-1 block uppercase">{key}</label>
                    <input type="text" value={value} onChange={(e) => handleUpdateAttribute(key, e.target.value)} className="w-full bg-[#090D14] border border-slate-800 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50" />
                  </div>
               ))}
             </div>
          </div>

          {/* TAGS */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 tracking-wider mb-3 uppercase flex items-center gap-1"><Tags className="w-3 h-3"/> Tags</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {entityTags.map(tag => (
                <span key={tag} className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-md flex items-center gap-1 border border-slate-700">{tag} <X className="w-3 h-3 cursor-pointer hover:text-rose-400" onClick={() => handleRemoveTag(tag)} /></span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newTagInput} onChange={(e) => setNewTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTag()} placeholder="Nova tag..." className="flex-1 bg-[#090D14] border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
              <button onClick={handleAddTag} className="bg-emerald-500/10 text-emerald-400 px-2 py-1.5 rounded-lg border border-emerald-500/20"><Plus className="w-4 h-4"/></button>
            </div>
          </div>

          <div className="w-full h-px bg-slate-800/50"></div>

          {/* RELAÇÕES (Componente Isolado) */}
          <div className="pb-4">
            <RelationsPanel />
          </div>

          <div className="w-full h-px bg-slate-800/50"></div>

          {/* PUBLICAÇÃO */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 tracking-wider mb-4 flex items-center gap-2"><Network className="w-4 h-4"/> Publicação</p>
            <div className="flex items-center justify-between mb-4">
               <div><p className="text-sm font-medium text-white">Wiki Pública</p><p className="text-[10px] text-slate-500">Permitir leitura por jogadores</p></div>
               <div onClick={() => setIsPublic(!isPublic)} className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${isPublic ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'}`}>
                 <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${isPublic ? 'right-0.5 bg-white' : 'left-0.5 bg-slate-500'}`}></div>
               </div>
            </div>
            <div>
               <p className="text-xs font-bold text-slate-400 mb-1">Ordem (Sort)</p>
               <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-full bg-[#090D14] border border-slate-800 text-white rounded p-2 text-sm outline-none focus:border-emerald-500"/>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}