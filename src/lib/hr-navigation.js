export const payrollConfigurationRoles = new Set(['HR_ADMIN', 'HR_STAFF', 'SUPER_ADMIN']);

export const payrollMenuChildren = [
  { id: 'payroll', label: 'Payroll processing' },
  { id: 'tax-simulation', label: 'Tax simulation' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'salary-structure', label: 'Salary structure' },
  { id: 'reports', label: 'Reports' },
  // Advanced: component/tariff builder kept off the main menu (Phase E decommission path).
  { id: 'payroll-configuration', label: 'Advanced components', roles: payrollConfigurationRoles, advanced: true },
];

export const configurationTabs = [
  { id: 'departments', label: 'Departments' },
  { id: 'positions', label: 'Positions' },
  { id: 'shifts', label: 'Shifts' },
  { id: 'leave-types', label: 'Leave Types' },
  { id: 'payroll-config', label: 'Payroll Config' },
  { id: 'office', label: 'Punch sites' },
];

export function visibleConfigurationTabs(role) {
  return configurationTabs.filter((tab) => !tab.roles || tab.roles.has(role));
}

export function payrollConfigurationVisible(role) {
  return payrollConfigurationRoles.has(role);
}
