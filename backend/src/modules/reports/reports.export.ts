import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

type ExportCellValue = string | number | null | undefined;

interface SummaryMetric {
  label: string;
  value: string;
}

interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "right" | "center";
}

interface BuildExportInput {
  shopName: string;
  title: string;
  subtitle: string;
  summary: SummaryMetric[];
  columns: TableColumn[];
  rows: Array<Record<string, ExportCellValue>>;
  pdfLayout?: "auto" | "portrait" | "landscape";
}

const formatCellValue = (value: ExportCellValue) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

const drawPageFrame = (
  doc: PDFKit.PDFDocument,
  title: string,
  shopName: string,
  subtitle: string,
) => {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const titleX = doc.page.margins.left + 20;

  doc
    .save()
    .roundedRect(doc.page.margins.left, 26, pageWidth, 64, 18)
    .fill("#10293a")
    .restore();

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(title, titleX, 40, { lineBreak: false });

  doc
    .font("Helvetica")
    .fontSize(10)
    .text(shopName, titleX, 64, { lineBreak: false });

  doc
    .fillColor("#475569")
    .font("Helvetica")
    .fontSize(9)
    .text(subtitle, doc.page.margins.left, 108, { lineBreak: false });
};

const drawPageFooter = (
  doc: PDFKit.PDFDocument,
  pageNumber: number,
  totalPages: number,
) => {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const footerY = doc.page.height - doc.page.margins.bottom - 12;
  const generatedAt = `Generated on ${new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date())}`;
  const pageLabel = `Page ${pageNumber} of ${totalPages}`;
  const pageLabelWidth = doc
    .font("Helvetica")
    .fontSize(8)
    .widthOfString(pageLabel);

  doc
    .moveTo(doc.page.margins.left, footerY - 8)
    .lineTo(doc.page.width - doc.page.margins.right, footerY - 8)
    .strokeColor("#d7dee6")
    .lineWidth(1)
    .stroke();

  doc
    .fillColor("#64748b")
    .font("Helvetica")
    .fontSize(8)
    .text(generatedAt, doc.page.margins.left, footerY, { lineBreak: false });

  doc.text(
    pageLabel,
    doc.page.width - doc.page.margins.right - pageLabelWidth,
    footerY,
    { lineBreak: false },
  );
};

export const buildExcelReport = async (input: BuildExportInput) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Codex";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(input.title.slice(0, 31));
  worksheet.columns = input.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? 20,
  }));

  worksheet.mergeCells(1, 1, 1, input.columns.length);
  worksheet.getCell(1, 1).value = input.title;
  worksheet.getCell(1, 1).font = {
    size: 16,
    bold: true,
    color: { argb: "10293A" },
  };

  worksheet.mergeCells(2, 1, 2, input.columns.length);
  worksheet.getCell(2, 1).value = `${input.shopName} - ${input.subtitle}`;
  worksheet.getCell(2, 1).font = { size: 10, color: { argb: "475569" } };

  let summaryRow = 4;
  input.summary.forEach((metric) => {
    worksheet.getCell(summaryRow, 1).value = metric.label;
    worksheet.getCell(summaryRow, 1).font = {
      bold: true,
      color: { argb: "334155" },
    };
    worksheet.getCell(summaryRow, 2).value = metric.value;
    worksheet.getCell(summaryRow, 2).font = { color: { argb: "0F172A" } };
    summaryRow += 1;
  });

  const headerRowIndex = summaryRow + 1;
  const headerRow = worksheet.getRow(headerRowIndex);
  input.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "10293A" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: column.align ?? "left",
      wrapText: true,
    };
  });

  input.rows.forEach((row) => {
    const addedRow = worksheet.addRow(
      Object.fromEntries(
        input.columns.map((column) => [column.key, formatCellValue(row[column.key])]),
      ),
    );

    addedRow.alignment = {
      vertical: "middle",
      wrapText: true,
    };

    input.columns.forEach((column, index) => {
      addedRow.getCell(index + 1).alignment = {
        vertical: "middle",
        horizontal: column.align ?? "left",
        wrapText: true,
      };
      addedRow.getCell(index + 1).border = {
        bottom: { style: "thin", color: { argb: "E2E8F0" } },
      };
    });
  });

  worksheet.views = [{ state: "frozen", ySplit: headerRowIndex }];
  return workbook.xlsx.writeBuffer();
};

