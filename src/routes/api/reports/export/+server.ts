import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as nodePath from 'path';
import * as XLSX from 'xlsx';
import type { RequestHandler } from './$types.js';
import { error } from '@sveltejs/kit';

import { calculateFineAmount, calculateDaysOverdue, updateAllOverdueFines } from '$lib/server/utils/fineCalculation.js';
import { db } from '$lib/server/db/index.js';
import { tbl_fine, tbl_user } from '$lib/server/db/schema/schema.js';
import { and, gte, lte, eq } from 'drizzle-orm';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCur  = (v: number) => `PHP ${Number(v || 0).toFixed(2)}`;
const fmtNum  = (v: number) => Number(v || 0).toLocaleString();
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDT   = (s: string) => new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function getDateRange(period: string) {
  const now = new Date(), end = new Date(now);
  let start: Date;
  switch (period) {
    case 'week':    start = new Date(now); start.setDate(start.getDate() - 7); break;
    case 'month':   start = new Date(now); start.setMonth(start.getMonth() - 1); break;
    case 'quarter': start = new Date(now); start.setMonth(start.getMonth() - 3); break;
    case 'year':    start = new Date(now); start.setFullYear(start.getFullYear() - 1); break;
    default:        start = new Date(0);
  }
  return { start, end };
}

function getPeriodLabel(period: string) {
  const m: Record<string, string> = {
    week: 'Last 7 Days', month: 'Last 30 Days',
    quarter: 'Last 3 Months', year: 'Last 12 Months',
  };
  return m[period] ?? 'Custom Period';
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  greenDark:  '#14532d',
  green:      '#16a34a',
  greenLight: '#dcfce7',
  gold:       '#ca8a04',
  goldLight:  '#fef9c3',
  amber:      '#d97706',
  yellow:     '#eab308',
  teal:       '#0d9488',
  olive:      '#65a30d',
  purple:     '#7c3aed',
  info:       '#2563eb',
  danger:     '#dc2626',
  dark:       '#1c1917',
  mid:        '#57534e',
  border:     '#d6d3ce',
  stripe:     '#f5f4f0',
  white:      '#ffffff',
};

// ─── PDF Layout Constants ─────────────────────────────────────────────────────
const ML       = 40;
const MR       = 40;
const MT       = 36;
const FOOTER_H = 24;

// ─── PDF State ────────────────────────────────────────────────────────────────
let _pageNum = 0;
let _period  = '';
let _doc: PDFKit.PDFDocument;

function pageW()   { return _doc.page.width; }
function pageH()   { return _doc.page.height; }
function cntW()    { return pageW() - ML - MR; }
function bottomY() { return pageH() - FOOTER_H - 10; }

/**
 * Draw footer in-place without disturbing _doc.y.
 * save/restore + manual y-reset prevents PDFKit from treating
 * footer text as content flow — fixes the blank-page bug.
 */
function drawFooterNow() {
  const savedY = _doc.y;
  const fy = pageH() - FOOTER_H;
  _doc.save();
  _doc.rect(0, fy, pageW(), FOOTER_H).fill('#f0f0ed');
  _doc.moveTo(0, fy).lineTo(pageW(), fy).strokeColor(C.border).lineWidth(0.4).stroke();
  const txt = `e-Kalibro Library Management System  ·  ${getPeriodLabel(_period)}  ·  Page ${_pageNum}`;
  _doc.fontSize(7).fillColor(C.mid).font('Regular')
    .text(txt, ML, fy + 8, { align: 'center', width: cntW(), lineBreak: false });
  _doc.restore();
  _doc.y = savedY;
}

function newPage() {
  _doc.addPage();
  _pageNum++;
  _doc.y = MT;
  drawFooterNow();
}

function need(h: number) {
  if (_doc.y + h > bottomY()) newPage();
}

// ─── Drawing Primitives ───────────────────────────────────────────────────────

function sectionHeader(title: string, sub = '', accent = C.green) {
  const blockH = sub ? 40 : 30;
  need(blockH + 8);
  const y = _doc.y;
  _doc.rect(ML, y, 4, blockH).fill(accent);
  _doc.fontSize(11).fillColor(C.dark).font('Bold')
    .text(title, ML + 11, y + (sub ? 3 : 8), { width: cntW() - 11 });
  if (sub) {
    _doc.fontSize(7.5).fillColor(C.mid).font('Regular')
      .text(sub, ML + 11, y + 18, { width: cntW() - 11 });
  }
  _doc.moveTo(ML, y + blockH + 2).lineTo(pageW() - MR, y + blockH + 2)
    .strokeColor(C.border).lineWidth(0.5).stroke();
  _doc.y = y + blockH + 7;
}

function subLabel(text: string) {
  need(16);
  _doc.fontSize(8).fillColor(C.mid).font('Bold').text(text, ML, _doc.y);
  _doc.y += 11;
}

function emptyBox(msg: string) {
  need(26);
  const y = _doc.y, w = cntW();
  _doc.roundedRect(ML, y, w, 22, 3).fillAndStroke('#fafaf8', C.border);
  _doc.rect(ML, y, 3, 22).fill(C.amber);
  _doc.fontSize(7.5).fillColor(C.mid).font('Regular')
    .text(msg, ML + 10, y + 6, { width: w - 14 });
  _doc.y = y + 28;
}

function metricCards(cards: { label: string; value: string; accent?: string }[]) {
  const cols = 4, gap = 5;
  const cw   = (cntW() - gap * (cols - 1)) / cols;
  const ch   = 44;
  const rows = Math.ceil(cards.length / cols);
  need(rows * (ch + gap));
  const sy = _doc.y;
  cards.forEach((card, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = ML + col * (cw + gap);
    const y = sy + row * (ch + gap);
    const ac = card.accent ?? C.green;
    _doc.roundedRect(x + 1, y + 1, cw, ch, 3).fill('#dedad6');
    _doc.roundedRect(x, y, cw, ch, 3).fillAndStroke(C.white, C.border);
    _doc.roundedRect(x, y, cw, 3, 1).fill(ac);
    _doc.fontSize(5.5).fillColor(C.mid).font('Regular')
      .text(card.label.toUpperCase(), x + 6, y + 9, { width: cw - 12, ellipsis: true });
    _doc.fontSize(11).fillColor(C.dark).font('Bold')
      .text(card.value, x + 6, y + 21, { width: cw - 12, ellipsis: true });
  });
  _doc.y = sy + rows * (ch + gap) + 3;
}

function table(
  headers: string[],
  rows: string[][],
  widths: number[],
  opts: { hBg?: string; sumRow?: string[]; compact?: boolean } = {}
) {
  const hBg = opts.hBg ?? C.green;
  const rh  = opts.compact ? 16 : 20;
  const tW  = widths.reduce((a, b) => a + b, 0);

  need(rh + 2);
  const hy = _doc.y;
  _doc.rect(ML, hy, tW, rh).fill(hBg);
  _doc.fontSize(6.5).fillColor(C.white).font('Bold');
  let hx = ML;
  headers.forEach((h, i) => {
    _doc.text(h, hx + 3, hy + (rh - 7) / 2, { width: widths[i] - 6, ellipsis: true });
    hx += widths[i];
  });
  _doc.y = hy + rh;

  rows.forEach((row, ri) => {
    need(rh + 1);
    const ry = _doc.y;
    _doc.rect(ML, ry, tW, rh).fillAndStroke(ri % 2 === 0 ? C.white : C.stripe, C.border);
    _doc.fontSize(6).fillColor(C.dark).font('Regular');
    let rx = ML;
    row.forEach((cell, ci) => {
      _doc.text(String(cell ?? ''), rx + 3, ry + (rh - 6.5) / 2, { width: widths[ci] - 6, ellipsis: true });
      rx += widths[ci];
    });
    _doc.y = ry + rh;
  });

  if (opts.sumRow) {
    need(rh + 1);
    const sy = _doc.y;
    _doc.rect(ML, sy, tW, rh).fillAndStroke(C.goldLight, C.gold);
    _doc.fontSize(6.5).fillColor(C.greenDark).font('Bold');
    let sx = ML;
    opts.sumRow.forEach((cell, ci) => {
      _doc.text(String(cell ?? ''), sx + 3, sy + (rh - 6.5) / 2, { width: widths[ci] - 6, ellipsis: true });
      sx += widths[ci];
    });
    _doc.y = sy + rh;
  }
  _doc.y += 6;
}

