// Acesso a dados das lojas. Consultas sempre parametrizadas; segredos cifrados campo a campo.
import { z } from "zod";
import { q, q1, pool } from "./db";
import { decryptField, encryptField } from "./crypto";
import {
  CAMPOS_SENSIVEIS, CHECKLIST, ETAPAS_SEM_CNPJ, fluxoDe,
  type CampoSensivel, type DadosLoja, type EtapaEstado, type Loja, type Segredos, type TipoLoja,
} from "./domain";
import { cleanText, isDriveLink, isUF, isValidCEP, isValidCNPJ, isValidEmail, onlyDigits } from "./validators";
import { HttpError } from "./auth";

const txt = (max = 200) => z.string().max(max * 2).transform((v) => cleanText(v, max));
const optTxt = (max = 200) => txt(max).optional();

export const DadosSchema = z.object({
  razao_social: optTxt(200), ie: optTxt(20), regime: optTxt(60),
  logradouro: optTxt(200), numero: optTxt(20), complemento: optTxt(100), bairro: optTxt(100),
  cep: optTxt(10).refine((v) => !v || isValidCEP(v), "CEP inválido").transform((v) => (v ? onlyDigits(v) : v)),
  cidade: optTxt(100),
  contrato_link: optTxt(500).refine((v) => !v || isDriveLink(v), "Link precisa ser do Google Drive"),
  resp_nome: optTxt(150), resp_email: optTxt(254).refine((v) => !v || isValidEmail(v), "E-mail inválido"),
  financeiro: optTxt(300), ponto_focal: optTxt(300), certificado_recebido: z.boolean().optional(),
  email_franqueado: optTxt(254), contador_email: optTxt(254), telefone_loja: optTxt(20),
  id_externo: optTxt(40), vendedor: optTxt(80), dias_cupom: optTxt(5), raio: optTxt(20),
  serie_nfe: optTxt(5), seq_nfe: optTxt(12), serie_nfce: optTxt(5), seq_nfce: optTxt(12), terminais: optTxt(4),
}).strict();

export const SegredosSchema = z.object(
  Object.fromEntries(CAMPOS_SENSIVEIS.map((k) => [k, optTxt(500)])) as Record<CampoSensivel, ReturnType<typeof optTxt>>
).strict();

export const NovaLojaSchema = z.object({
  tipo: z.enum(["FRANQUIA", "PROPRIA", "REPASSE_FF", "REPASSE_FP"]),
  nome: txt(120).transform((v) => v.toUpperCase()).refine((v) => v.length >= 3, "Nome muito curto"),
  email_loja: optTxt(254).refine((v) => !v || isValidEmail(v), "E-mail da loja inválido"),
  uf: z.string().transform((v) => v.toUpperCase()).refine(isUF, "UF inválida"),
  cnpj: optTxt(20).transform((v) => (v ? onlyDigits(v) : "")).refine((v) => !v || isValidCNPJ(v), "CNPJ inválido (dígitos verificadores não conferem)"),
  sem_cnpj: z.boolean().default(false),
  data_inauguracao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  observacoes: optTxt(2000),
  dados: DadosSchema.default({}),
  segredos: SegredosSchema.default({}),
}).superRefine((v, ctx) => {
  if (!v.sem_cnpj && !v.cnpj) ctx.addIssue({ code: "custom", path: ["cnpj"], message: "Informe o CNPJ ou marque 'ainda não tem CNPJ'" });
  const own = fluxoDe(v.tipo as TipoLoja) === "PROPRIA";
  if (v.email_loja && own && !/@biscoite\.com\.br$/i.test(v.email_loja))
    ctx.addIssue({ code: "custom", path: ["email_loja"], message: "Loja própria usa e-mail @biscoite.com.br (Google Admin)" });
  if (v.email_loja && !own && !/@biscoite\.com$/i.test(v.email_loja))
    ctx.addIssue({ code: "custom", path: ["email_loja"], message: "Franquia usa e-mail @biscoite.com (Hostinger)" });
});

export const AtualizaLojaSchema = z.object({
  nome: NovaLojaSchema.innerType().shape.nome.optional(),
  email_loja: NovaLojaSchema.innerType().shape.email_loja,
  uf: NovaLojaSchema.innerType().shape.uf.optional(),
  cnpj: NovaLojaSchema.innerType().shape.cnpj,
  sem_cnpj: z.boolean().optional(),
  data_inauguracao: NovaLojaSchema.innerType().shape.data_inauguracao,
  observacoes: optTxt(2000),
  dados: DadosSchema.partial().optional(),
  segredos: SegredosSchema.partial().optional(),
}).strict();

