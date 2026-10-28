# Execucao paralela - 27/10/2026

Dois usuarios virtuais, contas distintas, uma iteracao por VU, usando
`tests/k6/parallel.js` com executor `per-vu-iterations`. O cadastro nao faz
parte desta execucao. Login e carrinhos vazios foram verificados antes do k6.

Ambos concluiram login, busca, carrinho, checkout e consulta do pedido na
mesma iteracao. Foram aprovados 54/54 checks e todos os thresholds.
Taxa de sucesso do fluxo: 100%; falhas HTTP: 0 de 31 requisicoes.
p95 HTTP: aproximadamente 1,41 s; maximo HTTP: aproximadamente 4,59 s.
O limite configurado e para p95, portanto uma requisicao acima de 2 s nao
reprova isoladamente o teste. A amostra nao demonstra capacidade sob carga.

- [Dashboard](html/dashboard.html)
- [Pedidos e tempos em JSON](json/pedidos.json)
- [Pedidos e tempos em CSV](csv/pedidos.csv)
- [Resumo k6](json/resumo.json)
- [Metricas HTTP e demais amostras](json/metricas.json)
- [Log](logs/execucao.log)
- [Pre-verificacao dos carrinhos](json/pre-verificacao.json)

O teste criou dois pedidos reais no ambiente de demonstracao. IDs e status
estao nos arquivos de pedidos. Nao foram salvas senhas nessas evidencias.
Esta execucao nao gerou capturas de tela ou HTML dos detalhes dos pedidos;
o HTML disponivel e o dashboard gerado a partir dos dados reais.
O relatorio.txt nao foi alterado nesta atividade.
