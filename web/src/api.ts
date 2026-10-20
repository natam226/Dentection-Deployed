import type {Study} from './types';
export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const response=await fetch('/api'+path,{credentials:'same-origin',...options});
 if(!response.ok){let message='No se pudo completar la solicitud.';try{message=(await response.json()).error||message;}catch{}
  throw new ApiError(response.status,message);}
 if(response.status===204)return undefined as T;
 return response.json();
}
export async function saveAnalysis(study:Study,image:Blob,transport:typeof api=api):Promise<Study>{
 const saved=await transport<Study>('/studies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(study)});
 if(saved.status==='ready')return saved;
 return transport<Study>('/studies/'+saved.id+'/image',{method:'PUT',headers:{'Content-Type':study.mimeType},body:image});
}
export function needsNoteSave(study:Study,text:string):boolean {return study.notes!==text;}
