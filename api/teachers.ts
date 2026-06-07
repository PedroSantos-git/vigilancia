import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const { rows: teachers } = await sql`SELECT * FROM teachers ORDER BY name ASC`;
        if (!teachers || !Array.isArray(teachers)) {
          return res.status(200).json([]);
        }
        const mappedTeachers = teachers.map(t => ({
          ...t,
          subject_group: t.subject_group ?? '',
          subjectGroup: t.subject_group ?? '',
          role: t.role ?? '',
          email: t.email ?? '',
          unavailabilities: typeof t.unavailabilities === 'string' ? JSON.parse(t.unavailabilities) : (t.unavailabilities ?? [])
        }));
        return res.status(200).json(mappedTeachers);

      case 'POST':
        const {
          id,
          name,
          subjectGroup: subjectGroupCamel,
          subject_group: subjectGroupSnake,
          subject,
          role,
          email,
          phone,
          available,
          unavailabilities
        } = req.body;

        const subjectGroup = (subjectGroupCamel ?? subjectGroupSnake ?? '').toString().trim();

        if (!name?.trim() || !subjectGroup || !subject?.trim()) {
          return res.status(400).json({ error: 'Nome, grupo disciplinar e disciplina são obrigatórios.' });
        }

        const normalizedName = name.trim();
        const normalizedSubject = subject.trim();
        const normalizedRole = role?.trim() || null;
        const normalizedEmail = email?.trim() || null;
        const normalizedPhone = phone?.trim() || null;
        
        if (id) {
          await sql`
            INSERT INTO teachers (id, name, subject_group, subject, role, email, phone, available, unavailabilities)
            VALUES (${id}, ${normalizedName}, ${subjectGroup}, ${normalizedSubject}, ${normalizedRole}, ${normalizedEmail}, ${normalizedPhone}, ${available ?? true}, ${JSON.stringify(unavailabilities ?? [])})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              subject_group = EXCLUDED.subject_group,
              subject = EXCLUDED.subject,
              role = EXCLUDED.role,
              email = EXCLUDED.email,
              phone = EXCLUDED.phone,
              available = EXCLUDED.available,
              unavailabilities = EXCLUDED.unavailabilities
          `;
        } else {
          await sql`
            INSERT INTO teachers (name, subject_group, subject, role, email, phone, available, unavailabilities)
            VALUES (${normalizedName}, ${subjectGroup}, ${normalizedSubject}, ${normalizedRole}, ${normalizedEmail}, ${normalizedPhone}, ${available ?? true}, ${JSON.stringify(unavailabilities ?? [])})
          `;
        }
        return res.status(201).json({ message: 'Teacher saved' });

      case 'DELETE':
        const { id: deleteId } = req.query;
        if (deleteId === 'all') {
          await sql`DELETE FROM teachers`;
        } else {
          await sql`DELETE FROM teachers WHERE id = ${deleteId as string}`;
        }
        return res.status(200).json({ message: 'Teacher(s) deleted' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
