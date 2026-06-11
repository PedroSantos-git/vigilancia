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
        ${replyTo?.trim() || null}, ${schoolName?.trim() || 'Escola Secundária',
        ${subjectPrefix?.trim() || 'Vigilância de Exame', ${Boolean(enabled)}, NOW()
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
        'default', ${fromEmail.trim()}, ${fromName?.trim() || '',
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
  const { pathname } = new URL(req.url || '', 'http://localhost');
  const path = pathname.replace('/api', '') || '/';

  try {
    switch (path) {
      // Teachers
      case '/teachers':
        return await handleTeachers(req, res);

      // Rooms
      case '/rooms':
        return await handleRooms(req, res);

      // Exams
      case '/exams':
        return await handleExams(req, res);

      // Allocations
      case '/allocations':
        return await handleAllocations(req, res);

      // Notifications
      case '/notifications':
        return await handleNotifications(req, res);

      // Gemini AI
      case '/gemini':
        return await handleGemini(req, res);

      // Import Mapa
      case '/import-mapa':
        return await handleImportMapa(req, res);

      // Bulk Data
      case '/bulk-data':
        return await handleBulkData(req, res);

      // Init DB
      case '/init-db':
        return await handleInitDb(req, res);

      // Users
      case '/users':
        return await handleUsers(req, res);

      // Roles
      case '/roles':
        return await handleRoles(req, res);

      default:
        return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Teachers handler
async function handleTeachers(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      const { rows: teachers } = await sql`SELECT * FROM teachers ORDER BY name`;
      if (!teachers || !Array.isArray(teachers)) {
        return res.status(200).json([]);
      }
      const mappedTeachers = teachers.map(t => ({
        id: t.id,
        name: t.name,
        email: t.email,
        subject: t.subject,
        subjectGroup: t.subject_group ?? t.subjectGroup,
        available: Boolean(t.available),
        unavailableDates: t.unavailable_dates ?? t.unavailableDates ?? [],
        specialRole: Boolean(t.special_role ?? t.specialRole),
        specialRoleName: t.special_role_name ?? t.specialRoleName,
        ee: Boolean(t.ee),
        pisoZero: Boolean(t.piso_zero ?? t.pisoZero),
        role: t.role ?? null
      }));
      return res.status(200).json(mappedTeachers);

    case 'POST':
      const {
        id, name, email, subject, subjectGroup,
        available, unavailableDates, specialRole,
        specialRoleName, ee, pisoZero, role
      } = req.body;
      const unavailableString = Array.isArray(unavailableDates)
        ? unavailableDates.join(',')
        : unavailableDates;

      if (id) {
        await sql`
          INSERT INTO teachers (
            id, name, email, subject, subject_group, available,
            unavailable_dates, special_role, special_role_name, ee,
            piso_zero, role
          ) VALUES (
            ${id}, ${name}, ${email}, ${subject}, ${subjectGroup},
            ${available ? 1 : 0}, ${unavailableString},
            ${specialRole ? 1 : 0}, ${specialRoleName},
            ${ee ? 1 : 0}, ${pisoZero ? 1 : 0}, ${role}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            subject = EXCLUDED.subject,
            subject_group = EXCLUDED.subject_group,
            available = EXCLUDED.available,
            unavailable_dates = EXCLUDED.unavailable_dates,
            special_role = EXCLUDED.special_role,
            special_role_name = EXCLUDED.special_role_name,
            ee = EXCLUDED.ee,
            piso_zero = EXCLUDED.piso_zero,
            role = EXCLUDED.role
        `;
      } else {
        await sql`
          INSERT INTO teachers (
            name, email, subject, subject_group, available,
            unavailable_dates, special_role, special_role_name, ee,
            piso_zero, role
          ) VALUES (
            ${name}, ${email}, ${subject}, ${subjectGroup},
            ${available ? 1 : 0}, ${unavailableString},
            ${specialRole ? 1 : 0}, ${specialRoleName},
            ${ee ? 1 : 0}, ${pisoZero ? 1 : 0}, ${role}
          )
        `;
      }
      return res.status(201).json({ message: 'Teacher saved' });

    case 'DELETE':
      const { id: deleteId } = req.query;
      if (deleteId === 'all') {
        await sql`DELETE FROM teachers`;
      } else if (deleteId) {
        await sql`DELETE FROM teachers WHERE id = ${deleteId as string}`;
      }
      return res.status(200).json({ message: 'Teacher deleted' });

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}

// Rooms handler
async function handleRooms(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      const { rows: rooms } = await sql`SELECT * FROM rooms ORDER BY priority, name`;
      if (!rooms || !Array.isArray(rooms)) {
        return res.status(200).json([]);
      }
      const mappedRooms = rooms.map(r => ({
        id: r.id,
        name: r.name,
        capacity: Number(r.capacity),
        priority: Number(r.priority),
        pisoZero: Boolean(r.piso_zero ?? r.pisoZero)
      }));
      return res.status(200).json(mappedRooms);

    case 'POST':
      const { id, name, capacity, priority, pisoZero } = req.body;
      if (id) {
        await sql`
          INSERT INTO rooms (id, name, capacity, priority, piso_zero)
          VALUES (${id}, ${name}, ${Number(capacity)}, ${Number(priority)}, ${pisoZero ? 1 : 0})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            capacity = EXCLUDED.capacity,
            priority = EXCLUDED.priority,
            piso_zero = EXCLUDED.piso_zero
        `;
      } else {
        await sql`
          INSERT INTO rooms (name, capacity, priority, piso_zero)
          VALUES (${name}, ${Number(capacity)}, ${Number(priority)}, ${pisoZero ? 1 : 0})
        `;
      }
      return res.status(201).json({ message: 'Room saved' });

    case 'PUT':
      const { rooms: roomsToUpdate } = req.body;
      for (const room of roomsToUpdate) {
        await sql`
          INSERT INTO rooms (id, name, capacity, priority, piso_zero)
          VALUES (${room.id}, ${room.name}, ${Number(room.capacity)}, ${Number(room.priority)}, ${room.pisoZero ? 1 : 0})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            capacity = EXCLUDED.capacity,
            priority = EXCLUDED.priority,
            piso_zero = EXCLUDED.piso_zero
        `;
      }
      return res.status(200).json({ message: 'Rooms updated' });

    case 'DELETE':
      const { id: deleteId } = req.query;
      if (deleteId) {
        await sql`DELETE FROM rooms WHERE id = ${deleteId as string}`;
      }
      return res.status(200).json({ message: 'Room deleted' });

    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}

// Exams handler
async function handleExams(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      const { rows: exams } = await sql`SELECT * FROM exams ORDER BY date, time`;
      if (!exams || !Array.isArray(exams)) {
        return res.status(200).json([]);
      }
      const mappedExams = exams.map(e => ({
        id: e.id,
        name: e.name,
        date: e.date,
        time: e.time,
        code: e.code,
        year: e.year,
        modality: e.modality,
        shift: e.shift,
        phase: e.phase,
        ee: Boolean(e.ee),
        roomIds: e.room_ids ? e.room_ids.split(',').filter(Boolean) : []
      }));
      return res.status(200).json(mappedExams);

    case 'POST':
      const {
        id, name, date, time, code, year,
        modality, shift, phase, ee, roomIds
      } = req.body;
      const roomIdsString = Array.isArray(roomIds) ? roomIds.join(',') : '';
      if (id) {
        await sql`
          INSERT INTO exams (
            id, name, date, time, code, year, modality,
            shift, phase, ee, room_ids
          ) VALUES (
            ${id}, ${name}, ${date}, ${time}, ${code}, ${year},
            ${modality}, ${shift}, ${phase}, ${ee ? 1 : 0},
            ${roomIdsString}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            date = EXCLUDED.date,
            time = EXCLUDED.time,
            code = EXCLUDED.code,
            year = EXCLUDED.year,
            modality = EXCLUDED.modality,
            shift = EXCLUDED.shift,
            phase = EXCLUDED.phase,
            ee = EXCLUDED.ee,
            room_ids = EXCLUDED.room_ids
        `;
      } else {
        await sql`
          INSERT INTO exams (
            name, date, time, code, year, modality,
            shift, phase, ee, room_ids
          ) VALUES (
            ${name}, ${date}, ${time}, ${code}, ${year},
            ${modality}, ${shift}, ${phase}, ${ee ? 1 : 0},
            ${roomIdsString}
          )
        `;
      }
      return res.status(201).json({ message: 'Exam saved' });

    case 'DELETE':
      const { id: deleteId } = req.query;
      if (deleteId) {
        await sql`DELETE FROM exams WHERE id = ${deleteId as string}`;
      }
      return res.status(200).json({ message: 'Exam deleted' });

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}

// Allocations handler
async function handleAllocations(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      const { rows: allocations } = await sql`SELECT * FROM allocations`;
      if (!allocations || !Array.isArray(allocations)) {
        return res.status(200).json([]);
      }
      const mappedAllocations = allocations.map(a => ({
        id: a.id,
        examId: a.exam_id ?? a.examId,
        roomId: a.room_id ?? a.roomId,
        invigilator1Id: a.invigilator1_id ?? a.invigilator1Id ?? null,
        invigilator2Id: a.invigilator2_id ?? a.invigilator2Id ?? null,
        substituteId: a.substitute_id ?? a.substituteId ?? null
      }));
      return res.status(200).json(mappedAllocations);

    case 'POST':
      const { id, examId, roomId, invigilator1Id, invigilator2Id, substituteId } = req.body;
      if (id) {
        await sql`
          INSERT INTO allocations (id, exam_id, room_id, invigilator1_id, invigilator2_id, substitute_id)
          VALUES (${id}, ${examId}, ${roomId}, ${invigilator1Id}, ${invigilator2Id}, ${substituteId})
          ON CONFLICT (id) DO UPDATE SET
            exam_id = EXCLUDED.exam_id,
            room_id = EXCLUDED.room_id,
            invigilator1_id = EXCLUDED.invigilator1_id,
            invigilator2_id = EXCLUDED.invigilator2_id,
            substitute_id = EXCLUDED.substitute_id
        `;
      } else {
        await sql`
          INSERT INTO allocations (exam_id, room_id, invigilator1_id, invigilator2_id, substitute_id)
          VALUES (${examId}, ${roomId}, ${invigilator1Id}, ${invigilator2Id}, ${substituteId})
        `;
      }
      return res.status(201).json({ message: 'Allocation saved' });

    case 'DELETE':
      const { examId: deleteExamId, all } = req.query;
      if (all === 'true') {
        await sql`DELETE FROM allocations`;
      } else if (deleteExamId) {
        await sql`DELETE FROM allocations WHERE exam_id = ${deleteExamId as string}`;
      }
      return res.status(200).json({ message: 'Allocations deleted' });

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}

// Notifications handler
async function handleNotifications(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

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
}

// Gemini AI handler
async function handleGemini(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const { prompt, context } = req.body;
  const { rows: configRows } = await sql`SELECT * FROM config WHERE key = 'gemini_key' LIMIT 1`;
  const apiKey = configRows && configRows[0] ? configRows[0].value : null;

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  const contextText = Object.entries(context)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: `You are an assistant helping with exam invigilation scheduling. Please answer the user's question using the context provided.\nContext:\n${contextText}\n\nUser question: ${prompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    return res.status(200).json({ text });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to communicate with Gemini API' });
  }
}

// Import Mapa handler
async function handleImportMapa(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const { teachers, exams, roles, confirmReplace } = req.body;

  if (confirmReplace) {
    await sql`DELETE FROM teachers`;
    await sql`DELETE FROM exams`;
    await sql`DELETE FROM allocations`;
    await sql`DELETE FROM roles`;
  }

  if (Array.isArray(roles)) {
    for (const role of roles) {
      await sql`
        INSERT INTO roles (id, name, priority)
        VALUES (${role.id}, ${role.name}, ${Number(role.priority)})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, priority = EXCLUDED.priority
      `;
    }
  }

  if (Array.isArray(teachers)) {
    for (const teacher of teachers) {
      const unavailable = teacher.unavailable_dates?.join(',') || '';
      await sql`
        INSERT INTO teachers (
          id, name, email, subject, subject_group, available,
          unavailable_dates, special_role, special_role_name, ee,
          piso_zero, role
        ) VALUES (
          ${teacher.id}, ${teacher.name}, ${teacher.email}, ${teacher.subject},
          ${teacher.subject_group}, ${teacher.available ? 1 : 0},
          ${unavailable}, ${teacher.special_role ? 1 : 0},
          ${teacher.special_role_name}, ${teacher.ee ? 1 : 0},
          ${teacher.piso_zero ? 1 : 0}, ${teacher.role}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          subject = EXCLUDED.subject,
          subject_group = EXCLUDED.subject_group,
          available = EXCLUDED.available,
          unavailable_dates = EXCLUDED.unavailable_dates,
          special_role = EXCLUDED.special_role,
          special_role_name = EXCLUDED.special_role_name,
          ee = EXCLUDED.ee,
          piso_zero = EXCLUDED.piso_zero,
          role = EXCLUDED.role
      `;
    }
  }

  if (Array.isArray(exams)) {
    for (const exam of exams) {
      const roomIds = exam.room_ids?.join(',') || '';
      await sql`
        INSERT INTO exams (
          id, name, date, time, code, year, modality,
          shift, phase, ee, room_ids
        ) VALUES (
          ${exam.id}, ${exam.name}, ${exam.date}, ${exam.time},
          ${exam.code}, ${exam.year}, ${exam.modality},
          ${exam.shift}, ${exam.phase}, ${exam.ee ? 1 : 0},
          ${roomIds}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          date = EXCLUDED.date,
          time = EXCLUDED.time,
          code = EXCLUDED.code,
          year = EXCLUDED.year,
          modality = EXCLUDED.modality,
          shift = EXCLUDED.shift,
          phase = EXCLUDED.phase,
          ee = EXCLUDED.ee,
          room_ids = EXCLUDED.room_ids
      `;
    }
  }

  return res.status(200).json({ message: 'Import successful' });
}

// Bulk Data handler
async function handleBulkData(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const { teachers, exams, rooms, roles, sheetsPresent } = req.body;

  if (Array.isArray(teachers) && sheetsPresent?.Docentes) {
    await sql`DELETE FROM teachers`;
    for (const teacher of teachers) {
      const unavailable = teacher.unavailable_dates?.join(',') || '';
      await sql`
        INSERT INTO teachers (
          id, name, email, subject, subject_group, available,
          unavailable_dates, special_role, special_role_name, ee,
          piso_zero, role
        ) VALUES (
          ${teacher.id}, ${teacher.name}, ${teacher.email}, ${teacher.subject},
          ${teacher.subject_group}, ${teacher.available ? 1 : 0},
          ${unavailable}, ${teacher.special_role ? 1 : 0},
          ${teacher.special_role_name}, ${teacher.ee ? 1 : 0},
          ${teacher.piso_zero ? 1 : 0}, ${teacher.role}
        )
      `;
    }
  }

  if (Array.isArray(exams) && sheetsPresent?.Exames) {
    await sql`DELETE FROM exams`;
    for (const exam of exams) {
      const roomIds = exam.room_ids?.join(',') || '';
      await sql`
        INSERT INTO exams (
          id, name, date, time, code, year, modality,
          shift, phase, ee, room_ids
        ) VALUES (
          ${exam.id}, ${exam.name}, ${exam.date}, ${exam.time},
          ${exam.code}, ${exam.year}, ${exam.modality},
          ${exam.shift}, ${exam.phase}, ${exam.ee ? 1 : 0},
          ${roomIds}
        )
      `;
    }
  }

  if (Array.isArray(rooms) && sheetsPresent?.Salas) {
    await sql`DELETE FROM rooms`;
    for (const room of rooms) {
      await sql`
        INSERT INTO rooms (id, name, capacity, priority, piso_zero)
        VALUES (${room.id}, ${room.name}, ${Number(room.capacity)}, ${Number(room.priority)}, ${room.pisoZero ? 1 : 0})
      `;
    }
  }

  if (Array.isArray(roles) && sheetsPresent?.Cargos) {
    await sql`DELETE FROM roles`;
    for (const role of roles) {
      await sql`
        INSERT INTO roles (id, name, priority)
        VALUES (${role.id}, ${role.name}, ${Number(role.priority)})
      `;
    }
  }

  return res.status(200).json({ message: 'Bulk import successful' });
}

// Init DB handler
async function handleInitDb(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  await sql`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      subject TEXT,
      subject_group TEXT,
      available INTEGER,
      unavailable_dates TEXT,
      special_role INTEGER,
      special_role_name TEXT,
      ee INTEGER,
      piso_zero INTEGER,
      role TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT,
      capacity INTEGER,
      priority INTEGER,
      piso_zero INTEGER
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      name TEXT,
      date TEXT,
      time TEXT,
      code TEXT,
      year TEXT,
      modality TEXT,
      shift TEXT,
      phase TEXT,
      ee INTEGER,
      room_ids TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS allocations (
      id TEXT PRIMARY KEY,
      exam_id TEXT,
      room_id TEXT,
      invigilator1_id TEXT,
      invigilator2_id TEXT,
      substitute_id TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS notifications_log (
      id TEXT PRIMARY KEY,
      teacher_id TEXT,
      teacher_name TEXT,
      teacher_email TEXT,
      sent_at TEXT,
      success INTEGER,
      error TEXT,
      message TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT,
      role TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT,
      priority INTEGER
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `;

  return res.status(200).json({ message: 'Database initialized' });
}

// Users handler
async function handleUsers(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      const { rows: users } = await sql`SELECT * FROM users`;
      if (!users || !Array.isArray(users)) {
        return res.status(200).json([]);
      }
      return res.status(200).json(users);

    case 'POST':
      const { email, name, role } = req.body;
      await sql`
        INSERT INTO users (email, name, role)
        VALUES (${email}, ${name}, ${role})
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
      `;
      return res.status(201).json({ message: 'User saved' });

    case 'DELETE':
      const { email: deleteEmail } = req.query;
      if (deleteEmail) {
        await sql`DELETE FROM users WHERE email = ${deleteEmail as string}`;
      }
      return res.status(200).json({ message: 'User deleted' });

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}

// Roles handler
async function handleRoles(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      const { rows: roles } = await sql`SELECT * FROM roles ORDER BY priority`;
      if (!roles || !Array.isArray(roles)) {
        return res.status(200).json([]);
      }
      const mappedRoles = roles.map(r => ({
        id: r.id,
        name: r.name,
        priority: Number(r.priority)
      }));
      return res.status(200).json(mappedRoles);

    case 'POST':
      const { id, name, priority } = req.body;
      if (id) {
        await sql`
          INSERT INTO roles (id, name, priority)
          VALUES (${id}, ${name}, ${Number(priority)})
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, priority = EXCLUDED.priority
        `;
      } else {
        await sql`
          INSERT INTO roles (name, priority)
          VALUES (${name}, ${Number(priority)})
        `;
      }
      return res.status(201).json({ message: 'Role saved' });

    case 'PUT':
      const { roles: rolesToUpdate } = req.body;
      for (const role of rolesToUpdate) {
        await sql`
          INSERT INTO roles (id, name, priority)
          VALUES (${role.id}, ${role.name}, ${Number(role.priority)})
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, priority = EXCLUDED.priority
        `;
      }
      return res.status(200).json({ message: 'Roles updated' });

    case 'DELETE':
      const { id: deleteId } = req.query;
      if (deleteId) {
        await sql`DELETE FROM roles WHERE id = ${deleteId as string}`;
      }
      return res.status(200).json({ message: 'Role deleted' });

    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}
