import { useState } from 'react';
import { Download, FileText, Share2 } from 'lucide-react';
import {
  createRankingPdfBlob,
  rankingPdfFileName,
  type RankingPdfReport,
} from '@/lib/ranking-pdf';

export function RankingPdfActions({
  report,
  targetId,
  fromDate,
  toDate,
  createPdf = createRankingPdfBlob,
}: {
  report: RankingPdfReport;
  targetId: string;
  fromDate: string;
  toDate: string;
  createPdf?: (element: HTMLElement, report: RankingPdfReport) => Promise<Blob>;
}) {
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [preparedPdf, setPreparedPdf] = useState<File | null>(null);
  const [canSharePdf, setCanSharePdf] = useState(false);
  const [notice, setNotice] = useState('');

  const generatePdf = async () => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    setPreparedPdf(null);
    setCanSharePdf(false);
    try {
      const target = document.querySelector<HTMLElement>(`[data-ranking-pdf-target="${targetId}"]`);
      if (!target) throw new Error('Não encontrei o quadro do ranking para gerar o PDF.');
      const blob = await createPdf(target, report);
      if (!blob.size || blob.type !== 'application/pdf') {
        throw new Error('O arquivo PDF ficou vazio. Tente gerar novamente.');
      }
      const file = new File([blob], rankingPdfFileName(report.title, fromDate, toDate), { type: 'application/pdf' });
      let supportsFileShare = false;
      try {
        supportsFileShare = typeof navigator.share === 'function'
          && typeof navigator.canShare === 'function'
          && navigator.canShare({ files: [file] });
      } catch {
        supportsFileShare = false;
      }
      setPreparedPdf(file);
      setCanSharePdf(supportsFileShare);
      setNotice(supportsFileShare
        ? 'PDF pronto. Você pode compartilhar ou baixar.'
        : 'PDF pronto para baixar. O compartilhamento de arquivos não está disponível neste navegador.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível gerar o PDF do ranking.');
    } finally {
      setBusy(false);
    }
  };

  const sharePdf = async () => {
    if (!preparedPdf || !canSharePdf || !navigator.share || sharing) return;
    setSharing(true);
    try {
      await navigator.share({ files: [preparedPdf], title: report.title, text: `${report.title} · ${report.period}` });
      setNotice('PDF enviado para o compartilhamento do aparelho.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setNotice('Compartilhamento cancelado. O PDF continua pronto para baixar.');
      } else {
        setNotice('Não foi possível compartilhar agora. Você ainda pode baixar o PDF.');
      }
    } finally {
      setSharing(false);
    }
  };

  const downloadPdf = () => {
    if (!preparedPdf) return;
    const url = URL.createObjectURL(preparedPdf);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = preparedPdf.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return <div className="ranking-pdf-control" data-html2canvas-ignore="true">
    <div className="ranking-pdf-buttons">
      <button
        type="button"
        className="button ranking-pdf-generate"
        onClick={() => void generatePdf()}
        disabled={busy}
        data-testid={`button-generate-${report.variant}-ranking-pdf`}
      >
        <FileText size={15} aria-hidden="true" />
        {busy ? 'Gerando PDF...' : preparedPdf ? 'Gerar novamente' : 'Gerar PDF'}
      </button>
      {preparedPdf && canSharePdf && <button
        type="button"
        className="button ranking-pdf-share"
        onClick={() => void sharePdf()}
        disabled={sharing}
        data-testid={`button-share-${report.variant}-ranking-pdf`}
      >
        <Share2 size={15} aria-hidden="true" />
        {sharing ? 'Compartilhando...' : 'Compartilhar'}
      </button>}
      {preparedPdf && <button
        type="button"
        className="button ranking-pdf-download"
        onClick={downloadPdf}
        disabled={sharing}
        data-testid={`button-download-${report.variant}-ranking-pdf`}
      >
        <Download size={15} aria-hidden="true" />
        Baixar PDF
      </button>}
    </div>
    {notice && <span className="ranking-pdf-notice" role="status">{notice}</span>}
  </div>;
}
