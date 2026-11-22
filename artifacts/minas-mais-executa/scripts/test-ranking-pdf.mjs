import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import {
  createRankingPdfFromImages,
  getRankingPdfPageSlices,
  rankingPdfFileName,
} from '../src/lib/ranking-pdf.ts';

const slices = getRankingPdfPageSlices(1600, 800, [500, 760, 1200]);
assert.deepEqual(slices, [
  { top: 0, height: 760 },
  { top: 760, height: 440 },
  { top: 1200, height: 400 },
]);
assert.deepEqual(getRankingPdfPageSlices(0, 500), []);
assert.equal(rankingPdfFileName('Ranking dos supervisores', '2026-11-01', '2026-11-21'),
  'ranking-dos-supervisores-2026-11-01-a-2026-11-21.pdf');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(name, data) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}
const pngBytes = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
  pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
  pngChunk('IEND', Buffer.alloc(0)),
]);
const onePixelPng = `data:image/png;base64,${pngBytes.toString('base64')}`;
for (const [title, variant] of [
  ['Ranking geral de lojas', 'stores'],
  ['Ranking das lojas por região', 'regions'],
  ['Ranking dos supervisores', 'supervisors'],
]) {
  const pageSlices = getRankingPdfPageSlices(2600, 800, [760, 1560, 2360]);
  const blob = await createRankingPdfFromImages({
    pages: pageSlices.map((slice) => ({ image: onePixelPng, height: slice.height })),
    imageWidth: 600,
    orientation: 'portrait',
    report: { title, period: '01 nov. 2026 a 21 nov. 2026', variant },
  });
  const output = Buffer.from(await blob.arrayBuffer());
  const text = output.toString('latin1');
  assert.equal(blob.type, 'application/pdf', `${title} should be a PDF`);
  assert.ok(output.length > 1_000, `${title} should contain the captured ranking`);
  assert.ok(text.startsWith('%PDF-'), `${title} should have a valid PDF header`);
  assert.ok(text.includes('%%EOF'), `${title} should have a complete PDF trailer`);
  assert.equal((text.match(/\/Type\s*\/Page\b/g) ?? []).length, 4, `${title} should preserve safe multi-page breaks`);
}

console.log('Ranking PDF tests passed: screen-image PDFs and clean page breaks for all three ranking types.');
