'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, Wand2, ArrowRight, User, Key, X, CheckCircle2, Clock } from 'lucide-react';

export default function ManualJoinPage() {
  const router = useRouter();
  
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
  }, []);

  const handleRequestJoin = async () => {
    if (!session?.user?.id) {
      router.push('/');
      return;
    }
    if (!inviteCode.trim() || !displayName.trim()) {
      setError('Preencha o código de convite e o seu apelido.');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const code = inviteCode.toUpperCase().trim();
      
      // 1. Validar convite
      const { data: invite, error: inviteErr } = await supabase.from('campaign_invites')
        .select('*, campaigns(name, worlds(name, id))')
        .eq('invite_code', code)
        .single();

      if (inviteErr || !invite) throw new Error('Código de convite inválido ou expirado.');
      if (invite.uses_count >= invite.max_uses) throw new Error('Este convite já atingiu o limite de usos.');

      // 2. Criar pedido (Status = Pending)
      const colors = ['#10b981', '#f43f5e', '#3b82f6', '#8b5cf6', '#d946ef', '#f59e0b', '#06b6d4'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const { error: joinErr } = await supabase.from('campaign_members').insert([{
        campaign_id: invite.campaign_id,
        user_id: session.user.id,
        invite_id: invite.id,
        display_name: displayName,
        avatar_color: randomColor,
        role: 'player',
        status: 'pending' // Fica pendente para o GM aprovar!
      }]);

      if (joinErr && joinErr.message.includes('duplicate key')) {
        throw new Error("Você já solicitou entrada ou já está nesta mesa.");
      } else if (joinErr) {
        throw new Error("Erro ao enviar pedido de entrada.");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#090D14] flex items-center justify-center"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#090D14] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-400">
            <Wand2 className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-white tracking-wide text-center">Entrar na Campanha</h1>
        </div>

        <div className="bg-[#0B1018] border border-slate-800/80 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
          {success ? (
            <div className="text-center py-4 animate-in fade-in zoom-in duration-300">
               <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                 <Clock className="text-emerald-500 w-8 h-8" />
               </div>
               <h2 className="text-white font-bold text-xl mb-2">Pedido Enviado!</h2>
               <p className="text-slate-400 text-sm mb-8">O Mestre recebeu a sua solicitação. Assim que ele aprovar, a campanha aparecerá no seu painel principal.</p>
               <button onClick={() => router.push('/')} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all w-full">Voltar ao Início</button>
            </div>
          ) : (
            <div className="space-y-5">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm p-3 rounded-xl flex items-start gap-2">
                  <X size={16} className="shrink-0 mt-0.5" /> <span>{error}</span>
                </div>
              )}
              
              {!session && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs p-4 rounded-xl mb-4 text-center font-medium">
                  É necessário ter sessão iniciada no WorldCraft para entrar em campanhas. Crie uma conta no Início primeiro.
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2 block">Código do Convite</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input 
                    type="text" 
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Ex: XKTR-9201" 
                    className="w-full font-mono font-bold bg-[#05080C] border border-slate-800 text-emerald-400 text-sm rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-2 block">Seu Apelido na Mesa</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nome da sua personagem ou apelido" 
                    className="w-full bg-[#05080C] border border-slate-800 text-white text-sm rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner" 
                  />
                </div>
              </div>
              
              <button 
                onClick={handleRequestJoin} 
                disabled={isJoining || !displayName.trim() || !inviteCode.trim() || !session} 
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_5px_20px_rgba(16,185,129,0.2)] disabled:opacity-50"
              >
                {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight size={18}/> Solicitar Entrada</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}