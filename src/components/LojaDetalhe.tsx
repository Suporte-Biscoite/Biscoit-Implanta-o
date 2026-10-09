"use client";
import { useCallback, useEffect, useState } from "react";
import { api, copiarHtml, copiarTexto, csrf } from "./api";

type Etapa = { key: string; titulo: string; dica?: string };
type EtapaEstado = { etapa: string; status: string; data: string | null; observacao: string | null; responsavel: string | null };
type Detalhe = {
  loja: { id: string; tipo: string; nome: string; email_loja: string | null; uf: string; cnpj: string | null; data_inauguracao: string | null; observacoes: string | null; dados: Record<string, string | boolean>; form_sincronizado_em: string | null };
  segredos: Record<string, { preenchido: boolean; mascara: string }>;
  etapas: EtapaEstado[]; pendencias: { campo: string; rotulo: string; problema: string; pedido: string; interno?: boolean }[];
  alertas: { nivel: string; texto: string }[]; status: string;
  eventos: { id: number; tipo: string; texto: string; user_email: string; criado_em: string }[];
};
type Email = { assunto: string; para: string[]; cc: string[]; html: string; texto: string; faltando: string[] };

const ROTULOS: Record<string, string> = {
  razao_social: "Razão social", ie: "Inscrição Estadual", regime: "Regime tributário", logradouro: "Logradouro", numero: "Número",
  complemento: "Complemento", bairro: "Bairro", cep: "CEP", cidade: "Cidade", contrato_link: "Contrato social / Cartão CNPJ (link)",
  resp_nome: "Responsável legal", resp_email: "E-mail do responsável", financeiro: "Contato financeiro", ponto_focal: "Ponto focal",
  telefone_loja: "Telefone da loja", contador_email: "E-mail da contabilidade",
  id_externo: "ID Externo", vendedor: "Vendedor padrão", dias_cupom: "Dias p/ expirar cupons", raio: "Raio máximo (Sem Limite, 30KM, 60KM, 100KM)",
  serie_nfe: "Série NF-e", seq_nfe: "Últ. sequencial NF-e", serie_nfce: "Série NFC-e", seq_nfce: "Últ. sequencial NFC-e", terminais: "Qtde de terminais",
};
const SENS: Record<string, string> = {
  resp_cpf: "CPF do responsável", resp_doc_link: "RG/CNH (link)", resp_telefone: "Telefone do responsável", certificado_link: "Certificado digital (link)",
  csc_prod_id: "CSC ID produção", csc_prod_token: "CSC token produção", csc_hom_id: "CSC ID homologação", csc_hom_token: "CSC token homologação",
};
const STATUS = [["PENDENTE", "Pendente"], ["EM_ANDAMENTO", "Em andamento"], ["CONCLUIDO", "Concluído"], ["NAO_SE_APLICA", "Não se aplica"]];
const fmtCnpj = (c: string | null) => c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "sem CNPJ";

