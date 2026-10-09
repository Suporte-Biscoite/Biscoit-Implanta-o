import { describe, expect, it } from "vitest";
import { LISTAS, casarComLista } from "@/lib/listas-nexaas";
import { sugerirNomeExibicao } from "@/lib/domain";

describe("respostas contábeis → valor exato da lista do Nexaas", () => {
  it("aceita valor exato, só o código ou o texto", () => {
    expect(casarComLista("2062 - Sociedade Empresária Limitada", LISTAS.natureza)).toBe("2062 - Sociedade Empresária Limitada");
    expect(casarComLista("2062", LISTAS.natureza)).toBe("2062 - Sociedade Empresária Limitada");
    expect(casarComLista("10 - Atividade de comércio", LISTAS.indicador)).toBe("10- ATIVIDADE DE COMÉRCIO");
    expect(casarComLista("regime de competencia", LISTAS.receita)).toBe("2 - REGIME DE COMPETÊNCIA");
    expect(casarComLista("C", LISTAS.escrituracao)).toBe("C - SIMPLES NACIONAL");
    expect(casarComLista("Anual com estimativas mensais", LISTAS.periodo)).toBe("2 - ANUAL COM ESTIMATIVAS MENSAIS");
  });
  it("na dúvida, não chuta", () => {
    expect(casarComLista("não sei", LISTAS.natureza)).toBeNull();
    expect(casarComLista("Sociedade", LISTAS.natureza)).toBeNull(); // ambíguo
    expect(casarComLista("", LISTAS.receita)).toBeNull();
  });
});

describe("nome de exibição", () => {
  it("sugere a partir do nome em maiúsculo", () => {
    expect(sugerirNomeExibicao("BISCOITE UNIAO OSASCO")).toBe("Uniao Osasco");
    expect(sugerirNomeExibicao("BISCOITE SHOPPING DA PRAIA")).toBe("Shopping da Praia");
  });
});
