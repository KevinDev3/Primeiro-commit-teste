'use client';

import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Quote, Heading2 } from 'lucide-react';

interface RichTextEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
}

export default function RichTextEditor({ initialContent, onChange }: RichTextEditorProps) {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      
      // Cálculo de palavras e caracteres
      const text = editor.getText();
      setCharCount(text.length);
      setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-emerald max-w-none focus:outline-none min-h-[300px] text-slate-300 leading-relaxed prose-headings:font-serif prose-headings:text-white prose-hr:border-slate-800',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#0B1018] shadow-inner flex flex-col h-full">
      <div className="bg-[#05080C] border-b border-slate-800 p-2 flex items-center gap-1 flex-wrap shrink-0">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <Heading2 size={16} />
        </button>
        <div className="w-px h-5 bg-slate-800 mx-1"></div>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <Italic size={16} />
        </button>
        <div className="w-px h-5 bg-slate-800 mx-1"></div>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <ListOrdered size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded-lg transition-colors ${editor.isActive('blockquote') ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
        >
          <Quote size={16} />
        </button>

        {/* CONTADOR DE PALAVRAS E CARACTERES */}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500 font-mono pr-2">
          <span>{wordCount} palavras</span>
          <span className="text-slate-700">·</span>
          <span>{charCount} chars</span>
        </div>
      </div>
      
      <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}