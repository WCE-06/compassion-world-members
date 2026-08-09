import { NextRequest, NextResponse } from "next/server";

type LineProfile = { userId: string; displayName: string };

async function verifyLineToken(token: string): Promise<LineProfile | null> {
  const response = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<LineProfile>;
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "LINE_ACCESS_TOKEN_REQUIRED" }, { status: 401 });

  const profile = await verifyLineToken(token);
  if (!profile) return NextResponse.json({ error: "INVALID_LINE_ACCESS_TOKEN" }, { status: 401 });

  // 初期版の接続点。ここで line_user_id を identity_links から検索し、
  // member_id を介して会員・利用セッションを取得する。
  // DB未接続時は会員情報を推測せず、移行フローへ返す。
  return NextResponse.json(
    { error: "MEMBERSHIP_NOT_LINKED", lineDisplayName: profile.displayName },
    { status: 404 },
  );
}
