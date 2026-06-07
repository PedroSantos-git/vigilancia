/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Exam, Room, Language } from '../types';
import { translations } from '../translations';
import { getPeriodFromTime } from '../utils/scheduler';
import {   Home, 
  Check, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  HelpCircle,
  Hash,
  Layers,
  Sparkles,
  Bookmark
} from 'lucide-react';

interface ExamRoomManagerProps {
  lang: Language;
  exams: Exam[];
  rooms: Room[];
  onUpdateExam: (exam: Exam) => void;
}

export default function ExamRoomManager({
  lang,
  exams,
  rooms,
  onUpdateExam
}: ExamRoomManagerProps) {
  const t = translations[lang];

  // Active / Selected Exam for Association
  const [selectedExamId, setSelectedExamId] = useState<string>(exams[0]?.id || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fallback if there are no exams or rooms
  if (exams.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
        <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-2">
          {lang === 'pt' ? 'Sem Exames Registados' : 'No Exams Registered'}
        </p>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {t.examsListEmptyError}
        </p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
        <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-2">
          {lang === 'pt' ? 'Sem Salas Registadas' : 'No Rooms Registered'}
        </p>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          {t.roomsListEmptyError}
        </p>
      </div>
    );
  }

  // Active Exam
  const currentExam = exams.find(e => e.id === selectedExamId) || exams[0];

  // Group exams by date and sort
  const groupExamsByDate = () => {
    const groups: { [date: string]: Exam[] } = {};
    
    // Sort all exams first: time -> name -> modality
    const sortedExams = [...exams].sort((a, b) => {
      // 1. Time
      if (a.time !== b.time) return a.time.localeCompare(b.time);
      // 2. Name
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      // 3. Modality (variant)
      const modA = a.variant || '';
      const modB = b.variant || '';
      return modA.localeCompare(modB);
    });

    sortedExams.forEach(ex => {
      if (!groups[ex.date]) groups[ex.date] = [];
      groups[ex.date].push(ex);
    });

    // Return sorted dates
    return Object.keys(groups).sort().map(date => ({
      date,
      exams: groups[date]
    }));
  };

  const groupedExams = groupExamsByDate();

  // Helper to add minutes to time string "HH:mm"
  const addMinutes = (timeStr: string, minutes: number): string => {
    const [hours, mins] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins + minutes, 0, 0);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Helper to compare two time strings "HH:mm"
  const isTimeBefore = (t1: string, t2: string): boolean => {
    return t1.localeCompare(t2) < 0;
  };

  // Room Association Status Helper
  // Returns conflicting exam or status if there is an overlapping reservation
  const getRoomStatus = (room: Room, examToCheck: Exam): { 
    status: 'free' | 'occupied' | 'warning', 
    conflictingExam?: Exam,
    message?: string 
  } => {
    // Find all exams on the same day that use this room
    const examsInRoom = exams.filter(ex => 
      ex.date === examToCheck.date && 
      ex.roomIds?.includes(room.id) &&
      ex.id !== examToCheck.id
    );

    for (const otherEx of examsInRoom) {
      const otherStart = otherEx.time;
      const otherEnd = addMinutes(otherStart, (otherEx.duration || 120) + (otherEx.tolerance || 30));
      const bufferEnd = addMinutes(otherEnd, 45); // 45 min buffer for "free" status

      const currentStart = examToCheck.time;
      const currentEnd = addMinutes(currentStart, (examToCheck.duration || 120) + (examToCheck.tolerance || 30));

      // 1. Absolute overlap (Occupied)
      // If current exam starts before other exam ends, it's occupied
      if (isTimeBefore(currentStart, otherEnd) && isTimeBefore(otherStart, currentEnd)) {
        return { 
          status: 'occupied', 
          conflictingExam: otherEx,
          message: lang === 'pt' ? 'Ocupada / Conflito' : 'Occupied / Conflict'
        };
      }

      // 2. Warning period (within 45 min of previous exam end)
      // If current exam starts after other exam ends, but before buffer ends
      if (!isTimeBefore(currentStart, otherEnd) && isTimeBefore(currentStart, bufferEnd)) {
        return { 
          status: 'warning', 
          conflictingExam: otherEx,
          message: lang === 'pt' ? 'Atenção: Intervalo Curto' : 'Warning: Short Buffer'
        };
      }
    }

    return { status: 'free' };
  };

  const handleToggleRoom = (roomId: string) => {
    const currentRoomIds = currentExam.roomIds || [];
    let updatedRoomIds: string[] = [];

    if (currentRoomIds.includes(roomId)) {
      // Disassociate
      updatedRoomIds = currentRoomIds.filter(id => id !== roomId);
    } else {
      // Verify conflict before adding
      const room = rooms.find(r => r.id === roomId);
      if (room) {
        const { status, conflictingExam } = getRoomStatus(room, currentExam);
        if (status === 'occupied' && conflictingExam) {
          alert(
            lang === 'pt'
              ? `Impossível Associar!\nA sala "${room.name}" já se encontra em uso no Exame "${conflictingExam.name}" no mesmo dia (${conflictingExam.date}) e ainda não terá terminado (Duração + Tolerância).`
              : `Cannot Associate!\nRoom "${room.name}" is already reserved for Exam "${conflictingExam.name}" and won't be finished yet (Duration + Tolerance).`
          );
          return;
        }
      }
      // Associate
      updatedRoomIds = [...currentRoomIds, roomId];
    }

    const updatedExam = {
      ...currentExam,
      roomIds: updatedRoomIds
    };

    onUpdateExam(updatedExam);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Home className="h-5 w-5 text-blue-600" />
              <span>{t.examRoomsTitle}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              {t.examRoomsSubtitle}
            </p>
          </div>
          
          {saveSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 animate-pulse">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>{lang === 'pt' ? 'Alterações persistidas na nuvem!' : 'Changes synced successfully!'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Interactive Exam Selector (Tree Structure) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {t.selectExamToAssociate}
          </label>
          
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {groupedExams.map(group => (
              <div key={group.date} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                    {group.date}
                  </span>
                </div>
                
                <div className="space-y-2 pl-3 border-l-2 border-slate-100">
                  {group.exams.map(ex => {
                    const numRoomsAssoc = ex.roomIds?.length || 0;
                    const roomsNeeded = ex.roomsNeeded || 1;
                    const isSelected = ex.id === selectedExamId;

                    let statusColor = 'bg-slate-100 text-slate-500';
                    let borderColor = 'border-slate-150';
                    
                    if (numRoomsAssoc === 0) {
                      statusColor = 'bg-rose-100 text-rose-700';
                      if (isSelected) borderColor = 'border-rose-500';
                    } else if (numRoomsAssoc < roomsNeeded) {
                      statusColor = 'bg-amber-100 text-amber-800';
                      if (isSelected) borderColor = 'border-amber-500';
                    } else {
                      statusColor = 'bg-emerald-100 text-emerald-800';
                      if (isSelected) borderColor = 'border-emerald-600';
                    }

                    return (
                      <button
                        key={ex.id}
                        onClick={() => setSelectedExamId(ex.id)}
                        className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1 cursor-pointer ${
                          isSelected
                            ? `${borderColor} bg-blue-50/75 shadow-sm`
                            : 'bg-white border-slate-150 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className={`text-[11px] font-bold leading-tight ${
                            isSelected ? 'text-blue-900' : 'text-slate-800'
                          }`}>
                            {ex.name}
                          </span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                            {numRoomsAssoc} / {roomsNeeded}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5 text-slate-400" />
                            {ex.time}
                          </span>
                          {ex.code && (
                            <span className="bg-slate-100 text-slate-600 px-1 rounded font-mono">
                              {ex.code}
                            </span>
                          )}
                          {ex.variant && (
                            <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-1 rounded">
                              {ex.variant}
                            </span>
                          )}
                          {ex.modality && (
                            <span className="bg-blue-50 text-blue-700 px-1 rounded">
                              {ex.modality}
                            </span>
                          )}
                          <span className="bg-slate-100 px-1 rounded">{ex.year}º Ano</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Physical Rooms Check-list and Overlap Safeguards */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Detail card of selected Exam - COMPREHENSIVE VIEW */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-850">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest bg-blue-600/35 border border-blue-500/25 text-blue-300 px-2 py-0.5 rounded">
                    {lang === 'pt' ? 'Exame Ativo' : 'Selected Exam'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {currentExam.id}
                  </span>
                </div>
                
                <div>
                  <h3 className="text-xl font-black tracking-tight text-white">
                    {currentExam.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Calendar className="h-3.5 w-3.5 text-blue-500" />
                      <span className="font-bold text-slate-200">{currentExam.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                      <span className="font-bold text-slate-200">{currentExam.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Layers className="h-3.5 w-3.5 text-blue-500" />
                      <span className="font-bold text-slate-200">Fase {currentExam.phase}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/30">
                    <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Ano</span>
                    <span className="text-xs font-bold text-slate-200">{currentExam.year}º Ano</span>
                  </div>
                  <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/30">
                    <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Código</span>
                    <span className="text-xs font-bold text-slate-200">{currentExam.code || '---'}</span>
                  </div>
                  <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/30">
                    <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Variante</span>
                    <span className="text-xs font-bold text-slate-200">{currentExam.variant || 'Standard'}</span>
                  </div>
                  <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/30">
                    <span className="block text-[9px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Modalidade</span>
                    <span className="text-xs font-bold text-slate-200">{currentExam.modality || 'Regular'}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-600 rounded-2xl p-5 text-center flex flex-col justify-center shadow-lg shadow-blue-600/20 border border-blue-500/50 min-w-[120px]">
                <span className="text-[10px] text-blue-100 uppercase tracking-widest font-bold">
                  {lang === 'pt' ? 'Salas' : 'Rooms'}
                </span>
                <span className="text-3xl font-black text-white mt-1">
                  {currentExam.roomIds?.length || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
              {t.roomsAvailableForAssociation}
            </h4>

            {/* List of Rooms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {rooms.map(room => {
                const isAssoc = currentExam.roomIds?.includes(room.id);
                const { status, conflictingExam, message } = getRoomStatus(room, currentExam);

                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      if (status !== 'occupied') {
                        handleToggleRoom(room.id);
                      } else {
                        handleToggleRoom(room.id);
                      }
                    }}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 cursor-pointer select-none relative overflow-hidden ${
                      isAssoc 
                        ? 'border-emerald-600 bg-emerald-50/35 relative' 
                        : status === 'occupied'
                          ? 'border-rose-250 bg-rose-50/20 opacity-60 cursor-not-allowed'
                          : status === 'warning'
                            ? 'border-amber-400 bg-amber-50/40'
                            : 'border-slate-150 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {/* Ribbon or corner item */}
                    {isAssoc && (
                      <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/10 flex items-center justify-center rounded-bl-xl text-emerald-600">
                        <Check className="h-4 w-4" />
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`p-1 rounded ${status === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                          <Home className="h-3.5 w-3.5" />
                        </span>
                        <span className={`text-xs font-bold ${status === 'warning' ? 'text-amber-900' : 'text-slate-800'}`}>
                          {room.name}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                        <Hash className="h-3 w-3 text-slate-400" />
                        <span>Capacidade: <strong>{room.capacity}</strong> pax</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2.5 mt-1 flex justify-between items-center">
                      {isAssoc ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                          <Check className="h-2.5 w-2.5" />
                          {t.associatedBadge}
                        </span>
                      ) : status === 'occupied' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {message}
                        </span>
                      ) : status === 'warning' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="h-2.5 w-2.5" />
                          {message}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wide">
                          {t.idleBadge}
                        </span>
                      )}

                      {conflictingExam && (
                        <div className={`text-[9px] max-w-[150px] truncate leading-none italic ${status === 'warning' ? 'text-amber-700' : 'text-rose-700'}`}>
                          ({conflictingExam.name})
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
