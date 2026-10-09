"use client";
import { useState } from "react";
import { api, ApiError } from "./api";

type Tipo = "FRANQUIA" | "PROPRIA" | "REPASSE_FF" | "REPASSE_FP";
const TIPOS: { v: Tipo; t: string; d: string }[] = [
  { v: "FRANQUIA", t: "Franquia", d: "Expansão cria o grupo. Dados vêm do formulário do franqueado." },
  { v: "PROPRIA", t: "Loja própria", d: "Flávio avisa. Dados padrão da Biscoitê; sem formulário." },
  { v: "REPASSE_FF", t: "Repasse franquia → franquia", d: "Segue o fluxo de franquia; e-mail informa o repasse." },
  { v: "REPASSE_FP", t: "Repasse franquia → própria", d: "Segue o fluxo de loja própria; e-mail informa o repasse." },
];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
type Match = { linha: number; nome: string; cnpj: string; data_inauguracao: string | null; data_bruta: string; uf: string; por: string };

export function Assistente() {
  const [passo, setPasso] = useState(1);
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [f, setF] = useState({ nome: "", email_loja: "", uf: "SP", cnpj: "", sem_cnpj: false, data_inauguracao: "", observacoes: "" });
  const [d, setD] = useState({ razao_social: "", ie: "", logradouro: "", numero: "", complemento: "", bairro: "", cep: "", cidade: "", contrato_link: "" });
  const [rgLink, setRgLink] = useState("");
  const [pipe, setPipe] = useState<{ msg?: string; matches?: Match[] }>({});
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<{ campo: string; msg: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const propria = tipo === "PROPRIA" || tipo === "REPASSE_FP";
  const dominio = propria ? "@biscoite.com.br" : "@biscoite.com";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const setDd = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });

  async function buscarPipeline() {
    setPipe({ msg: "Buscando…" });
    try {
      const q = new URLSearchParams({ cnpj: f.cnpj, nome: f.nome });
      const r = await api<{ configurado: boolean; resultados: Match[] }>(`/api/pipeline?${q}`);
      if (!r.configurado) return setPipe({ msg: "Pipeline ainda não configurado (Configurações → Links)." });
      if (!r.resultados.length) return setPipe({ msg: "Loja não encontrada no pipeline. Confira o nome/CNPJ ou cadastre a data manualmente." });
      setPipe({ matches: r.resultados });
    } catch (e) { setPipe({ msg: (e as Error).message }); }
  }
  function usar(m: Match) {
    setF({ ...f, data_inauguracao: m.data_inauguracao ?? f.data_inauguracao, uf: m.uf && UFS.includes(m.uf) ? m.uf : f.uf });
  }
  const divergencias = (m: Match) => {
    const out: string[] = [];
    const c = f.cnpj.replace(/\D/g, "");
    if (c && m.cnpj && m.cnpj !== c) out.push(`CNPJ no pipeline é diferente (${m.cnpj})`);
    if (m.uf && m.uf !== f.uf) out.push(`UF no pipeline: ${m.uf}`);
    if (!m.data_inauguracao) out.push(`data na coluna H não reconhecida ("${m.data_bruta || "vazia"}")`);
    else if (f.data_inauguracao && m.data_inauguracao !== f.data_inauguracao) out.push("data diferente da informada");
    return out;
  };

  async function salvar() {
    setSalvando(true); setErro(null); setErros([]);
    try {
      const dados = propria ? Object.fromEntries(Object.entries(d).filter(([, v]) => v.trim())) : {};
      const r = await api<{ id: string }>("/api/lojas", "POST", {
        tipo, ...f, cnpj: f.sem_cnpj ? "" : f.cnpj, email_loja: f.email_loja || undefined, dados,
        segredos: propria && rgLink.trim() ? { resp_doc_link: rgLink.trim() } : {},
      });
      window.location.href = `/lojas/${r.id}`;
    } catch (e) {
      setErro((e as Error).message);
      if (e instanceof ApiError && e.detalhes) setErros(e.detalhes);
      setSalvando(false);
    }
  }

  const passos = ["Tipo", "Identificação", propria ? "Dados da loja" : "Formulário", "Revisão"];
  return (
    <>
      <div className="passos" aria-label="Etapas do cadastro">{passos.map((p, i) => <span key={p} className={passo === i + 1 ? "atual" : ""}>{i + 1}. {p}</span>)}</div>
      {erro && <div className="aviso erro" role="alert">{erro}{erros.length > 0 && <ul>{erros.map((x, i) => <li key={i}>{x.campo}: {x.msg}</li>)}</ul>}</div>}

      {passo === 1 && (
        <div className="cartao">
          <h2 style={{ marginTop: 0 }}>Qual é o tipo de abertura?</h2>
          {TIPOS.map((t) => (
            <label key={t.v} style={{ display: "flex", gap: ".6rem", padding: ".5rem 0", color: "var(--tinta)", fontSize: "1rem" }}>
              <input type="radio" name="tipo" style={{ width: "auto" }} checked={tipo === t.v} onChange={() => setTipo(t.v)} />
              <span><strong>{t.t}</strong><br /><span className="sub">{t.d}</span></span>
            </label>
          ))}
          <div className="acoes"><button disabled={!tipo} onClick={() => setPasso(2)}>Continuar</button></div>
        </div>
      )}

      {passo === 2 && (
        <div className="cartao">
          <div className="grade">
            <div className="campo"><label htmlFor="nome">Nome da loja (fica em MAIÚSCULO)</label><input id="nome" value={f.nome} onChange={set("nome")} placeholder="BISCOITE SHOPPING EXEMPLO" maxLength={120} /></div>
            <div className="campo"><label htmlFor="email">E-mail da loja ({dominio})</label><input id="email" type="email" value={f.email_loja} onChange={set("email_loja")} placeholder={`loja${dominio}`} /></div>
            <div className="campo"><label htmlFor="uf">UF</label><select id="uf" value={f.uf} onChange={set("uf")}>{UFS.map((u) => <option key={u}>{u}</option>)}</select></div>
            <div className="campo"><label htmlFor="cnpj">CNPJ</label><input id="cnpj" value={f.cnpj} onChange={set("cnpj")} disabled={f.sem_cnpj} inputMode="numeric" placeholder="00.000.000/0000-00" /></div>
            <div className="campo"><label htmlFor="data">Previsão de inauguração</label><input id="data" type="date" value={f.data_inauguracao} onChange={set("data_inauguracao")} /></div>
          </div>
          <label style={{ display: "flex", gap: ".5rem", color: "var(--tinta)" }}><input type="checkbox" style={{ width: "auto" }} checked={f.sem_cnpj} onChange={set("sem_cnpj")} /> Ainda não tem CNPJ (a loja fica como "Aguardando CNPJ" e nada avança)</label>
          <div className="acoes"><button className="sec" onClick={buscarPipeline} disabled={!f.cnpj && f.nome.length < 4}>Buscar no pipeline</button></div>
          {pipe.msg && <div className="aviso atencao">{pipe.msg}</div>}
          {pipe.matches?.map((m) => {
            const div = divergencias(m);
            return (
              <div key={m.linha} className={`aviso ${div.length ? "atencao" : "ok"}`}>
                Linha {m.linha}: <strong>{m.nome}</strong> (achado por {m.por}) · inauguração {m.data_bruta || "—"} · {m.uf || "UF?"}
                {div.length > 0 && <> · <strong>Divergência:</strong> {div.join("; ")}</>}
                {" "}<button className="sec" onClick={() => usar(m)}>Usar data/UF</button>
              </div>
            );
          })}
          <div className="campo"><label htmlFor="obs">Observações</label><textarea id="obs" value={f.observacoes} onChange={set("observacoes")} maxLength={2000} /></div>
          <div className="acoes"><button className="sec" onClick={() => setPasso(1)}>Voltar</button><button disabled={f.nome.trim().length < 3 || (!f.cnpj && !f.sem_cnpj)} onClick={() => setPasso(3)}>Continuar</button></div>
        </div>
      )}

      {passo === 3 && (
        <div className="cartao">
          {propria ? (
            <>
              <p className="sub">Só o que muda por loja. Responsável legal, contato financeiro, testemunha e campos fixos vêm das Configurações.</p>
              <div className="grade">
                <div className="campo"><label htmlFor="rs">Razão social (vazio = padrão da config.)</label><input id="rs" value={d.razao_social} onChange={setDd("razao_social")} /></div>
                <div className="campo"><label htmlFor="ie">Inscrição Estadual</label><input id="ie" value={d.ie} onChange={setDd("ie")} /></div>
                <div className="campo"><label htmlFor="cep">CEP</label><input id="cep" value={d.cep} onChange={setDd("cep")} inputMode="numeric" /></div>
                <div className="campo"><label htmlFor="log">Logradouro</label><input id="log" value={d.logradouro} onChange={setDd("logradouro")} /></div>
                <div className="campo"><label htmlFor="num">Número</label><input id="num" value={d.numero} onChange={setDd("numero")} /></div>
                <div className="campo"><label htmlFor="comp">Complemento</label><input id="comp" value={d.complemento} onChange={setDd("complemento")} /></div>
                <div className="campo"><label htmlFor="bai">Bairro</label><input id="bai" value={d.bairro} onChange={setDd("bairro")} /></div>
                <div className="campo"><label htmlFor="cid">Cidade</label><input id="cid" value={d.cidade} onChange={setDd("cidade")} /></div>
              </div>
              <div className="campo"><label htmlFor="ct">Link do Drive: contrato social / cartão CNPJ</label><input id="ct" value={d.contrato_link} onChange={setDd("contrato_link")} placeholder="https://drive.google.com/…" /></div>
              <div className="campo"><label htmlFor="rg">Link do Drive: RG/CNH do responsável legal (vazio = padrão da config.)</label><input id="rg" value={rgLink} onChange={(e) => setRgLink(e.target.value)} placeholder="https://drive.google.com/…" /></div>
              {f.uf !== "SP" && <div className="aviso atencao">Fora de SP: os tokens CSC ficam PENDENTES — solicitar à Controladoria.</div>}
            </>
          ) : (
            <p>Para franquias, os dados chegam pelo formulário. Depois de salvar, na página da loja você vai: copiar a mensagem com o link do formulário para o grupo, e depois clicar em <strong>Importar resposta do formulário</strong> para conferir as pendências.</p>
          )}
          <div className="acoes"><button className="sec" onClick={() => setPasso(2)}>Voltar</button><button onClick={() => setPasso(4)}>Revisar</button></div>
        </div>
      )}

      {passo === 4 && (
        <div className="cartao">
          <table><tbody>
            <tr><th>Tipo</th><td>{TIPOS.find((t) => t.v === tipo)?.t}</td></tr>
            <tr><th>Nome</th><td>{f.nome.toUpperCase()}</td></tr>
            <tr><th>E-mail</th><td>{f.email_loja || "—"}</td></tr>
            <tr><th>UF</th><td>{f.uf}</td></tr>
            <tr><th>CNPJ</th><td>{f.sem_cnpj ? "Ainda não tem (Aguardando CNPJ)" : f.cnpj}</td></tr>
            <tr><th>Inauguração</th><td>{f.data_inauguracao || "—"}</td></tr>
          </tbody></table>
          <div className="acoes"><button className="sec" onClick={() => setPasso(3)}>Voltar</button><button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar loja"}</button></div>
        </div>
      )}
    </>
  );
}
