'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import {
  listarNormas,
  criarNorma,
  atualizarNorma,
  deletarNorma,
} from '@/lib/laudosServiceSupabase';
import LogoAbuhler from '@/components/LogoAbuhler';
import SpecInput from '@/components/SpecInput';

export default function AdminNormas() {
  const { user, loading } = useAuth();

  const [normas, setNormas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [mostrando, setMostrando] = useState('lista');

  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [specification, setSpecification] = useState('');
  const [unidade, setUnidade] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoDelete, setConfirmandoDelete] = useState(null);

  async function carregarNormas(search = '') {
    setCarregando(true);
    setErro('');
    try {
      const dados = await listarNormas(search);
      setNormas(dados);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar normas');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (user) carregarNormas();
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
    setCodigo('');
    setDescricao('');
    setSpecification('');
    setUnidade('');
    setEditandoId(null);
    setErro('');
    setMostrando('editar');
  }

  function abrirEdicao(norma) {
    setCodigo(norma.codigo);
    setDescricao(norma.descricao || '');
    setSpecification(norma.specification || '');
    setUnidade(norma.unidade || '');
    setEditandoId(norma.id);
    setErro('');
    setMostrando('editar');
  }

  function cancelarEdicao() {
    setMostrando('lista');
    setCodigo('');
    setDescricao('');
    setSpecification('');
    setUnidade('');
    setEditandoId(null);
    setErro('');
  }

  async function handleSalvar() {
    if (!codigo.trim()) {
      setErro('Código é obrigatório');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      if (editandoId) {
        await atualizarNorma(editandoId, codigo, descricao, specification, unidade);
      } else {
        await criarNorma(codigo, descricao, specification, unidade);
      }
      cancelarEdicao();
      await carregarNormas(filtro);
    } catch (err) {
      setErro(err.message || 'Erro ao salvar norma');
    } finally {
      setSalvando(false);
    }
  }

  async function handleDeletar(id) {
    setSalvando(true);
    setErro('');
    try {
      await deletarNorma(id);
      setConfirmandoDelete(null);
      await carregarNormas(filtro);
    } catch (err) {
      setErro(err.message || 'Erro ao deletar norma');
    } finally {
      setSalvando(false);
    }
  }

  async function handleBuscar(termo) {
    setFiltro(termo);
    await carregarNormas(termo);
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400/70">Administração</p>
            <LogoAbuhler height={44} invertido className="mb-1" />
            <h1 className="text-4xl font-bold text-slate-100 mt-1">Normas</h1>
          </div>
          <Link href="/admin/templates" className="text-sm text-slate-400 hover:text-slate-200 transition">
            ← Bases de análises
          </Link>
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
                placeholder="Buscar por código ou descrição..."
                value={filtro}
                onChange={(e) => handleBuscar(e.target.value)}
                className="input-dark flex-1 rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
              />
              <button
                onClick={abrirNovo}
                className="button-primary px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-sky-500/20 whitespace-nowrap"
              >
                + Nova Norma
              </button>
            </div>

            {carregando ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : normas.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-300 text-lg font-semibold">Nenhuma norma cadastrada</p>
                <p className="text-slate-500 mt-1 text-sm">Clique em "+ Nova Norma" para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {normas.map((norma) => (
                  <div
                    key={norma.id}
                    className="glass-card rounded-[1.75rem] border-slate-800/80 p-5 hover:border-sky-500/30 transition flex justify-between items-start gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-100">{norma.codigo}</h3>
                      {norma.descricao && (
                        <p className="text-slate-400 text-sm mt-0.5">{norma.descricao}</p>
                      )}
                      <div className="flex gap-4 mt-1 flex-wrap">
                        {norma.specification && (
                          <p className="text-sky-400/80 text-xs font-mono">
                            Spec: {norma.specification}
                          </p>
                        )}
                        {norma.unidade && (
                          <p className="text-amber-400/80 text-xs font-mono">
                            Unidade: {norma.unidade}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => abrirEdicao(norma)}
                        className="button-secondary px-4 py-2 rounded-xl text-sm font-semibold transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setConfirmandoDelete(norma.id)}
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

        {/* Formulário criar / editar */}
        {mostrando === 'editar' && (
          <div className="glass-card rounded-[2rem] border-slate-800/90 p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">
              {editandoId ? 'Editar Norma' : 'Nova Norma'}
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  placeholder="ex: ISO 5470-2"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  className="input-dark w-full rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Descrição
                </label>
                <input
                  type="text"
                  placeholder="ex: Abrasion Wet Test"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="input-dark w-full rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Specification padrão
                  </label>
                  <SpecInput
                    value={specification}
                    onChange={setSpecification}
                    placeholder="ex: ≥150 ou >3.5"
                    className="input-dark w-full rounded-2xl px-4 py-3 text-sm font-mono placeholder:text-slate-500 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Unidade de medida
                  </label>
                  <input
                    type="text"
                    placeholder="ex: N, N/mm², ciclos, flexões"
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    className="input-dark w-full rounded-2xl px-4 py-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 -mt-2">
                Specification e unidade são auto-preenchidas ao usar esta norma.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="button-primary px-6 py-3 rounded-2xl font-semibold disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Criar norma'}
                </button>
                <button
                  onClick={cancelarEdicao}
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
            <h3 className="text-lg font-bold text-slate-100 mb-3">Excluir norma?</h3>
            <p className="text-slate-400 text-sm mb-6">
              Esta ação não pode ser desfeita. Bases de análises que usam esta norma não serão afetadas.
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
