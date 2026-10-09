// Listas de validação da planilha de onboarding do Nexaas (aba "Planilha3"). Valores exatos.
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

export const LISTAS = {
  natureza: ["2011 - Empresa Pública", "2038 - Sociedade de Economia Mista", "2046 - Sociedade Anônima Aberta", "2054 - Sociedade Anônima Fechada",
    "2062 - Sociedade Empresária Limitada", "2070 - Sociedade Empresária em Nome Coletivo", "2089 - Sociedade Empresária em Comandita Simples",
    "2097 - Sociedade Empresária em Comandita por Ações", "2127 - Sociedade em Conta de Participação", "2135 - Empresário (Individual)",
    "2143 - Cooperativa", "2151 - Consórcio de Sociedades", "2160 - Grupo de Sociedades", "2178 - Estabelecimento, no Brasil, de Sociedade Estrangeira",
    "2194 - Estabelecimento, no Brasil, de Empresa Binacional Argentino-Brasileira", "2216 - Empresa Domiciliada no Exterior",
    "2224 - Clube/Fundo de Investimento", "2232 - Sociedade Simples Pura", "2240 - Sociedade Simples Limitada", "2259 - Sociedade Simples em Nome Coletivo",
    "2267 - Sociedade Simples em Comandita Simples", "2275 - Empresa Binacional", "2283 - Consórcio de Empregadores", "2291 - Consórcio Simples",
    "2305 - Empresa Individual de Responsabilidade Limitada (de Natureza Empresária)", "2313 - Empresa Individual de Responsabilidade Limitada (de Natureza Simples)",
    "2321 – Sociedade Unipessoal de Advogados", "2330 – Cooperativas de Consumo"],
  indicador: [" 0 - INDUSTRIAL -TRANSFORMAÇÃO", "1 - INDUSTRIAL BENEFICIAMENTO", "2 - INDUSTRIAL - MONTAGEM", "3 - INDUSTRIAL - ACONDICIONAMENTO OU RECONDICIONAMENTO",
    "4 - INDUSTRIAL - RENOVAÇÃO OU RENCONDICIONAMENTO", "5 - EQUIPARADO  INDUSTRIAL - POR OPÇÃO", "6 - EQUIPARADO A INDUSTRIAL - IMPOSTAÇÃO DIRETA",
    "7 -  EQUIPARADO A INDUSTRIAL - POR LEI ESPECIFICA", "8 - ENQUADRADO A INDUSTRIAL -NÃO ENQUADRADO NOS CÓDIGOS 05, 06 OU 7", "9 - PRESTADOR DE SERVIÇOS",
    "10- ATIVIDADE DE COMÉRCIO", "11- PESSOAS JURÍDICAS REFERIDAS NOS PARÁGRAFOS 6º, 8º E 9º DO ARTIGO 3º DA LEI 9.718 DE 1998", "12- ATIVIDADE IMOBILIÁRIA", "99 - OUTROS"],
  periodo: ["2 - ANUAL COM ESTIMATIVAS MENSAIS", "3 - TRIMESTRAL"],
  receita: ["1 - REGIME DE CAIXA", "2 - REGIME DE COMPETÊNCIA"],
  escrituracao: ["A - DETALHADO", "B - RESUMIDO", "C - SIMPLES NACIONAL"],
} as const;

/**
 * Converte a resposta livre do formulário no valor EXATO da lista (ou null se não der para ter certeza).
 * Aceita: o valor exato, só o código ("2062", "A") ou o texto sem código ("Regime de Competência").
 */
export function casarComLista(valor: string | undefined, lista: readonly string[]): string | null {
  const v = norm(valor ?? "");
  if (!v) return null;
  const opcoes = lista.map((o) => ({ o, n: norm(o), cod: /^([0-9A-Z]+)\s*[-–]/.exec(norm(o))?.[1] ?? "", texto: norm(o.replace(/^\s*[0-9A-Za-z]+\s*[-–]\s*/, "")) }));
  const exato = opcoes.find((x) => x.n === v);
  if (exato) return exato.o;
  const codigo = /^([0-9]+|[A-C])(\s*[-–].*)?$/.exec(v)?.[1];
  if (codigo) { const c = opcoes.filter((x) => x.cod === codigo); if (c.length === 1) return c[0].o; }
  const porTexto = opcoes.filter((x) => x.texto.length >= 4 && (x.texto === v || (v.length >= 6 && x.texto.includes(v))));
  return porTexto.length === 1 ? porTexto[0].o : null;
}
