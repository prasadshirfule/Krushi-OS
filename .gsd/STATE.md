# 📍 KRUSHI OS — Current Project State

> **Active Context Anchor**: Read this file first to understand the current project state without recursive directory scanning.

---

## 1. Project Overview & Status
- **Application**: KRUSHI OS — Multi-tenant Agricultural Retail ERP & Point of Sale (POS) Platform.
- **Stack**: Next.js 16.3.3 (App Router, Turbopack, Server Actions), React 19.2.8, TypeScript 5, Tailwind CSS v4, Supabase (PostgreSQL 15, RLS, Auth, Storage), Capacitor 8.5.1 (Android SDK 36).
- **Status**: Stable core operations with ongoing mobile/offline and returns workflow enhancements. All 38 routes compiling cleanly with zero TypeScript errors.

## 2. Implemented Capabilities
- **POS & Counter Billing**: Fast product search, barcode scanning, batch/expiry selection, multi-payment options, thermal receipt formatting, and PDF invoice generation.
- **Inventory & Batch Management**: Category organization, purchase tracking, batch-level stock counting, expiry warnings, low-stock alerts.
- **Credit & Customer Ledger**: Customer profiles, khata balances, repayment tracking, customer statements.
- **Customer Portal**: Multi-shop purchase history, bill detail views, PDF downloads, and email/password customer authentication.
- **Sales Return & Cancellation**: Full return workflows with inventory replenishment, credit reversal, atomic Supabase RPCs, and document status tracking (Migrations 011 & 015).
- **Mobile Native Shell**: Capacitor Android wrapper targeting Android 14/15 (SDK 36) pointing to production server URL.

## 3. Recent Milestones & Work in Progress
- **Recent**:
  - `feature/production-readiness`: Complete Production Readiness, Security Hardening & SaaS Preparation:
    1. Complete OpenWA & WhatsApp removal across client/server/dependencies in favor of Indian DLT transactional SMS.
    2. Provider-independent SMS architecture (`lib/sms/`), MSG91 adapter, and persistent Supabase notification queue (`supabase/migrations/022_sms_notifications_queue.sql`).
    3. Combined Tax Invoice + Customer Ledger Statement generator (`lib/statement-generator.ts`) with cryptographic token viewer (`/docs/v/[token]`).
    4. Multi-tier SaaS subscription plans, 14-day auto trial, 15-day grace period, read-only mode, and zero data deletion on expiry (`supabase/migrations/023_saas_subscriptions.sql`, `services/subscription.service.ts`).
    5. OWASP ASVS & Top 10 security headers (CSP, HSTS, X-Frame-Options: DENY), in-memory API rate limiter (`lib/security/rate-limiter.ts`), and RBAC matrix hardening (`lib/permissions.ts`).
    6. Full statutory Indian legal pages compliant with DPDP Act 2023, IT Act 2000, and TRAI DLT (`/privacy`, `/terms`, `/refund-policy`, `/billing-policy`, `/cookie-policy`, `/data-processing`, `/acceptable-use`, `/grievance`, `/data-request`).
    7. Public marketing & SEO pages (`/features`, `/pricing`, `/about`, `/contact`, `/support`), `robots.ts` with strict disallow on private ERP routes, and `sitemap.ts`.
    8. Production health probe (`/api/health`), structured JSON logging (`lib/logging/logger.ts`), and disaster recovery runbook (`docs/disaster-recovery.md`).
    9. Automated test suites covering SMS queue, combined statements, tenant isolation, RBAC permissions, subscription lifecycle, and compliance pages (12/12 suites passing).
    10. Critical Audit Remediation & Hardening:
        - Financial Statement Double-Counting Elimination: Deduplicated opening balance adjustment entries in `lib/statement-generator.ts` and `app/docs/v/[token]/route.ts`. Added cash-only single-page invoice bypass and 500-entry statement fetch.
        - MSG91 Flow API v5 Specification: Restructured payload to strict `recipients: [{ mobiles, ...variables }]` array format.
        - SMS Queue Immediate Dispatch & Cron Worker: Implemented `dispatchQueuedSms`, 5-minute orphan worker recovery, `app/api/cron/process-sms/route.ts` secured with `CRON_SECRET`, and `vercel.json` cron config.
        - SaaS Subscription Gating: Added `ENABLE_SUBSCRIPTION_ENFORCEMENT` flag (disabled by default) and hooked usage increment tracking to sales and SMS engines.
        - Distributed Rate Limiting: Enhanced `lib/security/rate-limiter.ts` with Upstash Redis HTTP REST support and memory fallback; wired to `/docs/v/[token]`.
        - Security & Migrations: Created `supabase/migrations/024_subscription_backfill_and_fixes.sql` adding `document_access_logs` INSERT policy and backfill for existing shops.
        - UI: Built `components/sales/sms-delivery-card.tsx` with resend trigger in `sale-detail-view.tsx`.
        - All 18 automated test suites passing (18/18). Zero TypeScript errors. Zero ESLint errors.
  - `ed05abb`: Implement sale cancellation and return UI in [components/sales/sale-detail-view.tsx](file:///e:/antigravity/scratch/krushi-os/components/sales/sale-detail-view.tsx) and [actions/sales.ts](file:///e:/antigravity/scratch/krushi-os/actions/sales.ts).
  - Migration 015: Customer portal returns RLS security rules.
  - Implemented 6-Issue Core Fixes:
    1. Auth Separation: Portal-bound DB authorization check (`verifyPortalAuthorizationAction`) preventing cross-portal leakage with server route guards in middleware.
    2. Shopkeeper Dashboard: "Today's Bills" count card, clickable metric cards to `/sales` and `/customers`, legible X/Y axes with zero profit leaks in sales chart.
    3. Product Price Validation: Strict `min(0.01)` positive selling price schema, non-submitting subtle placeholder `e.g. 450.00`.
    4. Billing Cart Deduplication: Same product + same batch increments quantity; different batches remain separate lines.
    5. Sales History Export: Download PDF and Print buttons in toolbar respecting active filters via `lib/report-export.ts`.
    6. Dynamic Invoice PDF: Dynamic text wrapping (`splitTextToSize`) and dynamic coordinate calculations preventing layout overflow on multi-item/long customer data.
- **In Progress / Queued**:
  - Offline sync engine initialization ([src/lib/offline-db.ts](file:///e:/antigravity/scratch/krushi-os/src/lib/offline-db.ts)).
  - Thermal printer hardware bridge testing for mobile devices.

## 4. Key Architectural Constraints & Rules
- **Multi-Tenancy**: Every database query and mutation MUST filter by `shop_id`. Never query tenant tables without a valid active shop context.
- **Financial & Inventory Integrity**: Stock deductions, refunds, and ledger entries MUST occur inside atomic database transactions/RPCs.
- **Layer Separation**: Follow RSC / Server Action &rarr; Service Layer (`services/*.service.ts`) &rarr; Supabase SSR pattern. Do not write direct SQL inside client components.

## 5. Authoritative Technical Documentation
For complete technical schemas and system design, refer directly to:
- [docs/architecture.md](file:///e:/antigravity/scratch/krushi-os/docs/architecture.md) — System architecture, auth boundaries, layer design.
- [docs/database.md](file:///e:/antigravity/scratch/krushi-os/docs/database.md) — Schema tables, foreign keys, RLS policies, RPC definitions.
- [docs/api.md](file:///e:/antigravity/scratch/krushi-os/docs/api.md) — Server action contracts, validation schemas, API routes.
- [docs/setup.md](file:///e:/antigravity/scratch/krushi-os/docs/setup.md) — Local environment setup and build instructions.
