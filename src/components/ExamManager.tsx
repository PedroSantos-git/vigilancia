/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Exam, Language, Teacher } from '../types';
import { translations } from '../translations';
import { Plus, Calendar, Clock, Trash2, Edit2, X, FileDown, Layers, Tag, Hash, Bookmark, Home } from 'lucide-react';
import { getPeriodFromTime } from '../utils/scheduler';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function getMonthName(monthNumber: number, lang: Language): string {
  const monthsPt = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const monthsEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return lang === 'pt' ? monthsPt[monthNumber - 1] : monthsEn[monthNumber - 1];
}

function getDayInfo(dateStr: string, lang: Language): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  
  const dateObj = new Date(year, month - 1, day);
  
  const weekdaysPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const weekdaysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const weekday = lang === 'pt' ? weekdaysPt[dateObj.getDay()] : weekdaysEn[dateObj.getDay()];
  const monthName = getMonthName(month, lang);
  
  if (lang === 'pt') {
    return `${weekday}, ${day} de ${monthName}`;
  } else {
    return `${weekday}, ${monthName} ${day}`;
  }
}

interface ExamManagerProps {
  lang: Language;
  exams: Exam[];
  teachers: Teacher[];
  onAddExam: (exam: Exam) => void;
  onUpdateExam: (exam: Exam) => void;
  onDeleteExam: (id: string) => void;
}

