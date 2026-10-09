// Configurações editáveis (tela do administrador). Nada de dado real no código:
// os padrões abaixo são vazios ou genéricos e devem ser preenchidos na tela /config.
import { q, q1 } from "./db";
import { encryptField, decryptField } from "./crypto";

export type Destinatarios = { para: string[]; cc: string[] };
export type AppConfig = {
  emails: { FRANQUIA: Destinatarios; PROPRIA: Destinatarios };
  propria_padrao: { razao_social: string; regime: string; resp_nome: string; resp_email: string; resp_telefone: string; resp_doc_link: string; financeiro: string; ponto_focal: string };
  testemunha: { nome: string; email: string; endereco: string; telefone: string };
  onboarding: {
    natureza: string; indicador: string; periodo: string; receita: string; periodicidade_xml: string;
    email_xml: string; xml_incluir_email_loja: boolean; xml_incluir_contador: boolean;
    /** Franquia: usar Natureza/Indicador/Período/Receita/Escrituração respondidos no formulário quando batem com a lista. */
    preferir_respostas_formulario: boolean;
    escrituracao_por_regime: Record<string, string>;
    padroes: { id_externo: string; vendedor: string; dias_cupom: string; raio: string; serie_nfe: string; seq_nfe: string; serie_nfce: string; seq_nfce: string; terminais: string; serie_nfce_cont: string; serie_nfe_cont: string };
  };
  links: { formulario: string; respostas_sheet_id: string; respostas_aba: string; pipeline_sheet_id: string; pipeline_aba: string };
  pipeline_colunas: { nome: string; cnpj: string; inauguracao: string; previsao: string; tipo: string; uf: string };
  respostas_mapeamento: Record<string, string>;
  saudacoes: { nome_destinatario: string; manha: string; tarde: string; noite: string; hora_tarde: number; hora_noite: number };
  mensagem_formulario: string;
  retencao_meses: number;
};

// Cabeçalhos REAIS da planilha "Contratação do Sistema Nexaas (respostas)", lidos em 09/10/2026.
// A coluna "Senha" (senha do certificado) NUNCA é mapeada — e o leitor ignora qualquer coluna de senha.
export const DEFAULT_MAPEAMENTO: Record<string, string> = {
  email_franqueado: "Endereço de e-mail",
  nome_fantasia: "Nome Fantasia",
  cnpj: "CNPJ",
  razao_social: "Razão Social",
  contrato_link: "Contrato Social",
  ie: "I.E.",
  regime: "Regime tributário", // no formulário há um espaço no fim; a comparação ignora
  logradouro: "Logradouro",
  numero: "Número",
  complemento: "Complemento",
  bairro: "Bairro",
  cep: "CEP",
  cidade: "Cidade",
  uf: "UF",
  resp_nome: "Nome",
  resp_cpf: "CPF",
  resp_doc_link: "RG/CNH",
  resp_email: "E-mail",
  resp_telefone: "Telefone",
  financeiro: "Contato Financeiro",
  ponto_focal: "Ponto Focal",
  certificado_link: "Certificado Digital",
  csc_prod_id: "ID CSC Prod.",
  csc_prod_token: "CSC Produção",
  csc_hom_id: "ID CSC Homol.",
  csc_hom_token: "CSC Homologação",
  email_loja: "E-mail Loja/Quisoque", // grafia exata do formulário
  contador_email: "Contabilidade",
  natureza: "Natureza Jurídica",
  indicador: "Indicador de Atividade",
  periodo: "Período",
  receita: "Receita",
  escrituracao: "Escrituração",
};

