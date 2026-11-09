$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$migrationDir = Join-Path $repoRoot 'prisma\migrations\20261108230000_add_messages'
$rollbackSql = Join-Path $migrationDir 'rollback.sql'
$encodedPatch = Join-Path $PSScriptRoot 'rollback-messages-existing-files.patch.b64'
$reversePatch = Join-Path $env:TEMP "messages-rollback-$([guid]::NewGuid().ToString('N')).patch"
$prisma = Join-Path $repoRoot 'node_modules\.bin\prisma.cmd'
$schema = Join-Path $repoRoot 'prisma\schema.prisma'

if (-not $env:DATABASE_URL -or -not $env:DIRECT_URL) {
  throw 'DATABASE_URL et DIRECT_URL doivent être définies pour annuler la migration.'
}
if (-not (Test-Path -LiteralPath $rollbackSql) -or -not (Test-Path -LiteralPath $encodedPatch)) {
  throw 'Fichiers de retour arrière manquants.'
}

try {
  $encoded = (Get-Content -LiteralPath $encodedPatch -Raw).Trim()
  [System.IO.File]::WriteAllBytes($reversePatch, [Convert]::FromBase64String($encoded))
}
catch {
  if (Test-Path -LiteralPath $reversePatch) {
    Remove-Item -LiteralPath $reversePatch -Force
  }
  throw
}

& git -C $repoRoot apply --reverse --check $reversePatch
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $reversePatch -Force
  throw 'Les fichiers existants ont changé depuis la création du retour arrière ; aucune table n’a été supprimée.'
}

Push-Location $repoRoot
try {
  & $prisma db execute --file $rollbackSql --schema $schema
  if ($LASTEXITCODE -ne 0) {
    throw 'La suppression des tables Messages a échoué.'
  }

  & git -C $repoRoot apply --reverse $reversePatch
  if ($LASTEXITCODE -ne 0) {
    throw 'La restauration des fichiers existants a échoué après la suppression des tables.'
  }

  $featureDirectories = @(
    'src\app\(app)\messages',
    'src\app\api\messages',
    'src\components\messages',
    'src\lib\messages',
    'prisma\migrations\20261108230000_add_messages'
  )
  $rootPrefix = $repoRoot.TrimEnd('\') + '\'
  foreach ($relativePath in $featureDirectories) {
    $target = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $relativePath))
    if (-not $target.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Chemin de retour arrière hors du dépôt : $target"
    }
    if (Test-Path -LiteralPath $target) {
      Remove-Item -LiteralPath $target -Recurse -Force
    }
  }
}
finally {
  Pop-Location
  if (Test-Path -LiteralPath $reversePatch) {
    Remove-Item -LiteralPath $reversePatch -Force
  }
}

Write-Output 'Tables et code Messages supprimés. Retire également NEXT_PUBLIC_MESSAGES_ENABLED et ABLY_API_KEY de la configuration Vercel si tu les as ajoutées.'
