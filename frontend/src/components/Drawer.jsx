import { X } from 'lucide-react';

const Drawer = ({ isOpen, title, subtitle, onClose, children, footer }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      {/* Centered Modal */}
      <section
        className="relative w-full max-w-lg max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl animate-fade-in flex flex-col"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="border-b border-white/10 px-5 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
            </div>
            <button
              type="button"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
              onClick={onClose}
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {/* Footer */}
        {footer && <footer className="border-t border-white/10 px-5 py-4 flex-shrink-0">{footer}</footer>}
      </section>
    </div>
  );
};

export default Drawer;
