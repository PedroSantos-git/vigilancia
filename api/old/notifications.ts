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

function mapEmailConfigRow(row: Record<string, unknown>) {
  const apiKey = row.resend_api_key as string | null;
  return {
    id: row.id,
    fromEmail: row.from_email,
    fromName: row.from_name,
    replyTo: row.reply_to || '',
    schoolName: row.school_name,
    subjectPrefix: row.subject_prefix,
    enabled: row.enabled,
    updatedAt: row.updated_at,
    hasApiKey: Boolean(apiKey || process.env.RESEND_API_KEY),
    resendApiKey: apiKey ? '••••••••' : ''
  };
}

function buildEmailHtml(schoolName: string, teacherName: string, allocations: AllocationItem[]): string {
  const rows = allocations.map(a => {
    if (!a.examName) { // Substitute case
      return `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;" colspan="3">${a.examDate} | ${a.examTime}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">-</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${a.role}</td>
        </tr>
      `;
    } else {
      return `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;">${a.examName}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${a.examDate}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${a.examTime}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${a.roomName}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${a.role}</td>
        </tr>
      `;
    }
  }).join('');

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
  const lines = allocations.map(a => {
    if (!a.examName) {
      return `- ${a.examDate} ${a.examTime} | ${a.role}`;
    } else {
      return `- ${a.examName} | ${a.examDate} ${a.examTime} | ${a.roomName} | ${a.role}`;
    }
  }).join('\n');

  return `${schoolName}\n\nExmo(a). Sr(a). Prof(a). ${teacherName},\n\nInformamos que foi atribuída a seguinte vigilância de exame:\n\n${lines}\n\nEsta mensagem foi enviada automaticamente pelo sistema de gestão de vigilâncias.`;
}

async function getEmailConfig(res: VercelResponse) {
  const { rows } = await sql`SELECT * FROM email_settings WHERE id = 'default' LIMIT 1`;
  if (rows.length === 0) {
    return res.status(200).json({
      id: 'default',
      fromEmail: '',
      fromName: '',
      replyTo: '',
      schoolName: 'Escola Secundária',
      subjectPrefix: 'Vigilância de Exame',
      enabled: false,
      hasApiKey: Boolean(process.env.RESEND_API_KEY),
      resendApiKey: ''
    });
  }
  return res.status(200).json(mapEmailConfigRow(rows[0]));
}

async function saveEmailConfig(req: VercelRequest, res: VercelResponse) {
  const {
    fromEmail,
    fromName,
    replyTo,
    schoolName,
    subjectPrefix,
    enabled,
    resendApiKey
  } = req.body;

  if (!fromEmail?.trim()) {
    return res.status(400).json({ error: 'O email de envio (from) é obrigatório.' });
  }

  const shouldUpdateApiKey = resendApiKey && resendApiKey !== '••••••••';

  if (shouldUpdateApiKey) {
    await sql`
      INSERT INTO email_settings (
        id, resend_api_key, from_email, from_name, reply_to,
        school_name, subject_prefix, enabled, updated_at
      )
      VALUES (
        'default', ${resendApiKey}, ${fromEmail.trim()}, ${fromName?.trim() || ''},
        ${replyTo?.trim() || null}, ${schoolName?.trim() || 'Escola Secundária'},
        ${subjectPrefix?.trim() || 'Vigilância de Exame'}, ${Boolean(enabled)}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        resend_api_key = EXCLUDED.resend_api_key,
        from_email = EXCLUDED.from_email,
        from_name = EXCLUDED.from_name,
        reply_to = EXCLUDED.reply_to,
        school_name = EXCLUDED.school_name,
        subject_prefix = EXCLUDED.subject_prefix,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    `;
  } else {
    await sql`
      INSERT INTO email_settings (
        id, from_email, from_name, reply_to,
        school_name, subject_prefix, enabled, updated_at
      )
      VALUES (
        'default', ${fromEmail.trim()}, ${fromName?.trim() || ''},
        ${replyTo?.trim() || null}, ${schoolName?.trim() || 'Escola Secundária'},
        ${subjectPrefix?.trim() || 'Vigilância de Exame'}, ${Boolean(enabled)}, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        from_email = EXCLUDED.from_email,
        from_name = EXCLUDED.from_name,
        reply_to = EXCLUDED.reply_to,
        school_name = EXCLUDED.school_name,
        subject_prefix = EXCLUDED.subject_prefix,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
    `;
  }

  const { rows } = await sql`SELECT * FROM email_settings WHERE id = 'default' LIMIT 1`;
  return res.status(200).json(mapEmailConfigRow(rows[0]));
}

async function sendNotifications(req: VercelRequest, res: VercelResponse) {
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
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET': {
        if (req.query.type === 'config') {
          return getEmailConfig(res);
        }

        const { rows: notifications } = await sql`SELECT * FROM notifications ORDER BY timestamp DESC`;
        const mappedNotifications = notifications.map(n => ({
          ...n,
          recipientEmail: n.recipient_email,
          recipientName: n.recipient_name,
          sentVia: n.sent_via
        }));
        return res.status(200).json(mappedNotifications);
      }

      case 'POST': {
        const { action } = req.body;

        if (action === 'send') {
          return sendNotifications(req, res);
        }

        if (action === 'saveConfig') {
          return saveEmailConfig(req, res);
        }

        const { id, timestamp, recipientEmail, recipientName, title, message, sentVia, read } = req.body;

        if (id) {
          await sql`
            INSERT INTO notifications (id, timestamp, recipient_email, recipient_name, title, message, sent_via, read)
            VALUES (${id}, ${timestamp}, ${recipientEmail}, ${recipientName}, ${title}, ${message}, ${sentVia}, ${read})
            ON CONFLICT (id) DO UPDATE SET
              read = EXCLUDED.read
          `;
        } else {
          await sql`
            INSERT INTO notifications (timestamp, recipient_email, recipient_name, title, message, sent_via, read)
            VALUES (${timestamp}, ${recipientEmail}, ${recipientName}, ${title}, ${message}, ${sentVia}, ${read})
          `;
        }
        return res.status(201).json({ message: 'Notification saved' });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
