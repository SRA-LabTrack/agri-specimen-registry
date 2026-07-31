param(
    [ValidateSet("patch", "minor", "major")]
    [string]$Bump = "patch",
    [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$Step,
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Write-Host ""
    Write-Host $Step -ForegroundColor Cyan
    & $Command @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

Set-Location -LiteralPath $ProjectPath
[System.Environment]::CurrentDirectory = (Get-Location).ProviderPath

$dirty = git status --porcelain
if ($dirty) {
    Write-Host ""
    Write-Host "Uncommitted files were found:" -ForegroundColor Yellow
    $dirty | ForEach-Object { Write-Host "  $_" }
    throw "Commit or discard those changes before publishing a desktop update."
}

Invoke-Native `
    -Step "Synchronizing main" `
    -Command "git" `
    -Arguments @("pull", "--rebase", "origin", "main")

Invoke-Native `
    -Step "Increasing the $Bump version" `
    -Command "npm.cmd" `
    -Arguments @("version", $Bump, "--no-git-tag-version")

$version = (& node -e "process.stdout.write(require('./package.json').version)").Trim()
$tag = "v$version"

& git show-ref --tags --verify --quiet "refs/tags/$tag"
if ($LASTEXITCODE -eq 0) {
    throw "The tag $tag already exists."
}

Invoke-Native `
    -Step "Checking the website build" `
    -Command "npm.cmd" `
    -Arguments @("run", "build")

Invoke-Native `
    -Step "Staging the release version" `
    -Command "git" `
    -Arguments @("add", "--", "package.json", "package-lock.json")

Invoke-Native `
    -Step "Creating release commit $tag" `
    -Command "git" `
    -Arguments @("commit", "-m", "Release AgriRegistry $tag")

Invoke-Native `
    -Step "Pushing the release commit" `
    -Command "git" `
    -Arguments @("push", "origin", "main")

Invoke-Native `
    -Step "Creating release tag $tag" `
    -Command "git" `
    -Arguments @("tag", "-a", $tag, "-m", "AgriRegistry $tag")

Invoke-Native `
    -Step "Starting the GitHub update build" `
    -Command "git" `
    -Arguments @("push", "origin", $tag)

Write-Host ""
Write-Host "Release $tag was queued successfully." -ForegroundColor Green
Write-Host "GitHub Actions will build and publish the installer, blockmap, and latest.yml."
Write-Host "Installed AgriRegistry apps will detect it on launch or within six hours."
