'use client';

import React, { useState } from 'react';
import { X, Wand2, Loader2, BookOpen, Globe } from 'lucide-react';
import { useWorldContext } from '../../app/context/WorldContext';

interface CreateWorldModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GENRES = [
  'Fantasia Medieval', 'Sci-Fi / Espaço', 'Cyberpunk', 
  'Horror Cósmico', 'Mundo Moderno', 'Pós-Apocalíptico', 'Outro'
];

export default function CreateWorldModal({ isOpen, onClose }: CreateWorldModalProps) {
  const { handleCreateWorld } = useWorldContext();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('Fantasia Medieval');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await handleCreateWorld(name, description, genre);
      setName('');
      setDescription('');
      setGenre('Fantasia Medieval');
      onClose();
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#05080c]/90 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-[#0B1018] border border-slate-800 rounded-2xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Glow de Fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-[60px] pointer-events-none"></div>

        <div className="p-6 relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-serif text-white flex items-center gap-3 font-bold">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center">
                <Globe className="w-5 h-5 text-emerald-400" />
              </div>
              Forjar Novo Mundo
            </h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2 block">Nome do Universo</label>
              <input
                type="text" required autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: O Grande Império de Valdran..."
                className="w-full bg-[#05080c] border border-slate-800 focus:border-emerald-500/50 text-white text-lg rounded-xl px-4 py-3 focus:outline-none transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2 block">Gênero Principal</label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map(g => (
                  <button
                    key={g} type="button" onClick={() => setGenre(g)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${genre === g ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-300'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2 flex items-center gap-2"><BookOpen className="w-3 h-3"/> Premissa / Sinopse (Opcional)</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Um mundo onde a magia foi banida e a tecnologia a vapor domina..."
                className="w-full bg-[#05080c] border border-slate-800 focus:border-emerald-500/50 text-slate-300 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all shadow-inner min-h-[100px] resize-none custom-scrollbar"
              />
            </div>

            <button
              type="submit" disabled={isLoading || !name.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_5px_20px_rgba(16,185,129,0.2)] disabled:opacity-50 hover:-translate-y-0.5"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Wand2 className="w-5 h-5" /> Conjurar Universo</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}