# End-to-end tests

Runs the real server (and, for the browser suite, the built client in headless Chrome).
Only the outside services are faked: Supabase, OpenAI, Twilio, Google Vision, ElevenLabs, the WhatsApp Graph API and the render service.
No keys are needed, and nothing touches production.

```sh
cd e2e
node --import ./fakes/register.mjs api-tests.mjs       # API, auth, analysis, chat, video, WhatsApp
(cd ../client && npm run build)                         # browser suite serves client/dist
node --import ./fakes/register.mjs browser-tests.mjs   # 375px + 1280px flows; screenshots → e2e/shots/
```

Needs Node 22+ and Google Chrome (override the path with `CHROME_PATH`).