const aad = (storeId: string, campo: string) => `store:${storeId}:${campo}`;

function cifrar(storeId: string, s: Segredos): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(s)) if (v) out[k] = encryptField(v, aad(storeId, k));
  return out;
}

export function decifrar(storeId: string, enc: Record<string, string>): Segredos {
  const out: Segredos = {};
  for (const k of CAMPOS_SENSIVEIS) if (enc?.[k]) out[k] = decryptField(enc[k], aad(storeId, k));
  return out;
}

const COLS = `id, tipo, nome, email_loja, uf, cnpj, sem_cnpj, to_char(data_inauguracao,'YYYY-MM-DD') AS data_inauguracao,
  observacoes, dados, form_sincronizado_em, criado_em`;

export async function criarLoja(input: z.infer<typeof NovaLojaSchema>, por: string): Promise<string> {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query<{ id: string }>(
      `INSERT INTO stores(tipo, nome, email_loja, uf, cnpj, sem_cnpj, data_inauguracao, observacoes, dados, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [input.tipo, input.nome, input.email_loja || null, input.uf, input.cnpj || null, !input.cnpj,
       input.data_inauguracao || null, input.observacoes || null, JSON.stringify(input.dados), por]
    );
    const id = rows[0].id;
    await c.query("UPDATE stores SET segredos=$2 WHERE id=$1", [id, JSON.stringify(cifrar(id, input.segredos))]);
    const etapas = CHECKLIST[fluxoDe(input.tipo)];
    for (const e of etapas) await c.query("INSERT INTO store_steps(store_id, etapa) VALUES ($1,$2)", [id, e.key]);
    await c.query("INSERT INTO store_events(store_id, tipo, texto, user_email) VALUES ($1,'ALTERACAO',$2,$3)",
      [id, `Loja cadastrada (${input.tipo})${input.cnpj ? "" : " — aguardando CNPJ"}`, por]);
    await c.query("COMMIT");
    return id;
  } catch (e) {
    await c.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "Já existe uma loja ativa com este CNPJ");
    throw e;
  } finally { c.release(); }
}

export async function getLoja(id: string): Promise<(Loja & { segredosEnc: Record<string, string> }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await q1<Loja & { segredos: Record<string, string> }>(`SELECT ${COLS}, segredos FROM stores WHERE id=$1 AND excluido_em IS NULL`, [id]);
  if (!r) return null;
  const { segredos, ...rest } = r;
  return { ...rest, segredosEnc: segredos };
}

export async function listarLojas(f: { tipo?: string; de?: string; ate?: string } = {}) {
  const cond = ["s.excluido_em IS NULL"]; const p: unknown[] = [];
  if (f.tipo) { p.push(f.tipo); cond.push(`s.tipo = $${p.length}`); }
  if (f.de) { p.push(f.de); cond.push(`s.data_inauguracao >= $${p.length}`); }
  if (f.ate) { p.push(f.ate); cond.push(`s.data_inauguracao <= $${p.length}`); }
  return q<Loja & { etapas: EtapaEstado[]; segredos: Record<string, string> }>(
    `SELECT s.id, s.tipo, s.nome, s.email_loja, s.uf, s.cnpj, s.sem_cnpj,
       to_char(s.data_inauguracao,'YYYY-MM-DD') AS data_inauguracao, s.observacoes, s.dados, s.form_sincronizado_em, s.criado_em,
       s.segredos,
       COALESCE((SELECT json_agg(json_build_object('etapa',etapa,'status',status,'data',data,'observacao',observacao,'responsavel',responsavel))
                 FROM store_steps st WHERE st.store_id=s.id), '[]') AS etapas
     FROM stores s WHERE ${cond.join(" AND ")} ORDER BY s.data_inauguracao NULLS LAST, s.nome`, p);
}

export async function etapasDa(id: string) {
  return q<EtapaEstado>(`SELECT etapa, status, to_char(data,'YYYY-MM-DD') AS data, observacao, responsavel FROM store_steps WHERE store_id=$1`, [id]);
}

export async function eventosDa(id: string) {
  return q<{ id: number; tipo: string; texto: string; user_email: string; criado_em: string }>(
    "SELECT id, tipo, texto, user_email, criado_em FROM store_events WHERE store_id=$1 ORDER BY criado_em DESC LIMIT 200", [id]);
}

export async function registrarEvento(id: string, tipo: string, texto: string, por: string) {
  await q("INSERT INTO store_events(store_id, tipo, texto, user_email) VALUES ($1,$2,$3,$4)", [id, tipo, cleanText(texto, 4000), por]);
}

export async function atualizarLoja(id: string, patch: z.infer<typeof AtualizaLojaSchema>, por: string) {
  const atual = await getLoja(id);
  if (!atual) throw new HttpError(404, "Loja não encontrada");
  const cnpj = patch.cnpj !== undefined ? patch.cnpj || null : atual.cnpj;
  const dados = { ...atual.dados, ...(patch.dados ?? {}) };
  const seg = { ...atual.segredosEnc };
  for (const [k, v] of Object.entries(patch.segredos ?? {})) {
    if (v === undefined) continue;
    if (v) seg[k] = encryptField(v, aad(id, k)); else delete seg[k];
  }
  try {
    await q(
      `UPDATE stores SET nome=$2, email_loja=$3, uf=$4, cnpj=$5, sem_cnpj=$6, data_inauguracao=$7, observacoes=$8,
              dados=$9, segredos=$10, atualizado_em=now() WHERE id=$1`,
      [id, patch.nome ?? atual.nome, patch.email_loja !== undefined ? patch.email_loja || null : atual.email_loja,
       patch.uf ?? atual.uf, cnpj, !cnpj,
       patch.data_inauguracao !== undefined ? patch.data_inauguracao || null : atual.data_inauguracao,
       patch.observacoes !== undefined ? patch.observacoes || null : atual.observacoes,
       JSON.stringify(dados), JSON.stringify(seg)]
    );
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "Já existe uma loja ativa com este CNPJ");
    throw e;
  }
  const campos = [...Object.keys(patch).filter((k) => !["dados", "segredos"].includes(k)), ...Object.keys(patch.dados ?? {}), ...Object.keys(patch.segredos ?? {})];
  await registrarEvento(id, "ALTERACAO", `Campos alterados: ${campos.join(", ") || "nenhum"}`, por);
  return campos;
}

/** Salva dados vindos do formulário (sobrescreve só o que veio preenchido). */
export async function aplicarFormulario(id: string, dados: DadosLoja, segredos: Segredos, uf: string | null, por: string) {
  const atual = await getLoja(id);
  if (!atual) throw new HttpError(404, "Loja não encontrada");
  const novosDados = { ...atual.dados };
  for (const [k, v] of Object.entries(dados)) if (v !== "" && v !== undefined) (novosDados as Record<string, unknown>)[k] = v;
  const seg = { ...atual.segredosEnc };
  for (const [k, v] of Object.entries(segredos)) if (v) seg[k] = encryptField(v, aad(id, k));
  await q("UPDATE stores SET dados=$2, segredos=$3, form_sincronizado_em=now(), atualizado_em=now() WHERE id=$1",
    [id, JSON.stringify(novosDados), JSON.stringify(seg)]);
  await registrarEvento(id, "FORM_SINCRONIZADO", `Resposta do formulário importada${uf && uf !== atual.uf ? ` (UF no formulário: ${uf}, cadastro: ${atual.uf})` : ""}`, por);
}

export async function atualizarEtapa(id: string, etapa: string, v: { status: string; data?: string | null; observacao?: string | null; responsavel?: string | null }, por: string) {
  const loja = await getLoja(id);
  if (!loja) throw new HttpError(404, "Loja não encontrada");
  if (!CHECKLIST[fluxoDe(loja.tipo)].some((e) => e.key === etapa)) throw new HttpError(400, "Etapa inválida");
  // Regra de negócio: nenhuma etapa avança sem CNPJ.
  if (!loja.cnpj && !ETAPAS_SEM_CNPJ.has(etapa) && v.status !== "PENDENTE")
    throw new HttpError(409, "Loja sem CNPJ: nenhuma etapa avança até o CNPJ ser informado.");
  await q(
    `UPDATE store_steps SET status=$3, data=$4, observacao=$5, responsavel=$6, atualizado_em=now(), atualizado_por=$7
     WHERE store_id=$1 AND etapa=$2`,
    [id, etapa, v.status, v.data || null, v.observacao ? cleanText(v.observacao, 1000) : null, v.responsavel ? cleanText(v.responsavel, 100) : null, por]
  );
  await registrarEvento(id, "ETAPA", `Etapa "${etapa}" → ${v.status}`, por);
}

export async function excluirLoja(id: string, por: string) {
  await q("UPDATE stores SET excluido_em=now(), excluido_por=$2 WHERE id=$1 AND excluido_em IS NULL", [id, por]);
}
