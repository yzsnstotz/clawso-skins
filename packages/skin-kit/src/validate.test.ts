import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { validateSkin } from "./validate";

test("validates the default example skin", () => {
  const exampleDir = path.resolve(__dirname, "../../../examples/default");
  const result = validateSkin(exampleDir);
  assert.equal(result.ok, true);
  assert.equal(result.manifest?.id, "default");
});
