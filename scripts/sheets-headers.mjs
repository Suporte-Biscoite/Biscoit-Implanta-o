// PASSO 0: imprime SOMENTE a linha de cabeçalho (linha 1) das planilhas — nenhum dado de franqueado.
// Uso: GOOGLE_APPLICATION_CREDENTIALS=/fora/do/repo/sa.json node scripts/sheets-headers.mjs <ID_RESPOSTAS> <ID_PIPELINE>
// (ou, com gcloud logado: gcloud auth application-default login --scopes=...spreadsheets.readonly,...cloud-platform)
import { GoogleAuth } from "google-auth-library";
const ids = process.argv.slice(2);
if (!ids.length) { console.error("Informe os IDs das planilhas (trecho entre /d/ e /edit da URL)."); process.exit(1); }
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
const client = await auth.getClient();
for (const id of ids) {
  const meta = await client.request({ url: `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties.title` });
  for (const { properties: { title } } of meta.data.sheets) {
    const r = await client.request({ url: `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(`'${title}'!1:1`)}` });
    const hdr = r.data.values?.[0] ?? [];
    console.log(`\n=== ${id.slice(0, 6)}… / aba "${title}" (${hdr.length} colunas)`);
    hdr.forEach((h, i) => {
      const col = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
      console.log(`  ${col.padEnd(3)} ${h}`);
    });
  }
}
