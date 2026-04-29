'use client';

import React, { useState } from 'react';
import { X, ChevronRight, Check, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useWorldContext, WIKI_MODULES, formatEntityModulesToHTML } from '../../app/context/WorldContext';

export default function CreateEntityModal({ isOpen, onClose, defaultType }: { isOpen: boolean, onClose: () => void, defaultType?: any }) {
  const { handleCreateEntity } = useWorldContext();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType?.key || 'Personagem');
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [moduleData, setModuleData] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const modules = WIKI_MODULES[type] || WIKI_MODULES['Personagem'];
  const currentModuleName = modules[currentModuleIndex];

  const handleNextStep = () => {
    if (step === 1 && name.trim()) setStep(2);
    else if (currentModuleIndex < modules.length - 1) setCurrentModuleIndex(prev => prev + 1);
    else finishCreation();
  };

  const finishCreation = async () => {
    setIsSaving(true);
    try {
      // Aqui os módulos são unidos num HTML bonito com <h2> e <p>
      const finalHTML = formatEntityModulesToHTML(type, moduleData);
      
      await handleCreateEntity(name, type, 'livre', finalHTML);
      
      onClose();
      reset();
    } catch (err: any) {
      alert('Erro ao forjar entidade: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const reset = () => {
    setStep(1); setName(''); setType(defaultType?.key || 'Personagem');
    setCurrentModuleIndex(0); setModuleData({});
  };

  React.useEffect(() => {
    if (defaultType?.key) setType(defaultType.key);
  }, [defaultType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#05080c]/90 backdrop-blur-sm">
      <div className="bg-[#0B1018] border border-slate-800 rounded-3xl w-full max-w-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200 relative">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0D121B] relative z-20">
           <div>
              <h3 className="text-xl font-serif font-bold text-white flex items-center gap-2">
                <Wand2 className="text-emerald-500 w-5 h-5"/> Forjador de Entidades
              </h3>
              <p className="text-[10px] text-slate-500 mt-1.5 uppercase tracking-widest font-bold">
                Passo {step === 1 ? '1' : `2.${currentModuleIndex + 1}`}: {step === 1 ? 'Definições Base' : currentModuleName}
              </p>
           </div>
           <button onClick={() => { onClose(); reset(); }} className="text-slate-500 hover:text-white transition-colors bg-slate-900/50 p-2 rounded-full hover:bg-slate-800"><X size={20}/></button>
        </div>

        {/* PROGRESS BAR */}
        {step === 2 && (
          <div className="flex h-1 bg-slate-900 w-full z-20 relative">
            {modules.map((_, i) => (
              <div key={i} className={`flex-1 transition-all duration-500 border-r border-slate-900/50 ${i <= currentModuleIndex ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : ''}`} />
            ))}
          </div>
        )}

        <div className="p-8 min-h-[420px] flex flex-col justify-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
          
          {step === 1 ? (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 relative z-10 w-full max-w-lg mx-auto">
              <div>
                <label className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest mb-3 block">Nome de Batismo</label>
                <input 
                  autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && name.trim() && handleNextStep()}
                  placeholder="Ex: Galadriel, Mordor, Excalibur..." 
                  className="w-full bg-[#05080C] border border-slate-800 text-white text-2xl md:text-3xl font-serif p-4 rounded-2xl focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner text-center" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest mb-3 block">Tipo de Entidade</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.keys(WIKI_MODULES).map(m => (
                    <button 
                      key={m} onClick={() => setType(m)} 
                      className={`p-3 rounded-xl border text-sm font-bold transition-all ${type === m ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 shadow-inner scale-105' : 'bg-[#05080C] border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300 hover:bg-slate-900/50'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 h-full flex flex-col relative z-10">
              <div className="flex items-center gap-3 text-emerald-400 mb-2 border-b border-slate-800 pb-4">
                 <Sparkles size={24}/>
                 <h4 className="text-3xl font-serif font-bold text-white tracking-wide">{currentModuleName}</h4>
              </div>
              <textarea 
                autoFocus
                value={moduleData[currentModuleName] || ''}
                onChange={e => setModuleData({...moduleData, [currentModuleName]: e.target.value})}
                placeholder={`Descreva os detalhes sobre a ${currentModuleName.toLowerCase()} de ${name}...`}
                className="flex-1 w-full bg-[#05080C] border border-slate-800 text-slate-300 p-6 rounded-2xl focus:outline-none focus:border-emerald-500/50 transition-all min-h-[220px] text-lg leading-relaxed resize-none custom-scrollbar shadow-inner"
              />
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-6 bg-[#0D121B] border-t border-slate-800 flex justify-between items-center relative z-20">
           <button 
             onClick={() => step === 2 ? (currentModuleIndex === 0 ? setStep(1) : setCurrentModuleIndex(prev => prev -1)) : (onClose(), reset())} 
             className="text-slate-500 hover:text-white font-bold text-xs uppercase tracking-widest px-4 py-2 transition-colors"
           >
             {step === 1 ? 'Cancelar' : 'Voltar'}
           </button>
           
           <button 
             onClick={handleNextStep} 
             disabled={isSaving || (step === 1 && !name.trim())}
             className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-3.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_5px_15px_rgba(16,185,129,0.3)] disabled:opacity-50 hover:-translate-y-0.5"
           >
             {isSaving ? <Loader2 className="animate-spin" /> : currentModuleIndex === modules.length - 1 && step === 2 ? <><Check size={18}/> Concluir Forja</> : <><ChevronRight size={18}/> Próximo Passo</>}
           </button>
        </div>
      </div>
    </div>
  );
}