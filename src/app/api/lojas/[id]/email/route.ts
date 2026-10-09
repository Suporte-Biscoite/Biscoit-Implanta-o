import { NextResponse } from "next/server";
import { withApi } from "@/lib/auth";
import { carregarLoja, exigirCnpj } from "@/lib/service";
import { getConfig, getSecret } from "@/lib/config";
import { gerarEmailNexaas } from "@/lib/email";
import { registrarEvento } from "@/lib/stores";
import { audit } from "@/lib/audit";
import { fluxoDe } from "@/lib/domain";

export const GET = withApi<{ id: string }>("OPERADOR", async (_req, { user, ip, params }) => {
  const { loja, segredos } = await carregarLoja(params.id);
  exigirCnpj(loja);
  const cfg = await getConfig();
  const own = fluxoDe(loja.tipo) === "PROPRIA";
  const email = gerarEmailNexaas({
    loja, dados: loja.dados, segredos, cfg,
    propriaRespCpf: own ? await getSecret("propria_resp_cpf") : null,
    testemunhaCpf: await getSecret("testemunha_cpf"),
  });
  await registrarEvento(params.id, "EMAIL_GERADO", `E-mail do Nexaas gerado${email.faltando.length ? ` (${email.faltando.length} campo(s) pendente(s))` : ""}`, user.email);
  await audit("EMAIL_GERADO", { user: user.email, ip, alvo: params.id });
  return NextResponse.json(email);
}, { limit: 60 });
