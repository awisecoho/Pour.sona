export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const format = req.nextUrl.searchParams.get("format") || "svg";
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  const url = `${process.env.NEXT_PUBLIC_APP_URL || "https://pour-sona.vercel.app"}/r/${slug}`;
  try {
    if (format === "png") {
      const png = await QRCode.toDataURL(url, { width: 400, margin: 2, errorCorrectionLevel: "H" });
      const buffer = Buffer.from(png.replace("data:image/png;base64,", ""), "base64");
      return new NextResponse(buffer, { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="qr-${slug}.png"` } });
    }
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "H" });
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml" } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
