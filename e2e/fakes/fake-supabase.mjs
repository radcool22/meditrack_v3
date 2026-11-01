// In-memory stand-in for the Supabase client: the query-builder subset the
// server uses, plus storage. State lives on globalThis.__db for assertions.
import { randomUUID } from 'node:crypto'

let tick = 0
const now = () => new Date(Date.now() + tick++).toISOString()

const DEFAULTS = {
  users:             () => ({ id: randomUUID(), name: null, language_preference: 'en', created_at: now(), last_login_at: null }),
  otp_verifications: () => ({ id: randomUUID(), is_used: false, created_at: now() }),
  reports:           () => ({ id: randomUUID(), status: 'pending', uploaded_at: now(), ocr_raw_text: null, structured_data: null,
                              report_date: null, report_title: null, video_status: 'none', video_url: null, video_job_id: null,
                              video_error: null, video_requested_at: null, video_generated_at: null, whatsapp_wa_id: null }),
  report_analyses:   () => ({ id: randomUUID(), created_at: now(), language: 'en' }),
  chat_messages:     () => ({ id: randomUUID(), created_at: now(), message_type: 'text' }),
  whatsapp_sessions: () => ({ id: randomUUID(), state: 'idle', language: 'en', pending_action: null, pending_data: null,
                              recent_history: null, current_report_id: null, user_id: null, updated_at: now() }),
}

const db = globalThis.__db ??= { tables: Object.fromEntries(Object.keys(DEFAULTS).map((t) => [t, []])), storage: new Map(), fail: false }

function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)) }

class Query {
  constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.returning = false }
  select() { if (this.op !== 'select') this.returning = true; return this }
  insert(rows) { this.op = 'insert'; this.payload = rows; return this }
  update(values) { this.op = 'update'; this.payload = values; return this }
  upsert(row, opts = {}) { this.op = 'upsert'; this.payload = row; this.conflict = opts.onConflict; return this }
  delete() { this.op = 'delete'; return this }
  eq(col, val) { this.filters.push((r) => r[col] === val); return this }
  neq(col, val) { this.filters.push((r) => r[col] !== val); return this }
  in(col, vals) { this.filters.push((r) => vals.includes(r[col])); return this }
  gt(col, val) { this.filters.push((r) => r[col] > val); return this }
  order(col, { ascending = true, nullsFirst = !ascending } = {}) { this.orderBy = { col, ascending, nullsFirst }; return this }
  limit(n) { this.lim = n; return this }
  maybeSingle() { this.single_ = 'maybe'; return this }
  single() { this.single_ = 'one'; return this }

  run() {
    if (db.fail) return { data: null, error: { message: 'fake database unavailable' } }
    const rows = db.tables[this.table]
    if (!rows) return { data: null, error: { message: `no table ${this.table}` } }
    const match = (r) => this.filters.every((f) => f(r))
    let out

    if (this.op === 'select') {
      out = rows.filter(match)
    } else if (this.op === 'insert') {
      out = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p) => {
        const row = { ...DEFAULTS[this.table](), ...clone(p) }
        rows.push(row)
        return row
      })
    } else if (this.op === 'update') {
      out = rows.filter(match)
      for (const r of out) Object.assign(r, clone(this.payload))
    } else if (this.op === 'upsert') {
      const existing = rows.find((r) => r[this.conflict] === this.payload[this.conflict])
      if (existing) { Object.assign(existing, clone(this.payload)); out = [existing] }
      else { const row = { ...DEFAULTS[this.table](), ...clone(this.payload) }; rows.push(row); out = [row] }
    } else if (this.op === 'delete') {
      out = rows.filter(match)
      db.tables[this.table] = rows.filter((r) => !match(r))
      if (this.table === 'reports') {
        const gone = new Set(out.map((r) => r.id))
        for (const t of ['report_analyses', 'chat_messages']) db.tables[t] = db.tables[t].filter((r) => !gone.has(r.report_id))
      }
    }

    if (this.orderBy) {
      const { col, ascending, nullsFirst } = this.orderBy
      out = [...out].sort((a, b) => {
        const x = a[col], y = b[col]
        if (x == null && y == null) return 0
        if (x == null) return nullsFirst ? -1 : 1
        if (y == null) return nullsFirst ? 1 : -1
        return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1)
      })
    }
    if (this.lim !== undefined) out = out.slice(0, this.lim)

    if (this.op !== 'select' && !this.returning) return { data: null, error: null }
    if (this.single_ === 'maybe') {
      if (out.length > 1) return { data: null, error: { message: 'multiple rows' } }
      return { data: clone(out[0] ?? null), error: null }
    }
    if (this.single_ === 'one') {
      if (out.length !== 1) return { data: null, error: { message: `expected 1 row, got ${out.length}` } }
      return { data: clone(out[0]), error: null }
    }
    return { data: clone(out), error: null }
  }

  then(resolve, reject) { try { resolve(this.run()) } catch (e) { reject(e) } }
}

const supabase = {
  from: (table) => new Query(table),
  storage: {
    from: (bucket) => ({
      upload: async (path, buf) => { if (db.fail) return { error: { message: 'storage down' } }; db.storage.set(`${bucket}/${path}`, Buffer.from(buf)); return { error: null } },
      getPublicUrl: (path) => ({ data: { publicUrl: `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURI(path)}` } }),
      download: async (path) => {
        const buf = db.storage.get(`${bucket}/${path}`)
        return buf ? { data: new Blob([buf]), error: null } : { data: null, error: { message: 'Object not found' } }
      },
      remove: async (paths) => { for (const p of paths) db.storage.delete(`${bucket}/${p}`); return { error: null } },
    }),
  },
}

export default supabase
