import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, AlertTriangle, Clock } from 'lucide-react';

const COMPLIANCE_CALENDAR = [
  { month: 'January', items: [
    { title: 'Update UMK/UMSK', type: 'PAYROLL', desc: 'Regional minimum wage update effective January', due: 'Jan 1' },
    { title: 'Form 1721-A1', type: 'PAYROLL', desc: 'Annual income tax withholding slip for employees', due: 'Jan 31' },
    { title: 'PTKP/TER adjustment', type: 'PAYROLL', desc: 'Update PTKP and TER tables for new tax year', due: 'Jan 31' },
    { title: 'WLKP Report', type: 'COMPLIANCE', desc: 'Labor force report to Disnaker', due: 'Jan 31' },
  ]},
  { month: 'March', items: [
    { title: 'SPT Tahunan Karyawan', type: 'PAYROLL', desc: 'Annual employee income tax return', due: 'Mar 31' },
  ]},
  { month: 'Monthly', items: [] as { title: string; type: string; desc: string; due: string }[] },
  { month: 'Before Religious Holiday', items: [
    { title: 'THR Payment', type: 'PAYROLL', desc: 'Religious holiday allowance paid at least H-7 before holiday', due: 'H-7 before holiday' },
    { title: 'Peak Season Staffing', type: 'COMPLIANCE', desc: 'Prepare staffing for Lebaran, Nataru, school holidays', due: 'Before peak' },
  ]},
  { month: 'December', items: [
    { title: 'Annual PPh 21 Calculation', type: 'PAYROLL', desc: 'Year-end PPh 21 annual calculation (Pasal 17)', due: 'Dec 31' },
    { title: 'Cuti Bersama', type: 'COMPLIANCE', desc: 'Joint leave planning per SKB 3 Ministers', due: 'December' },
    { title: 'Year-End Close', type: 'PAYROLL', desc: 'Payroll year-end close and reconciliation', due: 'Dec 31' },
  ]},
];

const ordinal = (day: number) => {
  const mod = day % 10;
  if (mod === 1 && day !== 11) return `${day}st`;
  if (mod === 2 && day !== 12) return `${day}nd`;
  if (mod === 3 && day !== 13) return `${day}rd`;
  return `${day}th`;
};

export default function ComplianceCalendarPage() {
  const { employees: allEmployees, payPolicy } = useApp();
  const [selectedMonth, setSelectedMonth] = useState('Monthly');
  const calendar = COMPLIANCE_CALENDAR.map(month => month.month === 'Monthly' ? {
    ...month,
    items: [
      { title: 'Payroll Processing', type: 'PAYROLL', desc: 'Monthly payroll calculation and payment', due: `${ordinal(payPolicy.payDay)} of month` },
      { title: 'PPh 21 e-Bupot', type: 'PAYROLL', desc: 'Monthly PPh 21 withholding report via e-Bupot/Coretax', due: `${ordinal(payPolicy.pphDueDay)} of month` },
      { title: 'BPJS Contribution', type: 'COMPLIANCE', desc: 'BPJS Kesehatan & Ketenagakerjaan contribution via SIPP', due: `${ordinal(payPolicy.bpjsDueDay)} of month` },
    ],
  } : month);
  const monthData = calendar.find(m => m.month === selectedMonth) || calendar[2];
  const pad = (day: number) => String(day).padStart(2, '0');

  const alerts = [
    { id: 'a1', title: 'BPJS Contribution Due', type: 'COMPLIANCE', dueDate: `2026-01-${pad(payPolicy.bpjsDueDay)}`, description: 'January BPJS Kesehatan & Ketenagakerjaan contribution via SIPP-Online', status: 'PENDING' },
    { id: 'a2', title: 'PPh 21 e-Bupot Due', type: 'PAYROLL', dueDate: `2026-01-${pad(payPolicy.pphDueDay)}`, description: 'December 2025 PPh 21 withholding report', status: 'PENDING' },
    { id: 'a3', title: 'Contract Expiry: Ahmad Wijaya', type: 'COMPLIANCE', dueDate: '2026-02-28', description: 'PKWT contract expires in 45 days - prepare renewal or conversion', status: 'WARNING' },
    { id: 'a4', title: 'THR Preparation', type: 'PAYROLL', dueDate: '2026-02-14', description: 'Chinese New Year THR due H-7 (Feb 14)', status: 'UPCOMING' },
    { id: 'a5', title: 'Form 1721-A1 Preparation', type: 'PAYROLL', dueDate: '2026-01-15', description: 'Prepare annual tax slips for all employees', status: 'PENDING' },
  ];

  const statusColor = (status: string) => {
    switch(status) {
      case 'PENDING': return 'bg-amber-100 text-amber-700';
      case 'WARNING': return 'bg-orange-100 text-orange-700';
      case 'UPCOMING': return 'bg-blue-100 text-blue-700';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Compliance Calendar</h1>
          <p className="text-slate-500 text-sm mt-1">Statutory deadlines follow the pay policy: payroll on day {payPolicy.payDay}, PPh 21 on day {payPolicy.pphDueDay}, BPJS on day {payPolicy.bpjsDueDay}.</p>
        </div>
      </div>

      {/* Monthly selector */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {calendar.map(m => (
          <button
            key={m.month}
            onClick={() => setSelectedMonth(m.month)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg border text-sm transition-colors ${
              selectedMonth === m.month ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Calendar size={14} className="mr-2" /> {m.month}
          </button>
        ))}
      </div>

      {/* Selected month items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{selectedMonth} Compliance Items</h3>
          <p className="text-sm text-slate-500 mt-1">{monthData.items.length} scheduled compliance activities</p>
        </div>
        <div className="divide-y divide-slate-100">
          {monthData.items.map((item, i) => (
            <div key={i} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    item.type === 'PAYROLL' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                  }`}>
                    <Clock size={14} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{item.title}</p>
                    <p className="text-sm text-slate-600">{item.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800">{item.due}</p>
                  <span className="text-xs px-2 py-0.5 rounded text-slate-500">{item.type}</span>
                </div>
              </div>
              {i < monthData.items.length - 1 && <div className="border-t border-slate-100 my-3" /> }
            </div>
          ))}
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Active Compliance Alerts</h3>
          <div className="text-sm text-slate-500">{alerts.filter(a => a.status === 'PENDING' || a.status === 'WARNING').length} requiring attention</div>
        </div>
        <div className="divide-y divide-slate-100">
          {alerts.map(a => (
            <div key={a.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    a.status === 'WARNING' ? 'bg-orange-100 text-orange-600' :
                    a.status === 'PENDING' ? 'bg-amber-100 text-amber-600' :
                    a.status === 'UPCOMING' ? 'bg-blue-100 text-blue-600' :
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    <AlertTriangle size={14} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{a.title}</p>
                    <p className="text-sm text-slate-600">{a.description}</p>
                    <p className="text-xs text-slate-400 mt-1">Due: {new Date(a.dueDate).toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(a.status)}`}>{a.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Expiry Alerts */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Contract Expiry Monitor</p>
            <p className="text-sm text-amber-700 mt-1">
              {allEmployees.filter(e => e.employmentStatus !== 'TERMINATED').length} active employees tracked. 
              PKWT contracts expiring within 60 days will trigger automatic alerts 30-60 days before expiry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
