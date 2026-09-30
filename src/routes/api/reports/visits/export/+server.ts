import PDFDocument from 'pdfkit';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { createRequire } from 'node:module';
import type ExcelJSTypes from 'exceljs';
import type { Cell, Worksheet } from 'exceljs';
import type { RequestHandler } from './$types.js';
import { error } from '@sveltejs/kit';

const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof ExcelJSTypes;

/* ════════════════════════════════════════════════════════════════════════════
   Types, labels, helpers
   ════════════════════════════════════════════════════════════════════════════ */

interface VisitRecord {
  id: number;
  visitorName: string | null;
  visitorType: string | null;
  idNumber: string | null;
  purpose: string;
  timeIn: string | Date;
  timeOut: string | Date | null;
  duration: string;
  status: string;
}

const PERIOD_LABELS: Record<string, string> = {
  day: 'Today',
  week: 'Last 7 Days',
  month: 'Last 30 Days',
  year: 'Last 12 Months',
  all: 'All Time',
};

const TZ = 'Asia/Manila';
const PH_OFFSET_MS = 8 * 3600_000;

const toDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dateParts = (v: unknown) => {
  const d = toDate(v);
  if (!d) return null;
  return {
    date: d.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }),
  };
};
/** ExcelJS writes dates as UTC serials; shift so Excel displays Manila wall-clock time. */
const xlDate = (v: unknown): Date | null => {
  const d = toDate(v);
  return d ? new Date(d.getTime() + PH_OFFSET_MS) : null;
};

const isOut = (v: VisitRecord) => v.status === 'checked_out';
const statusLabel = (v: VisitRecord) => (isOut(v) ? 'Checked Out' : 'Checked In');
const visitorLabel = (v: VisitRecord) => v.visitorName || 'Walk-in visitor';

const STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  'Checked In':  { fg: '1D4ED8', bg: 'DBEAFE' },
  'Checked Out': { fg: '15803D', bg: 'DCFCE7' },
};

/** One pass over the data — feeds KPI cards, charts and the Summary sheet. */
function summarize(visits: VisitRecord[]) {
  const byType = new Map<string, number>();
  const byPurpose = new Map<string, number>();
  const unique = new Set<string>();
  let checkedOut = 0;
  for (const v of visits) {
    if (isOut(v)) checkedOut++;
    const t = v.visitorType || 'N/A';
    const p = (v.purpose || 'N/A').trim() || 'N/A';
    byType.set(t, (byType.get(t) ?? 0) + 1);
    byPurpose.set(p, (byPurpose.get(p) ?? 0) + 1);
    unique.add((v.idNumber || v.visitorName || `visit-${v.id}`).toLowerCase());
  }
  const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return {
    total: visits.length,
    checkedOut,
    checkedIn: visits.length - checkedOut,
    unique: unique.size,
    types: sorted(byType),
    purposes: sorted(byPurpose),
  };
}
type Summary = ReturnType<typeof summarize>;

let logoCache: Buffer | null | undefined;
function getLogo(): Buffer | null {
  if (logoCache !== undefined) return logoCache;
  try {
    const p = nodePath.resolve('static/assets/logo.png');
    logoCache = fs.existsSync(p) ? fs.readFileSync(p) : null;
  } catch {
    logoCache = null;
  }
  return logoCache;
}

/* ════════════════════════════════════════════════════════════════════════════
   PDF
   ════════════════════════════════════════════════════════════════════════════ */

const P = {
  brand: '#14532d', brand2: '#16a34a', soft: '#dcfce7', gold: '#ca8a04', goldSoft: '#fef9c3',
  info: '#2563eb', amber: '#d97706', purple: '#7c3aed', teal: '#0d9488',
  ink: '#1c1917', mid: '#57534e', muted: '#a8a29e', line: '#e7e5e4', stripe: '#fafaf9',
  track: '#efedea', white: '#ffffff',
};

