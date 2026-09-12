# Security Notes — Active Project

## Deferred Actions (Owner Decision)

### S-01: Firebase API Key Rotation
- Status: DEFERRED
- Reason: Experimental phase
- File: firebase-applet-config.json
- Action required: Rotate before production use

### S-02: Firestore Rules Hardening
- Status: DEFERRED
- Reason: Experimental phase
- Current rules: allow read, write: if true (permissive)
- Action required: Restrict before production use

## Executed Actions

### S-03: Removed Out-of-Scope Keys
- GATEIO_API_KEY: removed from .env.example
- GATEIO_API_SECRET: removed from .env.example
- TELEGRAM_BOT_TOKEN: removed from .env.example
- TELEGRAM_CHAT_ID: removed from .env.example
- Reason: Out of scope for XAUUSD research platform

## Warnings

- Never commit real API keys to version control.
- Always use .env for local secrets.
- Always use .env.example with empty values.
- Rotate any key exposed in logs, chats, or source.
