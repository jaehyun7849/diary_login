import { GET as getData } from "../data/route";
import { GET as getExperiment } from "../experiment/route";
import { requireUser, reply, fail } from "../../../lib/auth";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    await requireUser(req);
    const a = await getData(req),
      b = await getExperiment(req);
    if (!a.ok) return a;
    if (!b.ok) return b;
    return reply(
      {
        schemaVersion: 3,
        exportedAt: new Date().toISOString(),
        timezone: "Asia/Seoul",
        timeUnit: "minute",
        diary: await a.json(),
        observation: await b.json(),
      },
      200,
      { "Content-Disposition": 'attachment; filename="move-diary.json"' },
    );
  } catch (e) {
    return fail(e);
  }
}
