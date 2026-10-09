// Sessões no servidor + controle de acesso. Nega por padrão: toda rota/API chama requireUser ou withApi.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { q, q1 } from "./db";
import { randomToken, safeEqual, sha256 } from "./crypto";
import { audit } from "./audit";
import { rateLimit } from "./ratelimit";

export type Role = "ADMIN" | "OPERADOR" | "LEITOR";
const RANK: Record<Role, number> = { LEITOR: 1, OPERADOR: 2, ADMIN: 3 };
export type SessionUser = { email: string; nome: string | null; role: Role; csrf: string };

export const IS_PROD = process.env.NODE_ENV === "production";
export const SESSION_COOKIE = IS_PROD ? "__Host-sid" : "sid";
const ABS_HOURS = Number(process.env.SESSION_MAX_HOURS ?? 8);
const IDLE_MIN = Number(process.env.SESSION_IDLE_MINUTES ?? 30);

/**
 * IP do cliente. O X-Forwarded-For pode trazer valores forjados pelo próprio cliente NO INÍCIO;
 * o proxy confiável (Cloud Run) acrescenta o IP real no FIM. Por isso contamos a partir do fim,
 * pulando TRUSTED_PROXY_HOPS-1 proxies internos (padrão 1 = só o front-end do Google).
 */
export function clientIp(h: Headers): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1));
  const xff = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = xff.length >= hops ? xff[xff.length - hops] : "";
  return (ip || h.get("x-real-ip") || "desconhecido").slice(0, 64);
}

export async function createSession(email: string, ip: string, ua: string) {
  const token = randomToken(32);
  await q(
    `INSERT INTO sessions(token_hash, user_email, csrf_token, expira_em, ip, user_agent)
     VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval, $5, $6)`,
    [sha256(token), email, randomToken(24), String(ABS_HOURS), ip, ua.slice(0, 300)]
  );
  return token;
}

export function sessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, secure: IS_PROD, sameSite: "lax" as const, path: "/", maxAge: ABS_HOURS * 3600 };
}

export async function getSessionByToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const row = await q1<{ email: string; nome: string | null; role: Role; csrf_token: string }>(
    `UPDATE sessions s SET visto_em = now()
       FROM users u
      WHERE s.token_hash = $1 AND u.email = s.user_email AND u.ativo
        AND s.expira_em > now() AND s.visto_em > now() - ($2 || ' minutes')::interval
     RETURNING u.email, u.nome, u.role, s.csrf_token`,
    [sha256(token), String(IDLE_MIN)]
  );
  return row ? { email: row.email, nome: row.nome, role: row.role, csrf: row.csrf_token } : null;
}

export async function destroySession(token: string | undefined) {
  if (token) await q("DELETE FROM sessions WHERE token_hash=$1", [sha256(token)]);
}

/** Para páginas (Server Components). Sem sessão → /login. Sem permissão → painel. */
export async function requireUser(min: Role = "LEITOR"): Promise<SessionUser> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await getSessionByToken(token);
  if (!user) redirect("/login");
  if (RANK[user.role] < RANK[min]) {
    await audit("ACESSO_NEGADO", { user: user.email, ip: clientIp(await headers()), detalhe: { exigido: min } });
    redirect("/?negado=1");
  }
  return user;
}

export const hasRole = (u: SessionUser, min: Role) => RANK[u.role] >= RANK[min];

type Ctx<P> = { user: SessionUser; ip: string; params: P };
type Handler<P> = (req: NextRequest, ctx: Ctx<P>) => Promise<Response>;

const json = (status: number, body: unknown) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Envolve TODA rota de API: exige sessão, papel mínimo, limite de requisições e,
 * em métodos que alteram dados, Origin igual ao do app + token CSRF da sessão.
 */
const LIMITE_GERAL = Number(process.env.RATE_LIMIT_API ?? 300); // por IP, a cada 5 minutos
export function withApi<P = Record<string, string>>(min: Role, handler: Handler<P>, opts: { limit?: number } = {}) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    const ip = clientIp(req.headers);
    const okGeral = rateLimit(`api:${ip}`, LIMITE_GERAL, 5 * 60_000);
    // contador próprio para rotas com limite específico (revelar, exportar...), com IDs trocados por ":id"
    const rota = req.nextUrl.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id");
    const okRota = opts.limit ? rateLimit(`api:${ip}:${req.method}:${rota}`, opts.limit, 5 * 60_000) : true;
    if (!okGeral || !okRota) return json(429, { erro: "Muitas requisições. Aguarde alguns minutos." });
    const user = await getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return json(401, { erro: "Não autenticado" });
    if (RANK[user.role] < RANK[min]) {
      await audit("ACESSO_NEGADO", { user: user.email, ip, alvo: req.nextUrl.pathname, detalhe: { exigido: min } });
      return json(403, { erro: "Sem permissão" });
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      const origin = req.headers.get("origin");
      const appOrigin = new URL(process.env.APP_URL ?? req.nextUrl.origin).origin;
      const csrf = req.headers.get("x-csrf-token") ?? "";
      if (origin !== appOrigin || !safeEqual(csrf, user.csrf)) return json(403, { erro: "Falha de verificação CSRF" });
    }
    try {
      return await handler(req, { user, ip, params: await ctx.params });
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { erro: e.message, detalhes: e.detalhes });
      // Nunca devolver stack/dados internos; o log registra só a mensagem.
      console.error("Erro na API", req.nextUrl.pathname, (e as Error).message);
      return json(500, { erro: "Erro interno" });
    }
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public detalhes?: unknown) { super(message); }
}
