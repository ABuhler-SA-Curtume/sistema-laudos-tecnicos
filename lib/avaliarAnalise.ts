export function calcularMedia(medicoes: string[]): string | null {
  const nums = medicoes
    .map((v) => parseFloat(String(v).replace(',', '.')))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
  return avg % 1 === 0 ? String(avg) : avg.toFixed(2);
}

export function avaliarStatus(
  resultado: string,
  specification: string
): 'approved' | 'rejected' | null {
  if (!resultado || !specification) return null;

  const num = parseFloat(resultado.replace(',', '.'));
  if (isNaN(num)) return null;

  const normalized = specification
    .trim()
    .replace(/\s+/g, '')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=');

  if (normalized.startsWith('>=')) {
    return num >= parseFloat(normalized.slice(2)) ? 'approved' : 'rejected';
  }
  if (normalized.startsWith('<=')) {
    return num <= parseFloat(normalized.slice(2)) ? 'approved' : 'rejected';
  }
  if (normalized.startsWith('>')) {
    return num > parseFloat(normalized.slice(1)) ? 'approved' : 'rejected';
  }
  if (normalized.startsWith('<')) {
    return num < parseFloat(normalized.slice(1)) ? 'approved' : 'rejected';
  }
  if (normalized.startsWith('=')) {
    return num === parseFloat(normalized.slice(1)) ? 'approved' : 'rejected';
  }

  // Se a especificação for apenas um valor numérico simples, compare por igualdade.
  if (!Number.isNaN(parseFloat(normalized))) {
    return num === parseFloat(normalized) ? 'approved' : 'rejected';
  }

  return null;
}

export function calcularStatusGeral(
  analises: Array<{ resultado: string; specification: string; status_analise: string | null }>
): 'approved' | 'rejected' | 'draft' {
  if (analises.length === 0) return 'draft';

  // Any analysis without a result → still pending
  if (analises.some((a) => !a.resultado)) return 'draft';

  // All have results. Live calculation takes priority over saved value.
  const statuses = analises.map((a) =>
    avaliarStatus(a.resultado, a.specification) ?? a.status_analise
  );

  if (statuses.some((s) => s === 'rejected')) return 'rejected';

  // Analyses without a specification are informational — they don't affect pass/fail.
  // If all evaluable ones pass (or none have specs), the laudo is approved.
  const evaluable = statuses.filter((s) => s !== null);
  if (evaluable.length === 0 || evaluable.every((s) => s === 'approved')) return 'approved';

  return 'draft';
}
