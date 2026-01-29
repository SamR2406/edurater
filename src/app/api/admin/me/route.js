import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";

export async function GET(request) {
  const authResult = await requireAdmin(request);
  if (authResult.error) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  return NextResponse.json({ data: { isAdmin: true } });
}
