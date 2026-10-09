#!/usr/bin/env bash
# Restaura um backup cifrado em um banco DESTINO (nunca restaurar por cima da produção sem decisão explícita).
# Uso: RESTORE_DATABASE_URL=postgres://.../implantacao_restore ./scripts/restore.sh arquivo.dump.gpg
# Requer a CHAVE PRIVADA do backup importada no gpg da máquina que restaura (guardada offline pelo admin).
set -euo pipefail
ARQ="${1:?informe o arquivo .dump.gpg (ou gs://...)}"
: "${RESTORE_DATABASE_URL:?defina RESTORE_DATABASE_URL}"
if [[ "$RESTORE_DATABASE_URL" == *prod* && "${CONFIRMO_RESTAURAR_PRODUCAO:-}" != "sim" ]]; then
  echo "Destino parece produção. Defina CONFIRMO_RESTAURAR_PRODUCAO=sim se for mesmo isso."; exit 2; fi
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT; umask 077
if [[ "$ARQ" == gs://* ]]; then gcloud storage cp "$ARQ" "$ARQ.sha256" "$TMP/"; ARQ="$TMP/$(basename "$ARQ")"; fi
if [ -f "$ARQ.sha256" ]; then (cd "$(dirname "$ARQ")" && sha256sum -c "$(basename "$ARQ").sha256"); fi
gpg --batch --yes --decrypt "$ARQ" 2>/dev/null | pg_restore --no-owner --no-privileges --clean --if-exists --exit-on-error -d "$RESTORE_DATABASE_URL"
echo "Restauração concluída em: ${RESTORE_DATABASE_URL%%@*}@***"
