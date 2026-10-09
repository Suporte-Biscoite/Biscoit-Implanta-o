import { NextResponse } from "next/server";
import { z } from "zod";
import { withApi, HttpError } from "@/lib/auth";
import { DEFAULTS, getConfig, setConfig, secretStatus, type AppConfig } from "@/lib/config";
import { isValidEmail } from "@/lib/validators";
import { audit } from "@/lib/audit";

export const GET = withApi("ADMIN", async () =>
  NextResponse.json({ config: await getConfig(), segredos: await secretStatus() }));

/** Valida que o valor novo tem os mesmos tipos do padrão (sem aceitar chaves ou formatos estranhos). */
function mesmoFormato(padrao: unknown, valor: unknown, caminho: string, livre = false): string | null {
  if (Array.isArray(padrao)) {
    if (!Array.isArray(valor) || valor.length > 30) return `${caminho}: lista inválida`;
    for (const v of valor) if (typeof v !== "string" || !isValidEmail(v)) return `${caminho}: e-mail inválido`;
    return null;
  }
  if (padrao !== null && typeof padrao === "object") {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return `${caminho}: objeto esperado`;
    for (const [k, v] of Object.entries(valor)) {
      if (!livre && !(k in (padrao as object))) return `${caminho}.${k}: chave desconhecida`;
      const ref = (padrao as Record<string, unknown>)[k] ?? "";
      const err = mesmoFormato(ref, v, `${caminho}.${k}`);
      if (err) return err;
    }
    return null;
  }
  if (typeof padrao === "number") return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 && valor <= 1000 ? null : `${caminho}: número inválido`;
  if (typeof padrao === "boolean") return typeof valor === "boolean" ? null : `${caminho}: verdadeiro/falso`;
  return typeof valor === "string" && valor.length <= 3000 ? null : `${caminho}: texto inválido`;
}

const LIVRES = new Set(["respostas_mapeamento", "escrituracao_por_regime"]);
export const PUT = withApi("ADMIN", async (req, { user, ip }) => {
  const p = z.object({ chave: z.string(), valor: z.unknown() }).strict().safeParse(await req.json().catch(() => null));
  if (!p.success || !(p.data.chave in DEFAULTS)) throw new HttpError(400, "Chave inválida");
  const chave = p.data.chave as keyof AppConfig;
  const err = mesmoFormato(DEFAULTS[chave], p.data.valor, chave, LIVRES.has(chave));
  if (err) throw new HttpError(400, err);
  await setConfig(chave, p.data.valor, user.email);
  await audit("CONFIG_ALTERADA", { user: user.email, ip, alvo: chave });
  return NextResponse.json({ ok: true });
});
