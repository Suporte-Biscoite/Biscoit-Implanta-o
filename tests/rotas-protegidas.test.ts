// Garante "nega por padrão" no código: toda rota de API (exceto as 3 de login) usa withApi,
// e todo arquivo de página dentro de (app) está sob o layout que chama requireUser.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? arquivos(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const PUBLICAS = ["auth/login/route.ts", "auth/callback/route.ts", "auth/dev-login/route.ts"];

describe("nega por padrão (seção A)", () => {
  it("toda rota de API exporta handlers envolvidos por withApi", () => {
    const rotas = arquivos("src/app/api").filter((f) => f.endsWith("route.ts"));
    expect(rotas.length).toBeGreaterThan(10);
    for (const r of rotas) {
      if (PUBLICAS.some((p) => r.replaceAll("\\", "/").endsWith(p))) continue;
      const src = fs.readFileSync(r, "utf8");
      const handlers = [...src.matchAll(/export (?:const|async function) (GET|POST|PUT|PATCH|DELETE)\b(.*)/g)];
      expect(handlers.length, r).toBeGreaterThan(0);
      for (const h of handlers) expect(h[2], `${r} ${h[1]}`).toMatch(/=\s*withApi/);
    }
  });
  it("as páginas internas ficam sob o layout autenticado e chamam requireUser", () => {
    expect(fs.readFileSync("src/app/(app)/layout.tsx", "utf8")).toContain('requireUser("LEITOR")');
    for (const p of arquivos("src/app/(app)").filter((f) => f.endsWith("page.tsx")))
      expect(fs.readFileSync(p, "utf8"), p).toContain("requireUser(");
    const fora = arquivos("src/app").filter((f) => f.endsWith("page.tsx") && !f.includes("(app)"));
    expect(fora.map((f) => f.replaceAll("\\", "/"))).toEqual(["src/app/login/page.tsx"]);
  });
});
