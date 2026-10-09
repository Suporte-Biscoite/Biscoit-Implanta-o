// Primeira barreira (roda antes de qualquer página/API): sem cookie de sessão → bloqueia.
// A validação REAL da sessão e do papel acontece no servidor (requireUser / withApi), pois aqui
// não há acesso ao banco. Isto garante "nega por padrão" mesmo se alguém esquecer o requireUser.
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = [/^\/login$/, /^\/api\/auth\/(login|callback|dev-login)$/, /^\/robots\.txt$/, /^\/favicon\.ico$/];
const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-sid" : "sid";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // atributos style do preview do e-mail (conteúdo já escapado)
    "img-src 'self' data:", "font-src 'self'", "connect-src 'self'",
    "frame-ancestors 'none'", "base-uri 'none'", "object-src 'none'",
    "form-action 'self' https://accounts.google.com",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const isPublic = PUBLIC.some((r) => r.test(pathname));
  if (!isPublic && !req.cookies.get(SESSION_COOKIE)?.value) {
    if (pathname.startsWith("/api/"))
      return NextResponse.json({ erro: "Não autenticado" }, { status: 401, headers: { "Content-Security-Policy": csp } });
    const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = "";
    return NextResponse.redirect(url);
  }
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

// Roda em tudo, exceto arquivos estáticos do build.
export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
