import { describe, expect, it } from "vitest";
import { gerarEmailNexaas, saudacao } from "@/lib/email";
import { CFG, CNPJ_FICTICIO, CPF_FICTICIO, CPF_TESTEMUNHA, DADOS_COMPLETOS, SEG_COMPLETOS } from "./fixtures";

const ROTULOS = ["Nome da Loja/Quiosque", "Número do CNPJ", "Contrato Social / Cartão CNPJ", "Endereço da Loja", "Nome Completo do Responsável Legal",
  "CPF do Responsável Legal", "PDF do RG ou CNH do Responsável Legal", "E-mail do Responsável Legal", "Telefone do Responsável Legal",
  "Dados para contato financeiro", "Dados para contato com o ponto focal", "CPF da Testemunha", "Nome da Testemunha", "Email da Testemunha",
  "Endereço da Testemunha", "Telefone da Testemunha"];

describe("e-mail do Nexaas (critério 1)", () => {
  const base = { loja: { tipo: "PROPRIA" as const, nome: "BISCOITE SHOPPING EXEMPLO", cnpj: CNPJ_FICTICIO, uf: "SP", data_inauguracao: "2030-10-25" },
    dados: DADOS_COMPLETOS, segredos: {}, cfg: CFG, propriaRespCpf: CPF_FICTICIO, testemunhaCpf: CPF_TESTEMUNHA, agora: new Date("2030-10-01T12:00:00Z") };

  it("loja própria: assunto, frases, 16 linhas na ordem, CC com o responsável", () => {
    const e = gerarEmailNexaas(base);
    expect(e.assunto).toBe("Implantação Nexaas - BISCOITE SHOPPING EXEMPLO");
    expect(e.html).toContain("Bom dia Andrei, tudo bem?");
    expect(e.html).toContain("Seguem os dados para a implantação da operação Biscoitê BISCOITE SHOPPING EXEMPLO.");
    expect(e.html).toContain("Trata-se de uma loja própria, com previsão de inauguração para o dia 25/10.");
    const rot = [...e.html.matchAll(/<td style="[^"]*background:#dbe8f6[^"]*">([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(rot).toEqual(ROTULOS);
    expect(e.faltando).toEqual([]);
    expect(e.cc).toContain("responsavel@empresa.exemplo");
    expect(e.html).toContain("Fulano de Tal"); // responsável vem da configuração
  });
  it("frases de franquia e repasses + saudação pelo horário de SP", () => {
    expect(gerarEmailNexaas({ ...base, loja: { ...base.loja, tipo: "REPASSE_FF" }, segredos: SEG_COMPLETOS }).texto).toContain("um repasse de franquia para franquia");
    expect(gerarEmailNexaas({ ...base, loja: { ...base.loja, tipo: "REPASSE_FP" } }).texto).toContain("um repasse de franquia para loja própria");
    expect(saudacao(CFG.saudacoes, new Date("2030-10-01T17:00:00Z"))).toBe("Boa tarde"); // 14h em SP
  });
  it("escapa HTML/scripts vindos do formulário (XSS) e bloqueia links javascript:", () => {
    const e = gerarEmailNexaas({ ...base, loja: { ...base.loja, tipo: "FRANQUIA", nome: "LOJA <SCRIPT>ALERT(1)</SCRIPT>" },
      dados: { ...DADOS_COMPLETOS, resp_nome: '"><img src=x onerror=alert(1)>', contrato_link: "javascript:alert(1)", financeiro: "=HYPERLINK(\"http://mal\")" },
      segredos: SEG_COMPLETOS });
    expect(e.html).not.toMatch(/<script/i); expect(e.html).not.toMatch(/<img/i);
    expect(e.html).not.toContain('href="javascript'); expect(e.html).toContain("&lt;SCRIPT&gt;");
    expect(e.assunto).toBe("Implantação Nexaas - LOJA <SCRIPT>ALERT(1)</SCRIPT>"); // assunto é texto puro, não HTML
  });
  it("campos vazios aparecem como PENDENTE", () => {
    const e = gerarEmailNexaas({ ...base, testemunhaCpf: null, loja: { ...base.loja, data_inauguracao: null } });
    expect(e.faltando).toEqual(["CPF da Testemunha", "Data de inauguração"]);
  });
});
