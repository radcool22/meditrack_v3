// Swaps the server's client modules for fakes; everything else is the real code.
const FAKES = { 'services/supabase.js': 'fake-supabase.mjs', 'services/openai.js': 'fake-openai.mjs', 'services/twilio.js': 'fake-twilio.mjs' }
export async function resolve(specifier, context, next) {
  const res = await next(specifier, context)
  for (const [suffix, fake] of Object.entries(FAKES)) {
    if (res.url.endsWith('/server/' + suffix)) return { url: new URL(fake, import.meta.url).href, shortCircuit: true }
  }
  return res
}
