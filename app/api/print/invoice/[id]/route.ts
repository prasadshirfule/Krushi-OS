import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSaleById } from '@/services/sales.service'
import { generateInvoicePDF } from '@/lib/invoice'
import { getAuthAndPermissions } from '@/lib/auth-helper'
import { getShopProfile } from '@/services/settings.service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    
    const user = await getAuthAndPermissions()
    const shopId = user.shop_id

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    const sale = await getSaleById(shopId, id)
    
    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    const shopProfile = await getShopProfile(shopId)
    const settings = {
      shop_name: shopProfile.shopName || 'KRUSHI OS Store',
      shop_address: `${shopProfile.address || ''} ${shopProfile.district || ''} ${shopProfile.state || ''} ${shopProfile.pincode || ''}`.trim(),
      shop_phone: shopProfile.contact1 || shopProfile.contact2 || '',
      shop_email: shopProfile.email || '',
      gstin: shopProfile.gstNumber || '',
      fssai: shopProfile.registrationNumber || '',
      license: shopProfile.licenseNumber || '',
      terms: shopProfile.invoiceTerms || '',
      bank_name: shopProfile.bankName || '',
      account_number: shopProfile.accountNumber || '',
      ifsc: shopProfile.ifsc || '',
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
