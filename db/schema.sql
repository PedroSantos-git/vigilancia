-- Database schema for Exam Vigilance Management

CREATE TABLE IF NOT EXISTS AuthorizedUsers ( 
   id SERIAL PRIMARY KEY, 
   email TEXT UNIQUE NOT NULL, 
   name TEXT, 
   role TEXT DEFAULT 'admin', 
   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() 
 );

CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject_group TEXT NOT NULL,
    subject TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    available BOOLEAN DEFAULT TRUE,
    unavailabilities JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    floor TEXT
);

CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
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
