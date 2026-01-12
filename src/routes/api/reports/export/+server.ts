import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import type { RequestHandler } from './$types.js';
import { json, error } from '@sveltejs/kit';

// Helper functions
const formatCurrency = (amount: number) => `₱${(amount / 100).toFixed(2)}`;
const formatNumber = (num: number) => num.toLocaleString();
const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Color palette for professional reports
const COLORS = {
  primary: '#2563eb',
  secondary: '#64748b',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  dark: '#1e293b',
  light: '#f1f5f9',
  border: '#cbd5e1'
};

async function fetchReportData(period: string, fetch: typeof globalThis.fetch) {
  const response = await fetch(`/api/reports?period=${period}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch report data: ${response.status}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message || 'Failed to fetch report data');
  }
  return result.data;
}

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    const period = url.searchParams.get('period') || 'month';
    const format = url.searchParams.get('format') || 'pdf';

    const data = await fetchReportData(period, fetch);
    const reportTitle = `Library Analytics Report`;
    const periodLabel = getPeriodLabel(period);
    const generatedDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    if (format === 'excel') {
      return await generateExcelReport(data, reportTitle, periodLabel, generatedDate, period);
    } else {
      return await generatePDFReport(data, reportTitle, periodLabel, generatedDate, period);
    }
  } catch (err: any) {
    console.error('Export error:', err);
    throw error(500, { message: err.message || 'Export failed' });
  }
};

function getPeriodLabel(period: string): string {
  switch (period) {
    case 'week': return 'Last 7 Days';
    case 'month': return 'Last 30 Days';
    case 'quarter': return 'Last 3 Months';
    case 'year': return 'Last 12 Months';
    default: return 'Custom Period';
  }
}

// ============================================
// PDF GENERATION WITH PROFESSIONAL LAYOUT
// ============================================

async function generatePDFReport(data: any, title: string, periodLabel: string, generatedDate: string, period: string) {
  if (!data || !data.overview || !data.charts || !data.tables) {
    throw new Error('Invalid data structure received');
  }

  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    info: {
      Title: `${title} - ${periodLabel}`,
      Author: 'i-Kalibro Library System',
      Subject: 'Library Analytics Report'
    }
  });

  let buffers: Buffer[] = [];
  doc.on('data', buffers.push.bind(buffers));

  try {
    // ========== COVER PAGE ==========
    drawCoverPage(doc, title, periodLabel, generatedDate);
    
    doc.addPage();

    // ========== EXECUTIVE SUMMARY ==========
    drawSectionHeader(doc, 'Executive Summary');
    doc.moveDown(0.5);
    
    drawMetricsGrid(doc, data.overview);
    doc.moveDown(2);

    // ========== USAGE TRENDS ==========
    if (data.charts.dailyVisits && data.charts.dailyVisits.length > 0) {
      checkPageBreak(doc, 350);
      drawSectionHeader(doc, 'Usage Trends');
      doc.moveDown(0.5);
      drawLineChart(doc, data.charts.dailyVisits, 'Daily Library Visits');
      doc.moveDown(1);
      drawDailyVisitsTable(doc, data.charts.dailyVisits);
      doc.moveDown(2);
    }

    // ========== CATEGORY DISTRIBUTION ==========
    if (data.charts.categoryDistribution && data.charts.categoryDistribution.length > 0) {
      checkPageBreak(doc, 250);
      drawSectionHeader(doc, 'Collection Distribution');
      doc.moveDown(0.5);
      drawCategoryTable(doc, data.charts.categoryDistribution);
      doc.moveDown(2);
    }

    // ========== TOP BOOKS ==========
    if (data.tables.topBooks && data.tables.topBooks.length > 0) {
      checkPageBreak(doc, 300);
      drawSectionHeader(doc, 'Most Popular Books');
      doc.moveDown(0.5);
      drawTopBooksTable(doc, data.tables.topBooks);
      doc.moveDown(2);
    }

    // ========== OVERDUE BOOKS ==========
    if (data.tables.overdueList && data.tables.overdueList.length > 0) {
      checkPageBreak(doc, 300);
      drawSectionHeader(doc, 'Overdue Items');
      doc.moveDown(0.5);
      drawOverdueTable(doc, data.tables.overdueList);
    }

    // ========== FOOTER ON ALL PAGES ==========
    // Add footers to all pages after content is complete
    const pageRange = doc.bufferedPageRange();
    const totalPages = pageRange.count;
    const startPage = pageRange.start;
    
    for (let pageNum = startPage; pageNum < startPage + totalPages; pageNum++) {
      doc.switchToPage(pageNum);
      const displayPageNum = pageNum === startPage ? 1 : pageNum - startPage + 1; // Cover page shows as page 1
      const displayTotalPages = totalPages - 1; // Don't count cover page in total
      drawFooter(doc, displayPageNum, displayTotalPages);
    }

    doc.end();
    await new Promise(resolve => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(buffers);

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="i-kalibro_report_${period}_${new Date().toISOString().split('T')[0]}.pdf"`
      }
    });
  } catch (pdfError: any) {
    console.error('PDF generation error:', pdfError);
    throw new Error(`PDF generation failed: ${pdfError.message}`);
  }
}