function buildPdf(visits: VisitRecord[], periodLabel: string, generatedAt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // margin 0 + manual layout => no surprise auto-pagination when drawing footers.
    const doc = new PDFDocument({
      size: 'A4', layout: 'landscape', margin: 0, bufferPages: true, autoFirstPage: false,
      info: { Title: `Library Visit Report - ${periodLabel}`, Author: 'e-Kalibro' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      doc.addPage();
      const W = doc.page.width, H = doc.page.height;
      const ML = 32, CW = W - ML * 2, FOOT = 24, BOTTOM = H - FOOT - 8;
      const stats = summarize(visits);

      // ── layout helpers ────────────────────────────────────────────────────
      const bar = (title: string, items: [string, number][], x: number, y: number, w: number, color: string) => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(P.mid)
          .text(title.toUpperCase(), x, y, { width: w, lineBreak: false, characterSpacing: 0.4 });
        let cy = y + 16;
        if (!items.length) {
          doc.font('Helvetica').fontSize(8).fillColor(P.muted).text('No data', x, cy, { lineBreak: false });
          return;
        }
        const labelW = 92, valW = 26, aW = w - labelW - valW, barH = 10;
        const max = Math.max(...items.map(i => i[1]), 1);
        for (const [label, value] of items) {
          doc.font('Helvetica').fontSize(7).fillColor(P.ink)
            .text(label, x, cy + 1.5, { width: labelW - 6, height: 9, ellipsis: true });
          doc.roundedRect(x + labelW, cy, aW, barH, 3).fill(P.track);
          doc.roundedRect(x + labelW, cy, Math.max((value / max) * aW, 4), barH, 3).fill(color);
          doc.font('Helvetica-Bold').fontSize(7).fillColor(P.ink)
            .text(String(value), x + labelW + aW + 5, cy + 1.5, { width: valW - 5, lineBreak: false });
          cy += barH + 6;
        }
      };

      const kpi = (label: string, value: string, x: number, y: number, w: number, accent: string) => {
        doc.roundedRect(x, y, w, 46, 6).fillAndStroke(P.white, P.line);
        doc.save();
        doc.roundedRect(x, y, w, 46, 6).clip();
        doc.rect(x, y, 4, 46).fill(accent);
        doc.restore();
        doc.font('Helvetica').fontSize(6.5).fillColor(P.mid)
          .text(label.toUpperCase(), x + 14, y + 10, { width: w - 20, lineBreak: false, characterSpacing: 0.4 });
        doc.font('Helvetica-Bold').fontSize(16).fillColor(P.ink)
          .text(value, x + 14, y + 22, { width: w - 20, lineBreak: false });
      };

      // ── table definition ──────────────────────────────────────────────────
      const cols = [
        { t: 'ID', w: 34, a: 'left' }, { t: 'Visitor', w: 122, a: 'left' }, { t: 'Type', w: 62, a: 'left' },
        { t: 'ID Number', w: 82, a: 'left' }, { t: 'Purpose', w: 150, a: 'left' }, { t: 'Time In', w: 100, a: 'left' },
        { t: 'Time Out', w: 100, a: 'left' }, { t: 'Duration', w: 52, a: 'left' }, { t: 'Status', w: 76, a: 'left' },
      ] as const;
      const scale = CW / cols.reduce((s, c) => s + c.w, 0);
      const cw = cols.map(c => c.w * scale);
      const RH = 26, HH = 22;

      const drawTableHead = (y: number) => {
        doc.rect(ML, y, CW, HH).fill(P.brand2);
        let x = ML;
        cols.forEach((c, i) => {
          doc.font('Helvetica-Bold').fontSize(7).fillColor(P.white)
            .text(c.t.toUpperCase(), x + 6, y + 8, { width: cw[i] - 12, lineBreak: false, characterSpacing: 0.3 });
          x += cw[i];
        });
        return y + HH;
      };

      const drawRow = (v: VisitRecord, y: number, zebra: boolean) => {
        if (zebra) doc.rect(ML, y, CW, RH).fill(P.stripe);
        doc.moveTo(ML, y + RH).lineTo(ML + CW, y + RH).strokeColor(P.line).lineWidth(0.4).stroke();

        const text = (s: string, i: number, x: number, bold = false, color = P.ink) =>
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5).fillColor(color)
            .text(s, x + 6, y + 9, { width: cw[i] - 12, height: 10, ellipsis: true });

        const twoLine = (val: unknown, i: number, x: number) => {
          const p = dateParts(val);
          if (!p) {
            doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(P.muted)
              .text('Not checked out', x + 6, y + 9, { width: cw[i] - 12, lineBreak: false });
            return;
          }
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(P.ink).text(p.date, x + 6, y + 5, { width: cw[i] - 12, lineBreak: false });
          doc.font('Helvetica').fontSize(7).fillColor(P.mid).text(p.time, x + 6, y + 14, { width: cw[i] - 12, lineBreak: false });
        };

        let x = ML;
        text(String(v.id), 0, x, false, P.mid); x += cw[0];
        text(visitorLabel(v), 1, x, true); x += cw[1];
        text(v.visitorType || 'N/A', 2, x); x += cw[2];
        text(v.idNumber || 'N/A', 3, x); x += cw[3];
        doc.font('Helvetica').fontSize(7).fillColor(P.ink)
          .text(v.purpose || 'N/A', x + 6, y + 4, { width: cw[4] - 12, height: RH - 6, ellipsis: true }); x += cw[4];
        twoLine(v.timeIn, 5, x); x += cw[5];
        twoLine(v.timeOut, 6, x); x += cw[6];
        text(v.duration || 'N/A', 7, x); x += cw[7];

        const label = statusLabel(v), st = STATUS_STYLE[label];
        const pillW = Math.min(cw[8] - 12, 62);
        doc.roundedRect(x + 6, y + 7, pillW, 12, 6).fill('#' + st.bg);
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#' + st.fg)
          .text(label, x + 6, y + 10.5, { width: pillW, align: 'center', lineBreak: false });
      };

      // ── page 1: header, KPIs, breakdowns ──────────────────────────────────
      doc.rect(0, 0, W, 80).fill(P.brand);
      doc.rect(0, 80, W, 4).fill(P.gold);
      doc.save();
      doc.fillOpacity(0.06).fillColor(P.white).circle(W - 60, 20, 110).fill();
      doc.restore();

      let tx = ML;
      const logo = getLogo();
      if (logo) {
        try {
          doc.roundedRect(ML, 16, 48, 48, 8).fill(P.white);
          doc.image(logo, ML + 4, 20, { fit: [40, 40], align: 'center', valign: 'center' });
          tx = ML + 62;
        } catch { tx = ML; }
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(P.goldSoft)
        .text('e-KALIBRO  ·  LIBRARY MANAGEMENT SYSTEM', tx, 20, { lineBreak: false, characterSpacing: 1 });
      doc.font('Helvetica-Bold').fontSize(22).fillColor(P.white).text('Library Visit Report', tx, 34, { lineBreak: false });
      doc.font('Helvetica').fontSize(8.5).fillColor(P.soft)
        .text(`Generated ${generatedAt}`, tx, 62, { lineBreak: false });

      doc.font('Helvetica-Bold').fontSize(9);
      const label = periodLabel.toUpperCase();
      const pillW = doc.widthOfString(label) + 28;
      doc.roundedRect(W - ML - pillW, 30, pillW, 22, 11).fill(P.gold);
      doc.fillColor(P.white).text(label, W - ML - pillW + 14, 37, { lineBreak: false });

      const gap = 10, kw = (CW - gap * 3) / 4;
      const ky = 100;
      kpi('Total visits', stats.total.toLocaleString('en-US'), ML, ky, kw, P.info);
      kpi('Currently checked in', stats.checkedIn.toLocaleString('en-US'), ML + (kw + gap), ky, kw, P.amber);
      kpi('Checked out', stats.checkedOut.toLocaleString('en-US'), ML + (kw + gap) * 2, ky, kw, P.brand2);
      kpi('Unique visitors', stats.unique.toLocaleString('en-US'), ML + (kw + gap) * 3, ky, kw, P.purple);

      let y = ky + 46 + 16;
      if (stats.total > 0) {
        const half = (CW - 24) / 2;
        bar('Visits by visitor type', stats.types.slice(0, 5), ML, y, half, P.teal);
        bar('Top purposes', stats.purposes.slice(0, 5), ML + half + 24, y, half, P.brand2);
        y += 16 + Math.max(Math.min(stats.types.length, 5), Math.min(stats.purposes.length, 5), 1) * 16 + 8;
      }

      // section label
      doc.font('Helvetica-Bold').fontSize(11).fillColor(P.ink).text('Visit Log', ML, y, { lineBreak: false });
      doc.rect(ML, y + 15, 40, 2).fill(P.brand2);
      doc.moveTo(ML + 40, y + 16).lineTo(ML + CW, y + 16).strokeColor(P.line).lineWidth(0.8).stroke();
      y += 26;

      if (visits.length === 0) {
        doc.roundedRect(ML, y, CW, 30, 5).fillAndStroke(P.stripe, P.line);
        doc.rect(ML, y + 6, 3, 18).fill(P.amber);
        doc.font('Helvetica').fontSize(9).fillColor(P.mid)
          .text('No visits found for the selected filters.', ML + 14, y + 11, { lineBreak: false });
      } else {
        y = drawTableHead(y);
        visits.forEach((v, i) => {
          if (y + RH > BOTTOM) {
            doc.addPage();
            y = drawTableHead(MT_CONT);
          }
          drawRow(v, y, i % 2 === 1);
          y += RH;
        });
      }

      // ── footers on every page: "Page X of Y" ──────────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const fy = H - FOOT;
        if (i > 0) doc.rect(0, 0, W, 4).fill(P.brand2);
        doc.rect(0, fy, W, FOOT).fill(P.stripe);
        doc.moveTo(0, fy).lineTo(W, fy).strokeColor(P.line).lineWidth(0.5).stroke();
        doc.rect(0, fy, 60, 1.5).fill(P.brand2);
        doc.font('Helvetica').fontSize(7).fillColor(P.mid)
          .text(`e-Kalibro Library Management System  ·  Visit Report  ·  ${periodLabel}`, ML, fy + 9, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(7).fillColor(P.brand)
          .text(`Page ${i + 1} of ${range.count}`, ML, fy + 9, { width: CW, align: 'right', lineBreak: false });
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
const MT_CONT = 24; // top offset for table on continuation pages

/* ════════════════════════════════════════════════════════════════════════════
   EXCEL
   ════════════════════════════════════════════════════════════════════════════ */

const X = {
  brand: 'FF14532D', brand2: 'FF16A34A', soft: 'FFDCFCE7', gold: 'FFFEF9C3',
  stripe: 'FFF7F7F5', line: 'FFE7E5E4', ink: 'FF1C1917', mid: 'FF57534E', muted: 'FFA8A29E', white: 'FFFFFFFF',
};
const FONT = 'Calibri';
const DT_FMT = 'mmm d, yyyy h:mm AM/PM';
const solid = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
const hair = { bottom: { style: 'thin' as const, color: { argb: X.line } } };

function banner(ws: Worksheet, span: number, title: string, subtitle: string) {
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, size: 16, bold: true, color: { argb: X.white } };
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 32;
  ws.mergeCells(2, 1, 2, span);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: FONT, size: 10, color: { argb: X.mid } };
  s.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 20;
  for (let c = 1; c <= span; c++) {
    ws.getCell(1, c).fill = solid(X.brand);
    ws.getCell(2, c).fill = solid(X.soft);
  }
  ws.getRow(3).height = 6;
}

function statusCell(cell: Cell, label: string) {
  const st = STATUS_STYLE[label];
  cell.value = label.toUpperCase();
  cell.font = { name: FONT, size: 9, bold: true, color: { argb: 'FF' + st.fg } };
  cell.fill = solid('FF' + st.bg);
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function summaryBlock(ws: Worksheet, title: string, head: string[], rows: (string | number)[][]) {
  if (!rows.length) rows = [['No data for this period', '—', '—']];
  ws.addRow([]);
  const t = ws.addRow([title]);
  ws.mergeCells(t.number, 1, t.number, 3);
  t.height = 20;
  for (let c = 1; c <= 3; c++) t.getCell(c).fill = solid(X.brand2);
  t.getCell(1).font = { name: FONT, size: 11, bold: true, color: { argb: X.white } };
  t.getCell(1).alignment = { vertical: 'middle', indent: 1 };

  const h = ws.addRow(head);
  h.eachCell((c) => {
    c.font = { name: FONT, size: 10, bold: true, color: { argb: X.brand } };
    c.fill = solid(X.soft);
    c.border = hair;
    c.alignment = { horizontal: c.col === 1 ? 'left' : 'right', indent: c.col === 1 ? 1 : 0 };
  });
  rows.forEach((r, i) => {
    const row = ws.addRow(r);
    row.eachCell((c) => {
      c.font = { name: FONT, size: 10, bold: c.col === 1, color: { argb: X.ink } };
      c.border = hair;
      c.alignment = { horizontal: c.col === 1 ? 'left' : 'right', indent: c.col === 1 ? 1 : 0 };
      if (typeof c.value === 'number' && c.col === 3) c.numFmt = '0.0%';
      if (i % 2 === 1) c.fill = solid(X.stripe);
    });
  });
}

async function buildExcel(visits: VisitRecord[], periodLabel: string, generatedAt: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'e-Kalibro';
  wb.created = new Date();
  wb.title = `Library Visit Report - ${periodLabel}`;
  const stats = summarize(visits);
  const sub = `${periodLabel}   ·   ${visits.length} visits   ·   Generated ${generatedAt}`;

  // ── Sheet 1: Visits ───────────────────────────────────────────────────────
  const ws = wb.addWorksheet('Visits', {
    properties: { tabColor: { argb: 'FF16A34A' } },
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      printTitlesRow: '4:4', margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: '&LVisit Report&CPage &P of &N&R&D' },
  });
  const columns = [
    { header: 'Visit ID', key: 'id', width: 10, align: 'center' },
    { header: 'Visitor', key: 'visitor', width: 28, align: 'left' },
    { header: 'Visitor Type', key: 'type', width: 16, align: 'left' },
    { header: 'ID Number', key: 'idNumber', width: 20, align: 'left' },
    { header: 'Purpose', key: 'purpose', width: 34, align: 'left' },
    { header: 'Time In', key: 'timeIn', width: 22, align: 'left' },
    { header: 'Time Out', key: 'timeOut', width: 22, align: 'left' },
    { header: 'Duration', key: 'duration', width: 14, align: 'center' },
    { header: 'Status', key: 'status', width: 15, align: 'center' },
  ] as const;
  ws.columns = columns.map(c => ({ key: c.key, width: c.width }));
  banner(ws, columns.length, 'Library Visit Report', sub);

  const head = ws.getRow(4);
  head.height = 24;
  columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: X.white } };
    cell.fill = solid(X.brand2);
    cell.alignment = { vertical: 'middle', horizontal: c.align, indent: c.key === 'visitor' ? 1 : 0 };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFCA8A04' } } };
  });

  if (!visits.length) {
    const r = ws.addRow(['No visits found\nTry a different period or clear the filters, then export again.']);
    ws.mergeCells(r.number, 1, r.number, columns.length);
    r.height = 64;
    for (let c = 1; c <= columns.length; c++) {
      ws.getCell(r.number, c).fill = solid(X.stripe);
      ws.getCell(r.number, c).border = hair;
    }
    r.getCell(1).font = { name: FONT, size: 12, bold: true, color: { argb: X.mid } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  } else {
    visits.forEach((v, idx) => {
      const row = ws.addRow([]);
      row.height = 20;
      const timeIn = xlDate(v.timeIn), timeOut = xlDate(v.timeOut);
      const values: unknown[] = [
        v.id, visitorLabel(v), v.visitorType || 'N/A', v.idNumber || 'N/A', v.purpose || 'N/A',
        timeIn ?? 'N/A', timeOut ?? 'Not checked out', v.duration || 'N/A', statusLabel(v),
      ];
      columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (c.key === 'status') {
          statusCell(cell, statusLabel(v));
        } else {
          cell.value = values[i] as any;
          const isDate = values[i] instanceof Date;
          const placeholder = c.key === 'timeOut' && !timeOut;
          cell.font = {
            name: FONT, size: 10, bold: c.key === 'visitor', italic: placeholder,
            color: { argb: placeholder ? X.muted : X.ink },
          };
          cell.alignment = { vertical: 'middle', horizontal: c.align, indent: c.key === 'visitor' ? 1 : 0 };
          if (isDate) cell.numFmt = DT_FMT;
          if (idx % 2 === 1) cell.fill = solid(X.stripe);
        }
        cell.border = hair;
      });
    });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + visits.length, column: columns.length } };

    const foot = ws.addRow([`Showing ${visits.length} visit${visits.length === 1 ? '' : 's'}   ·   ${stats.checkedIn} checked in   ·   ${stats.checkedOut} checked out`]);
    ws.mergeCells(foot.number, 1, foot.number, columns.length);
    foot.height = 24;
    for (let c = 1; c <= columns.length; c++) {
      ws.getCell(foot.number, c).fill = solid(X.gold);
      ws.getCell(foot.number, c).border = { top: { style: 'medium', color: { argb: 'FFCA8A04' } } };
    }
    foot.getCell(1).font = { name: FONT, size: 10, bold: true, color: { argb: X.brand } };
    foot.getCell(1).alignment = { vertical: 'middle', indent: 1 };
  }

  // ── Sheet 2: Summary ──────────────────────────────────────────────────────
  const sm = wb.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF14532D' } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  sm.columns = [{ width: 36 }, { width: 16 }, { width: 16 }];
  banner(sm, 3, 'Visit Summary', sub);

  const pct = (n: number) => (stats.total ? n / stats.total : 0);
  summaryBlock(sm, 'OVERVIEW', ['Metric', 'Value', 'Share'], [
    ['Total Visits', stats.total, 1],
    ['Currently Checked In', stats.checkedIn, pct(stats.checkedIn)],
    ['Checked Out', stats.checkedOut, pct(stats.checkedOut)],
    ['Unique Visitors', stats.unique, '—'],
  ]);
  summaryBlock(sm, 'BY VISITOR TYPE', ['Visitor Type', 'Visits', 'Share'], stats.types.map(([k, n]) => [k, n, pct(n)]));
  summaryBlock(sm, 'BY PURPOSE', ['Purpose', 'Visits', 'Share'], stats.purposes.map(([k, n]) => [k, n, pct(n)]));

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ════════════════════════════════════════════════════════════════════════════
   Route handler (logic unchanged)
   ════════════════════════════════════════════════════════════════════════════ */

