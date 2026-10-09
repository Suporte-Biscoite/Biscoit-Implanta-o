# Backup e restauração — roteiro (runbook)

## Visão geral (regra 3-2-1)
| Cópia | Onde | Retenção | Proteção |
|---|---|---|---|
| 1. Banco em uso | Cloud SQL `southamerica-east1` | — | criptografia em repouso + campos AES-256-GCM |
| 2. Backup automático + PITR | Cloud SQL (gerenciado pelo Google) | 30 backups diários + 7 dias de logs | `--deletion-protection` na instância |
| 3. Dump lógico cifrado | Bucket em **outra região** (ex.: `southamerica-west1` ou `us-east1`) | 30 dias (diários) e 12 meses (mensais) | GPG (chave pública), versionamento, **retenção bloqueada** |

## Preparação (uma vez)

1. **Par de chaves GPG do backup** — no computador do administrador, NÃO no servidor:
   ```bash
   gpg --quick-gen-key "backup-implantacao@biscoite.com.br" rsa4096 encrypt 3y
   gpg --armor --export backup-implantacao@biscoite.com.br > backup-publica.asc       # vai para o job de backup
   gpg --armor --export-secret-keys backup-implantacao@biscoite.com.br > PRIVADA.asc  # cofre offline
   ```
   Guarde `PRIVADA.asc` (e a senha dela) no cofre da empresa + mídia offline. Ela **não** fica na nuvem.
2. **Bucket com retenção bloqueada** (resistente a exclusão acidental e ransomware):
   ```bash
   gcloud storage buckets create gs://biscoite-implantacao-backup --location=southamerica-west1 \
     --uniform-bucket-level-access --public-access-prevention
   gcloud storage buckets update gs://biscoite-implantacao-backup --versioning
   gcloud storage buckets update gs://biscoite-implantacao-backup --retention-period=30d
   # Regras de ciclo de vida: apagar diario/ após 35 dias e mensal/ após 400 dias (lifecycle.json)
   # Depois de testar: travar a retenção (IRREVERSÍVEL): gcloud storage buckets update ... --lock-retention-period
   ```
   Acesso ao bucket: só a conta de serviço do backup (`roles/storage.objectCreator`, sem permissão de apagar) e o administrador. Ative os **logs de acesso a dados** do Cloud Storage para registrar quem leu.
3. **Job diário:** Cloud Run Job (ou Cloud Scheduler + Job) com a imagem `postgres:16` + `gcloud`, importando `backup-publica.asc` e rodando `scripts/backup.sh` com
   `BACKUP_DATABASE_URL` (usuário só leitura), `BACKUP_GPG_RECIPIENT` e `BACKUP_BUCKET`. No dia 1 de cada mês o arquivo vai para `mensal/`.
4. **Chave de campo:** guarde também uma cópia offline de `FIELD_ENCRYPTION_KEYS` (local diferente da chave GPG). Sem ela, CPF/tokens do backup ficam ilegíveis.

## Restaurar (passo a passo)

1. **Decida o ponto de restauração.** Erro recente (minutos/horas)? Prefira o PITR do Cloud SQL:
   `gcloud sql instances clone implantacao-db implantacao-restaurado --point-in-time="2026-10-09T12:00:00Z"` → valide → aponte o app.
2. **Dump cifrado** (perda maior, outra região, conta comprometida):
   ```bash
   gpg --import PRIVADA.asc                                   # na máquina do administrador
   createdb implantacao_restore                               # banco NOVO, nunca por cima da produção
   psql -d implantacao_restore -c "CREATE EXTENSION IF NOT EXISTS pgcrypto"
   RESTORE_DATABASE_URL=postgres://.../implantacao_restore ./scripts/restore.sh gs://biscoite-implantacao-backup/diario/ARQUIVO.dump.gpg
   ```
   O script confere o SHA-256 antes de restaurar.
3. **Valide:** contagem de lojas, uma loja conhecida abrindo com CPF mascarado (prova que a chave de campo confere), auditoria presente.
4. Reaplique `docs/db-roles.sql`, aponte a `DATABASE_URL` do app e **registre** a restauração.

## Teste de restauração (mensal — obrigatório)
```bash
BACKUP_DATABASE_URL=<origem> RESTORE_DATABASE_URL=<banco vazio de teste> BACKUP_GPG_RECIPIENT=<chave> npm run test:restore
```
O script: faz o backup, confirma que está cifrado e ilegível, restaura num banco separado, compara linhas **e hash** de 6 tabelas
e confere as proteções da auditoria. Anote data e resultado. O CI também roda este teste a cada push (com banco e chave descartáveis).

**Último resultado:** ver `docs/RELATORIO_TESTES.md`.

## Exportação completa (administrador)
**Configurações → Exportação completa cifrada**: JSON cifrado (scrypt + AES-256-GCM) com senha de 16+ caracteres; registrado na auditoria.
Abrir: `node scripts/decrypt-export.mjs exportacao-AAAA-MM-DD.enc.json > saida.json` (a senha é pedida no terminal).
