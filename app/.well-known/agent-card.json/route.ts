import { getAgentCard } from "@/lib/a2a";

export async function GET() {
  return Response.json(getAgentCard(), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
