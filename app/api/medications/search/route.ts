import { z } from "zod";

const QuerySchema = z.string().trim().min(2).max(80);
const RXTERMS_SEARCH_URL = "https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search";

type RxTermsResponse = [
  number,
  string[],
  { STRENGTHS_AND_FORMS?: string[][]; RXCUIS?: string[][] },
  string[][],
];

export async function GET(request: Request) {
  const parsed = QuerySchema.safeParse(new URL(request.url).searchParams.get("terms"));
  if (!parsed.success) return Response.json({ results: [] });

  const url = new URL(RXTERMS_SEARCH_URL);
  url.searchParams.set("terms", parsed.data);
  url.searchParams.set("ef", "STRENGTHS_AND_FORMS,RXCUIS");
  url.searchParams.set("maxList", "8");

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`RxTerms returned ${response.status}`);
    const [, names, extraFields] = await response.json() as RxTermsResponse;
    const strengths = extraFields.STRENGTHS_AND_FORMS || [];
    const rxcuis = extraFields.RXCUIS || [];
    return Response.json({
      results: names.map((name, index) => ({
        name,
        strengthsAndForms: strengths[index] || [],
        rxcuis: rxcuis[index] || [],
      })),
    }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    console.error("RxTerms medication search failed", { error: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "Medication search is temporarily unavailable." }, { status: 503 });
  }
}
