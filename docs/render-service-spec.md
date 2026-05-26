# Render Service Integration — Reference

This document describes the MediTrack Render Service from the perspective of meditrack_v3. The render service is a separate Node.js service that takes a parsed medical `Report` and produces a 30–45 second Hindi explainer video.

This document is the source of truth for the integration contract between meditrack_v3 and the render service. If the integration drifts from what's here, update this document.

---

## What the render service does

Accepts a parsed `Report` over HTTPS. Returns a `jobId` immediately (async). Generates the video (30s–3min depending on cold/warm state). Posts back to a callback URL when complete.

The render service is hosted at `https://meditrack-render.fly.dev`. It runs in Fly.io's Mumbai region.

You do NOT need to know how it generates the video. Treat it as a black box that takes Reports and produces videos.

---

## API contract

### `POST /render`

Request:

```http
POST /render
Host: meditrack-render.fly.dev
Authorization: Bearer <RENDER_API_KEY>
Content-Type: application/json
```

Body:

```ts
{
  reportId: string;                          // Your internal report ID
  callbackUrl: string;                       // Where we POST when done
  patient: {
    firstName: string;                       // For personalization ("Namaste Priya ji")
    ageYears: number;                        // Used for safety gate (< 18 = rejection)
    isPregnancyPanel: boolean;               // Used for safety gate
  };
  report: {
    type: string;                            // e.g. "Lipid Profile" — spoken in audio
    date: string;                            // ISO format "2025-10-18"
    lab: string;                             // e.g. "Dr. Lal PathLabs" — spoken in audio
  };
  findings: Array<{
    valueName: string;                       // e.g. "LDL Cholesterol"
    value: number;                           // e.g. 142
    unit: string;                            // e.g. "mg/dL"
    referenceRange: {
      low: number | null;                    // e.g. null
      high: number | null;                   // e.g. 100
    };
    status: "normal" | "low" | "high" | "critical_low" | "critical_high";
    history: Array<{                         // Optional time-series for trend charts
      date: string;                          // ISO date
      value: number;
    }> | null;
  }>;
  lang: "hi";                                // Only Hindi for v1
}
```

Response — Success:

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "jobId": "uuid-string",
  "status": "queued"
}
```

Response — Validation error:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "validation_failed",
  "issues": [
    {
      "code": "invalid_type",
      "path": ["patient", "firstName"],
      "message": "Required"
    }
  ]
}
```

Response — Auth error:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": "unauthorized",
  "message": "Invalid Bearer token"
}
```

Response — Rate limited:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": "rate_limited",
  "retry_after_sec": 60
}
```

Current rate limit: 10 requests/minute per IP. Generous for v1 but worth knowing.

### Callback to your URL

When the render service completes (success or failure), it POSTs to the `callbackUrl` you provided.

Success:

```http
POST {callbackUrl}
Content-Type: application/json
Authorization: Bearer <CALLBACK_SHARED_SECRET>

{
  "jobId": "uuid-string",
  "reportId": "the-same-reportId-you-sent",
  "status": "completed",
  "videoUrl": "https://<r2-host>/path/to/video.mp4?<signature>",
  "durationSec": 42,
  "completedAt": "2026-05-24T12:34:56.789Z"
}
```

The `videoUrl` is a presigned URL valid for 24 hours. After that you'd need to re-sign it — but meditrack_v3 should store and serve it directly, and re-render only if the URL expires before the user accesses it (rare in practice).

Failure:

```http
POST {callbackUrl}
Content-Type: application/json
Authorization: Bearer <CALLBACK_SHARED_SECRET>

{
  "jobId": "uuid-string",
  "reportId": "the-same-reportId-you-sent",
  "status": "failed",
  "error": "specialist_required" | "script_generation_failed"
          | "script_safety_violation" | "script_number_hallucination"
          | "tts_failed" | "render_failed",
  "message": "Human-readable reason (no PHI)"
}
```

### `GET /healthz`

For uptime monitoring. Returns 200 with `{"ok": true}` if service is healthy. Returns 503 if Redis is unreachable.

---

## Error codes the render service can return

| Code | Meaning | What meditrack_v3 should do |
|------|---------|----------------------------|
| `specialist_required` | Pediatric or pregnancy panel — render service refuses to generate | Show user "Speak with a specialist about this report" message. Do NOT retry. |
| `script_generation_failed` | OpenAI returned malformed JSON twice in a row | Retry once after 30 seconds. If it fails again, log and surface generic error. |
| `script_safety_violation` | LLM produced banned phrasing or medication names | Log. Do NOT retry — output will be deterministically similar. Surface generic error. |
| `script_number_hallucination` | LLM put a number in the script that wasn't in findings | Log. Retry once — might be a one-off. If it fails again, surface generic error. |
| `tts_failed` | ElevenLabs API error | Retry once after 60 seconds. If it fails again, surface generic error and notify operators. |
| `render_failed` | Remotion render crashed (usually Chromium issue) | Retry once. If it fails again, surface generic error and notify operators. |

