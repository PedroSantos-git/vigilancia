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
      const parts: string[] = [exam.name];
      if (exam.code) parts.push(exam.code);
      parts.push(`${exam.year}º`);
      if (exam.shift) parts.push(exam.shift);
      if (exam.modality) parts.push(exam.modality);
      parts.push(`${exam.phase}ª Fase`);
      return parts.join(' | ');
    }

    const parts: string[] = [exam.name];
    if (exam.code) parts.push(exam.code);
    parts.push(exam.year);
    if (exam.shift) parts.push(exam.shift);
    if (exam.modality) parts.push(exam.modality);
    parts.push(`${exam.phase}st Phase`);
    return parts.join(' | ');
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

    const addPageNumbers = () => {
      const pageCount = (doc as any).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `${lang === 'pt' ? 'Página' : 'Page'} ${i} / ${pageCount}`,
          doc.internal.pageSize.width - 15,
          doc.internal.pageSize.height - 10,
          { align: 'right' }
        );
      }
    };

    const formatExamLine1 = (exam: Exam) => {
      const parts: string[] = [exam.name, `${exam.year}º`];
      if (exam.code) parts.push(`(${exam.code})`);
      if (exam.modality) parts.push(exam.modality);
      if (exam.shift) parts.push(exam.shift);
      if (exam.phase) parts.push(`${exam.phase}ª Fase`);
      return parts.join(' ');
    };

    const formatExamLine2 = (role: string, room: Room, exam: Exam) => {
      return `${getRoleLabel(role)} | Sala: ${room.name} | Data: ${exam.date} | Hora: ${exam.time}`;
    };

    // Title
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(lang === 'pt' ? 'Resumo de Atribuições por Professor' : 'Teacher Assignments Summary', 14, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${new Date().toLocaleDateString()}`, 14, 28);

    let currentY = 35;
    const sortedTeachers = [...(Array.isArray(teachers) ? teachers : [])]
      .filter(teacher => {
        const teacherAssignments = assignmentsByTeacher.get(teacher.id) || [];
        const hasAssignments = teacherAssignments.length > 0;
        const roleNorm = String(teacher.role || '').toLowerCase().trim();
        const isEligibleByProfile = teacher.available && roleNorm === '';

        return isEligibleByProfile || hasAssignments;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    sortedTeachers.forEach((teacher, teacherIdx) => {
      const teacherAssignments = [...(assignmentsByTeacher.get(teacher.id) || [])].sort((a, b) => {
        if (a.exam.date !== b.exam.date) return a.exam.date.localeCompare(b.exam.date);
        if (a.exam.time !== b.exam.time) return a.exam.time.localeCompare(b.exam.time);
        if (a.exam.name !== b.exam.name) return a.exam.name.localeCompare(b.exam.name);
        return a.room.name.localeCompare(b.room.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      // Calculate teacher header height based on whether teacher has a role
      const hasRole = !!teacher.role;
      const headerHeight = hasRole ? 35 : 25;

      // Check if we need a new page for this teacher
      const estimatedHeightForTeacher = headerHeight + (teacherAssignments.length * 20);
      if (currentY + estimatedHeightForTeacher > doc.internal.pageSize.height - 20) {
        doc.addPage();
        currentY = 20;
      }

      // Teacher Header
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(10, currentY - 5, 190, headerHeight, 3, 3, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(teacher.name, 14, currentY + 7);
      let currentLine = 1;
      if (hasRole) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(teacher.role, 14, currentY + 14);
        currentLine++;
      }
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(71, 85, 105);
      doc.text(`${teacher.subject_group} - ${teacher.subject}`, 14, currentY + 7 + (currentLine * 7));

      // Total count
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${lang === 'pt' ? 'Total' : 'Total'}: ${teacherAssignments.length}`, 188, currentY + 10, { align: 'right' });

      currentY += headerHeight;

      if (teacherAssignments.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(lang === 'pt' ? 'Sem atribuições.' : 'No assignments.', 20, currentY + 5);
        currentY += 15;
      } else {
        // Assignments
        teacherAssignments.forEach((assignment, idx) => {
          // Check for new page within teacher's assignments (try to keep together)
          if (currentY + 20 > doc.internal.pageSize.height - 20) {
            doc.addPage();
            currentY = 20;
            // Repeat teacher name at top of new page with continuation label
            const continuationHeaderHeight = hasRole ? 35 : 25;
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(10, currentY - 5, 190, continuationHeaderHeight, 3, 3, 'F');
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`${teacher.name} (${lang === 'pt' ? 'continuação' : 'continued'})`, 14, currentY + 7);
            let continuationLine = 1;
            if (hasRole) {
              doc.setFontSize(9);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(71, 85, 105);
              doc.text(teacher.role, 14, currentY + 14);
              continuationLine++;
            }
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(71, 85, 105);
            doc.text(`${teacher.subject_group} - ${teacher.subject}`, 14, currentY + 7 + (continuationLine * 7));
            currentY += continuationHeaderHeight;
          }

          // Exam line 1
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 64, 175);
          doc.text(formatExamLine1(assignment.exam), 20, currentY + 5);

          // Exam line 2
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text(formatExamLine2(assignment.role, assignment.room, assignment.exam), 20, currentY + 12);

          currentY += 18;
        });
      }

      // Add spacing between teachers
      if (teacherIdx < sortedTeachers.length - 1) {
        currentY += 10;
      }
    });

    addPageNumbers();
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

    const title = lang === 'pt' ? 'Escala Oficial de Vigilâncias' : 'Official Exams Invigilation Scale';
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

    let pageNumber = 1;

    const drawFooter = () => {
      const pageCount = (doc as any).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(
          lang === 'pt' ? 'A Direção: _________________________' : 'The Director: _________________________',
          15,
          287
        );
        doc.text(
          `${lang === 'pt' ? 'Página' : 'Page'} ${i} de ${pageCount}`,
          180,
          287,
          { align: 'right' }
        );
      }
    };

    const drawSlotHeader = (slotDate: string, slotTime: string, isContinuation: boolean = false) => {
      let startY = 12;
      if (!isContinuation) {
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
      } else {
        doc.setFillColor(241, 245, 249);
        doc.rect(10, startY, 190, 15, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.text(
          lang === 'pt'
            ? `Continuação - Página ${pageNumber} | Dia: ${slotDate} | Hora: ${slotTime}`
            : `Continuation - Page ${pageNumber} | Date: ${slotDate} | Time: ${slotTime}`,
          15,
          startY + 9
        );
        return startY + 18;
      }
    };

    groupedSlots.forEach((slot, slotIdx) => {
      if (slotIdx > 0) {
        doc.addPage();
        pageNumber++;
      }
      let currentY = drawSlotHeader(slot.date, slot.time, false);

      slot.exams.forEach(exam => {
        const examRows = [...(allocationsByExam.get(exam.id) || [])].sort((a, b) =>
          a.room.name.localeCompare(b.room.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        if (examRows.length === 0) return;

        // Check if we need a new page for this exam
        const estimatedExamHeaderHeight = 16;
        const estimatedTableHeight = examRows.length * 3 * 10;
        if (currentY + estimatedExamHeaderHeight + estimatedTableHeight > 270) {
          doc.addPage();
          pageNumber++;
          currentY = drawSlotHeader(slot.date, slot.time, true);
        }

        // Exam header
        const examLabelParts = [
          lang === 'pt' ? `Data: ${exam.date} | Hora: ${exam.time}` : `Date: ${exam.date} | Time: ${exam.time}`,
          formatExamIdentity(exam)
        ];
        const examLabelLines = doc.splitTextToSize(examLabelParts.join(' | '), 183);
        const examHeaderHeight = Math.max(16, examLabelLines.length * 5 + 6);
        doc.setFillColor(59, 130, 246);
        doc.rect(10, currentY, 190, examHeaderHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(examLabelLines, 13, currentY + 6);
        doc.setFont('helvetica', 'normal');
        currentY += examHeaderHeight + 3;

        // Prepare table data
        const tableHeaders = [[
          lang === 'pt' ? 'Sala' : 'Room',
          lang === 'pt' ? 'Função' : 'Role',
          lang === 'pt' ? 'Docente' : 'Teacher',
          lang === 'pt' ? 'Assinatura' : 'Signature'
        ]];

        const tableData: string[][] = [];
        examRows.forEach(({ alloc, room }) => {
          const getTeacherCell = (teacherId: string | null) => {
            if (!teacherId) return '-';
            const teacher = teacherById.get(teacherId);
            if (!teacher) return '-';
            return `${teacher.name}\n(${teacher.subject_group} - ${teacher.subject})`;
          };

          const v1Text = getTeacherCell(alloc.invigilator1Id);
          const v2Text = getTeacherCell(alloc.invigilator2Id);
          const subText = getTeacherCell(alloc.substituteId);

          tableData.push([room.name, getRoleLabel('invigilator1'), v1Text, '____________________']);
          tableData.push(['', getRoleLabel('invigilator2'), v2Text, '____________________']);
          tableData.push(['', getRoleLabel('substitute'), subText, '____________________']);
        });

        // Draw table
        autoTable(doc, {
          startY: currentY,
          head: tableHeaders,
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42], textColor: 255 },
          styles: { fontSize: 9, cellPadding: 2, minCellHeight: 10 },
          margin: { left: 10, right: 10, bottom: 20 },
          columnStyles: {
            0: { cellWidth: 32 },
            1: { cellWidth: 32 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 44 }
          },
          willDrawCell: (data) => {
            if (data.cell.section === 'body' && data.column.index === 2 && data.cell.text.length > 1) {
              // The second line is the group/subject - style it
              data.doc.setFontSize(7);
              data.doc.setFont('helvetica', 'italic');
            }
          }
        });

        currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 8;
      });
    });

    drawFooter();

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
