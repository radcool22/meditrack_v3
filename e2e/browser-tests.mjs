// Drives the real built client in headless Chrome (iPhone-size viewport)
// against the real server with faked external services.
// Needs a fresh client build (client/dist) and Google Chrome.
// Run from this folder:  node --import ./fakes/register.mjs browser-tests.mjs
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SHOTS = path.join(HERE, 'shots'); fs.mkdirSync(SHOTS, { recursive: true })
const SERVER = path.join(HERE, '../server')
const FIXTURES = path.join(HERE, 'fixtures')
const PORT = 5097, RENDER_PORT = 5197, CDP_PORT = 9333
const BASE = `http://127.0.0.1:${PORT}`
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

Object.assign(process.env, {
  PORT: String(PORT), NODE_ENV: 'production', JWT_SECRET: 'e2e-jwt', JWT_EXPIRES_IN: '7d',
  SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'x', SUPABASE_STORAGE_BUCKET: 'reports',
  OPENAI_API_KEY: 'x', GOOGLE_CLOUD_API_KEY: 'x', ELEVENLABS_API_KEY: 'x', TWILIO_ACCOUNT_SID: 'ACx', TWILIO_AUTH_TOKEN: 'x', TWILIO_PHONE_NUMBER: '+10000000000',
  APP_BASE_URL: BASE, RENDER_SERVICE_URL: `http://127.0.0.1:${RENDER_PORT}`, RENDER_API_KEY: 'render-key',
  CALLBACK_SHARED_SECRET: 'cb-secret', R2_PUBLIC_URL: 'https://videos.example',
  SARVAM_API_KEY: 'sarvam-key', SARVAM_ORG_ID: 'org1', SARVAM_WORKSPACE_ID: 'ws1', SARVAM_APP_ID: 'agent1', SARVAM_APP_VERSION: '3',
  SARVAM_CONNECTION_ID: 'conn1', SARVAM_AGENT_NUMBER: '+918064270600', VOICE_WEBHOOK_TOKEN: 'hook-token', VOICE_CALL_HOURS: '00:00-24:00',
})

const render = { mode: 'ok', jobs: [] }
await new Promise((resolve) => http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => body += c)
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/render') {
      if (render.mode === '429') { res.writeHead(429, { 'Retry-After': '60' }); return res.end('{}') }
      const jobId = crypto.randomUUID(); render.jobs.push({ jobId, payload: JSON.parse(body) })
      res.writeHead(202, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ jobId }))
    }
    res.writeHead(200); res.end('{}')
  })
}).listen(RENDER_PORT, '127.0.0.1', resolve))

for (const k of ['log', 'warn', 'error']) { const o = console[k]; console[k] = (...a) => { if (process.env.VERBOSE) o(...a) } }
await import(path.join(SERVER, 'index.js'))
await new Promise((r) => setTimeout(r, 500))
const db = globalThis.__db, sms = globalThis.__sms

// ── Chrome over the DevTools protocol ──────────────────────────────────────
const profile = fs.mkdtempSync(path.join(HERE, 'chrome-'))
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run',
  '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' })
let pageWs
for (let i = 0; i < 100 && !pageWs; i++) {
  await new Promise((r) => setTimeout(r, 200))
  try { pageWs = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl } catch {}
}
const ws = new WebSocket(pageWs)
await new Promise((r) => ws.addEventListener('open', r))
let seq = 0; const pending = new Map(); const listeners = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } else listeners.forEach((l) => l(m))
})
const cdp = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, (m) => m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result))
  ws.send(JSON.stringify({ id, method, params }))
})

