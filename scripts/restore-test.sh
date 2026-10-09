#!/usr/bin/env bash
# TESTE DE RESTAURAÇÃO (rodar mensalmente): faz backup, restaura num banco SEPARADO e compara.
# Variáveis: BACKUP_DATABASE_URL (origem), RESTORE_DATABASE_URL (banco vazio de teste), BACKUP_GPG_RECIPIENT
set -euo pipefail
export BACKUP_DIR="$(mktemp -d)"; trap 'rm -rf "$BACKUP_DIR"' EXIT
unset BACKUP_BUCKET
./scripts/backup.sh >/dev/null
ARQ="$(ls "$BACKUP_DIR"/*.dump.gpg)"
echo "1) Backup gerado e cifrado: $(basename "$ARQ")"
if gpg --list-packets "$ARQ" 2>&1 | grep -q "encrypted data packet\|pubkey enc packet"; then echo "2) Arquivo está cifrado (GPG) — OK"; else echo "2) FALHA: arquivo não parece cifrado"; exit 1; fi
if gpg --batch --decrypt "$ARQ" 2>/dev/null | head -c 5 | grep -q PGDMP && ! grep -aq "INSERT INTO\|COPY public" "$ARQ"; then echo "3) Conteúdo ilegível sem a chave privada — OK"; fi
./scripts/restore.sh "$ARQ" >/dev/null
echo "4) Restaurado no banco de teste"
SQL="SELECT 'stores', count(*), md5(string_agg(id::text||nome||coalesce(cnpj,'')||segredos::text, ',' ORDER BY id)) FROM stores
 UNION ALL SELECT 'store_steps', count(*), md5(string_agg(store_id::text||etapa||status, ',' ORDER BY store_id, etapa)) FROM store_steps
 UNION ALL SELECT 'store_events', count(*), md5(string_agg(id::text||texto, ',' ORDER BY id)) FROM store_events
 UNION ALL SELECT 'audit_log', count(*), md5(string_agg(id::text||acao, ',' ORDER BY id)) FROM audit_log
 UNION ALL SELECT 'users', count(*), md5(string_agg(email||role, ',' ORDER BY email)) FROM users
 UNION ALL SELECT 'config', count(*), md5(string_agg(chave||coalesce(valor::text,'')||coalesce(valor_cifrado,''), ',' ORDER BY chave)) FROM config"
A="$(psql -At "$BACKUP_DATABASE_URL" -c "$SQL")"; B="$(psql -At "$RESTORE_DATABASE_URL" -c "$SQL")"
echo "5) Comparação origem x restaurado (tabela|linhas|hash):"; paste -d'  ' <(echo "$A") <(echo "$B" | sed 's/^/=> /')
[ "$A" = "$B" ] || { echo "FALHA: dados restaurados diferem da origem"; exit 1; }
TRG="$(psql -At "$RESTORE_DATABASE_URL" -c "SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'audit_log_no_%'")"
[ "$TRG" = "2" ] && echo "6) Proteção de auditoria (triggers) restaurada — OK" || { echo "FALHA: triggers ausentes"; exit 1; }
echo "RESULTADO: RESTAURAÇÃO OK ($(date -u +%FT%TZ))"
