-- Database schema for Exam Vigilance Management

CREATE TABLE IF NOT EXISTS AuthorizedUsers ( 
   id SERIAL PRIMARY KEY, 
   email TEXT UNIQUE NOT NULL, 
   name TEXT, 
   role TEXT DEFAULT 'admin', 
   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() 
 );

CREATE TABLE IF NOT EXISTS teacher_roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject_group TEXT NOT NULL,
    subject TEXT NOT NULL,
    role TEXT REFERENCES teacher_roles(id),
    email TEXT UNIQUE,
    available BOOLEAN DEFAULT TRUE,
    EE BOOLEAN DEFAULT FALSE,
    PISO_ZERO BOOLEAN DEFAULT FALSE,
    unavailabilities JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    floor TEXT,
    priority INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  variant TEXT,
  subject_group TEXT NOT NULL,
  year TEXT NOT NULL,
  code TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  shift TEXT,
  modality TEXT,
  phase TEXT NOT NULL,
  registrations_count INTEGER DEFAULT 0,
  EE BOOLEAN DEFAULT FALSE,
  room_ids JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS allocations (
    id TEXT PRIMARY KEY,
    exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
    room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
    invigilator1_id TEXT REFERENCES teachers(id),
    invigilator2_id TEXT REFERENCES teachers(id),
    substitute_id TEXT REFERENCES teachers(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_via TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS email_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    resend_api_key TEXT,
    from_email TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    reply_to TEXT,
    school_name TEXT NOT NULL DEFAULT 'Escola Secundária',
    subject_prefix TEXT NOT NULL DEFAULT 'Vigilância de Exame',
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
