const BusCard = ({ bus, onAction }) => {
  return (
    <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{bus.name}</h3>
          <p className="text-sm text-slate-500">#{bus.numberPlate}</p>
          {bus.route && (
            <p className="text-xs text-slate-400">Route: {bus.route.name}</p>
          )}
          {bus.driver && (
            <p className="text-xs text-slate-400">Driver: {bus.driver.name || bus.driver.username}</p>
          )}
        </div>
        {onAction && (
          <button
            type="button"
            onClick={() => onAction(bus)}
            className="rounded bg-brand px-3 py-1 text-sm text-white"
          >
            Manage
          </button>
        )}
      </div>
    </div>
  );
};

export default BusCard;
