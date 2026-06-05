/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSession, signOut } from "next-auth/react";
import { 
  Teacher, 
  Room, 
  Exam, 
  Allocation, 
  NotificationLog, 
  Language, 
  UserSession 
} from './types';
import { translations } from './translations';
import { autoAllocate } from './utils/scheduler';

// Subcomponents
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import TeacherManager from './components/TeacherManager';
import RoomManager from './components/RoomManager';
import ExamManager from './components/ExamManager';
import AllocationManager from './components/AllocationManager';
import ReportManager from './components/ReportManager';
import BackupLogs from './components/BackupLogs';
import NotificationCenter from './components/NotificationCenter';
import ExamRoomManager from './components/ExamRoomManager';
import UserManager from './components/UserManager';

// Icons
import { 
  Shield, 
  Users, 
  Home, 
  Calendar, 
  Sparkles, 
  Bell, 
  FileText, 
  CloudLightning, 
  LogOut, 
  Globe,
  Layers,
  Lock
} from 'lucide-react';

import { SchoolShipIcon } from './components/SchoolLogo';
import { api } from './utils/api';

// Default Portuguese Demographics
const INITIAL_TEACHERS: Teacher[] = [
  { id: 't_1', name: 'Dr. Manuel Antunes', subjectGroup: '500', subject: 'Matemática', role: 'Professor', email: 'manuel.antunes@escola.pt', available: true },
  { id: 't_2', name: 'Dra. Sandra Santos', subjectGroup: '300', subject: 'Português', role: 'Coordenador', email: 'sandra.santos@escola.pt', available: true },
  { id: 't_3', name: 'Dr. João Costa', subjectGroup: '510', subject: 'Física e Química', role: 'Professor', email: 'joao.costa@escola.pt', available: true },
  { id: 't_4', name: 'Dra. Maria Mendes', subjectGroup: '430', subject: 'Biologia e Geologia', role: 'Diretor de Turma', email: 'maria.mendes@escola.pt', available: true },
  { id: 't_5', name: 'Dr. Pedro Oliveira', subjectGroup: '500', subject: 'Matemática', role: 'Professor', email: 'pedro.oliveira@escola.pt', available: true },
  { id: 't_6', name: 'Dra. Ana Ferreira', subjectGroup: '300', subject: 'Português', role: 'Diretor de Turma', email: 'ana.ferreira@escola.pt', available: true },
  { id: 't_7', name: 'Dr. Ricardo Sousa', subjectGroup: '700', subject: 'Educação Física', role: 'Professor', email: 'ricardo.sousa@escola.pt', available: true },
  { id: 't_8', name: 'Dra. Sofia Lima', subjectGroup: '600', subject: 'Artes Visuais', role: 'Professor', email: 'sofia.lima@escola.pt', available: true }
];

const INITIAL_ROOMS: Room[] = [
  { id: 'r_4', name: 'Anfiteatro Geral', capacity: 40 },
  { id: 'r_1', name: 'Sala 101', capacity: 20 },
  { id: 'r_2', name: 'Sala 102', capacity: 20 },
  { id: 'r_3', name: 'Sala 204', capacity: 15 }
];