export default function ExamManager({
  lang,
  exams,
  onAddExam,
  onUpdateExam,
  onDeleteExam
}: ExamManagerProps) {
  const t = translations[lang];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [subjectGroup, setSubjectGroup] = useState('300');
  const [variant, setVariant] = useState<string | null>(null);
  const [year, setYear] = useState('12');
  const [code, setCode] = useState('');
  const [date, setDate] = useState('2026-06-16');
  const [time, setTime] = useState("08:45");
  const [shift, setShift] = useState<string | null>(null);
  const [modality, setModality] = useState<string | null>(null);
  const [phase, setPhase] = useState('1');
  const [registrationsCount, setRegistrationsCount] = useState(0);
  const [EE, setEE] = useState(false);

  const getDefaultTimes = (examYear: string, examName: string) => {
    if (examYear === '9') return { duration: 90, tolerance: 30 };
    if (examName.toLowerCase().includes('matemática')) return { duration: 150, tolerance: 30 };
    return { duration: 120, tolerance: 30 };
  };

  const handleOpenAdd = () => {
    setEditingExam(null);
    setName('');
    setSubjectGroup('300');
    setVariant(null);
    setYear('12');
    setCode('');
    setDate('2026-06-16');
    setTime('08:45');
    setShift(null);
    setModality(null);
    setPhase('1');
    setRegistrationsCount(0);
    setEE(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ex: Exam) => {
    setEditingExam(ex);
    setName(ex.name);
    setSubjectGroup(ex.subject_group);
    setVariant(ex.variant || null);
    setYear(ex.year);
    setCode(ex.code || '');
    setDate(ex.date);
    setTime(ex.time);
    setShift(ex.shift || null);
    setModality(ex.modality || null);
    setPhase(ex.phase);
    setRegistrationsCount(ex.registrationsCount || 0);
    setEE(ex.EE || false);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !subjectGroup || !year || !date || !time || !phase) {
      alert('Por favor, informe todos os campos obrigatórios.');
      return;
    }

    const examData = {
      name,
      subject_group: subjectGroup,
      variant,
      year,
      code,
      date,
      time,
      shift,
      modality,
      phase,
      registrationsCount,
      EE
    };

    if (editingExam) {
      onUpdateExam({
        ...editingExam,
        ...examData
      });
    } else {
      onAddExam({
        id: crypto.randomUUID(),
        ...examData
      });
    }
    setIsModalOpen(false);
  };

  const handleExportPDF = () => {
    if (exams.length === 0) return;

    const title = 'Exames Registados';
    const subtitle = lang === 'pt' 
      ? 'Escola Secundária D. João II - Sistema de Alocações' 
      : 'Secondary School D. João II - Allocation System';
    const timestamp = lang === 'pt' 
      ? `Gerado em: ${new Date().toLocaleDateString('pt-PT')} ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
      : `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 297, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(title, 15, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225);
    doc.text(subtitle, 15, 24);
    doc.text(timestamp, 15, 30);

    const headers = lang === 'pt'
      ? [['Data', 'Hora', 'Fase', 'Exame', 'Ano', 'Código', 'Variante', 'Turno', 'Modalidade', 'Inscritos', 'EE']]
      : [['Date', 'Time', 'Phase', 'Exam', 'Year', 'Code', 'Variant', 'Shift', 'Modality', 'Registrations', 'EE']];

    const sortedExams = [...exams].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });

    const body = sortedExams.map(ex => [
      ex.date,
      ex.time,
      ex.phase,
      ex.name,
      ex.year,
      ex.code || '-',
      ex.variant || '-',
      ex.shift || '-',
      ex.modality || '-',
      (ex.registrationsCount || 0).toString(),
      ex.EE ? 'Sim' : 'Não'
    ]);

    autoTable(doc, {
      startY: 48,
      head: headers,
      body: body,
      theme: 'striped',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59]
      },
      margin: { left: 15, right: 15 }
    });

    const fileName = lang === 'pt' ? 'exames_registados.pdf' : 'registered_exams.pdf';
    doc.save(fileName);
  };

  const groupedByMonthAndDayList = React.useMemo(() => {
    const sorted = [...exams].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });

    const groups: {
      monthKey: string;
      monthDisplay: string;
      days: {
        dayKey: string;
        dayDisplay: string;
        exams: Exam[];
      }[];
    }[] = [];

    sorted.forEach((ex) => {
      let yearStr = '2026';
      let monthStr = '06';
      if (ex.date) {
        const parts = ex.date.split('-');
        if (parts.length > 0) yearStr = parts[0];
        if (parts.length > 1) monthStr = parts[1];
      }
      const monthNum = parseInt(monthStr, 10) || 6;
      const yearNum = parseInt(yearStr, 10) || 2026;
      const monthKey = `${yearStr}-${monthStr}`;
      const monthDisplay = `${getMonthName(monthNum, lang)} ${yearNum}`;

      let monthGroup = groups.find((g) => g.monthKey === monthKey);
      if (!monthGroup) {
        monthGroup = {
          monthKey,
          monthDisplay,
          days: []
        };
        groups.push(monthGroup);
      }

      const dayKey = ex.date;
      const dayDisplay = getDayInfo(ex.date, lang);

      let dayGroup = monthGroup.days.find((d) => d.dayKey === dayKey);
      if (!dayGroup) {
        dayGroup = {
          dayKey,
          dayDisplay,
          exams: []
        };
        monthGroup.days.push(dayGroup);
      }

      dayGroup.exams.push(ex);
    });

    return groups;
  }, [exams, lang]);

  return (
    <div id="exam_manager" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t.examTitle}</h2>
          <p className="text-slate-500 text-xs">{t.examSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exams.length === 0}
            className={`flex items-center space-x-1.5 border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-sm ${
              exams.length === 0 ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 cursor-pointer bg-white hover:text-slate-900'
            }`}
          >
            <FileDown className="h-3.5 w-3.5 text-slate-500" />
            <span>{lang === 'pt' ? 'Exportar PDF' : 'Export PDF'}</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow cursor-pointer shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.addExam}</span>
          </button>
        </div>
      </div>

      {exams.length > 0 ? (
        <div className="space-y-8">
          {groupedByMonthAndDayList.map((monthGroup) => (
            <div key={monthGroup.monthKey} className="space-y-6">
              <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
                <Calendar className="h-5 w-5 text-indigo-600 shrink-0" />
                <h3 className="text-base font-bold text-slate-800 tracking-tight capitalize">
                  {monthGroup.monthDisplay}
                </h3>
                <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
                  {monthGroup.days.reduce((acc, d) => acc + d.exams.length, 0)}{' '}
                  {lang === 'pt' ? 'exames' : 'exams'}
                </span>
              </div>

              <div className="space-y-6 pl-1 md:pl-3 border-l-2 border-slate-100">
                {monthGroup.days.map((dayGroup) => (
                  <div key={dayGroup.dayKey} className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                      <h4 className="text-sm font-semibold text-slate-700">
                        {dayGroup.dayDisplay}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-3.5">
                      {dayGroup.exams.map((ex) => (
                        <div 
                          key={ex.id} 
                          className={`bg-white border border-slate-200 shadow-sm hover:shadow transition duration-200 rounded-lg px-4 py-3 flex flex-col gap-3 relative overflow-hidden border-l-4 ${
                            getPeriodFromTime(ex.time) === '09:00' ? 'border-l-blue-600' : 'border-l-amber-500'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">{ex.name}</span>
                                <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                  {ex.phase}ª FASE
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> {ex.year}º Ano</span>
                                {ex.code && <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {ex.code}</span>}
                                {ex.variant && <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {ex.variant}</span>}
                                {ex.modality && <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" /> {ex.modality}</span>}
                                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                              <Home className="h-3 w-3" /> {ex.registrationsCount || 0} {lang === 'pt' ? 'Inscritos' : 'Registrations'}
                            </span>
                            {ex.EE && <span className="flex items-center gap-1 bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold">EE</span>}
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <button onClick={() => handleOpenEdit(ex)} className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => onDeleteExam(ex.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                              getPeriodFromTime(ex.time) === '09:00' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-amber-50 border-amber-100 text-amber-700'
                            }`}>
                              <Clock className="h-3 w-3" />
                              <span>{ex.time}</span>
                            </div>
                            {ex.shift && (
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                                {ex.shift}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-xs">
          {t.noExams}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingExam ? t.editExam : t.addExam}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Nome do Exame *</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Português" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Grupo Disciplinar *</label>
                  <input type="text" required value={subjectGroup} onChange={(e) => setSubjectGroup(e.target.value)} placeholder="ex. 300" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Ano Escolar *</label>
                  <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white">
                    <option value="9">9º Ano</option>
                    <option value="11">11º Ano</option>
                    <option value="12">12º Ano</option>
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Fase *</label>
                  <select value={phase} onChange={(e) => setPhase(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 bg-white">
                    <option value="1">1ª Fase</option>
                    <option value="2">2ª Fase</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Código</label>
                  <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex. 639" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Variante</label>
                  <input type="text" value={variant || ''} onChange={(e) => setVariant(e.target.value || null)} placeholder="ex. A, LNM" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Data *</label>
                  <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Hora *</label>
                  <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Número de Inscritos *</label>
                  <input type="number" required min="0" value={registrationsCount} onChange={(e) => setRegistrationsCount(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex items-center pt-6">
                  <input
                    type="checkbox"
                    id="exam-ee"
                    checked={EE}
                    onChange={(e) => setEE(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="exam-ee" className="text-xs text-slate-700 font-medium">
                    Necessita de Docente EE
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Turno</label>
                  <input type="text" value={shift || ''} onChange={(e) => setShift(e.target.value || null)} placeholder="ex. T1, T2" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Modalidade</label>
                  <input type="text" value={modality || ''} onChange={(e) => setModality(e.target.value || null)} placeholder="ex. LO, SP, NE" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50 cursor-pointer">{t.cancel}</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer">{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
