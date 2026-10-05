import { computeComparisonMetrics, formatComparisonReport, exportEvaluationDataset } from "../src/lib/ai/clefComparison";
import { writeFileSync } from "fs";

async function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes("--json");
  const exportIdx = args.indexOf("--export");
  const outIdx = args.indexOf("--out");

  if (exportIdx !== -1) {
    const format = args[exportIdx + 1] === "jsonl" ? "jsonl" : "json";
    const data = await exportEvaluationDataset({ format });
    const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);

    if (outIdx !== -1 && args[outIdx + 1]) {
      const outPath = args[outIdx + 1];
      writeFileSync(outPath, content, "utf8");
      console.log(`Exported evaluation dataset to ${outPath}`);
    } else {
      console.log(content);
    }
    return;
  }

  const metrics = await computeComparisonMetrics();

  if (isJson) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    console.log(formatComparisonReport(metrics));
  }
}

main().catch((err) => {
  console.error("Failed to generate Clef comparison report:", err);
  process.exit(1);
});
