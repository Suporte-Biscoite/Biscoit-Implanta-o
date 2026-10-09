// Importa a resposta do formulário (planilha de respostas, somente leitura) para a loja.
import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/auth";
import { carregarLoja } from "@/lib/service";
import { getConfig } from "@/lib/config";
import { lerAba, acharResposta } from "@/lib/sheets";
import { aplicarFormulario } from "@/lib/stores";
import { audit } from "@/lib/audit";
import { fluxoDe } from "@/lib/domain";

export const POST = withApi<{ id: string }>("OPERADOR", async (_req, { user, ip, params }) => {
  const { loja } = await carregarLoja(params.id);
  if (fluxoDe(loja.tipo) !== "FRANQUIA") throw new HttpError(400, "Loja própria não usa formulário");
  const cfg = await getConfig();
  if (!cfg.links.respostas_sheet_id) throw new HttpError(400, "Configure o ID da planilha de respostas em Configurações");
  let rows: string[][];
  try { rows = await lerAba(cfg.links.respostas_sheet_id, cfg.links.respostas_aba); }
  catch (e) {
    console.error("Falha ao ler planilha de respostas:", (e as Error).message.slice(0, 200));
    throw new HttpError(502, "Não foi possível ler a planilha de respostas. Confira se ela está compartilhada com a conta de serviço.");
  }
  const r = acharResposta(rows, cfg.respostas_mapeamento, { cnpj: loja.cnpj, email_loja: loja.email_loja });
  if (!r) return NextResponse.json({ encontrado: false, mensagem: "Nenhuma resposta encontrada para o CNPJ nem para o e-mail da loja." });
  await aplicarFormulario(params.id, r.dados, r.segredos, r.uf, user.email);
  await audit("FORM_SINCRONIZADO", { user: user.email, ip, alvo: params.id, detalhe: { por: r.por } });
  const depois = await carregarLoja(params.id);
  return NextResponse.json({ encontrado: true, por: r.por, colunasNaoEncontradas: r.camposAusentes, pendencias: depois.pendencias });
}, { limit: 30 });
