import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { sql } from './utils/db.js';

interface AllocationItem {
  examName: string;
  examDate: string;
  examTime: string;
  roomName: string;
  role: string;
}

interface TeacherNotification {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  allocations: AllocationItem[];
}

function buildEmailHtml(schoolName: string, teacherName: string, allocations: AllocationItem[]): string {
  const rows = allocations.map(a => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;">${a.examName}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${a.examDate}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${a.examTime}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${a.roomName}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;">${a.role}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#1e293b;max-width:640px;">
      <h2 style="color:#1d4ed8;">${schoolName}</h2>
      <p>Exmo(a). Sr(a). Prof(a). <strong>${teacherName}</strong>,</p>
      <p>Informamos que foi atribuída a seguinte vigilância de exame:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Exame</th>
            <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Data</th>
            <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Hora</th>
            <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Sala</th>
            <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Função</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:13px;color:#64748b;">Esta mensagem foi enviada automaticamente pelo sistema de gestão de vigilâncias.</p>
    </div>
  `;
}

function buildPlainText(schoolName: string, teacherName: string, allocations: AllocationItem[]): string {
  const lines = allocations.map(a =>
    `- ${a.examName} | ${a.examDate} ${a.examTime} | ${a.roomName} | ${a.role}`
  ).join('\n');

  return `${schoolName}\n\nExmo(a). Sr(a). Prof(a). ${teacherName},\n\nInformamos que foi atribuída a seguinte vigilância de exame:\n\n${lines}\n\nEsta mensagem foi enviada automaticamente pelo sistema de gestão de vigilâncias.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { notifications } = req.body as { notifications: TeacherNotification[] };

    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({ error: 'Nenhuma notificação para enviar.' });
    }

    const { rows } = await sql`SELECT * FROM email_settings WHERE id = 'default' LIMIT 1`;
    const settings = rows[0];

    if (!settings?.enabled) {
      return res.status(400).json({ error: 'O envio de emails está desativado. Ative em Config Email.' });
    }

    const apiKey = settings.resend_api_key || process.env.RESEND_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'API Key do Resend não configurada. Configure em Config Email ou defina RESEND_API_KEY.' });
    }

    if (!settings.from_email?.trim()) {
      return res.status(400).json({ error: 'Email de envio (from) não configurado.' });
    }

    const resend = new Resend(apiKey);
    const fromAddress = settings.from_name
      ? `${settings.from_name} <${settings.from_email}>`
      : settings.from_email;

    const results: Array<{ teacherName: string; email: string; success: boolean; error?: string }> = [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const notification of notifications) {
      if (!notification.teacherEmail?.trim()) {
        skippedCount++;
        results.push({
          teacherName: notification.teacherName,
          email: '',
          success: false,
          error: 'Docente sem email registado'
        });
        continue;
      }

      const subject = `${settings.subject_prefix} - ${notification.teacherName}`;
      const html = buildEmailHtml(settings.school_name, notification.teacherName, notification.allocations);
      const text = buildPlainText(settings.school_name, notification.teacherName, notification.allocations);

      try {
        const { error } = await resend.emails.send({
          from: fromAddress,
          to: notification.teacherEmail.trim(),
          subject,
          html,
          text,
          ...(settings.reply_to ? { replyTo: settings.reply_to } : {})
        });

        if (error) {
          failedCount++;
          results.push({
            teacherName: notification.teacherName,
            email: notification.teacherEmail,
            success: false,
            error: error.message
          });
          continue;
        }

        sentCount++;
        results.push({
          teacherName: notification.teacherName,
          email: notification.teacherEmail,
          success: true
        });

        await sql`
          INSERT INTO notifications (timestamp, recipient_email, recipient_name, title, message, sent_via, read)
          VALUES (
            ${new Date().toISOString()},
            ${notification.teacherEmail},
            ${notification.teacherName},
            ${subject},
            ${text},
            'email',
            false
          )
        `;
      } catch (err) {
        failedCount++;
        results.push({
          teacherName: notification.teacherName,
          email: notification.teacherEmail,
          success: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido'
        });
      }
    }

    return res.status(200).json({
      sentCount,
      failedCount,
      skippedCount,
      total: notifications.length,
      results
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao enviar notificações.' });
  }
}
