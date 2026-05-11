// lib/laudosServiceSupabase.js
// Serviço para gerenciar laudos no Supabase

import { supabase } from './supabaseClient';

// ============================================
// IDIOMAS DISPONÍVEIS
// ============================================

export const IDIOMAS_DISPONIVEIS = [
  { codigo: 'pt-BR', label: '🇧🇷 Português (Brasil)', nativo: 'Português' },
  { codigo: 'en-US', label: '🇬🇧 English (USA)', nativo: 'English' },
  { codigo: 'es-ES', label: '🇪🇸 Español (España)', nativo: 'Español' },
  { codigo: 'fr-FR', label: '🇫🇷 Français (France)', nativo: 'Français' },
];

// ============================================
// AUTENTICAÇÃO
// ============================================

export async function registrar(email, senha, nome) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome: nome,
        }
      }
    });

    if (error) throw error;

    return data; // retorna { user, session } — session é null se email confirmation estiver ativo
  } catch (error) {
    console.error('Erro ao registrar:', error.message);
    throw error;
  }
}

export async function login(email, senha) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) throw error;

    return data.user;
  } catch (error) {
    console.error('Erro ao fazer login:', error.message);
    throw error;
  }
}

export async function recuperarSenha(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  } catch (error) {
    console.error('Erro ao enviar email de recuperação:', error.message);
    throw error;
  }
}

export async function loginComGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Erro ao fazer login com Google:', error.message);
    throw error;
  }
}

export async function logout() {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
  }
}

// ============================================
// LAUDOS - CRUD
// ============================================

export async function criarLaudo(laudoData) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Usuário não autenticado');

    // Gerar número sequencial via função do banco (LAB-2000, LAB-2001, ...)
    const { data: numeroData, error: numeroError } = await supabase.rpc('proximo_numero_laudo');
    if (numeroError) throw numeroError;
    const numero = numeroData;

    const { data, error } = await supabase
      .from('laudos')
      .insert({
        numero,
        criador_id: user.id,
        ...laudoData,
        status: 'draft',
      })
      .select();

    if (error) throw error;

    return data[0];
  } catch (error) {
    console.error('Erro ao criar laudo:', error.message);
    throw error;
  }
}

export async function atualizarLaudo(laudoId, updateData) {
  try {
    const { error } = await supabase
      .from('laudos')
      .update({
        ...updateData,
        atualizado_em: new Date(),
      })
      .eq('id', laudoId);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao atualizar laudo:', error.message);
    throw error;
  }
}

export async function finalizarLaudo(laudoId, pdfUrl, status = 'approved', idiomaPdf = 'pt-BR') {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('laudos')
      .update({
        status,
        pdf_url: pdfUrl,
        idioma_pdf: idiomaPdf,
        finalizado_em: new Date(),
        assinador_por: user.email,
        assinador_em: new Date(),
      })
      .eq('id', laudoId);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao finalizar laudo:', error.message);
    throw error;
  }
}

