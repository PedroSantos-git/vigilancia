import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const { rows: roles } = await sql`SELECT * FROM teacher_roles ORDER BY name ASC`;
        return res.status(200).json(roles);

      case 'POST':
        const { id, name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        const roleId = id || name.toLowerCase().replace(/\s+/g, '_');
        
        await sql`
          INSERT INTO teacher_roles (id, name)
          VALUES (${roleId}, ${name})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name
        `;
        return res.status(201).json({ message: 'Role saved' });

      case 'DELETE':
        const { id: deleteId } = req.query;
        if (!deleteId) return res.status(400).json({ error: 'ID is required' });

        // Verificar se existem professores com este role
        const { rows: teachers } = await sql`SELECT id FROM teachers WHERE role = ${deleteId as string} LIMIT 1`;
        if (teachers.length > 0) {
          return res.status(403).json({ error: 'Cannot delete role: teachers are assigned to it.' });
        }

        await sql`DELETE FROM teacher_roles WHERE id = ${deleteId as string}`;
        return res.status(200).json({ message: 'Role deleted' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
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
