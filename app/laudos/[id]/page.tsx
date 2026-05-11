'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  getLaudo,
  getAnalises,
  atualizarLaudo,
  adicionarAnalise,
  atualizarAnalise,
  deletarAnalise,
  finalizarLaudo,
  IDIOMAS_DISPONIVEIS,
  // uploadFoto, — REMOVIDO: fotos desabilitadas temporariamente
} from '@/lib/laudosServiceSupabase';
import { avaliarStatus, calcularStatusGeral } from '@/lib/avaliarAnalise';
import LogoAbuhler from '@/components/LogoAbuhler';

type Analise = {
  id: string;
  nome: string;
  specification: string;
  unidade: string;
  norma: string;
  tipo_foto: 'required' | 'optional' | 'none';
  resultado: string;
  status_analise: string | null;
  foto_url: string | null;
};

type Laudo = {
  id: string;
  numero: string;
  cliente: string;
  artigo: string;
  cor: string;
  op: string;
  responsavel: string;
  codigo_item: string;
  ordem_compra: string;
  metragem: string;
  lotes: string;
  status: string;
  observacoes: string;
  criado_em: string;
  finalizado_em: string | null;
  assinador_por: string | null;
};

const FOTO_LABELS = {
  required: { label: 'Obrigatória', cls: 'text-red-600' },
  optional: { label: 'Opcional', cls: 'text-yellow-600' },
  none: { label: 'Sem foto', cls: 'text-gray-400' },
};

const STATUS_BADGE = {
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-700',
};

const STATUS_LABEL = {
  approved: 'APROVADO',
  rejected: 'REPROVADO',
  draft: 'RASCUNHO',
};

const BLANK_ANALISE = {
  nome: '',
  specification: '',
  norma: '',
  tipo_foto: 'optional' as 'required' | 'optional' | 'none',
};

