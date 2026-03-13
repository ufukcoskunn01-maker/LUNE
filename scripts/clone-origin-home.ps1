param(
  [string]$Url = "https://app.useorigin.com/home/",
  [string]$OutputDir = "reference\LiveOriginHome"
)

$ErrorActionPreference = "Stop"

function Get-AbsoluteAssetUrl {
  param(
    [string]$RawUrl,
    [Uri]$BaseUri
  )

  if ([string]::IsNullOrWhiteSpace($RawUrl)) {
    return $null
  }

  if ($RawUrl.StartsWith("data:", [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  if ($RawUrl.StartsWith("javascript:", [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  if ($RawUrl.StartsWith("//")) {
    return "{0}:{1}" -f $BaseUri.Scheme, $RawUrl
  }

  if ($RawUrl.StartsWith("http://", [System.StringComparison]::OrdinalIgnoreCase) -or
      $RawUrl.StartsWith("https://", [System.StringComparison]::OrdinalIgnoreCase)) {
    return $RawUrl
  }

  try {
    return ([Uri]::new($BaseUri, $RawUrl)).AbsoluteUri
  } catch {
    return $null
  }
}

function Get-TargetFilePath {
  param(
    [Uri]$AssetUri,
    [string]$DestinationRoot
  )

  $relativePath = $AssetUri.AbsolutePath.TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($relativePath)) {
    $relativePath = "index.html"
  }

  $safePath = $relativePath.Replace("/", "\")
  $filePath = Join-Path $DestinationRoot $safePath

  if (-not [string]::IsNullOrWhiteSpace($AssetUri.Query)) {
    $hash = [System.BitConverter]::ToString(
      [System.Security.Cryptography.SHA1]::Create().ComputeHash(
        [System.Text.Encoding]::UTF8.GetBytes($AssetUri.Query)
      )
    ).Replace("-", "").ToLowerInvariant().Substring(0, 10)

    $extension = [System.IO.Path]::GetExtension($filePath)
    $nameWithoutExtension = [System.IO.Path]::GetFileNameWithoutExtension($filePath)
    $directory = Split-Path $filePath
    $filePath = Join-Path $directory ("{0}.{1}{2}" -f $nameWithoutExtension, $hash, $extension)
  }

  return $filePath
}

$baseUri = [Uri]$Url
$destinationRoot = Join-Path (Get-Location) $OutputDir
New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null

$htmlPath = Join-Path $destinationRoot "index.html"
Write-Host "Downloading page shell from $Url"
curl.exe -L --silent --show-error $Url -o $htmlPath

$html = Get-Content $htmlPath -Raw
$baseHrefMatch = [regex]::Match($html, '(?i)<base\s+href=["'']([^"'']+)["'']')
if ($baseHrefMatch.Success) {
  try {
    $baseUri = [Uri]::new($baseUri, $baseHrefMatch.Groups[1].Value)
  } catch {
    $baseUri = [Uri]$Url
  }
}

$pattern = '(?i)(?:src|href)=["'']([^"'']+)["'']'
$matches = [regex]::Matches($html, $pattern)

$assetUrls = New-Object System.Collections.Generic.HashSet[string]
foreach ($match in $matches) {
  $absoluteUrl = Get-AbsoluteAssetUrl -RawUrl $match.Groups[1].Value -BaseUri $baseUri
  if ($null -ne $absoluteUrl) {
    $assetUri = [Uri]$absoluteUrl
    if ($assetUri.Host -eq $baseUri.Host) {
      [void]$assetUrls.Add($assetUri.AbsoluteUri)
    }
  }
}

$downloaded = 0
foreach ($assetUrl in $assetUrls) {
  $assetUri = [Uri]$assetUrl
  $targetPath = Get-TargetFilePath -AssetUri $assetUri -DestinationRoot $destinationRoot
  $targetDirectory = Split-Path $targetPath
  New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null

  if (Test-Path $targetPath) {
    continue
  }

  Write-Host "Downloading asset $assetUrl"
  try {
    curl.exe -L --silent --show-error $assetUrl -o $targetPath
    $downloaded += 1
  } catch {
    Write-Warning "Failed to download $assetUrl"
  }
}

Write-Host "Saved HTML to $htmlPath"
Write-Host "Downloaded $downloaded same-origin assets into $destinationRoot"
Write-Host "Note: authenticated API data and runtime XHR responses are not mirrored by this script."
