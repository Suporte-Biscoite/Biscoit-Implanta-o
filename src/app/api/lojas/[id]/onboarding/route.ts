import { withApi } from "@/lib/auth";
import { carregarLoja, exigirCnpj } from "@/lib/service";
import { getConfig, getSecret } from "@/lib/config";
import { gerarOnboardingXlsx, nomeArquivoOnboarding } from "@/lib/onboarding";
import { registrarEvento } from "@/lib/stores";
import { audit } from "@/lib/audit";
import { fluxoDe } from "@/lib/domain";

export const runtime = "nodejs";
export const GET = withApi<{ id: string }>("OPERADOR", async (_req, { user, ip, params }) => {
  const { loja, segredos } = await carregarLoja(params.id);
  exigirCnpj(loja);
  const cfg = await getConfig();
  const own = fluxoDe(loja.tipo) === "PROPRIA";
  const cscSP = own && loja.uf === "SP" ? await getSecret("csc_sp") : null;
  const { buffer, pendentes } = await gerarOnboardingXlsx({ loja, dados: loja.dados, segredos, cfg, cscSP });
  await registrarEvento(params.id, "ONBOARDING_GERADO", `Planilha de onboarding gerada${pendentes.length ? ` — PENDENTE: ${pendentes.join(", ")}` : ""}`, user.email);
  await audit("ONBOARDING_GERADO", { user: user.email, ip, alvo: params.id, detalhe: { pendentes: pendentes.length } });
  const nome = nomeArquivoOnboarding(loja.nome);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="onboarding.xlsx"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "no-store",
      "X-Pendentes": String(pendentes.length),
    },
  });
}, { limit: 60 });
