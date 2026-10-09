import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { gerarOnboardingXlsx, COLUNAS, nomeArquivoOnboarding } from "@/lib/onboarding";
import { CFG, CNPJ_FICTICIO, DADOS_COMPLETOS, SEG_COMPLETOS } from "./fixtures";

const cscSP = { prod_id: "000001", prod_token: "CCCCCCCC-0000-0000-0000-FICTICIO0003", hom_id: "000001", hom_token: "DDDDDDDD-0000-0000-0000-FICTICIO0004" };
async function abrir(buf: Buffer) {
  const z = await JSZip.loadAsync(buf);
  return { sheet: await z.file("xl/worksheets/sheet1.xml")!.async("string"), styles: await z.file("xl/styles.xml")!.async("string"), z };
}

describe("planilha de onboarding (critério 2)", () => {
  it("36 colunas, validações preservadas e campos fixos", async () => {
    const { buffer, linha, pendentes } = await gerarOnboardingXlsx({ loja: { tipo: "FRANQUIA", nome: "BISCOITE TESTE", cnpj: CNPJ_FICTICIO, uf: "SP", email_loja: "t@biscoite.com" }, dados: DADOS_COMPLETOS, segredos: SEG_COMPLETOS, cfg: CFG, cscSP: null });
    expect(COLUNAS).toHaveLength(36);
    const { sheet, z } = await abrir(buffer);
    expect((sheet.match(/<dataValidation /g) ?? []).length).toBe(9);
    expect(sheet.match(/<row r="2"[^>]*>([\s\S]*?)<\/row>/)![1].match(/<c r=/g)).toHaveLength(36);
    expect(z.file("xl/worksheets/sheet2.xml")).toBeTruthy(); // aba Planilha3 com as listas
    expect(linha["Natureza Jurídica"]).toBe("2062 - Sociedade Empresária Limitada");
    expect(linha["Indicador de Atividade"]).toBe("10- ATIVIDADE DE COMÉRCIO");
    expect(linha["Regime tributário"]).toBe("1 - SIMPLES");
    expect(linha["Escrituração"]).toBe("C - SIMPLES NACIONAL");
    expect(linha["Tipo de Organização"]).toBe("Franquia");
    expect(pendentes.sort()).toEqual(["Dias para expirar cupons", "ID Externo", "Vendedor Padrão"]);
  });
  it("loja própria em SP usa CSC fixo; fora de SP fica PENDENTE", async () => {
    const own = { tipo: "PROPRIA" as const, nome: "BISCOITE PROPRIA", cnpj: CNPJ_FICTICIO, email_loja: null };
    const sp = await gerarOnboardingXlsx({ loja: { ...own, uf: "SP" }, dados: DADOS_COMPLETOS, segredos: {}, cfg: CFG, cscSP });
    expect(sp.linha["CSC Token Produção"]).toBe(cscSP.prod_token);
    expect(sp.linha["Escrituração"]).toBe("A - DETALHADO"); // regime da config: presumido
    const rj = await gerarOnboardingXlsx({ loja: { ...own, uf: "RJ" }, dados: DADOS_COMPLETOS, segredos: {}, cfg: CFG, cscSP });
    expect(rj.pendentes).toContain("CSC Token Produção");
  });
  it("injeção de fórmula: valores perigosos viram texto puro, nunca <f>", async () => {
    const mal = { ...DADOS_COMPLETOS, razao_social: '=HYPERLINK("http://mal","x")', bairro: "+cmd|' /C calc'!A0", logradouro: "@SUM(1)", complemento: "-2+3", cidade: "\t=1+1" };
    const { buffer } = await gerarOnboardingXlsx({ loja: { tipo: "FRANQUIA", nome: "X<Y>&Z", cnpj: CNPJ_FICTICIO, uf: "SP", email_loja: null }, dados: mal, segredos: SEG_COMPLETOS, cfg: CFG, cscSP: null });
    const { sheet, styles } = await abrir(buffer);
    const row2 = sheet.match(/<row r="2"[^>]*>([\s\S]*?)<\/row>/)![1];
    expect(row2).not.toContain("<f>");
    expect(row2).toContain("&lt;Y&gt;&amp;Z");
    const a2 = row2.match(/<c r="A2" s="(\d+)" t="inlineStr">/)!;
    const xfs = [...styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)![1].matchAll(/<xf [^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => m[0]);
    expect(xfs[Number(a2[1])]).toContain('quotePrefix="1"');
    expect(xfs[Number(a2[1])]).toContain('numFmtId="49"');
  });
  it("nome do arquivo", () => expect(nomeArquivoOnboarding("BISCOITE A/B")).toBe("Onboarding - BISCOITE AB.xlsx"));
});
