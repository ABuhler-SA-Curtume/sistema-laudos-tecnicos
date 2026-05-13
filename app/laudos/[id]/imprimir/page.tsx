'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { getLaudo, getAnalises, listarNormas, listarFotosLaudo } from '@/lib/laudosServiceSupabase';
import { avaliarStatus, calcularStatusGeral } from '@/lib/avaliarAnalise';
import { TRADUCOES, traduzirNomeAnalise, traduzirUnidade, type LaudoLang } from '@/lib/laudoTranslations';

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

type LaudoFoto = {
  id: string;
  url: string;
  caminho: string;
  legenda: string | null;
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
  idioma_pdf?: string | null;
};

export default function ImprimirLaudo() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [normaMap, setNormaMap] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<LaudoFoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [lang, setLang] = useState<LaudoLang>('pt-BR');

  function unidadeOf(a: Analise): string {
    return a.unidade || normaMap[a.norma] || '';
  }

  async function baixarPDF(modo: 'download' | 'share' = 'download') {
    if (!laudo) return;
    setGerando(true);
    const t = TRADUCOES[lang] ?? TRADUCOES['pt-BR'];
    try {
      const { jsPDF } = await import('jspdf');

      type S = 'approved' | 'rejected' | 'draft';
      const getS = (a: Analise): S | null =>
        (avaliarStatus(a.resultado, a.specification) ?? (a.status_analise as S | null)) as S | null;

      const ss = analises.map(getS);
      const sg: S = ss.some(s => s === 'rejected') ? 'rejected'
        : ss.length > 0 && ss.every(s => s === 'approved') ? 'approved' : 'draft';

      const SLBL: Record<S, string> = { approved: t.aprovado, rejected: t.reprovado, draft: t.rascunho };
      const SBG: Record<S, [number,number,number]> = { approved: [220,252,231], rejected: [254,226,226], draft: [243,244,246] };
      const STC: Record<S, [number,number,number]> = { approved: [21,128,61], rejected: [220,38,38], draft: [55,65,81] };

      const aprovados = analises.filter(a => getS(a) === 'approved').length;
      const reprovados = analises.filter(a => getS(a) === 'rejected').length;
      const dataEmissao = new Date(laudo.finalizado_em ?? laudo.criado_em).toLocaleDateString(lang);

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
      else { doc.setFont('helvetica','bold'); doc.setFontSize(11); tc(17,24,39); doc.text('A.Buhler', M, y+7); }
      doc.setFont('helvetica','normal'); doc.setFontSize(7); tc(107,114,128);
      doc.text(t.laudoTecnico, M, y+13);
      doc.setFont('helvetica','bold'); doc.setFontSize(14); tc(17,24,39);
      doc.text(laudo.numero, M, y+20);

      doc.setFont('helvetica','normal'); doc.setFontSize(7); tc(107,114,128);
      doc.text(t.dataEmissao, W-M, y+3, { align:'right' });
      doc.setFont('helvetica','bold'); doc.setFontSize(10); tc(17,24,39);
      doc.text(dataEmissao, W-M, y+9, { align:'right' });
      drawBadge(SLBL[sg], SBG[sg], STC[sg], W-M-16, y+18);

      y += 23;
      d(37,99,235); doc.setLineWidth(0.5); doc.line(M, y, W-M, y);
      y += 5;

      // ─── INFORMAÇÕES DO PRODUTO ─────────────────────────────────────────────
      doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(107,114,128);
      doc.text(t.informacoesProduto, M, y); y += 3;

      const INFO: [string,string][] = [
        [t.cliente, laudo.cliente],
        [t.artigo, laudo.artigo],
        ...(laudo.cor ? [[t.cor, laudo.cor] as [string,string]] : []),
        ...(laudo.op ? [[t.ordemProducao, laudo.op] as [string,string]] : []),
        [t.responsavelTecnico, laudo.responsavel],
        ...(laudo.codigo_item ? [[t.codigoItem, laudo.codigo_item] as [string,string]] : []),
        ...(laudo.ordem_compra ? [[t.ordemCompra, laudo.ordem_compra] as [string,string]] : []),
        ...(laudo.metragem ? [[t.metragem, laudo.metragem] as [string,string]] : []),
        ...(laudo.lotes ? [[t.lotes, laudo.lotes] as [string,string]] : []),
      ];

      const RH = 6, HALF = CW/2, LW = 40, VW = HALF - LW;
      const infoCell = (x: number, yy: number, w: number, isLbl: boolean, text: string) => {
        f(isLbl ? 249:255, isLbl ? 250:255, isLbl ? 251:255);
        d(209,213,219); doc.setLineWidth(0.2);
        doc.rect(x, yy, w, RH, 'FD');
        doc.setFont('helvetica', isLbl ? 'bold':'normal'); doc.setFontSize(8); tc(17,24,39);
        doc.text(pdfTrunc(text, isLbl ? 26:24), x+2, yy+RH*0.65);
      };

      for (let i = 0; i < INFO.length; i += 2) {
        const L = INFO[i], R = INFO[i+1];
        infoCell(M, y, LW, true, L[0]);
        infoCell(M+LW, y, VW, false, L[1]||'-');
        if (R) {
          infoCell(M+HALF, y, LW, true, R[0]);
          infoCell(M+HALF+LW, y, VW, false, R[1]||'-');
        } else {
          f(255,255,255); d(209,213,219); doc.rect(M+HALF, y, HALF, RH, 'FD');
        }
        y += RH;
      }
      y += 6;

      // ─── ANÁLISES REALIZADAS ────────────────────────────────────────────────
      doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(107,114,128);
      doc.text(t.analisesRealizadas, M, y); y += 3;

      // nome=44 spec=26 res=16 unit=26 norma=38 status=36 → total=186
      const COLS = [44,26,16,26,38,36];
      const XS = COLS.map((_,i) => M + COLS.slice(0,i).reduce((s,v)=>s+v,0));

      f(37,99,235); doc.rect(M, y, CW, 7, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); tc(255,255,255);
      [t.analise, t.especificacao, t.resultado, t.unidade, t.norma, t.status].forEach((h,i) => {
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
        doc.setFont('helvetica','normal'); doc.text(pdfTrunc(traduzirNomeAnalise(a.nome, lang), 24), XS[0]+2, TY);
        pdfSpecText(doc, a.specification||'', XS[1]+COLS[1]/2, TY, 13);
        doc.setFont('courier','bold'); tc(17,24,39); doc.text(a.resultado||'-', XS[2]+COLS[2]/2, TY, {align:'center'});
        doc.setFont('helvetica','normal'); doc.setFontSize(7); tc(107,114,128); doc.text(traduzirUnidade(unidadeOf(a), lang)||'-', XS[3]+COLS[3]/2, TY, {align:'center'}); doc.setFontSize(8);
        doc.setFont('helvetica','normal'); tc(17,24,39); doc.text(pdfTrunc(a.norma||'-',22), XS[4]+COLS[4]/2, TY, {align:'center'});
        if (s) drawBadge(SLBL[s], SBG[s], STC[s], XS[5]+COLS[5]/2, y+3.25);
        else { tc(156,163,175); doc.text('-', XS[5]+COLS[5]/2, TY, {align:'center'}); }

        y += 6.5;
      }

      // linha de totais
      if (y+6.5 > 282) { doc.addPage(); y = M; }
      const FS = COLS.slice(0,5).reduce((a,b)=>a+b,0);
      f(243,244,246); d(229,231,235); doc.setLineWidth(0.2);
      doc.rect(M, y, FS, 6.5, 'FD');
      doc.rect(M+FS, y, COLS[5], 6.5, 'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); tc(17,24,39);
      doc.text(t.resultadoFinal(aprovados, reprovados), M+2, y+4.3);
      drawBadge(SLBL[sg], SBG[sg], STC[sg], M+FS+COLS[5]/2, y+3.25);
      y += 6.5 + 8;

      // ─── OBSERVAÇÕES ───────────────────────────────────────────────────────
      if (laudo.observacoes) {
        if (y+20 > 282) { doc.addPage(); y = M; }
        doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(107,114,128);
        doc.text(t.observacoes, M, y); y += 3;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); tc(55,65,81);
        const lines = doc.splitTextToSize(laudo.observacoes, CW-4) as string[];
        const OH = lines.length*4.5 + 5;
        d(229,231,235); doc.setLineWidth(0.2); doc.rect(M, y, CW, OH);
        doc.text(lines, M+2, y+4.5);
        y += OH + 8;
      }

      // ─── FOTOS ─────────────────────────────────────────────────────────────
      if (fotos.length > 0) {
        if (y+12 > 282) { doc.addPage(); y = M; }
        doc.setFont('helvetica','bold'); doc.setFontSize(7); tc(107,114,128);
        doc.text(t.registroFotografico, M, y); y += 5;

        const FW = 85, FH = 60, FGAP = 6;
        const fotoImgs = await Promise.all(fotos.map(f => pdfLoadImage(f.url)));

        for (let i = 0; i < fotoImgs.length; i += 2) {
          const rowH = FH + (fotos[i]?.legenda || fotos[i+1]?.legenda ? 8 : 2);
          if (y + rowH > 282) { doc.addPage(); y = M; }

          const img1 = fotoImgs[i];
          const img2 = i+1 < fotoImgs.length ? fotoImgs[i+1] : null;

          if (img1) {
            doc.addImage(img1, 'JPEG', M, y, FW, FH);
            if (fotos[i].legenda) {
              doc.setFont('helvetica','normal'); doc.setFontSize(7); tc(107,114,128);
              doc.text(pdfTrunc(fotos[i].legenda!, 28), M + FW/2, y + FH + 4, { align: 'center' });
            }
          }
          if (img2) {
            doc.addImage(img2, 'JPEG', M + FW + FGAP, y, FW, FH);
            if (fotos[i+1].legenda) {
              doc.setFont('helvetica','normal'); doc.setFontSize(7); tc(107,114,128);
              doc.text(pdfTrunc(fotos[i+1].legenda!, 28), M + FW + FGAP + FW/2, y + FH + 4, { align: 'center' });
            }
          }
          y += rowH + 4;
        }
        y += 4;
      }

      // ─── ASSINATURA ────────────────────────────────────────────────────────
      const SY = Math.max(y, 265);
      d(209,213,219); doc.setLineWidth(0.3); doc.line(M, SY, W-M, SY);
      if (sigImg) doc.addImage(sigImg, 'PNG', M, SY+2, 55, 8);
      d(156,163,175); doc.setLineWidth(0.3); doc.line(M, SY+12, M+58, SY+12);
      doc.setFont('helvetica','bold'); doc.setFontSize(9); tc(55,65,81);
      doc.text('Cristiano Luis Backes', M, SY+17);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); tc(156,163,175);
      doc.text(t.responsavelTecnico, M, SY+21);
      doc.text(`${t.documentoGeradoEm} ${new Date().toLocaleDateString(lang)}`, W-M, SY+15, { align:'right' });
      doc.setFont('courier','normal'); tc(107,114,128);
      doc.text(laudo.numero, W-M, SY+20, { align:'right' });

      const blob = doc.output('blob');
      const filename = `${laudo.numero}.pdf`;

      if (modo === 'share') {
        const file = new File([blob], filename, { type: 'application/pdf' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: laudo.numero,
            text: `${lang === 'en-US' ? 'Technical report' : 'Laudo tecnico'} - ${laudo.cliente}`,
            files: [file],
          });
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);

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
      const [l, a, normas, fs] = await Promise.all([getLaudo(id), getAnalises(id), listarNormas(), listarFotosLaudo(id)]);
      setLaudo(l);
      setAnalises(a);
      setFotos(fs);
      const map: Record<string, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normas.forEach((n: any) => { if (n.codigo && n.unidade) map[n.codigo] = n.unidade; });
      setNormaMap(map);
      // Prioridade: parâmetro URL > idioma salvo no laudo > padrão pt-BR
      const urlLang = searchParams.get('lang') as LaudoLang | null;
      setLang(urlLang || (l.idioma_pdf as LaudoLang) || 'pt-BR');
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) return null;

  if (loading || !laudo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Preparando documento...</p>
      </div>
    );
  }

  const t = TRADUCOES[lang] ?? TRADUCOES['pt-BR'];
  const statusLabel: Record<string, string> = {
    approved: t.aprovado,
    rejected: t.reprovado,
    draft: t.rascunho,
  };

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

      {/* Toolbar */}
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
            <p className="text-xs uppercase tracking-widest text-gray-500">{t.laudoTecnico}</p>
            <p className="text-lg font-mono font-bold text-gray-800 mt-1">{laudo.numero}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{t.dataEmissao}</p>
            <p className="font-semibold">
              {new Date(laudo.finalizado_em ?? laudo.criado_em).toLocaleDateString(lang)}
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
              {statusLabel[statusGeral] ?? t.rascunho}
            </div>
          </div>
        </div>

        {/* Product info */}
        <div className="mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            {t.informacoesProduto}
          </h2>
          <table className="w-full border-collapse" style={{ fontSize: '11px' }}>
            <tbody>
              {(([
                [t.cliente, laudo.cliente],
                [t.artigo, laudo.artigo],
                laudo.cor ? [t.cor, laudo.cor] : null,
                laudo.op ? [t.ordemProducao, laudo.op] : null,
                [t.responsavelTecnico, laudo.responsavel],
                laudo.codigo_item ? [t.codigoItem, laudo.codigo_item] : null,
                laudo.ordem_compra ? [t.ordemCompra, laudo.ordem_compra] : null,
                laudo.metragem ? [t.metragem, laudo.metragem] : null,
                laudo.lotes ? [t.lotes, laudo.lotes] : null,
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
            {t.analisesRealizadas}
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="px-3 py-2 text-left font-semibold">{t.analise}</th>
                <th className="px-3 py-2 text-center font-semibold">{t.especificacao}</th>
                <th className="px-3 py-2 text-center font-semibold">{t.resultado}</th>
                <th className="px-3 py-2 text-center font-semibold">{t.unidade}</th>
                <th className="px-3 py-2 text-center font-semibold">{t.norma}</th>
                <th className="px-3 py-2 text-center font-semibold">{t.status}</th>
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
                    <td className="px-3 py-2 border border-gray-200 font-medium">
                      {traduzirNomeAnalise(a.nome, lang)}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center font-mono">
                      {a.specification || '—'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center font-mono font-bold">
                      {a.resultado || '—'}
                    </td>
                    <td className="px-3 py-2 border border-gray-200 text-center text-gray-600 font-mono">
                      {traduzirUnidade(unidadeOf(a), lang) || '—'}
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
                          {statusLabel[status]}
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
                <td className="px-3 py-2 border border-gray-200" colSpan={5}>
                  {t.resultadoFinal(aprovados, reprovados)}
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
                    {statusLabel[statusGeral] ?? t.rascunho}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Photos */}
        {fotos.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
              {t.registroFotografico}
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {fotos.map((foto) => (
                <div key={foto.id} className="text-center">
                  <img
                    src={foto.url}
                    alt={foto.legenda || ''}
                    className="w-full h-36 object-cover rounded border border-gray-200"
                  />
                  {foto.legenda && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">{foto.legenda}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Observations */}
        {laudo.observacoes && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
              {t.observacoes}
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
              <p className="text-xs text-gray-400">{t.responsavelTecnico}</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>{t.documentoGeradoEm} {new Date().toLocaleDateString(lang)}</p>
              <p className="font-mono text-gray-500">{laudo.numero}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function pdfTrunc(str: string, max: number): string {
  if (!str) return '-';
  return str.length > max ? str.slice(0, max - 1) + '.' : str;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pdfSpecText(doc: any, text: string, cx: number, y: number, maxChars: number) {
  doc.setFont('courier', 'normal');
  if (!text) { doc.text('-', cx, y, { align: 'center' }); return; }

  const t = text.length > maxChars ? text.slice(0, maxChars - 1) + '.' : text;

  if (!/[≥≤]/.test(t)) {
    doc.text(t, cx, y, { align: 'center' });
    return;
  }

  const parts = t.split(/(≥|≤)/);

  let totalW = 0;
  for (const p of parts) {
    if (!p) continue;
    if (p === '≥' || p === '≤') {
      doc.setFont('symbol', 'normal');
      totalW += doc.getTextWidth(String.fromCharCode(p === '≥' ? 179 : 163));
    } else {
      doc.setFont('courier', 'normal');
      totalW += doc.getTextWidth(p);
    }
  }

  let x = cx - totalW / 2;
  for (const p of parts) {
    if (!p) continue;
    if (p === '≥' || p === '≤') {
      doc.setFont('symbol', 'normal');
      const ch = String.fromCharCode(p === '≥' ? 179 : 163);
      doc.text(ch, x, y);
      x += doc.getTextWidth(ch);
    } else {
      doc.setFont('courier', 'normal');
      doc.text(p, x, y);
      x += doc.getTextWidth(p);
    }
  }
  doc.setFont('courier', 'normal');
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
