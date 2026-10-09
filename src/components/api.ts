"use client";
// Chamadas à API com o token CSRF da sessão (lido da meta tag do layout).
export function csrf(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
}
export class ApiError extends Error { constructor(public status: number, msg: string, public detalhes?: { campo: string; msg: string }[]) { super(msg); } }
export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method, credentials: "same-origin",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { "x-csrf-token": csrf() } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { window.location.href = "/login"; throw new ApiError(401, "Sessão expirada"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.erro ?? "Erro", data.detalhes);
  return data as T;
}
export async function copiarTexto(t: string) { await navigator.clipboard.writeText(t); }
/** Copia HTML formatado (para colar no Gmail mantendo a tabela) + texto puro de reserva. */
export async function copiarHtml(html: string, texto: string) {
  if (typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([texto], { type: "text/plain" }),
    })]);
  } else await navigator.clipboard.writeText(texto);
}
