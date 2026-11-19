import { useEffect, useRef, useState } from 'react';
import { Employee, Department, Position } from '../types';
import { changeRequestPhotoUrl, employeePhotoUrl, employeesApi, mapEmployeeRow, profileRequestsApi } from '../services/api';

type Draft = {
  fullName: string;
  preferredName: string;
  phone: string;
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  departmentId: string;
  positionId: string;
  employmentStatus: string;
};

const statuses = ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'];

function draftFrom(employee: Employee): Draft {
  return {
    fullName: employee.fullName || '',
    preferredName: employee.preferredName || '',
    phone: employee.phone || '',
    email: employee.email || '',
    address: employee.address || '',
    emergencyContactName: employee.emergencyContactName || '',
    emergencyContactPhone: employee.emergencyContactPhone || '',
    departmentId: employee.departmentId || '',
    positionId: employee.positionId || '',
    employmentStatus: employee.employmentStatus || 'ACTIVE',
  };
}

function changedBody(employee: Employee, draft: Draft, photo: string) {
  const body: Record<string, string> = {};
  const pairs: [string, string, string][] = [
    ['full_name', employee.fullName || '', draft.fullName],
    ['preferred_name', employee.preferredName || '', draft.preferredName],
    ['phone', employee.phone || '', draft.phone],
    ['email', employee.email || '', draft.email],
    ['address', employee.address || '', draft.address],
    ['emergency_contact_name', employee.emergencyContactName || '', draft.emergencyContactName],
    ['emergency_contact_phone', employee.emergencyContactPhone || '', draft.emergencyContactPhone],
    ['department_id', employee.departmentId || '', draft.departmentId],
    ['position_id', employee.positionId || '', draft.positionId],
    ['employment_status', employee.employmentStatus || '', draft.employmentStatus],
  ];
  pairs.forEach(([key, current, next]) => {
    if (current !== next) body[key] = next;
  });
  if (photo) body.photo = photo;
  return body;
}

function salaryDigits(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  return '';
}

function formatIdr(digits: string): string {
  if (digits === '') return '';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(digits));
}

function digitsFromDisplay(raw: string): string | null {
  if (raw.trim() === '') return '';
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digits.length > 12) return null;
  return digits;
}

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const named = /\.(jpe?g|png|webp)$/i.test(file.name);
    const typed = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
    if (!named && !typed) {
      reject(new Error('Use a JPEG, PNG, or WebP image.'));
      return;
    }
    if (file.size > 256 * 1024) {
      reject(new Error('Use an image under 256 KB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(file);
  });
}

export function ProfilePhoto({ employee, className }: { employee: Employee; className: string }) {
  if (!employee.hasProfilePhoto) {
    const initials = employee.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2);
    return <div className={`${className} bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold`}>{initials}</div>;
  }
  return <img src={`${employeePhotoUrl(employee.id)}?v=${encodeURIComponent(employee.updatedAt || '1')}`} alt="" className={`${className} object-cover`} />;
}