export default function LaudoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [idiomaSelecionado, setIdiomaSelecionado] = useState('pt-BR');

  // Inline laudo edit
  const [editandoInfo, setEditandoInfo] = useState(false);
  const [infoForm, setInfoForm] = useState<Partial<Laudo>>({});

  // New analysis form
  const [showAddAnalise, setShowAddAnalise] = useState(false);
  const [novaAnalise, setNovaAnalise] = useState(BLANK_ANALISE);
  const [adicionando, setAdicionando] = useState(false);

  const saveDebounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Removed: Photo upload state per analysis id
  // const [uploading, setUploading] = useState<Record<string, boolean>>({});
  // const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) router.replace('/');
      else if (id) carregar(mounted);
    });

    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function carregar(mounted = true) {
    setLoading(true);
    try {
      const [l, a] = await Promise.all([getLaudo(id), getAnalises(id)]);
      if (!mounted) return;
      setLaudo(l);
      setAnalises(a);
      setInfoForm(l);
    } finally {
      if (mounted) setLoading(false);
    }
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  }

  // ── Laudo info ──────────────────────────────────────────────
  async function handleSalvarInfo() {
    if (!laudo) return;
    setSalvando(true);
    try {
      await atualizarLaudo(laudo.id, {
        cliente: infoForm.cliente,
        artigo: infoForm.artigo,
        cor: infoForm.cor,
        op: infoForm.op,
        responsavel: infoForm.responsavel,
        observacoes: infoForm.observacoes,
      });
      setLaudo({ ...laudo, ...infoForm } as Laudo);
      setEditandoInfo(false);
      flash('Informações salvas.');
    } finally {
      setSalvando(false);
    }
  }

  // ── Análises ─────────────────────────────────────────────────
  async function handleAddAnalise() {
    if (!novaAnalise.nome.trim()) return;
    setAdicionando(true);
    try {
      const criada = await adicionarAnalise(id, {
        ...novaAnalise,
        resultado: null,
        status_analise: null,
        foto_url: null,
      });
      setAnalises((prev) => [...prev, criada]);
      setNovaAnalise(BLANK_ANALISE);
      setShowAddAnalise(false);
    } finally {
      setAdicionando(false);
    }
  }

  function handleResultadoChange(analise: Analise, valor: string) {
    const status = avaliarStatus(valor, analise.specification);
    const updated = { ...analise, resultado: valor, status_analise: status };

    // Atualiza UI imediatamente (otimista)
    setAnalises((prev) => prev.map((a) => (a.id === analise.id ? updated : a)));

    // Salva no Supabase só após 600ms sem digitar
    if (saveDebounceRefs.current[analise.id]) clearTimeout(saveDebounceRefs.current[analise.id]);
    saveDebounceRefs.current[analise.id] = setTimeout(() => {
      atualizarAnalise(analise.id, { resultado: valor, status_analise: status });
    }, 600);
  }

  async function handleDeletarAnalise(analiseId: string) {
    if (!confirm('Remover esta análise?')) return;
    await deletarAnalise(analiseId);
    setAnalises((prev) => prev.filter((a) => a.id !== analiseId));
  }

  // ── Foto ────────────────────────────────────────────────────── [DESABILITADO]
  // async function handleFotoChange(analise: Analise, file: File) {
  //   setUploading((prev) => ({ ...prev, [analise.id]: true }));
  //   try {
  //     const url = await uploadFoto(id, analise.id, file);
  //     await atualizarAnalise(analise.id, { foto_url: url });
  //     setAnalises((prev) => prev.map((a) => (a.id === analise.id ? { ...a, foto_url: url } : a)));
  //     flash('Foto enviada.');
  //   } catch (err: any) {
  //     flash(`Erro: ${err.message}`);
  //   } finally {
  //     setUploading((prev) => ({ ...prev, [analise.id]: false }));
  //   }
  // }

  // ── Finalizar ─────────────────────────────────────────────────
  async function handleFinalizar() {
    if (!laudo) return;

    // DESABILITADO: Validação de fotos obrigatórias
    // const faltamFotos = analises.filter(
    //   (a) => a.tipo_foto === 'required' && !a.foto_url
    // );
    // if (faltamFotos.length > 0) {
    //   alert(
    //     `Faltam fotos obrigatórias em:\n${faltamFotos.map((a) => `• ${a.nome}`).join('\n')}`
    //   );
    //   return;
    // }

    const statusGeral = calcularStatusGeral(
      analises.map((a) => ({
        resultado: a.resultado,
        specification: a.specification,
        status_analise: a.status_analise,
      }))
    );

    if (
      !confirm(
        `Finalizar laudo com status: ${STATUS_LABEL[statusGeral]}?\n\nEsta ação registra o responsável e a data de finalização.`
      )
    )
      return;

    setSalvando(true);
    try {
      await finalizarLaudo(laudo.id, null, statusGeral, idiomaSelecionado);
      await carregar();
      flash('Laudo finalizado.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert(`Erro ao finalizar laudo: ${msg}`);
    } finally {
      setSalvando(false);
    }
  }

  // ── Render helpers ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="glass-card rounded-[2rem] border-slate-800/90 p-10 text-center shadow-[0_35px_120px_-80px_rgba(56,189,248,0.45)]">
          <p className="text-2xl font-semibold text-white">Carregando laudo...</p>
          <p className="mt-2 text-sm text-slate-400">Aguarde um momento enquanto recuperamos os dados.</p>
        </div>
      </div>
    );
  }

  if (!laudo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="glass-card rounded-[2rem] border-slate-800/90 p-10 text-center shadow-[0_35px_120px_-80px_rgba(56,189,248,0.45)]">
          <p className="text-xl font-semibold text-white">Laudo não encontrado.</p>
          <p className="mt-2 text-sm text-slate-400">Verifique se o link está correto ou retorne ao painel.</p>
          <Link href="/" className="mt-5 inline-flex rounded-full button-primary px-5 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20">
            Voltar ao painel
          </Link>
        </div>
      </div>
    );
  }

  const statusGeral = calcularStatusGeral(
    analises.map((a) => ({
      resultado: a.resultado,
      specification: a.specification,
      status_analise: a.status_analise,
    }))
  );

  const finalizado = laudo.status !== 'draft';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-sky-500/10 via-transparent to-transparent" />

      {/* Nav */}
      <nav className="relative mb-6 border-b border-slate-800/90 bg-slate-950/95 px-4 py-4 backdrop-blur-xl print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-400 min-w-0">
            <Link href="/">
              <LogoAbuhler height={28} invertido />
            </Link>
            <span className="text-slate-600 hidden sm:inline">/</span>
            <span className="font-mono font-semibold text-white hidden sm:inline">{laudo.numero}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/"
              className="rounded-full border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 sm:px-4 sm:py-2 text-sm text-slate-200 transition hover:border-slate-500 whitespace-nowrap"
            >
              ← Início
            </Link>
            <a
              href={`/laudos/${id}/imprimir`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 sm:px-4 sm:py-2 text-sm text-slate-200 transition hover:border-slate-500 whitespace-nowrap hidden sm:inline-flex"
            >
              Imprimir / PDF
            </a>
            {!finalizado && (
              <button
                onClick={handleFinalizar}
                disabled={salvando}
                className="rounded-full button-primary px-5 py-2 text-sm font-semibold shadow-lg shadow-sky-500/15 transition hover:brightness-110 disabled:opacity-60"
              >
                Finalizar Laudo
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Flash message */}
      {msg && (
        <div className="max-w-5xl mx-auto px-4 pb-2 md:px-6">
          <div className="glass-card rounded-[1.75rem] border-emerald-500/20 p-4 text-sm text-emerald-100">
            {msg}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 pb-12 md:px-6 space-y-6">
        {/* Header card */}
        <section className="glass-card rounded-[2rem] border-slate-800/90 p-6 shadow-[0_30px_120px_-70px_rgba(56,189,248,0.45)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-sky-400/75">Número do Laudo</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">{laudo.numero}</h1>
              <p className="mt-2 text-sm text-slate-400">
                Criado em {new Date(laudo.criado_em).toLocaleDateString('pt-BR')}
                {laudo.finalizado_em &&
                  ` · Finalizado em ${new Date(laudo.finalizado_em).toLocaleDateString('pt-BR')}`}
                {laudo.assinador_por && ` · Assinado por ${laudo.assinador_por}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                  statusGeral === 'approved'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : statusGeral === 'rejected'
                    ? 'bg-rose-500/15 text-rose-300'
                    : 'bg-slate-800/70 text-slate-200'
                }`}
              >
                {STATUS_LABEL[statusGeral]}
              </span>
              {!finalizado && !editandoInfo && (
                <button
                  onClick={() => setEditandoInfo(true)}
                  className="text-sm font-semibold text-sky-300 transition hover:text-sky-200"
                >
                  Editar informações
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Info section */}
        <section className="glass-card rounded-[2rem] border-slate-800/90 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Informações do produto
            </h2>
          </div>

          {editandoInfo ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ['cliente', 'Cliente'],
                    ['artigo', 'Artigo'],
                    ['cor', 'Cor'],
                    ['op', 'OP'],
                    ['responsavel', 'Responsável'],
                    ['codigo_item', 'Código do item'],
                    ['ordem_compra', 'Ordem de compra'],
                    ['metragem', 'Metragem'],
                    ['lotes', 'Lotes'],
                  ] as [keyof Laudo, string][]
                ).map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="text-sm font-medium text-slate-300">{label}</span>
                    <input
                      value={(infoForm[field] as string) ?? ''}
                      onChange={(e) => setInfoForm({ ...infoForm, [field]: e.target.value })}
                      className="input-dark mt-2 w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                    />
                  </label>
                ))}
              </div>
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Observações</span>
                <textarea
                  value={(infoForm.observacoes as string) ?? ''}
                  onChange={(e) => setInfoForm({ ...infoForm, observacoes: e.target.value })}
                  rows={4}
                  className="input-dark mt-2 w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSalvarInfo}
                  disabled={salvando}
                  className="rounded-full button-primary px-5 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20 disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button
                  onClick={() => {
                    setInfoForm(laudo);
                    setEditandoInfo(false);
                  }}
                  className="rounded-full button-secondary px-5 py-3 text-sm font-semibold text-slate-300 hover:text-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid gap-4 md:grid-cols-3 text-sm">
              {[
                ['Cliente', laudo.cliente],
                ['Artigo', laudo.artigo],
                ['Cor', laudo.cor],
                ['OP', laudo.op],
                ['Responsável', laudo.responsavel],
                ...(laudo.codigo_item ? [['Código do item', laudo.codigo_item]] : []),
                ...(laudo.ordem_compra ? [['Ordem de compra', laudo.ordem_compra]] : []),
                ...(laudo.metragem ? [['Metragem', laudo.metragem]] : []),
                ...(laudo.lotes ? [['Lotes', laudo.lotes]] : []),
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</dt>
                  <dd className="mt-2 text-base font-semibold text-slate-100">{value || '—'}</dd>
                </div>
              ))}
              {laudo.observacoes && (
                <div className="md:col-span-3">
                  <dt className="text-xs uppercase tracking-[0.25em] text-slate-500">Observações</dt>
                  <dd className="mt-2 text-slate-300 whitespace-pre-line">{laudo.observacoes}</dd>
                </div>
              )}
            </dl>
          )}
        </section>

        {/* Analyses */}
        <section className="glass-card rounded-[2rem] border-slate-800/90 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Análises ({analises.length})
            </h2>
            {!finalizado && (
              <button
                onClick={() => setShowAddAnalise(!showAddAnalise)}
                className="text-sm font-semibold text-sky-300 transition hover:text-sky-200"
              >
                {showAddAnalise ? 'Cancelar' : '+ Adicionar análise'}
              </button>
            )}
          </div>

          {showAddAnalise && (
            <div className="mb-6 rounded-[1.75rem] border border-slate-800/80 bg-slate-900/80 p-5">
              <p className="mb-4 text-sm font-semibold text-slate-100">Nova análise</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  placeholder="Nome da análise *"
                  value={novaAnalise.nome}
                  onChange={(e) => setNovaAnalise({ ...novaAnalise, nome: e.target.value })}
                  className="input-dark rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
                <input
                  placeholder="Especificação (ex: >3.5)"
                  value={novaAnalise.specification}
                  onChange={(e) => setNovaAnalise({ ...novaAnalise, specification: e.target.value })}
                  className="input-dark rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
                <textarea
                  placeholder="Norma — código e descrição"
                  value={novaAnalise.norma}
                  onChange={(e) => setNovaAnalise({ ...novaAnalise, norma: e.target.value })}
                  rows={3}
                  className="col-span-full input-dark rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
                <select
                  value={novaAnalise.tipo_foto}
                  onChange={(e) =>
                    setNovaAnalise({
                      ...novaAnalise,
                      tipo_foto: e.target.value as 'required' | 'optional' | 'none',
                    })
                  }
                  className="input-dark rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                >
                  <option value="required">Foto obrigatória</option>
                  <option value="optional">Foto opcional</option>
                  <option value="none">Sem foto</option>
                </select>
              </div>
              <div className="mt-5">
                <button
                  onClick={handleAddAnalise}
                  disabled={adicionando || !novaAnalise.nome.trim()}
                  className="rounded-full button-primary px-5 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20 disabled:opacity-60"
                >
                  {adicionando ? 'Adicionando...' : 'Adicionar análise'}
                </button>
              </div>
            </div>
          )}

          {analises.length === 0 ? (
            <div className="rounded-[1.75rem] border border-slate-800/80 bg-slate-900/80 p-8 text-center text-slate-400">
              Nenhuma análise disponível. Adicione a nova análise para começar.
            </div>
          ) : (
            <div className="space-y-4">
              {analises.map((analise) => {
                const statusCalc =
                  avaliarStatus(analise.resultado, analise.specification) ?? analise.status_analise;
                const fotoInfo = FOTO_LABELS[analise.tipo_foto];

                return (
                  <div
                    key={analise.id}
                    className={`rounded-[1.5rem] border p-4 ${
                      statusCalc === 'approved'
                        ? 'border-emerald-500/20 bg-emerald-500/10'
                        : statusCalc === 'rejected'
                        ? 'border-rose-500/20 bg-rose-500/10'
                        : 'border-slate-800/80 bg-slate-900/80'
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-100">{analise.nome}</p>
                          {statusCalc && (
                            <span
                              className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                statusCalc === 'approved'
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : statusCalc === 'rejected'
                                  ? 'bg-rose-500/15 text-rose-300'
                                  : 'bg-slate-800/70 text-slate-300'
                              }`}
                            >
                              {STATUS_LABEL[statusCalc as keyof typeof STATUS_LABEL]}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-400">
                          Esp: <span className="font-mono text-slate-200">{analise.specification || '—'}</span>
                          {analise.unidade && <span className="text-amber-400/80 font-mono"> · {analise.unidade}</span>}
                          {analise.norma && ` · ${analise.norma}`}
                          {' · '}
                          <span className={fotoInfo.cls}>{fotoInfo.label}</span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {!finalizado ? (
                          <div className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/90 px-3 py-2">
                            <span className="text-xs text-slate-400">Resultado</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={analise.resultado ?? ''}
                              onChange={(e) => handleResultadoChange(analise, e.target.value)}
                              placeholder="0.0"
                              className="w-24 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1 text-center text-sm font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                            />
                            {analise.unidade && (
                              <span className="text-xs text-amber-400/80 font-mono">{analise.unidade}</span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm font-mono font-semibold text-slate-100">
                            {analise.resultado || '—'}{analise.unidade ? ` ${analise.unidade}` : ''}
                          </p>
                        )}
                        {!finalizado && (
                          <button
                            onClick={() => handleDeletarAnalise(analise.id)}
                            className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-300 transition hover:text-rose-200"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Result summary */}
        {analises.length > 0 && (
          <section className="glass-card rounded-[2rem] border-slate-800/90 p-6">
            {!finalizado && (
              <div className="mb-6">
                <label className="block text-sm font-semibold uppercase tracking-[0.3em] text-slate-400 mb-3">
                  Idioma do laudo
                </label>
                <div className="grid gap-3 sm:grid-cols-4">
                  {IDIOMAS_DISPONIVEIS.map((idioma) => (
                    <button
                      key={idioma.codigo}
                      onClick={() => setIdiomaSelecionado(idioma.codigo)}
                      className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        idiomaSelecionado === idioma.codigo
                          ? 'bg-sky-500/15 text-sky-300 border border-sky-500/20'
                          : 'bg-slate-900/90 text-slate-300 border border-slate-800/80 hover:bg-slate-900'
                      }`}
                    >
                      {idioma.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">Selecione o idioma final para exportação do laudo.</p>
              </div>
            )}

            {/* Progress bar */}
            {!finalizado && (() => {
              const comResultado = analises.filter((a) => a.resultado).length;
              const total = analises.length;
              const pct = Math.round((comResultado / total) * 100);
              return (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Resultados preenchidos</span>
                    <span>{comResultado} / {total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct === 100 ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            <div
              className={`rounded-[1.75rem] p-6 text-center ${
                statusGeral === 'approved'
                  ? 'bg-emerald-600'
                  : statusGeral === 'rejected'
                  ? 'bg-rose-600'
                  : 'bg-slate-700'
              }`}
            >
              <p className="text-3xl font-bold text-white">
                {statusGeral === 'approved'
                  ? '✅ LAUDO APROVADO'
                  : statusGeral === 'rejected'
                  ? '❌ LAUDO REPROVADO'
                  : '⏳ AGUARDANDO RESULTADOS'}
              </p>
              {finalizado && laudo.finalizado_em && (
                <p className="mt-2 text-sm text-white/70">
                  Finalizado em {new Date(laudo.finalizado_em).toLocaleDateString('pt-BR')}
                </p>
              )}
              {!finalizado && statusGeral !== 'draft' && (
                <button
                  onClick={handleFinalizar}
                  disabled={salvando}
                  className="mt-5 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-slate-900/20 disabled:opacity-60"
                >
                  {salvando ? 'Finalizando...' : 'Finalizar e registrar'}
                </button>
              )}
              {!finalizado && statusGeral === 'draft' && (
                <p className="mt-3 text-sm text-white/60">
                  Preencha todos os resultados para finalizar
                </p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
