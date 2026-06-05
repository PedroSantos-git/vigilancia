import NextAuth from "next-auth";
import { authOptions } from "./_config.js";
import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // O NextAuth espera que o parâmetro 'nextauth' esteja presente no query
  // No Vercel, isto é configurado via vercel.json rewrites ou pelo nome do ficheiro [...nextauth]
  
  // Se NEXTAUTH_URL não estiver definido, tentamos detetar o host
  if (!process.env.NEXTAUTH_URL) {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers["host"];
    process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  }

  // @ts-ignore
  return await NextAuth(req, res, authOptions);
}
