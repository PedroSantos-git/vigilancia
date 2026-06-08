import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teachers, exams, rooms, roles } = req.body;

  try {
    // 1. Clear everything (except users/notifications if needed, but here we clear base data)
    await sql`DELETE FROM allocations`;
    await sql`DELETE FROM exams`;
    await sql`DELETE FROM teachers`;
    await sql`DELETE FROM rooms`;
    await sql`DELETE FROM teacher_roles`;

    // 2. Insert Roles and get Mapping
    const roleNameToId: Record<string, string> = {};
    for (const r of roles) {
      const { rows } = await sql`
        INSERT INTO teacher_roles (name)
        VALUES (${r.name})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;
      roleNameToId[r.name] = rows[0].id;
    }

    // 3. Insert Rooms and get Mapping
    const roomNameToId: Record<string, string> = {};
    for (const rm of rooms) {
      const { rows } = await sql`
        INSERT INTO rooms (name, capacity, floor, priority)
        VALUES (${rm.name}, ${rm.capacity}, ${rm.floor}, ${rm.priority || 0})
        ON CONFLICT (name) DO UPDATE SET 
          capacity = EXCLUDED.capacity,
          floor = EXCLUDED.floor,
          priority = EXCLUDED.priority
        RETURNING id
      `;
      roomNameToId[rm.name] = rows[0].id;
    }

    // 4. Insert Teachers
    for (const t of teachers) {
      const roleId = t.role ? roleNameToId[t.role] : null;
      await sql`
        INSERT INTO teachers (name, subject_group, subject, role, email, available, EE, PISO_ZERO)
        VALUES (${t.name}, ${t.subject_group}, ${t.subject}, ${roleId}, ${t.email || null}, ${t.available}, ${t.EE ?? false}, ${t.PISO_ZERO ?? false})
      `;
    }

    // 5. Insert Exams
    for (const e of exams) {
      const examRoomIds = (e.roomNames || [])
        .map((rn: string) => roomNameToId[rn])
        .filter((id: string) => !!id);

      await sql`
        INSERT INTO exams (name, variant, subject_group, year, code, date, time, shift, modality, phase, registrations_count, EE, room_ids)
        VALUES (
          ${e.name}, 
          ${e.variant || null}, 
          ${e.subject_group}, 
          ${e.year}, 
          ${e.code || null}, 
          ${e.date}, 
          ${e.time}, 
          ${e.shift || null}, 
          ${e.modality || null}, 
          ${e.phase},
          ${e.registrationsCount || 0},
          ${e.EE ?? false},
          ${JSON.stringify(examRoomIds)}
        )
      `;
    }

    return res.status(200).json({ 
      message: 'Bulk import successful',
      stats: {
        teachers: teachers.length,
        exams: exams.length,
        rooms: rooms.length,
        roles: roles.length
      }
    });
  } catch (error: any) {
    console.error('Bulk import error:', error);
    return res.status(500).json({ 
      error: 'Failed to import bulk data',
      detail: error.message
    });
  }
}
