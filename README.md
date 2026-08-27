# 🌾 KRUSHI OS — Smart Agricultural ERP & POS System

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**KRUSHI OS** is a full-stack, enterprise-grade Enterprise Resource Planning (ERP) and Point of Sale (POS) solution custom-built for agricultural retail businesses, Krushi Seva Kendras, seed and fertilizer distributors, and agrochemical dealers across India.

Designed with agricultural domain workflows in mind, KRUSHI OS handles complex batch expiry management, multi-tier GST calculations, farmer credit khata ledgers, purchase inwarding, expense tracking, and thermal/A4 invoice printing with speed and precision.

---

## ✨ Key Features

### 🛒 1. Lightning-Fast POS & Billing
- **Keyboard-Driven POS**: Fast shortcuts (`F2` new bill, `F4` product search, `F8` payment settlement).
- **Barcode Scanner Support**: Instant item lookup via hardware barcode scanners or manual entry.
- **Batch & Expiry Selection**: Automatic First-Expiry-First-Out (FEFO) batch picker to prevent selling expired stock.
- **Split & Multi-Mode Payments**: Accept combinations of Cash, UPI, Card, Net Banking, and Farmer Credit in a single transaction.
- **Live GST & Discount Engine**: Automatic item-level and bill-level calculations with Indian GST (CGST + SGST or IGST) and round-off logic.
- **Idempotent Billing**: Network fault-tolerant transaction submission to prevent duplicate bills.

### 📦 2. Batch & Expiry-Aware Inventory
- **Batch Tracking**: Track every SKU with unique Batch Number, Manufacturing Date, and Expiry Date.
- **Expiry Health Alerts**: Color-coded expiry tracking:
  - 🔴 **Expired** (Past expiry date — sales blocked)
  - 🟠 **Urgent** (< 30 days)
  - 🟡 **Warning** (31 - 90 days)
  - 🟢 **Normal** (> 90 days)
- **Stock Audit & Adjustments**: Record stock adjustments with audit trails for breakage, leaks, damage, and manual corrections.
- **Low Stock Notifications**: Automatic alerts when inventory falls below minimum stock thresholds.

### 👥 3. Farmer Credit & Khata Book (Customer Management)
- **Farmer Profile Management**: Store farmer details, village, mobile, land acreage, and crop patterns.
- **Automated Credit Ledger**: Complete debit/credit ledger tracking every credit sale and partial repayment.
- **Payment Collection**: One-click credit collection with instant receipt generation and balance update.
- **Credit Limit Safeguards**: Configurable credit limits to prevent bad debts during sowing seasons.

### 🏭 4. Supplier & Purchase Management
- **Inward Purchase Entry**: Register incoming supplier invoices, update cost prices, and create new batches automatically.
- **Supplier Khata**: Comprehensive ledger tracking purchases, payments, credit adjustments, and outstanding dues.
- **Supplier Payment Reconciliation**: Support for partial payments and multi-method settlements.

### 🧾 5. Multi-Format Invoice & Thermal Printing
- **A4 Full GST Tax Invoices**: Formatted with company header, GSTIN, HSN summary, and terms & conditions.
- **Thermal Slip Support**: Optimized 80mm and 58mm thermal receipts for rapid counter billing.
- **PDF Generation**: Client and server-side PDF generation via `jsPDF` and `jspdf-autotable`.

### 📊 6. Analytics & Financial Reports
- **Executive Dashboard**: Real-time KPI cards for Daily Sales, Monthly Revenue, Gross Profit, Total Credit, and Low Stock.
- **Interactive Visualizations**: Revenue trends, top-selling categories, and payment breakdown powered by `Recharts`.
- **Exporting Capabilities**: Instant export of sales, customer ledgers, inventory, and supplier reports to Excel (`.xlsx`), CSV, and PDF.

### 🔐 7. Security, RBAC & Audit
- **Role-Based Access Control (RBAC)**: 4 pre-configured roles:
  - **Admin**: Unrestricted access to all modules, settings, and employee permissions.
  - **Manager**: Operations management, reports, inventory adjustments, and purchase entries.
  - **Cashier**: Counter sales, customer creation, and payment collection.
  - **Sales Staff**: Product catalog lookup and customer browsing.
