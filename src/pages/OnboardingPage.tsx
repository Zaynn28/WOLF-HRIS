import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Applicant } from '../types';
import { employeesApi, isApiAvailable } from '../services/api';
import { planOnboarding } from '../lib/hiring.js';

const DEFAULT_ACTIVITIES = [
  { id: 'ktp', label: 'KTP received' },
  { id: 'npwp', label: 'NPWP received' },
  { id: 'bank', label: 'Bank account confirmed' },
  { id: 'orientation', label: 'Orientation done' },
  { id: 'uniform', label: 'Uniform / name tag issued' },
  { id: 'slideshow', label: 'Onboarding slideshow completed' },
];

export default function OnboardingPage() {
  const {
    applicants, setApplicants, employees, setEmployees,
    onboardingMaterials, setOnboardingMaterials,
    onboardingActivities, setOnboardingActivities,
    addToast, addAuditLog,
  } = useApp();
  const [materialDraft, setMaterialDraft] = useState({ title: '', url: '' });
  const [activityDraft, setActivityDraft] = useState('');

  const activities = onboardingActivities.length > 0 ? onboardingActivities : DEFAULT_ACTIVITIES;
  const queue = applicants.filter(row => row.status === 'SIGNED' || row.status === 'ONBOARDED');

  const checkValue = (row: Applicant, activityId: string) => {
    if (row.activityChecks && activityId in row.activityChecks) return Boolean(row.activityChecks[activityId]);
    if (activityId in row.checks) return Boolean(row.checks[activityId as keyof Applicant['checks']]);
    return false;
  };

  const toggleActivity = (id: string, activityId: string) => {
    setApplicants(prev => prev.map(item => {
      if (item.id !== id) return item;
      const nextChecks = { ...item.checks };
      if (activityId in nextChecks) {
        nextChecks[activityId as keyof Applicant['checks']] = !nextChecks[activityId as keyof Applicant['checks']];
      }
      return {
        ...item,
        checks: nextChecks,
        activityChecks: {
          ...(item.activityChecks || {}),
          [activityId]: !checkValue(item, activityId),
        },
      };
    }));
  };

  const completeOnboarding = async (row: Applicant) => {
    const plan = planOnboarding({
      employeeId: row.employeeId,
      ready: activities.every(activity => checkValue(row, activity.id)),
    });
    if (plan.action !== 'activate' || !row.employeeId) {
      addToast(plan.action === 'refuse' ? plan.error : 'That employee is not signed.', 'error');
      return;
    }
    const embedded = typeof window !== 'undefined' && window.__WOLF_HR_EMBEDDED__ === true;
    if (embedded || isApiAvailable()) {
      try {
        await employeesApi.updateProfile(row.employeeId, { employment_status: 'ACTIVE' });
      } catch (error) {
        addToast(error instanceof Error ? error.message : 'The employee was not saved.', 'error');
        return;
      }
    }
    setEmployees(prev => prev.map(item => item.id === row.employeeId ? { ...item, employmentStatus: 'ACTIVE' } : item));
    setApplicants(prev => prev.map(item => item.id === row.id ? { ...item, status: 'ONBOARDED' } : item));
    addAuditLog('UPDATE', 'Employee', row.employeeId, `${row.fullName} onboarded and active`);
    addToast(`${row.fullName} is registered and active.`, 'success');
  };

  const addMaterial = () => {
    if (!materialDraft.title.trim() || !materialDraft.url.trim()) {
      addToast('Title and URL are required for slideshow materials.', 'error');
      return;
    }
    setOnboardingMaterials(prev => [...prev, { id: `mat${Date.now()}`, title: materialDraft.title.trim(), url: materialDraft.url.trim() }]);
    setMaterialDraft({ title: '', url: '' });
    addToast('Onboarding material added.', 'success');
  };

  const addActivity = () => {
    if (!activityDraft.trim()) return;
    const id = activityDraft.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 40);
    if (activities.some(row => row.id === id)) {
      addToast('That activity already exists.', 'error');
      return;
    }
    setOnboardingActivities([...activities, { id, label: activityDraft.trim() }]);
    setActivityDraft('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Onboarding</h1>
        <p className="text-slate-500 text-sm mt-1">Schedule date, complete activities and slideshow, then the employee becomes active automatically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-slate-800">Onboarding activities</h2>
          <ul className="space-y-1 text-sm text-slate-600">
            {activities.map(activity => <li key={activity.id}>• {activity.label}</li>)}
          </ul>
          <div className="flex gap-2">
            <input value={activityDraft} onChange={event => setActivityDraft(event.target.value)} placeholder="Add activity" className="flex-1 px-3 py-2 border rounded-lg text-sm" />
            <button onClick={addActivity} className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm">Add</button>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <h2 className="font-semibold text-slate-800">Slideshow materials</h2>
          {onboardingMaterials.length === 0 && <p className="text-sm text-slate-500">No materials yet.</p>}
          <ul className="space-y-2">
            {onboardingMaterials.map(material => (
              <li key={material.id} className="text-sm">
                <a href={material.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{material.title}</a>
              </li>
            ))}
          </ul>
          <input value={materialDraft.title} onChange={event => setMaterialDraft(prev => ({ ...prev, title: event.target.value }))} placeholder="Material title" className="w-full px-3 py-2 border rounded-lg text-sm" />
          <input value={materialDraft.url} onChange={event => setMaterialDraft(prev => ({ ...prev, url: event.target.value }))} placeholder="https://..." className="w-full px-3 py-2 border rounded-lg text-sm" />
          <button onClick={addMaterial} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">Add material</button>
        </div>
      </div>

      {queue.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          No signed candidates waiting for onboarding. Finish Hiring → offer accept → sign contract first.
        </div>
      )}

      <div className="space-y-3">
        {queue.map(row => {
          const employee = employees.find(person => person.id === row.employeeId);
          return (
            <div key={row.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{row.fullName}</p>
                  <p className="text-sm text-slate-500">{row.email} · status {employee?.employmentStatus || '—'}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{row.status}</span>
              </div>
              <label className="block text-xs text-slate-500 max-w-xs">
                Onboarding date
                <input
                  type="date"
                  value={row.onboardingDate || row.startDate || ''}
                  onChange={event => setApplicants(prev => prev.map(item => item.id === row.id ? { ...item, onboardingDate: event.target.value } : item))}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
                  disabled={row.status === 'ONBOARDED'}
                />
              </label>
              {row.status === 'SIGNED' && (
                <>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {activities.map(activity => (
                      <label key={activity.id} className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={checkValue(row, activity.id)} onChange={() => toggleActivity(row.id, activity.id)} />
                        {activity.label}
                      </label>
                    ))}
                  </div>
                  <button onClick={() => completeOnboarding(row)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm">Complete onboarding · activate</button>
                </>
              )}
              {row.status === 'ONBOARDED' && <p className="text-sm text-emerald-700">Onboarding complete. Employee status is ACTIVE.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
