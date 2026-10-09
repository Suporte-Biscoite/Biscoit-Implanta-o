// Composição: loja + segredos (decifrados só no servidor) + pendências + alertas.
import { getLoja, etapasDa, decifrar, listarLojas } from "./stores";
import { detectarPendencias } from "./pendencias";
import { alertasDaLoja, statusGeral, diasAte, CAMPOS_SENSIVEIS, type Segredos } from "./domain";
import { maskCPF, maskLink, maskPhone, maskToken } from "./mask";
import { HttpError } from "./auth";
import { getConfig } from "./config";

export async function carregarLoja(id: string) {
  const loja = await getLoja(id);
  if (!loja) throw new HttpError(404, "Loja não encontrada");
  const { segredosEnc, ...pub } = loja;
  const segredos = decifrar(id, segredosEnc);
  const etapas = await etapasDa(id);
  const cfg = await getConfig();
  const pendencias = detectarPendencias({ loja: pub, dados: pub.dados, segredos, padraoPropria: cfg.propria_padrao });
  const alertas = alertasDaLoja(pub, etapas, pendencias.length);
  return { loja: pub, segredos, etapas, pendencias, alertas, status: statusGeral(pub, etapas, pub.tipo) };
}

/** Versão mascarada dos segredos para exibir na tela. */
export function mascarar(s: Segredos): Record<string, { preenchido: boolean; mascara: string }> {
  const out: Record<string, { preenchido: boolean; mascara: string }> = {};
  for (const k of CAMPOS_SENSIVEIS) {
    const v = s[k] ?? "";
    const mascara = !v ? "" : k === "resp_cpf" ? maskCPF(v) : k === "resp_telefone" ? maskPhone(v)
      : k.endsWith("_link") ? maskLink(v) : maskToken(v);
    out[k] = { preenchido: !!v, mascara };
  }
  return out;
}

export function exigirCnpj(loja: { cnpj: string | null }) {
  if (!loja.cnpj) throw new HttpError(409, "Loja sem CNPJ: nada avança até o CNPJ ser informado.");
}

export type ResumoLoja = Awaited<ReturnType<typeof resumoLojas>>[number];
export async function resumoLojas(f: { tipo?: string; de?: string; ate?: string } = {}) {
  const [lojas, cfg] = await Promise.all([listarLojas(f), getConfig()]);
  return lojas.map(({ segredos, etapas, ...l }) => {
    const pend = detectarPendencias({ loja: l, dados: l.dados, segredos: decifrar(l.id, segredos), padraoPropria: cfg.propria_padrao });
    return {
      id: l.id, tipo: l.tipo, nome: l.nome, uf: l.uf, cnpj: l.cnpj, data_inauguracao: l.data_inauguracao,
      dias: diasAte(l.data_inauguracao), status: statusGeral(l, etapas, l.tipo), etapas,
      alertas: alertasDaLoja(l, etapas, pend.length), pendencias: pend.length,
    };
  });
}
