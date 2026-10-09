// Leitura (somente leitura) das planilhas do Google Drive.
// Funciona para os dois formatos: planilha Google (exportada como .xlsx) e arquivo .xlsx guardado no Drive
// (é o caso do pipeline "BASE DE LOJAS DA REDE E IMPLANTAÇÕES.xlsx", que a API do Sheets não lê).
// Credencial: Application Default Credentials. No Cloud Run, a identidade do próprio serviço
// (sem arquivo de chave). Escopo drive.readonly: a conta de serviço só enxerga o que foi compartilhado com ela.
// NUNCA logar conteúdo das planilhas.
import { GoogleAuth } from "google-auth-library";
import type { AppConfig } from "./config";
import type { DadosLoja, Segredos } from "./domain";
import { CAMPOS_SENSIVEIS } from "./domain";
import { cleanText, isUF, onlyDigits } from "./validators";
import { lerXlsx } from "./xlsx-read";

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function lerAba(fileId: string, aba: string): Promise<string[][]> {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(fileId)) throw new Error("ID de arquivo inválido");
  const client = await auth.getClient();
  const meta = await client.request<{ mimeType: string; size?: string }>({
    url: `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,size&supportsAllDrives=true`, timeout: 15_000 });
  const tipo = meta.data.mimeType;
  let url: string;
  if (tipo === "application/vnd.google-apps.spreadsheet") url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`;
  else if (tipo === XLSX_MIME) {
    if (Number(meta.data.size ?? 0) > 20 * 1024 * 1024) throw new Error("Planilha maior que 20 MB");
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  } else throw new Error(`Tipo de arquivo não suportado: ${tipo}`);
  const res = await client.request<ArrayBuffer>({ url, responseType: "arraybuffer", timeout: 30_000 });
  const abas = await lerXlsx(Buffer.from(res.data as ArrayBuffer), aba || undefined);
  if (!abas.length) throw new Error(aba ? `Aba "${aba}" não encontrada` : "Planilha sem abas");
  return abas[0].linhas;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Índice da coluna pelo cabeçalho (exato, depois "começa com") ou por letra no formato "Coluna H". */
export function colIndex(headers: string[], ref: string): number {
  if (!ref) return -1;
  const letra = /^coluna\s+([A-Z]{1,2})$/i.exec(ref.trim());
  if (letra) {
    const L = letra[1].toUpperCase();
    return L.length === 1 ? L.charCodeAt(0) - 65 : (L.charCodeAt(0) - 64) * 26 + L.charCodeAt(1) - 65;
  }
  const n = norm(ref);
  const exact = headers.findIndex((h) => norm(h) === n);
  return exact >= 0 ? exact : headers.findIndex((h) => norm(h).startsWith(n));
}

/** Converte "dd/mm/aaaa" (ou "aaaa-mm-dd") em ISO; null se não for data. */
export function parseDataBR(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Acha a linha de cabeçalho (o pipeline tem título e totais antes dela): a primeira, entre as 15 primeiras, que contém a coluna-âncora. */
export function separarCabecalho(rows: string[][], ancora: string): { hdr: string[]; dados: string[][]; linhaHdr: number } {
  if (!/^coluna\s/i.test(ancora)) for (let i = 0; i < Math.min(15, rows.length); i++) {
    const r = rows[i] ?? [];
    if (r.some((h) => norm(h ?? "") === norm(ancora))) return { hdr: r, dados: rows.slice(i + 1), linhaHdr: i + 1 };
  }
  return { hdr: rows[0] ?? [], dados: rows.slice(1), linhaHdr: 1 };
}

export type PipelineMatch = { linha: number; nome: string; cnpj: string; data_inauguracao: string | null; data_bruta: string; uf: string; tipo: string; por: "cnpj" | "nome" };

export function buscarNoPipeline(rows: string[][], cols: AppConfig["pipeline_colunas"], busca: { cnpj?: string | null; nome?: string }): PipelineMatch[] {
  const { hdr, dados: data, linhaHdr } = separarCabecalho(rows, cols.nome || cols.cnpj);
  const ci = { nome: colIndex(hdr, cols.nome), cnpj: colIndex(hdr, cols.cnpj), data: colIndex(hdr, cols.inauguracao || "Coluna H"), prev: colIndex(hdr, cols.previsao), uf: colIndex(hdr, cols.uf), tipo: colIndex(hdr, cols.tipo) };
  const cnpj = onlyDigits(busca.cnpj);
  const nome = norm((busca.nome ?? "").replace(/^biscoit[eê]\s+/i, ""));
  const out: PipelineMatch[] = [];
  data.forEach((r, i) => {
    const rc = ci.cnpj >= 0 ? onlyDigits(r[ci.cnpj]) : "";
    const rn = ci.nome >= 0 ? norm((r[ci.nome] ?? "").replace(/^biscoit[eê]\s+/i, "")) : "";
    const por = cnpj.length === 14 && rc === cnpj ? "cnpj" : nome.length >= 4 && rn && (rn.includes(nome) || nome.includes(rn)) ? "nome" : null;
    if (!por) return;
    // Data efetiva de inauguração; se vazia ou "-", usa a previsão.
    let bruta = ci.data >= 0 ? (r[ci.data] ?? "").trim() : "";
    if (!parseDataBR(bruta) && ci.prev >= 0 && parseDataBR(r[ci.prev])) bruta = (r[ci.prev] ?? "").trim();
    out.push({ linha: linhaHdr + i + 1, nome: r[ci.nome] ?? "", cnpj: rc, data_inauguracao: parseDataBR(bruta), data_bruta: bruta, uf: (r[ci.uf] ?? "").toUpperCase(), tipo: r[ci.tipo] ?? "", por });
  });
  return out.sort((a, b) => (a.por === b.por ? 0 : a.por === "cnpj" ? -1 : 1));
}

/** Acha a resposta do formulário da loja (por CNPJ; senão por e-mail da loja) — a mais recente vence. */
export function acharResposta(rows: string[][], map: Record<string, string>, busca: { cnpj?: string | null; email_loja?: string | null }) {
  const [hdr = [], ...data] = rows;
  const idx = Object.fromEntries(Object.entries(map).map(([campo, h]) => [campo, colIndex(hdr, h)]));
  // Minimização: colunas de senha (ex.: senha do certificado) nunca são lidas, mesmo se mapeadas por engano.
  for (const [campo, i] of Object.entries(idx)) if (i >= 0 && /senha|password/i.test(hdr[i] ?? "")) idx[campo] = -1;
  const cnpj = onlyDigits(busca.cnpj), email = (busca.email_loja ?? "").toLowerCase().trim();
  let found: string[] | null = null, por: "cnpj" | "email" | null = null;
  for (const r of data) {
    const rc = idx.cnpj >= 0 ? onlyDigits(r[idx.cnpj]) : "";
    const re = idx.email_loja >= 0 ? (r[idx.email_loja] ?? "").toLowerCase().trim() : "";
    if (cnpj.length === 14 && rc === cnpj) { found = r; por = "cnpj"; }
    else if (!found && email && re === email) { found = r; por = "email"; }
  }
  if (!found) return null;
  const get = (campo: string) => (idx[campo] >= 0 ? cleanText(found![idx[campo]], 500) : "");
  const dados: DadosLoja = {
    razao_social: get("razao_social"), ie: get("ie"), regime: get("regime"),
    logradouro: get("logradouro"), numero: get("numero"), complemento: get("complemento"), bairro: get("bairro"),
    cep: onlyDigits(get("cep")), cidade: get("cidade"), contrato_link: get("contrato_link"),
    resp_nome: get("resp_nome"), resp_email: get("resp_email"), financeiro: get("financeiro"), ponto_focal: get("ponto_focal"),
    email_franqueado: get("email_franqueado"), contador_email: get("contador_email"),
    cnpj_formulario: onlyDigits(get("cnpj")), nome_formulario: get("nome_fantasia"),
    certificado_recebido: get("certificado_link").length > 0,
    natureza: get("natureza"), indicador: get("indicador"), periodo: get("periodo"), receita: get("receita"), escrituracao: get("escrituracao"),
  };
  const segredos: Segredos = {};
  for (const k of CAMPOS_SENSIVEIS) { const v = get(k); if (v) segredos[k] = k === "resp_cpf" ? onlyDigits(v) : v; }
  const ufForm = get("uf").toUpperCase();
  const camposAusentes = Object.entries(idx).filter(([, i]) => i < 0).map(([c]) => c);
  return { dados, segredos, por, uf: isUF(ufForm) ? ufForm : null, camposAusentes };
}
