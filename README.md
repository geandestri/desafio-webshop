# Demo Web Shop - teste de performance

Teste HTTP com k6: login, busca, carrinho, checkout, consulta e exportacao.
Python 3 utiliza apenas a biblioteca padrao para massa e processamento.

## Resultado e documentos

A validacao final executou **5 VUs x 3 compras**, com 15/15 fluxos,
460/460 checks aprovados e zero falhas HTTP. As tres volumetrias grandes
foram configuradas, sem execucao, conforme o desafio.

- [Relatorio do desafio](report/relatorio.txt): estrategia, resultados e melhorias.
- [Dashboard final](report/execucoes/2026-10-28-5vu-final/html/dashboard.html).
- [Dados das compras](report/execucoes/2026-10-28-5vu-final/json/pedidos.json).

As evidencias anteriores sao historico; a execucao final e a referencia principal.

## Preparar a massa

Requisitos: k6 e Python 3 no PATH. Comandos no PowerShell, na raiz do projeto.
Para cadastrar cinco contas reais e validar um novo login por conta:

```powershell
python scripts/register_users.py --count 5 --output data/novos-usuarios.json
$env:USERS_FILE = (Resolve-Path 'data/novos-usuarios.json').Path
```

O cadastro fica fora da medicao. Nao sobrescreve arquivo existente.
Para reutilizar as contas locais da validacao final, indique
`data/users-validacao-final.json` em USERS_FILE. Credenciais nao acompanham o Git;
quem clonar o projeto deve gerar sua propria massa. Cada VU usa uma conta distinta.

## Executar e gerar resultados

O runner verifica dependencias e massa, executa o k6 e gera JSON, CSV e HTML:

```powershell
.\scripts\run_tests.ps1 -Scenario final -UsersFile .\data\novos-usuarios.json
```

Cenarios: `single` (1 VU / 1 compra), `parallel` (2 VUs / 2 compras) e
`final` (5 VUs / 3 compras por VU, total 15). O padrao e `final`.
Para a massa local ja cadastrada, use `data/users-validacao-final.json`.
O runner cria a pasta em report/execucoes/, informa o caminho do dashboard e
registra os codigos de saida em json/runner.json. Retorna falha se o k6
reprovar ou se o processamento dos resultados falhar. Nao cadastra contas,
nao limpa evidencias e nao disponibiliza as grandes volumetrias.
Se o PowerShell bloquear scripts locais, pode-se executar sem alterar a
politica permanente da maquina:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_tests.ps1 -Scenario final -UsersFile .\data\novos-usuarios.json
```

Os comandos equivalentes, para executar manualmente, estao abaixo.

O cenario confirma **15 compras reais no ambiente de demonstracao**.
Cada iteracao exige carrinho vazio; se houver itens residuais, falha antes da compra.

```powershell
$runReport = "report/execucoes/$(Get-Date -Format 'yyyy-MM-dd-HHmmss')"
foreach ($tipo in @('logs', 'json', 'csv', 'html')) {
    New-Item -ItemType Directory -Path "$runReport/$tipo" -Force | Out-Null
}
k6 run --log-format raw --console-output "$runReport/logs/execucao.log" --out "json=$runReport/json/metricas.json" --summary-export "$runReport/json/resumo.json" tests/k6/final_validation.js
python scripts/export_results.py "$runReport/logs/execucao.log" --output-prefix "$runReport/json/pedidos" --csv-prefix "$runReport/csv/pedidos"
python scripts/build_dashboard.py $runReport
```

Abra `$runReport/html/dashboard.html` no navegador; funciona offline.
Execute o conversor mesmo se o teste reprovar para preservar registros de falha.
O gerador utiliza o formato legado de --summary-export.
Para 1 VU / 1 iteracao, use `tests/k6/login.js`; para 2 VUs / 1 iteracao por
usuario, use `tests/k6/parallel.js` no mesmo comando.

## Volumetrias: somente configuracao

| Arquivo em tests/k6/ | Meta | Referencia por pedido | VUs iniciais / limite |
| --- | --- | --- | --- |
| volumetry1.js | 1.000 em 1 h | 60 s | 17 / 25 |
| volumetry2.js | 5.000 em 2 h | 90 s | 63 / 95 |
| volumetry3.js | 100.000 em 4 h | 120 s | 834 / 1.251 |

Usam constant-arrival-rate e dimensionamento por taxa x duracao.
Agendam tentativas; pedidos confirmados dependem do sucesso dos checkouts.
A massa pequena nao cobre os limites desses perfis. Inspecionar sem executar:

```powershell
k6 inspect tests/k6/volumetry1.js
k6 inspect tests/k6/volumetry2.js
k6 inspect tests/k6/volumetry3.js
```

## Configuracao e estrutura

```text
tests/k6/    Fluxo e cenarios k6
scripts/     Cadastro, exportacao, dashboard e limpeza
data/        Massa local, fora do Git
report/      Relatorio e execucoes com logs/, json/, csv/ e html/
```

- EXPECTED_ORDER_STATUS: status esperado opcional, por exemplo Pending.
- CHECKOUT_FIRST_NAME, CHECKOUT_LAST_NAME, CHECKOUT_COUNTRY, CHECKOUT_STATE,
  CHECKOUT_CITY, CHECKOUT_ADDRESS, CHECKOUT_ZIP e CHECKOUT_PHONE: endereco
  ficticio quando nao houver endereco cadastrado.
- Checkout exige pagamento na entrega disponivel.
- Para consultar pedido existente sem nova compra, configure USERS_FILE,
  defina ORDER_ID e execute `k6 run tests/k6/verify_order.js`. O pedido deve
  pertencer a primeira conta da massa.

## Retencao das evidencias

`cleanup_reports.py` mantem cinco execucoes recentes e preserva as pastas
com um arquivo vazio ENTREGA. Apenas simula sem --apply:

```powershell
python scripts/cleanup_reports.py
# Conferir a lista antes de excluir:
python scripts/cleanup_reports.py --apply
```

A limpeza e manual e nao e backup. As evidencias sao versionadas: exclusoes
locais devem ser revisadas antes de um commit. Credenciais continuam fora do Git.