export const GET: RequestHandler = async ({ url, fetch }) => {
  try {
    const requestedPeriod = url.searchParams.get('period') ?? 'month';
    const period = PERIOD_LABELS[requestedPeriod] ? requestedPeriod : 'month';
    const format = url.searchParams.get('format') === 'excel' ? 'excel' : 'pdf';
    const reportParams = new URLSearchParams({ period });

    for (const key of ['date', 'time']) {
      const value = url.searchParams.get(key);
      if (value) reportParams.set(key, value);
    }

    const reportResponse = await fetch(`/api/reports/visits?${reportParams}`);
    if (!reportResponse.ok) throw new Error(`Visit report request failed (${reportResponse.status})`);

    const reportData = await reportResponse.json() as { success: boolean; visits?: VisitRecord[] };
    if (!reportData.success || !Array.isArray(reportData.visits)) {
      throw new Error('Visit report returned an invalid response');
    }

    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
    const status = url.searchParams.get('status') ?? 'all';
    const visitorType = (url.searchParams.get('visitorType') ?? 'all').toLowerCase();
    const visits = reportData.visits.filter((visit) => {
      const matchesStatus = status === 'all' || visit.status === status;
      const matchesType = visitorType === 'all' || (visit.visitorType ?? '').toLowerCase() === visitorType;
      const matchesSearch = !search || [visit.visitorName, visit.idNumber, visit.purpose]
        .some((value) => (value ?? '').toLowerCase().includes(search));
      return matchesStatus && matchesType && matchesSearch;
    });

    const dateFilter = url.searchParams.get('date');
    const timeFilter = url.searchParams.get('time');
    const periodLabel = dateFilter
      ? timeFilter ? `${dateFilter} at ${timeFilter}` : dateFilter
      : PERIOD_LABELS[requestedPeriod] ?? PERIOD_LABELS.month;
    const generatedAt = new Date().toLocaleString('en-US', {
      timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'excel') {
      const buffer = await buildExcel(visits, periodLabel, generatedAt);
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="library_visits_${stamp}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const buffer = await buildPdf(visits, periodLabel, generatedAt);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="library_visits_${stamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[GET /api/reports/visits/export] Error:', err);
    throw error(500, { message: 'Failed to export visit report' });
  }
};