// SOMENTE DESENVOLVIMENTO LOCAL: entra sem Google, mas ainda exige e-mail na allowlist.
// Em produção (NODE_ENV=production) esta rota responde 404 sempre — coberto pelos testes de segurança.
import { NextResponse, type NextRequest } from "next/server";
import { q1 } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp, createSession, sessionCookie } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const enabled = process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN_ENABLED === "true"
    && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.APP_URL ?? "");
  if (!enabled) return new NextResponse("Not found", { status: 404 });
  const email = (req.nextUrl.searchParams.get("email") ?? "").toLowerCase();
  const u = await q1("SELECT email FROM users WHERE email=$1 AND ativo", [email]);
  if (!u) return new NextResponse("Usuário fora da allowlist", { status: 403 });
  const token = await createSession(email, clientIp(req.headers), "dev-login");
  await audit("LOGIN_OK", { user: email, ip: clientIp(req.headers), detalhe: { via: "dev-login" } });
  const res = NextResponse.redirect(new URL("/", process.env.APP_URL));
  res.cookies.set(sessionCookie(token));
  return res;
}
