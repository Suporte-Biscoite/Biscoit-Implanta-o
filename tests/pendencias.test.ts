import { describe, expect, it } from "vitest";
import { detectarPendencias, mensagemPendencias } from "@/lib/pendencias";
import { CNPJ_FICTICIO, DADOS_COMPLETOS, SEG_COMPLETOS, gerarCNPJ } from "./fixtures";

const loja = { tipo: "FRANQUIA" as const, uf: "SP", cnpj: CNPJ_FICTICIO, email_loja: "loja@biscoite.com", nome: "BISCOITE TESTE", data_inauguracao: "2030-01-10" };

describe("pendências (critério 3)", () => {
  it("formulário completo → zero pendências", () => {
    expect(detectarPendencias({ loja, dados: DADOS_COMPLETOS, segredos: SEG_COMPLETOS })).toEqual([]);
  });
  it("formulário incompleto → lista exatamente o que falta e gera a mensagem", () => {
    const dados = { ...DADOS_COMPLETOS, regime: "", contrato_link: "https://exemplo.com/arquivo", cep: "", certificado_recebido: false };
    const segredos = { ...SEG_COMPLETOS, resp_cpf: "11111111111", csc_hom_id: "", csc_hom_token: "" };
    const p = detectarPendencias({ loja, dados, segredos });
    expect(p.map((x) => `${x.campo}:${x.problema}`).sort()).toEqual([
      "cep:vazio", "certificado:vazio", "contrato_link:invalido", "csc_hom:vazio", "regime:vazio", "resp_cpf:invalido",
    ]);
    const msg = mensagemPendencias("BISCOITE TESTE", p);
    expect(msg).toContain("contabilidade"); expect(msg.split("\n").filter((l) => /^\d+\./.test(l))).toHaveLength(6);
    expect(msg).not.toContain("11111111111"); // nunca ecoa o valor informado
  });
  it("sinaliza divergência de CNPJ entre formulário e cadastro", () => {
    const p = detectarPendencias({ loja, dados: { ...DADOS_COMPLETOS, cnpj_formulario: gerarCNPJ("999999990001") }, segredos: SEG_COMPLETOS });
    expect(p.find((x) => x.campo === "cnpj_formulario")?.problema).toBe("divergente");
  });
  it("MG não exige CSC de homologação (token de produção serve para os dois)", () => {
    const p = detectarPendencias({ loja: { ...loja, uf: "MG" }, dados: { ...DADOS_COMPLETOS, ie: "0011223344" }, segredos: { ...SEG_COMPLETOS, csc_hom_id: "", csc_hom_token: "" } });
    expect(p.find((x) => x.campo === "csc_hom")).toBeUndefined();
  });
  it("loja própria fora de SP marca CSC como pendência interna", () => {
    const p = detectarPendencias({ loja: { ...loja, tipo: "PROPRIA", uf: "RJ" }, dados: { ...DADOS_COMPLETOS, ie: "12345678" }, segredos: { resp_doc_link: "https://drive.google.com/x" } });
    expect(p.find((x) => x.campo === "csc")?.interno).toBe(true);
  });
});

describe("pendências da loja própria usam os padrões da configuração", () => {
  it("razão social e RG/CNH da config não contam como pendência", () => {
    const own = { ...loja, tipo: "PROPRIA" as const };
    const dados = { ...DADOS_COMPLETOS, razao_social: "" };
    expect(detectarPendencias({ loja: own, dados, segredos: {} }).map((p) => p.campo).sort()).toEqual(["razao_social", "resp_doc_link"]);
    expect(detectarPendencias({ loja: own, dados, segredos: {}, padraoPropria: { razao_social: "EMPRESA X", resp_doc_link: "https://drive.google.com/x" } })).toEqual([]);
  });
});
