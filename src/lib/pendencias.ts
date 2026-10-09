// Detecta campos obrigatórios vazios ou inválidos e monta a mensagem para o franqueado.
import { fluxoDe, type DadosLoja, type Loja, type Segredos } from "./domain";
import {
  isDriveLink, isValidCEP, isValidCNPJ, isValidCPF, isValidEmail, isValidIE, isUF,
  normalizeRegime, onlyDigits, formatCNPJ,
} from "./validators";

export type Pendencia = {
  campo: string;
  rotulo: string;
  problema: "vazio" | "invalido" | "divergente";
  /** Texto para o franqueado (WhatsApp). Nunca contém o valor informado. */
  pedido: string;
  interno?: boolean; // pendência só do time de TI (não vai na mensagem ao franqueado)
};

type Entrada = {
  loja: Pick<Loja, "tipo" | "uf" | "cnpj" | "email_loja" | "nome" | "data_inauguracao">; dados: DadosLoja; segredos: Segredos;
  /** Loja própria: valores padrão da configuração (razão social, RG/CNH do responsável). */
  padraoPropria?: { razao_social?: string; resp_doc_link?: string };
};

const filled = (v: unknown) => String(v ?? "").trim().length > 0;
const CONTAB = "Se tiver dúvida, a contabilidade de vocês consegue informar.";

