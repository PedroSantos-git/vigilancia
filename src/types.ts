/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TeacherUnavailability {
  id: string;
  date: string | "all"; // YYYY-MM-DD or "all"
  time: "09:00" | "14:00" | "all";
  year?: string; // Year of exam
  subject_group?: string; // Subject group of exam
}

export interface TeacherRole {
  id: string;
  name: string;
  priority: number;
}

export interface Teacher {
  id: string;
  name: string;
  subject_group: string; // e.g. "500", "300"
  subject: string;      // e.g. "Matemática", "Português"
  role: string;         // e.g. "QA", "Contratado", "Quadro"
  email: string;
  available: boolean;   // Check if available for invigilation
  EE: boolean;          // Educação Especial
  PISO_ZERO: boolean;   // Only assign to floor 0 rooms
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
  name: string; // e.g., "Matemática"
  variant?: string | null; // e.g., "A", "B", "LNM"
  subject_group: string; // e.g., "500", "300" (NOT NULL)
  year: string; // e.g., "9", "11", "12"
  code?: string | null;  // e.g., "635", "92"
  date: string; // YYYY-MM-DD
  time: string; // e.g., "08:45"
  shift?: string | null; // e.g., "T1", "T2"
  modality?: string | null; // e.g., "LO", "SP", "NE", "EE"
  phase: string; // "1", "2"
  registrationsCount: number; // Number of students registered for this exam (N_Inscritos)
  EE: boolean; // Needs at least one EE teacher
  roomIds?: string[]; // Associated room IDs for this exam
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

export interface EmailSettings {
  id: string;
  resendApiKey?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  schoolName: string;
  subjectPrefix: string;
  enabled: boolean;
  updatedAt?: string;
  hasApiKey?: boolean;
}

export type Language = 'pt' | 'en';

export type UserRole = 'admin' | 'teacher';

export interface UserSession {
  role: UserRole;
  teacherId?: string; // If logging in as a specific teacher
  email: string;
  name: string;
}
