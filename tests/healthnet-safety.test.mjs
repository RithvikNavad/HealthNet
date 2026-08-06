import assert from "node:assert/strict";
import test from "node:test";
import { detectUrgentWarning } from "../lib/healthnet-safety.mjs";

test("flags urgent breathing and stroke-like reports", () => {
  assert.match(detectUrgentWarning("I suddenly cannot breathe") ?? "", /immediate|emergency/i);
  assert.match(detectUrgentWarning("I have sudden one-sided weakness") ?? "", /immediate|emergency/i);
});

test("flags severe chest pain and immediate self-harm risk", () => {
  assert.match(detectUrgentWarning("I have crushing chest pain") ?? "", /chest pain/i);
  assert.match(detectUrgentWarning("I plan to hurt myself") ?? "", /immediate|emergency/i);
});

test("does not flag explicit negatives or routine symptoms", () => {
  assert.equal(detectUrgentWarning("I have dizziness but no chest pain or trouble breathing"), null);
  assert.equal(detectUrgentWarning("I have had mild headaches in the afternoon for two weeks"), null);
  assert.equal(detectUrgentWarning("I do not have one-sided weakness"), null);
});
