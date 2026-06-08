/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Teacher, Language, Exam } from '../types';
import { translations } from '../translations';
import { api } from '../utils/api';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  UserPlus, 
  Check, 
  X,
  FileSpreadsheet,
  Calendar
} from 'lucide-react';

interface TeacherManagerProps {
  lang: Language;
  teachers: Teacher[];
  exams: Exam[];
  onAddTeacher: (teacher: Teacher) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  onClearAllTeachers: () => void;
}

export default function TeacherManager({
  lang,
  teachers,
  exams,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onClearAllTeachers
}: TeacherManagerProps) {
  const t = translations[lang];

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'subjectGroup' | 'subject'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // States for Unavailability Modal
  const [unavailabilityTeacher, setUnavailabilityTeacher] = useState<Teacher | null>(null);
  const [unavailDate, setUnavailDate] = useState('');
  const [unavailTime, setUnavailTime] = useState<'all' | '09:00' | '14:00'>('all');
  const [unavailYear, setUnavailYear] = useState('');
  const [unavailSubjectGroup, setUnavailSubjectGroup] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [subjectGroup, setSubjectGroup] = useState('300');
  const [subject, setSubject] = useState('');
  const [role, setRole] = useState('professor');
  const [email, setEmail] = useState('');
  const [available, setAvailable] = useState(true);
  const [EE, setEE] = useState(false);
  const [PISO_ZERO, setPISO_ZERO] = useState(false);

  // Roles state for dropdown
  const [availableRoles, setAvailableRoles] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const rolesData = await api.roles.getAll();
        setAvailableRoles(rolesData);
      } catch (err) {
        console.error('Error loading roles for dropdown:', err);
      }
    };
    fetchRoles();
  }, [isModalOpen]);

  // New Confirm Clear states
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const clearTimerRef = useRef<any>(null);

  // Open modal for adding
  const handleOpenAdd = () => {
    setEditingTeacher(null);
    setName('');
    setSubjectGroup('300');
    setSubject('');
    setRole('Professor');
    setEmail('');
    setAvailable(true);
    setEE(false);
    setPISO_ZERO(false);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setName(teacher.name);
    setSubjectGroup(teacher.subject_group || '300');
    setSubject(teacher.subject || '');
    setRole(teacher.role || '');
    setEmail(teacher.email || '');
    setAvailable(teacher.available);
    setEE(teacher.EE || false);
    setPISO_ZERO(teacher.PISO_ZERO || false);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !subjectGroup.trim()) {
      alert(lang === 'pt'
        ? 'Por favor, preencha todos os campos obrigatórios (Nome, Grupo Disciplinar e Disciplina).'
        : 'Please fill in all required fields (Name, Subject Group and Subject).');
      return;
    }

    const teacherData: Teacher = {
      id: editingTeacher ? editingTeacher.id : crypto.randomUUID(),
      name,
      subject_group: subjectGroup,
      subject,
      role: role || null,
      email: email || null,
      available,
      EE,
      PISO_ZERO,
      unavailabilities: editingTeacher?.unavailabilities || []
    };

    if (editingTeacher) {
      onUpdateTeacher(teacherData);
    } else {
      onAddTeacher(teacherData);
    }
    setIsModalOpen(false);
  };

  const handleClearAllClick = () => {
    if (isConfirmingClear) {
      onClearAllTeachers();
      setIsConfirmingClear(false);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    } else {
      setIsConfirmingClear(true);
      clearTimerRef.current = setTimeout(() => {
        setIsConfirmingClear(false);
      }, 4050); // 4 seconds timeframe
    }
  };

  // Filter and sort teachers list
  const filteredTeachers = [...teachers].filter(tchr => {
    const term = searchTerm.toLowerCase();
    const roleName = availableRoles.find(r => r.id === tchr.role)?.name || tchr.role || '';
    return (
      (tchr.name || '').toLowerCase().includes(term) ||
      (tchr.subject || '').toLowerCase().includes(term) ||
      String(tchr.subject_group || '').toLowerCase().includes(term) ||
      roleName.toLowerCase().includes(term) ||
      (tchr.email || '').toLowerCase().includes(term)
    );
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === 'subjectGroup') {
      comparison = (a.subject_group || '').localeCompare(b.subject_group || '');
    } else if (sortBy === 'subject') {
      comparison = (a.subject || '').localeCompare(b.subject || '');
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleExportPDF = () => {
    // Create a map from subject_group to subject name using exams
    const groupToSubject = new Map<string, string>();
    exams.forEach(ex => {
      if (!groupToSubject.has(ex.subject_group)) {
        groupToSubject.set(ex.subject_group, ex.name);
      }
    });

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(lang === 'pt' ? 'Lista de Professores' : 'Teachers List', 14, 15);
    doc.setFontSize(10);
    doc.text(`${new Date().toLocaleDateString()}`, 14, 22);

    // Group and sort
    const sorted = [...teachers].sort((a, b) => {
      // First by subject group
      if (a.subject_group !== b.subject_group) return a.subject_group.localeCompare(b.subject_group);
      // Then by name
      return a.name.localeCompare(b.name);
    });

    const headers = [[
      lang === 'pt' ? 'Grupo' : 'Group',
      lang === 'pt' ? 'Nome' : 'Name',
      lang === 'pt' ? 'Disciplina' : 'Subject',
      lang === 'pt' ? 'Cargo' : 'Role',
      lang === 'pt' ? 'Indisponibilidades' : 'Unavailabilities'
    ]];

    const data = sorted.map(t => [
      t.subject_group,
      t.name,
      t.subject,
      availableRoles.find(r => r.id === t.role)?.name || t.role || '-',
      t.unavailabilities && t.unavailabilities.length > 0 
        ? t.unavailabilities.map(u => {
            let parts: string[] = [];
            parts.push(u.date === 'all' ? (lang === 'pt' ? 'Todas as datas' : 'All dates') : u.date);
            if (u.time !== 'all') {
              parts.push(`(${u.time === '09:00' ? (lang === 'pt' ? 'Manhã' : 'Morning') : (lang === 'pt' ? 'Tarde' : 'Afternoon')})`);
            }
            if (u.year) {
              parts.push(`Ano ${u.year}`);
            }
            if (u.subject_group) {
              const subjectName = groupToSubject.get(u.subject_group) || '';
              parts.push(`Grupo ${u.subject_group}${subjectName ? ` - ${subjectName}` : ''}`);
            }
            return parts.join(' ');
          }).join('; ')
        : (lang === 'pt' ? 'Nenhuma' : 'None')
    ]);

    let startY = 30;
    autoTable(doc, {
      head: headers,
      body: data,
      startY: startY,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 }
    });

    // Get the last Y position to add summary
    const lastTableY = (doc as any).lastAutoTable.finalY + 15;
    if (lastTableY < 280) { // Make sure we have space on the page
      doc.setFontSize(12);
      doc.text(lang === 'pt' ? 'Resumo de Indisponibilidades' : 'Unavailability Summary', 15, lastTableY);
      
      // Collect all unavailabilities
      const allUnavailabilities: any[] = [];
      teachers.forEach(t => {
        if (t.unavailabilities) {
          t.unavailabilities.forEach(u => {
            allUnavailabilities.push({ ...u, teacherName: t.name });
          });
        }
      });

      if (allUnavailabilities.length > 0) {
        const summaryHeaders = [[
          lang === 'pt' ? 'Professor' : 'Teacher',
          lang === 'pt' ? 'Data' : 'Date',
          lang === 'pt' ? 'Período' : 'Period',
          lang === 'pt' ? 'Ano' : 'Year',
          lang === 'pt' ? 'Grupo / Disciplina' : 'Group / Subject'
        ]];

        const summaryData = allUnavailabilities.map(u => {
          const subjectName = u.subject_group ? (groupToSubject.get(u.subject_group) || '') : '';
          return [
            u.teacherName,
            u.date === 'all' ? (lang === 'pt' ? 'Todas as datas' : 'All dates') : u.date,
            u.time === 'all' ? (lang === 'pt' ? 'Todo o dia' : 'All day') : (u.time === '09:00' ? (lang === 'pt' ? 'Manhã' : 'Morning') : (lang === 'pt' ? 'Tarde' : 'Afternoon')),
            u.year || '-',
            u.subject_group ? `${u.subject_group}${subjectName ? ` - ${subjectName}` : ''}` : '-'
          ];
        });

        autoTable(doc, {
          head: summaryHeaders,
          body: summaryData,
          startY: lastTableY + 10,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 7 }
        });
      }
    }

    doc.save(`lista_professores_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div id="teacher_manager" className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t.teacherTitle}</h2>
          <p className="text-slate-500 text-xs">{t.teacherSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>{lang === 'pt' ? 'Exportar PDF' : 'Export PDF'}</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.addTeacher}</span>
          </button>
        </div>
      </div>

      {/* Search Input filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.searchTeacher}
          className="flex-1 text-xs text-slate-700 placeholder-slate-400 focus:outline-none"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 text-xs">
            {lang === 'pt' ? 'Limpar' : 'Clear'}
          </button>
        )}
      </div>

      {/* Sort options */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <span className="text-xs font-semibold text-slate-700">{lang === 'pt' ? 'Ordenar por:' : 'Sort by:'}</span>
        <button
          onClick={() => {
            if (sortBy === 'name') {
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            } else {
                setSortBy('name');
                setSortOrder('asc');
            }
          }}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
            sortBy === 'name' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {t.teacherName}
          {sortBy === 'name' && (sortOrder === 'asc' ? ' ↓' : ' ↑')}
        </button>
        <button
          onClick={() => {
            if (sortBy === 'subjectGroup') {
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            } else {
              setSortBy('subjectGroup');
              setSortOrder('asc');
            }
          }}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
            sortBy === 'subjectGroup' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {t.subjectGroup}
          {sortBy === 'subjectGroup' && (sortOrder === 'asc' ? ' ↓' : ' ↑')}
        </button>
        <button
          onClick={() => {
            if (sortBy === 'subject') {
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            } else {
              setSortBy('subject');
              setSortOrder('asc');
            }
          }}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer ${
            sortBy === 'subject' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {t.subject}
          {sortBy === 'subject' && (sortOrder === 'asc' ? ' ↓' : ' ↑')}
        </button>
      </div>

      {/* Teachers list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-550/80 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="px-5 py-3 w-1/3">{t.teacherName}</th>
                <th className="px-5 py-3 w-1/8">{t.role}</th>
                <th className="px-5 py-3 w-1/6">{t.email}</th>
                <th className="px-5 py-3 text-center w-1/12">{t.available}</th>
                <th className="px-5 py-3 text-center w-1/16">EE</th>
                <th className="px-5 py-3 text-center w-1/16">Piso 0</th>
                <th className="px-5 py-3 w-1/6">{lang === 'pt' ? 'Indisponibilidades' : 'Unavailabilities'}</th>
                <th className="px-5 py-3 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredTeachers.length > 0 ? (
                filteredTeachers.map((tc) => (
                  <tr key={tc.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{tc.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        <span className="font-mono mr-3">{tc.subject_group}</span>
                        <span>{tc.subject}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {availableRoles.find(r => r.id === tc.role)?.name || tc.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-500">
                      {tc.email ? (() => {
                        const [local, domain] = tc.email.split('@');
                        return (
                          <div>
                            <div>{local}</div>
                            {domain && <div className="text-slate-400">@{domain}</div>}
                          </div>
                        );
                      })() : '-'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => onUpdateTeacher({ ...tc, available: !tc.available})}
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                          tc.available 
                            ? 'bg-blue-55 text-blue-700 border border-blue-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {tc.available ? (lang === 'pt' ? 'SIM' : 'YES') : (lang === 'pt' ? 'NÃO' : 'NO')}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tc.EE 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                      }`}>
                        {tc.EE ? (lang === 'pt' ? 'SIM' : 'YES') : (lang === 'pt' ? 'NÃO' : 'NO')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tc.PISO_ZERO 
                          ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                      }`}>
                        {tc.PISO_ZERO ? (lang === 'pt' ? 'SIM' : 'YES') : (lang === 'pt' ? 'NÃO' : 'NO')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[10px] text-slate-500">
                      {tc.unavailabilities && tc.unavailabilities.length > 0 
                        ? tc.unavailabilities.map((u, i) => (
                          <div key={i} className="mb-1">
                            {`${u.date === 'all' ? (lang === 'pt' ? 'Todas as datas' : 'All dates') : u.date} ${u.time === 'all' ? '' : `(${u.time === '09:00' ? (lang === 'pt' ? 'Manhã' : 'Morning') : (lang === 'pt' ? 'Tarde' : 'Afternoon')})`} ${u.year ? `Ano ${u.year}` : ''} ${u.subject_group ? `Grupo ${u.subject_group}` : ''}`}
                          </div>
                        ))
                        : (lang === 'pt' ? 'Nenhuma' : 'None')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setUnavailabilityTeacher(tc);
                            setUnavailDate('');
                            setUnavailTime('all');
                          }}
                          title={t.manageUnavailability}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(tc)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTeacher(tc.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    Nenhum docente encontrado de momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Unavailability Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">{lang === 'pt' ? 'Resumo de Indisponibilidades' : 'Unavailability Summary'}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-550/80 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="px-3 py-2">{lang === 'pt' ? 'Professor' : 'Teacher'}</th>
                <th className="px-3 py-2">{lang === 'pt' ? 'Data' : 'Date'}</th>
                <th className="px-3 py-2">{lang === 'pt' ? 'Período' : 'Period'}</th>
                <th className="px-3 py-2">{lang === 'pt' ? 'Ano' : 'Year'}</th>
                <th className="px-3 py-2">{lang === 'pt' ? 'Grupo' : 'Group'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {(() => {
                const allUnavailabilities: any[] = [];
                teachers.forEach(t => {
                  if (t.unavailabilities) {
                    t.unavailabilities.forEach(u => {
                      allUnavailabilities.push({ ...u, teacherName: t.name });
                    });
                  }
                });
                
                if (allUnavailabilities.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="text-center py-5 text-slate-400">
                        {lang === 'pt' ? 'Nenhuma indisponibilidade registada' : 'No unavailabilities recorded'}
                      </td>
                    </tr>
                  );
                }
                
                return allUnavailabilities.map((u, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition">
                    <td className="px-3 py-2 font-medium">{u.teacherName}</td>
                    <td className="px-3 py-2">{u.date === 'all' ? (lang === 'pt' ? 'Todas as datas' : 'All dates') : u.date}</td>
                    <td className="px-3 py-2">{u.time === 'all' ? (lang === 'pt' ? 'Todo o dia' : 'All day') : (u.time === '09:00' ? (lang === 'pt' ? 'Manhã' : 'Morning') : (lang === 'pt' ? 'Tarde' : 'Afternoon'))}</td>
                    <td className="px-3 py-2">{u.year || '-'}</td>
                    <td className="px-3 py-2">{u.subject_group || '-'}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">
                {editingTeacher ? t.editTeacher : t.addTeacher}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {t.teacherName} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex. Professor Doutor Manuel Antunes"
                  className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {t.subjectGroup} *
                  </label>
                  <input
                    type="text"
                    required
                    value={subjectGroup}
                    onChange={(e) => setSubjectGroup(e.target.value)}
                    placeholder="ex. 500 para Matemática"
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {t.subject} *
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="ex. Matemática, Português, Física"
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {t.role}
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">{lang === 'pt' ? 'Selecionar Cargo...' : 'Select Role...'}</option>
                    {availableRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {t.email}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ex. docente@escola.pt"
                    className="w-full border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="v-available"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label id="available_label" htmlFor="v-available" className="text-xs text-slate-700 font-medium">
                  {t.available}
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="v-ee"
                  checked={EE}
                  onChange={(e) => setEE(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label id="ee_label" htmlFor="v-ee" className="text-xs text-slate-700 font-medium">
                  Educação Especial (EE)
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="v-piso-zero"
                  checked={PISO_ZERO}
                  onChange={(e) => setPISO_ZERO(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label id="piso_zero_label" htmlFor="v-piso-zero" className="text-xs text-slate-700 font-medium">
                  Apenas Piso 0
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Unavailabilities Modal */}
      {unavailabilityTeacher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-slide-up">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {t.unavailabilityTitle}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium font-sans">
                  {unavailabilityTeacher.name} ({unavailabilityTeacher.subject})
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setUnavailabilityTeacher(null)} 
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-full hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Form to add a new blockout slot */}
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100/60 space-y-3">
          <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider font-sans">
            {t.addUnavailability}
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-550 uppercase tracking-wider mb-1">
                {t.date}
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="unavail-date-specific"
                    name="unavail-date-type"
                    checked={unavailDate !== 'all' && unavailDate !== ''}
                    onChange={() => setUnavailDate('')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="unavail-date-specific" className="text-xs text-slate-700">
                    {lang === 'pt' ? 'Data específica' : 'Specific Date'}
                  </label>
                </div>
                {unavailDate !== 'all' && (
                  <input
                    type="date"
                    required
                    value={unavailDate}
                    onChange={(e) => setUnavailDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  />
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="unavail-date-all"
                    name="unavail-date-type"
                    checked={unavailDate === 'all'}
                    onChange={() => setUnavailDate('all')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="unavail-date-all" className="text-xs text-slate-700">
                    {lang === 'pt' ? 'Todas as datas' : 'All Dates'}
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-550 uppercase tracking-wider mb-1">
                {lang === 'pt' ? 'Período' : 'Time Slot'}
              </label>
              <select
                value={unavailTime}
                onChange={(e) => setUnavailTime(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">{t.allDay}</option>
                <option value="09:00">{lang === 'pt' ? 'Manhã' : 'Morning'}</option>
                <option value="14:00">{lang === 'pt' ? 'Tarde' : 'Afternoon'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-550 uppercase tracking-wider mb-1">
                {lang === 'pt' ? 'Ano' : 'Year'}
              </label>
              <select
                value={unavailYear}
                onChange={(e) => setUnavailYear(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">{lang === 'pt' ? 'Todos os anos' : 'All Years'}</option>
                <option value="9">9º Ano</option>
                <option value="11">11º Ano</option>
                <option value="12">12º Ano</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-550 uppercase tracking-wider mb-1">
                {lang === 'pt' ? 'Grupo Disciplinar' : 'Subject Group'}
              </label>
              <select
                value={unavailSubjectGroup}
                onChange={(e) => setUnavailSubjectGroup(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">{lang === 'pt' ? 'Todos os grupos' : 'All Groups'}</option>
                {(() => {
                  // Get unique subject_group + name pairs from exams, sorted by subject_group number
                  const uniqueGroups = new Map();
                  exams.forEach(ex => {
                    if (!uniqueGroups.has(ex.subject_group)) {
                      uniqueGroups.set(ex.subject_group, ex.name);
                    }
                  });
                  return Array.from(uniqueGroups.entries())
                    .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
                    .map(([group, name]) => (
                      <option key={group} value={group}>{group} - {name}</option>
                    ));
                })()}
              </select>
            </div>
          </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={!unavailDate || (unavailDate !== 'all' && !unavailDate.match(/^\d{4}-\d{2}-\d{2}$/))}
                    onClick={() => {
                      if (!unavailDate || (unavailDate !== 'all' && !unavailDate.match(/^\d{4}-\d{2}-\d{2}$/))) return;
                      const currentUnavailabilities = unavailabilityTeacher.unavailabilities || [];
                      // Prevent duplicate date + times + year + subject_group
                      const isDup = currentUnavailabilities.some(u => 
                        u.date === unavailDate && 
                        u.time === unavailTime &&
                        u.year === unavailYear &&
                        u.subject_group === unavailSubjectGroup
                      );
                      if (isDup) {
                        alert(lang === 'pt' ? 'Esta indisponibilidade já se encontra registada.' : 'This unavailability is already listed.');
                        return;
                      }
                      const newUn = {
                        id: `un_${Date.now()}`,
                        date: unavailDate,
                        time: unavailTime,
                        year: unavailYear || undefined,
                        subject_group: unavailSubjectGroup || undefined
                      };
                      const updated = {
                        ...unavailabilityTeacher,
                        unavailabilities: [...currentUnavailabilities, newUn]
                      };
                      onUpdateTeacher(updated);
                      setUnavailabilityTeacher(updated);
                      setUnavailDate('');
                      setUnavailYear('');
                      setUnavailSubjectGroup('');
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{lang === 'pt' ? 'Adicionar' : 'Add'}</span>
                  </button>
                </div>
              </div>

              {/* Current registered unavailabilities list */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-sans">
                  {lang === 'pt' ? 'Indisponibilidades Registadas' : 'Registered Unavailabilities'}
                </h4>

                <div className="border border-slate-150 rounded-xl overflow-hidden bg-white max-h-[160px] overflow-y-auto">
                  {unavailabilityTeacher.unavailabilities && unavailabilityTeacher.unavailabilities.length > 0 ? (
                    <div className="divide-y divide-slate-100 text-xs">
                      {unavailabilityTeacher.unavailabilities
                        .slice()
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((un) => (
                          <div key={un.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/55 transition">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <div className="font-mono text-xs font-semibold text-slate-800">
                                {un.date === 'all' ? (lang === 'pt' ? 'Todas as datas' : 'All Dates') : un.date}
                              </div>
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-sans">
                                {un.time === 'all' ? t.allDay : (un.time === '09:00' ? (lang === 'pt' ? 'Manhã' : 'Morning') : (lang === 'pt' ? 'Tarde' : 'Afternoon'))}
                              </span>
                              {un.year && (
                                <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-sans">
                                  {un.year}º Ano
                                </span>
                              )}
                              {un.subject_group && (
                                <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-sans">
                                  {un.subject_group}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const currentUnavailabilities = unavailabilityTeacher.unavailabilities || [];
                                const updatedUnavailabilities = currentUnavailabilities.filter(u => u.id !== un.id);
                                const updated = {
                                  ...unavailabilityTeacher,
                                  unavailabilities: updatedUnavailabilities
                                };
                                onUpdateTeacher(updated);
                                setUnavailabilityTeacher(updated);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-xs text-slate-400 italic">
                      {t.noUnavailabilities}
                    </p>
                  )}
                </div>
              </div>

              {/* Close Button footer */}
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUnavailabilityTeacher(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-md"
                >
                  {lang === 'pt' ? 'Concluir' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
