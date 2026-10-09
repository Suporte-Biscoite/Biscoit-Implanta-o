// Login com Google (OpenID Connect) via biblioteca openid-client: valida assinatura do ID token,
// emissor, audiência, nonce, state e PKCE. A autorização (domínio + allowlist) é feita depois, no servidor.
import { Issuer, generators, type Client } from "openid-client";

let client: Client | null = null;
export async function oidcClient(): Promise<Client> {
  if (client) return client;
  const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID/SECRET não configurados");
  const google = await Issuer.discover("https://accounts.google.com");
  client = new google.Client({
    client_id: id, client_secret: secret,
    redirect_uris: [`${process.env.APP_URL}/api/auth/callback`], response_types: ["code"],
  });
  return client;
}
export { generators };

export const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN ?? "").toLowerCase();

/** Regras de autorização sobre as claims do Google (testadas em tests/auth-claims.test.ts). */
export function claimsPermitidas(c: { email?: unknown; email_verified?: unknown; hd?: unknown }): { ok: true; email: string } | { ok: false; motivo: string } {
  const email = String(c.email ?? "").toLowerCase();
  if (!ALLOWED_DOMAIN) return { ok: false, motivo: "ALLOWED_DOMAIN não configurado" };
  if (c.email_verified !== true) return { ok: false, motivo: "e-mail não verificado" };
  if (String(c.hd ?? "").toLowerCase() !== ALLOWED_DOMAIN) return { ok: false, motivo: "conta fora do Workspace da empresa" };
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) return { ok: false, motivo: "domínio não permitido" };
  return { ok: true, email };
}
