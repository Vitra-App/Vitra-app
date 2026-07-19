import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ONE-TIME admin endpoint — verifies a user's email directly in the DB.
// Protected by a shared secret. Delete this file after use.
export async function POST(req: NextRequest) {
  const { email, secret } = await req.json();

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  return NextResponse.json({ ok: true, email: user.email, emailVerified: user.emailVerified });
}
