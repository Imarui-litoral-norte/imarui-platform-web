import assert from "node:assert/strict";
import fs from "node:fs";
await import('./test-identity-entrypoints.mjs');
const records=new Map([["logimarui.auth.session",JSON.stringify({accessToken:"legacy-access",refreshToken:"legacy-refresh"})]]);
const storage={getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
globalThis.window={localStorage:storage,sessionStorage:storage,location:{origin:"https://localhost:8443",hostname:"localhost",port:"8443",protocol:"https:"},dispatchEvent(){}};
globalThis.BroadcastChannel=class{postMessage(){} close(){}};
let lock=Promise.resolve();
Object.defineProperty(globalThis,"navigator",{configurable:true,value:{locks:{request(name,callback){assert.equal(name,"logimarui-iiam-refresh");const current=lock.then(callback);lock=current.catch(()=>{});return current;}}}});
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const sessionUrl=url(fs.readFileSync("src/features/auth/lib/authSession.js","utf8"));
const gatewayUrl=url(fs.readFileSync("src/shared/network/gatewayUrl.js","utf8"));
const session=await import(sessionUrl);
assert.equal(session.readAuthSession(),null);assert.equal(records.has("logimarui.auth.session"),false);
const apiSource=fs.readFileSync("src/features/auth/lib/authApi.js","utf8").replace('"@/features/auth/lib/authSession"',JSON.stringify(sessionUrl)).replace('"@/shared/network/gatewayUrl"',JSON.stringify(gatewayUrl));
const first=await import(url(apiSource)),second=await import(url(apiSource+"\n// independent tab module"));
const calls=[];let rotations=0,active=0,maximum=0;
globalThis.fetch=async(input,options={})=>{
  const path=new URL(input).pathname;calls.push({path,...options});assert.equal(options.credentials,"include");
  if(path.endsWith('/csrf'))return Response.json({token:"csrf-fixture"});
  if(path.endsWith('/refresh')){
    assert.equal(options.headers['X-XSRF-TOKEN'],"csrf-fixture");assert.equal(options.body,undefined);active+=1;maximum=Math.max(maximum,active);
    await new Promise(resolve=>setTimeout(resolve,10));active-=1;rotations+=1;return Response.json({accessToken:`access-fixture-${rotations}`,expiresIn:900});
  }
  if(path.endsWith('/browser-context'))return new Response(null,{status:204});
  if(path.endsWith('/logout')){assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers['X-XSRF-TOKEN'],"csrf-fixture");return new Response(null,{status:204});}
  return new Response('upstream transport failure',{status:403});
};
await Promise.all([first.refreshSession(),first.refreshSession(),second.refreshSession()]);
assert.equal(rotations,2);assert.equal(maximum,1);assert.equal(session.readAuthSession().refreshToken,undefined);
assert.equal(records.size,0);assert.ok(calls.filter(c=>c.path.endsWith('/browser-context')).every(c=>c.headers.Authorization.startsWith('Bearer access-fixture-')));
await assert.rejects(()=>first.authRequest('/api/v1/private',{authenticated:true}),error=>error.status===403&&error.message==='upstream transport failure');
await first.authApi.logout();session.clearAuthSession();assert.equal(session.readAuthSession(),null);assert.equal(records.size,0);
console.log("IIAM browser transport: legacy storage cleared, access only in JS memory, cookie refresh with CSRF, single-flight and cross-tab lock serialization verified.");
