export type RankingPdfColumn = {
  key: string;
  header: string;
  width: number;
};

export type RankingPdfRow = Record<string, string | number> & {
  position: number;
};

export type RankingPdfSection = {
  heading?: string;
  columns: RankingPdfColumn[];
  rows: RankingPdfRow[];
};

export type RankingPdfReport = {
  title: string;
  period: string;
  summary: string;
  variant: 'stores' | 'regions' | 'supervisors';
  sections: RankingPdfSection[];
};

const medalColors: Record<number, [number, number, number]> = {
  1: [255, 247, 218],
  2: [236, 241, 245],
  3: [250, 235, 224],
};

const medalTextColors: Record<number, [number, number, number]> = {
  1: [126, 92, 13],
  2: [75, 88, 101],
  3: [133, 77, 45],
};

export async function createRankingPdfBlob(report: RankingPdfReport): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const left = 38;
  const right = 38;
  const bottom = 42;
  const tableWidth = pageWidth - left - right;
  let nextY = 116;

  for (const section of report.sections) {
    if (!section.rows.length) continue;

    if (section.heading) {
      if (nextY + 54 > pageHeight - bottom) {
        document.addPage();
        nextY = 116;
      }
      document.setFillColor(22, 86, 78);
      document.roundedRect(left, nextY, pageWidth - left - right, 23, 4, 4, 'F');
      document.setFont('helvetica', 'bold');
      document.setFontSize(9);
      document.setTextColor(255, 255, 255);
      document.text(section.heading, left + 10, nextY + 15);
      nextY += 29;
    }

    autoTable(document, {
      startY: nextY,
      margin: { top: 116, bottom, left, right },
      columns: section.columns.map(({ key, header }) => ({ header, dataKey: key })),
      body: section.rows.map((row) => row),
      theme: 'grid',
      tableWidth,
      styles: {
        font: 'helvetica',
        fontSize: report.variant === 'stores' ? 7 : 8,
        textColor: [34, 45, 54],
        lineColor: [220, 228, 232],
        lineWidth: 0.45,
        cellPadding: 4,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: report.variant === 'supervisors' ? [18, 25, 36] : [22, 86, 78],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      alternateRowStyles: {
        fillColor: report.variant === 'supervisors' ? [247, 249, 251] : [241, 248, 246],
      },
      columnStyles: Object.fromEntries(section.columns.map((column) => [
        column.key,
        { cellWidth: column.width * tableWidth / section.columns.reduce((total, item) => total + item.width, 0) },
      ])),
      didParseCell: (cell) => {
        if (cell.section !== 'body') return;
        const row = section.rows[cell.row.index];
        if (!row) return;
        if (medalColors[row.position]) {
          cell.cell.styles.fillColor = medalColors[row.position];
          if (cell.column.index === 0 || cell.column.index === section.columns.length - 1) {
            cell.cell.styles.textColor = medalTextColors[row.position];
            cell.cell.styles.fontStyle = 'bold';
          }
        } else if (report.variant !== 'supervisors') {
          cell.cell.styles.fillColor = [237, 247, 245];
        }
      },
    });

    const finalY = (document as typeof document & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    nextY = (finalY ?? nextY) + 12;
  }

  for (let page = 1; page <= document.getNumberOfPages(); page += 1) {
    document.setPage(page);
    document.setFillColor(13, 20, 27);
    document.rect(0, 0, pageWidth, 104, 'F');
    document.setFillColor(219, 48, 59);
    document.roundedRect(28, 18, 4, 66, 2, 2, 'F');
    document.setFont('helvetica', 'bold');
    document.setFontSize(19);
    document.setTextColor(248, 250, 252);
    document.text('MINAS MAIS EXECUTA', 42, 39);
    document.setFontSize(9);
    document.setTextColor(245, 129, 143);
    document.text('Excelência na execução!', 42, 57);
    document.setFont('helvetica', 'normal');
    document.setTextColor(222, 229, 234);
    document.text('Nada é tão bom, que não possa melhorar!', 42, 71);
    document.setFont('helvetica', 'bold');
    document.setFontSize(11);
    document.setTextColor(255, 255, 255);
    document.text(report.title, 42, 91);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7);
    document.setTextColor(193, 205, 213);
    document.text(`Período: ${report.period}  ·  ${report.summary}`, 42, 101);

    document.setDrawColor(218, 225, 230);
    document.setLineWidth(0.5);
    document.line(left, pageHeight - 29, pageWidth - right, pageHeight - 29);
    document.setFontSize(7);
    document.setTextColor(103, 116, 127);
    document.text('MINAS MAIS EXECUTA · Relatório de classificação', left, pageHeight - 17);
    document.text(`Página ${page} de ${document.getNumberOfPages()}`, pageWidth - right, pageHeight - 17, { align: 'right' });
  }

  return document.output('blob');
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
