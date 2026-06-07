import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        const { rows: rooms } = await sql`SELECT * FROM rooms ORDER BY priority ASC, name ASC`;
        return res.status(200).json(rooms);

      case 'POST':
        const { id, name, capacity, floor, priority } = req.body;
        
        if (id) {
          await sql`
            INSERT INTO rooms (id, name, capacity, floor, priority)
            VALUES (${id}, ${name}, ${capacity}, ${floor}, ${priority})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              capacity = EXCLUDED.capacity,
              floor = EXCLUDED.floor,
              priority = EXCLUDED.priority
          `;
        } else {
          await sql`
            INSERT INTO rooms (name, capacity, floor, priority)
            VALUES (${name}, ${capacity}, ${floor}, ${priority})
          `;
        }
        return res.status(201).json({ message: 'Room saved' });

      case 'PUT':
        const { rooms: roomsToUpdate } = req.body;
        if (Array.isArray(roomsToUpdate)) {
          for (const room of roomsToUpdate) {
            await sql`
              UPDATE rooms SET
                name = ${room.name},
                capacity = ${room.capacity},
                floor = ${room.floor},
                priority = ${room.priority}
              WHERE id = ${room.id}
            `;
          }
        }
        return res.status(200).json({ message: 'Rooms updated' });

      case 'DELETE':
        const { id: deleteId } = req.query;
        await sql`DELETE FROM rooms WHERE id = ${deleteId as string}`;
        return res.status(200).json({ message: 'Room deleted' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
