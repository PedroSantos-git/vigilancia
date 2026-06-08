/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Language, Teacher, Room, Exam, Allocation } from '../types';
import { translations } from '../translations';
import { 
  Users, 
  Home, 
  Calendar, 
  Sparkles, 
  AlertTriangle, 
  Trash2, 
  CheckCircle,
  MessageSquare,
  Send,
  Loader2,
  FileText,
  X
} from 'lucide-react';
import {
  examIncludesRoom,
  findAllocationForExamRoom,
  formatExamLabel,
  hasAssignedTeacher
} from '../utils/allocations';
import {
  getPeriodFromTime,
  hasNoSpecialRole,
  hasSubjectConflict,
  isFloorZero,
  isTeacherUnavailableAt
} from '../utils/scheduler';
import { api } from '../utils/api';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  lang: Language;
  teachers: Teacher[];
  rooms: Room[];
  exams: Exam[];
  allocations: Allocation[];
  onAutoTrigger: () => void;
  onAutoTriggerRooms: () => void;
  onClearRooms: () => void;
  onClearAllocations: () => Promise<void> | void;
  onRefreshData: () => void;
  isSystemTaskRunning?: boolean;
}

export default function AdminDashboard({
  lang,
  teachers,
  rooms,
  exams,
  allocations,
  onAutoTrigger,
  onAutoTriggerRooms,
  onClearRooms,
  onClearAllocations,
  onRefreshData,
  isSystemTaskRunning = false
}: AdminDashboardProps) {
  const t = translations[lang];

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Clear Confirmation State
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

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
        exams: exams.map(e => ({ name: e.name, date: e.date, code: e.code })),
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

  const availableTeachers = teachers.filter(t => t.available && hasNoSpecialRole(t));
  const unavailableTeachersCount = totalTeachers - availableTeachers.length;

  // Let's calculate coverage
  // Total roles needing invigilators: each exam needs 2 invigilators + 1 substitute PER ROOM assigned
  let totalRolesNeeded = 0;
  if (Array.isArray(exams)) {
    exams.forEach(ex => {
      // Rule: if no rooms are assigned, zero invigilators needed
      const examRoomsCount = Array.isArray(ex.roomIds) ? ex.roomIds.length : 0;
      totalRolesNeeded += examRoomsCount * 3;
    });
  }

  let rolesFilledCount = 0;
  if (Array.isArray(allocations)) {
    allocations.forEach(alloc => {
      const exam = exams.find(e => e.id === alloc.examId);
      // Only count allocations for rooms that are still associated to the exam
      if (exam && examIncludesRoom(exam, alloc.roomId)) {
        if (hasAssignedTeacher(alloc.invigilator1Id)) rolesFilledCount++;
        if (hasAssignedTeacher(alloc.invigilator2Id)) rolesFilledCount++;
        if (hasAssignedTeacher(alloc.substituteId)) rolesFilledCount++;
      }
    });
  }

  const coveragePercent = totalRolesNeeded > 0 
    ? Math.min(Math.round((rolesFilledCount / totalRolesNeeded) * 100), 100)
    : 100;

  // Find conflicts and coverage gaps
  const conflicts: string[] = [];
  const assignedTwiceMap = new Map<string, Array<{ examId: string; roomId: string; label: string }>>();

  const addTeacherSlotCheck = (
    teacherId: string | null,
    label: string,
    examObj: Exam,
    roomObj: Room
  ) => {
    if (!teacherId) return;
    const tchr = teachers.find(p => p.id === teacherId);
    if (!tchr) {
      conflicts.push(`Docente inexistente (${teacherId}) atribuído como ${label} na ${roomObj.name} (${examObj.name}).`);
      return;
    }

    if (hasSubjectConflict(tchr, examObj)) {
      conflicts.push(
        `${tchr.name} (${tchr.subject}) está alocado como ${label} na ${roomObj.name} para o exame de ${examObj.name}, violando o critério de compatibilidade disciplinar.`
      );
    }

    if (!tchr.available) {
      conflicts.push(
        `${tchr.name} está marcado como indisponível mas foi atribuído como ${label} na ${roomObj.name} (${examObj.name}).`
      );
    }

    if (isTeacherUnavailableAt(tchr, examObj.date, examObj.time, examObj)) {
      conflicts.push(
        `${tchr.name} tem indisponibilidade registada e foi atribuído como ${label} na ${roomObj.name} (${examObj.name}, ${examObj.date}).`
      );
    }

    if (tchr.PISO_ZERO && !isFloorZero(roomObj)) {
      conflicts.push(
        `${tchr.name} (Piso 0) foi atribuído à ${roomObj.name}, que não é de piso 0 (${examObj.name}).`
      );
    }

    const period = getPeriodFromTime(examObj.time);
    const periodKey = `${teacherId}@@${examObj.date}@@${period}`;
    if (!assignedTwiceMap.has(periodKey)) {
      assignedTwiceMap.set(periodKey, []);
    }
    assignedTwiceMap.get(periodKey)!.push({ examId: examObj.id, roomId: roomObj.id, label });
  };

  if (Array.isArray(exams)) {
    exams.forEach(examObj => {
      const examRoomIds = Array.isArray(examObj.roomIds) ? examObj.roomIds : [];
      if (examRoomIds.length === 0) return;

      const examRooms = rooms.filter(r => examRoomIds.some(id => String(id) === String(r.id)));
      const examLabel = formatExamLabel(examObj);

      examRooms.forEach(roomObj => {
        const alloc = findAllocationForExamRoom(allocations, examObj.id, roomObj.id, rooms);

        if (!alloc) {
          conflicts.push(`Sem escala registada na ${roomObj.name} (${examLabel}).`);
          return;
        }

        if (!hasAssignedTeacher(alloc.invigilator1Id)) {
          conflicts.push(`Falta Vigilante 1 na ${roomObj.name} (${examLabel}).`);
        }
        if (!hasAssignedTeacher(alloc.invigilator2Id)) {
          conflicts.push(`Falta Vigilante 2 na ${roomObj.name} (${examLabel}).`);
        }
        if (!hasAssignedTeacher(alloc.substituteId)) {
          conflicts.push(`Falta Suplente na ${roomObj.name} (${examLabel}).`);
        }

        addTeacherSlotCheck(alloc.invigilator1Id, 'Vigilante 1', examObj, roomObj);
        addTeacherSlotCheck(alloc.invigilator2Id, 'Vigilante 2', examObj, roomObj);
        addTeacherSlotCheck(alloc.substituteId, 'Suplente', examObj, roomObj);
      });

      if (examObj.EE && examRooms.length > 0) {
        const firstRoom = [...examRooms].sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        })[0];
        const firstAlloc = findAllocationForExamRoom(allocations, examObj.id, firstRoom.id, rooms);
        if (firstAlloc) {
          const v1 = teachers.find(t => t.id === firstAlloc.invigilator1Id);
          if (firstAlloc.invigilator1Id && v1 && !v1.EE) {
            conflicts.push(`Exame EE ${examObj.name}: Vigilante 1 na ${firstRoom.name} não é docente EE.`);
          }
          if (!firstAlloc.invigilator1Id) {
            conflicts.push(`Exame EE ${examObj.name}: falta Vigilante 1 EE na primeira sala (${firstRoom.name}).`);
          }
        }
      }
    });
  }

  assignedTwiceMap.forEach((places, key) => {
    if (places.length <= 1) return;
    const teacherId = key.split('@@')[0];
    const date = key.split('@@')[1];
    const period = key.split('@@')[2];
    const periodLabel = period === '14:00' ? 'tarde' : 'manhã';
    const tchr = teachers.find(p => p.id === teacherId);
    if (tchr) {
      conflicts.push(
        `${tchr.name} está alocado a múltiplas funções (${places.map(p => {
          const r = rooms.find(room => room.id === p.roomId);
          return `${p.label} em ${r ? r.name : 'Desconhecida'}`;
        }).join(', ')}) no mesmo período (${date}, ${periodLabel})!`
      );
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onAutoTriggerRooms}
            disabled={isSystemTaskRunning}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow shadow-blue-900/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSystemTaskRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Home className="h-3.5 w-3.5" />}
            <span>{lang === 'pt' ? 'Atribuir salas' : 'Assign rooms'}</span>
          </button>
          <button
            onClick={onClearRooms}
            disabled={isSystemTaskRunning}
            className="flex items-center space-x-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow shadow-slate-900/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Home className="h-3.5 w-3.5" />
            <span>{lang === 'pt' ? 'Limpar salas' : 'Clear rooms'}</span>
          </button>
          <button
            onClick={onAutoTrigger}
            disabled={isSystemTaskRunning}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow shadow-indigo-900/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSystemTaskRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
            <span>{lang === 'pt' ? 'Atribuir vigilantes' : 'Assign invigilators'}</span>
          </button>
          <button
            onClick={() => {
              setConfirmInput('');
              setIsClearModalOpen(true);
            }}
            className="flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow shadow-amber-900/10 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{lang === 'pt' ? 'Limpar vigilantes' : 'Clear invigilators'}</span>
          </button>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex justify-between items-center">
              <h3 className="font-bold text-rose-800 text-sm flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <span>{t.clearConfirmTitle}</span>
              </h3>
              <button onClick={() => setIsClearModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {t.clearConfirmMessage}
                <br />
                <strong className="text-rose-600 font-mono text-sm block mt-2 text-center select-all">
                  {t.confirmPhrase}
                </strong>
              </p>

              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={t.clearConfirmPlaceholder}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
              />

              <div className="flex flex-col space-y-2 pt-2">
                <button
                  disabled={confirmInput !== t.confirmPhrase}
                  onClick={async () => {
                    await Promise.resolve(onClearAllocations());
                    setIsClearModalOpen(false);
                  }}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition flex items-center justify-center space-x-2 ${
                    confirmInput === t.confirmPhrase
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{t.clearConfirmButton}</span>
                </button>
                <button
                  onClick={() => setIsClearModalOpen(false)}
                  className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              {availableTeachers.length} disponíveis / {unavailableTeachersCount} indisponíveis
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
        <div className="lg:col-span-12 bg-white border border-slate-200 shadow-sm rounded-xl p-5">
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
              <p>Nenhum conflito, indisponibilidade ou vaga em falta detetados de momento!</p>
              <p className="text-[11px] text-slate-400/80 mt-1">Escalas completas e compatíveis com as regras de atribuição.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
