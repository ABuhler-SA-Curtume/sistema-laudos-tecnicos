'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { criarLaudo, adicionarAnalise, listarTemplates, obterTemplate } from '@/lib/laudosServiceSupabase';

const BLANK_ANALISE = { nome: '', norma: '', specification: '', tipo_foto: 'optional' };

const TIPO_FOTO_LABEL = {
  required: 'Foto obrigatória',
  optional: 'Foto opcional',
  none: 'Sem foto',
};

const COR_MAP = {
  blue: { card: 'border-sky-400/20 bg-sky-500/10', badge: 'bg-sky-500/15 text-sky-300', btn: 'ring-sky-500/50' },
  green: { card: 'border-emerald-400/20 bg-emerald-500/10', badge: 'bg-emerald-500/15 text-emerald-300', btn: 'ring-emerald-500/50' },
  gray: { card: 'border-slate-400/20 bg-slate-500/10', badge: 'bg-slate-500/15 text-slate-300', btn: 'ring-slate-500/50' },
};

export default function NovoLaudo() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [passo, setPasso] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [carregandoTemplates, setCarregandoTemplates] = useState(true);
  const [templates, setTemplates] = useState([]);

  // Passo 1 — dados básicos
  const [info, setInfo] = useState({
    cliente: '', artigo: '', cor: '', op: '', responsavel: 'Cristiano Luis Backes',
    codigo_item: '', ordem_compra: '', metragem: '', lotes: '', observacoes: '',
  });

  // Passo 2 — base de análises
  const [templateId, setTemplateId] = useState('');
  const [analises, setAnalises] = useState([]);
  const [adicionando, setAdicionando] = useState(false);
  const [novaAnalise, setNovaAnalise] = useState(BLANK_ANALISE);

  // ── Carregar bases de análises dinâmicas ──
  async function carregarTemplates() {
    setCarregandoTemplates(true);
    try {
      const dados = await listarTemplates();
      setTemplates(dados);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar bases de análises');
    } finally {
      setCarregandoTemplates(false);
    }
  }

  useEffect(() => {
    if (user) carregarTemplates();
  }, [user]);

  // Recarrega templates ao voltar para esta aba (ex: após criar template em nova aba)
  useEffect(() => {
    function handleFocus() {
      if (user && passo === 2) carregarTemplates();
    }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, passo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return null; // useAuth já redireciona
  }

  // ── Passo 1 ──────────────────────────────────────────────────
  function handleInfoChange(field, value) {
    setInfo((prev) => ({ ...prev, [field]: value }));
  }

  function avancar() {
    if (!info.cliente.trim() || !info.artigo.trim()) {
      setErro('Cliente e Artigo são obrigatórios.');
      return;
    }
    setErro('');
    setPasso(2);
  }

  // ── Passo 2 — templates ──────────────────────────────────────
  async function selecionarTemplate(tpl) {
    setTemplateId(tpl.id);

    // Obter template completo com análises do banco
    try {
      const templateCompleto = await obterTemplate(tpl.id);

      // Mapear análises do banco para o formato esperado
      const analisesFormatadas = templateCompleto.analises.map((a) => ({
        id: a.id,
        nome: a.nome,
        norma: a.norma?.codigo || '',
        specification: a.specification || a.norma?.specification || '',
        unidade: a.unidade || a.norma?.unidade || '',
        tipo_foto: a.tipo_foto || 'optional',
      }));

      setAnalises(analisesFormatadas);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar base de análises');
      setTemplateId('');
    }
  }

  function handleAnaliseChange(idx, field, value) {
    setAnalises((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  }

  function removerAnalise(idx) {
    setAnalises((prev) => prev.filter((_, i) => i !== idx));
  }

  function adicionarLinha() {
    if (!novaAnalise.nome.trim()) return;
    setAnalises((prev) => [...prev, { ...novaAnalise }]);
    setNovaAnalise(BLANK_ANALISE);
    setAdicionando(false);
  }

  // ── Criar laudo ──────────────────────────────────────────────
  async function handleCriar() {
    if (!templateId) {
      setErro('Selecione uma base de análises.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      const laudo = await criarLaudo(info);

      await Promise.all(
        analises.map((a) =>
          adicionarAnalise(laudo.id, {
            nome: a.nome,
            norma: a.norma,
            specification: a.specification,
            unidade: a.unidade || null,
            tipo_foto: a.tipo_foto,
            resultado: null,
            status_analise: null,
            foto_url: null,
          })
        )
      );

      router.push(`/laudos/${laudo.id}`);
    } catch (err) {
      setErro(err.message || 'Erro ao criar laudo.');
      setSalvando(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="glass-card border-slate-800/90 rounded-none">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3 text-sm">
          <Link href="/" className="text-sky-300 hover:text-sky-200 transition">Dashboard</Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 font-medium">Novo laudo</span>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-6 mb-8">
          {[
            { n: 1, label: 'Dados do produto' },
            { n: 2, label: 'Base de análises' },
          ].map(({ n, label }) => (
            <div key={n} className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  passo >= n
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                {n}
              </div>
              <span className={`text-sm font-medium transition ${
                passo >= n ? 'text-slate-200' : 'text-slate-500'
              }`}>
                {label}
              </span>
              {n < 2 && (
                <div className={`w-8 h-0.5 transition ${
                  passo > n ? 'bg-sky-500' : 'bg-slate-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        {erro && (
          <div className="glass-card rounded-[1.75rem] border-rose-500/20 bg-rose-500/10 p-4 mb-6 text-sm text-rose-300">
            <div className="flex items-center gap-2">
              <span className="text-rose-400">⚠️</span>
              {erro}
            </div>
          </div>
        )}

        {/* ── PASSO 1 ── */}
        {passo === 1 && (
          <section className="glass-card rounded-[2rem] border-slate-800/90 p-8 space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-100 mb-2">Dados do produto</h2>
              <p className="text-slate-400 text-sm">Preencha as informações básicas do laudo técnico</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { field: 'cliente',      label: 'Cliente',          req: true,  icon: '🏢' },
                { field: 'artigo',       label: 'Artigo',           req: true,  icon: '📦' },
                { field: 'cor',          label: 'Cor',              req: false, icon: '🎨' },
                { field: 'op',           label: 'OP',               req: false, icon: '🔢' },
                { field: 'responsavel',  label: 'Responsável',      req: false, icon: '👤' },
                { field: 'codigo_item',  label: 'Código do item',   req: false, icon: '🏷️' },
                { field: 'ordem_compra', label: 'Ordem de compra',  req: false, icon: '📋' },
                { field: 'metragem',     label: 'Metragem',         req: false, icon: '📏' },
                { field: 'lotes',        label: 'Lotes',            req: false, icon: '🗂️' },
              ].map(({ field, label, req, icon }) => (
                <label key={field} className="block">
                  <span className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <span>{icon}</span>
                    {label} {req && <span className="text-rose-400">*</span>}
                  </span>
                  <input
                    value={info[field]}
                    onChange={(e) => handleInfoChange(field, e.target.value)}
                    className="input-dark rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70 w-full"
                    placeholder={`Digite ${label.toLowerCase()}`}
                  />
                </label>
              ))}
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <span>📝</span>
                Observações
              </span>
              <textarea
                value={info.observacoes}
                onChange={(e) => handleInfoChange('observacoes', e.target.value)}
                rows={4}
                className="input-dark rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70 w-full resize-none"
                placeholder="Observações adicionais sobre o produto..."
              />
            </label>

            <div className="flex gap-4 pt-4 border-t border-slate-800/50">
              <button
                onClick={avancar}
                className="button-primary px-8 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20 flex-1 md:flex-none"
              >
                Próximo →
              </button>
              <Link href="/" className="button-secondary px-6 py-3 text-sm font-semibold">
                Cancelar
              </Link>
            </div>
          </section>
        )}

        {/* ── PASSO 2 ── */}
        {passo === 2 && (
          <div className="space-y-6">
            {/* Template selector */}
            <section className="glass-card rounded-[2rem] border-slate-800/90 p-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-100 mb-2">Selecione a base de análises</h2>
                <p className="text-slate-400 text-sm">Escolha uma base de análises para o laudo</p>
              </div>

              {carregandoTemplates ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-400 text-sm">Carregando bases de análises...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-12 rounded-[1.75rem] border border-slate-800/80 bg-slate-900/80">
                  <p className="text-slate-400 text-sm mb-4">Nenhuma base de análises disponível</p>
                  <Link href="/admin/templates" target="_blank" rel="noopener" className="button-primary px-6 py-2 text-sm">
                    Criar primeira base de análises ↗
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {templates.map((tpl) => {
                    const c = COR_MAP[tpl.cor] || COR_MAP.blue;
                    const ativo = templateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        onClick={() => selecionarTemplate(tpl)}
                        className={`text-left p-6 rounded-[1.5rem] border-2 transition-all duration-200 ${
                          ativo
                            ? `${c.card} ${c.btn} ring-2 shadow-lg`
                            : 'border-slate-800/80 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/50'
                        }`}
                      >
                        <p className="font-semibold text-sm text-slate-100 mb-2">{tpl.nome}</p>
                        <p className="text-xs text-slate-400 mb-3">{tpl.descricao}</p>
                        <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${c.badge}`}>
                          {tpl.analises?.length || 0} análises
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Botão para criar nova base de análises */}
              <div className="border-t border-slate-800/50 pt-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-slate-400 mb-3">Não encontrou a base de análises ideal?</p>
                  <Link
                    href="/admin/templates"
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 button-primary px-6 py-3 text-sm font-semibold shadow-lg shadow-emerald-500/20"
                  >
                    <span>+</span>
                    Criar nova base de análises ↗
                  </Link>
                </div>
                <button
                  onClick={carregarTemplates}
                  disabled={carregandoTemplates}
                  className="button-secondary px-4 py-2 text-xs font-semibold text-slate-400 flex items-center gap-2 disabled:opacity-50"
                >
                  {carregandoTemplates ? (
                    <span className="animate-spin inline-block w-3 h-3 border border-slate-400 border-t-transparent rounded-full" />
                  ) : '↺'}
                  Recarregar lista
                </button>
              </div>
            </section>

            {/* Analyses list */}
            {templateId && (
              <section className="glass-card rounded-[2rem] border-slate-800/90 p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">
                      Análises ({analises.length})
                    </h2>
                    <p className="text-slate-400 text-sm">Configure as análises do laudo</p>
                  </div>
                  {!adicionando && (
                    <button
                      onClick={() => setAdicionando(true)}
                      className="text-sm font-semibold text-sky-300 hover:text-sky-200 transition flex items-center gap-2"
                    >
                      <span>+</span>
                      Adicionar análise
                    </button>
                  )}
                </div>

                {analises.length === 0 && !adicionando && (
                  <div className="text-center py-12 rounded-[1.75rem] border border-slate-800/80 bg-slate-900/80">
                    <p className="text-slate-400 text-sm mb-4">Nenhuma análise configurada</p>
                    <button
                      onClick={() => setAdicionando(true)}
                      className="button-primary px-6 py-2 text-sm"
                    >
                      Adicionar primeira análise
                    </button>
                  </div>
                )}

                {/* Analysis rows */}
                <div className="space-y-3">
                  {analises.map((a, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-3 items-center p-4 rounded-[1.25rem] border border-slate-800/80 bg-slate-900/80"
                    >
                      <input
                        value={a.nome}
                        onChange={(e) => handleAnaliseChange(idx, 'nome', e.target.value)}
                        placeholder="Nome da análise *"
                        className="col-span-3 input-dark rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                      />
                      <input
                        value={a.norma}
                        onChange={(e) => handleAnaliseChange(idx, 'norma', e.target.value)}
                        placeholder="Norma (ex: ISO 5470-2)"
                        className="col-span-3 input-dark rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                      />
                      <input
                        value={a.specification}
                        onChange={(e) => handleAnaliseChange(idx, 'specification', e.target.value)}
                        placeholder="Spec. (ex: >3.5)"
                        className="col-span-3 input-dark rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                      />
                      <select
                        value={a.tipo_foto}
                        onChange={(e) => handleAnaliseChange(idx, 'tipo_foto', e.target.value)}
                        className="col-span-2 input-dark rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                      >
                        <option value="required">Obrigatória</option>
                        <option value="optional">Opcional</option>
                        <option value="none">Sem foto</option>
                      </select>
                      <button
                        onClick={() => removerAnalise(idx)}
                        className="col-span-1 text-rose-400 hover:text-rose-300 text-xs font-semibold transition p-2 rounded-lg hover:bg-rose-500/10"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new analysis form */}
                {adicionando && (
                  <div className="mt-6 p-6 rounded-[1.75rem] border border-sky-500/20 bg-sky-500/10">
                    <p className="text-sm font-semibold text-sky-300 mb-4 flex items-center gap-2">
                      <span>🧪</span>
                      Nova análise
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        autoFocus
                        value={novaAnalise.nome}
                        onChange={(e) => setNovaAnalise({ ...novaAnalise, nome: e.target.value })}
                        placeholder="Nome da análise *"
                        className="input-dark rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                      />
                      <input
                        value={novaAnalise.norma}
                        onChange={(e) => setNovaAnalise({ ...novaAnalise, norma: e.target.value })}
                        placeholder="Norma (ex: ISO 5470-2)"
                        className="input-dark rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                      />
                      <input
                        value={novaAnalise.specification}
                        onChange={(e) => setNovaAnalise({ ...novaAnalise, specification: e.target.value })}
                        placeholder="Especificação (ex: >3.5)"
                        className="input-dark rounded-2xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                      />
                      <select
                        value={novaAnalise.tipo_foto}
                        onChange={(e) => setNovaAnalise({ ...novaAnalise, tipo_foto: e.target.value })}
                        className="input-dark rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                      >
                        <option value="required">Foto obrigatória</option>
                        <option value="optional">Foto opcional</option>
                        <option value="none">Sem foto</option>
                      </select>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={adicionarLinha}
                        disabled={!novaAnalise.nome.trim()}
                        className="button-primary px-6 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20"
                      >
                        Adicionar análise
                      </button>
                      <button
                        onClick={() => { setAdicionando(false); setNovaAnalise(BLANK_ANALISE); }}
                        className="button-secondary px-6 py-3 text-sm font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setPasso(1)}
                className="button-secondary px-8 py-3 text-sm font-semibold flex-1 md:flex-none"
              >
                ← Voltar
              </button>
              <button
                onClick={handleCriar}
                disabled={salvando || !templateId}
                className="button-primary px-8 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20 flex-1 md:flex-none disabled:opacity-60"
              >
                {salvando ? 'Criando laudo...' : 'Criar laudo'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
