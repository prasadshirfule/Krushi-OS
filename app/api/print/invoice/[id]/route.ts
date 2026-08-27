import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSaleById } from '@/services/sales.service'
import { generateInvoicePDF } from '@/lib/invoice'
import { cookies } from 'next/headers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    const cookieStore = await cookies()
    const isDemo = cookieStore.get('krushi_demo_session')?.value === 'true'
    const isPlaceholder = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')

    let shopId = 'demo-shop-1'

    if (!isPlaceholder && user) {
      const { data: userData } = await supabase
        .from('users')
        .select('shop_id')
        .eq('id', user.id)
        .single()
      if (userData?.shop_id) shopId = userData.shop_id
    } else if (!isDemo && !isPlaceholder && !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    const sale = await getSaleById(shopId, id)
    
    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    const settings = {
      shop_name: 'KRUSHI OS SEVA KENDRA',
      shop_address: 'Main Market Road, Near Mandi Yard, Sehore, MP',
      shop_phone: '9876543210',
      gstin: '23AAACK1234F1Z9'
    }

    if (format === 'pdf') {
      const doc = generateInvoicePDF(sale as any, settings)
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Invoice-${sale.invoice_number || sale.id}.pdf"`,
        },
      })
    }

    return NextResponse.json({ sale, settings })
  } catch (error) {
    console.error('Error generating print/pdf:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
