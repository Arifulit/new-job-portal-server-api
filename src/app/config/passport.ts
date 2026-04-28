

import passport from "passport";
import { Profile, Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import { findOrCreateGoogleUser } from "../modules/auth/services/authService";

const hasGoogleOAuthConfig = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL,
);

passport.serializeUser((user: any, done) => {
  done(null, user._id ?? user.id);
});

passport.deserializeUser((id: string, done) => {
  // You may want to fetch user from DB here, but for now, return a minimal User object with a valid role
  done(null, { id, role: "candidate" });
});

if (hasGoogleOAuthConfig) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID as string,
        clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        callbackURL: env.GOOGLE_CALLBACK_URL as string,
        scope: ["email", "profile"],  // ✅ এখানে add
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done,
      ) => {
        try {
          const email = profile.emails?.[0]?.value?.trim().toLowerCase();
          if (!email) {
            return done(new Error("Google account email is required"));
          }

          const name = profile.displayName?.trim() || email.split("@")[0];
          const avatar = profile.photos?.[0]?.value?.trim() || "";
          const googleId = profile.id?.trim();
          if (!googleId) {
            return done(new Error("Google account ID is required"));
          }

          const user = await findOrCreateGoogleUser({
            googleId,
            email,
            name,
            avatar,
          });

          return done(null, user as any);
        } catch (error) {
          return done(error as Error);
        }
      },
    ),
  );
} else {
  console.warn(
    "Google OAuth is disabled. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL to enable it.",
  );
}

export default passport;