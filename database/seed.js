/**
 * Realistic simulated hospital data for demonstration purposes.
 * Deterministic (seeded PRNG) so every install looks the same.
 * Dates are relative to "now" so dashboards always look current.
 */
const U = (id, w = 800) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
const portrait = (g, n) => `https://randomuser.me/api/portraits/${g === 'female' ? 'women' : 'men'}/${n}.jpg`;

module.exports = async function seed(conn, { bcrypt }) {
  // ------------------------------------------------------------------ helpers
  let s = 20260117;
  const rnd = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ri = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const p2 = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  const fmtDate = (d) => fmt(d).slice(0, 10);
  const NOW = new Date();
  const ago = (days, hour, min = 0) => { const d = new Date(NOW); d.setDate(d.getDate() - days); if (hour !== undefined) d.setHours(hour, min, 0, 0); return d; };
  const bulk = async (table, cols, rows) => {
    if (!rows.length) return;
    for (let i = 0; i < rows.length; i += 200) {
      await conn.query(`INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES ?`, [rows.slice(i, i + 200)]);
    }
  };

  // -------------------------------------------------------------- departments
  const depts = [
    ['Cardiology', 'Heart and vascular care, interventional cardiology and cardiac rehabilitation.', U('1530026186672-2cd00ffc50fe'), 'HeartPulse', '#ef4444', 'Floor 3'],
    ['Neurology', 'Diagnosis and treatment of brain, spine and nervous system disorders.', U('1559757175-5700dde675bc'), 'Brain', '#8b5cf6', 'Floor 4'],
    ['Orthopedics', 'Bone, joint and sports injury care with advanced surgical options.', U('1530497610245-94d3c16cda28'), 'Bone', '#f59e0b', 'Floor 2'],
    ['Emergency Medicine', '24/7 emergency and trauma response with rapid triage.', U('1551601651-2a8555f1a136'), 'Siren', '#dc2626', 'Ground'],
    ['General Medicine', 'Comprehensive primary and internal medicine for adults.', U('1631217868264-e5b90bb7e133'), 'Stethoscope', '#0d9488', 'Floor 1'],
    ['Surgery', 'General and minimally-invasive surgery with modern operating suites.', U('1579684385127-1ef15d508118'), 'Scissors', '#2563eb', 'Floor 2'],
    ['Radiology', 'MRI, CT, ultrasound and digital X-ray diagnostic imaging.', U('1666214280557-f1b5022eb634'), 'ScanLine', '#0891b2', 'Basement'],
    ['Pediatrics', 'Child-friendly care for infants, children and adolescents.', U('1584982751601-97dcc096659c'), 'Baby', '#ec4899', 'Floor 1'],
  ].map((d, i) => [i + 1, ...d]);
  await bulk('departments', ['id', 'name', 'description', 'image_url', 'icon', 'color', 'floor'], depts);
  const deptId = Object.fromEntries(depts.map((d) => [d[1], d[0]]));

  // -------------------------------------------------------------------- users
  const hAdmin = await bcrypt.hash('Admin@123', 10);
  const hDoc = await bcrypt.hash('Doctor@123', 10);
  const hRec = await bcrypt.hash('Reception@123', 10);
  const users = [
    [1, 'Hannah Collins', 'admin@medicore.com', hAdmin, 'admin', '+1 555 0100', portrait('female', 79)],
    [2, 'Daniel Foster', 'reception@medicore.com', hRec, 'receptionist', '+1 555 0101', portrait('male', 22)],
    [3, 'Maya Singh', 'maya.singh@medicore.com', hRec, 'receptionist', '+1 555 0102', portrait('female', 17)],
  ];
  const doctorDefs = [
    // name, email, dept, specialization, qualification, exp, fee, bio, gender, photo#
    ['Sofia Rivera', 'doctor@medicore.com', 'Cardiology', 'Interventional Cardiologist', 'MD, DM Cardiology, FACC', 14, 180, 'Leads the cardiac cath lab and specialises in complex coronary interventions.', 'female', 44],
    ['Arjun Mehta', 'arjun.mehta@medicore.com', 'Neurology', 'Neurologist', 'MD, DM Neurology', 11, 170, 'Stroke and epilepsy specialist with a focus on rapid-response neuro care.', 'male', 32],
    ['Priya Nair', 'priya.nair@medicore.com', 'Pediatrics', 'Pediatrician', 'MD Pediatrics, IAP Fellow', 9, 120, 'Dedicated to child wellness, immunisation and developmental pediatrics.', 'female', 65],
    ['Michael Chen', 'michael.chen@medicore.com', 'Orthopedics', 'Orthopedic Surgeon', 'MS Orthopedics, FRCS', 16, 200, 'Joint replacement and sports medicine surgeon.', 'male', 75],
    ['Aisha Rahman', 'aisha.rahman@medicore.com', 'Radiology', 'Radiologist', 'MD Radiodiagnosis', 8, 150, 'Expert in neuro and musculoskeletal imaging.', 'female', 68],
    ['David Okafor', 'david.okafor@medicore.com', 'Emergency Medicine', 'Emergency Physician', 'MD, FACEP', 12, 160, 'Trauma and critical care lead for the emergency department.', 'male', 52],
    ['Emily Watson', 'emily.watson@medicore.com', 'General Medicine', 'Internal Medicine Physician', 'MD Internal Medicine', 10, 110, 'Manages complex chronic conditions with a preventive-care approach.', 'female', 26],
    ['Rahul Verma', 'rahul.verma@medicore.com', 'Surgery', 'General Surgeon', 'MS General Surgery, FACS', 15, 220, 'Laparoscopic and robotic-assisted surgery specialist.', 'male', 46],
    ['Laura Martinez', 'laura.martinez@medicore.com', 'Cardiology', 'Cardiac Electrophysiologist', 'MD, PhD Cardiology', 13, 190, 'Arrhythmia management and device implantation expert.', 'female', 12],
    ['James Anderson', 'james.anderson@medicore.com', 'General Medicine', 'Family Physician', 'MBBS, MD Family Medicine', 18, 100, 'Whole-family care with 18 years of community practice.', 'male', 12],
    ['Neha Kapoor', 'neha.kapoor@medicore.com', 'Pediatrics', 'Neonatologist', 'MD Pediatrics, DM Neonatology', 7, 140, 'Newborn intensive care and high-risk neonatal follow-up.', 'female', 33],
    ['Omar Haddad', 'omar.haddad@medicore.com', 'Emergency Medicine', 'Trauma Specialist', 'MD, FAAEM', 9, 160, 'Advanced trauma life support instructor.', 'male', 64],
  ];
  doctorDefs.forEach((d, i) => users.push([4 + i, d[0], d[1], hDoc, 'doctor', `+1 555 02${p2(i)}`, portrait(d[8], d[9])]));
  await bulk('users', ['id', 'name', 'email', 'password_hash', 'role', 'phone', 'avatar_url'], users);

  const doctors = doctorDefs.map((d, i) => [
    i + 1, 4 + i, deptId[d[2]], d[3], d[4], d[5], d[6], `MC-LIC-${2010 + i}${ri(100, 999)}`, d[7],
    (4.4 + rnd() * 0.6).toFixed(1), pick(['Mon,Tue,Wed,Thu,Fri', 'Mon,Wed,Fri,Sat', 'Tue,Thu,Fri,Sat,Sun', 'Mon,Tue,Thu,Fri']),
    i === 8 ? 'on_leave' : 'active',
  ]);
  await bulk('doctors', ['id', 'user_id', 'department_id', 'specialization', 'qualification', 'experience_years', 'consultation_fee', 'license_no', 'bio', 'rating', 'available_days', 'status'], doctors);
  const doctorsByDept = {};
  doctorDefs.forEach((d, i) => { (doctorsByDept[d[2]] = doctorsByDept[d[2]] || []).push(i + 1); });

  // -------------------------------------------------------------------- staff
  const staffDefs = [
    ['Grace Thompson', 'Head Nurse', 'General Medicine', 'morning', 'female', 8], ['Marcus Bell', 'ICU Nurse', 'Emergency Medicine', 'night', 'male', 11],
    ['Sunita Rao', 'Staff Nurse', 'Cardiology', 'morning', 'female', 51], ['Tyler Brooks', 'Lab Technician', 'Radiology', 'morning', 'male', 41],
    ['Chloe Dubois', 'Pharmacist', 'General Medicine', 'evening', 'female', 36], ['Ravi Shankar', 'Radiographer', 'Radiology', 'evening', 'male', 54],
    ['Isabel Cruz', 'Staff Nurse', 'Pediatrics', 'morning', 'female', 72], ['Kenji Tanaka', 'Anesthesia Technician', 'Surgery', 'morning', 'male', 29],
    ['Amara Okoye', 'Staff Nurse', 'Neurology', 'evening', 'female', 59], ['Peter Novak', 'Security Supervisor', null, 'night', 'male', 70],
    ['Leah Goldberg', 'Physiotherapist', 'Orthopedics', 'morning', 'female', 83], ['Victor Alvarez', 'Ambulance Driver', 'Emergency Medicine', 'night', 'male', 18],
    ['Daniel Foster', 'Receptionist', null, 'morning', 'male', 22], ['Maya Singh', 'Receptionist', null, 'evening', 'female', 17],
  ];
  const staff = staffDefs.map((d, i) => [
    i + 1, d[1] === 'Receptionist' ? (d[0] === 'Daniel Foster' ? 2 : 3) : null, d[0], d[1], d[2] ? deptId[d[2]] : null,
    `${d[0].toLowerCase().replace(/[^a-z]+/g, '.')}@medicore.com`, `+1 555 03${p2(i)}`, d[3], i === 6 ? 'on_leave' : 'active',
    fmtDate(ago(ri(200, 2400))), portrait(d[4], d[5]),
  ]);
  await bulk('staff', ['id', 'user_id', 'name', 'designation', 'department_id', 'email', 'phone', 'shift', 'status', 'joined_on', 'avatar_url'], staff);

  // ---------------------------------------------------------------- medicines
  const medDefs = [
    // name, generic, category, manufacturer, unit, price, qty, reorder, expiryDays
    ['Amlodipine', 'Amlodipine besylate', 'Cardiovascular', 'Pfizer', 'tablets', 0.35, 1800, 300, 520],
    ['Losartan', 'Losartan potassium', 'Cardiovascular', 'Merck', 'tablets', 0.42, 1250, 300, 610],
    ['Metoprolol', 'Metoprolol tartrate', 'Cardiovascular', 'AstraZeneca', 'tablets', 0.3, 90, 250, 400],
    ['Furosemide', 'Furosemide', 'Cardiovascular', 'Sanofi', 'tablets', 0.2, 760, 200, 480],
    ['Atorvastatin', 'Atorvastatin calcium', 'Cardiovascular', 'Pfizer', 'tablets', 0.55, 1420, 300, 700],
    ['Clopidogrel', 'Clopidogrel bisulfate', 'Cardiovascular', 'Sanofi', 'tablets', 0.62, 640, 200, 365],
    ['Aspirin', 'Acetylsalicylic acid', 'Cardiovascular', 'Bayer', 'tablets', 0.1, 2400, 500, 560],
    ['Enoxaparin', 'Enoxaparin sodium', 'Anticoagulant', 'Sanofi', 'syringes', 6.8, 140, 60, 300],
    ['Heparin', 'Heparin sodium', 'Anticoagulant', 'Pfizer', 'vials', 4.2, 36, 50, 45],
    ['Metformin', 'Metformin HCl', 'Antidiabetic', 'Merck', 'tablets', 0.18, 2100, 500, 640],
    ['Glimepiride', 'Glimepiride', 'Antidiabetic', 'Sanofi', 'tablets', 0.4, 480, 150, 420],
    ['Insulin Glargine', 'Insulin glargine', 'Antidiabetic', 'Sanofi', 'pens', 24.5, 58, 40, 150],
    ['Azithromycin', 'Azithromycin dihydrate', 'Antibiotic', 'Pfizer', 'tablets', 1.1, 560, 200, 330],
    ['Amoxicillin-Clavulanate', 'Co-amoxiclav', 'Antibiotic', 'GSK', 'tablets', 0.95, 25, 200, 270],
    ['Ceftriaxone', 'Ceftriaxone sodium', 'Antibiotic', 'Roche', 'vials', 2.9, 420, 150, 390],
    ['Ciprofloxacin', 'Ciprofloxacin HCl', 'Antibiotic', 'Bayer', 'tablets', 0.5, 940, 250, 28],
    ['Doxycycline', 'Doxycycline hyclate', 'Antibiotic', 'Pfizer', 'capsules', 0.4, 720, 200, 460],
    ['Paracetamol', 'Acetaminophen', 'Analgesic', 'GSK', 'tablets', 0.05, 5200, 1000, 600],
    ['Ibuprofen', 'Ibuprofen', 'Analgesic', 'Reckitt', 'tablets', 0.12, 1900, 500, 520],
    ['Naproxen', 'Naproxen sodium', 'Analgesic', 'Bayer', 'tablets', 0.22, 840, 300, 410],
    ['Diclofenac', 'Diclofenac sodium', 'Analgesic', 'Novartis', 'tablets', 0.2, 0, 300, 380],
    ['Tramadol', 'Tramadol HCl', 'Analgesic', 'Grunenthal', 'capsules', 0.7, 330, 150, 340],
    ['Morphine', 'Morphine sulfate', 'Analgesic', 'Fresenius', 'ampoules', 3.4, 74, 60, 260],
    ['Sumatriptan', 'Sumatriptan succinate', 'Neurological', 'GSK', 'tablets', 2.2, 180, 80, 500],
    ['Lorazepam', 'Lorazepam', 'Neurological', 'Pfizer', 'tablets', 0.8, 210, 100, 220],
    ['Omeprazole', 'Omeprazole', 'Gastrointestinal', 'AstraZeneca', 'capsules', 0.28, 1500, 400, 580],
    ['Pantoprazole', 'Pantoprazole sodium', 'Gastrointestinal', 'Takeda', 'tablets', 0.33, 1120, 300, 460],
    ['Ondansetron', 'Ondansetron HCl', 'Gastrointestinal', 'Novartis', 'tablets', 0.6, 380, 150, 90],
    ['ORS Sachet', 'Oral rehydration salts', 'Gastrointestinal', 'WHO-Std', 'sachets', 0.25, 2600, 600, 720],
    ['Salbutamol Inhaler', 'Salbutamol sulfate', 'Respiratory', 'GSK', 'inhalers', 5.6, 20, 80, 420],
    ['Prednisolone', 'Prednisolone', 'Respiratory', 'Pfizer', 'tablets', 0.3, 640, 200, 350],
    ['Cetirizine', 'Cetirizine HCl', 'Respiratory', 'UCB', 'tablets', 0.1, 1700, 400, 650],
    ['Dexamethasone', 'Dexamethasone', 'Corticosteroid', 'Fresenius', 'vials', 1.9, 310, 120, 200],
    ['Hydrocortisone', 'Hydrocortisone sodium', 'Corticosteroid', 'Pfizer', 'vials', 3.1, 150, 80, -12],
    ['Epinephrine', 'Epinephrine', 'Emergency', 'Hospira', 'ampoules', 8.5, 96, 80, 240],
    ['Normal Saline 0.9%', 'Sodium chloride', 'IV Fluids', 'Baxter', 'bags', 1.4, 880, 300, 540],
    ['Ringer\'s Lactate', 'Lactated Ringer\'s', 'IV Fluids', 'Baxter', 'bags', 1.7, 460, 250, 500],
    ['Vitamin D3', 'Cholecalciferol', 'Supplement', 'Abbott', 'capsules', 0.15, 2300, 400, 680],
    ['Ferrous Sulfate', 'Iron(II) sulfate', 'Supplement', 'Abbott', 'tablets', 0.08, 55, 300, 75],
    ['Calcium Carbonate', 'Calcium carbonate', 'Supplement', 'Abbott', 'tablets', 0.09, 1980, 400, 610],
  ];
  const medicines = medDefs.map((m, i) => [i + 1, m[0], m[1], m[2], m[3], `B${ri(24, 26)}${String.fromCharCode(65 + ri(0, 25))}${ri(100, 999)}`, m[6], m[7], m[4], m[5], fmtDate(ago(-m[8]))]);
  await bulk('medicines', ['id', 'name', 'generic_name', 'category', 'manufacturer', 'batch_no', 'quantity', 'reorder_level', 'unit', 'unit_price', 'expiry_date'], medicines);
  const medId = Object.fromEntries(medDefs.map((m, i) => [m[0], i + 1]));

  // ----------------------------------------------------------------- diagnoses
  const DX = [
    { n: 'Hypertension', dept: 'Cardiology', cc: 'Persistent headache and dizziness', tx: 'Lifestyle modification, low-sodium diet and antihypertensive therapy.', bp: [152, 96], hr: 78, t: 36.7, o2: 98, meds: ['Amlodipine', 'Losartan'], cond: 'Hypertension', w: 4, min: 35 },
    { n: 'Type 2 Diabetes Mellitus', dept: 'General Medicine', cc: 'Increased thirst, fatigue, blurred vision', tx: 'Glycaemic control, dietary counselling and HbA1c monitoring.', bp: [132, 84], hr: 80, t: 36.8, o2: 98, meds: ['Metformin', 'Glimepiride'], cond: 'Type 2 Diabetes', w: 4, min: 30 },
    { n: 'Community-acquired Pneumonia', dept: 'General Medicine', cc: 'Fever, productive cough, shortness of breath', tx: 'Antibiotic therapy, oxygen support and chest physiotherapy.', bp: [118, 76], hr: 98, t: 38.7, o2: 92, meds: ['Azithromycin', 'Amoxicillin-Clavulanate', 'Paracetamol'], cond: null, w: 3, icu: true },
    { n: 'Acute Coronary Syndrome', dept: 'Cardiology', cc: 'Chest pain radiating to the left arm', tx: 'Dual antiplatelet therapy, statin and cath-lab evaluation.', bp: [142, 90], hr: 104, t: 36.9, o2: 95, meds: ['Aspirin', 'Atorvastatin', 'Clopidogrel'], cond: 'Coronary Artery Disease', w: 3, icu: true, min: 42 },
    { n: 'Congestive Heart Failure', dept: 'Cardiology', cc: 'Swollen ankles and breathlessness on exertion', tx: 'Diuretic therapy, fluid restriction and daily weights.', bp: [128, 82], hr: 90, t: 36.6, o2: 93, meds: ['Furosemide', 'Losartan', 'Metoprolol'], cond: 'Heart Failure', w: 2, icu: true, min: 50 },
    { n: 'Fractured Femur', dept: 'Orthopedics', cc: 'Severe hip pain following a fall', tx: 'Surgical fixation followed by structured physiotherapy.', bp: [124, 80], hr: 92, t: 37.1, o2: 97, meds: ['Tramadol', 'Paracetamol', 'Enoxaparin'], cond: null, w: 2, min: 16 },
    { n: 'Migraine with Aura', dept: 'Neurology', cc: 'Recurrent throbbing headache with visual aura', tx: 'Abortive therapy, trigger avoidance and sleep hygiene.', bp: [122, 78], hr: 74, t: 36.6, o2: 99, meds: ['Sumatriptan', 'Naproxen'], cond: 'Chronic Migraine', w: 2, min: 14 },
    { n: 'Ischemic Stroke', dept: 'Neurology', cc: 'Sudden weakness on the left side and slurred speech', tx: 'Thrombolysis evaluation, antiplatelets and rehabilitation.', bp: [168, 100], hr: 86, t: 36.8, o2: 96, meds: ['Aspirin', 'Atorvastatin', 'Clopidogrel'], cond: 'Prior Stroke', w: 2, icu: true, min: 45 },
    { n: 'Asthma Exacerbation', dept: 'General Medicine', kid: 'Pediatrics', cc: 'Wheezing and difficulty breathing', tx: 'Nebulised bronchodilators and short oral steroid course.', bp: [116, 74], hr: 102, t: 37.0, o2: 93, meds: ['Salbutamol Inhaler', 'Prednisolone'], cond: 'Asthma', w: 3 },
    { n: 'Acute Gastroenteritis', dept: 'General Medicine', kid: 'Pediatrics', cc: 'Vomiting, diarrhoea and abdominal cramps', tx: 'Oral rehydration, antiemetics and a bland diet.', bp: [110, 70], hr: 96, t: 37.8, o2: 98, meds: ['ORS Sachet', 'Ondansetron'], cond: null, w: 3 },
    { n: 'Acute Appendicitis', dept: 'Surgery', cc: 'Right lower abdominal pain with nausea', tx: 'Laparoscopic appendectomy and post-operative antibiotics.', bp: [120, 78], hr: 100, t: 38.2, o2: 98, meds: ['Ceftriaxone', 'Paracetamol'], cond: null, w: 2 },
    { n: 'Urinary Tract Infection', dept: 'General Medicine', cc: 'Burning micturition and urinary frequency', tx: 'Targeted antibiotics and increased fluid intake.', bp: [118, 76], hr: 82, t: 37.6, o2: 98, meds: ['Ciprofloxacin', 'Paracetamol'], cond: null, w: 2 },
  ];
  const wdx = DX.flatMap((d) => Array(d.w).fill(d));
  const dxForAge = (age) => (age < 14 ? pick(DX.filter((d) => d.kid)) : pick(wdx.filter((d) => (d.min || 0) <= age)));
  const docForDx = (dx, age) => {
    const dept = age < 14 && dx.kid ? dx.kid : dx.dept;
    if (dept === 'Cardiology' && chance(0.7)) return 1;
    return pick(doctorsByDept[dept]);
  };

  // ----------------------------------------------------------------- patients
  const mFirst = ['Liam', 'Noah', 'Oliver', 'Ethan', 'Aarav', 'Vikram', 'Rohan', 'Mateo', 'Lucas', 'Henry', 'Samuel', 'Daniel', 'Kabir', 'Ibrahim', 'Carlos', 'Ryan', 'Nathan', 'Adrian', 'Tariq', 'Jonathan', 'Arthur', 'Felix', 'Hugo', 'Sebastian'];
  const fFirst = ['Olivia', 'Emma', 'Ava', 'Sophia', 'Isabella', 'Mia', 'Ananya', 'Kavya', 'Meera', 'Sara', 'Chloe', 'Grace', 'Fatima', 'Elena', 'Hannah', 'Zoe', 'Nadia', 'Lily', 'Anika', 'Rachel', 'Nora', 'Camila', 'Ruth', 'Ingrid'];
  const lasts = ['Johnson', 'Williams', 'Brown', 'Patel', 'Sharma', 'Garcia', 'Miller', 'Davis', 'Kumar', 'Singh', 'Lopez', 'Wilson', 'Taylor', 'Khan', 'Moore', 'Thomas', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young', 'Allen', 'Reddy', 'Gupta', 'Iyer', 'Nguyen', 'Kim', 'Rossi', 'Schmidt', 'Silva', 'Costa', 'Morgan', 'Bennett'];
  const cities = ['Boston', 'Austin', 'Seattle', 'Denver', 'Chicago', 'Phoenix', 'Portland', 'Atlanta'];
  const streets = ['Maple Ave', 'Oak Street', 'Cedar Lane', 'Willow Road', 'Sunset Blvd', 'Lakeview Dr', 'Park Avenue', 'Highland Rd'];
  const insurers = ['BlueShield Health', 'Aetna Care', 'UnitedCare', 'Cigna Plus', 'MediTrust', 'HealthFirst', null];
  const allergies = [null, null, null, 'Penicillin', 'Peanuts', 'Sulfa drugs', 'Latex', 'Penicillin, Ibuprofen', 'Shellfish', 'Pollen, Dust mites'];
  const used = new Set();
  const patients = [];
  const patientMeta = [];
  const PCOUNT = 96;
  for (let i = 1; i <= PCOUNT; i++) {
    const gender = chance(0.5) ? 'female' : 'male';
    let first, last, key;
    do { first = pick(gender === 'female' ? fFirst : mFirst); last = pick(lasts); key = first + last; } while (used.has(key));
    used.add(key);
    const age = chance(0.14) ? ri(1, 13) : chance(0.55) ? ri(30, 79) : ri(14, 29);
    const dob = ago(age * 365 + ri(0, 364));
    const dx = dxForAge(age);
    const docId = docForDx(dx, age);
    const createdAt = ago(i > 90 ? 0 : ri(0, 75), ri(8, 17), ri(0, 59));
    const adult = age >= 18;
    patientMeta.push({ id: i, age, dx, docId, gender, wt: age < 14 ? 10 + age * 2.7 : ri(52, 96) });
    patients.push([
      i, `MC-${NOW.getFullYear()}-${String(i).padStart(5, '0')}`, first, last, fmtDate(dob), gender, pick(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O+', 'O-']),
      `+1 555 ${String(ri(1000, 9999))}`, `${first}.${last}${ri(1, 99)}@mail.com`.toLowerCase(), `${ri(10, 999)} ${pick(streets)}`, pick(cities),
      `${pick(adult ? (gender === 'female' ? mFirst : fFirst) : fFirst)} ${last}`, `+1 555 ${String(ri(1000, 9999))}`,
      pick(allergies), dx.cond && adult ? dx.cond : null, pick(insurers), `INS-${ri(100000, 999999)}`,
      age < 18 ? null : portrait(gender, ri(1, 95)), docId, 2, fmt(createdAt),
    ]);
  }
  await bulk('patients', ['id', 'patient_code', 'first_name', 'last_name', 'dob', 'gender', 'blood_group', 'phone', 'email', 'address', 'city', 'emergency_contact_name', 'emergency_contact_phone', 'allergies', 'chronic_conditions', 'insurance_provider', 'insurance_no', 'photo_url', 'assigned_doctor_id', 'created_by', 'created_at'], patients);

  // ------------------------------------------------------------ wards & beds
  const wardDefs = [
    ['Med-Surg', 'general', 'Floor 2', 'General medical and surgical inpatients', U('1538108149393-fbbd81895907'), 'MS-', 101, 24, 'standard', 120],
    ['Telemetry', 'cardiac', 'Floor 3', 'Continuous cardiac monitoring unit', U('1631815588090-d4bfec5b1ccb'), 'TL-', 201, 16, 'standard', 210],
    ['ICU', 'icu', 'Floor 4', 'Intensive care unit with 1:1 nursing', U('1551076805-e1869033e561'), 'ICU-', 1, 12, 'icu', 650],
    ['Emergency', 'emergency', 'Ground', 'Emergency department observation bays', U('1551601651-2a8555f1a136'), 'ER-', 1, 12, 'standard', 180],
    ['Private Suites', 'private', 'Floor 5', 'Premium single-occupancy recovery suites', U('1519494026892-80bbd2d6fd0d'), 'PS-', 501, 8, 'private', 320],
  ];
  const wards = wardDefs.map((w, i) => [i + 1, w[0], w[1], w[2], w[3], w[4]]);
  await bulk('wards', ['id', 'name', 'type', 'floor', 'description', 'image_url'], wards);
  // (beds are inserted once occupancy has been decided - see below)
  const beds = [];
  wardDefs.forEach((w, wi) => {
    for (let k = 0; k < w[7]; k++) {
      const num = w[5] === 'ICU-' || w[5] === 'ER-' ? p2(w[6] + k) : String(w[6] + k);
      beds.push({ id: beds.length + 1, ward: wi + 1, wname: w[0], num: `${w[5]}${num}`, type: k % 7 === 6 && w[2] !== 'Ground' ? 'isolation' : w[8], rate: k % 7 === 6 ? 400 : w[9], status: 'available' });
    }
  });
  // maintenance beds
  shuffle(beds).slice(0, 6).forEach((b) => { b.status = 'maintenance'; b.note = pick(['Deep cleaning in progress', 'Oxygen outlet repair', 'Mattress replacement', 'Monitor calibration', 'Terminal disinfection']); });

  // -------------------------------------------------------------- admissions
  const occupancy = { 'Med-Surg': 0.66, Telemetry: 0.72, ICU: 0.9, Emergency: 0.75, 'Private Suites': 0.5 };
  const pool = shuffle(patientMeta.filter((p) => p.age >= 3));
  const takePatient = (pred) => { const i = pool.findIndex(pred); return pool.splice(i >= 0 ? i : 0, 1)[0]; };
  const admissions = [];
  const records = [];
  const rec = (patient, doctorId, when, type, dx, extra = {}) => {
    const dxd = dx;
    const worse = extra.worse ?? 0;
    records.push([
      records.length + 1, patient.id, doctorId, fmt(when), type, dxd.cc, dxd.n, dxd.tx, extra.notes || null,
      Math.round(dxd.bp[0] + ri(-6, 6) + worse * 4), Math.round(dxd.bp[1] + ri(-4, 4) + worse * 2), Math.round(dxd.hr + ri(-6, 6) + worse * 2),
      (dxd.t + (rnd() - 0.5) * 0.6).toFixed(1), Math.min(100, Math.max(86, dxd.o2 + ri(-1, 2))), +(patient.wt + (rnd() - 0.5) * 2).toFixed(1),
      extra.followUp || null,
    ]);
  };
  const activeByPatient = new Set();
  const addAdmission = (bed, patient, whenAdmitted, status, dischargedAt) => {
    admissions.push([
      admissions.length + 1, patient.id, bed.id, patient.docId, fmt(whenAdmitted), dischargedAt ? fmt(dischargedAt) : null,
      patient.dx.cc.split(',')[0], status, dischargedAt ? pick(['Recovered well. Follow-up in 2 weeks.', 'Stable at discharge; oral medication continued.', 'Discharged with home-care instructions.']) : null, pick([2, 3]), dischargedAt ? pick([2, 3]) : null,
    ]);
  };
  beds.forEach((b) => {
    if (b.status === 'maintenance') return;
    if (!chance(occupancy[b.wname])) return;
    const icuWard = b.wname === 'ICU';
    const pat = takePatient((p) => (icuWard ? p.dx.icu : b.wname === 'Telemetry' ? p.dx.dept === 'Cardiology' : true));
    if (!pat) return;
    b.status = 'occupied';
    activeByPatient.add(pat.id);
    const days = icuWard ? ri(0, 6) : ri(0, 8);
    const when = days === 0 ? new Date(NOW.getTime() - ri(1, 9) * 3600e3) : ago(days, ri(6, 22), ri(0, 59));
    addAdmission(b, pat, when, 'admitted', null);
    rec(pat, pat.docId, when, 'Inpatient', pat.dx, { notes: 'Admitted for observation and treatment.', worse: 1 });
  });
  // historical (discharged) admissions for charts
  for (let n = 0; n < 150; n++) {
    const d = ri(1, 30);
    const los = ri(1, 7);
    const adm = ago(d, ri(5, 22), ri(0, 59));
    const dis = new Date(adm.getTime() + los * 86400e3 - ri(0, 5) * 3600e3);
    if (dis > NOW) continue;
    const pat = pick(patientMeta.filter((p) => p.age >= 3));
    addAdmission(pick(beds), pat, adm, 'discharged', dis);
  }

  // ----------------------------------------------------- appointments (tmp)
  const appts = [];
  const slotUsed = new Set();
  const patsByDoc = {};
  patientMeta.forEach((p) => { (patsByDoc[p.docId] = patsByDoc[p.docId] || []).push(p); });
  const addAppt = (docId, dayOff, slot, forceStatus) => {
    const key = `${docId}-${dayOff}-${slot}`;
    if (slotUsed.has(key)) return;
    slotUsed.add(key);
    const when = new Date(NOW); when.setDate(when.getDate() + dayOff); when.setHours(9 + Math.floor(slot / 2), (slot % 2) * 30, 0, 0);
    const pats = patsByDoc[docId] && patsByDoc[docId].length && chance(0.85) ? patsByDoc[docId] : patientMeta;
    const pat = pick(pats);
    const diffMin = (when - NOW) / 60000;
    let status = forceStatus;
    if (!status) {
      if (diffMin < -40) status = chance(0.84) ? 'completed' : chance(0.5) ? 'no_show' : 'cancelled';
      else if (diffMin < 10) status = 'checked_in';
      else status = chance(0.92) ? 'scheduled' : 'cancelled';
    }
    const type = pick(['consultation', 'consultation', 'consultation', 'follow_up', 'follow_up', 'checkup', 'procedure']);
    appts.push([appts.length + 1, pat.id, docId, fmt(when), pick([20, 30, 30, 45]), type, status, pick([pat.dx.cc, 'Routine follow-up', 'Review of lab results', 'Annual health checkup', 'Medication review']), pick([2, 3]), fmt(new Date(when.getTime() - ri(1, 8) * 86400e3))]);
  };
  for (let dayOff = -14; dayOff <= 7; dayOff++) {
    const dow = new Date(NOW.getTime() + dayOff * 86400e3).getDay();
    for (let docId = 1; docId <= doctorDefs.length; docId++) {
      if (docId === 9) continue; // on leave
      const n = dayOff === 0 ? ri(2, 4) : dow === 0 ? ri(0, 1) : ri(1, 4);
      const slots = shuffle([...Array(16).keys()]).slice(0, n);
      slots.forEach((sl) => addAppt(docId, dayOff, sl));
    }
  }
  // make the demo doctor's day nice & dense
  [1, 3, 4, 6, 8, 11, 13].forEach((sl) => addAppt(1, 0, sl));
  appts.forEach((a, i) => { a[0] = i + 1; });

  // ------------------------------------------------ outpatient medical records
  patientMeta.forEach((p) => {
    const n = ri(3, 5);
    let day = ri(1, 40);
    for (let k = 0; k < n; k++) {
      const dx = k === 0 || chance(0.75) ? p.dx : pick(DX);
      rec(p, chance(0.85) ? p.docId : pick(doctorsByDept[dx.dept]), ago(day, ri(9, 16), ri(0, 59)), pick(['Outpatient', 'Outpatient', 'Follow-up', 'Checkup']), dx, {
        worse: k * 0.7, notes: pick(['Patient counselled on medication adherence.', 'Vitals stable; continue current plan.', 'Advised to follow up if symptoms worsen.', 'Lab work ordered; review next visit.']),
        followUp: chance(0.5) ? fmtDate(ago(-ri(7, 45))) : null,
      });
      day += ri(25, 90);
    }
  });
  records.forEach((r, i) => { r[0] = i + 1; });

  await bulk('beds', ['id', 'ward_id', 'bed_number', 'bed_type', 'status', 'daily_rate', 'notes'], beds.map((b) => [b.id, b.ward, b.num, b.type, b.status, b.rate, b.note || null]));
  await bulk('appointments', ['id', 'patient_id', 'doctor_id', 'scheduled_at', 'duration_min', 'type', 'status', 'reason', 'created_by', 'created_at'], appts);
  await bulk('admissions', ['id', 'patient_id', 'bed_id', 'doctor_id', 'admitted_at', 'discharged_at', 'reason', 'status', 'discharge_notes', 'admitted_by', 'discharged_by'], admissions);
  await bulk('medical_records', ['id', 'patient_id', 'doctor_id', 'visit_date', 'visit_type', 'chief_complaint', 'diagnosis', 'treatment', 'notes', 'bp_systolic', 'bp_diastolic', 'heart_rate', 'temperature', 'spo2', 'weight_kg', 'follow_up_date'], records);

  // ---------------------------------------------------------- prescriptions
  const rxs = []; const items = [];
  const dosages = ['5 mg', '10 mg', '20 mg', '40 mg', '250 mg', '500 mg', '1 tablet', '2 puffs'];
  const freqs = ['Once daily', 'Twice daily', 'Three times daily', 'At bedtime', 'Every 8 hours', 'As needed'];
  const notes = ['After meals', 'Before meals', 'Take with plenty of water', 'Avoid alcohol', 'Complete the full course', null];
  records.forEach((r) => {
    if (!chance(0.62)) return;
    const pm = patientMeta[r[1] - 1];
    const dx = DX.find((d) => d.n === r[6]) || pm.dx;
    const id = rxs.length + 1;
    const recent = (NOW - new Date(r[3].replace(' ', 'T'))) / 86400e3 < 20;
    rxs.push([id, r[1], r[2], r[0], pick(['Review after the course', 'Return if symptoms persist', null]), recent ? 'active' : 'completed', r[3]]);
    shuffle(dx.meds).slice(0, ri(1, Math.min(3, dx.meds.length))).forEach((m) => {
      items.push([items.length + 1, id, medId[m], m, pick(dosages), pick(freqs), pick([5, 7, 10, 14, 30]), pick(notes)]);
    });
  });
  await bulk('prescriptions', ['id', 'patient_id', 'doctor_id', 'record_id', 'notes', 'status', 'created_at'], rxs);
  await bulk('prescription_items', ['id', 'prescription_id', 'medicine_id', 'medicine_name', 'dosage', 'frequency', 'duration_days', 'instructions'], items);

  // --------------------------------------------------------------- emergency
  const emgDefs = [
    ['Marcus Reed', 34, 'male', 'Road traffic accident - suspected internal bleeding and leg fracture', 'critical', 'in_treatment', 'ambulance', 6, 0.4],
    ['Linda Park', 61, 'female', 'Severe chest pain with sweating, suspected myocardial infarction', 'critical', 'in_treatment', 'ambulance', 1, 1.1],
    ['Baby Anaya Sharma', 2, 'female', 'High fever with febrile seizure, now stable', 'high', 'pending', 'walk_in', 3, 0.25],
    ['Robert Hughes', 72, 'male', 'Sudden speech difficulty and facial droop - stroke protocol', 'critical', 'pending', 'ambulance', 2, 0.15],
    ['Carla Mendes', 27, 'female', 'Severe asthma attack, poor response to inhaler', 'high', 'in_treatment', 'walk_in', 7, 2.3],
    ['Tom Fischer', 45, 'male', 'Deep laceration on forearm from workshop accident', 'medium', 'resolved', 'walk_in', 12, 9],
    ['Yusuf Ali', 19, 'male', 'Sports injury - suspected ankle ligament tear', 'low', 'resolved', 'walk_in', 4, 26],
    ['Helen Zhou', 55, 'female', 'Acute abdominal pain, possible appendicitis', 'high', 'admitted', 'referral', 8, 30],
    ['Samuel Ortiz', 38, 'male', 'Accidental ingestion of cleaning fluid', 'high', 'resolved', 'ambulance', 6, 52],
    ['Nina Petrova', 29, 'female', 'Allergic reaction with facial swelling', 'medium', 'resolved', 'walk_in', 7, 70],
  ];
  const emg = emgDefs.map((e, i) => [i + 1, `EMR-${String(1001 + i)}`, e[0], e[1], e[2], `+1 555 ${ri(1000, 9999)}`, e[3], e[4], e[5], e[6], e[7], 2, fmt(new Date(NOW.getTime() - e[8] * 3600e3)), e[5] === 'resolved' ? fmt(new Date(NOW.getTime() - e[8] * 3600e3 + 2.5 * 3600e3)) : null]);
  await bulk('emergency_requests', ['id', 'request_code', 'patient_name', 'age', 'gender', 'phone', 'condition_desc', 'urgency', 'status', 'arrival_mode', 'assigned_doctor_id', 'created_by', 'created_at', 'resolved_at'], emg);

  // ------------------------------------------------------------------- audit
  const audit = [];
  const ips = ['10.0.4.21', '10.0.4.35', '10.0.5.12', '192.168.1.14', '10.0.4.77'];
  const uinfo = (id) => users.find((u) => u[0] === id);
  const A = (when, uid, action, entity, eid, desc, sev = 'info', ip) => {
    if (when > NOW) return; // never seed events from the future
    const u = uid ? uinfo(uid) : null;
    audit.push([fmt(when), uid, u ? u[1] : 'Anonymous', u ? u[4] : null, action, entity, eid ? String(eid) : null, desc, sev, ip || pick(ips), 'Mozilla/5.0 (Windows NT 10.0) Chrome/126']);
  };
  for (let d = 14; d >= 0; d--) {
    [1, 2, 3, ...Array.from({ length: 12 }, (_, i) => 4 + i)].forEach((uid) => {
      if (uid > 3 && !chance(0.55)) return;
      if (uid === 3 && chance(0.4)) return;
      const hr = ri(7, 10);
      A(ago(d, hr, ri(0, 59)), uid, 'LOGIN', 'auth', uid, `${uinfo(uid)[1]} signed in successfully`);
      if (d > 0 || hr < 12) A(ago(d, ri(16, 19), ri(0, 59)), uid, 'LOGOUT', 'auth', uid, `${uinfo(uid)[1]} signed out`);
    });
    const pid = () => ri(1, PCOUNT);
    for (let k = 0; k < ri(2, 5); k++) {
      const p = pid(); const pr = patients[p - 1];
      A(ago(d, ri(8, 17), ri(0, 59)), pick([2, 3]), 'PATIENT_UPDATED', 'patient', p, `Updated record of ${pr[2]} ${pr[3]} (${pr[1]})`);
    }
    for (let k = 0; k < ri(2, 4); k++) { const p = ri(1, PCOUNT); A(ago(d, ri(8, 17), ri(0, 59)), pick([2, 3]), 'APPOINTMENT_CREATED', 'appointment', ri(1, 200), `Scheduled appointment for ${patients[p - 1][1]}`); }
    for (let k = 0; k < ri(1, 3); k++) { const p = pid(); A(ago(d, ri(8, 17), ri(0, 59)), pick([2, 3]), 'PATIENT_CREATED', 'patient', p, `Registered new patient ${patients[p - 1][2]} ${patients[p - 1][3]}`); }
    for (let k = 0; k < ri(1, 4); k++) { const p = pid(); A(ago(d, ri(8, 17), ri(0, 59)), 4 + ri(0, 11), pick(['PATIENT_VIEWED', 'PATIENT_VIEWED', 'RECORD_CREATED', 'PRESCRIPTION_CREATED']), 'patient', p, `Clinical activity on ${patients[p - 1][1]}`); }
    A(ago(d, ri(9, 15), ri(0, 59)), pick([2, 3]), 'BED_ALLOCATED', 'bed', ri(1, 72), 'Allocated bed to admitted patient');
    if (chance(0.7)) A(ago(d, ri(10, 17), ri(0, 59)), pick([2, 3]), 'BED_DISCHARGED', 'bed', ri(1, 72), 'Patient discharged and bed released');
    if (chance(0.5)) A(ago(d, ri(9, 16), ri(0, 59)), 1, pick(['MEDICINE_UPDATED', 'MEDICINE_STOCK_ADJUSTED']), 'medicine', ri(1, 40), 'Inventory adjusted by administrator');
    if (chance(0.25)) A(ago(d, ri(9, 16), ri(0, 59)), pick([2, 3]), 'ACCESS_DENIED', 'security', null, 'Attempted to open an admin-only resource (/api/audit)', 'warning');
    if (chance(0.3)) A(ago(d, ri(1, 23), ri(0, 59)), null, 'LOGIN_FAILED', 'auth', null, `Failed login for ${pick(['admin@medicore.com', 'dr.smith@medicore.com', 'reception@medicore.com', 'test@test.com'])} - invalid password`, 'warning', `203.0.113.${ri(2, 90)}`);
  }
  // suspicious burst (brute-force style) yesterday night
  for (let k = 0; k < 8; k++) A(new Date(ago(1, 2, 14).getTime() + k * 31000), null, 'LOGIN_FAILED', 'auth', null, 'Failed login for admin@medicore.com - invalid password', k > 5 ? 'critical' : 'warning', '198.51.100.23');
  A(ago(5, 11, 20), 1, 'DOCTOR_CREATED', 'doctor', 12, 'Created doctor profile for Omar Haddad');
  A(ago(6, 14, 5), 1, 'PATIENT_DELETED', 'patient', 999, 'Deleted duplicate patient record (MC-DUP-0042)', 'critical');
  A(ago(3, 10, 40), 1, 'PASSWORD_CHANGED', 'auth', 1, 'Administrator changed account password', 'warning');
  audit.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  await bulk('audit_logs', ['created_at', 'user_id', 'user_name', 'user_role', 'action', 'entity', 'entity_id', 'description', 'severity', 'ip_address', 'user_agent'], audit);

  console.log(`  users: ${users.length}, doctors: ${doctors.length}, patients: ${patients.length}, beds: ${beds.length}, admissions: ${admissions.length},`);
  console.log(`  appointments: ${appts.length}, records: ${records.length}, prescriptions: ${rxs.length}, medicines: ${medicines.length}, audit logs: ${audit.length}`);
  return { beds };
};
