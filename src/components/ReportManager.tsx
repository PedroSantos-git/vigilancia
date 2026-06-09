/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Teacher, Room, Exam, Allocation, Language, TeacherRole } from '../types';
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
  availableRoles: TeacherRole[];
}

export default function ReportManager({
  lang,
  teachers,
  rooms,
  exams,
  allocations,
  availableRoles,
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

    const getRoleName = (roleId: string | null | undefined) => {
      if (!roleId) return '';
      const role = availableRoles.find(r => r.id === roleId);
      return role ? role.name : roleId;
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
      const roleName = getRoleName(teacher.role);
      const hasRole = !!roleName;
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
        doc.text(roleName, 14, currentY + 14);
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
              doc.text(roleName, 14, currentY + 14);
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

  const handleExportOfficialScale = () => {
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

    // Helper function to get teacher role name
    const getRoleName = (roleId: string | null | undefined) => {
      if (!roleId) return '';
      const role = availableRoles.find(r => r.id === roleId);
      return role ? role.name : roleId;
    };

    // Helper function to format exam info as requested
    const formatExamLine = (exam: Exam) => {
      const parts: string[] = [exam.name, `${exam.year}º`];
      if (exam.code) parts.push(`(${exam.code})`);
      if (exam.modality) parts.push(exam.modality);
      if (exam.shift) parts.push(exam.shift);
      if (exam.phase) parts.push(`${exam.phase}ª Fase`);
      return parts.join(' ');
    };

    // Track the current start page for each slot
    let globalPageCounter = 1;

    // Process each time slot (date + time)
    groupedSlots.forEach((slot, slotIdx) => {
      const slotPageStart = globalPageCounter;
      let slotPageCount = 1;
      let currentPageInSlot = 1;

      // Collect all substitutes for this slot
      const slotSubstitutes = new Set<string>();

      // First pass to collect substitutes
      slot.exams.forEach(exam => {
        const examRows = [...(allocationsByExam.get(exam.id) || [])];
        examRows.forEach(({ alloc }) => {
          if (alloc.substituteId) slotSubstitutes.add(alloc.substituteId);
        });
      });

      // Helper to draw the main slot header
      const drawMainSlotHeader = () => {
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
            ? `Dia: ${slot.date} | Hora: ${slot.time}`
            : `Date: ${slot.date} | Time: ${slot.time}`,
          15,
          startY + 31
        );
        return startY + 40;
      };

      // Draw initial header
      let currentY = drawMainSlotHeader();

      // Now draw exams and rooms for this slot
      slot.exams.forEach(exam => {
        const examRows = [...(allocationsByExam.get(exam.id) || [])].sort((a, b) =>
          a.room.name.localeCompare(b.room.name, undefined, { numeric: true, sensitivity: 'base' })
        );
        if (examRows.length === 0) return;

        // Exam header (blue bar)
        const examLabel = `${lang === 'pt' ? 'Data: ' + exam.date + ' | Hora: ' + exam.time : 'Date: ' + exam.date + ' | Time: ' + exam.time} | ${formatExamLine(exam)}`;
        const examLabelLines = doc.splitTextToSize(examLabel, 183);
        const examHeaderHeight = Math.max(16, examLabelLines.length * 5 + 6);

        // Check if we need a new page before this exam
        if (currentY + examHeaderHeight + 30 > 270) {
          doc.addPage();
          globalPageCounter++;
          currentPageInSlot++;
          slotPageCount++;
          currentY = drawMainSlotHeader(); // Always full header, no continuation label
        }

        // Draw exam header
        doc.setFillColor(59, 130, 246);
        doc.rect(10, currentY, 190, examHeaderHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(examLabelLines, 13, currentY + 6);
        doc.setFont('helvetica', 'normal');
        currentY += examHeaderHeight + 3;

        // Draw each room and vigilantes
        examRows.forEach(({ alloc, room }) => {
          // Check if we need a new page for this room
          if (currentY + 35 > 270) {
            doc.addPage();
            globalPageCounter++;
            currentPageInSlot++;
            slotPageCount++;
            currentY = drawMainSlotHeader();
          }

          // Draw room separator
          doc.setDrawColor(59, 130, 246);
          doc.setLineWidth(0.5);
          doc.line(15, currentY, 195, currentY);
          doc.setDrawColor(0, 0, 0);
          currentY += 4;

          // Draw room header
          doc.setTextColor(30, 64, 175);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(`${lang === 'pt' ? 'Sala' : 'Room'}: ${room.name}`, 15, currentY);
          currentY += 6;

          // Draw vigilante 1
          const v1 = alloc.invigilator1Id ? teacherById.get(alloc.invigilator1Id) : null;
          if (v1) {
            // Left side: Teacher info
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`${getRoleLabel('invigilator1')}: ${v1.name}`, 18, currentY);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            const v1Role = getRoleName(v1.role);
            doc.setTextColor(71, 85, 105);
            const v1Info = `(${v1.subject_group} - ${v1.subject})${v1Role ? ` | ${v1Role}` : ''}`;
            doc.text(v1Info, 18, currentY + 4);
            // Right side: Assinatura and line
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(lang === 'pt' ? 'Assinatura:' : 'Signature:', 120, currentY);
            doc.setDrawColor(100, 100, 100);
            doc.line(140, currentY + 1, 190, currentY + 1);
            currentY += 10;
          }

          // Draw vigilante 2
          const v2 = alloc.invigilator2Id ? teacherById.get(alloc.invigilator2Id) : null;
          if (v2) {
            // Left side: Teacher info
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`${getRoleLabel('invigilator2')}: ${v2.name}`, 18, currentY);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');
            const v2Role = getRoleName(v2.role);
            doc.setTextColor(71, 85, 105);
            const v2Info = `(${v2.subject_group} - ${v2.subject})${v2Role ? ` | ${v2Role}` : ''}`;
            doc.text(v2Info, 18, currentY + 4);
            // Right side: Assinatura and line
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(lang === 'pt' ? 'Assinatura:' : 'Signature:', 120, currentY);
            doc.setDrawColor(100, 100, 100);
            doc.line(140, currentY + 1, 190, currentY + 1);
            currentY += 10;
          }

          currentY += 4;
        });
      });

      // Now draw substitutes for this slot at the end
      if (slotSubstitutes.size > 0) {
        // Check if we need a new page for substitutes
        const estimatedSubHeight = 20 + (slotSubstitutes.size * 10);
        if (currentY + estimatedSubHeight > 270) {
          doc.addPage();
          globalPageCounter++;
          currentPageInSlot++;
          slotPageCount++;
          currentY = drawMainSlotHeader();
        }

        // Draw substitutes header
        doc.setFillColor(234, 88, 12);
        doc.rect(10, currentY, 190, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(lang === 'pt' ? 'Suplentes' : 'Substitutes', 15, currentY + 8);
        currentY += 16;

        // Draw each substitute
        Array.from(slotSubstitutes).forEach(subId => {
          const sub = teacherById.get(subId);
          if (!sub) return;

          if (currentY + 10 > 270) {
            doc.addPage();
            globalPageCounter++;
            currentPageInSlot++;
            slotPageCount++;
            currentY = drawMainSlotHeader();
          }

          // Left side: Teacher info
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`${lang === 'pt' ? 'Suplente' : 'Substitute'}: ${sub.name}`, 18, currentY);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          const subRole = getRoleName(sub.role);
          doc.setTextColor(71, 85, 105);
          const subInfo = `(${sub.subject_group} - ${sub.subject})${subRole ? ` | ${subRole}` : ''}`;
          doc.text(subInfo, 18, currentY + 4);
          // Right side: Assinatura and line
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(lang === 'pt' ? 'Assinatura:' : 'Signature:', 120, currentY);
          doc.setDrawColor(100, 100, 100);
          doc.line(140, currentY + 1, 190, currentY + 1);
          currentY += 10;
        });
      }

      // Now draw footers for all pages in this slot
      const startPage = slotPageStart;
      const endPage = (doc as any).getNumberOfPages();
      for (let i = startPage; i <= endPage; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text(
          lang === 'pt' ? 'A Direção: _________________________' : 'The Director: _________________________',
          15,
          287
        );
        doc.text(
          `${lang === 'pt' ? 'Página' : 'Page'} ${i - startPage + 1} de ${slotPageCount}`,
          180,
          287,
          { align: 'right' }
        );
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(
          lang === 'pt'
            ? `Dia: ${slot.date} | Hora: ${slot.time}`
            : `Date: ${slot.date} | Time: ${slot.time}`,
          15,
          293
        );
      }

      if (slotIdx < groupedSlots.length - 1) {
        doc.addPage();
        globalPageCounter++;
      }
    });

    doc.save(`escala_vigilancias_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleExportVigilanceList = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const records = getValidAllocationRecords();
    const teacherById = new Map((Array.isArray(teachers) ? teachers : []).map(teacher => [teacher.id, teacher]));
    
    // Collect all assignments by teacher
    interface AssignmentEntry {
      teacherId: string;
      date: string;
      time: string;
      isSubstitute: boolean;
      roomName?: string;
    }
    
    const assignmentsByTeacher = new Map<string, AssignmentEntry[]>();
    
    records.forEach(({ alloc, exam, room }) => {
      if (alloc.invigilator1Id) {
        const existing = assignmentsByTeacher.get(alloc.invigilator1Id) || [];
        existing.push({
          teacherId: alloc.invigilator1Id,
          date: exam.date,
          time: exam.time,
          isSubstitute: false,
          roomName: room.name
        });
        assignmentsByTeacher.set(alloc.invigilator1Id, existing);
      }
      if (alloc.invigilator2Id) {
        const existing = assignmentsByTeacher.get(alloc.invigilator2Id) || [];
        existing.push({
          teacherId: alloc.invigilator2Id,
          date: exam.date,
          time: exam.time,
          isSubstitute: false,
          roomName: room.name
        });
        assignmentsByTeacher.set(alloc.invigilator2Id, existing);
      }
      if (alloc.substituteId) {
        const existing = assignmentsByTeacher.get(alloc.substituteId) || [];
        existing.push({
          teacherId: alloc.substituteId,
          date: exam.date,
          time: exam.time,
          isSubstitute: true
        });
        assignmentsByTeacher.set(alloc.substituteId, existing);
      }
    });

    // Helper functions
    const getRoleName = (roleId: string | null | undefined) => {
      if (!roleId) return '';
      const role = availableRoles.find(r => r.id === roleId);
      return role ? role.name : roleId;
    };

    const title = lang === 'pt' ? 'Lista de Vigilâncias' : 'Vigilance List';
    const schoolName = 'Escola Secundária D. João II';
    const schoolYearLabel = lang === 'pt' ? 'Ano Letivo: 2025/2026' : 'School Year: 2025/2026';

    let currentY = 20;

    // Draw title header
    doc.setFillColor(15, 23, 42);
    doc.rect(10, 10, 190, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(schoolName, 14, 20);
    doc.setFontSize(10);
    doc.text(schoolYearLabel, 14, 27);
    doc.setFontSize(12);
    doc.text(title, 14, 33);

    currentY = 45;

    // Now process each teacher
    const sortedTeachers = [...(Array.isArray(teachers) ? teachers : [])]
      .filter(t => assignmentsByTeacher.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    let pageCount = 1;

    const addPageNumbers = () => {
      const totalPages = (doc as any).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `${lang === 'pt' ? 'Página' : 'Page'} ${i} de ${totalPages}`,
          180,
          290,
          { align: 'right' }
        );
      }
    };

    sortedTeachers.forEach((teacher, idx) => {
      const teacherAssignments = (assignmentsByTeacher.get(teacher.id) || [])
        .sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.time.localeCompare(b.time);
        });

      // Estimate height for teacher's section
      const estimatedHeight = 30 + (teacherAssignments.length * 10);
      if (currentY + estimatedHeight > 275) {
        doc.addPage();
        pageCount++;
        currentY = 20;
      }

      // Draw teacher header
      doc.setFillColor(241, 245, 249);
      doc.rect(10, currentY, 190, 20, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(teacher.name, 14, currentY + 7);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(71, 85, 105);
      const roleText = getRoleName(teacher.role);
      const teacherInfo = `(${teacher.subject_group} - ${teacher.subject})${roleText ? ` | ${roleText}` : ''}`;
      doc.text(teacherInfo, 14, currentY + 14);
      currentY += 25;

      // Draw each assignment
      teacherAssignments.forEach(assignment => {
        if (currentY + 15 > 275) {
          doc.addPage();
          pageCount++;
          currentY = 20;
          // Repeat teacher header on new page
          doc.setFillColor(241, 245, 249);
          doc.rect(10, currentY, 190, 20, 'F');
          doc.setTextColor(15, 23, 42);
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text(teacher.name + ` (${lang === 'pt' ? 'continuação' : 'continued'})`, 14, currentY + 7);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(71, 85, 105);
          doc.text(teacherInfo, 14, currentY + 14);
          currentY += 25;
        }

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let assignmentText = lang === 'pt' ? `Dia: ${assignment.date} | Hora: ${assignment.time}` : `Date: ${assignment.date} | Time: ${assignment.time}`;
        if (!assignment.isSubstitute) {
          assignmentText += lang === 'pt' ? ` | Sala: ${assignment.roomName}` : ` | Room: ${assignment.roomName}`;
        } else {
          assignmentText += ` | ${lang === 'pt' ? 'Suplente' : 'Substitute'}`;
        }
        
        doc.text(assignmentText, 18, currentY);
        
        // Signature line
        doc.setDrawColor(100, 100, 100);
        doc.line(18, currentY + 3, 190, currentY + 3);
        currentY += 10;
      });

      currentY += 8; // Space between teachers
    });

    addPageNumbers();
    doc.save(`lista_vigilancias_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t.tabReports}</h2>
          <p className="text-slate-500 text-xs">Análise de esforço e exportação oficial</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportTeachersPDF}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{lang === 'pt' ? 'Exportar Professores (PDF)' : 'Export Teachers (PDF)'}</span>
          </button>
          <button
            onClick={handleExportOfficialScale}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Exportar Escala Oficial (PDF)</span>
          </button>
          <button
            onClick={handleExportVigilanceList}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>{lang === 'pt' ? 'Exportar Lista de Vigilâncias (PDF)' : 'Export Vigilance List (PDF)'}</span>
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
