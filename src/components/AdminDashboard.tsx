/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Language, Teacher, Room, Exam, Allocation, NotificationLog } from '../types';
import { translations } from '../translations';
import { 
  Users, 
  Home, 
  Calendar, 
  Sparkles, 
  AlertTriangle, 
  RefreshCcw, 
  Trash2, 
  CheckCircle,
  Bell,
  MessageSquare,
  Send,
  Loader2
} from 'lucide-react';
import { hasSubjectConflict, getPeriodFromTime } from '../utils/scheduler';
import { api } from '../utils/api';

interface AdminDashboardProps {
  lang: Language;
  teachers: Teacher[];
  rooms: Room[];
  exams: Exam[];
  allocations: Allocation[];
  notificationsLog: NotificationLog[];
  onAutoTrigger: () => void;
  onClearAllocations: () => void;
}

export default function AdminDashboard({
  lang,
  teachers,
  rooms,
  exams,
  allocations,
  notificationsLog,
  onAutoTrigger,
  onClearAllocations
}: AdminDashboardProps) {
  const t = translations[lang];

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsAiLoading(true);
    setAiResponse('');

    try {
      const context = {
        teachersCount: teachers.length,
        roomsCount: rooms.length,
        examsCount: exams.length,
        allocationsCount: allocations.length,
        exams: exams.map(e => ({ name: e.name, date: e.date, subject: e.subject })),
        conflictsCount: 0 // Will be updated if we pass actual conflicts
      };

      const res = await api.ai.ask(aiPrompt, context);
      setAiResponse(res.text || 'Desculpe, não consegui processar o seu pedido.');
    } catch (error) {
      console.error('AI error:', error);
      setAiResponse('Ocorreu um erro ao comunicar com o assistente Gemini AI.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Logic Calculations
  const totalTeachers = teachers.length;
  const totalRooms = rooms.length;
  const totalExams = exams.length;

  // Let's calculate coverage
  // Let's calculate coverage
  // Total roles needing invigilators: each exam needs 2 invigilators per room associated to it
  let totalRolesNeeded = 0;
  exams.forEach(ex => {
    const examRoomsCount = ex.roomIds && ex.roomIds.length > 0 ? ex.roomIds.length : totalRooms;
    totalRolesNeeded += examRoomsCount * 2;
  });

  let rolesFilledCount = 0;
  allocations.forEach(alloc => {
    if (alloc.invigilator1Id) rolesFilledCount++;
    if (alloc.invigilator2Id) rolesFilledCount++;
  });

  const coveragePercent = totalRolesNeeded > 0 
    ? Math.min(Math.round((rolesFilledCount / totalRolesNeeded) * 100), 100)
    : 100;

  // Find conflicts
  const conflicts: string[] = [];
  const assignedTwiceMap = new Map<string, Array<{ examId: string; roomId: string }>>();

  allocations.forEach(alloc => {
    const examObj = exams.find(e => e.id === alloc.examId);
    const roomObj = rooms.find(r => r.id === alloc.roomId);
      
    if (!examObj || !roomObj) return;

    // Ignore rooms not associated to this exam if specific rooms are set up
    if (examObj.roomIds && examObj.roomIds.length > 0 && !examObj.roomIds.includes(roomObj.id)) return;

    const checkTeacherConflict = (teacherId: string | null, label: string) => {
      if (!teacherId) return;
      const tchr = teachers.find(p => p.id === teacherId);
      if (!tchr) return;

      // 1. Same subject
      if (hasSubjectConflict(tchr, examObj)) {
        conflicts.push(
          `${tchr.name} (${tchr.subject}) está alocado como ${label} na ${roomObj.name} para o exame de ${examObj.name}, violando o critério de compatibilidade disciplinar.`
        );
      }

      // 2. Double booking on the same date/time session
      const period = getPeriodFromTime(examObj.time);
      const key = `${teacherId}_${examObj.date}_${period}`;
      if (!assignedTwiceMap.has(key)) {
        assignedTwiceMap.set(key, []);
      }
      assignedTwiceMap.get(key)!.push({ examId: examObj.id, roomId: roomObj.id });
    };

    checkTeacherConflict(alloc.invigilator1Id, 'Vigilante 1');
    checkTeacherConflict(alloc.invigilator2Id, 'Vigilante 2');
    checkTeacherConflict(alloc.substituteId, 'Suplente');
  });

  assignedTwiceMap.forEach((places, key) => {
    if (places.length > 1) {
      const teacherId = key.split('_')[0];
      const tchr = teachers.find(p => p.id === teacherId);
      if (tchr) {
        conflicts.push(
          `${tchr.name} está alocado a múltiplas funções (${places.map(p => {
            const r = rooms.find(room => room.id === p.roomId);
            return r ? r.name : 'Desconhecida';
          }).join(', ')}) no mesmo dia e período escolar!`
        );
      }
    }
  });

  return (
    <div id="admin_dashboard" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">
            {lang === 'pt' ? 'Painel de Controlo Centralizado' : 'Centralized Control Center'}
          </h2>
          <p className="text-slate-400 text-xs">
            {lang === 'pt' 
              ? 'Consulte o estado geral das salas, alocações e conflitos disciplinar em tempo real.' 
              : 'Consult schools exams coverage, scales and subject exceptions in real-time.'}
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={onAutoTrigger}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow shadow-blue-700/10 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t.autoDistributeNow}</span>
          </button>
          <button
            onClick={onClearAllocations}
            className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow shadow-rose-900/10 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t.clearAllocations}</span>
          </button>
        </div>
      </div>

      {/* AI Assistant Section */}
      <div className="bg-gradient-to-br from-blue-900/10 to-indigo-900/10 border border-blue-200/50 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {lang === 'pt' ? 'Assistente de Planeamento Gemini AI' : 'Gemini AI Planning Assistant'}
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              {lang === 'pt' 
                ? 'Peça ajuda para otimizar horários ou analisar conflitos complexos.' 
                : 'Ask for help optimizing schedules or analyzing complex conflicts.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleAskAI} className="relative mb-4">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={lang === 'pt' ? "Ex: Analisa a distribuição de vigilâncias e sugere melhorias..." : "Ex: Analyze invigilation distribution and suggest improvements..."}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
          />
          <button
            type="submit"
            disabled={isAiLoading || !aiPrompt.trim()}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
          >
            {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        {aiResponse && (
          <div className="bg-white/80 border border-blue-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start space-x-3">
              <div className="mt-1 bg-slate-100 p-1 rounded">
                <MessageSquare className="h-3 w-3 text-slate-500" />
              </div>
              <div className="prose prose-sm max-w-none">
                {aiResponse.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 last:mb-0">{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid statistics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Teachers */}
        <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wider block">
              {t.statsTotalTeachers}
            </span>
            <span className="text-2xl font-bold text-slate-800 font-mono">
              {totalTeachers}
            </span>
            <div className="text-[11px] text-slate-500">
              {teachers.filter(tchr => tchr.available).length} disponíveis / {teachers.filter(tchr => !tchr.available).length} indisponíveis
            </div>
          </div>
          <div className="h-10 w-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Rooms */}
        <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wider block">
              {t.statsActiveRooms}
            </span>
            <span className="text-2xl font-bold text-slate-800 font-mono">
              {totalRooms}
            </span>
            <div className="text-[11px] text-slate-500">
              Estudantes sentados: {rooms.reduce((acc, r) => acc + Number(r.capacity), 0)} no total
            </div>
          </div>
          <div className="h-10 w-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Home className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Exams */}
        <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wider block">
              {t.statsTotalExams}
            </span>
            <span className="text-2xl font-bold text-slate-800 font-mono">
              {totalExams}
            </span>
            <div className="text-[11px] text-slate-500">
              Vigilantes necessários: {totalRolesNeeded}
            </div>
          </div>
          <div className="h-10 w-10 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center text-blue-600">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Coverage progress */}
        <div className="bg-white border border-slate-200 shadow-sm p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1 w-full mr-2">
            <span className="text-slate-500 text-xs font-medium uppercase tracking-wider block">
              {t.statsCoverage}
            </span>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-slate-800 font-mono">
                {coveragePercent}%
              </span>
              <span className="text-xs text-slate-500">
                ({rolesFilledCount}/{totalRolesNeeded})
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div 
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  coveragePercent === 100 
                    ? 'bg-blue-600' 
                    : coveragePercent > 60 
                      ? 'bg-amber-500' 
                      : 'bg-rose-500'
                }`}
                style={{ width: `${coveragePercent}%` }}
              ></div>
            </div>
          </div>
          <div className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-lg flex-shrink-0 flex items-center justify-center text-slate-500">
            {coveragePercent === 100 ? (
              <CheckCircle className="h-5 w-5 text-blue-600" />
            ) : (
              <div className="text-xs font-semibold text-amber-600 font-mono">!</div>
            )}
          </div>
        </div>
      </div>

      {/* Main split sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Conflicts list */}
        <div className="lg:col-span-7 bg-white border border-slate-200 shadow-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-slate-800 text-sm">
                {t.warningsList} ({conflicts.length})
              </h3>
            </div>
            {conflicts.length === 0 && (
              <span className="text-blue-600 bg-blue-50 text-xs px-2.5 py-0.5 rounded-full font-medium">
                Regras cumpridas
              </span>
            )}
          </div>

          {conflicts.length > 0 ? (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {conflicts.map((conf, index) => (
                <div 
                  key={index} 
                  className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-3 text-xs text-amber-900 flex items-start space-x-3"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed font-medium">{conf}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs">
              <CheckCircle className="h-8 w-8 text-blue-500 mx-auto mb-2 opacity-70" />
              <p>Nenhum conflito disciplinar ou de horário detetado de momento!</p>
              <p className="text-[11px] text-slate-400/80 mt-1">Todos os docentes estão compatíveis nas salas alocadas.</p>
            </div>
          )}
        </div>

        {/* Back notifications feed */}
        <div className="lg:col-span-5 bg-white border border-slate-200 shadow-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-indigo-500" />
              <h3 className="font-semibold text-slate-800 text-sm">
                {t.recentActivity}
              </h3>
            </div>
            <span className="text-indigo-600 bg-indigo-50 text-[10px] px-2 py-0.5 rounded font-mono font-semibold">
              Live Feed
            </span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {notificationsLog.length > 0 ? (
              notificationsLog.slice().reverse().map((log) => (
                <div 
                  key={log.id} 
                  className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:border-slate-200 transition text-xs space-y-1"
                >
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span className="font-medium text-slate-700">{log.recipientName}</span>
                    <span>{log.timestamp}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-[11px]">{log.title}</h4>
                  <p className="text-slate-600 line-clamp-2 text-[11px]">{log.message}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                <p>{t.noActivity}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