export const DEFAULTS: AppConfig = {
  emails: { FRANQUIA: { para: [], cc: [] }, PROPRIA: { para: [], cc: [] } },
  propria_padrao: { razao_social: "", regime: "", resp_nome: "", resp_email: "", resp_telefone: "", resp_doc_link: "", financeiro: "", ponto_focal: "" },
  testemunha: { nome: "", email: "", endereco: "", telefone: "" },
  onboarding: {
    natureza: "2062 - Sociedade Empresária Limitada",
    indicador: "10- ATIVIDADE DE COMÉRCIO", // grafia exata da lista da Planilha3
    periodo: "2 - ANUAL COM ESTIMATIVAS MENSAIS",
    receita: "2 - REGIME DE COMPETÊNCIA",
    periodicidade_xml: "MENSAL",
    email_xml: "",
    xml_incluir_email_loja: false,
    xml_incluir_contador: false,
    preferir_respostas_formulario: true,
    escrituracao_por_regime: {
      "1 - SIMPLES": "C - SIMPLES NACIONAL",
      "2 - SIMPLES - SUBLIMITE": "C - SIMPLES NACIONAL",
      "3 - PRESUMIDO": "A - DETALHADO",
      "4 - REAL": "A - DETALHADO",
      "5 - ARBITRADO": "A - DETALHADO",
    },
    padroes: { id_externo: "", vendedor: "", dias_cupom: "", raio: "", serie_nfe: "", seq_nfe: "", serie_nfce: "", seq_nfce: "", terminais: "", serie_nfce_cont: "", serie_nfe_cont: "" },
  },
  links: { formulario: "", respostas_sheet_id: "", respostas_aba: "", pipeline_sheet_id: "", pipeline_aba: "" },
  // Cabeçalhos reais do arquivo "BASE DE LOJAS DA REDE E IMPLANTAÇÕES.xlsx" (linha 3), lidos em 09/10/2026.
  pipeline_colunas: { nome: "LOJA", cnpj: "CNPJ", inauguracao: "INAUGURAÇÃO", previsao: "PREVISÃO INAUGURAÇÃO", tipo: "PRÓPRIA| FRANQUEADO", uf: "ES" },
  respostas_mapeamento: DEFAULT_MAPEAMENTO,
  saudacoes: { nome_destinatario: "Andrei", manha: "Bom dia", tarde: "Boa tarde", noite: "Boa noite", hora_tarde: 12, hora_noite: 18 },
  mensagem_formulario:
    "Olá! Tudo bem? 😊\nSou do time de TI da Biscoitê e vou acompanhar a implantação dos sistemas da {loja}.\n\n" +
    "Para começarmos, preciso que vocês preencham este formulário com os dados da loja:\n{link}\n\n" +
    "Se tiverem dúvida em algum campo (regime tributário, certificado digital, natureza jurídica), a contabilidade de vocês consegue ajudar. " +
    "Se puderem, enviem também o Cartão CNPJ. Qualquer dúvida, é só chamar por aqui!",
  retencao_meses: 12,
};

/** Chaves cujo valor é sempre cifrado no banco. */
export const SECRET_KEYS = ["propria_resp_cpf", "testemunha_cpf", "csc_sp"] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];
export type CscSet = { prod_id: string; prod_token: string; hom_id: string; hom_token: string };

function merge<T>(base: T, over: unknown): T {
  if (over === null || over === undefined) return base;
  if (typeof base !== "object" || Array.isArray(base) || base === null) return over as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = k in out ? merge(out[k], v) : v;
  }
  return out as T;
}

export async function getConfig(): Promise<AppConfig> {
  const rows = await q<{ chave: string; valor: unknown }>("SELECT chave, valor FROM config WHERE sensivel = false");
  let cfg = DEFAULTS;
  for (const r of rows) if (r.chave in DEFAULTS) cfg = { ...cfg, [r.chave]: merge((DEFAULTS as Record<string, unknown>)[r.chave], r.valor) };
  return cfg;
}

export async function setConfig(chave: keyof AppConfig, valor: unknown, por: string) {
  await q(
    `INSERT INTO config(chave, valor, sensivel, atualizado_por) VALUES ($1,$2,false,$3)
     ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor, atualizado_em=now(), atualizado_por=EXCLUDED.atualizado_por`,
    [chave, JSON.stringify(valor), por]
  );
}

export async function getSecret(chave: "csc_sp"): Promise<CscSet | null>;
export async function getSecret(chave: Exclude<SecretKey, "csc_sp">): Promise<string | null>;
export async function getSecret(chave: SecretKey): Promise<unknown> {
  const r = await q1<{ valor_cifrado: string | null }>("SELECT valor_cifrado FROM config WHERE chave=$1 AND sensivel", [chave]);
  if (!r?.valor_cifrado) return null;
  return JSON.parse(decryptField(r.valor_cifrado, `config:${chave}`));
}

export async function setSecret(chave: SecretKey, valor: unknown, por: string) {
  await q(
    `INSERT INTO config(chave, sensivel, valor_cifrado, atualizado_por) VALUES ($1,true,$2,$3)
     ON CONFLICT (chave) DO UPDATE SET valor_cifrado=EXCLUDED.valor_cifrado, atualizado_em=now(), atualizado_por=EXCLUDED.atualizado_por`,
    [chave, encryptField(JSON.stringify(valor), `config:${chave}`), por]
  );
}

export async function secretStatus(): Promise<Record<SecretKey, boolean>> {
  const rows = await q<{ chave: string }>("SELECT chave FROM config WHERE sensivel AND valor_cifrado IS NOT NULL");
  const set = new Set(rows.map((r) => r.chave));
  return Object.fromEntries(SECRET_KEYS.map((k) => [k, set.has(k)])) as Record<SecretKey, boolean>;
}
