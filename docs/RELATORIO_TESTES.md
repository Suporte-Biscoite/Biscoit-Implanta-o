# Relatório de testes — Fase 1

Data: 09/10/2026 (2ª rodada, após o print do e-mail real e a leitura das planilhas) · Código final da Fase 1 · Ambiente: Ubuntu 24.04, Node 22, PostgreSQL 16, app em **modo produção**.
Todos os dados usados são **fictícios** (CNPJ/CPF/I.E. gerados pelos algoritmos).

## Resumo
| Verificação | Resultado |
|---|---|
| Tipagem (TypeScript estrito) | ✅ sem erros |
| Testes unitários | ✅ **44/44** (10 arquivos) |
| Dependências (`npm audit`) | ✅ 0 vulnerabilidades |
| Segredos/dados pessoais no código (`scan:secrets`) | ✅ nenhum achado |
| Dados reais dos anexos e do print no repositório | ✅ 0 ocorrências (CNPJs, I.E., CPFs, tokens CSC, links do Drive, telefones, 18 e-mails, nomes) |
| Build de produção | ✅ |
| Segurança de ponta a ponta (seção D) | ✅ **40/40** |
| Backup cifrado + restauração | ✅ dados idênticos em 6 tabelas + dado sensível decifrado do banco restaurado |
| Telas no navegador (Chromium) | ✅ sem erros de console com a CSP; "Copiar e-mail formatado" leva a tabela de 16 linhas |

## Critérios de aceite
| # | Critério | Situação |
|---|---|---|
| 1 | E-mail com a mesma estrutura e campos do real | ✅ **comparado lado a lado com o print real**: assunto e texto com o nome de exibição ("União Osasco"), nome em MAIÚSCULO na tabela, 16 rótulos idênticos (inclusive os pontos finais), endereço em 3 linhas, contato financeiro em várias linhas, frase da inauguração sem ponto, azul claro e bordas pretas. Diferença intencional: CPF da testemunha formatado. |
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
1) Backup gerado e cifrado: implantacao-diario-20261009T151152Z.dump.gpg
2) Arquivo está cifrado (GPG) — OK
3) Conteúdo ilegível sem a chave privada — OK
4) Restaurado no banco de teste
5) Comparação origem x restaurado (tabela|linhas|hash):
stores|4|b50a78d627f2807592a24daf42bd82e6 => stores|4|b50a78d627f2807592a24daf42bd82e6
store_steps|44|7c719a2b77b8aae31bd6541f4560151c => store_steps|44|7c719a2b77b8aae31bd6541f4560151c
store_events|10|4d04ae0e3f00b2237c21d39b46d828ee => store_events|10|4d04ae0e3f00b2237c21d39b46d828ee
audit_log|150|01188220ab099c91c82177205d7c277f => audit_log|150|01188220ab099c91c82177205d7c277f
users|5|338107abca44a127133ac6b13cbff861 => users|5|338107abca44a127133ac6b13cbff861
config|0| => config|0|
6) Proteção de auditoria (triggers) restaurada — OK
RESULTADO: RESTAURAÇÃO OK (2026-10-09T15:11:52Z)
```

## Problemas encontrados e corrigidos durante os testes
0. **(2ª rodada) O pipeline é um .xlsx guardado no Drive**, não uma planilha Google: a API do Sheets falharia em produção → leitura pelo Drive + leitor de .xlsx próprio; cabeçalho detectado na linha 3; datas do Excel convertidas; "PREVISÃO INAUGURAÇÃO" como reserva.
0b. **(2ª rodada) A planilha de respostas tem a senha do certificado em texto aberto** → o leitor ignora qualquer coluna de senha (trava + teste).
1. **Next.js 14 com falhas críticas** (incl. execução remota de código) → atualizado para 15.5.27 + postcss corrigido.
2. **Modelo do Nexaas com e-mails reais escondidos** num hyperlink interno e dados na linha 2 → modelo sanitizado (`npm run make-template`).
3. **IP forjável** (primeiro valor do `X-Forwarded-For`) permitiria burlar o limite de requisições e falsear a auditoria → passa a usar o valor acrescentado pelo proxy confiável.
4. **Limite de requisições compartilhado** entre rotas → contador geral + contador por rota.
5. **Falsas pendências** na loja própria e **mensagem enganosa** ao franqueado antes da importação do formulário → corrigidos (vistos nas telas).
6. **Script de demonstração com traços de dados reais** (CEP/número da loja de Osasco, prefixos de CNPJ/I.E.) → trocados por valores fictícios.

## Limitações deste relatório
- O login Google real não foi exercitado (sem rede para o Google aqui). As regras de autorização das claims têm teste unitário e o fluxo usa a biblioteca `openid-client`; teste o login uma vez em homologação.
- Os cabeçalhos reais das duas planilhas foram lidos (09/10/2026) e estão na configuração padrão. A leitura completa pela conta de serviço não foi exercitada aqui; o leitor de .xlsx foi testado com uma planilha fictícia com a mesma estrutura do pipeline (cabeçalho na linha 3, datas do Excel).
- O Dockerfile e o workflow de CI não foram executados aqui (sem Docker/GitHub neste ambiente).
