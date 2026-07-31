import { getSelfFacilitator } from "@/lib/x402-facilitator";

export async function GET() {
  const facilitator = getSelfFacilitator();
  if (!facilitator) {
    return Response.json(
      {
        error:
          "Self-facilitator offline. Set X402_FACILITATOR_PRIVATE_KEY on Vercel.",
        supported: false,
      },
      { status: 503 },
    );
  }
  return Response.json(facilitator.getSupported());
}
