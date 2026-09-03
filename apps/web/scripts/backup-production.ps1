[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Require-Value([string]$Name, [string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "$Name is required."
  }
}

Require-Value "DATABASE_URL" $env:DATABASE_URL
Require-Value "CORELOOM_BACKUP_DIR" $env:CORELOOM_BACKUP_DIR

if (-not [System.IO.Path]::IsPathRooted($env:CORELOOM_BACKUP_DIR)) {
  throw "CORELOOM_BACKUP_DIR must be an absolute path."
}

$backupDirectory = [System.IO.Path]::GetFullPath($env:CORELOOM_BACKUP_DIR)
$appDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$rootDirectory = [System.IO.Path]::GetPathRoot($backupDirectory)

if ($backupDirectory.TrimEnd("\\", "/") -eq $rootDirectory.TrimEnd("\\", "/")) {
  throw "CORELOOM_BACKUP_DIR cannot be a drive root."
}

if ($backupDirectory.StartsWith($appDirectory, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "CORELOOM_BACKUP_DIR must be outside the repository."
}

if (-not (Test-Path -LiteralPath $backupDirectory -PathType Container)) {
  throw "CORELOOM_BACKUP_DIR must already exist."
}

$pgDump = Get-Command pg_dump -ErrorAction Stop
$pgRestore = Get-Command pg_restore -ErrorAction Stop
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
$archiveName = "coreloom-production-$timestamp.dump"
$archivePath = Join-Path $backupDirectory $archiveName
$receiptPath = "$archivePath.receipt.txt"

& $pgDump.Source --format=custom "--file=$archivePath" $env:DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }

& $pgRestore.Source --list $archivePath | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pg_restore verification failed." }

$size = (Get-Item -LiteralPath $archivePath).Length
@(
  "archive=$archiveName"
  "bytes=$size"
  "created_utc=$((Get-Date).ToUniversalTime().ToString('o'))"
  "verification=pg_restore_list_passed"
) | Set-Content -LiteralPath $receiptPath -Encoding utf8

Write-Output "Backup verified: $archiveName"
