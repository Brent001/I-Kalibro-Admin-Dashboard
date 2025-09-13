import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ url }) => {
  // Fetch your report data here (replace with your logic)
  const period = url.searchParams.get('period') || 'month';
  // Example data
  const report = {
    title: `Library Report (${period})`,
    generated: new Date().toLocaleString(),
    stats: [
      { label: 'Total Visits', value: 1247 },
      { label: 'Transactions', value: 856 },
      { label: 'Active Borrowings', value: 342 },
      { label: 'Overdue Books', value: 28 },
      { label: 'Total Penalties', value: '₱485,000.00' },
      { label: 'Available Books', value: 8734 }
    ]
  };

  // Create PDF
  const doc = new PDFDocument({ margin: 40 });
  let buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  // Title
  doc.fontSize(20).text(report.title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Generated: ${report.generated}`, { align: 'center' });
  doc.moveDown(2);

  // Stats Table
  doc.fontSize(14).text('Key Metrics:', { underline: true });
  doc.moveDown();
  report.stats.forEach(stat => {
    doc.fontSize(12).text(`${stat.label}: ${stat.value}`);
  });

  doc.end();

  // Wait for PDF to finish
  await new Promise(resolve => doc.on('end', resolve));
  const pdfBuffer = Buffer.concat(buffers);

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="library_report_${period}.pdf"`
    }
  });
};