import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLoja } from "@/lib/stores";
import { CHECKLIST, fluxoDe } from "@/lib/domain";
import { LojaDetalhe } from "@/components/LojaDetalhe";

export default async function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("LEITOR");
  const { id } = await params;
  const loja = await getLoja(id);
  if (!loja) notFound();
  const fluxo = fluxoDe(loja.tipo);
  return <LojaDetalhe id={id} checklist={CHECKLIST[fluxo]} fluxo={fluxo} papel={user.role} />;
}
