import { requireUser } from "@/lib/auth";
import { getConfig, secretStatus } from "@/lib/config";
import { ConfigEditor } from "@/components/ConfigEditor";
export default async function Config() {
  await requireUser("ADMIN");
  return (<><h1>Configurações</h1><p className="sub">Somente administradores. Toda alteração fica registrada na auditoria.</p>
    <ConfigEditor inicial={await getConfig()} segredos={await secretStatus()} /></>);
}