export const buildPdfReport = async (input: BuildExportInput) =>
  new Promise<Buffer>((resolve, reject) => {
    const portraitMargin = 44;
    const landscapeMargin = 30;
    const portraitContentWidth = 595.28 - portraitMargin * 2;
    const defaultTableWidth = input.columns.reduce(
      (sum, column) => sum + (column.width ?? 70),
      0,
    );
    const shouldUseLandscape =
      input.pdfLayout === "landscape" ||
      (input.pdfLayout !== "portrait" &&
        (input.columns.length >= 7 ||
          defaultTableWidth > portraitContentWidth));
    const doc = new PDFDocument({
      size: "A4",
      layout: shouldUseLandscape ? "landscape" : "portrait",
      margin: shouldUseLandscape ? landscapeMargin : portraitMargin,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidths = input.columns.map((column) => column.width ?? 70);
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const scale = tableWidth > 0 ? pageWidth / tableWidth : 1;
    const normalizedWidths = columnWidths.map((width) => width * scale);
    const denseTable = shouldUseLandscape || input.columns.length >= 7;
    const headerFontSize = denseTable ? 7.2 : 8;
    const rowFontSize = denseTable ? 7.6 : 8;
    const contentTop = 136;
    const contentBottom = doc.page.height - doc.page.margins.bottom - 30;
    let cursorY = contentTop;

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const startNewPage = () => {
      drawPageFrame(doc, input.title, input.shopName, input.subtitle);
      cursorY = contentTop;
    };

    const ensureSpace = (height: number) => {
      if (cursorY + height <= contentBottom) {
        return;
      }

      doc.addPage();
      startNewPage();
    };

    startNewPage();

    if (input.summary.length) {
      const summaryColumns = pageWidth > 640 ? 3 : 2;
      const cardGap = 12;
      const cardWidth = (pageWidth - cardGap * (summaryColumns - 1)) / summaryColumns;
      const cardHeight = 54;
      const summaryRows = Math.ceil(input.summary.length / summaryColumns);
      const summaryHeight = summaryRows * cardHeight + Math.max(summaryRows - 1, 0) * cardGap;

      ensureSpace(summaryHeight + 14);

      input.summary.forEach((metric, index) => {
        const x =
          doc.page.margins.left + (index % summaryColumns) * (cardWidth + cardGap);
        const y =
          cursorY + Math.floor(index / summaryColumns) * (cardHeight + cardGap);

        doc
          .save()
          .roundedRect(x, y, cardWidth, cardHeight, 14)
          .fill("#f8fafc")
          .restore();

        doc
          .fillColor("#64748b")
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .text(metric.label, x + 12, y + 10, {
            width: cardWidth - 24,
            lineBreak: false,
          });

        doc
          .fillColor("#0f172a")
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(metric.value, x + 12, y + 28, {
            width: cardWidth - 24,
            lineBreak: false,
          });
      });

      cursorY += summaryHeight + 18;
    }

    const drawTableHeader = () => {
      let cursorX = doc.page.margins.left;
      doc.font("Helvetica-Bold").fontSize(headerFontSize);
      const headerHeight =
        Math.max(
          26,
          ...input.columns.map((column, index) =>
            doc.heightOfString(column.header, {
              width: Math.max((normalizedWidths[index] ?? 0) - 12, 24),
              align: column.align ?? "left",
            }),
          ),
        ) + 8;

      doc
        .save()
        .roundedRect(doc.page.margins.left, cursorY, pageWidth, headerHeight, 10)
        .fill("#10293a")
        .restore();

      input.columns.forEach((column, index) => {
        const width = normalizedWidths[index] ?? 0;
        doc
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .fontSize(headerFontSize)
          .text(column.header, cursorX + 6, cursorY + 6, {
            width: Math.max(width - 12, 24),
            align: column.align ?? "left",
            lineBreak: false,
          });
        cursorX += width;
      });

      cursorY += headerHeight + 6;
    };

    const getRowHeight = (row: Record<string, ExportCellValue>) => {
      let maxHeight = 0;

      input.columns.forEach((column, index) => {
        const width = normalizedWidths[index] ?? 0;

        doc.font("Helvetica").fontSize(rowFontSize);
        const height = doc.heightOfString(formatCellValue(row[column.key]), {
          width: Math.max(width - 12, 24),
          align: column.align ?? "left",
        });

        maxHeight = Math.max(maxHeight, height);
      });

      return Math.max(22, Math.ceil(maxHeight) + 10);
    };

    drawTableHeader();

    input.rows.forEach((row, rowIndex) => {
      const rowHeight = getRowHeight(row);

      if (cursorY + rowHeight > contentBottom) {
        doc.addPage();
        startNewPage();
        drawTableHeader();
      }

      let cursorX = doc.page.margins.left;

      doc
        .save()
        .roundedRect(doc.page.margins.left, cursorY, pageWidth, rowHeight, 8)
        .fill(rowIndex % 2 === 0 ? "#f8fafc" : "#ffffff")
        .restore();

      input.columns.forEach((column, index) => {
        const width = normalizedWidths[index] ?? 0;
        doc
          .fillColor("#0f172a")
          .font("Helvetica")
          .fontSize(rowFontSize)
          .text(formatCellValue(row[column.key]), cursorX + 6, cursorY + 6, {
            width: Math.max(width - 12, 24),
            align: column.align ?? "left",
            lineBreak: false,
          });

        cursorX += width;
      });

      cursorY += rowHeight + 4;
    });

    const bufferedRange = doc.bufferedPageRange();
    const totalPages = bufferedRange.count;

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      doc.switchToPage(bufferedRange.start + pageIndex);
      drawPageFooter(doc, pageIndex + 1, totalPages);
    }

    doc.end();
  });
