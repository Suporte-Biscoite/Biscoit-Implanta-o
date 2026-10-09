import { NextResponse } from "next/server";
import { z } from "zod";
import { withApi, HttpError } from "@/lib/auth";
import { atualizarEtapa } from "@/lib/stores";

const S = z.object({
  etapa: z.string().max(40),
  status: z.enum(["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO", "NAO_SE_APLICA"]),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
  observacao: z.string().max(2000).nullable().optional(),
  responsavel: z.string().max(200).nullable().optional(),
}).strict();
export const PATCH = withApi<{ id: string }>("OPERADOR", async (req, { user, params }) => {
  const p = S.safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Dados inválidos");
  await atualizarEtapa(params.id, p.data.etapa, p.data, user.email);
  return NextResponse.json({ ok: true });
});
