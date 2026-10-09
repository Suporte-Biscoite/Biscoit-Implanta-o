import { describe, expect, it } from "vitest";
import { claimsPermitidas } from "@/lib/oidc";

describe("login Google: regras do servidor (seção A)", () => {
  it("aceita só e-mail verificado do Workspace da empresa", () => {
    expect(claimsPermitidas({ email: "Ti@Exemplo.com.br", email_verified: true, hd: "exemplo.com.br" })).toEqual({ ok: true, email: "ti@exemplo.com.br" });
    expect(claimsPermitidas({ email: "x@gmail.com", email_verified: true }).ok).toBe(false);
    expect(claimsPermitidas({ email: "x@exemplo.com.br", email_verified: false, hd: "exemplo.com.br" }).ok).toBe(false);
    expect(claimsPermitidas({ email: "x@outro.com", email_verified: true, hd: "exemplo.com.br" }).ok).toBe(false);
    expect(claimsPermitidas({ email: "x@exemplo.com.br.mal.com", email_verified: true, hd: "exemplo.com.br" }).ok).toBe(false);
  });
});

import { clientIp } from "@/lib/auth";
describe("IP do cliente atrás do proxy", () => {
  it("ignora valores forjados no início do X-Forwarded-For", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
  });
});
