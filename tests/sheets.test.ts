import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { acharResposta, buscarNoPipeline, colIndex, parseDataBR, separarCabecalho } from "@/lib/sheets";
import { lerXlsx, decodeXml } from "@/lib/xlsx-read";
import { DEFAULT_MAPEAMENTO, DEFAULTS } from "@/lib/config";
import { CNPJ_FICTICIO, CPF_FICTICIO } from "./fixtures";

describe("leitor de .xlsx (o pipeline é um .xlsx no Drive)", () => {
  it("lê abas, textos compartilhados/ricos, entidades e datas do Excel", async () => {
    const abas = await lerXlsx(fs.readFileSync("tests/fixtures/pipeline-ficticio.xlsx"));
    expect(abas.map((a) => a.nome)).toEqual(["BASE REDE F", "OUTRA ABA"]);
    const l = abas[0].linhas;
    expect(l[2][1]).toBe("LOJA"); expect(l[2][25]).toBe("ES");
    expect(l[3][6]).toBe("25/10/2030");             // célula de data → dd/mm/aaaa
    expect(l[4][4]).toBe("03/11/2030");
    expect(l[3][2]).toBe('Rica & <Teste> "aspas"'); // entidades XML decodificadas
    expect(decodeXml("&#xE7;&#227;o")).toBe("ção");
  });
  it("lê só a aba pedida", async () => {
    const abas = await lerXlsx(fs.readFileSync("tests/fixtures/pipeline-ficticio.xlsx"), "OUTRA ABA");
    expect(abas).toHaveLength(1); expect(abas[0].linhas[0][0]).toBe("x");
  });
  it("lê o modelo de onboarding (36 cabeçalhos)", async () => {
    const [aba] = await lerXlsx(fs.readFileSync("templates/onboarding-template.xlsx"), "Dados Cadastrais");
    expect(aba.linhas[0].filter(Boolean)).toHaveLength(36);
  });
});

describe("pipeline com a estrutura real (cabeçalho na linha 3)", () => {
  it("acha o cabeçalho, busca por CNPJ e por nome, e usa a previsão quando a inauguração está vazia", async () => {
    const [aba] = await lerXlsx(fs.readFileSync("tests/fixtures/pipeline-ficticio.xlsx"));
    const cols = DEFAULTS.pipeline_colunas;
    expect(separarCabecalho(aba.linhas, cols.nome).linhaHdr).toBe(3);
    expect(buscarNoPipeline(aba.linhas, cols, { cnpj: CNPJ_FICTICIO })[0]).toMatchObject({ por: "cnpj", linha: 4, data_inauguracao: "2030-10-25", uf: "SP", tipo: "PRÓPRIA" });
    expect(buscarNoPipeline(aba.linhas, cols, { nome: "BISCOITE UNIAO EXEMPLO" })[0]).toMatchObject({ por: "nome", linha: 5, data_inauguracao: "2030-11-03", uf: "PR" });
    expect(buscarNoPipeline(aba.linhas, cols, { nome: "BISCOITE PRACA TEXTO" })[0].data_inauguracao).toBe("2030-12-15");
  });
  it("coluna por letra e datas", () => {
    expect(colIndex(["a", "UF"], "UF")).toBe(1); expect(colIndex([], "Coluna H")).toBe(7); expect(colIndex([], "Coluna AA")).toBe(26);
    expect(parseDataBR("25/10/2030")).toBe("2030-10-25"); expect(parseDataBR("01/01/18")).toBe("2018-01-01"); expect(parseDataBR("-")).toBeNull();
  });
});

describe("planilha de respostas (cabeçalhos reais)", () => {
  const hdrReais = ["Carimbo de data/hora", "Endereço de e-mail", "Nome Fantasia", "CNPJ", "Razão Social", "Contrato Social", "I.E.", "Regime tributário ",
    "Logradouro", "Número", "Complemento", "Bairro", "CEP", "Cidade", "UF", "Nome", "CPF", "RG/CNH", "E-mail", "Telefone", "Contato Financeiro",
    "Ponto Focal", "Certificado Digital", "Senha", "UF SP", "ID CSC Prod.", "CSC Produção", "ID CSC Homol.", "CSC Homologação", "Natureza Jurídica",
    "Indicador de Atividade", "Período", "Receita", "Escrituração", "E-mail Loja/Quisoque", "Operação", "Contabilidade"];
  const linha = (cpf: string, extra: Record<string, string> = {}) => hdrReais.map((h) => ({
    "CNPJ": CNPJ_FICTICIO, "CPF": cpf, "Razão Social": "LOJA FICTICIA LTDA", "Regime tributário ": "Simples Nacional", "Senha": "SENHA-FICTICIA-123",
    "Escrituração": "C - SIMPLES NACIONAL", "E-mail Loja/Quisoque": "loja@biscoite.com", "UF": "PR", ...extra }[h] ?? ""));

  it("todas as colunas do mapeamento padrão existem no formulário real", () => {
    for (const [campo, h] of Object.entries(DEFAULT_MAPEAMENTO)) expect(colIndex(hdrReais, h), campo).toBeGreaterThanOrEqual(0);
  });
  it("usa a resposta mais recente do CNPJ, separa sensíveis e lê respostas contábeis", () => {
    const r = acharResposta([hdrReais, linha("00000000000"), linha(CPF_FICTICIO)], DEFAULT_MAPEAMENTO, { cnpj: CNPJ_FICTICIO })!;
    expect(r.por).toBe("cnpj"); expect(r.segredos.resp_cpf).toBe(CPF_FICTICIO); expect(r.uf).toBe("PR");
    expect(r.dados.regime).toBe("Simples Nacional"); expect(r.dados.escrituracao).toBe("C - SIMPLES NACIONAL");
    expect(r.camposAusentes).toEqual([]);
  });
  it("acha por e-mail da loja quando o CNPJ não bate", () => {
    const r = acharResposta([hdrReais, linha(CPF_FICTICIO, { CNPJ: "" })], DEFAULT_MAPEAMENTO, { cnpj: "00000000000000", email_loja: "LOJA@biscoite.com" })!;
    expect(r.por).toBe("email");
  });
  it("NUNCA lê a coluna de senha, mesmo mapeada por engano", () => {
    const r = acharResposta([hdrReais, linha(CPF_FICTICIO)], { ...DEFAULT_MAPEAMENTO, certificado_link: "Senha" }, { cnpj: CNPJ_FICTICIO })!;
    expect(JSON.stringify(r)).not.toContain("SENHA-FICTICIA-123");
  });
});
