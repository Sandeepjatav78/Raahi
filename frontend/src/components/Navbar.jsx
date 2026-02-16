import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import {
  Bus, Home, Users, Navigation, MapPin, UserCheck,
  User, LogOut, Sun, Moon, Bell, Menu, X, ChevronRight
} from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const isActive = (path) => location.pathname === path;
  const darkMode = isDark ?? true;

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); setProfileOpen(false); }, [location.pathname]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Admin navigation items
  const adminLinks = [
    { to: '/admin', icon: Home, label: 'Dashboard' },
    { to: '/admin/buses', icon: Bus, label: 'Buses' },
    { to: '/admin/drivers', icon: UserCheck, label: 'Drivers' },
    { to: '/admin/routes', icon: Navigation, label: 'Routes' },
    { to: '/admin/students', icon: Users, label: 'Students' },
    { to: '/admin/assignments', icon: MapPin, label: 'Assign' },
  ];

  // All nav links for the mobile drawer
  const getAllLinks = () => {
    if (user?.role === 'admin') return adminLinks;
    if (user?.role === 'student') return [
      { to: '/student', icon: Home, label: 'Dashboard' },
      { to: '/profile', icon: User, label: 'Profile' },
    ];
    if (user?.role === 'driver') return [
      { to: '/driver', icon: Navigation, label: 'Drive' },
      { to: '/profile', icon: User, label: 'Profile' },
    ];
    return [];
  };

  // Bottom nav for mobile (student/driver)
  const getMobileNav = () => {
    if (user?.role === 'student') {
      return [
        { to: '/student', icon: Home, label: 'Track' },
        { to: '/profile', icon: User, label: 'Profile' },
      ];
    }
    if (user?.role === 'driver') {
      return [
        { to: '/driver', icon: Navigation, label: 'Drive' },
        { to: '/profile', icon: User, label: 'Profile' },
      ];
    }
    return [];
  };

  const mobileNav = getMobileNav();
  const allLinks = getAllLinks();

  return (
    <>
      {/* ===== Top Header Bar ===== */}
      <header className="nav-header">
        <div className="nav-inner">
          {/* Left — Logo */}
          <Link
            to={user ? (user.role === 'admin' ? '/admin' : `/${user.role}`) : '/login'}
            className="nav-logo"
          >
            <img
              src="/logohorigental.svg"
              alt="TrackMate"
              className="nav-logo-img"
            />
          </Link>

          {/* Center — Desktop Admin Nav */}
          {user?.role === 'admin' && (
            <nav className="nav-center">
              {adminLinks.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`nav-link ${isActive(to) ? 'nav-link-active' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="nav-link-label">{label}</span>
                </Link>
              ))}
            </nav>
          )}

          {/* Right — Icon Actions */}
          <div className="nav-right">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="nav-icon-btn"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="w-[1.15rem] h-[1.15rem]" /> : <Moon className="w-[1.15rem] h-[1.15rem]" />}
            </button>

            {/* Notification Bell */}
            {user && (
              <button className="nav-icon-btn nav-bell-btn" title="Notifications">
                <Bell className="w-[1.15rem] h-[1.15rem]" />
                <span className="nav-bell-badge" />
              </button>
            )}

            {/* Profile Dropdown */}
            {user && (
              <div className="nav-profile-wrap" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="nav-avatar-btn"
                  title="Profile"
                >
                  <User className="w-[1.15rem] h-[1.15rem]" />
                </button>
                {profileOpen && (
                  <div className="nav-dropdown">
                    <div className="nav-dropdown-header">
                      <p className="nav-dropdown-name">{user.name || user.username}</p>
                      <p className="nav-dropdown-role">{user.role}</p>
                    </div>
                    <div className="nav-dropdown-divider" />
                    <Link to="/profile" className="nav-dropdown-item">
                      <User className="w-4 h-4" />
                      <span>My Profile</span>
                      <ChevronRight className="w-4 h-4 ml-auto opacity-40" />
                    </Link>
                    <button onClick={logout} className="nav-dropdown-item nav-dropdown-danger">
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Logout (always visible on desktop, no dropdown needed) */}
            {user && (
              <button
                onClick={logout}
                className="nav-icon-btn nav-logout-btn"
                title="Logout"
              >
                <LogOut className="w-[1.15rem] h-[1.15rem]" />
              </button>
            )}

            {/* Login button (guest) */}
            {!user && (
              <Link to="/login" className="nav-login-btn">Login</Link>
            )}

            {/* Mobile Hamburger */}
            {user && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="nav-icon-btn nav-hamburger"
                title="Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===== Mobile Slide-in Drawer ===== */}
      {drawerOpen && (
        <div className="nav-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <aside className="nav-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="nav-drawer-head">
              <div className="nav-drawer-logo">
                <img
                  src="/logohorigental.svg"
                  alt="TrackMate"
                  className="nav-logo-img"
                />
              </div>
              <button onClick={() => setDrawerOpen(false)} className="nav-drawer-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Info */}
            {user && (
              <div className="nav-drawer-user">
                <div className="nav-drawer-avatar">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="nav-drawer-username">{user.name || user.username}</p>
                  <p className="nav-drawer-userrole">{user.role}</p>
                </div>
              </div>
            )}

            {/* Nav Links */}
            <nav className="nav-drawer-links">
              {allLinks.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`nav-drawer-link ${isActive(to) ? 'nav-drawer-link-active' : ''}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                  {isActive(to) && <span className="nav-drawer-active-dot" />}
                </Link>
              ))}
            </nav>

            {/* Drawer Footer */}
            <div className="nav-drawer-footer">
              <button onClick={toggleTheme} className="nav-drawer-link">
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button onClick={logout} className="nav-drawer-link nav-drawer-link-danger">
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ===== Mobile Bottom Navigation (Student/Driver only) ===== */}
      {user && (user.role === 'student' || user.role === 'driver') && mobileNav.length > 0 && (
        <nav className="nav-bottom">
          <div className="nav-bottom-inner">
            {mobileNav.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`nav-bottom-link ${isActive(to) ? 'nav-bottom-active' : ''}`}
              >
                <Icon className={`w-6 h-6 ${isActive(to) ? 'nav-bottom-icon-active' : ''}`} />
                <span className="nav-bottom-label">{label}</span>
              </Link>
            ))}
            <button
              onClick={logout}
              className="nav-bottom-link nav-bottom-danger"
            >
              <LogOut className="w-6 h-6" />
              <span className="nav-bottom-label">Logout</span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
};

export default Navbar;
