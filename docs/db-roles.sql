-- Menor privilégio no PostgreSQL. Rodar UMA vez com o usuário administrador (no Cloud SQL: "postgres"),
-- depois apontar DATABASE_URL da aplicação para o usuário "app_implantacao".
-- O usuário das migrações (owner) NÃO deve ser o mesmo da aplicação.
-- Uso: psql "$ADMIN_URL_DO_BANCO_implantacao" -v senha_app='...' -f docs/db-roles.sql
CREATE ROLE app_implantacao LOGIN PASSWORD :'senha_app';
GRANT CONNECT ON DATABASE implantacao TO app_implantacao;
GRANT USAGE ON SCHEMA public TO app_implantacao;
GRANT SELECT, INSERT, UPDATE ON users, sessions, auth_flows, config, stores, store_steps, store_events TO app_implantacao;
GRANT DELETE ON sessions, auth_flows TO app_implantacao;   -- logout e limpeza de fluxos OAuth
GRANT SELECT, INSERT ON audit_log TO app_implantacao;      -- auditoria: só inclusão
GRANT USAGE ON SEQUENCE audit_log_id_seq, store_events_id_seq TO app_implantacao;
-- Sem DELETE em stores: exclusão é sempre lógica (excluido_em).
