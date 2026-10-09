#!/usr/bin/env bash
# Backup lógico CIFRADO do banco (complementa o backup automático + PITR do Cloud SQL).
# - pg_dump em formato custom -> cifrado com a CHAVE PÚBLICA GPG do backup (o servidor não consegue decifrar)
# - envia para um bucket em OUTRA região, com versionamento e retenção bloqueada (ver docs/BACKUP.md)
# Variáveis: BACKUP_DATABASE_URL, BACKUP_GPG_RECIPIENT (id/e-mail da chave pública importada),
#            BACKUP_DIR (padrão ./backups), BACKUP_BUCKET (opcional, ex.: gs://biscoite-implantacao-backup)
set -euo pipefail
: "${BACKUP_DATABASE_URL:?defina BACKUP_DATABASE_URL}"
: "${BACKUP_GPG_RECIPIENT:?defina BACKUP_GPG_RECIPIENT}"
DIR="${BACKUP_DIR:-./backups}"; mkdir -p "$DIR"; chmod 700 "$DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TIPO="diario"; [ "$(date -u +%d)" = "01" ] && TIPO="mensal"
OUT="$DIR/implantacao-$TIPO-$STAMP.dump.gpg"
umask 077
# O dump nunca toca o disco em texto claro: vai direto do pg_dump para o gpg.
pg_dump --format=custom --no-owner --no-privileges "$BACKUP_DATABASE_URL" \
  | gpg --batch --yes --trust-model always --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --cipher-algo AES256 --output "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
echo "Backup cifrado: $OUT ($(du -h "$OUT" | cut -f1))"
if [ -n "${BACKUP_BUCKET:-}" ]; then
  gcloud storage cp "$OUT" "$OUT.sha256" "$BACKUP_BUCKET/$TIPO/"
  echo "Enviado para $BACKUP_BUCKET/$TIPO/"
  rm -f "$OUT" "$OUT.sha256"   # a cópia local não fica no servidor
fi
