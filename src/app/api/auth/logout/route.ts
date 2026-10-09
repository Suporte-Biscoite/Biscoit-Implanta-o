import { NextResponse, type NextRequest } from "next/server";
import { withApi, destroySession, SESSION_COOKIE } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const POST = withApi("LEITOR", async (req: NextRequest, { user, ip }) => {
  await destroySession(req.cookies.get(SESSION_COOKIE)?.value); // invalida no servidor
  await audit("LOGOUT", { user: user.email, ip });
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" });
  return res;
});
