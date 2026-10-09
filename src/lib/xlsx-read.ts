// Leitor mínimo de .xlsx (somente leitura de valores), usando JSZip.
// Motivo: o pipeline é um arquivo .xlsx guardado no Drive (não uma planilha Google), e a API do
// Sheets não lê .xlsx. Evitamos o pacote "xlsx" do npm, cuja versão publicada lá tem falhas conhecidas.
import JSZip from "jszip";

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_m, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()]);

/** Texto de um <si>/<is>: junta todos os <t> (inclui texto rico com várias partes), ignorando a fonética (<rPh>). */
const textoDe = (xml: string) =>
  [...xml.replace(/<rPh[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");

const colNum = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
function formatoEhData(code: string) {
  const limpo = code.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "").replace(/\\./g, "");
  return /[dmy]/i.test(limpo) && !/^(general|0|#)/i.test(limpo);
}

function serialParaData(serial: number, base1904: boolean) {
  const epoch = base1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const d = new Date(epoch + Math.round(serial * 86400) * 1000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export type Aba = { nome: string; linhas: string[][] };

/** Lê todas as abas (ou só a pedida) como matriz de textos. Datas viram "dd/mm/aaaa". */
export async function lerXlsx(buf: Buffer | Uint8Array, apenasAba?: string): Promise<Aba[]> {
  if (buf.byteLength > 20 * 1024 * 1024) throw new Error("Planilha maior que 20 MB");
  const zip = await JSZip.loadAsync(buf);
  const ler = async (p: string) => (await zip.file(p)?.async("string")) ?? "";

  const wb = await ler("xl/workbook.xml");
  const base1904 = /date1904="(1|true)"/.test(wb);
  const rels = await ler("xl/_rels/workbook.xml.rels");
  const alvo = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1] ?? "", t = /Target="([^"]+)"/.exec(m[0])?.[1] ?? "";
    return [id, t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`];
  }));
  const sheets = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    nome: decodeXml(/name="([^"]*)"/.exec(m[0])?.[1] ?? ""),
    path: alvo.get(/r:id="([^"]+)"/.exec(m[0])?.[1] ?? "") ?? "",
  }));

  const sst = [...(await ler("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]));
  const styles = await ler("xl/styles.xml");
  const fmts = new Map([...styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)].map((m) => [Number(m[1]), decodeXml(m[2])]));
  const xfsBloco = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  const estiloData = [...xfsBloco.matchAll(/<xf\b[^>]*>/g)].map((m) => {
    const id = Number(/numFmtId="(\d+)"/.exec(m[0])?.[1] ?? 0);
    return DATE_IDS.has(id) || (fmts.has(id) && formatoEhData(fmts.get(id)!));
  });

  const out: Aba[] = [];
  for (const s of sheets) {
    if (apenasAba && s.nome !== apenasAba) continue;
    const xml = await ler(s.path);
    const linhas: string[][] = [];
    for (const row of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const r = Number(/\br="(\d+)"/.exec(row[0])?.[1] ?? linhas.length + 1) - 1;
      const cells: string[] = [];
      for (const c of (row[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1], body = c[2] ?? "";
        const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
        const t = /\bt="(\w+)"/.exec(attrs)?.[1];
        const st = Number(/\bs="(\d+)"/.exec(attrs)?.[1] ?? 0);
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let val = "";
        if (t === "s") val = sst[Number(v)] ?? "";
        else if (t === "inlineStr") val = textoDe(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? "");
        else if (t === "b") val = v === "1" ? "VERDADEIRO" : "FALSO";
        else if (v !== undefined) {
          const raw = decodeXml(v);
          val = t !== "str" && t !== "e" && estiloData[st] && /^-?\d+(\.\d+)?$/.test(raw) ? serialParaData(Number(raw), base1904) : raw;
        }
        cells[ref ? colNum(ref) : cells.length] = val;
      }
      linhas[r] = Array.from(cells, (x) => x ?? "");
    }
    out.push({ nome: s.nome, linhas: Array.from(linhas, (x) => x ?? []) });
  }
  return out;
}
