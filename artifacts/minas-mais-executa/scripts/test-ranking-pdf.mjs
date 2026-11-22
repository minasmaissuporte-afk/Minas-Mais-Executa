import assert from 'node:assert/strict';
import { createRankingPdfBlob } from '../src/lib/ranking-pdf.ts';

const reports = [
  {
    title: 'Ranking geral de lojas',
    period: '01 nov. 2026 a 21 nov. 2026',
    summary: '46 lojas · todas as localizações · todos os supervisores',
    variant: 'stores',
    sections: [{
      columns: [
        { key: 'position', header: 'Pos.', width: 55 },
        { key: 'store', header: 'Loja', width: 440 },
        { key: 'points', header: 'Pontos', width: 270 },
      ],
      rows: Array.from({ length: 46 }, (_, index) => ({
        position: index + 1,
        store: `Loja ${index + 1}`,
        points: `${(740 - index * 10).toLocaleString('pt-BR')} pts`,
      })),
    }],
  },
  {
    title: 'Ranking das lojas por região',
    period: '01 nov. 2026 a 21 nov. 2026',
    summary: '2 regiões · 5 lojas · grupos por supervisor',
    variant: 'regions',
    sections: ['Região 1 · Supervisor A', 'Região 2 · Supervisor B'].map((heading, groupIndex) => ({
      heading,
      columns: [
        { key: 'position', header: 'Pos.', width: 55 },
        { key: 'store', header: 'Loja', width: 500 },
        { key: 'points', header: 'Pontos', width: 210 },
      ],
      rows: Array.from({ length: groupIndex ? 2 : 3 }, (_, index) => ({
        position: index + 1,
        store: `Loja ${groupIndex}-${index}`,
        points: `${580 - index * 20} pts`,
      })),
    })),
  },
  {
    title: 'Ranking dos supervisores',
    period: '01 nov. 2026 a 21 nov. 2026',
    summary: '46 lojas · 24.200 pontos totais · 100% das lojas com tarefa concluída',
    variant: 'supervisors',
    sections: [{
      columns: [
        { key: 'position', header: 'Pos.', width: 55 },
        { key: 'supervisor', header: 'Supervisor', width: 460 },
        { key: 'points', header: 'Pontos', width: 150 },
        { key: 'award', header: 'Faixa', width: 100 },
      ],
      rows: ['Ouro', 'Prata', 'Bronze', 'Cobre'].map((award, index) => ({
        position: index + 1,
        supervisor: `Supervisor ${index + 1}`,
        points: `${(8000 - index * 700).toLocaleString('pt-BR')} pts`,
        award,
      })),
    }],
  },
];

for (const report of reports) {
  const blob = await createRankingPdfBlob(report);
  const output = Buffer.from(await blob.arrayBuffer());
  const text = output.toString('latin1');
  assert.equal(blob.type, 'application/pdf', `${report.title} should be a PDF`);
  assert.ok(output.length > 1_000, `${report.title} should contain the report, not a blank file`);
  assert.ok(text.startsWith('%PDF-'), `${report.title} should have a valid PDF header`);
  assert.ok(text.includes('%%EOF'), `${report.title} should have a complete PDF trailer`);
}

const generalPdf = Buffer.from(await createRankingPdfBlob(reports[0]).then((blob) => blob.arrayBuffer())).toString('latin1');
const pageCount = (generalPdf.match(/\/Type\s*\/Page\b/g) ?? []).length;
assert.ok(pageCount > 1, 'A long general ranking should continue across pages');

console.log('Ranking PDF tests passed: general, regional, supervisor, and multi-page reports generate valid PDFs.');
