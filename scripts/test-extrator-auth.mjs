import assert from "node:assert/strict";
import fs from "node:fs";
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const sessionModule = asModule(fs.readFileSync("src/features/auth/lib/authSession.js", "utf8"));
const gatewayModule = asModule(fs.readFileSync("src/shared/network/gatewayUrl.js", "utf8"));
globalThis.window = { location: { origin: "https://gateway.test", hostname: "gateway.test", protocol: "https:", port: "" }, localStorage: {removeItem(){}}, sessionStorage: {removeItem(){}}, dispatchEvent(){} };
globalThis.BroadcastChannel = class {postMessage(){}};
Object.defineProperty(globalThis, "navigator", {value:{locks:{request: async (_, callback) => callback()}}, configurable:true});
const session = await import(sessionModule);
session.saveAuthSession({accessToken:"expired-fixture", expiresIn:900});
const authModule = asModule(fs.readFileSync("src/features/auth/lib/authApi.js", "utf8").replace('"@/features/auth/lib/authSession"', JSON.stringify(sessionModule)).replace('"@/shared/network/gatewayUrl"', JSON.stringify(gatewayModule)));
const {extratorApi} = await import(asModule(fs.readFileSync("src/features/extrator-manager/api/extratorApi.js", "utf8").replace('"@/features/auth/lib/authApi"', JSON.stringify(authModule))));
let refreshes=0, statusCalls=0;
globalThis.fetch = async (url, options) => {
  assert.equal(options.credentials, "include");
  const path = new URL(url).pathname;
  if(path.endsWith("/csrf")) return Response.json({token:"csrf-fixture"});
  if(path.endsWith("/refresh")){refreshes++; return Response.json({accessToken:"renewed-fixture",expiresIn:900});}
  if(path.endsWith("/browser-context")){assert.equal(options.headers.Authorization,"Bearer renewed-fixture");return new Response(null,{status:204});}
  assert.equal(path,"/api/extrator/status");statusCalls++;
  if(statusCalls===1){assert.equal(options.headers.Authorization,"Bearer expired-fixture");return new Response(null,{status:401});}
  assert.equal(options.headers.Authorization,"Bearer renewed-fixture");
  return Response.json({running:true});
};
assert.deepEqual(await extratorApi.getStatus(),{running:true});
assert.equal(refreshes,1);assert.equal(statusCalls,2);
globalThis.fetch = async () => Response.json({code:"ACCESS_DENIED"},{status:403});
await assert.rejects(extratorApi.getStatus(),error=>error.status===403);
assert.equal(refreshes,1);
console.log("Extrator: Bearer transport, HTTPS, cookie credentials, 401 refresh with browser context and 403 preservation passed.");