export async function meuHistoricoLaudos(filtros = {}, userId) {
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      uid = user.id;
    }

    let query = supabase
      .from('laudos')
      .select('id, numero, cliente, artigo, cor, op, status, criado_em')
      .eq('criador_id', uid)
      .order('criado_em', { ascending: false });

    if (filtros.cliente) {
      query = query.ilike('cliente', `%${filtros.cliente}%`);
    }

    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }

    if (filtros.numero) {
      const termo = filtros.numero.toUpperCase().includes('LAB')
        ? filtros.numero
        : `LAB-${filtros.numero}`;
      query = query.ilike('numero', `%${termo}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Erro ao recuperar laudos:', error.message);
    return [];
  }
}

export async function getLaudo(laudoId) {
  try {
    const { data, error } = await supabase
      .from('laudos')
      .select('*')
      .eq('id', laudoId)
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Erro ao buscar laudo:', error.message);
    throw error;
  }
}

export async function deletarLaudo(laudoId) {
  try {
    // Deletar fotos vinculadas ao laudo
    const { data: analises } = await supabase
      .from('analises')
      .select('foto_url')
      .eq('laudo_id', laudoId);

    if (analises) {
      for (const analise of analises) {
        if (analise.foto_url) {
          const caminho = analise.foto_url.split('fotos-laudos/')[1];
          if (caminho) await supabase.storage.from('fotos-laudos').remove([caminho]);
        }
      }
    }

    // Deletar PDF
    const { data: laudo } = await supabase
      .from('laudos')
      .select('pdf_url')
      .eq('id', laudoId)
      .single();

    if (laudo?.pdf_url) {
      await supabase.storage.from('pdfs-laudos').remove([laudo.pdf_url]);
    }

    // Análises deletadas automaticamente por CASCADE
    const { error } = await supabase.from('laudos').delete().eq('id', laudoId);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao deletar laudo:', error.message);
    throw error;
  }
}

export async function duplicarLaudo(laudoOriginalId) {
  try {
    const laudoOriginal = await getLaudo(laudoOriginalId);

    const { id, numero, pdf_url, assinador_por, assinador_em, finalizado_em, criado_em, ...laudoDados } =
      laudoOriginal;

    const novoLaudo = await criarLaudo(laudoDados);

    return novoLaudo;
  } catch (error) {
    console.error('Erro ao duplicar laudo:', error.message);
    throw error;
  }
}

// ============================================
// ANÁLISES
// ============================================

export async function getAnalises(laudoId) {
  try {
    const { data, error } = await supabase
      .from('analises')
      .select('*')
      .eq('laudo_id', laudoId)
      .order('criado_em', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar análises:', error.message);
    throw error;
  }
}

export async function adicionarAnalise(laudoId, analiseData) {
  try {
    const { data, error } = await supabase
      .from('analises')
      .insert({
        laudo_id: laudoId,
        ...analiseData,
      })
      .select();

    if (error) throw error;

    return data[0];
  } catch (error) {
    console.error('Erro ao adicionar análise:', error.message);
    throw error;
  }
}

export async function atualizarAnalise(analiseId, updateData) {
  try {
    const { error } = await supabase
      .from('analises')
      .update({
        ...updateData,
        atualizado_em: new Date(),
      })
      .eq('id', analiseId);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao atualizar análise:', error.message);
    throw error;
  }
}

export async function deletarAnalise(analiseId) {
  try {
    const { error } = await supabase.from('analises').delete().eq('id', analiseId);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao deletar análise:', error.message);
    throw error;
  }
}

// ============================================
// FOTOS
// ============================================

export async function uploadFoto(laudoId, analiseId, file) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Usuário não autenticado');

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('Foto muito grande. Máximo 5MB');
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('Arquivo deve ser uma imagem');
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const caminhoArquivo = `laudos/${user.id}/${laudoId}/analise-${analiseId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('fotos-laudos')
      .upload(caminhoArquivo, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('fotos-laudos').getPublicUrl(caminhoArquivo);

    return data.publicUrl;
  } catch (error) {
    console.error('Erro ao fazer upload:', error.message);
    throw error;
  }
}

export async function deletarFoto(caminhoFoto) {
  try {
    const { error } = await supabase.storage.from('fotos-laudos').remove([caminhoFoto]);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao deletar foto:', error.message);
  }
}

// ============================================
// ESTATÍSTICAS
// ============================================

export async function obterEstatisticas(userId) {
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { total: 0, aprovados: 0, reprovados: 0, taxa: 0 };
      uid = user.id;
    }

    const { data, error } = await supabase
      .from('laudos')
      .select('status')
      .eq('criador_id', uid);

    if (error) throw error;

    const total = data.length;
    const aprovados = data.filter((l) => l.status === 'approved').length;
    const reprovados = data.filter((l) => l.status === 'rejected').length;
    const taxa = total > 0 ? Math.round((aprovados / total) * 100) : 0;

    return { total, aprovados, reprovados, taxa };
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error.message);
    return { total: 0, aprovados: 0, reprovados: 0, taxa: 0 };
  }
}

// ============================================
// USUÁRIO
// ============================================

export async function obterDadosUsuario() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    return {
      id: user.id,
      email: user.email,
      ...data,
    };
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error.message);
    return null;
  }
}

