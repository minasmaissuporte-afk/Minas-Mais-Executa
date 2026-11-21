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
  document.info.Author = "Minas Mais Executa";
  document.info.Subject = "Relatório fotográfico de execução das lojas";
  const totalPages = Math.ceil(totalPhotos / 4);
  const contentTop = 210;
  let count = 0;
  return {
    document,
    async addPhoto(storeName: string, source: Buffer) {
      const image = await normalizeEvidencePhoto(source);
      const slot = count % 4;
      if (slot === 0) {
        document.addPage();
        const pageNumber = Math.floor(count / 4) + 1;
        const pageWidth = document.page.width;
        const pageHeight = document.page.height;
        document.save().rect(0, 0, pageWidth, pageHeight).fill("#000000").restore();
        document.save().rect(0, 0, pageWidth, 190).fill("#000000")
          .roundedRect(28, 22, 4, 38, 2).fill("#df3037")
          .roundedRect(28, 64, 3, 21, 1.5).fill("#ff8589").restore();
        document.font("Helvetica-BoldOblique").fontSize(30).fillColor("#ffffff")
          .text("MINAS MAIS EXECUTA", 42, 22, { width: pageWidth - 70, height: 38, characterSpacing: 0.8 });
        document.font("Helvetica-BoldOblique").fontSize(18).fillColor("#ff8589")
          .text("A excelência em execução!", 42, 63, { width: pageWidth - 70, height: 24 });
        document.font("Helvetica-Bold").fontSize(13).fillColor("#ffffff")
          .text("Nada é tão bom que não possa melhorar!", 42, 88, { width: pageWidth - 70, height: 19 });
        document.save().lineWidth(0.5).strokeColor("#454545")
          .moveTo(28, 118).lineTo(pageWidth - 28, 118).stroke().restore();
        document.font("Helvetica-Bold").fontSize(title.length > 95 ? 12 : 14).fillColor("#ffffff")
          .text(title, 28, 131, { width: pageWidth - 56, height: 32, ellipsis: true, lineGap: 2 });
        document.font("Helvetica").fontSize(9).fillColor("#c5cfdb")
          .text(`RELATÓRIO FOTOGRÁFICO  /  ${totalPhotos} fotos`, 28, 171, { width: pageWidth - 56, height: 14 });
        document.save().lineWidth(0.5).strokeColor("#454545")
          .moveTo(28, pageHeight - 40).lineTo(pageWidth - 28, pageHeight - 40).stroke().restore();
        document.font("Helvetica").fontSize(8).fillColor("#a8b0bb")
          .text("MINAS MAIS EXECUTA · REGISTRO DE EXECUÇÃO", 28, pageHeight - 29, { width: pageWidth - 150, height: 12, lineBreak: false });
        document.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff")
          .text(`${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`, pageWidth - 108, pageHeight - 29, { width: 80, height: 12, align: "right", lineBreak: false });
      }
      const gap = 16;
      const width = (document.page.width - 56 - gap) / 2;
      const height = (document.page.height - contentTop - 56 - gap) / 2;
      const x = 28 + (slot % 2) * (width + gap);
      const y = contentTop + Math.floor(slot / 2) * (height + gap);
      const photoNumber = String(count + 1).padStart(2, "0");
      document.save().lineWidth(0.6).fillColor("#ffffff").strokeColor("#d6dde5")
        .roundedRect(x, y, width, height, 8).fillAndStroke().restore();
      document.save().roundedRect(x + 12, y + 12, 26, 22, 5).fill("#e9eff5").restore();
      document.font("Helvetica-Bold").fontSize(9).fillColor("#284867")
        .text(photoNumber, x + 12, y + 19, { width: 26, height: 12, align: "center" });
      const labelSize = storeName.length > 48 ? 10 : 12;
      document.font("Helvetica-Bold").fontSize(labelSize).fillColor("#18232f")
        .text(storeName, x + 48, y + 13, { width: width - 60, height: 40, ellipsis: true });
      document.save().roundedRect(x + 10, y + 64, width - 20, height - 90, 4).fill("#f3f5f7").restore();
      document.image(image, x + 14, y + 68, {
        fit: [width - 28, height - 98],
        align: "center",
        valign: "center",
      });
      document.font("Helvetica").fontSize(7).fillColor("#a8b0bb")
        .text(`EVIDÊNCIA ${photoNumber}`, x + 12, y + height - 17, { width: width - 24, height: 10 });
      count += 1;
    },
  };
}
