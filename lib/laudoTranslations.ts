export type LaudoLang = 'pt-BR' | 'en-US';

export type LaudoT = {
  laudoTecnico: string;
  informacoesProduto: string;
  analisesRealizadas: string;
  registroFotografico: string;
  observacoes: string;
  dataEmissao: string;
  cliente: string;
  artigo: string;
  cor: string;
  ordemProducao: string;
  responsavelTecnico: string;
  codigoItem: string;
  ordemCompra: string;
  metragem: string;
  lotes: string;
  analise: string;
  especificacao: string;
  resultado: string;
  unidade: string;
  norma: string;
  status: string;
  aprovado: string;
  reprovado: string;
  rascunho: string;
  resultadoFinal: (ap: number, rep: number) => string;
  documentoGeradoEm: string;
};

export const TRADUCOES: Record<LaudoLang, LaudoT> = {
  'pt-BR': {
    laudoTecnico: 'LAUDO TECNICO',
    informacoesProduto: 'INFORMACOES DO PRODUTO',
    analisesRealizadas: 'ANALISES REALIZADAS',
    registroFotografico: 'REGISTRO FOTOGRAFICO',
    observacoes: 'OBSERVACOES',
    dataEmissao: 'Data de emissao',
    cliente: 'Cliente',
    artigo: 'Artigo / Material',
    cor: 'Cor',
    ordemProducao: 'Ordem de Producao',
    responsavelTecnico: 'Responsavel Tecnico',
    codigoItem: 'Codigo do item',
    ordemCompra: 'Ordem de compra',
    metragem: 'Metragem',
    lotes: 'Lotes',
    analise: 'Analise',
    especificacao: 'Especificacao',
    resultado: 'Resultado',
    unidade: 'Unidade',
    norma: 'Norma',
    status: 'Status',
    aprovado: 'APROVADO',
    reprovado: 'REPROVADO',
    rascunho: 'RASCUNHO',
    resultadoFinal: (ap, rep) => `Resultado Final - ${ap} aprovada(s), ${rep} reprovada(s)`,
    documentoGeradoEm: 'Documento gerado em',
  },
  'en-US': {
    laudoTecnico: 'TECHNICAL REPORT',
    informacoesProduto: 'PRODUCT INFORMATION',
    analisesRealizadas: 'ANALYSES PERFORMED',
    registroFotografico: 'PHOTOGRAPHIC RECORD',
    observacoes: 'OBSERVATIONS',
    dataEmissao: 'Issue Date',
    cliente: 'Customer',
    artigo: 'Article / Material',
    cor: 'Colour',
    ordemProducao: 'Production Order',
    responsavelTecnico: 'Technical Responsible',
    codigoItem: 'Item Code',
    ordemCompra: 'Purchase Order',
    metragem: 'Meterage',
    lotes: 'Lots',
    analise: 'Analysis',
    especificacao: 'Specification',
    resultado: 'Result',
    unidade: 'Unit',
    norma: 'Standard',
    status: 'Status',
    aprovado: 'APPROVED',
    reprovado: 'REJECTED',
    rascunho: 'DRAFT',
    resultadoFinal: (ap, rep) => `Final Result - ${ap} approved, ${rep} rejected`,
    documentoGeradoEm: 'Document generated on',
  },
};

