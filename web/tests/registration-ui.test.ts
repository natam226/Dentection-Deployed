// @vitest-environment happy-dom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';import {readFileSync} from 'node:fs';import {URL as NodeURL} from 'node:url';
const challenge=vi.hoisted(()=>({token:'valid-register',changed:undefined as undefined|((ready:boolean,message:string)=>void)}));
vi.mock('../src/turnstile',()=>({prepareChallenge:async(_container:any,_action:any,changed:any)=>{challenge.changed=changed;changed(true,'Verificación completada.');},getChallengeToken:()=>challenge.token,resetChallenge:()=>{challenge.token='';challenge.changed?.(false,'Repite la verificación.');},removeChallenge:()=>{}}));
let bodies:any[],signedIn=false,fail=false;
beforeEach(async()=>{
 vi.resetModules();bodies=[];signedIn=false;fail=false;challenge.token='valid-register';
 document.body.innerHTML=readFileSync(new NodeURL('../index.html',import.meta.url),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
 vi.stubGlobal('fetch',vi.fn(async(input:any,init:any={})=>{
  const path=String(input);
  if(path==='/api/me')return signedIn?Response.json({name:'Nuevo profesional',email:'nuevo@example.test'}):Response.json({error:'Inicia sesión'},{status:401});
  if(path==='/api/studies')return Response.json({studies:[],total:0,nextCursor:null});
  if(path==='/api/auth/register'){bodies.push(JSON.parse(init.body));if(fail)return Response.json({error:'Ya existe una cuenta con ese correo.'},{status:409});signedIn=true;return Response.json({ok:true},{status:201});}
  throw new Error('Unexpected '+path);
 }));
 await import('../src/main');await vi.waitFor(()=>expect((document.getElementById('auth-panel') as HTMLElement).hidden).toBe(false));
 document.getElementById('auth-switch')!.click();
 (document.getElementById('auth-name') as HTMLInputElement).value='Nuevo profesional';(document.getElementById('auth-email') as HTMLInputElement).value='nuevo@example.test';
 (document.getElementById('auth-password') as HTMLInputElement).value='A long password for this account!';
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const submit=()=>document.getElementById('auth-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
it('offers open registration with confirmation and sends the challenge without an invitation',async()=>{
 expect((document.querySelector('.sidebar') as HTMLElement).hidden).toBe(true);
 expect((document.querySelector('.topbar') as HTMLElement).hidden).toBe(true);
 expect(document.body.classList.contains('auth-screen')).toBe(true);
 expect(document.getElementById('auth-invitation')).toBeNull();
 const confirm=document.getElementById('auth-confirm') as HTMLInputElement;expect(confirm).not.toBeNull();confirm.value='A long password for this account!';submit();
 await vi.waitFor(()=>expect(bodies).toHaveLength(1));expect(bodies[0].turnstileToken).toBe('valid-register');expect(bodies[0]).not.toHaveProperty('invitation');
 await vi.waitFor(()=>expect((document.getElementById('auth-panel') as HTMLElement).hidden).toBe(true));
 expect((document.querySelector('.sidebar') as HTMLElement).hidden).toBe(false);
 expect((document.querySelector('.topbar') as HTMLElement).hidden).toBe(false);
 expect(document.body.classList.contains('auth-screen')).toBe(false);
});
it('prevents mismatched passwords and expired challenges from reaching the server',async()=>{
 const confirm=document.getElementById('auth-confirm') as HTMLInputElement;expect(confirm).not.toBeNull();confirm.value='Different password';submit();
 await vi.waitFor(()=>expect(document.getElementById('auth-error')!.textContent).toContain('coinciden'));expect(bodies).toHaveLength(0);
 challenge.token='';challenge.changed?.(false,'La verificación venció.');expect((document.getElementById('auth-submit') as HTMLButtonElement).disabled).toBe(true);
});
it('keeps entered fields and requests a fresh challenge after a duplicate account response',async()=>{
 const confirm=document.getElementById('auth-confirm') as HTMLInputElement;expect(confirm).not.toBeNull();confirm.value='A long password for this account!';fail=true;submit();
 await vi.waitFor(()=>expect(document.getElementById('auth-error')!.textContent).toContain('Ya existe'));
 expect((document.getElementById('auth-email') as HTMLInputElement).value).toBe('nuevo@example.test');expect((document.getElementById('auth-name') as HTMLInputElement).value).toBe('Nuevo profesional');expect(challenge.token).toBe('');
});
