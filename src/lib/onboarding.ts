// Gera a planilha de onboarding do Nexaas a partir do modelo limpo (templates/onboarding-template.xlsx),
// editando só a linha 2 no XML. Assim abas, estilos, comentários e validações (Planilha3) ficam intactos.
//
// Segurança (injeção de fórmula): toda célula de texto é gravada como "inlineStr" (texto puro, nunca <f>)
// e com estilo quotePrefix + formato "@" (texto), o mesmo mecanismo que o Excel usa ao digitar 'valor.
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { fluxoDe, type DadosLoja, type Loja, type Segredos } from "./domain";
import type { AppConfig, CscSet } from "./config";
import { cleanText, formatCEP, formatCNPJ, normalizeRegime } from "./validators";

export const COLUNAS = [
  "Razão Social", "Nome Fantasia", "CNPJ", "I.E", "Tipo de Organização", "Cep", "Endereço", "Número", "Complemento",
  "Bairro", "Município", "UF", "Telefone", "ID Externo", "Vendedor Padrão", "Dias para expirar cupons",
  "Raio Maximo de entrega", "Regime tributário", "Série NF-e", "Ult. Sequencial (NF-e)", "Série NFC-e",
  "Ult. Sequencial (NFC-e)", "Qtde de Terminais", "CSC ID Produção", "CSC Token Produção", "CSC ID Homologação",
  "CSC Token Homologação", "Série NFC-e (Contingência)", "Série NF-e (Contingência)", "Natureza Jurídica",
  "Indicador de Atividade", "Período", "Receita", "Escrituração", "E-mail (Recebimento XML)", "Períodicidade XML",
] as const;

export const PENDENTE = "PENDENTE";
/** Colunas opcionais no modelo (cabeçalho branco): vazio não vira PENDENTE. */
const OPCIONAIS = new Set(["Complemento", "Telefone", "Série NFC-e (Contingência)", "Série NF-e (Contingência)"]);
/** Colunas que o modelo do Nexaas usa como número. */
const NUMERICAS = new Set(["Número", "Série NF-e", "Ult. Sequencial (NF-e)", "Série NFC-e", "Ult. Sequencial (NFC-e)", "Qtde de Terminais", "Dias para expirar cupons"]);

const colLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(65 + i - 26));

export type OnboardingInput = {
  loja: Pick<Loja, "tipo" | "nome" | "cnpj" | "uf" | "email_loja">;
  dados: DadosLoja; segredos: Segredos; cfg: AppConfig; cscSP: CscSet | null;
};

/** Monta os 36 valores (A..AJ). Valores não definidos viram "PENDENTE". */
export function montarLinha({ loja, dados, segredos, cfg, cscSP }: OnboardingInput): Record<string, string> {
  const own = fluxoDe(loja.tipo) === "PROPRIA";
  const O = cfg.onboarding, D = O.padroes;
  const regime = normalizeRegime(own ? cfg.propria_padrao.regime || dados.regime : dados.regime);
  const csc: Partial<CscSet> = own
    ? (loja.uf === "SP" && cscSP ? cscSP : {})
    : { prod_id: segredos.csc_prod_id, prod_token: segredos.csc_prod_token, hom_id: segredos.csc_hom_id, hom_token: segredos.csc_hom_token };
  // MG: o token de produção serve para os dois ambientes (manual, seção 2.3).
  if (!own && loja.uf === "MG" && !csc.hom_id) { csc.hom_id = csc.prod_id; csc.hom_token = csc.prod_token; }

  const xml = [O.email_xml, O.xml_incluir_email_loja ? loja.email_loja : "", O.xml_incluir_contador ? dados.contador_email : ""]
    .map((e) => (e ?? "").trim()).filter(Boolean);
  const pick = (loja_: string | undefined, padrao: string) => (loja_ ?? "").trim() || padrao.trim();

  const v: Record<string, string | undefined> = {
    "Razão Social": own ? pick(dados.razao_social, cfg.propria_padrao.razao_social) : dados.razao_social,
    "Nome Fantasia": loja.nome.toUpperCase(),
    "CNPJ": loja.cnpj ? formatCNPJ(loja.cnpj) : "",
    "I.E": dados.ie,
    "Tipo de Organização": own ? "Loja Própria" : "Franquia",
    "Cep": dados.cep ? formatCEP(dados.cep) : "",
    "Endereço": dados.logradouro,
    "Número": dados.numero,
    "Complemento": dados.complemento,
    "Bairro": dados.bairro,
    "Município": dados.cidade,
    "UF": loja.uf,
    "Telefone": dados.telefone_loja,
    "ID Externo": pick(dados.id_externo, D.id_externo),
    "Vendedor Padrão": pick(dados.vendedor, D.vendedor),
    "Dias para expirar cupons": pick(dados.dias_cupom, D.dias_cupom),
    "Raio Maximo de entrega": pick(dados.raio, D.raio),
    "Regime tributário": regime ?? "",
    "Série NF-e": pick(dados.serie_nfe, D.serie_nfe),
    "Ult. Sequencial (NF-e)": pick(dados.seq_nfe, D.seq_nfe),
    "Série NFC-e": pick(dados.serie_nfce, D.serie_nfce),
    "Ult. Sequencial (NFC-e)": pick(dados.seq_nfce, D.seq_nfce),
    "Qtde de Terminais": pick(dados.terminais, D.terminais),
    "CSC ID Produção": csc.prod_id,
    "CSC Token Produção": csc.prod_token,
    "CSC ID Homologação": csc.hom_id,
    "CSC Token Homologação": csc.hom_token,
    "Série NFC-e (Contingência)": D.serie_nfce_cont,
    "Série NF-e (Contingência)": D.serie_nfe_cont,
    "Natureza Jurídica": O.natureza,
    "Indicador de Atividade": O.indicador,
    "Período": O.periodo,
    "Receita": O.receita,
    "Escrituração": regime ? O.escrituracao_por_regime[regime] ?? "" : "",
    "E-mail (Recebimento XML)": xml.join(", "), // o comentário do modelo pede e-mails separados por vírgula
    "Períodicidade XML": O.periodicidade_xml,
  };
  const out: Record<string, string> = {};
  for (const c of COLUNAS) {
    const val = cleanText(v[c], 300);
    out[c] = val || (OPCIONAIS.has(c) ? "" : PENDENTE);
  }
  return out;
}

