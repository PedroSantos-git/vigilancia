import NextAuth from "next-auth";
import { authOptions } from "./_config.js";
import { VercelRequest, VercelResponse } from "@vercel/node";

// @ts-ignore
const nextAuthHandler = typeof NextAuth === 'function' ? NextAuth : NextAuth.default;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Se NEXTAUTH_URL não estiver definido, tentamos detetar o host
  if (!process.env.NEXTAUTH_URL) {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["host"];
    process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  }

  // @ts-ignore
  return await nextAuthHandler(req, res, authOptions);
}
