/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TeacherUnavailability {
  id: string;
  date: string; // YYYY-MM-DD
  time: "09:00" | "14:00" | "all";
}

export interface Teacher {
  id: string;
  name: string;
  subject_group: string; // e.g. "500", "300"
  subject: string;      // e.g. "Matemática", "Português"
  role: string;         // e.g. "QA", "Contratado", "Quadro"
  email: string;
  phone?: string;
  available: boolean;   // Check if available for invigilation
  unavailabilities?: TeacherUnavailability[];
}

export interface Room {
  id: string;
  name: string;         // e.g. "Sala 101", "Anfiteatro A"
  capacity: number;     // Student capacity
  floor?: string;
  priority: number;
}

export interface Exam {
  id: string;
  name: string;         // e.g. "Matemática"
  variant?: string | null; // e.g. "A", "B", "LNM"
  subject_group: string; // e.g. "300", "500" (NOT NULL)
  year: string;         // e.g. "9", "11", "12"
  code?: string | null;  // e.g. "635", "92"
  date: string;         // YYYY-MM-DD
  time: string;         // e.g. "08:45"
  shift?: string | null; // e.g. "T1", "T2"
  modality?: string | null; // e.g. "LO", "SP", "NE", "EE"
  phase: string;        // "1", "2"
  duration: number;     // In minutes
  tolerance: number;    // In minutes
  roomsNeeded: number;  // Number of rooms required for this exam
  roomIds?: string[];   // Associated room IDs for this exam
}

export interface Allocation {
  id: string;
  examId: string;
  roomId: string;
  invigilator1Id: string | null; // Teacher 1
  invigilator2Id: string | null; // Teacher 2
  substituteId: string | null;   // Suplente (reserve)
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  recipientEmail: string;
  recipientName: string;
  title: string;
  message: string;
  sentVia: 'push' | 'email';
  read: boolean;
}

export type Language = 'pt' | 'en';

export type UserRole = 'admin' | 'teacher';

export interface UserSession {
  role: UserRole;
  teacherId?: string; // If logging in as a specific teacher
  email: string;
  name: string;
}
