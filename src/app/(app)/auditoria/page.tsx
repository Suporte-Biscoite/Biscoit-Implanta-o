import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
export default async function Auditoria({ searchParams }: { searchParams: Promise<{ acao?: string }> }) {
  await requireUser("ADMIN");
  const { acao } = await searchParams;
  const filtro = acao && /^[A-Z_]{3,30}$/.test(acao) ? acao : null;
  const linhas = await q<{ id: number; em: string; user_email: string | null; ip: string | null; acao: string; alvo: string | null; detalhe: unknown }>(
    `SELECT id, em, user_email, ip, acao, alvo, detalhe FROM audit_log ${filtro ? "WHERE acao=$1" : ""} ORDER BY id DESC LIMIT 300`, filtro ? [filtro] : []);
  return (<><h1>Auditoria</h1><p className="sub">Registro somente-inclusão (o banco bloqueia alteração e exclusão). Últimos 300 eventos.</p>
    <form className="filtros" method="get"><div><label htmlFor="a">Ação</label><input id="a" name="acao" defaultValue={filtro ?? ""} placeholder="ex.: LOGIN_FALHA" /></div><button className="sec">Filtrar</button></form>
    <div className="tabela-wrap"><table><thead><tr><th>Quando</th><th>Ação</th><th>Usuário</th><th>IP</th><th>Alvo</th><th>Detalhe</th></tr></thead><tbody>
      {linhas.map((l) => <tr key={l.id}><td>{new Date(l.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td><td><span className={`selo ${l.acao.includes("FALHA") || l.acao.includes("NEGADO") ? "bloqueio" : ""}`}>{l.acao}</span></td><td>{l.user_email ?? "—"}</td><td>{l.ip}</td><td>{l.alvo}</td><td><code>{l.detalhe ? JSON.stringify(l.detalhe) : ""}</code></td></tr>)}
    </tbody></table></div></>);
}