// Normaliza para lookup: minúsculas, sem acentos, sem espaços extras
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Dicionário de nomes técnicos de análises em couro PT → EN
const NOMES_EN: Record<string, string> = {
  // Resistência mecânica
  'resistencia a tracao': 'Tensile Strength',
  'resistencia a tracao longitudinal': 'Tensile Strength (Longitudinal)',
  'resistencia a tracao transversal': 'Tensile Strength (Transversal)',
  'resistencia ao rasgo': 'Tear Strength',
  'resistencia ao rasgo duplo': 'Double Tear Strength',
  'rasgo duplo': 'Double Tear Strength',
  'resistencia ao rasgo em duplo': 'Double Tear Strength',
  'alongamento na ruptura': 'Elongation at Break',
  'elongacao na ruptura': 'Elongation at Break',
  'resistencia a costura': 'Seam Strength',
  'resistencia a perfuracao': 'Puncture Resistance',

  // Lastômetro / estouro
  'lastometro': 'Lastometer (Ball Burst)',
  'teste lastometro': 'Lastometer (Ball Burst)',
  'resistencia ao estouro': 'Burst Strength',
  'resistencia a compressao': 'Compression Resistance',

  // Abrasão
  'resistencia a abrasao': 'Abrasion Resistance',
  'resistencia a abrasao umida': 'Wet Abrasion Resistance',
  'abrasao umida': 'Wet Abrasion',
  'teste de abrasao umida': 'Wet Abrasion Test',
  'abrasao seca': 'Dry Abrasion',
  'resistencia a abrasao seca': 'Dry Abrasion Resistance',

  // Flexão / dobramento
  'resistencia a flexao': 'Flex Endurance',
  'flexao seco': 'Dry Flex Endurance',
  'flexao umida': 'Wet Flex Endurance',
  'flexao a seco': 'Dry Flex Endurance',
  'flexao a umido': 'Wet Flex Endurance',
  'endurance a flexao': 'Flex Endurance',
  'resistencia ao dobramento': 'Folding Endurance',
  'flexoes sem trincas': 'Flex Cycles',
  'ciclos sem trincas': 'Flex Cycles',
  'resistencia a flexao umida': 'Wet Flex Endurance',

  // Fricção / rubbing
  'friccao umida': 'Wet Rub Fastness',
  'friccao seca': 'Dry Rub Fastness',
  'friccao a umido': 'Wet Rub Fastness',
  'friccao a seco': 'Dry Rub Fastness',
  'solidez a cor': 'Colour Fastness',
  'solidez a cor ao atrito': 'Colour Fastness to Rubbing',
  'solidez a cor a luz': 'Colour Fastness to Light',
  'solidez a cor ao suor': 'Colour Fastness to Perspiration',
  'solidez a cor a agua': 'Colour Fastness to Water',
  'solidez a luz': 'Light Fastness',
  'solidez ao atrito': 'Rub Fastness',
  'solidez ao atrito umido': 'Wet Rub Fastness',
  'solidez ao atrito seco': 'Dry Rub Fastness',
  'resistencia ao atrito': 'Rub Fastness',
  'resistencia ao atrito umido': 'Wet Rub Fastness',
  'resistencia ao atrito seco': 'Dry Rub Fastness',
  'resistencia ao suor': 'Perspiration Resistance',
  'resistencia a agua': 'Water Resistance',
  'impermeabilidade': 'Water Impermeability',

  // Adesão / acabamento
  'adesao do acabamento': 'Finish Adhesion',
  'adesao acabamento seco': 'Dry Finish Adhesion',
  'adesao acabamento umido': 'Wet Finish Adhesion',
  'adesao acabamento a seco': 'Dry Finish Adhesion',
  'adesao acabamento a umido': 'Wet Finish Adhesion',
  'adesao do revestimento': 'Coating Adhesion',
  'resistencia ao revestimento': 'Coating Adhesion',
  'resistencia da camada de acabamento': 'Finish Layer Adhesion',
  'adesao da camada superficial': 'Surface Layer Adhesion',

  // Físico-dimensional
  'espessura': 'Thickness',
  'gramatura': 'Grammage',
  'substancia': 'Grammage',
  'peso': 'Weight',
  'area': 'Area',
  'densidade': 'Density',

  // Térmico
  'temperatura de encolhimento': 'Shrinkage Temperature',
  'resistencia ao calor': 'Heat Resistance',
  'estabilidade dimensional ao calor': 'Dimensional Stability to Heat',

  // Químico
  'ph': 'pH',
  'ph do extrato aquoso': 'pH of Aqueous Extract',
  'conteudo de cromo': 'Chromium Content',
  'cromo total': 'Total Chromium',
  'conteudo de aldeido': 'Aldehyde Content',
  'formaldeido': 'Formaldehyde',
  'conteudo de gordura': 'Fat Content',
  'cinzas': 'Ash Content',
  'substancias soluveis em agua': 'Water Soluble Substances',
};

export function traduzirNomeAnalise(nome: string, lang: LaudoLang): string {
  if (lang === 'pt-BR' || !nome) return nome;
  const key = norm(nome);
  if (NOMES_EN[key]) return NOMES_EN[key];
  // Lookup parcial: verifica se alguma chave é substring do nome ou vice-versa
  for (const [pt, en] of Object.entries(NOMES_EN)) {
    if (key.includes(pt) || pt.includes(key)) return en;
  }
  return nome;
}

// Dicionário de unidades de medida PT → EN
const UNIDADES_EN: Record<string, string> = {
  'escala de cinzas': 'Grey Scale',
  'ciclos sem trincas': 'Cycles',
  'flexoes sem trincas': 'Cycles',
  'flexoes': 'Flexions',
  'ciclos': 'Cycles',
  'vezes': 'Times',
  'passadas': 'Strokes',
};

export function traduzirUnidade(unidade: string, lang: LaudoLang): string {
  if (lang === 'pt-BR' || !unidade) return unidade;
  const key = norm(unidade);
  return UNIDADES_EN[key] ?? unidade;
}
