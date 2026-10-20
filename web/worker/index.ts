import type { Authenticate, Env, Identity } from './types';
import {authenticate,handleAuth} from './password-auth';
import {HttpError,check,readJSON,readLimited,validateStudy,present,validImageMagic,MAX_IMAGE,type StudyRow} from './studies';
const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...privateHeaders,'Content-Type':'application/json; charset=utf-8'}});}
async function profile(env:Env,user:Identity){
 await env.DB.prepare('INSERT INTO professionals(id,email,name) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email').bind(user.id,user.email,user.email.split('@')[0]).run();
 return env.DB.prepare('SELECT email,name FROM professionals WHERE id=?').bind(user.id).first();
}
export function createHandler(authenticateRequest: Authenticate) {
  return async (request: Request, env: Env): Promise<Response> => {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    if(url.pathname.startsWith('/api/auth/'))return handleAuth(request,env);
    let user:Identity;
    try{user=await authenticateRequest(request,env);}catch{return json({error:'Inicia sesión para acceder a tus estudios.',code:'AUTH_REQUIRED'},401);}
    try{
      if(!['GET','HEAD'].includes(request.method)&&request.headers.get('Origin')!==url.origin)throw new HttpError(403,'La solicitud debe venir de esta aplicación.');
      const path=url.pathname.slice(4);
      if(path==='/me'&&request.method==='GET')return json(await profile(env,user));
      if(path==='/studies'&&request.method==='GET'){
        const rows=await env.DB.prepare('SELECT * FROM studies WHERE owner_id=? ORDER BY created_at DESC LIMIT 200').bind(user.id).all<StudyRow>();
        return json({studies:rows.results.map(present)});
      }
      if(path==='/studies'&&request.method==='POST'){
        const d=validateStudy(await readJSON(request));
        const existing=await env.DB.prepare('SELECT * FROM studies WHERE id=?').bind(d.id).first<StudyRow>();
        if(existing){if(existing.owner_id!==user.id)throw new HttpError(409,'No se pudo asignar ese identificador. Reintenta con un nuevo análisis.');return json(present(existing));}
        await profile(env,user);
        await env.DB.prepare('INSERT INTO studies(id,owner_id,filename,mime_type,size,width,height,image_key,sha256,model_version,parameters,detections) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(d.id,user.id,d.filename,d.mimeType,d.size,d.width,d.height,'study/'+encodeURIComponent(user.id)+'/'+d.id,d.sha256,d.modelVersion,JSON.stringify(d.parameters),JSON.stringify(d.detections)).run();
        return json(present((await env.DB.prepare('SELECT * FROM studies WHERE id=? AND owner_id=?').bind(d.id,user.id).first<StudyRow>())!),201);
      }
      const match=path.match(/^\/studies\/([a-f0-9-]{36})(?:\/(image|notes))?$/i);
      if(!match)throw new HttpError(404,'No se encontró ese recurso.');
      const [,id,action]=match;
      const row=await env.DB.prepare('SELECT * FROM studies WHERE id=? AND owner_id=?').bind(id,user.id).first<StudyRow>();
      if(!row)throw new HttpError(404,'No se encontró el estudio.');
      if(!action&&request.method==='GET')return json(present(row));
      if(action==='image'&&request.method==='GET'){
        const value=await env.IMAGES.get(row.image_key,{type:'stream'});
        if(!value)throw new HttpError(503,'La imagen aún se está sincronizando. Reintenta en unos segundos.');
        return new Response(value,{headers:{...privateHeaders,'Content-Type':row.mime_type,'Content-Disposition':'inline; filename="radiografia.'+(row.mime_type==='image/png'?'png':'jpg')+'"'}});
      }
      if(action==='image'&&request.method==='PUT'){
        if(row.status==='ready')return json(present(row));
        const bytes=await readLimited(request,MAX_IMAGE);
        check(bytes.length===row.size&&request.headers.get('Content-Type')?.split(';')[0]===row.mime_type&&validImageMagic(bytes,row.mime_type),'La imagen recibida no coincide con el original.');
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
        check(digest===row.sha256,'La imagen recibida no coincide con el original. Reintenta la carga.');
        await env.IMAGES.put(row.image_key,bytes,{metadata:{mimeType:row.mime_type}});
        const update=await env.DB.prepare("UPDATE studies SET status='ready' WHERE id=? AND owner_id=? AND status='pending'").bind(id,user.id).run();
        if(!update.meta.changes){
          const latest=await env.DB.prepare('SELECT * FROM studies WHERE id=? AND owner_id=?').bind(id,user.id).first<StudyRow>();
          if(latest?.status==='ready')return json(present(latest));
          await env.IMAGES.delete(row.image_key);throw new HttpError(409,'El estudio cambió durante la carga. Vuelve al historial.');
        }
        return json(present({...row,status:'ready'}));
      }
      if(action==='notes'&&request.method==='PATCH'){
        const d=await readJSON(request);
        check(d&&typeof d.notes==='string'&&d.notes.length<=10000&&Number.isInteger(d.revision)&&d.revision>=0,'Las observaciones deben tener un máximo de 10.000 caracteres.');
        const result=await env.DB.prepare('UPDATE studies SET notes=?, revision=revision+1 WHERE id=? AND owner_id=? AND revision=?').bind(d.notes,id,user.id,d.revision).run();
        if(!result.meta.changes)throw new HttpError(409,'El estudio se actualizó en otra pestaña. Recarga el estudio antes de guardar.');
        return json({notes:d.notes,revision:d.revision+1});
      }
      if(!action&&request.method==='DELETE'){
        await env.DB.prepare('DELETE FROM studies WHERE id=? AND owner_id=?').bind(id,user.id).run();
        await env.IMAGES.delete(row.image_key);
        return new Response(null,{status:204,headers:privateHeaders});
      }
      throw new HttpError(405,'Acción no disponible.');
    }catch(error){
      if(error instanceof HttpError)return json({error:error.message},error.status);
      const text=String(error);
      if(text.includes('storage_limit'))return json({error:'Se alcanzó el almacenamiento de esta demostración. Elimina un estudio antes de subir otro.'},507);
      if(text.includes('daily_limit'))return json({error:'Se alcanzó el límite diario de cargas. Intenta de nuevo mañana.'},429);
      if(text.includes('UNIQUE constraint'))return json({error:'El estudio ya se está guardando. Reintenta para recuperar el estado.'},409);
      console.error('Study operation failed:',error instanceof Error?error.name:'unknown');
      return json({error:'No se pudo completar la operación. Tu trabajo sigue en esta vista; vuelve a intentarlo.'},500);
    }
  };
}
export default {fetch:createHandler(authenticate)};
