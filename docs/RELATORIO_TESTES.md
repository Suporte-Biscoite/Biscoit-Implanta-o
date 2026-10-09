# Relatório de testes — Fase 1

Data: 09/10/2026 · Código final da Fase 1 · Ambiente: Ubuntu 24.04, Node 22, PostgreSQL 16, app em **modo produção**.
Todos os dados usados são **fictícios** (CNPJ/CPF/I.E. gerados pelos algoritmos).

## Resumo
| Verificação | Resultado |
|---|---|
| Tipagem (TypeScript estrito) | ✅ sem erros |
| Testes unitários | ✅ **32/32** (9 arquivos) |
| Dependências (`npm audit`) | ✅ 0 vulnerabilidades |
| Segredos/dados pessoais no código (`scan:secrets`) | ✅ nenhum achado |
| Dados reais dos anexos no repositório | ✅ 0 ocorrências (CNPJs, I.E., tokens CSC, telefones, 18 e-mails, nomes) |
| Build de produção | ✅ |
| Segurança de ponta a ponta (seção D) | ✅ **40/40** |
| Backup cifrado + restauração | ✅ dados idênticos em 6 tabelas + dado sensível decifrado do banco restaurado |
| Telas no navegador (Chromium) | ✅ sem erros de console com a CSP; "Copiar e-mail formatado" leva a tabela de 16 linhas |

## Critérios de aceite
| # | Critério | Situação |
|---|---|---|
| 1 | E-mail com a mesma estrutura e campos do real | ✅ assunto, saudação por horário, 2 frases e tabela de 16 campos na ordem pedida (teste `email.test.ts`). ⚠️ **Falta a comparação lado a lado com o print real**, que não chegou. |
| 2 | .xlsx abre no Excel e no Sheets, com validações e 36 colunas | ✅ 36 colunas e 9 validações preservadas (aba Planilha3), abre no LibreOffice e openpyxl. ⚠️ **Não testei no Excel nem no Google Sheets** (indisponíveis aqui) — conferir ao receber. |
| 3 | Formulário incompleto → pendências exatas + mensagem | ✅ `pendencias.test.ts` (6 pendências esperadas, mensagem numerada, sem ecoar valores) |
| 4 | CNPJ/CPF inválidos rejeitados; sem CNPJ bloqueado | ✅ unitários + segurança (400 / 409) |
| 5 | Segurança da seção D + restauração | ✅ 40/40 e restauração OK |
| 6 | Nenhum dado real; README completo | ✅ varreduras zeradas; README com instalação, variáveis, Google, deploy, restauração e incidente |

## Segurança — detalhe (saída do `npm run test:security`)
| | Verificação |
|---|---|
| ✅ | Sem login: 27 rotas/APIs bloqueadas (401 ou redirecionamento p/ login) |
| ✅ | Cookie de sessão forjado → 401 |
| ✅ | Usuário bloqueado (fora da allowlist ativa) → 401 |
| ✅ | Sessão ociosa há 45 min → 401 (expira por inatividade) |
| ✅ | Login de desenvolvimento NÃO existe em produção → 404 |
| ✅ | Leitor consegue ver o painel (GET /api/lojas → 200) |
| ✅ | Leitor NÃO cadastra loja → 403 |
| ✅ | Operador NÃO acessa funções de administrador (7 APIs → 403) |
| ✅ | Operador NÃO abre a página de Configurações (redireciona) |
| ✅ | POST sem token CSRF válido → 403 |
| ✅ | POST vindo de outra origem (Origin) → 403 |
| ✅ | CNPJ inválido rejeitado → 400 |
| ✅ | Sem CNPJ e sem marcar 'ainda não tem' → 400 |
| ✅ | Loja com conteúdo malicioso é aceita como TEXTO (201) |
| ✅ | Tentativa de SQL injection não afetou o banco (tabela stores existe) |
| ✅ | Filtro com SQL injection → 400 |
| ✅ | ID com SQL injection → 404 |
| ✅ | E-mail gerado sem <script>/<img>/<svg> executáveis (HTML escapado) |
| ✅ | .xlsx sem fórmulas: valores =, +, -, @ gravados como texto |
| ✅ | .xlsx baixado só autenticado e sem cache |
| ✅ | Loja sem CNPJ: etapa não avança → 409 |
| ✅ | Loja sem CNPJ: e-mail do Nexaas bloqueado → 409 |
| ✅ | Loja sem CNPJ: onboarding bloqueado → 409 |
| ✅ | CPF e token gravados CIFRADOS no banco (não aparecem em texto) |
| ✅ | Leitura da loja devolve só a máscara (sem CPF/token completos) |
| ✅ | Leitor NÃO pode revelar campo sensível → 403 |
| ✅ | Revelar CPF funciona e fica na auditoria (só o nome do campo) |
| ✅ | Cabeçalho: CSP com nonce e frame-ancestors 'none' |
| ✅ | Cabeçalho: X-Frame-Options: DENY |
| ✅ | Cabeçalho: X-Content-Type-Options: nosniff |
| ✅ | Cabeçalho: Referrer-Policy: no-referrer |
| ✅ | Cabeçalho: HSTS |
| ✅ | Cabeçalho: X-Robots-Tag noindex |
| ✅ | Cabeçalho: Sem X-Powered-By |
| ✅ | Cabeçalho: Cache-Control no-store |
| ✅ | robots.txt bloqueia indexação |
| ✅ | Limite de requisições em rota sensível (revelar: 60 / 5 min) → 429 |
| ✅ | Auditoria imutável: UPDATE/DELETE/TRUNCATE recusados (inclusive para o dono)  (4/4 bloqueados) |
| ✅ | Usuário da aplicação não tem DELETE em stores (exclusão só lógica) |
| ✅ | Logout invalida a sessão no servidor (mesmo cookie → 401) |

