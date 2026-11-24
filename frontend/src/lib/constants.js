const U = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

export const IMAGES = {
  hospital: U('1586773860418-d37222d8fce3'),
  reception: U('1519494026892-80bbd2d6fd0d'),
  ward: U('1538108149393-fbbd81895907'),
  doctorTeam: U('1631217868264-e5b90bb7e133'),
  doctorPhone: U('1576091160399-112ba8d25d1d'),
  surgery: U('1579684385127-1ef15d508118'),
  stethoscope: U('1584982751601-97dcc096659c'),
  lab: U('1581594693702-fbdc51b2763b'),
  pharmacy: U('1579154204601-01588f351e67'),
  scans: U('1666214280557-f1b5022eb634'),
  nurse: U('1612776572997-76cc42e058c3'),
  icu: U('1551076805-e1869033e561'),
  heart: U('1530026186672-2cd00ffc50fe'),
  security: U('1576671081837-49000212a370'),
};

export const ROLE_META = {
  admin: { label: 'Administrator', short: 'Admin', hero: IMAGES.hospital, tagline: 'Command centre for the entire hospital', color: 'from-navy-900 to-navy-700' },
  doctor: { label: 'Doctor', short: 'Doctor', hero: IMAGES.doctorTeam, tagline: 'Your patients, schedule and clinical tools', color: 'from-teal-700 to-navy-800' },
  receptionist: { label: 'Receptionist', short: 'Front Desk', hero: IMAGES.reception, tagline: 'Registrations, appointments and admissions', color: 'from-navy-800 to-teal-700' },
};

export const BED_STATUS = {
  available: { label: 'Available', dot: 'bg-emerald-500', text: 'text-emerald-700', soft: 'bg-emerald-50', border: 'border-emerald-200', hex: '#10b981' },
  occupied: { label: 'Occupied', dot: 'bg-blue-500', text: 'text-blue-700', soft: 'bg-blue-50', border: 'border-blue-200', hex: '#3b82f6' },
  maintenance: { label: 'Maintenance', dot: 'bg-rose-500', text: 'text-rose-700', soft: 'bg-rose-50', border: 'border-rose-200', hex: '#f43f5e' },
};

export const URGENCY = {
  critical: { label: 'Critical', tone: 'red', bar: 'bg-rose-500', hex: '#f43f5e' },
  high: { label: 'High', tone: 'amber', bar: 'bg-amber-500', hex: '#f59e0b' },
  medium: { label: 'Medium', tone: 'blue', bar: 'bg-blue-500', hex: '#3b82f6' },
  low: { label: 'Low', tone: 'green', bar: 'bg-emerald-500', hex: '#10b981' },
};

export const APPT_STATUS = {
  scheduled: { label: 'Scheduled', tone: 'blue' },
  checked_in: { label: 'Checked in', tone: 'teal' },
  completed: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
  no_show: { label: 'No show', tone: 'amber' },
};

export const EMG_STATUS = {
  pending: { label: 'Pending', tone: 'amber' },
  in_treatment: { label: 'In treatment', tone: 'blue' },
  admitted: { label: 'Admitted', tone: 'teal' },
  resolved: { label: 'Resolved', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
};

export const CHART_COLORS = ['#12223f', '#17aa9e', '#3b82f6', '#8b5cf6', '#f59e0b', '#94a3b8'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@medicore.com', password: 'Admin@123' },
  doctor: { email: 'doctor@medicore.com', password: 'Doctor@123' },
  receptionist: { email: 'reception@medicore.com', password: 'Reception@123' },
};
