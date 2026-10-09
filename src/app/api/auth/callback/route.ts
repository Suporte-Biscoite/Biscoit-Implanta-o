import { NextResponse, type NextRequest } from "next/server";
import { oidcClient, claimsPermitidas } from "@/lib/oidc";
import { q, q1 } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, createSession, sessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

const fail = (base: string) => NextResponse.redirect(new URL("/login?erro=1", base));

export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  if (!rateLimit(`login:${ip}`, 20, 10 * 60_000)) return fail(base);
  const state = req.nextUrl.searchParams.get("state") ?? "";
  // O fluxo (state) só pode ser usado uma vez: apaga e devolve na mesma operação.
  const flow = await q1<{ nonce: string; code_verifier: string }>(
    "DELETE FROM auth_flows WHERE state=$1 AND criado_em > now() - interval '10 minutes' RETURNING nonce, code_verifier", [state]);
  if (!flow) { await audit("LOGIN_FALHA", { ip, detalhe: { motivo: "state inválido/expirado" } }); return fail(base); }
  let claims;
  try {
    const client = await oidcClient();
    const params = client.callbackParams(req.nextUrl.toString());
    const tokens = await client.callback(`${process.env.APP_URL}/api/auth/callback`, params,
      { state, nonce: flow.nonce, code_verifier: flow.code_verifier });
    claims = tokens.claims(); // assinatura, emissor, audiência, expiração e nonce já validados
  } catch (e) {
    await audit("LOGIN_FALHA", { ip, detalhe: { motivo: "troca de código falhou", erro: (e as Error).message.slice(0, 120) } });
    return fail(base);
  }
  const ok = claimsPermitidas(claims);
  if (!ok.ok) { await audit("LOGIN_FALHA", { user: String(claims.email ?? ""), ip, detalhe: { motivo: ok.motivo } }); return fail(base); }
  const user = await q1<{ email: string }>("SELECT email FROM users WHERE email=$1 AND ativo", [ok.email]);
  if (!user) { await audit("LOGIN_FALHA", { user: ok.email, ip, detalhe: { motivo: "fora da allowlist" } }); return fail(base); }
  await q("UPDATE users SET nome=COALESCE(nome,$2) WHERE email=$1", [ok.email, String(claims.name ?? "").slice(0, 120) || null]);
  const token = await createSession(ok.email, ip, req.headers.get("user-agent") ?? "");
  await audit("LOGIN_OK", { user: ok.email, ip });
  const res = NextResponse.redirect(new URL("/", base));
  res.cookies.set(sessionCookie(token));
  return res;
}