- **Row-Level Security (RLS)**: Database-enforced multi-tenant isolation guaranteeing zero cross-shop data leakage.
- **Tamper-Evident Audit Logs**: Comprehensive logging of critical actions, old/new value diffs, user IDs, and timestamps.

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | [Next.js 16](https://nextjs.org/) | App Router, Server Components & Server Actions |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | Strict typing across client, server, and schema layers |
| **Database & Auth** | [Supabase](https://supabase.com/) | PostgreSQL 15, Supabase Auth (SSR), Storage & RLS |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern utility-first CSS with dark/light mode support |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) | Accessible, unstyled primitives customized for KRUSHI OS |
| **Form & Validation** | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) | Type-safe schema validation on client and server |
| **Charts** | [Recharts](https://recharts.org/) | Interactive, responsive SVG data visualization |
| **Document Export** | [jsPDF](https://github.com/parallax/jsPDF) + [SheetJS](https://sheetjs.com/) | PDF invoice generation and XLSX spreadsheet exports |
| **Icons & Alerts** | [Lucide React](https://lucide.dev/) + [Sonner](https://sonner.emilkowal.ski/) | Clean icon set and toast notification system |

---

## 📸 Screenshots & UI Preview

```
+-----------------------------------------------------------------------------------------+
|  🌾 KRUSHI OS  |  [Dashboard] [Billing (F2)] [Products] [Inventory] [Khata] [Reports]   |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [ Today's Sales: ₹48,250 ]   [ Gross Profit: ₹9,650 ]   [ Outstanding: ₹1,24,000 ]     |
|                                                                                         |
|  +---------------------------------------+  +----------------------------------------+  |
|  | 🛒 POS Counter                        |  | 📦 Batch Expiry Radar                  |  |
|  | Confidor 100ml x 2  ... ₹1,100        |  | Confidor (B-1001) - Exp: 12 days 🔴    |  |
|  | DAP Fertilizer 50kg ... ₹1,400        |  | Glyphosate (B-2004) - Exp: 45 days 🟡  |  |
|  | Subtotal: ₹2,500 | GST: ₹280          |  | DAP 50kg (B-1002) - Normal 🟢          |  |
|  | Total: ₹2,780  [ F8 - Settle & Print ]|  |                                        |  |
|  +---------------------------------------+  +----------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 📋 Prerequisites

Before setting up KRUSHI OS, ensure you have the following installed on your machine:

- **Node.js**: `v18.17.0` or higher (Node.js 20+ recommended)
- **npm** (v9+), **pnpm** (v8+), or **yarn**
- **Git**
- A free **[Supabase](https://supabase.com/)** account for hosting PostgreSQL database, Authentication, and Storage.

---

## 🚀 Step-by-Step Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/krushi-os.git
cd krushi-os
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env.local
```
Open `.env.local` and populate your Supabase project credentials (obtainable from Supabase Dashboard > Project Settings > API):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Run Database Migrations
Execute the SQL migration scripts in order in the **Supabase SQL Editor** (or via Supabase CLI):

1. `supabase/migrations/001_initial_schema.sql` — Creates 24 tables, triggers, and indexes.
2. `supabase/migrations/002_rls_policies.sql` — Enables multi-tenant Row Level Security.
3. `supabase/migrations/003_functions.sql` — Creates invoice number generator & expiry helper routines.

### 5. Seed Demo Data
Run the sample data script in the Supabase SQL Editor:
```sql
-- Paste and execute contents of:
supabase/seed.sql
```
*This populates initial categories (Seeds, Fertilizers, Insecticides, etc.), top agro brands (Bayer, Syngenta, IFFCO), demo products, batches, suppliers, and customer profiles.*

### 6. Start the Development Server
```bash
npm run dev
```

### 7. Launch KRUSHI OS
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🔑 Environment Variables Reference

| Variable Name | Required | Client/Server | Description |
| :--- | :---: | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Both | Supabase Project URL (e.g. `https://abc.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Both | Supabase Anonymous Key (safe for browser client) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Server-Only | Supabase Admin Service Role Key (bypasses RLS for system tasks) |

> ⚠️ **Important**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to client components or public GitHub repositories.

---

## 📁 Project Structure

```
krushi-os/
├── actions/                  # Next.js Server Actions (Auth, RBAC, Validation & Services)
│   ├── customers.ts          # Farmer ledger and profile actions
│   ├── employees.ts          # Staff and role management actions
│   ├── expenses.ts           # Store expense tracking actions
│   ├── inventory.ts          # Batch and stock adjustment actions
│   ├── notifications.ts      # Expiry and stock notification actions
│   ├── products.ts           # SKU, brand, and category actions
│   ├── purchases.ts          # Inward stock purchase actions
│   ├── reports.ts            # Sales, financial, and inventory analytics actions
│   ├── sales.ts              # POS checkout, return, and cancellation actions
│   ├── settings.ts           # Shop profile and print layout actions
│   ├── suppliers.ts          # Supplier ledger and profile actions
│   └── types.ts              # Action result envelope types
├── app/                      # Next.js 16 App Router pages & layouts
│   ├── (auth)/               # Authentication route group (login, register, forgot-password)
│   ├── (dashboard)/          # Authenticated application route group
│   │   ├── audit/            # Audit trail viewer
│   │   ├── billing/          # High-speed POS Billing terminal
│   │   ├── categories/       # Category management
│   │   ├── credit/           # Farmer Khata book overview
│   │   ├── customers/        # Customer directory & individual ledger ([id])
│   │   ├── dashboard/        # Executive KPI overview
│   │   ├── employees/        # Staff & permission management
│   │   ├── expenses/         # Store expense registry
│   │   ├── inventory/        # Stock, batch & expiry control
│   │   ├── notifications/    # System alerts
│   │   ├── payments/         # Cash & UPI transactions ledger
│   │   ├── products/         # Product catalog & CRUD ([id], new, edit)
│   │   ├── purchases/        # Purchase entry ([id], new)
│   │   ├── reports/          # Analytics and export reports
│   │   ├── sales/            # Sales history and bill viewer ([id])
│   │   ├── settings/         # Store configuration & GST setup
│   │   └── suppliers/        # Supplier directory & ledger ([id])
│   ├── api/                  # API Route Handlers
│   │   └── print/invoice/[id]# PDF & Thermal slip rendering endpoint
│   ├── globals.css           # Tailwind CSS theme definitions & custom styles
│   └── layout.tsx            # Root layout wrapper
├── components/               # Reusable UI Components
│   ├── billing/              # POS cart, payment modal, product search bar
│   ├── customers/            # Customer tables, forms, payment collection dialogs
│   ├── dashboard/            # Metric cards, sales charts, expiry tables
│   ├── employees/            # Employee dialogs, role selector
│   ├── expenses/             # Expense modal and category filter
│   ├── inventory/            # Batch table, adjustment modal, expiry badge
│   ├── layout/               # Header, Sidebar, User navigation, Theme toggle
│   ├── notifications/        # Notification bell and dropdown list
│   ├── print/                # Printable A4 and 80mm invoice templates
│   ├── products/             # Product form, SKU card, category picker
│   ├── purchases/            # Purchase inward table, item entry grid
│   ├── reports/              # Date-range picker, report tables, chart components
│   ├── suppliers/            # Supplier table, payment dialog
│   └── ui/                   # shadcn/ui components (Button, Dialog, Select, etc.)
├── hooks/                    # Custom React hooks (use-debounce, etc.)
├── lib/                      # Core utilities and business helpers
│   ├── calculations.ts       # GST, margin, profit, and round-off math
│   ├── constants.ts          # Units, categories, shortcuts, and thresholds
│   ├── export.ts             # CSV and Excel export generators
│   ├── invoice.ts            # Client-side jsPDF invoice generator
│   ├── permissions.ts        # RBAC definitions and permission checks
│   ├── supabase/             # Supabase client instances (client, server, middleware)
│   ├── utils.ts              # CSS clsx/tailwind-merge helper
│   └── validations.ts        # Zod validation schemas for all entities
├── services/                 # Database abstraction service layer
│   ├── customers.service.ts
│   ├── dashboard.service.ts
│   ├── inventory.service.ts
│   ├── payments.service.ts
│   ├── products.service.ts
│   ├── purchases.service.ts
│   ├── sales.service.ts
│   └── suppliers.service.ts
├── supabase/                 # PostgreSQL migrations and seed data
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_functions.sql
│   └── seed.sql
└── types/                    # TypeScript interfaces and database types
```

---

## 🏗️ Production Build & Verification

To verify type safety and produce an optimized production bundle:

```bash
# Check TypeScript types & compile
npm run build

# Run local production server
npm run start
```

---

## ☁️ Deployment on Vercel

1. Push your code to a GitHub repository.
2. Log into [Vercel](https://vercel.com/) and click **New Project**.
3. Import your `krushi-os` repository.
4. Add the Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Deploy**. Vercel will build and deploy the application globally with automatic edge SSL.

---

## 📖 Extended Documentation

- 🏛️ [System Architecture](docs/architecture.md) — Comprehensive technical architecture, data flows, and design decisions.
- 🗄️ [Database Reference](docs/database.md) — Complete 24+ table dictionary, ER diagrams, indexes, and RLS policies.
- ⚙️ [Setup & Deployment Guide](docs/setup.md) — Detailed Supabase configuration, storage bucket setup, and troubleshooting.
- 🔌 [API & Server Actions Reference](docs/api.md) — Full parameter specifications, validation rules, and RBAC matrix.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
