import { z } from 'zod'

// بنستخدمها في أول أي API route عشان نتأكد إن الشكل والقيم المتوقعة صح
// قبل ما نعمل أي استعلام لقاعدة البيانات أو نكلم بوابة دفع

export const createPaymentSchema = z.object({
  courseId: z.string().uuid({ message: 'رقم الكورس غير صحيح' }),
  couponCode: z.string().trim().min(1).max(50).optional(),
})

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/, { message: 'الكود يتكون من حروف وأرقام إنجليزية بس' }),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.coerce.number().positive(),
    courseId: z.string().uuid().nullable().optional(),
    minPrice: z.coerce.number().min(0).nullable().optional(),
    usageLimit: z.coerce.number().int().positive().nullable().optional(),
    oneTimePerStudent: z.boolean().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .refine((data) => data.discountType !== 'percentage' || data.discountValue <= 100, {
    message: 'نسبة الخصم مينفعش تكون أكتر من 100%',
    path: ['discountValue'],
  })

export const createVideoSchema = z.object({
  courseId: z.string().uuid({ message: 'رقم الكورس غير صحيح' }),
  sectionId: z.string().uuid({ message: 'رقم القسم غير صحيح' }),
  title: z
    .string()
    .trim()
    .min(2, { message: 'اسم الفيديو قصير جدًا' })
    .max(200, { message: 'اسم الفيديو طويل جدًا' }),
})

export const createSectionSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(1).max(150),
})

export const reorderSectionsSchema = z.object({
  courseId: z.string().uuid(),
  orderedSectionIds: z.array(z.string().uuid()).min(1),
})

export const reorderVideosSchema = z.object({
  courseId: z.string().uuid(),
  orderedVideoIds: z.array(z.string().uuid()).min(1),
})

export const videoPlaybackSchema = z.object({
  videoId: z.string().uuid({ message: 'رقم الفيديو غير صحيح' }),
})

export const paypalCaptureSchema = z.object({
  orderId: z.string().min(1, { message: 'رقم الطلب مفقود' }),
})

export const createCourseSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().positive().max(100000),
  publishAt: z.string().datetime().optional().nullable(),
  unpublishAt: z.string().datetime().optional().nullable(),
})

export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'الإيميل غير صحيح' }),
  password: z.string().min(8, { message: 'كلمة السر قصيرة جدًا' }),
})

export const registerSchema = z.object({
  email: z.string().trim().email({ message: 'الإيميل غير صحيح' }),
  password: z.string().min(8, { message: 'كلمة السر لازم تكون 8 أحرف على الأقل' }),
  fullName: z.string().trim().min(2).max(100),
  role: z.enum(['teacher', 'student']),
  parentPhone: z.string().trim().min(8).max(20).optional(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: 'الإيميل غير صحيح' }),
})

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, { message: 'كلمة السر لازم تكون 8 أحرف على الأقل' }),
})

export const videoHeartbeatSchema = z.object({
  videoId: z.string().uuid(),
  positionSeconds: z.coerce.number().min(0).max(36000), // 10 ساعات كحد أقصى منطقي
  durationSeconds: z.coerce.number().min(0).max(36000).optional(),
})

export const evaluationSchema = z.object({
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  attendanceStatus: z.enum(['present', 'absent']),
  grade: z.coerce.number().min(0).max(100).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
})

export const createQuizSchema = z.object({
  courseId: z.string().uuid({ message: 'رقم الكورس غير صحيح' }),
  videoId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2, { message: 'عنوان الكويز قصير جدًا' }).max(150),
  description: z.string().trim().max(1000).nullable().optional(),
  timeLimitSeconds: z.coerce.number().int().positive().max(10800).nullable().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(10).optional(),
})

const quizOptionSchema = z.object({
  text: z.string().trim().min(1, { message: 'نص الاختيار مطلوب' }).max(300),
  isCorrect: z.boolean(),
})

const quizQuestionBaseSchema = z.object({
  questionText: z.string().trim().min(2, { message: 'نص السؤال قصير جدًا' }).max(500),
  questionType: z.enum(['mcq', 'true_false']),
  points: z.coerce.number().positive().max(100).optional(),
  options: z.array(quizOptionSchema).min(2).max(6),
})

function exactlyOneCorrect(data: z.infer<typeof quizQuestionBaseSchema>) {
  return data.options.filter((o) => o.isCorrect).length === 1
}

export const createQuizQuestionSchema = quizQuestionBaseSchema.refine(exactlyOneCorrect, {
  message: 'لازم يكون فيه اختيار صح واحد بالظبط',
  path: ['options'],
})

export const bulkCreateQuizQuestionsSchema = z.object({
  questions: z
    .array(quizQuestionBaseSchema.refine(exactlyOneCorrect, { message: 'لازم يكون فيه اختيار صح واحد بالظبط' }))
    .min(1)
    .max(20),
})

export const aiGenerateQuestionsSchema = z.object({
  lessonContent: z.string().trim().min(30, { message: 'محتوى الدرس قصير أوي، ضيف تفاصيل أكتر' }).max(8000),
  count: z.coerce.number().int().min(1).max(10),
})

export const startQuizAttemptSchema = z.object({
  quizId: z.string().uuid(),
})

export const submitQuizAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selectedOptionId: z.string().uuid().nullable(),
      })
    )
    .min(1),
})

export const promoteAdminSchema = z.object({
  email: z.string().trim().email({ message: 'الإيميل مش صحيح' }),
  fullName: z.string().trim().min(2).max(150).optional(),
})

export const updatePackageSchema = z.object({
  name: z.string().trim().min(2, { message: 'اسم الباقة قصير جدًا' }).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  price: z.coerce.number().min(0, { message: 'السعر مينفعش يكون بالسالب' }).max(1_000_000).optional(),
  // null صراحةً يعني "بلا حد" - لازم نفرّق بينه وبين undefined (يعني الحقل مش متبعت أصلًا)
  maxCourses: z.coerce.number().int().positive().nullable().optional(),
  maxStudents: z.coerce.number().int().positive().nullable().optional(),
  liveSessions: z.boolean().optional(),
  couponsEnabled: z.boolean().optional(),
  prioritySupport: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const subscribePackageSchema = z.object({
  packageId: z.string().uuid({ message: 'رقم الباقة غير صحيح' }),
})

export const toggleMaintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().min(1).max(500).nullable().optional(),
})

/**
 * دالة مساعدة بتاخد أي schema وبيانات، وبترجع إما البيانات نضيفة ومتحقق منها،
 * أو رسالة خطأ واضحة بالعربي جاهزة تترجع للمستخدم
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.errors[0]?.message || 'بيانات غير صحيحة'
    return { success: false, error: firstError }
  }
  return { success: true, data: result.data }
}