## Restauração (saída do `npm run test:restore`)
```
1) Backup gerado e cifrado: implantacao-diario-20261009T145853Z.dump.gpg
2) Arquivo está cifrado (GPG) — OK
3) Conteúdo ilegível sem a chave privada — OK
4) Restaurado no banco de teste
5) Comparação origem x restaurado (tabela|linhas|hash):
stores|2|173fa6bca9be89e1e36d8a1378a2fb47 => stores|2|173fa6bca9be89e1e36d8a1378a2fb47
store_steps|22|22afdb4ef65d3996b1a34dc39ad44573 => store_steps|22|22afdb4ef65d3996b1a34dc39ad44573
store_events|5|d4d3b9163f6b916a5751216e23a7a8fd => store_events|5|d4d3b9163f6b916a5751216e23a7a8fd
audit_log|75|13c7529a8609e572f14994f78ea34556 => audit_log|75|13c7529a8609e572f14994f78ea34556
users|5|338107abca44a127133ac6b13cbff861 => users|5|338107abca44a127133ac6b13cbff861
config|0| => config|0|
6) Proteção de auditoria (triggers) restaurada — OK
RESULTADO: RESTAURAÇÃO OK (2026-10-09T14:58:53Z)
CPF decifrado do banco RESTAURADO (fictício, mascarado): ***.982.247-** | chave v1
```

## Problemas encontrados e corrigidos durante os testes
1. **Next.js 14 com falhas críticas** (incl. execução remota de código) → atualizado para 15.5.27 + postcss corrigido.
2. **Modelo do Nexaas com e-mails reais escondidos** num hyperlink interno e dados na linha 2 → modelo sanitizado (`npm run make-template`).
3. **IP forjável** (primeiro valor do `X-Forwarded-For`) permitiria burlar o limite de requisições e falsear a auditoria → passa a usar o valor acrescentado pelo proxy confiável.
4. **Limite de requisições compartilhado** entre rotas → contador geral + contador por rota.
5. **Falsas pendências** na loja própria e **mensagem enganosa** ao franqueado antes da importação do formulário → corrigidos (vistos nas telas).
6. **Script de demonstração com traços de dados reais** (CEP/número da loja de Osasco, prefixos de CNPJ/I.E.) → trocados por valores fictícios.

## Limitações deste relatório
- O login Google real não foi exercitado (sem rede para o Google aqui). As regras de autorização das claims têm teste unitário e o fluxo usa a biblioteca `openid-client`; teste o login uma vez em homologação.
- A leitura real das planilhas não foi exercitada (sem acesso). A lógica de mapeamento e busca tem testes com planilhas simuladas.
- O Dockerfile e o workflow de CI não foram executados aqui (sem Docker/GitHub neste ambiente).
