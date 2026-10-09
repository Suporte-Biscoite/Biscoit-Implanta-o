// Busca a loja no pipeline (somente leitura). Devolve só nome, CNPJ, UF, tipo e data — nada pessoal.
import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { lerAba, buscarNoPipeline } from "@/lib/sheets";
import { cleanText, onlyDigits } from "@/lib/validators";

export const GET = withApi("OPERADOR", async (req) => {
  const cnpj = onlyDigits(req.nextUrl.searchParams.get("cnpj")).slice(0, 14);
  const nome = cleanText(req.nextUrl.searchParams.get("nome"), 120);
  if (!cnpj && nome.length < 4) throw new HttpError(400, "Informe CNPJ ou ao menos 4 letras do nome");
  const cfg = await getConfig();
  if (!cfg.links.pipeline_sheet_id) return NextResponse.json({ configurado: false, resultados: [] });
  let rows: string[][];
  try { rows = await lerAba(cfg.links.pipeline_sheet_id, cfg.links.pipeline_aba); }
  catch (e) {
    console.error("Falha ao ler pipeline:", (e as Error).message.slice(0, 200));
    throw new HttpError(502, "Não foi possível ler o pipeline. Confira o compartilhamento com a conta de serviço.");
  }
  return NextResponse.json({ configurado: true, resultados: buscarNoPipeline(rows, cfg.pipeline_colunas, { cnpj, nome }).slice(0, 5) });
}, { limit: 60 });
