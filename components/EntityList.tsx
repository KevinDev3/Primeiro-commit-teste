'use client';

import React from 'react';
import { User, Plus, Search, X } from 'lucide-react';
import { useWorldContext } from '../app/context/WorldContext';

interface EntityListProps {
  onCreateEntity: () => void;
}

export default function EntityList({ onCreateEntity }: EntityListProps) {
  const { filteredCharacters, selectedCharacter, loadCharacterData, searchQuery, setSearchQuery } = useWorldContext();

  return (
    <div className="w-72 flex flex-col gap-4 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-400" />
          Personagens
          <span className="text-xs text-slate-600 font-mono font-normal ml-1">{filteredCharacters.length}</span>
        </h2>
        <button
          onClick={onCreateEntity}
          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg border border-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar entidade..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-800 text-sm text-white rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-600"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {filteredCharacters.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-sm">
            {searchQuery ? 'Nenhuma entidade encontrada.' : 'Nenhuma entidade criada ainda.'}
          </div>
        ) : filteredCharacters.map(char => (
          <button
            key={char.id}
            onClick={() => loadCharacterData(char)}
            className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selectedCharacter === char.id
              ? 'bg-slate-800/80 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
              : 'bg-slate-900/30 border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700'}`}
          >
            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-slate-700">
              {char.avatar_url
                ? <img src={char.avatar_url} className="w-full h-full object-cover" alt={char.name} />
                : <User className="w-5 h-5 text-slate-500" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-medium truncate text-sm ${selectedCharacter === char.id ? 'text-emerald-400' : 'text-slate-200'}`}>
                {char.name}
              </h3>
              <p className="text-xs text-slate-500 truncate mt-0.5">{char.role || 'Sem papel definido'}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
