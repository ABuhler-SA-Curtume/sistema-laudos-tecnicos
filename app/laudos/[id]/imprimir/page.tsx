'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
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

export default function ImprimirLaudo() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  async function baixarPDF(modo: 'download' | 'share' = 'download') {
    if (!laudo) return;
    setGerando(true);
    try {
      const { jsPDF } = await import('jspdf');

      type S = 'approved' | 'rejected' | 'draft';
      const getS = (a: Analise): S | null =>
        (avaliarStatus(a.resultado, a.specification) ?? (a.status_analise as S | null)) as S | null;

      const ss = analises.map(getS);
      const sg: S = ss.some(s => s === 'rejected') ? 'rejected'
        : ss.length > 0 && ss.every(s => s === 'approved') ? 'approved' : 'draft';

      const SLBL: Record<S, string> = { approved: 'APROVADO', rejected: 'REPROVADO', draft: 'RASCUNHO' };
      const SBG: Record<S, [number,number,number]> = { approved: [220,252,231], rejected: [254,226,226], draft: [243,244,246] };
      const STC: Record<S, [number,number,number]> = { approved: [21,128,61], rejected: [220,38,38], draft: [55,65,81] };

      const aprovados = analises.filter(a => getS(a) === 'approved').length;
      const reprovados = analises.filter(a => getS(a) === 'rejected').length;
      const dataEmissao = new Date(laudo.finalizado_em ?? laudo.criado_em).toLocaleDateString('pt-BR');

      const [logoImg, sigImg] = await Promise.all([
        pdfLoadImage('/logo-abuhler.png'),
        pdfLoadImage('/assinatura-cristiano.png'),
      ]);

      const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait' });
      const W = 210, M = 12, CW = W - 2 * M;
      let y = M;

      const f = (r: number, g: number, b: number) => doc.setFillColor(r, g, b);
      const d = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b);
      const tc = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);

      const drawBadge = (lbl: string, bg: [number,number,number], fg: [number,number,number], cx: number, cy: number) => {
        const bw = Math.max(doc.getTextWidth(lbl) + 5, 20);
        f(bg[0], bg[1], bg[2]); d(bg[0], bg[1], bg[2]);
        doc.roundedRect(cx - bw/2, cy - 2.25, bw, 4.5, 0.8, 0.8, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); tc(fg[0], fg[1], fg[2]);
        doc.text(lbl, cx, cy + 1.2, { align: 'center' });
      };

      // ─── HEADER ────────────────────────────────────────────────────────────
      if (logoImg) doc.addImage(logoImg, 'PNG', M, y, 30, 9.5);
      else { doc.setFont('helvetica','bold'); doc.setFontSize(11); tc(17,24,39); doc.text('A.Bühler', M, y+7); }
      doc.setFont('helvetica','normal'); doc.setFontSize(7); tc(107,114,128);
      doc.text('LAUDO TÉCNICO', M, y+13);
      doc.setFont('helvetica','bold'); doc.setFontSize(14); tc(17,24,39);
      doc.text(laudo.numero, M, y+20);

      doc.setFont('helvetica','normal'); doc.setFontSize(7); tc(107,114,128);
      doc.text('Data de emissão', W-M, y+3, { align:'right' });
      doc.setFont('helvetica','bold'); doc.setFontSize(10); tc(17,24,39);
      doc.text(dataEmissao, W-M, y+9, { align:'right' });
      drawBadge(SLBL[sg], SBG[sg], STC[sg], W-M-16, y+18);

      y += 23;
      d(37,99,235); doc.setLineWidth(0.5); doc.line(M, y, W-M, y);
      y += 5;

      // ─── INFORMAÇÕES DO PRODUTO ─────────────────────────────────────────────
      doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(107,114,128);
      doc.text('INFORMAÇÕES DO PRODUTO', M, y); y += 3;

      const INFO: [string,string][] = [
        ['Cliente', laudo.cliente],
        ['Artigo / Material', laudo.artigo],
        ...(laudo.cor ? [['Cor', laudo.cor] as [string,string]] : []),
        ...(laudo.op ? [['Ordem de Produção', laudo.op] as [string,string]] : []),
        ['Responsável Técnico', laudo.responsavel],
        ...(laudo.codigo_item ? [['Código do item', laudo.codigo_item] as [string,string]] : []),
        ...(laudo.ordem_compra ? [['Ordem de compra', laudo.ordem_compra] as [string,string]] : []),
        ...(laudo.metragem ? [['Metragem', laudo.metragem] as [string,string]] : []),
        ...(laudo.lotes ? [['Lotes', laudo.lotes] as [string,string]] : []),
      ];

      const RH = 6, HALF = CW/2, LW = 40, VW = HALF - LW;
      const infoCell = (x: number, yy: number, w: number, isLbl: boolean, text: string) => {
        f(isLbl ? 249:255, isLbl ? 250:255, isLbl ? 251:255);
        d(209,213,219); doc.setLineWidth(0.2);
        doc.rect(x, yy, w, RH, 'FD');
        doc.setFont('helvetica', isLbl ? 'bold':'normal'); doc.setFontSize(8); tc(17,24,39);
        doc.text(pdfTrunc(text, isLbl ? 20:22), x+2, yy+RH*0.65);
      };

      for (let i = 0; i < INFO.length; i += 2) {
        const L = INFO[i], R = INFO[i+1];
        infoCell(M, y, LW, true, L[0]);
        infoCell(M+LW, y, VW, false, L[1]||'—');
        if (R) {
          infoCell(M+HALF, y, LW, true, R[0]);
          infoCell(M+HALF+LW, y, VW, false, R[1]||'—');
        } else {
          f(255,255,255); d(209,213,219); doc.rect(M+HALF, y, HALF, RH, 'FD');
        }
        y += RH;
      }
      y += 6;

      // ─── ANÁLISES REALIZADAS ────────────────────────────────────────────────
      doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(107,114,128);
      doc.text('ANÁLISES REALIZADAS', M, y); y += 3;

      const COLS = [52,30,22,20,26,36];
      const XS = COLS.map((_,i) => M + COLS.slice(0,i).reduce((s,v)=>s+v,0));

      f(37,99,235); doc.rect(M, y, CW, 7, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); tc(255,255,255);
      ['Análise','Especificação','Resultado','Unidade','Norma','Status'].forEach((h,i) => {
        doc.text(h, i===0 ? XS[i]+2 : XS[i]+COLS[i]/2, y+5, { align: i===0 ? 'left':'center' });
      });
      y += 7;

      for (let i = 0; i < analises.length; i++) {
        const a = analises[i];
        const s = getS(a);
        const bg: [number,number,number] = s==='approved' ? [240,253,244] : s==='rejected' ? [254,242,242] : i%2===0 ? [255,255,255] : [249,250,251];

        if (y+6.5 > 282) { doc.addPage(); y = M; }

        f(bg[0],bg[1],bg[2]); d(229,231,235); doc.setLineWidth(0.2);
        COLS.forEach((cw,ci) => doc.rect(XS[ci], y, cw, 6.5, 'FD'));

        const TY = y+4.3;
        doc.setFontSize(8); tc(17,24,39);
        doc.setFont('helvetica','normal'); doc.text(pdfTrunc(a.nome,28), XS[0]+2, TY);
        doc.setFont('courier','normal'); doc.text(pdfTrunc(a.specification||'—',14), XS[1]+COLS[1]/2, TY, {align:'center'});
        doc.setFont('courier','bold'); doc.text(a.resultado||'—', XS[2]+COLS[2]/2, TY, {align:'center'});
        doc.setFont('courier','normal'); tc(107,114,128); doc.text(a.unidade||'—', XS[3]+COLS[3]/2, TY, {align:'center'});
        doc.setFont('helvetica','normal'); doc.text(pdfTrunc(a.norma||'—',13), XS[4]+COLS[4]/2, TY, {align:'center'});
        if (s) drawBadge(SLBL[s], SBG[s], STC[s], XS[5]+COLS[5]/2, y+3.25);
        else { tc(156,163,175); doc.text('—', XS[5]+COLS[5]/2, TY, {align:'center'}); }

        y += 6.5;
      }

      // linha de totais
      if (y+6.5 > 282) { doc.addPage(); y = M; }
      const FS = COLS.slice(0,5).reduce((a,b)=>a+b,0);
      f(243,244,246); d(229,231,235); doc.setLineWidth(0.2);
      doc.rect(M, y, FS, 6.5, 'FD');
      doc.rect(M+FS, y, COLS[5], 6.5, 'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); tc(17,24,39);
      doc.text(`Resultado Final — ${aprovados} aprovada(s), ${reprovados} reprovada(s)`, M+2, y+4.3);
      drawBadge(SLBL[sg], SBG[sg], STC[sg], M+FS+COLS[5]/2, y+3.25);
      y += 6.5 + 8;

      // ─── OBSERVAÇÕES ───────────────────────────────────────────────────────
      if (laudo.observacoes) {
        if (y+20 > 282) { doc.addPage(); y = M; }
        doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(107,114,128);
        doc.text('OBSERVAÇÕES', M, y); y += 3;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); tc(55,65,81);
        const lines = doc.splitTextToSize(laudo.observacoes, CW-4) as string[];
        const OH = lines.length*4.5 + 5;
        d(229,231,235); doc.setLineWidth(0.2); doc.rect(M, y, CW, OH);
        doc.text(lines, M+2, y+4.5);
        y += OH + 8;
      }

      // ─── ASSINATURA ────────────────────────────────────────────────────────
      const SY = Math.max(y, 265);
      d(209,213,219); doc.setLineWidth(0.3); doc.line(M, SY, W-M, SY);
      if (sigImg) doc.addImage(sigImg, 'PNG', M, SY+2, 26, 8);
      d(156,163,175); doc.setLineWidth(0.3); doc.line(M, SY+12, M+58, SY+12);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); tc(55,65,81);
      doc.text('Cristiano Luis Backes', M, SY+17);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); tc(156,163,175);
      doc.text('Responsável Técnico', M, SY+21);
      doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')}`, W-M, SY+15, { align:'right' });
      doc.setFont('courier','normal'); tc(107,114,128);
      doc.text(laudo.numero, W-M, SY+20, { align:'right' });

      const blob = doc.output('blob');
      const filename = `${laudo.numero}.pdf`;

      if (modo === 'share') {
        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `Laudo ${laudo.numero}`,
            text: `Laudo técnico — ${laudo.cliente}`,
            files: [file],
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = filename; a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGerando(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    if (!id) return;
    (async () => {
      const [l, a] = await Promise.all([getLaudo(id), getAnalises(id)]);
      setLaudo(l);
      setAnalises(a);
      setLoading(false);
    })();
  }, [id, user]);


  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return null; // useAuth já redireciona
  }

  if (loading || !laudo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Preparando documento...</p>
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
          background: #ffffff !important;
          color: #111827 !important;
          font-family: Arial, sans-serif;
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

      {/* Toolbar – hidden when printing */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => baixarPDF('download')}
          disabled={gerando}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow disabled:opacity-60"
        >
          {gerando ? 'Gerando...' : '⬇ Baixar PDF'}
        </button>
        <button
          onClick={() => baixarPDF('share')}
          disabled={gerando}
          className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow disabled:opacity-60"
        >
          {gerando ? 'Gerando...' : '⤴ Compartilhar'}
        </button>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hidden sm:block"
        >
          Imprimir
        </button>
        <button
          onClick={() => window.close()}
          className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm"
        >
          Fechar
        </button>
      </div>

      <div id="laudo-content" className="max-w-4xl mx-auto p-8 text-gray-900" style={{ fontSize: '12px', backgroundColor: '#ffffff' }}>
        {/* Header */}
        <div className="border-b-2 border-blue-600 pb-4 mb-6 flex items-start justify-between">
          <div>
            <img
              src="/logo-abuhler.png"
              alt="A. Bühler Genuine Leather"
              style={{ height: 48, width: 'auto', marginBottom: 6 }}
            />
            <p className="text-xs uppercase tracking-widest text-gray-500">Laudo Técnico</p>
            <p className="text-lg font-mono font-bold text-gray-800 mt-1">{laudo.numero}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Data de emissão</p>
            <p className="font-semibold">
              {new Date(laudo.finalizado_em ?? laudo.criado_em).toLocaleDateString('pt-BR')}
            </p>
            <div
              className={`mt-2 px-3 py-1 rounded font-bold text-sm inline-block ${
                statusGeral === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : statusGeral === 'rejected'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {STATUS_LABEL[statusGeral] ?? 'RASCUNHO'}
            </div>
          </div>
        </div>

        {/* Product info */}
        <div className="mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            Informações do Produto
          </h2>
          <table className="w-full border-collapse" style={{ fontSize: '11px' }}>
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
                <tr key={ri} className="border border-gray-300">
                  <td className="px-2 py-1 bg-gray-50 font-semibold w-36">{pair[0][0]}</td>
                  <td className="px-2 py-1 w-[30%]">{pair[0][1] || '—'}</td>
                  {pair[1] ? (
                    <>
                      <td className="px-2 py-1 bg-gray-50 font-semibold w-36">{pair[1][0]}</td>
                      <td className="px-2 py-1">{pair[1][1] || '—'}</td>
                    </>
                  ) : (
                    <td colSpan={2} />
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Analyses table */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
            Análises Realizadas
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-3 py-2 text-left font-semibold">Análise</th>
                <th className="px-3 py-2 text-center font-semibold">Especificação</th>
                <th className="px-3 py-2 text-center font-semibold">Resultado</th>
                <th className="px-3 py-2 text-center font-semibold">Unidade</th>
                <th className="px-3 py-2 text-center font-semibold">Norma</th>
                <th className="px-3 py-2 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {analises.map((a, i) => {
                const status =
                  avaliarStatus(a.resultado, a.specification) ?? a.status_analise;
                return (
                  <tr
                    key={a.id}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    style={{
                      backgroundColor:
                        status === 'approved'
                          ? '#f0fdf4'
                          : status === 'rejected'
                          ? '#fef2f2'
                          : undefined,
                    }}
                  >
                    <td className="px-3 py-2 border border-gray-200 font-medium">{a.nome}</td>
                    <td className="px-3 py-2 border border-gray-200 text-center font-mono">
                      {a.specification || '—'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center font-mono font-bold">
                      {a.resultado || '—'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-gray-600 font-mono">
                      {a.unidade || '—'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-gray-500">
                      {a.norma || '—'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center">
                      {status ? (
                        <span
                          className={`font-bold text-xs px-2 py-0.5 rounded ${
                            status === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td className="px-3 py-2 border border-gray-200" colSpan={4}>
                  Resultado Final — {aprovados} aprovada(s), {reprovados} reprovada(s)
                </td>
                <td className="px-3 py-2 border border-gray-200 text-center">
                  <span
                    className={`font-bold text-xs px-2 py-0.5 rounded ${
                      statusGeral === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : statusGeral === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {STATUS_LABEL[statusGeral] ?? 'RASCUNHO'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Photos */}
        {analises.some((a) => a.foto_url) && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
              Registro Fotográfico
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {analises
                .filter((a) => a.foto_url)
                .map((a) => (
                  <div key={a.id} className="text-center">
                    <img
                      src={a.foto_url!}
                      alt={a.nome}
                      className="w-full h-36 object-cover rounded border border-gray-200"
                    />
                    <p className="text-xs text-gray-600 mt-1 font-medium">{a.nome}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Observations */}
        {laudo.observacoes && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
              Observações
            </h2>
            <p className="text-gray-700 border border-gray-200 rounded p-3">{laudo.observacoes}</p>
          </div>
        )}

        {/* Signature */}
        <div className="mt-8 pt-6 border-t border-gray-300">
          <div className="flex justify-between items-end">
            <div>
              <img
                src="/assinatura-cristiano.png"
                alt="Assinatura"
                style={{ height: 45, width: 'auto', marginBottom: 2 }}
              />
              <div className="border-b border-gray-400 w-56 mb-1" />
              <p className="text-xs font-semibold text-gray-700">Cristiano Luis Backes</p>
              <p className="text-xs text-gray-400">Responsável Técnico</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Documento gerado em {new Date().toLocaleDateString('pt-BR')}</p>
              <p className="font-mono text-gray-500">{laudo.numero}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function pdfTrunc(str: string, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

async function pdfLoadImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

