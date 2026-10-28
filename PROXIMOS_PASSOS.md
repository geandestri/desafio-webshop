# Proximos passos

Plano registrado em 27/10/2026 para revisao posterior.

- [x] Validar novamente o fluxo completo apos as correcoes, com evidencia
  de login, busca, carrinho, checkout e consulta na mesma iteracao.
- [x] Executar dois usuarios em paralelo, com contas distintas, e gerar
  JSON, CSV e dashboard. Prioridade solicitada pelo usuario.
- [x] Configurar as tres volumetrias do desafio, sem executa-las:
  1.000 pedidos/1h (1 minuto por pedido), 5.000/2h (1,5 minutos)
  e 100.000/4h (2 minutos).
- [x] Revisar scripts, evidencias, exportacoes, dashboard e relatorio final.

Antes das compras, conferir que os carrinhos das contas estao vazios.
Se o teste paralelo validar o fluxo completo, registrar esse resultado sem
considerar realizada uma nova execucao isolada de um usuario.
O relatorio.txt so sera atualizado mediante autorizacao.

Resultado: fluxo completo validado para ambos os VUs em 27/10/2026, uma
iteracao por VU, 54/54 checks e todos os thresholds aprovados. Evidencias:
report/execucoes/2026-10-27-2vu/html/dashboard.html.
A validacao completa foi paralela; nao houve nova execucao isolada de 1 VU.

Revisao final: relatorio resumido para estrategia, correlacao, volumetrias,
resultado paralelo e limitacoes. README concentra comandos de reproducao.
Imports k6, sintaxe Python, links e resultados existentes foram conferidos,
sem executar novas compras. As cargas grandes permanecem sem execucao.

Para entrega: incluir a evidencia principal de 2 VUs junto dos scripts e
do relatorio, pois report/execucoes/ e ignorado pelo Git. Credenciais locais
nao devem ser incluidas; o script de cadastro permite gerar uma nova massa.
