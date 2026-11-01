const sms = globalThis.__sms ??= []
export async function sendSms(to, body) {
  if (globalThis.__twilioFail) throw new Error('Twilio: The From phone number is not SMS-capable')
  sms.push({ to, body })
  return { sid: 'SMfake' }
}
export default { messages: { create: sendSms } }
