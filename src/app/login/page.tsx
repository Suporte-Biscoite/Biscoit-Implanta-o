export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="login">
      <div className="cartao">
        <h1>Implantação de Lojas</h1>
        <p className="sub">Acesso restrito ao time de TI da Biscoitê.</p>
        {erro && <div className="aviso erro">Não foi possível entrar. Use sua conta Google da empresa e confirme com o administrador se seu e-mail está liberado.</div>}
        <a className="botao" href="/api/auth/login">Entrar com Google</a>
      </div>
    </main>
  );
}
