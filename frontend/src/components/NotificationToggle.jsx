const NotificationToggle = ({ enabled, permission, onEnable, onDisable }) => {
  const statusCopy = enabled
    ? 'Notifications are on. We will alert you when your bus is close.'
    : 'Notifications are off. Enable them to get approach/arrival alerts.';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1">
        <p className="text-xs uppercase tracking-widest text-slate-400">Notifications</p>
        <h2 className="text-lg font-semibold text-slate-800">Stay informed</h2>
        <p className="text-sm text-slate-500">{statusCopy}</p>
        <p className="text-xs text-slate-400">Permission: {permission}</p>
      </div>
      <button
        type="button"
        onClick={enabled ? onDisable : onEnable}
        className={`w-full rounded-full px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          enabled
            ? 'bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-600'
            : 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900'
        }`}
      >
        {enabled ? 'Disable notifications' : 'Enable notifications'}
      </button>
      <p className="mt-2 text-xs text-slate-400">
        You can always change this later in the browser settings.
      </p>
    </section>
  );
};

export default NotificationToggle;
