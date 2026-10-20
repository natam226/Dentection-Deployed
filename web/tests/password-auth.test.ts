import {beforeAll,afterAll,it,expect} from 'vitest';
import {Miniflare} from 'miniflare';
import {readFileSync} from 'node:fs';
import {handleAuth,authenticate,sha256} from '../worker/password-auth';
import type {Env} from '../worker/types';
let mf:Miniflare,env:Env;
const req=(path:string,body?:unknown,cookie?:string)=>new Request('https://app.test/api/auth/'+path,{method:body?'POST':'GET',headers:{Origin:'https://app.test','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
beforeAll(async()=>{mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response()}}',d1Databases:['DB']});const DB=await mf.getD1Database('DB');await DB.exec("CREATE TABLE professionals(id TEXT PRIMARY KEY,email TEXT NOT NULL,name TEXT NOT NULL);");await DB.batch(readFileSync(new URL('../migrations/0002_accounts.sql',import.meta.url),'utf8').split(';').map(s=>s.trim()).filter(Boolean).map(s=>DB.prepare(s)));env={DB,AUTH_PEPPER:'test-pepper-only-not-for-production'} as Env;await DB.prepare('INSERT INTO invitations(token_hash,email) VALUES(?,?)').bind(await sha256('invitation-test'),'alice@example.test').run();});
afterAll(async()=>{await mf?.dispose()});
it('registers only with a matching one-time invitation and authenticates a secure session',async()=>{
 const data={email:'alice@example.test',name:'Alice',password:'A long unique password for testing!',invitation:'invitation-test'};
 expect((await handleAuth(req('register',{...data,email:'bob@example.test'}),env)).status).toBe(403);
 const result=await handleAuth(req('register',data),env);expect(result.status).toBe(201);
 const cookie=result.headers.get('Set-Cookie')!;expect(cookie).toContain('HttpOnly');expect(cookie).toContain('Secure');expect(cookie).toContain('SameSite=Strict');
 const identity=await authenticate(req('session',undefined,cookie),env);expect(identity.email).toBe(data.email);
 expect((await handleAuth(req('register',data),env)).status).toBe(403);
 const stored=await env.DB.prepare('SELECT password_hash FROM accounts').first<any>();expect(stored.password_hash).not.toContain(data.password);
 await handleAuth(req('logout',{},cookie),env);await expect(authenticate(req('session',undefined,cookie),env)).rejects.toThrow();
},30000);
it('rejects wrong passwords and forged sessions, and expires sessions server side',async()=>{
 expect((await handleAuth(req('login',{email:'alice@example.test',password:'wrong password'}),env)).status).toBe(401);
 const result=await handleAuth(req('login',{email:'alice@example.test',password:'A long unique password for testing!'}),env);expect(result.status).toBe(200);
 await expect(authenticate(req('session',undefined,'__Host-dentection=forged'),env)).rejects.toThrow();
 const cookie=result.headers.get('Set-Cookie')!;await env.DB.prepare('UPDATE sessions SET expires_at=0').run();await expect(authenticate(req('session',undefined,cookie),env)).rejects.toThrow();
},30000);
it('rejects cross-origin authentication and limits repeated attempts',async()=>{
 const cross=req('login',{email:'alice@example.test',password:'wrong'});cross.headers.set('Origin','https://other.test');expect((await handleAuth(cross,env)).status).toBe(403);
 for(let i=0;i<12;i++)await handleAuth(req('login',{email:'missing@example.test',password:'wrong'}),env);
 expect((await handleAuth(req('login',{email:'missing@example.test',password:'wrong'}),env)).status).toBe(429);
},30000);
