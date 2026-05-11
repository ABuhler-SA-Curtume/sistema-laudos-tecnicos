import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;
export const runtime = 'nodejs';

type Params = Promise<{ id: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const [{ data: laudo, error }, { data: analises }] = await Promise.all([
    supabase.from('laudos').select('*').eq('id', id).single(),
    supabase.from('analises').select('*').eq('laudo_id', id).order('criado_em', { ascending: true }),
  ]);

  if (error || !laudo) {
    return NextResponse.json({ error: 'Laudo não encontrado' }, { status: 404 });
  }

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const html = buildHTML(laudo, analises ?? [], baseUrl);

  const isLocal = process.env.NODE_ENV === 'development';

  let browser;
  try {
    const puppeteer = (await import('puppeteer-core')).default;

    let executablePath: string;
    let launchArgs: string[];

    if (isLocal) {
      executablePath = process.env.CHROME_PATH
        ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
    } else {
      const chromium = (await import('@sparticuz/chromium')).default;
      executablePath = await chromium.executablePath();
      launchArgs = [...chromium.args, '--disable-dev-shm-usage'];
    }

    browser = await puppeteer.launch({
      executablePath,
      args: launchArgs,
      headless: true,
      defaultViewport: { width: 1200, height: 900 },
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 25000 });
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images)
          .filter(img => !img.complete)
          .map(img => new Promise(resolve => { img.onload = img.onerror = resolve; }))
      )
    );

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });

    const pdfBuffer = Buffer.from(pdfUint8);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${laudo.numero}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gerar-pdf] erro:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await browser?.close();
  }
}

// ─── avaliação de status ────────────────────────────────────────────────────

function avaliarStatus(resultado: string, spec: string): 'approved' | 'rejected' | null {
  if (!resultado || !spec) return null;
  const val = parseFloat(String(resultado).replace(',', '.'));
  if (isNaN(val)) return null;
  const match = spec.match(/^([><=]+)\s*([\d.,]+)/);
  if (!match) return null;
  const op = match[1];
  const num = parseFloat(match[2].replace(',', '.'));
  const map: Record<string, boolean> = {
    '>': val > num, '>=': val >= num, '≥': val >= num,
    '<': val < num, '<=': val <= num, '≤': val <= num,
    '=': val === num,
  };
  const ok = map[op];
  return ok === undefined ? null : ok ? 'approved' : 'rejected';
}

// ─── template HTML ──────────────────────────────────────────────────────────

