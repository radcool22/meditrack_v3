// Fake OpenAI: records every call; answers by what the prompt asks for.
const calls = globalThis.__openaiCalls ??= []

const ANALYSIS = {
  structured_data: {
    report_date: '2025-10-18',
    tests: [
      { test: 'Haemoglobin', value: '11.2', unit: 'g/dL', normal_range: '13.0 - 17.0', flag: 'LOW' },
      { test: 'Platelet Count', value: '1,50,000', unit: '/cumm', normal_range: '1,50,000 - 4,10,000', flag: 'NORMAL' },
      { test: 'Glucose Fasting', value: '480', unit: 'mg/dL', normal_range: '70 - 100 mg/dL', flag: 'HIGH' },
    ],
  },
  analysis: {
    report_title: 'Complete Blood Count — Dr. Lal PathLabs',
    summary: 'Your blood report shows low haemoglobin and very high sugar.',
    abnormal_values: [{ test: 'Haemoglobin', value: '11.2 g/dL', normal_range: '13.0 - 17.0', flag: 'LOW', plain_explanation: 'Carries oxygen; a bit low.' }],
    suggestions: ['Eat iron-rich foods', 'See a doctor about sugar'],
  },
}

const NON_NUMERIC = {
  structured_data: { report_date: null, tests: [{ test: 'HIV', value: 'Non Reactive', unit: '', normal_range: 'Non Reactive', flag: 'NORMAL' }] },
  analysis: { report_title: 'HIV Screening', summary: 'Your HIV test is non reactive.', abnormal_values: [], suggestions: ['Keep up regular check-ups'] },
}

export default {
  chat: {
    completions: {
      create: async (req) => {
        calls.push(req)
        const sys = req.messages[0]?.content ?? ''
        const last = req.messages.at(-1)?.content ?? ''
        if (last.includes('FAIL_OPENAI') || sys.includes('FAIL_OPENAI')) throw new Error('429 Rate limit reached')
        let content
        if (sys.startsWith('Summarise a phone call')) {
          const lang = sys.includes('Hindi') ? 'hi' : 'en'
          content = JSON.stringify({ summary: `CallSummary(${lang}): you asked about sugar.`, urgent: last.includes('chest pain') })
          return { choices: [{ message: { content } }] }
        }
        if (req.response_format?.type === 'json_object') {
          if (globalThis.__gptDelay) await new Promise((r) => setTimeout(r, globalThis.__gptDelay))
          if (sys.includes('BADGPT')) throw new Error('500 upstream')
          content = JSON.stringify(sys.includes('NONUMERIC') ? NON_NUMERIC : ANALYSIS)
        } else if (sys.startsWith('Translate')) {
          content = `[translated] ${last}`
        } else {
          const lang = sys.includes('explicitly chosen Hindi') ? 'hi' : sys.includes('ONLY in Marathi') ? 'mr' : 'auto'
          content = `Reply(${lang}): ${last}`
        }
        return { choices: [{ message: { content } }] }
      },
    },
  },
}
