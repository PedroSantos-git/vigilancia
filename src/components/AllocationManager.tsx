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
  UserCheck, 
  Filter,
  Search,
  X
} from 'lucide-react';
import { SchoolShipIcon } from './SchoolLogo';
import { hasSubjectConflict, isTeacherUnavailableAt, getPeriodFromTime } from '../utils/scheduler';

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
  
  if (!hasSpecificRooms) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-10 text-center text-amber-800 text-xs">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
        <p className="font-bold mb-1">Este exame não tem salas atribuídas.</p>
        <p>Por favor, associe salas a este exame no menu "Associações Salas/Exames" para poder definir os vigilantes.</p>
      </div>
    );
  }

  const filteredRooms = rooms.filter(room => currentExam.roomIds?.includes(room.id));

  // Create allocation shells
  const activeRoomsAllocations = filteredRooms.map(room => {
    let existing = examAllocations.find(a => a.roomId === room.id);
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

  // Check if a teacher is busy elsewhere at the exact same day/time (excluding current exam/room)
  const isTeacherBusyElsewhere = (teacherId: string, currentAllocId: string): boolean => {
    if (!Array.isArray(allocations)) return false;
    // Find allocations of OTHER exams on this day/period
    return allocations.some(alloc => {
      if (alloc.id === currentAllocId) return false; // same slot
      const ex = exams.find(e => e.id === alloc.examId);
      if (!ex) return false;
      // Exclude current exam itself since teachers cannot be double booked even in two rooms of the same exam
      if (ex.date === currentExam.date && getPeriodFromTime(ex.time) === getPeriodFromTime(currentExam.time)) {
        return (
          alloc.invigilator1Id === teacherId ||
          alloc.invigilator2Id === teacherId ||
          alloc.substituteId === teacherId
        );
      }
      return false;
    });
  };

  // Helper inside allocation selection context
  const getTeacherValidationState = (
    teacherId: string | null,
    currentAllocId: string,
    roleLabel: string
  ) => {
    if (!teacherId) return { state: 'empty', label: 'Vago', color: 'text-slate-400' };
    const teacher = teachers.find(tchr => tchr.id === teacherId);
    if (!teacher) return { state: 'notfound', label: 'Inexistente', color: 'text-slate-400' };

    // Unavailability check (either general flag or specific date/time unavailability)
    const isUnavailable = !teacher.available || isTeacherUnavailableAt(teacher, currentExam.date, currentExam.time);
    if (isUnavailable) {
      return {
        state: 'critical',
        label: lang === 'pt' ? 'Conflito: Indisponibilidade registada para esta data/hora' : 'Conflict: Registered unavailability for this date and time',
        color: 'text-rose-600 font-semibold'
      };
    }

    // Same subject check
    const isSpecialtyConflict = hasSubjectConflict(teacher, currentExam);
    
    // Busy check
    const isBusy = isTeacherBusyElsewhere(teacherId, currentAllocId);

    if (isSpecialtyConflict && isBusy) {
      return {
        state: 'critical',
        label: lang === 'pt' ? 'Conflito: Especialidade + Horário' : 'Conflict: Subject & Time',
        color: 'text-red-500'
      };
    }
    if (isSpecialtyConflict) {
      return {
        state: 'conflict_subject',
        label: lang === 'pt' ? 'Conflito: Especialidade (Ensina a disciplina)' : 'Subject Specialty Conflict',
        color: 'text-amber-600'
      };
    }
    if (isBusy) {
      return {
        state: 'conflict_busy',
        label: lang === 'pt' ? 'Conflito: Alocado a outra sala em simultâneo' : 'Busy: Room double-booked',
        color: 'text-rose-500'
      };
    }

    return {
      state: 'valid',
      label: t.noConflict,
      color: 'text-blue-600'
    };
  };

  // Handle manual selection
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t.allocationTitle}</h2>
          <p className="text-slate-500 text-xs">{t.allocationSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700">
            <span>{t.selectExam}:</span>
            <select
               value={selectedExamId}
               onChange={(e) => setSelectedExamId(e.target.value)}
               className="bg-transparent border-none font-bold text-blue-600 focus:outline-none cursor-pointer"
             >
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.year}º Ano) | {ex.date} • {ex.time} | Fase {ex.phase} | {ex.code} | {ex.variant || 'Standard'}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => onAutoTriggerForExam(currentExam.id)}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2.5 rounded-lg transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{lang === 'pt' ? 'Distribuição Automática neste Exame' : 'Auto-Allocate this exam'}</span>
          </button>
          <button
            onClick={() => onClearAllocationsForExam(currentExam.id)}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-250 border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-lg transition cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{lang === 'pt' ? 'Limpar Escala' : 'Clear scale'}</span>
          </button>
        </div>
      </div>

       {/* Constraints Quick Filter options bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center space-x-2 text-blue-600 font-semibold mb-1 sm:mb-0">
          <Filter className="h-4 w-4" />
          <span>Filtros Dinâmicos de Seleção Manual:</span>
        </div>
        <div className="flex flex-wrap gap-4 font-medium">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideBusy}
              onChange={(e) => setHideBusy(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>{t.filterExcludeBusy}</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideIncompatible}
              onChange={(e) => setHideIncompatible(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>{t.filterExcludeIncompatible}</span>
          </label>
        </div>
      </div>

       {/* Grid of rooms and allocations */}
      {!hasSpecificRooms && (
        <div className="bg-amber-50/70 border border-amber-200 text-amber-900 p-4 rounded-xl text-[11px] font-sans leading-relaxed flex items-start gap-3 shadow-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <strong className="block font-bold text-amber-950 mb-0.5">
              {lang === 'pt' ? 'Nota: Nenhuma sala foi associada explicitamente a este exame' : 'Notice: No rooms explicitly associated to this exam'}
            </strong>
            <span>
              {lang === 'pt' 
                ? 'Para fins de conveniência, todas as salas de exames escolares estão ativas para este exame. Para restringir as salas e calibrar a ocupação contra conflitos de horários, configure-as na barra lateral sob o separador "Salas de Exame".' 
                : 'For simplicity, all registered school exam rooms are listed. To fully restrict active rooms and optimize teacher rosters against room conflicts, navigate to the "Exam Rooms" tab in the left sidebar.'}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {activeRoomsAllocations.map(({ room, allocation }) => {
          // Validate staff statuses
          const val1 = getTeacherValidationState(allocation.invigilator1Id, allocation.id, 'Vigilante 1');
          const val2 = getTeacherValidationState(allocation.invigilator2Id, allocation.id, 'Vigilante 2');
          const val3 = getTeacherValidationState(allocation.substituteId, allocation.id, 'Suplente');

          // Build option list with live filters
          const buildOptionList = (
            currentSelectedId: string | null,
            roleKey: 'invigilator1Id' | 'invigilator2Id' | 'substituteId'
          ) => {
            return teachers.filter(tchr => {
              // Always show currently selected teacher
              if (tchr.id === currentSelectedId) return true;

              // A teacher cannot be assigned to another role in this same room/allocation
              const isAssignedElsewhereInRoom = 
                (roleKey !== 'invigilator1Id' && allocation.invigilator1Id === tchr.id) ||
                (roleKey !== 'invigilator2Id' && allocation.invigilator2Id === tchr.id);
              if (isAssignedElsewhereInRoom) return false;

              // Filter unavailable teachers (overall flag + specific date/time unavailability)
              if (!tchr.available || isTeacherUnavailableAt(tchr, currentExam.date, currentExam.time)) return false;

              // Match filter checkboxes
              if (hideBusy && isTeacherBusyElsewhere(tchr.id, allocation.id)) return false;
              if (hideIncompatible && hasSubjectConflict(tchr, currentExam)) return false;

              return true;
            });
          };

          const optionsList = buildOptionList;

          return (
            <div 
              key={room.id} 
              className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 hover:border-slate-300 transition"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                
                {/* Room title & specs column */}
                <div className="lg:col-span-3 border-r border-slate-100 pr-4">
                  <div className="flex items-baseline space-x-2">
                    <h3 className="font-bold text-slate-800 text-sm">{room.name}</h3>
                  </div>
                  <div className="mt-1 flex items-center space-x-2 text-slate-500 text-xs">
                    <span>{t.capacity}:</span>
                    <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {room.capacity} alunos
                    </span>
                  </div>
                </div>

                {/* Selection Selectors Block (col-span-9) */}
                <div className="lg:col-span-9 grid grid-cols-1 gap-4">
                  
                  {/* Select 1: Vigilante 1 */}
                  <div className="space-y-1.5 font-sans">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      {t.invigilator1} (Obrigatório)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={allocation.invigilator1Id || ''}
                        onChange={(e) => handleSelectTeacher(allocation, room.id, 'invigilator1Id', e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 font-medium py-1.5 px-2.5 rounded-lg text-xs focus:outline-none focus:bg-white"
                      >
                        <option value="">-- {t.manualOptionSelect} --</option>
                        {optionsList(allocation.invigilator1Id, 'invigilator1Id').map((tchr) => (
                          <option key={tchr.id} value={tchr.id}>
                            {tchr.name} ({tchr.subject_group} - {tchr.subject})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setPickerSlot({
                          allocation,
                          roomId: room.id,
                          roleKey: 'invigilator1Id',
                          roleLabel: 'Vigilante 1',
                          roomName: room.name
                        })}
                        title={lang === 'pt' ? "Abrir Pesquisa de Docentes" : "Open Search Picker"}
                        className="p-1.5 bg-slate-50 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer flex-shrink-0"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </button>

                      {allocation.invigilator1Id && (
                        <button
                          type="button"
                          onClick={() => handleSelectTeacher(allocation, room.id, 'invigilator1Id', '')}
                          title={lang === 'pt' ? "Remover Professor" : "Remove Assignment"}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition border border-rose-200 cursor-pointer flex-shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Inline helper message */}
                    <div className="flex items-center space-x-1.5 text-[10px] pl-1 font-medium select-none">
                      {val1.state === 'valid' && <CheckCircle className="h-3 w-3 text-blue-600" />}
                      {(val1.state === 'critical' || val1.state === 'conflict_busy') && <ShieldAlert className="h-3 w-3 text-rose-500" />}
                      {val1.state === 'conflict_subject' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      <span className={val1.color}>{val1.label}</span>
                    </div>
                  </div>

                  {/* Select 2: Vigilante 2 */}
                  <div className="space-y-1.5 font-sans">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      {t.invigilator2} (Obrigatório)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={allocation.invigilator2Id || ''}
                        onChange={(e) => handleSelectTeacher(allocation, room.id, 'invigilator2Id', e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 font-medium py-1.5 px-2.5 rounded-lg text-xs focus:outline-none focus:bg-white"
                      >
                        <option value="">-- {t.manualOptionSelect} --</option>
                        {optionsList(allocation.invigilator2Id, 'invigilator2Id').map((tchr) => (
                          <option key={tchr.id} value={tchr.id}>
                            {tchr.name} ({tchr.subject_group} - {tchr.subject})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setPickerSlot({
                          allocation,
                          roomId: room.id,
                          roleKey: 'invigilator2Id',
                          roleLabel: 'Vigilante 2',
                          roomName: room.name
                        })}
                        title={lang === 'pt' ? "Abrir Pesquisa de Docentes" : "Open Search Picker"}
                        className="p-1.5 bg-slate-50 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer flex-shrink-0"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </button>

                      {allocation.invigilator2Id && (
                        <button
                          type="button"
                          onClick={() => handleSelectTeacher(allocation, room.id, 'invigilator2Id', '')}
                          title={lang === 'pt' ? "Remover Professor" : "Remove Assignment"}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-650 text-rose-600 rounded-lg transition border border-rose-200 cursor-pointer flex-shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Inline helper message */}
                    <div className="flex items-center space-x-1.5 text-[10px] pl-1 font-medium select-none">
                      {val2.state === 'valid' && <CheckCircle className="h-3 w-3 text-blue-600" />}
                      {(val2.state === 'critical' || val2.state === 'conflict_busy') && <ShieldAlert className="h-3 w-3 text-rose-500" />}
                      {val2.state === 'conflict_subject' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      <span className={val2.color}>{val2.label}</span>
                    </div>
                  </div>

                  {/* Select 3: Suplente por Sala */}
                  <div className="space-y-1.5 font-sans">
                    <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      {t.substitute} (Obrigatório por Sala)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={allocation.substituteId || ''}
                        onChange={(e) => handleSelectTeacher(allocation, room.id, 'substituteId', e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-800 font-medium py-1.5 px-2.5 rounded-lg text-xs focus:outline-none focus:bg-white"
                      >
                        <option value="">-- {t.manualOptionSelect} --</option>
                        {optionsList(allocation.substituteId, 'substituteId').map((tchr) => (
                          <option key={tchr.id} value={tchr.id}>
                            {tchr.name} ({tchr.subject_group} - {tchr.subject})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setPickerSlot({
                          allocation,
                          roomId: room.id,
                          roleKey: 'substituteId',
                          roleLabel: 'Suplente',
                          roomName: room.name
                        })}
                        title={lang === 'pt' ? "Abrir Pesquisa de Docentes" : "Open Search Picker"}
                        className="p-1.5 bg-slate-50 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer flex-shrink-0"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </button>

                      {allocation.substituteId && (
                        <button
                          type="button"
                          onClick={() => handleSelectTeacher(allocation, room.id, 'substituteId', '')}
                          title={lang === 'pt' ? "Remover Professor" : "Remove Assignment"}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-650 text-rose-600 rounded-lg transition border border-rose-200 cursor-pointer flex-shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Inline helper message */}
                    <div className="flex items-center space-x-1.5 text-[10px] pl-1 font-medium select-none">
                      {val3.state === 'valid' && <CheckCircle className="h-3 w-3 text-blue-600" />}
                      {(val3.state === 'critical' || val3.state === 'conflict_busy') && <ShieldAlert className="h-3 w-3 text-rose-500" />}
                      {val3.state === 'conflict_subject' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      <span className={val3.color}>{val3.label}</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          );
        })}
      </div>



      {/* Manual Picker Modal Overlay */}
      {pickerSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 font-sans">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <SchoolShipIcon className="h-5 w-5 text-blue-600" color="#2563eb" />
                  <span>Atribuir Docente Manualmente</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Escolher ocupação para o cargo de <strong className="text-blue-600 font-semibold">{pickerSlot.roleLabel}</strong> na <strong className="text-slate-800 font-semibold">{pickerSlot.roomName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPickerSlot(null);
                  setPickerSearch('');
                }}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Search & Rules Banner */}
            <div className="p-4 border-b border-indigo-50/50 bg-white space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Pesquisar professor por nome, disciplina, grupo, email..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              
              <div className="text-[10px] text-slate-500 bg-slate-50 rounded-lg p-2.5 flex items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-blue-600">Info Exame:</span>
                <span>{currentExam.name} • {currentExam.date} • {getPeriodFromTime(currentExam.time) === '09:00' ? (lang === 'pt' ? `Manhã (${currentExam.time})` : `Morning (${currentExam.time})`) : (lang === 'pt' ? `Tarde (${currentExam.time})` : `Afternoon (${currentExam.time})`)}</span>
              </div>
            </div>

            {/* Teachers List Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/55 min-h-[250px]">
              {(() => {
                const searchLower = pickerSearch.toLowerCase();
                const filtered = teachers.filter(tchr => 
                  tchr.name.toLowerCase().includes(searchLower) ||
                  tchr.subject.toLowerCase().includes(searchLower) ||
                  tchr.subject_group.includes(searchLower) ||
                  tchr.email.toLowerCase().includes(searchLower)
                );

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      Nenhum professor encontrado com os critérios de pesquisa.
                    </div>
                  );
                }

                return filtered.map((tchr) => {
                  // Determine suitability and status
                  const val = getTeacherValidationState(tchr.id, pickerSlot.allocation.id, pickerSlot.roleLabel);
                  const isAssignedToThisSlot = pickerSlot.allocation[pickerSlot.roleKey] === tchr.id;
                  
                  // Check if teacher is assigned to another role in this exact room/allocation
                  const isAssignedElsewhereInRoom = 
                    (pickerSlot.roleKey !== 'invigilator1Id' && pickerSlot.allocation.invigilator1Id === tchr.id) ||
                    (pickerSlot.roleKey !== 'invigilator2Id' && pickerSlot.allocation.invigilator2Id === tchr.id) ||
                    (pickerSlot.roleKey !== 'substituteId' && pickerSlot.allocation.substituteId === tchr.id);

                  return (
                    <div 
                      key={tchr.id} 
                      className={`bg-white border rounded-xl p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-3 transition shadow-sm ${
                        isAssignedToThisSlot 
                          ? 'border-blue-500 ring-1 ring-blue-500/20' 
                          : isAssignedElsewhereInRoom 
                            ? 'border-slate-200 opacity-60 bg-slate-100/30' 
                            : 'border-slate-150 hover:border-slate-250'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-800">{tchr.name}</span>
                          <span className="font-mono text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            Grupo {tchr.subject_group}
                          </span>
                          {(!tchr.available || isTeacherUnavailableAt(tchr, currentExam.date, currentExam.time)) && (
                            <span className="text-[9px] font-bold bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded">
                              {lang === 'pt' ? 'Indisponível' : 'Unavailable'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {tchr.subject} • {tchr.email}
                        </div>
                        
                        {/* Suitability indicator message */}
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-medium">
                          {val.state === 'valid' && <CheckCircle className="h-3 w-3 text-blue-600" />}
                          {(val.state === 'critical' || val.state === 'conflict_busy') && <ShieldAlert className="h-3 w-3 text-rose-500" />}
                          {val.state === 'conflict_subject' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                          <span className={val.color}>{val.label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 justify-end">
                        {isAssignedToThisSlot ? (
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectTeacher(pickerSlot.allocation, pickerSlot.roomId, pickerSlot.roleKey, '');
                              setPickerSlot(null);
                              setPickerSearch('');
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition cursor-pointer"
                          >
                            Remover Atribuição
                          </button>
                        ) : isAssignedElsewhereInRoom ? (
                          <span className="text-[10px] text-slate-400 italic pr-2">
                            Já alocado nesta sala
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectTeacher(pickerSlot.allocation, pickerSlot.roomId, pickerSlot.roleKey, tchr.id);
                              setPickerSlot(null);
                              setPickerSearch('');
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer select-none ${
                              val.state === 'valid'
                                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {val.state === 'valid' ? 'Atribuir' : 'Forçar Atribuição'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
              <span className="hidden sm:inline">A atribuição manual sobrepõe-se temporariamente aos algoritmos.</span>
              <button
                type="button"
                onClick={() => {
                  setPickerSlot(null);
                  setPickerSearch('');
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
              >
                {t.cancel || 'Cancelar'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