export function LojaDetalhe({ id, checklist, fluxo, papel }: { id: string; checklist: Etapa[]; fluxo: "FRANQUIA" | "PROPRIA"; papel: string }) {
  const [d, setD] = useState<Detalhe | null>(null);
  const [aba, setAba] = useState("checklist");
  const [aviso, setAviso] = useState<{ t: "ok" | "erro" | "atencao"; m: string } | null>(null);
  const pode = papel !== "LEITOR";
  const carregar = useCallback(async () => { try { setD(await api<Detalhe>(`/api/lojas/${id}`)); } catch (e) { setAviso({ t: "erro", m: (e as Error).message }); } }, [id]);
  useEffect(() => { carregar(); }, [carregar]);
  const ok = (m: string) => setAviso({ t: "ok", m }), err = (e: unknown) => setAviso({ t: "erro", m: (e as Error).message });
  if (!d) return <p>Carregando…</p>;
  const concluida = (k: string) => d.etapas.some((e) => e.etapa === k && e.status === "CONCLUIDO");
  const { loja } = d;
  const dias = loja.data_inauguracao ? Math.round((Date.parse(loja.data_inauguracao) - Date.parse(new Date().toISOString().slice(0, 10))) / 86400000) : null;

  const abas = [["checklist", "Checklist"], ["dados", "Dados"], ["pendencias", `Pendências (${d.pendencias.length})`], ["email", "E-mail Nexaas"], ["onboarding", "Onboarding"], ["historico", "Histórico"]];
  return (
    <>
      <div className="cab-loja">
        <div>
          <h1>{loja.nome}</h1>
          <p className="sub">{fluxo === "FRANQUIA" ? "Franquia" : "Loja própria"}{loja.tipo.startsWith("REPASSE") ? " (repasse)" : ""} · {loja.uf} · CNPJ {fmtCnpj(loja.cnpj)}</p>
          <span className={`selo ${d.status === "Aguardando CNPJ" ? "bloqueio" : d.status === "Concluída" ? "ok" : ""}`}>{d.status}</span>
          <ul className="alertas" style={{ marginTop: ".75rem" }}>{d.alertas.map((a, i) => <li key={i} className={a.nivel}>{a.texto}</li>)}</ul>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="contagem-grande">{dias === null ? "—" : dias > 0 ? `D-${dias}` : dias === 0 ? "Hoje" : `D+${-dias}`}</div>
          <div className="sub">inauguração {loja.data_inauguracao ? loja.data_inauguracao.split("-").reverse().join("/") : "sem data"}</div>
        </div>
      </div>
      {aviso && <div className={`aviso ${aviso.t}`} role="status">{aviso.m}</div>}
      <div className="abas" role="tablist">{abas.map(([k, t]) => <button key={k} role="tab" aria-selected={aba === k} onClick={() => { setAba(k); setAviso(null); }}>{t}</button>)}</div>

      {aba === "checklist" && <Checklist d={d} checklist={checklist} pode={pode} recarregar={carregar} onErro={err} />}
      {aba === "dados" && <Dados d={d} fluxo={fluxo} pode={pode} recarregar={carregar} onOk={ok} onErro={err} papel={papel} />}
      {aba === "pendencias" && <Pendencias d={d} fluxo={fluxo} pode={pode} recarregar={carregar} onOk={ok} onErro={err} />}
      {aba === "email" && <EmailNexaas id={id} pode={pode} semCnpj={!loja.cnpj} onOk={ok} onErro={err} feito={concluida("email_nexaas")} recarregar={carregar} />}
      {aba === "onboarding" && <Onboarding id={id} nome={loja.nome} pode={pode} semCnpj={!loja.cnpj} onOk={ok} onErro={err} feito={concluida("onboarding")} recarregar={carregar} />}
      {aba === "historico" && <Historico d={d} id={id} pode={pode} recarregar={carregar} onErro={err} />}
    </>
  );
}

