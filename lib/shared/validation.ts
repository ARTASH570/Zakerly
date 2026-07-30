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
