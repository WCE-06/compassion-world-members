import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return NextResponse.json({ error: "LINE_ACCESS_TOKEN_REQUIRED" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { memberCode?: string; verificationCode?: string } | null;
  if (!body?.memberCode) return NextResponse.json({ error: "MEMBER_CODE_REQUIRED" }, { status: 400 });

  // 本番接続では、氏名・電話番号等の追加確認またはワンタイムコードを必須にする。
  // 会員番号だけでLINEアカウントへ紐付けてはいけない。
  return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 409 });
}
