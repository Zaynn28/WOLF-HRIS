import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayslip, payrollCutoffLabel, payslipCompanyName } from '../src/lib/payslipView.ts';

test('payslip uses each company name', () => {
  assert.equal(payslipCompanyName('amg'), 'PT ATRIUM MANAGEMENT GROUP');
  assert.equal(payslipCompanyName('bzg'), 'PT BLU ZONE GROUP');
  assert.equal(payslipCompanyName('ggv'), 'GGV');
  assert.equal(payslipCompanyName(null), 'PT ATRIUM MANAGEMENT GROUP');
});

test('payroll cutoff matches the payslip date style', () => {
  assert.equal(payrollCutoffLabel('2026-08-28', '2026-09-27'), '28 Aug - 27 Sep 2026');
});

test('payslip shows earnings and you-pay only — company costs omitted', () => {
  const slip = buildPayslip({
    id: 'pr-lalu',
    employeeId: 'lalu',
    payrollPeriodId: '2026-09',
    basicSalary: 7500000,
    allowance: 0,
    overtime: 0,
    serviceCharge: 0,
    grossPay: 7725000,
    totalDeductions: 225000,
    netPay: 7500000,
    status: 'FINALIZED',
    componentAmounts: {
      basic: 7500000,
      full_basic: 7500000,
      jht_allowance: 150000,
      jp_allowance: 75000,
      jht_employee: 150000,
      jp_employee: 75000,
      jkk: 40500,
      jkm: 22500,
      jht_company: 277500,
      jp_company: 150000,
      bpjsk_company: 0,
      pph21_benefit: 113445,
      tax_mode: 1,
      ter_gross: 7800000,
    },
  }, [{ id: 'tax', payrollRecordId: 'pr-lalu', componentCode: 'PPh21', componentName: 'PPh 21', category: 'EARNING', amount: 113445 }]);

  assert.deepEqual(slip.earnings.map(row => [row.label, row.amount]), [
    ['Basic Salary', 7500000],
    ['JHT Employee Allowance', 150000],
    ['JP Employee Allowance', 75000],
  ]);
  assert.deepEqual(slip.youPay.map(row => [row.label, row.amount]), [
    ['Jaminan Pensiun Employee', 75000],
    ['JHT Employee', 150000],
  ]);
  assert.equal(slip.totalEarnings, 7725000);
  assert.equal(slip.totalYouPay, 225000);
  assert.equal(slip.takeHome, 7500000);
  assert.equal(slip.taxMode, 'netto');
  assert.match(slip.taxModeLabel, /Netto/i);
  assert.equal(slip.youPay.some(row => row.code === 'pph21'), false);
  assert.equal(slip.earnings.some(row => row.code === 'jkk' || row.code === 'pph21_benefit'), false);
});

test('withheld PPh 21 stays in you-pay; unpaid folds into kasbon', () => {
  const slip = buildPayslip({
    id: 'pr-tax',
    employeeId: 'person',
    payrollPeriodId: '2026-09',
    basicSalary: 1000000,
    allowance: 0,
    overtime: 0,
    serviceCharge: 0,
    grossPay: 1000000,
    totalDeductions: 350000,
    netPay: 650000,
    status: 'FINALIZED',
    componentAmounts: {
      basic: 1000000,
      pph21: 50000,
      kasbon: 100000,
      unpaid: 200000,
      tax_mode: 0,
      jkk: 2400,
      bpjsk_company: 40000,
    },
  }, [{ id: 'tax', payrollRecordId: 'pr-tax', componentCode: 'PPh21', componentName: 'PPh 21', category: 'DEDUCTION', amount: 50000 }]);

  assert.deepEqual(slip.youPay.map(row => [row.code, row.amount]), [
    ['kasbon', 300000],
    ['pph21', 50000],
  ]);
  assert.equal(slip.taxMode, 'gross');
  assert.equal(slip.youPay.some(row => row.code === 'unpaid'), false);
  assert.equal(slip.earnings.some(row => row.code === 'jkk'), false);
});
