'use client';

import React, { useState } from 'react';
import { useWorldContext, ICampaignMember } from '../app/context/WorldContext';
import { Shield, Eye, EyeOff, Check, Search, Lock } from 'lucide-react';

const CENSORABLE_FIELDS = [
  { id: 'biography', label: 'Biografia / Lore' },
  { id: 'attributes', label: 'Ficha Técnica' },
  { id: 'avatar', label: 'Registo Visual (Capa)' },
  { id: 'tags', label: 'Etiquetas' },
  { id: 'relations', label: 'Vínculos' }
];

export default function PlayerAccessPanel() {
  const { characters, selectedCampaign, campaignMembers, entityPermissions, updateEntityPermission } = useWorldContext();
  const [selectedMember, setSelectedMember] = useState<ICampaignMember | null>(campaignMembers[0] || null);
  const [search, setSearch] = useState('');

  if (!selectedCampaign) return <div className="p-6 text-slate-500 italic bg-[#0B1018] h-full">Crie uma campanha primeiro.</div>;

  const handleToggleVisibility = async (entityId: string, currentCanView: boolean, currentFields: string[]) => {
    if (!selectedMember) return;
    await updateEntityPermission(selectedCampaign.id, entityId, selectedMember.id, !currentCanView, currentFields);
  };

  const handleToggleField = async (entityId: string, currentCanView: boolean, currentFields: string[], fieldToToggle: string) => {
    if (!selectedMember) return;
    const newFields = currentFields.includes(fieldToToggle) 
      ? currentFields.filter(f => f !== fieldToToggle)
      : [...currentFields, fieldToToggle];
    await updateEntityPermission(selectedCampaign.id, entityId, selectedMember.id, currentCanView, newFields);
  };

  const filteredChars = characters.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-[#0B1018] border-l border-slate-800 w-[400px] shrink-0 absolute right-0 top-0 bottom-0 z-50 shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="p-5 border-b border-slate-800 bg-[#090D14]">
        <h3 className="text-white font-bold flex items-center gap-2 mb-4"><Shield className="text-emerald-500" size={18}/> Acesso de Jogadores</h3>
        
        <select 
          value={selectedMember?.id || ''} 
          onChange={e => setSelectedMember(campaignMembers.find(m => m.id === e.target.value) || null)}
          className="w-full bg-[#05080C] border border-slate-700 text-white text-sm px-3 py-2 rounded-lg outline-none focus:border-emerald-500/50"
        >
          {campaignMembers.length === 0 && <option value="">Sem jogadores na mesa</option>}
          {campaignMembers.map(m => (
            <option key={m.id} value={m.id}>{m.display_name} ({m.role})</option>
          ))}
        </select>
      </div>

      <div className="p-4 border-b border-slate-800 bg-[#0B1018]">
         <div className="relative">
           <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
           <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar entidade..." className="w-full bg-[#05080C] border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-4 py-2 outline-none focus:border-emerald-500/50" />
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {!selectedMember && <p className="text-xs text-slate-500 text-center mt-10">Selecione um jogador acima para gerir permissões.</p>}
        
        {selectedMember && filteredChars.map(char => {
          const perm = entityPermissions.find(p => p.entity_id === char.id && p.member_id === selectedMember.id);
          const canView = perm?.can_view || false;
          const revealedFields = perm?.revealed_fields || [];

          return (
            <div key={char.id} className={`p-4 rounded-xl border transition-all ${canView ? 'bg-slate-900 border-slate-700' : 'bg-[#05080C] border-slate-800/50 opacity-80'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-bold text-sm text-white truncate">{char.name}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest truncate">{char.category}</p>
                </div>
                <button 
                  onClick={() => handleToggleVisibility(char.id, canView, revealedFields)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${canView ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {canView ? <><Eye size={14}/> Visível</> : <><EyeOff size={14}/> Oculto</>}
                </button>
              </div>

              {canView && (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Lock size={10}/> Desbloquear Dados do Dossiê</p>
                  {CENSORABLE_FIELDS.map(field => {
                    const isRevealed = revealedFields.includes(field.id);
                    return (
                      <label key={field.id} className="flex items-center gap-2 cursor-pointer group">
                         <div onClick={() => handleToggleField(char.id, canView, revealedFields, field.id)} className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${isRevealed ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-900 border-slate-600 group-hover:border-slate-400'}`}>
                           {isRevealed && <Check size={12} className="text-[#090D14]"/>}
                         </div>
                         <span className={`text-xs ${isRevealed ? 'text-slate-300' : 'text-slate-500'}`}>{field.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}