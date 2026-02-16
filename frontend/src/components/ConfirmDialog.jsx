import { AlertTriangle } from 'lucide-react';

const ConfirmDialog = ({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }) => {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'} transition-opacity duration-200`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onCancel} />
      <section
        className={`relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl ${
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } transition-all duration-200`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {message && <p className="mt-1 text-sm text-slate-400">{message}</p>}
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 font-medium hover:text-white hover:border-white/20 transition"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ConfirmDialog;
