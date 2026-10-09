// Grava (nunca lê de volta) configurações sensíveis: CPF do responsável da própria, CPF da testemunha, CSC de SP.
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApi, HttpError } from "@/lib/auth";
import { setSecret } from "@/lib/config";
import { isValidCPF, onlyDigits } from "@/lib/validators";
import { audit } from "@/lib/audit";

const S = z.discriminatedUnion("chave", [
  z.object({ chave: z.literal("propria_resp_cpf"), valor: z.string().refine(isValidCPF, "CPF inválido") }),
  z.object({ chave: z.literal("testemunha_cpf"), valor: z.string().refine(isValidCPF, "CPF inválido") }),
  z.object({ chave: z.literal("csc_sp"), valor: z.object({
    prod_id: z.string().regex(/^\d{1,6}$/), prod_token: z.string().min(16).max(64),
    hom_id: z.string().regex(/^\d{1,6}$/), hom_token: z.string().min(16).max(64),
  }).strict() }),
]);
export const PUT = withApi("ADMIN", async (req, { user, ip }) => {
  const p = S.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Valor inválido");
  const valor = typeof p.data.valor === "string" ? onlyDigits(p.data.valor) : p.data.valor;
  await setSecret(p.data.chave, valor, user.email);
  await audit("CONFIG_ALTERADA", { user: user.email, ip, alvo: p.data.chave, detalhe: { sensivel: true } });
  return NextResponse.json({ ok: true });
});
