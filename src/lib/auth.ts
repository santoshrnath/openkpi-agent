import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";

const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const hasEmail =
  !!process.env.EMAIL_SERVER_HOST &&
  !!process.env.EMAIL_SERVER_USER &&
  !!process.env.EMAIL_SERVER_PASSWORD &&
  !!process.env.EMAIL_FROM;
const devAuth = process.env.OPENKPI_DEV_AUTH === "true";

const providers: NextAuthOptions["providers"] = [];

if (hasGoogle) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

if (hasEmail) {
  providers.push(
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST!,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER!,
          pass: process.env.EMAIL_SERVER_PASSWORD!,
        },
      },
      from: process.env.EMAIL_FROM!,
    })
  );
}

if (devAuth) {
  // ─── DEV-ONLY: passwordless 'sign in as anyone' ────────────────────────
  // Enabled by OPENKPI_DEV_AUTH=true. Lets you test the ACL/invite flow
  // without external OAuth/SMTP. Removed by clearing the env var.
  //
  // ⚠️  NEVER enable this in a production deployment that real customers
  //     access. The /login page surfaces the warning prominently.
  providers.push(
    CredentialsProvider({
      id: "dev",
      name: "Dev sign-in",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        name: { label: "Display name", type: "text", placeholder: "Optional" },
      },
      async authorize(input) {
        const email = String(input?.email ?? "").trim().toLowerCase();
        const name = String(input?.name ?? "").trim() || email.split("@")[0];
        if (!email || !/.+@.+/.test(email)) return null;
        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { email, name, emailVerified: new Date() },
        });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        } as { id: string; email: string | null; name: string | null; image: string | null };
      },
    })
  );
}

// JWT sessions are required for the Credentials provider; we use JWT throughout
// for simplicity (still backed by the Prisma adapter for OAuth account links).
const useJwt = devAuth;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: { strategy: useJwt ? "jwt" : "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
  },
  providers,
  callbacks: {
    async session({ session, user, token }) {
      if (session.user) {
        if (user) (session.user as { id?: string }).id = user.id;
        else if (token?.sub) (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.sub = (user as { id?: string }).id ?? token.sub;
      return token;
    },
  },
};

export const authMeta = {
  hasGoogle,
  hasEmail,
  hasDev: devAuth,
  anyProvider: providers.length > 0,
};
