import type { Attendance } from '../types';
import { EMP } from './mockPayrollConfigs';

const DEPT_SHIFTS: Record<string, string> = {
  [EMP.siti]: 's4',
  [EMP.budi]: 's1',
  [EMP.dewi]: 's2',
  [EMP.agus]: 's3',
  [EMP.rina]: 's1',
  [EMP.andi]: 's1',
  [EMP.maya]: 's4',
  [EMP.joko]: 's2',
};

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function eachDay(start: string, end: string, fn: (date: string, weekday: number) => void) {
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    fn(iso(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()), cursor.getDay());
    cursor.setDate(cursor.getDate() + 1);
  }
}

type Plan = {
  employeeId: string;
  /** Present/late days inside payroll cut-off 26 Oct–25 Nov */
  cutoffPresent: number;
  lateDates?: string[];
  unpaidDates?: string[];
  /** Present days in October calendar (SC) */
  octoberPresent: number;
};

/**
 * Attendance for payroll cut-off 26 Oct–25 Nov and SC October calendar.
 * October is seeded first and never overwritten so SC day counts stay stable.
 * Nov 1–25 is filled so cut-off present = Oct 26–31 (from Oct seed) + Nov days.
 */
export function buildDemoAttendance(): Attendance[] {
  const plans: Plan[] = [
    { employeeId: EMP.siti, cutoffPresent: 22, lateDates: ['2026-11-03'], octoberPresent: 22 },
    { employeeId: EMP.budi, cutoffPresent: 20, unpaidDates: ['2026-11-10', '2026-11-11'], octoberPresent: 20 },
    { employeeId: EMP.dewi, cutoffPresent: 21, octoberPresent: 21 },
    { employeeId: EMP.agus, cutoffPresent: 18, octoberPresent: 18 },
    { employeeId: EMP.rina, cutoffPresent: 22, octoberPresent: 22 },
    { employeeId: EMP.andi, cutoffPresent: 19, unpaidDates: ['2026-11-18'], octoberPresent: 19 },
    { employeeId: EMP.maya, cutoffPresent: 22, octoberPresent: 22 },
    { employeeId: EMP.joko, cutoffPresent: 12, octoberPresent: 12 },
  ];

  const byKey = new Map<string, Attendance>();
  let seq = 1;

  const put = (employeeId: string, date: string, status: Attendance['status'], extra?: Partial<Attendance>) => {
    const key = `${employeeId}|${date}`;
    if (byKey.has(key)) return; // never overwrite (protects October for SC)
    const shiftId = DEPT_SHIFTS[employeeId] || 's4';
    byKey.set(key, {
      id: `att-demo-${seq++}`,
      employeeId,
      attendanceDate: date,
      shiftId,
      status,
      clockIn: status === 'PRESENT' || status === 'LATE' ? (status === 'LATE' ? '08:25' : '08:00') : undefined,
      clockOut: status === 'PRESENT' || status === 'LATE' ? '17:00' : undefined,
      lateMinutes: status === 'LATE' ? 25 : 0,
      ...extra,
    });
  };

  const fillWindow = (
    employeeId: string,
    start: string,
    end: string,
    presentTarget: number,
    unpaidDates: string[],
    lateDates: string[],
    alreadyPresent: number,
  ) => {
    const unpaid = new Set(unpaidDates);
    const late = new Set(lateDates);
    const workdays: string[] = [];
    eachDay(start, end, (date, weekday) => {
      if (weekday === 0) return;
      workdays.push(date);
    });
    let present = alreadyPresent;
    for (const date of workdays) {
      if (unpaid.has(date)) {
        put(employeeId, date, 'ABSENT', { notes: 'Unpaid leave' });
        continue;
      }
      if (present >= presentTarget) {
        put(employeeId, date, 'REST_DAY');
        continue;
      }
      put(employeeId, date, late.has(date) ? 'LATE' : 'PRESENT');
      present += 1;
    }
  };

  for (const plan of plans) {
    // October calendar (SC) — exact target
    fillWindow(plan.employeeId, '2026-10-01', '2026-10-31', plan.octoberPresent, [], [], 0);

    // Count Oct 26–31 already present toward cut-off target
    let octTailPresent = 0;
    eachDay('2026-10-26', '2026-10-31', (date) => {
      const row = byKey.get(`${plan.employeeId}|${date}`);
      if (row && (row.status === 'PRESENT' || row.status === 'LATE')) octTailPresent += 1;
    });

    // Nov 1–25 only (do not rewrite October)
    fillWindow(
      plan.employeeId,
      '2026-11-01',
      '2026-11-25',
      plan.cutoffPresent,
      plan.unpaidDates || [],
      plan.lateDates || [],
      octTailPresent,
    );
  }

  const dewiOt = byKey.get(`${EMP.dewi}|2026-11-07`);
  if (dewiOt && (dewiOt.status === 'PRESENT' || dewiOt.status === 'LATE')) {
    dewiOt.overtimeMinutes = 240;
  }

  return [...byKey.values()].sort((a, b) =>
    a.attendanceDate.localeCompare(b.attendanceDate) || a.employeeId.localeCompare(b.employeeId),
  );
}
