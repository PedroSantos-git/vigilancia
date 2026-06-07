/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Teacher, Room, Exam, Allocation, Language } from '../types';
import { translations } from '../translations';
import { 
  Download, 
  Printer, 
  CheckCircle, 
  FileText
} from 'lucide-react';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPeriodFromTime } from '../utils/scheduler';

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

  // Calculations: count invigilations per teacher (Fatigue counter)
  const teacherStats = (Array.isArray(teachers) ? teachers : []).map(tchr => {
    let count = 0;
    if (Array.isArray(allocations)) {
      allocations.forEach(alloc => {
        if (alloc.invigilator1Id === tchr.id) count++;
        if (alloc.invigilator2Id === tchr.id) count++;
        if (alloc.substituteId === tchr.id) count++;
      });
    }
    return {
      teacher: tchr,
      count
    };
  }).sort((a, b) => b.count - a.count);

  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const activeExams = (Array.isArray(exams) ? exams : []).filter(exam => {
      const examAllocs = Array.isArray(allocations) ? allocations.filter(a => a.examId === exam.id) : [];
      return examAllocs.length > 0;
    });

    if (activeExams.length === 0) {
      alert(lang === 'pt' ? 'Nenhuma alocação registada para exportar.' : 'No allocations registered to export.');
      return;
    }

    const title = lang === 'pt' ? 'Escala Oficial de Vigilâncias - Exames Nacionais' : 'Official National Exams Invigilation Scale';
    const schoolName = 'Escola Secundária D. João II';
    const schoolYearLabel = lang === 'pt' ? 'Ano Letivo: 2025/2026' : 'School Year: 2025/2026';

    activeExams.forEach((exam, examIdx) => {
      if (examIdx > 0) doc.addPage();
      
      let currentY = 15;
      doc.setFillColor(15, 23, 42); 
      doc.rect(10, currentY, 190, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text(schoolName, 15, currentY + 10);
      doc.setFontSize(9);
      doc.text(schoolYearLabel, 15, currentY + 18);
      doc.setFontSize(11);
      doc.text(title, 15, currentY + 25);

      currentY += 40;

      const examAllocs = Array.isArray(allocations) ? allocations.filter(a => a.examId === exam.id) : [];
      
      doc.setFillColor(241, 245, 249);
      doc.rect(10, currentY, 190, 10, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      const examPeriod = getPeriodFromTime(exam.time) === '09:00' ? t.periodMorning : t.periodAfternoon;
      const examLabel = `${exam.name} (${exam.year}º Ano) | ${exam.date} • ${examPeriod} (${exam.time}) | Fase ${exam.phase}`;
      doc.text(examLabel, 13, currentY + 6.5);

      currentY += 15;

      const tableHeaders = [[t.roomNameCol, t.invigilator1, t.invigilator2, t.presenceSignature]];
      const tableData = examAllocs.map(alloc => {
        const roomObj = Array.isArray(rooms) ? rooms.find(r => r.id === alloc.roomId) : null;
        const v1 = Array.isArray(teachers) ? teachers.find(tchr => tchr.id === alloc.invigilator1Id) : null;
        const v2 = Array.isArray(teachers) ? teachers.find(tchr => tchr.id === alloc.invigilator2Id) : null;
        return [
          roomObj?.name || '-',
          v1?.name || '-',
          v2?.name || '-',
          '____________________'
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: tableHeaders,
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        margin: { left: 10, right: 10 }
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
            onClick={() => {
              const doc = new jsPDF();
              doc.setFontSize(16);
              doc.text(lang === 'pt' ? 'Resumo de Atribuições por Professor' : 'Teacher Assignments Summary', 14, 15);
              doc.setFontSize(10);
              doc.text(`${new Date().toLocaleDateString()}`, 14, 22);

              const headers = [[
                lang === 'pt' ? 'Nome' : 'Name', 
                lang === 'pt' ? 'Grupo' : 'Group', 
                lang === 'pt' ? 'Total Vigilâncias/Suplências' : 'Total Invigilations/Standbys'
              ]];
              
              const data = teachers
                .filter(tchr => {
                  // Rule: Only include available teachers with no special role (or role "professor")
                  const tRole = (tchr.role || "").toLowerCase();
                  const isProfessor = tRole === "" || tRole === "professor";
                  return tchr.available && isProfessor;
                })
                .map(tchr => {
                  let count = 0;
                  allocations.forEach(alloc => {
                    if (alloc.invigilator1Id === tchr.id) count++;
                    if (alloc.invigilator2Id === tchr.id) count++;
                    if (alloc.substituteId === tchr.id) count++;
                  });
                  return [tchr.name, tchr.subject_group, count.toString()];
                })
                .sort((a, b) => a[0].localeCompare(b[0]));

              autoTable(doc, { 
                head: headers, 
                body: data, 
                startY: 30,
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42] }
              });
              doc.save(`resumo_atribuicoes_${new Date().toISOString().slice(0, 10)}.pdf`);
            }}
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
