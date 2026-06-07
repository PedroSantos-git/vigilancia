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
  Language, 
  UserSession 
} from './types';
import { translations } from './translations';
import { autoAllocate, autoAllocateAll, autoAllocateRooms } from './utils/scheduler';

// Subcomponents
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import TeacherManager from './components/TeacherManager';
import RoomManager from './components/RoomManager';
import ExamManager from './components/ExamManager';
import AllocationManager from './components/AllocationManager';
import ReportManager from './components/ReportManager';
import BackupLogs from './components/BackupLogs';
import NotificationSender from './components/NotificationSender';
import ExamRoomManager from './components/ExamRoomManager';
import UserManager from './components/UserManager';
import RoleManager from './components/RoleManager';

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
  Lock,
  Tag,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

import { SchoolShipIcon } from './components/SchoolLogo';
import { api } from './utils/api';

const sortRooms = (list: Room[]): Room[] => {
  return [...list].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
};

type OperationLogLevel = 'info' | 'warn' | 'error';

interface OperationLogEntry {
  id: number;
  level: OperationLogLevel;
  message: string;
  timestamp: string;
}

interface OperationState {
  open: boolean;
  title: string;
  progress: number;
  status: 'idle' | 'running' | 'done' | 'error';
  logs: OperationLogEntry[];
}

