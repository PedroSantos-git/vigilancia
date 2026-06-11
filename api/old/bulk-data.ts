import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

type SheetsPresent = {
  Docentes?: boolean;
  Exames?: boolean;
  Salas?: boolean;
  Cargos?: boolean;
};

const defaultSheetsPresent = (): Required<SheetsPresent> => ({
  Docentes: true,
  Exames: true,
  Salas: true,
  Cargos: true
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teachers = [], exams = [], rooms = [], roles = [], sheetsPresent } = req.body;
  const present = { ...defaultSheetsPresent(), ...(sheetsPresent as SheetsPresent | undefined) };

  try {
    await sql`BEGIN`;

    const cleared: Record<string, boolean> = {};

    // Limpar alocações sempre que qualquer tabela base importada for substituída
    if (present.Docentes || present.Exames || present.Salas) {
      await sql`DELETE FROM allocations`;
      cleared.allocations = true;
    }

    if (present.Exames) {
      await sql`DELETE FROM exams`;
      cleared.exams = true;
    }

    if (present.Docentes) {
      await sql`DELETE FROM teachers`;
      cleared.teachers = true;
    }

    if (present.Salas) {
      await sql`DELETE FROM rooms`;
      cleared.rooms = true;
    }

    if (present.Cargos) {
      await sql`DELETE FROM teacher_roles`;
      cleared.roles = true;
    }

    const roleNameToId: Record<string, string> = {};

    if (present.Cargos) {
      for (let i = 0; i < roles.length; i++) {
        const r = roles[i];
        const { rows } = await sql`
          INSERT INTO teacher_roles (name, priority)
          VALUES (${r.name}, ${r.priority ?? i + 1})
          RETURNING id
        `;
        roleNameToId[r.name] = rows[0].id;
      }
    } else {
      const { rows: existingRoles } = await sql`SELECT id, name FROM teacher_roles`;
      for (const r of existingRoles) {
        roleNameToId[r.name] = r.id;
      }
    }

    const roomNameToId: Record<string, string> = {};

    if (present.Salas) {
      for (const rm of rooms) {
        const { rows } = await sql`
          INSERT INTO rooms (name, capacity, floor, priority)
          VALUES (${rm.name}, ${rm.capacity}, ${rm.floor ?? null}, ${rm.priority || 0})
          RETURNING id
        `;
        roomNameToId[rm.name] = rows[0].id;
      }
    } else {
      const { rows: existingRooms } = await sql`SELECT id, name FROM rooms`;
      for (const r of existingRooms) {
        roomNameToId[r.name] = r.id;
      }
    }

    if (present.Docentes) {
      for (const t of teachers) {
        const roleId = t.role ? roleNameToId[t.role] ?? null : null;
        await sql`
          INSERT INTO teachers (name, subject_group, subject, role, email, available, EE, PISO_ZERO, unavailabilities)
          VALUES (
            ${t.name},
            ${t.subject_group},
            ${t.subject},
            ${roleId},
            ${t.email || null},
            ${t.available ?? true},
            ${t.EE ?? false},
            ${t.PISO_ZERO ?? false},
            ${JSON.stringify(t.unavailabilities ?? [])}
          )
        `;
      }
    }

    if (present.Exames) {
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
    }

    await sql`COMMIT`;

    return res.status(200).json({
      message: 'Bulk import successful',
      stats: {
        teachers: present.Docentes ? teachers.length : 0,
        exams: present.Exames ? exams.length : 0,
        rooms: present.Salas ? rooms.length : 0,
        roles: present.Cargos ? roles.length : 0
      },
      cleared
    });
  } catch (error: any) {
    try {
      await sql`ROLLBACK`;
    } catch (rollbackError) {
      console.error('Bulk import rollback error:', rollbackError);
    }

    console.error('Bulk import error:', error);
    return res.status(500).json({
      error: 'Failed to import bulk data',
      detail: error.message
    });
  }
}
