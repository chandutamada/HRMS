# Backup and Disaster Recovery Guide

## 1. Backup Strategy Overview

A reliable backup strategy ensures high availability and disaster recovery for company employee data, attendance history, and payroll records in **MySQL 8.4 LTS**.

| Backup Type | Frequency | Tool / Command | Retention |
| :--- | :--- | :--- | :--- |
| **Full Logical Backup** | Daily at 01:00 IST | `mysqldump` (single-transaction) | 30 days |
| **Binary Logs (PITR)** | Continuous / Hourly | MySQL Binary Logging (`binlog`) | 7 days |
| **Private Files Archive** | Weekly | File system archive (`tar` / `Compress-Archive`) | 90 days |

---

## 2. MySQL 8.4 Logical Backup (`mysqldump`)

Run the following command to generate an atomic, non-locking backup of `hrms_db`:

```bash
mysqldump -u root -p \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --hex-blob \
  --databases hrms_db > hrms_db_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Windows PowerShell Backup Script (`scripts/backup.ps1`)

```powershell
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = "C:\Backups\HRMS"
$OutputFile = "$BackupDir\hrms_db_$Date.sql"
$ZipFile = "$BackupDir\hrms_db_$Date.zip"

If (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir
}

# Execute mysqldump
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe" `
  -u root -p"Chanduu@444444" `
  --single-transaction `
  --quick `
  --routines `
  --triggers `
  hrms_db > $OutputFile

# Compress into zip archive
Compress-Archive -Path $OutputFile -DestinationPath $ZipFile
Remove-Item $OutputFile

# Purge backups older than 30 days
Get-ChildItem -Path $BackupDir -Filter "*.zip" | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

---

## 3. Database Restoration Procedure

In the event of hardware failure, database corruption, or recovery testing:

### Step 1: Create or Reset Target Database
```sql
-- Connect to MySQL shell
mysql -u root -p

-- Reset database schema
DROP DATABASE IF EXISTS hrms_db;
CREATE DATABASE hrms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### Step 2: Import Backup File
```bash
mysql -u root -p hrms_db < hrms_db_backup_20261016.sql
```

### Step 3: Run Prisma Schema Verification
```bash
cd c:\Users\chand\OneDrive\Desktop\HR-APPLICATION
npm.cmd run db:generate
```

---

## 4. Point-in-Time Recovery (PITR) with Binary Logs

Binary logging allows restoring the database to an exact minute between full backups.

1. Locate binary log files in MySQL data directory (`my.ini` -> `log-bin=mysql-bin`).
2. Extract statements between the last full backup and failure timestamp:
```bash
mysqlbinlog --start-datetime="2026-10-16 01:00:00" \
            --stop-datetime="2026-10-16 14:32:00" \
            --database=hrms_db \
            mysql-bin.000012 | mysql -u root -p hrms_db
```

---

## 5. Backup Testing & Integrity Drills

1. **Monthly Restoration Drill**:
   - Restore the latest backup into a separate staging database (`hrms_db_staging`).
   - Run verification queries:
     ```sql
     SELECT COUNT(*) FROM companies;
     SELECT COUNT(*) FROM employees;
     SELECT COUNT(*) FROM attendance_records;
     SELECT COUNT(*) FROM payroll_records;
     ```
   - Verify that all counts match production logs.
2. **Offsite Replication**:
   - Encrypted backup archives (`.zip` / `.gpg`) should be synced to an offsite secure private storage bucket (e.g. AWS S3 Glacier, GCP Cloud Storage) using automated tooling.
