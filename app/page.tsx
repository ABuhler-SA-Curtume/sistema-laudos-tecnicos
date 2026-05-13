'use client';

import { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import LoginSupabase from '@/components/LoginSupabase';
import LogoAbuhler from '@/components/LogoAbuhler';
import { supabase } from '@/lib/supabaseClient';
import {
  logout,
  obterEstatisticas,
  meuHistoricoLaudos,
  deletarLaudo,
  duplicarLaudo,
} from '@/lib/laudosServiceSupabase';

type Laudo = {
  id: string;
  numero: string;
  cliente: string;
  artigo: string;
  cor: string;
  op: string;
  status: 'draft' | 'approved' | 'rejected';
  criado_em: string;
  idioma_pdf?: string | null;
};

const IDIOMA_FLAG: Record<string, string> = {
  'pt-BR': '🇧🇷',
  'en-US': '🇬🇧',
};

type Stats = {
  total: number;
  aprovados: number;
  reprovados: number;
  taxa: number;
};

const STATUS_MAP = {
  approved: { label: 'APROVADO', cls: 'bg-emerald-500/15 text-emerald-300' },
  rejected: { label: 'REPROVADO', cls: 'bg-rose-500/15 text-rose-300' },
  draft: { label: 'RASCUNHO', cls: 'bg-slate-800/70 text-slate-300' },
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, aprovados: 0, reprovados: 0, taxa: 0 });
  const [laudos, setLaudos] = useState<Laudo[]>([]);
  const [loadingLaudos, setLoadingLaudos] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroNumero, setFiltroNumero] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref síncrono do userId — disponível imediatamente, sem esperar o ciclo de render do state
  const userIdRef = useRef<string | null>(null);
  // Impede que o debounce do filtroNumero dispare na montagem inicial
  const initialMountRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    // getSession() auto-refreshes the token before returning — fonte confiável
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      userIdRef.current = u?.id ?? null;
      setUser(u);
      if (u) await carregarDados({}, u.id);
      clearTimeout(safetyTimer);
      if (mounted) setLoading(false);
    }).catch(() => {
      clearTimeout(safetyTimer);
      if (mounted) setLoading(false);
    });

    // onAuthStateChange apenas limpa o estado no logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        userIdRef.current = null;
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Auto-search por número (não dispara na montagem inicial)
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const filtros: Record<string, string> = {};
      if (filtroStatus) filtros.status = filtroStatus;
      if (filtroCliente) filtros.cliente = filtroCliente;
      if (filtroNumero) filtros.numero = filtroNumero;
      carregarDados(filtros);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filtroNumero]);

  async function carregarDados(filtros: Record<string, string> = {}, uid?: string) {
    const userId = uid ?? userIdRef.current;
    if (!userId) return;
    setLoadingLaudos(true);
    try {
      const [statsData, laudosData] = await Promise.all([
        obterEstatisticas(userId),
        meuHistoricoLaudos(filtros, userId),
      ]);
      setStats(statsData);
      setLaudos(laudosData);
    } finally {
      setLoadingLaudos(false);
    }
  }

  async function handleFiltrar() {
    const filtros: Record<string, string> = {};
    if (filtroStatus) filtros.status = filtroStatus;
    if (filtroCliente) filtros.cliente = filtroCliente;
    if (filtroNumero) filtros.numero = filtroNumero;
    await carregarDados(filtros);
  }

  async function handleLimpar() {
    setFiltroStatus('');
    setFiltroCliente('');
    setFiltroNumero('');
    await carregarDados();
  }

  async function handleLoginSuccess(loggedUser: User) {
    userIdRef.current = loggedUser.id;
    setUser(loggedUser);
    await carregarDados({}, loggedUser.id);
    setLoading(false);
  }

  async function handleLogout() {
    await logout();
    window.location.href = '/';
  }

  async function handleDeletar(id: string) {
    if (!confirm('Deletar este laudo permanentemente?')) return;
    await deletarLaudo(id);
    await carregarDados();
  }

  async function handleDuplicar(id: string) {
    const novo = await duplicarLaudo(id);
    window.location.href = `/laudos/${novo.id}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="glass-card px-10 py-8 text-center">
          <p className="text-2xl font-semibold">Carregando painel...</p>
          <p className="mt-2 text-sm text-slate-400">Preparando sua experiência.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginSupabase onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-sky-500/10 via-transparent to-transparent" />

      {/* Nav */}
      <nav className="relative mb-6 border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-xl shadow-[0_20px_120px_-60px_rgba(0,0,0,0.6)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-sky-400/70">Laudos Técnicos</p>
            <LogoAbuhler height={32} invertido />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-sm text-slate-400 hidden sm:inline">{user.email}</span>
            <Link
              href="/admin/templates"
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              Admin
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-full bg-gradient-to-r from-red-500 to-rose-500 px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition hover:brightness-110 whitespace-nowrap"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>

      <main className="relative max-w-7xl mx-auto px-4 pb-12 md:px-6">
        {/* Hero */}
        <section className="glass-card rounded-[2rem] border-slate-800/90 p-5 sm:p-8 shadow-[0_30px_120px_-70px_rgba(56,189,248,0.45)]">
          <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs sm:text-sm uppercase tracking-[0.35em] text-sky-400/75">Qualidade que se comprova</p>
              <h2 className="mt-2 sm:mt-3 text-2xl sm:text-4xl font-semibold text-white leading-tight">
                Excelência em couro.<br />Rastreabilidade em cada laudo.
              </h2>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-300/90 leading-6 sm:leading-7">
                A <strong className="text-white">A. Bühler S/A Curtume</strong> desenvolve couros de alta
                performance para as principais marcas nacionais e internacionais. Este sistema assegura que
                cada lote entregue atenda aos mais rigorosos padrões de qualidade — com laudos técnicos
                rastreáveis, auditáveis e produzidos com excelência.
              </p>
            </div>
            <Link
              href="/laudos/novo"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 sm:shrink-0 w-full sm:w-auto"
            >
              + Novo Laudo
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 mt-4 sm:mt-6 sm:gap-4 xl:grid-cols-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-100' },
            { label: 'Aprovados', value: stats.aprovados, color: 'text-emerald-300' },
            { label: 'Reprovados', value: stats.reprovados, color: 'text-rose-300' },
            { label: 'Taxa de aprovação', value: `${stats.taxa}%`, color: 'text-sky-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card rounded-[1.5rem] sm:rounded-[1.75rem] border-slate-800/80 p-4 sm:p-5">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-slate-400">{label}</p>
              <p className={`mt-2 sm:mt-4 text-3xl sm:text-4xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        {/* Filters */}
        <section className="glass-card mt-4 sm:mt-6 rounded-[2rem] border-slate-800/90 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            {/* Busca por número — auto-search */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono pointer-events-none">
                LAB-
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="2000"
                value={filtroNumero}
                onChange={(e) => setFiltroNumero(e.target.value.replace(/\D/g, ''))}
                className="input-dark w-full rounded-2xl pl-14 pr-4 py-3 text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
              />
            </div>

            <input
              type="text"
              placeholder="Buscar cliente"
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFiltrar()}
              className="input-dark w-full rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
            />

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="input-dark w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
            >
              <option value="">Todos os status</option>
              <option value="draft">Rascunho</option>
              <option value="approved">Aprovado</option>
              <option value="rejected">Reprovado</option>
            </select>

            <div className="flex gap-3">
              <button
                onClick={handleFiltrar}
                className="flex-1 rounded-full button-primary px-5 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20 transition hover:brightness-110"
              >
                Filtrar
              </button>
              {(filtroStatus || filtroCliente || filtroNumero) && (
                <button
                  onClick={handleLimpar}
                  className="rounded-full button-secondary px-5 py-3 text-sm font-semibold text-slate-300 hover:text-slate-100"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Table */}
        {loadingLaudos ? (
          <div className="glass-card mt-4 sm:mt-6 rounded-[2rem] border-slate-800/90 p-8 sm:p-12 text-center text-slate-400">
            Carregando registros...
          </div>
        ) : laudos.length === 0 ? (
          <div className="glass-card mt-4 sm:mt-6 rounded-[2rem] border-slate-800/90 p-8 sm:p-12 text-center">
            <div className="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/80 text-4xl text-sky-300 shadow-inner shadow-sky-500/10">
              📋
            </div>
            <p className="text-xl font-semibold text-slate-100">Nenhum laudo encontrado</p>
            <p className="mt-2 text-sm text-slate-400">Crie um novo laudo e comece hoje mesmo.</p>
            <Link
              href="/laudos/novo"
              className="mt-6 inline-flex rounded-full button-primary px-6 py-3 text-sm font-semibold shadow-lg shadow-sky-500/25"
            >
              Criar primeiro laudo
            </Link>
          </div>
        ) : (
          <div className="glass-card mt-4 sm:mt-6 overflow-hidden rounded-[2rem] border-slate-800/90">
            <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="bg-slate-900/90 text-slate-400">
                <tr>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-left font-semibold tracking-wide">Número</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-left font-semibold tracking-wide">Cliente</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-left font-semibold tracking-wide hidden md:table-cell">Artigo</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-left font-semibold tracking-wide hidden lg:table-cell">Data</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-left font-semibold tracking-wide">Status</th>
                  <th className="px-3 sm:px-4 py-3 sm:py-4 text-left font-semibold tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {laudos.map((laudo) => {
                  const s = STATUS_MAP[laudo.status] ?? STATUS_MAP.draft;
                  return (
                    <tr key={laudo.id} className="border-t border-slate-800/80 transition hover:bg-slate-900/80">
                      <td className="px-3 sm:px-4 py-3 sm:py-4 font-mono font-semibold text-sky-300 whitespace-nowrap">{laudo.numero}</td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 text-slate-200 max-w-[120px] sm:max-w-none truncate">{laudo.cliente}</td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 hidden md:table-cell text-slate-400">{laudo.artigo}</td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 hidden lg:table-cell text-slate-400 whitespace-nowrap">
                        {new Date(laudo.criado_em).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex rounded-full px-2 sm:px-3 py-1 text-xs font-semibold whitespace-nowrap ${s.cls}`}>
                            {s.label}
                          </span>
                          {laudo.idioma_pdf && IDIOMA_FLAG[laudo.idioma_pdf] && (
                            <span className="text-base leading-none" title={laudo.idioma_pdf}>
                              {IDIOMA_FLAG[laudo.idioma_pdf]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex gap-2 sm:gap-3 text-sm">
                          <Link href={`/laudos/${laudo.id}`} className="text-sky-300 hover:text-sky-200 whitespace-nowrap">
                            Abrir
                          </Link>
                          <button onClick={() => handleDuplicar(laudo.id)} className="text-slate-400 hover:text-slate-100 whitespace-nowrap">
                            Duplicar
                          </button>
                          <button onClick={() => handleDeletar(laudo.id)} className="text-rose-300 hover:text-rose-200 whitespace-nowrap">
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
