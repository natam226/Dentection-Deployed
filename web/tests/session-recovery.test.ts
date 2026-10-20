// @vitest-environment happy-dom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';import {URL as NodeURL} from 'node:url';import {webcrypto} from 'node:crypto';
vi.mock('../src/inference',()=>({analyze:async()=>[{classId:6,confidence:.8,box:[1,1,9,9]}]}));
let expired=false,saved:any,profile={email:'professional@example.test',name:'Professional'},requests:string[]=[],postedIds:string[]=[];
const existing={id:'12345678-1234-4123-8123-123456789abc',filename:'saved.png',mimeType:'image/png',size:10,width:10,height:10,status:'ready',modelVersion:'dental-yolov8n-2025',parameters:{confidence:.25,iou:.7},detections:[],notes:'Original',revision:0};
const click=(id:string)=>document.getElementById(id)!.click();
const waitFor=async(fn:()=>void)=>vi.waitFor(fn,{timeout:3000});
beforeEach(async()=>{
 vi.resetModules();expired=false;requests=[];postedIds=[];saved=undefined;
 document.body.innerHTML=readFileSync(new NodeURL('../index.html',import.meta.url),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
 vi.stubGlobal('confirm',()=>true);vi.stubGlobal('crypto',webcrypto);
 vi.stubGlobal('createImageBitmap',async()=>({width:10,height:10,close(){}}));
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage(){},strokeRect(){},fillRect(){},fillText(){},measureText(){return {width:8}}} as any);
 vi.stubGlobal('fetch',vi.fn(async(input:any,init:any={})=>{
  const path=String(input);requests.push(path);if(path==='/api/studies'&&init.method==='POST')postedIds.push(JSON.parse(init.body).id);
  if(path==='/api/auth/login'){expired=false;return Response.json({ok:true});}
  if(expired)return Response.json({error:'Sesión finalizada'},{status:401});
  if(path==='/api/me')return Response.json(profile);
  if(path==='/api/studies'&&init.method==='POST'){saved=JSON.parse(init.body);return Response.json({...saved,status:'pending'});}
  if(path.endsWith('/image')&&init.method==='PUT')return Response.json({...saved,status:'ready'});
  if(path.endsWith('/notes'))return Response.json({notes:JSON.parse(init.body).notes,revision:1});
  if(path.endsWith('/image'))return new Response(new Uint8Array([1,2,3]));
  if(path==='/api/studies')return Response.json({studies:[existing],total:1,nextCursor:null});
  if(path==='/api/studies/'+existing.id)return Response.json(existing);
  throw new Error('Unexpected '+path);
 }));
 await import('../src/main');await waitFor(()=>expect(document.getElementById('account-name')!.textContent).toBe('Professional'));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
async function loginAgain(){
 expect((document.getElementById('auth-panel') as HTMLElement).hidden).toBe(false);
 expect((document.getElementById('auth-email') as HTMLInputElement).value).toBe(profile.email);
 (document.getElementById('auth-password') as HTMLInputElement).value='A long password for testing!';
 document.getElementById('auth-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await waitFor(()=>expect((document.getElementById('auth-panel') as HTMLElement).hidden).toBe(true));
}
it('preserves an analyzed image and its identifier when a save requires reauthentication',async()=>{
 expired=true;const input=document.getElementById('image-input') as HTMLInputElement;
 Object.defineProperty(input,'files',{configurable:true,value:[new File([new Uint8Array([1,2,3])],'new.png',{type:'image/png'})]});
 input.dispatchEvent(new Event('change',{bubbles:true}));
 await waitFor(()=>expect(document.getElementById('notification')!.textContent).toContain('sesión'));
 await loginAgain();click('retry-save');
 await waitFor(()=>expect(document.getElementById('save-status')!.textContent).toBe('Guardado en tu historial'));
 expect(postedIds).toHaveLength(2);expect(postedIds[0]).toBe(postedIds[1]);expect(saved.filename).toBe('new.png');expect(saved.detections).toHaveLength(1);
 expect((document.getElementById('analysis-workspace') as HTMLElement).hidden).toBe(false);
});
it('preserves dirty notes across expired-session login and saves them after retry',async()=>{
 click('nav-history');await waitFor(()=>expect((document.getElementById('nav-history') as HTMLButtonElement).disabled).toBe(false));await waitFor(()=>expect(document.querySelector('.history-row button')).not.toBeNull());
 (document.querySelector('.history-row button') as HTMLElement).click();
 await waitFor(()=>expect((document.getElementById('notes') as HTMLTextAreaElement).value).toBe('Original'));
 const notes=document.getElementById('notes') as HTMLTextAreaElement;notes.value='My unsaved professional review';notes.dispatchEvent(new Event('input',{bubbles:true}));expired=true;click('save-notes');
 await waitFor(()=>expect(document.getElementById('notification')!.textContent).toContain('sesión'));
 await loginAgain();expect(notes.value).toBe('My unsaved professional review');click('save-notes');
 await waitFor(()=>expect(document.getElementById('note-state')!.textContent).toBe('Sin cambios pendientes'));
 expect(notes.value).toBe('My unsaved professional review');
});
