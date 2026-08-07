# Editor authentication

KopiContext has one human editor in v1. Auth.js (`next-auth` 4.24.15, the
current stable release) uses Google OAuth and admits exactly one verified Google
email address. It has no public registration, password, or multi-editor role
flow.

## Deployment configuration

Set these **server-only** environment variables in Vercel (and in the local
environment only when using editor authentication):

| Variable | Purpose |
| --- | --- |
| `EDITOR_ALLOWED_EMAIL` | The sole editor's email. Deployment value: `ernest.tanhk@gmail.com`. |
| `GOOGLE_CLIENT_ID` | Google OAuth web-client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web-client secret. |
| `NEXTAUTH_SECRET` | A long, random secret used to encrypt/sign Auth.js session material. |
| `NEXTAUTH_URL` | Canonical public origin, for example `https://kopicontext.example`. |

Register this redirect URI in the Google OAuth client:

```text
https://<canonical-origin>/api/auth/callback/google
```

For local development, use `http://localhost:<port>` for `NEXTAUTH_URL` and
register the matching localhost callback URI. Do not put OAuth credentials in
`NEXT_PUBLIC_*` variables, source files, or Git.

## Safety boundary

The Auth.js route lives at `/api/auth/[...nextauth]` and uses Node.js runtime.
Its configuration is evaluated only when authentication is invoked, so a public
reader build does not require editor secrets. Missing or invalid configuration
then fails closed; it must be fixed before an editor can sign in.

Google's verified email is compared with the normalised single configured
address during sign-in. Later editor-only server code calls
`requireEditorSession()`, which checks the session again and derives an audit
actor ID from Google's stable subject (`google:<subject>`). Browser input never
chooses that actor ID, and private API credentials remain server-only.

This is the authentication foundation only. Protected editor pages and their
server-side BFF composition now begin at `/editor`. The route is dynamically
server-rendered, calls `requireEditorSession()` before it loads anything, and
redirects a missing session to Auth.js sign-in or an unapproved one to its
denied state. Its review queue has no browser API route: the server-only BFF
will use `PRIVATE_API_BASE_URL` and `PRIVATE_API_SERVICE_CREDENTIAL` only when
the private `GET /v1/editorial/work` endpoint is composed. Until then, it
shows an explicit unavailable state rather than an empty or fabricated queue.
