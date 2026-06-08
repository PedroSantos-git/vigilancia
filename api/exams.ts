import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const { rows: exams } = await sql`SELECT * FROM exams ORDER BY date ASC, time ASC`;
        if (!exams || !Array.isArray(exams)) {
          return res.status(200).json([]);
        }
        const mappedExams = exams.map(e => ({
          ...e,
          registrationsCount: e.registrations_count,
          roomIds: typeof e.room_ids === 'string' ? JSON.parse(e.room_ids) : e.room_ids
        }));
        return res.status(200).json(mappedExams);

      case 'POST':
        const { id, name, variant, subject_group, year, code, date, time, shift, modality, phase, registrationsCount, EE, roomIds } = req.body;
        
        if (id) {
          await sql`
            INSERT INTO exams (id, name, variant, subject_group, year, code, date, time, shift, modality, phase, registrations_count, EE, room_ids)
            VALUES (${id}, ${name}, ${variant}, ${subject_group}, ${year}, ${code}, ${date}, ${time}, ${shift}, ${modality}, ${phase}, ${registrationsCount ?? 0}, ${EE ?? false}, ${JSON.stringify(roomIds)})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              variant = EXCLUDED.variant,
              subject_group = EXCLUDED.subject_group,
              year = EXCLUDED.year,
              code = EXCLUDED.code,
              date = EXCLUDED.date,
              time = EXCLUDED.time,
              shift = EXCLUDED.shift,
              modality = EXCLUDED.modality,
              phase = EXCLUDED.phase,
              registrations_count = EXCLUDED.registrations_count,
              EE = EXCLUDED.EE,
              room_ids = EXCLUDED.room_ids
          `;
        } else {
          await sql`
            INSERT INTO exams (name, variant, subject_group, year, code, date, time, shift, modality, phase, registrations_count, EE, room_ids)
            VALUES (${name}, ${variant}, ${subject_group}, ${year}, ${code}, ${date}, ${time}, ${shift}, ${modality}, ${phase}, ${registrationsCount ?? 0}, ${EE ?? false}, ${JSON.stringify(roomIds)})
          `;
        }
        return res.status(201).json({ message: 'Exam saved' });

      case 'DELETE':
        const { id: deleteId } = req.query;
        await sql`DELETE FROM exams WHERE id = ${deleteId as string}`;
        return res.status(200).json({ message: 'Exam deleted' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
