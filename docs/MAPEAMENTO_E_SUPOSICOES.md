# Mapeamento de campos, suposições e decisões em aberto

## Mapeamento (formulário → sistema → e-mail → onboarding)

Cabeçalhos **reais**, lidos em 09/10/2026 da planilha "Contratação do Sistema Nexaas (respostas)" e do arquivo
"BASE DE LOJAS DA REDE E IMPLANTAÇÕES.xlsx" (só a linha de cabeçalho; nenhum dado foi copiado para o sistema).

| Pergunta do formulário (esperada) | Campo do sistema | E-mail ao Nexaas | Onboarding |
|---|---|---|---|
| Nome Fantasia | `nome` (MAIÚSCULO) + `nome_exibicao` (com acentos, para assunto e texto do e-mail) — conferido contra `dados.nome_formulario` | Nome da Loja/Quiosque | B Nome Fantasia |
| CNPJ | `cnpj` (divergência com o formulário e o pipeline é sinalizada) | Número do CNPJ | C CNPJ |
| Razão Social | `dados.razao_social` (própria: padrão da config.) | — | A Razão Social |
| Contrato Social | `dados.contrato_link` (precisa ser link do Drive) | Contrato Social / Cartão CNPJ | — |
| I.E. | `dados.ie` (dígito verificador em SP) | — | D I.E |
| `Regime tributário ` (com espaço no fim) | `dados.regime` → normalizado para a lista | — | R Regime; AH Escrituração (regra por regime) |
| Logradouro / Número / Complemento / Bairro / CEP / Cidade / UF | `dados.*`, `uf` | Endereço da Loja | G, H, I, J, F, K, L |
| Nome (responsável) | `dados.resp_nome` | Nome Completo do Responsável Legal | — |
| CPF | `segredos.resp_cpf` 🔒 | CPF do Responsável Legal | — |
| RG/CNH | `segredos.resp_doc_link` 🔒 | PDF do RG ou CNH | — |
| E-mail | `dados.resp_email` | E-mail do Responsável Legal | — |
| Telefone | `segredos.resp_telefone` 🔒 | Telefone do Responsável Legal | — |
| Contato Financeiro / Ponto Focal | `dados.financeiro` / `dados.ponto_focal` | Contato financeiro / ponto focal | — |
| Certificado Digital (+ senha) | `dados.certificado_recebido` + `segredos.certificado_link` 🔒 — **senha não é guardada** | — | — |
| ID CSC Prod. / CSC Produção | `segredos.csc_prod_id/token` 🔒 | — | X, Y |
| ID CSC Homol. / CSC Homologação | `segredos.csc_hom_id/token` 🔒 (MG: copia produção) | — | Z, AA |
| `E-mail Loja/Quisoque` (grafia do formulário) | `email_loja` | — | AI (opcional) |
| Natureza Jurídica, Indicador de Atividade, Período, Receita, Escrituração | `dados.*` — usados no onboarding da franquia **quando batem com a lista do Nexaas**; senão, o padrão da configuração | — | AD–AH |
| **Senha** | **nunca lida** (trava no código + teste) | — | — |
| UF SP, Operação, Vendedores, Gestores, Tipo de Organização, perguntas sobre o Omie, STATUS SOLICITAÇÃO, DADOS PENDENTES | não usados | — | — |
| Contabilidade | `dados.contador_email` | — | AI (opcional) |
| (configuração) | Testemunha (CPF 🔒) | 5 campos da testemunha | — |
| (configuração) | Responsável legal das próprias (CPF 🔒) | campos do responsável (própria) | — |
| (configuração / por loja) | ID externo, vendedor, cupons, raio, séries, sequenciais, terminais | — | N–Q, S–W, AB, AC (vazio → **PENDENTE**) |
| (configuração) | Natureza, Indicador, Período, Receita, Periodicidade XML | — | AD, AE, AF, AG, AJ |

