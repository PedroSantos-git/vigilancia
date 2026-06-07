/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Teacher, Language } from '../types';
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
  onAddTeacher: (teacher: Teacher) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  onClearAllTeachers: () => void;
}

export default function TeacherManager({
  lang,
  teachers,
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

  // States for Unavailability Modal
  const [unavailabilityTeacher, setUnavailabilityTeacher] = useState<Teacher | null>(null);
  const [unavailDate, setUnavailDate] = useState('');
  const [unavailTime, setUnavailTime] = useState<'all' | '09:00' | '14:00'>('all');

  // Form state
  const [name, setName] = useState('');
  const [subjectGroup, setSubjectGroup] = useState('300');
  const [subject, setSubject] = useState('');
  const [role, setRole] = useState('professor');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [available, setAvailable] = useState(true);

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
    setPhone('');
    setAvailable(true);
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
    setPhone('');
    setAvailable(teacher.available);
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

  // Filter teachers list
  const filteredTeachers = teachers.filter(tchr => {
    const term = searchTerm.toLowerCase();
    const roleName = availableRoles.find(r => r.id === tchr.role)?.name || tchr.role || '';
    return (
      (tchr.name || '').toLowerCase().includes(term) ||
      (tchr.subject || '').toLowerCase().includes(term) ||
      String(tchr.subject_group || '').toLowerCase().includes(term) ||
      roleName.toLowerCase().includes(term) ||
      (tchr.email || '').toLowerCase().includes(term)
    );
  });

  const handleExportPDF = () => {
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
      lang === 'pt' ? 'Cargo' : 'Role'
    ]];

    const data = sorted.map(t => [
      t.subject_group,
      t.name,
      t.subject,
      availableRoles.find(r => r.id === t.role)?.name || t.role || '-'
    ]);

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 }
    });

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

      {/* Teachers list and directory table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-550/80 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="px-5 py-3">{t.teacherName}</th>
                <th className="px-5 py-3 text-center">{t.subjectGroup}</th>
                <th className="px-5 py-3">{t.subject}</th>
                <th className="px-5 py-3">{t.role}</th>
                <th className="px-5 py-3">{t.email}</th>
                <th className="px-5 py-3 text-center">{t.available}</th>
                <th className="px-5 py-3 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredTeachers.length > 0 ? (
                filteredTeachers.map((tc) => (
                  <tr key={tc.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 font-semibold text-slate-900">{tc.name}</td>
                    <td className="px-5 py-3 text-center font-mono">{tc.subject_group}</td>
                    <td className="px-5 py-3">{tc.subject}</td>
                    <td className="px-5 py-3">
                      <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-medium">
                        {availableRoles.find(r => r.id === tc.role)?.name || tc.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-500">{tc.email}</td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => onUpdateTeacher({ ...tc, available: !tc.available })}
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                          tc.available 
                            ? 'bg-blue-55 text-blue-700 border border-blue-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {tc.available ? (lang === 'pt' ? 'SIM' : 'YES') : (lang === 'pt' ? 'NÃO' : 'NO')}
                      </button>
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
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    Nenhum docente encontrado de momento.
                  </td>
                </tr>
              )}
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
                    <input
                      type="date"
                      required
                      value={unavailDate}
                      onChange={(e) => setUnavailDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                    />
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
                      <option value="09:00">{t.morning}</option>
                      <option value="14:00">{t.afternoon}</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={!unavailDate}
                    onClick={() => {
                      if (!unavailDate) return;
                      const currentUnavailabilities = unavailabilityTeacher.unavailabilities || [];
                      // Prevent duplicate date + times
                      const isDup = currentUnavailabilities.some(u => u.date === unavailDate && u.time === unavailTime);
                      if (isDup) {
                        alert(lang === 'pt' ? 'Esta indisponibilidade já se encontra registada.' : 'This unavailability is already listed.');
                        return;
                      }
                      const newUn = {
                        id: `un_${Date.now()}`,
                        date: unavailDate,
                        time: unavailTime
                      };
                      const updated = {
                        ...unavailabilityTeacher,
                        unavailabilities: [...currentUnavailabilities, newUn]
                      };
                      onUpdateTeacher(updated);
                      setUnavailabilityTeacher(updated);
                      setUnavailDate('');
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
                            <div className="flex items-center space-x-3">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <div className="font-mono text-xs font-semibold text-slate-800">
                                {un.date}
                              </div>
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-sans">
                                {un.time === 'all' ? t.allDay : (un.time === '09:00' ? t.morning : t.afternoon)}
                              </span>
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
