import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, Link } from 'react-router-dom';
import { Loader2, ShieldOff, Compass } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import { Button } from './components/ui';
import Login from './pages/Login';
const Dashboard = lazy(() => import('./pages/dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const PatientProfile = lazy(() => import('./pages/PatientProfile'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Beds = lazy(() => import('./pages/Beds'));
const Admissions = lazy(() => import('./pages/Admissions'));
const Emergency = lazy(() => import('./pages/Emergency'));
const Doctors = lazy(() => import('./pages/Doctors'));
const Staff = lazy(() => import('./pages/Staff'));
const Medicines = lazy(() => import('./pages/Medicines'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Clinical = lazy(() => import('./pages/Clinical'));
const Profile = lazy(() => import('./pages/Profile'));

const Fallback = () => <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-teal-600" size={32} /></div>;

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-teal-600" size={32} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Role({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) {
    return (
      <div className="card mx-auto mt-16 flex max-w-lg flex-col items-center px-8 py-14 text-center">
        <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-500"><ShieldOff size={30} /></span>
        <h2 className="text-xl font-extrabold text-navy-900">Access restricted</h2>
        <p className="mt-2 text-sm text-slate-500">Your role ({user.role}) doesn't have permission to open this area. If you think this is a mistake, contact an administrator.</p>
        <Link to="/dashboard" className="mt-6"><Button>Back to dashboard</Button></Link>
      </div>
    );
  }
  return children;
}

const NotFound = () => (
  <div className="card mx-auto mt-16 flex max-w-lg flex-col items-center px-8 py-14 text-center">
    <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-teal-50 text-teal-600"><Compass size={30} /></span>
    <h2 className="text-xl font-extrabold text-navy-900">Page not found</h2>
    <p className="mt-2 text-sm text-slate-500">The page you're looking for doesn't exist or was moved.</p>
    <Link to="/dashboard" className="mt-6"><Button>Back to dashboard</Button></Link>
  </div>
);

export default function App() {
  const { user } = useAuth();
  const ALL = ['admin', 'doctor', 'receptionist'];
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route element={<Suspense fallback={<Fallback />}><Outlet /></Suspense>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patients" element={<Role roles={ALL}><Patients /></Role>} />
        <Route path="/patients/:id" element={<Role roles={ALL}><PatientProfile /></Role>} />
        <Route path="/appointments" element={<Role roles={ALL}><Appointments /></Role>} />
        <Route path="/beds" element={<Role roles={ALL}><Beds /></Role>} />
        <Route path="/admissions" element={<Role roles={['admin', 'receptionist']}><Admissions /></Role>} />
        <Route path="/emergency" element={<Role roles={ALL}><Emergency /></Role>} />
        <Route path="/doctors" element={<Role roles={['admin', 'receptionist']}><Doctors /></Role>} />
        <Route path="/staff" element={<Role roles={['admin']}><Staff /></Role>} />
        <Route path="/medicines" element={<Role roles={['admin', 'doctor']}><Medicines /></Role>} />
        <Route path="/clinical" element={<Role roles={['admin', 'doctor']}><Clinical /></Role>} />
        <Route path="/audit" element={<Role roles={['admin']}><AuditLogs /></Role>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