### Pipeline (`BASE DE LOJAS DA REDE E IMPLANTAÇÕES.xlsx`, arquivo .xlsx no Drive)
O cabeçalho fica na **linha 3** (as linhas 1–2 são título e totais) — o sistema encontra sozinho.
| Coluna do pipeline | Uso |
|---|---|
| LOJA | busca por nome (ignora "Biscoitê", acentos e maiúsculas) |
| CNPJ | busca por CNPJ (preferencial) e aviso de divergência |
| INAUGURAÇÃO | data de inauguração |
| PREVISÃO INAUGURAÇÃO | usada quando INAUGURAÇÃO está vazia ou com "-" |
| PRÓPRIA\| FRANQUEADO | tipo (exibido no aviso) |
| ES | UF |

⚠️ **Sobre a "coluna H":** pela leitura do arquivo, a coluna H aparenta ser **ENCERRAMENTO** (G = INAUGURAÇÃO, E = PREVISÃO).
Pode haver coluna oculta que mude as letras. Por isso o sistema usa o **nome** do cabeçalho, não a letra — confirme se a
data certa é "INAUGURAÇÃO" (com "PREVISÃO INAUGURAÇÃO" como reserva). Datas do Excel são convertidas para dd/mm/aaaa.

## Suposições (todas editáveis em Configurações)
1. **Escrituração por regime:** Simples e Simples-Sublimite → `C - SIMPLES NACIONAL`; Presumido, Real, Arbitrado → `A - DETALHADO`.
2. **Respostas contábeis do formulário** (Natureza, Indicador, Período, Receita, Escrituração): na franquia, valem quando batem com a lista do Nexaas (aceita o valor exato, só o código ou o texto); na dúvida, o sistema não chuta e usa o padrão. Desligável em `onboarding.preferir_respostas_formulario`.
2b. **E-mail de recebimento do XML:** um endereço padrão (o manual cita xml@…); opções para incluir o e-mail da loja e o da contabilidade. Separados por vírgula, como pede o comentário do próprio modelo do Nexaas.
3. **Para/CC:** começam vazios; preencher em Configurações (o print mostra "Customer Success" e "Grupo Financeiro", o manual lista outros).
4. **Valores sem definição** (ID externo, vendedor, cupons, séries, sequenciais, terminais, raio) → PENDENTE em amarelo até você definir padrões.
5. **Repasse franquia→franquia** segue o fluxo de franquia; **franquia→própria**, o de própria. A frase do e-mail informa o repasse.
6. **Saudação:** "Bom dia" antes das 12 h, "Boa tarde" até 18 h, "Boa noite" depois (fuso de São Paulo); nome do destinatário configurável (padrão "Andrei").
7. **Loja própria:** razão social, regime, responsável legal, financeiro e ponto focal vêm da configuração; RG/CNH e contrato podem ser informados por loja.
8. **"Indicador de Atividade"** gravado exatamente como na lista do modelo: `10- ATIVIDADE DE COMÉRCIO` (sem espaço antes do hífen).
9. **Validação de I.E.:** completa para SP; demais UFs só formato.
10. **Etapas sem CNPJ:** só a primeira etapa de cada checklist pode avançar; e-mail e onboarding ficam bloqueados.
11. **Pendências da franquia** só aparecem como alerta depois que o formulário é importado (antes disso, o alerta é "Formulário pendente").

## Decisões em aberto (preciso de você)
- Confirmar a regra de Escrituração com o Nexaas/contabilidade.
- Qual(is) e-mail(s) recebem o XML.
- Lista final de Para/CC e se o CC difere entre franquia e própria além do responsável legal.
- Padrões de ID Externo, Vendedor, cupons, raio, séries/sequenciais e terminais.
- Regime tributário e razão social padrão das lojas próprias.
- Confirmar se o **responsável legal entra no CC** da loja própria (manual diz sim; o e-mail real não tinha).
- Confirmar qual coluna é a data de inauguração no pipeline (ver aviso acima).
