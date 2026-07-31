import { getSelfFacilitator } from "@/lib/x402-facilitator";

export async function POST(req: Request) {
  const facilitator = getSelfFacilitator();
  if (!facilitator) {
    return Response.json(
      { error: "Self-facilitator offline. Set X402_FACILITATOR_PRIVATE_KEY." },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as {
      paymentPayload?: unknown;
      paymentRequirements?: unknown;
    };
    if (!body.paymentPayload || !body.paymentRequirements) {
      return Response.json(
        { error: "Missing paymentPayload or paymentRequirements" },
        { status: 400 },
      );
    }
    const result = await facilitator.settle(
      body.paymentPayload as never,
      body.paymentRequirements as never,
    );
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
