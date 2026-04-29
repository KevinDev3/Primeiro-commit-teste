'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X, User, Loader2, ArrowRight, ArrowLeft, Link2, Search, ChevronDown } from 'lucide-react';
import { useWorldContext, IRelation } from '../app/context/WorldContext';

const RELATION_SUGGESTIONS = [
  'pertence a', 'governa', 'serve', 'é aliado de', 'é inimigo de',
  'criou', 'foi criado por', 'protege', 'traiu', 'conhece',
  'é lar de', 'foi forjado por', 'pertence ao panteão de',
  'é filho(a) de', 'lidera', 'é membro de',
];

export default function RelationsPanel() {
  const { selectedCharacter, characters, fetchRelations, createRelation, deleteRelation } = useWorldContext();
  
  const [relations, setRelations] = useState<IRelation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [targetId, setTargetId] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!selectedCharacter) return;
    setIsLoading(true);
    fetchRelations(selectedCharacter).then(setRelations).finally(() => setIsLoading(false));
  }, [selectedCharacter, fetchRelations]);

  const handleCreate = async () => {
    if (!label.trim() || !targetId || !selectedCharacter) return;
    setIsCreating(true);
    try {
      await createRelation(selectedCharacter, targetId, label.trim());
      const updated = await fetchRelations(selectedCharacter);
      setRelations(updated);
      setLabel('');
      setTargetId('');
      setDescription('');
      setShowForm(false);
    } catch (err: any) { alert('Erro: ' + err.message); } finally { setIsCreating(false); }
  };

  const handleDelete = async (id: string) => {
    setRelations(prev => prev.filter(r => r.id !== id));
    try { await deleteRelation(id); } catch (err) { alert('Erro ao remover.'); fetchRelations(selectedCharacter!).then(setRelations); }
  };

  if (!selectedCharacter) return null;

  const otherEntities = characters.filter(c => c.id !== selectedCharacter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowForm(!showForm)}>
        <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-2"><Link2 className="w-4 h-4" /> Conexões</p>
        <button className="text-slate-500 hover:text-emerald-400 transition-colors">{showForm ? <ChevronDown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-emerald-500" /></div>
      ) : relations.length === 0 && !showForm ? (
        <div className="border border-slate-800 border-dashed rounded-xl p-4 text-center"><p className="text-sm text-slate-500">Nenhuma conexão ainda</p></div>
      ) : (
        <div className="flex flex-col gap-2">
          {relations.map(rel => {
            const isOutgoing = rel.from_entity_id === selectedCharacter;
            const linkedEntity = isOutgoing ? rel.to_entity : rel.from_entity;
            if (!linkedEntity) return null;

            return (
              <div key={rel.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#090D14] border border-slate-800/50 relative group transition-colors hover:border-slate-700">
                <div className="w-8 h-8 rounded-lg bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                  {linkedEntity.avatar_url ? <img src={linkedEntity.avatar_url} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-slate-500" />}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h4 className="text-sm font-medium text-slate-200 truncate">{linkedEntity.name}</h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isOutgoing ? <ArrowRight className="w-3 h-3 text-emerald-500" /> : <ArrowLeft className="w-3 h-3 text-amber-500" />}
                    <span className={`text-xs truncate ${isOutgoing ? 'text-emerald-400' : 'text-amber-400'}`}>{rel.relation_label}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(rel.id)} className="absolute right-2 top-2 p-1.5 rounded-md bg-rose-500/10 text-rose-400 opacity-0 group-hover:opacity-100 hover:bg-rose-500/20"><X className="w-3 h-3" /></button>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 animate-in fade-in flex flex-col gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full bg-[#090D14] border border-slate-800 text-slate-300 text-sm rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-emerald-500/50 appearance-none">
              <option value="" disabled>Buscar entidade...</option>
              {otherEntities.map(ent => <option key={ent.id} value={ent.id}>{ent.name} ({ent.category})</option>)}
            </select>
          </div>
          <div>
            <input list="relation-suggestions" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Tipo de relação..." className="w-full bg-[#090D14] border border-slate-800 text-slate-300 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500/50" />
            <datalist id="relation-suggestions">{RELATION_SUGGESTIONS.map(sug => <option key={sug} value={sug} />)}</datalist>
          </div>
          <button onClick={handleCreate} disabled={isCreating || !targetId || !label.trim()} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-sm transition-all disabled:opacity-50">
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar Conexão'}
          </button>
        </div>
      )}
    </div>
  );
}