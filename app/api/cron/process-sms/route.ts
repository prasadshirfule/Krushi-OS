import { NextResponse } from 'next/server';
import { processPendingSmsQueue } from '@/services/sms.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30s max duration for cron worker

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET?.trim();

    // Verify Vercel Cron authorization if secret configured
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }

    const result = await processPendingSmsQueue(25);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error('[Cron/ProcessSms] Error executing SMS worker:', error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process queue' },
      { status: 500 }
    );
  }
}
