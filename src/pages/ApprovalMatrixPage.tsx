import { useState } from 'react';
import { GitBranch, Plus, Edit2, Trash2, Save, CheckCircle } from 'lucide-react';

interface ApprovalStep {
  id: string;
  order: number;
  role: string;
  name: string;
  autoApprove: boolean;
  notifyByEmail: boolean;
}

interface ApprovalWorkflow {
  id: string;
  name: string;
  type: 'leave' | 'overtime' | 'expense' | 'correction';
  steps: ApprovalStep[];
  isActive: boolean;
}

export default function ApprovalMatrixPage() {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([
    {
      id: 'w1',
      name: 'Standard Leave Approval',
      type: 'leave',
      steps: [
        { id: 's1', order: 1, role: 'SUPERVISOR', name: 'Direct Supervisor', autoApprove: false, notifyByEmail: true },
        { id: 's2', order: 2, role: 'HR_STAFF', name: 'HR Staff', autoApprove: false, notifyByEmail: true },
      ],
      isActive: true,
    },
    {
      id: 'w2',
      name: 'Overtime Approval',
      type: 'overtime',
      steps: [
        { id: 's3', order: 1, role: 'SUPERVISOR', name: 'Direct Supervisor', autoApprove: false, notifyByEmail: true },
      ],
      isActive: true,
    },
    {
      id: 'w3',
      name: 'Attendance Correction',
      type: 'correction',
      steps: [
        { id: 's4', order: 1, role: 'SUPERVISOR', name: 'Direct Supervisor', autoApprove: false, notifyByEmail: true },
        { id: 's5', order: 2, role: 'HR_ADMIN', name: 'HR Admin', autoApprove: false, notifyByEmail: true },
      ],
      isActive: true,
    },
  ]);

  const [editingWorkflow, setEditingWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const availableRoles = [
    { value: 'SUPERVISOR', label: 'Direct Supervisor' },
    { value: 'DEPARTMENT_HEAD', label: 'Department Head' },
    { value: 'HR_STAFF', label: 'HR Staff' },
    { value: 'HR_ADMIN', label: 'HR Admin' },
    { value: 'PAYROLL', label: 'Payroll Staff' },
    { value: 'FINANCE', label: 'Finance' },
    { value: 'GENERAL_MANAGER', label: 'General Manager' },
  ];

  const workflowTypes = [
    { value: 'leave', label: 'Leave Requests' },
    { value: 'overtime', label: 'Overtime Requests' },
    { value: 'expense', label: 'Expense Claims' },
    { value: 'correction', label: 'Attendance Corrections' },
  ];

  const handleCreateNew = () => {
    setEditingWorkflow({
      id: 'w' + Date.now(),
      name: '',
      type: 'leave',
      steps: [],
      isActive: true,
    });
    setShowEditor(true);
  };

  const handleEdit = (workflow: ApprovalWorkflow) => {
    setEditingWorkflow({ ...workflow });
    setShowEditor(true);
  };

  const handleSave = () => {
    if (!editingWorkflow?.name || editingWorkflow.steps.length === 0) {
      alert('Please provide a workflow name and at least one approval step');
      return;
    }

    const existing = workflows.find(w => w.id === editingWorkflow.id);
    if (existing) {
      setWorkflows(workflows.map(w => w.id === editingWorkflow.id ? editingWorkflow : w));
    } else {
      setWorkflows([...workflows, editingWorkflow]);
    }

    setShowEditor(false);
    setEditingWorkflow(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      setWorkflows(workflows.filter(w => w.id !== id));
    }
  };

  const handleToggleActive = (id: string) => {
    setWorkflows(workflows.map(w => w.id === id ? { ...w, isActive: !w.isActive } : w));
  };

  const addStep = () => {
    if (!editingWorkflow) return;
    const newStep: ApprovalStep = {
      id: 's' + Date.now(),
      order: editingWorkflow.steps.length + 1,
      role: 'SUPERVISOR',
      name: '',
      autoApprove: false,
      notifyByEmail: true,
    };
    setEditingWorkflow({ ...editingWorkflow, steps: [...editingWorkflow.steps, newStep] });
  };

  const removeStep = (stepId: string) => {
    if (!editingWorkflow) return;
    setEditingWorkflow({
      ...editingWorkflow,
      steps: editingWorkflow.steps.filter(s => s.id !== stepId).map((s, idx) => ({ ...s, order: idx + 1 })),
    });
  };

  const updateStep = (stepId: string, updates: Partial<ApprovalStep>) => {
    if (!editingWorkflow) return;
    setEditingWorkflow({
      ...editingWorkflow,
      steps: editingWorkflow.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
    });
  };

  const getWorkflowTypeLabel = (type: string) => {
    return workflowTypes.find(t => t.value === type)?.label || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Approval Matrix</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure multi-level approval workflows</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus size={16} /> New Workflow
        </button>
      </div>

      {/* Workflows List */}
      <div className="space-y-4">
        {workflows.map(workflow => (
          <div key={workflow.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                  <GitBranch size={24} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">{workflow.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{getWorkflowTypeLabel(workflow.type)} • {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(workflow.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    workflow.isActive
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {workflow.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => handleEdit(workflow)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Edit2 size={16} className="text-slate-600 dark:text-slate-400" />
                </button>
                <button
                  onClick={() => handleDelete(workflow.id)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                </button>
              </div>
            </div>

            {/* Approval Steps */}
            <div className="ml-16 space-y-2">
              {workflow.steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-400">
                    {step.order}
                  </div>
                  <div className="flex-1 flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{step.name || step.role}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{step.role}</p>
                    </div>
                    {step.autoApprove && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">Auto</span>
                    )}
                    {step.notifyByEmail && (
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs">Email</span>
                    )}
                  </div>
                  {idx < workflow.steps.length - 1 && (
                    <div className="text-slate-400 dark:text-slate-600">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {workflows.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <GitBranch size={48} className="mx-auto mb-3 opacity-50" />
          <p>No approval workflows configured. Create your first workflow!</p>
        </div>
      )}

      {/* Workflow Editor Modal */}
      {showEditor && editingWorkflow && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              {workflows.find(w => w.id === editingWorkflow.id) ? 'Edit Workflow' : 'Create Workflow'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Workflow Name</label>
                <input
                  type="text"
                  value={editingWorkflow.name}
                  onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder="e.g. Standard Leave Approval"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Workflow Type</label>
                <select
                  value={editingWorkflow.type}
                  onChange={(e) => setEditingWorkflow({ ...editingWorkflow, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                >
                  {workflowTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Approval Steps</label>
                  <button
                    onClick={addStep}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                  >
                    <Plus size={12} /> Add Step
                  </button>
                </div>

                <div className="space-y-3">
                  {editingWorkflow.steps.map((step, idx) => (
                    <div key={step.id} className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="flex-shrink-0 w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-400">
                        {step.order}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) => updateStep(step.id, { name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                          placeholder="Step name (e.g. Direct Supervisor)"
                        />
                        <select
                          value={step.role}
                          onChange={(e) => updateStep(step.id, { role: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                        >
                          {availableRoles.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={step.autoApprove}
                              onChange={(e) => updateStep(step.id, { autoApprove: e.target.checked })}
                              className="rounded border-slate-300"
                            />
                            Auto-approve
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={step.notifyByEmail}
                              onChange={(e) => updateStep(step.id, { notifyByEmail: e.target.checked })}
                              className="rounded border-slate-300"
                            />
                            Notify by email
                          </label>
                        </div>
                      </div>
                      <button
                        onClick={() => removeStep(step.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditor(false);
                    setEditingWorkflow(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  <Save size={16} /> Save Workflow
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
