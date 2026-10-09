import { describe, expect, it } from "vitest";
import { acharResposta, buscarNoPipeline, colIndex, parseDataBR } from "@/lib/sheets";
import { DEFAULT_MAPEAMENTO } from "@/lib/config";
import { CNPJ_FICTICIO, CPF_FICTICIO } from "./fixtures";

describe("integração com planilhas (lógica, sem rede)", () => {
  it("coluna por letra e por cabeçalho", () => {
    expect(colIndex(["a", "UF"], "UF")).toBe(1); expect(colIndex([], "Coluna H")).toBe(7); expect(colIndex([], "Coluna AA")).toBe(26);
    expect(parseDataBR("25/10/2030")).toBe("2030-10-25"); expect(parseDataBR("a definir")).toBeNull();
  });
  it("pipeline: acha por CNPJ, depois por nome, lê data da coluna H", () => {
    const rows = [["Loja", "x", "CNPJ", "x", "x", "x", "UF", "Inauguração"],
      ["Biscoitê Shopping Exemplo", "", "", "", "", "", "SP", "25/10/2030"],
      ["Outra", "", CNPJ_FICTICIO, "", "", "", "RJ", "01/11/2030"]];
    const cols = { nome: "Loja", cnpj: "CNPJ", inauguracao: "Coluna H", tipo: "", uf: "UF" };
    expect(buscarNoPipeline(rows, cols, { cnpj: CNPJ_FICTICIO })[0]).toMatchObject({ por: "cnpj", data_inauguracao: "2030-11-01", uf: "RJ" });
    expect(buscarNoPipeline(rows, cols, { nome: "BISCOITE SHOPPING EXEMPLO" })[0]).toMatchObject({ por: "nome", data_inauguracao: "2030-10-25" });
  });
  it("respostas: usa a resposta mais recente do CNPJ e separa campos sensíveis", () => {
    const hdr = Object.values(DEFAULT_MAPEAMENTO);
    const linha = (cpf: string) => hdr.map((h) => (h === "CNPJ" ? CNPJ_FICTICIO : h === "CPF" ? cpf : h === "Razão Social" ? "LOJA FICTICIA LTDA" : ""));
    const r = acharResposta([hdr, linha("00000000000"), linha(CPF_FICTICIO)], DEFAULT_MAPEAMENTO, { cnpj: CNPJ_FICTICIO })!;
    expect(r.por).toBe("cnpj"); expect(r.segredos.resp_cpf).toBe(CPF_FICTICIO);
    expect(r.dados.razao_social).toBe("LOJA FICTICIA LTDA"); expect((r.dados as Record<string, unknown>).resp_cpf).toBeUndefined();
  });
});
