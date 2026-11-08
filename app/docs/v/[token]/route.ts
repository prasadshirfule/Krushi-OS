import { NextResponse } from 'next/server';
import { validateDocumentAccessToken } from '@/lib/documents/token-service';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/admin';
import { generateCombinedInvoiceStatementPDF } from '@/lib/statement-generator';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return new NextResponse('Invalid document token', { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // 1. Validate token with cryptographic SHA-256 hash lookup and audit logging
    const tokenRecord = await validateDocumentAccessToken(token, { ip, userAgent });

    if (!tokenRecord) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
          <title>KRUSHI OS — Document Link Expired</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
            .card { background: #18181b; border: 1px solid #27272a; border-radius: 1rem; max-width: 440px; width: 100%; padding: 2rem; text-align: center; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
            p { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; margin-bottom: 1.5rem; }
            .badge { display: inline-block; background: #ef444420; color: #f87171; border: 1px solid #ef444440; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">🌾</div>
            <div class="badge">LINK EXPIRED OR INVALID</div>
            <h1>Document Not Accessible</h1>
            <p>This invoice statement link has expired (valid for 30 days) or has been revoked for security. Kindly contact your Krushi Kendra to request an updated account statement.</p>
          </div>
        </body>
        </html>`,
        {
          status: 410,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      );
    }

    // 2. Fetch sale, shop, and customer ledger records
    const supabase = await createServerSupabaseClient();
    const adminClient = createServerAdminClient() || supabase;

    // Fetch sale record
    const { data: sale, error: saleErr } = await adminClient
      .from('sales')
      .select('*, sale_items(*), customer:customers(*)')
      .eq('id', tokenRecord.sale_id)
      .eq('shop_id', tokenRecord.shop_id)
      .single();

    if (saleErr || !sale) {
      return new NextResponse('Sale record not found', { status: 404 });
    }

    // Fetch shop profile
    const { data: shop } = await adminClient
      .from('shops')
      .select('*')
      .eq('id', tokenRecord.shop_id)
      .single();

    // Fetch customer ledger entries if customer exists
    let ledgerEntries: any[] = [];
    const customerId = sale.customer_id || sale.customer?.id;

    if (customerId) {
      const { data: entries } = await adminClient
        .from('customer_ledger')
        .select('*')
        .eq('customer_id', customerId)
        .eq('shop_id', tokenRecord.shop_id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (entries) {
        ledgerEntries = entries;
      }
    }

    const shopSettings = {
      shop_name: shop?.name || 'KRUSHI OS Store',
      shop_address: shop?.address || '',
      shop_phone: shop?.phone || '',
      shop_email: shop?.email || '',
      gstin: shop?.gstin || '',
      fssai: shop?.fssai || '',
      license: shop?.fertilizer_license || shop?.pesticide_license || '',
      terms: shop?.terms_and_conditions || '',
      bank_name: shop?.bank_name || '',
      account_number: shop?.bank_account_number || '',
      ifsc: shop?.bank_ifsc || '',
    };

    const statementData = {
      customer: {
        id: customerId,
        name: sale.customer?.name || sale.customer_name || 'Farmer',
        phone: sale.customer?.phone || sale.customer_phone,
        village: sale.customer?.village || sale.customer?.address,
        opening_balance: sale.customer?.opening_balance || 0,
        current_balance: sale.customer?.current_balance || 0,
      },
      ledgerEntries,
      statementDate: new Date(),
    };

    // 3. Generate combined PDF: Page 1 = Canonical Invoice, Page 2+ = Customer Statement
    const doc = generateCombinedInvoiceStatementPDF(sale, shopSettings, statementData);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const invNo = sale.invoice_number || sale.id.substring(0, 8);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Bill-Statement-${invNo}.pdf"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[Document Viewer] Error serving document:', error?.message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
