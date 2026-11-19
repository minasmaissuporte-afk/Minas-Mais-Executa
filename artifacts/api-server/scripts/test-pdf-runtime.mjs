import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// Resolve from the emitted server, not the test's own directory. This catches
// both bundled PDFKit internals and missing runtime dependencies after building.
const bundleUrl = new URL("../dist/index.mjs", import.meta.url);
const bundle = await readFile(bundleUrl, "utf8");
assert.match(bundle, /from ["']pdfkit["']/, "PDFKit must remain external in the production bundle");
assert.doesNotMatch(bundle, /require\$?\w*\(["']#standard-fonts\//, "Font lookup must not be bundled");
const requireFromBundle = createRequire(bundleUrl);
const { default: PDFDocument } = await import(requireFromBundle.resolve("pdfkit"));
const { default: sharp } = await import(requireFromBundle.resolve("sharp"));

const image = await sharp({
  create: { width: 600, height: 900, channels: 3, background: "#d92525" },
}).jpeg().toBuffer();
const pdf = new PDFDocument({ size: "A4", margin: 44, autoFirstPage: false });
const chunks = [];
pdf.on("data", (chunk) => chunks.push(chunk));
const done = new Promise((resolve, reject) => {
  pdf.once("end", resolve);
  pdf.once("error", reject);
});
pdf.addPage();
pdf.font("Helvetica-Bold").fontSize(25).text("Evidências da tarefa");
pdf.font("Helvetica").fontSize(12).text("Amend linha capilar");
// Match the reported 46-store export and exercise both standard fonts.
for (let store = 1; store <= 46; store += 1) {
  pdf.addPage();
  pdf.font("Helvetica-Bold").fontSize(20).text(`Filial ${store}`);
  pdf.font("Helvetica").fontSize(10).text(`Comprovação da filial ${store}`);
  pdf.image(image, 44, 120, { fit: [500, 650] });
}
pdf.end();
await done;
const output = Buffer.concat(chunks);
assert.equal(output.subarray(0, 5).toString(), "%PDF-");
assert.match(output.toString("latin1"), /%%EOF/);
assert.equal((output.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length, 47);
console.log(`PDF runtime regression passed: 46 identified stores, 47 pages, ${output.length} bytes.`);
