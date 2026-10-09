// Teste de segurança de ponta a ponta (seção D). Roda contra o app em modo PRODUÇÃO.
// Uso: BASE_URL=http://localhost:3000 TEST_DB_URL=<url do dono, banco de TESTE> TEST_APP_DB_URL=<url do usuário da app> node scripts/security-test.mjs
// NUNCA rodar contra o banco de produção: cria usuários e lojas FICTÍCIOS.
import crypto from "node:crypto";
import JSZip from "jszip";
import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new pg.Client({ connectionString: process.env.TEST_DB_URL });
await db.connect();
const { rows: [{ current_database: nomeDb }] } = await db.query("select current_database()");
if (/prod/i.test(nomeDb)) { console.error("Recusado: parece banco de produção"); process.exit(2); }

const resultados = [];
const check = (nome, ok, info = "") => { resultados.push({ nome, ok, info }); console.log(`${ok ? "PASSOU" : "FALHOU"}  ${nome}${info ? `  (${info})` : ""}`); };
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
const COOKIE = "__Host-sid";

async function sessao(email, role, { ativo = true, idleMin = 0 } = {}) {
  await db.query("INSERT INTO users(email, role, ativo, criado_por) VALUES ($1,$2,$3,'teste') ON CONFLICT (email) DO UPDATE SET role=$2, ativo=$3", [email, role, ativo]);
  const token = crypto.randomBytes(32).toString("base64url"), csrf = crypto.randomBytes(24).toString("base64url");
  await db.query(`INSERT INTO sessions(token_hash, user_email, csrf_token, expira_em, visto_em) VALUES ($1,$2,$3, now()+interval '8 hours', now() - ($4 || ' minutes')::interval)`, [sha(token), email, csrf, String(idleMin)]);
  return { token, csrf };
}
const req = (path, { s, method = "GET", body, headers = {}, origin = BASE, csrf } = {}) =>
  fetch(BASE + path, {
    method, redirect: "manual",
    headers: {
      ...(s ? { cookie: `${COOKIE}=${s.token}` } : {}),
      ...(method !== "GET" ? { origin, "x-csrf-token": csrf ?? s?.csrf ?? "" } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

const D = "exemplo.com.br";
const admin = await sessao(`sec-admin@${D}`, "ADMIN");
const oper = await sessao(`sec-operador@${D}`, "OPERADOR");
const leitor = await sessao(`sec-leitor@${D}`, "LEITOR");
const inativo = await sessao(`sec-inativo@${D}`, "ADMIN", { ativo: false });
const ociosa = await sessao(`sec-ocioso@${D}`, "ADMIN", { idleMin: 45 });

// CNPJ/CPF fictícios gerados pelo algoritmo
function cnpj(b) { const d = b.split("").map(Number); const c = (w) => { const r = w.reduce((a, x, i) => a + x * d[i], 0) % 11; return r < 2 ? 0 : 11 - r; }; d.push(c([5,4,3,2,9,8,7,6,5,4,3,2])); d.push(c([6,5,4,3,2,9,8,7,6,5,4,3,2])); return d.join(""); }
await db.query("UPDATE stores SET excluido_em=now() WHERE criado_por LIKE 'sec-%' AND excluido_em IS NULL");
const CNPJ = cnpj(String(Date.now()).slice(-8) + "0001");
const UUID0 = "00000000-0000-0000-0000-000000000000";

// ---------- 1. Sem login: tudo bloqueado ----------
const rotas = [
  ["GET", "/"], ["GET", "/lojas/nova"], ["GET", `/lojas/${UUID0}`], ["GET", "/config"], ["GET", "/usuarios"], ["GET", "/auditoria"],
  ["GET", "/api/lojas"], ["POST", "/api/lojas"], ["GET", `/api/lojas/${UUID0}`], ["PATCH", `/api/lojas/${UUID0}`], ["DELETE", `/api/lojas/${UUID0}`],
  ["PATCH", `/api/lojas/${UUID0}/etapas`], ["POST", `/api/lojas/${UUID0}/notas`], ["POST", `/api/lojas/${UUID0}/revelar`],
  ["GET", `/api/lojas/${UUID0}/email`], ["GET", `/api/lojas/${UUID0}/onboarding`], ["POST", `/api/lojas/${UUID0}/formulario`],
  ["GET", `/api/lojas/${UUID0}/mensagens`], ["GET", "/api/pipeline?nome=teste"], ["GET", "/api/config"], ["PUT", "/api/config"],
  ["PUT", "/api/config/segredo"], ["GET", "/api/usuarios"], ["POST", "/api/usuarios"], ["PATCH", "/api/usuarios"], ["POST", "/api/exportar"], ["POST", "/api/auth/logout"],
];
let falhas = [];
for (const [m, p] of rotas) {
  const r = await req(p, { method: m, body: m === "GET" ? undefined : {} });
  const ok = p.startsWith("/api/") ? r.status === 401 : r.status === 307 && (r.headers.get("location") ?? "").endsWith("/login");
  if (!ok) falhas.push(`${m} ${p} → ${r.status}`);
}
check(`Sem login: ${rotas.length} rotas/APIs bloqueadas (401 ou redirecionamento p/ login)`, !falhas.length, falhas.join("; "));

let r = await req("/api/lojas", { s: { token: crypto.randomBytes(32).toString("base64url"), csrf: "x" } });
check("Cookie de sessão forjado → 401", r.status === 401);
r = await req("/api/lojas", { s: inativo });
check("Usuário bloqueado (fora da allowlist ativa) → 401", r.status === 401);
r = await req("/api/lojas", { s: ociosa });
check("Sessão ociosa há 45 min → 401 (expira por inatividade)", r.status === 401);
r = await req(`/api/auth/dev-login?email=sec-admin@${D}`);
check("Login de desenvolvimento NÃO existe em produção → 404", r.status === 404);

// ---------- 2. Perfis ----------
r = await req("/api/lojas", { s: leitor });
check("Leitor consegue ver o painel (GET /api/lojas → 200)", r.status === 200);
r = await req("/api/lojas", { s: leitor, method: "POST", body: { tipo: "PROPRIA" } });
check("Leitor NÃO cadastra loja → 403", r.status === 403);
falhas = [];
for (const [m, p] of [["GET", "/api/config"], ["PUT", "/api/config"], ["PUT", "/api/config/segredo"], ["GET", "/api/usuarios"], ["POST", "/api/usuarios"], ["POST", "/api/exportar"], ["DELETE", `/api/lojas/${UUID0}`]]) {
  const x = await req(p, { s: oper, method: m, body: m === "GET" ? undefined : {} });
  if (x.status !== 403) falhas.push(`${m} ${p} → ${x.status}`);
}
check("Operador NÃO acessa funções de administrador (7 APIs → 403)", !falhas.length, falhas.join("; "));
r = await req("/config", { s: oper });
check("Operador NÃO abre a página de Configurações (redireciona)", r.status === 307 && (r.headers.get("location") ?? "").includes("negado=1"));

// ---------- 3. CSRF ----------
const novaLoja = { tipo: "FRANQUIA", nome: "BISCOITE SEGURANCA", uf: "SP", cnpj: CNPJ, email_loja: "seg@biscoite.com", data_inauguracao: "2030-10-25" };
r = await req("/api/lojas", { s: oper, method: "POST", body: novaLoja, csrf: "token-errado" });
check("POST sem token CSRF válido → 403", r.status === 403);
r = await req("/api/lojas", { s: oper, method: "POST", body: novaLoja, origin: "https://site-malicioso.exemplo" });
check("POST vindo de outra origem (Origin) → 403", r.status === 403);

// ---------- 4. Entradas maliciosas ----------
r = await req("/api/lojas", { s: oper, method: "POST", body: { ...novaLoja, cnpj: "11.111.111/1111-11" } });
check("CNPJ inválido rejeitado → 400", r.status === 400);
r = await req("/api/lojas", { s: oper, method: "POST", body: { ...novaLoja, cnpj: "", sem_cnpj: false } });
check("Sem CNPJ e sem marcar 'ainda não tem' → 400", r.status === 400);
r = await req("/api/lojas", { s: oper, method: "POST", body: {
  ...novaLoja, nome: "LOJA <script>alert(1)</script> '); DROP TABLE stores;--",
  observacoes: "<img src=x onerror=alert(1)>",
  dados: { razao_social: '=HYPERLINK("http://mal.exemplo","clique")', bairro: "+cmd|' /C calc'!A0", logradouro: "@SUM(A1)", numero: "1", cidade: "-1+1", resp_nome: '"><svg onload=alert(1)>' },
} });
const criada = await r.json();
check("Loja com conteúdo malicioso é aceita como TEXTO (201)", r.status === 201, criada.erro ?? "");
const id = criada.id;
const { rows: [{ n }] } = await db.query("SELECT count(*)::int AS n FROM stores");
check("Tentativa de SQL injection não afetou o banco (tabela stores existe)", n > 0);
r = await req("/api/lojas?tipo=" + encodeURIComponent("' OR 1=1--"), { s: oper });
check("Filtro com SQL injection → 400", r.status === 400);
r = await req("/api/lojas/" + encodeURIComponent("1' OR '1'='1"), { s: oper });
check("ID com SQL injection → 404", r.status === 404);

r = await req(`/api/lojas/${id}/email`, { s: oper });
const email = await r.json();
check("E-mail gerado sem <script>/<img>/<svg> executáveis (HTML escapado)", r.status === 200 && !/<script|<img|<svg/i.test(email.html) && /&lt;script&gt;/i.test(email.html) && email.html.includes("&lt;svg"));
r = await req(`/api/lojas/${id}/onboarding`, { s: oper });
const zip = await JSZip.loadAsync(Buffer.from(await r.arrayBuffer()));
const row2 = (await zip.file("xl/worksheets/sheet1.xml").async("string")).match(/<row r="2"[^>]*>([\s\S]*?)<\/row>/)[1];
check(".xlsx sem fórmulas: valores =, +, -, @ gravados como texto", r.status === 200 && !row2.includes("<f>") && row2.includes("=HYPERLINK") && /t="inlineStr"/.test(row2));
check(".xlsx baixado só autenticado e sem cache", r.headers.get("cache-control")?.includes("no-store") === true);

// ---------- 5. Regra: sem CNPJ nada avança ----------
r = await req("/api/lojas", { s: oper, method: "POST", body: { ...novaLoja, nome: "BISCOITE SEM CNPJ", cnpj: "", sem_cnpj: true, email_loja: undefined } });
const semId = (await r.json()).id;
r = await req(`/api/lojas/${semId}/etapas`, { s: oper, method: "PATCH", body: { etapa: "email_hostinger", status: "CONCLUIDO" } });
check("Loja sem CNPJ: etapa não avança → 409", r.status === 409);
r = await req(`/api/lojas/${semId}/email`, { s: oper });
check("Loja sem CNPJ: e-mail do Nexaas bloqueado → 409", r.status === 409);
r = await req(`/api/lojas/${semId}/onboarding`, { s: oper });
check("Loja sem CNPJ: onboarding bloqueado → 409", r.status === 409);

// ---------- 6. Dados sensíveis ----------
await req(`/api/lojas/${id}`, { s: oper, method: "PATCH", body: { segredos: { resp_cpf: "52998224725", csc_prod_token: "TOKEN-FICTICIO-0000-1111" } } });
const { rows: [raw] } = await db.query("SELECT segredos::text AS s FROM stores WHERE id=$1", [id]);
check("CPF e token gravados CIFRADOS no banco (não aparecem em texto)", !raw.s.includes("52998224725") && !raw.s.includes("TOKEN-FICTICIO"));
r = await req(`/api/lojas/${id}`, { s: leitor });
const det = await r.text();
check("Leitura da loja devolve só a máscara (sem CPF/token completos)", !det.includes("52998224725") && !det.includes("TOKEN-FICTICIO") && det.includes("***.982.247-**"));
r = await req(`/api/lojas/${id}/revelar`, { s: leitor, method: "POST", body: { campo: "resp_cpf" } });
check("Leitor NÃO pode revelar campo sensível → 403", r.status === 403);
r = await req(`/api/lojas/${id}/revelar`, { s: oper, method: "POST", body: { campo: "resp_cpf" } });
const { rows: rev } = await db.query("SELECT detalhe FROM audit_log WHERE acao='CAMPO_REVELADO' AND alvo=$1 ORDER BY id DESC LIMIT 1", [id]);
check("Revelar CPF funciona e fica na auditoria (só o nome do campo)", r.status === 200 && rev[0]?.detalhe?.campo === "resp_cpf" && !JSON.stringify(rev[0]).includes("52998224725"));

// ---------- 7. Cabeçalhos ----------
r = await req("/", { s: oper });
const h = r.headers, csp = h.get("content-security-policy") ?? "";
const exig = {
  "CSP com nonce e frame-ancestors 'none'": /nonce-/.test(csp) && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'") && !/script-src[^;]*unsafe-inline/.test(csp),
  "X-Frame-Options: DENY": h.get("x-frame-options") === "DENY",
  "X-Content-Type-Options: nosniff": h.get("x-content-type-options") === "nosniff",
  "Referrer-Policy: no-referrer": h.get("referrer-policy") === "no-referrer",
  "HSTS": (h.get("strict-transport-security") ?? "").includes("max-age=63072000"),
  "X-Robots-Tag noindex": (h.get("x-robots-tag") ?? "").includes("noindex"),
  "Sem X-Powered-By": !h.get("x-powered-by"),
  "Cache-Control no-store": (h.get("cache-control") ?? "").includes("no-store"),
};
for (const [k, v] of Object.entries(exig)) check(`Cabeçalho: ${k}`, v);
r = await fetch(BASE + "/robots.txt");
check("robots.txt bloqueia indexação", (await r.text()).includes("Disallow: /"));

// ---------- 8. Limite de requisições ----------
let s429 = false;
for (let i = 0; i < 65 && !s429; i++) s429 = (await req(`/api/lojas/${id}/revelar`, { s: admin, method: "POST", body: { campo: "csc_prod_token" } })).status === 429;
check("Limite de requisições em rota sensível (revelar: 60 / 5 min) → 429", s429);

// ---------- 9. Auditoria imutável ----------
const app = new pg.Client({ connectionString: process.env.TEST_APP_DB_URL }); await app.connect();
let bloq = 0;
for (const sql of ["UPDATE audit_log SET acao='X'", "DELETE FROM audit_log", "TRUNCATE audit_log"]) { try { await app.query(sql); } catch { bloq++; } }
try { await db.query("UPDATE audit_log SET acao='X' WHERE id=(SELECT min(id) FROM audit_log)"); } catch { bloq++; }
check("Auditoria imutável: UPDATE/DELETE/TRUNCATE recusados (inclusive para o dono)", bloq === 4, `${bloq}/4 bloqueados`);
try { await app.query("DELETE FROM stores WHERE false"); check("Usuário da aplicação não tem DELETE em stores (exclusão só lógica)", false); }
catch { check("Usuário da aplicação não tem DELETE em stores (exclusão só lógica)", true); }
await app.end();

// ---------- 10. Logout ----------
r = await req("/api/auth/logout", { s: oper, method: "POST" });
const depois = await req("/api/lojas", { s: oper });
check("Logout invalida a sessão no servidor (mesmo cookie → 401)", r.status === 200 && depois.status === 401);

await db.end();
const ok = resultados.filter((x) => x.ok).length;
console.log(`\nRESUMO: ${ok}/${resultados.length} verificações de segurança passaram.`);
process.exit(ok === resultados.length ? 0 : 1);
