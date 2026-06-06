import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teachers, exams, roles } = req.body;

  try {
    // 1. Process Roles (Insert or Ignore)
    for (const role of roles) {
      await sql`
        INSERT INTO teacher_roles (id, name)
        VALUES (${role.id}, ${role.name})
        ON CONFLICT (id) DO NOTHING
      `;
    }

    // 2. Process Teachers
    for (const t of teachers) {
      await sql`
        INSERT INTO teachers (id, name, subject_group, subject, role, email, available)
        VALUES (${t.id}, ${t.name}, ${t.subject_group}, ${t.subject}, ${t.role}, ${t.email || null}, true)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          subject_group = EXCLUDED.subject_group,
          subject = EXCLUDED.subject,
          role = EXCLUDED.role,
          email = EXCLUDED.email
      `;
    }

    // 3. Process Exams
    for (const e of exams) {
      await sql`
        INSERT INTO exams (id, name, subject, date, time)
        VALUES (${e.id}, ${e.name}, ${e.subject}, ${e.date}, ${e.time})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          subject = EXCLUDED.subject,
          date = EXCLUDED.date,
          time = EXCLUDED.time
      `;
    }

    return res.status(200).json({ 
      message: 'Import successful',
      stats: {
        teachers: teachers.length,
        exams: exams.length,
        roles: roles.length
      }
    });
  } catch (error: any) {
    console.error('Import error detail:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error during import',
      detail: error.message,
      hint: 'Certifique-se de que correu /api/init-db para criar as tabelas.'
    });
  }
}