export async function obterUsuarioLogado() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch (error) {
    console.error('Erro ao obter usuário logado:', error.message);
    return null;
  }
}

// ============================================
// NORMAS - CRUD
// ============================================

export async function listarNormas(filtro = '') {
  try {
    let query = supabase
      .from('normas')
      .select('*')
      .eq('ativo', true)
      .order('codigo', { ascending: true });

    if (filtro.trim()) {
      query = query.or(`codigo.ilike.%${filtro}%,descricao.ilike.%${filtro}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Erro ao listar normas:', error.message);
    return [];
  }
}

export async function criarNorma(codigo, descricao = '', specification = '', unidade = '') {
  try {
    const { data, error } = await supabase
      .from('normas')
      .insert({
        codigo: codigo.trim(),
        descricao: descricao.trim(),
        specification: specification.trim() || null,
        unidade: unidade.trim() || null,
        ativo: true,
      })
      .select();

    if (error) throw error;

    return data[0];
  } catch (error) {
    console.error('Erro ao criar norma:', error.message);
    throw error;
  }
}

export async function atualizarNorma(id, codigo, descricao = '', specification = '', unidade = '') {
  try {
    const { error } = await supabase
      .from('normas')
      .update({
        codigo: codigo.trim(),
        descricao: descricao.trim(),
        specification: specification.trim() || null,
        unidade: unidade.trim() || null,
        atualizado_em: new Date(),
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao atualizar norma:', error.message);
    throw error;
  }
}

export async function deletarNorma(id) {
  try {
    // Remove referências antes de deletar para evitar erro de foreign key
    await supabase.from('template_analises').update({ norma_id: null }).eq('norma_id', id);
    await supabase.from('catalogo_analises').update({ norma_id: null }).eq('norma_id', id);

    const { error } = await supabase
      .from('normas')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao deletar norma:', error.message);
    throw error;
  }
}

// ============================================
// TEMPLATES - CRUD (dinâmicos)
// ============================================

export async function listarTemplates() {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('*, analises:template_analises(id)')
      .eq('ativo', true)
      .order('criado_em', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Erro ao listar templates:', error.message);
    return [];
  }
}

export async function obterTemplate(id) {
  try {
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (templateError) throw templateError;

    const { data: analises, error: analisesError } = await supabase
      .from('template_analises')
      .select(`
        id,
        nome,
        specification,
        unidade,
        tipo_foto,
        ordem,
        norma:norma_id (
          id,
          codigo,
          descricao,
          unidade
        )
      `)
      .eq('template_id', id)
      .order('ordem', { ascending: true });

    if (analisesError) throw analisesError;

    return {
      ...template,
      analises: analises || [],
    };
  } catch (error) {
    console.error('Erro ao obter template:', error.message);
    throw error;
  }
}

export async function criarTemplate(nome, descricao = '', cor = 'blue') {
  try {
    const { data, error } = await supabase
      .from('templates')
      .insert({
        nome: nome.trim(),
        descricao: descricao.trim(),
        cor,
        ativo: true,
      })
      .select();

    if (error) throw error;

    return data[0];
  } catch (error) {
    console.error('Erro ao criar template:', error.message);
    throw error;
  }
}

export async function atualizarTemplate(id, nome, descricao = '', cor = 'blue') {
  try {
    const { error } = await supabase
      .from('templates')
      .update({
        nome: nome.trim(),
        descricao: descricao.trim(),
        cor,
        atualizado_em: new Date(),
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao atualizar template:', error.message);
    throw error;
  }
}

export async function deletarTemplate(id) {
  try {
    const { error } = await supabase
      .from('templates')
      .update({ ativo: false })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao deletar template:', error.message);
    throw error;
  }
}

export async function clonarTemplate(id, novoNome) {
  try {
    const original = await obterTemplate(id);

    const novoTemplate = await criarTemplate(
      novoNome || `${original.nome} (cópia)`,
      original.descricao,
      original.cor
    );

    if (original.analises && original.analises.length > 0) {
      await Promise.all(
        original.analises.map((analise) =>
          adicionarAnaliseTemplate(
            novoTemplate.id,
            analise.nome,
            analise.norma?.id || null,
            analise.specification,
            analise.tipo_foto,
            analise.unidade
          )
        )
      );
    }

    return novoTemplate;
  } catch (error) {
    console.error('Erro ao clonar template:', error.message);
    throw error;
  }
}

// ============================================
// TEMPLATE ANÁLISES - CRUD
// ============================================

export async function adicionarAnaliseTemplate(
  templateId,
  nome,
  normaId = null,
  specification = '',
  tipoFoto = 'optional',
  unidade = ''
) {
  try {
    const { data: maxOrdem } = await supabase
      .from('template_analises')
      .select('ordem')
      .eq('template_id', templateId)
      .order('ordem', { ascending: false })
      .limit(1);

    const ordem = (maxOrdem?.[0]?.ordem ?? -1) + 1;

    const { data, error } = await supabase
      .from('template_analises')
      .insert({
        template_id: templateId,
        nome: nome.trim(),
        norma_id: normaId,
        specification: specification.trim(),
        unidade: unidade.trim() || null,
        tipo_foto: tipoFoto,
        ordem,
      })
      .select();

    if (error) throw error;

    return data[0];
  } catch (error) {
    console.error('Erro ao adicionar análise ao template:', error.message);
    throw error;
  }
}

export async function atualizarAnaliseTemplate(
  id,
  nome,
  normaId = null,
  specification = '',
  tipoFoto = 'optional',
  unidade = ''
) {
  try {
    const { error } = await supabase
      .from('template_analises')
      .update({
        nome: nome.trim(),
        norma_id: normaId,
        specification: specification.trim(),
        unidade: unidade.trim() || null,
        tipo_foto: tipoFoto,
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao atualizar análise do template:', error.message);
    throw error;
  }
}

export async function deletarAnaliseTemplate(id) {
  try {
    const { error } = await supabase
      .from('template_analises')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao deletar análise do template:', error.message);
    throw error;
  }
}

// ============================================
// CATÁLOGO DE ANÁLISES
// ============================================

export async function listarCatalogoAnalises(filtro = '') {
  try {
    let query = supabase
      .from('catalogo_analises')
      .select(`
        id, nome, specification, unidade, tipo_foto,
        norma:norma_id ( id, codigo, descricao, specification, unidade )
      `)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (filtro.trim()) {
      query = query.ilike('nome', `%${filtro}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao listar catálogo de análises:', error.message);
    return [];
  }
}

export async function criarCatalogoAnalise(nome, normaId = null, specification = '', tipoFoto = 'optional', unidade = '') {
  try {
    const { data, error } = await supabase
      .from('catalogo_analises')
      .insert({
        nome: nome.trim(),
        norma_id: normaId || null,
        specification: specification.trim() || null,
        unidade: unidade.trim() || null,
        tipo_foto: tipoFoto,
        ativo: true,
      })
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Erro ao criar análise no catálogo:', error.message);
    throw error;
  }
}

export async function atualizarCatalogoAnalise(id, nome, normaId = null, specification = '', tipoFoto = 'optional', unidade = '') {
  try {
    const { error } = await supabase
      .from('catalogo_analises')
      .update({
        nome: nome.trim(),
        norma_id: normaId || null,
        specification: specification.trim() || null,
        unidade: unidade.trim() || null,
        tipo_foto: tipoFoto,
        atualizado_em: new Date(),
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao atualizar análise no catálogo:', error.message);
    throw error;
  }
}

export async function deletarCatalogoAnalise(id) {
  try {
    const { error } = await supabase
      .from('catalogo_analises')
      .update({ ativo: false })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao deletar análise do catálogo:', error.message);
    throw error;
  }
}

export async function reordenarAnaliseTemplate(analiseId, novaOrdem) {
  try {
    const { error } = await supabase
      .from('template_analises')
      .update({ ordem: novaOrdem })
      .eq('id', analiseId);

    if (error) throw error;
  } catch (error) {
    console.error('Erro ao reordenar análise:', error.message);
    throw error;
  }
}
