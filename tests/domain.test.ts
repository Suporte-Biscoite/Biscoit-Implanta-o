import { describe, expect, it } from "vitest";
import { alertasDaLoja, CHECKLIST, statusGeral } from "@/lib/domain";

const etapas = (keys: string[], done: string[] = []) => keys.map((k) => ({ etapa: k, status: done.includes(k) ? "CONCLUIDO" as const : "PENDENTE" as const, data: null, observacao: null, responsavel: null }));
describe("checklist e alertas", () => {
  it("franquia tem 11 etapas e própria 6", () => { expect(CHECKLIST.FRANQUIA).toHaveLength(11); expect(CHECKLIST.PROPRIA).toHaveLength(6); });
  it("loja sem CNPJ fica bloqueada (critério 4)", () => {
    const l = { tipo: "FRANQUIA" as const, sem_cnpj: true, cnpj: null, data_inauguracao: "2030-01-01", form_sincronizado_em: null };
    expect(statusGeral(l, [], "FRANQUIA")).toBe("Aguardando CNPJ");
    expect(alertasDaLoja(l, [], 0)[0]).toEqual({ nivel: "bloqueio", texto: "Aguardando CNPJ — nenhuma etapa avança" });
  });
  it("alertas de formulário, assinatura e pós-inauguração", () => {
    const keys = CHECKLIST.FRANQUIA.map((e) => e.key);
    const hoje = new Date("2030-01-20T15:00:00Z");
    const l = { tipo: "FRANQUIA" as const, sem_cnpj: false, cnpj: "x", data_inauguracao: "2030-01-15", form_sincronizado_em: null };
    const a = alertasDaLoja(l, etapas(keys, ["email_nexaas", "onboarding"]), 0, hoje).map((x) => x.texto);
    expect(a).toContain("Formulário do franqueado pendente");
    expect(a).toContain("Aguardando assinatura do contrato");
    expect(a).toContain("Pós-inauguração: dia 6 de 14 de acompanhamento");
    const depois = alertasDaLoja(l, etapas(keys), 0, new Date("2030-02-05T15:00:00Z")).map((x) => x.texto);
    expect(depois).toContain("2 semanas pós-inauguração: encaminhar ao suporte de TI e encerrar");
  });
});

describe("alerta de pendências sem ruído", () => {
  it("franquia sem formulário importado não mostra contagem de pendências", () => {
    const l = { tipo: "FRANQUIA" as const, sem_cnpj: false, cnpj: "x", data_inauguracao: "2030-01-15", form_sincronizado_em: null };
    expect(alertasDaLoja(l, [], 9).some((a) => a.texto.includes("pendência"))).toBe(false);
    expect(alertasDaLoja({ ...l, form_sincronizado_em: "2030-01-01" }, [], 9).some((a) => a.texto.includes("9 pendência"))).toBe(true);
  });
});
