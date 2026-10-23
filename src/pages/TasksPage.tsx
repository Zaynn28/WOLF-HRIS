import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { StaffTask } from '../types';

type ProgressStatus = 'On track' | 'Stuck' | 'No tasks';

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isStuckTask(task: StaffTask, today: string): boolean {
  return (task.status === 'OPEN' || task.status === 'IN_PROGRESS') && task.dueDate < today;
}

const TASK_STATUS_LABEL: Record<StaffTask['status'], string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

const STATUS_STYLE: Record<ProgressStatus, string> = {
  'On track': 'bg-emerald-50 text-emerald-800',
  Stuck: 'bg-red-50 text-red-800',
  'No tasks': 'bg-slate-100 text-slate-600',
};

export default function TasksPage() {
  const { tasks, setTasks, employees, departments, addToast } = useApp();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', detail: '', dueDate: '' });
  const today = localToday();

  const active = useMemo(
    () => employees
      .filter(person => person.employmentStatus === 'ACTIVE' || person.employmentStatus === 'PROBATION')
      .slice()
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees],
  );

  const rows = useMemo(() => active.map(person => {
    const mine = tasks.filter(task => task.assigneeId === person.id);
    const done = mine.filter(task => task.status === 'DONE').length;
    const stuck = mine.filter(task => isStuckTask(task, today)).length;
    const status: ProgressStatus = mine.length === 0 ? 'No tasks' : stuck > 0 ? 'Stuck' : 'On track';
    const department = departments.find(row => row.id === person.departmentId)?.name || 'No department';
    return { person, mine, done, stuck, status, department };
  }), [active, tasks, today, departments]);

  const selected = rows.find(row => row.person.id === selectedId) || null;

  const openPerson = (id: string) => {
    setSelectedId(id);
    setForm({ title: '', detail: '', dueDate: '' });
  };

  const assign = () => {
    if (!selected) return;
    if (!form.title.trim() || !form.dueDate) {
      addToast('Title and due date are required.', 'error');
      return;
    }
    setTasks(prev => [{
      id: `task${Date.now()}`,
      title: form.title.trim(),
      detail: form.detail.trim(),
      assigneeId: selected.person.id,
      assignerName: user?.fullName || 'Manager',
      dueDate: form.dueDate,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    }, ...prev]);
    addToast('Task assigned.', 'success');
    setForm({ title: '', detail: '', dueDate: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Staff tasks</h1>
        <p className="text-slate-500 text-sm mt-1">
          Click a person to see their tasks. A task still open or in progress with a due date before today is stuck.
        </p>
      </div>

      {active.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600">No active or probation staff are registered.</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-2">
            {rows.map(row => (
              <button
                key={row.person.id}
                type="button"
                data-employee-id={row.person.id}
                onClick={() => openPerson(row.person.id)}
                className={`w-full text-left bg-white rounded-xl border p-4 transition-colors ${
                  selectedId === row.person.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{row.person.fullName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{row.department}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[row.status]}`}>
                    {row.status}{row.status === 'Stuck' ? ` · ${row.stuck} stuck` : ''}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-3">
                  {row.done} / {row.mine.length} done
                  {row.mine.length > 0 && row.status !== 'Stuck' ? ` · ${row.stuck} stuck` : ''}
                </p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {!selected && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-600">Select a staff member to see their tasks and assign more work.</p>
              </div>
            )}

            {selected && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">{selected.person.fullName}</h2>
                    <p className="text-sm text-slate-500">{selected.department}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[selected.status]}`}>
                    {selected.status}{selected.stuck > 0 ? ` · ${selected.stuck} stuck` : ''}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{selected.done} / {selected.mine.length} done · {selected.stuck} stuck</p>

                <ul className="space-y-3">
                  {selected.mine.length === 0 && <li className="text-sm text-slate-500">No tasks assigned yet.</li>}
                  {selected.mine.map(task => {
                    const overdue = isStuckTask(task, today);
                    return (
                      <li key={task.id} className={`rounded-lg border p-3 ${overdue ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium text-slate-800">{task.title}</p>
                          <span className={`shrink-0 text-xs font-medium ${overdue ? 'text-red-700' : 'text-slate-500'}`}>
                            {TASK_STATUS_LABEL[task.status]}{overdue ? ' · stuck' : ''}
                          </span>
                        </div>
                        {task.detail && <p className="text-sm text-slate-600 mt-1">{task.detail}</p>}
                        <p className="text-xs text-slate-500 mt-2">Due {task.dueDate} · assigned by {task.assignerName}</p>
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Assign a task to {selected.person.fullName}</h3>
                  <input
                    value={form.title}
                    onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                    placeholder="Task title"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    value={form.detail}
                    onChange={event => setForm(prev => ({ ...prev, detail: event.target.value }))}
                    placeholder="What needs to be done"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={event => setForm(prev => ({ ...prev, dueDate: event.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <button type="button" onClick={assign} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
                    Assign task
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
