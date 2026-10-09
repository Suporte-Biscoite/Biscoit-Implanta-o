// Dados FICTÍCIOS para testes. Documentos gerados pelos algoritmos (não pertencem a ninguém real).
import { DEFAULTS, type AppConfig } from "@/lib/config";
import type { DadosLoja, Segredos } from "@/lib/domain";

export function gerarCNPJ(base12: string) {
  const d = base12.split("").map(Number);
  const calc = (w: number[]) => { const r = w.reduce((a, x, i) => a + x * d[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  d.push(calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])); d.push(calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return d.join("");
}
export function gerarCPF(base9: string) {
  const d = base9.split("").map(Number);
  const dv = (len: number) => { let s = 0; for (let i = 0; i < len; i++) s += d[i] * (len + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  d.push(dv(9)); d.push(dv(10)); return d.join("");
}
export function gerarIESP(base: string) { // base: 8 dígitos + 2 dígitos (posições 10-11)
  const d = base.slice(0, 8).split("").map(Number);
  const d9 = [1, 3, 4, 5, 6, 7, 8, 10].reduce((a, w, i) => a + w * d[i], 0) % 11 % 10;
  const e = [...d, d9, ...base.slice(8, 10).split("").map(Number)];
  const d12 = [3, 2, 10, 9, 8, 7, 6, 5, 4, 3, 2].reduce((a, w, i) => a + w * e[i], 0) % 11 % 10;
  return [...e, d12].join("");
}

export const CNPJ_FICTICIO = gerarCNPJ("123456780001");
export const CPF_FICTICIO = gerarCPF("123456789");
export const CPF_TESTEMUNHA = gerarCPF("987654321");
export const IE_SP_FICTICIA = gerarIESP("1112223334");

export const CFG: AppConfig = {
  ...DEFAULTS,
  emails: {
    FRANQUIA: { para: ["contato@fornecedor.exemplo"], cc: ["cs@fornecedor.exemplo", "ti@empresa.exemplo"] },
    PROPRIA: { para: ["contato@fornecedor.exemplo"], cc: ["cs@fornecedor.exemplo", "ti@empresa.exemplo", "responsavel@empresa.exemplo"] },
  },
  propria_padrao: { razao_social: "EMPRESA FICTICIA COMERCIO LTDA", regime: "3 - PRESUMIDO", resp_nome: "Fulano de Tal", resp_email: "responsavel@empresa.exemplo", resp_telefone: "11 90000-0000", resp_doc_link: "https://drive.google.com/file/d/FICTICIO-RG", financeiro: "A/C Beltrano | Controladoria | financeiro@empresa.exemplo | Rua Exemplo, 100 - São Paulo/SP", ponto_focal: "11 90000-0000" },
  testemunha: { nome: "Ciclana Testemunha", email: "testemunha@empresa.exemplo", endereco: "Rua Exemplo, 100 - São Paulo/SP", telefone: "11 91111-1111" },
  onboarding: { ...DEFAULTS.onboarding, email_xml: "xml@empresa.exemplo", padroes: { ...DEFAULTS.onboarding.padroes, serie_nfce: "1", serie_nfe: "2", seq_nfe: "0", seq_nfce: "0", terminais: "2", raio: "Sem Limite" } },
};

export const DADOS_COMPLETOS: DadosLoja = {
  razao_social: "LOJA FICTICIA LTDA", ie: IE_SP_FICTICIA, regime: "Simples Nacional",
  logradouro: "Avenida Exemplo", numero: "1000", complemento: "Loja 1", bairro: "Centro", cep: "01000000", cidade: "São Paulo",
  contrato_link: "https://drive.google.com/file/d/FICTICIO-CONTRATO", resp_nome: "Maria Exemplo", resp_email: "maria@exemplo.com",
  financeiro: "João Exemplo 11 92222-2222", ponto_focal: "11 93333-3333", certificado_recebido: true,
};
export const SEG_COMPLETOS: Segredos = {
  resp_cpf: CPF_FICTICIO, resp_doc_link: "https://drive.google.com/file/d/FICTICIO-RG", resp_telefone: "11 94444-4444",
  certificado_link: "https://drive.google.com/file/d/FICTICIO-CERT",
  csc_prod_id: "000001", csc_prod_token: "AAAAAAAA-1111-2222-3333-FICTICIO0001", csc_hom_id: "000001", csc_hom_token: "BBBBBBBB-1111-2222-3333-FICTICIO0002",
};
