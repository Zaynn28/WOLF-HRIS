import * as XLSX from 'xlsx';

export type PayrollExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface PayrollExportLine {
  employeeCode: string;
  employeeName: string;
  department: string;
  basicSalary: number;
  allowance: number;
  overtime: number;
  serviceCharge: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayrollExportMeta {
  periodCode: string;
  status: string;
  startDate: string;
  endDate: string;
  payDate: string;
}

const HEADERS = ['Employee code', 'Employee', 'Department', 'Basic', 'Allowance', 'Overtime', 'Service charge', 'Gross', 'Deductions', 'Net pay'];

const money = (amount: number) => `Rp ${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

function sheetRows(meta: PayrollExportMeta, lines: PayrollExportLine[]) {
  const totals = lines.reduce((sum, line) => ({
    basicSalary: sum.basicSalary + line.basicSalary,
    allowance: sum.allowance + line.allowance,
    overtime: sum.overtime + line.overtime,
    serviceCharge: sum.serviceCharge + line.serviceCharge,
    grossPay: sum.grossPay + line.grossPay,
    totalDeductions: sum.totalDeductions + line.totalDeductions,
    netPay: sum.netPay + line.netPay,
  }), { basicSalary: 0, allowance: 0, overtime: 0, serviceCharge: 0, grossPay: 0, totalDeductions: 0, netPay: 0 });

  const body = lines.map(line => [
    line.employeeCode,
    line.employeeName,
    line.department,
    line.basicSalary,
    line.allowance,
    line.overtime,
    line.serviceCharge,
    line.grossPay,
    line.totalDeductions,
    line.netPay,
  ]);
  body.push(['', 'Total', '', totals.basicSalary, totals.allowance, totals.overtime, totals.serviceCharge, totals.grossPay, totals.totalDeductions, totals.netPay]);
  return [
    ['Period', meta.periodCode],
    ['Status', meta.status],
    ['Dates', `${meta.startDate} to ${meta.endDate}`],
    ['Pay date', meta.payDate],
    [],
    HEADERS,
    ...body,
  ];
}

function workbook(meta: PayrollExportMeta, lines: PayrollExportLine[]) {
  const sheet = XLSX.utils.aoa_to_sheet(sheetRows(meta, lines));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Payroll');
  return book;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function fit(value: string, width: number, size: number) {
  const max = Math.max(1, Math.floor(width / (size * 0.5)));
  return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 3))}...`;
}

function buildPdf(meta: PayrollExportMeta, lines: PayrollExportLine[]) {
  const pageWidth = 842;
  const pageHeight = 595;
  const columns = [
    { title: 'Code', width: 52, align: 'left' as const },
    { title: 'Employee', width: 130, align: 'left' as const },
    { title: 'Department', width: 100, align: 'left' as const },
    { title: 'Basic', width: 78, align: 'right' as const },
    { title: 'Allowance', width: 78, align: 'right' as const },
    { title: 'Overtime', width: 72, align: 'right' as const },
    { title: 'Service', width: 72, align: 'right' as const },
    { title: 'Gross', width: 78, align: 'right' as const },
    { title: 'Deductions', width: 78, align: 'right' as const },
    { title: 'Net pay', width: 78, align: 'right' as const },
  ];
  const totals = lines.reduce((sum, line) => ({
    basicSalary: sum.basicSalary + line.basicSalary,
    allowance: sum.allowance + line.allowance,
    overtime: sum.overtime + line.overtime,
    serviceCharge: sum.serviceCharge + line.serviceCharge,
    grossPay: sum.grossPay + line.grossPay,
    totalDeductions: sum.totalDeductions + line.totalDeductions,
    netPay: sum.netPay + line.netPay,
  }), { basicSalary: 0, allowance: 0, overtime: 0, serviceCharge: 0, grossPay: 0, totalDeductions: 0, netPay: 0 });
  const rows = [
    ...lines.map(line => [
      line.employeeCode,
      line.employeeName,
      line.department,
      money(line.basicSalary),
      money(line.allowance),
      money(line.overtime),
      money(line.serviceCharge),
      money(line.grossPay),
      money(line.totalDeductions),
      money(line.netPay),
    ]),
    ['', 'Total', '', money(totals.basicSalary), money(totals.allowance), money(totals.overtime), money(totals.serviceCharge), money(totals.grossPay), money(totals.totalDeductions), money(totals.netPay)],
  ];
  const pageSize = 16;
  const pages: string[][][] = [];
  for (let index = 0; index < Math.max(rows.length, 1); index += pageSize) pages.push(rows.slice(index, index + pageSize));
  if (pages.length === 0) pages.push([]);

  const streams = pages.map((pageRows, pageIndex) => {
    const commands = [
      'BT /F1 14 Tf 36 560 Tm (Payroll export) Tj ET',
      `BT /F1 10 Tf 36 544 Tm (${pdfEscape(`${meta.periodCode} · ${meta.status} · ${meta.startDate} to ${meta.endDate} · pay ${meta.payDate}`)}) Tj ET`,
      `BT /F1 9 Tf 700 560 Tm (${pdfEscape(`Page ${pageIndex + 1} of ${pages.length}`)}) Tj ET`,
    ];
    let x = 36;
    columns.forEach(column => {
      commands.push(`BT /F1 8 Tf ${column.align === 'right' ? x + column.width - 8 : x} 520 Tm (${pdfEscape(column.title)}) Tj ET`);
      x += column.width;
    });
    pageRows.forEach((row, rowIndex) => {
      const y = 500 - rowIndex * 22;
      let cellX = 36;
      row.forEach((cell, cellIndex) => {
        const column = columns[cellIndex];
        const text = fit(String(cell), column.width - 8, 8);
        const drawX = column.align === 'right' ? cellX + column.width - 8 - text.length * 4 : cellX;
        commands.push(`BT /F1 8 Tf ${drawX} ${y} Tm (${pdfEscape(text)}) Tj ET`);
        cellX += column.width;
      });
    });
    return commands.join('\n');
  });

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
  objects.push('');
  objects.push('3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
  streams.forEach((stream, index) => {
    const contentId = 4 + index * 2;
    const pageId = contentId + 1;
    pageObjectIds.push(pageId);
    objects.push(`${contentId} 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`);
    objects.push(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >> endobj`);
  });
  objects[1] = `2 0 obj << /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] >> endobj`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach(object => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadPayrollExport(format: PayrollExportFormat, meta: PayrollExportMeta, lines: PayrollExportLine[]) {
  const base = `payroll_${meta.periodCode}_${meta.status.toLowerCase()}`;
  if (format === 'pdf') {
    saveBlob(buildPdf(meta, lines), `${base}.pdf`);
    return `${base}.pdf`;
  }
  const book = workbook(meta, lines);
  const bookType = format === 'csv' ? 'csv' : 'xlsx';
  const raw = XLSX.write(book, { bookType, type: 'array' }) as ArrayLike<number>;
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw[index];
  const type = format === 'csv'
    ? 'text/csv;charset=utf-8'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  saveBlob(new Blob([buffer], { type }), `${base}.${bookType}`);
  return `${base}.${bookType}`;
}
