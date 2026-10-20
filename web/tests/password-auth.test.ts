import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {Miniflare} from 'miniflare';
import {readFileSync} from 'node:fs';
import {handleAuth,authenticate} from '../worker/password-auth';
import type {Env} from '../worker/types';
let mf:Miniflare,env:Env;
const req=(path:string,body?:unknown,cookie?:string)=>new Request('https://app.test/api/auth/'+path,{method:body?'POST':'GET',headers:{Origin:'https://app.test','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
beforeAll(async()=>{mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response()}}',d1Databases:['DB']});const DB=await mf.getD1Database('DB');await DB.exec("CREATE TABLE professionals(id TEXT PRIMARY KEY,email TEXT NOT NULL,name TEXT NOT NULL);");await DB.batch(readFileSync(new URL('../migrations/0002_accounts.sql',import.meta.url),'utf8').split(';').map(s=>s.trim()).filter(Boolean).map(s=>DB.prepare(s)));env={DB,AUTH_PEPPER:'test-pepper-only-not-for-production',TURNSTILE_SECRET_KEY:'test-only-secret',TURNSTILE_SITE_KEY:'test-site-key'} as Env;vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const body=new URLSearchParams(String(init?.body));const response=body.get('response')||'';if(response==='network-failure')throw new Error('offline');return Response.json({success:response.startsWith('valid-'),hostname:response==='valid-wrong-host'?'other.test':'app.test',action:response.includes('login')?'login':'register'});})});
afterAll(async()=>{vi.restoreAllMocks();await mf?.dispose()});
it('registers without an invitation and authenticates a secure private session',async()=>{
 const data={email:'alice@example.test',name:'Alice',password:'A long unique password for testing!',turnstileToken:'valid-register'};
 const result=await handleAuth(req('register',data),env);expect(result.status).toBe(201);
 const cookie=result.headers.get('Set-Cookie')!;expect(cookie).toContain('HttpOnly');expect(cookie).toContain('Secure');expect(cookie).toContain('SameSite=Strict');
 const identity=await authenticate(req('session',undefined,cookie),env);expect(identity.email).toBe(data.email);
 expect((await handleAuth(req('register',data),env)).status).toBe(409);
 const stored=await env.DB.prepare('SELECT password_hash FROM accounts').first<any>();expect(stored.password_hash).not.toContain(data.password);
 await handleAuth(req('logout',{},cookie),env);await expect(authenticate(req('session',undefined,cookie),env)).rejects.toThrow();
},30000);
it('rejects wrong passwords and forged sessions, and expires sessions server side',async()=>{
 expect((await handleAuth(req('login',{email:'alice@example.test',password:'wrong password',turnstileToken:'valid-login'}),env)).status).toBe(401);
 const result=await handleAuth(req('login',{email:'alice@example.test',password:'A long unique password for testing!',turnstileToken:'valid-login'}),env);expect(result.status).toBe(200);
 await expect(authenticate(req('session',undefined,'__Host-dentection=forged'),env)).rejects.toThrow();
 const cookie=result.headers.get('Set-Cookie')!;await env.DB.prepare('UPDATE sessions SET expires_at=0').run();await expect(authenticate(req('session',undefined,cookie),env)).rejects.toThrow();
},30000);
it('rejects cross-origin authentication and limits repeated attempts',async()=>{
 const cross=req('login',{email:'alice@example.test',password:'wrong',turnstileToken:'valid-login'});cross.headers.set('Origin','https://other.test');expect((await handleAuth(cross,env)).status).toBe(403);
 for(let i=0;i<12;i++)await handleAuth(req('login',{email:'missing@example.test',password:'wrong',turnstileToken:'valid-login'}),env);
 expect((await handleAuth(req('login',{email:'missing@example.test',password:'wrong',turnstileToken:'valid-login'}),env)).status).toBe(429);
},30000);

it('rejects missing, forged, expired and wrong-host/action challenges without creating an account',async()=>{
 const data={email:'blocked@example.test',name:'Blocked',password:'A long password for this account!'};
 for(const token of [undefined,'forged','expired','valid-wrong-host','valid-login']){
  const result=await handleAuth(req('register',{...data,turnstileToken:token}),env);
  expect([400,403]).toContain(result.status);
 }
 expect(await env.DB.prepare("SELECT user_id FROM accounts WHERE email='blocked@example.test'").first()).toBeNull();
});
it('fails closed if Siteverify or its secret is unavailable',async()=>{
 const data={email:'unavailable@example.test',name:'Unavailable',password:'A long password for this account!',turnstileToken:'network-failure'};
 expect((await handleAuth(req('register',data),env)).status).toBe(503);
 expect((await handleAuth(req('register',{...data,turnstileToken:'valid-register'}),{...env,TURNSTILE_SECRET_KEY:''})).status).toBe(503);
});
it('creates a single profile when registrations race for the same email',async()=>{
 const data={email:'race@example.test',name:'Race',password:'A long unique password for racing!',turnstileToken:'valid-register'};
 const results=await Promise.all([handleAuth(req('register',data),env),handleAuth(req('register',data),env)]);
 expect(results.map(r=>r.status).sort()).toEqual([201,409]);
 const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM professionals WHERE email='race@example.test'").first<any>();expect(row.n).toBe(1);
},30000);

it('does not reuse a spent challenge to create a second account',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce(Response.json({success:true,hostname:'app.test',action:'register'})).mockResolvedValueOnce(Response.json({success:false,'error-codes':['timeout-or-duplicate']}));
 const data={name:'Replay test',email:'first-token@example.test',password:'A long password for replay testing!',turnstileToken:'one-time-token'};
 expect((await handleAuth(req('register',data),env)).status).toBe(201);
 expect((await handleAuth(req('register',{...data,email:'second-token@example.test'}),env)).status).toBe(403);
 expect(await env.DB.prepare("SELECT user_id FROM accounts WHERE email='second-token@example.test'").first()).toBeNull();
},30000);
it('exposes only the public site key in auth configuration',async()=>{
 const response=await handleAuth(req('config'),env);expect(response.status).toBe(200);expect(await response.json()).toEqual({siteKey:'test-site-key'});
});
