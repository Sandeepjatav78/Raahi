const Toast = ({ toasts = [], onDismiss }) => (
  <div className="pointer-events-none fixed bottom-4 right-4 z-[999] flex flex-col gap-3" role="region" aria-live="polite">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        className={`pointer-events-auto min-w-[240px] max-w-sm rounded-2xl border px-4 py-3 shadow-lg ${
          toast.type === 'success'
            ? 'border-emerald-100 bg-white'
            : toast.type === 'warning'
              ? 'border-amber-200 bg-white'
              : toast.type === 'info'
                ? 'border-slate-200 bg-white'
                : 'border-red-200 bg-white'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            {toast.message && <p className="text-xs text-slate-600">{toast.message}</p>}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            className="text-xs text-slate-400 transition hover:text-slate-600"
            onClick={() => onDismiss(toast.id)}
          >
            x
          </button>
        </div>
      </div>
    ))}
  </div>
);

export default Toast;
