import React from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { registerServiceWorker } from './utils/notifications';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import StudentDashboard from './pages/StudentDashboard';
import ManageBuses from './pages/ManageBuses';
import ManageDrivers from './pages/ManageDrivers';
import ManageRoutes from './pages/ManageRoutes';
import ManageStops from './pages/ManageStops';
import AssignStudents from './pages/AssignStudents';
import ManageStudents from './pages/ManageStudents';
import DriverSimulator from './pages/DriverSimulator';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: (
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      ),
      children: [
        { index: true, element: <Navigate to="/login" replace /> },
        { path: 'login', element: <Login /> },
        {
          path: 'admin',
          element: (
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          )
        },
        {
          path: 'admin/buses',
          element: (
            <ProtectedRoute roles={['admin']}>
              <ManageBuses />
            </ProtectedRoute>
          )
        },
        {
          path: 'admin/drivers',
          element: (
            <ProtectedRoute roles={['admin']}>
              <ManageDrivers />
            </ProtectedRoute>
          )
        },
        {
          path: 'admin/routes',
          element: (
            <ProtectedRoute roles={['admin']}>
              <ManageRoutes />
            </ProtectedRoute>
          )
        },
        {
          path: 'admin/stops',
          element: (
            <ProtectedRoute roles={['admin']}>
              <ManageStops />
            </ProtectedRoute>
          )
        },
        {
          path: 'admin/assignments',
          element: (
            <ProtectedRoute roles={['admin']}>
              <AssignStudents />
            </ProtectedRoute>
          )
        },
        {
          path: 'admin/students',
          element: (
            <ProtectedRoute roles={['admin']}>
              <ManageStudents />
            </ProtectedRoute>
          )
        },
        {
          path: 'driver',
          element: (
            <ProtectedRoute roles={['driver']}>
              <DriverDashboard />
            </ProtectedRoute>
          )
        },
        {
          path: 'driver-sim',
          element: (
            <ProtectedRoute roles={['driver', 'admin']}>
              <DriverSimulator />
            </ProtectedRoute>
          )
        },
        {
          path: 'student',
          element: (
            <ProtectedRoute roles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          )
        },
        {
          path: 'profile',
          element: (
            <ProtectedRoute roles={['admin', 'driver', 'student']}>
              <Profile />
            </ProtectedRoute>
          )
        },
        { path: '*', element: <NotFound /> }
      ]
    }
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider
      router={router}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    />
  </React.StrictMode>
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerServiceWorker();
}
