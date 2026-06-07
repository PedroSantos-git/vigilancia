/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Language, Teacher, Exam, Room, Allocation } from '../types';
import { Mail, Send, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';

interface NotificationSenderProps {
  lang: Language;
  teachers: Teacher[];
  exams: Exam[];
  rooms: Room[];
  allocations: Allocation[];
}

export default function NotificationSender({
  lang,
  teachers,
  exams,
  rooms,
  allocations
}: NotificationSenderProps) {
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastError, setLastError] = useState('');

  const teacherAllocations = teachers.map(teacher => {
    const myAllocations = allocations.filter(a =>
      a.invigilator1Id === teacher.id ||
      a.invigilator2Id === teacher.id ||
      a.substituteId === teacher.id
    );

    return {
      teacher,
      allocations: myAllocations.map(a => {
        const exam = exams.find(e => e.id === a.examId);
        const room = rooms.find(r => r.id === a.roomId);
        let role = '';
        if (a.invigilator1Id === teacher.id) role = lang === 'pt' ? 'Vigilante 1' : 'Invigilator 1';
        else if (a.invigilator2Id === teacher.id) role = lang === 'pt' ? 'Vigilante 2' : 'Invigilator 2';
        else if (a.substituteId === teacher.id) role = lang === 'pt' ? 'Suplente' : 'Substitute';

        return { exam, room, role };
      }).filter(item => item.exam && item.room)
    };
  }).filter(item => item.allocations.length > 0);

  const handleSendEmails = async () => {
    if (!confirm(lang === 'pt'
      ? 'Deseja enviar notificações por email (via Resend) para todos os docentes com vigilâncias atribuídas?'
      : 'Do you want to send email notifications (via Resend) to all teachers with assigned invigilations?'
    )) {
      return;
    }

    setIsSending(true);
    setLastError('');
    setSentCount(0);
    setFailedCount(0);

    try {
      const payload = teacherAllocations.map(({ teacher, allocations: allocs }) => ({
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherEmail: teacher.email || '',
        allocations: allocs.map(alloc => ({
          examName: alloc.exam!.name,
          examDate: alloc.exam!.date,
          examTime: alloc.exam!.time,
          roomName: alloc.room!.name,
          role: alloc.role
        }))
      }));

      const result = await api.sendNotifications(payload);
      setSentCount(result.sentCount);
      setFailedCount(result.failedCount);

      if (result.failedCount > 0 || result.skippedCount > 0) {
        const details = result.results
          ?.filter((r: { success: boolean }) => !r.success)
          .map((r: { teacherName: string; error?: string }) => `${r.teacherName}: ${r.error || 'erro'}`)
          .join('\n');
        alert(lang === 'pt'
          ? `Enviados: ${result.sentCount}. Falhados: ${result.failedCount}. Sem email: ${result.skippedCount}.\n\n${details || ''}`
          : `Sent: ${result.sentCount}. Failed: ${result.failedCount}. No email: ${result.skippedCount}.\n\n${details || ''}`
        );
      } else {
        alert(lang === 'pt'
          ? `${result.sentCount} notificações enviadas com sucesso via Resend.`
          : `${result.sentCount} notifications sent successfully via Resend.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : (lang === 'pt' ? 'Erro ao enviar notificações.' : 'Error sending notifications.');
      setLastError(message);
      alert(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-1">
            {lang === 'pt' ? 'Enviar Notificações por Email' : 'Send Email Notifications'}
          </h2>
          <p className="text-slate-400 text-xs">
            {lang === 'pt'
              ? 'Envia avisos de vigilância aos docentes via Resend.'
              : 'Send invigilation notices to teachers via Resend.'}
          </p>
        </div>
        <button
          onClick={handleSendEmails}
          disabled={isSending || teacherAllocations.length === 0}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-6 py-3 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-600/20"
        >
          {isSending ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span>{lang === 'pt' ? 'Enviar Notificações' : 'Send Notifications'}</span>
        </button>
      </div>

      {(sentCount > 0 || failedCount > 0) && (
        <div className="flex gap-3">
          {sentCount > 0 && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-2 rounded-lg">
              <CheckCircle className="h-4 w-4" />
              {sentCount} {lang === 'pt' ? 'enviados' : 'sent'}
            </div>
          )}
          {failedCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {failedCount} {lang === 'pt' ? 'falhados' : 'failed'}
            </div>
          )}
        </div>
      )}

      {lastError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {lastError}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            {lang === 'pt' ? 'Docentes a Notificar' : 'Teachers to Notify'}
          </h3>
          <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
            {teacherAllocations.length} {lang === 'pt' ? 'Docentes' : 'Teachers'}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {teacherAllocations.length > 0 ? (
            teacherAllocations.map(({ teacher, allocations }) => (
              <div key={teacher.id} className="p-5 hover:bg-slate-50/50 transition">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-sm">{teacher.name}</h4>
                    <p className={`text-xs ${teacher.email ? 'text-slate-500' : 'text-red-500 font-semibold'}`}>
                      {teacher.email || (lang === 'pt' ? 'Sem email registado' : 'No email registered')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allocations.map((alloc, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] shadow-sm">
                        <span className="font-bold text-blue-700 block mb-0.5">{alloc.exam?.name}</span>
                        <span className="text-slate-600">{alloc.room?.name} • {alloc.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-slate-400 text-xs italic">
              {lang === 'pt' ? 'Nenhuma alocação detetada para notificar.' : 'No allocations detected to notify.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
