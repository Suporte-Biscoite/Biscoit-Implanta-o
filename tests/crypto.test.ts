import { describe, expect, it } from "vitest";
import { encryptField, decryptField, _resetKeyring } from "@/lib/crypto";

describe("criptografia por campo (AES-256-GCM)", () => {
  it("cifra/decifra e cada cifragem é diferente (IV aleatório)", () => {
    const a = encryptField("segredo", "store:1:cpf"), b = encryptField("segredo", "store:1:cpf");
    expect(a).not.toBe(b); expect(a).not.toContain("segredo");
    expect(decryptField(a, "store:1:cpf")).toBe("segredo");
  });
  it("detecta adulteração e uso fora de contexto (AAD)", () => {
    const a = encryptField("segredo", "store:1:cpf");
    expect(() => decryptField(a, "store:2:cpf")).toThrow();
    const p = a.split(":"); p[3] = Buffer.from("x").toString("base64");
    expect(() => decryptField(p.join(":"), "store:1:cpf")).toThrow();
  });
  it("rotação: lê com chave antiga e cifra com a nova", () => {
    const old = encryptField("v", "c");
    process.env.FIELD_ENCRYPTION_KEYS += ";v2=" + Buffer.alloc(32, 7).toString("base64"); _resetKeyring();
    expect(decryptField(old, "c")).toBe("v"); expect(encryptField("v", "c").startsWith("v2:")).toBe(true);
  });
});
