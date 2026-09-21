import { useKeyboardShortcuts } from '../context/KeyboardShortcutsContext';
import { X, Keyboard } from 'lucide-react';
import Modal from './Modal';

export default function KeyboardShortcutsHelp() {
  const { shortcuts, isHelpOpen, setIsHelpOpen } = useKeyboardShortcuts();

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  const formatShortcut = (shortcut: typeof shortcuts[0]) => {
    const parts = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  return (
    <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Keyboard Shortcuts" size="md">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
          <Keyboard size={16} />
          <span>Press <kbd className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">Ctrl + /</kbd> or <kbd className="px-2 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">?</kbd> to toggle this help</span>
        </div>

        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
          <div key={category}>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">{category}</h3>
            <div className="space-y-2">
              {categoryShortcuts.map((shortcut, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-300">{shortcut.description}</span>
                  <kbd className="px-3 py-1 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {formatShortcut(shortcut)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}

        {shortcuts.length === 0 && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Keyboard size={48} className="mx-auto mb-3 opacity-50" />
            <p>No shortcuts registered for this page</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
