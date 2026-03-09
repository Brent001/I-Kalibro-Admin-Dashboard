declare module 'pdfkit' {
  interface PDFDocumentOptions {
    margin?: number;
    size?: string | [number, number];
    info?: {
      Title?: string;
      Author?: string;
      Subject?: string;
      Keywords?: string;
      Creator?: string;
      Producer?: string;
      CreationDate?: Date;
    };
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions);

    // Page properties
    page: {
      width: number;
      height: number;
    };

    // Positioning
    x: number;
    y: number;

    // Text methods
    font(font: string): this;
    fontSize(size: number): this;
    fillColor(color: string): this;
    strokeColor(color: string): this;
    text(text: string, x?: number, y?: number, options?: any): this;

    // Drawing methods
    rect(x: number, y: number, width: number, height: number): this;
    roundedRect(x: number, y: number, width: number, height: number, radius: number): this;
    circle(x: number, y: number, radius: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;

    // Fill and stroke
    fill(color?: string): this;
    stroke(color?: string): this;
    fillAndStroke(fillColor?: string, strokeColor?: string): this;

    // Line properties
    lineWidth(width: number): this;

    // Page management
    addPage(options?: PDFDocumentOptions): this;

    // Event handling
    on(event: 'data', callback: (chunk: Buffer) => void): this;
    on(event: 'end', callback: () => void): this;

    // Document control
    end(): void;

    // Utility
    bufferedPageRange(): { start: number; count: number };
    switchToPage(pageNum: number): this;
  }

  export = PDFDocument;
}