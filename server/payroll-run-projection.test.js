import test from 'node:test';
import assert from 'node:assert/strict';
import { componentAmountsFromRunLine, projectRunLineToRecord, projectRunLineToClientRecord } from './payroll-run-projection.js';
import { buildPayslip } from '../src/lib/payslipView.ts';

const sampleLine = {
  employee_id: 'emp-1',
  employee_code: 'AMG-14',
  full_name: 'Apriadi Idris',
  pay_type: 'MONTHLY',
  gross_earnings: 3_000_000,
  total_deductions: 180_000,
  take_home_pay: 2_820_000,
  company_tax_cost: 0,
  detail: {
    basic: 1_800_000,
    fixed_allowance: 1_200_000,
    housing: 0,
    transport: 0,
    attendance_pay: 0,
    overtime: 0,
    bonus: 0,
    unpaid_deduction: 0,
    loan_installment: 0,
    late_deduction: 0,
    employee_pph: 50_000,
    pph21: 50_000,
    tax_mode: 'EMPLOYEE',
    ter_gross: 3_100_000,
    company_covers_employee_bpjs: false,
    bpjs: {
      health_employee: 18_000,
      jht_employee: 36_000,
      jp_employee: 18_000,
      health_employer: 72_000,
      jht_employer: 66_600,
      jp_employer: 36_000,
      jkk: 4_320,
      jkm: 5_400,
      employee_total: 72_000,
    },
  },
};

test('projection fills hotel component codes from engine detail', () => {
  const amounts = componentAmountsFromRunLine(sampleLine);
  assert.equal(amounts.basic, 1_800_000);
  assert.equal(amounts.fixed_allowance, 1_200_000);
  assert.equal(amounts.bpjsk_employee, 18_000);
  assert.equal(amounts.jht_employee, 36_000);
  assert.equal(amounts.pph21, 50_000);
  assert.equal(amounts.jkk, 4_320);
  assert.equal(amounts.tax_mode, 0);
  assert.ok(amounts.basic + amounts.fixed_allowance === 3_000_000);
});

test('projected client record is not basic-only on the payslip', () => {
  const record = projectRunLineToClientRecord(sampleLine, 'pp-1');
  const slip = buildPayslip(record, []);
  assert.ok(slip.earnings.length >= 2, 'expected basic + fixed allowance (or more)');
  assert.ok(slip.youPay.some((row) => row.code === 'pph21'));
  assert.ok(slip.youPay.some((row) => row.code === 'bpjsk_employee'));
  assert.equal(slip.takeHome, 2_820_000);
  assert.equal(slip.earnings.some((row) => row.code === 'jkk'), false);
});

test('DB projection row carries component_amounts JSON', () => {
  const row = projectRunLineToRecord(sampleLine, { periodId: 'pp-1', companyId: 'amg' });
  assert.equal(row.employee_id, 'emp-1');
  assert.equal(row.basic_salary, 1_800_000);
  assert.equal(row.component_amounts.fixed_allowance, 1_200_000);
  assert.equal(row.status, 'CALCULATED');
  assert.equal(row.basic_salary_from_profile, false);
});
