import { and, eq } from "drizzle-orm";
import { evaluations } from "./schema";

/** Replace a review atomically so a failed insert cannot erase the previous scorecard. */
export async function replaceCallEvaluation(database: any, value: typeof evaluations.$inferInsert): Promise<void> {
  const queries = (connection: any) => [
    connection.delete(evaluations).where(and(eq(evaluations.callId, value.callId), eq(evaluations.orgId, value.orgId || "local"))),
    connection.insert(evaluations).values(value),
  ];
  if (typeof database.batch === "function") {
    // D1 batches are transactional; explicit BEGIN/COMMIT is unavailable in Workers.
    await database.batch(queries(database));
  } else {
    // better-sqlite3 requires a synchronous transaction callback.
    database.transaction((transaction: any) => {
      for (const query of queries(transaction)) query.run();
    });
  }
}
