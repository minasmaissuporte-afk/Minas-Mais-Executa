import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { build } from "esbuild";

// Resolve from the emitted server, not the test's own directory. This catches
// both bundled PDFKit internals and missing runtime dependencies after building.
const bundleUrl = new URL("../dist/index.mjs", import.meta.url);
const bundle = await readFile(bundleUrl, "utf8");
assert.match(bundle, /from ["']pdfkit["']/, "PDFKit must remain external in the production bundle");
assert.doesNotMatch(bundle, /require\$?\w*\(["']#standard-fonts\//, "Font lookup must not be bundled");
const requireFromBundle = createRequire(bundleUrl);
const { default: sharp } = await import(requireFromBundle.resolve("sharp"));
const rendererUrl = new URL("../dist/pdf-renderer-test.mjs", import.meta.url);
await build({
  entryPoints: [new URL("../src/lib/evidence-pdf.ts", import.meta.url).pathname],
  outfile: rendererUrl.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["pdfkit", "sharp"],
});
const { createEvidencePdf } = await import(rendererUrl.href);

const image = await sharp({
  create: { width: 600, height: 900, channels: 3, background: "#d92525" },
}).jpeg().toBuffer();
for (const total of [1, 4, 5, 46]) {
const presentation = createEvidencePdf("Campanha de teste · 4 fotos por página", total);
const pdf = presentation.document;
const chunks = [];
pdf.on("data", (chunk) => chunks.push(chunk));
const done = new Promise((resolve, reject) => {
  pdf.once("end", resolve);
  pdf.once("error", reject);
});
for (let store = 1; store <= total; store += 1) {
  await presentation.addPhoto(`Filial ${store} · Loja com identificação`, image);
}
pdf.end();
await done;
const output = Buffer.concat(chunks);
assert.equal(output.subarray(0, 5).toString(), "%PDF-");
assert.match(output.toString("latin1"), /%%EOF/);
const pages = Math.ceil(total / 4);
assert.equal((output.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length, pages);
assert.equal((output.toString("latin1").match(/\/Subtype\s*\/Image\b/g) ?? []).length, total);
console.log(`PDF runtime regression passed: ${total} identified stores/photos, ${pages} pages, ${output.length} bytes.`);
}
