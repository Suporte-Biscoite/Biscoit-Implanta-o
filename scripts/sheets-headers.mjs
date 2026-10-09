// PASSO 0: imprime SOMENTE a linha de cabeçalho de cada aba — nenhum dado de loja ou pessoa.
// Funciona com planilha Google e com .xlsx guardado no Drive. Detecta o cabeçalho mesmo que não esteja na linha 1
// (a primeira linha, entre as 15 primeiras, com 8+ células preenchidas e só textos).
// Uso: node --experimental-strip-types scripts/sheets-headers.mjs <ID_ARQUIVO> [<ID_ARQUIVO> ...]
// Credencial: gcloud auth application-default login --impersonate-service-account=<conta de serviço>
import { GoogleAuth } from "google-auth-library";
import { lerXlsx } from "../src/lib/xlsx-read.ts";

const ids = process.argv.slice(2);
if (!ids.length) { console.error("Informe os IDs dos arquivos (o trecho entre /d/ e /edit ou /view da URL)."); process.exit(1); }
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const client = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive.readonly"] }).getClient();
const letra = (i) => (i < 26 ? "" : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));

for (const id of ids) {
  const { data: meta } = await client.request({ url: `https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType&supportsAllDrives=true` });
  const url = meta.mimeType === XLSX ? `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`
    : `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(XLSX)}`;
  const { data } = await client.request({ url, responseType: "arraybuffer" });
  console.log(`\n### ${meta.name} (${meta.mimeType === XLSX ? ".xlsx no Drive" : "planilha Google"})`);
  for (const aba of await lerXlsx(Buffer.from(data))) {
    const i = aba.linhas.slice(0, 15).findIndex((r) => r.filter((c) => c && c.trim()).length >= 8 && r.every((c) => !c || !/^\d/.test(c.trim())));
    if (i < 0) { console.log(`\n  aba "${aba.nome}": cabeçalho não encontrado nas 15 primeiras linhas`); continue; }
    console.log(`\n  aba "${aba.nome}" — cabeçalho na linha ${i + 1}:`);
    aba.linhas[i].forEach((h, c) => h && console.log(`    ${letra(c).padEnd(3)} ${h}`));
  }
}
