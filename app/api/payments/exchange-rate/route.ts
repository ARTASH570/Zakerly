import { NextResponse } from 'next/server'
import { egpToUsdCents } from '@/features/payments/lib/currency'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const amountEgp = Number(searchParams.get('amount'))

    if (!amountEgp || amountEgp <= 0 || Number.isNaN(amountEgp)) {
      return NextResponse.json({ error: 'قيمة غير صحيحة' }, { status: 400 })
    }

    const cents = await egpToUsdCents(amountEgp)
    const usd = Math.round((cents / 100) * 100) / 100

    return NextResponse.json({ usd })
  } catch (err) {
    console.error('Exchange rate display error:', err)
    return NextResponse.json({ error: 'حصل خطأ' }, { status: 500 })
  }
}