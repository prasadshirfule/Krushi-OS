import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'disconnected';
  let dbLatencyMs = 0;

  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = createServerAdminClient() || supabase;

    const dbStart = Date.now();
    const { error } = await adminClient
      .from('shops')
      .select('id')
      .limit(1);

    dbLatencyMs = Date.now() - dbStart;

    if (!error) {
      dbStatus = 'connected';
    } else {
      console.warn('[HealthCheck] DB probe warning:', error.message);
      dbStatus = 'degraded';
    }
  } catch (err: any) {
    console.error('[HealthCheck] DB probe failed:', err?.message);
    dbStatus = 'error';
  }

  const isHealthy = dbStatus === 'connected' || dbStatus === 'degraded';
  const totalLatencyMs = Date.now() - startTime;

  const payload = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      web: {
        status: 'online',
        latencyMs: totalLatencyMs,
      },
    },
    environment: process.env.NODE_ENV || 'production',
  };

  return NextResponse.json(payload, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
