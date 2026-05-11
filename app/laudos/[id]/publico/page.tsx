'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getLaudo, getAnalises } from '@/lib/laudosServiceSupabase';
import { avaliarStatus, calcularStatusGeral } from '@/lib/avaliarAnalise';

type Analise = {
  id: string;
  nome: string;
  specification: string;
  unidade: string;
  norma: string;
  tipo_foto: string;
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
  codigo_item: string | null;
  ordem_compra: string | null;
  metragem: string | null;
  lotes: string | null;
  status: string;
  observacoes: string;
  criado_em: string;
  finalizado_em: string | null;
  assinador_por: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'APROVADO',
  rejected: 'REPROVADO',
  draft: 'RASCUNHO',
};

export default function PublicoLaudo() {
  const { id } = useParams<{ id: string }>();

  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);

  async function baixarPDF() {
    if (!laudo) return;
    const el = document.getElementById('laudo-content');
    if (!el) return;
    setGerando(true);
    try {
      const [domToImage, { default: jsPDF }] = await Promise.all([
        import('dom-to-image-more'),
        import('jspdf'),
      ]);
      const rect = el.getBoundingClientRect();
      const dataUrl = await domToImage.default.toJpeg(el, {
        quality: 0.97,
        bgcolor: '#ffffff',
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        scale: 2,
      });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const imgAspect = rect.width / rect.height;
      const availAspect = availW / availH;
      let drawW: number, drawH: number;
      if (imgAspect > availAspect) {
        drawW = availW;
        drawH = drawW / imgAspect;
      } else {
        drawH = availH;
        drawW = drawH * imgAspect;
      }
      const x = margin + (availW - drawW) / 2;
      const y = margin + (availH - drawH) / 2;
      pdf.addImage(dataUrl, 'JPEG', x, y, drawW, drawH);
      pdf.save(`${laudo.numero}.pdf`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Erro ao gerar PDF:', msg);
      alert(`Erro ao gerar PDF: ${msg}`);
    } finally {
      setGerando(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [l, a] = await Promise.all([getLaudo(id), getAnalises(id)]);
        setLaudo(l);
        setAnalises(a);
      } catch {
        setErro('Laudo não encontrado ou não disponível.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function copiarLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <p style={{ color: '#64748b', fontFamily: 'Arial, sans-serif' }}>Carregando laudo...</p>
      </div>
    );
  }

  if (erro || !laudo) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <p style={{ color: '#ef4444', fontFamily: 'Arial, sans-serif' }}>{erro || 'Laudo não encontrado.'}</p>
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
  const aprovados = analises.filter(
    (a) => (avaliarStatus(a.resultado, a.specification) ?? a.status_analise) === 'approved'
  ).length;
  const reprovados = analises.filter(
    (a) => (avaliarStatus(a.resultado, a.specification) ?? a.status_analise) === 'rejected'
  ).length;

  return (
    <>
      <style>{`
        html, body {
          background: #f1f5f9 !important;
          color: #111827 !important;
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #ffffff !important; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Top bar */}
      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#1e293b', borderBottom: '1px solid #334155',
        padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>
          Laudo Técnico · <strong style={{ color: '#e2e8f0' }}>{laudo.numero}</strong>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={baixarPDF}
            disabled={gerando}
            style={{
              background: gerando ? '#065f46' : '#059669',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: gerando ? 'not-allowed' : 'pointer',
              opacity: gerando ? 0.7 : 1,
            }}
          >
            {gerando ? 'Gerando PDF...' : '⬇ Baixar PDF'}
          </button>
          <button
            onClick={copiarLink}
            style={{
              background: copiado ? '#1d4ed8' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {copiado ? '✓ Link copiado!' : 'Copiar link'}
          </button>
          <button
            onClick={() => window.print()}
            style={{
              background: '#334155', color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Imprimir
          </button>
        </div>
      </div>

      <div id="laudo-content" style={{ maxWidth: 900, margin: '32px auto', padding: '32px', background: '#ffffff', fontSize: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', borderRadius: 12 }}>

        {/* Header */}
        <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: 16, marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <img src="/logo-abuhler.png" alt="A. Bühler Genuine Leather" style={{ height: 48, width: 'auto', marginBottom: 6 }} />
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', margin: 0 }}>Laudo Técnico</p>
            <p style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 'bold', color: '#1f2937', margin: '4px 0 0' }}>{laudo.numero}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>Data de emissão</p>
            <p style={{ fontWeight: 600, margin: '2px 0 8px' }}>
              {new Date(laudo.finalizado_em ?? laudo.criado_em).toLocaleDateString('pt-BR')}
            </p>
            <span style={{
              padding: '4px 12px', borderRadius: 4, fontWeight: 'bold', fontSize: 12, display: 'inline-block',
              background: statusGeral === 'approved' ? '#dcfce7' : statusGeral === 'rejected' ? '#fee2e2' : '#f3f4f6',
              color: statusGeral === 'approved' ? '#166534' : statusGeral === 'rejected' ? '#991b1b' : '#374151',
            }}>
              {STATUS_LABEL[statusGeral] ?? 'RASCUNHO'}
            </span>
          </div>
        </div>

        {/* Product info */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 8 }}>
            Informações do Produto
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              {(([
                ['Cliente', laudo.cliente],
                ['Artigo / Material', laudo.artigo],
                laudo.cor ? ['Cor', laudo.cor] : null,
                laudo.op ? ['Ordem de Produção (OP)', laudo.op] : null,
                ['Responsável Técnico', laudo.responsavel],
                laudo.codigo_item ? ['Código do item', laudo.codigo_item] : null,
                laudo.ordem_compra ? ['Ordem de compra', laudo.ordem_compra] : null,
                laudo.metragem ? ['Metragem', laudo.metragem] : null,
                laudo.lotes ? ['Lotes', laudo.lotes] : null,
              ].filter(Boolean) as [string, string][])
                .reduce<[string, string][][]>((rows, item, i) => {
                  if (i % 2 === 0) rows.push([item]);
                  else rows[rows.length - 1].push(item);
                  return rows;
                }, [])
              ).map((pair, ri) => (
                <tr key={ri} style={{ border: '1px solid #d1d5db' }}>
                  <td style={{ padding: '4px 8px', background: '#f9fafb', fontWeight: 600, width: 144 }}>{pair[0][0]}</td>
                  <td style={{ padding: '4px 8px', width: '30%' }}>{pair[0][1] || '—'}</td>
                  {pair[1] ? (
                    <>
                      <td style={{ padding: '4px 8px', background: '#f9fafb', fontWeight: 600, width: 144 }}>{pair[1][0]}</td>
                      <td style={{ padding: '4px 8px' }}>{pair[1][1] || '—'}</td>
                    </>
                  ) : <td colSpan={2} />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Analyses table */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 8 }}>
            Análises Realizadas
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#2563eb', color: '#fff' }}>
                {['Análise', 'Especificação', 'Resultado', 'Unidade', 'Norma', 'Status'].map((h, i) => (
                  <th key={h} style={{ padding: '8px 12px', fontWeight: 600, textAlign: i === 0 ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analises.map((a, i) => {
                const status = avaliarStatus(a.resultado, a.specification) ?? a.status_analise;
                return (
                  <tr key={a.id} style={{
                    background: status === 'approved' ? '#f0fdf4' : status === 'rejected' ? '#fef2f2' : i % 2 === 0 ? '#fff' : '#f9fafb',
                  }}>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', fontWeight: 500 }}>{a.nome}</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'monospace' }}>{a.specification || '—'}</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>{a.resultado || '—'}</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#4b5563', fontFamily: 'monospace' }}>{a.unidade || '—'}</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280' }}>{a.norma || '—'}</td>
                    <td style={{ padding: '8px 12px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {status ? (
                        <span style={{
                          fontWeight: 'bold', fontSize: 11, padding: '2px 8px', borderRadius: 4,
                          background: status === 'approved' ? '#dcfce7' : '#fee2e2',
                          color: status === 'approved' ? '#166534' : '#991b1b',
                        }}>
                          {STATUS_LABEL[status]}
                        </span>
                      ) : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
                <td colSpan={4} style={{ padding: '8px 12px', border: '1px solid #e5e7eb' }}>
                  Resultado Final — {aprovados} aprovada(s), {reprovados} reprovada(s)
                </td>
                <td colSpan={2} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <span style={{
                    fontWeight: 'bold', fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: statusGeral === 'approved' ? '#dcfce7' : statusGeral === 'rejected' ? '#fee2e2' : '#f3f4f6',
                    color: statusGeral === 'approved' ? '#166534' : statusGeral === 'rejected' ? '#991b1b' : '#374151',
                  }}>
                    {STATUS_LABEL[statusGeral] ?? 'RASCUNHO'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Photos */}
        {analises.some((a) => a.foto_url) && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 8 }}>
              Registro Fotográfico
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {analises.filter((a) => a.foto_url).map((a) => (
                <div key={a.id} style={{ textAlign: 'center' }}>
                  <img src={a.foto_url!} alt={a.nome} style={{ width: '100%', height: 144, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb' }} />
                  <p style={{ fontSize: 11, color: '#4b5563', marginTop: 4, fontWeight: 500 }}>{a.nome}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observations */}
        {laudo.observacoes && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: 8 }}>
              Observações
            </p>
            <p style={{ color: '#374151', border: '1px solid #e5e7eb', borderRadius: 4, padding: 12, margin: 0 }}>{laudo.observacoes}</p>
          </div>
        )}

        {/* Signature */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #d1d5db', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <img src="/assinatura-cristiano.png" alt="Assinatura" style={{ height: 45, width: 'auto', marginBottom: 2 }} />
            <div style={{ borderBottom: '1px solid #9ca3af', width: 224, marginBottom: 4 }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: 0 }}>Cristiano Luis Backes</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>Responsável Técnico</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af' }}>
            <p style={{ margin: 0 }}>Documento gerado em {new Date().toLocaleDateString('pt-BR')}</p>
            <p style={{ margin: 0, fontFamily: 'monospace', color: '#6b7280' }}>{laudo.numero}</p>
          </div>
        </div>
      </div>
    </>
  );
}