const xmlEscape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
   .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** Acrescenta estilos derivados: texto forçado (quotePrefix + "@") e texto forçado + fundo amarelo (PENDENTE). */
function addStyles(styles: string, baseIds: number[]) {
  const fillsOpen = /<fills count="(\d+)">/.exec(styles)!;
  const yellowFillId = Number(fillsOpen[1]);
  styles = styles
    .replace(fillsOpen[0], `<fills count="${yellowFillId + 1}">`)
    .replace("</fills>", `<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3B0"/><bgColor rgb="FFFFF3B0"/></patternFill></fill></fills>`);

  const xfsBlock = /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/.exec(styles)!;
  const xfs = [...xfsBlock[2].matchAll(/<xf [^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => m[0]);
  const map = new Map<number, { text: number; pend: number }>();
  const extra: string[] = [];
  const clone = (xf: string, fill?: number) => {
    let x = xf
      .replace(/ (quotePrefix|applyNumberFormat)="1"/g, "")
      .replace(/numFmtId="\d+"/, 'numFmtId="49"')
      .replace("<xf ", '<xf quotePrefix="1" applyNumberFormat="1" ');
    if (fill !== undefined)
      x = x.replace(/ applyFill="1"/g, "").replace(/fillId="\d+"/, `fillId="${fill}"`).replace("<xf ", '<xf applyFill="1" ');
    return x;
  };
  for (const id of new Set(baseIds)) {
    const base = xfs[id] ?? xfs[0];
    const text = xfs.length + extra.length; extra.push(clone(base));
    const pend = xfs.length + extra.length; extra.push(clone(base, yellowFillId));
    map.set(id, { text, pend });
  }
  styles = styles.replace(xfsBlock[0], `<cellXfs count="${xfs.length + extra.length}">${xfsBlock[2]}${extra.join("")}</cellXfs>`);
  return { styles, map };
}

let templateCache: Buffer | null = null;
function template(): Buffer {
  if (!templateCache) templateCache = fs.readFileSync(path.join(process.cwd(), "templates", "onboarding-template.xlsx"));
  return templateCache;
}

export async function gerarOnboardingXlsx(input: OnboardingInput): Promise<{ buffer: Buffer; pendentes: string[]; linha: Record<string, string> }> {
  const linha = montarLinha(input);
  const zip = await JSZip.loadAsync(template());
  const S1 = "xl/worksheets/sheet1.xml";
  let sheet = await zip.file(S1)!.async("string");
  let styles = await zip.file("xl/styles.xml")!.async("string");

  const rowMatch = /<row r="2"([^>]*)>([\s\S]*?)<\/row>/.exec(sheet);
  if (!rowMatch) throw new Error("Modelo inválido: linha 2 não encontrada");
  const baseStyle = new Map<string, number>();
  for (const m of rowMatch[2].matchAll(/<c r="([A-Z]+)2"(?: s="(\d+)")?/g)) baseStyle.set(m[1], Number(m[2] ?? 0));
  const { styles: st2, map } = addStyles(styles, [...baseStyle.values()]);
  styles = st2;

  const pendentes: string[] = [];
  const cells = COLUNAS.map((col, i) => {
    const L = colLetter(i);
    const base = baseStyle.get(L) ?? 5;
    const val = linha[col];
    const s = map.get(base)!;
    if (val === PENDENTE) {
      pendentes.push(col);
      return `<c r="${L}2" s="${s.pend}" t="inlineStr"><is><t>${PENDENTE}</t></is></c>`;
    }
    if (!val) return `<c r="${L}2" s="${base}"/>`;
    if (NUMERICAS.has(col) && /^\d{1,9}$/.test(val)) return `<c r="${L}2" s="${base}"><v>${Number(val)}</v></c>`;
    return `<c r="${L}2" s="${s.text}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(val)}</t></is></c>`;
  }).join("");
  sheet = sheet.replace(rowMatch[0], `<row r="2"${rowMatch[1]}>${cells}</row>`);

  zip.file(S1, sheet);
  zip.file("xl/styles.xml", styles);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, pendentes, linha };
}

export const nomeArquivoOnboarding = (nome: string) =>
  `Onboarding - ${nome.replace(/[\\/:*?"<>|\u0000-\u001F]/g, "").trim()}.xlsx`;