function drawCoverPage(doc: PDFKit.PDFDocument, title: string, periodLabel: string, generatedDate: string) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Header bar
  doc.rect(0, 0, pageWidth, 120).fill('#2563eb');
  
  // System logo/title
  doc.fontSize(36)
     .fillColor('#ffffff')
     .font('Helvetica-Bold')
     .text('i-Kalibro', 50, 40);
  
  doc.fontSize(16)
     .fillColor('#e0e7ff')
     .font('Helvetica')
     .text('Library Management System', 50, 85);

  // Report title
  doc.fontSize(32)
     .fillColor('#1e293b')
     .font('Helvetica-Bold')
     .text(title, 50, 200);

  doc.fontSize(20)
     .fillColor('#64748b')
     .font('Helvetica')
     .text(periodLabel, 50, 245);

  // Info box
  const boxY = 350;
  doc.roundedRect(50, boxY, pageWidth - 100, 120, 5)
     .fillAndStroke('#f8fafc', '#cbd5e1');

  doc.fontSize(12)
     .fillColor('#64748b')
     .font('Helvetica')
     .text('Generated:', 70, boxY + 20);
  
  doc.fontSize(12)
     .fillColor('#1e293b')
     .font('Helvetica-Bold')
     .text(generatedDate, 70, boxY + 40);

  doc.fontSize(12)
     .fillColor('#64748b')
     .font('Helvetica')
     .text('Report Type:', 70, boxY + 70);
  
  doc.fontSize(12)
     .fillColor('#1e293b')
     .font('Helvetica-Bold')
     .text('Comprehensive Analytics', 70, boxY + 90);

  // Footer
  doc.fontSize(10)
     .fillColor('#94a3b8')
     .font('Helvetica')
     .text('Confidential - For Internal Use Only', 50, pageHeight - 100, {
       align: 'center',
       width: pageWidth - 100
     });
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string) {
  const y = doc.y;
  
  doc.fontSize(18)
     .fillColor('#1e293b')
     .font('Helvetica-Bold')
     .text(title, 50, y);
  
  doc.moveTo(50, doc.y + 5)
     .lineTo(doc.page.width - 50, doc.y + 5)
     .strokeColor('#2563eb')
     .lineWidth(2)
     .stroke();
  
  doc.moveDown(0.5);
}

