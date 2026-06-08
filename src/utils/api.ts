import { Teacher, Room, Exam, Allocation, NotificationLog } from '../types';

const API_BASE = '/api';

export const api = {
  teachers: {
    getAll: () => fetch(`${API_BASE}/teachers`).then(r => r.json()),
    save: (teacher: Teacher) => fetch(`${API_BASE}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacher)
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Failed to save teacher');
      }
      return r.json();
    }),
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
    updateAll: (rooms: Room[]) => fetch(`${API_BASE}/rooms`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rooms })
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
    clearAll: () => fetch(`${API_BASE}/allocations?all=true`, { method: 'DELETE' }).then(r => r.json())
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
  },
  emailConfig: {
    get: () => fetch(`${API_BASE}/notifications?type=config`).then(r => r.json()),
    save: (config: {
      fromEmail: string;
      fromName?: string;
      replyTo?: string;
      schoolName?: string;
      subjectPrefix?: string;
      enabled?: boolean;
      resendApiKey?: string;
    }) => fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveConfig', ...config })
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Failed to save email config');
      }
      return r.json();
    }),
  },
  sendNotifications: (notifications: Array<{
    teacherId: string;
    teacherName: string;
    teacherEmail: string;
    allocations: Array<{
      examName: string;
      examDate: string;
      examTime: string;
      roomName: string;
      role: string;
    }>;
  }>) => fetch(`${API_BASE}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', notifications })
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json();
      throw new Error(err.error || 'Failed to send notifications');
    }
    return r.json();
  }),
  users: {
    getAll: () => fetch(`${API_BASE}/users`).then(r => r.json()),
    save: (user: { email: string, name: string, role?: string }) => fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    }).then(r => r.json()),
    delete: (email: string) => fetch(`${API_BASE}/users?email=${email}`, { method: 'DELETE' }).then(r => r.json()),
  },
  roles: {
    getAll: () => fetch(`${API_BASE}/roles`).then(r => r.json()),
    save: (role: { id?: string, name: string }) => fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role)
    }).then(r => r.json()),
    delete: (id: string) => fetch(`${API_BASE}/roles?id=${id}`, { method: 'DELETE' }).then(r => r.json()),
  },
  import: {
    mapaGeral: (data: { teachers: any[], exams: any[], roles: any[], confirmReplace: boolean }) => fetch(`${API_BASE}/import-mapa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    bulk: (data: {
      teachers: any[];
      exams: any[];
      rooms: any[];
      roles: any[];
      sheetsPresent?: {
        Docentes: boolean;
        Exames: boolean;
        Salas: boolean;
        Cargos: boolean;
      };
    }) => fetch(`${API_BASE}/bulk-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  }
};
