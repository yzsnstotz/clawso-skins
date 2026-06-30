import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { publishSkin } from "./publish";
import { validateArtifact, validatePetPack, validateSkin } from "./validate";

test("validates the default example skin", () => {
  const exampleDir = path.resolve(__dirname, "../../../examples/default");
  const result = validateSkin(exampleDir);
  assert.equal(result.ok, true);
  assert.equal(result.manifest?.id, "default");
});

test("validates the pawsnap puppy pet-pack example", () => {
  const exampleDir = path.resolve(__dirname, "../../../examples/pet-packs/pawsnap-puppy");
  const result = validatePetPack(exampleDir);
  assert.equal(result.ok, true);
  assert.equal(result.manifest?.id, "pawsnap-puppy");
});

test("detects skin and pet-pack artifacts", () => {
  const skinDir = path.resolve(__dirname, "../../../examples/default");
  const petDir = path.resolve(__dirname, "../../../examples/pet-packs/pawsnap-puppy");

  assert.equal(validateArtifact(skinDir).kind, "skin");
  assert.equal(validateArtifact(petDir).kind, "pet-pack");
});

test("plans skin publish through Creator Studio BFF endpoints", async () => {
  const exampleDir = path.resolve(__dirname, "../../../examples/default");
  const result = await publishSkin(
    exampleDir,
    { apiBase: "http://127.0.0.1:18808", token: "test", dryRun: true },
    "test dry-run"
  );

  assert.equal(result.plan.preflightEndpoint, "http://127.0.0.1:18808/api/creator/skin/preflight");
  assert.equal(result.plan.submitEndpoint, "http://127.0.0.1:18808/api/creator/skin/submissions");
});
