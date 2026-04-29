'use client';

import React, { useState } from 'react';
import { useWorldContext } from '../app/context/WorldContext';
import { Users, Plus, Shield, Link as LinkIcon, Copy, CheckCircle2, Trash2, Clock, Check, X } from 'lucide-react';
import ConfirmModal from './Modals/ConfirmModal';

export default function CampaignManager() {
  const { 
    selectedWorld, campaigns, selectedCampaign, setSelectedCampaign, 
    handleCreateCampaign, handleDeleteCampaign, generateInviteCode, revokeInvite, 
    campaignInvites, campaignMembers, handleApproveMember, handleRejectMember
  } = useWorldContext();
  
  const [newCampName, setNewCampName] = useState('');
  const [newCampDesc, setNewCampDesc] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{ isOpen: boolean; title: string; message: string; action: () => Promise<void>; }>({ isOpen: false, title: '', message: '', action: async () => {} });

  if (!selectedWorld) return <div className="p-8 text-slate-500">Selecione um mundo primeiro.</div>;

  const handleCreate = async () => {
    if(!newCampName.trim()) return;
    await handleCreateCampaign(newCampName, newCampDesc);
    setNewCampName(''); setNewCampDesc('');
  };

  const handleCopyLink = (code: string) => {
    // O Mestre agora compartilha apenas o /join fixo e o jogador digita o código lá
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const onDeleteCampaignClick = (campId: string, campName: string) => {
    setConfirmModalConfig({ isOpen: true, title: 'Excluir Campanha', message: `Tem a certeza que deseja excluir a campanha "${campName}"? Esta ação removerá o acesso de todos os jogadores.`, action: async () => { await handleDeleteCampaign(campId); setConfirmModalConfig(prev => ({ ...prev, isOpen: false })); } });
  };

  const pendingMembers = campaignMembers.filter(m => m.status === 'pending');
  const approvedMembers = campaignMembers.filter(m => m.status === 'approved');

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-[#090D14] animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-serif font-bold text-white mb-2 flex items-center gap-3"><Users className="w-8 h-8 text-emerald-500" /> Gestão de Campanhas</h1>
          <p className="text-slate-400 text-lg">Administre os jogadores, convites e sessões de {selectedWorld.name}.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#0B1018] border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Nova Campanha</h3>
              <input type="text" value={newCampName} onChange={e => setNewCampName(e.target.value)} placeholder="Nome da Campanha..." className="w-full bg-[#05080C] border border-slate-800 text-white text-sm px-4 py-2.5 rounded-lg mb-3 focus:outline-none focus:border-emerald-500/50" />
              <textarea value={newCampDesc} onChange={e => setNewCampDesc(e.target.value)} placeholder="Descrição curta (opcional)" className="w-full bg-[#05080C] border border-slate-800 text-white text-sm px-4 py-2.5 rounded-lg mb-4 focus:outline-none focus:border-emerald-500/50 resize-none h-20" />
              <button onClick={handleCreate} disabled={!newCampName.trim()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg text-sm transition-all disabled:opacity-50">Criar Instância</button>
            </div>
            <div className="bg-[#0B1018] border border-slate-800 p-4 rounded-2xl max-h-96 overflow-y-auto custom-scrollbar">
               <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">Suas Campanhas</h3>
               {campaigns.length === 0 && <p className="text-xs text-slate-600 px-2 italic">Nenhuma campanha criada.</p>}
               {campaigns.map(camp => (
                 <div key={camp.id} className={`group flex items-center justify-between p-2 rounded-xl transition-all mb-2 ${selectedCampaign?.id === camp.id ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-slate-800 border border-transparent'}`}>
                    <button onClick={() => setSelectedCampaign(camp)} className="flex-1 text-left truncate">
                      <p className={`font-bold text-sm truncate px-2 ${selectedCampaign?.id === camp.id ? 'text-emerald-400' : 'text-slate-300 group-hover:text-white'}`}>{camp.name}</p>
                    </button>
                    <button onClick={() => onDeleteCampaignClick(camp.id, camp.name)} className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"><Trash2 size={14} /></button>
                 </div>
               ))}
            </div>
          </div>

          {selectedCampaign ? (
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[#0B1018] border border-slate-800 rounded-2xl p-6 md:p-8">
                <div className="flex items-start justify-between mb-8 border-b border-slate-800/50 pb-6">
                  <div>
                    <h2 className="text-3xl font-serif text-white font-bold">{selectedCampaign.name}</h2>
                    <p className="text-slate-400 text-sm mt-2">{selectedCampaign.description || 'Sem descrição.'}</p>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm">Ativa</span>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  {/* Códigos de Convite */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-800/50 pb-2">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2"><LinkIcon size={16} className="text-emerald-500"/> Códigos de Convite</h3>
                      <button onClick={() => generateInviteCode(selectedCampaign.id)} className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"><Plus size={14}/> Gerar Código</button>
                    </div>
                    
                    <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                      {campaignInvites.length === 0 && <p className="text-xs text-slate-500 italic p-4 bg-[#05080C] rounded-xl border border-slate-800/50 text-center">Nenhum convite ativo no momento.</p>}
                      {campaignInvites.map(inv => (
                        <div key={inv.id} className="flex flex-col gap-2 bg-[#05080C] border border-slate-800 p-3.5 rounded-xl shadow-inner group relative">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-emerald-400 text-sm font-bold tracking-wider">{inv.invite_code}</span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Usos: {inv.uses_count} / {inv.max_uses}</span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <button onClick={() => handleCopyLink(inv.invite_code)} className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-white font-medium py-1.5 rounded flex items-center justify-center gap-1.5 transition-colors">
                              {copiedCode === inv.invite_code ? <><CheckCircle2 size={14} className="text-emerald-400" /> Copiado</> : <><Copy size={14} /> Copiar Código</>}
                            </button>
                            <button onClick={() => revokeInvite(inv.id)} className="px-3 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded transition-colors" title="Revogar"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pedidos Pendentes */}
                  {pendingMembers.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4 border-b border-amber-500/20 pb-2">
                        <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2"><Clock size={16}/> Pedidos Pendentes</h3>
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-widest">{pendingMembers.length} Aguardando</span>
                      </div>
                      <div className="space-y-3">
                        {pendingMembers.map(member => (
                          <div key={member.id} className="flex items-center justify-between p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: member.avatar_color }}>{member.display_name.substring(0,2).toUpperCase()}</div>
                              <p className="text-sm font-bold text-white">{member.display_name}</p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleApproveMember(member.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg transition-colors" title="Aprovar"><Check size={16}/></button>
                              <button onClick={() => handleRejectMember(member.id)} className="bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white p-2 rounded-lg transition-colors" title="Rejeitar"><X size={16}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Jogadores Aprovados */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-800/50 pb-2">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2"><Shield size={16} className="text-emerald-500"/> Jogadores na Mesa</h3>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{approvedMembers.length} Membros</span>
                    </div>
                    <div className="space-y-3">
                      {approvedMembers.length === 0 && <p className="text-xs text-slate-500 italic p-4 bg-[#05080C] rounded-xl border border-slate-800/50 text-center">Nenhum jogador aprovado na mesa ainda.</p>}
                      {approvedMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-[#05080C] border border-slate-800 rounded-xl group">
                           <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: member.avatar_color }}>{member.display_name.substring(0,2).toUpperCase()}</div>
                             <div>
                               <p className="text-sm font-bold text-white leading-none">{member.display_name}</p>
                               <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{member.role === 'co-gm' ? 'Co-Mestre' : 'Jogador'}</p>
                             </div>
                           </div>
                           <button onClick={() => handleRejectMember(member.id)} className="text-slate-600 hover:text-rose-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity" title="Expulsar Jogador"><Trash2 size={16}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
             <div className="lg:col-span-2 border border-dashed border-slate-700 bg-slate-900/10 rounded-2xl flex flex-col items-center justify-center p-12 text-center shadow-inner">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4"><Users className="w-8 h-8 text-slate-500" /></div>
                <h3 className="text-lg font-bold text-white mb-2">Nenhuma Campanha Selecionada</h3>
                <p className="text-slate-500 text-sm max-w-sm">Crie uma nova instância ou selecione uma existente na lateral para gerir acessos e permissões.</p>
             </div>
          )}
        </div>
      </div>
      <ConfirmModal isOpen={confirmModalConfig.isOpen} title={confirmModalConfig.title} message={confirmModalConfig.message} onConfirm={confirmModalConfig.action} onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))} confirmVariant="danger" confirmLabel="Excluir" />
    </div>
  );
}