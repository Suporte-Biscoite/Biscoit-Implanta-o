"use client";
import { useState } from "react";
import { api } from "./api";

type Cfg = Record<string, unknown>;
const SECOES: { chave: string; titulo: string; ajuda: string }[] = [
  { chave: "emails", titulo: "Destinatários do e-mail ao Nexaas", ajuda: "Listas por tipo. Repasse para própria usa PROPRIA; repasse entre franquias usa FRANQUIA. Lembre de incluir o responsável legal no CC da própria." },
  { chave: "propria_padrao", titulo: "Padrões das lojas próprias", ajuda: "Razão social, regime (ex.: 3 - PRESUMIDO), responsável legal, contato financeiro e ponto focal. Para quebrar linha (como no e-mail real do contato financeiro), escreva \\n dentro do texto — ex.: \"A/C NOME\\nCargo: CONTROLADORIA\\n\\nemail@...\"." },
  { chave: "testemunha", titulo: "Testemunha dos contratos", ajuda: "O CPF é gravado à parte, cifrado (abaixo)." },
  { chave: "onboarding", titulo: "Campos fixos e padrões do onboarding", ajuda: "Valores precisam ser idênticos às listas da planilha do Nexaas. Padrões vazios saem como PENDENTE." },
  { chave: "links", titulo: "Links e planilhas", ajuda: "Use o ID do arquivo (o trecho entre /d/ e /edit ou /view da URL) e o nome da aba (vazio = primeira aba). Aceita planilha Google e .xlsx guardado no Drive (o pipeline é .xlsx)." },
  { chave: "pipeline_colunas", titulo: "Colunas do pipeline", ajuda: 'Nome exato do cabeçalho (a linha do cabeçalho é encontrada sozinha), ou "Coluna H" para indicar pela letra. "previsao" é usada quando "inauguracao" estiver vazia ou com "-".' },
  { chave: "respostas_mapeamento", titulo: "Mapeamento do formulário", ajuda: "campo do sistema → cabeçalho da planilha de respostas. Ajuste após rodar npm run sheets:headers." },
  { chave: "saudacoes", titulo: "Saudações do e-mail", ajuda: "Horários de corte no fuso de São Paulo." },
  { chave: "mensagem_formulario", titulo: "Mensagem com o link do formulário", ajuda: "Use {loja} e {link}." },
  { chave: "retencao_meses", titulo: "Retenção de dados sensíveis (meses após a inauguração)", ajuda: "A rotina automática de anonimização entra na Fase 2." },
];

