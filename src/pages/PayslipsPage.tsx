import { useState } from 'react';
import { employees, payrollRecords, payrollPeriods, departments, positions } from '../data/mockData';
import { FileText, Download, Printer, Search, Filter } from 'lucide-react';

export default function PayslipsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(payrollPeriods[0]?.id);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const period = payrollPeriods.find(p => p.id === selectedPeriod);
  const records = payrollRecords.filter(r => r.payrollPeriodId === selectedPeriod);
  
  const filteredRecords = records.filter(r => {
    const emp = employees.find(e => e.id === r.employeeId);
    return emp?.fullName.toLowerCase().includes(search.toLowerCase()) || 
           emp?.employeeCode.toLowerCase().includes(search.toLowerCase());
  });

  const getEmp = (id: string) => employees.find(e => e.id === id);
  const getDept = (id: string) => departments.find(d => d.id === id)?.name || '-';
  const getPos = (id: string) => positions.find(p => p.id === id)?.title || '-';
  const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const getBreakdown = (record: typeof records[0]) => {
    const basicSalary = record.grossPay * 0.7;
    const allowance = record.grossPay * 0.15;
    const overtime = record.grossPay * 0.1;
    const serviceCharge = record.grossPay * 0.05;
    const bpjs = record.totalDeductions * 0.6;
    const tax = record.totalDeductions * 0.4;
    return { basicSalary, allowance, overtime, serviceCharge, bpjs, tax };
  };

  const handlePrint = (record: typeof records[0]) => {
    const emp = getEmp(record.employeeId);
    const breakdown = getBreakdown(record);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${emp?.fullName} - ${period?.periodCode}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #4F46E5; }
          .header p { margin: 5px 0; color: #666; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
          .info-box h3 { margin: 0 0 10px 0; color: #333; font-size: 14px; }
          .info-box p { margin: 5px 0; font-size: 13px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          .table th { background-color: #f5f5f5; font-weight: bold; }
          .table .amount { text-align: right; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .net-pay { font-size: 18px; color: #10B981; font-weight: bold; }
          .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ATRIUM HOTEL</h1>
          <p>Payslip for ${period?.periodCode}</p>
          <p>Pay Date: ${period?.payDate}</p>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Employee Information</h3>
            <p><strong>Name:</strong> ${emp?.fullName}</p>
            <p><strong>Employee Code:</strong> ${emp?.employeeCode}</p>
            <p><strong>Department:</strong> ${emp ? getDept(emp.departmentId) : '-'}</p>
            <p><strong>Position:</strong> ${emp ? getPos(emp.positionId) : '-'}</p>
          </div>
          <div class="info-box">
            <h3>Payment Details</h3>
            <p><strong>Period:</strong> ${period?.startDate} to ${period?.endDate}</p>
            <p><strong>Pay Date:</strong> ${period?.payDate}</p>
            <p><strong>Bank:</strong> ${emp?.bankName || '-'}</p>
            <p><strong>Account:</strong> ${emp?.bankAccountNumber || '-'}</p>
          </div>
        </div>

        <h3>Earnings</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Component</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Basic Salary</td><td class="amount">${formatCurrency(breakdown.basicSalary)}</td></tr>
            <tr><td>Position Allowance</td><td class="amount">${formatCurrency(breakdown.allowance)}</td></tr>
            <tr><td>Overtime Pay</td><td class="amount">${formatCurrency(breakdown.overtime)}</td></tr>
            <tr><td>Service Charge</td><td class="amount">${formatCurrency(breakdown.serviceCharge)}</td></tr>
            <tr class="total-row"><td><strong>Total Gross</strong></td><td class="amount"><strong>${formatCurrency(record.grossPay)}</strong></td></tr>
          </tbody>
        </table>

        <h3>Deductions</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Component</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>BPJS Kesehatan & Ketenagakerjaan</td><td class="amount">${formatCurrency(breakdown.bpjs)}</td></tr>
            <tr><td>PPh 21 (Income Tax)</td><td class="amount">${formatCurrency(breakdown.tax)}</td></tr>
            <tr class="total-row"><td><strong>Total Deductions</strong></td><td class="amount"><strong>${formatCurrency(record.totalDeductions)}</strong></td></tr>
          </tbody>
        </table>

        <table class="table">
          <tr class="total-row">
            <td><strong>NET PAY</strong></td>
            <td class="amount net-pay">${formatCurrency(record.netPay)}</td>
          </tr>
        </table>

        <div class="footer">
          <p>This is a computer-generated payslip and does not require a signature.</p>
          <p>Generated on ${new Date().toLocaleDateString()} | ATRIUM HRIS</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const selectedRecord = selectedEmployee ? records.find(r => r.employeeId === selectedEmployee) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payslips</h1>
          <p className="text-slate-500 text-sm mt-1">View and print employee payslips</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {payrollPeriods.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedPeriod(p.id)}
            className={`flex-shrink-0 px-4 py-3 rounded-xl border text-sm transition-all ${
              selectedPeriod === p.id
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <p className="font-medium">{p.periodCode}</p>
            <p className="text-xs text-slate-500">{p.status}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Payslip List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecords.map(record => {
          const emp = getEmp(record.employeeId);
          return (
            <div key={record.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                    {emp?.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{emp?.fullName}</p>
                    <p className="text-xs text-slate-500">{emp?.employeeCode}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Gross Pay</span>
                  <span className="font-medium text-slate-700">{formatCurrency(record.grossPay)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Deductions</span>
                  <span className="font-medium text-red-600">-{formatCurrency(record.totalDeductions)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                  <span className="text-slate-700 font-medium">Net Pay</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(record.netPay)}</span>
                </div>
              </div>
              <button
                onClick={() => handlePrint(record)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Printer size={16} /> Print Payslip
              </button>
            </div>
          );
        })}
      </div>

      {filteredRecords.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <FileText size={40} className="mx-auto mb-3 text-slate-300" />
          <p>No payslips found for this period.</p>
        </div>
      )}
    </div>
  );
}