const sortRooms = (list: Room[]): Room[] => {
  return [...list].sort((a, b) => 
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
};

const INITIAL_EXAMS: Exam[] = [
  { id: 'e_1', name: 'Matemática A - 12º Ano', subject: 'Matemática', date: '2026-06-15', time: '09:00' },
  { id: 'e_2', name: 'Português - 12º Ano', subject: 'Português', date: '2026-06-16', time: '09:00' },
  { id: 'e_3', name: 'Física e Química A - 11º Ano', subject: 'Física e Química', date: '2026-06-18', time: '14:00' }
];

const INITIAL_ALLOCATIONS: Allocation[] = [
  // Matemática A Exam allocations
  { id: 'alloc_1', examId: 'e_1', roomId: 'r_1', invigilator1Id: 't_2', invigilator2Id: 't_3', substituteId: 't_7' }, // Sandra and João watch Math, Ricardo as backup
  { id: 'alloc_2', examId: 'e_1', roomId: 'r_2', invigilator1Id: 't_4', invigilator2Id: 't_6', substituteId: 't_8' }  // Maria and Ana watch Math, Sofia as backup
];

const INITIAL_NOTIFICATIONS: NotificationLog[] = [
  { id: 'n_1', timestamp: '09:59', recipientEmail: 'sandra.santos@escola.pt', recipientName: 'Dra. Sandra Santos', title: 'Alocado(a) a Vigilância de Exame', message: 'Foi nomeado(a) como Vigilante 1 na Sala 101 para o Exame Matemática A - 12º Ano no dia 2026-06-15 às 09h00.', sentVia: 'email', read: false },
  { id: 'n_2', timestamp: '09:59', recipientEmail: 'joao.costa@escola.pt', recipientName: 'Dr. João Costa', title: 'Alocado(a) a Vigilância de Exame', message: 'Foi nomeado(a) como Vigilante 2 na Sala 101 para o Exame Matemática A - 12º Ano no dia 2026-06-15 às 09h00.', sentVia: 'email', read: false }
];

export default function App() {
  // Locale state
  const [lang, setLang] = useState<Language>('pt');
  
  // App primary states
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [notificationsLog, setNotificationsLog] = useState<NotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // NextAuth Session
  const { data: nextSession, status: nextStatus } = useSession();

  // Authentication session (compatibility with legacy local auth)
  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('v_session');
    return saved ? JSON.parse(saved) : null;
  });

  // Sync NextAuth session to our local session state
  useEffect(() => {
    if (nextStatus === 'authenticated' && nextSession?.user) {
      const userSession: UserSession = {
        role: (nextSession.user as any).role || 'admin',
        email: nextSession.user.email || '',
        name: nextSession.user.name || '',
      };
      setSession(userSession);
    }
  }, [nextSession, nextStatus]);

  // Active Screen / Tab option: dashboard, teachers, rooms, exams, schedule, reports, backup
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tData, rData, eData, aData, nData] = await Promise.all([
          api.teachers.getAll(),
          api.rooms.getAll(),
          api.exams.getAll(),
          api.allocations.getAll(),
          api.notifications.getAll()
        ]);
        setTeachers(tData);
        setRooms(sortRooms(rData));
        setExams(eData);
        setAllocations(aData);
        setNotificationsLog(nData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem('v_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('v_session');
    }
  }, [session]);

  const t = translations[lang];

  // LOGOUT
  const handleLogout = () => {
    if (nextStatus === 'authenticated') {
      signOut();
    }
    setSession(null);
    setActiveTab('dashboard');
  };

  // Bulk Teachers Import CSV action
  const handleBulkImportTeachers = async (newTeachers: Teacher[]) => {
    // Avoid duplicate emails
    const existingEmails = new Set(teachers.map(t => t.email.toLowerCase()));
    const uniques = newTeachers.filter(t => !existingEmails.has(t.email.toLowerCase()));
    
    for (const t of uniques) {
      await api.teachers.save(t);
    }
    
    const updatedTeachers = await api.teachers.getAll();
    setTeachers(updatedTeachers);
  };

  // Manual update handlers
  const handleAddTeacher = async (teacher: Teacher) => {
    await api.teachers.save(teacher);
    setTeachers(prev => [...prev, teacher]);
  };
  const handleUpdateTeacher = async (teacher: Teacher) => {
    await api.teachers.save(teacher);
    setTeachers(prev => prev.map(t => t.id === teacher.id ? teacher : t));
  };
  const handleDeleteTeacher = async (id: string) => {
    await api.teachers.delete(id);
    setTeachers(prev => prev.filter(t => t.id !== id));
  };
  const handleClearAllTeachers = async () => {
    await api.teachers.deleteAll();
    setTeachers([]);
  };

  const handleAddRoom = async (room: Room) => {
    await api.rooms.save(room);
    setRooms(prev => sortRooms([...prev, room]));
  };
  const handleUpdateRoom = async (room: Room) => {
    await api.rooms.save(room);
    setRooms(prev => sortRooms(prev.map(r => r.id === room.id ? room : r)));
  };
  const handleDeleteRoom = async (id: string) => {
    await api.rooms.delete(id);
    setRooms(prev => sortRooms(prev.filter(r => r.id !== id)));
  };

  const handleAddExam = async (exam: Exam) => {
    await api.exams.save(exam);
    setExams(prev => [...prev, exam]);
    // Redirect to allocation setup
    setSelectedTabContext('exams');
  };
  const handleUpdateExam = async (exam: Exam) => {
    await api.exams.save(exam);
    setExams(prev => prev.map(e => e.id === exam.id ? exam : e));
  };
  const handleDeleteExam = async (id: string) => {
    await api.exams.delete(id);
    await api.allocations.deleteByExam(id);
    setExams(prev => prev.filter(e => e.id !== id));
    setAllocations(prev => prev.filter(a => a.examId !== id)); // purge allocations
  };

  const handleUpdateAllocation = async (updatedAlloc: Allocation) => {
    await api.allocations.save(updatedAlloc);
    setAllocations(prev => {
      const exists = prev.some(a => a.id === updatedAlloc.id);
      if (exists) {
        return prev.map(a => a.id === updatedAlloc.id ? updatedAlloc : a);
      } else {
        return [...prev, updatedAlloc];
      }
    });

    // Generate notification alerts for assigned staff
    const triggerNotifsForAssignement = async (roleVal: 'invigilator1Id' | 'invigilator2Id' | 'substituteId', labelPt: string, labelEn: string) => {
      const teacherId = updatedAlloc[roleVal];
      if (!teacherId) return;

      const teacher = teachers.find(t => t.id === teacherId);
      const exam = exams.find(e => e.id === updatedAlloc.examId);
      const room = rooms.find(r => r.id === updatedAlloc.roomId);

      if (teacher && exam && room) {
        const timeStr = new Date().toLocaleTimeString(lang === 'pt' ? 'pt-PT' : 'en-US', { hour: '2-digit', minute: '2-digit' });
        
        const isSub = roleVal === 'substituteId';
        const ptRole = isSub ? 'Professor Suplente (Reserva Geral)' : labelPt;
        const enRole = isSub ? 'General Standby Substitute' : labelEn;

        const ptMsg = isSub
          ? `Foi convocado como Professor Suplente (Reserva Geral) para o exame de ${exam.name} no dia ${exam.date} às ${exam.time === '09:00' ? '09h00' : '14h00'}. Deve apresentar-se no Secretariado.`
          : `Foi alocado como ${ptRole} na ${room.name} para o exame de ${exam.name} no dia ${exam.date} às ${exam.time === '09:00' ? '09h00' : '14h00'}.`;
          
        const enMsg = isSub
          ? `You have been convocated as a Standby Substitute (General Reserve) for the ${exam.name} exam on ${exam.date} at ${exam.time === '09:00' ? '09:00 AM' : '02:00 PM'}. Please report to the central desk (Secretariado).`
          : `You have been allocated as ${enRole} in ${room.name} for the ${exam.name} exam on ${exam.date} at ${exam.time === '09:00' ? '09:00 AM' : '02:00 PM'}.`;

        const newLog: NotificationLog = {
          id: `n_trigger_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          timestamp: timeStr,
          recipientEmail: teacher.email,
          recipientName: teacher.name,
          title: lang === 'pt' ? 'Alteração Escalar de Vigilância' : 'Invigilation Schedule Update',
          message: lang === 'pt' ? ptMsg : enMsg,
          sentVia: 'email',
          read: false
        };

        await api.notifications.save(newLog);
        setNotificationsLog(prevNot => [...prevNot, newLog]);
      }
    };

    // Find difference to only trigger warnings if staff changes
    const oldAlloc = allocations.find(a => a.id === updatedAlloc.id);
    if (!oldAlloc) {
      triggerNotifsForAssignement('invigilator1Id', 'Vigilante 1', 'Invigilator 1');
      triggerNotifsForAssignement('invigilator2Id', 'Vigilante 2', 'Invigilator 2');
      triggerNotifsForAssignement('substituteId', 'Suplente', 'Substitute');
    } else {
      if (updatedAlloc.invigilator1Id !== oldAlloc.invigilator1Id) {
        triggerNotifsForAssignement('invigilator1Id', 'Vigilante 1', 'Invigilator 1');
      }
      if (updatedAlloc.invigilator2Id !== oldAlloc.invigilator2Id) {
        triggerNotifsForAssignement('invigilator2Id', 'Vigilante 2', 'Invigilator 2');
      }
      if (updatedAlloc.substituteId !== oldAlloc.substituteId) {
        triggerNotifsForAssignement('substituteId', 'Suplente', 'Substitute');
      }
    }
  };

  const handleAddNotificationLog = async (notif: NotificationLog) => {
    await api.notifications.save(notif);
    setNotificationsLog(prev => [...prev, notif]);
  };

  const handleMarkAsRead = async (id: string) => {
    const notification = notificationsLog.find(n => n.id === id);
    if (notification) {
      const updated = { ...notification, read: true };
      await api.notifications.save(updated);
      setNotificationsLog(prev => prev.map(n => n.id === id ? updated : n));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (session) {
      const promises = notificationsLog.map(n => {
        if (!n.read && (session.role === 'admin' || n.recipientEmail.toLowerCase() === session.email.toLowerCase())) {
          return api.notifications.save({ ...n, read: true });
        }
        return null;
      }).filter(p => p !== null);

      await Promise.all(promises);

      setNotificationsLog(prev => prev.map(n => {
        if (session.role === 'admin' || n.recipientEmail.toLowerCase() === session.email.toLowerCase()) {
          return { ...n, read: true };
        }
        return n;
      }));
    }
  };

  // Automated scales triggers across all rooms of a single exam block
  const handleAutoTriggerForExam = async (examId: string) => {
    const examObj = exams.find(e => e.id === examId);
    if (!examObj) return;

    // Run autoAllocate with specific rooms if associated, otherwise fallback to all
    const examCurrentAllocs = allocations.filter(a => a.examId === examId);
    const examRooms = examObj.roomIds && examObj.roomIds.length > 0
      ? rooms.filter(r => examObj.roomIds?.includes(r.id))
      : rooms;
    const result = autoAllocate(examObj, examRooms, teachers, allocations, examCurrentAllocs);

    // Save outputs
    for (const alloc of result.allocations) {
      await api.allocations.save(alloc);
    }

    setAllocations(prev => {
      // Purge old allocations for this exam
      const filtered = prev.filter(a => a.examId !== examId);
      return [...filtered, ...result.allocations];
    });

    // Push new notifications
    const timeStr = new Date().toLocaleTimeString(lang === 'pt' ? 'pt-PT' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const formattedLogs: NotificationLog[] = result.notifications.map((log, index) => {
      const teacher = teachers.find(t => t.id === log.teacherId)!;
      return {
        id: `n_auto_${Date.now()}_${index}`,
        timestamp: timeStr,
        recipientEmail: teacher.email,
        recipientName: teacher.name,
        title: lang === 'pt' ? 'Atribuição Automática de Escala' : 'Auto Allocation Notification',
        message: log.message,
        sentVia: 'email',
        read: false
      };
    });

    for (const log of formattedLogs) {
      await api.notifications.save(log);
    }

    if (formattedLogs.length > 0) {
      setNotificationsLog(prev => [...prev, ...formattedLogs]);
    }

    alert(t.automaticSuccess);
  };

  // Clear allocations for a single exam
  const handleClearAllocationsForExam = async (examId: string) => {
    await api.allocations.deleteByExam(examId);
    setAllocations(prev => prev.filter(a => a.examId !== examId));
  };

  // Trigger automation globally (for all exams!)
  const handleAutoTriggerAll = async () => {
    for (const ex of exams) {
      const examCurrentAllocs = allocations.filter(a => a.examId === ex.id);
      const examRooms = ex.roomIds && ex.roomIds.length > 0
        ? rooms.filter(r => ex.roomIds?.includes(r.id))
        : rooms;
      const result = autoAllocate(ex, examRooms, teachers, allocations, examCurrentAllocs);
      
      for (const alloc of result.allocations) {
        await api.allocations.save(alloc);
      }

      setAllocations(prev => {
        const filtered = prev.filter(v => v.examId !== ex.id);
        return [...filtered, ...result.allocations];
      });

      // Notifications logs
      const timeStr = new Date().toLocaleTimeString();
      const logsToAppend: NotificationLog[] = result.notifications.map((log, i) => {
        const t = teachers.find(p => p.id === log.teacherId)!;
        return {
          id: `n_auto_${Date.now()}_${i}`,
          timestamp: timeStr,
          recipientEmail: t.email,
          recipientName: t.name,
          title: lang === 'pt' ? 'Escala Automática Central' : 'Central Roster Scale Auto-Allot',
          message: log.message,
          sentVia: 'email',
          read: false
        };
      });

      for (const log of logsToAppend) {
        await api.notifications.save(log);
      }

      if (logsToAppend.length > 0) {
        setNotificationsLog(prev => [...prev, ...logsToAppend]);
      }
    }

    alert(t.automaticSuccess);
  };

  const handleClearAllocationsAll = async () => {
    for (const ex of exams) {
      await api.allocations.deleteByExam(ex.id);
    }
    setAllocations([]);
  };

  // State context setters helper
  const setSelectedTabContext = (targetTab: string) => {
    setActiveTab(targetTab);
  };

  // Physical Backup downloader / uploader triggers
  const handleDownloadBackupFile = () => {
    const fullDatabaseMap = {
      teachers,
      rooms,
      exams,
      allocations,
      notificationsLog
    };
    
    const jsonContent = JSON.stringify(fullDatabaseMap, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `seguranca_exames_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadBackupFile = async (fileText: string) => {
    try {
      const parsed = JSON.parse(fileText);
      if (parsed.teachers && parsed.rooms && parsed.exams) {
        // Clear and reload all data
        await api.teachers.deleteAll();
        for (const t of parsed.teachers) await api.teachers.save(t);
        for (const r of parsed.rooms) await api.rooms.save(r);
        for (const e of parsed.exams) await api.exams.save(e);
        if (parsed.allocations) {
          for (const a of parsed.allocations) await api.allocations.save(a);
        }
        if (parsed.notificationsLog) {
          for (const n of parsed.notificationsLog) await api.notifications.save(n);
        }

        const [tData, rData, eData, aData, nData] = await Promise.all([
          api.teachers.getAll(),
          api.rooms.getAll(),
          api.exams.getAll(),
          api.allocations.getAll(),
          api.notifications.getAll()
        ]);

        setTeachers(tData);
        setRooms(sortRooms(rData));
        setExams(eData);
        setAllocations(aData);
        setNotificationsLog(nData);
        alert(t.restoreSuccessMsg);
      } else {
        alert(lang === 'pt' ? 'O arquivado de importação de JSON é inválido.' : 'Invalid system map dataset format.');
      }
    } catch(e) {
      alert(lang === 'pt' ? 'Erro de leitura do ficheiro de restauro.' : 'Error decoding local backup database file.');
    }
  };

  // If loading data, show a simple spinner or message
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <SchoolShipIcon className="h-16 w-16 text-blue-400 animate-pulse" color="#3b82f6" />
        <div className="text-xl font-bold tracking-tight">Carregando sistema...</div>
        <div className="text-slate-400 text-sm animate-pulse">Acedendo à base de dados Vercel</div>
      </div>
    );
  }

  // If session is empty, load LoginScreen
  if (!session) {
    return (
      <LoginScreen 
        lang={lang} 
        onSetLang={setLang} 
        onLoginSuccess={setSession} 
        teachersList={teachers}
        onRegisterTeacher={handleAddTeacher}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col font-sans print:bg-white print:text-black">
      
      {/* Primary Header brand layout */}
      <header className="bg-slate-900 text-slate-200 border-b border-slate-850 py-3.5 px-6 sticky top-0 z-40 print:hidden flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <SchoolShipIcon className="h-8 w-8 text-blue-400" color="#3b82f6" />
          <div>
            <h1 className="font-extrabold text-sm tracking-wide text-white leading-none">
              {t.appName}
            </h1>
            <p className="text-[10px] text-slate-400 mt-1">{t.tagline}</p>
          </div>
        </div>

        {/* Global toggles and session profile */}
        <div className="flex items-center space-x-4">
          
          {/* PT/EN Toggle */}
          <button
            onClick={() => setLang(l => l === 'pt' ? 'en' : 'pt')}
            className="flex items-center space-x-1.5 hover:text-white transition text-xs font-semibold cursor-pointer"
          >
            <Globe className="h-4 w-4 text-blue-400" />
            <span>{lang === 'pt' ? 'EN' : 'PT'}</span>
          </button>

          {/* User profile line info */}
          <div className="border-l border-slate-850 h-5" />
          <div className="text-right text-xs leading-tight">
            <span className="font-semibold text-white block">{session.name}</span>
            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
              session.role === 'admin' ? 'bg-blue-950 text-blue-455 border border-blue-900/30' : 'bg-slate-800 text-slate-300 border border-slate-700/60'
            }`}>
              {session.role === 'admin' ? t.adminBadge : t.teacherBadge}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="bg-slate-850 hover:bg-slate-800 p-2 text-slate-300 hover:text-rose-400 rounded-lg border border-slate-800 transition cursor-pointer"
            title={t.logoutBtn}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Main Body with Sidebar navigations container */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        
        {/* Navigation Sidebar (Tailored according to role) */}
        <aside className="w-64 border-r border-[#e2e8f0] bg-white p-5 space-y-6 hidden md:block print:hidden shadow-[1px_0_0_0_#e2e8f0]">
          
          {/* Section: Menu */}
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
              Menu Geral
            </span>
            
            {/* Tab: Dashboard only for Admin */}
            {session.role === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'dashboard' 
                      ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <span>{t.tabDashboard}</span>
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'users' 
                      ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Lock className="h-4 w-4" />
                  <span>{lang === 'pt' ? 'Acessos' : 'Access Control'}</span>
                </button>
              </>
            )}

            {/* Tab: Teachers */}
            <button
              onClick={() => setActiveTab('teachers')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'teachers' 
                  ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>{t.tabTeachers}</span>
            </button>

            {/* Tab: Rooms */}
            <button
              onClick={() => setActiveTab('rooms')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'rooms' 
                  ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>{t.tabRooms}</span>
            </button>

            {/* Tab: Exams */}
            <button
              onClick={() => setActiveTab('exams')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'exams' 
                  ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>{t.tabExams}</span>
            </button>

            {/* Tab: Exam Rooms */}
            <button
              onClick={() => setActiveTab('examRooms')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'examRooms' 
                  ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>{t.tabExamRooms}</span>
            </button>
          </div>

          <div className="space-y-1.5 pt-4 border-t border-slate-100">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
              Supervisão Escalar
            </span>

            {/* Tab: Allocation Scale */}
            <button
              onClick={() => setActiveTab('schedule')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'schedule' 
                  ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>{t.tabSchedule}</span>
            </button>

            {/* Tab: Notification Feed */}
            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'notifications' 
                  ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span>{lang === 'pt' ? 'Alertas por Email' : 'Email Alerts Feed'}</span>
            </button>

            {/* Tab: Reports */}
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'reports' 
                  ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>{t.tabReports}</span>
            </button>

            {/* Tab: Backups only for Admin */}
            {session.role === 'admin' && (
              <button
                onClick={() => setActiveTab('backup')}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'backup' 
                    ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CloudLightning className="h-4 w-4" />
                <span>{t.tabBackup}</span>
              </button>
            )}
          </div>

          {/* Quick tips display card */}
          <div className="bg-[#f8fafc] border border-slate-205 p-3.5 rounded-xl space-y-1 mt-6 text-[11px] leading-relaxed">
            <span className="font-extrabold text-slate-805">Regulamentação Nacional:</span>
            <p className="text-slate-550">
              Obrigatório colocar pelo menos <strong>2 vigilantes</strong> por sala de exame. Nenhum docente pode exercer vigilância no exame correspondente ao seu próprio grupo especializado.
            </p>
          </div>
        </aside>

        {/* Dynamic Mobile Navigator tabs row */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 grid grid-cols-5 py-2 z-40 print:hidden justify-items-center">
          <button 
            onClick={() => {
              if (session.role === 'admin') setActiveTab('dashboard');
              else setActiveTab('teachers');
            }}
            className={`flex flex-col items-center justify-center space-y-1 cursor-pointer ${
              (activeTab === 'dashboard' || activeTab === 'teachers') ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[9px] font-bold">Início</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('rooms')}
            className={`flex flex-col items-center justify-center space-y-1 cursor-pointer ${
              activeTab === 'rooms' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[9px] font-bold">Salas/Doc.</span>
          </button>

          <button 
            onClick={() => setActiveTab('schedule')}
            className={`flex flex-col items-center justify-center space-y-1 cursor-pointer ${
              activeTab === 'schedule' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <Sparkles className="h-5 w-5" />
            <span className="text-[9px] font-bold">Escalas</span>
          </button>

          <button 
            onClick={() => setActiveTab('notifications')}
            className={`flex flex-col items-center justify-center space-y-1 cursor-pointer ${
              activeTab === 'notifications' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <Bell className="h-5 w-5" />
            <span className="text-[9px] font-bold">Alertas</span>
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center space-y-1 cursor-pointer ${
              activeTab === 'reports' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="text-[9px] font-bold">Gerar</span>
          </button>
        </div>

        {/* Dynamic Content Frame panel */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto pb-24 md:pb-8">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Load Panel dynamically corresponding to active tab */}
              {activeTab === 'dashboard' && session.role === 'admin' && (
                <AdminDashboard
                  lang={lang}
                  teachers={teachers}
                  rooms={rooms}
                  exams={exams}
                  allocations={allocations}
                  notificationsLog={notificationsLog}
                  onAutoTrigger={handleAutoTriggerAll}
                  onClearAllocations={handleClearAllocationsAll}
                />
              )}

              {activeTab === 'users' && session.role === 'admin' && (
                 <UserManager
                   lang={lang}
                 />
               )}

              {activeTab === 'teachers' && (
                <TeacherManager
                  lang={lang}
                  teachers={teachers}
                  onAddTeacher={handleAddTeacher}
                  onUpdateTeacher={handleUpdateTeacher}
                  onDeleteTeacher={handleDeleteTeacher}
                  onClearAllTeachers={handleClearAllTeachers}
                  onBulkImport={handleBulkImportTeachers}
                />
              )}

              {activeTab === 'rooms' && (
                <RoomManager
                  lang={lang}
                  rooms={rooms}
                  onAddRoom={handleAddRoom}
                  onUpdateRoom={handleUpdateRoom}
                  onDeleteRoom={handleDeleteRoom}
                />
              )}

              {activeTab === 'exams' && (
                <ExamManager
                  lang={lang}
                  exams={exams}
                  teachers={teachers}
                  onAddExam={handleAddExam}
                  onUpdateExam={handleUpdateExam}
                  onDeleteExam={handleDeleteExam}
                />
              )}

              {activeTab === 'examRooms' && (
                <ExamRoomManager
                  lang={lang}
                  exams={exams}
                  rooms={rooms}
                  onUpdateExam={handleUpdateExam}
                />
              )}

              {activeTab === 'schedule' && (
                <AllocationManager
                  lang={lang}
                  teachers={teachers}
                  rooms={rooms}
                  exams={exams}
                  allocations={allocations}
                  onAutoTriggerForExam={handleAutoTriggerForExam}
                  onClearAllocationsForExam={handleClearAllocationsForExam}
                  onUpdateAllocation={handleUpdateAllocation}
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationCenter
                  lang={lang}
                  session={session}
                  teachers={teachers}
                  notifications={notificationsLog}
                  onAddNotification={handleAddNotificationLog}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkAllAsRead={handleMarkAllAsRead}
                />
              )}

              {activeTab === 'reports' && (
                <ReportManager
                  lang={lang}
                  teachers={teachers}
                  rooms={rooms}
                  exams={exams}
                  allocations={allocations}
                />
              )}

              {activeTab === 'backup' && session.role === 'admin' && (
                <BackupLogs
                  lang={lang}
                  onDownloadBackup={handleDownloadBackupFile}
                  onUploadBackup={handleUploadBackupFile}
                />
              )}
            </motion.div>
          </AnimatePresence>

        </main>

      </div>
    </div>
  );
}
