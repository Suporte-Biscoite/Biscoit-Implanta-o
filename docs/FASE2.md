# O que ficou para a Fase 2 (e Fase 3)

## Fase 2
| Item | Situação na Fase 1 |
|---|---|
| Rotação de chave de criptografia (recifrar tudo com a chave nova) | Leitura com chave antiga e cifragem com a nova **já funcionam**; falta o script que recifra os registros antigos |
| Alertas por e-mail de eventos suspeitos (várias falhas de login, usuário novo, exportação) | Eventos já são auditados; falta o envio |
| Rotina automática de retenção/anonimização | Prazo já configurável (`retencao_meses`); falta o job |
| Rascunho no Gmail | Hoje: botão "Copiar e-mail formatado" |
| Extração do PDF do Cadesp (I.E., razão social, endereço) | — |
| Lembretes e integração com ClickUp (ex.: tarefa automática para loja sem CNPJ) | — |
| Validação de I.E. para todas as UFs | Só SP completa |
| Importação manual das respostas por CSV (alternativa sem conta de serviço) | — |

## Fase 3
Melhorias de painel e relatórios, repasses avançados (vínculo entre loja antiga e nova), e **revisão de segurança por terceiro**.
Sugestão de estudo: reescrever o backend em Java/Spring Boot reaproveitando o mesmo banco e os mesmos testes de segurança (eles testam por HTTP, servem para qualquer linguagem).