function barChart(
  title: string,
  items: { label: string; value: number; color?: string }[],
  barH = 13
) {
  if (!items.length) return;
  const gap   = 3, labelW = 96, valW = 42;
  const aW    = cntW() - labelW - valW;
  const tot   = (title ? 14 : 0) + items.length * (barH + gap) + 4;
  need(tot);
  if (title) {
    _doc.fontSize(7.5).fillColor(C.mid).font('Bold').text(title, ML, _doc.y);
    _doc.y += 12;
  }
  const maxV = Math.max(...items.map(i => i.value), 1);
  items.forEach(item => {
    const y = _doc.y, bW = Math.max((item.value / maxV) * aW, 0);
    _doc.fontSize(6).fillColor(C.dark).font('Regular')
      .text(item.label, ML, y + 1, { width: labelW - 4, ellipsis: true });
    _doc.roundedRect(ML + labelW, y, aW, barH, 2).fill('#e8e5e0');
    if (bW > 0) _doc.roundedRect(ML + labelW, y, bW, barH, 2).fill(item.color ?? C.green);
    _doc.fontSize(6).fillColor(C.dark).font('Bold')
      .text(item.value.toLocaleString(), ML + labelW + aW + 3, y + 1, { width: valW - 3 });
    _doc.y = y + barH + gap;
  });
  _doc.y += 3;
}

/**
 * Sparkline — fully guarded:
 *  • empty/single-point arrays skipped
 *  • zero-range (all equal values) expanded so toY() is always finite
 *  • indexOf / lastIndexOf results checked before array access
 *  • pts[n] verified before drawing dots/labels
 */
