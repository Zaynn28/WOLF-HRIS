import { overlapDays } from './payrollEngine';
import type { Attendance, LeaveRequest, LeaveType, OvertimeRequest, PayrollPeriod, PayrollRecord, ServiceChargeDistribution } from '../types';

export function defaultWorkingPeriodId(periods: PayrollPeriod[]): string {
  return periods.find(period => period.status !== 'FINALIZED' && period.status !== 'LOCKED')?.id
    || periods[periods.length - 1]?.id
    || '';
}

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function cycleForMonth(year: number, month: number, cutoffDay: number, payDay: number) {
  const cutoff = Math.min(28, Math.max(1, cutoffDay || 25));
  const pay = Math.min(28, Math.max(1, payDay || 5));
  const end = new Date(year, month - 1, cutoff);
  const start = new Date(year, month - 2, cutoff + 1);
  const payDate = new Date(year, month, pay);
  return {
    periodCode: `${year}-${String(month).padStart(2, '0')}`,
    startDate: isoDate(start),
    endDate: isoDate(end),
    payDate: isoDate(payDate),
  };
}

export function periodScope(
  period: PayrollPeriod,
  attendance: Attendance[],
  overtime: OvertimeRequest[],
  leave: LeaveRequest[],
  leaveTypes: LeaveType[],
  distributions: ServiceChargeDistribution[],
  records: PayrollRecord[],
) {
  const inPeriod = (date: string) => date >= period.startDate && date <= period.endDate;
  const approvedLeave = leave.filter(request => request.status === 'APPROVED' && overlapDays(request.startDate, request.endDate, period.startDate, period.endDate) > 0);
  const unpaidDays = approvedLeave.reduce((sum, request) => {
    const leaveType = leaveTypes.find(type => type.id === request.leaveTypeId);
    if (!leaveType || leaveType.isPaid) return sum;
    return sum + overlapDays(request.startDate, request.endDate, period.startDate, period.endDate);
  }, 0);
  const savedShares = distributions.filter(row => row.periodId === period.id && row.status === 'DISTRIBUTED');
  return {
    attendanceCount: attendance.filter(row => inPeriod(row.attendanceDate)).length,
    approvedOt: overtime.filter(request => request.status === 'APPROVED' && inPeriod(request.date)).length,
    pendingOt: overtime.filter(request => request.status === 'PENDING' && inPeriod(request.date)).length,
    approvedLeave: approvedLeave.length,
    unpaidDays,
    distributedEmployees: savedShares.length,
    records: records.filter(record => record.payrollPeriodId === period.id).length,
  };
}