export function ProfileEditor({
  mode,
  employee,
  departments,
  positions,
  onSaved,
  notify,
}: {
  mode: 'edit' | 'request';
  employee: Employee;
  departments: Department[];
  positions: Position[];
  onSaved: (employee: Employee) => void;
  notify: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(employee));
  const [photo, setPhoto] = useState('');
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [gajiDigits, setGajiDigits] = useState('');
  const [storedGaji, setStoredGaji] = useState('');
  const [gajiKnown, setGajiKnown] = useState(mode !== 'edit');
  const gajiInput = useRef<HTMLInputElement>(null);
  const salaryTouched = useRef(false);
  const saveLock = useRef(false);
  const lastEmptyNotice = useRef(0);
  const set = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (mode !== 'edit') return;
    let cancelled = false;
    salaryTouched.current = false;
    employeesApi.getById(employee.id)
      .then((row) => {
        if (cancelled) return;
        const digits = salaryDigits(row?.gaji_pokok);
        setStoredGaji(digits);
        setGajiDigits((current) => (salaryTouched.current ? current : digits));
        setGajiKnown(true);
      })
      .catch(() => { if (!cancelled) setGajiKnown(false); });
    return () => { cancelled = true; };
  }, [employee.id, mode]);

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await readPhoto(file);
      setPhoto(data);
      setPreview(data);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Use a JPEG, PNG, or WebP image.', 'error');
    }
  };

  const save = async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    const shown = gajiInput.current ? digitsFromDisplay(gajiInput.current.value) : gajiDigits;
    if (shown === null) {
      saveLock.current = false;
      notify('Enter gaji pokok as a whole rupiah amount.', 'error');
      return;
    }
    const formSalary = shown;
    const body = changedBody(employee, draft, photo);
    if (mode === 'edit' && gajiKnown && formSalary !== storedGaji) body.gaji_pokok = formSalary;
    if (Object.keys(body).length === 0 && mode === 'edit' && gajiKnown) {
      try {
        const row = await employeesApi.getById(employee.id);
        Object.assign(body, changedBody(mapEmployeeRow(row), draft, ''));
        const serverSalary = salaryDigits(row?.gaji_pokok);
        if (formSalary !== serverSalary) body.gaji_pokok = formSalary;
        else setStoredGaji(serverSalary);
      } catch {
        // The form already matched the copy loaded with this profile.
      }
    }
    if (Object.keys(body).length === 0) {
      saveLock.current = false;
      const now = Date.now();
      if (now - lastEmptyNotice.current > 4000) {
        lastEmptyNotice.current = now;
        notify(mode === 'edit' ? 'Nothing to save.' : 'Nothing to submit.', 'info');
      }
      return;
    }
    setSaving(true);
    try {
      if (mode === 'edit') {
        const saved = await employeesApi.updateProfile(employee.id, body);
        onSaved({
          ...employee,
          fullName: saved.full_name ?? employee.fullName,
          preferredName: saved.preferred_name || undefined,
          phone: saved.phone || '',
          email: saved.email || '',
          address: saved.address || '',
          emergencyContactName: saved.emergency_contact_name || '',
          emergencyContactPhone: saved.emergency_contact_phone || '',
          departmentId: saved.department_id || '',
          positionId: saved.position_id || '',
          employmentStatus: saved.employment_status || employee.employmentStatus,
          hasProfilePhoto: saved.has_profile_photo === true,
          updatedAt: typeof saved.updated_at === 'string' ? saved.updated_at : new Date().toISOString(),
        });
        if (Object.prototype.hasOwnProperty.call(saved, 'gaji_pokok')) {
          const digits = salaryDigits(saved.gaji_pokok);
          salaryTouched.current = false;
          setGajiDigits(digits);
          setStoredGaji(digits);
        }
        setPhoto('');
        notify('Profile saved.', 'success');
      } else {
        await profileRequestsApi.create(body);
        setPhoto('');
        notify('Change request submitted. The live record is unchanged until HR approves it.', 'success');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The profile could not be saved.', 'error');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const fieldClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">{mode === 'edit' ? 'Edit profile' : 'Request a profile change'}</h3>
        <p className="text-sm text-slate-500 mt-1">
          {mode === 'edit'
            ? 'Saving updates the live record for this company.'
            : 'HR reviews this request before the live record changes.'}
        </p>
      </div>
      <div className="flex items-center gap-4">
        {preview ? <img src={preview} alt="" className="w-16 h-16 rounded-full object-cover" /> : <ProfilePhoto employee={employee} className="w-16 h-16 rounded-full text-sm" />}
        <label className="text-sm text-indigo-600 cursor-pointer">
          {mode === 'edit' ? 'Attach or replace photo' : 'Attach a photo to this request'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => choosePhoto(event.target.files?.[0])} />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-slate-700">Name
          <input className={fieldClass} value={draft.fullName} onChange={(event) => set('fullName', event.target.value)} />
        </label>
        <label className="text-sm text-slate-700">Preferred name
          <input className={fieldClass} value={draft.preferredName} onChange={(event) => set('preferredName', event.target.value)} />
        </label>
        <label className="text-sm text-slate-700">Email
          <input className={fieldClass} value={draft.email} onChange={(event) => set('email', event.target.value)} />
        </label>
        <label className="text-sm text-slate-700">Phone
          <input className={fieldClass} value={draft.phone} onChange={(event) => set('phone', event.target.value)} />
        </label>
        <label className="text-sm text-slate-700 md:col-span-2">Address
          <input className={fieldClass} value={draft.address} onChange={(event) => set('address', event.target.value)} />
        </label>
        <label className="text-sm text-slate-700">Emergency contact
          <input className={fieldClass} value={draft.emergencyContactName} onChange={(event) => set('emergencyContactName', event.target.value)} />
        </label>
        <label className="text-sm text-slate-700">Emergency phone
          <input className={fieldClass} value={draft.emergencyContactPhone} onChange={(event) => set('emergencyContactPhone', event.target.value)} />
        </label>
        <label className="text-sm text-slate-700">Department
          <select className={fieldClass} value={draft.departmentId} onChange={(event) => set('departmentId', event.target.value)}>
            <option value="">No department</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-700">Position
          <select className={fieldClass} value={draft.positionId} onChange={(event) => set('positionId', event.target.value)}>
            <option value="">No position</option>
            {positions.filter((position) => !draft.departmentId || position.departmentId === draft.departmentId).map((position) => (
              <option key={position.id} value={position.id}>{position.title}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-700">Status
          <select className={fieldClass} value={draft.employmentStatus} onChange={(event) => set('employmentStatus', event.target.value)}>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        {mode === 'edit' && (
          <label className="text-sm text-slate-700">Gaji pokok
            <input
              ref={gajiInput}
              className={fieldClass}
              inputMode="numeric"
              autoComplete="off"
              disabled={!gajiKnown}
              value={formatIdr(gajiDigits)}
              onChange={(event) => {
                const digits = digitsFromDisplay(event.target.value);
                if (digits === null) return;
                salaryTouched.current = true;
                setGajiDigits(digits);
              }}
            />
          </label>
        )}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving…' : mode === 'edit' ? 'Save profile' : 'Submit change request'}
        </button>
      </div>
    </div>
  );
}

const fieldLabels: Record<string, string> = {
  full_name: 'Name',
  preferred_name: 'Preferred name',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  emergency_contact_name: 'Emergency contact',
  emergency_contact_phone: 'Emergency phone',
  department_id: 'Department',
  position_id: 'Position',
  employment_status: 'Status',
};

export function PendingProfileRequests({
  requests,
  departments,
  positions,
  onDecide,
}: {
  requests: Array<{ id: string; employee_code?: string; fields?: string[]; proposed?: Record<string, string | null>; has_photo?: boolean }>;
  departments: Department[];
  positions: Position[];
  onDecide: () => void;
}) {
  const [busy, setBusy] = useState('');
  if (requests.length === 0) return null;
  const labelFor = (key: string, value: string | null) => {
    if (key === 'department_id') return departments.find((department) => department.id === value)?.name || 'Department';
    if (key === 'position_id') return positions.find((position) => position.id === value)?.title || 'Position';
    return value || 'Empty';
  };
  const decide = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id + action);
    try {
      if (action === 'approve') await profileRequestsApi.approve(id);
      else await profileRequestsApi.reject(id);
      await onDecide();
    } catch {
      setBusy('');
      return;
    }
    setBusy('');
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h3 className="font-semibold text-slate-800">Profile change requests</h3>
      {requests.map((request) => (
        <div key={request.id} className="border border-slate-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium text-slate-800">{request.employee_code}</p>
          <ul className="text-sm text-slate-600 space-y-1">
            {(request.fields || []).map((field) => (
              <li key={field}>{fieldLabels[field] || field}: {labelFor(field, request.proposed?.[field] ?? null)}</li>
            ))}
          </ul>
          {request.has_photo && <img src={changeRequestPhotoUrl(request.id)} alt="" className="w-16 h-16 rounded-full object-cover" />}
          <div className="flex gap-2">
            <button type="button" disabled={busy !== ''} onClick={() => decide(request.id, 'approve')} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm">Approve</button>
            <button type="button" disabled={busy !== ''} onClick={() => decide(request.id, 'reject')} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
