'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useWorldContext } from '../app/context/WorldContext';
import { Loader2, Clock, Plus, X, ArrowUp, ArrowDown } from 'lucide-react';

type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  description: string;
  color: string;
};

const COLORS = ['emerald', 'rose', 'sky', 'amber', 'purple'];

export default function Timeline() {
  const { selectedWorld } = useWorldContext();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!selectedWorld) return;
    const loadTimeline = async () => {
      setLoading(true);
      const { data } = await supabase.from('world_timeline').select('events_data').eq('world_id', selectedWorld.id).single();
      if (data?.events_data) setEvents(data.events_data as TimelineEvent[]);
      setLoading(false);
      isFirstLoad.current = false;
    };
    loadTimeline();
  }, [selectedWorld]);

  useEffect(() => {
    if (isFirstLoad.current || !selectedWorld) return;
    const timeoutId = setTimeout(async () => {
      setIsSaving(true);
      await supabase.from('world_timeline').upsert({ world_id: selectedWorld.id, events_data: events, updated_at: new Date().toISOString() });
      setIsSaving(false);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [events, selectedWorld]);

  const addEvent = () => {
    const newEvent: TimelineEvent = { id: Date.now().toString(), date: 'Nova Era', title: 'Título do Evento', description: 'Descreva o que aconteceu...', color: COLORS[Math.floor(Math.random() * COLORS.length)] };
    setEvents([...events, newEvent]);
  };

  const updateEvent = (id: string, field: keyof TimelineEvent, value: string) => {
    setEvents(events.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeEvent = (id: string) => {
    if(window.confirm('Excluir este evento histórico?')) setEvents(events.filter(e => e.id !== id));
  };

  const moveEvent = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === events.length - 1)) return;
    const newEvents = [...events];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newEvents[index], newEvents[targetIndex]] = [newEvents[targetIndex], newEvents[index]];
    setEvents(newEvents);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-[#090D14]"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="flex-1 h-full w-full overflow-y-auto custom-scrollbar flex flex-col bg-[#090D14] p-6 md:p-10 animate-in fade-in">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex items-start justify-between mb-12">
          <div>
            <h1 className="text-4xl font-serif font-bold text-white mb-2 flex items-center gap-3">
              <Clock className="w-8 h-8 text-sky-400" /> Cronos
            </h1>
            <p className="text-slate-400 text-lg">Os Anais da História de {selectedWorld?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            {isSaving && <span className="text-xs text-sky-400 flex items-center gap-2 font-mono"><Loader2 className="w-4 h-4 animate-spin"/> Registrando...</span>}
            <button onClick={addEvent} className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-all">
              <Plus className="w-5 h-5" /> Adicionar Evento
            </button>
          </div>
        </div>

        <div className="relative border-l-2 border-slate-800 ml-4 md:ml-6 space-y-12 pb-20">
          {events.length === 0 && <p className="text-slate-500 italic ml-8">Nenhum evento registrado. O tempo aguarda as suas lendas.</p>}
          
          {events.map((ev, index) => (
            <div key={ev.id} className="relative pl-8 md:pl-12 group">
              {/* O Nó na Linha do Tempo */}
              <div className={`absolute -left-[11px] top-1.5 w-5 h-5 rounded-full border-4 border-[#090D14] shadow-[0_0_10px_currentColor] bg-${ev.color}-500 text-${ev.color}-500 transition-transform group-hover:scale-125`}></div>
              
              <div className="bg-[#0B1018] border border-slate-800 rounded-2xl p-5 shadow-lg relative transition-all group-hover:border-slate-600">
                 
                 {/* Ações (Aparecem no Hover) */}
                 <div className="absolute -right-4 -top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 rounded-lg p-1 border border-slate-700 shadow-xl">
                    <button onClick={() => moveEvent(index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ArrowUp size={16}/></button>
                    <button onClick={() => moveEvent(index, 'down')} disabled={index === events.length - 1} className="p-1 text-slate-400 hover:text-white disabled:opacity-30"><ArrowDown size={16}/></button>
                    <div className="w-px bg-slate-700 mx-1"></div>
                    <button onClick={() => removeEvent(ev.id)} className="p-1 text-rose-500 hover:text-rose-400"><X size={16}/></button>
                 </div>

                 <div className="flex flex-col gap-3">
                   <div className="flex items-center gap-4">
                     <input type="text" value={ev.date} onChange={e => updateEvent(ev.id, 'date', e.target.value)} className={`bg-transparent border-b border-transparent hover:border-${ev.color}-500/50 focus:border-${ev.color}-500 text-${ev.color}-400 font-mono font-bold w-32 outline-none transition-colors`} placeholder="Ano / Era" />
                     <input type="text" value={ev.title} onChange={e => updateEvent(ev.id, 'title', e.target.value)} className="bg-transparent border-b border-transparent hover:border-slate-600 focus:border-slate-500 text-white font-serif text-xl font-bold flex-1 outline-none transition-colors" placeholder="Nome do Evento" />
                   </div>
                   <textarea value={ev.description} onChange={e => updateEvent(ev.id, 'description', e.target.value)} className="w-full bg-transparent text-slate-400 text-sm outline-none resize-none min-h-[60px]" placeholder="Descreva os detalhes deste momento histórico..." />
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}