import crypto from 'crypto'

const BUNNY_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID!
const BUNNY_API_KEY = process.env.BUNNY_STREAM_API_KEY! // مفتاح الـ API بتاع المكتبة (Library API Key)
const BUNNY_TOKEN_SECURITY_KEY = process.env.BUNNY_STREAM_TOKEN_KEY! // مفتاح التوثيق من تبويب Security

/**
 * الخطوة 1: بننشئ "كائن فيديو" فاضي على Bunny (لسه من غير محتوى)
 * وده بيرجعلنا الـ GUID بتاعه اللي هنستخدمه بعدين في كل حاجة
 */
export async function createBunnyVideo(title: string) {
  const response = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`, {
    method: 'POST',
    headers: {
      AccessKey: BUNNY_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })

  if (!response.ok) {
    throw new Error(`فشل إنشاء الفيديو على Bunny: ${await response.text()}`)
  }

  const data = await response.json()
  return data.guid as string
}

/**
 * الخطوة 2: بنجهز "توقيع" (signature) عشان المعلم يقدر يرفع الفيديو مباشرة
 * من المتصفح بتاعه لـ Bunny من غير ما نمرر ملف الفيديو على السيرفر بتاعنا
 * (ده بيوفر وقت وموارد كتير، خصوصًا للفيديوهات الكبيرة)
 */
export function generateTusUploadCredentials(videoId: string) {
  const expirationTime = Math.floor(Date.now() / 1000) + 3600 // ساعة كفاية للرفع

  const signature = crypto
    .createHash('sha256')
    .update(`${BUNNY_LIBRARY_ID}${BUNNY_API_KEY}${expirationTime}${videoId}`)
    .digest('hex')

  return {
    libraryId: BUNNY_LIBRARY_ID,
    videoId,
    expirationTime,
    signature,
  }
}

/**
 * بتنشئ رابط مشاهدة "موقّع" وصالح لمدة قصيرة بس (مثلاً ساعتين)
 * أي حد يحاول يفتح الرابط ده بعد ما ينتهي أو بدون التوكيع الصحيح، هياخد خطأ
 * ده اللي بيمنع مشاركة اللينك أو الوصول للفيديو من غير ما يمر عبر السيستم بتاعنا
 */
export function generateSecureEmbedUrl(videoId: string, expiresInSeconds = 7200) {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds

  const token = crypto
    .createHash('sha256')
    .update(`${BUNNY_TOKEN_SECURITY_KEY}${videoId}${expires}`)
    .digest('hex')

  return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}?token=${token}&expires=${expires}`
}
