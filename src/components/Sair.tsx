"use client";
import { api } from "./api";
export function Sair() {
  return <button className="sec" onClick={async () => { await api("/api/auth/logout", "POST").catch(() => {}); window.location.href = "/login"; }}>Sair</button>;
}
