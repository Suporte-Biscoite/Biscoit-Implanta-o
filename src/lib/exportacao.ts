// Exportação completa cifrada: scrypt (derivação de chave) + AES-256-GCM, ambos da biblioteca nativa.
// Para abrir: node scripts/decrypt-export.mjs arquivo.enc.json
import crypto from "node:crypto";
export function cifrarExportacao(json: string, senha: string) {
  if (senha.length < 16) throw new Error("A senha da exportação precisa ter pelo menos 16 caracteres");
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(senha, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(json, "utf8"), c.final()]);
  return JSON.stringify({ v: 1, kdf: "scrypt", N: 32768, r: 8, p: 1, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") });
}
