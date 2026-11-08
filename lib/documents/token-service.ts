import crypto from 'node:crypto';
import { createServerSupabaseClient } from '../supabase/server';
import { createServerAdminClient } from '../supabase/admin';

export interface DocumentTokenPayload {
  shopId: string;
  saleId: string;
  customerId?: string | null;
  documentType?: 'INVOICE_STATEMENT' | 'INVOICE_ONLY' | 'STATEMENT_ONLY';
  expiresInDays?: number;
  metadata?: Record<string, any>;
}

export interface GeneratedDocumentToken {
  token: string;
  url: string;
  expiresAt: Date;
  tokenId: string;
}

export interface ValidatedDocumentToken {
  id: string;
  shop_id: string;
  sale_id: string;
  customer_id?: string | null;
  document_type: string;
  metadata: Record<string, any>;
  expires_at: string;
  revoked_at?: string | null;
}

/**
 * Computes the SHA-256 hash of a raw document access token.
 */
export function hashDocumentToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Creates a cryptographically random access token for a sale/invoice statement.
 * Stores the SHA-256 hash in database with an expiration date.
 */
export async function createDocumentAccessToken(
  payload: DocumentTokenPayload
): Promise<GeneratedDocumentToken> {
  const rawToken = crypto.randomBytes(24).toString('base64url');
  const tokenHash = hashDocumentToken(rawToken);

  const expiresInDays = payload.expiresInDays || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const supabase = await createServerSupabaseClient();
  const adminClient = createServerAdminClient() || supabase;

  const { data, error } = await adminClient
    .from('document_access_tokens')
    .insert({
      shop_id: payload.shopId,
      sale_id: payload.saleId,
      customer_id: payload.customerId || null,
      token_hash: tokenHash,
      document_type: payload.documentType || 'INVOICE_STATEMENT',
      metadata: payload.metadata || {},
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[DocumentToken] Failed to create access token:', error?.message);
    throw new Error(`Failed to generate secure document token: ${error?.message || 'Database error'}`);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://krushios.vercel.app';
  const url = `${baseUrl.replace(/\/+$/, '')}/docs/v/${rawToken}`;

  return {
    token: rawToken,
    url,
    expiresAt,
    tokenId: data.id,
  };
}

/**
 * Validates a raw document access token and records an audit log entry.
 * Returns the token record if valid, or null if invalid, expired, or revoked.
 */
export async function validateDocumentAccessToken(
  rawToken: string,
  auditContext?: { ip?: string; userAgent?: string }
): Promise<ValidatedDocumentToken | null> {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenHash = hashDocumentToken(rawToken);
  const supabase = await createServerSupabaseClient();
  const adminClient = createServerAdminClient() || supabase;

  const { data: record, error } = await adminClient
    .from('document_access_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !record) {
    return null;
  }

  // Check revocation
  if (record.revoked_at) {
    return null;
  }

  // Check expiry
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    return null;
  }

  // Record access audit log & increment access count asynchronously
  try {
    await adminClient
      .from('document_access_tokens')
      .update({
        access_count: (record.access_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    if (auditContext) {
      await adminClient.from('document_access_logs').insert({
        token_id: record.id,
        ip_address: auditContext.ip || null,
        user_agent: auditContext.userAgent || null,
      });
    }
  } catch (logErr) {
    console.warn('[DocumentToken] Failed to record access log:', logErr);
  }

  return record as ValidatedDocumentToken;
}

/**
 * Revokes a document access token (e.g., if a sale is cancelled or upon request).
 */
export async function revokeDocumentAccessToken(
  saleId: string,
  shopId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const adminClient = createServerAdminClient() || supabase;

  const { error } = await adminClient
    .from('document_access_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('sale_id', saleId)
    .eq('shop_id', shopId);

  return !error;
}
