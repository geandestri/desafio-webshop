# Retencao de resultados

Cada execucao fica em `execucoes/AAAA-MM-DD-HHmmss/`, com subpastas
`logs/`, `json/`, `csv/` e `html/`. Os resultados nao sao versionados no Git.

Manter as cinco execucoes mais recentes, ordenadas pela data e hora no nome.
Nomes antigos como `2026-10-27-1vu` usam a data com horario 00:00:00.
Em empate, utiliza-se a data de modificacao da pasta.
Pastas com nomes fora desse padrao sao ignoradas.

Para simular a limpeza, a partir da raiz do projeto:

```powershell
python scripts/cleanup_reports.py
```

Para excluir as execucoes antigas listadas:

```powershell
python scripts/cleanup_reports.py --apply
```

A limpeza e manual, sem agendamento automatico. Para preservar uma execucao
como evidencia de entrega, crie um arquivo vazio chamado `ENTREGA` dentro dela.
Execucoes protegidas sao mantidas alem das cinco recentes. O script limita
a exclusao a subpastas diretas de `report/execucoes`, ignorando links e junctions.
O `relatorio.txt` fica fora dessa limpeza.
