# Sketchter

A collaborative visual workspace for sketches, sticky notes, diagrams, and charts. Built with React, Vite, Express, and Socket.IO, with optional Neon and Gemini integrations.

## Run locally

Requires Node.js 22.12+ (Node.js 24 is supported).

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open **http://localhost:3000**, create an account, and create a whiteboard. No cloud credentials are needed for accounts, drawing, persistence, or collaboration. The app stores local data in `data/`; keep that directory to retain accounts, images, boards, and the local session signing secret.

```powershell
# Production
npm run build
npm start
```

`PORT` defaults to `3000`. The Express server serves both the React application and the Socket.IO endpoint, so there is only one server to start.

## Included

- Light and dark themes with a persistent preference and system-theme default.
- A focused board library, original Sketchter branding, and responsive editing controls.
- Accessible dialogs with keyboard focus management and reduced-motion support.

- Landing page, registration/sign-in, responsive dashboard, board search, sorting, real content thumbnails, templates, duplication, and owner-only deletion.
- Infinite SVG canvas with pan, zoom, fit-to-content, marquee selection, multi-element movement, resize, rotation, layering, and 100-step undo/redo.
- Text, bullet lists, sticky notes, rectangles, ellipses, diamonds, lines, arrows, freehand pen, eraser, images, and emojis.
- Stroke and fill palettes, line width, dashed strokes, handwriting, and a lightweight sketch treatment for shapes.
- Editable bar, line, pie, and donut charts, with up to 12 data rows.
- Socket.IO synchronization, live presence and cursors, and server-enforced owner/editor/viewer roles. Operations on different elements merge; simultaneous edits to the same element use the last received version.
- Email-based board access. Collaborators register using the invited email and open the shared link. **The app grants access but does not send invitation emails.**
- Gemini brainstorm, outline, flow diagram, chart generation, selection rewriting, and board summaries.
- PNG and SVG export, plus dots/grid/plain canvas backgrounds.
- Optional Neon Postgres, managed Neon Auth with JWKS validation, and Neon/S3-compatible object storage.

## Cloud configuration

Keep secrets in `.env`, which is ignored by Git. Restart the server after changing configuration. `VITE_` values are public frontend configuration and are embedded during the production build.

### Gemini

Set `GEMINI_API_KEY` to your Google AI Studio API key. `GEMINI_MODEL` defaults to `gemini-2.5-flash` and can be changed to a compatible model available to your account. Calls originate from the backend; the key is never sent to the browser. Without a key, AI tools show a configuration message rather than simulated results. AI output should be reviewed.

### Neon Postgres

Set `DATABASE_URL` to your Neon connection string. At startup, the app creates `canvas_records` with JSONB records for users and boards. When this variable is absent, it uses an atomically written local JSON store. Switching storage modes does not migrate existing local data.

### Managed Neon Auth

1. Enable Auth in your Neon project.
2. Set `VITE_NEON_AUTH_URL` to the Auth Base URL shown in the Neon console.
3. Add your application origin, such as `http://localhost:3000`, to the allowed domains in Neon Auth.
4. The backend derives `/.well-known/jwks.json` from that URL and validates the issuer. Override `NEON_AUTH_JWKS_URL`, `NEON_AUTH_ISSUER`, and `NEON_AUTH_AUDIENCE` if your setup requires it.
5. Rebuild for production after changing `VITE_NEON_AUTH_URL`.

The custom sign-in form uses the Neon SDK. After sign-in, a Neon JWT is validated with JWKS and exchanged for this app’s seven-day session. Signing out clears the app token and the Neon session. Without Neon Auth configuration, the app uses local email/password accounts with scrypt-hashed passwords. Local mode does not include email verification or password recovery and is intended for local use.

### Neon Object Storage / S3

Create a private bucket and set `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` using your provider’s settings. Uploads use the backend AWS S3 SDK with path-style addressing. Without configuration, original images are stored under `data/images/`. Board elements also retain an embedded image preview for realtime rendering and self-contained export. Protected original image retrieval checks board membership. Uploads accept PNG, JPEG, WebP, and GIF files up to 4 MB.

Cloud connections require your credentials and have not been exercised against a live account. Local mode has been tested end to end. This implementation runs as a single Node process; horizontal scaling would require shared Socket.IO infrastructure and database-level concurrency control. Use HTTPS and a persistent `JWT_SECRET` for hosting.

## Controls

| Action | Shortcut |
| --- | --- |
| Select / pan | `V` / `H` |
| Pan temporarily | Hold `Space` and drag |
| Zoom | `Ctrl`/`Cmd` + scroll, or bottom-right buttons |
| Pan with trackpad | Scroll |
| Fit all content | `1` |
| Text / sticky / list | `T` / `N` / `L` |
| Rectangle / ellipse / diamond | `R` / `O` / `D` |
| Line / arrow / pen / eraser | `I` / `A` / `P` / `E` |
| Multi-select | `Shift` + click, or drag a selection rectangle |
| Edit text or chart | Double-click an element |
| Resize / rotate | Drag the bottom-right / upper circular selection handle |
| Square / proportional resize / 15° rotation | Hold `Shift` while dragging |
| Copy / paste / duplicate | `Ctrl`/`Cmd` + `C` / `V` / `D` |
| Undo / redo | `Ctrl`/`Cmd` + `Z` / `Shift+Z` |
| Select all / delete | `Ctrl`/`Cmd` + `A` / `Delete` |
| Save text / clear selection | `Ctrl`/`Cmd` + `Enter` / `Escape` |

On touch devices, choose the Hand tool to pan and use the zoom buttons.

## Verification

```powershell
npm run build
npm test
npm run test:browser
```

The integration suite uses isolated temporary storage and tests authentication, board permissions, concurrent drawing and renaming, uploads, AI configuration failures, revoked permissions, and deletion. Browser checks use the installed Microsoft Edge browser through Playwright; they cover registration, templates, text, shapes, freehand drawing, erasing, resize, undo/redo, charts, PNG export, reload persistence, sharing, and mobile layouts. Screenshots and an example PNG export are written to `artifacts/`. If Edge is unavailable, change the browser channel in `tests/browser-smoke.mjs` to an installed Chromium browser.

## Structure

```text
src/                 React pages, SVG renderer, canvas editor, styles
server/              Express API, auth, persistence, images, Gemini, Socket.IO
tests/               API integration tests and browser workflow
.env.example         Local and cloud configuration
artifacts/           Browser screenshots and tested PNG export
```

References: [Neon React Auth](https://neon.com/docs/auth/quick-start/react), [Neon JWT verification](https://neon.com/docs/auth/guides/plugins/jwt), [Neon Object Storage](https://neon.com/docs/storage/overview), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).
