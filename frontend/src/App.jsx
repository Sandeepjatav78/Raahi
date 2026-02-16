import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import { Toaster } from 'react-hot-toast';


const App = () => {
  const location = useLocation();
  const hideNavbar = location.pathname === '/login';

  return (
    <div className="min-h-screen text-slate-100">
      {!hideNavbar && <Navbar />}
      <Outlet />
      <Toaster position="top-center" reverseOrder={false} />
    </div>
  );
};

export default App;
