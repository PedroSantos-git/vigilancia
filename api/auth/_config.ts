import GoogleProvider from "next-auth/providers/google";
import { sql } from "../utils/db.js";
import { AuthOptions } from "next-auth";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      try {
        const { rows } = await sql`
          SELECT * FROM AuthorizedUsers 
          WHERE email = ${user.email.toLowerCase()}
        `;

        // Se o email estiver na whitelist, permite o login
        return rows.length > 0;
      } catch (error) {
        console.error("Erro ao verificar whitelist:", error);
        return false;
      }
    },
    async session({ session }) {
      if (session.user?.email) {
        try {
          const { rows } = await sql`
            SELECT role FROM AuthorizedUsers 
            WHERE email = ${session.user.email.toLowerCase()}
          `;

          if (rows.length > 0) {
            // @ts-ignore
            session.user.role = rows[0].role;
          }
        } catch (error) {
          console.error("Erro ao procurar role do utilizador:", error);
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
