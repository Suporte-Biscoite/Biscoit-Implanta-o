// Mensagens prontas para copiar (WhatsApp): convite do formulário e pedido de pendências.
import { NextResponse } from "next/server";
import { withApi } from "@/lib/auth";
import { carregarLoja } from "@/lib/service";
import { getConfig } from "@/lib/config";
import { mensagemPendencias } from "@/lib/pendencias";

export const GET = withApi<{ id: string }>("LEITOR", async (_req, { params }) => {
  const { loja, pendencias } = await carregarLoja(params.id);
  const cfg = await getConfig();
  const formulario = cfg.mensagem_formulario
    .replaceAll("{loja}", loja.nome)
    .replaceAll("{link}", cfg.links.formulario || "[CONFIGURAR LINK DO FORMULÁRIO]");
  // Só faz sentido pedir pendências ao franqueado depois de importar a resposta do formulário.
  const pend = loja.form_sincronizado_em ? mensagemPendencias(loja.nome, pendencias) : "";
  return NextResponse.json({ formulario, pendencias: pend, formularioImportado: !!loja.form_sincronizado_em });
});
