import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/auth";
import { criarLoja, NovaLojaSchema } from "@/lib/stores";
import { resumoLojas } from "@/lib/service";
import { audit } from "@/lib/audit";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const GET = withApi("LEITOR", async (req) => {
  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo") ?? undefined, de = sp.get("de") ?? undefined, ate = sp.get("ate") ?? undefined;
  if (tipo && !["FRANQUIA", "PROPRIA", "REPASSE_FF", "REPASSE_FP"].includes(tipo)) throw new HttpError(400, "Tipo inválido");
  if ((de && !ISO.test(de)) || (ate && !ISO.test(ate))) throw new HttpError(400, "Data inválida");
  return NextResponse.json(await resumoLojas({ tipo, de, ate }));
});

export const POST = withApi("OPERADOR", async (req, { user, ip }) => {
  const parsed = NovaLojaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "Dados inválidos", parsed.error.issues.map((i) => ({ campo: i.path.join("."), msg: i.message })));
  const id = await criarLoja(parsed.data, user.email);
  await audit("LOJA_CRIADA", { user: user.email, ip, alvo: id, detalhe: { tipo: parsed.data.tipo } });
  return NextResponse.json({ id }, { status: 201 });
});
