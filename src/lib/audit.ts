// Log de auditoria (somente inclusão — o banco bloqueia UPDATE/DELETE por trigger).
// NUNCA gravar aqui valores sensíveis (CPF, tokens, conteúdo de planilha): só QUAL campo/ação.
import { q } from "./db";
export type AuditAction =
  | "LOGIN_OK" | "LOGIN_FALHA" | "LOGOUT" | "SESSAO_EXPIRADA"
  | "CAMPO_REVELADO" | "EMAIL_GERADO" | "ONBOARDING_GERADO" | "EXPORTACAO"
  | "CONFIG_ALTERADA" | "USUARIO_CRIADO" | "USUARIO_ALTERADO"
  | "LOJA_CRIADA" | "LOJA_ALTERADA" | "LOJA_EXCLUIDA" | "FORM_SINCRONIZADO" | "ACESSO_NEGADO";
export async function audit(acao: AuditAction, opts: { user?: string | null; ip?: string | null; alvo?: string; detalhe?: Record<string, unknown> } = {}) {
  await q("INSERT INTO audit_log(user_email, ip, acao, alvo, detalhe) VALUES ($1,$2,$3,$4,$5)", [
    opts.user ?? null, opts.ip ?? null, acao, opts.alvo ?? null, opts.detalhe ? JSON.stringify(opts.detalhe) : null,
  ]);
}
