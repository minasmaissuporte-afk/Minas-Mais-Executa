import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  external: ["pdfkit", "sharp", "heic-convert"],
});
const { createEvidencePdf, normalizeEvidencePhoto } = await import(rendererUrl.href);
const testDir = await mkdtemp(join(tmpdir(), "evidence-pdf-"));

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
const filePath = join(testDir, `evidence-${total}.pdf`);
await writeFile(filePath, output);
const extracted = execFileSync("pdftotext", [filePath, "-"], { encoding: "utf8" });
assert.ok(extracted.includes("Campanha de teste"), "Task heading must be readable");
for (let store = 1; store <= total; store += 1) {
  assert.ok(extracted.includes(`Filial ${store} ·`), `Store ${store} label must be readable`);
}
// Count decoded red pixels, not just image objects; a blank PDF cannot pass.
const raster = join(testDir, `page-${total}`);
execFileSync("pdftoppm", ["-f", String(pages), "-l", String(pages), "-singlefile", "-scale-to", "1000", "-png", filePath, raster]);
const { data, info } = await sharp(`${raster}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let redPixels = 0;
for (let pixel = 0; pixel < data.length; pixel += info.channels) {
  if (data[pixel] > 150 && data[pixel + 1] < 100 && data[pixel + 2] < 100) redPixels += 1;
}
assert.ok(redPixels > 10000, "Last PDF page must visibly render its photo");
console.log(`PDF runtime regression passed: ${total} identified stores/photos, ${pages} pages, ${output.length} bytes.`);
}
await normalizeEvidencePhoto(image.subarray(0, image.length - 2));
console.log("Recoverable JPEG end-marker warning: converted successfully.");
await assert.rejects(() => normalizeEvidencePhoto(Buffer.from("invalid image")));
console.log("Invalid image rejected rather than silently omitted.");
if (process.env.HEIC_TEST_FILE) {
  const normalized = await normalizeEvidencePhoto(await readFile(process.env.HEIC_TEST_FILE));
  assert.equal((await sharp(normalized).metadata()).format, "jpeg");
  console.log("Real HEIC/HEVC fixture decoded to JPEG successfully.");
}
console.log(`Rendered PDF evidence: ${testDir}`);
