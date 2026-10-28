# Validacao final - 28/10/2026

Configuracao aprovada: `per-vu-iterations`, 5 usuarios com contas distintas,
3 iteracoes por usuario, total de 15 tentativas. Script: `final_validation.js`.
Cadastro de contas realizado antes da medicao.

Resultado: **15/15 compras e 460/460 checks aprovados**, 245 requisicoes HTTP,
zero falhas HTTP e todos os thresholds atendidos. Duracao aproximada: 36,6 s.
HTTP medio: 726,20 ms; p95: 1749,20 ms; maximo: 5575,42 ms.
Quinze IDs distintos (2406900 a 2406914), todos Pending.

Em cada login, o teste extrai NOPCOMMERCE.AUTH da resposta original, reinsere
o valor no jar e valida sua reutilizacao e a conta autenticada. Em cada compra,
valida carrinho vazio. As evidencias contem apenas nome do cookie e indicador
sessionCorrelated; o valor secreto nao e gravado.

- [Dashboard](html/dashboard.html)
- [Pedidos JSON](json/pedidos.json)
- [Pedidos CSV](csv/pedidos.csv)
- [Resumo](json/resumo.json)
- [Amostras](json/metricas.json)
- [Log](logs/execucao.log)

Conferidos: tres registros por VU, IDs distintos, correlacao em 15 logins,
status Pending, thresholds e ausencia das senhas da massa nos artefatos.
A evidencia nao comprova capacidade ou estabilidade em alta carga.
As tres volumetrias grandes nao foram executadas.
