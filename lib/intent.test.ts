import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "./intent";

test("routes plain-English requests", () => {
  assert.equal(parseIntent("check WIF")?.href, "/token/WIF");
  assert.equal(parseIntent("is $BONK safe?")?.href, "/token/BONK");
  assert.equal(parseIntent("show serial launchers")?.href, "/?filter=serial");
  assert.equal(parseIntent("what's trending right now")?.href, "/trending");
  assert.equal(parseIntent("newest launches")?.href, "/");
  assert.equal(parseIntent("how does the score work")?.href, "/methodology");
  assert.equal(parseIntent("tokens with fewer flags")?.href, "/?filter=clean");
  assert.equal(parseIntent("scan DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")?.href, "/token/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263");
  assert.equal(parseIntent("   "), null);
});
