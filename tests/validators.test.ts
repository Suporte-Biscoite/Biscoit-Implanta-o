import { describe, expect, it } from "vitest";
import { isValidCNPJ, isValidCPF, isValidIE, isValidCEP, isDriveLink, normalizeRegime, isValidEmail } from "@/lib/validators";
import { CNPJ_FICTICIO, CPF_FICTICIO, IE_SP_FICTICIA } from "./fixtures";

describe("validadores (critério 4)", () => {
  it("aceita CNPJ válido e rejeita inválidos", () => {
    expect(isValidCNPJ(CNPJ_FICTICIO)).toBe(true);
    expect(isValidCNPJ(CNPJ_FICTICIO.slice(0, 13) + ((Number(CNPJ_FICTICIO[13]) + 1) % 10))).toBe(false);
    expect(isValidCNPJ("11111111111111")).toBe(false);
    expect(isValidCNPJ("123")).toBe(false);
  });
  it("aceita CPF válido e rejeita inválidos", () => {
    expect(isValidCPF(CPF_FICTICIO)).toBe(true);
    expect(isValidCPF(CPF_FICTICIO.slice(0, 10) + ((Number(CPF_FICTICIO[10]) + 1) % 10))).toBe(false);
    expect(isValidCPF("00000000000")).toBe(false);
  });
  it("I.E. de SP com dígitos verificadores", () => {
    expect(isValidIE(IE_SP_FICTICIA, "SP")).toBe(true);
    expect(isValidIE(IE_SP_FICTICIA.slice(0, 11) + ((Number(IE_SP_FICTICIA[11]) + 1) % 10), "SP")).toBe(false);
    expect(isValidIE("ISENTO", "RJ")).toBe(true);
  });
  it("CEP, e-mail, links do Drive e regime", () => {
    expect(isValidCEP("01000-000")).toBe(true); expect(isValidCEP("123")).toBe(false);
    expect(isValidEmail("a@b.com")).toBe(true); expect(isValidEmail("a@b")).toBe(false); expect(isValidEmail('x"<script>@a.com')).toBe(false);
    expect(isDriveLink("https://drive.google.com/x")).toBe(true);
    expect(isDriveLink("javascript:alert(1)")).toBe(false); expect(isDriveLink("http://drive.google.com/x")).toBe(false);
    expect(normalizeRegime("Simples Nacional")).toBe("1 - SIMPLES"); expect(normalizeRegime("lucro presumido")).toBe("3 - PRESUMIDO");
    expect(normalizeRegime("xyz")).toBeNull();
  });
});
