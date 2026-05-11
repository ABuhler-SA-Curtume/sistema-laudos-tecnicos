'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import {
  listarTemplates,
  criarTemplate,
  deletarTemplate,
  clonarTemplate,
} from '@/lib/laudosServiceSupabase';
import LogoAbuhler from '@/components/LogoAbuhler';

const COR_MAP = {
  blue: { bg: 'border-sky-500/20 bg-sky-500/10', badge: 'bg-sky-500/15 text-sky-300', btn: 'ring-sky-500/50' },
  green: { bg: 'border-emerald-500/20 bg-emerald-500/10', badge: 'bg-emerald-500/15 text-emerald-300', btn: 'ring-emerald-500/50' },
  gray: { bg: 'border-slate-500/20 bg-slate-500/10', badge: 'bg-slate-500/15 text-slate-300', btn: 'ring-slate-500/50' },
};

export default function AdminTemplates() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [templates, setTemplates] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrando, setMostrando] = useState('lista');

  // Estados para criar nova base de análises
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cor, setCor] = useState('blue');
  const [salvando, setSalvando] = useState(false);

  // Estados para clonar
  const [clonarId, setClonarId] = useState(null);
  const [clonarNome, setClonarNome] = useState('');

  // Estados para deletar
  const [confirmandoDelete, setConfirmandoDelete] = useState(null);

  // ────────────────────────────────────────
  // Carregar templates
  // ────────────────────────────────────────
  async function carregarTemplates() {
    setCarregando(true);
    setErro('');
    try {
      const dados = await listarTemplates();
      setTemplates(dados);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar bases de análises');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (user) {
      carregarTemplates();
    }
  }, [user]);

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

  // ────────────────────────────────────────
  // Criar nova base de análises
  // ────────────────────────────────────────
  async function handleCriar() {
    if (!nome.trim()) {
      setErro('Nome é obrigatório');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await criarTemplate(nome, descricao, cor);
      setNome('');
      setDescricao('');
      setCor('blue');
      setMostrando('lista');
      await carregarTemplates();
    } catch (err) {
      setErro(err.message || 'Erro ao criar base de análises');
    } finally {
      setSalvando(false);
    }
  }

  // ────────────────────────────────────────
  // Clonar base de análises
  // ────────────────────────────────────────
  async function handleClonar(id) {
    const nome = clonarNome.trim();
    if (!nome) {
      setErro('Nome é obrigatório');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await clonarTemplate(id, nome);
      setClonarId(null);
      setClonarNome('');
      await carregarTemplates();
    } catch (err) {
      setErro(err.message || 'Erro ao clonar base de análises');
    } finally {
      setSalvando(false);
    }
  }

  // ────────────────────────────────────────
  // Deletar base de análises
  // ────────────────────────────────────────
  async function handleDeletar(id) {
    setSalvando(true);
    setErro('');
    try {
      await deletarTemplate(id);
      setConfirmandoDelete(null);
      await carregarTemplates();
    } catch (err) {
      setErro(err.message || 'Erro ao deletar base de análises');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-sky-500/10 via-transparent to-transparent" />
      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        {/* ──── Header ──── */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-400/70">Administração</p>
            <LogoAbuhler height={44} invertido className="mb-1" />
            <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              📋 Gerenciar bases de análises
            </h1>
            <p className="text-slate-400 mt-2">Crie, edite e organize suas bases de análises</p>
          </div>
          <div className="flex gap-3 text-sm shrink-0">
            <Link href="/admin/analises" className="text-slate-400 hover:text-slate-200 transition px-3 py-2">
              Catálogo de análises
            </Link>
            <Link href="/admin/normas" className="text-slate-400 hover:text-slate-200 transition px-3 py-2">
              Normas
            </Link>
            <Link href="/" className="text-slate-400 hover:text-slate-200 transition px-3 py-2">
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* ──── Erro ──── */}
        {erro && (
          <div className="mb-6 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            ❌ {erro}
          </div>
        )}

        {/* ──── Modo LISTA ──── */}
        {mostrando === 'lista' && (
          <>
            {/* ──── Botão Novo ──── */}
            <div className="mb-6">
              <button
                onClick={() => {
                  setNome('');
                  setDescricao('');
                  setCor('blue');
                  setMostrando('criar');
                  setErro('');
                }}
                className="button-primary px-6 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20 flex items-center gap-2"
              >
                + Nova base de análises
              </button>
            </div>

            {/* ──── Lista de bases de análises ──── */}
            {carregando ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Carregando bases de análises...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 rounded-[1.75rem] border border-slate-800/80 bg-slate-900/80">
                <p className="text-slate-400 text-lg">Nenhuma base de análises encontrada</p>
                <p className="text-slate-500 mt-2">Clique em "+ Nova base de análises" para começar</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templates.map((tpl) => {
                  const c = COR_MAP[tpl.cor] || COR_MAP.blue;
                  return (
                    <div
                      key={tpl.id}
                      className={`glass-card rounded-[1.75rem] border-2 border-slate-800/80 p-6 ${c.bg}`}
                    >
                      {/* Nome */}
                      <h3 className="text-xl font-bold text-slate-100 mb-2">{tpl.nome}</h3>

                      {/* Descrição */}
                      {tpl.descricao && (
                        <p className="text-slate-400 text-sm mb-4">{tpl.descricao}</p>
                      )}

                      {/* Badge de cor */}
                      <div className="mb-4">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${c.badge}`}>
                          {tpl.cor}
                        </span>
                      </div>

                      {/* Botões de ação */}
                      <div className="flex gap-2 flex-wrap pt-4 border-t border-slate-800/50">
                        <Link
                          href={`/admin/templates/${tpl.id}/edit`}
                          className="button-primary px-4 py-2 text-xs font-semibold rounded-xl transition"
                        >
                          ✏️ Editar
                        </Link>
                        <button
                          onClick={() => {
                            setClonarId(tpl.id);
                            setClonarNome(`${tpl.nome} (cópia)`);
                          }}
                          className="button-secondary px-4 py-2 text-xs font-semibold rounded-xl transition text-slate-300 hover:text-slate-100"
                        >
                          📋 Clonar
                        </button>
                        <button
                          onClick={() => setConfirmandoDelete(tpl.id)}
                          className="px-4 py-2 bg-rose-500/20 text-rose-300 rounded-xl hover:bg-rose-500/30 transition text-xs font-semibold"
                        >
                          🗑️ Deletar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ──── Modo CRIAR ──── */}
        {mostrando === 'criar' && (
          <div className="glass-card rounded-[2rem] border-slate-800/90 p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-100 mb-6">➕ Nova base de análises</h2>

            <div className="space-y-5">
              {/* Nome */}
              <div>
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

              {/* Descrição */}
              <div>
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

              {/* Cor */}
              <div>
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
                          ? `ring-2 ${COR_MAP[c].btn} bg-slate-800/50`
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

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCriar}
                  disabled={salvando}
                  className="button-primary px-6 py-3 text-sm font-semibold shadow-lg shadow-sky-500/20 rounded-xl disabled:opacity-60"
                >
                  {salvando ? '💾 Salvando...' : '💾 Salvar'}
                </button>
                <button
                  onClick={() => {
                    setMostrando('lista');
                    setNome('');
                    setDescricao('');
                    setCor('blue');
                    setErro('');
                  }}
                  disabled={salvando}
                  className="button-secondary px-6 py-3 text-sm font-semibold rounded-xl disabled:opacity-60"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ──── Modal de Confirmação Delete ──── */}
      {confirmandoDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-[2rem] border-slate-800/90 p-6 max-w-sm">
            <h3 className="text-lg font-bold text-slate-100 mb-4">
              ⚠️ Confirmar Deleção
            </h3>
            <p className="text-slate-400 mb-6">
              Tem certeza que deseja deletar esta base de análises? Todas as suas análises também serão removidas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeletar(confirmandoDelete)}
                disabled={salvando}
                className="px-4 py-2 bg-rose-500/20 text-rose-300 rounded-xl hover:bg-rose-500/30 font-semibold transition disabled:opacity-60"
              >
                {salvando ? '⏳ Deletando...' : '🗑️ Deletar'}
              </button>
              <button
                onClick={() => setConfirmandoDelete(null)}
                disabled={salvando}
                className="button-secondary px-4 py-2 rounded-xl font-semibold transition disabled:opacity-60"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── Modal de Clonar ──── */}
      {clonarId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-[2rem] border-slate-800/90 p-6 max-w-sm">
            <h3 className="text-lg font-bold text-slate-100 mb-4">
              📋 Clonar base de análises
            </h3>
            <input
              type="text"
              placeholder="Nome da nova base de análises"
              value={clonarNome}
              onChange={(e) => setClonarNome(e.target.value)}
              className="input-dark w-full rounded-xl px-4 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleClonar(clonarId)}
                disabled={salvando}
                className="button-primary px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
              >
                {salvando ? '⏳ Clonando...' : '📋 Clonar'}
              </button>
              <button
                onClick={() => {
                  setClonarId(null);
                  setClonarNome('');
                }}
                disabled={salvando}
                className="button-secondary px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
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
