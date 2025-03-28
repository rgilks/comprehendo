import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import db from "../../../../lib/db";

// Only check for environment variables during runtime, not during build
const providers = [];

// Add GitHub provider when not building
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    })
  );
} else if (process.env.NODE_ENV === "production") {
  // Only throw in production, not during build
  console.warn("GitHub OAuth credentials missing");
}

// Add Google provider
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    })
  );
} else if (process.env.NODE_ENV === "production") {
  // Only throw in production, not during build
  console.warn("Google OAuth credentials missing");
}

const handler = NextAuth({
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // Store user in DB when they sign in
      try {
        if (user && account) {
          // Update or insert user data
          db.prepare(
            `
            INSERT INTO users (provider_id, provider, name, email, image, last_login)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(provider_id, provider) 
            DO UPDATE SET name = ?, email = ?, image = ?, last_login = CURRENT_TIMESTAMP
          `
          ).run(
            user.id,
            account.provider,
            user.name || null,
            user.email || null,
            user.image || null,
            user.name || null,
            user.email || null,
            user.image || null
          );
          console.log(
            `[AUTH] User ${user.name || user.email || user.id} logged in via ${
              account.provider
            }`
          );
        }
      } catch (error) {
        console.error("[AUTH] Error storing user data:", error);
        // Don't block sign-in if DB storage fails
      }
      return true;
    },
  },
  // Add trust host configuration for production
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});

export { handler as GET, handler as POST };
