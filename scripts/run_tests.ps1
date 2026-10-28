[CmdletBinding()]
param(
    [ValidateSet('single', 'parallel', 'final')]
    [string]$Scenario = 'final',
    [Parameter(Mandatory = $true)]
    [string]$UsersFile
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$originalLocation = Get-Location
$previousUsersFile = $env:USERS_FILE
$exitCode = 1

try {
    # Caminho da massa e interpretado relativamente ao diretorio de chamada.
    $resolvedUsers = (Resolve-Path -LiteralPath $UsersFile).Path
    Get-Command k6 -ErrorAction Stop | Out-Null
    Get-Command python -ErrorAction Stop | Out-Null
    $parsedUsers = Get-Content -LiteralPath $resolvedUsers -Raw | ConvertFrom-Json
    $users = @($parsedUsers)
    $profiles = @{
        single = @{ Script = 'login.js'; Accounts = 1; Orders = 1 }
        parallel = @{ Script = 'parallel.js'; Accounts = 2; Orders = 2 }
        final = @{ Script = 'final_validation.js'; Accounts = 5; Orders = 15 }
    }
    $profile = $profiles[$Scenario]
    if ($users.Count -lt $profile.Accounts) {
        throw "O cenario $Scenario exige pelo menos $($profile.Accounts) contas."
    }
    $selected = @($users | Select-Object -First $profile.Accounts)
    if (@($selected | Where-Object { -not $_.email -or -not $_.password }).Count) {
        throw 'Massa invalida: cada conta precisa de email e password.'
    }
    if (@($selected.email | ForEach-Object { $_.ToLowerInvariant() } | Select-Object -Unique).Count -ne $profile.Accounts) {
        throw 'Cada usuario virtual precisa de uma conta distinta.'
    }

    Set-Location -LiteralPath $projectRoot
    $runName = "$(Get-Date -Format 'yyyy-MM-dd-HHmmss-fff')-$Scenario"
    $runReport = Join-Path $projectRoot "report/execucoes/$runName"
    foreach ($folder in @('logs', 'json', 'csv', 'html')) {
        New-Item -ItemType Directory -Path (Join-Path $runReport $folder) -Force | Out-Null
    }
    $env:USERS_FILE = $resolvedUsers
    Write-Host "Cenario: $Scenario | VUs: $($profile.Accounts) | Tentativas: $($profile.Orders)"
    Write-Host "Evidencias: $runReport"
    $testScript = Join-Path $projectRoot "tests/k6/$($profile.Script)"
    & k6 run --log-format raw --console-output "$runReport/logs/execucao.log" --out "json=$runReport/json/metricas.json" --summary-export "$runReport/json/resumo.json" $testScript
    $testExitCode = $LASTEXITCODE

    # Executar o pos-processamento mesmo quando o teste reprova.
    & python "$PSScriptRoot/export_results.py" "$runReport/logs/execucao.log" --output-prefix "$runReport/json/pedidos" --csv-prefix "$runReport/csv/pedidos"
    $exportExitCode = $LASTEXITCODE
    $dashboardExitCode = 1
    if ($exportExitCode -eq 0 -and (Test-Path -LiteralPath "$runReport/json/resumo.json")) {
        & python "$PSScriptRoot/build_dashboard.py" $runReport
        $dashboardExitCode = $LASTEXITCODE
    } else {
        Write-Warning 'Dashboard nao gerado: registros ou resumo indisponiveis. Consulte o log.'
    }
    $exitCode = if ($testExitCode -ne 0) { $testExitCode } elseif ($exportExitCode -ne 0 -or $dashboardExitCode -ne 0) { 1 } else { 0 }
    [ordered]@{
        scenario = $Scenario
        virtualUsers = $profile.Accounts
        plannedAttempts = $profile.Orders
        k6ExitCode = $testExitCode
        exportExitCode = $exportExitCode
        dashboardExitCode = $dashboardExitCode
        exitCode = $exitCode
    } | ConvertTo-Json | Set-Content -LiteralPath "$runReport/json/runner.json" -Encoding UTF8
    if ($dashboardExitCode -eq 0) { Write-Host "Dashboard: $runReport/html/dashboard.html" }
} catch {
    Write-Error -Message $_ -ErrorAction Continue
    $exitCode = 1
} finally {
    $env:USERS_FILE = $previousUsersFile
    Set-Location -LiteralPath $originalLocation.Path
}
exit $exitCode
