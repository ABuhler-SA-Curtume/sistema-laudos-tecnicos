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
  uploadFotoAnalise,
  listarCatalogoAnalises,
} from '@/lib/laudosServiceSupabase';
import { avaliarStatus, calcularStatusGeral, calcularMedia } from '@/lib/avaliarAnalise';
import LogoAbuhler from '@/components/LogoAbuhler';

type Analise = {
  id: string;
  nome: string;
  specification: string;
  unidade: string;
  norma: string;
  tipo_foto: 'required' | 'optional' | 'none';
  resultado: string;
  medicoes: string[];
  status_analise: string | null;
  foto_url: string | null;
};

type NormaRef = { codigo: string; specification?: string; unidade?: string };

type CatalogoAnalise = {
  id: string;
  nome: string;
  specification: string;
  unidade: string;
  tipo_foto: string;
  norma?: NormaRef | null;
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
  idioma_pdf?: string | null;
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

// Catalog modal state kept separately — no blank analise needed

export default function LaudoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [idiomaSelecionado, setIdiomaSelecionado] = useState('pt-BR');
  const [uploadingFoto, setUploadingFoto] = useState<Record<string, boolean>>({});

  // Inline laudo edit
  const [editandoInfo, setEditandoInfo] = useState(false);
  const [infoForm, setInfoForm] = useState<Partial<Laudo>>({});

  // Catalog modal
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogoAnalise[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSelected, setCatalogSelected] = useState<Set<string>>(new Set());
  const [catalogLoading, setCatalogLoading] = useState(false);
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
      setAnalises(a.map((an: Analise) => ({ ...an, medicoes: an.medicoes.length > 0 ? an.medicoes : [''] })));
      setInfoForm(l);
      if (l.idioma_pdf) setIdiomaSelecionado(l.idioma_pdf);
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

  // ── Catálogo de análises ──────────────────────────────────────
  async function abrirCatalogo() {
    setShowCatalog(true);
    setCatalogSearch('');
    setCatalogSelected(new Set());
    setCatalogLoading(true);
    try {
      const dados = await listarCatalogoAnalises('');
      // normaliza norma que pode vir como array do Supabase join
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalizados: CatalogoAnalise[] = (dados as any[]).map((c) => ({
        ...c,
        norma: Array.isArray(c.norma) ? (c.norma[0] ?? null) : (c.norma ?? null),
      }));
      setCatalogItems(normalizados);
    } finally {
      setCatalogLoading(false);
    }
  }

  function toggleCatalogItem(itemId: string) {
    setCatalogSelected((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  async function handleAddFromCatalog() {
    if (catalogSelected.size === 0) return;
    setAdicionando(true);
    try {
      const selecionadas = catalogItems.filter((c) => catalogSelected.has(c.id));
      const criadas = await Promise.all(
        selecionadas.map((c, i) => {
          return adicionarAnalise(id, {
            nome: c.nome,
            norma: c.norma?.codigo || '',
            specification: c.specification || c.norma?.specification || '',
            unidade: c.unidade || c.norma?.unidade || '',
            tipo_foto: c.tipo_foto || 'optional',
            resultado: null,
            medicoes: [''],
            status_analise: null,
            foto_url: null,
            ordem: analises.length + i,
          });
        })
      );
      setAnalises((prev) => [...prev, ...criadas.map((c) => ({ ...c, medicoes: Array.isArray(c.medicoes) && c.medicoes.length > 0 ? c.medicoes : [''] }))]);
      setShowCatalog(false);
    } finally {
      setAdicionando(false);
    }
  }

  // ── Medições por análise ──────────────────────────────────────
  function handleMedicaoChange(analise: Analise, idx: number, valor: string) {
    const novasMedicoes = analise.medicoes.map((m, i) => (i === idx ? valor : m));
    const media = calcularMedia(novasMedicoes) ?? '';
    const status = avaliarStatus(media, analise.specification);
    const updated = { ...analise, medicoes: novasMedicoes, resultado: media, status_analise: status };

    setAnalises((prev) => prev.map((a) => (a.id === analise.id ? updated : a)));

    if (saveDebounceRefs.current[analise.id]) clearTimeout(saveDebounceRefs.current[analise.id]);
    saveDebounceRefs.current[analise.id] = setTimeout(() => {
      atualizarAnalise(analise.id, { medicoes: novasMedicoes, resultado: media, status_analise: status });
    }, 600);
  }

  function handleAdicionarMedicao(analise: Analise) {
    const novasMedicoes = [...analise.medicoes, ''];
    const updated = { ...analise, medicoes: novasMedicoes };
    setAnalises((prev) => prev.map((a) => (a.id === analise.id ? updated : a)));
  }

  function handleRemoverMedicao(analise: Analise, idx: number) {
    const novasMedicoes = analise.medicoes.filter((_, i) => i !== idx);
    const media = calcularMedia(novasMedicoes) ?? '';
    const status = avaliarStatus(media, analise.specification);
    const updated = { ...analise, medicoes: novasMedicoes, resultado: media, status_analise: status };

    setAnalises((prev) => prev.map((a) => (a.id === analise.id ? updated : a)));

    if (saveDebounceRefs.current[analise.id]) clearTimeout(saveDebounceRefs.current[analise.id]);
    saveDebounceRefs.current[analise.id] = setTimeout(() => {
      atualizarAnalise(analise.id, { medicoes: novasMedicoes, resultado: media, status_analise: status });
    }, 600);
  }

  async function handleDeletarAnalise(analiseId: string) {
    if (!confirm('Remover esta análise?')) return;
    await deletarAnalise(analiseId);
    setAnalises((prev) => prev.filter((a) => a.id !== analiseId));
  }

  // ── Fotos por análise ─────────────────────────────────────────
  async function comprimirImagem(file: File): Promise<File> {
    return new Promise((resolve) => {
      const MAX = 1400;
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (blob) => resolve(blob
              ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
              : file
            ),
            'image/jpeg', 0.82
          );
        } catch {
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file); // usa o arquivo original se compressão falhar
      };

      img.src = objectUrl;
    });
  }

  async function handleFotoChange(analise: Analise, file: File) {
    setUploadingFoto(prev => ({ ...prev, [analise.id]: true }));
    try {
      const compressed = await comprimirImagem(file);
      const url = await uploadFotoAnalise(id, analise.id, compressed);
      await atualizarAnalise(analise.id, { foto_url: url });
      setAnalises(prev => prev.map(a => a.id === analise.id ? { ...a, foto_url: url } : a));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Erro ao enviar foto:\n${msg}`);
    } finally {
      setUploadingFoto(prev => ({ ...prev, [analise.id]: false }));
    }
  }

  async function handleDeletarFotoAnalise(analise: Analise) {
    if (!confirm('Remover foto desta análise?')) return;
    await atualizarAnalise(analise.id, { foto_url: null });
    setAnalises(prev => prev.map(a => a.id === analise.id ? { ...a, foto_url: null } : a));
  }

  // ── Finalizar ─────────────────────────────────────────────────
  async function handleFinalizar() {
    if (!laudo) return;

    const faltamFotos = analises.filter(a => a.tipo_foto === 'required' && !a.foto_url);
    if (faltamFotos.length > 0) {
      alert(`Faltam fotos obrigatórias em:\n${faltamFotos.map(a => `• ${a.nome}`).join('\n')}`);
      return;
    }

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
              href={`/laudos/${id}/imprimir?lang=${idiomaSelecionado}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 sm:px-4 sm:py-2 text-sm text-slate-200 transition hover:border-slate-500 whitespace-nowrap"
            >
              <span className="sm:hidden">PDF</span>
              <span className="hidden sm:inline">Imprimir / PDF</span>
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
                    ['lotes', 'Marca'],
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
                ...(laudo.lotes ? [['Marca', laudo.lotes]] : []),
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
                onClick={abrirCatalogo}
                className="text-sm font-semibold text-sky-300 transition hover:text-sky-200"
              >
                + Adicionar análise
              </button>
            )}
          </div>

          {/* Modal catálogo */}
          {showCatalog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-[2rem] border border-slate-800/90 bg-slate-900 shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
                  <p className="text-sm font-semibold text-slate-100">Adicionar análises do catálogo</p>
                  <button onClick={() => setShowCatalog(false)} className="text-slate-400 hover:text-slate-200 text-lg leading-none">✕</button>
                </div>
                <div className="px-6 pb-3">
                  <input
                    autoFocus
                    placeholder="Pesquisar análise..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="input-dark w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  />
                </div>
                <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-1">
                  {catalogLoading ? (
                    <p className="py-6 text-center text-sm text-slate-400">Carregando...</p>
                  ) : catalogItems.filter((c) =>
                      c.nome.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                      (c.norma?.codigo || '').toLowerCase().includes(catalogSearch.toLowerCase())
                    ).length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">Nenhuma análise encontrada.</p>
                  ) : (
                    catalogItems
                      .filter((c) =>
                        c.nome.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                        (c.norma?.codigo || '').toLowerCase().includes(catalogSearch.toLowerCase())
                      )
                      .map((c) => (
                        <label
                          key={c.id}
                          className={`flex items-start gap-3 rounded-2xl border p-3 cursor-pointer transition ${
                            catalogSelected.has(c.id)
                              ? 'border-sky-500/40 bg-sky-500/10'
                              : 'border-slate-800/60 bg-slate-950/40 hover:border-slate-700/80'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={catalogSelected.has(c.id)}
                            onChange={() => toggleCatalogItem(c.id)}
                            className="mt-0.5 accent-sky-500"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-100">{c.nome}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {c.specification && <span className="font-mono text-slate-300">{c.specification}</span>}
                              {c.unidade && <span className="text-amber-400/80 font-mono"> {c.unidade}</span>}
                              {c.norma?.codigo && <span className="text-slate-500"> · {c.norma.codigo}</span>}
                            </p>
                          </div>
                        </label>
                      ))
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-800/60">
                  <span className="text-xs text-slate-400">
                    {catalogSelected.size > 0 ? `${catalogSelected.size} selecionada(s)` : 'Nenhuma selecionada'}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCatalog(false)}
                      className="rounded-full button-secondary px-4 py-2 text-sm font-semibold text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAddFromCatalog}
                      disabled={adicionando || catalogSelected.size === 0}
                      className="rounded-full button-primary px-5 py-2 text-sm font-semibold shadow-lg shadow-sky-500/20 disabled:opacity-60"
                    >
                      {adicionando ? 'Adicionando...' : 'Adicionar'}
                    </button>
                  </div>
                </div>
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

                      <div className="flex flex-col gap-2 items-end">
                        {!finalizado ? (
                          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 px-3 py-2 flex flex-col gap-2 min-w-[180px]">
                            {analise.medicoes.map((m, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 w-8 shrink-0">CP {idx + 1}</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={m}
                                  onChange={(e) => handleMedicaoChange(analise, idx, e.target.value)}
                                  placeholder="0.0"
                                  className="w-20 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1 text-center text-sm font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                                />
                                {analise.unidade && (
                                  <span className="text-[11px] font-mono text-amber-400/80">{analise.unidade}</span>
                                )}
                                {analise.medicoes.length > 1 && (
                                  <button
                                    onClick={() => handleRemoverMedicao(analise, idx)}
                                    className="text-[11px] text-rose-400 hover:text-rose-300 leading-none"
                                    title="Remover medição"
                                  >✕</button>
                                )}
                              </div>
                            ))}
                            {analise.medicoes.length > 1 && analise.resultado && (
                              <div className="flex items-center gap-1.5 border-t border-slate-800/60 pt-1.5 mt-0.5">
                                <span className="text-[11px] text-slate-400 w-8 shrink-0">Méd.</span>
                                <span className="w-20 text-center text-sm font-mono font-semibold text-sky-300">
                                  {analise.resultado}
                                </span>
                                {analise.unidade && (
                                  <span className="text-[11px] font-mono text-amber-400/80">{analise.unidade}</span>
                                )}
                              </div>
                            )}
                            <button
                              onClick={() => handleAdicionarMedicao(analise)}
                              className="mt-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 text-left"
                            >
                              + Medição
                            </button>
                          </div>
                        ) : (
                          <div className="text-right">
                            {analise.medicoes.length > 1 ? (
                              <div className="text-xs text-slate-400 space-y-0.5">
                                {analise.medicoes.map((m, idx) => (
                                  <div key={idx}>CP {idx + 1}: <span className="font-mono text-slate-200">{m}</span></div>
                                ))}
                                <div className="border-t border-slate-700/60 pt-0.5 font-semibold text-sky-300">
                                  Méd: <span className="font-mono">{analise.resultado}</span>
                                  {analise.unidade && <span className="text-amber-400/80 font-mono"> {analise.unidade}</span>}
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm font-mono font-semibold text-slate-100">
                                {analise.resultado || '—'}{analise.unidade ? ` ${analise.unidade}` : ''}
                              </p>
                            )}
                          </div>
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

        {/* Registro Fotográfico — uma foto por análise */}
        {analises.some(a => a.tipo_foto !== 'none') && (
          <section className="glass-card rounded-[2rem] border-slate-800/90 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400 mb-4">
              Registro Fotográfico
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {analises.filter(a => a.tipo_foto !== 'none').map(analise => (
                <div key={analise.id} className="group relative flex flex-col">
                  {analise.foto_url ? (
                    <div className="rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-900/80 flex flex-col">
                      <img
                        src={analise.foto_url}
                        alt={analise.nome}
                        className="w-full aspect-square object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                      />
                      <div className="px-2 py-1.5 flex items-center justify-between gap-1 min-h-[2rem]">
                        <span className="text-xs text-slate-400 truncate leading-tight">{analise.nome}</span>
                        {!finalizado && (
                          <button
                            onClick={() => handleDeletarFotoAnalise(analise)}
                            className="shrink-0 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-xs text-rose-400 transition hover:bg-rose-500/20"
                          >✕</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed aspect-square transition ${
                      analise.tipo_foto === 'required'
                        ? 'border-rose-500/50 bg-rose-500/5'
                        : 'border-slate-700/60 bg-slate-900/40'
                    } ${uploadingFoto[analise.id] ? 'opacity-50 pointer-events-none' : ''}`}>
                      <span className="text-2xl mb-1">
                        {uploadingFoto[analise.id] ? '⏳' : '📷'}
                      </span>
                      <span className={`text-[11px] font-semibold ${analise.tipo_foto === 'required' ? 'text-rose-400' : 'text-slate-500'}`}>
                        {analise.tipo_foto === 'required' ? 'Obrigatória' : 'Opcional'}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1 text-center px-3 leading-tight line-clamp-2">
                        {analise.nome}
                      </span>
                      {!finalizado && (
                        <div className="flex gap-2 mt-2 px-3 w-full">
                          <label className="flex-1 flex items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 py-1 cursor-pointer text-xs text-sky-400 transition hover:bg-sky-500/20">
                            📷
                            <input type="file" accept="image/*" capture="environment" className="hidden"
                              onChange={e => e.target.files?.[0] && handleFotoChange(analise, e.target.files[0])} />
                          </label>
                          <label className="flex-1 flex items-center justify-center rounded-xl border border-slate-700/40 bg-slate-700/20 py-1 cursor-pointer text-xs text-slate-400 transition hover:bg-slate-700/40">
                            🖼️
                            <input type="file" accept="image/*" className="hidden"
                              onChange={e => e.target.files?.[0] && handleFotoChange(analise, e.target.files[0])} />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

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
                      onClick={() => {
                        setIdiomaSelecionado(idioma.codigo);
                        if (laudo) atualizarLaudo(laudo.id, { idioma_pdf: idioma.codigo });
                      }}
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
