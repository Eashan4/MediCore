-- =====================================================================
--  MediCore Hospital Management System - MySQL 8 schema
--  Usage (manual):  mysql -u root -p -e "CREATE DATABASE medicore CHARACTER SET utf8mb4"
--                   mysql -u root -p medicore < database/schema.sql
--  Or simply run:   npm run db:setup   (from /backend) - creates DB, schema and demo data.
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs, emergency_requests, prescription_items, prescriptions,
  medical_records, admissions, beds, wards, appointments, patients, staff, doctors,
  departments, medicines, users;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------- users
CREATE TABLE users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(150) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('admin','doctor','receptionist') NOT NULL,
  phone          VARCHAR(30) NULL,
  avatar_url     VARCHAR(500) NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at  DATETIME NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

-- ---------------------------------------------------------- departments
CREATE TABLE departments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(100) NOT NULL,
  description  TEXT NULL,
  image_url    VARCHAR(500) NULL,
  icon         VARCHAR(40) NULL,
  color        VARCHAR(20) NULL,
  floor        VARCHAR(20) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB;

-- -------------------------------------------------------------- doctors
CREATE TABLE doctors (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED NOT NULL,
  department_id     INT UNSIGNED NULL,
  specialization    VARCHAR(120) NOT NULL,
  qualification     VARCHAR(200) NULL,
  experience_years  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  consultation_fee  DECIMAL(10,2) NOT NULL DEFAULT 0,
  license_no        VARCHAR(60) NOT NULL,
  bio               TEXT NULL,
  rating            DECIMAL(2,1) NOT NULL DEFAULT 4.5,
  available_days    VARCHAR(60) NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  status            ENUM('active','on_leave','inactive') NOT NULL DEFAULT 'active',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doctors_user (user_id),
  UNIQUE KEY uq_doctors_license (license_no),
  KEY idx_doctors_department (department_id),
  CONSTRAINT fk_doctors_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_doctors_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- staff
CREATE TABLE staff (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NULL,
  name           VARCHAR(120) NOT NULL,
  designation    VARCHAR(80) NOT NULL,
  department_id  INT UNSIGNED NULL,
  email          VARCHAR(150) NULL,
  phone          VARCHAR(30) NULL,
  shift          ENUM('morning','evening','night') NOT NULL DEFAULT 'morning',
  status         ENUM('active','on_leave','inactive') NOT NULL DEFAULT 'active',
  joined_on      DATE NULL,
  avatar_url     VARCHAR(500) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_staff_department (department_id),
  CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_staff_department FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------- patients
CREATE TABLE patients (
  id                       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_code             VARCHAR(30) NOT NULL,
  first_name               VARCHAR(80) NOT NULL,
  last_name                VARCHAR(80) NOT NULL,
  dob                      DATE NOT NULL,
  gender                   ENUM('male','female','other') NOT NULL,
  blood_group              ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NULL,
  phone                    VARCHAR(30) NULL,
  email                    VARCHAR(150) NULL,
  address                  VARCHAR(255) NULL,
  city                     VARCHAR(80) NULL,
  emergency_contact_name   VARCHAR(120) NULL,
  emergency_contact_phone  VARCHAR(30) NULL,
  allergies                VARCHAR(500) NULL,
  chronic_conditions       VARCHAR(500) NULL,
  insurance_provider       VARCHAR(120) NULL,
  insurance_no             VARCHAR(60) NULL,
  photo_url                VARCHAR(500) NULL,
  assigned_doctor_id       INT UNSIGNED NULL,
  created_by               INT UNSIGNED NULL,
  created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patients_code (patient_code),
  KEY idx_patients_name (last_name, first_name),
  KEY idx_patients_phone (phone),
  KEY idx_patients_doctor (assigned_doctor_id),
  CONSTRAINT fk_patients_doctor FOREIGN KEY (assigned_doctor_id) REFERENCES doctors (id) ON DELETE SET NULL,
  CONSTRAINT fk_patients_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- --------------------------------------------------------- appointments
CREATE TABLE appointments (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id    INT UNSIGNED NOT NULL,
  doctor_id     INT UNSIGNED NOT NULL,
  scheduled_at  DATETIME NOT NULL,
  duration_min  SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  type          ENUM('consultation','follow_up','checkup','procedure','emergency') NOT NULL DEFAULT 'consultation',
  status        ENUM('scheduled','checked_in','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  reason        VARCHAR(255) NULL,
  notes         TEXT NULL,
  created_by    INT UNSIGNED NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appt_doctor_time (doctor_id, scheduled_at),
  KEY idx_appt_patient (patient_id),
  KEY idx_appt_time (scheduled_at),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE RESTRICT,
  CONSTRAINT fk_appt_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- wards
CREATE TABLE wards (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(80) NOT NULL,
  type        VARCHAR(40) NOT NULL DEFAULT 'general',
  floor       VARCHAR(20) NULL,
  description VARCHAR(255) NULL,
  image_url   VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wards_name (name)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------- beds
CREATE TABLE beds (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ward_id      INT UNSIGNED NOT NULL,
  bed_number   VARCHAR(20) NOT NULL,
  bed_type     ENUM('standard','icu','private','isolation') NOT NULL DEFAULT 'standard',
  status       ENUM('available','occupied','maintenance') NOT NULL DEFAULT 'available',
  daily_rate   DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes        VARCHAR(255) NULL,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_beds_ward_number (ward_id, bed_number),
  KEY idx_beds_status (status),
  CONSTRAINT fk_beds_ward FOREIGN KEY (ward_id) REFERENCES wards (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------- admissions
-- The two generated "active_*" columns plus UNIQUE keys make it impossible (at
-- database level) to have two active admissions on one bed or for one patient.
CREATE TABLE admissions (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id         INT UNSIGNED NOT NULL,
  bed_id             INT UNSIGNED NOT NULL,
  doctor_id          INT UNSIGNED NULL,
  admitted_at        DATETIME NOT NULL,
  discharged_at      DATETIME NULL,
  reason             VARCHAR(255) NULL,
  status             ENUM('admitted','discharged') NOT NULL DEFAULT 'admitted',
  discharge_notes    TEXT NULL,
  admitted_by        INT UNSIGNED NULL,
  discharged_by      INT UNSIGNED NULL,
  active_bed_key     INT UNSIGNED GENERATED ALWAYS AS (IF(status = 'admitted', bed_id, NULL)) STORED,
  active_patient_key INT UNSIGNED GENERATED ALWAYS AS (IF(status = 'admitted', patient_id, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_adm_active_bed (active_bed_key),
  UNIQUE KEY uq_adm_active_patient (active_patient_key),
  KEY idx_adm_patient (patient_id),
  KEY idx_adm_bed (bed_id),
  KEY idx_adm_doctor (doctor_id),
  KEY idx_adm_admitted (admitted_at),
  CONSTRAINT fk_adm_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_adm_bed FOREIGN KEY (bed_id) REFERENCES beds (id) ON DELETE RESTRICT,
  CONSTRAINT fk_adm_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE RESTRICT,
  CONSTRAINT fk_adm_admitter FOREIGN KEY (admitted_by) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_adm_discharger FOREIGN KEY (discharged_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------ medical_records
CREATE TABLE medical_records (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id       INT UNSIGNED NOT NULL,
  doctor_id        INT UNSIGNED NOT NULL,
  appointment_id   INT UNSIGNED NULL,
  visit_date       DATETIME NOT NULL,
  visit_type       VARCHAR(40) NOT NULL DEFAULT 'Outpatient',
  chief_complaint  VARCHAR(255) NULL,
  diagnosis        VARCHAR(255) NOT NULL,
  treatment        TEXT NULL,
  notes            TEXT NULL,
  bp_systolic      SMALLINT UNSIGNED NULL,
  bp_diastolic     SMALLINT UNSIGNED NULL,
  heart_rate       SMALLINT UNSIGNED NULL,
  temperature      DECIMAL(4,1) NULL,
  spo2             TINYINT UNSIGNED NULL,
  weight_kg        DECIMAL(5,1) NULL,
  follow_up_date   DATE NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rec_patient_date (patient_id, visit_date),
  KEY idx_rec_doctor (doctor_id),
  KEY idx_rec_diagnosis (diagnosis),
  CONSTRAINT fk_rec_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE RESTRICT,
  CONSTRAINT fk_rec_appt FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- -------------------------------------------------------------- medicines
CREATE TABLE medicines (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(120) NOT NULL,
  generic_name   VARCHAR(120) NULL,
  category       VARCHAR(60) NOT NULL DEFAULT 'General',
  manufacturer   VARCHAR(120) NULL,
  batch_no       VARCHAR(40) NULL,
  quantity       INT NOT NULL DEFAULT 0,
  reorder_level  INT NOT NULL DEFAULT 50,
  unit           VARCHAR(20) NOT NULL DEFAULT 'tablets',
  unit_price     DECIMAL(10,2) NOT NULL DEFAULT 0,
  expiry_date    DATE NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_med_name (name),
  KEY idx_med_category (category),
  KEY idx_med_expiry (expiry_date),
  CONSTRAINT chk_med_qty CHECK (quantity >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------- prescriptions
CREATE TABLE prescriptions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id  INT UNSIGNED NOT NULL,
  doctor_id   INT UNSIGNED NOT NULL,
  record_id   INT UNSIGNED NULL,
  notes       VARCHAR(500) NULL,
  status      ENUM('active','completed') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rx_patient (patient_id),
  KEY idx_rx_doctor (doctor_id),
  CONSTRAINT fk_rx_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
  CONSTRAINT fk_rx_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE RESTRICT,
  CONSTRAINT fk_rx_record FOREIGN KEY (record_id) REFERENCES medical_records (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE prescription_items (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  prescription_id  INT UNSIGNED NOT NULL,
  medicine_id      INT UNSIGNED NULL,
  medicine_name    VARCHAR(120) NOT NULL,
  dosage           VARCHAR(60) NOT NULL,
  frequency        VARCHAR(60) NOT NULL,
  duration_days    SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  instructions     VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_rxi_prescription (prescription_id),
  CONSTRAINT fk_rxi_rx FOREIGN KEY (prescription_id) REFERENCES prescriptions (id) ON DELETE CASCADE,
  CONSTRAINT fk_rxi_med FOREIGN KEY (medicine_id) REFERENCES medicines (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------ emergency_requests
CREATE TABLE emergency_requests (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_code        VARCHAR(20) NOT NULL,
  patient_id          INT UNSIGNED NULL,
  patient_name        VARCHAR(160) NOT NULL,
  age                 TINYINT UNSIGNED NULL,
  gender              ENUM('male','female','other') NOT NULL DEFAULT 'male',
  phone               VARCHAR(30) NULL,
  condition_desc      TEXT NOT NULL,
  urgency             ENUM('critical','high','medium','low') NOT NULL DEFAULT 'medium',
  status              ENUM('pending','in_treatment','admitted','resolved','cancelled') NOT NULL DEFAULT 'pending',
  arrival_mode        ENUM('ambulance','walk_in','referral') NOT NULL DEFAULT 'walk_in',
  assigned_doctor_id  INT UNSIGNED NULL,
  notes               VARCHAR(500) NULL,
  created_by          INT UNSIGNED NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at         DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emg_code (request_code),
  KEY idx_emg_status (status),
  KEY idx_emg_urgency (urgency),
  CONSTRAINT fk_emg_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE SET NULL,
  CONSTRAINT fk_emg_doctor FOREIGN KEY (assigned_doctor_id) REFERENCES doctors (id) ON DELETE SET NULL,
  CONSTRAINT fk_emg_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------ audit_logs
CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NULL,
  user_name    VARCHAR(120) NOT NULL DEFAULT 'Anonymous',
  user_role    VARCHAR(20) NULL,
  action       VARCHAR(60) NOT NULL,
  entity       VARCHAR(40) NULL,
  entity_id    VARCHAR(40) NULL,
  description  VARCHAR(500) NULL,
  severity     ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  ip_address   VARCHAR(64) NULL,
  user_agent   VARCHAR(255) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_created (created_at),
  KEY idx_audit_action (action),
  KEY idx_audit_user (user_id),
  KEY idx_audit_severity (severity),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;
