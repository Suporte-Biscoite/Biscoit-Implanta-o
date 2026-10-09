// Gera o e-mail de implantação para o Nexaas (HTML com tabela de 2 colunas, rótulos em azul claro).
// Todo valor passa por escapeHtml — dados de formulário de terceiros nunca viram HTML.
import { TIPOS, fluxoDe, sugerirNomeExibicao, type DadosLoja, type Loja, type Segredos } from "./domain";
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

/** Rótulos exatamente como no e-mail real enviado ao Nexaas (inclusive os pontos finais). */
export const ROTULOS_EMAIL = [
  "Nome da Loja/Quiosque.", "Número do CNPJ", "Contrato Social / Cartão CNPJ", "Endereço da Loja",
  "Nome Completo do Responsável Legal.", "CPF do Responsável Legal.", "PDF do RG ou CNH do Responsável Legal.",
  "E-mail do Responsável Legal.", "Telefone do Responsável Legal.", "Dados para contato financeiro",
  "Dados para contato com o ponto focal", "CPF da Testemunha", "Nome da Testemunha", "Email da Testemunha",
  "Endereço da Testemunha", "Telefone da Testemunha",
] as const;

/** Endereço em 3 linhas, como no e-mail real: "Rua, Nº — Complemento" / "Bairro, Cidade - UF" / "CEP: 00000-000". */
export function enderecoEmail(d: DadosLoja, uf: string): string {
  const l1 = [[d.logradouro, d.numero].filter(Boolean).join(", "), d.complemento].filter(Boolean).join(" — ");
  const l2 = [[d.bairro, d.cidade].filter(Boolean).join(", "), uf].filter(Boolean).join(" - ");
  const l3 = d.cep ? `CEP: ${formatCEP(d.cep)}` : "";
  return [l1, l2, l3].filter(Boolean).join("\n");
}

export function gerarEmailNexaas(i: EmailInput): EmailGerado {
  const { loja, dados, segredos, cfg } = i;
  const fluxo = fluxoDe(loja.tipo);
  const P = cfg.propria_padrao, T = cfg.testemunha;
  const own = fluxo === "PROPRIA";
  const cpfResp = own ? i.propriaRespCpf : segredos.resp_cpf;
  const valores: [string, boolean][] = [
    // [valor, éLink] — na mesma ordem de ROTULOS_EMAIL
    [loja.nome, false],
    [loja.cnpj ? formatCNPJ(loja.cnpj) : "", false],
    [dados.contrato_link ?? "", true],
    [enderecoEmail(dados, loja.uf), false],
    [own ? P.resp_nome : dados.resp_nome ?? "", false],
    [cpfResp ? formatCPF(cpfResp) : "", false],
    [(own ? segredos.resp_doc_link || P.resp_doc_link : segredos.resp_doc_link) ?? "", true],
    [own ? P.resp_email : dados.resp_email ?? "", false],
    [own ? P.resp_telefone : segredos.resp_telefone ?? "", false],
    [own ? P.financeiro : dados.financeiro ?? "", false],
    [own ? P.ponto_focal : dados.ponto_focal ?? "", false],
    [i.testemunhaCpf ? formatCPF(i.testemunhaCpf) : "", false],
    [T.nome, false], [T.email, false], [T.endereco, false], [T.telefone, false],
  ];
  const linhas = ROTULOS_EMAIL.map((r, k) => [r, ...valores[k]] as [string, string, boolean]);
  const faltando = linhas.filter(([, v]) => !String(v ?? "").trim()).map(([r]) => r.replace(/\.$/, ""));

  const data = loja.data_inauguracao ? `${loja.data_inauguracao.slice(8, 10)}/${loja.data_inauguracao.slice(5, 7)}` : null;
  if (!data) faltando.push("Data de inauguração");
  const exib = (dados.nome_exibicao ?? "").trim() || sugerirNomeExibicao(loja.nome);
  const nome = cfg.saudacoes.nome_destinatario.trim();
  const ola = `${saudacao(cfg.saudacoes, i.agora)}${nome ? ` ${nome}` : ""}, tudo bem?`;
  const p1 = `Seguem os dados para a implantação da operação Biscoitê ${exib}.`;
  const p2 = `Trata-se de ${TIPOS[loja.tipo].frase}, com previsão de inauguração para o dia ${data ?? "[PENDENTE]"}`;

  // Visual do e-mail real: bordas pretas, rótulo em azul claro e negrito, alinhado embaixo; valor alinhado em cima.
  const td = "border:1px solid #000000;padding:3px 6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;";
  const multi = (v: string) => escapeHtml(v).replace(/\r?\n/g, "<br>");
  const rows = linhas.map(([rot, val, isLink]) => {
    const v = String(val ?? "").trim();
    const cell = !v
      ? `<span style="background:#fff3b0;color:#7a4b00;font-weight:bold;">PENDENTE</span>`
      : isLink ? linkOrText(v) : multi(v);
    return `<tr><td style="${td}background:#cfe2f3;font-weight:bold;vertical-align:bottom;white-space:nowrap;">${escapeHtml(rot)}</td>` +
      `<td style="${td}vertical-align:top;min-width:520px;">${cell}</td></tr>`;
  }).join("");

  const pf = "font-family:Arial,Helvetica,sans-serif;font-size:13px;margin:0 0 14px 0;";
  const html =
    `<div><p style="${pf}">${escapeHtml(ola)}</p><p style="${pf}">${escapeHtml(p1)}</p><p style="${pf}">${escapeHtml(p2)}</p>` +
    `<table style="border-collapse:collapse;" cellspacing="0" cellpadding="0"><tbody>${rows}</tbody></table></div>`;
  const texto = [ola, "", p1, "", p2, "", ...linhas.map(([r, v]) => `${r} ${String(v ?? "").trim().replace(/\n/g, " / ") || "PENDENTE"}`)].join("\n");

  const dest = cfg.emails[fluxo];
  return { assunto: `Implantação Nexaas - ${exib}`, para: dest.para, cc: dest.cc, html, texto, faltando };
}