function buildHTML(laudo: Record<string, string>, analises: Record<string, string>[], baseUrl: string): string {
  type Status = 'approved' | 'rejected' | 'draft';
  const LABEL: Record<Status, string> = { approved: 'APROVADO', rejected: 'REPROVADO', draft: 'RASCUNHO' };

  const getStatus = (a: Record<string, string>): 'approved' | 'rejected' | null =>
    avaliarStatus(a.resultado, a.specification) ?? (a.status_analise as 'approved' | 'rejected' | null);

  const statusGeral: Status = (() => {
    const ss = analises.map(getStatus);
    if (ss.some(s => s === 'rejected')) return 'rejected';
    if (ss.length > 0 && ss.every(s => s === 'approved')) return 'approved';
    return 'draft';
  })();

  const aprovados = analises.filter(a => getStatus(a) === 'approved').length;
  const reprovados = analises.filter(a => getStatus(a) === 'rejected').length;
  const dataEmissao = new Date(laudo.finalizado_em ?? laudo.criado_em).toLocaleDateString('pt-BR');

  const statusBg: Record<Status, string> = { approved: '#dcfce7', rejected: '#fee2e2', draft: '#f3f4f6' };
  const statusColor: Record<Status, string> = { approved: '#15803d', rejected: '#dc2626', draft: '#374151' };

  const infoFields = [
    ['Cliente', laudo.cliente],
    ['Artigo / Material', laudo.artigo],
    laudo.cor ? ['Cor', laudo.cor] : null,
    laudo.op ? ['Ordem de Produção (OP)', laudo.op] : null,
    ['Responsável Técnico', laudo.responsavel],
    laudo.codigo_item ? ['Código do item', laudo.codigo_item] : null,
    laudo.ordem_compra ? ['Ordem de compra', laudo.ordem_compra] : null,
    laudo.metragem ? ['Metragem', laudo.metragem] : null,
    laudo.lotes ? ['Lotes', laudo.lotes] : null,
  ].filter(Boolean) as [string, string][];

  const pairs = infoFields.reduce<[string, string][][]>((rows, item, i) => {
    if (i % 2 === 0) rows.push([item]);
    else rows[rows.length - 1].push(item);
    return rows;
  }, []);

  const infoRows = pairs.map(pair => `
    <tr>
      <td class="lbl">${pair[0][0]}</td><td>${pair[0][1] || '—'}</td>
      ${pair[1] ? `<td class="lbl">${pair[1][0]}</td><td>${pair[1][1] || '—'}</td>` : '<td colspan="2"></td>'}
    </tr>`).join('');

  const analysisRows = analises.map((a, i) => {
    const s = getStatus(a);
    const bg = s === 'approved' ? '#f0fdf4' : s === 'rejected' ? '#fef2f2' : i % 2 === 0 ? '#fff' : '#f9fafb';
    const badge = s
      ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${statusBg[s]};color:${statusColor[s]}">${LABEL[s]}</span>`
      : '<span style="color:#9ca3af">—</span>';
    return `
      <tr style="background:${bg}">
        <td class="bd">${a.nome}</td>
        <td class="bd tc mono">${a.specification || '—'}</td>
        <td class="bd tc mono" style="font-weight:700">${a.resultado || '—'}</td>
        <td class="bd tc mono" style="color:#6b7280">${a.unidade || '—'}</td>
        <td class="bd tc" style="color:#6b7280">${a.norma || '—'}</td>
        <td class="bd tc">${badge}</td>
      </tr>`;
  }).join('');

  const footerBadge = `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${statusBg[statusGeral]};color:${statusColor[statusGeral]}">${LABEL[statusGeral]}</span>`;

  const obsBlock = laudo.observacoes ? `
    <div style="margin-bottom:20px">
      <div class="st">Observações</div>
      <p style="border:1px solid #e5e7eb;border-radius:4px;padding:10px;color:#374151">${laudo.observacoes}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:12px;color:#111827;background:#fff}
  .hdr{border-bottom:2px solid #2563eb;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start}
  .st{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:8px}
  table{width:100%;border-collapse:collapse}
  .it td{padding:4px 8px;border:1px solid #d1d5db;font-size:11px}
  .it td.lbl{background:#f9fafb;font-weight:600;width:140px}
  .at th{background:#2563eb;color:#fff;padding:7px 10px;font-weight:600;font-size:11px;text-align:center}
  .at th:first-child{text-align:left}
  td.bd{padding:6px 10px;border:1px solid #e5e7eb}
  .tc{text-align:center}.mono{font-family:monospace}
</style></head><body>

<div class="hdr">
  <div>
    <img src="${baseUrl}/logo-abuhler.png" alt="A.Bühler" style="height:48px;width:auto;display:block;margin-bottom:6px"/>
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6b7280">Laudo Técnico</div>
    <div style="font-size:18px;font-family:monospace;font-weight:700;margin-top:4px">${laudo.numero}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:10px;color:#6b7280">Data de emissão</div>
    <div style="font-weight:600;margin-bottom:8px">${dataEmissao}</div>
    <span style="padding:4px 14px;border-radius:4px;font-weight:700;font-size:12px;background:${statusBg[statusGeral]};color:${statusColor[statusGeral]}">${LABEL[statusGeral]}</span>
  </div>
</div>

<div style="margin-bottom:16px">
  <div class="st">Informações do Produto</div>
  <table class="it"><tbody>${infoRows}</tbody></table>
</div>

<div style="margin-bottom:20px">
  <div class="st">Análises Realizadas</div>
  <table class="at">
    <thead><tr>
      <th style="text-align:left">Análise</th>
      <th>Especificação</th><th>Resultado</th><th>Unidade</th><th>Norma</th><th>Status</th>
    </tr></thead>
    <tbody>${analysisRows}</tbody>
    <tfoot>
      <tr style="background:#f3f4f6;font-weight:600">
        <td class="bd" colspan="5">Resultado Final — ${aprovados} aprovada(s), ${reprovados} reprovada(s)</td>
        <td class="bd tc">${footerBadge}</td>
      </tr>
    </tfoot>
  </table>
</div>

${obsBlock}

<div style="margin-top:28px;padding-top:14px;border-top:1px solid #d1d5db;display:flex;justify-content:space-between;align-items:flex-end">
  <div>
    <img src="${baseUrl}/assinatura-cristiano.png" alt="Assinatura" style="height:44px;display:block;margin-bottom:4px"/>
    <div style="border-bottom:1px solid #9ca3af;width:220px;margin-bottom:4px"></div>
    <div style="font-size:11px;font-weight:600;color:#374151">Cristiano Luis Backes</div>
    <div style="font-size:10px;color:#9ca3af">Responsável Técnico</div>
  </div>
  <div style="text-align:right;font-size:10px;color:#9ca3af">
    <div>Documento gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
    <div style="font-family:monospace;color:#6b7280">${laudo.numero}</div>
  </div>
</div>

</body></html>`;
}
