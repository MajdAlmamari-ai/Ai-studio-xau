# Security Notes & Compliance Status (`_legacy/`)

## S-01: Firebase API Key — Deferred Rotation
- **Owner Decision**: Rotation DEFERRED to a future date.
- **Reason**: Project is currently in experimental / evaluation phase.
- **Reference File**: `_legacy/firebase-applet-config.json`
- **Schedule**: Scheduled for rotation prior to public release.

## S-02: Firestore Rules — Deferred Hardening
- **Owner Decision**: Firestore rules hardening DEFERRED.
- **Status**: Pending next architectural cycle.
- **Reference File**: `_legacy/firestore.rules`

## S-03: Gate.io & Telegram Credentials Policy
- New production code and environment templates (`.env.example`) must not expose live private API keys or bot tokens.
- All institutional data engines leverage public market feeds or server-side proxied endpoints with rate limiters and AI circuit breakers.
