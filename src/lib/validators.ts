// Validações de documentos e campos. Funções puras, sem dependências.

export const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** CNPJ: 14 dígitos + dígitos verificadores. Rejeita sequências repetidas. */
export function isValidCNPJ(value: unknown): boolean {
  const c = onlyDigits(value);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((acc, wi, i) => acc + wi * Number(c[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

/** CPF: 11 dígitos + dígitos verificadores. */
export function isValidCPF(value: unknown): boolean {
  const c = onlyDigits(value);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export const isValidCEP = (v: unknown) => /^\d{8}$/.test(onlyDigits(v)) && !/^0{8}$/.test(onlyDigits(v));

export const isValidEmail = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(s);
};

/**
 * Inscrição Estadual. Validação completa de dígito verificador para SP (o caso principal);
 * para as demais UFs valida formato (número de dígitos plausível) ou "ISENTO".
 * Ver docs/SUPOSICOES.md — validação por UF completa fica para a Fase 2.
 */
export function isValidIE(value: unknown, uf: string): boolean {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "ISENTO") return true;
  const d = onlyDigits(raw);
  if (uf === "SP") {
    if (d.length !== 12) return false;
    const w1 = [1, 3, 4, 5, 6, 7, 8, 10];
    const d9 = w1.reduce((a, w, i) => a + w * Number(d[i]), 0) % 11 % 10;
    if (d9 !== Number(d[8])) return false;
    const w2 = [3, 2, 10, 9, 8, 7, 6, 5, 4, 3, 2];
    const d12 = w2.reduce((a, w, i) => a + w * Number(d[i]), 0) % 11 % 10;
    return d12 === Number(d[11]);
  }
  return d.length >= 8 && d.length <= 14 && !/^(\d)\1+$/.test(d);
}

/** Aceita apenas links https do Google Drive/Docs (documentos são compartilhados assim). */
export function isDriveLink(v: unknown): boolean {
  try {
    const u = new URL(String(v ?? "").trim());
    return u.protocol === "https:" && ["drive.google.com", "docs.google.com"].includes(u.hostname);
  } catch {
    return false;
  }
}

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;
export const isUF = (v: unknown) => (UFS as readonly string[]).includes(String(v ?? "").toUpperCase());

/** Valores exatos da lista "Regime tributário" da planilha do Nexaas (aba Planilha3). */
export const REGIMES = ["1 - SIMPLES", "2 - SIMPLES - SUBLIMITE", "3 - PRESUMIDO", "4 - REAL", "5 - ARBITRADO"] as const;

/** Converte o texto livre do formulário ("Simples Nacional", "lucro presumido"...) no valor da lista. */
export function normalizeRegime(v: unknown): (typeof REGIMES)[number] | null {
  const s = String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (!s.trim()) return null;
  const exact = REGIMES.find((r) => r === s.trim());
  if (exact) return exact;
  if (s.includes("SUBLIMITE")) return "2 - SIMPLES - SUBLIMITE";
  if (s.includes("SIMPLES") || s.includes("MEI")) return "1 - SIMPLES";
  if (s.includes("PRESUMIDO")) return "3 - PRESUMIDO";
  if (s.includes("REAL")) return "4 - REAL";
  if (s.includes("ARBITRADO")) return "5 - ARBITRADO";
  return null;
}

export const formatCNPJ = (v: unknown) =>
  onlyDigits(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
export const formatCPF = (v: unknown) => onlyDigits(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
export const formatCEP = (v: unknown) => onlyDigits(v).replace(/^(\d{5})(\d{3})$/, "$1-$2");

/** Limite de tamanho e remoção de caracteres de controle de qualquer texto vindo de fora. */
export function cleanText(v: unknown, max = 500): string {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}
