import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const { rows: users } = await sql`SELECT * FROM AuthorizedUsers ORDER BY created_at DESC`;
        return res.status(200).json(users);

      case 'POST':
        const { email, name, role } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        
        await sql`
          INSERT INTO AuthorizedUsers (email, name, role)
          VALUES (${email.toLowerCase()}, ${name}, ${role || 'admin'})
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role
        `;
        return res.status(201).json({ message: 'User authorized' });

      case 'DELETE':
        const { email: deleteEmail } = req.query;
        if (!deleteEmail) return res.status(400).json({ error: 'Email is required' });
        
        // Proteção para nunca remover o email principal
        if (deleteEmail.toString().toLowerCase() === 'pedro.santos@djoaoii.com') {
          return res.status(403).json({ error: 'Cannot remove the primary administrator' });
        }

        await sql`DELETE FROM AuthorizedUsers WHERE email = ${deleteEmail.toString().toLowerCase()}`;
        return res.status(200).json({ message: 'User removed' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
