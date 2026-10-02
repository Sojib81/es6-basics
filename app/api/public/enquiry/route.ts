import { handleEnquiryRequest } from "@/lib/leads/handle-public";
import { publicDepsFromRequest, readJson } from "@/lib/leads/route-deps";

export async function POST(request: Request) {
  const result = await handleEnquiryRequest(
    await readJson(request),
    await publicDepsFromRequest(request),
  );
  return Response.json(result.body, { status: result.status });
}
