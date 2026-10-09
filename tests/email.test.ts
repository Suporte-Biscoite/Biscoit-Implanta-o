import { describe, expect, it } from "vitest";
import { gerarEmailNexaas, saudacao } from "@/lib/email";
import { CFG, CNPJ_FICTICIO, CPF_FICTICIO, CPF_TESTEMUNHA, DADOS_COMPLETOS, SEG_COMPLETOS } from "./fixtures";

// Rótulos copiados do e-mail real (print de 09/10/2026), inclusive os pontos finais.
const ROTULOS = ["Nome da Loja/Quiosque.", "Número do CNPJ", "Contrato Social / Cartão CNPJ", "Endereço da Loja", "Nome Completo do Responsável Legal.",
  "CPF do Responsável Legal.", "PDF do RG ou CNH do Responsável Legal.", "E-mail do Responsável Legal.", "Telefone do Responsável Legal.",
  "Dados para contato financeiro", "Dados para contato com o ponto focal", "CPF da Testemunha", "Nome da Testemunha", "Email da Testemunha",
  "Endereço da Testemunha", "Telefone da Testemunha"];

describe("e-mail do Nexaas (critério 1)", () => {
  const base = { loja: { tipo: "PROPRIA" as const, nome: "BISCOITE SHOPPING EXEMPLO", cnpj: CNPJ_FICTICIO, uf: "SP", data_inauguracao: "2030-10-25" },
    dados: { ...DADOS_COMPLETOS, nome_exibicao: "Shopping Exemplo São João" }, segredos: {}, cfg: CFG, propriaRespCpf: CPF_FICTICIO, testemunhaCpf: CPF_TESTEMUNHA, agora: new Date("2030-10-01T12:00:00Z") };

  it("loja própria: assunto, frases, 16 linhas na ordem, CC com o responsável", () => {
    const e = gerarEmailNexaas(base);
    expect(e.assunto).toBe("Implantação Nexaas - Shopping Exemplo São João");      // nome de exibição, com acento
    expect(e.html).toContain("Bom dia Andrei, tudo bem?");
    expect(e.html).toContain("Seguem os dados para a implantação da operação Biscoitê Shopping Exemplo São João.");
    expect(e.html).toContain("Trata-se de uma loja própria, com previsão de inauguração para o dia 25/10</p>"); // sem ponto final, como no real
    expect(e.html).toContain(">BISCOITE SHOPPING EXEMPLO<");                      // na tabela, o nome em maiúsculo
    expect(e.html).toContain("Avenida Exemplo, 1000 — Loja 1<br>Centro, São Paulo - SP<br>CEP: 01000-000"); // endereço em 3 linhas
    expect(e.html).toContain("background:#cfe2f3"); expect(e.html).toContain("border:1px solid #000000");
    const rot = [...e.html.matchAll(/<td style="[^"]*background:#cfe2f3[^"]*">([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(rot).toEqual(ROTULOS);
    expect(e.faltando).toEqual([]);
    expect(e.cc).toContain("responsavel@empresa.exemplo");
    expect(e.html).toContain("Fulano de Tal"); // responsável vem da configuração
  });
  it("contato financeiro com várias linhas vira <br> (e continua escapado)", () => {
    const cfg = { ...CFG, propria_padrao: { ...CFG.propria_padrao, financeiro: "A/C FULANO\nCargo: CONTROLADORIA\n\n<b>x</b>@empresa.exemplo" } };
    const e = gerarEmailNexaas({ ...base, cfg });
    expect(e.html).toContain("A/C FULANO<br>Cargo: CONTROLADORIA<br><br>&lt;b&gt;x&lt;/b&gt;@empresa.exemplo");
  });
  it("sem nome de exibição, usa a sugestão automática", () => {
    expect(gerarEmailNexaas({ ...base, dados: DADOS_COMPLETOS }).assunto).toBe("Implantação Nexaas - Shopping Exemplo");
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
    expect(e.assunto).toBe("Implantação Nexaas - Loja <script>alert(1)</script>"); // assunto é texto puro (o Gmail não interpreta HTML no assunto)
    expect(e.html).toContain("operação Biscoitê Loja &lt;script&gt;");
  });
  it("campos vazios aparecem como PENDENTE", () => {
    const e = gerarEmailNexaas({ ...base, testemunhaCpf: null, loja: { ...base.loja, data_inauguracao: null } });
    expect(e.faltando).toEqual(["CPF da Testemunha", "Data de inauguração"]);
  });
});
