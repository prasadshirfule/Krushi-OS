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
