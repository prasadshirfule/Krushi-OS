# KRUSHI OS — Production Disaster Recovery & Backup Runbook

## 1. System Overview & Objectives

KRUSHI OS operates as a multi-tenant retail ERP and billing platform for independent Krushi Seva Kendras in India. Preserving business data, statutory GST invoices, and farmer credit ledgers is paramount.

| Parameter | Self-Managed Daily Cold Backup | Supabase Pro Tier (PITR) | Statutory / Regulatory Notes |
| :--- | :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **24 Hours** (Nightly dump) | **< 5 Minutes** (WAL-G stream) | Acceptable for retail stores; Pro tier recommended for high-volume Kendras |
| **RTO (Recovery Time Objective)** | **2 to 4 Hours** (Restore from dump) | **< 1 Hour** (Automated snapshot) | Elapsed time to restore database and switch connection strings |
| **Backup Retention** | **7 Years** (Encrypted S3/Glacier) | **7 to 30 Days** (Live console) | Section 36 of CGST Act 2017 requires 72 months record preservation |

---

## 2. Backup Architecture

### A. Database Tier (Supabase PostgreSQL)
1. **Automated Continuous Backups (WAL-G / PITR):**
   - Managed automatically by Supabase for point-in-time recovery up to 7–30 days.
2. **Scheduled Independent Cold Exports (Nightly pg_dump):**
   - Cron-triggered export generating encrypted, compressed SQL archives (`.sql.gz.enc`).
   - Stored in a separate cloud object bucket (e.g. AWS S3 Asia-Pacific Mumbai / Cloudflare R2).

### B. Document Storage Tier (Supabase Storage)
- Contains signed PDF invoice statements and customer receipt records.
- Synced bi-directionally or archived nightly to independent secondary object storage.
- Storage objects cannot be recovered solely from database SQL dumps.

---

## 3. Database Backup Execution Procedure

### Automated PowerShell Script (Windows / Dev Environment)
Located at: `scripts/backup-database.ps1`

```powershell
# Usage:
$env:DB_HOST="aws-0-ap-south-1.pooler.supabase.com"
$env:DB_PORT="6543"
$env:DB_NAME="postgres"
$env:DB_USER="postgres.mpulodbwspbrwzcqpzqg"
$env:DB_PASSWORD="your-secure-password"

.\scripts\backup-database.ps1 -OutputDir "C:\Backups\KrushiOS"
```

### Automated Bash Script (Linux / CI/CD)
Located at: `scripts/backup-database.sh`

```bash
# Usage:
export PGPASSWORD="your-secure-password"
./scripts/backup-database.sh /var/backups/krushios
```

---

## 4. Disaster Recovery & Restoration Runbook

### Step 1: Incident Assessment & Triage
1. Confirm primary outage vs localized network routing issue.
2. Check [health API endpoint](https://krushios.vercel.app/api/health).
3. If database corruption or data loss is identified, immediately set `NEXT_PUBLIC_MAINTENANCE_MODE=true` to halt incoming write transactions.

### Step 2: Database Restoration
1. If using Supabase PITR (Point-in-Time Recovery):
   - Access Supabase Management Console &gt; Project Settings &gt; Database &gt; Backups.
   - Select the target timestamp immediately prior to the failure event.
   - Click "Restore to Timestamp".
2. If restoring to a clean PostgreSQL instance via Cold Dump:
   ```bash
   # Decrypt archive
   openssl enc -d -aes-256-cbc -pbkdf2 -in krushios_backup_20261108.sql.gz.enc -out krushios_backup.sql.gz

   # Decompress archive
   gunzip krushios_backup.sql.gz

   # Restore into clean database
   psql -h target-host -p 5432 -U postgres -d postgres -f krushios_backup.sql
   ```

### Step 3: Run Database Health & RLS Audit
Verify that:
- Row Level Security (RLS) is enabled on all tables:
  ```sql
  SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
  ```
- All foreign keys and tenant isolation triggers are intact.
- Migration version is at least `023_saas_subscriptions.sql`.

### Step 4: Verification of Financial Consistency
Run ledger verification query across active shops:
```sql
SELECT
  c.id,
  c.name,
  c.current_balance,
  COALESCE(SUM(cl.debit), 0) - COALESCE(SUM(cl.credit), 0) as computed_net
FROM customers c
LEFT JOIN customer_ledger cl ON cl.customer_id = c.id
GROUP BY c.id, c.name, c.current_balance;
```

### Step 5: Post-Restore Deployment & DNS Switching
1. Update `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel project environment variables if the target database host changed.
2. Trigger production redeployment.
3. Remove maintenance banner and verify shopkeeper login.
