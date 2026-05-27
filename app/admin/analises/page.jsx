'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import {
  listarCatalogoAnalises,
  criarCatalogoAnalise,
  atualizarCatalogoAnalise,
  deletarCatalogoAnalise,
  listarNormas,
} from '@/lib/laudosServiceSupabase';
import LogoAbuhler from '@/components/LogoAbuhler';
import SpecInput from '@/components/SpecInput';

const TIPO_FOTO_LABEL = {
  required: 'Foto obrigatória',
  optional: 'Foto opcional',
  none: 'Sem foto',
};

const TIPO_FOTO_BADGE = {
  required: 'bg-sky-500/15 text-sky-300',
  optional: 'bg-slate-500/15 text-slate-300',
  none: 'bg-slate-800/50 text-slate-500',
};

const BLANK = { nome: '', norma_id: '', specification: '', unidade: '', tipo_foto: 'optional' };

export default function AdminAnalises() {
  const { user, loading } = useAuth();

  const [analises, setAnalises] = useState([]);
  const [normas, setNormas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [mostrando, setMostrando] = useState('lista');
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoDelete, setConfirmandoDelete] = useState(null);

  async function carregar(search = '') {
    setCarregando(true);
    setErro('');
    try {
      const [dados, normasData] = await Promise.all([
        listarCatalogoAnalises(search),
        listarNormas(),
      ]);
      setAnalises(dados);
      setNormas(normasData);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar análises');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (user) carregar();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  function abrirNovo() {
    setForm(BLANK);
    setEditandoId(null);
    setErro('');
    setMostrando('editar');
  }

  function abrirEdicao(analise) {
    setForm({
      nome: analise.nome,
      norma_id: analise.norma?.id || '',
      specification: analise.specification || '',
      unidade: analise.unidade || '',
      tipo_foto: analise.tipo_foto || 'optional',
    });
    setEditandoId(analise.id);
    setErro('');
    setMostrando('editar');
  }

  function cancelar() {
    setMostrando('lista');
    setForm(BLANK);
    setEditandoId(null);
    setErro('');
  }

  function handleNormaChange(normaId) {
    const norma = normas.find((n) => n.id === normaId);
    setForm((f) => ({
      ...f,
      norma_id: normaId,
      nome: norma ? (norma.descricao || norma.codigo) : f.nome,
      specification: norma?.specification ?? f.specification,
      unidade: norma?.unidade ?? f.unidade,
    }));
  }

  async function handleSalvar() {
    if (!form.nome.trim()) {
      setErro('Nome é obrigatório');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      if (editandoId) {
        await atualizarCatalogoAnalise(editandoId, form.nome, form.norma_id || null, form.specification, form.tipo_foto, form.unidade);
      } else {
        await criarCatalogoAnalise(form.nome, form.norma_id || null, form.specification, form.tipo_foto, form.unidade);
      }
      cancelar();
      await carregar(filtro);
    } catch (err) {
      setErro(err.message || 'Erro ao salvar análise');
    } finally {
      setSalvando(false);
    }
  }

  async function handleDeletar(id) {
    setSalvando(true);
    setErro('');
    try {
      await deletarCatalogoAnalise(id);
      setConfirmandoDelete(null);
      await carregar(filtro);
    } catch (err) {
      setErro(err.message || 'Erro ao excluir análise');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400/70">Administração</p>
            <LogoAbuhler height={44} invertido className="mb-1" />
            <h1 className="text-4xl font-bold text-slate-100 mt-1">Catálogo de Análises</h1>
            <p className="text-slate-400 text-sm mt-1">
              Análises padrão reutilizáveis nas bases de análises
            </p>
          </div>
          <div className="flex gap-3 text-sm shrink-0">
            <Link href="/admin/normas" className="text-slate-400 hover:text-slate-200 transition px-3 py-2">
              Normas
            </Link>
            <Link href="/admin/templates" className="text-slate-400 hover:text-slate-200 transition px-3 py-2">
              Bases de análises
            </Link>
          </div>
        </div>

        {erro && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
            {erro}
          </div>
        )}

        {/* Lista */}
        {mostrando === 'lista' && (
          <>
            <div className="mb-6 flex gap-3">
              <input
                type="text"
                placeholder="Buscar análise..."
                value={filtro}
                onChange={(e) => { setFiltro(e.target.value); carregar(e.target.value); }}
                className="input-dark flex-1 rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
              />
              <button
                onClick={abrirNovo}
                className="button-primary px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-sky-500/20 whitespace-nowrap"
              >
                + Nova Análise
              </button>
            </div>

            {carregando ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : analises.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-300 text-lg font-semibold">Nenhuma análise cadastrada</p>
                <p className="text-slate-500 mt-1 text-sm">Clique em "+ Nova Análise" para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analises.map((a) => (
                  <div
                    key={a.id}
                    className="glass-card rounded-[1.75rem] border-slate-800/80 p-5 hover:border-sky-500/30 transition flex justify-between items-start gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-base font-bold text-slate-100">{a.nome}</h3>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${TIPO_FOTO_BADGE[a.tipo_foto]}`}>
                          {TIPO_FOTO_LABEL[a.tipo_foto]}
                        </span>
                      </div>
                      {a.norma && (
                        <p className="text-slate-400 text-sm mt-1">
                          📚 {a.norma.codigo}{a.norma.descricao ? ` — ${a.norma.descricao}` : ''}
                        </p>
                      )}
                      <div className="flex gap-4 mt-1 flex-wrap">
                        {a.specification && (
                          <p className="text-sky-400/80 text-xs font-mono">Spec: {a.specification}</p>
                        )}
                        {a.unidade && (
                          <p className="text-amber-400/80 text-xs font-mono">Unid: {a.unidade}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => abrirEdicao(a)}
                        className="button-secondary px-4 py-2 rounded-xl text-sm font-semibold transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setConfirmandoDelete(a.id)}
                        className="px-4 py-2 bg-rose-500/20 text-rose-300 rounded-xl hover:bg-rose-500/30 transition text-sm font-semibold"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Formulário */}
        {mostrando === 'editar' && (
          <div className="glass-card rounded-[2rem] border-slate-800/90 p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">
              {editandoId ? 'Editar Análise' : 'Nova Análise'}
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Nome *</label>
                <input
                  type="text"
                  placeholder="ex: Abrasion Wet"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="input-dark w-full rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Norma</label>
                  <select
                    value={form.norma_id}
                    onChange={(e) => handleNormaChange(e.target.value)}
                    className="input-dark w-full rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  >
                    <option value="">Selecione a norma...</option>
                    {normas.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.codigo}{n.descricao ? ` — ${n.descricao}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1.5">Nome e specification preenchidos automaticamente.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Specification</label>
                  <SpecInput
                    value={form.specification}
                    onChange={(v) => setForm({ ...form, specification: v })}
                    placeholder="ex: ≥150"
                    className="input-dark w-full rounded-2xl px-4 py-3 text-sm font-mono placeholder:font-sans placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Unidade de medida</label>
                  <input
                    type="text"
                    placeholder="ex: N, ciclos, flexões"
                    value={form.unidade}
                    onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                    className="input-dark w-full rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Tipo de foto</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(TIPO_FOTO_LABEL).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setForm({ ...form, tipo_foto: val })}
                      className={`py-3 rounded-2xl text-sm font-semibold transition border ${
                        form.tipo_foto === val
                          ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                          : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="button-primary px-6 py-3 rounded-2xl font-semibold disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar análise'}
                </button>
                <button
                  onClick={cancelar}
                  disabled={salvando}
                  className="button-secondary px-6 py-3 rounded-2xl font-semibold disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal confirmar exclusão */}
      {confirmandoDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-[2rem] border-slate-800/90 p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-slate-100 mb-3">Excluir análise?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Esta ação remove a análise do catálogo. Bases de análises que já a incluem não são afetadas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeletar(confirmandoDelete)}
                disabled={salvando}
                className="px-4 py-2 bg-rose-500/20 text-rose-300 rounded-xl hover:bg-rose-500/30 font-semibold transition disabled:opacity-50 text-sm"
              >
                {salvando ? 'Excluindo...' : 'Excluir'}
              </button>
              <button
                onClick={() => setConfirmandoDelete(null)}
                disabled={salvando}
                className="button-secondary px-4 py-2 rounded-xl font-semibold transition disabled:opacity-50 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
