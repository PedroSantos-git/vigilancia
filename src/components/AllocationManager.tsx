/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Exam, Room, Teacher, Allocation, Language } from '../types';
import { translations } from '../translations';
import { 
  Sparkles, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Filter,
  Search,
  X,
  Calendar,
  Clock,
  Home,
  Layers
} from 'lucide-react';
import { findAllocationForExamRoom } from '../utils/allocations';
import { getPeriodFromTime, hasSubjectConflict, isTeacherUnavailableAt } from '../utils/scheduler';

interface AllocationManagerProps {
  lang: Language;
  teachers: Teacher[];
  rooms: Room[];
  exams: Exam[];
  allocations: Allocation[];
  onAutoTriggerForExam: (examId: string) => void;
  onClearAllocationsForExam: (examId: string) => void;
  onUpdateAllocation: (allocation: Allocation) => void;
}

export default function AllocationManager({
  lang,
  teachers,
  rooms,
  exams,
  allocations,
  onAutoTriggerForExam,
  onClearAllocationsForExam,
  onUpdateAllocation
}: AllocationManagerProps) {
  const t = translations[lang];

  // Selected Exam State
  const [selectedExamId, setSelectedExamId] = useState(exams[0]?.id || '');

  // Dropdown filter options
  const [hideBusy, setHideBusy] = useState(true);
  const [hideIncompatible, setHideIncompatible] = useState(true);

  // Manual Teacher Picker Popover/Modal State
  const [pickerSlot, setPickerSlot] = useState<{
    allocation: Allocation;
    roomId: string;
    roleKey: 'invigilator1Id' | 'invigilator2Id' | 'substituteId';
    roleLabel: string;
    roomName: string;
  } | null>(null);

  const [pickerSearch, setPickerSearch] = useState('');

  // Group exams by date and sort
  const groupExamsByDate = () => {
    const groups: { [date: string]: Exam[] } = {};
    const sortedExams = [...exams].sort((a, b) => {
      if (a.time !== b.time) return a.time.localeCompare(b.time);
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      return (a.variant || '').localeCompare(b.variant || '');
    });
    sortedExams.forEach(ex => {
      if (!groups[ex.date]) groups[ex.date] = [];
      groups[ex.date].push(ex);
    });
    return Object.keys(groups).sort().map(date => ({
      date,
      exams: groups[date]
    }));
  };

  const groupedExams = groupExamsByDate();

  // Pick current selected exam
  const currentExam = exams.find(e => e.id === selectedExamId) || exams[0];

  if (!currentExam) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-xs">
        {lang === 'pt' ? 'Cadastre pelo menos 1 exame para aceder às escalas.' : 'Register at least 1 exam to access scaling.'}
      </div>
    );
  }

  // Get allocations for this exam
  const examAllocations = Array.isArray(allocations) ? allocations.filter(a => a.examId === currentExam.id) : [];

  // Filter rooms associated with this exam.
  const hasSpecificRooms = Array.isArray(currentExam.roomIds) && currentExam.roomIds.length > 0;
  
  const filteredRooms = hasSpecificRooms 
    ? rooms.filter(room => currentExam.roomIds?.includes(room.id))
    : [];

  // Create allocation shells
  const activeRoomsAllocations = filteredRooms.map(room => {
    let existing = findAllocationForExamRoom(allocations, currentExam.id, room.id, rooms);
    if (!existing) {
      existing = {
        id: `${currentExam.id}_${room.id}`,
        examId: currentExam.id,
        roomId: room.id,
        invigilator1Id: null,
        invigilator2Id: null,
        substituteId: null
      };
    }
    return {
      room,
      allocation: existing
    };
  });

  // Check if a teacher is busy elsewhere on the same day (excluding current exam/room)
  const isTeacherBusyElsewhere = (teacherId: string, currentAllocId: string): boolean => {
    if (!Array.isArray(allocations)) return false;
    const currentPeriod = getPeriodFromTime(currentExam.time);
    return allocations.some(alloc => {
      if (alloc.id === currentAllocId) return false;
      const ex = exams.find(e => e.id === alloc.examId);
      if (!ex || ex.date !== currentExam.date) return false;
      if (getPeriodFromTime(ex.time) !== currentPeriod) return false;
      return (
        alloc.invigilator1Id === teacherId ||
        alloc.invigilator2Id === teacherId ||
        alloc.substituteId === teacherId
      );
    });
  };

  const getTeacherValidationState = (
    teacherId: string | null,
    currentAllocId: string,
    roleLabel: string
  ) => {
    if (!teacherId) return { state: 'empty', label: 'Vago', color: 'text-slate-400' };
    const teacher = teachers.find(tchr => tchr.id === teacherId);
    if (!teacher) return { state: 'notfound', label: 'Inexistente', color: 'text-slate-400' };

    const isUnavailable = !teacher.available || isTeacherUnavailableAt(teacher, currentExam.date, currentExam.time, currentExam);
    if (isUnavailable) {
      return {
        state: 'critical',
        label: lang === 'pt' ? 'Conflito: Indisponibilidade' : 'Conflict: Unavailability',
        color: 'text-rose-600 font-semibold'
      };
    }

    const isSpecialtyConflict = hasSubjectConflict(teacher, currentExam);
    const isBusy = isTeacherBusyElsewhere(teacherId, currentAllocId);

    if (isSpecialtyConflict && isBusy) return { state: 'critical', label: lang === 'pt' ? 'Conflito: Especialidade + Horário' : 'Conflict: Subject & Time', color: 'text-red-500' };
    if (isSpecialtyConflict) return { state: 'conflict_subject', label: lang === 'pt' ? 'Conflito: Especialidade' : 'Subject Conflict', color: 'text-amber-600' };
    if (isBusy) return { state: 'conflict_busy', label: lang === 'pt' ? 'Conflito: Horário' : 'Time Conflict', color: 'text-rose-500' };

    return { state: 'valid', label: t.noConflict, color: 'text-blue-600' };
  };

  const handleSelectTeacher = (
    allocation: Allocation,
    roomId: string,
    roleKey: 'invigilator1Id' | 'invigilator2Id' | 'substituteId',
    newValue: string
  ) => {
    const updated = {
      ...allocation,
      [roleKey]: newValue === "" ? null : newValue
    };
    onUpdateAllocation(updated);
  };

  return (
    <div id="allocation_manager" className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <span>{t.allocationTitle}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t.allocationSubtitle}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onClearAllocationsForExam(currentExam.id)}
            className="flex items-center space-x-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold px-4 py-2.5 rounded-lg transition cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{lang === 'pt' ? 'Limpar Escala' : 'Clear scale'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tree Selector */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {t.selectExam}
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
                    const isSelected = ex.id === currentExam.id;
                    const examRooms = rooms.filter(r => ex.roomIds?.includes(r.id));
                    const totalCapacity = examRooms.reduce((sum, room) => sum + (room.capacity || 0), 0);
                    const registrations = ex.registrationsCount || 0;
                    const isInsufficient = totalCapacity < registrations;

                    return (
                      <div key={ex.id} className="space-y-1">
                        <button
                          onClick={() => setSelectedExamId(ex.id)}
                          className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/75 border-blue-600 shadow-sm'
                              : 'bg-white border-slate-150 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className={`text-[11px] font-bold leading-tight ${
                              isSelected ? 'text-blue-900' : 'text-slate-800'
                            }`}>
                              {ex.name}
                            </span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                              examRooms.length === 0 
                                ? 'bg-rose-100 text-rose-700' 
                                : isInsufficient
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {totalCapacity} / {registrations}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-500 flex flex-wrap items-center gap-2">
                            <Clock className="h-2.5 w-2.5" />
                            {ex.time}
                            {ex.code && <span className="bg-slate-100 text-slate-600 px-1 rounded font-mono">{ex.code}</span>}
                            {ex.variant && <span className="bg-amber-50 text-amber-700 px-1 rounded">{ex.variant}</span>}
                            {ex.modality && <span className="bg-blue-50 text-blue-700 px-1 rounded">{ex.modality}</span>}
                          </div>
                        </button>

                        {/* Rooms Tree Branch (if selected) */}
                        {isSelected && examRooms.length > 0 && (
                          <div className="pl-4 space-y-1 pt-1">
                            {examRooms.map(room => (
                              <div key={room.id} className="flex items-center gap-2 text-[10px] text-slate-500 py-0.5">
                                <Home className="h-3 w-3 text-slate-300" />
                                <span className="truncate">{room.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Full Details & Allocations */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Detailed Exam Header */}
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
            </div>
          </div>

          {!hasSpecificRooms ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-12 text-center shadow-sm">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
              <h4 className="text-sm font-bold text-amber-900 mb-2">Este exame não tem salas atribuídas.</h4>
              <p className="text-xs text-amber-700 max-w-sm mx-auto leading-relaxed">
                Para definir os vigilantes e suplentes, é necessário primeiro associar as salas onde este exame será realizado no menu <strong className="font-bold uppercase tracking-tighter underline">Associações Salas/Exames</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-600">
                <div className="flex items-center space-x-2 text-blue-600 font-bold uppercase tracking-tight">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filtros Dinâmicos:</span>
                </div>
                <div className="flex flex-wrap gap-4 font-semibold">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={hideBusy} onChange={(e) => setHideBusy(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span>{t.filterExcludeBusy}</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={hideIncompatible} onChange={(e) => setHideIncompatible(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <span>{t.filterExcludeIncompatible}</span>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                {activeRoomsAllocations.map(({ room, allocation }) => {
                  const val1 = getTeacherValidationState(allocation.invigilator1Id, allocation.id, 'Vigilante 1');
                  const val2 = getTeacherValidationState(allocation.invigilator2Id, allocation.id, 'Vigilante 2');
                  const val3 = getTeacherValidationState(allocation.substituteId, allocation.id, 'Suplente');
                  
                  const optionsList = (currentSelectedId: string | null, roleKey: string) => {
                    return teachers.filter(tchr => {
                      if (tchr.id === currentSelectedId) return true;
                      const isAssignedElsewhereInRoom = 
                        (roleKey !== 'invigilator1Id' && allocation.invigilator1Id === tchr.id) ||
                        (roleKey !== 'invigilator2Id' && allocation.invigilator2Id === tchr.id) ||
                        (roleKey !== 'substituteId' && allocation.substituteId === tchr.id);
                      if (isAssignedElsewhereInRoom) return false;
                      if (!tchr.available || isTeacherUnavailableAt(tchr, currentExam.date, currentExam.time, currentExam)) return false;
                      if (hideBusy && isTeacherBusyElsewhere(tchr.id, allocation.id)) return false;
                      if (hideIncompatible && hasSubjectConflict(tchr, currentExam)) return false;
                      return true;
                    });
                  };

                  return (
                    <div key={room.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 hover:border-blue-200 transition">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-3 border-r border-slate-100 pr-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-slate-100 p-1.5 rounded-lg"><Home className="h-4 w-4 text-slate-600" /></div>
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">{room.name}</h3>
                          </div>
                          <div className="text-[10px] text-slate-500 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="font-bold uppercase tracking-wider">{t.capacity}: {room.capacity}</span>
                          </div>
                        </div>

                        <div className="lg:col-span-9 space-y-4">
                          {[
                            { key: 'invigilator1Id', label: t.invigilator1, val: val1 },
                            { key: 'invigilator2Id', label: t.invigilator2, val: val2 },
                            { key: 'substituteId', label: t.substitute, val: val3, isSub: true }
                          ].map(role => (
                            <div key={role.key} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className={`text-[9px] font-black uppercase tracking-widest ${role.isSub ? 'text-blue-400' : 'text-slate-400'}`}>
                                  {role.label}
                                </label>
                                <div className="flex items-center gap-1 text-[9px] font-bold">
                                  {role.val.state === 'valid' && <CheckCircle className="h-2.5 w-2.5 text-blue-600" />}
                                  {role.val.state === 'critical' && <ShieldAlert className="h-2.5 w-2.5 text-rose-500" />}
                                  {role.val.state === 'conflict_subject' && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
                                  <span className={role.val.color}>{role.val.label}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={(allocation as any)[role.key] || ''}
                                  onChange={(e) => handleSelectTeacher(allocation, room.id, role.key as any, e.target.value)}
                                  className={`flex-1 ${role.isSub ? 'bg-blue-50/50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-800'} border rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition`}
                                >
                                  <option value="">-- {t.manualOptionSelect} --</option>
                                  {optionsList((allocation as any)[role.key], role.key).map(tchr => (
                                    <option key={tchr.id} value={tchr.id}>{tchr.name} ({tchr.subject_group} - {tchr.subject})</option>
                                  ))}
                                </select>
                                {(allocation as any)[role.key] && (
                                  <button onClick={() => handleSelectTeacher(allocation, room.id, role.key as any, '')} className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition cursor-pointer">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {pickerSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Pesquisa de Docentes</h3>
                <p className="text-[10px] text-slate-500">{pickerSlot.roleLabel} • {pickerSlot.roomName}</p>
              </div>
              <button onClick={() => { setPickerSlot(null); setPickerSearch(''); }} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 bg-white border-b border-slate-50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" autoFocus value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Procurar por nome ou grupo..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" />
              </div>
            </div>
            <div className="overflow-y-auto p-2 flex-1">
              {teachers.filter(t => (t.name || '').toLowerCase().includes(pickerSearch.toLowerCase()) || String(t.subject_group || '').toLowerCase().includes(pickerSearch.toLowerCase())).map(tchr => {
                const val = getTeacherValidationState(tchr.id, pickerSlot.allocation.id, pickerSlot.roleLabel);
                return (
                  <button key={tchr.id} onClick={() => { handleSelectTeacher(pickerSlot.allocation, pickerSlot.roomId, pickerSlot.roleKey, tchr.id); setPickerSlot(null); setPickerSearch(''); }} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition group text-left">
                    <div className="flex flex-col"><span className="text-sm font-bold text-slate-800 group-hover:text-blue-600">{tchr.name}</span><span className="text-[10px] text-slate-500">{tchr.subject_group} - {tchr.subject}</span></div>
                    <div className={`text-[10px] font-bold ${val.color}`}>{val.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
