// Gera o e-mail de implantação para o Nexaas (HTML com tabela de 2 colunas, rótulos em azul claro).
// Todo valor passa por escapeHtml — dados de formulário de terceiros nunca viram HTML.
import { TIPOS, fluxoDe, type DadosLoja, type Loja, type Segredos } from "./domain";
import type { AppConfig } from "./config";
import { formatCEP, formatCNPJ, formatCPF } from "./validators";

export const escapeHtml = (v: unknown) =>
  String(v ?? "").replace(/[&<>"'`=]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;", "=": "&#61;" })[c]!);

/** Só aceita links http(s) para virar <a>; qualquer outro esquema (javascript:, data:) vira texto. */
function linkOrText(v: string): string {
  try {
    const u = new URL(v);
    if (u.protocol === "https:" || u.protocol === "http:") return `<a href="${escapeHtml(u.href)}">${escapeHtml(v)}</a>`;
  } catch { /* não é URL */ }
  return escapeHtml(v);
}

export function saudacao(cfg: AppConfig["saudacoes"], agora = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(agora));
  return h < cfg.hora_tarde ? cfg.manha : h < cfg.hora_noite ? cfg.tarde : cfg.noite;
}

export type EmailInput = {
  loja: Pick<Loja, "tipo" | "nome" | "cnpj" | "uf" | "data_inauguracao">;
  dados: DadosLoja;
  segredos: Segredos;
  cfg: AppConfig;
  propriaRespCpf: string | null;
  testemunhaCpf: string | null;
  agora?: Date;
};
export type EmailGerado = { assunto: string; para: string[]; cc: string[]; html: string; texto: string; faltando: string[] };

export function gerarEmailNexaas(i: EmailInput): EmailGerado {
  const { loja, dados, segredos, cfg } = i;
  const fluxo = fluxoDe(loja.tipo);
  const P = cfg.propria_padrao, T = cfg.testemunha;
  const endereco = [
    [dados.logradouro, dados.numero].filter(Boolean).join(", "),
    dados.complemento, dados.bairro,
    [dados.cidade, loja.uf].filter(Boolean).join("/"),
    dados.cep ? `CEP ${formatCEP(dados.cep)}` : "",
  ].filter(Boolean).join(" - ");

  const own = fluxo === "PROPRIA";
  const linhas: [string, string, boolean][] = [
    // [rótulo, valor, éLink]
    ["Nome da Loja/Quiosque", loja.nome, false],
    ["Número do CNPJ", loja.cnpj ? formatCNPJ(loja.cnpj) : "", false],
    ["Contrato Social / Cartão CNPJ", dados.contrato_link ?? "", true],
    ["Endereço da Loja", endereco, false],
    ["Nome Completo do Responsável Legal", own ? P.resp_nome : dados.resp_nome ?? "", false],
    ["CPF do Responsável Legal", (own ? i.propriaRespCpf : segredos.resp_cpf) ? formatCPF(own ? i.propriaRespCpf : segredos.resp_cpf) : "", false],
    ["PDF do RG ou CNH do Responsável Legal", (own ? segredos.resp_doc_link || P.resp_doc_link : segredos.resp_doc_link) ?? "", true],
    ["E-mail do Responsável Legal", own ? P.resp_email : dados.resp_email ?? "", false],
    ["Telefone do Responsável Legal", own ? P.resp_telefone : segredos.resp_telefone ?? "", false],
    ["Dados para contato financeiro", own ? P.financeiro : dados.financeiro ?? "", false],
    ["Dados para contato com o ponto focal", own ? P.ponto_focal : dados.ponto_focal ?? "", false],
    ["CPF da Testemunha", i.testemunhaCpf ? formatCPF(i.testemunhaCpf) : "", false],
    ["Nome da Testemunha", T.nome, false],
    ["Email da Testemunha", T.email, false],
    ["Endereço da Testemunha", T.endereco, false],
    ["Telefone da Testemunha", T.telefone, false],
  ];
  const faltando = linhas.filter(([, v]) => !String(v ?? "").trim()).map(([r]) => r);

  const data = loja.data_inauguracao ? `${loja.data_inauguracao.slice(8, 10)}/${loja.data_inauguracao.slice(5, 7)}` : null;
  if (!data) faltando.push("Data de inauguração");
  const nome = cfg.saudacoes.nome_destinatario.trim();
  const ola = `${saudacao(cfg.saudacoes, i.agora)}${nome ? ` ${nome}` : ""}, tudo bem?`;
  const p1 = `Seguem os dados para a implantação da operação Biscoitê ${loja.nome}.`;
  const p2 = `Trata-se de ${TIPOS[loja.tipo].frase}, com previsão de inauguração para o dia ${data ?? "[PENDENTE]"}.`;

  const td = "border:1px solid #9fb6cf;padding:6px 10px;font-family:Arial,sans-serif;font-size:13px;vertical-align:top;";
  const rows = linhas.map(([rot, val, isLink]) => {
    const v = String(val ?? "").trim();
    const cell = !v
      ? `<span style="background:#fff3b0;color:#7a4b00;font-weight:bold;">PENDENTE</span>`
      : isLink ? linkOrText(v) : escapeHtml(v);
    return `<tr><td style="${td}background:#dbe8f6;font-weight:bold;width:42%;">${escapeHtml(rot)}</td><td style="${td}">${cell}</td></tr>`;
  }).join("");

  const pf = "font-family:Arial,sans-serif;font-size:13px;margin:0 0 12px 0;";
  const html =
    `<div><p style="${pf}">${escapeHtml(ola)}</p><p style="${pf}">${escapeHtml(p1)}</p><p style="${pf}">${escapeHtml(p2)}</p>` +
    `<table style="border-collapse:collapse;min-width:520px;max-width:760px;" cellspacing="0" cellpadding="0"><tbody>${rows}</tbody></table></div>`;
  const texto = [ola, "", p1, p2, "", ...linhas.map(([r, v]) => `${r}: ${String(v ?? "").trim() || "PENDENTE"}`)].join("\n");

  const dest = cfg.emails[fluxo];
  return { assunto: `Implantação Nexaas - ${loja.nome}`, para: dest.para, cc: dest.cc, html, texto, faltando };
}
