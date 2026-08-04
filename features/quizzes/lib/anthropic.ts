// دالة مساعدة لتوليد أسئلة كويز بالـ AI من محتوى الدرس، باستخدام Claude API
// التوثيق: https://docs.claude.com/en/api/messages
//
// ⚠️ لازم تحط ANTHROPIC_API_KEY في .env.local عشان الميزة دي تشتغل
// (هتلاقي مفتاحك من https://console.anthropic.com/settings/keys)

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-5'

export interface AiGeneratedOption {
  text: string
  isCorrect: boolean
}

export interface AiGeneratedQuestion {
  questionText: string
  questionType: 'mcq' | 'true_false'
  options: AiGeneratedOption[]
}

/**
 * بياخد محتوى/ملخص الدرس وبيرجع أسئلة مقترحة (مش محفوظة في الداتابيز لسه -
 * المعلم لازم يراجعها ويحفظها بنفسه عن طريق endpoint تاني)
 */
export async function generateQuizQuestions(
  lessonContent: string,
  count: number
): Promise<AiGeneratedQuestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY مش متظبط في متغيرات البيئة')
  }

  const prompt = `أنت معلم بتحضّر كويز مراجعة لطلاب في مصر. اقرا محتوى الدرس ده وكوّن ${count} سؤال مراجعة بالظبط.

قواعد مهمة:
- الأسئلة لازم تكون بالعربي الفصحى المبسطة، واضحة ومباشرة، بتقيس فهم الطالب للمحتوى مش تفاصيل تافهة
- كل سؤال إما "اختيار من متعدد" (mcq) بأربع اختيارات، اختيار واحد صح بس، أو "صح وغلط" (true_false) باختيارين بس
- نوّع بين النوعين لو عدد الأسئلة أكتر من 3
- الاختيارات الغلط لازم تكون منطقية ومقنعة، مش سخيفة بشكل واضح
- رجّع JSON فقط بدون أي نص تاني قبله أو بعده، وبدون Markdown code fences

محتوى الدرس:
"""
${lessonContent.slice(0, 6000)}
"""

رجّع الأسئلة بالشكل ده بالظبط (array من ${count} عنصر):
[
  {
    "questionText": "نص السؤال",
    "questionType": "mcq",
    "options": [
      { "text": "اختيار 1", "isCorrect": false },
      { "text": "اختيار 2", "isCorrect": true },
      { "text": "اختيار 3", "isCorrect": false },
      { "text": "اختيار 4", "isCorrect": false }
    ]
  }
]`

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`فشل الاتصال بـ Claude API: ${errText}`)
  }

  const data = await response.json()
  const textBlock = (data.content || []).find((b: { type: string }) => b.type === 'text')
  if (!textBlock?.text) {
    throw new Error('رد غير متوقع من Claude API')
  }

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('تعذر تحليل الأسئلة اللي رجعت من الـ AI، جرب تاني')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('شكل الرد من الـ AI غير متوقع')
  }

  // تحقق بسيط من الشكل قبل ما نرجعه، عشان مانرجعش بيانات فاسدة للواجهة
  return (parsed as AiGeneratedQuestion[]).filter(
    (q) =>
      q &&
      typeof q.questionText === 'string' &&
      (q.questionType === 'mcq' || q.questionType === 'true_false') &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      q.options.some((o) => o.isCorrect)
  )
}