function Checklist({ d, checklist, pode, recarregar, onErro }: { d: Detalhe; checklist: Etapa[]; pode: boolean; recarregar: () => void; onErro: (e: unknown) => void }) {
  async function salvar(etapa: string, patch: Partial<EtapaEstado>) {
    const atual = d.etapas.find((e) => e.etapa === etapa)!;
    const novo = { ...atual, ...patch };
    if (patch.status === "CONCLUIDO" && !novo.data) novo.data = new Date().toISOString().slice(0, 10);
    try { await api(`/api/lojas/${d.loja.id}/etapas`, "PATCH", { etapa, status: novo.status, data: novo.data ?? "", observacao: novo.observacao, responsavel: novo.responsavel }); recarregar(); }
    catch (e) { onErro(e); }
  }
  return (
    <div className="cartao">
      {checklist.map((e, i) => {
        const s = d.etapas.find((x) => x.etapa === e.key);
        return (
          <div className="etapa" key={e.key}>
            <span className="num">{i + 1}</span>
            <div><strong>{e.titulo}</strong>{e.dica && <div className="dica">{e.dica}</div>}</div>
            <select aria-label={`Status: ${e.titulo}`} value={s?.status ?? "PENDENTE"} disabled={!pode} onChange={(ev) => salvar(e.key, { status: ev.target.value })}>
              {STATUS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
            <input aria-label="Data" type="date" value={s?.data ?? ""} disabled={!pode} onChange={(ev) => salvar(e.key, { data: ev.target.value })} />
            <div className="extra">
              <input aria-label="Observação" placeholder="Observação" defaultValue={s?.observacao ?? ""} disabled={!pode} onBlur={(ev) => ev.target.value !== (s?.observacao ?? "") && salvar(e.key, { observacao: ev.target.value })} />
              <input aria-label="Responsável" placeholder="Responsável" defaultValue={s?.responsavel ?? ""} disabled={!pode} onBlur={(ev) => ev.target.value !== (s?.responsavel ?? "") && salvar(e.key, { responsavel: ev.target.value })} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Dados({ d, fluxo, pode, recarregar, onOk, onErro, papel }: { d: Detalhe; fluxo: string; pode: boolean; recarregar: () => void; onOk: (m: string) => void; onErro: (e: unknown) => void; papel: string }) {
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(Object.keys(ROTULOS).map((k) => [k, String(d.loja.dados[k] ?? "")])));
  const [base, setBase] = useState({ nome: d.loja.nome, email_loja: d.loja.email_loja ?? "", uf: d.loja.uf, cnpj: d.loja.cnpj ?? "", data_inauguracao: d.loja.data_inauguracao ?? "", observacoes: d.loja.observacoes ?? "" });
  const [cert, setCert] = useState(Boolean(d.loja.dados.certificado_recebido));
  const [novosSeg, setNovosSeg] = useState<Record<string, string>>({});
  const [revelado, setRevelado] = useState<Record<string, string>>({});
  async function salvar() {
    try {
      const dados = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== String(d.loja.dados[k] ?? "")));
      await api(`/api/lojas/${d.loja.id}`, "PATCH", {
        ...base, nome: base.nome, dados: { ...dados, certificado_recebido: cert },
        segredos: Object.fromEntries(Object.entries(novosSeg).filter(([, v]) => v.trim())),
      });
      setNovosSeg({}); onOk("Dados salvos."); recarregar();
    } catch (e) { onErro(e); }
  }
  async function revelar(campo: string) {
    try { const r = await api<{ valor: string }>(`/api/lojas/${d.loja.id}/revelar`, "POST", { campo }); setRevelado({ ...revelado, [campo]: r.valor }); }
    catch (e) { onErro(e); }
  }
  async function excluir() {
    if (!confirm(`Excluir a loja ${d.loja.nome}? (exclusão lógica — o administrador consegue recuperar pelo banco)`)) return;
    try { await api(`/api/lojas/${d.loja.id}`, "DELETE"); window.location.href = "/"; } catch (e) { onErro(e); }
  }
  const campos = fluxo === "PROPRIA" ? ["razao_social", "ie", "logradouro", "numero", "complemento", "bairro", "cep", "cidade", "contrato_link", "telefone_loja", "id_externo", "vendedor", "dias_cupom", "raio", "serie_nfe", "seq_nfe", "serie_nfce", "seq_nfce", "terminais"] : Object.keys(ROTULOS);
  const sens = fluxo === "PROPRIA" ? ["resp_doc_link"] : Object.keys(SENS);
  return (
    <div className="cartao">
      <h3 style={{ marginTop: 0 }}>Identificação</h3>
      <div className="grade">
        {(["nome", "email_loja", "uf", "cnpj", "data_inauguracao"] as const).map((k) => (
          <div className="campo" key={k}><label htmlFor={k}>{{ nome: "Nome", email_loja: "E-mail da loja", uf: "UF", cnpj: "CNPJ (vazio = sem CNPJ)", data_inauguracao: "Inauguração" }[k]}</label>
            <input id={k} type={k === "data_inauguracao" ? "date" : "text"} value={base[k]} disabled={!pode} onChange={(e) => setBase({ ...base, [k]: e.target.value })} /></div>
        ))}
      </div>
      <h3>Dados da loja</h3>
      <div className="grade">
        {campos.map((k) => <div className="campo" key={k}><label htmlFor={k}>{ROTULOS[k]}</label><input id={k} value={form[k]} disabled={!pode} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>)}
      </div>
      {fluxo === "FRANQUIA" && <label style={{ display: "flex", gap: ".5rem", color: "var(--tinta)" }}><input type="checkbox" style={{ width: "auto" }} checked={cert} disabled={!pode} onChange={(e) => setCert(e.target.checked)} /> Certificado digital recebido (a senha NUNCA é guardada no sistema)</label>}
      <h3>Dados sensíveis (cifrados)</h3>
      <p className="sub">Valores atuais ficam mascarados. Cada "revelar" fica registrado na auditoria. Para trocar, digite o novo valor.</p>
      {sens.map((k) => (
        <div className="campo" key={k}>
          <label htmlFor={`s-${k}`}>{SENS[k]}</label>
          <div className="sensivel">
            <code>{revelado[k] ?? (d.segredos[k]?.preenchido ? d.segredos[k].mascara : "vazio")}</code>
            {pode && d.segredos[k]?.preenchido && !revelado[k] && <button className="sec" onClick={() => revelar(k)}>Revelar</button>}
            {pode && <input id={`s-${k}`} placeholder="novo valor" value={novosSeg[k] ?? ""} onChange={(e) => setNovosSeg({ ...novosSeg, [k]: e.target.value })} autoComplete="off" style={{ maxWidth: 320 }} />}
          </div>
        </div>
      ))}
      <div className="campo"><label htmlFor="obs">Observações</label><textarea id="obs" value={base.observacoes} disabled={!pode} onChange={(e) => setBase({ ...base, observacoes: e.target.value })} /></div>
      {pode && <div className="acoes"><button onClick={salvar}>Salvar dados</button>{papel === "ADMIN" && <button className="perigo" onClick={excluir}>Excluir loja</button>}</div>}
    </div>
  );
}

function Pendencias({ d, fluxo, pode, recarregar, onOk, onErro }: { d: Detalhe; fluxo: string; pode: boolean; recarregar: () => void; onOk: (m: string) => void; onErro: (e: unknown) => void }) {
  const [msgs, setMsgs] = useState<{ formulario: string; pendencias: string } | null>(null);
  const [sync, setSync] = useState(false);
  const lojaId = d.loja.id, versao = d.eventos[0]?.id;
  // recarrega as mensagens quando a loja muda (novo evento = dados alterados)
  useEffect(() => { api<{ formulario: string; pendencias: string }>(`/api/lojas/${lojaId}/mensagens`).then(setMsgs).catch(() => setMsgs(null)); }, [lojaId, versao]);
  async function importar() {
    setSync(true);
    try {
      const r = await api<{ encontrado: boolean; mensagem?: string; por?: string; colunasNaoEncontradas?: string[] }>(`/api/lojas/${d.loja.id}/formulario`, "POST");
      if (!r.encontrado) onErro(new Error(r.mensagem));
      else onOk(`Resposta importada (encontrada por ${r.por}).${r.colunasNaoEncontradas?.length ? ` Colunas não mapeadas: ${r.colunasNaoEncontradas.join(", ")} — ajuste em Configurações.` : ""}`);
      recarregar();
    } catch (e) { onErro(e); } finally { setSync(false); }
  }
  const externas = d.pendencias.filter((p) => !p.interno), internas = d.pendencias.filter((p) => p.interno);
  return (
    <>
      {fluxo === "FRANQUIA" && (
        <div className="cartao">
          <h3 style={{ marginTop: 0 }}>1. Mensagem com o formulário (para o grupo)</h3>
          {msgs && <div className="msg">{msgs.formulario}</div>}
          <div className="acoes"><button className="sec" onClick={() => msgs && copiarTexto(msgs.formulario).then(() => onOk("Mensagem copiada."))}>Copiar mensagem</button></div>
          <h3>2. Importar resposta do formulário</h3>
          <p className="sub">{d.loja.form_sincronizado_em ? `Última importação: ${new Date(d.loja.form_sincronizado_em).toLocaleString("pt-BR")}` : "Ainda não importado."} Busca pelo CNPJ e, se não achar, pelo e-mail da loja.</p>
          {pode && <button onClick={importar} disabled={sync || !d.loja.cnpj}>{sync ? "Lendo planilha…" : "Importar resposta do formulário"}</button>}
        </div>
      )}
      <div className="cartao">
        <h3 style={{ marginTop: 0 }}>Pendências ({d.pendencias.length})</h3>
        {d.pendencias.length === 0 ? <div className="aviso ok">Nenhuma pendência. Tudo pronto para o e-mail e o onboarding.</div> : (
          <ul className="lista-pend">
            {[...externas, ...internas].map((p, i) => <li key={i}><span className={`selo ${p.problema === "vazio" ? "atencao" : "bloqueio"}`}>{p.problema}</span> <strong>{p.rotulo}</strong>{p.interno && <span className="sub"> (resolver internamente)</span>}</li>)}
          </ul>
        )}
        {fluxo === "FRANQUIA" && !d.loja.form_sincronizado_em && <p className="sub">A mensagem pedindo o que falta aparece depois que a resposta do formulário for importada.</p>}
        {msgs?.pendencias && (<>
          <h3>Mensagem para o franqueado</h3>
          <div className="msg">{msgs.pendencias}</div>
          <div className="acoes"><button className="sec" onClick={() => copiarTexto(msgs.pendencias).then(() => onOk("Mensagem copiada."))}>Copiar mensagem</button></div>
        </>)}
      </div>
    </>
  );
}

function MarcarEtapa({ id, etapa, texto, feito, onOk, onErro, recarregar }: { id: string; etapa: string; texto: string; feito: boolean; onOk: (m: string) => void; onErro: (e: unknown) => void; recarregar: () => void }) {
  if (feito) return <span className="selo ok">Etapa já concluída</span>;
  return <button className="sec" onClick={() => api(`/api/lojas/${id}/etapas`, "PATCH", { etapa, status: "CONCLUIDO", data: new Date().toISOString().slice(0, 10) })
    .then(() => { onOk("Etapa marcada como concluída."); recarregar(); }).catch(onErro)}>{texto}</button>;
}

function EmailNexaas({ id, pode, semCnpj, onOk, onErro, feito, recarregar }: { id: string; pode: boolean; semCnpj: boolean; onOk: (m: string) => void; onErro: (e: unknown) => void; feito: boolean; recarregar: () => void }) {
  const [e, setE] = useState<Email | null>(null);
  if (semCnpj) return <div className="aviso erro">Loja sem CNPJ: o e-mail só pode ser gerado depois que o CNPJ for informado.</div>;
  if (!pode) return <p className="sub">Somente operadores geram o e-mail.</p>;
  return (
    <div className="cartao">
      <button onClick={() => api<Email>(`/api/lojas/${id}/email`).then(setE).catch(onErro)}>{e ? "Gerar novamente" : "Gerar e-mail"}</button>
      {e && (<>
        {e.faltando.length > 0 && <div className="aviso atencao" style={{ marginTop: "1rem" }}>Campos PENDENTES: {e.faltando.join(", ")}. Complete antes de enviar.</div>}
        <table style={{ margin: "1rem 0" }}><tbody>
          <tr><th>Assunto</th><td>{e.assunto}</td><td><button className="sec" onClick={() => copiarTexto(e.assunto).then(() => onOk("Assunto copiado."))}>Copiar</button></td></tr>
          <tr><th>Para</th><td>{e.para.join(", ") || "configurar em Configurações"}</td><td><button className="sec" onClick={() => copiarTexto(e.para.join(", ")).then(() => onOk("Destinatários copiados."))}>Copiar</button></td></tr>
          <tr><th>CC</th><td>{e.cc.join(", ") || "—"}</td><td><button className="sec" onClick={() => copiarTexto(e.cc.join(", ")).then(() => onOk("CC copiado."))}>Copiar</button></td></tr>
        </tbody></table>
        <div className="acoes"><button onClick={() => copiarHtml(e.html, e.texto).then(() => onOk("E-mail formatado copiado. Cole no corpo do Gmail (Ctrl+V)."))}>Copiar e-mail formatado</button>
          <MarcarEtapa id={id} etapa="email_nexaas" texto="Já enviei: concluir etapa" feito={feito} onOk={onOk} onErro={onErro} recarregar={recarregar} /></div>
        {/* O HTML é gerado no servidor com todos os valores escapados (ver src/lib/email.ts). */}
        <div className="preview" dangerouslySetInnerHTML={{ __html: e.html }} />
      </>)}
    </div>
  );
}

function Onboarding({ id, nome, pode, semCnpj, onOk, onErro, feito, recarregar }: { id: string; nome: string; pode: boolean; semCnpj: boolean; onOk: (m: string) => void; onErro: (e: unknown) => void; feito: boolean; recarregar: () => void }) {
  if (semCnpj) return <div className="aviso erro">Loja sem CNPJ: a planilha só pode ser gerada depois que o CNPJ for informado.</div>;
  if (!pode) return <p className="sub">Somente operadores geram a planilha.</p>;
  async function baixar() {
    try {
      const res = await fetch(`/api/lojas/${id}/onboarding`, { credentials: "same-origin", headers: { "x-csrf-token": csrf() } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).erro ?? "Falha ao gerar");
      const pend = Number(res.headers.get("X-Pendentes") ?? 0);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a"); a.href = url; a.download = `Onboarding - ${nome}.xlsx`; a.click(); URL.revokeObjectURL(url);
      onOk(pend ? `Planilha baixada com ${pend} campo(s) PENDENTE (destacados em amarelo).` : "Planilha baixada, sem pendências.");
    } catch (e) { onErro(e); }
  }
  return (<div className="cartao"><p>Gera o .xlsx a partir do modelo do Nexaas, mantendo abas, comentários e listas de validação. Campos sem definição saem como <strong>PENDENTE</strong> em amarelo.</p><div className="acoes"><button onClick={baixar}>Baixar planilha de onboarding</button>
    <MarcarEtapa id={id} etapa="onboarding" texto="Já enviei: concluir etapa" feito={feito} onOk={onOk} onErro={onErro} recarregar={recarregar} /></div></div>);
}

function Historico({ d, id, pode, recarregar, onErro }: { d: Detalhe; id: string; pode: boolean; recarregar: () => void; onErro: (e: unknown) => void }) {
  const [nota, setNota] = useState("");
  return (
    <div className="cartao">
      {pode && (<><div className="campo"><label htmlFor="nota">Nova anotação</label><textarea id="nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={4000} /></div>
        <div className="acoes"><button disabled={!nota.trim()} onClick={() => api(`/api/lojas/${id}/notas`, "POST", { texto: nota }).then(() => { setNota(""); recarregar(); }).catch(onErro)}>Salvar anotação</button></div></>)}
      <table><thead><tr><th>Quando</th><th>Tipo</th><th>O quê</th><th>Quem</th></tr></thead><tbody>
        {d.eventos.map((ev) => <tr key={ev.id}><td>{new Date(ev.criado_em).toLocaleString("pt-BR")}</td><td><span className="selo">{ev.tipo}</span></td><td style={{ whiteSpace: "pre-wrap" }}>{ev.texto}</td><td>{ev.user_email}</td></tr>)}
      </tbody></table>
    </div>
  );
}
