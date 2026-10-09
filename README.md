# Sistema de Implantação de Lojas — Biscoitê

Sistema web interno do time de TI para acompanhar a implantação de lojas (franquias, lojas próprias e repasses):
cadastro passo a passo, checklist por loja, painel com alertas, leitura das planilhas do Google, detecção de
pendências, e-mail pronto para o Nexaas e planilha de onboarding (.xlsx).

> ⚠️ **Não coloque dados reais** antes de concluir a seção "Antes de usar com dados reais" no fim deste arquivo.

## Sumário
1. [O que tem aqui](#1-o-que-tem-aqui)
2. [Rodar no seu computador (passo a passo)](#2-rodar-no-seu-computador)
3. [Variáveis de ambiente](#3-variáveis-de-ambiente)
4. [Conectar o Google (login e planilhas)](#4-conectar-o-google)
5. [Deploy no Google Cloud (São Paulo)](#5-deploy-no-google-cloud)
6. [Backup e restauração](#6-backup-e-restauração)
7. [Plano de resposta a incidente](#7-plano-de-resposta-a-incidente)
8. [Testes](#8-testes)
9. [Antes de usar com dados reais](#9-antes-de-usar-com-dados-reais)

Documentos complementares: [`docs/SEGURANCA.md`](docs/SEGURANCA.md) · [`docs/BACKUP.md`](docs/BACKUP.md) ·
[`docs/MAPEAMENTO_E_SUPOSICOES.md`](docs/MAPEAMENTO_E_SUPOSICOES.md) · [`docs/RELATORIO_TESTES.md`](docs/RELATORIO_TESTES.md) ·
[`docs/FASE2.md`](docs/FASE2.md)

---

## 1. O que tem aqui

| Pasta | Conteúdo |
|---|---|
| `src/app` | Páginas e APIs (Next.js 15). Páginas internas ficam em `src/app/(app)` (todas exigem login). |
| `src/lib` | Regras de negócio: validadores, pendências, e-mail, onboarding, checklist, segurança, banco. |
| `src/components` | Telas interativas (assistente de cadastro, detalhe da loja, configurações). |
| `db/migrations` | Estrutura do banco (PostgreSQL). |
| `templates/onboarding-template.xlsx` | Modelo do Nexaas **sem dados** (gerado por `npm run make-template`). |
| `scripts/` | Migração, backup/restauração, testes de segurança, leitura de cabeçalhos, dados de demonstração. |
| `tests/` | Testes automáticos (só dados fictícios). |

**Stack:** Next.js 15 + TypeScript, PostgreSQL 16, login Google (OpenID Connect).
**Hospedagem recomendada:** Cloud Run + Cloud SQL em `southamerica-east1` (São Paulo).
Custo estimado: **US$ 15–40/mês** (o Cloud SQL é quase todo o custo; confira na calculadora do GCP).

## 2. Rodar no seu computador

Pré-requisitos: **Node.js 22**, **PostgreSQL 16** e **GnuPG** (para o backup).

```bash
# 1. Instalar dependências
npm ci

# 2. Criar o banco e os usuários (no psql como administrador "postgres")
psql -U postgres -c "CREATE ROLE dono_implantacao LOGIN PASSWORD 'TROCAR'"
psql -U postgres -c "CREATE DATABASE implantacao OWNER dono_implantacao"

# 3. Criar as tabelas e o primeiro administrador (use o SEU e-mail da empresa)
DATABASE_URL=postgres://dono_implantacao:TROCAR@localhost:5432/implantacao \
INITIAL_ADMINS=seu.email@biscoite.com.br npm run migrate

# 4. Criar o usuário da aplicação (menor privilégio: não apaga auditoria nem lojas)
psql -U postgres -d implantacao -v senha_app='TROCAR_APP' -f docs/db-roles.sql

# 5. Configurar o ambiente
cp .env.example .env.local
openssl rand -base64 32        # cole o resultado em FIELD_ENCRYPTION_KEYS=v1=<aqui>
# edite .env.local: DATABASE_URL com o usuário app_implantacao e a senha do passo 4

# 6. Subir
npm run dev                    # http://localhost:3000
```

**Entrar sem configurar o Google (só no seu computador):** em `.env.local`, defina
`DEV_LOGIN_ENABLED=true` e acesse `http://localhost:3000/api/auth/dev-login?email=seu.email@biscoite.com.br`.
Essa rota **não existe em produção** (testado).

**Dados de demonstração (fictícios):** com o app rodando,
`ALLOW_SEED=sim BASE_URL=http://localhost:3000 DATABASE_URL=<url do dono> npm run seed:demo`.

## 3. Variáveis de ambiente

| Variável | Para quê | Onde fica em produção |
|---|---|---|
| `APP_URL` | Endereço público (ex.: `https://implantacao.biscoite.com.br`) | variável do Cloud Run |
| `DATABASE_URL` | Conexão com o usuário **app_implantacao** | Secret Manager |
| `DATABASE_SSL` | `require` em produção | variável |
| `FIELD_ENCRYPTION_KEYS` | Chaves AES-256 da criptografia por campo (`v1=...;v2=...`, a última é a atual) | Secret Manager — **e cópia offline** (ver seção 6) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login Google | Secret Manager |
| `ALLOWED_DOMAIN` | Domínio aceito no login (`biscoite.com.br`) | variável |
| `INITIAL_ADMINS` | Só para o `npm run migrate` | — |
| `SESSION_MAX_HOURS` / `SESSION_IDLE_MINUTES` | Sessão: 8 h no máximo, 30 min de inatividade | variável |
| `TRUSTED_PROXY_HOPS` | Proxies confiáveis à frente (Cloud Run = 1) | variável |
| `RATE_LIMIT_API` | Requisições por IP a cada 5 min (padrão 300) | variável |
| `DEV_LOGIN_ENABLED` | Só desenvolvimento; ignorado em produção | **não definir** |
| `GOOGLE_APPLICATION_CREDENTIALS` | Só local: JSON da conta de serviço, **fora** do projeto | não usar no Cloud Run |

Regras: `.env*` nunca vai para o git (já está no `.gitignore`); `npm run scan:secrets` confere antes do commit.

## 4. Conectar o Google

### 4.1 Login (OAuth)
1. Console do GCP → **APIs e serviços → Tela de consentimento OAuth** → tipo **Interno** (só contas do Workspace).
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web.**
3. URI de redirecionamento autorizado: `https://SEU-DOMINIO/api/auth/callback` (e `http://localhost:3000/api/auth/callback` para testes).
4. Copie o ID e o segredo para o Secret Manager (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
5. Libere os usuários em **Usuários** dentro do sistema. Ter conta no domínio **não basta**: a pessoa precisa estar na lista (allowlist).
6. **Exigir verificação em duas etapas:** Admin Console do Google Workspace → **Segurança → Autenticação → Verificação em duas etapas** →
   marque *Permitir* e *Aplicação obrigatória* para a unidade organizacional do time de TI (de preferência com chave de segurança ou app autenticador).

### 4.2 Leitura das planilhas (somente leitura, sem chave em arquivo)
O sistema lê os arquivos **pela API do Drive**, porque o pipeline (`BASE DE LOJAS DA REDE E IMPLANTAÇÕES.xlsx`) é um
**arquivo .xlsx guardado no Drive**, não uma planilha Google — e a API do Sheets não lê .xlsx. A planilha de respostas
(planilha Google) é exportada como .xlsx na hora. Nos dois casos, só leitura.

1. Ative a **Google Drive API** no projeto.
2. Crie uma conta de serviço sem nenhum papel: `implantacao-app@PROJETO.iam.gserviceaccount.com`.
3. Compartilhe **somente os dois arquivos** com o e-mail da conta de serviço, como **Leitor**:
   a planilha de respostas e o arquivo .xlsx do pipeline. Não compartilhe pastas.
   O escopo é `drive.readonly`, mas a conta de serviço só enxerga o que foi compartilhado com ela.
4. No Cloud Run, use essa conta como **identidade do serviço**: nenhum arquivo de chave (nada para vazar nem rotacionar).
5. **Passo 0 — já feito em 09/10/2026:** os cabeçalhos reais estão na configuração padrão
   (ver `docs/MAPEAMENTO_E_SUPOSICOES.md`). Se o formulário ou o pipeline mudarem de colunas, rode
   `npm run sheets:headers <ID_RESPOSTAS> <ID_PIPELINE>` — imprime **só a linha de cabeçalho** de cada aba — e ajuste em **Configurações**.
   Para rodar no seu computador: `gcloud auth application-default login --impersonate-service-account=implantacao-app@PROJETO.iam.gserviceaccount.com`
   (seu usuário precisa do papel *Criador de token da conta de serviço* nessa conta).
6. Em **Configurações → Links e planilhas**, preencha `respostas_sheet_id` e `pipeline_sheet_id` com o ID de cada arquivo
   (o trecho entre `/d/` e `/edit` ou `/view` da URL). `pipeline_aba` vazio = primeira aba.

> ⚠️ A planilha de respostas tem uma coluna **"Senha"** (senha do certificado digital, em texto aberto).
> O sistema **nunca lê** colunas de senha (há trava no código e teste automático). Recomendo ao time limitar quem
> acessa essa planilha e apagar as senhas antigas depois que o Nexaas configurar o certificado.

## 5. Deploy no Google Cloud

Tudo em `southamerica-east1`. Comandos de referência (troque `PROJETO`):

```bash
# Banco: Cloud SQL Postgres 16, IP PRIVADO, backup automático + recuperação em ponto no tempo
gcloud sql instances create implantacao-db --database-version=POSTGRES_16 --region=southamerica-east1 \
  --tier=db-g1-small --no-assign-ip --network=default --enable-point-in-time-recovery \
  --backup-start-time=05:00 --retained-backups-count=30 --retained-transaction-log-days=7 \
  --require-ssl --deletion-protection
gcloud sql databases create implantacao --instance=implantacao-db

# Segredos
printf '%s' "v1=$(openssl rand -base64 32)" | gcloud secrets create FIELD_ENCRYPTION_KEYS --data-file=-
# (idem DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)

# App: build da imagem e deploy (1 instância: o limite de requisições fica em memória)
gcloud run deploy implantacao --source . --region=southamerica-east1 \
  --service-account=implantacao-app@PROJETO.iam.gserviceaccount.com \
  --max-instances=1 --network=default --subnet=default --vpc-egress=private-ranges-only \
  --set-env-vars=APP_URL=https://SEU-DOMINIO,ALLOWED_DOMAIN=biscoite.com.br,DATABASE_SSL=require,TRUSTED_PROXY_HOPS=1 \
  --set-secrets=DATABASE_URL=DATABASE_URL:latest,FIELD_ENCRYPTION_KEYS=FIELD_ENCRYPTION_KEYS:latest,GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest
```

Depois do primeiro deploy: rode as migrações (Cloud SQL Auth Proxy + `npm run migrate`), aplique `docs/db-roles.sql`
e mapeie um domínio próprio com HTTPS (o Cloud Run emite o certificado).
**Camada extra recomendada:** colocar o Cloud Run atrás de um Load Balancer com **Identity-Aware Proxy (IAP)** — o Google
barra quem não é do time antes mesmo de chegar no app (ver `docs/SEGURANCA.md`).

## 6. Backup e restauração

Resumo (o roteiro completo, com o teste mensal, está em [`docs/BACKUP.md`](docs/BACKUP.md)):

- **Camada 1 — Cloud SQL:** backup diário automático (30 dias) + recuperação em ponto no tempo (7 dias).
- **Camada 2 — `scripts/backup.sh`:** dump diário **cifrado com chave pública GPG** enviado a um bucket em **outra região**,
  com versionamento e retenção bloqueada (30 dias para diários, 12 meses para mensais).
- **Restaurar:** `RESTORE_DATABASE_URL=... ./scripts/restore.sh gs://bucket/diario/arquivo.dump.gpg`
- **Testar (todo mês):** `npm run test:restore` — restaura num banco separado e compara tabela por tabela.

> 🔑 **A chave `FIELD_ENCRYPTION_KEYS` precisa de cópia offline separada** (ex.: cofre de senhas da empresa + envelope lacrado).
> Os CPFs, documentos e tokens ficam cifrados *dentro* do backup: sem essa chave, o backup restaura mas esses campos ficam ilegíveis.
> Guarde em local diferente da chave privada GPG do backup.

## 7. Plano de resposta a incidente

Use quando houver suspeita de acesso indevido, vazamento, conta comprometida ou perda de dados.

| # | Ação | Como |
|---|---|---|
| 1 | **Conter** | Em **Usuários**, bloqueie a conta suspeita (encerra as sessões na hora). Se o alcance for incerto: `DELETE FROM sessions;` (todos saem) ou `gcloud run services update implantacao --max-instances=0` (tira o site do ar). |
| 2 | **Preservar evidências** | Exporte a **Auditoria** (logins, revelações, exportações, IPs) e os logs do Cloud Run do período. Não apague nada. |
| 3 | **Trocar segredos** | Novo `GOOGLE_CLIENT_SECRET`; nova senha do usuário do banco; nova chave em `FIELD_ENCRYPTION_KEYS` (adicione `v2`, mantenha `v1` até recifrar — rotina na Fase 2); se tokens CSC ou certificados de lojas puderem ter vazado, peça às lojas para **regerar o CSC na SEFAZ** e revogar o certificado. |
| 4 | **Restaurar** (se houve perda ou adulteração) | Recuperação em ponto no tempo do Cloud SQL para antes do incidente, ou `restore.sh` do último backup íntegro. Valide antes de liberar o acesso. |
| 5 | **Avisar** | Gestor de TI e o encarregado de dados (DPO) da Biscoitê no mesmo dia. Se o incidente puder causar risco ou dano relevante aos titulares, a empresa deve **comunicar a ANPD e os titulares** (LGPD, art. 48), no prazo da regulamentação vigente da ANPD (hoje, 3 dias úteis — confirme com o jurídico). |
| 6 | **Corrigir e registrar** | Corrija a causa, rode `npm run test:security`, e registre: o que aconteceu, dados afetados, titulares, medidas tomadas. |

## 8. Testes

```bash
npm test                 # 32 testes unitários (dados fictícios)
npm run typecheck
npm run scan:secrets     # segredos e dados pessoais nos arquivos versionados
npm audit --audit-level=high
npm run test:security    # 40 verificações de segurança contra o app rodando (ver docs/RELATORIO_TESTES.md)
npm run test:restore     # backup → restauração → comparação
```
O CI (`.github/workflows/ci.yml`) roda tudo isso a cada push, mais o gitleaks.

## 9. Antes de usar com dados reais

- [ ] Deploy em produção com HTTPS, Cloud SQL com IP privado e segredos no Secret Manager
- [ ] Verificação em duas etapas **obrigatória** no Workspace para o time de TI
- [ ] Allowlist com só quem precisa; apenas 1–2 administradores
- [ ] `npm run test:security` **contra o ambiente de produção vazio** (com `TEST_DB_URL` de um banco de teste — nunca o de produção)
- [ ] Bucket de backup criado em outra região com retenção bloqueada, e **um teste de restauração feito**
- [ ] Cópia offline da `FIELD_ENCRYPTION_KEYS` e da chave privada GPG, em locais diferentes
- [ ] Configurações preenchidas (destinatários, padrões das próprias, testemunha, CSC de SP)
- [ ] Remover os tokens CSC do manual de implantação (hoje estão em texto aberto no documento)
- [x] Comparar um e-mail gerado com o print real do e-mail ao Nexaas, lado a lado (feito em 09/10/2026)
