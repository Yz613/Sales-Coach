import assert from "node:assert/strict";
import { applyOrder, DEFAULT_METRIC_ORDER, DEFAULT_SECTION_ORDER, moveId } from "./dashboardLayout";

assert.deepEqual(applyOrder(["script", "pain"], DEFAULT_METRIC_ORDER), ["script", "pain", "budget", "decision"]);
assert.deepEqual(applyOrder(["ghost", "budget"], DEFAULT_METRIC_ORDER), ["budget", "pain", "decision", "script"]);
assert.deepEqual(moveId(["a", "b", "c"], "a", "c"), ["b", "c", "a"]);
assert.deepEqual(moveId(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
assert.deepEqual(moveId(["a", "b", "c"], "b", "b"), ["a", "b", "c"]);
assert.deepEqual(applyOrder([], DEFAULT_SECTION_ORDER), [...DEFAULT_SECTION_ORDER]);

console.log("dashboardLayout checks passed");
