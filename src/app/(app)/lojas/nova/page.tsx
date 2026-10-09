import { requireUser } from "@/lib/auth";
import { Assistente } from "@/components/Assistente";
export default async function Nova() {
  await requireUser("OPERADOR");
  return (<><h1>Cadastrar loja</h1><p className="sub">Responda passo a passo. Nada avança sem CNPJ.</p><Assistente /></>);
}
