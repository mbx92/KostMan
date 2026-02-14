# Database Copy Script for KostMan (PowerShell)
# Copies a PostgreSQL database from source to target

param(
    [string]$SourceDB = "kostMan_dev",
    [string]$TargetDB = "kostman_prod",
    [string]$DBUser = "mbx",
    [string]$DBPassword = "nopassword123!",
    [string]$DBHost = "10.100.10.5",
    [string]$DBPort = "5432"
)

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║  KostMan Database Copy Utility        ║" -ForegroundColor Yellow
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Yellow
Write-Host ""
Write-Host "Source Database: " -NoNewline
Write-Host $SourceDB -ForegroundColor Green
Write-Host "Target Database: " -NoNewline
Write-Host $TargetDB -ForegroundColor Green
Write-Host ""

# Confirmation
$confirmation = Read-Host "This will REPLACE $TargetDB with a copy of $SourceDB. Continue? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Red
    exit 1
}

# Set password environment variable
$env:PGPASSWORD = $DBPassword

Write-Host "[1/4] Checking if source database exists..." -ForegroundColor Yellow
$checkSource = & psql -h $DBHost -p $DBPort -U $DBUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$SourceDB'"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($checkSource)) {
    Write-Host "Error: Source database '$SourceDB' does not exist!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Source database exists" -ForegroundColor Green

Write-Host "[2/4] Terminating connections to target database..." -ForegroundColor Yellow
& psql -h $DBHost -p $DBPort -U $DBUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$TargetDB' AND pid <> pg_backend_pid();" 2>$null
Write-Host "✓ Connections terminated" -ForegroundColor Green

Write-Host "[3/4] Dropping target database if exists..." -ForegroundColor Yellow
& psql -h $DBHost -p $DBPort -U $DBUser -d postgres -c "DROP DATABASE IF EXISTS `"$TargetDB`";" 2>$null
Write-Host "✓ Target database dropped" -ForegroundColor Green

Write-Host "[4/4] Creating target database from template..." -ForegroundColor Yellow
& psql -h $DBHost -p $DBPort -U $DBUser -d postgres -c "CREATE DATABASE `"$TargetDB`" WITH TEMPLATE `"$SourceDB`" OWNER `"$DBUser`";"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to create database" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Database created successfully" -ForegroundColor Green

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Database Copy Completed Successfully ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Database '$SourceDB' has been copied to '$TargetDB'" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update DATABASE_URL in .env to point to $TargetDB if needed"
Write-Host "2. Or configure it in Database Configuration UI (/settings/database-config)"
Write-Host "3. Restart the server to use the new database"
Write-Host ""
