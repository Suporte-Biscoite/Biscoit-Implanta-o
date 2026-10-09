// Tipos e regras de negócio do processo de implantação (manual de TI, versão 1.0).

export type TipoLoja = "FRANQUIA" | "PROPRIA" | "REPASSE_FF" | "REPASSE_FP";
export const TIPOS: Record<TipoLoja, { label: string; frase: string; fluxo: "FRANQUIA" | "PROPRIA" }> = {
  FRANQUIA: { label: "Franquia", frase: "uma franquia", fluxo: "FRANQUIA" },
  PROPRIA: { label: "Loja própria", frase: "uma loja própria", fluxo: "PROPRIA" },
  REPASSE_FF: { label: "Repasse franquia → franquia", frase: "um repasse de franquia para franquia", fluxo: "FRANQUIA" },
  REPASSE_FP: { label: "Repasse franquia → própria", frase: "um repasse de franquia para loja própria", fluxo: "PROPRIA" },
};
export const fluxoDe = (t: TipoLoja) => TIPOS[t].fluxo;

/** Campos não sensíveis (coluna `dados`). */
export type DadosLoja = Partial<{
  razao_social: string; ie: string; regime: string;
  logradouro: string; numero: string; complemento: string; bairro: string; cep: string; cidade: string;
  contrato_link: string;
  resp_nome: string; resp_email: string;
  financeiro: string; ponto_focal: string;
  certificado_recebido: boolean;
  email_franqueado: string; contador_email: string; telefone_loja: string;
  cnpj_formulario: string; nome_formulario: string;
  /** Nome curto com acentos para o assunto e o texto do e-mail (ex.: "União Osasco"). */
  nome_exibicao: string;
  // respostas contábeis do formulário (franquia)
  natureza: string; indicador: string; periodo: string; receita: string; escrituracao: string;
  // sobreposições por loja dos campos de onboarding
  id_externo: string; vendedor: string; dias_cupom: string; raio: string;
  serie_nfe: string; seq_nfe: string; serie_nfce: string; seq_nfce: string; terminais: string;
}>;

/** Campos sensíveis (coluna `segredos`, cada um cifrado com AES-256-GCM). */
export const CAMPOS_SENSIVEIS = [
  "resp_cpf", "resp_doc_link", "resp_telefone", "certificado_link",
  "csc_prod_id", "csc_prod_token", "csc_hom_id", "csc_hom_token",
] as const;
export type CampoSensivel = (typeof CAMPOS_SENSIVEIS)[number];
export type Segredos = Partial<Record<CampoSensivel, string>>;

export type Loja = {
  id: string; tipo: TipoLoja; nome: string; email_loja: string | null; uf: string;
  cnpj: string | null; sem_cnpj: boolean; data_inauguracao: string | null; observacoes: string | null;
  dados: DadosLoja; form_sincronizado_em: string | null; criado_em: string;
};

