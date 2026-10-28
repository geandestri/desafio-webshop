Massa local de usuarios (JSON com email e password).

- users-verificados.json: duas contas com cadastro e login confirmados.
- users.json: arquivo vazio da tentativa inicial bloqueada pela rede.

Os arquivos JSON desta pasta contem credenciais e sao ignorados pelo Git.
Para usar a massa no PowerShell, a partir da raiz:

```powershell
$env:USERS_FILE = (Resolve-Path 'data/users-verificados.json').Path
```
