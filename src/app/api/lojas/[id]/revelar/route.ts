// Revela UM campo sensível — sempre registrado na auditoria (qual campo, quem, IP; nunca o valor).
import { NextResponse } from "next/server";
import { z } from "zod";
import { withApi, HttpError } from "@/lib/auth";
import { CAMPOS_SENSIVEIS } from "@/lib/domain";
import { carregarLoja } from "@/lib/service";
import { audit } from "@/lib/audit";

export const POST = withApi<{ id: string }>("OPERADOR", async (req, { user, ip, params }) => {
  const p = z.object({ campo: z.enum(CAMPOS_SENSIVEIS) }).strict().safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Campo inválido");
  const { segredos } = await carregarLoja(params.id);
  await audit("CAMPO_REVELADO", { user: user.email, ip, alvo: params.id, detalhe: { campo: p.data.campo } });
  return NextResponse.json({ valor: segredos[p.data.campo] ?? "" });
}, { limit: 60 });
