import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET': {
        const { rows: roles } = await sql`
          SELECT * FROM teacher_roles
          ORDER BY priority ASC, name ASC
        `;
        return res.status(200).json(roles);
      }

      case 'POST': {
        const { id, name, priority } = req.body;

        if (id) {
          await sql`
            INSERT INTO teacher_roles (id, name, priority)
            VALUES (${id}, ${name}, ${priority ?? 0})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              priority = EXCLUDED.priority
          `;
        } else {
          const { rows: maxRows } = await sql`
            SELECT COALESCE(MAX(priority), 0) AS max_priority FROM teacher_roles
          `;
          const nextPriority = priority ?? Number(maxRows[0]?.max_priority ?? 0) + 1;

          await sql`
            INSERT INTO teacher_roles (name, priority)
            VALUES (${name}, ${nextPriority})
            ON CONFLICT (name) DO UPDATE SET
              name = EXCLUDED.name,
              priority = COALESCE(EXCLUDED.priority, teacher_roles.priority)
          `;
        }
        return res.status(201).json({ message: 'Role saved' });
      }

      case 'PUT': {
        const { roles: rolesToUpdate } = req.body;
        if (!Array.isArray(rolesToUpdate)) {
          return res.status(400).json({ error: 'roles array is required' });
        }

        for (const role of rolesToUpdate) {
          await sql`
            UPDATE teacher_roles
            SET name = ${role.name}, priority = ${role.priority}
            WHERE id = ${role.id}
          `;
        }
        return res.status(200).json({ message: 'Roles updated' });
      }

      case 'DELETE': {
        const { id: deleteId } = req.query;
        if (!deleteId) return res.status(400).json({ error: 'ID is required' });

        const { rows: teachers } = await sql`
          SELECT id FROM teachers WHERE role = ${deleteId as string} LIMIT 1
        `;
        if (teachers.length > 0) {
          return res.status(403).json({ error: 'Cannot delete role: teachers are assigned to it.' });
        }

        await sql`DELETE FROM teacher_roles WHERE id = ${deleteId as string}`;
        return res.status(200).json({ message: 'Role deleted' });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('Roles API error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      detail: error.message,
      hint: 'Verifique se a tabela teacher_roles existe correndo /api/init-db'
    });
  }
}
