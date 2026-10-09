// Allowlist individual: só estes e-mails (do domínio da empresa) conseguem entrar.
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApi, HttpError } from "@/lib/auth";
import { q } from "@/lib/db";
import { audit } from "@/lib/audit";

const dominio = () => (process.env.ALLOWED_DOMAIN ?? "").toLowerCase();
export const GET = withApi("ADMIN", async () =>
  NextResponse.json(await q("SELECT email, nome, role, ativo, criado_em, criado_por FROM users ORDER BY email")));

export const POST = withApi("ADMIN", async (req, { user, ip }) => {
  const p = z.object({ email: z.string().email().max(254), role: z.enum(["ADMIN", "OPERADOR", "LEITOR"]) }).strict()
    .safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Dados inválidos");
  const email = p.data.email.toLowerCase();
  if (dominio() && !email.endsWith(`@${dominio()}`)) throw new HttpError(400, `Só e-mails @${dominio()}`);
  const r = await q("INSERT INTO users(email, role, criado_por) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING RETURNING email", [email, p.data.role, user.email]);
  if (!r.length) throw new HttpError(409, "Usuário já existe");
  await audit("USUARIO_CRIADO", { user: user.email, ip, alvo: email, detalhe: { role: p.data.role } });
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const PATCH = withApi("ADMIN", async (req, { user, ip }) => {
  const p = z.object({ email: z.string().email(), role: z.enum(["ADMIN", "OPERADOR", "LEITOR"]).optional(), ativo: z.boolean().optional() }).strict()
    .safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Dados inválidos");
  const email = p.data.email.toLowerCase();
  if (email === user.email && (p.data.ativo === false || (p.data.role && p.data.role !== "ADMIN")))
    throw new HttpError(400, "Você não pode remover o seu próprio acesso de administrador");
  await q("UPDATE users SET role=COALESCE($2,role), ativo=COALESCE($3,ativo) WHERE email=$1", [email, p.data.role ?? null, p.data.ativo ?? null]);
  if (p.data.ativo === false || p.data.role) await q("DELETE FROM sessions WHERE user_email=$1", [email]); // efeito imediato
  await audit("USUARIO_ALTERADO", { user: user.email, ip, alvo: email, detalhe: { role: p.data.role, ativo: p.data.ativo } });
  return NextResponse.json({ ok: true });
});
