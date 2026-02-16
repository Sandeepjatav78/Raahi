import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  User, Phone, Lock, Shield, Save, Eye, EyeOff,
  Bus, MapPin, AlertCircle, IdCard, ChevronRight, X,
  Navigation, Settings, Users, UserCheck, LayoutDashboard, Mail
} from 'lucide-react';

const roleRedirect = {
  admin: '/admin',
  driver: '/driver',
  student: '/student'
};

const Profile = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    role: '',
    name: '',
    phone: '',
    currentPassword: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Bus/Stop selection state (students only)
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [selectedStopSeq, setSelectedStopSeq] = useState('');
  const [currentAssignment, setCurrentAssignment] = useState(null);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        role: user.role || '',
        name: user.name || '',
        phone: user.phone || '',
        currentPassword: '',
        password: ''
      });

      // Fetch buses and current assignment for students
      if (user.role === 'student') {
        fetchBusesAndAssignment();
      }
    }
  }, [user]);

  const fetchBusesAndAssignment = async () => {
    try {
      const [busesRes, assignmentRes] = await Promise.all([
        api.get('/students/buses'),
        api.get('/students/assignment')
      ]);

      setBuses(busesRes.data || []);

      if (assignmentRes.data) {
        setCurrentAssignment(assignmentRes.data);
        setSelectedBusId(assignmentRes.data.bus?._id || '');
        setSelectedStopSeq(assignmentRes.data.stop?.seq?.toString() || assignmentRes.data.stop?.sequence?.toString() || '');
      }
    } catch (err) {
      console.error('Failed to fetch buses:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBusChange = (e) => {
    setSelectedBusId(e.target.value);
    setSelectedStopSeq(''); // Reset stop when bus changes
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (formData.password && !formData.currentPassword) {
      toast.error('Current password is required to change password');
      setLoading(false);
      return;
    }

    const payload = {
      name: formData.name,
      phone: formData.phone
    };
    if (formData.password) {
      payload.password = formData.password;
      payload.currentPassword = formData.currentPassword;
    }

    try {
      // Update profile
      await api.put('/auth/profile', payload);

      // Update bus assignment for students
      if (formData.role === 'student' && selectedBusId) {
        await api.put('/students/assignment', {
          busId: selectedBusId,
          stopSeq: selectedStopSeq ? parseInt(selectedStopSeq) : null
        });
      }

      toast.success('Profile updated successfully!');
      setFormData(prev => ({ ...prev, currentPassword: '', password: '' }));

      // If this was a first login, update user state and redirect to dashboard
      if (user?.firstLogin) {
        const updatedUser = { ...user, firstLogin: false, name: formData.name, phone: formData.phone };
        setUser(updatedUser);
        localStorage.setItem('tm_user', JSON.stringify(updatedUser));
        toast.success('Welcome to TrackMate! Redirecting to dashboard...', { duration: 2000 });
        setTimeout(() => {
          navigate(roleRedirect[user.role] || '/student', { replace: true });
        }, 1500);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'profile-badge-admin',
      driver: 'profile-badge-driver',
      student: 'profile-badge-student'
    };
    return styles[role] || 'profile-badge-default';
  };

  // Get stops for selected bus
  const selectedBus = buses.find(b => b._id === selectedBusId);
  const availableStops = selectedBus?.route?.stops || [];

  return (
    <main className="profile-page">
      <div className="profile-container">
        {/* ---- Security Alert Banner (full width) ---- */}
        {user?.firstLogin && (
          <div className="profile-alert profile-card-animate profile-full-width">
            <div className="profile-alert-icon">
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="profile-alert-title">Security Alert</h3>
              <p className="profile-alert-text">
                Change your password if using default credentials. Your initial password is your username.
              </p>
            </div>
          </div>
        )}

        {/* ---- Desktop 2-column grid ---- */}
        <div className="profile-grid">
          {/* LEFT COLUMN: Header + Role-specific cards */}
          <div className="profile-col-left">
            {/* Profile Header */}
            <header className="profile-header profile-card-animate">
              <div className="profile-avatar">
                <User className="w-10 h-10 text-white" />
              </div>
              <h1 className="profile-name">{formData.name || formData.username}</h1>
              <span className={`profile-badge ${getRoleBadge(formData.role)}`}>
                {formData.role}
              </span>
              <div className="profile-header-divider" />
            </header>

            {/* Account Information (Read-Only) — admin/driver only (students see it on right) */}
            {formData.role !== 'student' && (
              <section className="profile-card profile-card-animate">
                <div className="profile-card-header">
                  <IdCard className="w-4.5 h-4.5 profile-card-icon" />
                  <h2 className="profile-card-title">Account Information</h2>
                </div>
                <div className="profile-info-grid">
                  <div className="profile-info-tag">
                    <span className="profile-info-label">Username</span>
                    <span className="profile-info-value">@{formData.username}</span>
                  </div>
                  <div className="profile-info-tag">
                    <span className="profile-info-label">Role</span>
                    <span className="profile-info-value capitalize">{formData.role}</span>
                  </div>
                  {formData.phone && (
                    <div className="profile-info-tag profile-info-tag-full">
                      <span className="profile-info-label">Phone</span>
                      <span className="profile-info-value">{formData.phone}</span>
                    </div>
                  )}
                  {user?.email && (
                    <div className="profile-info-tag profile-info-tag-full">
                      <span className="profile-info-label">Email</span>
                      <span className="profile-info-value">{user.email}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Admin — Permissions / Quick Links */}
            {formData.role === 'admin' && (
              <section className="profile-card profile-card-animate">
                <div className="profile-card-header">
                  <Shield className="w-4.5 h-4.5 profile-card-icon" />
                  <h2 className="profile-card-title">Admin Privileges</h2>
                </div>
                <div className="profile-perms-list">
                  {[
                    { icon: LayoutDashboard, label: 'Dashboard & Analytics' },
                    { icon: Bus, label: 'Manage Buses' },
                    { icon: UserCheck, label: 'Manage Drivers' },
                    { icon: Navigation, label: 'Manage Routes' },
                    { icon: Users, label: 'Manage Students' },
                    { icon: Settings, label: 'System Configuration' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="profile-perm-item">
                      <Icon className="w-4 h-4 profile-perm-icon" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Driver — Assignment Info */}
            {formData.role === 'driver' && (
              <section className="profile-card profile-card-animate">
                <div className="profile-card-header">
                  <Navigation className="w-4.5 h-4.5 profile-card-icon" />
                  <h2 className="profile-card-title">Driver Assignment</h2>
                </div>
                <div className="profile-info-grid">
                  <div className="profile-info-tag profile-info-tag-full">
                    <span className="profile-info-label">Assigned Bus</span>
                    <span className="profile-info-value">
                      {user?.assignedBusId ? (
                        <span className="profile-assignment-pill">
                          <Bus className="w-4 h-4 flex-shrink-0" />
                          <span>Bus assigned</span>
                        </span>
                      ) : (
                        <span className="profile-no-assignment">No bus assigned — contact admin</span>
                      )}
                    </span>
                  </div>
                  <div className="profile-info-tag profile-info-tag-full">
                    <span className="profile-info-label">Status</span>
                    <span className="profile-info-value">
                      <span className="profile-driver-status">
                        <span className="profile-driver-status-dot" />
                        Active Driver
                      </span>
                    </span>
                  </div>
                </div>
              </section>
            )}

            {/* Bus Assignment — Students Only */}
            {formData.role === 'student' && (
              <section className="profile-card profile-card-animate">
                <div className="profile-card-header">
                  <Bus className="w-4.5 h-4.5 profile-card-icon" />
                  <h2 className="profile-card-title">Bus Assignment</h2>
                </div>

                <div className="profile-form-fields">
                  <div className="profile-field">
                    <label className="profile-label">Select Bus</label>
                    <div className="profile-input-wrap">
                      <Bus className="profile-input-icon" />
                      <select
                        value={selectedBusId}
                        onChange={handleBusChange}
                        className="profile-input profile-select"
                      >
                        <option value="">Select a bus...</option>
                        {buses.map(bus => (
                          <option key={bus._id} value={bus._id}>
                            {bus.name} ({bus.numberPlate}) {bus.route ? `- ${bus.route.name}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {availableStops.length > 0 && (
                    <div className="profile-field">
                      <label className="profile-label">Select Your Stop</label>
                      <div className="profile-input-wrap">
                        <MapPin className="profile-input-icon" />
                        <select
                          value={selectedStopSeq}
                          onChange={(e) => setSelectedStopSeq(e.target.value)}
                          className="profile-input profile-select"
                        >
                          <option value="">Select your stop...</option>
                          {availableStops.map(stop => (
                            <option key={stop._id} value={stop.seq}>
                              Stop #{stop.seq}: {stop.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {currentAssignment && (
                    <div className="profile-assignment-pill">
                      <Bus className="w-4 h-4 flex-shrink-0" />
                      <span>
                        {currentAssignment.bus?.name}
                        {currentAssignment.stop?.name && (
                          <>
                            <ChevronRight className="inline w-3.5 h-3.5 mx-0.5 opacity-60" />
                            {currentAssignment.stop.name}
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: Personal Info + Password (+ Account Info for students) */}
          <div className="profile-col-right">
            <form onSubmit={handleSubmit} className="profile-form-area">
              {/* Account Information (Read-Only) — students only; admin/driver have it in left col */}
              {formData.role === 'student' && (
                <section className="profile-card profile-card-animate">
                  <div className="profile-card-header">
                    <IdCard className="w-4.5 h-4.5 profile-card-icon" />
                    <h2 className="profile-card-title">Account Information</h2>
                  </div>
                  <div className="profile-info-grid">
                    <div className="profile-info-tag">
                      <span className="profile-info-label">Username</span>
                      <span className="profile-info-value">@{formData.username}</span>
                    </div>
                    <div className="profile-info-tag">
                      <span className="profile-info-label">Role</span>
                      <span className="profile-info-value capitalize">{formData.role}</span>
                    </div>
                    {formData.phone && (
                      <div className="profile-info-tag profile-info-tag-full">
                        <span className="profile-info-label">Phone</span>
                        <span className="profile-info-value">{formData.phone}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Personal Information */}
              <section className="profile-card profile-card-animate">
                <div className="profile-card-header">
                  <User className="w-4.5 h-4.5 profile-card-icon" />
                  <h2 className="profile-card-title">Personal Information</h2>
                </div>

                <div className="profile-form-fields">
                  <div className="profile-field">
                    <label className="profile-label">Full Name</label>
                    <div className="profile-input-wrap">
                      <User className="profile-input-icon" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter your name"
                        className="profile-input"
                      />
                    </div>
                  </div>

                  <div className="profile-field">
                    <label className="profile-label">Phone Number</label>
                    <div className="profile-input-wrap">
                      <Phone className="profile-input-icon" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Enter phone number"
                        className="profile-input"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Change Password */}
              <section className="profile-card profile-card-animate">
                <div className="profile-card-header">
                  <Shield className="w-4.5 h-4.5 profile-card-icon" />
                  <h2 className="profile-card-title">Change Password</h2>
                </div>

                <div className="profile-form-fields">
                  <div className="profile-field">
                    <label className="profile-label">Current Password</label>
                    <div className="profile-input-wrap">
                      <Lock className="profile-input-icon" />
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        name="currentPassword"
                        value={formData.currentPassword}
                        onChange={handleChange}
                        placeholder="Required to change password"
                        className="profile-input pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="profile-eye-btn"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="profile-field">
                    <label className="profile-label">New Password</label>
                    <div className="profile-input-wrap">
                      <Shield className="profile-input-icon" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Leave blank to keep current"
                        className="profile-input pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="profile-eye-btn"
                      >
                        {showNewPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                    <p className="profile-helper">Only fill this if you want to change your password.</p>
                  </div>
                </div>
              </section>

              {/* Save Button */}
              <div className="profile-save-wrap">
                <button
                  type="submit"
                  disabled={loading}
                  className="profile-save-btn"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Profile;

