import NextAuth from "next-auth";
import { authOptions } from "./_config.js";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nextAuthHandler = require("next-auth").default;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Garantir que req.query.nextauth é um array (NextAuth exige isto para catch-all routes)
  if (req.query.nextauth && typeof req.query.nextauth === 'string') {
    req.query.nextauth = req.query.nextauth.split('/');
  }

  // Se NEXTAUTH_URL não estiver definido, tentamos detetar o host
  if (!process.env.NEXTAUTH_URL) {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["host"];
    process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  }

  // @ts-ignore
  return await nextAuthHandler(req, res, authOptions);
}
