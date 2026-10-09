import "./globals.css";
import { headers } from "next/headers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Implantação de Lojas · Biscoitê",
  robots: { index: false, follow: false, nocache: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // força renderização dinâmica (necessário para o nonce da CSP)
  return (<html lang="pt-BR"><body>{children}</body></html>);
}
