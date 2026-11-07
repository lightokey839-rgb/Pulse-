export async function POST() {
  return Response.json({ ok: false, status: "UNAVAILABLE", message: process.env.ATTESTOR_SECRET_KEY ? "Receipt writer is scaffolded but not enabled in this first build gate." : "Receipt unavailable: configure and fund the attestor wallet first." }, { status: 503 });
}
