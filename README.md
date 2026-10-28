# Demo Web Shop ? teste de performance

Teste HTTP em k6 cobrindo login, busca, carrinho, checkout, consulta do pedido
e exporta??o de resultados. Python 3 usa apenas a biblioteca padr?o.

```text
tests/k6/    Fluxo, cen?rio paralelo e tr?s volumetrias
scripts/     Cadastro, exporta??o, dashboard e limpeza
data/        Credenciais locais (fora do Git)
report/      Relat?rio TXT e evid?ncias por execu??o
```

## Evid?ncia principal

O [teste com dois usu?rios](report/execucoes/2026-10-27-2vu/LEIA-ME.md) concluiu
as duas compras: 54/54 checks, zero falhas HTTP e todos os thresholds aprovados.
Abra o [dashboard](report/execucoes/2026-10-27-2vu/html/dashboard.html).
A estrat?gia, resultados e limita??es est?o no [relat?rio](report/relatorio.txt).

## Preparar contas

Requisitos: k6 e Python 3 no PATH. Execute os comandos na raiz, no PowerShell.
Se precisar criar uma nova massa:

```powershell
python scripts/register_users.py --count 2 --output data/novos-usuarios.json
```

O script cadastra contas reais e confirma um novo login antes de salvar.
N?o sobrescreve arquivos existentes. Cadastro fica fora dos tempos do teste.
Para usar as duas contas j? verificadas:

```powershell
$env:USERS_FILE = (Resolve-Path 'data/users-verificados.json').Path
```

Para uma nova massa, indique seu caminho em `USERS_FILE`. Cada VU precisa de
uma conta distinta. Credenciais n?o acompanham o Git: gere a massa ao reproduzir.

## Executar o teste pequeno e gerar evid?ncias

Confira que os carrinhos est?o vazios. O comando confirma **duas compras reais
no ambiente de demonstra??o**, incluindo qualquer item j? presente no carrinho.

```powershell
$runReport = "report/execucoes/$(Get-Date -Format 'yyyy-MM-dd-HHmmss')"
foreach ($tipo in @('logs', 'json', 'csv', 'html')) {
    New-Item -ItemType Directory -Path "$runReport/$tipo" -Force | Out-Null
}
k6 run --log-format raw --console-output "$runReport/logs/execucao.log" --out "json=$runReport/json/metricas.json" --summary-export "$runReport/json/resumo.json" tests/k6/parallel.js
python scripts/export_results.py "$runReport/logs/execucao.log" --output-prefix "$runReport/json/pedidos" --csv-prefix "$runReport/csv/pedidos"
python scripts/build_dashboard.py $runReport
```

O cen?rio garante uma itera??o por VU. Para testar com apenas uma conta,
substitua `tests/k6/parallel.js` por `tests/k6/login.js` (1 VU / 1 itera??o).
Execute a exporta??o tamb?m se o k6 reprovar; ela preserva tentativas com erro.
Abra `$runReport/html/dashboard.html` no navegador. N?o exige servidor ou internet.
O gerador l? o formato legado de `--summary-export` e as amostras de m?tricas.

## Volumetrias: configurar, sem executar

| Arquivo em tests/k6/ | Meta | Refer?ncia por pedido | VUs iniciais / limite |
| --- | --- | --- | --- |
| volumetry1.js | 1.000 em 1 h | 60 s | 17 / 25 |
| volumetry2.js | 5.000 em 2 h | 90 s | 63 / 95 |
| volumetry3.js | 100.000 em 4 h | 120 s | 834 / 1.251 |

Usam `constant-arrival-rate` e dimensionamento por taxa ? dura??o. Controlam
in?cios de compra; pedidos confirmados dependem do sucesso dos checkouts.
A massa pequena n?o cobre os limites dos perfis. Para validar a configura??o
sem fazer requisi??es:

```powershell
k6 inspect tests/k6/volumetry1.js
k6 inspect tests/k6/volumetry2.js
k6 inspect tests/k6/volumetry3.js
```

## Configura??o e manuten??o

- `EXPECTED_ORDER_STATUS`: status esperado opcional, por exemplo `Pending`.
- `CHECKOUT_FIRST_NAME`, `CHECKOUT_LAST_NAME`, `CHECKOUT_COUNTRY`,
  `CHECKOUT_STATE`, `CHECKOUT_CITY`, `CHECKOUT_ADDRESS`, `CHECKOUT_ZIP` e
  `CHECKOUT_PHONE`: dados fict?cios usados quando n?o houver endere?o cadastrado.
- Checkout usa pagamento na entrega; falha se o m?todo estiver indispon?vel.
- Consulta de pedido existente sem outra compra:

```powershell
$env:ORDER_ID = '2406111'
k6 run tests/k6/verify_order.js
```

A consulta usa a primeira conta da massa; escolha um pedido pertencente a ela.
Para limpeza, veja [report/README.md](report/README.md). O script mant?m cinco
execu??es recentes e preserva as marcadas com `ENTREGA`:

```powershell
python scripts/cleanup_reports.py
# Excluir apenas ap?s conferir a simula??o:
python scripts/cleanup_reports.py --apply
```

Resultados em `report/execucoes/` s?o ignorados pelo Git. Inclua a pasta da
evid?ncia principal ao entregar o projeto; o marcador `ENTREGA` n?o ? backup.
