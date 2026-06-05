import { Teacher, Room, Exam, Allocation, NotificationLog } from '../types';

const API_BASE = '/api';

export const api = {
  teachers: {
    getAll: () => fetch(`${API_BASE}/teachers`).then(r => r.json()),
    save: (teacher: Teacher) => fetch(`${API_BASE}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacher)
    }).then(r => r.json()),
    delete: (id: string) => fetch(`${API_BASE}/teachers?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
    deleteAll: () => fetch(`${API_BASE}/teachers?id=all`, { method: 'DELETE' }).then(r => r.json()),
  },
  rooms: {
    getAll: () => fetch(`${API_BASE}/rooms`).then(r => r.json()),
    save: (room: Room) => fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room)
    }).then(r => r.json()),
    delete: (id: string) => fetch(`${API_BASE}/rooms?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
  },
  exams: {
    getAll: () => fetch(`${API_BASE}/exams`).then(r => r.json()),
    save: (exam: Exam) => fetch(`${API_BASE}/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exam)
    }).then(r => r.json()),
    delete: (id: string) => fetch(`${API_BASE}/exams?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
  },
  allocations: {
    getAll: () => fetch(`${API_BASE}/allocations`).then(r => r.json()),
    save: (allocation: Allocation) => fetch(`${API_BASE}/allocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allocation)
    }).then(r => r.json()),
    deleteByExam: (examId: string) => fetch(`${API_BASE}/allocations?examId=${examId}`, { method: 'DELETE' }).then(r => r.json()),
  },
  notifications: {
    getAll: () => fetch(`${API_BASE}/notifications`).then(r => r.json()),
    save: (notification: NotificationLog) => fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification)
    }).then(r => r.json()),
  },
  ai: {
    ask: (prompt: string, context: any) => fetch(`${API_BASE}/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context })
    }).then(r => r.json()),
  }
};
