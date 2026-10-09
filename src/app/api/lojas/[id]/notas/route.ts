import { NextResponse } from "next/server";
import { z } from "zod";
import { withApi, HttpError } from "@/lib/auth";
import { getLoja, registrarEvento } from "@/lib/stores";

export const POST = withApi<{ id: string }>("OPERADOR", async (req, { user, params }) => {
  const p = z.object({ texto: z.string().min(1).max(4000) }).strict().safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Nota inválida");
  if (!(await getLoja(params.id))) throw new HttpError(404, "Loja não encontrada");
  await registrarEvento(params.id, "NOTA", p.data.texto, user.email);
  return NextResponse.json({ ok: true }, { status: 201 });
});
