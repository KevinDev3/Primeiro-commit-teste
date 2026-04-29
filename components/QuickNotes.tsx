'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useWorldContext } from '../app/context/WorldContext';
import { Loader2, StickyNote, Trash2 } from 'lucide-react';
import ConfirmModal from './Modals/ConfirmModal';

export default function QuickNotes() {
  const { selectedWorld } = useWorldContext();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isFirstLoad = useRef(true);

  // Carregar dados iniciais
  useEffect(() => {
    if (!selectedWorld) return;
    const fetchNotes = async () => {
      setLoading(true);
      const { data } = await supabase.from('world_notes').select('content').eq('world_id', selectedWorld.id).single();
      if (data) setContent(data.content || '');
      else setContent('');
      setLoading(false);
      isFirstLoad.current = false;
    };
    fetchNotes();
  }, [selectedWorld]);

  // Auto-save com debounce de 1500ms
  useEffect(() => {
    if (isFirstLoad.current || !selectedWorld) return;
    
    setStatus('saving');
    const timer = setTimeout(async () => {
      await supabase.from('world_notes').upsert({ 
        world_id: selectedWorld.id, 
        content,
        updated_at: new Date().toISOString()
      });
      setStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1500);

    return () => clearTimeout(timer);
  }, [content, selectedWorld]);

  const handleClear = async () => {
    setContent('');
    setIsConfirmOpen(false);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-[#090D14]"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>;

  return (
    <div className="flex-1 h-full w-full overflow-hidden flex flex-col bg-[#090D14] p-6 animate-in fade-in">
      <div className="flex items-start justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-4xl font-serif font-bold text-white mb-2 flex items-center gap-3">
            <StickyNote className="w-8 h-8 text-emerald-500" /> Grimório
          </h1>
          <p className="text-slate-400 text-lg">Anotações confidenciais do mestre para {selectedWorld?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
             {status === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-emerald-500"/> Guardando...</>}
             {status === 'saved' && <span className="text-emerald-500">Guardado às {lastSavedTime}</span>}
          </div>
          <button onClick={() => setIsConfirmOpen(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 font-semibold px-4 py-2 rounded-lg transition-all">
            <Trash2 className="w-4 h-4" /> Limpar Notas
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#0B1018] border border-slate-800 rounded-2xl p-6 shadow-inner flex flex-col relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Este espaço é só seu. Anote ideias, ganchos, lembretes, segredos que só o mestre sabe..."
          className="flex-1 w-full bg-transparent resize-none outline-none font-mono text-slate-300 text-sm leading-relaxed custom-scrollbar"
        />
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleClear}
        title="Limpar Grimório"
        message="Tem a certeza que deseja apagar todas as anotações deste mundo? Esta ação não pode ser desfeita."
        confirmVariant="danger"
        confirmLabel="Apagar Tudo"
      />
    </div>
  );
}