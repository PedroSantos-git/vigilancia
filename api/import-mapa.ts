import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teachers, exams, roles, confirmReplace } = req.body;

  try {
    if (!confirmReplace) {
      return res.status(400).json({
        error: 'Confirmation required',
        detail: 'A importacao do Mapa Geral apaga os professores e exames atuais antes de inserir os novos dados.'
      });
    }

    // 1. Limpar dados dependentes antes da nova importacao
    await sql`DELETE FROM allocations`;
    await sql`DELETE FROM exams`;
    await sql`DELETE FROM teachers`;

    // 2. Process Roles (Insert or Ignore)
    for (const role of roles) {
      await sql`
        INSERT INTO teacher_roles (id, name)
        VALUES (${role.id}, ${role.name})
        ON CONFLICT (id) DO NOTHING
      `;
    }

    // 3. Process Teachers
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

    // 4. Process Exams
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
        roles: roles.length,
        cleared: {
          teachers: true,
          exams: true,
          allocations: true
        }
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
