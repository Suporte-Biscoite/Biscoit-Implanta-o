// Gera templates/onboarding-template.xlsx a partir do modelo do Nexaas,
// REMOVENDO todos os dados da linha de exemplo (linha 2), o hyperlink com
// e-mails reais e as strings compartilhadas que só a linha 2 usava.
// Mantém intactos: cabeçalhos, estilos, validações (aba Planilha3) e comentários.
//
// Uso: node scripts/make-template.mjs "/caminho/Modelo.xlsx"
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const src = process.argv[2];
if (!src) {
  console.error("Uso: node scripts/make-template.mjs <modelo.xlsx>");
  process.exit(1);
}
const out = path.resolve("templates/onboarding-template.xlsx");

const zip = await JSZip.loadAsync(fs.readFileSync(src));
const S1 = "xl/worksheets/sheet1.xml";
const S2 = "xl/worksheets/sheet2.xml";
const SST = "xl/sharedStrings.xml";
const RELS = "xl/worksheets/_rels/sheet1.xml.rels";

let s1 = await zip.file(S1).async("string");
let s2 = await zip.file(S2).async("string");
let sst = await zip.file(SST).async("string");

// 1) Linha 2: mantém só o estilo de cada célula (sem valor, sem tipo)
s1 = s1.replace(/<row r="2"[^>]*>[\s\S]*?<\/row>/, (row) =>
  row.replace(/<c r="([A-Z]+2)"([^>]*?)(\/>|>[\s\S]*?<\/c>)/g, (_m, ref, attrs) => {
    const style = /s="(\d+)"/.exec(attrs);
    return `<c r="${ref}"${style ? ` s="${style[1]}"` : ""}/>`;
  })
);

// 2) Remove hyperlinks (continham e-mails reais) e a relação correspondente
const hl = /<hyperlinks>[\s\S]*?<\/hyperlinks>/.exec(s1);
if (hl) {
  const ids = [...hl[0].matchAll(/r:id="(rId\d+)"/g)].map((m) => m[1]);
  s1 = s1.replace(hl[0], "");
  let rels = await zip.file(RELS).async("string");
  for (const id of ids) rels = rels.replace(new RegExp(`<Relationship Id="${id}"[^>]*/>`), "");
  zip.file(RELS, rels);
}

// 3) Reconstrói sharedStrings só com as strings ainda usadas
const sis = [...sst.matchAll(/<si>[\s\S]*?<\/si>/g)].map((m) => m[0]);
const used = new Set();
for (const xml of [s1, s2])
  for (const m of xml.matchAll(/<c [^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g)) used.add(Number(m[1]));
const order = [...used].sort((a, b) => a - b);
const remap = new Map(order.map((old, i) => [old, i]));
const fix = (xml) =>
  xml.replace(/(<c [^>]*t="s"[^>]*><v>)(\d+)(<\/v><\/c>)/g, (_m, a, n, b) => `${a}${remap.get(Number(n))}${b}`);
s1 = fix(s1);
s2 = fix(s2);
const head = sst.slice(0, sst.indexOf("<sst"));
const sstOpen = /<sst[^>]*>/.exec(sst)[0]
  .replace(/count="\d+"/, `count="${order.length}"`)
  .replace(/uniqueCount="\d+"/, `uniqueCount="${order.length}"`);
sst = `${head}${sstOpen}${order.map((i) => sis[i]).join("")}</sst>`;

zip.file(S1, s1);
zip.file(S2, s2);
zip.file(SST, sst);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Modelo limpo gerado em ${out} (${order.length} strings mantidas de ${sis.length}).`);
