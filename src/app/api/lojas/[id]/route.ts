import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/auth";
import { AtualizaLojaSchema, atualizarLoja, excluirLoja, eventosDa } from "@/lib/stores";
import { carregarLoja, mascarar } from "@/lib/service";
import { audit } from "@/lib/audit";

type P = { id: string };
export const GET = withApi<P>("LEITOR", async (_req, { params }) => {
  const d = await carregarLoja(params.id);
  return NextResponse.json({ ...d, segredos: mascarar(d.segredos), eventos: await eventosDa(params.id) });
});

export const PATCH = withApi<P>("OPERADOR", async (req, { user, ip, params }) => {
  const parsed = AtualizaLojaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Dados inválidos", parsed.error.issues.map((i) => ({ campo: i.path.join("."), msg: i.message })));
  const campos = await atualizarLoja(params.id, parsed.data, user.email);
  await audit("LOJA_ALTERADA", { user: user.email, ip, alvo: params.id, detalhe: { campos } });
  return NextResponse.json({ ok: true });
});

export const DELETE = withApi<P>("ADMIN", async (_req, { user, ip, params }) => {
  await excluirLoja(params.id, user.email);
  await audit("LOJA_EXCLUIDA", { user: user.email, ip, alvo: params.id, detalhe: { tipo: "logica" } });
  return NextResponse.json({ ok: true });
});
