/** Local-demo payroll checklist fields (not persisted to API). */

export type MockPayType = 'MONTHLY' | 'DAILY';
export type MockTaxMode = 'EMPLOYEE' | 'COMPANY';
export type MockBpjsBase = 'BASIC' | 'BASIC_PLUS_FIXED';
export type MockContractKind = 'PKWTT' | 'PKWT' | 'DAILY_HIRE';

export type MockPayrollConfig = {
  pay_type: MockPayType;
  gross_fixed_salary: number | null;
  basic_percentage: number;
  daily_rate: number | null;
  working_days_per_month: number;
  housing_allowance: number;
  transport_allowance: number;
  attendance_allowance_per_day: number;
  bpjs_kesehatan_enabled: boolean;
  bpjs_tk_enabled: boolean;
  bpjs_base: MockBpjsBase;
  company_covers_employee_bpjs: boolean;
  tax_mode: MockTaxMode;
  npwp_enabled: boolean;
  contract_kind: MockContractKind;
  loan_installment: number;
};

export const EMP = {
  siti: 'a1111111-1111-4111-8111-111111111101',
  budi: 'a1111111-1111-4111-8111-111111111102',
  dewi: 'a1111111-1111-4111-8111-111111111103',
  agus: 'a1111111-1111-4111-8111-111111111104',
  rina: 'a1111111-1111-4111-8111-111111111105',
  andi: 'a1111111-1111-4111-8111-111111111106',
  maya: 'a1111111-1111-4111-8111-111111111107',
  joko: 'a1111111-1111-4111-8111-111111111108',
} as const;

export const mockPayrollConfigs: Record<string, MockPayrollConfig> = {
  [EMP.siti]: {
    pay_type: 'MONTHLY',
    gross_fixed_salary: 7_500_000,
    basic_percentage: 60,
    daily_rate: null,
    working_days_per_month: 22,
    housing_allowance: 0,
    transport_allowance: 500_000,
    attendance_allowance_per_day: 0,
    bpjs_kesehatan_enabled: true,
    bpjs_tk_enabled: true,
    bpjs_base: 'BASIC',
    company_covers_employee_bpjs: false,
    tax_mode: 'COMPANY',
    npwp_enabled: true,
    contract_kind: 'PKWTT',
    loan_installment: 0,
  },
  [EMP.budi]: {
    pay_type: 'MONTHLY',
    gross_fixed_salary: 5_500_000,
    basic_percentage: 60,
    daily_rate: null,
    working_days_per_month: 22,
    housing_allowance: 0,
    transport_allowance: 0,
    attendance_allowance_per_day: 25_000,
    bpjs_kesehatan_enabled: true,
    bpjs_tk_enabled: true,
    bpjs_base: 'BASIC',
    company_covers_employee_bpjs: false,
    tax_mode: 'EMPLOYEE',
    npwp_enabled: true,
    contract_kind: 'PKWTT',
    loan_installment: 0,
  },
  [EMP.dewi]: {
    pay_type: 'MONTHLY',
    gross_fixed_salary: 6_000_000,
    basic_percentage: 60,
    daily_rate: null,
    working_days_per_month: 22,
    housing_allowance: 1_000_000,
    transport_allowance: 300_000,
    attendance_allowance_per_day: 0,
    bpjs_kesehatan_enabled: true,
    bpjs_tk_enabled: true,
    bpjs_base: 'BASIC_PLUS_FIXED',
    company_covers_employee_bpjs: false,
    tax_mode: 'COMPANY',
    npwp_enabled: true,
    contract_kind: 'PKWT',
    loan_installment: 0,
  },
  [EMP.agus]: {
    pay_type: 'DAILY',
    gross_fixed_salary: null,
    basic_percentage: 60,
    daily_rate: 200_000,
    working_days_per_month: 22,
    housing_allowance: 0,
    transport_allowance: 0,
    attendance_allowance_per_day: 0,
    bpjs_kesehatan_enabled: false,
    bpjs_tk_enabled: true,
    bpjs_base: 'BASIC',
    company_covers_employee_bpjs: false,
    tax_mode: 'EMPLOYEE',
    npwp_enabled: false,
    contract_kind: 'PKWTT',
    loan_installment: 0,
  },
  [EMP.rina]: {
    pay_type: 'MONTHLY',
    gross_fixed_salary: 8_500_000,
    basic_percentage: 60,
    daily_rate: null,
    working_days_per_month: 22,
    housing_allowance: 0,
    transport_allowance: 750_000,
    attendance_allowance_per_day: 0,
    bpjs_kesehatan_enabled: true,
    bpjs_tk_enabled: true,
    bpjs_base: 'BASIC',
    company_covers_employee_bpjs: false,
    tax_mode: 'COMPANY',
    npwp_enabled: true,
    contract_kind: 'PKWTT',
    loan_installment: 0,
  },
  [EMP.andi]: {
    pay_type: 'MONTHLY',
    gross_fixed_salary: 6_500_000,
    basic_percentage: 60,
    daily_rate: null,
    working_days_per_month: 22,
    housing_allowance: 0,
    transport_allowance: 400_000,
    attendance_allowance_per_day: 0,
    bpjs_kesehatan_enabled: true,
    bpjs_tk_enabled: true,
    bpjs_base: 'BASIC',
    company_covers_employee_bpjs: false,
    tax_mode: 'EMPLOYEE',
    npwp_enabled: true,
    contract_kind: 'PKWTT',
    loan_installment: 500_000,
  },
  [EMP.maya]: {
    pay_type: 'MONTHLY',
    gross_fixed_salary: 9_000_000,
    basic_percentage: 60,
    daily_rate: null,
    working_days_per_month: 22,
    housing_allowance: 0,
    transport_allowance: 500_000,
    attendance_allowance_per_day: 0,
    bpjs_kesehatan_enabled: true,
    bpjs_tk_enabled: true,
    bpjs_base: 'BASIC',
    company_covers_employee_bpjs: false,
    tax_mode: 'COMPANY',
    npwp_enabled: true,
    contract_kind: 'PKWTT',
    loan_installment: 0,
  },
  [EMP.joko]: {
    pay_type: 'DAILY',
    gross_fixed_salary: null,
    basic_percentage: 60,
    daily_rate: 180_000,
    working_days_per_month: 22,
    housing_allowance: 0,
    transport_allowance: 0,
    attendance_allowance_per_day: 0,
    bpjs_kesehatan_enabled: false,
    bpjs_tk_enabled: true,
    bpjs_base: 'BASIC',
    company_covers_employee_bpjs: false,
    tax_mode: 'EMPLOYEE',
    npwp_enabled: false,
    contract_kind: 'DAILY_HIRE',
    loan_installment: 0,
  },
};

/** Demo JKK only — labeled for local calc, not statutory authority. */
export const DEMO_JKK_PERCENT = 0.24;
