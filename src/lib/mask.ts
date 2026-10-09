// Mascaramento para exibição. O valor completo só aparece com "revelar" (que é auditado).
import { onlyDigits } from "./validators";
export function maskCPF(v: string) {
  const d = onlyDigits(v);
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "***";
}
export function maskToken(v: string) {
  return v.length <= 4 ? "****" : `****${v.slice(-4)}`;
}
export function maskPhone(v: string) {
  const d = onlyDigits(v);
  return d.length >= 4 ? `(**) *****-${d.slice(-4)}` : "****";
}
export const maskLink = (v: string) => (v ? "🔒 link oculto" : "");