export function detectarPendencias({ loja, dados: dadosIn, segredos: segIn, padraoPropria }: Entrada): Pendencia[] {
  const p: Pendencia[] = [];
  const add = (campo: string, rotulo: string, problema: Pendencia["problema"], pedido: string, interno = false) =>
    p.push({ campo, rotulo, problema, pedido, interno });
  const req = (campo: string, rotulo: string, v: unknown, ok: (v: unknown) => boolean, pedidoVazio: string, pedidoInvalido: string) => {
    if (!filled(v)) add(campo, rotulo, "vazio", pedidoVazio);
    else if (!ok(v)) add(campo, rotulo, "invalido", pedidoInvalido);
  };
  const always = () => true;
  const franquia = fluxoDe(loja.tipo) === "FRANQUIA";
  const dados = !franquia && padraoPropria?.razao_social && !dadosIn.razao_social ? { ...dadosIn, razao_social: padraoPropria.razao_social } : dadosIn;
  const segredos = !franquia && padraoPropria?.resp_doc_link && !segIn.resp_doc_link ? { ...segIn, resp_doc_link: padraoPropria.resp_doc_link } : segIn;

  // ---- Comuns aos dois fluxos ----
  if (!loja.cnpj) add("cnpj", "CNPJ", "vazio", "o CNPJ da loja", true);
  else if (!isValidCNPJ(loja.cnpj)) add("cnpj", "CNPJ", "invalido", "o CNPJ da loja (o número informado não é válido)");
  if (!loja.data_inauguracao) add("data_inauguracao", "Data de inauguração", "vazio", "", true);

  req("razao_social", "Razão Social", dados.razao_social, always, "a Razão Social (como está no Cartão CNPJ)", "");
  req("ie", "Inscrição Estadual", dados.ie, (v) => isValidIE(v, loja.uf),
    `a Inscrição Estadual. ${CONTAB}`, `a Inscrição Estadual — o número informado não confere para ${loja.uf}. ${CONTAB}`);
  req("contrato_link", "Contrato Social / Cartão CNPJ", dados.contrato_link, isDriveLink,
    "o link (Google Drive) do Contrato Social ou do Cartão CNPJ",
    "o link do Contrato Social/Cartão CNPJ — precisa ser um link do Google Drive com acesso liberado");
  req("logradouro", "Logradouro", dados.logradouro, always, "o endereço da loja (rua/avenida)", "");
  req("numero", "Número", dados.numero, always, "o número do endereço da loja", "");
  req("bairro", "Bairro", dados.bairro, always, "o bairro da loja", "");
  req("cidade", "Cidade", dados.cidade, always, "a cidade da loja", "");
  req("cep", "CEP", dados.cep, isValidCEP, "o CEP da loja", "o CEP da loja (o informado não é válido)");
  if (!isUF(loja.uf)) add("uf", "UF", "invalido", "a UF da loja");

  if (!franquia) {
    // Loja própria: responsável legal, testemunha, CSC (SP) e certificado vêm da configuração.
    req("resp_doc_link", "PDF do RG/CNH do Responsável Legal", segredos.resp_doc_link, isDriveLink,
      "link do Drive com o RG/CNH do responsável legal", "link do RG/CNH (precisa ser do Google Drive)");
    if (loja.uf !== "SP") add("csc", "CSC (produção e homologação)", "vazio", "solicitar CSC ID e Token à Controladoria", true);
    return p.map((x) => ({ ...x, interno: true }));
  }

  // ---- Somente franquia (dados vêm do formulário) ----
  if (dados.cnpj_formulario && loja.cnpj && onlyDigits(dados.cnpj_formulario) !== loja.cnpj)
    add("cnpj_formulario", "CNPJ do formulário", "divergente",
      `confirmar o CNPJ: no formulário veio ${formatCNPJ(dados.cnpj_formulario)}, mas o cadastro da loja tem ${formatCNPJ(loja.cnpj)}`);
  const regime = normalizeRegime(dados.regime);
  if (!filled(dados.regime)) add("regime", "Regime Tributário", "vazio", `o Regime Tributário (aparece no Cartão CNPJ ou em cnpj.biz). ${CONTAB}`);
  else if (!regime) add("regime", "Regime Tributário", "invalido", `o Regime Tributário (Simples, Lucro Presumido ou Lucro Real). ${CONTAB}`);

  req("resp_nome", "Nome do Responsável Legal", dados.resp_nome, always, "o nome completo do responsável legal (dono do CNPJ)", "");
  req("resp_cpf", "CPF do Responsável Legal", segredos.resp_cpf, isValidCPF, "o CPF do responsável legal", "o CPF do responsável legal (o informado não é válido)");
  req("resp_doc_link", "RG/CNH do Responsável Legal", segredos.resp_doc_link, isDriveLink,
    "o link (Google Drive) do RG ou CNH do responsável legal", "o link do RG/CNH — precisa ser do Google Drive com acesso liberado");
  req("resp_email", "E-mail do Responsável Legal", dados.resp_email, isValidEmail, "o e-mail do responsável legal", "o e-mail do responsável legal (o informado não é válido)");
  req("resp_telefone", "Telefone do Responsável Legal", segredos.resp_telefone, (v) => [10, 11, 12, 13].includes(onlyDigits(v).length),
    "o telefone do responsável legal (com DDD)", "o telefone do responsável legal com DDD");
  req("financeiro", "Contato financeiro", dados.financeiro, always, "o nome e contato do responsável financeiro", "");
  req("ponto_focal", "Ponto focal", dados.ponto_focal, always, "o contato do ponto focal da loja", "");

  if (!dados.certificado_recebido || !filled(segredos.certificado_link))
    add("certificado", "Certificado Digital", "vazio", `o Certificado Digital da empresa (e a senha, enviada em separado). Se não souberem emitir, a contabilidade ajuda.`);

  const cscOk = (id: unknown, tok: unknown) => /^\d{1,6}$/.test(String(id ?? "").trim()) && String(tok ?? "").trim().length >= 16;
  if (!filled(segredos.csc_prod_id) || !filled(segredos.csc_prod_token)) add("csc_prod", "CSC de Produção", "vazio", `o ID e o Token CSC de Produção (NFC-e, gerados no portal da SEFAZ). ${CONTAB}`);
  else if (!cscOk(segredos.csc_prod_id, segredos.csc_prod_token)) add("csc_prod", "CSC de Produção", "invalido", "conferir o ID e o Token CSC de Produção (formato inválido)");
  if (loja.uf !== "MG") {
    if (!filled(segredos.csc_hom_id) || !filled(segredos.csc_hom_token)) add("csc_hom", "CSC de Homologação", "vazio", `o ID e o Token CSC de Homologação (ambiente de testes). ${CONTAB}`);
    else if (!cscOk(segredos.csc_hom_id, segredos.csc_hom_token)) add("csc_hom", "CSC de Homologação", "invalido", "conferir o ID e o Token CSC de Homologação (formato inválido)");
  }
  if (loja.email_loja && !/@biscoite\.com$/i.test(loja.email_loja))
    add("email_loja", "E-mail da loja", "invalido", "", true);
  return p;
}

export function mensagemPendencias(nomeLoja: string, pend: Pendencia[]): string {
  const itens = pend.filter((x) => !x.interno && x.pedido);
  if (!itens.length) return "";
  return [
    `Oi, pessoal! Tudo bem? 😊`,
    `Recebemos o formulário da ${nomeLoja}, obrigado! Para seguirmos com a implantação do sistema, ficaram faltando alguns itens:`,
    "",
    ...itens.map((x, i) => `${i + 1}. ${x.pedido.charAt(0).toUpperCase()}${x.pedido.slice(1)}`),
    "",
    "Podem me mandar por aqui mesmo ou atualizar o formulário. Dados como CPF, certificado e tokens, prefiram enviar só pelo formulário. 🙏",
    "Qualquer dúvida, é só chamar!",
  ].join("\n");
}