For all retries, generate a new jobId (don't reuse). The render service treats each request as independent.

---

## Auth

### Calling the render service

You need `RENDER_API_KEY` set in meditrack_v3's env. This is the bearer token you put in the `Authorization` header.

This key is set in Fly secrets on the render service side and must be replicated to meditrack_v3's env. When rotating, update both sides.

Get the current value from the password manager entry: "MediTrack Render — production".

### Receiving callbacks

You need `CALLBACK_SHARED_SECRET` set in meditrack_v3's env. The render service sends `Authorization: Bearer <CALLBACK_SHARED_SECRET>` on every callback. meditrack_v3 must verify it on every received callback.

This secret is also set in Fly secrets on the render service. It's a DIFFERENT value from `RENDER_API_KEY` — don't conflate them.

If `CALLBACK_SHARED_SECRET` hasn't been set up yet, generate one and set on both sides:

```bash
# On meditrack_v3 deployment:
CALLBACK_SHARED_SECRET=$(openssl rand -base64 32)

# Then set in both:
# - meditrack_v3 env (however meditrack_v3 manages secrets)
# - Fly secrets for render service:
#     fly secrets set CALLBACK_SHARED_SECRET="$CALLBACK_SHARED_SECRET" --app meditrack-render
```

Verifying the callback in meditrack_v3:

```ts
// In your callback handler
const incomingToken = req.headers.authorization?.replace('Bearer ', '');
if (incomingToken !== process.env.CALLBACK_SHARED_SECRET) {
  return res.status(401).json({ error: 'unauthorized' });
}
```

Use constant-time comparison (`crypto.timingSafeEqual`) if your codebase already has that pattern.

---

## Expected timing

| Phase | Cold container | Warm container |
|-------|---------------|---------------|
| Queue → start rendering | < 1 sec | < 1 sec |
| Script generation (OpenAI) | 5–15 sec | 5–15 sec |
| Lint | < 1 sec | < 1 sec |
| TTS generation (ElevenLabs) | 30–60 sec (8 beats × ~5s each) | 5–10 sec (cache hits) |
| Render (Remotion + Chromium) | 60–120 sec | 45–90 sec |
| Upload to R2 + callback | < 5 sec | < 5 sec |
| **Total** | 2–4 minutes | 60–120 sec |

meditrack_v3 should design for ~2 minutes as the typical case and ~4 minutes as the worst case. Show progress feedback throughout. Don't set client-side timeouts shorter than 5 minutes.

---

## What the render service is NOT responsible for

These are meditrack_v3's job:

- Authenticating the end user (only the render service auth is bearer token)
- Storing the video URL for later retrieval
- Showing the video to the user
- Notifying the user when the video is ready
- Handling user errors (showing helpful messages on failure)
- Generating thumbnails or preview images
- Maintaining viewing history
- WhatsApp/email sharing (defer to v1.5)
- Re-rendering with different parameters (the user clicks "regenerate")
- Lab report parsing — meditrack_v3 already does this; the render service just consumes the parsed output

If meditrack_v3 ever calls the render service with malformed data (wrong shape, missing fields), the render service rejects with 400 — meditrack_v3 should treat that as an internal bug in meditrack_v3, not a user-facing error.

---

## Production state (as of this writing)

- Render service deployed at `https://meditrack-render.fly.dev`
- Fly region: Mumbai (`bom`)
- VM: `shared-cpu-2x`, 4GB RAM
- Storage: Cloudflare R2 bucket `meditrack-videos`, hosted-by-Upstash Redis for queue
- LLM: OpenAI gpt-4o
- TTS: ElevenLabs Multilingual v2 (Hindi)
- Healthcheck: `https://meditrack-render.fly.dev/healthz` — should return 200

For source code and detailed architecture see the `meditrack-render` repo separately.

---

## Smoke test endpoint

To verify the render service is alive and your auth works without doing a full render:

```bash
curl https://meditrack-render.fly.dev/healthz
# Expected: {"ok":true,"uptime_sec":N}

curl -X POST https://meditrack-render.fly.dev/render \
  -H "Authorization: Bearer <RENDER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 validation_failed (proves auth works, empty body is rejected)
```

If the first returns ok:true and the second returns 400 (not 401), the integration plumbing is healthy. From there, the issue is in your request shape, not the connection.

---

## What's left to integrate (TODO for meditrack_v3)

1. Database columns on the report record to track video state (video_status, video_url, video_job_id, video_error, video_requested_at, video_generated_at)
2. Trigger endpoint: `POST /api/reports/:id/generate-video`
3. Callback receiver: `POST /api/videos/callback`
4. Status endpoint: `GET /api/reports/:id/video-status`
5. UI on the report detail page: "Generate video" button, in-progress state, video player
6. Frontend polling logic for status updates
7. Smoke tests against production render service

See the integration plan for the order to build these.
