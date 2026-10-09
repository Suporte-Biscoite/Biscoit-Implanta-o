# Arquitetura de segurança

```
 Navegador ──HTTPS/HSTS──► Cloud Run (São Paulo, 1 instância)            [opcional: Load Balancer + IAP na frente]
                             │ middleware: sem cookie de sessão = 401 / login; CSP com nonce; cabeçalhos
                             │ servidor: sessão no banco (8 h; 30 min ocioso) + papel + CSRF/Origin + limite de requisições
   Google OIDC ◄─────────────┤ login: assinatura do token, e-mail verificado, domínio (hd) e allowlist — tudo no servidor
   Sheets API (leitura) ◄────┤ identidade do serviço, escopo spreadsheets.readonly, sem arquivo de chave
   Secret Manager ──────────►│ FIELD_ENCRYPTION_KEYS, segredo OAuth, URL do banco
                             ▼ IP privado + TLS (banco nunca exposto à internet)
                    Cloud SQL (SP): criptografia em repouso + AES-256-GCM por campo; auditoria só-inclusão;
                    exclusão lógica; usuário da aplicação com menor privilégio
                             └► backup diário + PITR  →  dump cifrado (GPG) em bucket de OUTRA região com retenção bloqueada
```

## Como cada exigência foi atendida

| Exigência | Implementação | Onde |
|---|---|---|
| Nega por padrão | Middleware bloqueia tudo sem cookie (exceto login e robots); toda API usa `withApi`, toda página interna `requireUser`; teste automático falha se uma rota nova não estiver protegida | `src/middleware.ts`, `src/lib/auth.ts`, `tests/rotas-protegidas.test.ts` |
| Login Google restrito | OpenID Connect com state, nonce e PKCE; servidor exige `email_verified`, `hd` = domínio, e-mail do domínio **e** presença na allowlist ativa | `src/lib/oidc.ts`, `src/app/api/auth/callback/route.ts` |
| Perfis | ADMIN / OPERADOR / LEITOR, checados no servidor em cada API e página | `withApi(papel, ...)` |
| Sessão segura | Token aleatório de 256 bits; no banco só o hash SHA-256; cookie `__Host-`, HttpOnly, Secure, SameSite=Lax; 8 h máx., 30 min ocioso; logout apaga no servidor; bloquear usuário ou mudar papel encerra as sessões dele | `src/lib/auth.ts` |
| CSRF | Token por sessão no cabeçalho `x-csrf-token` **e** checagem do `Origin` | `withApi` |
| Força bruta / abuso | Limite por IP (geral 300/5 min; revelar 60; exportar 5; login 20/10 min). IP lido do fim do `X-Forwarded-For` (não forjável atrás do Cloud Run) | `src/lib/ratelimit.ts` |
| Criptografia por campo | AES-256-GCM (biblioteca nativa do Node), IV aleatório, AAD amarrando o valor à loja e ao campo (não dá para copiar o cifrado de uma loja para outra); chaves versionadas para rotação | `src/lib/crypto.ts` |
| Mascaramento | CPF `***.123.456-**`, tokens `****1234`, links ocultos; "revelar" só para OPERADOR+, auditado | `src/lib/mask.ts`, `/api/lojas/[id]/revelar` |
| Minimização | Senha do certificado e arquivo do certificado **nunca** são guardados (só "recebido" + link) | `src/lib/domain.ts` |
| SQL injection | 100% consultas parametrizadas; entradas validadas com Zod (tipo, formato, tamanho) | `src/lib/stores.ts` |
| XSS / injeção de HTML no e-mail | Todo valor escapado; só links http(s) viram `<a>`; CSP com nonce e sem `unsafe-inline` em scripts | `src/lib/email.ts` |
| Injeção de fórmula no .xlsx | Células de texto gravadas como `inlineStr` (nunca `<f>`) e com estilo `quotePrefix` + formato texto | `src/lib/onboarding.ts` |
| Cabeçalhos | CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy no-referrer, Permissions-Policy, COOP/CORP, X-Robots-Tag noindex, no-store | `next.config.mjs`, `src/middleware.ts` |
| Arquivos gerados | Criados sob demanda na memória, entregues só a requisição autenticada, `no-store`; nada em armazenamento público | rotas `email` e `onboarding` |
| Auditoria imutável | Tabela com trigger que recusa UPDATE/DELETE/TRUNCATE (até para o dono); usuário da app só tem INSERT/SELECT; registra logins (ok/falha), acessos negados, revelações, geração de e-mail/planilha, exportações, configurações e usuários, com usuário e IP | `db/migrations/001_init.sql`, `src/lib/audit.ts` |
| Menor privilégio no banco | Usuário de migração ≠ usuário da aplicação; app sem DELETE em lojas e auditoria | `docs/db-roles.sql` |
| Segredos fora do código | `.env*` no `.gitignore`; Secret Manager em produção; varredura própria + gitleaks no CI | `scripts/scan-secrets.mjs`, `.github/workflows/ci.yml` |
| Dependências | Next.js atualizado para 15.5.27 (a 14.x tinha falhas críticas) e postcss forçado para versão corrigida; `npm audit` = 0 vulnerabilidades; CI falha em high/critical | `package.json` |
| Dados de teste | Somente fictícios, gerados pelos algoritmos; varredura confirmou 0 ocorrências dos dados reais dos anexos | `tests/fixtures.ts` |

## Riscos que continuam (e o que recomendo)

1. **Limite de requisições em memória:** vale para 1 instância. Se aumentar `max-instances`, coloque Cloud Armor (regra de rate limit) ou mova o contador para o banco.
2. **Defesa em profundidade com IAP (recomendado):** Load Balancer + Identity-Aware Proxy restrito ao grupo do time de TI. Assim, falhas no app nem chegam a ser alcançáveis por quem é de fora. Custo baixo (o Load Balancer é a maior parte, ~US$ 18/mês).
3. **`style-src 'unsafe-inline'`:** necessário para exibir o e-mail formatado e alguns estilos inline. Scripts continuam bloqueados (nonce). Risco residual baixo porque todo conteúdo é escapado.
4. **Validação de I.E. completa só para SP**; demais UFs validam formato (Fase 2).
5. **Alertas por e-mail de eventos suspeitos** e **rotina de retenção** ficaram para a Fase 2 (os eventos já são auditados).
6. **Admin pode revelar e exportar tudo**: mantenha só 1–2 administradores e revise a auditoria (filtro `EXPORTACAO`, `CAMPO_REVELADO`) uma vez por mês.
7. **Os tokens CSC de produção estão em texto aberto no manual de implantação.** Recomendo removê-los do documento; se ele circulou fora do time, considere regerar o CSC na SEFAZ.
8. Nenhum sistema é 100% inviolável. Antes de dados reais, faça o checklist do README (seção 9); na Fase 3, revisão por terceiro.
