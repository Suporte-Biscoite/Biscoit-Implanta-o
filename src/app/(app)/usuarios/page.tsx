import { requireUser } from "@/lib/auth";
import { Usuarios } from "@/components/Usuarios";
export default async function Pagina() {
  const u = await requireUser("ADMIN");
  return (<><h1>Usuários autorizados</h1><p className="sub">Só quem está nesta lista (e ativo) consegue entrar, mesmo tendo conta no domínio.</p><Usuarios eu={u.email} /></>);
}
