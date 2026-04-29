'use client';

import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  confirmVariant = 'primary',
  isLoading = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isDanger = confirmVariant === 'danger';
  const Icon = isDanger ? AlertTriangle : AlertTriangle; // Reusing AlertTriangle for both for now, could differentiate if needed.
  const iconColorClass = isDanger ? 'text-rose-500' : 'text-emerald-500';
  const iconBgClass = isDanger ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30';
  const confirmBtnClass = isDanger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#05080c]/80 backdrop-blur-sm" onClick={!isLoading ? onClose : undefined}></div>
      
      <div className="bg-[#0B1018] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="p-6 relative z-10 flex flex-col items-center text-center">
          <div className={`w-14 h-14 rounded-full border flex items-center justify-center mb-4 ${iconBgClass}`}>
            <Icon className={`w-6 h-6 ${iconColorClass}`} />
          </div>
          
          <h3 className="text-xl font-serif font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-400 mb-8">{message}</p>

          <div className="flex gap-3 w-full">
            <button 
              onClick={onClose} 
              disabled={isLoading}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm} 
              disabled={isLoading}
              className={`flex-1 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${confirmBtnClass}`}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}