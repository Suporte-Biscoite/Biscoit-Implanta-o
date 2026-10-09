// Criptografia por campo (AES-256-GCM, biblioteca nativa do Node — nada de cripto própria).
// Formato do texto cifrado: "<versãoDaChave>:<iv b64>:<tag b64>:<dados b64>".
// Chaves em FIELD_ENCRYPTION_KEYS="v1=<base64 32 bytes>;v2=<...>" — a ÚLTIMA é a atual.
// Manter as antigas permite ler dados enquanto a rotação (Fase 2) recifra tudo.
import crypto from "node:crypto";

type Keyring = { current: string; keys: Map<string, Buffer> };
let ring: Keyring | null = null;

function keyring(): Keyring {
  if (ring) return ring;
  const raw = process.env.FIELD_ENCRYPTION_KEYS;
  if (!raw) throw new Error("FIELD_ENCRYPTION_KEYS não configurada");
  const keys = new Map<string, Buffer>();
  let current = "";
  for (const part of raw.split(";").map((p) => p.trim()).filter(Boolean)) {
    const [ver, b64] = part.split("=", 2);
    const key = Buffer.from(b64 ?? "", "base64");
    if (!/^v\d+$/.test(ver) || key.length !== 32) throw new Error(`Chave de criptografia inválida: ${ver}`);
    keys.set(ver, key);
    current = ver;
  }
  ring = { current, keys };
  return ring;
}

export function encryptField(plain: string, aad = ""): string {
  const { current, keys } = keyring();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", keys.get(current)!, iv);
  if (aad) c.setAAD(Buffer.from(aad));
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [current, iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptField(enc: string, aad = ""): string {
  const [ver, iv, tag, data] = enc.split(":");
  const key = keyring().keys.get(ver);
  if (!key || !iv || !tag || data === undefined) throw new Error("Valor cifrado inválido ou chave ausente");
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  if (aad) d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
/** Apenas para testes: reseta o cache do chaveiro. */
export const _resetKeyring = () => { ring = null; };
