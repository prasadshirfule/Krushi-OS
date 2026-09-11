# 🗺️ KRUSHI OS — Project Roadmap

> High-level tracking of system milestones and delivery phases.

---

### Phase 1: Core ERP & Multi-Tenant Foundations (COMPLETED ✅)
- Multi-tenant authentication, role-based access control (Admin, Cashier, Stock Manager).
- Product catalog, categories, supplier management, and batch inventory tracking.
- Counter POS billing with discount, tax, payment modes (Cash, UPI, Credit), and thermal printing.
- Customer ledger (Khata), credit transactions, and debt recovery history.
- Core reporting suite: daily sales, profit/loss estimates, GST summaries, inventory valuation.

### Phase 2: Sales Returns & Customer Portal (COMPLETED ✅)
- Migration 011 & 015: Database schema, atomic RPCs, and RLS policies for Sales Returns.
- Server actions, validation rules, and UI for bill cancellation and partial item returns.
- Customer self-service portal: multi-shop purchase history, bill detail views, and invoice downloads.
- Dual authentication flow (Admin/Employee staff vs. Customer portal users).

### Phase 3: Mobile Native Shell & Counter Optimizations (IN PROGRESS 🟡)
- [x] Capacitor 8.5+ native Android wrapper targeting SDK 36.
- [x] Mobile navigation bar and responsive touch UI refinements.
- [ ] Offline-first counter billing data store and queue architecture ([src/lib/offline-db.ts](file:///e:/antigravity/scratch/krushi-os/src/lib/offline-db.ts)).
- [ ] Bluetooth ESC/POS thermal printer hardware bridge for Android terminals.

### Phase 4: Enterprise Operations & Offline Synchronization (PLANNED 🔵)
- Bi-directional sync protocol between IndexedDB local cache and Supabase backend.
- Multi-branch inventory transfer and central analytics dashboard.
- Automated SMS/WhatsApp invoice delivery integration.
- Scheduled stock audit reconciliation workflows.
