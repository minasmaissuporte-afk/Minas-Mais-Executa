export type RankingPdfReport = {
  title: string;
  period: string;
  variant: 'stores' | 'regions' | 'supervisors';
};

export type RankingPdfPageSlice = {
  top: number;
  height: number;
};

export function getRankingPdfPageSlices(
  imageHeight: number,
  maxPageHeight: number,
  safeBreaks: number[] = [],
): RankingPdfPageSlice[] {
  if (imageHeight <= 0 || maxPageHeight <= 0) return [];
  const breaks = [...safeBreaks].filter((value) => value > 0 && value < imageHeight).sort((a, b) => a - b);
  const pages: RankingPdfPageSlice[] = [];
  let top = 0;

  while (top < imageHeight) {
    const limit = Math.min(top + maxPageHeight, imageHeight);
    const preferredMinimum = top + maxPageHeight * 0.55;
    const safeEnd = breaks.filter((value) => value >= preferredMinimum && value <= limit).at(-1);
    const end = Math.max(top + 1, Math.floor(safeEnd ?? limit));
    pages.push({ top, height: end - top });
    top = end;
  }

  return pages;
}

export async function createRankingPdfBlob(
  element: HTMLElement,
  report: RankingPdfReport,
): Promise<Blob> {
  await document.fonts?.ready;
  const { default: html2canvas } = await import('html2canvas');
  const rootBounds = element.getBoundingClientRect();
  const cssWidth = Math.max(1, element.clientWidth || rootBounds.width);
  const cssHeight = Math.max(1, element.scrollHeight || rootBounds.height);
  const scale = Math.min(
    2,
    2400 / cssWidth,
    12_000 / cssHeight,
    Math.sqrt(18_000_000 / (cssWidth * cssHeight)),
  );
  const scaleSafeBreaks = [
    '.stores-ranking-mobile-row',
    '.stores-ranking-table tbody tr',
    '.regional-store-group',
    '.regional-store-mobile-row',
    '.regional-stores-table tbody tr',
    '.regional-ranking-card',
    '.supervisor-podium-card',
    '.supervisor-ranking-row',
  ]
    .flatMap((selector) => Array.from(element.querySelectorAll<HTMLElement>(selector)))
    .map((row) => Math.round((row.getBoundingClientRect().bottom - rootBounds.top) * scale))
    .filter((value) => value > 0);

  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale,
    width: cssWidth,
    height: cssHeight,
    windowWidth: window.innerWidth,
    windowHeight: Math.max(window.innerHeight, Math.ceil(cssHeight)),
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
    useCORS: true,
    logging: false,
  });

  if (!canvas.width || !canvas.height) {
    throw new Error('Não foi possível capturar o ranking para gerar o PDF.');
  }

  const orientation = cssWidth > 760 ? 'landscape' : 'portrait';
  const pdf = await createRankingPdfFromImages({
    pages: getRankingPdfPageSlices(canvas.height, getImagePageHeight(canvas.width, orientation), scaleSafeBreaks)
      .map((slice) => {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = slice.height;
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar as páginas do PDF.');
        context.drawImage(canvas, 0, slice.top, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
        return { image: pageCanvas.toDataURL('image/jpeg', 0.94), height: slice.height };
      }),
    imageWidth: canvas.width,
    orientation,
    report,
  });
  return pdf;
}

function getImagePageHeight(imageWidth: number, orientation: 'portrait' | 'landscape') {
  const page = orientation === 'landscape' ? { width: 841.89, height: 595.28 } : { width: 595.28, height: 841.89 };
  const margin = 18;
  const imageWidthPoints = page.width - margin * 2;
  const pointsPerPixel = imageWidthPoints / imageWidth;
  return (page.height - margin * 2) / pointsPerPixel;
}

export async function createRankingPdfFromImages({
  pages,
  imageWidth,
  orientation,
  report,
}: {
  pages: Array<{ image: string; height: number }>;
  imageWidth: number;
  orientation: 'portrait' | 'landscape';
  report: RankingPdfReport;
}): Promise<Blob> {
  const [{ jsPDF }] = await Promise.all([import('jspdf')]);
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4', compress: true });
  pdf.setProperties({ title: `${report.title} · ${report.period}`, subject: 'Ranking Minas Mais Executa' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const pointsPerPixel = contentWidth / imageWidth;

  pages.forEach((page, index) => {
    if (index > 0) pdf.addPage('a4', orientation);
    const imageHeight = page.height * pointsPerPixel;
    pdf.addImage(page.image, 'JPEG', margin, margin, contentWidth, imageHeight, `ranking-page-${index}`, 'FAST');
  });

  return pdf.output('blob');
}

export function rankingPdfFileName(title: string, fromDate: string, toDate: string) {
  const safeTitle = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${safeTitle}-${fromDate}-a-${toDate}.pdf`;
}
