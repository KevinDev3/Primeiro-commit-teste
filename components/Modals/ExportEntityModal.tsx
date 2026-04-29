'use client';

import React from 'react';
import { X, Download, FileText, FileCode } from 'lucide-react';
import { ICharacter, IWorld } from '../../app/context/WorldContext';

interface ExportEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: ICharacter | undefined;
  world: IWorld | null;
  bioHtml: string;
}

export default function ExportEntityModal({ isOpen, onClose, entity, world, bioHtml }: ExportEntityModalProps) {
  if (!isOpen || !entity) return null;

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onClose();
  };

  const exportMarkdown = () => {
    // Regex simples para converter HTML básico em Markdown
    let mdBio = bioHtml
      .replace(/<h[1-3]>(.*?)<\/h[1-3]>/gi, '\n## $1\n')
      .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<[^>]*>/g, ''); // strip remaining tags

    const attrsTable = Object.entries(entity.attributes || {})
      .map(([k, v]) => `| ${k} | ${v} |`)
      .join('\n');

    const tagsMd = (entity.tags || []).map(t => `\`${t}\``).join(' ');

    const md = `# ${entity.name}\n**Tipo:** ${entity.category}\n**Mundo:** ${world?.name || 'Desconhecido'}\n\n## Atributos\n| Campo | Valor |\n|---|---|\n${attrsTable}\n\n## Tags\n${tagsMd}\n\n## Lore / Arquivos\n${mdBio}`;
    
    downloadFile(md, `${entity.name.replace(/\s+/g, '_')}_export.md`, 'text/markdown;charset=utf-8;');
  };

  const exportJSON = () => {
    const jsonStr = JSON.stringify(entity, null, 2);
    downloadFile(jsonStr, `${entity.name.replace(/\s+/g, '_')}_data.json`, 'application/json;charset=utf-8;');
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#05080c]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0B1018] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#0D121B]">
           <div>
              <h3 className="text-xl font-serif font-bold text-white flex items-center gap-2">
                <Download className="text-emerald-500 w-5 h-5"/> Exportar Entidade
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Gerar documento de {entity.name}</p>
           </div>
           <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-slate-900/50 p-2 rounded-full hover:bg-slate-800"><X size={20}/></button>
        </div>

        <div className="p-8 flex flex-col gap-4">
           <button onClick={exportMarkdown} className="w-full flex items-center gap-4 p-4 bg-[#05080C] border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all rounded-2xl group text-left">
              <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-emerald-500/20 flex items-center justify-center shrink-0 transition-colors">
                 <FileText className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div>
                 <h4 className="font-bold text-white text-sm">Documento Markdown (.md)</h4>
                 <p className="text-xs text-slate-500 mt-0.5">Ideal para ler, imprimir ou usar em editores de texto (Obsidian, Notion).</p>
              </div>
           </button>

           <button onClick={exportJSON} className="w-full flex items-center gap-4 p-4 bg-[#05080C] border border-slate-800 hover:border-sky-500/50 hover:bg-sky-500/10 transition-all rounded-2xl group text-left">
              <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-sky-500/20 flex items-center justify-center shrink-0 transition-colors">
                 <FileCode className="w-6 h-6 text-slate-400 group-hover:text-sky-400 transition-colors" />
              </div>
              <div>
                 <h4 className="font-bold text-white text-sm">Dados Brutos JSON (.json)</h4>
                 <p className="text-xs text-slate-500 mt-0.5">Estrutura de dados original, perfeita para backups ou integrações com código.</p>
              </div>
           </button>
        </div>
      </div>
    </div>
  );
}