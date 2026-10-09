// Popula o ambiente de DESENVOLVIMENTO com dados 100% FICTÍCIOS, usando a própria API.
// Uso: BASE_URL=http://localhost:3000 DATABASE_URL=<url do dono, banco de dev> node scripts/seed-demo.mjs
import crypto from "node:crypto";
import pg from "pg";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
const { rows: [{ current_database: nome }] } = await db.query("select current_database()");
if (/prod/i.test(nome) || process.env.ALLOW_SEED !== "sim") { console.error("Defina ALLOW_SEED=sim e use um banco de desenvolvimento."); process.exit(2); }
const email = "demo-admin@exemplo.com.br";
await db.query("INSERT INTO users(email, role, criado_por) VALUES ($1,'ADMIN','seed') ON CONFLICT (email) DO UPDATE SET ativo=true, role='ADMIN'", [email]);
const token = crypto.randomBytes(32).toString("base64url"), csrf = crypto.randomBytes(24).toString("base64url");
await db.query("INSERT INTO sessions(token_hash,user_email,csrf_token,expira_em) VALUES ($1,$2,$3, now()+interval '8 hours')", [crypto.createHash("sha256").update(token).digest("hex"), email, csrf]);
const cookie = `${process.env.NODE_ENV === "production" ? "__Host-sid" : "sid"}=${token}`;
const call = async (path, method, body) => {
  const r = await fetch(BASE + path, { method, headers: { cookie, origin: BASE, "x-csrf-token": csrf, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`); return r.json();
};
const cnpj = (b) => { const d = b.split("").map(Number); const c = (w) => { const r = w.reduce((a, x, i) => a + x * d[i], 0) % 11; return r < 2 ? 0 : 11 - r; }; d.push(c([5,4,3,2,9,8,7,6,5,4,3,2])); d.push(c([6,5,4,3,2,9,8,7,6,5,4,3,2])); return d.join(""); };
const cpf = (b) => { const d = b.split("").map(Number); const v = (n) => { let s = 0; for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; d.push(v(9)); d.push(v(10)); return d.join(""); };
const ie = (b) => { const d = b.slice(0, 8).split("").map(Number); const d9 = [1,3,4,5,6,7,8,10].reduce((a, w, i) => a + w * d[i], 0) % 11 % 10; const e = [...d, d9, ...b.slice(8, 10).split("").map(Number)]; return [...e, [3,2,10,9,8,7,6,5,4,3,2].reduce((a, w, i) => a + w * e[i], 0) % 11 % 10].join(""); };
const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const sufixo = String(Date.now()).slice(-6);

await call("/api/config", "PUT", { chave: "emails", valor: {
  FRANQUIA: { para: ["implantacao@fornecedor.exemplo"], cc: ["cs@fornecedor.exemplo", "juridico@fornecedor.exemplo", "ti@empresa.exemplo"] },
  PROPRIA: { para: ["implantacao@fornecedor.exemplo"], cc: ["cs@fornecedor.exemplo", "financeiro@empresa.exemplo", "ti@empresa.exemplo", "responsavel@empresa.exemplo"] } } });
await call("/api/config", "PUT", { chave: "propria_padrao", valor: { razao_social: "EMPRESA FICTICIA DE ALIMENTOS LTDA", regime: "3 - PRESUMIDO", resp_nome: "Fulano de Tal Exemplo", resp_email: "responsavel@empresa.exemplo", resp_telefone: "11 90000-0000", resp_doc_link: "https://drive.google.com/file/d/DOC-FICTICIO", financeiro: "A/C Beltrano Exemplo | Controladoria | financeiro@empresa.exemplo | Rua Fictícia, 100 - São Paulo/SP - CEP 01000-000", ponto_focal: "11 90000-0000" } });
await call("/api/config", "PUT", { chave: "testemunha", valor: { nome: "Ciclana Testemunha Exemplo", email: "testemunha@empresa.exemplo", endereco: "Rua Fictícia, 100 - São Paulo/SP - 01000-000", telefone: "11 91111-1111" } });
await call("/api/config", "PUT", { chave: "links", valor: { formulario: "https://docs.google.com/forms/d/FORMULARIO-FICTICIO/viewform" } });
await call("/api/config", "PUT", { chave: "onboarding", valor: { email_xml: "xml@empresa.exemplo", padroes: { serie_nfe: "2", seq_nfe: "0", serie_nfce: "1", seq_nfce: "0", terminais: "2", raio: "Sem Limite" } } });
await call("/api/config/segredo", "PUT", { chave: "propria_resp_cpf", valor: cpf("111444777") });
await call("/api/config/segredo", "PUT", { chave: "testemunha_cpf", valor: cpf("222555888") });
await call("/api/config/segredo", "PUT", { chave: "csc_sp", valor: { prod_id: "000001", prod_token: "FICTICIO-PROD-0000-0000-000000000001", hom_id: "000001", hom_token: "FICTICIO-HOMO-0000-0000-000000000002" } });

const p = await call("/api/lojas", "POST", { tipo: "PROPRIA", nome: "BISCOITE SHOPPING EXEMPLO", uf: "SP", cnpj: cnpj(`12${sufixo}0001`), email_loja: "shoppingexemplo@biscoite.com.br", data_inauguracao: dia(12),
  dados: { ie: ie("1112223334"), logradouro: "Avenida Fictícia", numero: "500", complemento: "Loja 10", bairro: "Bairro Exemplo", cep: "01001000", cidade: "São Paulo", contrato_link: "https://drive.google.com/file/d/CONTRATO-FICTICIO" } });
for (const e of ["cnpj"]) await call(`/api/lojas/${p.id}/etapas`, "PATCH", { etapa: e, status: "CONCLUIDO" });
await call(`/api/lojas/${p.id}/etapas`, "PATCH", { etapa: "email_nexaas", status: "EM_ANDAMENTO" });
const f = await call("/api/lojas", "POST", { tipo: "FRANQUIA", nome: "BISCOITE RUA DAS FLORES", uf: "PR", cnpj: cnpj(`55${sufixo}0001`), email_loja: "ruadasflores@biscoite.com", data_inauguracao: dia(26),
  dados: { razao_social: "FLORES DOCES FICTICIOS LTDA", regime: "Simples Nacional", logradouro: "Rua das Flores", numero: "200", bairro: "Centro", cep: "80000000", cidade: "Curitiba", resp_nome: "Maria Fictícia", resp_email: "maria@exemplo.com" },
  segredos: { resp_cpf: cpf("333666999"), resp_telefone: "41 95555-5555" } });
for (const e of ["grupo_pipeline", "cnpj_formulario", "email_hostinger", "extranet"]) await call(`/api/lojas/${f.id}/etapas`, "PATCH", { etapa: e, status: "CONCLUIDO" });
await call("/api/lojas", "POST", { tipo: "FRANQUIA", nome: "BISCOITE PRACA CENTRAL", uf: "MG", sem_cnpj: true, cnpj: "", data_inauguracao: dia(48) });
await call("/api/lojas", "POST", { tipo: "REPASSE_FP", nome: "BISCOITE AEROPORTO EXEMPLO", uf: "RJ", cnpj: cnpj(`77${sufixo}0001`), data_inauguracao: dia(5), dados: { ie: "12345678" } });
await db.end();
console.log(JSON.stringify({ propria: p.id, franquia: f.id, cookie_name: cookie.split("=")[0], token }));
