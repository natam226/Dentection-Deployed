import type {Env,Identity} from './types';
import {HttpError,check,readJSON} from './studies';
const encoder=new TextEncoder();
const COOKIE='__Host-dentection';
const SESSION_SECONDS=8*60*60;
const ITERATIONS=100000; // workerd's Web Crypto maximum; independent secret pepper protects DB-only compromise.
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('');
export async function sha256(value:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
function random(){return hex(crypto.getRandomValues(new Uint8Array(32)));}
function token(request:Request){return request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);}
async function passwordHash(password:string,salt:string,pepper:string){
 if(!pepper||pepper.length<24)throw new Error('Authentication not configured');
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const derived=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:ITERATIONS,hash:'SHA-256'},key,256);
 const secret=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',secret,derived));
}
function equal(a:string,b:string){let result=a.length^b.length;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return result===0;}
async function throttle(env:Env,key:string,max:number){
 const now=Math.floor(Date.now()/1000);
 const result=await env.DB.prepare('INSERT INTO auth_attempts(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count').bind(key,now+900,now,now).first<{count:number}>();
 if(!result||result.count>max)throw new HttpError(429,'Demasiados intentos. Espera 15 minutos antes de volver a intentar.');
}
async function sessionResponse(env:Env,userId:string,status=200){
 const raw=random(),expires=Math.floor(Date.now()/1000)+SESSION_SECONDS;
 await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<=unixepoch()'),env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(raw),userId,expires)]);
 return new Response(JSON.stringify({ok:true}),{status,headers:{...headers,'Set-Cookie':`${COOKIE}=${raw}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`}});
}
export async function authenticate(request:Request,env:Env):Promise<Identity>{
 const raw=token(request);if(!raw||!/^[a-f0-9]{64}$/.test(raw))throw new Error('Authentication required');
 const row=await env.DB.prepare('SELECT p.id,p.email FROM sessions s JOIN professionals p ON p.id=s.user_id WHERE s.token_hash=? AND s.expires_at>unixepoch()').bind(await sha256(raw)).first<Identity>();
 if(!row)throw new Error('Authentication required');return row;
}
export async function handleAuth(request:Request,env:Env):Promise<Response>{
 try{
  if(request.method!=='POST')throw new HttpError(405,'Acción no disponible.');
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new HttpError(403,'La solicitud debe venir de esta aplicación.');
  const path=new URL(request.url).pathname.split('/').pop();
  if(path==='logout'){
   const raw=token(request);if(raw)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(raw)).run();
   return new Response(JSON.stringify({ok:true}),{headers:{...headers,'Set-Cookie':`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`}});
  }
  if(path!=='login'&&path!=='register')throw new HttpError(404,'Acción no disponible.');
  const d=await readJSON(request);
  check(d&&typeof d.email==='string'&&d.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)&&typeof d.password==='string'&&d.password.length<=256,'Revisa tu correo y contraseña.');
  const email=d.email.trim().toLowerCase();
  await throttle(env,'ip:'+await sha256(request.headers.get('CF-Connecting-IP')||'local'),50);
  await throttle(env,'email:'+await sha256(email),10);
  // Remove expired counters with every auth request; bounded by the 15-minute window.
  await env.DB.prepare('DELETE FROM auth_attempts WHERE expires_at<=unixepoch()').run();
  if(path==='register'){
   check(typeof d.name==='string'&&d.name.trim().length>=2&&d.name.length<=100&&d.password.length>=15&&typeof d.invitation==='string'&&d.invitation.length<=200,'Usa tu nombre, una contraseña de al menos 15 caracteres y tu invitación.');
   const inviteHash=await sha256(d.invitation);
   const invitation=await env.DB.prepare('SELECT email FROM invitations WHERE token_hash=? AND used=0 AND expires_at>unixepoch()').bind(inviteHash).first<{email:string}>();
   if(!invitation||invitation.email!==email)throw new HttpError(403,'La invitación no es válida para ese correo o ya fue utilizada.');
   const id=crypto.randomUUID(),salt=random(),hash=await passwordHash(d.password,salt,env.AUTH_PEPPER);
   const results=await env.DB.batch([
    env.DB.prepare('INSERT INTO professionals(id,email,name) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM invitations WHERE token_hash=? AND used=0 AND expires_at>unixepoch())').bind(id,email,d.name.trim(),inviteHash),
    env.DB.prepare('INSERT INTO accounts(user_id,email,password_hash,salt) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM professionals WHERE id=?)').bind(id,email,hash,salt,id),
    env.DB.prepare('UPDATE invitations SET used=1 WHERE token_hash=? AND used=0 AND EXISTS(SELECT 1 FROM accounts WHERE user_id=?)').bind(inviteHash,id),
   ]);
   if(!results[0].meta.changes)throw new HttpError(403,'La invitación ya fue utilizada.');
   return sessionResponse(env,id,201);
  }
  const account=await env.DB.prepare('SELECT user_id,password_hash,salt FROM accounts WHERE email=?').bind(email).first<{user_id:string;password_hash:string;salt:string}>();
  const computed=await passwordHash(d.password,account?.salt||'constant-dummy-salt-for-missing-user',env.AUTH_PEPPER);
  if(!account||!equal(computed,account.password_hash))throw new HttpError(401,'El correo o la contraseña no son correctos.');
  return sessionResponse(env,account.user_id);
 }catch(error){
  const status=error instanceof HttpError?error.status:String(error).includes('UNIQUE constraint')?409:500;
  return new Response(JSON.stringify({error:error instanceof HttpError?error.message:status===409?'Ya existe una cuenta con ese correo.':'No se pudo iniciar sesión. Intenta de nuevo.'}),{status,headers});
 }
}
