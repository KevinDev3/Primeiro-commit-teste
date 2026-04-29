'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWorldContext } from '../app/context/WorldContext';
import {
  Folder, FolderOpen, FileText, ExternalLink, Home, UploadCloud,
  Download, Image as ImageIcon, Film, Link as LinkIcon, Loader2, Plus, X, Search, Trash2,
  ChevronRight, Save, Music, Archive, LayoutGrid, List as ListIcon, Eye, Edit3,
  Map, BookOpen, RefreshCw, File, Star, StarOff, Clock, HardDrive, CheckCircle2,
  AlertCircle, Copy, Tag, SortAsc, SortDesc, Filter, Maximize2, ChevronDown,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIAS = ['Geral', 'Mapas', 'Artes & Imagens', 'Documentos', 'Referências', 'Áudio', 'Vídeo'];
const TIPOS_LOGICOS = ['documento', 'imagem', 'mapa', 'referencia', 'link', 'audio', 'video'];
const MAX_FILE_SIZE_MB = 50;

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Geral':          { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/20' },
  'Mapas':          { bg: 'bg-emerald-500/10',  text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'Artes & Imagens':{ bg: 'bg-pink-500/10',     text: 'text-pink-400',    border: 'border-pink-500/20' },
  'Documentos':     { bg: 'bg-sky-500/10',      text: 'text-sky-400',     border: 'border-sky-500/20' },
  'Referências':    { bg: 'bg-amber-500/10',    text: 'text-amber-400',   border: 'border-amber-500/20' },
  'Áudio':          { bg: 'bg-violet-500/10',   text: 'text-violet-400',  border: 'border-violet-500/20' },
  'Vídeo':          { bg: 'bg-rose-500/10',     text: 'text-rose-400',    border: 'border-rose-500/20' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (!b || b === 0) return '–';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMimeCategory(mime?: string): string {
  if (!mime) return 'file';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text')) return 'doc';
  if (mime.includes('zip') || mime.includes('archive') || mime.includes('compressed')) return 'archive';
  return 'file';
}

function MimeIcon({ mime, size = 18, className = '' }: { mime?: string; size?: number; className?: string }) {
  const cat = getMimeCategory(mime);
  const props = { size, className };
  if (cat === 'image') return <ImageIcon {...props} />;
  if (cat === 'video') return <Film {...props} />;
  if (cat === 'audio') return <Music {...props} />;
  if (cat === 'archive') return <Archive {...props} />;
  if (cat === 'doc') return <FileText {...props} />;
  return <File {...props} />;
}

function getMimeColor(mime?: string): string {
  const cat = getMimeCategory(mime);
  if (cat === 'image')   return 'text-pink-400';
  if (cat === 'video')   return 'text-rose-400';
  if (cat === 'audio')   return 'text-violet-400';
  if (cat === 'archive') return 'text-amber-400';
  if (cat === 'doc')     return 'text-sky-400';
  return 'text-slate-400';
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/60 hover:text-white bg-white/10 p-2 rounded-full" onClick={onClose}><X size={20} /></button>
      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <img src={src} alt={name} className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl" />
        <p className="text-white/60 text-sm">{name}</p>
      </div>
    </div>
  );
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameModal({ file, onClose, onSave }: { file: any; onClose: () => void; onSave: (id: string, name: string, notes: string, category: string) => Promise<void> }) {
  const [name, setName] = useState(file.name || '');
  const [notes, setNotes] = useState(file.notes || '');
  const [category, setCategory] = useState(file.category || 'Geral');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(file.id, name, notes, category);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0B1018] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-serif font-bold text-white">Editar Arquivo</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nome</label>
            <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-[#090D14] border border-slate-800 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full bg-[#090D14] border border-slate-800 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50">
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Descreva o conteúdo deste arquivo..."
              className="w-full bg-[#090D14] border border-slate-800 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({ worldId, userId, onClose, onSuccess }: {
  worldId: string; userId: string; onClose: () => void; onSuccess: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Geral', type: 'documento', external_url: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    setError(null);
    setSelectedFile(file);
    if (!form.name) setForm(f => ({ ...f, name: file.name.replace(/\.[^.]+$/, '') }));
    // Auto-detect category
    const mime = file.type;
    if (mime.startsWith('image/')) setForm(f => ({ ...f, category: 'Artes & Imagens', type: 'imagem' }));
    else if (mime.startsWith('audio/')) setForm(f => ({ ...f, category: 'Áudio', type: 'audio' }));
    else if (mime.startsWith('video/')) setForm(f => ({ ...f, category: 'Vídeo', type: 'video' }));
    else if (mime.includes('pdf') || mime.includes('document')) setForm(f => ({ ...f, category: 'Documentos', type: 'documento' }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return setError('O nome é obrigatório.');
    setError(null);
    setSaving(true);
    setProgress(0);

    let storagePath = null;
    let fileSize = null;
    let mimeType = null;
    let publicUrl: string | null = null;

    try {
      if (selectedFile && uploadMode === 'file') {
        const ext = selectedFile.name.split('.').pop();
        const path = `${worldId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        setProgress(30);
        const { error: upErr } = await supabase.storage.from('world_files').upload(path, selectedFile);
        if (upErr) throw upErr;
        setProgress(70);
        storagePath = path;
        fileSize = selectedFile.size;
        mimeType = selectedFile.type;
        const { data: urlData } = supabase.storage.from('world_files').getPublicUrl(path);
        publicUrl = urlData.publicUrl;
      }
      setProgress(85);
      const { error: dbErr } = await supabase.from('world_files').insert([{
        world_id: worldId,
        name: form.name,
        category: form.category,
        file_type: form.type,
        notes: form.notes,
        size_label: fileSize ? fmtBytes(fileSize) : '',
        file_size: fileSize,
        mime_type: mimeType,
        storage_path: storagePath,
        external_url: uploadMode === 'url' ? form.external_url : publicUrl,
        owner_id: userId,
      }]);
      if (dbErr) throw dbErr;
      setProgress(100);
      setTimeout(() => { onSuccess(); onClose(); }, 400);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = form.name.trim() && (uploadMode === 'file' ? !!selectedFile : !!form.external_url.trim());

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05080c]/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0B1018] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        
        {/* Progress bar */}
        {saving && (
          <div className="h-0.5 bg-slate-800 w-full">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-serif font-bold text-white">Novo Arquivo</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"><X size={18} /></button>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-[#090D14] border border-slate-800 rounded-xl p-1 mb-5">
            {[['file', UploadCloud, 'Upload Físico'] as const, ['url', LinkIcon, 'Link Externo'] as const].map(([mode, Icon, label]) => (
              <button key={mode} onClick={() => setUploadMode(mode)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${uploadMode === mode ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:text-slate-200'}`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {/* Upload area / URL */}
          {uploadMode === 'file' ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-5 ${dragActive ? 'border-emerald-500 bg-emerald-500/5 scale-[1.01]' : selectedFile ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700 bg-[#090D14] hover:border-slate-500 hover:bg-slate-900/30'}`}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center ${getMimeColor(selectedFile.type)}`}>
                    <MimeIcon mime={selectedFile.type} size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-emerald-400 truncate max-w-[240px]">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{fmtBytes(selectedFile.size)}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setSelectedFile(null); }} className="ml-2 text-slate-600 hover:text-rose-400"><X size={14} /></button>
                </div>
              ) : (
                <div>
                  <UploadCloud className={`w-8 h-8 mx-auto mb-3 ${dragActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <p className="text-sm text-slate-300 font-medium mb-1">Clique ou arraste um arquivo</p>
                  <p className="text-xs text-slate-500">Imagens, Mapas, PDFs, Áudio (Max {MAX_FILE_SIZE_MB}MB)</p>
                </div>
              )}
              <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            </div>
          ) : (
            <div className="mb-5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">URL do Recurso</label>
              <div className="relative">
                <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="url" placeholder="https://..." value={form.external_url}
                  onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))}
                  className="w-full bg-[#090D14] border border-slate-800 text-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50" />
              </div>
            </div>
          )}

          {/* Fields */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Nome de Exibição *</label>
              <input type="text" placeholder="Ex: Mapa do Reino Norte..." value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#090D14] border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Categoria</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-[#090D14] border border-slate-800 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Tipo Lógico</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full bg-[#090D14] border border-slate-800 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50">
                  {TIPOS_LOGICOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Notas (Opcional)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                placeholder="Descrição curta, contexto, para que serve..."
                className="w-full bg-[#090D14] border border-slate-800 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-2.5 rounded-lg text-sm">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <button onClick={handleSave} disabled={saving || !canSave}
            className="w-full mt-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-2 hover:-translate-y-0.5">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            {saving ? `Carregando... ${progress}%` : 'Adicionar ao Mundo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── File Card (Grid) ─────────────────────────────────────────────────────────

function FileCard({
  file, onDelete, onEdit, onPreview, onToggleStar, deleting,
}: {
  file: any; onDelete: (f: any) => void; onEdit: (f: any) => void;
  onPreview: (f: any) => void; onToggleStar: (f: any) => void; deleting: boolean;
}) {
  const isImage = getMimeCategory(file.mime_type) === 'image';
  const catStyle = CATEGORY_COLORS[file.category] || CATEGORY_COLORS['Geral'];

  return (
    <div className="bg-[#0B1018] border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-600 transition-all group shadow-sm flex flex-col">
      {/* Thumbnail / Icon header */}
      <div className="relative bg-[#090D14] border-b border-slate-800/60 h-36 flex items-center justify-center overflow-hidden">
        {isImage && file.external_url ? (
          <img src={file.external_url} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" />
        ) : (
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getMimeColor(file.mime_type)} bg-slate-800/80`}>
            <MimeIcon mime={file.mime_type} size={28} />
          </div>
        )}
        {/* Star */}
        <button
          onClick={() => onToggleStar(file)}
          className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-sm transition-all ${file.starred ? 'text-amber-400 bg-amber-500/10' : 'text-slate-600 bg-slate-900/40 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}
        >
          {file.starred ? <Star size={13} fill="currentColor" /> : <StarOff size={13} />}
        </button>
        {/* Preview btn for images */}
        {isImage && file.external_url && (
          <button
            onClick={() => onPreview(file)}
            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70"
          >
            <Maximize2 size={13} />
          </button>
        )}
        {/* Category badge */}
        <div className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md border ${catStyle.bg} ${catStyle.text} ${catStyle.border} backdrop-blur-sm`}>
          {file.category}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <h4 className="text-sm font-bold text-white truncate leading-tight" title={file.name}>{file.name}</h4>
        {file.notes && <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{file.notes}</p>}
        <div className="flex items-center gap-2 text-[10px] text-slate-600 mt-auto">
          {file.size_label && <span className="flex items-center gap-1"><HardDrive size={10}/>{file.size_label}</span>}
          {file.created_at && <span className="flex items-center gap-1"><Clock size={10}/>{fmtDate(file.created_at)}</span>}
          {!file.storage_path && <span className="flex items-center gap-1 text-sky-500"><LinkIcon size={10}/> Link</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 flex items-center gap-1.5">
        <button
          onClick={() => window.open(file.external_url, '_blank')}
          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-1.5 rounded-lg text-xs font-bold transition-colors"
        >
          <ExternalLink size={12} /> Abrir
        </button>
        <button onClick={() => onEdit(file)} className="px-2 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/50 rounded-lg transition-colors">
          <Edit3 size={13} />
        </button>
        {file.storage_path && (
          <button onClick={() => window.open(file.external_url, '_blank')} className="px-2 py-1.5 bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/50 rounded-lg transition-colors">
            <Download size={13} />
          </button>
        )}
        <button onClick={() => onDelete(file)} disabled={deleting}
          className="px-2 py-1.5 bg-slate-800/60 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 border border-slate-700/50 rounded-lg transition-colors disabled:opacity-50">
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

// ─── File Row (List) ──────────────────────────────────────────────────────────

function FileRow({
  file, onDelete, onEdit, onPreview, onToggleStar, deleting,
}: {
  file: any; onDelete: (f: any) => void; onEdit: (f: any) => void;
  onPreview: (f: any) => void; onToggleStar: (f: any) => void; deleting: boolean;
}) {
  const catStyle = CATEGORY_COLORS[file.category] || CATEGORY_COLORS['Geral'];

  return (
    <div className="bg-[#0B1018] border border-slate-800 rounded-xl p-3 flex items-center gap-3 hover:border-slate-600 transition-all group">
      <div className={`w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 ${getMimeColor(file.mime_type)}`}>
        <MimeIcon mime={file.mime_type} size={16} />
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-4 items-center">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-white truncate">{file.name}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>{file.category}</span>
            {file.notes && <span className="text-[11px] text-slate-500 truncate">{file.notes}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-600 shrink-0">
          {file.size_label && <span>{file.size_label}</span>}
          {file.created_at && <span className="hidden sm:block">{fmtDate(file.created_at)}</span>}
          {!file.storage_path && <span className="text-sky-500 flex items-center gap-1"><LinkIcon size={10}/> Link</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button onClick={() => onToggleStar(file)} className={`p-1.5 rounded-lg transition-colors ${file.starred ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'}`}>
          {file.starred ? <Star size={13} fill="currentColor" /> : <Star size={13} />}
        </button>
        <button onClick={() => window.open(file.external_url, '_blank')} className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 transition-colors"><ExternalLink size={13} /></button>
        <button onClick={() => onEdit(file)} className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors"><Edit3 size={13} /></button>
        {file.storage_path && (
          <button onClick={() => window.open(file.external_url, '_blank')} className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors"><Download size={13} /></button>
        )}
        <button onClick={() => onDelete(file)} disabled={deleting} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50">
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FileManager() {
  const { selectedWorld, session } = useWorldContext();

  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<any | null>(null);
  const [lightboxFile, setLightboxFile] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'created_at' | 'file_size'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showStarred, setShowStarred] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!selectedWorld) return;
    setLoading(true);
    const { data } = await supabase
      .from('world_files')
      .select('*')
      .eq('world_id', selectedWorld.id)
      .order('created_at', { ascending: false });
    setFiles(data || []);
    setLoading(false);
  }, [selectedWorld]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleDelete = async (file: any) => {
    if (!confirm(`Deletar "${file.name}"?`)) return;
    setDeleting(file.id);
    if (file.storage_path) await supabase.storage.from('world_files').remove([file.storage_path]);
    await supabase.from('world_files').delete().eq('id', file.id);
    setDeleting(null);
    setFiles(prev => prev.filter(f => f.id !== file.id));
    showToast('Arquivo removido.');
  };

  const handleEdit = async (id: string, name: string, notes: string, category: string) => {
    await supabase.from('world_files').update({ name, notes, category }).eq('id', id);
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name, notes, category } : f));
    showToast('Arquivo atualizado!');
  };

  const handleToggleStar = async (file: any) => {
    const newVal = !file.starred;
    await supabase.from('world_files').update({ starred: newVal }).eq('id', file.id);
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, starred: newVal } : f));
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('URL copiada!');
  };

  // Sort toggle
  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // Build filtered + sorted list
  const folderList = [...new Set([...CATEGORIAS, ...files.map(f => f.category)])].sort();
  const folderCounts = folderList.reduce((acc, folder) => {
    acc[folder] = files.filter(f => f.category === folder).length;
    return acc;
  }, {} as Record<string, number>);

  let viewFiles = [...files];
  if (showStarred) viewFiles = viewFiles.filter(f => f.starred);
  if (activeFolder) viewFiles = viewFiles.filter(f => f.category === activeFolder);
  if (search) viewFiles = viewFiles.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.notes || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.category || '').toLowerCase().includes(search.toLowerCase())
  );
  viewFiles.sort((a, b) => {
    let av = a[sortField] ?? '', bv = b[sortField] ?? '';
    if (sortField === 'file_size') { av = Number(av) || 0; bv = Number(bv) || 0; }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalSize = files.reduce((acc, f) => acc + (f.file_size || 0), 0);
  const withFile = files.filter(f => f.storage_path).length;
  const withLink = files.filter(f => !f.storage_path).length;
  const starredCount = files.filter(f => f.starred).length;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[300] bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-4">
          <CheckCircle2 size={15} className="text-emerald-400" /> {toastMsg}
        </div>
      )}

      {/* Lightbox */}
      {lightboxFile && (
        <Lightbox src={lightboxFile.external_url} name={lightboxFile.name} onClose={() => setLightboxFile(null)} />
      )}

      {/* Edit modal */}
      {editingFile && (
        <RenameModal file={editingFile} onClose={() => setEditingFile(null)} onSave={handleEdit} />
      )}

      {/* Upload modal */}
      {modalOpen && selectedWorld && (
        <UploadModal worldId={selectedWorld.id} userId={session?.user?.id} onClose={() => setModalOpen(false)} onSuccess={loadFiles} />
      )}

      <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-4xl font-serif font-bold text-white mb-1.5 flex items-center gap-3">
              <Folder className="w-8 h-8 text-emerald-500" />
              Biblioteca de Arquivos
            </h1>
            <p className="text-slate-400">
              Repositório de {selectedWorld?.name || 'mundo'} · {files.length} itens · {fmtBytes(totalSize)} usados
            </p>
          </div>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all hover:-translate-y-0.5">
            <Plus size={18} /> Novo Arquivo
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total', val: files.length, color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5' },
            { label: 'Hospedados', val: withFile, color: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
            { label: 'Links', val: withLink, color: 'text-sky-400', border: 'border-sky-500/20', bg: 'bg-sky-500/5' },
            { label: 'Favoritos', val: starredCount, color: 'text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
          ].map((s, i) => (
            <div key={i} className={`${s.bg} border ${s.border} rounded-2xl p-4`}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{s.label}</p>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Body layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar – folders */}
          <div className="w-full lg:w-56 shrink-0">
            <div className="bg-[#0B1018] border border-slate-800 rounded-2xl p-3 sticky top-0">
              <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-3 px-2">Pastas</p>

              <button onClick={() => { setActiveFolder(null); setShowStarred(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm mb-1 transition-all ${!activeFolder && !showStarred ? 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
                <div className="flex items-center gap-2"><Home size={14} /> Todos</div>
                <span className="text-xs font-mono opacity-60">{files.length}</span>
              </button>

              <button onClick={() => { setShowStarred(s => !s); setActiveFolder(null); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm mb-1 transition-all ${showStarred ? 'bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
                <div className="flex items-center gap-2"><Star size={14} /> Favoritos</div>
                <span className="text-xs font-mono opacity-60">{starredCount}</span>
              </button>

              <div className="h-px bg-slate-800 my-2 mx-1" />

              {folderList.map(folder => {
                const count = folderCounts[folder] || 0;
                const active = activeFolder === folder;
                return (
                  <button key={folder} onClick={() => { setActiveFolder(active ? null : folder); setShowStarred(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm mb-0.5 transition-all ${active ? 'bg-slate-800 text-white font-bold border border-slate-700' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {active ? <FolderOpen size={14} className="text-emerald-400 shrink-0" /> : <Folder size={14} className="shrink-0" />}
                      <span className="truncate text-[13px]">{folder}</span>
                    </div>
                    <span className="text-xs font-mono opacity-50 shrink-0">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main file area */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Buscar por nome, notas, categoria..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#0B1018] border border-slate-800 text-slate-200 text-sm rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-emerald-500/50 transition-all placeholder-slate-600" />
                {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={14} /></button>}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1.5">
                {(['name', 'created_at', 'file_size'] as const).map(field => {
                  const labels = { name: 'Nome', created_at: 'Data', file_size: 'Tamanho' };
                  const active = sortField === field;
                  return (
                    <button key={field} onClick={() => toggleSort(field)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${active ? 'bg-slate-800 text-white border-slate-700' : 'text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'}`}>
                      {labels[field]}
                      {active && (sortDir === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                    </button>
                  );
                })}
              </div>

              {/* View mode */}
              <div className="flex bg-[#0B1018] border border-slate-800 rounded-xl p-1 gap-0.5">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={15} /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}><ListIcon size={15} /></button>
              </div>

              <button onClick={loadFiles} className="p-2 rounded-xl text-slate-500 hover:text-white bg-[#0B1018] border border-slate-800 hover:border-slate-700 transition-colors">
                <RefreshCw size={15} />
              </button>
            </div>

            {/* Breadcrumb / context */}
            {(activeFolder || showStarred || search) && (
              <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
                <button onClick={() => { setActiveFolder(null); setShowStarred(false); setSearch(''); }} className="hover:text-emerald-400 transition-colors">Todos</button>
                {activeFolder && <><ChevronRight size={12} /><span className="text-slate-300">{activeFolder}</span></>}
                {showStarred && <><ChevronRight size={12} /><span className="text-amber-400">Favoritos</span></>}
                {search && <><ChevronRight size={12} /><span className="text-slate-300">"{search}"</span></>}
                <span className="text-slate-600">· {viewFiles.length} resultado(s)</span>
              </div>
            )}

            {/* Files */}
            {viewFiles.length === 0 ? (
              <div className="bg-[#0B1018] border border-slate-800/50 border-dashed rounded-2xl flex flex-col items-center justify-center p-16 text-center">
                <FolderOpen className="w-12 h-12 text-slate-700 mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {search ? 'Nenhum resultado' : showStarred ? 'Sem favoritos' : 'Pasta vazia'}
                </h3>
                <p className="text-slate-500 text-sm mb-6 max-w-xs">
                  {search ? `Nenhum arquivo corresponde a "${search}".` : 'Adicione arquivos ou links para este mundo.'}
                </p>
                <button onClick={() => setModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2">
                  <Plus size={15} /> Fazer Upload
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-12">
                {viewFiles.map(file => (
                  <FileCard key={file.id} file={file}
                    onDelete={handleDelete}
                    onEdit={f => setEditingFile(f)}
                    onPreview={f => setLightboxFile(f)}
                    onToggleStar={handleToggleStar}
                    deleting={deleting === file.id}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2 pb-12">
                {viewFiles.map(file => (
                  <FileRow key={file.id} file={file}
                    onDelete={handleDelete}
                    onEdit={f => setEditingFile(f)}
                    onPreview={f => setLightboxFile(f)}
                    onToggleStar={handleToggleStar}
                    deleting={deleting === file.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}