const jsErrors = []
listeners.push((m) => {
  if (m.method === 'Runtime.exceptionThrown') jsErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') jsErrors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '))
})
await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('DOM.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
await cdp('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })

const js = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result.value
}
const text = () => js('document.body.innerText')
const goto = async (url) => { await cdp('Page.navigate', { url }); await new Promise((r) => setTimeout(r, 700)) }
async function waitText(needle, ms = 15000) {
  const end = Date.now() + ms
  while (Date.now() < end) { if ((await text()).includes(needle)) return true; await new Promise((r) => setTimeout(r, 150)) }
  return false
}
// Clicks the innermost visible element whose text is exactly `label` (scoped by CSS selector).
async function click(label, scope = 'button, a, [role=button]') {
  return js(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(scope)})].filter(e => e.offsetParent !== null && e.innerText.trim() === ${JSON.stringify(label)})
    if (!els.length) return false
    els[els.length - 1].click(); return true })()`)
}
// Sets a React-controlled input's value the way typing does.
async function type(selector, value) {
  return js(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e => e.offsetParent !== null).pop()
    if (!el) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
}
async function shot(name) {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'))
}
// The age modal's form is the last form on the page (the chat box has one too).
const submitAge = () => js(`[...document.querySelectorAll('form button[type=submit]')].pop().click()`)
const noSideScroll = () => js('document.documentElement.scrollWidth <= window.innerWidth + 1')

let passed = 0, failed = 0; const failures = []
function check(name, ok, detail = '') {
  if (ok) passed++; else { failed++; failures.push(`${name} ${detail}`) }
  console.info(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  ← ' + String(detail).slice(0, 300)}`)
}
const section = (t) => console.info(`\n── ${t}`)
const lastCode = (to) => [...sms].reverse().find((m) => m.to === to)?.body.match(/\d{6}/)?.[0]
// Sarvam's post-call webhook for the most recent call still ringing.
async function endCall(fields) {
  const live = [...db.tables.voice_calls].reverse().find((c) => c.status === 'calling')
  await fetch(BASE + '/api/voice/webhook?token=hook-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt_id: live.sarvam_attempt_id, ...fields }) })
}
const cb = (body) => fetch(BASE + '/api/videos/callback', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer cb-secret' }, body: JSON.stringify(body) })

try {
  section('Login — new user')
  await goto(BASE + '/')
  check('root redirects to /login', (await js('location.pathname')) === '/login')
  check('login screen shows phone entry', await waitText('Send OTP'))
  check('"Log In" is the default tab', await js(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Log In').className.includes('shadow-sm')`))
  check('login page fits 375px (no sideways scroll)', await noSideScroll())
  await shot('01-login')
  await type('input[type=tel]', '9800000001')
  await click('Send OTP')
  check('new number on "Log In" → OTP sent silently (no error)', await waitText('OTP sent to +919800000001'), await text())
  check('no error text on OTP screen', !/already registered|No account found|Sorry/.test(await text()))
  await shot('02-otp')
  await type('input[maxlength="6"]', lastCode('+919800000001'))
  await click('Verify & Login')
  check('new user sees the name screen', await waitText('Welcome!'), await text())
  await shot('03-name')
  await type('input[maxlength="60"]', 'Meera Iyer')
  await click('Continue')
  check('lands on dashboard with greeting', await waitText('Hello, Meera Iyer'), await text())
  check('name saved in DB', db.tables.users.find((u) => u.phone_number === '+919800000001')?.name === 'Meera Iyer')
  check('dashboard fits 375px', await noSideScroll())
  await shot('04-dashboard-empty')

  section('Upload + analysis')
  const doc = await cdp('DOM.getDocument', { depth: -1 })
  const { nodeId } = await cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' })
  await cdp('DOM.setFileInputFiles', { nodeId, files: [path.join(FIXTURES, 'lab.pdf')] })
  check('file appears in upload list', await waitText('lab.pdf'))
  await click('Upload Report')
  check('card shows real title after analysis (no refresh)', await waitText('Complete Blood Count — Dr. Lal PathLabs', 20000), await text())
  check('card shows report date', await waitText('18 Oct 2025'))
  check('card shows Ready', await waitText('Ready'))
  check('chat panel unlocked once a report is done', !(await text()).includes('Upload and analyse a report to start chatting.'))
  await shot('05-dashboard-report')

  section('Dashboard chat')
  await js(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Text').click()`)
  await new Promise((r) => setTimeout(r, 200))
  await type('input[placeholder="Type your question…"]', 'Is my sugar ok?')
  await click('Send')
  check('dashboard chat answers', await waitText('Reply(auto): Is my sugar ok?'), await text())

  section('Report page')
  await js(`[...document.querySelectorAll('p')].find(p => p.innerText.includes('Complete Blood Count')).click()`)
  check('report page opens with summary', await waitText('Your blood report shows low haemoglobin', 15000), await text())
  check('no "analysis failed" on report page', !(await text()).includes('Analysis failed'))
  check('abnormal value tile shown', (await text()).includes('Carries oxygen'))
  check('report page fits 375px', await noSideScroll())
  await shot('06-report')
  await js(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Text').click()`)
  await new Promise((r) => setTimeout(r, 200))
  await type('input[placeholder="Type your question…"]', 'What is haemoglobin?')
  await click('Send')
  check('report chat answers', await waitText('Reply(auto): What is haemoglobin?'), await text())

  section('Phone call — dashboard')
  const sarvam = globalThis.__net.sarvam
  await goto(BASE + '/dashboard')
  check('Call card on the dashboard', await waitText('Talk to MediTrack on the phone'), await text())
  check('Call card comes before upload', await js(`!!(document.getElementById('call-me').compareDocumentPosition(document.getElementById('upload-section')) & Node.DOCUMENT_POSITION_FOLLOWING)`))
  check('card names the number and language', (await text()).includes('+91 98000 00001') && (await text()).includes('English'))
  check('dashboard with Call card fits 375px', await noSideScroll())
  await shot('20-call-card')
  await click('Call me now')
  check('first call asks for consent', await waitText('Before we call you'), await text())
  check('consent sheet fits 375px', await noSideScroll())
  await shot('21-call-consent')
  await click('Not now')
  await new Promise((r) => setTimeout(r, 300))
  check('"Not now" closes it and nothing is dialled', !(await text()).includes('Before we call you') && sarvam.length === 0)
  await click('Call me now')
  await waitText('Before we call you')
  await click('Agree and call me')
  check('agree → calling state', await waitText('Calling +91 98000 00001'), await text())
  check('shows the number that will ring', (await text()).includes('+91 80642 70600'))
  check('Sarvam dialled the account number', sarvam.length === 1 && sarvam[0].body.user_config.user_phone_number === '+919800000001')
  check('"Your calls" shows it ringing', await waitText('Calling…'))
  await shot('22-calling')
  await goto(BASE + '/dashboard')
  check('a ringing call survives a page refresh', await waitText('Calling +91 98000 00001'), await text())
  await endCall({ status: 'connected', duration: 95, interaction_transcript: [{ role: 'agent', en_text: 'Namaste Meera ji' }, { role: 'user', en_text: 'Is my sugar fine?' }] })
  check('call ends → finished with duration', await waitText('Call finished', 12000) && (await text()).includes('1 min 35 sec'), await text())
  check('summary appears on the card', await waitText('CallSummary(en)', 40000), await text())
  await shot('23-call-done')
  await js(`[...document.querySelectorAll('button[aria-expanded]')][0].click()`)
  await click('Show what was said')
  check('history row opens summary and transcript', await waitText('MediTrack: Namaste Meera ji') && (await text()).includes('You: Is my sugar fine?'), await text())
  await shot('24-call-history')
  await click('Done')
  check('"Done" returns to the Call card', await waitText('Call me now'))
  await click('Call me now')
  check('second call needs no consent again', await waitText('Calling +91 98000 00001') && !(await text()).includes('Before we call you'))
  await endCall({ status: 'no_answer' })
  check('missed call explained', await waitText("You didn't pick up", 12000), await text())
  process.env.VOICE_CALL_HOURS = '00:00-00:00'
  await click('Try again')
  check('outside calling hours explained', await waitText('MediTrack calls between 8 am and 9:30 pm'), await text())
  process.env.VOICE_CALL_HOURS = '00:00-24:00'

  section('Phone call — report page')
  const callReport = db.tables.reports.find((r) => r.status === 'done')
  await goto(`${BASE}/report/${callReport.id}`)
  check('report page offers a call about this report', await waitText('Talk about this report on the phone'), await text())
  check('report page with call button fits 375px', await noSideScroll())
  await click('Call me')
  check('report call → calling state', await waitText('Calling +91 98000 00001'), await text())
  check('Sarvam told which report', sarvam.at(-1).body.app_config.agent_variables.focus_report.startsWith('Complete Blood Count'))
  await shot('25-report-calling')
  await endCall({ status: 'busy' })
  check('busy line explained', await waitText('Your line was busy', 12000), await text())

  section('Phone call — from meditrack.in')
  await goto(BASE + '/?call=1')
  check('?call=1 lands on the dashboard Call card, highlighted', await waitText('Talk to MediTrack on the phone') && await js(`document.getElementById('call-me').className.includes('ring-4')`))
  await goto(`${BASE}/report/${callReport.id}`)
  await waitText('Your blood report shows')

  section('Video — success path')
  await click('Generate Video')
  check('age prompt opens', await waitText("Patient's age"))
  await shot('07-age')
  await type('input[type=number]', '52')
  await submitAge()
  check('generating frame shown', await waitText('Generating your Hindi video summary', 8000), await text())
  check('floating progress card appears at once', await waitText('Generating Video...', 3000))
  check('render received the age we typed', render.jobs.at(-1)?.payload.patient.ageYears === 52)
  check('render received the real name', render.jobs.at(-1)?.payload.patient.firstName === 'Meera')
  await shot('08-generating')
  const job = render.jobs.at(-1)
  await cb({ reportId: job.payload.reportId, jobId: job.jobId, status: 'completed', videoUrl: 'https://videos.example/v.mp4' })
  check('report page flips to Watch Video', await waitText('Watch Video', 12000), await text())
  check('progress card shows Video Ready!', await waitText('Video Ready!', 12000))
  await shot('09-ready')
  await click('Watch Now')
  check('Watch Now opens the player', await js(`!!document.querySelector('video')`))
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await new Promise((r) => setTimeout(r, 200))
  await js(`[...document.querySelectorAll('button[aria-label=Close]')].forEach(b => b.click())`)

  section('Video — failure path')
  await click('Back')
  await new Promise((r) => setTimeout(r, 500))
  const doc2 = await cdp('DOM.getDocument', { depth: -1 })
  const fi = await cdp('DOM.querySelector', { nodeId: doc2.root.nodeId, selector: 'input[type=file]' })
  await cdp('DOM.setFileInputFiles', { nodeId: fi.nodeId, files: [path.join(FIXTURES, 'lab.pdf')] })
  await waitText('lab.pdf'); await click('Upload Report')
  await new Promise((r) => setTimeout(r, 1500))
  const reports = db.tables.reports.filter((r) => r.user_id === db.tables.users.find((u) => u.phone_number === '+919800000001').id)
  const second = reports.at(-1)
  await goto(`${BASE}/report/${second.id}`)
  await waitText('Your blood report shows')
  await click('Generate Video')
  await type('input[type=number]', '52')
  await submitAge()
  await waitText('Generating your Hindi video summary', 8000)
  const job2 = render.jobs.at(-1)
  await cb({ reportId: second.id, jobId: job2.jobId, status: 'failed', error: 'specialist_required', message: 'x' })
  check('failed video shows the reason', await waitText('specialist doctor', 12000), await text())
  check('failed video offers Try Again', (await text()).includes('Try Again'))
  await shot('10-video-failed')
  await click('Try Again', 'main button')
  check('Try Again reopens the age prompt', await waitText("Patient's age"))
  await type('input[type=number]', '12')
  await submitAge()
  check('age 12 → specialist message, no render', await waitText('under 18', 5000) && render.jobs.at(-1).jobId === job2.jobId, await text())

  section('Dashboard video picker — busy service')
  await goto(BASE + '/dashboard')
  await waitText('Your Reports'.toUpperCase()) || await waitText('Hello')
  render.mode = '429'
  await click('Generate Video SummaryA short Hindi video explaining any report') || await js(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('Generate Video Summary')).click()`)
  check('report picker opens', await waitText('Choose a report to generate a video for'))
  await shot('11-picker')
  await js(`[...document.querySelectorAll('button')].filter(b => b.innerText.includes('Complete Blood Count')).pop().click()`)
  await type('input[type=number]', '52')
  await submitAge()
  check('busy service → clear message on dashboard', await waitText('busy right now', 5000), await text())
  await shot('12-busy')
  render.mode = 'ok'

  section('Delete')
  const before = db.tables.reports.length
  await js(`document.querySelector('button[aria-label=Delete]').click()`)
  await click('Delete')
  await new Promise((r) => setTimeout(r, 1000))
  check('report deleted from list and DB', db.tables.reports.length === before - 1)

  section('Language dropdown')
  await js(`(() => { const s = document.querySelector('select[aria-label="Select language"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, 'hi'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await js(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Text').click()`)
  await new Promise((r) => setTimeout(r, 200))
  await type('input[placeholder="Type your question…"]', 'sugar?')
  await click('Send')
  check('Hindi selected → dashboard chat answers in Hindi', await waitText('Reply(hi): sugar?'), await text())

  section('Logout + returning user')
  await click('Logout')
  check('logout returns to login', await waitText('Send OTP'))
  await type('input[type=tel]', '9800000001')
  await click('Send OTP')
  await waitText('OTP sent to')
  await type('input[maxlength="6"]', lastCode('+919800000001'))
  await click('Verify & Login')
  check('returning user goes straight to dashboard (no name screen)', await waitText('Hello, Meera Iyer') && !(await text()).includes('Welcome!'), await text())

  section('Existing account without a name')
  db.tables.users.find((u) => u.phone_number === '+919800000001').name = null
  await js(`localStorage.setItem('mt_user', JSON.stringify({ ...JSON.parse(localStorage.getItem('mt_user')), name: null }))`)
  await goto(BASE + '/dashboard')
  check('nameless account sees the name prompt', await waitText('What should we call you?'))
  await shot('13-name-prompt')
  await type('input[placeholder="Your name"]', 'Meera')
  await click('Save')
  check('name saved → greeting appears', await waitText('Hello, Meera'))

  section('Laptop width (1280px)')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await goto(BASE + '/dashboard')
  check('dashboard renders on laptop', await waitText('Hello, Meera'))
  check('dashboard: no sideways scroll on laptop', await noSideScroll())
  check('Call card + call history on laptop', (await text()).includes('Talk to MediTrack on the phone') && await waitText('YOUR CALLS'))
  await shot('14-desktop-dashboard')
  const anyReport = db.tables.reports.find((r) => r.status === 'done')
  await goto(`${BASE}/report/${anyReport.id}`)
  check('report page renders on laptop', await waitText('Your blood report shows'))
  check('report page: no sideways scroll on laptop', await noSideScroll())
  await shot('15-desktop-report')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true })
  await goto(BASE + '/dashboard')

  section('Signup tab with an existing number')
  await click('Logout')
  await click('Sign Up')
  await type('input[type=tel]', '9800000001')
  await click('Send OTP')
  check('"Sign Up" with existing number → OTP sent silently', await waitText('OTP sent to +919800000001') && !(await text()).includes('already registered'), await text())

  await goto(BASE + '/?call=1')
  check('logged out + ?call=1 → login says what happens next', await waitText('Log in, then tap Call me now'), await text())
  await shot('26-login-call-intent')

  section('Old debug page')
  await goto(BASE + '/test-voice')
  check('/test-voice no longer exists (redirects to login)', (await js('location.pathname')) === '/login')

  section('JavaScript errors during the whole run')
  const real = jsErrors.filter((e) => !/Failed to load resource|status of 4\d\d|WebSocket|ws\/tts/.test(e))
  check('no uncaught JS errors or console errors', real.length === 0, real.slice(0, 5).join(' || '))
} catch (e) {
  check('browser run completed without a harness crash', false, e.stack)
} finally {
  console.info(`\n${failed === 0 ? 'ALL ' : ''}${passed} passed, ${failed} failed`)
  if (failed) console.info('FAILURES:\n- ' + failures.join('\n- '))
  chrome.kill(); await new Promise((r) => setTimeout(r, 500)); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  process.exit(failed ? 1 : 0)
}