function drawMetricsGrid(doc: PDFKit.PDFDocument, overview: any) {
  const metrics = [
    { label: 'Total Visits', value: formatNumber(overview.totalVisits || 0) },
    { label: 'Transactions', value: formatNumber(overview.totalTransactions || 0) },
    { label: 'Active Borrowings', value: formatNumber(overview.activeBorrowings || 0) },
    { label: 'Overdue Books', value: formatNumber(overview.overdueBooks || 0) },
    { label: 'Total Penalties', value: formatCurrency(overview.totalPenalties || 0) },
    { label: 'Available Books', value: formatNumber(overview.availableBooks || 0) }
  ];

  const startX = 50;
  const startY = doc.y;
  const boxWidth = 160;
  const boxHeight = 70;
  const spacing = 20;
  const cols = 3;

  metrics.forEach((metric, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = startX + col * (boxWidth + spacing);
    const y = startY + row * (boxHeight + spacing);

    // Box with shadow effect
    doc.roundedRect(x + 2, y + 2, boxWidth, boxHeight, 5)
       .fill('#e2e8f0');
    
    doc.roundedRect(x, y, boxWidth, boxHeight, 5)
       .fillAndStroke('#ffffff', '#cbd5e1');

    // Label
    doc.fontSize(9)
       .fillColor('#64748b')
       .font('Helvetica')
       .text(metric.label, x + 15, y + 15, { width: boxWidth - 30 });

    // Value
    doc.fontSize(14)
       .fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text(metric.value, x + 15, y + 30, { width: boxWidth - 30, align: 'center' });
  });

  doc.y = startY + Math.ceil(metrics.length / cols) * (boxHeight + spacing);
}

function drawLineChart(doc: PDFKit.PDFDocument, data: any[], title: string) {
  const chartX = 70;
  const chartY = doc.y;
  const chartWidth = 450;
  const chartHeight = 150;
  
  // Title
  doc.fontSize(12)
     .fillColor('#64748b')
     .font('Helvetica-Bold')
     .text(title, chartX, chartY);

  const graphY = chartY + 25;

  // Chart background
  doc.rect(chartX, graphY, chartWidth, chartHeight)
     .fillAndStroke('#f8fafc', '#cbd5e1');

  // Grid lines
  doc.strokeColor('#e2e8f0').lineWidth(0.5);
  for (let i = 0; i <= 5; i++) {
    const y = graphY + (chartHeight / 5) * i;
    doc.moveTo(chartX, y).lineTo(chartX + chartWidth, y).stroke();
  }

  // Find max value for scaling
  const maxValue = Math.max(...data.map((d: any) => d.count || 0), 1);
  const points: { x: number; y: number }[] = [];

  // Plot data points
  data.forEach((item: any, index: number) => {
    const x = chartX + (chartWidth / (data.length - 1 || 1)) * index;
    const value = item.count || 0;
    const y = graphY + chartHeight - (value / maxValue) * chartHeight;
    points.push({ x, y });
  });

  // Draw line
  if (points.length > 0) {
    doc.moveTo(points[0].x, points[0].y);
    points.forEach((point, index) => {
      if (index > 0) {
        doc.lineTo(point.x, point.y);
      }
    });
    doc.strokeColor('#2563eb').lineWidth(2).stroke();

    // Draw points
    points.forEach(point => {
      doc.circle(point.x, point.y, 3)
         .fillAndStroke('#2563eb', '#1e40af');
    });
  }

  // X-axis labels (show first, middle, last)
  doc.fontSize(8).fillColor('#64748b').font('Helvetica');
  if (data.length > 0) {
    doc.text(formatDate(data[0].date), chartX - 20, graphY + chartHeight + 5, { width: 60, align: 'center' });
    if (data.length > 2) {
      const mid = Math.floor(data.length / 2);
      doc.text(formatDate(data[mid].date), chartX + chartWidth / 2 - 30, graphY + chartHeight + 5, { width: 60, align: 'center' });
    }
    doc.text(formatDate(data[data.length - 1].date), chartX + chartWidth - 30, graphY + chartHeight + 5, { width: 60, align: 'center' });
  }

  doc.y = graphY + chartHeight + 30;
}

