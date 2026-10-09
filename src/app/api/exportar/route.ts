import { z } from "zod";
import { withApi, HttpError } from "@/lib/auth";
import { q } from "@/lib/db";
import { decifrar } from "@/lib/stores";
import { cifrarExportacao } from "@/lib/exportacao";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const POST = withApi("ADMIN", async (req, { user, ip }) => {
  const p = z.object({ senha: z.string().min(16).max(200) }).strict().safeParse(await req.json().catch(() => null));
  if (!p.success) throw new HttpError(400, "Informe uma senha com pelo menos 16 caracteres");
  const lojas = await q<{ id: string; segredos: Record<string, string> }>("SELECT * FROM stores");
  const conteudo = {
    gerado_em: new Date().toISOString(), por: user.email,
    lojas: lojas.map((l) => ({ ...l, segredos: decifrar(l.id, l.segredos) })),
    etapas: await q("SELECT * FROM store_steps"), eventos: await q("SELECT * FROM store_events"),
    config: await q("SELECT chave, valor, atualizado_em FROM config WHERE NOT sensivel"),
  };
  const enc = cifrarExportacao(JSON.stringify(conteudo), p.data.senha);
  await audit("EXPORTACAO", { user: user.email, ip, detalhe: { lojas: lojas.length } });
  return new Response(enc, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="exportacao-${new Date().toISOString().slice(0, 10)}.enc.json"`, "Cache-Control": "no-store" } });
}, { limit: 5 });
