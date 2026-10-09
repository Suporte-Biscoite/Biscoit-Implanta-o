// Varredura simples de segredos/dados pessoais nos arquivos versionados (complementa o gitleaks do CI).
import { execSync } from "node:child_process";
import fs from "node:fs";
const arquivos = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter((f) => f && !f.endsWith(".xlsx") && !f.includes("package-lock"));
const regras = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada"],
  [/GOCSPX-[A-Za-z0-9_-]{20,}/, "client secret do Google"],
  [/"type":\s*"service_account"/, "JSON de conta de serviço"],
  [/AKIA[0-9A-Z]{16}/, "chave AWS"],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, "CPF formatado"],
  [/\b(?!0{8}-0{4})[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b/, "token no formato CSC"], // ignora o UUID nulo
  [/postgres(ql)?:\/\/[^:\s]+:(?!TROCAR|app_dev_local|dono_dev_local|dono_ci|app_ci)[^@\s]{6,}@/, "URL de banco com senha"],
  [/FIELD_ENCRYPTION_KEYS=v1=[A-Za-z0-9+/]{43}=/, "chave de criptografia"],
];
let achados = 0;
for (const f of arquivos) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, "utf8").split("\n").forEach((linha, i) => {
    for (const [re, nome] of regras) if (re.test(linha)) { console.log(`${f}:${i + 1}: possível ${nome}`); achados++; }
  });
  if (/^\.env(\.|$)/.test(f.split("/").pop()) && !f.endsWith(".env.example")) { console.log(`${f}: arquivo .env versionado!`); achados++; }
}
console.log(achados ? `\n${achados} achado(s). Corrija antes do commit.` : `OK: ${arquivos.length} arquivos sem segredos aparentes.`);
process.exit(achados ? 1 : 0);