function drawDailyVisitsTable(doc: PDFKit.PDFDocument, visits: any[]) {
  const tableX = 70;
  const tableY = doc.y;
  const colWidths = [100, 80, 120, 100];
  const rowHeight = 25;

  // Title
  doc.fontSize(12)
     .fillColor('#64748b')
     .font('Helvetica-Bold')
     .text('Daily Visit Details', tableX, tableY);
  
  const tableStartY = tableY + 20;

  // Header
  doc.rect(tableX, tableStartY, colWidths.reduce((a, b) => a + b), rowHeight)
     .fill('#2563eb');

  doc.fontSize(10)
     .fillColor('#ffffff')
     .font('Helvetica-Bold');
  
  doc.text('Date', tableX + 10, tableStartY + 8, { width: colWidths[0] - 20 });
  doc.text('Visitors', tableX + colWidths[0] + 10, tableStartY + 8, { width: colWidths[1] - 20, align: 'center' });
  doc.text('Day of Week', tableX + colWidths[0] + colWidths[1] + 10, tableStartY + 8, { width: colWidths[2] - 20, align: 'center' });
  doc.text('Trend', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, tableStartY + 8, { width: colWidths[3] - 20, align: 'center' });

  // Calculate average for trend analysis
  const avgVisits = visits.reduce((sum: number, v: any) => sum + (v.count || 0), 0) / visits.length;

  // Rows
  visits.forEach((visit: any, index: number) => {
    const y = tableStartY + rowHeight * (index + 1);
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    
    const date = new Date(visit.date);
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
    const trend = visit.count > avgVisits * 1.2 ? 'Above Average' :
                 visit.count < avgVisits * 0.8 ? 'Below Average' : 'Average';

    doc.rect(tableX, y, colWidths.reduce((a, b) => a + b), rowHeight)
       .fillAndStroke(bgColor, '#e2e8f0');

    doc.fontSize(9)
       .fillColor('#1e293b')
       .font('Helvetica');
    
    doc.text(date.toLocaleDateString('en-US'), tableX + 10, y + 8, { width: colWidths[0] - 20 });
    doc.text(formatNumber(visit.count || 0), tableX + colWidths[0] + 10, y + 8, { width: colWidths[1] - 20, align: 'center' });
    doc.text(dayOfWeek, tableX + colWidths[0] + colWidths[1] + 10, y + 8, { width: colWidths[2] - 20, align: 'center' });
    doc.text(trend, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, y + 8, { width: colWidths[3] - 20, align: 'center' });
  });

  // Summary row
  const summaryY = tableStartY + rowHeight * (visits.length + 1);
  doc.rect(tableX, summaryY, colWidths.reduce((a, b) => a + b), rowHeight)
     .fillAndStroke('#f1f5f9', '#cbd5e1');

  doc.fontSize(9)
     .fillColor('#1e293b')
     .font('Helvetica-Bold');
  
  doc.text('TOTAL', tableX + 10, summaryY + 8, { width: colWidths[0] - 20 });
  doc.text(formatNumber(visits.reduce((sum: number, v: any) => sum + (v.count || 0), 0)), tableX + colWidths[0] + 10, summaryY + 8, { width: colWidths[1] - 20, align: 'center' });
  doc.text('Average', tableX + colWidths[0] + colWidths[1] + 10, summaryY + 8, { width: colWidths[2] - 20, align: 'center' });
  doc.text(avgVisits.toFixed(1), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, summaryY + 8, { width: colWidths[3] - 20, align: 'center' });

  doc.y = summaryY + rowHeight + 10;
}

function drawCategoryTable(doc: PDFKit.PDFDocument, categories: any[]) {
  const tableX = 70;
  const tableY = doc.y;
  const colWidths = [250, 100, 100];
  const rowHeight = 30;

  // Header
  doc.rect(tableX, tableY, colWidths.reduce((a, b) => a + b), rowHeight)
     .fill('#2563eb');

  doc.fontSize(11)
     .fillColor('#ffffff')
     .font('Helvetica-Bold');
  
  doc.text('Category', tableX + 10, tableY + 10, { width: colWidths[0] - 20 });
  doc.text('Books', tableX + colWidths[0] + 10, tableY + 10, { width: colWidths[1] - 20, align: 'center' });
  doc.text('Percentage', tableX + colWidths[0] + colWidths[1] + 10, tableY + 10, { width: colWidths[2] - 20, align: 'center' });

  // Rows
  categories.forEach((cat: any, index: number) => {
    const y = tableY + rowHeight * (index + 1);
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    doc.rect(tableX, y, colWidths.reduce((a, b) => a + b), rowHeight)
       .fillAndStroke(bgColor, '#e2e8f0');

    doc.fontSize(10)
       .fillColor('#1e293b')
       .font('Helvetica');
    
    doc.text(cat.category || 'Unknown', tableX + 10, y + 10, { width: colWidths[0] - 20 });
    doc.text(formatNumber(cat.count || 0), tableX + colWidths[0] + 10, y + 10, { width: colWidths[1] - 20, align: 'center' });
    doc.text(`${cat.percentage || 0}%`, tableX + colWidths[0] + colWidths[1] + 10, y + 10, { width: colWidths[2] - 20, align: 'center' });
  });

  doc.y = tableY + rowHeight * (categories.length + 1) + 10;
}