function sparkLine(
  title: string,
  points: number[],
  color  = C.green,
  chartH = 58
) {
  if (!points || points.length < 2) return;

  const w = cntW();
  need(chartH + (title ? 16 : 4) + 6);

  if (title) {
    _doc.fontSize(7.5).fillColor(C.mid).font('Bold').text(title, ML, _doc.y);
    _doc.y += 12;
  }

  const cy = _doc.y;
  _doc.rect(ML, cy, w, chartH).fillAndStroke('#f8f7f3', C.border);

  const rawMax = Math.max(...points);
  const rawMin = Math.min(...points);
  // When all values are equal, expand range by 1 downward so toY() is always valid
  const minV   = rawMax === rawMin ? Math.max(0, rawMin - 1) : rawMin;
  const rng    = rawMax - minV || 1;
  const pad    = 7;

  const toX = (i: number) =>
    ML + pad + (i / Math.max(points.length - 1, 1)) * (w - pad * 2);
  const toY = (v: number) =>
    cy + chartH - pad - ((v - minV) / rng) * (chartH - pad * 2);

  // Grid lines
  _doc.strokeColor('#e8e5e0').lineWidth(0.3);
  [0.25, 0.5, 0.75].forEach(f => {
    const gy = cy + f * chartH;
    _doc.moveTo(ML + pad, gy).lineTo(ML + w - pad, gy).stroke();
    _doc.fontSize(5).fillColor('#aaa8a3').font('Regular')
      .text(Math.round(minV + f * rng).toString(), ML + 1, gy - 3, { width: pad - 1 });
  });

  const pts = points.map((v, i) => ({ x: toX(i), y: toY(v) }));

  // Area fill
  _doc.save();
  _doc.moveTo(pts[0].x, cy + chartH - pad);
  _doc.lineTo(pts[0].x, pts[0].y);
  pts.forEach((p, i) => { if (i > 0) _doc.lineTo(p.x, p.y); });
  _doc.lineTo(pts[pts.length - 1].x, cy + chartH - pad);
  _doc.closePath().fill(`${color}22`);
  _doc.restore();

  // Line
  _doc.moveTo(pts[0].x, pts[0].y);
  pts.forEach((p, i) => { if (i > 0) _doc.lineTo(p.x, p.y); });
  _doc.strokeColor(color).lineWidth(1.6).stroke();

  // High/low dots — use lastIndexOf for min so it differs from max when possible
  const maxIdx = points.indexOf(rawMax);
  const minIdx = points.lastIndexOf(rawMin);
  const ptMax  = maxIdx >= 0 ? pts[maxIdx] : undefined;
  const ptMin  = (minIdx >= 0 && minIdx !== maxIdx) ? pts[minIdx] : undefined;

  if (ptMax) {
    _doc.circle(ptMax.x, ptMax.y, 2.5).fillAndStroke(C.green, C.white);
    const off = ptMax.x > ML + w - 44 ? -36 : 4;
    _doc.fontSize(5.5).fillColor(C.mid).font('Regular')
      .text(`High: ${rawMax}`, ptMax.x + off, ptMax.y - 9, { width: 32 });
  }
  if (ptMin) {
    _doc.circle(ptMin.x, ptMin.y, 2.5).fillAndStroke(C.amber, C.white);
    const off = ptMin.x > ML + w - 44 ? -36 : 4;
    _doc.fontSize(5.5).fillColor(C.mid).font('Regular')
      .text(`Low: ${rawMin}`, ptMin.x + off, ptMin.y + 2, { width: 32 });
  }

  _doc.y = cy + chartH + 8;
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function drawCover(periodLabel: string, generatedDate: string, logoPath?: string) {
  const pw = pageW(), ph = pageH();

  // Header band
  _doc.rect(0, 0, pw, 125).fill(C.greenDark);
  _doc.rect(0, 125, pw, 5).fill(C.gold);

  // Logo — embed image if file exists, else fall back to text mark
  const logoSize = 60;
  const logoX    = ML;
  const logoY    = 32;
  let   logoLoaded = false;

  if (logoPath) {
    try {
      if (fs.existsSync(logoPath)) {
        _doc.image(logoPath, logoX, logoY, {
          width:  logoSize,
          height: logoSize,
          fit:    [logoSize, logoSize],
        });
        logoLoaded = true;
      }
    } catch { /* fall through to text fallback */ }
  }

  // Text block — shift right if logo was embedded
  const textX = logoLoaded ? logoX + logoSize + 10 : logoX + 16;
  if (!logoLoaded) {
    // Accent bar fallback when no logo
    _doc.rect(logoX, logoY, 4, 56).fill(C.goldLight);
  }

  _doc.fontSize(28).fillColor(C.white).font('Bold')
    .text('e-Kalibro', textX, 36);
  _doc.fontSize(10).fillColor(C.goldLight).font('Regular')
    .text('Library Management System', textX + 2, 76);

  _doc.fontSize(23).fillColor(C.dark).font('Bold').text('Library Analytics Report', ML, 158);
  _doc.fontSize(12).fillColor(C.gold).font('Bold').text(periodLabel.toUpperCase(), ML, 190);

  const bx = ML, by = 238, bw = pw - ML - MR, bh = 88;
  _doc.roundedRect(bx, by, bw, bh, 5).fillAndStroke(C.greenLight, C.green);
  _doc.rect(bx, by, 4, bh).fill(C.green);
  _doc.fontSize(7.5).fillColor(C.mid).font('Regular').text('Generated',   bx + 12, by + 12);
  _doc.fontSize(10).fillColor(C.dark).font('Bold').text(generatedDate,     bx + 12, by + 23);
  _doc.fontSize(7.5).fillColor(C.mid).font('Regular').text('Report Type', bx + 12, by + 50);
  _doc.fontSize(10).fillColor(C.dark).font('Bold')
    .text('Comprehensive Full-System Analytics', bx + 12, by + 61);

  _doc.rect(0, ph - 38, pw, 38).fill('#f2f8f2');
  _doc.fontSize(7).fillColor(C.mid).font('Regular')
    .text('CONFIDENTIAL — FOR INTERNAL USE ONLY', ML, ph - 20,
      { align: 'center', width: pw - ML - MR });
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

async function generatePDF(
  data: any, periodLabel: string, generatedDate: string, period: string
): Promise<Response> {
  if (!data?.overview || !data?.charts || !data?.tables) throw new Error('Invalid data structure');

  _period  = period;
  _pageNum = 0;

  _doc = new PDFDocument({
    margin: 0,
    size: 'A4',
    autoFirstPage: false,
    bufferPages: false,
    info: { Title: `e-Kalibro Analytics - ${periodLabel}`, Author: 'e-Kalibro' },
  });

  try {
    _doc.registerFont('Regular', 'C:/Windows/Fonts/arial.ttf');
    _doc.registerFont('Bold',    'C:/Windows/Fonts/arialbd.ttf');
  } catch { /* Helvetica fallback */ }

  const buffers: Buffer[] = [];
  _doc.on('data', (b: Buffer) => buffers.push(b));

  const ov = data.overview;

  // Cover (no page number)
  // Resolve logo path relative to project static/assets directory
  const logoPath = nodePath.resolve('static/assets/logo.png');
  _doc.addPage();
  drawCover(periodLabel, generatedDate, logoPath);

  newPage(); // page 1

  // ── SECTION 1: EXECUTIVE SUMMARY ─────────────────────────────────────────
  sectionHeader('1. Executive Summary', `Analytics for ${periodLabel}`, C.greenDark);
  metricCards([
    { label: 'Total Visits',         value: fmtNum(ov.totalVisits               ?? 0), accent: C.info   },
    { label: 'Active Members',       value: fmtNum(ov.activeMembers             ?? 0), accent: C.green  },
    { label: 'Active Borrowings',    value: fmtNum(ov.activeBorrowings          ?? 0), accent: C.teal   },
    { label: 'Total Overdue',        value: fmtNum(ov.totalOverdue              ?? 0), accent: C.danger },
    { label: 'Pending Reservations', value: fmtNum(ov.totalPendingReservations  ?? 0), accent: C.amber  },
    { label: 'Pending Returns',      value: fmtNum(ov.totalPendingReturnRequests?? 0), accent: C.gold   },
    { label: 'Paid Fines',           value: fmtCur(ov.totalPaidFines            ?? 0), accent: C.green  },
    { label: 'Unpaid Fines',         value: fmtCur(ov.totalUnpaidFines          ?? 0), accent: C.danger },
  ]);
  _doc.y += 3;
  metricCards([
    { label: 'Total Books',      value: fmtNum(ov.totalBooks          ?? 0), accent: C.info   },
    { label: 'Total Magazines',  value: fmtNum(ov.totalMagazines      ?? 0), accent: C.purple },
    { label: 'Total Theses',     value: fmtNum(ov.totalTheses         ?? 0), accent: C.teal   },
    { label: 'Total Journals',   value: fmtNum(ov.totalJournals       ?? 0), accent: C.olive  },
    { label: 'Total Members',    value: fmtNum(ov.totalMembers        ?? 0), accent: C.green  },
    { label: 'Total Staff',      value: fmtNum(ov.totalStaff          ?? 0), accent: C.gold   },
    { label: 'Available Copies', value: fmtNum(ov.availableBookCopies ?? 0), accent: C.teal   },
    { label: 'New Members',      value: fmtNum(ov.newMembers          ?? 0), accent: C.amber  },
  ]);
  _doc.y += 8;

  // ── SECTION 2: VISIT TRENDS ───────────────────────────────────────────────
  sectionHeader('2. Library Visit Trends', 'Daily foot traffic', C.green);
  const dv: any[] = data.charts.dailyVisits ?? [];
  if (dv.length > 1) {
    sparkLine('Daily Visitor Count', dv.map(v => v.count ?? 0), C.green, 58);
    const avgV   = dv.reduce((s, v) => s + (v.count ?? 0), 0) / dv.length;
    const totalV = dv.reduce((s, v) => s + (v.count ?? 0), 0);
    table(
      ['Date', 'Day', 'Visitors', 'Trend'],
      dv.map(v => {
        const d = new Date(v.date);
        const t = v.count > avgV * 1.2 ? 'Above Avg' : v.count < avgV * 0.8 ? 'Below Avg' : 'Average';
        return [d.toLocaleDateString('en-US'), d.toLocaleDateString('en-US', { weekday: 'short' }), fmtNum(v.count ?? 0), t];
      }),
      [114, 66, 76, 84],
      { hBg: C.green, sumRow: ['TOTAL', '', fmtNum(totalV), `Avg: ${avgV.toFixed(1)}`], compact: true }
    );
  } else {
    emptyBox('No visit data available for this period.');
  }
  _doc.y += 4;

  // ── SECTION 3: BORROWING ACTIVITY ────────────────────────────────────────
  sectionHeader('3. Borrowing Activity', 'Summary by item type', C.teal);
  const bTypes = [
    { label: 'Books',     data: data.tables.bookBorrowings     ?? [], color: C.info   },
    { label: 'Magazines', data: data.tables.magazineBorrowings ?? [], color: C.purple },
    { label: 'Theses',    data: data.tables.thesisBorrowings   ?? [], color: C.teal   },
    { label: 'Journals',  data: data.tables.journalBorrowings  ?? [], color: C.amber  },
  ];
  const totalB = bTypes.reduce((s, b) => s + b.data.length, 0);
  if (totalB === 0) {
    emptyBox('No borrowing records found for this period.');
  } else {
    barChart('Active Borrowings by Item Type',
      bTypes.map(b => ({ label: b.label, value: b.data.filter((i: any) => i.status === 'borrowed').length, color: b.color }))
    );
    const sRows = bTypes.map(b => {
      const d = b.data;
      return [b.label, String(d.length),
        String(d.filter((i: any) => i.status === 'borrowed').length),
        String(d.filter((i: any) => i.status === 'returned').length),
        String(d.filter((i: any) => i.status === 'overdue').length)];
    });
    const tot = sRows.reduce(
      (a, r) => ['', String(+a[1]+ +r[1]), String(+a[2]+ +r[2]), String(+a[3]+ +r[3]), String(+a[4]+ +r[4])],
      ['', '0', '0', '0', '0']
    );
    table(['Item Type', 'Total', 'Active', 'Returned', 'Overdue'], sRows, [108, 72, 72, 78, 72],
      { hBg: C.teal, sumRow: ['TOTAL', tot[1], tot[2], tot[3], tot[4]] });
    _doc.y += 2;
    for (const b of bTypes) {
      const sl = b.data.slice(0, 10);
      subLabel(`${b.label} — Recent Borrowings (top 10)`);
      if (!sl.length) {
        emptyBox(`No ${b.label.toLowerCase()} borrowings found for this period.`);
      } else {
        table(
          ['Title', 'Borrower', 'Borrowed', 'Due', 'Status'],
          sl.map((i: any) => [
            i.title ?? i.bookTitle ?? i.magazineTitle ?? i.thesisTitle ?? i.journalTitle ?? 'N/A',
            i.borrowerName ?? i.userName ?? 'N/A',
            i.borrowDate ? fmtDate(i.borrowDate) : 'N/A',
            i.dueDate    ? fmtDate(i.dueDate)    : 'N/A',
            (i.status ?? 'N/A').toUpperCase(),
          ]),
          [156, 102, 62, 62, 54],
          { hBg: C.teal, compact: true }
        );
      }
    }
  }
  _doc.y += 4;

  // ── SECTION 4: RESERVATIONS ───────────────────────────────────────────────
  sectionHeader('4. Reservation Activity', '', C.amber);
  const rTypes = [
    { label: 'Books',     data: data.tables.bookReservations     ?? [] },
    { label: 'Magazines', data: data.tables.magazineReservations ?? [] },
    { label: 'Theses',    data: data.tables.thesisReservations   ?? [] },
    { label: 'Journals',  data: data.tables.journalReservations  ?? [] },
  ];
  if (rTypes.reduce((s, r) => s + r.data.length, 0) === 0) {
    emptyBox('No reservation records found for this period.');
  } else {
    const ss = ['pending', 'approved', 'rejected', 'fulfilled', 'expired', 'cancelled'];
    table(
      ['Type', 'Total', 'Pending', 'Approved', 'Rejected', 'Fulfilled', 'Expired', 'Cancelled'],
      rTypes.map(r => [r.label, String(r.data.length), ...ss.map(s => String(r.data.filter((i: any) => i.status === s).length))]),
      [68, 42, 50, 56, 54, 58, 50, 58],
      { hBg: C.amber }
    );
  }
  _doc.y += 6;

  // ── SECTION 5: RETURN REQUESTS ────────────────────────────────────────────
  sectionHeader('5. Return Requests', '', C.olive);
  const retTypes = [
    { label: 'Books',     data: data.tables.bookReturnRequests     ?? [] },
    { label: 'Magazines', data: data.tables.magazineReturnRequests ?? [] },
    { label: 'Theses',    data: data.tables.thesisReturnRequests   ?? [] },
    { label: 'Journals',  data: data.tables.journalReturnRequests  ?? [] },
  ];
  if (retTypes.reduce((s, r) => s + r.data.length, 0) === 0) {
    emptyBox('No return request records found for this period.');
  } else {
    table(
      ['Type', 'Total', 'Pending', 'Approved', 'Rejected', 'Damaged', 'Lost'],
      retTypes.map(r => [r.label, String(r.data.length),
        String(r.data.filter((i: any) => i.status === 'pending').length),
        String(r.data.filter((i: any) => i.status === 'approved').length),
        String(r.data.filter((i: any) => i.status === 'rejected').length),
        String(r.data.filter((i: any) => i.condition === 'damaged').length),
        String(r.data.filter((i: any) => i.condition === 'lost').length)]),
      [78, 48, 58, 62, 62, 60, 50],
      { hBg: C.olive }
    );
  }
  _doc.y += 6;

  // ── SECTION 6: OVERDUE ITEMS ──────────────────────────────────────────────
  sectionHeader('6. Overdue Items', `${data.tables.overdueList?.length ?? 0} item(s) currently overdue`, C.danger);
  const od: any[] = data.tables.overdueList ?? [];
  if (!od.length) {
    emptyBox('No overdue items for this period — great!');
  } else {
    barChart('Overdue Severity Distribution', [
      { label: 'Critical (>30 days)', value: od.filter(i => (i.daysOverdue ?? 0) > 30).length,                                          color: '#991b1b' },
      { label: 'High (15-30 days)',   value: od.filter(i => (i.daysOverdue ?? 0) > 14 && (i.daysOverdue ?? 0) <= 30).length,           color: C.danger  },
      { label: 'Medium (8-14 days)', value: od.filter(i => (i.daysOverdue ?? 0) > 7  && (i.daysOverdue ?? 0) <= 14).length,           color: C.amber   },
      { label: 'Low (1-7 days)',      value: od.filter(i => (i.daysOverdue ?? 0) <= 7).length,                                          color: C.yellow  },
    ]);
    const totalFine = od.reduce((s, i) => s + (i.fine ?? 0), 0);
    table(
      ['Title', 'Type', 'Borrower', 'Days', 'Hours', 'Fine (PHP)'],
      od.slice(0, 20).map(i => [
        i.bookTitle ?? i.itemTitle ?? 'N/A', i.itemType ?? 'book',
        i.borrowerName ?? 'N/A', String(i.daysOverdue ?? 0),
        String(i.hoursOverdue ?? 0), fmtCur(i.fine ?? 0),
      ]),
      [138, 48, 110, 50, 46, 78],
      { hBg: C.danger, sumRow: ['TOTAL', '', '', '', '', fmtCur(totalFine)] }
    );
  }
  _doc.y += 6;

  // ── SECTION 7: FINES & PAYMENTS ───────────────────────────────────────────
  sectionHeader('7. Fines & Payments', '', C.gold);
  const fines: any[] = data.tables.fines ?? [];
  if (!fines.length) {
    emptyBox('No fine records found for this period.');
  } else {
    const paid   = fines.filter(f => f.status === 'paid').reduce((s, f)   => s + Number(f.fineAmount ?? 0), 0);
    const unpaid = fines.filter(f => f.status === 'unpaid').reduce((s, f) => s + Number(f.fineAmount ?? 0), 0);
    const total  = fines.reduce((s, f) => s + Number(f.fineAmount ?? 0), 0);
    metricCards([
      { label: 'Total Fine Amount', value: fmtCur(total),        accent: C.danger },
      { label: 'Collected (Paid)',  value: fmtCur(paid),         accent: C.green  },
      { label: 'Outstanding',       value: fmtCur(unpaid),       accent: C.amber  },
      { label: 'Total Records',     value: String(fines.length), accent: C.gold   },
    ]);
    _doc.y += 4;
    table(
      ['Borrower', 'Item Type', 'Amount (PHP)', 'Status', 'Date'],
      fines.slice(0, 20).map(f => [
        f.userName ?? 'N/A', f.itemType ?? 'N/A',
        fmtCur(Number(f.fineAmount ?? 0)), (f.status ?? 'N/A').toUpperCase(),
        f.calculatedAt ? fmtDate(f.calculatedAt) : 'N/A',
      ]),
      [138, 74, 94, 70, 80],
      { hBg: C.gold, sumRow: ['TOTAL', '', fmtCur(total), `Paid: ${fmtCur(paid)}`, `Unpaid: ${fmtCur(unpaid)}`] }
    );
  }
  subLabel('Payment Records (top 20)');
  const pays: any[] = data.tables.payments ?? [];
  if (!pays.length) {
    emptyBox('No payment records found for this period.');
  } else {
    const tc = pays.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    table(
      ['Member', 'Amount (PHP)', 'Type', 'Method', 'Date', 'Staff'],
      pays.slice(0, 20).map(p => [
        p.userName ?? 'N/A', fmtCur(p.amount ?? 0),
        (p.paymentType ?? 'N/A').toLowerCase(), (p.paymentMethod ?? 'cash').toLowerCase(),
        p.paymentDate ? fmtDate(p.paymentDate) : 'N/A', p.receivedBy ?? 'N/A',
      ]),
      [120, 88, 62, 62, 76, 78],
      { hBg: C.green, sumRow: ['TOTAL COLLECTED', fmtCur(tc), '', '', '', ''] }
    );
  }
  _doc.y += 6;

  // ── SECTION 8: COLLECTION OVERVIEW ───────────────────────────────────────
  sectionHeader('8. Collection Overview', '', C.purple);
  const cats: any[] = data.charts.categoryDistribution ?? [];
  if (!cats.length) {
    emptyBox('No category distribution data available.');
  } else {
    barChart('Top Categories by Item Count',
      cats.slice(0, 10).map(c => ({ label: c.category ?? 'Unknown', value: c.count ?? 0, color: C.purple }))
    );
    table(
      ['Category', 'Count', 'Share %'],
      cats.slice(0, 10).map(c => [c.category ?? 'Unknown', fmtNum(c.count ?? 0), `${c.percentage ?? 0}%`]),
      [250, 84, 78],
      { hBg: C.purple, compact: true }
    );
  }
  table(
    ['Item Type', 'Total Titles', 'Available Copies'],
    [
      ['Books',     fmtNum(ov.totalBooks     ?? 0), fmtNum(ov.availableBookCopies     ?? 0)],
      ['Magazines', fmtNum(ov.totalMagazines ?? 0), fmtNum(ov.availableMagazineCopies ?? 0)],
      ['Theses',    fmtNum(ov.totalTheses    ?? 0), fmtNum(ov.availableThesisCopies   ?? 0)],
      ['Journals',  fmtNum(ov.totalJournals  ?? 0), fmtNum(ov.availableJournalCopies  ?? 0)],
    ],
    [158, 150, 150],
    { hBg: C.purple }
  );
  _doc.y += 6;

  // ── SECTION 9: POPULAR ITEMS ──────────────────────────────────────────────
  sectionHeader('9. Most Popular Items', 'Ranked by borrow count', C.green);
  const popDefs = [
    { name: 'Books',     key: 'topBooks',     color: C.info   },
    { name: 'Magazines', key: 'topMagazines', color: C.purple },
    { name: 'Theses',    key: 'topTheses',    color: C.teal   },
    { name: 'Journals',  key: 'topJournals',  color: C.amber  },
  ];
  for (const pd of popDefs) {
    const items: any[] = data.tables[pd.key] ?? [];
    subLabel(`Top 10 ${pd.name}`);
    if (!items.length) {
      emptyBox(`No popular ${pd.name.toLowerCase()} data available for this period.`);
    } else {
      barChart('', items.slice(0, 10).map(i => ({
        label: (i.title ?? 'N/A').slice(0, 32), value: i.borrowCount ?? 0, color: pd.color,
      })));
    }
  }
  _doc.y += 6;

  // ── SECTION 10: MEMBERS & STAFF ───────────────────────────────────────────
  sectionHeader('10. Members & Staff', '', C.teal);
  subLabel('Recently Registered Members');
  const mem: any[] = data.tables.recentMembers ?? [];
  if (!mem.length) {
    emptyBox('No new members registered in this period.');
  } else {
    table(
      ['Name', 'Type', 'Email', 'Joined', 'Status'],
      mem.slice(0, 15).map(m => [
        m.name ?? 'N/A', m.userType ?? 'N/A', m.email ?? 'N/A',
        m.createdAt ? fmtDate(m.createdAt) : 'N/A',
        m.isActive ? 'ACTIVE' : 'INACTIVE',
      ]),
      [112, 58, 128, 76, 60],
      { hBg: C.teal, compact: true }
    );
  }
  subLabel('Staff Directory');
  const stf: any[] = data.tables.staffList ?? [];
  if (!stf.length) {
    emptyBox('No staff records found.');
  } else {
    table(
      ['Name', 'Department', 'Position', 'Email', 'Status'],
      stf.map(s => [
        s.name ?? 'N/A', s.department ?? 'N/A', s.position ?? 'N/A',
        s.email ?? 'N/A', s.isActive ? 'ACTIVE' : 'INACTIVE',
      ]),
      [110, 93, 93, 118, 54],
      { hBg: C.teal, compact: true }
    );
  }

  _doc.end();
  await new Promise(resolve => _doc.on('end', resolve));

  return new Response(Buffer.concat(buffers), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="e-kalibro_report_${period}_${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}

// ─── Excel ────────────────────────────────────────────────────────────────────

function xlSheet(
  titleRows: any[][],
  headers: string[],
  dataRows: any[][],
  colWidths: number[],
  tableName: string,
  opts: { extra?: any[][]; emptyMsg?: string } = {}
): XLSX.WorkSheet {
  const noData  = dataRows.length === 0;
  const tRows   = noData
    ? [[opts.emptyMsg ?? 'No data available for this report.', ...Array(Math.max(headers.length - 1, 0)).fill('')]]
    : dataRows;
  const hIdx    = titleRows.length;
  const allRows = [...titleRows, headers, ...tRows, ...(opts.extra ?? [])];
  const ws      = XLSX.utils.aoa_to_sheet(allRows);
  ws['!cols']   = colWidths.map(w => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: hIdx + 1 };
  if (!noData) {
    const ref  = XLSX.utils.encode_range({ s: { r: hIdx, c: 0 }, e: { r: hIdx + tRows.length, c: headers.length - 1 } });
    const safe = tableName.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 30);
    ws['!tables'] = [{ name: safe, ref, headerRow: true, totalsRow: false, tableStyleInfo: { name: 'TableStyleMedium2', showRowStripes: true, showFirstColumn: false, showLastColumn: false, showColumnStripes: false } }];
  }
  return ws;
}

async function generateExcel(
  data: any, periodLabel: string, generatedDate: string, period: string
): Promise<Response> {
  const wb  = XLSX.utils.book_new();
  const ov  = data.overview;
  const hdr = [`Period: ${periodLabel}`, '', `Generated: ${generatedDate}`];

  // Overview
  {
    const mData: any[][] = [
      ['Total Visits',             ov.totalVisits               ?? 0],
      ['Active Members',           ov.activeMembers             ?? 0],
      ['Total Members',            ov.totalMembers              ?? 0],
      ['New Members (Period)',      ov.newMembers                ?? 0],
      ['Active Borrowings',        ov.activeBorrowings          ?? 0],
      ['Returned (Period)',         ov.totalReturnedPeriod       ?? 0],
      ['Total Overdue',            ov.totalOverdue              ?? 0],
      ['Pending Reservations',     ov.totalPendingReservations  ?? 0],
      ['Pending Return Requests',  ov.totalPendingReturnRequests?? 0],
      ['Paid Fines (PHP)',         fmtCur(ov.totalPaidFines     ?? 0)],
      ['Unpaid Fines (PHP)',       fmtCur(ov.totalUnpaidFines   ?? 0)],
      ['Payments Count',           ov.paymentsCount             ?? 0],
    ];
    const cats = (data.charts.categoryDistribution ?? []).map((c: any) => [c.category, c.count, `${c.percentage ?? 0}%`]);
    const rows: any[][] = [
      ['e-Kalibro Library Analytics Report'], hdr, [],
      ['KEY METRICS'], ['Metric', 'Value'], ...mData, [],
      ['COLLECTION SUMMARY'], ['Item Type', 'Total Titles', 'Available Copies'],
      ['Books',     ov.totalBooks     ?? 0, ov.availableBookCopies     ?? 0],
      ['Magazines', ov.totalMagazines ?? 0, ov.availableMagazineCopies ?? 0],
      ['Theses',    ov.totalTheses    ?? 0, ov.availableThesisCopies   ?? 0],
      ['Journals',  ov.totalJournals  ?? 0, ov.availableJournalCopies  ?? 0], [],
      ['CATEGORY DISTRIBUTION'], ['Category', 'Count', 'Share %'],
      ...(cats.length ? cats : [['No category data available', '', '']]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']   = [{ wch: 34 }, { wch: 22 }, { wch: 22 }, { wch: 14 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 4 };
    ws['!tables'] = [{ name: 'KeyMetrics', ref: `A5:B${5 + mData.length - 1}`, headerRow: true, totalsRow: false, tableStyleInfo: { name: 'TableStyleMedium7', showRowStripes: true } }];
    XLSX.utils.book_append_sheet(wb, ws, 'Overview');
  }

  for (const def of [
    { key: 'bookBorrowings',     label: 'Book Borrowings'     },
    { key: 'magazineBorrowings', label: 'Magazine Borrowings' },
    { key: 'thesisBorrowings',   label: 'Thesis Borrowings'   },
    { key: 'journalBorrowings',  label: 'Journal Borrowings'  },
  ]) {
    const items: any[] = data.tables[def.key] ?? [];
    const act = items.filter(i => i.status === 'borrowed').length;
    const ret = items.filter(i => i.status === 'returned').length;
    const ovd = items.filter(i => i.status === 'overdue').length;
    const ws  = xlSheet(
      [[def.label.toUpperCase()], hdr, [`Total: ${items.length}  |  Active: ${act}  |  Returned: ${ret}  |  Overdue: ${ovd}`], []],
      ['Title', 'Borrower', 'Borrower Type', 'Copy / Call No', 'Borrow Date', 'Due Date', 'Return Date', 'Status', 'Approved By'],
      items.map(i => [
        i.title ?? i.bookTitle ?? i.magazineTitle ?? i.thesisTitle ?? i.journalTitle ?? 'N/A',
        i.borrowerName ?? i.userName  ?? 'N/A',
        i.borrowerType ?? i.userType  ?? 'N/A',
        i.callNumber   ?? i.copyNumber ?? 'N/A',
        i.borrowDate ? fmtDT(i.borrowDate) : 'N/A',
        i.dueDate    ? fmtDT(i.dueDate)    : 'N/A',
        i.returnDate ? fmtDT(i.returnDate) : '',
        (i.status ?? 'N/A').toUpperCase(),
        i.approvedByName ?? 'N/A',
      ]),
      [35, 26, 16, 18, 22, 22, 22, 14, 22], def.label,
      {
        emptyMsg: `No ${def.label.toLowerCase()} found for this period.`,
        extra: items.length ? [[], ['SUMMARY'], ['Active', act], ['Returned', ret], ['Overdue', ovd], ['Total', items.length]] : [],
      }
    );
    XLSX.utils.book_append_sheet(wb, ws, def.label);
  }

  {
    const all: any[] = [
      ...(data.tables.bookReservations     ?? []).map((r: any) => ({ ...r, itemType: 'Book'     })),
      ...(data.tables.magazineReservations ?? []).map((r: any) => ({ ...r, itemType: 'Magazine' })),
      ...(data.tables.thesisReservations   ?? []).map((r: any) => ({ ...r, itemType: 'Thesis'   })),
      ...(data.tables.journalReservations  ?? []).map((r: any) => ({ ...r, itemType: 'Journal'  })),
    ];
    const ws = xlSheet(
      [['RESERVATION ACTIVITY'], hdr, [`Total: ${all.length}`], []],
      ['Type', 'Title', 'Borrower', 'Request Date', 'Req. Borrow', 'Req. Due', 'Expiry', 'Status', 'Reviewed By', 'Rejection Reason'],
      all.map(r => [
        r.itemType,
        r.title ?? r.bookTitle ?? r.magazineTitle ?? r.thesisTitle ?? r.journalTitle ?? 'N/A',
        r.borrowerName ?? r.userName ?? 'N/A',
        r.requestDate         ? fmtDT(r.requestDate)         : 'N/A',
        r.requestedBorrowDate ? fmtDT(r.requestedBorrowDate) : 'N/A',
        r.requestedDueDate    ? fmtDT(r.requestedDueDate)    : 'N/A',
        r.expiryDate          ? fmtDT(r.expiryDate)          : 'N/A',
        (r.status ?? 'N/A').toUpperCase(),
        r.reviewedByName ?? 'N/A',
        r.rejectionReason ?? '',
      ]),
      [12, 35, 26, 20, 20, 20, 20, 15, 22, 30], 'Reservations',
      {
        emptyMsg: 'No reservation records found for this period.',
        extra: all.length ? [
          [], ['STATUS BREAKDOWN'], ['Status', 'Count'],
          ...['pending', 'approved', 'rejected', 'fulfilled', 'expired', 'cancelled'].map(s =>
            [s.charAt(0).toUpperCase() + s.slice(1), all.filter(r => r.status === s).length]
          ),
        ] : [],
      }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Reservations');
  }

  {
    const all: any[] = [
      ...(data.tables.bookReturnRequests     ?? []).map((r: any) => ({ ...r, itemType: 'Book'     })),
      ...(data.tables.magazineReturnRequests ?? []).map((r: any) => ({ ...r, itemType: 'Magazine' })),
      ...(data.tables.thesisReturnRequests   ?? []).map((r: any) => ({ ...r, itemType: 'Thesis'   })),
      ...(data.tables.journalReturnRequests  ?? []).map((r: any) => ({ ...r, itemType: 'Journal'  })),
    ];
    const ws = xlSheet(
      [['RETURN REQUEST ACTIVITY'], hdr, [`Total: ${all.length}`], []],
      ['Type', 'Title', 'Borrower', 'Request Date', 'Req. Return', 'Status', 'Condition', 'User Remarks', 'Staff Remarks', 'Rejection Reason'],
      all.map(r => [
        r.itemType,
        r.title ?? r.bookTitle ?? r.magazineTitle ?? r.thesisTitle ?? r.journalTitle ?? 'N/A',
        r.borrowerName ?? r.userName ?? 'N/A',
        r.requestDate         ? fmtDT(r.requestDate)         : 'N/A',
        r.requestedReturnDate ? fmtDT(r.requestedReturnDate) : 'N/A',
        (r.status    ?? 'N/A').toUpperCase(),
        (r.condition ?? 'N/A').toUpperCase(),
        r.userRemarks  ?? '',
        r.staffRemarks ?? '',
        r.rejectionReason ?? '',
      ]),
      [12, 35, 26, 20, 22, 15, 14, 26, 26, 30], 'ReturnRequests',
      {
        emptyMsg: 'No return request records found for this period.',
        extra: all.length ? [
          [], ['STATUS BREAKDOWN'], ['Status', 'Count'],
          ...['pending', 'approved', 'rejected'].map(s => [s.charAt(0).toUpperCase() + s.slice(1), all.filter(r => r.status === s).length]),
          [], ['CONDITION BREAKDOWN'], ['Condition', 'Count'],
          ...['good', 'damaged', 'lost'].map(c => [c.charAt(0).toUpperCase() + c.slice(1), all.filter(r => r.condition === c).length]),
        ] : [],
      }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Return Requests');
  }

  {
    const od: any[] = data.tables.overdueList ?? [];
    const ws = xlSheet(
      [['OVERDUE ITEMS REPORT'], hdr, [`Total Overdue: ${od.length}`], []],
      ['Type', 'Title', 'Borrower', 'Borrower ID', 'Due Date', 'Days Overdue', 'Hours Overdue', 'Fine (PHP)', 'Severity'],
      od.map((i: any) => {
        const sev = (i.daysOverdue ?? 0) > 30 ? 'Critical' : (i.daysOverdue ?? 0) > 14 ? 'High' : (i.daysOverdue ?? 0) > 7 ? 'Medium' : 'Low';
        return [i.itemType ?? 'book', i.bookTitle ?? i.itemTitle ?? 'N/A', i.borrowerName ?? 'N/A', i.borrowerId ?? 'N/A', i.dueDate ?? 'N/A', i.daysOverdue ?? 0, i.hoursOverdue ?? 0, fmtCur(i.fine ?? 0), sev];
      }),
      [12, 36, 26, 16, 20, 14, 14, 18, 12], 'OverdueItems',
      {
        emptyMsg: 'No overdue items for this period — great!',
        extra: od.length ? [
          [], ['SUMMARY'],
          ['Total Overdue',    od.length],
          ['Total Fines (PHP)', fmtCur(od.reduce((s: number, i: any) => s + (i.fine ?? 0), 0))],
          ['Avg Days Overdue', (od.reduce((s: number, i: any) => s + (i.daysOverdue ?? 0), 0) / od.length).toFixed(1)],
          ['Critical (>30d)', od.filter((i: any) => (i.daysOverdue ?? 0) > 30).length],
          ['High (15-30d)',   od.filter((i: any) => (i.daysOverdue ?? 0) > 14 && (i.daysOverdue ?? 0) <= 30).length],
          ['Medium (8-14d)',  od.filter((i: any) => (i.daysOverdue ?? 0) > 7  && (i.daysOverdue ?? 0) <= 14).length],
          ['Low (1-7d)',      od.filter((i: any) => (i.daysOverdue ?? 0) <= 7).length],
        ] : [],
      }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Overdue Items');
  }

  {
    const fines: any[] = data.tables.fines ?? [];
    const paid   = fines.filter(f => f.status === 'paid');
    const unpaid = fines.filter(f => f.status === 'unpaid');
    const waived = fines.filter(f => f.status === 'waived');
    const ws = xlSheet(
      [['FINES REPORT'], hdr, [`Total Records: ${fines.length}`], []],
      ['Borrower', 'Item Type', 'Borrowing ID', 'Fine Amount (PHP)', 'Status', 'Calculated At'],
      fines.map(f => [f.userName ?? 'N/A', f.itemType ?? 'N/A', f.borrowingId ?? 'N/A', fmtCur(Number(f.fineAmount ?? 0)), (f.status ?? 'N/A').toUpperCase(), f.calculatedAt ? fmtDT(f.calculatedAt) : 'N/A']),
      [28, 16, 16, 20, 14, 24], 'Fines',
      {
        emptyMsg: 'No fine records found for this period.',
        extra: fines.length ? [
          [], ['FINANCIAL SUMMARY'], ['Status', 'Count', 'Total Amount (PHP)'],
          ['Paid',   paid.length,   fmtCur(paid.reduce((s, f)   => s + Number(f.fineAmount ?? 0), 0))],
          ['Unpaid', unpaid.length, fmtCur(unpaid.reduce((s, f) => s + Number(f.fineAmount ?? 0), 0))],
          ['Waived', waived.length, fmtCur(waived.reduce((s, f) => s + Number(f.fineAmount ?? 0), 0))],
          ['TOTAL',  fines.length,  fmtCur(fines.reduce((s, f)  => s + Number(f.fineAmount ?? 0), 0))],
        ] : [],
      }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Fines');
  }

  {
    const pays: any[] = data.tables.payments ?? [];
    const ws = xlSheet(
      [['PAYMENT RECORDS'], hdr, [`Total: ${pays.length}`], []],
      ['Transaction ID', 'Borrower', 'Amount (PHP)', 'Type', 'Method', 'Date', 'Received By', 'Remarks'],
      pays.map(p => [p.transactionId ?? 'N/A', p.userName ?? 'N/A', fmtCur(p.amount ?? 0), (p.paymentType ?? 'N/A').toLowerCase(), (p.paymentMethod ?? 'cash').toLowerCase(), p.paymentDate ? fmtDT(p.paymentDate) : 'N/A', p.receivedByName ?? 'N/A', p.remarks ?? '']),
      [22, 26, 18, 16, 18, 24, 22, 30], 'Payments',
      {
        emptyMsg: 'No payment records found for this period.',
        extra: pays.length ? [[], ['TOTAL COLLECTED', fmtCur(pays.reduce((s, p) => s + Number(p.amount ?? 0), 0))]] : [],
      }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
  }

  for (const def of [
    { key: 'topBooks',     label: 'Top Books',     authorKey: 'author'    },
    { key: 'topMagazines', label: 'Top Magazines',  authorKey: 'publisher' },
    { key: 'topTheses',    label: 'Top Theses',     authorKey: 'author'    },
    { key: 'topJournals',  label: 'Top Journals',   authorKey: 'publisher' },
  ]) {
    const items: any[] = data.tables[def.key] ?? [];
    const maxB = Math.max(...items.map(i => i.borrowCount ?? 0), 1);
    const ws   = xlSheet(
      [[`MOST POPULAR ${def.label.toUpperCase()}`], hdr, []],
      ['Rank', 'Title', 'Author / Publisher', 'Category', 'ISBN / ISSN', 'Borrow Count', 'Popularity'],
      items.map((i: any, idx: number) => {
        const rank = idx + 1;
        const medal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
        const pop   = (i.borrowCount ?? 0) >= maxB * 0.7 ? 'Very High' : (i.borrowCount ?? 0) >= maxB * 0.4 ? 'High' : 'Moderate';
        return [medal, i.title ?? 'N/A', i[def.authorKey] ?? 'N/A', i.category ?? 'General', i.isbn ?? i.issn ?? 'N/A', i.borrowCount ?? 0, pop];
      }),
      [8, 36, 26, 20, 16, 14, 14], def.label.replace(/\s+/g, '_'),
      {
        emptyMsg: `No popular ${def.label.toLowerCase().replace('top ', '')} data available for this period.`,
        extra: items.length ? [
          [],
          ['Total Borrows',   items.reduce((s, i) => s + (i.borrowCount ?? 0), 0)],
          ['Average Borrows', (items.reduce((s, i) => s + (i.borrowCount ?? 0), 0) / items.length).toFixed(1)],
        ] : [],
      }
    );
    XLSX.utils.book_append_sheet(wb, ws, def.label);
  }

  {
    const dv: any[] = data.charts.dailyVisits ?? [];
    const avg = dv.length ? dv.reduce((s, v) => s + (v.count ?? 0), 0) / dv.length : 0;
    const ws  = xlSheet(
      [['DAILY VISITS TREND'], hdr, []],
      ['Date', 'Day of Week', 'Visitor Count', 'Trend'],
      dv.map(v => {
        const d = new Date(v.date);
        const t = v.count > avg * 1.2 ? 'Above Avg' : v.count < avg * 0.8 ? 'Below Avg' : 'Average';
        return [d.toLocaleDateString('en-US'), d.toLocaleDateString('en-US', { weekday: 'long' }), v.count ?? 0, t];
      }),
      [16, 18, 16, 16], 'DailyVisits',
      {
        emptyMsg: 'No visit data available for this period.',
        extra: dv.length ? [
          [], ['STATISTICS'], ['Metric', 'Value'],
          ['Total',   dv.reduce((s, v) => s + (v.count ?? 0), 0)],
          ['Average', parseFloat(avg.toFixed(1))],
          ['Peak',    Math.max(...dv.map(v => v.count ?? 0))],
          ['Lowest',  Math.min(...dv.map(v => v.count ?? 0))],
        ] : [],
      }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Visits');
  }

  {
    const members: any[] = data.tables.recentMembers ?? [];
    const ws = xlSheet(
      [['MEMBER DIRECTORY'], hdr, [`Showing: ${members.length} member(s)`], []],
      ['Name', 'User Type', 'Username', 'Email', 'Phone', 'Enrollment / Faculty No', 'Department', 'Joined', 'Status'],
      members.map(m => [m.name ?? 'N/A', m.userType ?? 'N/A', m.username ?? 'N/A', m.email ?? 'N/A', m.phone ?? 'N/A', m.enrollmentNo ?? m.facultyNumber ?? 'N/A', m.department ?? 'N/A', m.createdAt ? fmtDT(m.createdAt) : 'N/A', m.isActive ? 'ACTIVE' : 'INACTIVE']),
      [26, 14, 20, 32, 16, 24, 22, 24, 12], 'Members',
      { emptyMsg: 'No member records found.' }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
  }

  {
    const staff: any[] = data.tables.staffList ?? [];
    const ws = xlSheet(
      [['STAFF DIRECTORY'], [`Generated: ${generatedDate}`], []],
      ['Name', 'Username', 'Email', 'Department', 'Position', 'Status', 'Joined'],
      staff.map(s => [s.name ?? 'N/A', s.username ?? 'N/A', s.email ?? 'N/A', s.department ?? 'N/A', s.position ?? 'N/A', s.isActive ? 'ACTIVE' : 'INACTIVE', s.createdAt ? fmtDT(s.createdAt) : 'N/A']),
      [26, 20, 32, 22, 22, 12, 24], 'Staff',
      { emptyMsg: 'No staff records found.' }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Staff');
  }

  {
    const tb   = (ov.availableBookCopies ?? 0) + (ov.activeBorrowings ?? 0);
    const rows: any[][] = [
      ['ACTIVITY SUMMARY'], hdr, [],
      ['BORROWING METRICS'], ['Metric', 'Value'],
      ['Active Borrowings',    ov.activeBorrowings    ?? 0],
      ['Returned This Period', ov.totalReturnedPeriod ?? 0],
      ['Total Overdue',        ov.totalOverdue        ?? 0],
      ['Overdue Rate', `${(((ov.totalOverdue ?? 0) / Math.max(ov.activeBorrowings ?? 1, 1)) * 100).toFixed(1)}%`],
      [], ['FINANCIAL METRICS'], ['Metric', 'Amount (PHP)'],
      ['Paid Fines',   fmtCur(ov.totalPaidFines  ?? 0)],
      ['Unpaid Fines', fmtCur(ov.totalUnpaidFines ?? 0)],
      ['Waived Fines', fmtCur(ov.totalWaivedFines ?? 0)],
      [], ['COLLECTION UTILIZATION'], ['Metric', 'Value'],
      ['Books in Circulation', ov.activeBorrowings        ?? 0],
      ['Available Books',      ov.availableBookCopies     ?? 0],
      ['Available Magazines',  ov.availableMagazineCopies ?? 0],
      ['Available Theses',     ov.availableThesisCopies   ?? 0],
      ['Available Journals',   ov.availableJournalCopies  ?? 0],
      ['Utilization Rate', `${((ov.activeBorrowings ?? 0) / Math.max(tb, 1) * 100).toFixed(1)}%`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']   = [{ wch: 36 }, { wch: 24 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 4 };
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Summary');
  }

  {
    const qr: any[] = data.tables.qrScanLogs ?? [];
    const ws = xlSheet(
      [['QR SCAN ACTIVITY'], hdr, [`Total Scans: ${qr.length}`], []],
      ['QR Code', 'Item Type', 'Scan Type', 'Result', 'Scanned By', 'User', 'Location', 'Scanned At'],
      qr.map(q => [q.qrCode ?? 'N/A', q.itemType ?? 'N/A', q.scanType ?? 'N/A', q.scanResult ?? 'N/A', q.scannedByName ?? 'N/A', q.userName ?? 'N/A', q.scanLocation ?? 'N/A', q.scannedAt ? fmtDT(q.scannedAt) : 'N/A']),
      [30, 14, 16, 14, 22, 22, 22, 24], 'QRScans',
      { emptyMsg: 'No QR scan records found for this period.' }
    );
    XLSX.utils.book_append_sheet(wb, ws, 'QR Scans');
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="e-kalibro_report_${period}_${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  });
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    const period = url.searchParams.get('period') ?? 'month';
    const format = url.searchParams.get('format') ?? 'pdf';

    await updateAllOverdueFines();

    const res = await fetch(`/api/reports?period=${period}`);
    if (!res.ok) throw new Error(`Failed to fetch report data: ${res.status}`);
    const result = await res.json();
    if (!result.success) throw new Error(result.message ?? 'Failed to fetch report data');
    const data = result.data;

    if (data?.tables?.overdueList) {
      data.tables.overdueList = await Promise.all(
        data.tables.overdueList.map(async (item: any) => {
          if (item.dueDate) {
            item.daysOverdue  = await calculateDaysOverdue(new Date(item.dueDate));
            item.fine         = await calculateFineAmount(new Date(item.dueDate));
            item.hoursOverdue = item.fine > 0 ? Math.ceil(item.fine / 5) : 0;
          }
          return item;
        })
      );
    }

    const { start, end } = getDateRange(period);
    const finesRaw = await db
      .select({
        id:          tbl_fine.id,
        userId:      tbl_fine.userId,
        userName:    tbl_user.name,
        borrowingId: tbl_fine.borrowingId,
        fineAmount:  tbl_fine.fineAmount,
        status:      tbl_fine.status,
        calculatedAt: tbl_fine.createdAt,
      })
      .from(tbl_fine)
      .leftJoin(tbl_user, eq(tbl_fine.userId, tbl_user.id))
      .where(and(gte(tbl_fine.createdAt, start), lte(tbl_fine.createdAt, end)));

    data.tables ??= {};
    data.tables.fines = finesRaw.map(f => ({
      userName:    f.userName,
      itemType:    'N/A',
      borrowingId: f.borrowingId,
      fineAmount:  Number(f.fineAmount),
      daysOverdue: 0,
      status:      f.status,
      calculatedAt: f.calculatedAt,
    }));

    const periodLabel   = getPeriodLabel(period);
    const generatedDate = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    if (format === 'excel') return generateExcel(data, periodLabel, generatedDate, period);
    return generatePDF(data, periodLabel, generatedDate, period);

  } catch (err: any) {
    console.error('Export error:', err);
    throw error(500, { message: err.message ?? 'Export failed' });
  }
};