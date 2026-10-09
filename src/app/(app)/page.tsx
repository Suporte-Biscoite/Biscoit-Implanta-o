import Link from "next/link";
import { requireUser, hasRole } from "@/lib/auth";
import { resumoLojas } from "@/lib/service";
import { TIPOS, CHECKLIST, fluxoDe, type TipoLoja } from "@/lib/domain";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");

export default async function Painel({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("LEITOR");
  const sp = await searchParams;
  const tipo = sp.tipo && sp.tipo in TIPOS ? sp.tipo : undefined;
  const de = sp.de && ISO.test(sp.de) ? sp.de : undefined;
  const ate = sp.ate && ISO.test(sp.ate) ? sp.ate : undefined;
  const lojas = (await resumoLojas({ tipo, de, ate })).filter((l) => (sp.mostrar === "todas" ? true : l.status !== "Concluída"));

  const bloqueadas = lojas.filter((l) => l.status === "Aguardando CNPJ").length;
  const proximas = lojas.filter((l) => l.dias !== null && l.dias >= 0 && l.dias <= 15).length;

  return (
    <>
      <div className="painel-cab">
        <div>
          <h1>Lojas em implantação</h1>
          <p className="sub">{lojas.length} loja(s) · {proximas} inaugurando em até 15 dias · {bloqueadas} aguardando CNPJ</p>
        </div>
        {hasRole(user, "OPERADOR") && <Link className="botao" href="/lojas/nova">Cadastrar loja</Link>}
      </div>
      {sp.negado && <div className="aviso erro">Você não tem permissão para acessar aquela página.</div>}
      <form className="filtros" method="get">
        <div><label htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipo ?? ""}>
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></div>
        <div><label htmlFor="de">Inauguração de</label><input id="de" type="date" name="de" defaultValue={de ?? ""} /></div>
        <div><label htmlFor="ate">até</label><input id="ate" type="date" name="ate" defaultValue={ate ?? ""} /></div>
        <div><label htmlFor="mostrar">Mostrar</label>
          <select id="mostrar" name="mostrar" defaultValue={sp.mostrar ?? ""}><option value="">Em andamento</option><option value="todas">Incluir concluídas</option></select></div>
        <button type="submit" className="sec">Filtrar</button>
      </form>
      <div className="tabela-wrap">
        {lojas.length === 0 ? <div className="vazio">Nenhuma loja com esses filtros.</div> : (
          <table>
            <thead><tr><th>Inauguração</th><th>Loja</th><th>Status e etapas</th><th>Alertas</th></tr></thead>
            <tbody>
              {lojas.map((l) => {
                const etapas = CHECKLIST[fluxoDe(l.tipo as TipoLoja)];
                const st = (k: string) => l.etapas.find((e) => e.etapa === k)?.status;
                const cls = l.status === "Aguardando CNPJ" ? "bloqueio" : l.status === "Concluída" ? "ok" : l.alertas.some((a) => a.nivel !== "info") ? "atencao" : "";
                return (
                  <tr key={l.id}>
                    <td>
                      <div className={`contagem${l.dias !== null && l.dias >= 0 && l.dias <= 7 ? " perto" : ""}`}>
                        {l.dias === null ? "—" : l.dias > 0 ? `D-${l.dias}` : l.dias === 0 ? "Hoje" : `D+${-l.dias}`}
                        <small>{fmt(l.data_inauguracao)}</small>
                      </div>
                    </td>
                    <td><Link href={`/lojas/${l.id}`}><strong>{l.nome}</strong></Link><br /><span className="sub">{TIPOS[l.tipo as TipoLoja].label} · {l.uf}</span></td>
                    <td>
                      <span className={`selo ${cls}`}>{l.status}</span>
                      <div className="progresso" aria-label={`${l.etapas.filter((e) => e.status === "CONCLUIDO" || e.status === "NAO_SE_APLICA").length} de ${etapas.length} etapas`}>
                        {etapas.map((e) => { const s = st(e.key); return <span key={e.key} title={e.titulo} className={s === "CONCLUIDO" || s === "NAO_SE_APLICA" ? "feito" : s === "EM_ANDAMENTO" ? "andamento" : ""} />; })}
                      </div>
                    </td>
                    <td><ul className="alertas">{l.alertas.map((a, i) => <li key={i} className={a.nivel}>{a.texto}</li>)}</ul></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
