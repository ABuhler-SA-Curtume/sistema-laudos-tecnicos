'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import SpecInput from '@/components/SpecInput';
import {
  obterTemplate,
  listarNormas,
  listarCatalogoAnalises,
  atualizarTemplate,
  adicionarAnaliseTemplate,
  atualizarAnaliseTemplate,
  deletarAnaliseTemplate,
  reordenarAnaliseTemplate,
} from '@/lib/laudosServiceSupabase';

const COR_MAP = {
  blue: { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-300' },
  green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-300' },
  gray: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-300' },
};

const TIPO_FOTO = ['required', 'optional', 'none'];
const TIPO_FOTO_LABEL = {
  required: '📸 Obrigatória',
  optional: '📷 Opcional',
  none: '✖️ Sem foto',
};

export default function EditTemplate() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id;

  // Estados principais
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Template
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cor, setCor] = useState('blue');

  // Análises
  const [analises, setAnalises] = useState([]);
  const [normas, setNormas] = useState([]);
  const [catalogo, setCatalogo] = useState([]);

  // Modal catálogo
  const [mostraCatalogo, setMostraCatalogo] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [filtroCatalogo, setFiltroCatalogo] = useState('');

  // Edição/Criação de análise
  const [editandoAnaliseId, setEditandoAnaliseId] = useState(null);
  const [mostraFormAnalise, setMostraFormAnalise] = useState(false);
  const [analiseForm, setAnaliseForm] = useState({
    nome: '',
    norma_id: null,
    specification: '',
    unidade: '',
    tipo_foto: 'optional',
  });

  // Confirmação de delete
  const [confirmandoDeleteAnalise, setConfirmandoDeleteAnalise] = useState(null);

  // ────────────────────────────────────────
  // Carregar dados
  // ────────────────────────────────────────
  async function carregarDados() {
    setCarregando(true);
    setErro('');
    try {
      const [template, normasData, catalogoData] = await Promise.all([
        obterTemplate(templateId),
        listarNormas(),
        listarCatalogoAnalises(),
      ]);

      setNome(template.nome);
      setDescricao(template.descricao || '');
      setCor(template.cor);
      setAnalises(template.analises || []);
      setNormas(normasData);
      setCatalogo(catalogoData);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar base de análises');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [templateId]);

  // ────────────────────────────────────────
  // Salvar template (nome, desc, cor)
  // ────────────────────────────────────────
  async function handleSalvarTemplate() {
    if (!nome.trim()) {
      setErro('Nome é obrigatório');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await atualizarTemplate(templateId, nome, descricao, cor);
      setErro('');
    } catch (err) {
      setErro(err.message || 'Erro ao salvar base de análises');
    } finally {
      setSalvando(false);
    }
  }

  // ────────────────────────────────────────
  // Salvar análise (criar ou editar)
  // ────────────────────────────────────────
  async function handleSalvarAnalise() {
    if (!analiseForm.nome.trim()) {
      setErro('Nome da análise é obrigatório');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      if (editandoAnaliseId) {
        // Editar
        await atualizarAnaliseTemplate(
          editandoAnaliseId,
          analiseForm.nome,
          analiseForm.norma_id,
          analiseForm.specification,
          analiseForm.tipo_foto,
          analiseForm.unidade
        );
      } else {
        // Criar
        await adicionarAnaliseTemplate(
          templateId,
          analiseForm.nome,
          analiseForm.norma_id,
          analiseForm.specification,
          analiseForm.tipo_foto,
          analiseForm.unidade
        );
      }

      setMostraFormAnalise(false);
      setEditandoAnaliseId(null);
      setAnaliseForm({
        nome: '',
        norma_id: null,
        specification: '',
        unidade: '',
        tipo_foto: 'optional',
      });

      // Recarregar análises
      const template = await obterTemplate(templateId);
      setAnalises(template.analises || []);
    } catch (err) {
      setErro(err.message || 'Erro ao salvar análise');
    } finally {
      setSalvando(false);
    }
  }

  // ────────────────────────────────────────
  // Adicionar do catálogo
  // ────────────────────────────────────────
  async function handleAdicionarDoCatalogo() {
    if (selecionados.length === 0) return;
    setSalvando(true);
    setErro('');
    try {
      for (const item of selecionados) {
        await adicionarAnaliseTemplate(
          templateId,
          item.nome,
          item.norma?.id || null,
          item.specification || item.norma?.specification || '',
          item.tipo_foto || 'optional',
          item.unidade || item.norma?.unidade || ''
        );
      }
      setMostraCatalogo(false);
      setSelecionados([]);
      setFiltroCatalogo('');
      const template = await obterTemplate(templateId);
      setAnalises(template.analises || []);
    } catch (err) {
      setErro(err.message || 'Erro ao adicionar análises');
    } finally {
      setSalvando(false);
    }
  }

  function toggleSelecionado(item) {
    setSelecionados((prev) =>
      prev.find((s) => s.id === item.id)
        ? prev.filter((s) => s.id !== item.id)
        : [...prev, item]
    );
  }

  const catalogoFiltrado = catalogo.filter((a) =>
    !filtroCatalogo || a.nome.toLowerCase().includes(filtroCatalogo.toLowerCase())
  );

  // ────────────────────────────────────────
  // Deletar análise
  // ────────────────────────────────────────
  async function handleDeletarAnalise(id) {
    setSalvando(true);
    setErro('');
    try {
      await deletarAnaliseTemplate(id);
      setConfirmandoDeleteAnalise(null);

      // Recarregar
      const template = await obterTemplate(templateId);
      setAnalises(template.analises || []);
    } catch (err) {
      setErro(err.message || 'Erro ao deletar análise');
    } finally {
      setSalvando(false);
    }
  }

  // ────────────────────────────────────────
  // Editar análise
  // ────────────────────────────────────────
  function abrirEdicaoAnalise(analise) {
    setAnaliseForm({
      nome: analise.nome,
      norma_id: analise.norma?.id || null,
      specification: analise.specification || '',
      unidade: analise.unidade || '',
      tipo_foto: analise.tipo_foto || 'optional',
    });
    setEditandoAnaliseId(analise.id);
    setMostraFormAnalise(true);
    setErro('');
  }

  // ────────────────────────────────────────
  // Reordenar análises
  // ────────────────────────────────────────
  function moverAnalise(idx, direcao) {
    if (direcao === 'up' && idx === 0) return;
    if (direcao === 'down' && idx === analises.length - 1) return;

    const novasPosicoes = [...analises];
    const outraIdx = direcao === 'up' ? idx - 1 : idx + 1;

    [novasPosicoes[idx].ordem, novasPosicoes[outraIdx].ordem] = [
      novasPosicoes[outraIdx].ordem,
      novasPosicoes[idx].ordem,
    ];

    [novasPosicoes[idx], novasPosicoes[outraIdx]] = [
      novasPosicoes[outraIdx],
      novasPosicoes[idx],
    ];

    setAnalises(novasPosicoes);

    // Salvar reordenação
    Promise.all(
      novasPosicoes.map((a) => reordenarAnaliseTemplate(a.id, a.ordem))
    ).catch((err) => setErro(err.message));
  }

  // ────────────────────────────────────────
  // Render
  // ────────────────────────────────────────
  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <p className="text-slate-400 text-lg">Carregando base de análises...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-5xl mx-auto">
        {/* ──── Header ──── */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-100">✏️ Editar base de análises</h1>
            <p className="text-slate-400 mt-2 uppercase text-sm tracking-wide">Administração</p>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-slate-300 hover:text-slate-100 font-semibold transition"
          >
            ← Voltar
          </button>
        </div>

        {/* ──── Erro ──── */}
        {erro && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300">
            ❌ {erro}
          </div>
        )}

        {/* ──── Formulário Principal ──── */}
        <div className="glass-card rounded-[1.75rem] border-slate-800/90 p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Informações da base de análises</h2>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Nome */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Nome *
              </label>
              <input
                type="text"
                placeholder="ex: Laudo Completo Couro"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input-dark w-full rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
              />
            </div>

            {/* Cor */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Cor
              </label>
              <div className="flex gap-3">
                {['blue', 'green', 'gray'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCor(c)}
                    className={`px-4 py-2 rounded-xl font-semibold transition ${
                      cor === c
                        ? `ring-2 ${COR_MAP[c].bg} bg-slate-800/50`
                        : `bg-slate-800/30 hover:bg-slate-800/50`
                    }`}
                  >
                    {c === 'blue' && '🔵'}
                    {c === 'green' && '🟢'}
                    {c === 'gray' && '⚪'}
                  </button>
                ))}
              </div>
            </div>

            {/* Descrição */}
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Descrição
              </label>
              <textarea
                placeholder="ex: 5 análises — bateria padrão para couro acabado"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className="input-dark w-full rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70 resize-none"
              />
            </div>
          </div>

          {/* Botão Salvar */}
          <button
            onClick={handleSalvarTemplate}
            disabled={salvando}
            className="button-primary px-6 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20 rounded-xl disabled:opacity-60"
          >
            {salvando ? '💾 Salvando...' : '💾 Salvar Informações'}
          </button>
        </div>

        {/* ──── Análises ──── */}
        <div className="glass-card rounded-[1.75rem] border-slate-800/90 p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-100">
              Análises ({analises.length})
            </h2>
            {!mostraFormAnalise && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setMostraCatalogo(true); setSelecionados([]); setFiltroCatalogo(''); }}
                  className="button-secondary px-4 py-2 rounded-xl font-semibold text-sm"
                >
                  📋 Do catálogo
                </button>
                <button
                  onClick={() => {
                    setAnaliseForm({ nome: '', norma_id: null, specification: '', unidade: '', tipo_foto: 'optional' });
                    setEditandoAnaliseId(null);
                    setMostraFormAnalise(true);
                  }}
                  className="button-primary px-4 py-2 rounded-xl font-semibold text-sm"
                >
                  + Manual
                </button>
              </div>
            )}
          </div>

          {/* ──── Formulário de Análise ──── */}
          {mostraFormAnalise && (
            <div className="mb-8 p-6 bg-sky-500/10 border-2 border-sky-500/20 rounded-2xl">
              <h3 className="text-xl font-bold text-slate-100 mb-4">
                {editandoAnaliseId ? '✏️ Editar Análise' : '➕ Nova Análise'}
              </h3>

              <div className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Abrasion Wet"
                    value={analiseForm.nome}
                    onChange={(e) =>
                      setAnaliseForm({ ...analiseForm, nome: e.target.value })
                    }
                    className="input-dark w-full rounded-xl px-4 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Norma */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Norma
                    </label>
                    <select
                      value={analiseForm.norma_id || ''}
                      onChange={(e) => {
                        const normaId = e.target.value || null;
                        const norma = normas.find((n) => n.id === normaId);
                        setAnaliseForm({
                          ...analiseForm,
                          norma_id: normaId,
                          nome: norma ? (norma.descricao || norma.codigo) : analiseForm.nome,
                          specification: norma?.specification ?? analiseForm.specification,
                          unidade: norma?.unidade ?? analiseForm.unidade,
                        });
                      }}
                      className="input-dark w-full rounded-xl px-4 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                    >
                      <option value="">Sem norma</option>
                      {normas.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.codigo}{n.descricao ? ` — ${n.descricao}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Specification */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Specification
                    </label>
                    <SpecInput
                      value={analiseForm.specification}
                      onChange={(v) => setAnaliseForm({ ...analiseForm, specification: v })}
                      placeholder="ex: ≥3.5"
                      className="input-dark w-full rounded-xl px-4 py-2 text-sm font-mono placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                    />
                  </div>
                </div>

                {/* Unidade */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Unidade de medida
                  </label>
                  <input
                    type="text"
                    placeholder="ex: N, N/mm², ciclos"
                    value={analiseForm.unidade}
                    onChange={(e) => setAnaliseForm({ ...analiseForm, unidade: e.target.value })}
                    className="input-dark w-full rounded-xl px-4 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  />
                </div>

                {/* Tipo Foto */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Tipo de Foto
                  </label>
                  <select
                    value={analiseForm.tipo_foto}
                    onChange={(e) =>
                      setAnaliseForm({
                        ...analiseForm,
                        tipo_foto: e.target.value,
                      })
                    }
                    className="input-dark w-full rounded-xl px-4 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  >
                    {TIPO_FOTO.map((t) => (
                      <option key={t} value={t}>
                        {TIPO_FOTO_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSalvarAnalise}
                    disabled={salvando}
                    className="button-primary px-6 py-2 rounded-xl font-semibold disabled:opacity-60"
                  >
                    {salvando
                      ? '💾 Salvando...'
                      : editandoAnaliseId
                      ? '✏️ Atualizar'
                      : '➕ Adicionar'}
                  </button>
                  <button
                    onClick={() => {
                      setMostraFormAnalise(false);
                      setEditandoAnaliseId(null);
                      setAnaliseForm({
                        nome: '',
                        norma_id: null,
                        specification: '',
                        unidade: '',
                        tipo_foto: 'optional',
                      });
                    }}
                    disabled={salvando}
                    className="button-secondary px-6 py-2 rounded-xl font-semibold disabled:opacity-60"
                  >
                    ❌ Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ──── Lista de Análises ──── */}
          {analises.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">Nenhuma análise adicionada ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analises.map((analise, idx) => (
                <div
                  key={analise.id}
                  className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800/60 hover:border-sky-500/30 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-100">
                        {idx + 1}. {analise.nome}
                      </h4>
                      {analise.norma && (
                        <p className="text-sm text-slate-400 mt-1">
                          📚 {analise.norma.codigo} - {analise.norma.descricao}
                        </p>
                      )}
                      {analise.specification && (
                        <p className="text-sm text-slate-400">
                          📊 Spec: {analise.specification}
                        </p>
                      )}
                      <p className="text-sm text-slate-400">
                        {TIPO_FOTO_LABEL[analise.tipo_foto]}
                      </p>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => moverAnalise(idx, 'up')}
                        disabled={idx === 0}
                        className="px-3 py-1 bg-slate-800/50 text-slate-300 rounded-lg hover:bg-slate-700 text-sm disabled:opacity-40 transition"
                      >
                        ⬆️
                      </button>
                      <button
                        onClick={() => moverAnalise(idx, 'down')}
                        disabled={idx === analises.length - 1}
                        className="px-3 py-1 bg-slate-800/50 text-slate-300 rounded-lg hover:bg-slate-700 text-sm disabled:opacity-40 transition"
                      >
                        ⬇️
                      </button>
                      <button
                        onClick={() => abrirEdicaoAnalise(analise)}
                        className="px-3 py-1 bg-sky-500/20 text-sky-300 rounded-lg hover:bg-sky-500/30 text-sm transition"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setConfirmandoDeleteAnalise(analise.id)}
                        className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-lg hover:bg-rose-500/30 text-sm transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ──── Modal Catálogo ──── */}
      {mostraCatalogo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-[2rem] border-slate-800/90 w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-800/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-100">Selecionar do catálogo</h3>
                <button onClick={() => setMostraCatalogo(false)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
              </div>
              <input
                type="text"
                placeholder="Buscar análise..."
                value={filtroCatalogo}
                onChange={(e) => setFiltroCatalogo(e.target.value)}
                className="input-dark w-full rounded-2xl px-4 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {catalogoFiltrado.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm">Nenhuma análise no catálogo.</p>
                  <a href="/admin/analises" target="_blank" className="text-sky-400 text-sm hover:underline mt-1 inline-block">
                    Ir para o catálogo →
                  </a>
                </div>
              ) : (
                catalogoFiltrado.map((item) => {
                  const sel = selecionados.find((s) => s.id === item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleSelecionado(item)}
                      className={`w-full text-left p-4 rounded-2xl border transition ${
                        sel
                          ? 'border-sky-500/50 bg-sky-500/10'
                          : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          sel ? 'border-sky-500 bg-sky-500' : 'border-slate-600'
                        }`}>
                          {sel && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-100 text-sm">{item.nome}</p>
                          <div className="flex gap-3 mt-0.5 text-xs text-slate-400">
                            {item.norma && <span>📚 {item.norma.codigo}</span>}
                            {item.specification && <span className="font-mono text-sky-400/80">Spec: {item.specification}</span>}
                            <span>{TIPO_FOTO_LABEL[item.tipo_foto]}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-800/60 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-400">
                {selecionados.length} selecionada{selecionados.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setMostraCatalogo(false)}
                  className="button-secondary px-4 py-2 rounded-xl font-semibold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdicionarDoCatalogo}
                  disabled={selecionados.length === 0 || salvando}
                  className="button-primary px-5 py-2 rounded-xl font-semibold text-sm disabled:opacity-50"
                >
                  {salvando ? 'Adicionando...' : `Adicionar ${selecionados.length > 0 ? `(${selecionados.length})` : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── Modal Confirmar Delete ──── */}
      {confirmandoDeleteAnalise && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-[2rem] border-slate-800/90 p-6 max-w-sm">
            <h3 className="text-lg font-bold text-slate-100 mb-4">
              ⚠️ Deletar Análise?
            </h3>
            <p className="text-slate-400 mb-6">
              Tem certeza que deseja remover esta análise da base de análises?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeletarAnalise(confirmandoDeleteAnalise)}
                disabled={salvando}
                className="px-4 py-2 bg-rose-500/20 text-rose-300 rounded-xl hover:bg-rose-500/30 font-semibold transition disabled:opacity-60"
              >
                {salvando ? '⏳ Deletando...' : '🗑️ Deletar'}
              </button>
              <button
                onClick={() => setConfirmandoDeleteAnalise(null)}
                disabled={salvando}
                className="button-secondary px-4 py-2 rounded-xl font-semibold transition disabled:opacity-60"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
