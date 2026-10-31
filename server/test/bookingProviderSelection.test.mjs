import test from "node:test";
import assert from "node:assert/strict";
import { chooseProvider } from "../src/domain/bookings/bookingService.js";

const guardian = { id: "guardian", name: "Guardian One" };
const sts = { id: "sts", name: "STS" };

test("single provider is automatically assigned", () => {
  assert.equal(chooseProvider([guardian], null), "guardian");
});
test("single provider cannot be overridden", () => {
  assert.throws(() => chooseProvider([guardian], "sts"), /not assigned/);
});
test("multiple providers require explicit selection", () => {
  assert.throws(() => chooseProvider([guardian, sts], null), /Select one/);
  assert.equal(chooseProvider([guardian, sts], "sts"), "sts");
});
test("unrelated provider cannot receive booking", () => {
  assert.throws(() => chooseProvider([guardian, sts], "other"), /Select one/);
});
test("no active providers blocks booking", () => {
  assert.throws(() => chooseProvider([], null), /No active transport provider/);
});
