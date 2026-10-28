# Evidencia de execucao - 27/10/2026

Executado com k6, 1 usuario virtual e 1 iteracao por tentativa, utilizando
a primeira conta de users-verificados.json. Foi criado um unico pedido: **2406107**.
Status confirmado posteriormente: **Pending**.

## Resultados e arquivos

- [pedido-criado.json](json/pedido-criado.json) / [pedido-criado.csv](csv/pedido-criado.csv): registro real do fluxo que criou
  o pedido. Login, busca, carrinho e checkout passaram. A consulta abriu o pedido
  correto, mas falhou ao extrair o status com o seletor inicial. O registro
  permanece com success=false e status vazio, preservando o resultado original.
- [pedido-consultado.json](json/pedido-consultado.json) / [pedido-consultado.csv](csv/pedido-consultado.csv): nova autenticacao e consulta
  do MESMO pedido depois da correcao do seletor. Sucesso, status Pending,
  10/10 checks aprovados. Essa execucao nao repetiu busca, carrinho ou checkout.
- [execucao-final.log](logs/execucao-final.log), [metricas-final.json](json/metricas-final.json), [resumo-final.json](json/resumo-final.json): log,
  amostras e resumo da tentativa que criou o pedido (25/26 checks aprovados).
- [consulta-corrigida.log](logs/consulta-corrigida.log), [metricas-consulta.json](json/metricas-consulta.json), [resumo-consulta.json](json/resumo-consulta.json):
  evidencias da consulta corrigida (10/10 checks aprovados).
- [pedido-2406107.html](html/pedido-2406107.html): HTML dos detalhes obtido com autenticacao; abrir
  localmente para inspecao. Pode conter dados ficticios da conta e do endereco.

As outras tentativas foram preservadas: a inicial encontrou restricao de rede;
as seguintes identificaram incompatibilidade no acesso aos elementos HTML,
espacos no caminho de adicao ao carrinho e nomes de etapas com sublinhado.
Nenhuma dessas tentativas anteriores confirmou pedido. Produtos adicionados
durante as tentativas podem ter permanecido no carrinho ate o checkout final.

## Correcoes aplicadas

- Leitura de elementos HTML via Selection.eq(index).
- Remocao de espacos ao redor da URL extraida do botao de compra.
- Normalizacao dos nomes de etapas do checkout (sublinhado para hifen).
- Extracao do status pelo texto Order Status quando nao existe .order-status.
- Metrica flow_success com threshold para impedir aprovacao de um fluxo
  interrompido por excecao mesmo quando os checks anteriores passaram.
- Interrupcao quando a pagina de login nao carrega.

## Limites da evidencia

As etapas foram verificadas com um pedido real de demonstracao, mas nao houve
uma nova execucao completa em uma unica iteracao apos a ultima correcao.
Nao foram mesclados resultados de execucoes diferentes em um sucesso artificial.
O teste de um usuario nao permite concluir capacidade ou estabilidade sob carga.
Nao foi alterado o relatorio.txt nesta atividade.

Para conferir manualmente, entre na primeira conta e acesse:
https://demowebshop.tricentis.com/orderdetails/2406107
