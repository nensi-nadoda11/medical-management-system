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
  pageNumber: number,
) => {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .save()
    .roundedRect(doc.page.margins.left, 28, pageWidth, 56, 16)
    .fill("#10293a")
    .restore();

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(title, doc.page.margins.left + 18, 42, {
      width: pageWidth - 36,
      align: "left",
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .text(shopName, doc.page.margins.left + 18, 64, {
      width: pageWidth - 36,
      align: "left",
    });

  doc
    .fillColor("#475569")
    .font("Helvetica")
    .fontSize(9)
    .text(subtitle, doc.page.margins.left, 98, {
      width: pageWidth,
      align: "left",
    });

  const footerY = doc.page.height - 34;
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
    .text(
      `Generated on ${new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date())}`,
      doc.page.margins.left,
      footerY,
      {
        width: pageWidth,
        align: "left",
      },
    );

  doc.text(`Page ${pageNumber}`, doc.page.margins.left, footerY, {
    width: pageWidth,
    align: "right",
  });
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
    const doc = new PDFDocument({
      size: "A4",
      margin: 44,
      bufferPages: true,
    });
    const chunks: Buffer[] = [];
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidths = input.columns.map((column) => column.width ?? 70);
    const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const scale = tableWidth > pageWidth ? pageWidth / tableWidth : 1;
    const normalizedWidths = columnWidths.map((width) => width * scale);
    let pageNumber = 1;

    const addTemplate = () =>
      drawPageFrame(doc, input.title, input.shopName, input.subtitle, pageNumber);

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    addTemplate();

    let cursorY = 124;

    input.summary.forEach((metric, index) => {
      const cardWidth = (pageWidth - 16) / 2;
      const cardHeight = 46;
      const x = doc.page.margins.left + (index % 2) * (cardWidth + 16);
      const y = cursorY + Math.floor(index / 2) * (cardHeight + 10);

      doc
        .save()
        .roundedRect(x, y, cardWidth, cardHeight, 12)
        .fill("#f8fafc")
        .restore();

      doc
        .fillColor("#64748b")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(metric.label, x + 12, y + 10, { width: cardWidth - 24 });

      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(metric.value, x + 12, y + 24, { width: cardWidth - 24 });
    });

    cursorY += Math.ceil(input.summary.length / 2) * 56 + 14;

    const drawTableHeader = () => {
      let cursorX = doc.page.margins.left;
      const headerHeight = 26;

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
          .fontSize(8)
          .text(column.header, cursorX + 6, cursorY + 8, {
            width: width - 12,
            align: column.align ?? "left",
          });
        cursorX += width;
      });

      cursorY += headerHeight + 6;
    };

    const getRowHeight = (row: Record<string, ExportCellValue>) => {
      let maxHeight = 0;

      input.columns.forEach((column, index) => {
        const width = normalizedWidths[index] ?? 0;

        doc.font("Helvetica").fontSize(8);
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

      if (cursorY + rowHeight > doc.page.height - 58) {
        doc.addPage();
        pageNumber += 1;
        addTemplate();
        cursorY = 124;
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
          .fontSize(8)
          .text(formatCellValue(row[column.key]), cursorX + 6, cursorY + 6, {
            width: width - 12,
            align: column.align ?? "left",
          });

        cursorX += width;
      });

      cursorY += rowHeight + 4;
    });

    doc.end();
  });
