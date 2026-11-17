import { writeFileSync } from 'node:fs';

const lines = ['Documento di prova', '', '#SIGN1#', '', '#SIGN2#'];
const content =
  'BT /F1 14 Tf 72 760 Td ' +
  lines.map((l, i) => `(${l}) Tj` + (i < lines.length - 1 ? ' 0 -28 Td' : '')).join(' ') +
  ' ET';

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});

const xref = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
offsets.forEach((o) => (pdf += `${String(o).padStart(10, '0')} 00000 n \n`));
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

const out = new URL('../test/fixtures/document.pdf', import.meta.url);
writeFileSync(out, pdf, 'latin1');
console.log('wrote', out.pathname);
