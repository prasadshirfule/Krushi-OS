# ⚙️ KRUSHI OS — Installation & Deployment Setup Guide

This guide walks you through setting up **KRUSHI OS** from scratch on your local development machine or production environment.

---

## 1. System Requirements

Before starting, ensure your system meets the following specifications:
- **Node.js**: `v18.17.0` or higher (Node.js 20 LTS recommended). Check with `node -v`.
- **npm** (`v9+`), **pnpm** (`v8+`), or **yarn**.
- **Git** installed on your system.
- A **Supabase** account (Free or Pro tier at [supabase.com](https://supabase.com)).

---

## 2. Step-by-Step Setup

### Step 1: Clone Repository & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-username/krushi-os.git
cd krushi-os

# Install required node modules
npm install
```

---

### Step 2: Create a Supabase Project

1. Log into your account at [database.new](https://database.new) to create a new project.
2. Fill in the project details:
   - **Project Name**: `krushi-os-prod` (or any preferred name)
   - **Database Password**: Generate a strong password and store it safely.
   - **Region**: Select the region nearest to your target users (e.g. `South Asia (Mumbai)` for Indian shops).
   - **Pricing Plan**: Free Tier is fully supported.
3. Click **Create new project** and wait ~2 minutes for PostgreSQL provisioning.

---

### Step 3: Retrieve API Keys & Configure Environment

1. In the Supabase Dashboard, navigate to **Project Settings** (gear icon) > **API**.
2. Locate the following values:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **Project API Keys** > `anon` `public`
   - **Project API Keys** > `service_role` `secret` (Click 'Reveal')
3. In your project root, copy the `.env.example` file:
   ```bash
   cp .env.example .env.local
   ```
4. Update `.env.local` with your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

### Step 4: Run Database Migrations

Open the **SQL Editor** in your Supabase Dashboard and run the three migration files in exact numerical sequence:

#### 1. Schema Migration (`001_initial_schema.sql`)
- Copy the entire contents of [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql).
- Paste it into the SQL Editor and click **Run**.
- *This creates the 22 core tables, unique constraints, and B-tree indexes.*

#### 2. Row Level Security (`002_rls_policies.sql`)
- Copy the entire contents of [`supabase/migrations/002_rls_policies.sql`](../supabase/migrations/002_rls_policies.sql).
- Paste it into the SQL Editor and click **Run**.
- *This installs the `get_user_shop_id()` helper and applies multi-tenant isolation policies.*

#### 3. Stored Functions (`003_functions.sql`)
- Copy the entire contents of [`supabase/migrations/003_functions.sql`](../supabase/migrations/003_functions.sql).
- Paste it into the SQL Editor and click **Run**.
- *This installs `generate_invoice_number` and `get_expiry_status` routines.*

---

### Step 5: Seed Demo Agricultural Data

To load initial seed data (roles, standard categories, top brands, demo products, batches, suppliers, and customer accounts):

1. Copy the contents of [`supabase/seed.sql`](../supabase/seed.sql).
2. Paste into the Supabase **SQL Editor** and click **Run**.

This seeds:
- **Default Shop**: `Krushi Seva Kendra`, Pune (`id: 11111111-1111-1111-1111-111111111111`)
- **4 System Roles**: Admin, Manager, Cashier, Sales Staff
- **9 Product Categories**: Seeds, Fertilizers, Insecticides, Fungicides, Herbicides, etc.
- **Top Brands**: Bayer CropScience, Syngenta, IFFCO
- **Sample SKUs**: Confidor 100ml, DAP Fertilizer 50kg, NPK Fertilizer 50kg with active batches
- **Sample Customers & Suppliers**

---

### Step 6: Configure Supabase Storage Buckets

KRUSHI OS supports uploading shop logos and expense receipts.

1. In the Supabase Dashboard, go to **Storage** > **New Bucket**.
2. Create the following public bucket:
   - **Bucket Name**: `shop-logos`
   - **Public Bucket**: **Enabled** (Toggle ON)
3. Create a second bucket:
   - **Bucket Name**: `receipts`
   - **Public Bucket**: **Enabled** (Toggle ON)

---

### Step 7: Create Your First Admin User

To log in and manage your store, you need an authenticated user record linked to `public.users`:

#### Option A: Register via the Application UI
1. Start the dev server: `npm run dev`
2. Open `http://localhost:3000/register` in your browser.
3. Complete the registration form with your Shop Name, Full Name, Email, and Password.
4. The registration action will automatically create the Supabase Auth user, the new `shops` record, and link your account with the **Admin** role.

#### Option B: Link an Existing Supabase Auth User with Seed Shop
If you created a user manually in Supabase Auth > Users (e.g. `admin@krushiseva.in`), link them to the seeded demo shop:

```sql
-- In Supabase SQL Editor:
INSERT INTO public.users (id, shop_id, role_id, full_name, email, phone)
VALUES (
  'PASTE_AUTH_USER_UUID_HERE',
  '11111111-1111-1111-1111-111111111111', -- Seed Shop ID
  '22222222-1111-1111-1111-111111111111', -- Admin Role ID
  'Admin User',
  'admin@krushiseva.in',
  '9876543210'
) ON CONFLICT (id) DO NOTHING;
```

---

### Step 8: Start Development Server

```bash
npm run dev
```

Open your browser at `http://localhost:3000` and sign in with your credentials.

---

## 3. Production Deployment (Vercel)

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Log into [Vercel](https://vercel.com/) and click **Add New** > **Project**.
3. Import the `krushi-os` repository.
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Deploy**.
6. In your Supabase Dashboard, go to **Authentication** > **URL Configuration**:
   - Set **Site URL** to your Vercel production URL (e.g. `https://krushi-os.vercel.app`).
   - Add your production URL to **Redirect URLs**.

---

## 4. Troubleshooting Common Issues

### Issue 1: "User not found" or "Permission denied" on Login
- **Cause**: The authenticated user exists in `auth.users` but has no matching row in `public.users`.
- **Fix**: Run the SQL snippet from Step 7 (Option B) in the Supabase SQL Editor to create the profile row with `shop_id` and `role_id`.

### Issue 2: Empty Data in Tables (RLS Filtering)
- **Cause**: Row Level Security (RLS) is active, and the current user session either lacks a valid `shop_id` or the `get_user_shop_id()` function returned `NULL`.
- **Fix**: Ensure your user record in `public.users` has an active `shop_id` matching the seed data. Verify by running `SELECT * FROM public.users WHERE id = auth.uid()`.

### Issue 3: Next.js Build Error ("Missing environment variable")
- **Cause**: `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` was omitted during `npm run build`.
- **Fix**: Ensure `.env.local` is present in the workspace root or add the variables in your CI/CD platform (e.g. Vercel dashboard).

### Issue 4: Duplicate Invoice Numbers
- **Cause**: Manual inserts into `sales` table bypassed the atomic sequence.
- **Fix**: Always generate invoice numbers using the `generate_invoice_number(shop_id)` function or update `shops.invoice_counter` to the maximum integer in `sales`.
