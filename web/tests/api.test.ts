import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import { readFileSync,readdirSync } from 'node:fs';
import { createHandler } from '../worker/index';
import type { Env } from '../worker/types';

let mf: Miniflare, env: Env;
const image = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,10,0,0,0,10,8,2,0,0,0]);
const hash = async (data: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(v=>v.toString(16).padStart(2,'0')).join('');
const alice = createHandler(async () => ({id:'alice', email:'alice@example.test'}));
const bob = createHandler(async () => ({id:'bob', email:'bob@example.test'}));
const anonymous = createHandler(async () => { throw new Error('Unauthenticated'); });
const uuid = () => crypto.randomUUID();
function request(path:string, method='GET', data?:unknown) {
  return new Request('https://app.test/api'+path, {method, headers:{Origin:'https://app.test', 'Content-Type':'application/json'},
    body: data === undefined ? undefined : JSON.stringify(data)});
}
async function payload(id=uuid()) {
  return {id, filename:'panoramica.png', mimeType:'image/png', size:image.length, width:10, height:10,
    sha256:await hash(image), modelVersion:'dental-yolov8n-2025', parameters:{confidence:0.25,iou:0.7},
    detections:[{classId:6,confidence:0.8,box:[1,1,8,8]}]};
}
beforeAll(async () => {
  mf = new Miniflare({modules:true, script:'export default { fetch(){ return new Response("test"); } }',
    compatibilityDate:'2026-08-01', d1Databases:['DB'], kvNamespaces:['IMAGES']});
  const DB = await mf.getD1Database('DB');
  for(const file of readdirSync(new URL('../migrations',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){
    const migration=readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8');
    const start=migration.indexOf('CREATE TRIGGER');
    const statements=start<0?migration.split(';').map(s=>s.trim()).filter(Boolean):[...migration.slice(0,start).split(';').map(s=>s.trim()).filter(Boolean),migration.slice(start)];
    await DB.batch(statements.map(s=>DB.prepare(s)));
  }
  env = {DB, IMAGES:await mf.getKVNamespace('IMAGES'), ASSETS:{fetch:()=>new Response('assets')},
    AUTH_PEPPER:'test-only-pepper-not-for-production'} as unknown as Env;
},30000);
afterAll(async()=>{await mf?.dispose()});

describe('private study API',()=>{
  it('fails closed without authenticated identity even with forged email headers',async()=>{
    const req=request('/studies'); req.headers.set('Cf-Access-Authenticated-User-Email','alice@example.test');
    expect((await anonymous(req,env)).status).toBe(401);
  });
  it('creates a pending study, uploads its original, and reopens a persistent history',async()=>{
    const data=await payload();
    expect((await alice(request('/studies','POST',data),env)).status).toBe(201);
    const upload=new Request('https://app.test/api/studies/'+data.id+'/image',{method:'PUT',headers:{Origin:'https://app.test','Content-Type':'image/png'},body:image});
    expect((await alice(upload,env)).status).toBe(200);
    const details=await (await alice(request('/studies/'+data.id),env)).json() as any;
    expect(details.status).toBe('ready'); expect(details.detections[0].classId).toBe(6);
    expect(Array.from(new Uint8Array(await (await alice(request('/studies/'+data.id+'/image'),env)).arrayBuffer()))).toEqual(Array.from(image));
    const list=await (await alice(request('/studies'),env)).json() as any;
    expect(list.studies.some((s:any)=>s.id===data.id)).toBe(true);
  });
  it('does not disclose another owner study, original image, notes, or deletion',async()=>{
    const data=await payload(); await alice(request('/studies','POST',data),env);
    for(const [path,method,body] of [
      ['/studies/'+data.id,'GET',undefined], ['/studies/'+data.id+'/image','GET',undefined],
      ['/studies/'+data.id+'/notes','PATCH',{notes:'overwrite',revision:0}], ['/studies/'+data.id,'DELETE',undefined],
    ] as const) expect((await bob(request(path,method,body),env)).status).toBe(404);
  });
  it('makes duplicate save retry idempotent and does not reserve capacity twice',async()=>{
    const data=await payload(); await alice(request('/studies','POST',data),env);
    expect((await alice(request('/studies','POST',data),env)).status).toBe(200);
    const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM studies WHERE id=?').bind(data.id).first<any>();
    expect(row.n).toBe(1);
    expect((await bob(request('/studies','POST',data),env)).status).toBe(409);
  });
  it('saves text notes and rejects an outdated edit instead of losing changes',async()=>{
    const data=await payload(); await alice(request('/studies','POST',data),env);
    expect((await alice(request('/studies/'+data.id+'/notes','PATCH',{notes:'Revisar cordal.',revision:0}),env)).status).toBe(200);
    expect((await alice(request('/studies/'+data.id+'/notes','PATCH',{notes:'stale',revision:0}),env)).status).toBe(409);
    expect((await (await alice(request('/studies/'+data.id),env)).json() as any).notes).toBe('Revisar cordal.');
  });
  it('rejects invalid coordinates, oversize images, and cross-origin changes',async()=>{
    const data=await payload();
    expect((await alice(request('/studies','POST',{...data,size:5242881}),env)).status).toBe(400);
    expect((await alice(request('/studies','POST',{...data,detections:[{classId:6,confidence:0.8,box:[8,8,1,1]}]}),env)).status).toBe(400);
    const req=request('/studies','POST',data); req.headers.set('Origin','https://other.test');
    expect((await alice(req,env)).status).toBe(403);
  });
  it('rejects bytes that do not match the original digest and keeps the study pending',async()=>{
    const data=await payload(); await alice(request('/studies','POST',data),env);
    const corrupt=image.slice(); corrupt[20]=11;
    expect((await alice(new Request('https://app.test/api/studies/'+data.id+'/image',{
      method:'PUT',headers:{Origin:'https://app.test','Content-Type':'image/png'},body:corrupt}),env)).status).toBe(400);
    expect((await (await alice(request('/studies/'+data.id),env)).json() as any).status).toBe('pending');
  });
  it('rejects null notes payload as a client error',async()=>{
    const data=await payload(); await alice(request('/studies','POST',data),env);
    expect((await alice(request('/studies/'+data.id+'/notes','PATCH',null),env)).status).toBe(400);
  });
  it('preserves the original when a simultaneous upload already marked it ready',async()=>{
    const data=await payload(); await alice(request('/studies','POST',data),env);
    const simultaneous={...env,IMAGES:{
      put:async(key:string,value:Uint8Array,options:any)=>{
        await env.IMAGES.put(key,value,options);
        await env.DB.prepare("UPDATE studies SET status='ready' WHERE id=?").bind(data.id).run();
      },delete:(key:string)=>env.IMAGES.delete(key),
    }} as unknown as Env;
    const response=await alice(new Request('https://app.test/api/studies/'+data.id+'/image',{
      method:'PUT',headers:{Origin:'https://app.test','Content-Type':'image/png'},body:image}),simultaneous);
    expect(response.status).toBe(200);
    expect((await alice(request('/studies/'+data.id+'/image'),env)).status).toBe(200);
  });
  it('keeps daily upload accounting after studies are deleted',async()=>{
    const limited=createHandler(async()=>({id:'limited',email:'limited@example.test'}));
    await env.DB.prepare("INSERT INTO upload_counts(day,owner_id,uploads) VALUES(date('now'),'limited',49)").run();
    const data=await payload();
    expect((await limited(request('/studies','POST',data),env)).status).toBe(201);
    expect((await limited(request('/studies/'+data.id,'DELETE'),env)).status).toBe(204);
    expect((await limited(request('/studies','POST',await payload()),env)).status).toBe(429);
  },30000);
  it('keeps failed image deletion visible and allows a safe retry',async()=>{
    const data=await payload();await alice(request('/studies','POST',data),env);
    await alice(new Request('https://app.test/api/studies/'+data.id+'/image',{method:'PUT',headers:{Origin:'https://app.test','Content-Type':'image/png'},body:image}),env);
    const unavailable={...env,IMAGES:{delete:async()=>{throw new Error('KV unavailable')}}} as unknown as Env;
    expect((await alice(request('/studies/'+data.id,'DELETE'),unavailable)).status).toBe(503);
    expect((await alice(request('/studies/'+data.id),env)).status).toBe(404);
    const list=await (await alice(request('/studies'),env)).json() as any;
    expect(list.studies.find((s:any)=>s.id===data.id).status).toBe('deleting');
    expect((await alice(request('/studies/'+data.id,'DELETE'),env)).status).toBe(204);
    expect((await alice(request('/studies/'+data.id,'DELETE'),env)).status).toBe(204);
    expect((await (await alice(request('/studies'),env)).json() as any).studies.some((s:any)=>s.id===data.id)).toBe(false);
  });
  it('does not revive an original uploaded concurrently with deletion',async()=>{
    const data=await payload();await alice(request('/studies','POST',data),env);
    const racing={...env,IMAGES:{put:async(key:string,value:Uint8Array,options:any)=>{
      await alice(request('/studies/'+data.id,'DELETE'),env);
      await env.IMAGES.put(key,value,options);
    },delete:(key:string)=>env.IMAGES.delete(key)}} as unknown as Env;
    expect((await alice(new Request('https://app.test/api/studies/'+data.id+'/image',{method:'PUT',headers:{Origin:'https://app.test','Content-Type':'image/png'},body:image}),racing)).status).toBe(404);
    const row=await env.DB.prepare('SELECT image_key FROM studies WHERE id=?').bind(data.id).first<any>();
    expect(await env.IMAGES.get(row.image_key)).toBe(null);
  });
  it('pages through more than 200 studies without losing the oldest',async()=>{
    await env.DB.prepare("INSERT INTO professionals(id,email,name) VALUES('paged','paged@example.test','Paged')").run();
    const ids:string[]=[];
    for(let batch=0;batch<6;batch++){
      await env.DB.prepare("DELETE FROM upload_counts WHERE owner_id='paged'").run();
      const statements=[];
      for(let i=0;i<40&&ids.length<201;i++){
        const d=await payload();ids.push(d.id);
        statements.push(env.DB.prepare('INSERT INTO studies(id,owner_id,filename,mime_type,size,width,height,image_key,sha256,model_version,parameters,detections) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(d.id,'paged','old.png','image/png',image.length,10,10,'paged/'+d.id,d.sha256,d.modelVersion,JSON.stringify(d.parameters),'[]'));
      }
      if(statements.length)await env.DB.batch(statements);
    }
    const paged=createHandler(async()=>({id:'paged',email:'paged@example.test'}));
    const seen=new Set<string>();let cursor:string|undefined;
    do{
      const response=await paged(request('/studies'+(cursor?'?cursor='+cursor:'')),env);
      const body=await response.json() as any;expect(body.total).toBe(201);
      for(const study of body.studies)seen.add(study.id);cursor=body.nextCursor;
    }while(cursor);
    expect(seen.size).toBe(201);expect(ids.every(id=>seen.has(id))).toBe(true);
  },30000);
});
