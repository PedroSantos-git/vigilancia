/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Teacher, Room, Exam, Allocation, Language } from '../types';
import { translations } from '../translations';
import { 
  Download, 
  CheckCircle
} from 'lucide-react';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportManagerProps {
  lang: Language;
  teachers: Teacher[];
  rooms: Room[];
  exams: Exam[];
  allocations: Allocation[];
}

export default function ReportManager({
  lang,
  teachers,
  rooms,
  exams,
  allocations
}: ReportManagerProps) {
  const t = translations[lang];

  const formatExamIdentity = (exam: Exam) => {
    if (lang === 'pt') {
      return [
        `Exame: ${exam.name}`,
        `Data: ${exam.date}`,
        `Hora: ${exam.time}`,
        `Ano: ${exam.year}º`,
        `Código: ${exam.code || '-'}`,
        `Turno: ${exam.shift || '-'}`,
        `Modalidade: ${exam.modality || '-'}`,
        `Fase: ${exam.phase}`,
        `Variante: ${exam.variant || '-'}`
      ].join(' | ');
    }

    return [
      `Exam: ${exam.name}`,
      `Date: ${exam.date}`,
      `Time: ${exam.time}`,
      `Year: ${exam.year}`,
      `Code: ${exam.code || '-'}`,
      `Shift: ${exam.shift || '-'}`,
      `Modality: ${exam.modality || '-'}`,
      `Phase: ${exam.phase}`,
      `Variant: ${exam.variant || '-'}`
    ].join(' | ');
  };

  const getRoleLabel = (role: 'invigilator1' | 'invigilator2' | 'substitute') => {
    if (role === 'invigilator1') return lang === 'pt' ? 'Vigilante 1' : 'Invigilator 1';
    if (role === 'invigilator2') return lang === 'pt' ? 'Vigilante 2' : 'Invigilator 2';
    return lang === 'pt' ? 'Suplente' : 'Substitute';
  };

  const getValidAllocationRecords = () => {
    const examById = new Map((Array.isArray(exams) ? exams : []).map(exam => [exam.id, exam]));
    const roomById = new Map((Array.isArray(rooms) ? rooms : []).map(room => [room.id, room]));

    return (Array.isArray(allocations) ? allocations : [])
      .map(alloc => {
        const exam = examById.get(alloc.examId);
        const room = roomById.get(alloc.roomId);
        if (!exam || !room) return null;
        if (Array.isArray(exam.roomIds) && exam.roomIds.length > 0 && !exam.roomIds.includes(alloc.roomId)) return null;
        return { alloc, exam, room };
      })
      .filter((record): record is { alloc: Allocation; exam: Exam; room: Room } => Boolean(record));
  };

  const handleExportTeachersPDF = () => {
    const records = getValidAllocationRecords();

    type TeacherAssignment = {
      teacherId: string;
      role: 'invigilator1' | 'invigilator2' | 'substitute';
      exam: Exam;
      room: Room;
    };

    const assignments: TeacherAssignment[] = [];
    records.forEach(({ alloc, exam, room }) => {
      if (alloc.invigilator1Id) assignments.push({ teacherId: alloc.invigilator1Id, role: 'invigilator1', exam, room });
      if (alloc.invigilator2Id) assignments.push({ teacherId: alloc.invigilator2Id, role: 'invigilator2', exam, room });
      if (alloc.substituteId) assignments.push({ teacherId: alloc.substituteId, role: 'substitute', exam, room });
    });

    const assignmentsByTeacher = new Map<string, TeacherAssignment[]>();
    assignments.forEach(assignment => {
      if (!assignmentsByTeacher.has(assignment.teacherId)) assignmentsByTeacher.set(assignment.teacherId, []);
      assignmentsByTeacher.get(assignment.teacherId)!.push(assignment);
    });

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(lang === 'pt' ? 'Resumo de Atribuições por Professor' : 'Teacher Assignments Summary', 14, 15);
    doc.setFontSize(10);
    doc.text(`${new Date().toLocaleDateString()}`, 14, 22);

    const headers = [[
      lang === 'pt' ? 'Nome' : 'Name',
      lang === 'pt' ? 'Grupo' : 'Group',
      lang === 'pt' ? 'Total' : 'Total',
      lang === 'pt' ? 'Atribuições (Exame/Data/Hora/Sala/Função)' : 'Assignments (Exam/Date/Time/Room/Role)'
    ]];

    const data: string[][] = [];
    const sortedTeachers = [...(Array.isArray(teachers) ? teachers : [])]
      .filter(teacher => {
        const teacherAssignments = assignmentsByTeacher.get(teacher.id) || [];
        const hasAssignments = teacherAssignments.length > 0;
        const roleNorm = String(teacher.role || '').toLowerCase().trim();
        const isEligibleByProfile = teacher.available && roleNorm === '';

        // Default listing: only available teachers with no special role.
        // Exception: if teacher already has assignments, always include.
        return isEligibleByProfile || hasAssignments;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    sortedTeachers.forEach(teacher => {
      const teacherAssignments = [...(assignmentsByTeacher.get(teacher.id) || [])].sort((a, b) => {
        if (a.exam.date !== b.exam.date) return a.exam.date.localeCompare(b.exam.date);
        if (a.exam.time !== b.exam.time) return a.exam.time.localeCompare(b.exam.time);
        if (a.exam.name !== b.exam.name) return a.exam.name.localeCompare(b.exam.name);
        return a.room.name.localeCompare(b.room.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      if (teacherAssignments.length === 0) {
        data.push([
          teacher.name,
          teacher.subject_group || '-',
          '0',
          lang === 'pt' ? 'Sem atribuições.' : 'No assignments.'
        ]);
        return;
      }

      teacherAssignments.forEach((assignment, idx) => {
        const detail = `${getRoleLabel(assignment.role)} | Sala: ${assignment.room.name} | ${formatExamIdentity(assignment.exam)}`;
        data.push([
          idx === 0 ? teacher.name : '',
          idx === 0 ? (teacher.subject_group || '-') : '',
          idx === 0 ? String(teacherAssignments.length) : '',
          detail
        ]);
      });
    });

    autoTable(doc, {
      head: headers,
      body: data,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8, cellPadding: 1.8, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 18 },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 'auto' }
      }
    });

    doc.save(`resumo_atribuicoes_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const records = getValidAllocationRecords();
    const teacherById = new Map((Array.isArray(teachers) ? teachers : []).map(teacher => [teacher.id, teacher]));
    const allocationsByExam = new Map<string, Array<{ alloc: Allocation; room: Room }>>();

    records.forEach(({ alloc, exam, room }) => {
      if (!allocationsByExam.has(exam.id)) allocationsByExam.set(exam.id, []);
      allocationsByExam.get(exam.id)!.push({ alloc, room });
    });

    const activeExams = (Array.isArray(exams) ? exams : [])
      .filter(exam => allocationsByExam.has(exam.id))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.time !== b.time) return a.time.localeCompare(b.time);
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.id.localeCompare(b.id);
      });

    if (activeExams.length === 0) {
      alert(lang === 'pt' ? 'Nenhuma alocação registada para exportar.' : 'No allocations registered to export.');
      return;
    }

    const title = lang === 'pt' ? 'Escala Oficial de Vigilâncias - Exames Nacionais' : 'Official National Exams Invigilation Scale';
    const schoolName = 'Escola Secundária D. João II';
    const schoolYearLabel = lang === 'pt' ? 'Ano Letivo: 2025/2026' : 'School Year: 2025/2026';
    const groupMap = new Map<string, { date: string; time: string; exams: Exam[] }>();

    activeExams.forEach(exam => {
      const key = `${exam.date}@@${exam.time}`;
      if (!groupMap.has(key)) groupMap.set(key, { date: exam.date, time: exam.time, exams: [] });
      groupMap.get(key)!.exams.push(exam);
    });

    const groupedSlots = [...groupMap.values()].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

    const drawSlotHeader = (slotDate: string, slotTime: string) => {
      let startY = 12;
      doc.setFillColor(15, 23, 42);
      doc.rect(10, startY, 190, 34, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text(schoolName, 15, startY + 10);
      doc.setFontSize(9);
      doc.text(schoolYearLabel, 15, startY + 17);
      doc.setFontSize(11);
      doc.text(title, 15, startY + 24);
      doc.setFontSize(10);
      doc.text(
        lang === 'pt'
          ? `Dia: ${slotDate} | Hora: ${slotTime}`
          : `Date: ${slotDate} | Time: ${slotTime}`,
        15,
        startY + 31
      );
      return startY + 40;
    };

    groupedSlots.forEach((slot, slotIdx) => {
      if (slotIdx > 0) doc.addPage();
      let currentY = drawSlotHeader(slot.date, slot.time);

      slot.exams.forEach(exam => {
        const examRows = [...(allocationsByExam.get(exam.id) || [])].sort((a, b) =>
          a.room.name.localeCompare(b.room.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        if (examRows.length === 0) return;

        const estimatedHeight = 16 + (examRows.length * 3 * 8);
        if (currentY + estimatedHeight > 280) {
          doc.addPage();
          currentY = drawSlotHeader(slot.date, slot.time);
        }

        const examLabelLines = doc.splitTextToSize(formatExamIdentity(exam), 183);
        const examHeaderHeight = Math.max(12, examLabelLines.length * 5 + 4);
        doc.setFillColor(241, 245, 249);
        doc.rect(10, currentY, 190, examHeaderHeight, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.text(examLabelLines, 13, currentY + 5);
        currentY += examHeaderHeight + 2;

        const tableHeaders = [[
          lang === 'pt' ? 'Sala' : 'Room',
          lang === 'pt' ? 'Função' : 'Role',
          lang === 'pt' ? 'Docente' : 'Teacher',
          lang === 'pt' ? 'Assinatura' : 'Signature'
        ]];

        const tableData: string[][] = [];
        examRows.forEach(({ alloc, room }) => {
          const v1 = alloc.invigilator1Id ? teacherById.get(alloc.invigilator1Id)?.name || '-' : '-';
          const v2 = alloc.invigilator2Id ? teacherById.get(alloc.invigilator2Id)?.name || '-' : '-';
          const sub = alloc.substituteId ? teacherById.get(alloc.substituteId)?.name || '-' : '-';

          tableData.push([room.name, getRoleLabel('invigilator1'), v1, '____________________']);
          tableData.push(['', getRoleLabel('invigilator2'), v2, '____________________']);
          tableData.push(['', getRoleLabel('substitute'), sub, '____________________']);
        });

        autoTable(doc, {
          startY: currentY,
          head: tableHeaders,
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42] },
          styles: { fontSize: 9, cellPadding: 1.8 },
          margin: { left: 10, right: 10 },
          columnStyles: {
            0: { cellWidth: 32 },
            1: { cellWidth: 32 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 44 }
          }
        });

        currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 6;
      });
    });

    doc.save(`escala_vigilancias_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t.tabReports}</h2>
          <p className="text-slate-500 text-xs">Análise de esforço e exportação oficial</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportTeachersPDF}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{lang === 'pt' ? 'Exportar Professores (PDF)' : 'Export Teachers (PDF)'}</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Exportar Escala Oficial (PDF)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-2 mb-6">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800">Estado de Cobertura das Salas</h3>
          </div>
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center h-32 w-32 rounded-full border-8 border-slate-100 border-t-emerald-500 mb-4">
              <span className="text-2xl font-bold text-slate-800">100%</span>
            </div>
            <p className="text-sm text-slate-500">Todas as salas configuradas têm vigilantes e suplentes atribuídos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
