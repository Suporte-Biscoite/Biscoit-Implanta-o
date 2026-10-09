-- 001_init.sql — esquema inicial do Sistema de Implantação de Lojas
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- Usuários autorizados (allowlist individual). Só quem está aqui e ativo entra.
CREATE TABLE users (
  email       text PRIMARY KEY CHECK (email = lower(email)),
  nome        text,
  role        text NOT NULL CHECK (role IN ('ADMIN','OPERADOR','LEITOR')),
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  criado_por  text
);

-- Sessões no servidor: o cookie leva um token aleatório; aqui guardamos só o hash.
CREATE TABLE sessions (
  token_hash   text PRIMARY KEY,
  user_email   text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  csrf_token   text NOT NULL,
  criada_em    timestamptz NOT NULL DEFAULT now(),
  visto_em     timestamptz NOT NULL DEFAULT now(),
  expira_em    timestamptz NOT NULL,
  ip           text,
  user_agent   text
);
CREATE INDEX sessions_user_idx ON sessions(user_email);

-- Estado temporário do fluxo OAuth (state/nonce/PKCE), expira em 10 min.
CREATE TABLE auth_flows (
  state          text PRIMARY KEY,
  nonce          text NOT NULL,
  code_verifier  text NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- Configurações editáveis pelo administrador. Valores sensíveis ficam cifrados (valor_cifrado).
CREATE TABLE config (
  chave           text PRIMARY KEY,
  valor           jsonb,
  sensivel        boolean NOT NULL DEFAULT false,
  valor_cifrado   text,
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  atualizado_por  text
);

-- Lojas em implantação.
CREATE TABLE stores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo              text NOT NULL CHECK (tipo IN ('FRANQUIA','PROPRIA','REPASSE_FF','REPASSE_FP')),
  nome              text NOT NULL CHECK (nome = upper(nome) AND length(nome) BETWEEN 3 AND 120),
  email_loja        text,
  uf                char(2) NOT NULL,
  cnpj              char(14) CHECK (cnpj ~ '^[0-9]{14}$'),
  sem_cnpj          boolean NOT NULL DEFAULT false,
  data_inauguracao  date,
  observacoes       text,
  dados             jsonb NOT NULL DEFAULT '{}'::jsonb,  -- dados não sensíveis (endereço, razão social...)
  segredos          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- cada valor cifrado individualmente (AES-256-GCM)
  form_sincronizado_em timestamptz,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  criado_por        text NOT NULL,
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  excluido_em       timestamptz,          -- exclusão lógica (soft delete)
  excluido_por      text,
  CHECK (sem_cnpj OR cnpj IS NOT NULL)
);
CREATE UNIQUE INDEX stores_cnpj_ativo_uq ON stores(cnpj) WHERE excluido_em IS NULL AND cnpj IS NOT NULL;

-- Checklist por loja.
CREATE TABLE store_steps (
  store_id     uuid NOT NULL REFERENCES stores(id),
  etapa        text NOT NULL,
  status       text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','NAO_SE_APLICA')),
  data         date,
  observacao   text,
  responsavel  text,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por text,
  PRIMARY KEY (store_id, etapa)
);

-- Histórico e anotações por loja.
CREATE TABLE store_events (
  id          bigserial PRIMARY KEY,
  store_id    uuid NOT NULL REFERENCES stores(id),
  tipo        text NOT NULL,   -- NOTA | ALTERACAO | EMAIL_GERADO | ONBOARDING_GERADO | FORM_SINCRONIZADO ...
  texto       text NOT NULL,
  user_email  text NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX store_events_store_idx ON store_events(store_id, criado_em DESC);

-- Log de auditoria: SOMENTE INCLUSÃO.
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  em          timestamptz NOT NULL DEFAULT now(),
  user_email  text,
  ip          text,
  acao        text NOT NULL,
  alvo        text,
  detalhe     jsonb
);
CREATE INDEX audit_log_em_idx ON audit_log(em DESC);

CREATE FUNCTION audit_log_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é somente inclusão (operação % bloqueada)', TG_OP;
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_imutavel();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_imutavel();

-- Controle de migrações
CREATE TABLE IF NOT EXISTS schema_migrations (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now());
