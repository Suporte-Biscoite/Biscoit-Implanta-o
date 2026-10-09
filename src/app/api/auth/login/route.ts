import { NextResponse, type NextRequest } from "next/server";
import { oidcClient, generators, ALLOWED_DOMAIN } from "@/lib/oidc";
import { q } from "@/lib/db";
import { clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

export async function GET(req: NextRequest) {
  if (!rateLimit(`login:${clientIp(req.headers)}`, 20, 10 * 60_000))
    return NextResponse.json({ erro: "Muitas tentativas de login. Aguarde 10 minutos." }, { status: 429 });
  const client = await oidcClient();
  const state = generators.state(), nonce = generators.nonce(), verifier = generators.codeVerifier();
  await q("DELETE FROM auth_flows WHERE criado_em < now() - interval '10 minutes'");
  await q("INSERT INTO auth_flows(state, nonce, code_verifier) VALUES ($1,$2,$3)", [state, nonce, verifier]);
  const url = client.authorizationUrl({
    scope: "openid email profile", state, nonce,
    code_challenge: generators.codeChallenge(verifier), code_challenge_method: "S256",
    hd: ALLOWED_DOMAIN, prompt: "select_account",
  });
  return NextResponse.redirect(url);
}
