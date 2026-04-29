'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import WorldCraftUI from './WorldCraftUI';
import { WorldProvider } from './context/WorldContext';
import { Wand2, Mail, Lock, Loader2, AlertCircle, Sparkles } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Carrega a sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    // Fica à escuta de Login / Logout para atualizar a interface instantaneamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Registo criado! Pode entrar agora ou verifique o seu e-mail.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="h-screen bg-[#090D14] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  // Se o utilizador estiver logado, injeta a sessão no Provider
  if (session) {
    return (
      <WorldProvider session={session}>
        <WorldCraftUI session={session} />
      </WorldProvider>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D14] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            <Wand2 className="w-6 h-6 text-slate-950" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-white tracking-wide">WorldCraft</h1>
          <p className="text-slate-400 mt-2">O compêndio do seu universo.</p>
        </div>

        <div className="bg-[#0B1018] border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
          <h2 className="text-xl font-medium text-white mb-6 text-center">
            {isLogin ? 'Aceder aos mundos' : 'Forjar conta'}
          </h2>

          {error && (
            <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-emerald-500/50 transition-all" placeholder="mestre@guilda.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900/50 border border-slate-800 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-emerald-500/50 transition-all" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 mt-2">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? 'Entrar no Portal' : <><Sparkles className="w-5 h-5" /> Criar Conta</>}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-slate-800/80 pt-6">
            <p className="text-slate-400 text-sm">
              <button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                {isLogin ? 'Criar nova conta' : 'Já possuo uma conta'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}