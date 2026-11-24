import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './Admin';
import DoctorDashboard from './Doctor';
import ReceptionDashboard from './Reception';

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === 'doctor') return <DoctorDashboard user={user} />;
  if (user.role === 'receptionist') return <ReceptionDashboard user={user} />;
  return <AdminDashboard user={user} />;
}