/** Sugestão de nome de exibição: tira "BISCOITE" e coloca em formato de título. Acentos precisam de ajuste manual. */
export function sugerirNomeExibicao(nome: string): string {
  const menores = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);
  return nome.replace(/^\s*biscoit[eê]\s+/i, "").toLowerCase().split(/\s+/).filter(Boolean)
    .map((p, i) => (i > 0 && menores.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(" ");
}

export type Etapa = { key: string; titulo: string; dica?: string };
export const CHECKLIST: Record<"FRANQUIA" | "PROPRIA", Etapa[]> = {
  FRANQUIA: [
    { key: "grupo_pipeline", titulo: "Entrar no grupo, verificar o pipeline e se apresentar" },
    { key: "cnpj_formulario", titulo: "Verificar CNPJ e enviar o formulário no grupo", dica: "Sem CNPJ: abrir tarefa no ClickUp e aguardar." },
    { key: "email_hostinger", titulo: "Criar e-mail no Hostinger (@biscoite.com)" },
    { key: "extranet", titulo: "Criar usuário e unidade na Extranet", dica: "MAIÚSCULO, Tabela Franqueados, 6 usuários fixos na unidade." },
    { key: "omie", titulo: "Cadastrar no Omie e integrar com a Extranet", dica: "Integração pode ficar em branco por até 5–7 min." },
    { key: "acessos_enviados", titulo: "Enviar acessos (Hostinger + Extranet) ao franqueado", dica: "Mesma senha nos dois acessos." },
    { key: "email_nexaas", titulo: "Formulário recebido: enviar e-mail ao Nexaas" },
    { key: "onboarding", titulo: "Enviar planilha de onboarding e marcar o CS do Nexaas" },
    { key: "grupo_treinamento", titulo: "Após assinatura: criar grupo de treinamento", dica: "Nome: Nexaas x [Loja]." },
    { key: "reuniao_checklist", titulo: "Reunião de checklist com o franqueado", dica: "Rede, Pix, vouchers, impostos, Nexaas, infra, cardápio." },
    { key: "pos_inauguracao", titulo: "Acompanhar 2 semanas pós-inauguração", dica: "Depois, encaminhar para o suporte de TI." },
  ],
  PROPRIA: [
    { key: "cnpj", titulo: "Aviso recebido e CNPJ confirmado com a Controladoria", dica: "Nada anda sem CNPJ." },
    { key: "email_nexaas", titulo: "Enviar e-mail ao Nexaas com os dados padrão" },
    { key: "grupo_implantacao", titulo: "Acelerar no grupo de implantação do Nexaas" },
    { key: "onboarding", titulo: "Avisar CS/treinamento do Nexaas e enviar planilha de onboarding" },
    { key: "email_google", titulo: "Criar e-mail no Google Admin Console (@biscoite.com.br)" },
    { key: "acessos", titulo: "Criar acessos Extranet + Nexaas" },
  ],
};
/** Etapas que podem ser marcadas mesmo sem CNPJ (só a primeira de cada fluxo). */
export const ETAPAS_SEM_CNPJ = new Set(["grupo_pipeline", "cnpj"]);

export type StatusEtapa = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO" | "NAO_SE_APLICA";
export type EtapaEstado = { etapa: string; status: StatusEtapa; data: string | null; observacao: string | null; responsavel: string | null };

export type Alerta = { nivel: "bloqueio" | "atencao" | "info"; texto: string };

/** Dias entre hoje (fuso de São Paulo) e a data ISO (positivo = futuro). */
export function diasAte(dataISO: string | null, hoje = new Date()): number | null {
  if (!dataISO) return null;
  const sp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(hoje);
  const a = Date.parse(`${sp}T00:00:00Z`), b = Date.parse(`${dataISO.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function alertasDaLoja(l: Pick<Loja, "tipo" | "sem_cnpj" | "cnpj" | "data_inauguracao" | "form_sincronizado_em">, etapas: EtapaEstado[], pendencias: number, hoje = new Date()): Alerta[] {
  const fluxo = fluxoDe(l.tipo);
  const ok = (k: string) => etapas.some((e) => e.etapa === k && (e.status === "CONCLUIDO" || e.status === "NAO_SE_APLICA"));
  const out: Alerta[] = [];
  const dias = diasAte(l.data_inauguracao, hoje);

  if (l.sem_cnpj || !l.cnpj) out.push({ nivel: "bloqueio", texto: "Aguardando CNPJ — nenhuma etapa avança" });
  if (!l.data_inauguracao) out.push({ nivel: "atencao", texto: "Sem data de inauguração (confira o pipeline)" });
  if (fluxo === "FRANQUIA" && !l.form_sincronizado_em && l.cnpj) out.push({ nivel: "atencao", texto: "Formulário do franqueado pendente" });
  // Antes do CNPJ (franquia: antes do formulário) a lista de pendências é só ruído — o alerta acima já diz o que fazer.
  const dadosEsperados = !!l.cnpj && (fluxo === "PROPRIA" || !!l.form_sincronizado_em);
  if (dadosEsperados && pendencias > 0) out.push({ nivel: "atencao", texto: `${pendencias} pendência(s) nos dados` });
  if (l.cnpj && !ok("email_nexaas")) out.push({ nivel: dias !== null && dias <= 30 ? "atencao" : "info", texto: "E-mail ao Nexaas não enviado" });
  if (ok("email_nexaas") && !ok("onboarding")) out.push({ nivel: "atencao", texto: "Planilha de onboarding não enviada" });
  if (fluxo === "FRANQUIA" && ok("email_nexaas") && !ok("grupo_treinamento")) out.push({ nivel: "info", texto: "Aguardando assinatura do contrato" });
  if (dias !== null && dias <= 0 && dias > -14) out.push({ nivel: "info", texto: `Pós-inauguração: dia ${-dias + 1} de 14 de acompanhamento` });
  if (dias !== null && dias <= -14 && fluxo === "FRANQUIA" && !ok("pos_inauguracao"))
    out.push({ nivel: "atencao", texto: "2 semanas pós-inauguração: encaminhar ao suporte de TI e encerrar" });
  if (dias !== null && dias > 0 && dias <= 15 && etapas.some((e) => e.status !== "CONCLUIDO" && e.status !== "NAO_SE_APLICA" && e.etapa !== "pos_inauguracao"))
    out.push({ nivel: "atencao", texto: `Inauguração em ${dias} dia(s) com etapas em aberto` });
  return out;
}

export function statusGeral(l: Pick<Loja, "sem_cnpj" | "cnpj" | "data_inauguracao">, etapas: EtapaEstado[], tipo: TipoLoja): string {
  if (l.sem_cnpj || !l.cnpj) return "Aguardando CNPJ";
  const total = CHECKLIST[fluxoDe(tipo)].length;
  const feitas = etapas.filter((e) => e.status === "CONCLUIDO" || e.status === "NAO_SE_APLICA").length;
  if (feitas >= total) return "Concluída";
  const dias = diasAte(l.data_inauguracao);
  if (dias !== null && dias <= 0) return "Pós-inauguração";
  return "Em implantação";
}
