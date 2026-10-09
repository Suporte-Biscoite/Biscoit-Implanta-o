"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
type U = { email: string; nome: string | null; role: string; ativo: boolean; criado_por: string | null };
export function Usuarios({ eu }: { eu: string }) {
  const [lista, setLista] = useState<U[]>([]); const [email, setEmail] = useState(""); const [role, setRole] = useState("OPERADOR");
  const [aviso, setAviso] = useState<{ t: string; m: string } | null>(null);
  const carregar = () => api<U[]>("/api/usuarios").then(setLista).catch((e) => setAviso({ t: "erro", m: e.message }));
  useEffect(() => { carregar(); }, []);
  const acao = (p: Promise<unknown>, m: string) => p.then(() => { setAviso({ t: "ok", m }); carregar(); }).catch((e) => setAviso({ t: "erro", m: e.message }));
  return (<>
    {aviso && <div className={`aviso ${aviso.t}`}>{aviso.m}</div>}
    <div className="cartao"><h3 style={{ marginTop: 0 }}>Liberar acesso</h3>
      <div className="filtros"><div style={{ flex: 1 }}><label htmlFor="em">E-mail (domínio da empresa)</label><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label htmlFor="pp">Perfil</label><select id="pp" value={role} onChange={(e) => setRole(e.target.value)}><option value="LEITOR">Leitor</option><option value="OPERADOR">Operador</option><option value="ADMIN">Administrador</option></select></div>
        <button onClick={() => acao(api("/api/usuarios", "POST", { email, role }), "Usuário liberado.").then(() => setEmail(""))}>Adicionar</button></div></div>
    <div className="tabela-wrap"><table><thead><tr><th>E-mail</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>
      {lista.map((u) => <tr key={u.email}><td>{u.email}{u.nome ? <><br /><span className="sub">{u.nome}</span></> : null}</td>
        <td><select aria-label="Perfil" value={u.role} disabled={u.email === eu} onChange={(e) => acao(api("/api/usuarios", "PATCH", { email: u.email, role: e.target.value }), "Perfil alterado (sessões encerradas).")}><option value="LEITOR">Leitor</option><option value="OPERADOR">Operador</option><option value="ADMIN">Administrador</option></select></td>
        <td><span className={`selo ${u.ativo ? "ok" : "bloqueio"}`}>{u.ativo ? "ativo" : "bloqueado"}</span></td>
        <td>{u.email !== eu && <button className="sec" onClick={() => acao(api("/api/usuarios", "PATCH", { email: u.email, ativo: !u.ativo }), u.ativo ? "Acesso bloqueado e sessões encerradas." : "Acesso reativado.")}>{u.ativo ? "Bloquear" : "Reativar"}</button>}</td></tr>)}
    </tbody></table></div></>);
}