function drawTopBooksTable(doc: PDFKit.PDFDocument, books: any[]) {
  const tableX = 70;
  const tableY = doc.y;
  const colWidths = [40, 200, 150, 80];
  const rowHeight = 35;

  // Header
  doc.rect(tableX, tableY, colWidths.reduce((a, b) => a + b), rowHeight)
     .fill('#2563eb');

  doc.fontSize(11)
     .fillColor('#ffffff')
     .font('Helvetica-Bold');
  
  doc.text('Rank', tableX + 10, tableY + 12, { width: colWidths[0] - 20, align: 'center' });
  doc.text('Title', tableX + colWidths[0] + 10, tableY + 12, { width: colWidths[1] - 20 });
  doc.text('Author', tableX + colWidths[0] + colWidths[1] + 10, tableY + 12, { width: colWidths[2] - 20 });
  doc.text('Borrows', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, tableY + 12, { width: colWidths[3] - 20, align: 'center' });

  // Rows
  books.slice(0, 10).forEach((book: any, index: number) => {
    const y = tableY + rowHeight * (index + 1);
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    doc.rect(tableX, y, colWidths.reduce((a, b) => a + b), rowHeight)
       .fillAndStroke(bgColor, '#e2e8f0');

    doc.fontSize(10).fillColor('#1e293b');
    
    // Rank with medal for top 3
    doc.font('Helvetica-Bold');
    const medal = index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`;
    doc.text(medal, tableX + 10, y + 12, { width: colWidths[0] - 20, align: 'center' });

    // Title
    doc.font('Helvetica-Bold');
    doc.text(book.title || 'Unknown', tableX + colWidths[0] + 10, y + 8, { width: colWidths[1] - 20, ellipsis: true });
    
    // Author
    doc.font('Helvetica');
    doc.fillColor('#64748b');
    doc.text(book.author || 'Unknown', tableX + colWidths[0] + colWidths[1] + 10, y + 12, { width: colWidths[2] - 20, ellipsis: true });

    // Borrow count
    doc.fillColor('#1e293b');
    doc.font('Helvetica-Bold');
    doc.text(formatNumber(book.borrowCount || 0), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, y + 12, { width: colWidths[3] - 20, align: 'center' });
  });

  doc.y = tableY + rowHeight * (Math.min(books.length, 10) + 1) + 10;
}

function drawOverdueTable(doc: PDFKit.PDFDocument, overdueItems: any[]) {
  const tableX = 70;
  const tableY = doc.y;
  const colWidths = [180, 130, 80, 80];
  const rowHeight = 35;

  // Header
  doc.rect(tableX, tableY, colWidths.reduce((a, b) => a + b), rowHeight)
     .fill('#ef4444');

  doc.fontSize(11)
     .fillColor('#ffffff')
     .font('Helvetica-Bold');
  
  doc.text('Book Title', tableX + 10, tableY + 12, { width: colWidths[0] - 20 });
  doc.text('Borrower', tableX + colWidths[0] + 10, tableY + 12, { width: colWidths[1] - 20 });
  doc.text('Days Late', tableX + colWidths[0] + colWidths[1] + 10, tableY + 12, { width: colWidths[2] - 20, align: 'center' });
  doc.text('Fine', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, tableY + 12, { width: colWidths[3] - 20, align: 'right' });

  // Rows
  overdueItems.slice(0, 10).forEach((item: any, index: number) => {
    const y = tableY + rowHeight * (index + 1);
    const bgColor = index % 2 === 0 ? '#fef2f2' : '#ffffff';

    doc.rect(tableX, y, colWidths.reduce((a, b) => a + b), rowHeight)
       .fillAndStroke(bgColor, '#fecaca');

    doc.fontSize(10);
    
    doc.fillColor('#1e293b').font('Helvetica-Bold');
    doc.text(item.bookTitle || 'Unknown', tableX + 10, y + 8, { width: colWidths[0] - 20, ellipsis: true });
    
    doc.fillColor('#64748b').font('Helvetica');
    doc.text(item.borrowerName || 'Unknown', tableX + colWidths[0] + 10, y + 12, { width: colWidths[1] - 20, ellipsis: true });

    doc.fillColor('#ef4444').font('Helvetica-Bold');
    doc.text(formatNumber(item.daysOverdue || 0), tableX + colWidths[0] + colWidths[1] + 10, y + 12, { width: colWidths[2] - 20, align: 'center' });

    doc.fillColor('#1e293b').font('Helvetica-Bold');
    doc.text(formatCurrency(item.fine || 0), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 10, y + 12, { width: colWidths[3] - 20, align: 'right' });
  });

  doc.y = tableY + rowHeight * (Math.min(overdueItems.length, 10) + 1) + 10;
}

function drawFooter(doc: PDFKit.PDFDocument, pageNum: number, totalPages: number) {
  doc.fontSize(8)
     .fillColor('#94a3b8')
     .font('Helvetica')
     .text(
       `i-Kalibro Library System  •  Page ${pageNum} of ${totalPages}  •  Generated ${new Date().toLocaleDateString()}`,
       50,
       doc.page.height - 30,
       { align: 'center', width: doc.page.width - 100 }
     );
}

function checkPageBreak(doc: PDFKit.PDFDocument, requiredSpace: number) {
  if (doc.y + requiredSpace > doc.page.height - 100) {
    doc.addPage();
  }
}

// ============================================
// EXCEL GENERATION WITH FORMATTING
// ============================================

async function generateExcelReport(data: any, title: string, periodLabel: string, generatedDate: string, period: string) {
  const workbook = XLSX.utils.book_new();

  // ========== OVERVIEW SHEET ==========
  const overviewData = [
    ['i-Kalibro Library Analytics Report'],
    [title],
    [`Period: ${periodLabel}`],
    [`Generated: ${generatedDate}`],
    [''],
    ['KEY METRICS'],
    ['Metric', 'Value', 'Status'],
    ['Total Visits', data.overview.totalVisits.toString(), data.overview.totalVisits > 100 ? 'Active' : 'Normal'],
    ['Total Transactions', data.overview.totalTransactions.toString(), ''],
    ['Active Borrowings', data.overview.activeBorrowings.toString(), ''],
    ['Overdue Books', data.overview.overdueBooks.toString(), data.overview.overdueBooks > 0 ? 'Attention Required' : 'Good'],
    ['Total Penalties', formatCurrency(data.overview.totalPenalties), ''],
    ['Available Books', data.overview.availableBooks.toString(), ''],
    [''],
    ['CATEGORY DISTRIBUTION'],
    ['Category', 'Book Count', 'Percentage', 'Status']
  ];

  data.charts.categoryDistribution.forEach((cat: any) => {
    overviewData.push([
      cat.category,
      cat.count.toString(),
      `${cat.percentage}%`,
      cat.percentage > 15 ? 'Major Category' : 'Minor Category'
    ]);
  });

  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
  
  // Set column widths
  overviewSheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 }
  ];

  // Add table formatting
  overviewSheet['!tables'] = [{
    ref: `A7:D${overviewData.length}`,
    headerRow: true,
    totalsRow: false,
    name: 'OverviewTable'
  }];

  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview');

  // ========== TOP BOOKS SHEET ==========
  if (data.tables.topBooks.length > 0) {
    const booksData = [
      ['MOST POPULAR BOOKS'],
      [`Period: ${periodLabel}`],
      [''],
      ['Rank', 'Title', 'Author', 'Category', 'ISBN', 'Borrow Count', 'Popularity']
    ];

    const maxBorrows = Math.max(...data.tables.topBooks.map((b: any) => b.borrowCount || 0), 1);

    data.tables.topBooks.forEach((book: any, index: number) => {
      const rank = index + 1;
      const medal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : rank.toString();
      const popularity = book.borrowCount >= maxBorrows * 0.7 ? 'Very High' :
                        book.borrowCount >= maxBorrows * 0.4 ? 'High' : 'Moderate';
      
      booksData.push([
        medal,
        book.title,
        book.author || 'Unknown',
        book.category || 'General',
        book.isbn || 'N/A',
        book.borrowCount.toString(),
        popularity
      ]);
    });

    booksData.push(['']);
    booksData.push(['Summary Statistics']);
    booksData.push(['Total Books Listed', data.tables.topBooks.length.toString()]);
    booksData.push(['Total Borrows', data.tables.topBooks.reduce((sum: number, b: any) => sum + (b.borrowCount || 0), 0).toString()]);
    booksData.push(['Average Borrows per Book', (data.tables.topBooks.reduce((sum: number, b: any) => sum + (b.borrowCount || 0), 0) / data.tables.topBooks.length).toFixed(1)]);

    const booksSheet = XLSX.utils.aoa_to_sheet(booksData);
    booksSheet['!cols'] = [
      { wch: 8 },
      { wch: 35 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 }
    ];

    // Add table formatting for books data (excluding header rows)
    const booksTableStart = 4; // After the 3 header rows
    booksSheet['!tables'] = [{
      ref: `A${booksTableStart}:G${booksData.length}`,
      headerRow: true,
      totalsRow: false,
      name: 'TopBooksTable'
    }];

    XLSX.utils.book_append_sheet(workbook, booksSheet, 'Top Books');
  }

  // ========== OVERDUE BOOKS SHEET ==========
  if (data.tables.overdueList.length > 0) {
    const overdueData = [
      ['OVERDUE BOOKS REPORT'],
      [`Period: ${periodLabel}`],
      [`Total Overdue: ${data.tables.overdueList.length}`],
      [''],
      ['Book Title', 'Borrower Name', 'Borrower ID', 'Due Date', 'Days Overdue', 'Fine Amount', 'Severity']
    ];

    data.tables.overdueList.forEach((item: any) => {
      const severity = item.daysOverdue > 30 ? 'Critical' :
                      item.daysOverdue > 14 ? 'High' :
                      item.daysOverdue > 7 ? 'Medium' : 'Low';
      
      overdueData.push([
        item.bookTitle,
        item.borrowerName,
        item.borrowerId || 'N/A',
        item.dueDate || 'N/A',
        item.daysOverdue.toString(),
        formatCurrency(item.fine),
        severity
      ]);
    });

    overdueData.push(['']);
    overdueData.push(['Summary']);
    overdueData.push(['Total Overdue Books', data.tables.overdueList.length.toString()]);
    overdueData.push(['Total Fines', formatCurrency(data.tables.overdueList.reduce((sum: number, i: any) => sum + (i.fine || 0), 0))]);
    overdueData.push(['Average Days Overdue', (data.tables.overdueList.reduce((sum: number, i: any) => sum + (i.daysOverdue || 0), 0) / data.tables.overdueList.length).toFixed(1)]);

    const overdueSheet = XLSX.utils.aoa_to_sheet(overdueData);
    overdueSheet['!cols'] = [
      { wch: 35 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 }
    ];

    // Add table formatting for overdue data (excluding header rows)
    const overdueTableStart = 4; // After the 3 header rows
    overdueSheet['!tables'] = [{
      ref: `A${overdueTableStart}:G${overdueData.length}`,
      headerRow: true,
      totalsRow: false,
      name: 'OverdueBooksTable'
    }];

    XLSX.utils.book_append_sheet(workbook, overdueSheet, 'Overdue Books');
  }

  // ========== DAILY VISITS SHEET ==========
  if (data.charts.dailyVisits.length > 0) {
    const visitsData = [
      ['DAILY VISITS TREND'],
      [`Period: ${periodLabel}`],
      [''],
      ['Date', 'Visit Count', 'Day of Week', 'Trend']
    ];

    const avgVisits = data.charts.dailyVisits.reduce((sum: number, v: any) => sum + (v.count || 0), 0) / data.charts.dailyVisits.length;

    data.charts.dailyVisits.forEach((visit: any) => {
      const date = new Date(visit.date);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const trend = visit.count > avgVisits * 1.2 ? 'Above Average' :
                   visit.count < avgVisits * 0.8 ? 'Below Average' : 'Average';
      
      visitsData.push([
        date.toLocaleDateString('en-US'),
        visit.count.toString(),
        dayOfWeek,
        trend
      ]);
    });

    visitsData.push(['']);
    visitsData.push(['Statistics']);
    visitsData.push(['Total Visits', data.charts.dailyVisits.reduce((sum: number, v: any) => sum + (v.count || 0), 0).toString()]);
    visitsData.push(['Average Daily Visits', avgVisits.toFixed(1)]);
    visitsData.push(['Peak Day Visits', Math.max(...data.charts.dailyVisits.map((v: any) => v.count || 0)).toString()]);
    visitsData.push(['Lowest Day Visits', Math.min(...data.charts.dailyVisits.map((v: any) => v.count || 0)).toString()]);

    const visitsSheet = XLSX.utils.aoa_to_sheet(visitsData);
    visitsSheet['!cols'] = [
      { wch: 15 },
      { wch: 12 },
      { wch: 15 },
      { wch: 20 }
    ];

    // Add table formatting for visits data (excluding header rows)
    const visitsTableStart = 4; // After the 3 header rows
    visitsSheet['!tables'] = [{
      ref: `A${visitsTableStart}:D${visitsData.length}`,
      headerRow: true,
      totalsRow: false,
      name: 'DailyVisitsTable'
    }];

    XLSX.utils.book_append_sheet(workbook, visitsSheet, 'Daily Visits');
  }

  // ========== BORROWING ACTIVITY SHEET ==========
  const activityData = [
    ['BORROWING ACTIVITY SUMMARY'],
    [`Period: ${periodLabel}`],
    [''],
    ['Activity Metric', 'Count', 'Percentage of Total'],
    ['Active Borrowings', data.overview.activeBorrowings.toString(), ''],
    ['Overdue Books', data.overview.overdueBooks.toString(), `${((data.overview.overdueBooks / (data.overview.activeBorrowings || 1)) * 100).toFixed(1)}%`],
    ['On-Time Returns', (data.overview.activeBorrowings - data.overview.overdueBooks).toString(), `${(((data.overview.activeBorrowings - data.overview.overdueBooks) / (data.overview.activeBorrowings || 1)) * 100).toFixed(1)}%`],
    [''],
    ['Financial Summary'],
    ['Total Penalties Collected', formatCurrency(data.overview.totalPenalties), ''],
    ['Average Penalty per Overdue', data.overview.overdueBooks > 0 ? formatCurrency(data.overview.totalPenalties / data.overview.overdueBooks) : formatCurrency(0), ''],
    [''],
    ['Collection Status'],
    ['Available Books', data.overview.availableBooks.toString(), ''],
    ['Books in Circulation', data.overview.activeBorrowings.toString(), ''],
    ['Utilization Rate', '', `${((data.overview.activeBorrowings / ((data.overview.availableBooks + data.overview.activeBorrowings) || 1)) * 100).toFixed(1)}%`]
  ];

  const activitySheet = XLSX.utils.aoa_to_sheet(activityData);
  activitySheet['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 20 }
  ];

  // Add table formatting for activity data (excluding header rows)
  const activityTableStart = 4; // After the 3 header rows
  activitySheet['!tables'] = [{
    ref: `A${activityTableStart}:C${activityData.length}`,
    headerRow: true,
    totalsRow: false,
    name: 'ActivityTable'
  }];

  XLSX.utils.book_append_sheet(workbook, activitySheet, 'Activity Summary');

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new Response(excelBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="i-kalibro_report_${period}_${new Date().toISOString().split('T')[0]}.xlsx"`
    }
  });
}