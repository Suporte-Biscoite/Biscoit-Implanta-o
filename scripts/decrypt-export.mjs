// Abre uma exportação cifrada. A senha é pedida no terminal (não fica no histórico do shell).
import fs from "node:fs";
import crypto from "node:crypto";
import readline from "node:readline";
const f = process.argv[2];
if (!f) { console.error("Uso: node scripts/decrypt-export.mjs <arquivo.enc.json> > saida.json"); process.exit(1); }
const e = JSON.parse(fs.readFileSync(f, "utf8"));
const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
const senha = process.env.EXPORT_PASSWORD ?? await new Promise((r) => rl.question("Senha: ", r));
rl.close();
const key = crypto.scryptSync(senha, Buffer.from(e.salt, "base64"), 32, { N: e.N, r: e.r, p: e.p, maxmem: 64 * 1024 * 1024 });
const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(e.iv, "base64"));
d.setAuthTag(Buffer.from(e.tag, "base64"));
process.stdout.write(Buffer.concat([d.update(Buffer.from(e.data, "base64")), d.final()]).toString("utf8"));