export default function App() {
  // Locale state
  const [lang, setLang] = useState<Language>('pt');
  
  // App primary states
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [operationState, setOperationState] = useState<OperationState>({
    open: false,
    title: '',
    progress: 0,
    status: 'idle',
    logs: []
  });

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
        const [tData, rData, eData, aData] = await Promise.all([
          api.teachers.getAll(),
          api.rooms.getAll(),
          api.exams.getAll(),
          api.allocations.getAll()
        ]);
        
        // Ensure data is array before setting state
        setTeachers(Array.isArray(tData) ? tData : []);
        setRooms(Array.isArray(rData) ? sortRooms(rData) : []);
        setExams(Array.isArray(eData) ? eData : []);
        setAllocations(Array.isArray(aData) ? aData : []);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Reset to empty arrays on error to avoid .forEach errors
        setTeachers([]);
        setRooms([]);
        setExams([]);
        setAllocations([]);
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

  const nowStamp = () => new Date().toLocaleTimeString(lang === 'pt' ? 'pt-PT' : 'en-US');
  const waitForUiTick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  const beginOperation = (title: string) => {
    setOperationState({
      open: true,
      title,
      progress: 0,
      status: 'running',
      logs: []
    });
  };

  const pushOperationLog = (message: string, level: OperationLogLevel = 'info') => {
    setOperationState(prev => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          id: prev.logs.length + 1,
          level,
          message,
          timestamp: nowStamp()
        }
      ].slice(-800)
    }));
  };

  const setOperationProgress = (progress: number) => {
    setOperationState(prev => ({
      ...prev,
      progress: Math.max(0, Math.min(100, progress))
    }));
  };

  const finishOperation = (status: 'done' | 'error', finalMessage?: string) => {
    setOperationState(prev => ({
      ...prev,
      status,
      progress: status === 'done' ? 100 : prev.progress
    }));
    if (finalMessage) {
      pushOperationLog(finalMessage, status === 'done' ? 'info' : 'error');
    }
  };

  const closeOperationModal = () => {
    setOperationState(prev => ({
      ...prev,
      open: false,
      status: 'idle'
    }));
  };

  // LOGOUT
  const handleLogout = () => {
    if (nextStatus === 'authenticated') {
      signOut();
    }
    setSession(null);
    setActiveTab('dashboard');
  };

  const handleClearAllTeachers = async () => {
    try {
      await api.teachers.deleteAll();
      handleRefreshData();
    } catch (err) {
      console.error('Error clearing all teachers:', err);
    }
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

  const handleUpdateAllRooms = async (updatedRooms: Room[]) => {
    // Update local state immediately for instant feedback
    setRooms(sortRooms(updatedRooms));
    
    try {
      await api.rooms.updateAll(updatedRooms);
    } catch (err) {
      console.error('Error saving room order:', err);
      // Optional: rollback if needed, but for UX we keep the local state
    }
  };

  const handleAddExam = async (exam: Exam) => {
    await api.exams.save(exam);
    setExams(prev => [...prev, exam]);
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
    };

  const handleAutoTriggerForExam = async (examId: string) => {
    const examObj = exams.find(e => e.id === examId);
    if (!examObj) return;

    const examCurrentAllocs = allocations.filter(a => a.examId === examId);
    const examRooms = examObj.roomIds && examObj.roomIds.length > 0
      ? rooms.filter(r => examObj.roomIds?.includes(r.id))
      : rooms;
    const result = autoAllocate(examObj, examRooms, teachers, allocations, examCurrentAllocs, exams);

    await Promise.all(result.allocations.map(alloc => api.allocations.save(alloc)));

    setAllocations(prev => {
      const filtered = prev.filter(a => a.examId !== examId);
      return [...filtered, ...result.allocations];
    });

    if (result.warnings.length > 0) {
      alert(`${t.automaticSuccess}\n\n${result.warnings.join('\n')}`);
    } else {
      alert(t.automaticSuccess);
    }
  };

  const handleClearAllocationsForExam = async (examId: string) => {
    await api.allocations.deleteByExam(examId);
    setAllocations(prev => prev.filter(a => a.examId !== examId));
  };

  const handleRefreshData = async () => {
    setIsLoading(true);
    try {
      const [tData, rData, eData, aData] = await Promise.all([
        api.teachers.getAll(),
        api.rooms.getAll(),
        api.exams.getAll(),
        api.allocations.getAll()
      ]);
      setTeachers(Array.isArray(tData) ? tData : []);
      setRooms(Array.isArray(rData) ? sortRooms(rData) : []);
      setExams(Array.isArray(eData) ? eData : []);
      setAllocations(Array.isArray(aData) ? aData : []);
    } catch (err) {
      console.error('Error refreshing data:', err);
      // Ensure we don't break the UI with non-array data
      setTeachers([]);
      setRooms([]);
      setExams([]);
      setAllocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoTriggerAll = async () => {
    if (operationState.status === 'running') return;

    beginOperation(lang === 'pt' ? 'Atribuição Automática de Vigilâncias' : 'Automatic Invigilator Allocation');
    pushOperationLog(lang === 'pt' ? 'A validar exames e salas associadas...' : 'Validating exams and assigned rooms...');
    setOperationProgress(5);
    await waitForUiTick();

    // Rule: All exams must have at least one room assigned
    const examsWithoutRooms = exams.filter(ex => !ex.roomIds || ex.roomIds.length === 0);
    if (examsWithoutRooms.length > 0) {
      finishOperation(
        'error',
        lang === 'pt'
          ? `Processo interrompido: ${examsWithoutRooms.length} exame(s) sem salas associadas.`
          : `Process aborted: ${examsWithoutRooms.length} exam(s) without assigned rooms.`
      );
      return;
    }

    try {
      pushOperationLog(lang === 'pt' ? 'A gerar plano global por fases (Vigilante 1 -> Vigilante 2 -> Suplente)...' : 'Building global phased plan (Invigilator 1 -> Invigilator 2 -> Substitute)...');
      setOperationProgress(20);
      await waitForUiTick();

      const planningResult = autoAllocateAll(exams, rooms, teachers);
      pushOperationLog(
        lang === 'pt'
          ? `Plano gerado: ${planningResult.allocations.length} alocações.`
          : `Plan generated: ${planningResult.allocations.length} allocations.`
      );

      setOperationProgress(35);
      await waitForUiTick();

      pushOperationLog(lang === 'pt' ? 'A limpar alocações antigas...' : 'Clearing previous allocations...');
      await api.allocations.clearAll();
      setOperationProgress(45);
      await waitForUiTick();

      const total = planningResult.allocations.length;
      if (total === 0) {
        pushOperationLog(lang === 'pt' ? 'Sem alocações para gravar.' : 'No allocations to persist.', 'warn');
      }

      for (let i = 0; i < total; i++) {
        await api.allocations.save(planningResult.allocations[i]);
        if ((i + 1) % 10 === 0 || i === total - 1) {
          const persistedProgress = 45 + Math.round(((i + 1) / Math.max(total, 1)) * 45);
          setOperationProgress(persistedProgress);
          pushOperationLog(
            lang === 'pt'
              ? `Gravação em curso: ${i + 1}/${total}`
              : `Saving in progress: ${i + 1}/${total}`
          );
          await waitForUiTick();
        }
      }

      for (const infoLog of planningResult.notifications) {
        pushOperationLog(infoLog.message);
      }
      for (const warning of planningResult.warnings) {
        pushOperationLog(warning, 'warn');
      }

      setAllocations(planningResult.allocations);
      setOperationProgress(100);
      finishOperation(
        'done',
        lang === 'pt'
          ? 'Atribuição automática concluída. Pode rever os logs e clicar em OK.'
          : 'Automatic allocation completed. Review the logs and click OK.'
      );
    } catch (err) {
      console.error('Error during auto trigger all:', err);
      finishOperation('error', lang === 'pt' ? 'Erro durante a distribuição automática de vigilâncias.' : 'Error during automatic invigilator allocation.');
    }
  };

  const handleAutoTriggerRooms = async () => {
    if (operationState.status === 'running') return;

    beginOperation(lang === 'pt' ? 'Atribuição Automática de Salas' : 'Automatic Room Assignment');
    pushOperationLog(lang === 'pt' ? 'A calcular disponibilidade de salas por exame...' : 'Calculating room availability per exam...');
    setOperationProgress(10);
    await waitForUiTick();

    try {
      const updatedExams = autoAllocateRooms(exams, rooms);

      pushOperationLog(lang === 'pt' ? 'A guardar atualização das salas por exame...' : 'Saving updated room assignments...');
      const total = updatedExams.length;
      for (let i = 0; i < total; i++) {
        await api.exams.save(updatedExams[i]);
        if ((i + 1) % 5 === 0 || i === total - 1) {
          const progress = 10 + Math.round(((i + 1) / Math.max(total, 1)) * 85);
          setOperationProgress(progress);
          pushOperationLog(
            lang === 'pt'
              ? `Salas gravadas: ${i + 1}/${total}`
              : `Rooms saved: ${i + 1}/${total}`
          );
          await waitForUiTick();
        }
      }

      setExams(updatedExams);
      setOperationProgress(100);
      finishOperation(
        'done',
        lang === 'pt'
          ? 'Distribuição automática de salas concluída. Pode rever os logs e clicar em OK.'
          : 'Automatic room assignment completed. Review the logs and click OK.'
      );
    } catch (err) {
      console.error('Error during auto trigger rooms:', err);
      finishOperation('error', lang === 'pt' ? 'Erro ao distribuir salas automaticamente.' : 'Error while assigning rooms automatically.');
    }
  };

  const handleClearAllocationsAll = async () => {
    setIsLoading(true);
    try {
      await api.allocations.clearAll();
      // Clear local state immediately to avoid sync issues
      setAllocations([]);
      // Force a re-fetch to be absolutely sure
      const freshAllocations = await api.allocations.getAll();
      setAllocations(Array.isArray(freshAllocations) ? freshAllocations : []);
    } catch (err) {
      console.error('Error clearing allocations:', err);
      alert('Erro ao limpar alocações.');
    } finally {
      setIsLoading(false);
    }
  };

  const setSelectedTabContext = (targetTab: string) => {
    setActiveTab(targetTab);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <SchoolShipIcon className="h-16 w-16 text-blue-400 animate-pulse" color="#3b82f6" />
        <div className="text-xl font-bold tracking-tight">Carregando sistema...</div>
        <div className="text-slate-400 text-sm animate-pulse">Acedendo à base de dados Vercel</div>
      </div>
    );
  }

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

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setLang(l => l === 'pt' ? 'en' : 'pt')}
            className="flex items-center space-x-1.5 hover:text-white transition text-xs font-semibold cursor-pointer"
          >
            <Globe className="h-4 w-4 text-blue-400" />
            <span>{lang === 'pt' ? 'EN' : 'PT'}</span>
          </button>

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

      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        <aside className="w-64 border-r border-[#e2e8f0] bg-white p-5 space-y-6 hidden md:block print:hidden shadow-[1px_0_0_0_#e2e8f0]">
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
              Menu Geral
            </span>
            
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

            <button
              onClick={() => setActiveTab('roles')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'roles' 
                  ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Tag className="h-4 w-4" />
              <span>{lang === 'pt' ? 'Cargos' : 'Roles'}</span>
            </button>

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

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'notifications' 
                  ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span>{t.tabNotifications}</span>
            </button>
          </div>

          <div className="space-y-1.5 pt-4 border-t border-slate-100">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
              Relatórios & Sistema
            </span>
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
          </div>
        </aside>

        <main className="flex-1 p-6 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'dashboard' && session.role === 'admin' && (
                <AdminDashboard 
                  lang={lang} 
                  teachers={teachers} 
                  rooms={rooms} 
                  exams={exams} 
                  allocations={allocations} 
                  onAutoTrigger={handleAutoTriggerAll}
                  onAutoTriggerRooms={handleAutoTriggerRooms}
                  onClearAllocations={handleClearAllocationsAll}
                  onRefreshData={handleRefreshData}
                  isSystemTaskRunning={operationState.status === 'running'}
                />
              )}
              {activeTab === 'users' && session.role === 'admin' && (
                <UserManager lang={lang} />
              )}
              {activeTab === 'teachers' && (
                <TeacherManager 
                  lang={lang} 
                  teachers={teachers} 
                  onAddTeacher={handleAddTeacher}
                  onUpdateTeacher={handleUpdateTeacher}
                  onDeleteTeacher={handleDeleteTeacher}
                  onClearAllTeachers={handleClearAllTeachers}
                />
              )}
              {activeTab === 'roles' && (
                <RoleManager lang={lang} />
              )}
              {activeTab === 'rooms' && (
                <RoomManager 
                  lang={lang} 
                  rooms={rooms} 
                  onAddRoom={handleAddRoom}
                  onUpdateRoom={handleUpdateRoom}
                  onDeleteRoom={handleDeleteRoom}
                  onUpdateAllRooms={handleUpdateAllRooms}
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
                  onUpdateAllocation={handleUpdateAllocation}
                  onAutoTriggerForExam={handleAutoTriggerForExam}
                  onClearAllocationsForExam={handleClearAllocationsForExam}
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
              {activeTab === 'notifications' && (
                <NotificationSender 
                  lang={lang} 
                  teachers={teachers} 
                  exams={exams} 
                  rooms={rooms} 
                  allocations={allocations} 
                />
              )}
              {activeTab === 'backup' && (
                <BackupLogs 
                  lang={lang} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {operationState.open && (
        <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">{operationState.title}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {operationState.status === 'running'
                    ? (lang === 'pt' ? 'Processo em execução...' : 'Process in progress...')
                    : operationState.status === 'done'
                      ? (lang === 'pt' ? 'Processo concluído.' : 'Process completed.')
                      : (lang === 'pt' ? 'Processo interrompido com erro.' : 'Process stopped with error.')}
                </p>
              </div>
              <div className="shrink-0">
                {operationState.status === 'running' && <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />}
                {operationState.status === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                {operationState.status === 'error' && <AlertTriangle className="h-5 w-5 text-rose-600" />}
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      operationState.status === 'error' ? 'bg-rose-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${operationState.progress}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5 font-medium">
                  {operationState.progress}%
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 h-72 overflow-y-auto p-3 space-y-1.5 text-[11px] leading-relaxed">
                {operationState.logs.length === 0 && (
                  <p className="text-slate-400">
                    {lang === 'pt' ? 'A aguardar início...' : 'Waiting to start...'}
                  </p>
                )}
                {operationState.logs.map(log => (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-slate-400 shrink-0 font-mono">[{log.timestamp}]</span>
                    <span className={
                      log.level === 'error'
                        ? 'text-rose-700'
                        : log.level === 'warn'
                          ? 'text-amber-700'
                          : 'text-slate-700'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end">
              <button
                onClick={closeOperationModal}
                disabled={operationState.status === 'running'}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  operationState.status === 'running'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
