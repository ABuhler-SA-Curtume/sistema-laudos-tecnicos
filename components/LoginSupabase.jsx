// components/LoginSupabase.jsx
'use client';

import { useState } from 'react';
import { registrar, login, loginComGoogle, recuperarSenha } from '../lib/laudosServiceSupabase';

export default function LoginSupabase({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState('login'); // 'login' | 'registrar' | 'confirmar' | 'recuperar' | 'recuperar-ok'

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const user = await login(email, senha);
      onLoginSuccess(user);
    } catch (error) {
      setErro(error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistro = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const { user, session } = await registrar(email, senha, nome);
      if (session) {
        onLoginSuccess(user);
      } else {
        setModo('confirmar');
      }
    } catch (error) {
      setErro(error.message || 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      await recuperarSenha(email);
      setModo('recuperar-ok');
    } catch (error) {
      setErro(error.message || 'Erro ao enviar email de recuperação');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginGoogle = async () => {
    setLoading(true);
    setErro('');
    try {
      await loginComGoogle();
    } catch (error) {
      setErro(error.message || 'Erro ao fazer login com Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8 text-slate-100 relative overflow-hidden">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-sky-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-cyan-500/6 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Logo card */}
        <div className="mb-8 text-center">
          <div className="inline-flex flex-col items-center gap-4 glass-card rounded-[2rem] border-slate-800/90 px-6 py-6 shadow-[0_40px_160px_-60px_rgba(56,189,248,0.35)] w-full max-w-xs">
            <img
              src="/logo-abuhler.png"
              alt="A. Bühler Genuine Leather"
              style={{ maxHeight: 100, maxWidth: '100%', width: 'auto', height: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
            <div className="h-px w-full bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
            <p className="text-xs uppercase tracking-[0.4em] text-sky-400/80">
              Sistema de Laudos Técnicos
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="glass-card rounded-[2rem] border-slate-800/90 p-8 shadow-[0_30px_120px_-80px_rgba(56,189,248,0.3)]">
          {erro && (
            <div className="mb-6 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
              {erro}
            </div>
          )}

          {modo === 'recuperar-ok' ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-4xl text-sky-300">📧</div>
              <div>
                <h2 className="text-2xl font-semibold text-white">Email enviado</h2>
                <p className="mt-2 text-slate-400">
                  Enviamos um link de redefinição para <strong className="text-slate-200">{email}</strong>. Verifique sua caixa de entrada.
                </p>
              </div>
              <button
                onClick={() => setModo('login')}
                className="rounded-full button-secondary px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/80"
              >
                Voltar para o login
              </button>
            </div>
          ) : modo === 'recuperar' ? (
            <form onSubmit={handleRecuperar} className="space-y-5">
              <h2 className="text-2xl font-semibold text-white text-center mb-2">Recuperar senha</h2>
              <p className="text-slate-400 text-sm text-center mb-4">
                Informe seu email e enviaremos um link para redefinir sua senha.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="input-dark w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full button-primary px-6 py-4 text-sm font-semibold shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:opacity-70"
              >
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
              <button
                type="button"
                onClick={() => { setModo('login'); setErro(''); }}
                className="w-full rounded-full button-secondary px-6 py-3 text-sm font-semibold text-slate-300"
              >
                Voltar para o login
              </button>
            </form>
          ) : modo === 'confirmar' ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-4xl text-sky-300">📧</div>
              <div>
                <h2 className="text-2xl font-semibold text-white">Confirme seu email</h2>
                <p className="mt-2 text-slate-400">
                  Enviamos um link para <strong>{email}</strong>. Abra o email e confirme sua conta.
                </p>
              </div>
              <button
                onClick={() => setModo('login')}
                className="rounded-full button-secondary px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/80"
              >
                Voltar para o login
              </button>
            </div>
          ) : (
            <form onSubmit={modo === 'login' ? handleLogin : handleRegistro} className="space-y-5">
              <h2 className="text-2xl font-semibold text-white text-center mb-6">
                {modo === 'login' ? 'Acesse sua conta' : 'Criar nova conta'}
              </h2>

              {modo === 'registrar' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nome completo</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="João Silva"
                    className="input-dark w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="input-dark w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">Senha</label>
                  {modo === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setModo('recuperar'); setErro(''); }}
                      className="text-xs text-sky-400 hover:text-sky-300 transition"
                    >
                      Esqueceu sua senha?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="input-dark w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  required
                  minLength={modo === 'registrar' ? 6 : 1}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full button-primary px-6 py-4 text-sm font-semibold shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading
                  ? (modo === 'login' ? 'Entrando...' : 'Registrando...')
                  : (modo === 'login' ? 'Entrar' : 'Criar conta')}
              </button>
            </form>
          )}

          {modo !== 'confirmar' && modo !== 'recuperar' && modo !== 'recuperar-ok' && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-x-0 top-1/2 h-px bg-slate-700/80" />
                <p className="relative mx-auto w-fit bg-slate-950 px-3 text-xs uppercase tracking-[0.25em] text-slate-500">ou</p>
              </div>

              <button
                onClick={handleLoginGoogle}
                disabled={loading}
                className="w-full rounded-full bg-slate-900/90 border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/90 disabled:opacity-60"
              >
                🔵 Entrar com Google
              </button>

              <div className="mt-6 text-center text-sm text-slate-400">
                {modo === 'login' ? 'Não tem conta?' : 'Já possui conta?'}{' '}
                <button
                  type="button"
                  onClick={() => setModo(modo === 'login' ? 'registrar' : 'login')}
                  className="text-sky-300 hover:text-sky-200 font-semibold"
                >
                  {modo === 'login' ? 'Crie uma agora' : 'Faça login'}
                </button>
              </div>
            </>
          )}

          <div className="mt-6 rounded-3xl border border-slate-800/80 bg-slate-900/80 p-3 text-center text-xs text-slate-500">
            🔒 Dados protegidos por Supabase com segurança TLS e PostgreSQL.
          </div>
        </div>
      </div>
    </div>
  );
}
