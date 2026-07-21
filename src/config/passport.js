import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env.js';
import { userService } from '../services/user.service.js';
import { logger } from '../utils/logger.js';

/**
 * Passport Google OAuth 2.0 Strategy.
 *
 * We use { session: false } everywhere this strategy is invoked (see auth.routes.js),
 * because authentication state is carried via JWTs, not server-side sessions —
 * so passport.serializeUser/deserializeUser are intentionally NOT configured.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      // NOTE: `_accessToken` / `_refreshToken` here are Google's OAuth tokens,
      // NOT our application's JWTs. We don't need to persist Google's tokens
      // since we don't call the Google API again after initial login.
      try {
        const user = await userService.findOrCreateFromGoogleProfile(profile);
        return done(null, user);
      } catch (error) {
        logger.error('Google strategy verify callback failed', { error: error.message });
        return done(error, null);
      }
    }
  )
);

export default passport;
