'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useWorldContext } from '../app/context/WorldContext';
import { Loader2, Plus, X, Lightbulb, ChevronLeft, ChevronRight, Save } from 'lucide-react';

type Card = { id: string; content: string; };
type Column = { id: string; title: string; cards: Card[]; };

export default function IdeaBoard() {
  const { selectedWorld } = useWorldContext();
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!selectedWorld) return;
    const loadBoard = async () => {
      setLoading(true);
      const { data } = await supabase.from('world_kanban').select('board_data').eq('world_id', selectedWorld.id).single();
      
      if (data?.board_data && (data.board_data as Column[]).length > 0) {
        setColumns(data.board_data as Column[]);
      } else {
        // Colunas Iniciais Padrão
        setColumns([
          { id: 'col-1', title: 'Ideias Brutas', cards: [] },
          { id: 'col-2', title: 'Ganchos de Campanha', cards: [] },
          { id: 'col-3', title: 'Lore a Desenvolver', cards: [] },
          { id: 'col-4', title: 'Concluído', cards: [] }
        ]);
      }
      setLoading(false);
      isFirstLoad.current = false;
    };
    loadBoard();
  }, [selectedWorld]);

  // Auto-Save com Debounce
  useEffect(() => {
    if (isFirstLoad.current || !selectedWorld) return;
    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      await supabase.from('world_kanban').upsert({ world_id: selectedWorld.id, board_data: columns, updated_at: new Date().toISOString() });
      setIsSaving(false);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [columns, selectedWorld]);

  const addColumn = () => {
    const title = prompt('Nome da nova coluna:');
    if (title) setColumns([...columns, { id: Date.now().toString(), title, cards: [] }]);
  };

  const removeColumn = (colId: string) => {
    if (window.confirm('Excluir esta coluna e todos os seus cartões?')) {
      setColumns(columns.filter(c => c.id !== colId));
    }
  };

  const addCard = (colId: string) => {
    setColumns(columns.map(c => c.id === colId ? { ...c, cards: [...c.cards, { id: Date.now().toString(), content: '' }] } : c));
  };

  const updateCard = (colId: string, cardId: string, content: string) => {
    setColumns(columns.map(c => c.id === colId ? { ...c, cards: c.cards.map(card => card.id === cardId ? { ...card, content } : card) } : c));
  };

  const removeCard = (colId: string, cardId: string) => {
    setColumns(columns.map(c => c.id === colId ? { ...c, cards: c.cards.filter(card => card.id !== cardId) } : c));
  };

  const moveCard = (colId: string, cardId: string, direction: 'left' | 'right') => {
    const colIndex = columns.findIndex(c => c.id === colId);
    if ((direction === 'left' && colIndex === 0) || (direction === 'right' && colIndex === columns.length - 1)) return;

    const targetColIndex = direction === 'left' ? colIndex - 1 : colIndex + 1;
    const cardToMove = columns[colIndex].cards.find(c => c.id === cardId);
    if (!cardToMove) return;

    const newColumns = [...columns];
    newColumns[colIndex].cards = newColumns[colIndex].cards.filter(c => c.id !== cardId);
    newColumns[targetColIndex].cards.push(cardToMove);
    setColumns(newColumns);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-[#090D14]"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /></div>;

  return (
    <div className="flex-1 h-full w-full overflow-hidden flex flex-col bg-[#090D14] p-6 animate-in fade-in">
      <div className="flex items-start justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-serif font-bold text-white mb-2 flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-amber-400" /> Quadro de Ideias
          </h1>
          <p className="text-slate-400 text-lg">Brainstorming e organização de campanhas de {selectedWorld?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          {isSaving && <span className="text-xs text-amber-400 flex items-center gap-2 font-mono"><Loader2 className="w-4 h-4 animate-spin"/> Guardando...</span>}
          <button onClick={addColumn} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all">
            <Plus className="w-5 h-5" /> Nova Coluna
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar flex gap-6 pb-4 items-start">
        {columns.map((col, colIndex) => (
          <div key={col.id} className="w-80 shrink-0 bg-[#0B1018] border border-slate-800 rounded-2xl flex flex-col max-h-full">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0D121B] rounded-t-2xl">
               <h3 className="font-bold text-slate-200 uppercase tracking-wider text-sm">{col.title} <span className="text-slate-600 ml-1">({col.cards.length})</span></h3>
               <button onClick={() => removeColumn(col.id)} className="text-slate-600 hover:text-rose-400"><X size={16}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
               {col.cards.map(card => (
                 <div key={card.id} className="bg-[#131923] border border-slate-700/50 hover:border-amber-500/30 rounded-xl p-3 shadow-lg group transition-all">
                    <textarea 
                      value={card.content} 
                      onChange={(e) => updateCard(col.id, card.id, e.target.value)}
                      placeholder="Descreva a sua ideia..."
                      className="w-full bg-transparent resize-none outline-none text-sm text-slate-300 min-h-[80px]"
                    />
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/50">
                       <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveCard(col.id, card.id, 'left')} disabled={colIndex === 0} className="p-1 text-slate-500 hover:text-amber-400 disabled:opacity-30"><ChevronLeft size={16}/></button>
                          <button onClick={() => moveCard(col.id, card.id, 'right')} disabled={colIndex === columns.length - 1} className="p-1 text-slate-500 hover:text-amber-400 disabled:opacity-30"><ChevronRight size={16}/></button>
                       </div>
                       <button onClick={() => removeCard(col.id, card.id)} className="text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                    </div>
                 </div>
               ))}
               <button onClick={() => addCard(col.id)} className="w-full py-3 border-2 border-dashed border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/5 text-slate-500 hover:text-amber-400 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all">
                 <Plus size={16}/> Adicionar Cartão
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}