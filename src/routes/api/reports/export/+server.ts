import PDFDocument from 'pdfkit';
import { createRequire } from 'node:module';
import type ExcelJSTypes from 'exceljs';
import type { Borders, Cell, Fill, Workbook, Worksheet } from 'exceljs';
import * as fs from 'fs';
import * as nodePath from 'path';
import type { RequestHandler } from './$types.js';
import { error } from '@sveltejs/kit';

import { calculateFineAmount, calculateDaysOverdue, updateAllOverdueFines } from '$lib/server/utils/fineCalculation.js';
import { db } from '$lib/server/db/index.js';
import { tbl_fine, tbl_user } from '$lib/server/db/schema/schema.js';
import { and, gte, lte, eq } from 'drizzle-orm';

const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof ExcelJSTypes;

/* ════════════════════════════════════════════════════════════════════════════
   SHARED: formatters, palette, data preparation
   ════════════════════════════════════════════════════════════════════════════ */

const TZ = 'Asia/Manila';
const PH_OFFSET_MS = 8 * 3600_000;

const num     = (v: unknown) => Number(v ?? 0) || 0;
const fmtNum  = (v: unknown) => num(v).toLocaleString('en-US');
const fmtCur  = (v: unknown) => `PHP ${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toDate  = (s: unknown): Date | null => {
  if (!s) return null;
  const d = new Date(s as any);
  return isNaN(d.getTime()) ? null : d;
};
const fmtDate = (s: unknown) => {
  const d = toDate(s);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ }) : 'N/A';
};
const itemTitle = (i: any) =>
  i.title ?? i.bookTitle ?? i.magazineTitle ?? i.thesisTitle ?? i.journalTitle ?? i.itemTitle ?? 'N/A';

/** Single-pass counter (replaces many repeated .filter().length calls). */
function countBy<T>(items: T[], key: (i: T) => string | undefined | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = String(key(it) ?? '').toLowerCase();
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

const severity = (days: number) =>
  days > 30 ? 'Critical' : days > 14 ? 'High' : days > 7 ? 'Medium' : 'Low';

function getDateRange(period: string) {
  const now = new Date(), end = new Date(now);
  const start = new Date(now);
  switch (period) {
    case 'week':    start.setDate(start.getDate() - 7); break;
    case 'month':   start.setMonth(start.getMonth() - 1); break;
    case 'quarter': start.setMonth(start.getMonth() - 3); break;
    case 'year':    start.setFullYear(start.getFullYear() - 1); break;
    default:        return { start: new Date(0), end };
  }
  return { start, end };
}

function getPeriodLabel(period: string) {
  const m: Record<string, string> = {
    week: 'Last 7 Days', month: 'Last 30 Days',
    quarter: 'Last 3 Months', year: 'Last 12 Months',
  };
  return m[period] ?? 'All Time';
}

// ─── Palette (hex for PDF) ────────────────────────────────────────────────────
const P = {
  brand:  '#14532d', brand2: '#16a34a', brandSoft: '#dcfce7',
  gold:   '#ca8a04', goldSoft: '#fef9c3',
  amber:  '#d97706', yellow: '#eab308', teal: '#0d9488', olive: '#65a30d',
  purple: '#7c3aed', info: '#2563eb', danger: '#dc2626', dangerDark: '#991b1b',
  ink:    '#1c1917', mid: '#57534e', muted: '#a8a29e',
  line:   '#e7e5e4', stripe: '#fafaf9', track: '#efedea', white: '#ffffff',
};

/** Text colour for status-like values (PDF) and fill/font for Excel. */
const STATUS: Record<string, { fg: string; bg: string }> = {
  borrowed:  { fg: '1D4ED8', bg: 'DBEAFE' }, returned:  { fg: '15803D', bg: 'DCFCE7' },
  overdue:   { fg: 'B91C1C', bg: 'FEE2E2' }, pending:   { fg: 'B45309', bg: 'FEF3C7' },
  approved:  { fg: '15803D', bg: 'DCFCE7' }, fulfilled: { fg: '15803D', bg: 'DCFCE7' },
  rejected:  { fg: 'B91C1C', bg: 'FEE2E2' }, expired:   { fg: '57534E', bg: 'E7E5E4' },
  cancelled: { fg: '57534E', bg: 'E7E5E4' }, paid:      { fg: '15803D', bg: 'DCFCE7' },
  unpaid:    { fg: 'B91C1C', bg: 'FEE2E2' }, waived:    { fg: '57534E', bg: 'E7E5E4' },
  active:    { fg: '15803D', bg: 'DCFCE7' }, inactive:  { fg: '57534E', bg: 'E7E5E4' },
  critical:  { fg: '991B1B', bg: 'FECACA' }, high:      { fg: 'B91C1C', bg: 'FEE2E2' },
  medium:    { fg: 'B45309', bg: 'FEF3C7' }, low:       { fg: 'A16207', bg: 'FEF9C3' },
  damaged:   { fg: 'B45309', bg: 'FEF3C7' }, lost:      { fg: 'B91C1C', bg: 'FEE2E2' },
  good:      { fg: '15803D', bg: 'DCFCE7' },
};

// ─── Item groups (one definition drives every section/sheet) ──────────────────
const GROUPS = [
  { label: 'Books',     single: 'Book',     b: 'bookBorrowings',     r: 'bookReservations',     rt: 'bookReturnRequests',     top: 'topBooks',     by: 'author',    color: P.info   },
  { label: 'Magazines', single: 'Magazine', b: 'magazineBorrowings', r: 'magazineReservations', rt: 'magazineReturnRequests', top: 'topMagazines', by: 'publisher', color: P.purple },
  { label: 'Theses',    single: 'Thesis',   b: 'thesisBorrowings',   r: 'thesisReservations',   rt: 'thesisReturnRequests',   top: 'topTheses',    by: 'author',    color: P.teal   },
  { label: 'Journals',  single: 'Journal',  b: 'journalBorrowings',  r: 'journalReservations',  rt: 'journalReturnRequests',  top: 'topJournals',  by: 'publisher', color: P.amber  },
] as const;

function prepare(data: any) {
  const t = data.tables ?? {};
  const groups = GROUPS.map(g => ({
    ...g,
    borrowings:   (t[g.b]  ?? []) as any[],
    reservations: (t[g.r]  ?? []) as any[],
    returns:      (t[g.rt] ?? []) as any[],
    topItems:     (t[g.top] ?? []) as any[],
  }));
  return {
    ov: data.overview ?? {},
    charts: data.charts ?? {},
    groups,
    overdue:  (t.overdueList ?? []) as any[],
    fines:    (t.fines ?? []) as any[],
    payments: (t.payments ?? []) as any[],
    members:  (t.recentMembers ?? []) as any[],
    staff:    (t.staffList ?? []) as any[],
    qr:       (t.qrScanLogs ?? []) as any[],
    visits:   (data.charts?.dailyVisits ?? []) as any[],
    cats:     (data.charts?.categoryDistribution ?? []) as any[],
  };
}
type Prepared = ReturnType<typeof prepare>;

/* ════════════════════════════════════════════════════════════════════════════
   PDF
   ════════════════════════════════════════════════════════════════════════════ */

const ML = 40, MR = 40, MT = 40, FOOTER_H = 26;

// Fonts & logo are resolved ONCE per server process (not on every request).
let fontCache: { reg: string; bold: string } | null | undefined;
function resolveFonts() {
  if (fontCache !== undefined) return fontCache;
  const dirs = [
    process.env.REPORT_FONT_DIR, nodePath.resolve('static/assets/fonts'),
    'C:/Windows/Fonts', '/usr/share/fonts/truetype/liberation', '/usr/share/fonts/truetype/dejavu',
  ].filter(Boolean) as string[];
  const pairs = [['arial.ttf', 'arialbd.ttf'], ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf'], ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']];
  fontCache = null;
  for (const d of dirs) for (const [r, b] of pairs) {
    const rp = nodePath.join(d, r), bp = nodePath.join(d, b);
    if (fs.existsSync(rp) && fs.existsSync(bp)) return (fontCache = { reg: rp, bold: bp });
  }
  return fontCache;
}

let logoCache: Buffer | null | undefined;
function getLogo() {
  if (logoCache !== undefined) return logoCache;
  try {
    const p = nodePath.resolve('static/assets/logo.png');
    logoCache = fs.existsSync(p) ? fs.readFileSync(p) : null;
  } catch { logoCache = null; }
  return logoCache;
}

type PCol = { h: string; w: number; a?: 'left' | 'right' | 'center' };

const SECTIONS: [string, string][] = [
  ['Executive Summary', 'Key figures at a glance'],
  ['Library Visit Trends', 'Daily foot traffic'],
  ['Borrowing Activity', 'Status by item type'],
  ['Reservation Activity', 'Request outcomes'],
  ['Return Requests', 'Processing & item condition'],
  ['Overdue Items', 'Severity and fines owed'],
  ['Fines & Payments', 'Collections and outstanding balance'],
  ['Collection Overview', 'Categories and availability'],
  ['Most Popular Items', 'Ranked by borrow count'],
  ['Members & Staff', 'Registrations and directory'],
];

function buildPdf(d: Prepared, periodLabel: string, generatedDate: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 0, size: 'A4', autoFirstPage: false, bufferPages: false,
      info: { Title: `e-Kalibro Analytics - ${periodLabel}`, Author: 'e-Kalibro' },
    });

    const fonts = resolveFonts();
    let FR = 'Helvetica', FB = 'Helvetica-Bold';
    if (fonts) {
      doc.registerFont('Regular', fonts.reg);
      doc.registerFont('Bold', fonts.bold);
      FR = 'Regular'; FB = 'Bold';
    }

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    let pageNum = 0;
    const pw = () => doc.page.width;
    const ph = () => doc.page.height;
    const cw = () => pw() - ML - MR;
    const bottomY = () => ph() - FOOTER_H - 12;

    // ── page furniture ──────────────────────────────────────────────────────
    function drawFooter() {
      const y = doc.y, fy = ph() - FOOTER_H;
      doc.save();
      doc.rect(0, fy, pw(), FOOTER_H).fill(P.stripe);
      doc.moveTo(0, fy).lineTo(pw(), fy).strokeColor(P.line).lineWidth(0.5).stroke();
      doc.rect(0, fy, 60, 1.5).fill(P.brand2);
      doc.font(FR).fontSize(7).fillColor(P.mid)
        .text(`e-Kalibro Library Management System  ·  ${periodLabel}`, ML, fy + 9, { lineBreak: false });
      doc.font(FB).fontSize(7).fillColor(P.brand)
        .text(`Page ${pageNum}`, ML, fy + 9, { width: cw(), align: 'right', lineBreak: false });
      doc.restore();
      doc.y = y;
    }
    function newPage() {
      doc.addPage();
      pageNum++;
      doc.rect(0, 0, pw(), 4).fill(P.brand2);
      doc.y = MT;
      drawFooter();
    }
    const need = (h: number) => { if (doc.y + h > bottomY()) newPage(); };

    // ── primitives ──────────────────────────────────────────────────────────
    function sectionHeader(no: number, title: string, sub: string, accent: string) {
      need(64); // keep header together with at least some content
      const y = doc.y;
      doc.roundedRect(ML, y, 24, 24, 5).fill(accent);
      doc.font(FB).fontSize(11).fillColor(P.white).text(String(no), ML, y + 7, { width: 24, align: 'center', lineBreak: false });
      doc.font(FB).fontSize(13).fillColor(P.ink).text(title, ML + 34, y + (sub ? 1 : 6), { width: cw() - 34, lineBreak: false });
      if (sub) doc.font(FR).fontSize(8).fillColor(P.mid).text(sub, ML + 34, y + 16, { width: cw() - 34, lineBreak: false });
      doc.moveTo(ML, y + 32).lineTo(pw() - MR, y + 32).strokeColor(P.line).lineWidth(0.8).stroke();
      doc.moveTo(ML, y + 32).lineTo(ML + 48, y + 32).strokeColor(accent).lineWidth(2).stroke();
      doc.y = y + 42;
    }

    function subLabel(text: string) {
      need(30);
      doc.font(FB).fontSize(8.5).fillColor(P.mid).text(text.toUpperCase(), ML, doc.y, { characterSpacing: 0.4, lineBreak: false });
      doc.y += 14;
    }

    function emptyBox(msg: string) {
      need(30);
      const y = doc.y, w = cw();
      doc.roundedRect(ML, y, w, 24, 4).fillAndStroke(P.stripe, P.line);
      doc.rect(ML, y + 4, 3, 16).fill(P.amber);
      doc.font(FR).fontSize(8).fillColor(P.mid).text(msg, ML + 12, y + 8, { width: w - 20, lineBreak: false });
      doc.y = y + 32;
    }

    function metricCards(cards: { label: string; value: string; accent?: string }[], cols = 4) {
      const gap = 8, ch = 50;
      const cardW = (cw() - gap * (cols - 1)) / cols;
      const rows = Math.ceil(cards.length / cols);
      need(rows * (ch + gap));
      const sy = doc.y;
      cards.forEach((c, i) => {
        const x = ML + (i % cols) * (cardW + gap);
        const y = sy + Math.floor(i / cols) * (ch + gap);
        const ac = c.accent ?? P.brand2;
        doc.roundedRect(x, y, cardW, ch, 5).fillAndStroke(P.white, P.line);
        doc.save();
        doc.roundedRect(x, y, cardW, ch, 5).clip();
        doc.rect(x, y, 3.5, ch).fill(ac);
        doc.restore();
        doc.font(FR).fontSize(6.5).fillColor(P.mid)
          .text(c.label.toUpperCase(), x + 12, y + 11, { width: cardW - 18, height: 9, ellipsis: true, characterSpacing: 0.3 });
        doc.font(FB).fontSize(13).fillColor(P.ink)
          .text(c.value, x + 12, y + 26, { width: cardW - 18, height: 16, ellipsis: true });
      });
      doc.y = sy + rows * (ch + gap) + 2;
    }

    function table(
      cols: PCol[], rows: string[][],
      o: { color?: string; sum?: string[]; compact?: boolean; statusCol?: number } = {}
    ) {
      const color = o.color ?? P.brand2;
      const rh = o.compact ? 16 : 19, fs = 7;
      const total = cols.reduce((a, c) => a + c.w, 0);
      const widths = cols.map(c => (c.w / total) * cw());

      const cells = (vals: string[], y: number, font: string, fill: string, statusCol = -1) => {
        let x = ML;
        doc.font(font).fontSize(fs);
        vals.forEach((v, i) => {
          const txt = String(v ?? '');
          const isStatus = i === statusCol && STATUS[txt.toLowerCase()];
          doc.fillColor(isStatus ? '#' + STATUS[txt.toLowerCase()].fg : fill);
          if (isStatus) doc.font(FB);
          doc.text(txt, x + 5, y + (rh - fs) / 2 - 0.5, {
            width: widths[i] - 10, height: fs + 2, ellipsis: true, align: cols[i].a ?? 'left',
          });
          if (isStatus) doc.font(font);
          x += widths[i];
        });
      };
      const head = () => {
        const y = doc.y;
        doc.rect(ML, y, cw(), rh + 2).fill(color);
        cells(cols.map(c => c.h.toUpperCase()), y + 1, FB, P.white);
        doc.y = y + rh + 2;
      };

      need(rh * 3 + 4);
      head();
      rows.forEach((r, ri) => {
        if (doc.y + rh > bottomY()) { newPage(); head(); }
        const y = doc.y;
        if (ri % 2 === 1) doc.rect(ML, y, cw(), rh).fill(P.stripe);
        doc.moveTo(ML, y + rh).lineTo(ML + cw(), y + rh).strokeColor(P.line).lineWidth(0.3).stroke();
        cells(r, y, FR, P.ink, o.statusCol ?? -1);
        doc.y = y + rh;
      });
      if (o.sum) {
        if (doc.y + rh > bottomY()) { newPage(); head(); }
        const y = doc.y;
        doc.rect(ML, y, cw(), rh + 1).fill(P.goldSoft);
        doc.moveTo(ML, y).lineTo(ML + cw(), y).strokeColor(P.gold).lineWidth(1).stroke();
        cells(o.sum, y + 0.5, FB, P.brand);
        doc.y = y + rh + 1;
      }
      doc.y += 10;
    }

    function barChart(
      title: string, items: { label: string; value: number; color?: string }[],
      o: { x?: number; w?: number; barH?: number; labelW?: number; advance?: boolean } = {}
    ) {
      if (!items.length) return;
      const x0 = o.x ?? ML, w = o.w ?? cw(), barH = o.barH ?? 12, gap = 4, labelW = o.labelW ?? 100, valW = 34;
      const aW = w - labelW - valW;
      if (o.advance !== false) need((title ? 16 : 0) + items.length * (barH + gap) + 6);
      if (title) {
        doc.font(FB).fontSize(8).fillColor(P.mid).text(title, x0, doc.y, { width: w, lineBreak: false });
        doc.y += 14;
      }
      const maxV = Math.max(...items.map(i => i.value), 1);
      for (const it of items) {
        const y = doc.y, bW = (it.value / maxV) * aW;
        doc.font(FR).fontSize(7).fillColor(P.ink)
          .text(it.label, x0, y + 2.5, { width: labelW - 6, height: 9, ellipsis: true });
        doc.roundedRect(x0 + labelW, y, aW, barH, 3).fill(P.track);
        if (bW > 0) doc.roundedRect(x0 + labelW, y, Math.max(bW, 4), barH, 3).fill(it.color ?? P.brand2);
        doc.font(FB).fontSize(7).fillColor(P.ink)
          .text(it.value.toLocaleString(), x0 + labelW + aW + 5, y + 2.5, { width: valW - 5, lineBreak: false });
        doc.y = y + barH + gap;
      }
      doc.y += 4;
    }

    function sparkLine(title: string, points: number[], labels: [string, string], color = P.brand2, chartH = 80) {
      if (points.length < 2) return;
      const w = cw();
      need(chartH + 34);
      if (title) {
        doc.font(FB).fontSize(8).fillColor(P.mid).text(title, ML, doc.y, { lineBreak: false });
        doc.y += 13;
      }
      const cy = doc.y;
      doc.roundedRect(ML, cy, w, chartH, 5).fillAndStroke('#fbfaf8', P.line);

      const rawMax = Math.max(...points), rawMin = Math.min(...points);
      const minV = rawMax === rawMin ? Math.max(0, rawMin - 1) : rawMin;
      const rng = rawMax - minV || 1;
      const padX = 26, padY = 10;
      const toX = (i: number) => ML + padX + (i / (points.length - 1)) * (w - padX - 12);
      const toY = (v: number) => cy + chartH - padY - ((v - minV) / rng) * (chartH - padY * 2);

      [0, 0.5, 1].forEach(f => {
        const gy = toY(minV + f * rng);
        doc.moveTo(ML + padX, gy).lineTo(ML + w - 12, gy).strokeColor(P.line).lineWidth(0.4).dash(2, { space: 2 }).stroke().undash();
        doc.font(FR).fontSize(6).fillColor(P.muted)
          .text(String(Math.round(minV + f * rng)), ML + 4, gy - 3, { width: padX - 8, align: 'right', lineBreak: false });
      });

      const pts = points.map((v, i) => ({ x: toX(i), y: toY(v) }));
      const base = cy + chartH - padY;

      doc.save();
      doc.moveTo(pts[0].x, base);
      pts.forEach(p => doc.lineTo(p.x, p.y));
      doc.lineTo(pts[pts.length - 1].x, base).closePath();
      doc.fillColor(color).fillOpacity(0.14).fill();
      doc.restore();

      doc.moveTo(pts[0].x, pts[0].y);
      pts.slice(1).forEach(p => doc.lineTo(p.x, p.y));
      doc.lineJoin('round').strokeColor(color).lineWidth(1.6).stroke();

      const maxIdx = points.indexOf(rawMax), minIdx = points.lastIndexOf(rawMin);
      const tag = (i: number, text: string, c: string, above: boolean) => {
        const p = pts[i];
        doc.circle(p.x, p.y, 3).fillAndStroke(c, P.white);
        const lx = Math.min(Math.max(p.x - 20, ML + padX), ML + w - 52);
        doc.font(FB).fontSize(6.5).fillColor(P.mid)
          .text(text, lx, above ? p.y - 12 : p.y + 5, { width: 40, align: 'center', lineBreak: false });
      };
      tag(maxIdx, `High ${rawMax}`, P.brand2, true);
      if (minIdx !== maxIdx) tag(minIdx, `Low ${rawMin}`, P.amber, false);

      doc.font(FR).fontSize(6.5).fillColor(P.muted)
        .text(labels[0], ML + padX, cy + chartH + 3, { lineBreak: false });
      doc.text(labels[1], ML, cy + chartH + 3, { width: w - 12, align: 'right', lineBreak: false });
      doc.y = cy + chartH + 18;
    }

    // ── cover ───────────────────────────────────────────────────────────────
    function drawCover() {
      doc.addPage();
      const W = pw(), H = ph();

      doc.rect(0, 0, W, 340).fill(P.brand);
      doc.rect(0, 340, W, 5).fill(P.gold);
      doc.save();
      doc.fillOpacity(0.06).fillColor(P.white);
      doc.circle(W - 40, 70, 170).fill();
      doc.circle(W - 150, 300, 90).fill();
      doc.restore();

      const logo = getLogo();
      let textX = ML;
      if (logo) {
        try {
          doc.roundedRect(ML - 4, 46, 68, 68, 10).fill(P.white);
          doc.image(logo, ML, 50, { fit: [60, 60], align: 'center', valign: 'center' });
          textX = ML + 82;
        } catch { textX = ML; }
      }
      doc.font(FB).fontSize(30).fillColor(P.white).text('e-Kalibro', textX, 54, { lineBreak: false });
      doc.font(FR).fontSize(10.5).fillColor(P.goldSoft).text('Library Management System', textX + 1, 92, { lineBreak: false });

      doc.font(FB).fontSize(11).fillColor(P.gold).text('ANALYTICS REPORT', ML, 190, { characterSpacing: 2, lineBreak: false });
      doc.font(FB).fontSize(36).fillColor(P.white).text('Library Analytics', ML, 210, { lineBreak: false });
      doc.font(FB).fontSize(36).fillColor(P.white).text('Report', ML, 250, { lineBreak: false });

      const label = periodLabel.toUpperCase();
      doc.font(FB).fontSize(9);
      const pillW = doc.widthOfString(label) + 28;
      doc.roundedRect(ML, 298, pillW, 22, 11).fill(P.gold);
      doc.fillColor(P.white).text(label, ML + 14, 305, { lineBreak: false });

      // meta strip
      const my = 380, mw = (cw() - 16) / 3;
      const meta: [string, string][] = [
        ['Generated', generatedDate], ['Coverage', periodLabel], ['Report Type', 'Full-System Analytics'],
      ];
      meta.forEach(([k, v], i) => {
        const x = ML + i * (mw + 8);
        doc.roundedRect(x, my, mw, 52, 6).fillAndStroke(P.stripe, P.line);
        doc.rect(x, my + 10, 3, 32).fill(P.brand2);
        doc.font(FR).fontSize(7).fillColor(P.mid).text(k.toUpperCase(), x + 14, my + 12, { characterSpacing: 0.4, lineBreak: false });
        doc.font(FB).fontSize(9.5).fillColor(P.ink).text(v, x + 14, my + 26, { width: mw - 22, height: 12, ellipsis: true });
      });

      // contents
      let cy = 470;
      doc.font(FB).fontSize(10).fillColor(P.brand).text('CONTENTS', ML, cy, { characterSpacing: 1.2, lineBreak: false });
      cy += 20;
      SECTIONS.forEach(([t, s], i) => {
        const col = i < 5 ? 0 : 1, row = i % 5;
        const x = ML + col * (cw() / 2 + 6), y = cy + row * 32;
        doc.circle(x + 9, y + 9, 9).fill(P.brandSoft);
        doc.font(FB).fontSize(8).fillColor(P.brand).text(String(i + 1), x, y + 5.5, { width: 18, align: 'center', lineBreak: false });
        doc.font(FB).fontSize(9.5).fillColor(P.ink).text(t, x + 26, y + 1, { lineBreak: false });
        doc.font(FR).fontSize(7.5).fillColor(P.mid).text(s, x + 26, y + 14, { lineBreak: false });
      });

      doc.rect(0, H - 40, W, 40).fill(P.brand);
      doc.font(FR).fontSize(7.5).fillColor(P.brandSoft)
        .text('CONFIDENTIAL  ·  FOR INTERNAL USE ONLY', ML, H - 24, { width: cw(), align: 'center', characterSpacing: 1.2, lineBreak: false });
    }

    // ── render ──────────────────────────────────────────────────────────────
    try {
      const { ov, groups } = d;
      drawCover();
      newPage();

      // 1. Executive summary
      sectionHeader(1, 'Executive Summary', `Analytics for ${periodLabel}`, P.brand);
      metricCards([
        { label: 'Total Visits',         value: fmtNum(ov.totalVisits),                accent: P.info   },
        { label: 'Active Members',       value: fmtNum(ov.activeMembers),              accent: P.brand2 },
        { label: 'Active Borrowings',    value: fmtNum(ov.activeBorrowings),           accent: P.teal   },
        { label: 'Total Overdue',        value: fmtNum(ov.totalOverdue),               accent: P.danger },
        { label: 'Pending Reservations', value: fmtNum(ov.totalPendingReservations),   accent: P.amber  },
        { label: 'Pending Returns',      value: fmtNum(ov.totalPendingReturnRequests), accent: P.gold   },
        { label: 'Paid Fines',           value: fmtCur(ov.totalPaidFines),             accent: P.brand2 },
        { label: 'Unpaid Fines',         value: fmtCur(ov.totalUnpaidFines),           accent: P.danger },
      ]);
      metricCards([
        { label: 'Total Books',      value: fmtNum(ov.totalBooks),          accent: P.info   },
        { label: 'Total Magazines',  value: fmtNum(ov.totalMagazines),      accent: P.purple },
        { label: 'Total Theses',     value: fmtNum(ov.totalTheses),         accent: P.teal   },
        { label: 'Total Journals',   value: fmtNum(ov.totalJournals),       accent: P.olive  },
        { label: 'Total Members',    value: fmtNum(ov.totalMembers),        accent: P.brand2 },
        { label: 'Total Staff',      value: fmtNum(ov.totalStaff),          accent: P.gold   },
        { label: 'Available Copies', value: fmtNum(ov.availableBookCopies), accent: P.teal   },
        { label: 'New Members',      value: fmtNum(ov.newMembers),          accent: P.amber  },
      ]);
      doc.y += 14;

      // 2. Visits
      sectionHeader(2, 'Library Visit Trends', 'Daily foot traffic', P.brand2);
      const dv = d.visits;
      if (dv.length > 1) {
        const counts = dv.map(v => num(v.count));
        const totalV = counts.reduce((a, b) => a + b, 0), avgV = totalV / counts.length;
        sparkLine('Daily visitor count', counts, [fmtDate(dv[0].date), fmtDate(dv[dv.length - 1].date)]);
        table(
          [{ h: 'Date', w: 3 }, { h: 'Day', w: 2 }, { h: 'Visitors', w: 2, a: 'right' }, { h: 'Trend', w: 2.5 }],
          dv.map((v, i) => {
            const dt = toDate(v.date);
            const t = counts[i] > avgV * 1.2 ? 'Above avg' : counts[i] < avgV * 0.8 ? 'Below avg' : 'Average';
            return [dt ? dt.toLocaleDateString('en-US', { timeZone: TZ }) : 'N/A',
                    dt ? dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ }) : '',
                    fmtNum(counts[i]), t];
          }),
          { color: P.brand2, compact: true, sum: ['TOTAL', '', fmtNum(totalV), `Avg ${avgV.toFixed(1)}`] }
        );
      } else emptyBox('No visit data available for this period.');
      doc.y += 6;

      // 3. Borrowing
      sectionHeader(3, 'Borrowing Activity', 'Summary by item type', P.teal);
      const bStats = groups.map(g => ({ g, c: countBy(g.borrowings, i => i.status) }));
      if (groups.every(g => !g.borrowings.length)) emptyBox('No borrowing records found for this period.');
      else {
        barChart('Active borrowings by item type',
          bStats.map(({ g, c }) => ({ label: g.label, value: c.borrowed ?? 0, color: g.color })));
        const rows = bStats.map(({ g, c }) => [g.label, String(g.borrowings.length), String(c.borrowed ?? 0), String(c.returned ?? 0), String(c.overdue ?? 0)]);
        const sum = ['TOTAL', ...[1, 2, 3, 4].map(k => String(rows.reduce((s, r) => s + +r[k], 0)))];
        table(
          [{ h: 'Item type', w: 3 }, { h: 'Total', w: 2, a: 'right' }, { h: 'Active', w: 2, a: 'right' }, { h: 'Returned', w: 2, a: 'right' }, { h: 'Overdue', w: 2, a: 'right' }],
          rows, { color: P.teal, sum }
        );
        for (const g of groups) {
          subLabel(`${g.label} — recent borrowings (top 10)`);
          if (!g.borrowings.length) { emptyBox(`No ${g.label.toLowerCase()} borrowings found for this period.`); continue; }
          table(
            [{ h: 'Title', w: 5 }, { h: 'Borrower', w: 3.2 }, { h: 'Borrowed', w: 2 }, { h: 'Due', w: 2 }, { h: 'Status', w: 1.8 }],
            g.borrowings.slice(0, 10).map((i: any) => [
              itemTitle(i), i.borrowerName ?? i.userName ?? 'N/A',
              fmtDate(i.borrowDate), fmtDate(i.dueDate), String(i.status ?? 'N/A').toUpperCase(),
            ]),
            { color: g.color, compact: true, statusCol: 4 }
          );
        }
      }
      doc.y += 6;

      // 4. Reservations
      sectionHeader(4, 'Reservation Activity', 'Request outcomes by item type', P.amber);
      if (groups.every(g => !g.reservations.length)) emptyBox('No reservation records found for this period.');
      else {
        const ss = ['pending', 'approved', 'rejected', 'fulfilled', 'expired', 'cancelled'];
        table(
          [{ h: 'Type', w: 2.4 }, { h: 'Total', w: 1.6, a: 'right' }, ...ss.map(s => ({ h: s, w: 1.9, a: 'right' as const }))],
          groups.map(g => { const c = countBy(g.reservations, i => i.status); return [g.label, String(g.reservations.length), ...ss.map(s => String(c[s] ?? 0))]; }),
          { color: P.amber }
        );
      }
      doc.y += 6;

      // 5. Return requests
      sectionHeader(5, 'Return Requests', 'Processing status and item condition', P.olive);
      if (groups.every(g => !g.returns.length)) emptyBox('No return request records found for this period.');
      else {
        table(
          [{ h: 'Type', w: 2.4 }, { h: 'Total', w: 1.6, a: 'right' }, { h: 'Pending', w: 1.9, a: 'right' }, { h: 'Approved', w: 1.9, a: 'right' }, { h: 'Rejected', w: 1.9, a: 'right' }, { h: 'Damaged', w: 1.9, a: 'right' }, { h: 'Lost', w: 1.6, a: 'right' }],
          groups.map(g => {
            const s = countBy(g.returns, i => i.status), c = countBy(g.returns, i => i.condition);
            return [g.label, String(g.returns.length), String(s.pending ?? 0), String(s.approved ?? 0), String(s.rejected ?? 0), String(c.damaged ?? 0), String(c.lost ?? 0)];
          }),
          { color: P.olive }
        );
      }
      doc.y += 6;

      // 6. Overdue
      const od = d.overdue;
      sectionHeader(6, 'Overdue Items', `${od.length} item(s) currently overdue`, P.danger);
      if (!od.length) emptyBox('No overdue items for this period — great!');
      else {
        const sv = countBy(od, i => severity(num(i.daysOverdue)));
        barChart('Overdue severity distribution', [
          { label: 'Critical (>30 days)', value: sv.critical ?? 0, color: P.dangerDark },
          { label: 'High (15–30 days)',   value: sv.high ?? 0,     color: P.danger     },
          { label: 'Medium (8–14 days)',  value: sv.medium ?? 0,   color: P.amber      },
          { label: 'Low (1–7 days)',      value: sv.low ?? 0,      color: P.yellow     },
        ]);
        table(
          [{ h: 'Title', w: 4 }, { h: 'Type', w: 1.5 }, { h: 'Borrower', w: 3 }, { h: 'Days', w: 1.1, a: 'right' }, { h: 'Hours', w: 1.2, a: 'right' }, { h: 'Fine', w: 2.2, a: 'right' }, { h: 'Severity', w: 1.7 }],
          od.slice(0, 20).map(i => [itemTitle(i), i.itemType ?? 'book', i.borrowerName ?? 'N/A', String(num(i.daysOverdue)), String(num(i.hoursOverdue)), fmtCur(i.fine), severity(num(i.daysOverdue)).toUpperCase()]),
          { color: P.danger, statusCol: 6, sum: ['TOTAL', '', '', '', '', fmtCur(od.reduce((s, i) => s + num(i.fine), 0)), ''] }
        );
        if (od.length > 20) { doc.font(FR).fontSize(7).fillColor(P.mid).text(`Showing 20 of ${od.length}. Export to Excel for the full list.`, ML, doc.y - 6, { lineBreak: false }); doc.y += 10; }
      }
      doc.y += 6;

      // 7. Fines & payments
      sectionHeader(7, 'Fines & Payments', 'Collections and outstanding balance', P.gold);
      const fines = d.fines;
      if (!fines.length) emptyBox('No fine records found for this period.');
      else {
        const by = { paid: 0, unpaid: 0, all: 0 };
        for (const f of fines) { const a = num(f.fineAmount); by.all += a; if (f.status === 'paid') by.paid += a; else if (f.status === 'unpaid') by.unpaid += a; }
        metricCards([
          { label: 'Total Fine Amount', value: fmtCur(by.all),      accent: P.danger },
          { label: 'Collected (Paid)',  value: fmtCur(by.paid),     accent: P.brand2 },
          { label: 'Outstanding',       value: fmtCur(by.unpaid),   accent: P.amber  },
          { label: 'Total Records',     value: fmtNum(fines.length), accent: P.gold  },
        ]);
        doc.y += 6;
        table(
          [{ h: 'Borrower', w: 4 }, { h: 'Item type', w: 2 }, { h: 'Amount', w: 2.6, a: 'right' }, { h: 'Status', w: 2 }, { h: 'Date', w: 2.4 }],
          fines.slice(0, 20).map(f => [f.userName ?? 'N/A', f.itemType ?? 'N/A', fmtCur(f.fineAmount), String(f.status ?? 'N/A').toUpperCase(), fmtDate(f.calculatedAt)]),
          { color: P.gold, statusCol: 3, sum: ['TOTAL', '', fmtCur(by.all), `Paid ${fmtCur(by.paid)}`, ''] }
        );
      }
      subLabel('Payment records (top 20)');
      const pays = d.payments;
      if (!pays.length) emptyBox('No payment records found for this period.');
      else {
        table(
          [{ h: 'Member', w: 3.6 }, { h: 'Amount', w: 2.6, a: 'right' }, { h: 'Type', w: 1.8 }, { h: 'Method', w: 1.8 }, { h: 'Date', w: 2.4 }, { h: 'Staff', w: 2.6 }],
          pays.slice(0, 20).map(p => [p.userName ?? 'N/A', fmtCur(p.amount), String(p.paymentType ?? 'N/A').toLowerCase(), String(p.paymentMethod ?? 'cash').toLowerCase(), fmtDate(p.paymentDate), p.receivedBy ?? p.receivedByName ?? 'N/A']),
          { color: P.brand2, sum: ['TOTAL COLLECTED', fmtCur(pays.reduce((s, p) => s + num(p.amount), 0)), '', '', '', ''] }
        );
      }
      doc.y += 6;

      // 8. Collection
      sectionHeader(8, 'Collection Overview', 'Categories and availability', P.purple);
      if (!d.cats.length) emptyBox('No category distribution data available.');
      else {
        const top = d.cats.slice(0, 10);
        barChart('Top categories by item count', top.map(c => ({ label: c.category ?? 'Unknown', value: num(c.count), color: P.purple })));
        table(
          [{ h: 'Category', w: 5 }, { h: 'Count', w: 2, a: 'right' }, { h: 'Share', w: 2, a: 'right' }],
          top.map(c => [c.category ?? 'Unknown', fmtNum(c.count), `${c.percentage ?? 0}%`]),
          { color: P.purple, compact: true }
        );
      }
      table(
        [{ h: 'Item type', w: 3 }, { h: 'Total titles', w: 3, a: 'right' }, { h: 'Available copies', w: 3, a: 'right' }],
        [
          ['Books', fmtNum(ov.totalBooks), fmtNum(ov.availableBookCopies)],
          ['Magazines', fmtNum(ov.totalMagazines), fmtNum(ov.availableMagazineCopies)],
          ['Theses', fmtNum(ov.totalTheses), fmtNum(ov.availableThesisCopies)],
          ['Journals', fmtNum(ov.totalJournals), fmtNum(ov.availableJournalCopies)],
        ],
        { color: P.purple }
      );
      doc.y += 6;

      // 9. Popular (2×2 grid of mini charts)
      sectionHeader(9, 'Most Popular Items', 'Ranked by borrow count (top 10)', P.brand2);
      const colW = (cw() - 20) / 2;
      for (let i = 0; i < groups.length; i += 2) {
        const pair = groups.slice(i, i + 2);
        const rowsN = Math.max(...pair.map(g => Math.min(g.topItems.length, 10)), 1);
        need(30 + rowsN * 16 + 10);
        const startY = doc.y;
        let endY = startY;
        pair.forEach((g, k) => {
          const x = ML + k * (colW + 20);
          doc.y = startY;
          doc.roundedRect(x, doc.y, 4, 4, 1).fill(g.color);
          doc.font(FB).fontSize(8.5).fillColor(P.ink).text(g.label.toUpperCase(), x + 10, doc.y - 1, { lineBreak: false });
          doc.y += 14;
          if (!g.topItems.length) {
            doc.font(FR).fontSize(7.5).fillColor(P.mid).text('No data for this period.', x, doc.y, { lineBreak: false });
            doc.y += 14;
          } else {
            barChart('', g.topItems.slice(0, 10).map((it: any) => ({ label: String(it.title ?? 'N/A'), value: num(it.borrowCount), color: g.color })),
              { x, w: colW, labelW: 92, barH: 11, advance: false });
          }
          endY = Math.max(endY, doc.y);
        });
        doc.y = endY + 6;
      }
      doc.y += 4;

      // 10. Members & staff
      sectionHeader(10, 'Members & Staff', 'Registrations and directory', P.teal);
      subLabel('Recently registered members');
      if (!d.members.length) emptyBox('No new members registered in this period.');
      else table(
        [{ h: 'Name', w: 3 }, { h: 'Type', w: 1.6 }, { h: 'Email', w: 3.6 }, { h: 'Joined', w: 2 }, { h: 'Status', w: 1.6 }],
        d.members.slice(0, 15).map(m => [m.name ?? 'N/A', m.userType ?? 'N/A', m.email ?? 'N/A', fmtDate(m.createdAt), m.isActive ? 'ACTIVE' : 'INACTIVE']),
        { color: P.teal, compact: true, statusCol: 4 }
      );
      subLabel('Staff directory');
      if (!d.staff.length) emptyBox('No staff records found.');
      else table(
        [{ h: 'Name', w: 3 }, { h: 'Department', w: 2.4 }, { h: 'Position', w: 2.4 }, { h: 'Email', w: 3.4 }, { h: 'Status', w: 1.6 }],
        d.staff.map(s => [s.name ?? 'N/A', s.department ?? 'N/A', s.position ?? 'N/A', s.email ?? 'N/A', s.isActive ? 'ACTIVE' : 'INACTIVE']),
        { color: P.teal, compact: true, statusCol: 4 }
      );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   EXCEL  (ExcelJS: real styling, number/date formats, filters, print setup)
   ════════════════════════════════════════════════════════════════════════════ */

const X = {
  brand: 'FF14532D', brand2: 'FF16A34A', soft: 'FFDCFCE7', gold: 'FFFEF9C3', goldLine: 'FFCA8A04',
  stripe: 'FFF7F7F5', line: 'FFE7E5E4', ink: 'FF1C1917', mid: 'FF57534E', white: 'FFFFFFFF',
};
const FMT = {
  money: '"PHP "#,##0.00', int: '#,##0', pct: '0.0%',
  date: 'mmm d, yyyy', dt: 'mmm d, yyyy h:mm AM/PM',
};
const FONT = 'Calibri';
const thinBottom: Partial<Borders> = { bottom: { style: 'thin', color: { argb: X.line } } };
const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** ExcelJS stores dates as UTC serials; shift so Excel shows Manila wall-clock time. */
const xlDate = (s: unknown): Date | null => {
  const d = toDate(s);
  return d ? new Date(d.getTime() + PH_OFFSET_MS) : null;
};

type XType = 'text' | 'int' | 'money' | 'date' | 'datetime' | 'status' | 'center';
type XCol = { header: string; key: string; width: number; type?: XType };
type Block = { title: string; head: string[]; rows: any[][] };

function statusStyle(cell: Cell, raw: unknown) {
  const txt = String(raw ?? '');
  const st = STATUS[txt.toLowerCase()];
  cell.value = txt.toUpperCase();
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.font = { name: FONT, size: 9, bold: true, color: { argb: 'FF' + (st?.fg ?? '57534E') } };
  if (st) cell.fill = solid('FF' + st.bg);
}

/** Cell setter that understands {money}, {pct}, {int} wrappers and plain values. */
function setAny(cell: Cell, v: any) {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('money' in v) { cell.value = num(v.money); cell.numFmt = FMT.money; }
    else if ('pct' in v) { cell.value = num(v.pct); cell.numFmt = FMT.pct; }
    else if ('int' in v) { cell.value = num(v.int); cell.numFmt = FMT.int; }
    cell.alignment = { horizontal: 'right' };
  } else {
    cell.value = v;
    if (typeof v === 'number') { cell.numFmt = FMT.int; cell.alignment = { horizontal: 'right' }; }
  }
}

function banner(ws: Worksheet, n: number, title: string, subtitle: string) {
  ws.mergeCells(1, 1, 1, n);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 16, bold: true, color: { argb: X.white } };
  t.fill = solid(X.brand);
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 32;
  for (let c = 2; c <= n; c++) ws.getCell(1, c).fill = solid(X.brand);

  ws.mergeCells(2, 1, 2, n);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: FONT, size: 10, color: { argb: X.mid } };
  s.fill = solid(X.soft);
  s.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 20;
  for (let c = 2; c <= n; c++) ws.getCell(2, c).fill = solid(X.soft);
}

function writeBlock(ws: Worksheet, span: number, b: Block) {
  ws.addRow([]);
  const w = Math.max(span, b.head.length);
  const t = ws.addRow([b.title]);
  ws.mergeCells(t.number, 1, t.number, w);
  t.height = 20;
  for (let c = 1; c <= w; c++) t.getCell(c).fill = solid(X.brand2);
  t.getCell(1).font = { name: FONT, size: 11, bold: true, color: { argb: X.white } };
  t.getCell(1).alignment = { vertical: 'middle', indent: 1 };

  const h = ws.addRow(b.head);
  h.eachCell((c, columnNumber) => {
    const column = Number(columnNumber);
    c.font = { name: FONT, size: 10, bold: true, color: { argb: X.brand } };
    c.fill = solid(X.soft);
    c.border = thinBottom;
    c.alignment = { horizontal: column === 1 ? 'left' : 'right', vertical: 'middle', indent: column === 1 ? 1 : 0 };
  });
  b.rows.forEach((r, i) => {
    const row = ws.addRow([]);
    r.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      setAny(c, v);
      c.font = { name: FONT, size: 10, color: { argb: X.ink }, bold: ci === 0 };
      c.border = thinBottom;
      if (ci === 0) c.alignment = { horizontal: 'left', indent: 1 };
      if (i % 2 === 1) c.fill = solid(X.stripe);
    });
  });
}

function addDataSheet(
  wb: Workbook,
  o: {
    name: string; title: string; subtitle: string; tab: string; cols: XCol[];
    rows: Record<string, any>[]; emptyMsg: string;
    totals?: Record<string, any>; blocks?: Block[];
  }
) {
  const HEAD = 4, n = o.cols.length;
  const ws = wb.addWorksheet(o.name, {
    properties: { tabColor: { argb: o.tab } },
    views: [{ state: 'frozen', ySplit: HEAD, showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: '&LeKalibro Analytics&CPage &P of &N&R&D' },
  });
  ws.columns = o.cols.map(c => ({ key: c.key, width: c.width }));

  banner(ws, n, o.title, o.subtitle);
  ws.getRow(3).height = 6;

  const hr = ws.getRow(HEAD);
  hr.height = 24;
  o.cols.forEach((c, i) => {
    const cell = hr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: X.white } };
    cell.fill = solid(X.brand2);
    cell.alignment = {
      vertical: 'middle', wrapText: true,
      horizontal: c.type === 'money' || c.type === 'int' ? 'right' : c.type === 'status' || c.type === 'center' ? 'center' : 'left',
      indent: i === 0 ? 1 : 0,
    };
  });

  if (!o.rows.length) {
    const r = ws.addRow([o.emptyMsg]);
    ws.mergeCells(r.number, 1, r.number, n);
    r.height = 30;
    r.getCell(1).font = { name: FONT, size: 10, italic: true, color: { argb: X.mid } };
    r.getCell(1).alignment = { vertical: 'middle', indent: 1 };
  } else {
    o.rows.forEach((rec, ri) => {
      const row = ws.addRow([]);
      row.height = 18;
      const zebra = ri % 2 === 1;
      o.cols.forEach((c, ci) => {
        const cell = row.getCell(ci + 1);
        const v = rec[c.key];
        switch (c.type) {
          case 'status': statusStyle(cell, v); break;
          case 'money':  cell.value = num(v); cell.numFmt = FMT.money; cell.alignment = { horizontal: 'right', vertical: 'middle' }; break;
          case 'int':    cell.value = num(v); cell.numFmt = FMT.int;   cell.alignment = { horizontal: 'right', vertical: 'middle' }; break;
          case 'date':
          case 'datetime': {
            const dt = xlDate(v);
            cell.value = dt ?? (v ? String(v) : '');
            if (dt) cell.numFmt = c.type === 'date' ? FMT.date : FMT.dt;
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
            break;
          }
          case 'center': cell.value = v ?? ''; cell.alignment = { horizontal: 'center', vertical: 'middle' }; break;
          default:       cell.value = v ?? ''; cell.alignment = { horizontal: 'left', vertical: 'middle', indent: ci === 0 ? 1 : 0 };
        }
        if (c.type !== 'status') cell.font = { name: FONT, size: 10, color: { argb: X.ink } };
        cell.border = thinBottom;
        if (zebra && c.type !== 'status') cell.fill = solid(X.stripe);
      });
    });

    if (o.totals) {
      const row = ws.addRow([]);
      row.height = 22;
      o.cols.forEach((c, ci) => {
        const cell = row.getCell(ci + 1);
        const v = o.totals![c.key];
        cell.value = v ?? '';
        if (c.type === 'money') cell.numFmt = FMT.money;
        if (c.type === 'int') cell.numFmt = FMT.int;
        cell.font = { name: FONT, size: 10, bold: true, color: { argb: X.brand } };
        cell.fill = solid(X.gold);
        cell.border = { top: { style: 'medium', color: { argb: X.goldLine } } };
        cell.alignment = { vertical: 'middle', horizontal: c.type === 'money' || c.type === 'int' ? 'right' : 'left', indent: ci === 0 ? 1 : 0 };
      });
    }
    ws.autoFilter = { from: { row: HEAD, column: 1 }, to: { row: HEAD + o.rows.length, column: n } };
  }

  o.blocks?.forEach(b => writeBlock(ws, Math.min(n, 4), b));
  return ws;
}

async function buildExcel(d: Prepared, periodLabel: string, generatedDate: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'e-Kalibro';
  wb.created = new Date();
  wb.title = `e-Kalibro Analytics - ${periodLabel}`;
  const sub = `Period: ${periodLabel}   ·   Generated: ${generatedDate}`;
  const { ov, groups } = d;

  // ── Overview ──────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Overview', {
      properties: { tabColor: { argb: X.brand } },
      views: [{ showGridLines: false }],
      pageSetup: { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = [{ width: 38 }, { width: 22 }, { width: 22 }, { width: 18 }];
    banner(ws, 4, 'e-Kalibro Library Analytics Report', sub);

    const overdueRate = num(ov.totalOverdue) / Math.max(num(ov.activeBorrowings), 1);
    const totalCopies = num(ov.availableBookCopies) + num(ov.activeBorrowings);
    const blocks: Block[] = [
      { title: 'KEY METRICS', head: ['Metric', 'Value'], rows: [
        ['Total Visits', { int: ov.totalVisits }], ['Active Members', { int: ov.activeMembers }],
        ['Total Members', { int: ov.totalMembers }], ['New Members (Period)', { int: ov.newMembers }],
        ['Active Borrowings', { int: ov.activeBorrowings }], ['Returned (Period)', { int: ov.totalReturnedPeriod }],
        ['Total Overdue', { int: ov.totalOverdue }], ['Pending Reservations', { int: ov.totalPendingReservations }],
        ['Pending Return Requests', { int: ov.totalPendingReturnRequests }], ['Payments Count', { int: ov.paymentsCount }],
      ] },
      { title: 'FINANCIAL', head: ['Metric', 'Amount'], rows: [
        ['Paid Fines', { money: ov.totalPaidFines }], ['Unpaid Fines', { money: ov.totalUnpaidFines }],
        ['Waived Fines', { money: ov.totalWaivedFines }],
      ] },
      { title: 'PERFORMANCE RATES', head: ['Metric', 'Value'], rows: [
        ['Overdue Rate (overdue ÷ active borrowings)', { pct: overdueRate }],
        ['Book Utilization (in circulation ÷ total copies)', { pct: num(ov.activeBorrowings) / Math.max(totalCopies, 1) }],
      ] },
      { title: 'COLLECTION SUMMARY', head: ['Item Type', 'Total Titles', 'Available Copies'], rows: [
        ['Books', { int: ov.totalBooks }, { int: ov.availableBookCopies }],
        ['Magazines', { int: ov.totalMagazines }, { int: ov.availableMagazineCopies }],
        ['Theses', { int: ov.totalTheses }, { int: ov.availableThesisCopies }],
        ['Journals', { int: ov.totalJournals }, { int: ov.availableJournalCopies }],
      ] },
      { title: 'CATEGORY DISTRIBUTION', head: ['Category', 'Count', 'Share'], rows:
        d.cats.length ? d.cats.map(c => [c.category ?? 'Unknown', { int: c.count }, { pct: num(c.percentage) / 100 }])
                      : [['No category data available', '', '']] },
    ];
    ws.getRow(3).height = 6;
    blocks.forEach(b => writeBlock(ws, 4, b));
  }

  // ── Borrowings (all types in one filterable sheet) ────────────────────────
  {
    const rows = groups.flatMap(g => g.borrowings.map((i: any) => ({
      type: g.single, title: itemTitle(i), borrower: i.borrowerName ?? i.userName ?? 'N/A',
      bType: i.borrowerType ?? i.userType ?? 'N/A', copy: i.callNumber ?? i.copyNumber ?? 'N/A',
      borrowed: i.borrowDate, due: i.dueDate, returned: i.returnDate, status: i.status ?? 'N/A', approver: i.approvedByName ?? 'N/A',
    })));
    const c = countBy(rows, r => r.status);
    addDataSheet(wb, {
      name: 'Borrowings', title: 'BORROWING ACTIVITY', tab: 'FF2563EB',
      subtitle: `${sub}   ·   Total ${rows.length}  |  Active ${c.borrowed ?? 0}  |  Returned ${c.returned ?? 0}  |  Overdue ${c.overdue ?? 0}`,
      cols: [
        { header: 'Type', key: 'type', width: 12 }, { header: 'Title', key: 'title', width: 38 },
        { header: 'Borrower', key: 'borrower', width: 26 }, { header: 'Borrower Type', key: 'bType', width: 15 },
        { header: 'Copy / Call No', key: 'copy', width: 18 }, { header: 'Borrowed', key: 'borrowed', width: 20, type: 'datetime' },
        { header: 'Due', key: 'due', width: 20, type: 'datetime' }, { header: 'Returned', key: 'returned', width: 20, type: 'datetime' },
        { header: 'Status', key: 'status', width: 13, type: 'status' }, { header: 'Approved By', key: 'approver', width: 22 },
      ],
      rows, emptyMsg: 'No borrowing records found for this period.',
      blocks: rows.length ? [{
        title: 'SUMMARY BY ITEM TYPE', head: ['Item Type', 'Total', 'Active', 'Returned', 'Overdue'],
        rows: groups.map(g => { const k = countBy(g.borrowings, i => i.status); return [g.label, { int: g.borrowings.length }, { int: k.borrowed ?? 0 }, { int: k.returned ?? 0 }, { int: k.overdue ?? 0 }]; }),
      }] : [],
    });
  }

  // ── Reservations ──────────────────────────────────────────────────────────
  {
    const rows = groups.flatMap(g => g.reservations.map((r: any) => ({
      type: g.single, title: itemTitle(r), borrower: r.borrowerName ?? r.userName ?? 'N/A',
      req: r.requestDate, rb: r.requestedBorrowDate, rd: r.requestedDueDate, exp: r.expiryDate,
      status: r.status ?? 'N/A', by: r.reviewedByName ?? 'N/A', reason: r.rejectionReason ?? '',
    })));
    const c = countBy(rows, r => r.status);
    addDataSheet(wb, {
      name: 'Reservations', title: 'RESERVATION ACTIVITY', tab: 'FFD97706', subtitle: `${sub}   ·   Total ${rows.length}`,
      cols: [
        { header: 'Type', key: 'type', width: 12 }, { header: 'Title', key: 'title', width: 38 },
        { header: 'Borrower', key: 'borrower', width: 26 }, { header: 'Requested', key: 'req', width: 20, type: 'datetime' },
        { header: 'Req. Borrow', key: 'rb', width: 20, type: 'datetime' }, { header: 'Req. Due', key: 'rd', width: 20, type: 'datetime' },
        { header: 'Expiry', key: 'exp', width: 20, type: 'datetime' }, { header: 'Status', key: 'status', width: 13, type: 'status' },
        { header: 'Reviewed By', key: 'by', width: 22 }, { header: 'Rejection Reason', key: 'reason', width: 30 },
      ],
      rows, emptyMsg: 'No reservation records found for this period.',
      blocks: rows.length ? [{
        title: 'STATUS BREAKDOWN', head: ['Status', 'Count'],
        rows: ['pending', 'approved', 'rejected', 'fulfilled', 'expired', 'cancelled'].map(s => [s[0].toUpperCase() + s.slice(1), { int: c[s] ?? 0 }]),
      }] : [],
    });
  }

  // ── Return requests ───────────────────────────────────────────────────────
  {
    const rows = groups.flatMap(g => g.returns.map((r: any) => ({
      type: g.single, title: itemTitle(r), borrower: r.borrowerName ?? r.userName ?? 'N/A',
      req: r.requestDate, rr: r.requestedReturnDate, status: r.status ?? 'N/A', cond: r.condition ?? 'N/A',
      ur: r.userRemarks ?? '', sr: r.staffRemarks ?? '', reason: r.rejectionReason ?? '',
    })));
    const s = countBy(rows, r => r.status), c = countBy(rows, r => r.cond);
    addDataSheet(wb, {
      name: 'Return Requests', title: 'RETURN REQUEST ACTIVITY', tab: 'FF65A30D', subtitle: `${sub}   ·   Total ${rows.length}`,
      cols: [
        { header: 'Type', key: 'type', width: 12 }, { header: 'Title', key: 'title', width: 38 },
        { header: 'Borrower', key: 'borrower', width: 26 }, { header: 'Requested', key: 'req', width: 20, type: 'datetime' },
        { header: 'Req. Return', key: 'rr', width: 20, type: 'datetime' }, { header: 'Status', key: 'status', width: 13, type: 'status' },
        { header: 'Condition', key: 'cond', width: 13, type: 'status' }, { header: 'User Remarks', key: 'ur', width: 28 },
        { header: 'Staff Remarks', key: 'sr', width: 28 }, { header: 'Rejection Reason', key: 'reason', width: 30 },
      ],
      rows, emptyMsg: 'No return request records found for this period.',
      blocks: rows.length ? [
        { title: 'STATUS BREAKDOWN', head: ['Status', 'Count'], rows: ['pending', 'approved', 'rejected'].map(k => [k[0].toUpperCase() + k.slice(1), { int: s[k] ?? 0 }]) },
        { title: 'CONDITION BREAKDOWN', head: ['Condition', 'Count'], rows: ['good', 'damaged', 'lost'].map(k => [k[0].toUpperCase() + k.slice(1), { int: c[k] ?? 0 }]) },
      ] : [],
    });
  }

  // ── Overdue ───────────────────────────────────────────────────────────────
  {
    const od = d.overdue;
    const rows = od.map(i => ({
      type: i.itemType ?? 'book', title: itemTitle(i), borrower: i.borrowerName ?? 'N/A', bid: i.borrowerId ?? 'N/A',
      due: i.dueDate, days: num(i.daysOverdue), hours: num(i.hoursOverdue), fine: num(i.fine), sev: severity(num(i.daysOverdue)),
    }));
    const sv = countBy(rows, r => r.sev);
    addDataSheet(wb, {
      name: 'Overdue Items', title: 'OVERDUE ITEMS REPORT', tab: 'FFDC2626', subtitle: `${sub}   ·   Total overdue ${od.length}`,
      cols: [
        { header: 'Type', key: 'type', width: 12 }, { header: 'Title', key: 'title', width: 38 },
        { header: 'Borrower', key: 'borrower', width: 26 }, { header: 'Borrower ID', key: 'bid', width: 16 },
        { header: 'Due Date', key: 'due', width: 20, type: 'datetime' }, { header: 'Days Overdue', key: 'days', width: 14, type: 'int' },
        { header: 'Hours Overdue', key: 'hours', width: 15, type: 'int' }, { header: 'Fine', key: 'fine', width: 18, type: 'money' },
        { header: 'Severity', key: 'sev', width: 13, type: 'status' },
      ],
      rows, emptyMsg: 'No overdue items for this period — great!',
      totals: { type: 'TOTAL', fine: rows.reduce((s, r) => s + r.fine, 0), days: rows.length ? Math.round(rows.reduce((s, r) => s + r.days, 0) / rows.length) : 0 },
      blocks: rows.length ? [{
        title: 'SEVERITY DISTRIBUTION', head: ['Severity', 'Count'],
        rows: [['Critical (>30 days)', { int: sv.critical ?? 0 }], ['High (15–30 days)', { int: sv.high ?? 0 }], ['Medium (8–14 days)', { int: sv.medium ?? 0 }], ['Low (1–7 days)', { int: sv.low ?? 0 }]],
      }] : [],
    });
  }

  // ── Fines ─────────────────────────────────────────────────────────────────
  {
    const fines = d.fines;
    const agg: Record<string, { n: number; amt: number }> = { paid: { n: 0, amt: 0 }, unpaid: { n: 0, amt: 0 }, waived: { n: 0, amt: 0 } };
    let all = 0;
    for (const f of fines) {
      const a = num(f.fineAmount); all += a;
      const k = String(f.status ?? '').toLowerCase();
      if (agg[k]) { agg[k].n++; agg[k].amt += a; }
    }
    addDataSheet(wb, {
      name: 'Fines', title: 'FINES REPORT', tab: 'FFCA8A04', subtitle: `${sub}   ·   Records ${fines.length}`,
      cols: [
        { header: 'Borrower', key: 'user', width: 28 }, { header: 'Item Type', key: 'type', width: 16 },
        { header: 'Borrowing ID', key: 'bid', width: 16, type: 'center' }, { header: 'Fine Amount', key: 'amt', width: 20, type: 'money' },
        { header: 'Status', key: 'status', width: 13, type: 'status' }, { header: 'Calculated At', key: 'at', width: 24, type: 'datetime' },
      ],
      rows: fines.map(f => ({ user: f.userName ?? 'N/A', type: f.itemType ?? 'N/A', bid: f.borrowingId ?? 'N/A', amt: num(f.fineAmount), status: f.status ?? 'N/A', at: f.calculatedAt })),
      emptyMsg: 'No fine records found for this period.',
      totals: { user: 'TOTAL', amt: all },
      blocks: fines.length ? [{
        title: 'FINANCIAL SUMMARY', head: ['Status', 'Count', 'Total Amount'],
        rows: [['Paid', { int: agg.paid.n }, { money: agg.paid.amt }], ['Unpaid', { int: agg.unpaid.n }, { money: agg.unpaid.amt }], ['Waived', { int: agg.waived.n }, { money: agg.waived.amt }], ['TOTAL', { int: fines.length }, { money: all }]],
      }] : [],
    });
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  {
    const pays = d.payments;
    addDataSheet(wb, {
      name: 'Payments', title: 'PAYMENT RECORDS', tab: 'FF16A34A', subtitle: `${sub}   ·   Total ${pays.length}`,
      cols: [
        { header: 'Transaction ID', key: 'tx', width: 22 }, { header: 'Borrower', key: 'user', width: 26 },
        { header: 'Amount', key: 'amt', width: 18, type: 'money' }, { header: 'Type', key: 'ptype', width: 16 },
        { header: 'Method', key: 'method', width: 16 }, { header: 'Date', key: 'date', width: 24, type: 'datetime' },
        { header: 'Received By', key: 'by', width: 22 }, { header: 'Remarks', key: 'remarks', width: 30 },
      ],
      rows: pays.map(p => ({
        tx: p.transactionId ?? 'N/A', user: p.userName ?? 'N/A', amt: num(p.amount),
        ptype: String(p.paymentType ?? 'N/A').toLowerCase(), method: String(p.paymentMethod ?? 'cash').toLowerCase(),
        date: p.paymentDate, by: p.receivedByName ?? p.receivedBy ?? 'N/A', remarks: p.remarks ?? '',
      })),
      emptyMsg: 'No payment records found for this period.',
      totals: { tx: 'TOTAL COLLECTED', amt: pays.reduce((s, p) => s + num(p.amount), 0) },
    });
  }

  // ── Popular items (all types, ranked per type) ────────────────────────────
  {
    const rows = groups.flatMap(g => {
      const maxB = Math.max(...g.topItems.map((i: any) => num(i.borrowCount)), 1);
      return g.topItems.map((i: any, idx: number) => {
        const bc = num(i.borrowCount);
        return {
          type: g.single, rank: idx + 1, title: i.title ?? 'N/A', by: i[g.by] ?? 'N/A', cat: i.category ?? 'General',
          code: i.isbn ?? i.issn ?? 'N/A', count: bc, pop: bc >= maxB * 0.7 ? 'Very High' : bc >= maxB * 0.4 ? 'High' : 'Moderate',
        };
      });
    });
    addDataSheet(wb, {
      name: 'Popular Items', title: 'MOST POPULAR ITEMS', tab: 'FF7C3AED', subtitle: sub,
      cols: [
        { header: 'Type', key: 'type', width: 12 }, { header: 'Rank', key: 'rank', width: 8, type: 'center' },
        { header: 'Title', key: 'title', width: 40 }, { header: 'Author / Publisher', key: 'by', width: 28 },
        { header: 'Category', key: 'cat', width: 20 }, { header: 'ISBN / ISSN', key: 'code', width: 18 },
        { header: 'Borrow Count', key: 'count', width: 15, type: 'int' }, { header: 'Popularity', key: 'pop', width: 14, type: 'center' },
      ],
      rows, emptyMsg: 'No popular item data available for this period.',
      totals: { type: 'TOTAL', count: rows.reduce((s, r) => s + r.count, 0) },
    });
  }

  // ── Daily visits ──────────────────────────────────────────────────────────
  {
    const counts = d.visits.map(v => num(v.count));
    const total = counts.reduce((a, b) => a + b, 0), avg = counts.length ? total / counts.length : 0;
    addDataSheet(wb, {
      name: 'Daily Visits', title: 'DAILY VISITS TREND', tab: 'FF0D9488', subtitle: sub,
      cols: [
        { header: 'Date', key: 'date', width: 16, type: 'date' }, { header: 'Day of Week', key: 'dow', width: 18 },
        { header: 'Visitors', key: 'count', width: 14, type: 'int' }, { header: 'Trend', key: 'trend', width: 14, type: 'center' },
      ],
      rows: d.visits.map((v, i) => {
        const dt = toDate(v.date);
        return {
          date: v.date, dow: dt ? dt.toLocaleDateString('en-US', { weekday: 'long', timeZone: TZ }) : '',
          count: counts[i], trend: counts[i] > avg * 1.2 ? 'Above Avg' : counts[i] < avg * 0.8 ? 'Below Avg' : 'Average',
        };
      }),
      emptyMsg: 'No visit data available for this period.',
      totals: { date: 'TOTAL', count: total },
      blocks: counts.length ? [{
        title: 'STATISTICS', head: ['Metric', 'Value'],
        rows: [['Average', parseFloat(avg.toFixed(1))], ['Peak', { int: Math.max(...counts) }], ['Lowest', { int: Math.min(...counts) }]],
      }] : [],
    });
  }

  // ── Members / Staff / QR ──────────────────────────────────────────────────
  addDataSheet(wb, {
    name: 'Members', title: 'MEMBER DIRECTORY', tab: 'FF0D9488', subtitle: `${sub}   ·   Showing ${d.members.length}`,
    cols: [
      { header: 'Name', key: 'name', width: 26 }, { header: 'User Type', key: 'type', width: 14 }, { header: 'Username', key: 'user', width: 20 },
      { header: 'Email', key: 'email', width: 32 }, { header: 'Phone', key: 'phone', width: 16 }, { header: 'Enrollment / Faculty No', key: 'no', width: 24 },
      { header: 'Department', key: 'dept', width: 22 }, { header: 'Joined', key: 'joined', width: 24, type: 'datetime' }, { header: 'Status', key: 'status', width: 12, type: 'status' },
    ],
    rows: d.members.map(m => ({ name: m.name ?? 'N/A', type: m.userType ?? 'N/A', user: m.username ?? 'N/A', email: m.email ?? 'N/A', phone: m.phone ?? 'N/A', no: m.enrollmentNo ?? m.facultyNumber ?? 'N/A', dept: m.department ?? 'N/A', joined: m.createdAt, status: m.isActive ? 'active' : 'inactive' })),
    emptyMsg: 'No member records found.',
  });

  addDataSheet(wb, {
    name: 'Staff', title: 'STAFF DIRECTORY', tab: 'FF0D9488', subtitle: `Generated: ${generatedDate}`,
    cols: [
      { header: 'Name', key: 'name', width: 26 }, { header: 'Username', key: 'user', width: 20 }, { header: 'Email', key: 'email', width: 32 },
      { header: 'Department', key: 'dept', width: 22 }, { header: 'Position', key: 'pos', width: 22 },
      { header: 'Status', key: 'status', width: 12, type: 'status' }, { header: 'Joined', key: 'joined', width: 24, type: 'datetime' },
    ],
    rows: d.staff.map(s => ({ name: s.name ?? 'N/A', user: s.username ?? 'N/A', email: s.email ?? 'N/A', dept: s.department ?? 'N/A', pos: s.position ?? 'N/A', status: s.isActive ? 'active' : 'inactive', joined: s.createdAt })),
    emptyMsg: 'No staff records found.',
  });

  addDataSheet(wb, {
    name: 'QR Scans', title: 'QR SCAN ACTIVITY', tab: 'FF57534E', subtitle: `${sub}   ·   Total scans ${d.qr.length}`,
    cols: [
      { header: 'QR Code', key: 'qr', width: 30 }, { header: 'Item Type', key: 'type', width: 14 }, { header: 'Scan Type', key: 'st', width: 16 },
      { header: 'Result', key: 'res', width: 14, type: 'center' }, { header: 'Scanned By', key: 'by', width: 22 }, { header: 'User', key: 'user', width: 22 },
      { header: 'Location', key: 'loc', width: 22 }, { header: 'Scanned At', key: 'at', width: 24, type: 'datetime' },
    ],
    rows: d.qr.map(q => ({ qr: q.qrCode ?? 'N/A', type: q.itemType ?? 'N/A', st: q.scanType ?? 'N/A', res: q.scanResult ?? 'N/A', by: q.scannedByName ?? 'N/A', user: q.userName ?? 'N/A', loc: q.scanLocation ?? 'N/A', at: q.scannedAt })),
    emptyMsg: 'No QR scan records found for this period.',
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ════════════════════════════════════════════════════════════════════════════
   ROUTE HANDLER
   ════════════════════════════════════════════════════════════════════════════ */

const PERIODS = new Set(['week', 'month', 'quarter', 'year', 'all']);

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    const rawPeriod = url.searchParams.get('period') ?? 'month';
    const period = PERIODS.has(rawPeriod) ? rawPeriod : 'month';
    const format = url.searchParams.get('format') === 'excel' ? 'excel' : 'pdf';
    const { start, end } = getDateRange(period);

    // Fines must be recalculated first; everything after runs in parallel.
    await updateAllOverdueFines();

    const [res, finesRaw] = await Promise.all([
      fetch(`/api/reports?period=${period}`),
      db.select({
        userName: tbl_user.name,
        borrowingId: tbl_fine.borrowingId,
        fineAmount: tbl_fine.fineAmount,
        status: tbl_fine.status,
        calculatedAt: tbl_fine.createdAt,
      })
        .from(tbl_fine)
        .leftJoin(tbl_user, eq(tbl_fine.userId, tbl_user.id))
        .where(and(gte(tbl_fine.createdAt, start), lte(tbl_fine.createdAt, end))),
    ]);

    if (!res.ok) throw new Error(`Failed to fetch report data: ${res.status}`);
    const result = await res.json();
    if (!result.success) throw new Error(result.message ?? 'Failed to fetch report data');
    const data = result.data;
    if (!data?.overview || !data?.charts || !data?.tables) throw new Error('Invalid data structure');

    // Per-item overdue maths, all in parallel.
    if (Array.isArray(data.tables.overdueList)) {
      data.tables.overdueList = await Promise.all(
        data.tables.overdueList.map(async (item: any) => {
          if (item.dueDate) {
            const due = new Date(item.dueDate);
            const [days, fine] = await Promise.all([calculateDaysOverdue(due), calculateFineAmount(due)]);
            item.daysOverdue = days;
            item.fine = fine;
            item.hoursOverdue = fine > 0 ? Math.ceil(fine / 5) : 0;
          }
          return item;
        })
      );
    }

    data.tables.fines = finesRaw.map(f => ({
      userName: f.userName, itemType: 'N/A', borrowingId: f.borrowingId,
      fineAmount: Number(f.fineAmount), daysOverdue: 0, status: f.status, calculatedAt: f.calculatedAt,
    }));

    const periodLabel = getPeriodLabel(period);
    const generatedDate = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
    });
    const prepared = prepare(data);
    const stamp = new Date().toISOString().split('T')[0];

    if (format === 'excel') {
      const buf = await buildExcel(prepared, periodLabel, generatedDate);
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="e-kalibro_report_${period}_${stamp}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const buf = await buildPdf(prepared, periodLabel, generatedDate);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="e-kalibro_report_${period}_${stamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Export error:', err);
    throw error(500, { message: err.message ?? 'Export failed' });
  }
};