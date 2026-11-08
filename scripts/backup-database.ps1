# KRUSHI OS — Automated PostgreSQL Backup Script (PowerShell)
param (
  [string]$OutputDir = "./backups"
)

$ErrorActionPreference = "Stop"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "🌾 KRUSHI OS — AUTOMATED DATABASE BACKUP" -ForegroundColor Cyan
Write-Host "================================================================"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Resolve-Path (New-Item -ItemType Directory -Force -Path $OutputDir)
$SqlFile = Join-Path $BackupDir "krushi_os_backup_$Timestamp.sql"
$ArchiveFile = "$SqlFile.gz"

Write-Host "Backup target: $SqlFile"

# Verify pg_dump exists
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
  Write-Warning "pg_dump binary not found in PATH. Please install PostgreSQL client tools."
  Write-Host "For Supabase, you can also use Supabase CLI: 'npx supabase db dump -f $SqlFile'"
  exit 1
}

$Host = if ($env:DB_HOST) { $env:DB_HOST } else { "127.0.0.1" }
$Port = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$User = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$Database = if ($env:DB_NAME) { $env:DB_NAME } else { "postgres" }

Write-Host "Executing pg_dump from $Host:$Port ($Database)..."

& pg_dump -h $Host -p $Port -U $User -d $Database --no-owner --no-acl -F p -f $SqlFile

if (Test-Path $SqlFile) {
  $fileSize = (Get-Item $SqlFile).Length
  Write-Host "✓ Dump successful! Size: $([math]::Round($fileSize / 1KB, 2)) KB" -ForegroundColor Green

  # Optional GPG encryption
  if ($env:BACKUP_ENCRYPTION_PASSPHRASE -and (Get-Command gpg -ErrorAction SilentlyContinue)) {
    Write-Host "Encrypting dump via GPG AES256..."
    & gpg --symmetric --cipher-algo AES256 --batch --yes --passphrase $env:BACKUP_ENCRYPTION_PASSPHRASE $SqlFile
    Remove-Item $SqlFile -Force
    $SqlFile = "$SqlFile.gpg"
    Write-Host "✓ Encrypted: $SqlFile" -ForegroundColor Green
  }

  # Optional S3 off-site sync
  if ($env:BACKUP_S3_BUCKET -and (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "Uploading to s3://$($env:BACKUP_S3_BUCKET)/backups/..."
    & aws s3 cp $SqlFile "s3://$($env:BACKUP_S3_BUCKET)/backups/"
    Write-Host "✓ S3 upload completed!" -ForegroundColor Green
  }
} else {
  Write-Error "Backup file was not created!"
}
