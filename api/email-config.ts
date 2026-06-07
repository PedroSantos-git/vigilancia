import { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './utils/db.js';

function mapRow(row: Record<string, unknown>) {
  const apiKey = row.resend_api_key as string | null;
  return {
    id: row.id,
    fromEmail: row.from_email,
    fromName: row.from_name,
    replyTo: row.reply_to || '',
    schoolName: row.school_name,
    subjectPrefix: row.subject_prefix,
    enabled: row.enabled,
    updatedAt: row.updated_at,
    hasApiKey: Boolean(apiKey || process.env.RESEND_API_KEY),
    resendApiKey: apiKey ? '••••••••' : ''
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET': {
        const { rows } = await sql`SELECT * FROM email_settings WHERE id = 'default' LIMIT 1`;
        if (rows.length === 0) {
          return res.status(200).json({
            id: 'default',
            fromEmail: '',
            fromName: '',
            replyTo: '',
            schoolName: 'Escola Secundária',
            subjectPrefix: 'Vigilância de Exame',
            enabled: false,
            hasApiKey: Boolean(process.env.RESEND_API_KEY),
            resendApiKey: ''
          });
        }
        return res.status(200).json(mapRow(rows[0]));
      }

      case 'POST': {
        const {
          fromEmail,
          fromName,
          replyTo,
          schoolName,
          subjectPrefix,
          enabled,
          resendApiKey
        } = req.body;

        if (!fromEmail?.trim()) {
          return res.status(400).json({ error: 'O email de envio (from) é obrigatório.' });
        }

        const shouldUpdateApiKey = resendApiKey && resendApiKey !== '••••••••';

        if (shouldUpdateApiKey) {
          await sql`
            INSERT INTO email_settings (
              id, resend_api_key, from_email, from_name, reply_to,
              school_name, subject_prefix, enabled, updated_at
            )
            VALUES (
              'default', ${resendApiKey}, ${fromEmail.trim()}, ${fromName?.trim() || ''},
              ${replyTo?.trim() || null}, ${schoolName?.trim() || 'Escola Secundária'},
              ${subjectPrefix?.trim() || 'Vigilância de Exame'}, ${Boolean(enabled)}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              resend_api_key = EXCLUDED.resend_api_key,
              from_email = EXCLUDED.from_email,
              from_name = EXCLUDED.from_name,
              reply_to = EXCLUDED.reply_to,
              school_name = EXCLUDED.school_name,
              subject_prefix = EXCLUDED.subject_prefix,
              enabled = EXCLUDED.enabled,
              updated_at = NOW()
          `;
        } else {
          await sql`
            INSERT INTO email_settings (
              id, from_email, from_name, reply_to,
              school_name, subject_prefix, enabled, updated_at
            )
            VALUES (
              'default', ${fromEmail.trim()}, ${fromName?.trim() || ''},
              ${replyTo?.trim() || null}, ${schoolName?.trim() || 'Escola Secundária'},
              ${subjectPrefix?.trim() || 'Vigilância de Exame'}, ${Boolean(enabled)}, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              from_email = EXCLUDED.from_email,
              from_name = EXCLUDED.from_name,
              reply_to = EXCLUDED.reply_to,
              school_name = EXCLUDED.school_name,
              subject_prefix = EXCLUDED.subject_prefix,
              enabled = EXCLUDED.enabled,
              updated_at = NOW()
          `;
        }

        const { rows } = await sql`SELECT * FROM email_settings WHERE id = 'default' LIMIT 1`;
        return res.status(200).json(mapRow(rows[0]));
      }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
