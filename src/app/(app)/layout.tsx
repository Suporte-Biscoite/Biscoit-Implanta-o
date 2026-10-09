import Link from "next/link";
import { requireUser, hasRole } from "@/lib/auth";
import { Sair } from "@/components/Sair";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("LEITOR");
  return (
    <>
      <meta name="csrf-token" content={user.csrf} />
      <header className="topo">
        <span className="marca">Biscoitê · Implantação</span>
        <nav aria-label="Principal">
          <Link href="/">Painel</Link>
          {hasRole(user, "OPERADOR") && <Link href="/lojas/nova">Nova loja</Link>}
          {hasRole(user, "ADMIN") && <><Link href="/config">Configurações</Link><Link href="/usuarios">Usuários</Link><Link href="/auditoria">Auditoria</Link></>}
        </nav>
        <span className="usuario">{user.email} ({user.role.toLowerCase()}) <Sair /></span>
      </header>
      <main>{children}</main>
    </>
  );
}