export function ConfigEditor({ inicial, segredos }: { inicial: Cfg; segredos: Record<string, boolean> }) {
  const [textos, setTextos] = useState<Record<string, string>>(() => Object.fromEntries(SECOES.map((s) => [s.chave, JSON.stringify(inicial[s.chave], null, 2)])));
  const [aviso, setAviso] = useState<{ t: string; m: string } | null>(null);
  const [seg, setSeg] = useState({ propria_resp_cpf: "", testemunha_cpf: "", prod_id: "", prod_token: "", hom_id: "", hom_token: "" });
  const [senhaExp, setSenhaExp] = useState("");

  async function salvar(chave: string) {
    try { const valor = JSON.parse(textos[chave]); await api("/api/config", "PUT", { chave, valor }); setAviso({ t: "ok", m: `"${chave}" salvo.` }); }
    catch (e) { setAviso({ t: "erro", m: e instanceof SyntaxError ? "JSON inválido — confira vírgulas e aspas." : (e as Error).message }); }
  }
  async function salvarSegredo(chave: string, valor: unknown) {
    try { await api("/api/config/segredo", "PUT", { chave, valor }); setAviso({ t: "ok", m: "Valor sensível gravado (cifrado)." }); setSeg({ propria_resp_cpf: "", testemunha_cpf: "", prod_id: "", prod_token: "", hom_id: "", hom_token: "" }); }
    catch (e) { setAviso({ t: "erro", m: (e as Error).message }); }
  }
  async function exportar() {
    try {
      const res = await fetch("/api/exportar", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-csrf-token": document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')!.content }, body: JSON.stringify({ senha: senhaExp }) });
      if (!res.ok) throw new Error((await res.json()).erro);
      const a = document.createElement("a"); a.href = URL.createObjectURL(await res.blob()); a.download = `exportacao-${new Date().toISOString().slice(0, 10)}.enc.json`; a.click();
      setSenhaExp(""); setAviso({ t: "ok", m: "Exportação cifrada baixada. Guarde a senha em local separado do arquivo." });
    } catch (e) { setAviso({ t: "erro", m: (e as Error).message }); }
  }
  return (
    <>
      {aviso && <div className={`aviso ${aviso.t}`} role="status">{aviso.m}</div>}
      {SECOES.map((s) => (
        <div className="cartao" key={s.chave}>
          <h3 style={{ marginTop: 0 }}>{s.titulo}</h3><p className="sub">{s.ajuda}</p>
          <textarea aria-label={s.titulo} spellCheck={false} style={{ fontFamily: "ui-monospace, Consolas, monospace", minHeight: `${Math.min(24, textos[s.chave].split("\n").length + 1) * 1.4}rem` }}
            value={textos[s.chave]} onChange={(e) => setTextos({ ...textos, [s.chave]: e.target.value })} />
          <div className="acoes"><button onClick={() => salvar(s.chave)}>Salvar</button></div>
        </div>
      ))}
      <div className="cartao">
        <h3 style={{ marginTop: 0 }}>Valores sensíveis (gravados cifrados, nunca exibidos)</h3>
        <div className="grade">
          <div className="campo"><label htmlFor="c1">CPF do responsável legal (próprias) {segredos.propria_resp_cpf ? "✓ definido" : "— não definido"}</label><input id="c1" autoComplete="off" value={seg.propria_resp_cpf} onChange={(e) => setSeg({ ...seg, propria_resp_cpf: e.target.value })} /><button className="sec" style={{ marginTop: ".4rem" }} onClick={() => salvarSegredo("propria_resp_cpf", seg.propria_resp_cpf)}>Gravar</button></div>
          <div className="campo"><label htmlFor="c2">CPF da testemunha {segredos.testemunha_cpf ? "✓ definido" : "— não definido"}</label><input id="c2" autoComplete="off" value={seg.testemunha_cpf} onChange={(e) => setSeg({ ...seg, testemunha_cpf: e.target.value })} /><button className="sec" style={{ marginTop: ".4rem" }} onClick={() => salvarSegredo("testemunha_cpf", seg.testemunha_cpf)}>Gravar</button></div>
        </div>
        <h3>Tokens CSC de SP (lojas próprias) {segredos.csc_sp ? "✓ definidos" : "— não definidos"}</h3>
        <div className="grade">
          {(["prod_id", "prod_token", "hom_id", "hom_token"] as const).map((k) => <div className="campo" key={k}><label htmlFor={k}>{{ prod_id: "CSC ID produção", prod_token: "CSC token produção", hom_id: "CSC ID homologação", hom_token: "CSC token homologação" }[k]}</label><input id={k} autoComplete="off" value={seg[k]} onChange={(e) => setSeg({ ...seg, [k]: e.target.value })} /></div>)}
        </div>
        <button className="sec" onClick={() => salvarSegredo("csc_sp", { prod_id: seg.prod_id, prod_token: seg.prod_token, hom_id: seg.hom_id, hom_token: seg.hom_token })}>Gravar tokens CSC</button>
      </div>
      <div className="cartao">
        <h3 style={{ marginTop: 0 }}>Exportação completa cifrada</h3>
        <p className="sub">Inclui dados sensíveis decifrados, protegidos por uma senha (mínimo 16 caracteres). Registrado na auditoria.</p>
        <div className="campo"><label htmlFor="senhaexp">Senha da exportação</label><input id="senhaexp" type="password" autoComplete="new-password" value={senhaExp} onChange={(e) => setSenhaExp(e.target.value)} /></div>
        <button className="sec" disabled={senhaExp.length < 16} onClick={exportar}>Gerar exportação</button>
      </div>
    </>
  );
}
