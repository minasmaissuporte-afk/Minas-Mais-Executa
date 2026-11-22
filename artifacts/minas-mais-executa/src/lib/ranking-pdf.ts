export type RankingPdfReport = {
  title: string;
  period: string;
  variant: 'stores' | 'regions' | 'supervisors';
};

export type RankingPdfPageSlice = {
  top: number;
  height: number;
};

export type RankingPdfPageImage = {
  image: string;
  height: number;
};

export type RankingPdfCapture = {
  pages: RankingPdfPageImage[];
  imageWidth: number;
  orientation: 'portrait' | 'landscape';
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
  const capture = await captureRankingPdfPages(element);
  return createRankingPdfFromImages({ ...capture, report });
}

export async function captureRankingPdfPages(element: HTMLElement): Promise<RankingPdfCapture> {
  await document.fonts?.ready;
  const { default: html2canvas } = await import('html2canvas');
  const rootBounds = element.getBoundingClientRect();
  const cssWidth = Math.max(1, element.clientWidth || rootBounds.width);
  const cssHeight = Math.max(1, element.scrollHeight || rootBounds.height);
  const orientation = cssWidth > 760 ? 'landscape' : 'portrait';
  const maxPageHeight = getImagePageHeight(cssWidth, orientation);
  const scale = Math.min(
    2,
    2400 / cssWidth,
    3200 / maxPageHeight,
    Math.sqrt(8_000_000 / (cssWidth * maxPageHeight)),
  );
  const safeBreaks = [
    '.stores-ranking-mobile-row',
    '.stores-ranking-table tbody tr',
    '.regional-store-group',
    '.regional-store-mobile-row',
    '.regional-stores-table tbody tr',
    '.regional-ranking-card',
    '.supervisor-podium-card',
    '.supervisor-ranking-row',
    '[data-ranking-pdf-break]',
  ]
    .flatMap((selector) => Array.from(element.querySelectorAll<HTMLElement>(selector)))
    .flatMap((row) => {
      const bounds = row.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 ? [bounds.bottom - rootBounds.top] : [];
    })
    .filter((value) => value > 0);

  const slices = getRankingPdfPageSlices(Math.ceil(cssHeight), maxPageHeight, safeBreaks);
  const pages: Array<{ image: string; height: number }> = [];
  let imageWidth = 0;

  for (const slice of slices) {
    const canvas = await html2canvas(element, {
      backgroundColor: null,
      scale,
      x: 0,
      y: slice.top,
      width: cssWidth,
      height: slice.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      useCORS: true,
      logging: false,
    });
    if (!canvas.width || !canvas.height) {
      throw new Error('Não foi possível capturar uma página do ranking para gerar o PDF.');
    }
    imageWidth ||= canvas.width;
    pages.push({ image: canvas.toDataURL('image/jpeg', 0.94), height: canvas.height });
  }

  if (!pages.length || !imageWidth) {
    throw new Error('Não foi possível capturar o ranking para gerar o PDF.');
  }

  return {
    pages,
    imageWidth,
    orientation,
  };
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
