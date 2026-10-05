/** Validate model data locally, including providers that only support JSON mode. */
export function validateModelOutput(value: unknown, schema?: Record<string, any>, depth = 0): void {
  const invalid = () => { throw new Error("Model output did not match the requested structure."); };
  if (depth > 30) invalid();
  if (typeof value === "string" && value.length > 100000) invalid();
  if (typeof value === "number" && !Number.isFinite(value)) invalid();
  if (schema?.enum && !schema.enum.includes(value)) invalid();
  if (schema?.type) {
    const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    if (schema.type !== actual && !(schema.type === "integer" && Number.isInteger(value))) invalid();
  }
  if (typeof value === "number") {
    if (schema?.minimum !== undefined && value < schema.minimum) invalid();
    if (schema?.maximum !== undefined && value > schema.maximum) invalid();
  }
  if (Array.isArray(value)) {
    if (value.length > 1000) invalid();
    for (const item of value) validateModelOutput(item, schema?.items, depth + 1);
  } else if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (Object.keys(object).length > 1000) invalid();
    for (const key of schema?.required || []) if (!Object.hasOwn(object, key)) invalid();
    for (const [key, item] of Object.entries(object)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) invalid();
      if (schema?.additionalProperties === false && !Object.hasOwn(schema.properties || {}, key)) invalid();
      validateModelOutput(item, schema?.properties?.[key], depth + 1);
    }
  }
}
