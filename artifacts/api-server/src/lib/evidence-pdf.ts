import PDFDocument from "pdfkit";
import sharp from "sharp";
import convertHeic from "heic-convert";

export async function normalizeEvidencePhoto(source: Buffer) {
  // iPhone HEIC/HEVC is not supported by the default sharp binary.
  // Decode with the portable libheif implementation before resizing.
  const brands = source.subarray(0, 64).toString("latin1");
  let input = brands.includes("ftyp") && /heic|heix|hevc|hevx|mif1|msf1/.test(brands)
    ? Buffer.from(await convertHeic({ buffer: source, format: "JPEG", quality: 0.9 }))
    : source;
  // Some older uploads contain the complete JPEG scan but omit its end marker.
  // Repair the marker; the decoder still rejects unrecoverable scan data.
  if (input[0] === 0xff && input[1] === 0xd8
    && !(input[input.length - 2] === 0xff && input[input.length - 1] === 0xd9)) {
    input = Buffer.concat([input, Buffer.from([0xff, 0xd9])]);
  }
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
}

/** Four fitted photos per A4 page; labels have fixed space and cannot overlap images. */
export function createEvidencePdf(title: string, totalPhotos: number) {
  const document = new PDFDocument({ size: "A4", margin: 32, autoFirstPage: false });
  document.info.Title = `Evidências: ${title}`;
  let count = 0;
  return {
    document,
    async addPhoto(storeName: string, source: Buffer) {
      const image = await normalizeEvidencePhoto(source);
      const slot = count % 4;
      if (slot === 0) {
        document.addPage();
        document.font("Helvetica-Bold").fontSize(9).fillColor("#c62828")
          .text("MINAS MAIS EXECUTA · EVIDÊNCIAS", 32, 26, { width: 531, height: 15 });
        document.font("Helvetica-Bold").fontSize(14).fillColor("#242424")
          .text(title, 32, 45, { width: 531, height: 36, ellipsis: true });
        document.font("Helvetica").fontSize(9).fillColor("#555555")
          .text(`${totalPhotos} fotos · Página ${Math.floor(count / 4) + 1} de ${Math.ceil(totalPhotos / 4)}`, 32, 85, { width: 531, height: 15 });
      }
      const gap = 14;
      const width = (document.page.width - 64 - gap) / 2;
      const height = (document.page.height - 144 - gap) / 2;
      const x = 32 + (slot % 2) * (width + gap);
      const y = 112 + Math.floor(slot / 2) * (height + gap);
      document.save().lineWidth(0.5).strokeColor("#dddddd").rect(x, y, width, height).stroke().restore();
      document.font("Helvetica-Bold").fontSize(11).fillColor("#242424")
        .text(storeName, x + 8, y + 8, { width: width - 16, height: 32, ellipsis: true });
      document.image(image, x + 8, y + 46, {
        fit: [width - 16, height - 54],
        align: "center",
        valign: "center",
      });
      count += 1;
    },
  };
}
