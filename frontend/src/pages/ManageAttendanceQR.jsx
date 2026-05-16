import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { QrCode, Bus, ChevronRight, Download, Printer, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Link } from 'react-router-dom';

const ManageAttendanceQR = () => {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeQrs, setRouteQrs] = useState([]);
  const [generating, setGenerating] = useState(false);

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/qr-catalog');
      setCatalog(data);
    } catch (err) {
      toast.error('Failed to load QR catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const selectRoute = async (route) => {
    setSelectedRoute(route);
    setGenerating(true);
    try {
      const routeId = route._id || 'unassigned';
      const { data } = await api.get(`/admin/qr-route/${routeId}`);
      setRouteQrs(data);
    } catch (err) {
      toast.error('Failed to generate QRs for route');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
        <p className="text-slate-400">Loading routes and buses...</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8 no-print">
        <Link to="/admin" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance QR Generator</h1>
          <p className="text-sm text-slate-400">Generate and print QR codes for each bus route.</p>
        </div>
      </div>

      {!selectedRoute ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((route) => (
            <button
              key={route._id || 'unassigned'}
              onClick={() => selectRoute(route)}
              className="group text-left p-5 rounded-3xl border border-white/10 bg-slate-900/40 hover:bg-slate-900/60 transition-all hover:border-indigo-500/30"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 transition">
                  <QrCode className="w-6 h-6" />
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">{route.name}</h3>
              <p className="text-sm text-slate-400 mt-1">{route.buses.length} buses assigned</p>
            </button>
          ))}

          {catalog.length === 0 && (
            <div className="col-span-full py-12 text-center card bg-slate-900/20">
              <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No buses or routes found to generate QRs for.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 no-print">
            <button
              onClick={() => setSelectedRoute(null)}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              &larr; Back to all routes
            </button>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-400 transition"
              >
                <Printer className="w-4 h-4" /> Print All
              </button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 no-print">
            <h2 className="text-xl font-bold text-white mb-2">{selectedRoute.name}</h2>
            <p className="text-slate-400 text-sm">Printing {routeQrs.length} QR codes for this route.</p>
          </div>

          {generating ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Generating payload...</p>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2 print:grid-cols-2">
              {routeQrs.map((item) => (
                <div key={item.bus._id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center text-center page-break-inside-avoid">
                  <div className="mb-6">
                    <h3 className="text-2xl font-black text-slate-900 mb-1">{item.bus.name}</h3>
                    <p className="text-lg font-bold text-indigo-600 uppercase tracking-widest">{item.bus.numberPlate}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-3xl border-2 border-slate-100 mb-6">
                    <QRCode
                      value={item.qrCode}
                      size={200}
                      level="H"
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-slate-500 font-medium">{item.route.name}</p>
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">Powered by Raahi TrackMate</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 20px !important; }
          .page-break-inside-avoid { page-break-inside: avoid; }
        }
      `}} />
    </main>
  );
};

export default ManageAttendanceQR;
