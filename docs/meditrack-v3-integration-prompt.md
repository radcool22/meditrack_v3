# What to tell the new Claude Code session

Two things to do, in this order.

## Step 1 — Drop the spec doc into meditrack_v3

Copy `render-service-spec.md` (the other output file from this session) into the meditrack_v3 repo at:

```
meditrack_v3/docs/render-service.md
```

Create the `docs/` directory if it doesn't exist. Commit it:

```bash
cd /path/to/meditrack_v3
git add docs/render-service.md
git commit -m "add render service integration spec"
```

This document now lives in the meditrack_v3 repo permanently. Every future Claude Code session can read it. Don't skip this — the spec is the contract between the two services.

## Step 2 — Start a Claude Code session in meditrack_v3

Open Claude Code in the meditrack_v3 repo. First message (orientation only):

> Read `docs/render-service.md` end-to-end. Then read the existing `CLAUDE.md`, `server/` directory, the schema/migrations directory, and any existing API route definitions. Don't write code yet.
>
> Tell me, in 6-8 sentences:
>
> 1. What this project is (in your own words, to confirm you understand).
> 2. The current API auth pattern — how routes authenticate users.
> 3. Where structured report data is stored — what tables/columns, how it's accessed.
> 4. Whether any endpoint currently returns parsed report data in JSON, and what shape it returns.
> 5. The schema migration system (Prisma? Drizzle? Knex? raw SQL?).
> 6. The frontend stack and how it currently displays the report detail page.
> 7. Whether there's any precedent for async/background work in this codebase (existing queue, polling pattern, etc.).
> 8. Whether there's a public webhook receiver pattern already in use.
>
> Anything in `docs/render-service.md` that contradicts current code or seems wrong, flag it now.

Read its response carefully. Don't proceed until you're sure it understands the codebase. Specifically, check:

- Does its summary of the data shape match what the render service expects? (See `docs/render-service.md` for the target shape.)
- Did it notice any gaps in the existing code that need to be addressed?
- Did it flag anything contradictory between the spec and reality?

If the answer to all three is solid, you're ready for the build sessions.

If it got something wrong, fix `docs/render-service.md` or `CLAUDE.md` first. Don't proceed with bad mental model — every subsequent prompt amplifies the error.

## Step 3 — Plan the integration with it

Once oriented, send a second message:

> Based on what you just read, the integration with the render service needs these pieces:
>
> 1. Database schema: new columns on the report table — `video_status`, `video_url`, `video_job_id`, `video_error`, `video_requested_at`, `video_generated_at`
> 2. Trigger endpoint: `POST /api/reports/:id/generate-video`
> 3. Callback receiver: `POST /api/videos/callback`
> 4. Status endpoint: `GET /api/reports/:id/video-status` (for frontend polling)
> 5. UI changes on the report detail page: "Generate video" button, in-progress state, video player
> 6. Frontend polling logic
>
> Two secrets needed in env:
> - `RENDER_API_KEY` — bearer token to call render service
> - `CALLBACK_SHARED_SECRET` — verifies callbacks from render service
>
> Walk through the integration plan you'd recommend, ordered by dependency. Break it into 4-5 focused sessions where each session ends in a deployable, reviewable state. I want to ship something usable at each milestone — not have one giant PR at the end.
>
> Then propose the first session in detail (what files to create/modify, what tests to add, what acceptance criteria look like). Don't write code yet.

Read the plan it produces carefully. Two things to verify:

- **The plan delivers value at each step.** Not "set up infrastructure for 3 sessions, then suddenly ship UI." Each session should produce something testable end-to-end. For example: session 1 might be "trigger endpoint working end-to-end with a curl, no UI yet" — that's deployable and testable, even though the user can't use it yet.

- **The plan respects existing meditrack_v3 patterns.** If meditrack_v3 uses a specific auth pattern, schema tool, or HTTP framework, the new code should match. If the plan introduces something inconsistent (e.g., a new ORM when meditrack_v3 already uses one), push back.

If the plan looks right, approve it. Then proceed with the first session's implementation prompt.

## A few notes on what NOT to do

- **Don't ask the new Claude Code session to read this conversation.** It can't and it would be a security issue anyway (credentials in chat history). It only needs `docs/render-service.md` and the meditrack_v3 codebase.

- **Don't paste secrets into the new Claude Code session.** Generate `CALLBACK_SHARED_SECRET` yourself in a terminal, paste into your password manager and into env files, never into chat.

- **Don't rush past the orientation step.** The 8-question check is what catches "Claude Code has misread the codebase and would now write 200 lines of bad code." 5 minutes of orientation saves an hour of fixing bad output.

- **Don't merge integration sessions to ship faster.** Each session should be one PR with one clear thing. Merging sessions because you're tired is how you produce diffs you can't review.

## What success looks like at the end

After 4-5 focused sessions:

- A user opens their report on meditrack.in
- They see a "Watch summary" button
- They click it; meditrack_v3 fires the render request
- The page shows a "preparing your video, about 2 minutes" state
- Polling detects when it's ready
- The video plays inline
- (Bonus: they can share the link)

That's the v1.0 launchable state. Lawyer review of the disclaimer and basic monitoring come next, but those don't block the basic flow.
