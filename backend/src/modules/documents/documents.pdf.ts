import PDFDocument from "pdfkit";

import type {
  DocumentField,
  DocumentPartyBlock,
  GeneratedDocumentTemplate,
} from "./documents.types";

const COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  border: "#dbe4ec",
  panel: "#f8fafc",
  banner: "#0f766e",
  bannerSoft: "#134e4a",
  white: "#ffffff",
};

const bufferFromPdf = (doc: PDFKit.PDFDocument) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

const ensurePageSpace = (
  doc: PDFKit.PDFDocument,
  cursorY: number,
  requiredHeight: number,
) => {
  const limit = doc.page.height - doc.page.margins.bottom - 26;

  if (cursorY + requiredHeight <= limit) {
    return cursorY;
  }

  doc.addPage();
  return 118;
};

const drawPageChrome = (
  doc: PDFKit.PDFDocument,
  template: GeneratedDocumentTemplate,
  pageNumber: number,
) => {
  const usableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .save()
    .roundedRect(doc.page.margins.left, 26, usableWidth, 64, 18)
    .fill(COLORS.banner)
    .restore();

  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(template.shop.logoPlaceholder, doc.page.margins.left + 16, 44, {
      width: 46,
      align: "center",
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(template.title, doc.page.margins.left + 74, 40, {
      width: usableWidth - 180,
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .text(template.shop.name, doc.page.margins.left + 74, 62, {
      width: usableWidth - 180,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(template.documentNumber, doc.page.margins.left, 46, {
      width: usableWidth - 18,
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(8)
    .text(template.generatedAt, doc.page.margins.left, doc.page.height - 28, {
      width: usableWidth,
      align: "left",
    });

  doc.text(`Page ${pageNumber}`, doc.page.margins.left, doc.page.height - 28, {
    width: usableWidth,
    align: "right",
  });
};

const drawBadgeRow = (
  doc: PDFKit.PDFDocument,
  badges: string[],
  x: number,
  y: number,
) => {
  let cursorX = x;

  badges.forEach((badge) => {
    doc.font("Helvetica-Bold").fontSize(8);
    const width = Math.max(doc.widthOfString(badge) + 18, 56);

    doc
      .save()
      .roundedRect(cursorX, y, width, 18, 9)
      .fill(COLORS.panel)
      .restore();

    doc
      .fillColor(COLORS.bannerSoft)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(badge, cursorX, y + 5, {
        width,
        align: "center",
      });

    cursorX += width + 8;
  });
};

const drawFieldCards = (
  doc: PDFKit.PDFDocument,
  fields: DocumentField[],
  x: number,
  y: number,
  width: number,
  columns: number,
) => {
  const gap = 10;
  const cardWidth = (width - gap * (columns - 1)) / columns;
  let cursorY = y;

  fields.forEach((field, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cardX = x + column * (cardWidth + gap);
    const cardY = y + row * 52;

    doc
      .save()
      .roundedRect(cardX, cardY, cardWidth, 42, 12)
      .fill(COLORS.panel)
      .restore();

    doc
      .fillColor(COLORS.muted)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(field.label.toUpperCase(), cardX + 12, cardY + 8, {
        width: cardWidth - 24,
      });

    doc
      .fillColor(COLORS.ink)
      .font(field.emphasis === "strong" ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9.5)
      .text(field.value, cardX + 12, cardY + 21, {
        width: cardWidth - 24,
      });

    cursorY = Math.max(cursorY, cardY + 52);
  });

  return cursorY;
};

const drawPartyBlocks = (
  doc: PDFKit.PDFDocument,
  parties: DocumentPartyBlock[],
  x: number,
  y: number,
  width: number,
  columns: number,
) => {
  const gap = 12;
  const blockWidth = (width - gap * (columns - 1)) / columns;
  let cursorY = y;

  parties.forEach((party, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const blockX = x + column * (blockWidth + gap);
    const blockY = y + row * 98;

    doc
      .save()
      .roundedRect(blockX, blockY, blockWidth, 88, 14)
      .fill(COLORS.white)
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke()
      .restore();

    doc
      .fillColor(COLORS.bannerSoft)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(party.title, blockX + 12, blockY + 12, {
        width: blockWidth - 24,
      });

    doc
      .fillColor(COLORS.ink)
      .font("Helvetica")
      .fontSize(9)
      .text(party.lines.join("\n"), blockX + 12, blockY + 28, {
        width: blockWidth - 24,
        lineGap: 2,
      });

    cursorY = Math.max(cursorY, blockY + 98);
  });

  return cursorY;
};

const drawTable = (
  doc: PDFKit.PDFDocument,
  template: GeneratedDocumentTemplate,
  x: number,
  startY: number,
  width: number,
) => {
  const columns = template.table.columns;
  const columnRatios =
    template.variant === "compact"
      ? [0.46, 0.14, 0.18, 0.22]
      : columns.map((column) => column.widthRatio ?? 1);
  const totalRatio = columnRatios.reduce((sum, ratio) => sum + ratio, 0);
  const columnWidths = columns.map(
    (_, index) => ((columnRatios[index] ?? 1) / totalRatio) * width,
  );
  const denseTable = template.variant !== "compact" && columns.length >= 7;
  const headerFontSize = denseTable ? 7.2 : 8;
  const rowFontSize = denseTable ? 7.6 : 8.6;
  let cursorY = startY;

  const drawHeader = () => {
    doc.font("Helvetica-Bold").fontSize(headerFontSize);
    const headerHeight =
      Math.max(
        24,
        ...columns.map((column, index) =>
          doc.heightOfString(column.label, {
            width: Math.max((columnWidths[index] ?? 0) - 12, 24),
            align: column.align ?? "left",
          }),
        ),
      ) + 10;

    cursorY = ensurePageSpace(doc, cursorY, headerHeight + 10);

    doc
      .save()
      .roundedRect(x, cursorY, width, headerHeight, 10)
      .fill(COLORS.bannerSoft)
      .restore();

    let cursorX = x;
    columns.forEach((column, index) => {
      const columnWidth = columnWidths[index] ?? 0;
      doc
        .fillColor(COLORS.white)
        .font("Helvetica-Bold")
        .fontSize(headerFontSize)
        .text(column.label, cursorX + 6, cursorY + 6, {
          width: Math.max(columnWidth - 12, 24),
          align: column.align ?? "left",
        });
      cursorX += columnWidth;
    });

    cursorY += headerHeight + 6;
  };

  drawHeader();

  template.table.rows.forEach((row, rowIndex) => {
    doc.font("Helvetica").fontSize(rowFontSize);
    let cursorX = x;
    const rowHeight = Math.max(
      ...columns.map((column, index) =>
        doc.heightOfString(row[column.key] ?? "", {
          width: Math.max((columnWidths[index] ?? 0) - 12, 24),
          align: column.align ?? "left",
        }),
      ),
      12,
    ) + (denseTable ? 10 : 12);

    cursorY = ensurePageSpace(doc, cursorY, rowHeight + 8);

    if (cursorY === 118) {
      drawHeader();
    }

    doc
      .save()
      .roundedRect(x, cursorY, width, rowHeight, 10)
      .fill(rowIndex % 2 === 0 ? COLORS.panel : COLORS.white)
      .strokeColor(COLORS.border)
      .lineWidth(0.7)
      .stroke()
      .restore();

    columns.forEach((column, index) => {
      const columnWidth = columnWidths[index] ?? 0;
      doc
        .fillColor(COLORS.ink)
        .font("Helvetica")
        .fontSize(rowFontSize)
        .text(row[column.key] ?? "", cursorX + 6, cursorY + 6, {
          width: Math.max(columnWidth - 12, 24),
          align: column.align ?? "left",
        });

      cursorX += columnWidth;
    });

    cursorY += rowHeight + 6;
  });

  return cursorY;
};

const drawSummaryBox = (
  doc: PDFKit.PDFDocument,
  title: string,
  fields: DocumentField[],
  x: number,
  y: number,
  width: number,
) => {
  const estimatedHeight = Math.max(54, fields.length * 18 + 26);

  doc
    .save()
    .roundedRect(x, y, width, estimatedHeight, 14)
    .fill(COLORS.panel)
    .restore();

  doc
    .fillColor(COLORS.bannerSoft)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(title, x + 12, y + 10, { width: width - 24 });

  let cursorY = y + 26;

  fields.forEach((field) => {
    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8.3)
      .text(field.label, x + 12, cursorY, {
        width: width * 0.48,
      });

    doc
      .fillColor(COLORS.ink)
      .font(field.emphasis === "strong" ? "Helvetica-Bold" : "Helvetica")
      .fontSize(field.emphasis === "strong" ? 9.2 : 8.6)
      .text(field.value, x + width * 0.5, cursorY, {
        width: width * 0.46 - 12,
        align: "right",
      });

    cursorY += 17;
  });

  return estimatedHeight;
};

const drawNotes = (
  doc: PDFKit.PDFDocument,
  notes: string[],
  x: number,
  y: number,
  width: number,
) => {
  const content = notes.map((note) => `- ${note}`).join("\n");
  const contentHeight = doc.heightOfString(content, {
    width: width - 24,
    lineGap: 2,
  });
  const height = contentHeight + 30;

  doc
    .save()
    .roundedRect(x, y, width, height, 14)
    .fill(COLORS.white)
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .stroke()
    .restore();

  doc
    .fillColor(COLORS.bannerSoft)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("Notes", x + 12, y + 10, { width: width - 24 });

  doc
    .fillColor(COLORS.ink)
    .font("Helvetica")
    .fontSize(8.8)
    .text(content, x + 12, y + 26, {
      width: width - 24,
      lineGap: 2,
    });

  return height;
};

export const renderDocumentPdf = async (template: GeneratedDocumentTemplate) => {
  const shouldUseLandscape =
    template.variant !== "compact" && template.table.columns.length >= 7;
  const doc = new PDFDocument({
    size: "A4",
    layout: shouldUseLandscape ? "landscape" : "portrait",
    margin: shouldUseLandscape ? 28 : 36,
  });
  const bufferPromise = bufferFromPdf(doc);
  const usableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentWidth =
    template.variant === "compact" ? Math.min(usableWidth, 300) : usableWidth;
  const contentX = doc.page.margins.left + (usableWidth - contentWidth) / 2;
  let pageNumber = 1;
  let cursorY = 104;

  drawPageChrome(doc, template, pageNumber);

  doc.on("pageAdded", () => {
    pageNumber += 1;
    drawPageChrome(doc, template, pageNumber);
  });

  if (template.badges.length) {
    drawBadgeRow(doc, template.badges, contentX, cursorY);
    cursorY += 28;
  }

  doc
    .fillColor(COLORS.ink)
    .font("Helvetica")
    .fontSize(10)
    .text(template.subtitle, contentX, cursorY, {
      width: contentWidth,
    });
  cursorY += 28;

  cursorY = drawFieldCards(
    doc,
    template.metadata,
    contentX,
    cursorY,
    contentWidth,
    template.variant === "compact" ? 1 : 2,
  );

  if (template.parties.length) {
    cursorY += 4;
    cursorY = ensurePageSpace(doc, cursorY, 108);
    cursorY = drawPartyBlocks(
      doc,
      template.parties,
      contentX,
      cursorY,
      contentWidth,
      template.variant === "compact" ? 1 : Math.min(template.parties.length, 2),
    );
  }

  cursorY = ensurePageSpace(doc, cursorY, 100);
  cursorY = drawTable(doc, template, contentX, cursorY + 2, contentWidth);

  const summaryWidth =
    template.variant === "compact" ? contentWidth : Math.min(260, contentWidth);
  const summaryX =
    template.variant === "compact" ? contentX : contentX + contentWidth - summaryWidth;
  const paymentFields = template.paymentSummary ?? [];
  const totalsHeight = Math.max(60, template.totals.length * 18 + 26);
  const paymentHeight = paymentFields.length
    ? Math.max(60, paymentFields.length * 18 + 26)
    : 0;
  const combinedHeight =
    totalsHeight + (paymentHeight ? paymentHeight + 10 : 0) + 10;

  cursorY = ensurePageSpace(doc, cursorY, combinedHeight);

  const totalsBoxHeight = drawSummaryBox(
    doc,
    "Totals",
    template.totals,
    summaryX,
    cursorY,
    summaryWidth,
  );

  if (paymentFields.length) {
    drawSummaryBox(
      doc,
      "Payment",
      paymentFields,
      summaryX,
      cursorY + totalsBoxHeight + 10,
      summaryWidth,
    );
  }

  if (template.notes?.length) {
    cursorY = ensurePageSpace(doc, cursorY + combinedHeight, 120);
    cursorY += combinedHeight + 8;
    cursorY += drawNotes(doc, template.notes, contentX, cursorY, contentWidth);
  } else {
    cursorY += combinedHeight;
  }

  cursorY += 12;
  cursorY = ensurePageSpace(doc, cursorY, 60);

  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8.3)
    .text(template.footerLines.join("\n"), contentX, cursorY, {
      width: contentWidth,
      lineGap: 2,
    });

  doc.end();
  return bufferPromise;
};
