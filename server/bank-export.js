/**
 * Bank transfer file adapters — Mandiri, BNI, BRI.
 * Layouts are documented CSV columns for v1 (bulk transfer import).
 */

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function bankExportSupported() {
  return ["mandiri", "bni", "bri"];
}

/**
 * @param {'mandiri'|'bni'|'bri'} bank
 * @param {Array<{account_number:string,account_name:string,amount:number,employee_code:string,remark?:string}>} payments
 */
export function buildBankTransferFile(bank, payments, options = {}) {
  const key = String(bank || "").toLowerCase();
  if (!bankExportSupported().includes(key)) {
    return { ok: false, error: "Bank must be Mandiri, BNI, or BRI." };
  }
  const list = (payments || []).filter((p) => Number(p.amount) > 0 && p.account_number);
  if (list.length === 0) return { ok: false, error: "No payable lines with bank accounts." };

  const remark = options.remark || "PAYROLL";
  if (key === "mandiri") {
    const headers = ["AccountNumber", "AccountName", "Amount", "Currency", "Remark", "EmployeeCode"];
    const rows = list.map((p) => ({
      AccountNumber: p.account_number,
      AccountName: p.account_name || "",
      Amount: Math.trunc(p.amount),
      Currency: "IDR",
      Remark: p.remark || remark,
      EmployeeCode: p.employee_code || "",
    }));
    return { ok: true, bank: key, filename: `mandiri-transfer-${options.period || "export"}.csv`, content: rowsToCsv(headers, rows) };
  }
  if (key === "bni") {
    const headers = ["NomorRekening", "Nama", "Jumlah", "Keterangan", "KodePegawai"];
    const rows = list.map((p) => ({
      NomorRekening: p.account_number,
      Nama: p.account_name || "",
      Jumlah: Math.trunc(p.amount),
      Keterangan: p.remark || remark,
      KodePegawai: p.employee_code || "",
    }));
    return { ok: true, bank: key, filename: `bni-transfer-${options.period || "export"}.csv`, content: rowsToCsv(headers, rows) };
  }
  const headers = ["REKENING", "NAMA", "NOMINAL", "BERITA", "NIK"];
  const rows = list.map((p) => ({
    REKENING: p.account_number,
    NAMA: p.account_name || "",
    NOMINAL: Math.trunc(p.amount),
    BERITA: p.remark || remark,
    NIK: p.employee_code || "",
  }));
  return { ok: true, bank: key, filename: `bri-transfer-${options.period || "export"}.csv`, content: rowsToCsv(headers, rows) };
}
