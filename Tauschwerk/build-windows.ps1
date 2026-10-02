$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Der .NET-Framework-Compiler wurde nicht gefunden.' }
& $compiler /nologo /target:winexe "/out:$PSScriptRoot\Tauschwerk.exe" /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll "$PSScriptRoot\Launcher.cs"
if ($LASTEXITCODE -ne 0) { throw 'Der Windows-Starter konnte nicht gebaut werden.' }
Write-Output 'Tauschwerk.exe wurde erstellt.'
