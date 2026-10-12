import assert from "node:assert/strict";
import test from "node:test";
import { formatCount, formatCurrency, formatDuration, formatUpdated } from "./utils";

test("formatDuration rejects NaN, negative, and absurd lengths", () => {
  assert.equal(formatDuration(Number.NaN), "—");
  assert.equal(formatDuration(Number.POSITIVE_INFINITY), "—");
  assert.equal(formatDuration(-1), "—");
  assert.equal(formatDuration(99 * 3600 + 59 * 60 + 60), "—");
  assert.equal(formatDuration(996044 * 60 + 1), "—");
});

test("formatDuration keeps ordinary call lengths", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(null), "0:00");
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(99 * 3600 + 59 * 60 + 59), "99:59:59");
  assert.equal(formatDuration(3661), "1:01:01");
});

test("formatCount always leaves a space before the noun", () => {
  assert.equal(formatCount(2, "call"), "2 calls");
  assert.equal(formatCount(1, "call"), "1 call");
  assert.equal(formatCount(0, "question"), "0 questions");
});

test("formatCurrency uses grouped whole dollars", () => {
  assert.equal(formatCurrency(100000), "$100,000");
  assert.equal(formatCurrency(100000.5), "$100,000.50");
  assert.equal(formatCurrency(Number.NaN), "—");
});

test("formatUpdated includes a space after Updated", () => {
  assert.match(formatUpdated("2026-10-11T15:00:00.000Z"), /^Updated Oct 11, 2026$/);
});
