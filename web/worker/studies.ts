import type { Detection } from '../src/detection';
export const MAX_IMAGE = 5 * 1024 * 1024;
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export function check(condition:unknown,message:string):asserts condition {if(!condition)throw new HttpError(400,message);}
export interface StudyRow {
 id:string;owner_id:string;filename:string;created_at:string;status:string;mime_type:string;size:number;
 width:number;height:number;image_key:string;sha256:string;model_version:string;parameters:string;detections:string;notes:string;revision:number;
}
export function present(row:StudyRow){return {id:row.id,filename:row.filename,createdAt:row.created_at,status:row.status,
 mimeType:row.mime_type,size:row.size,width:row.width,height:row.height,modelVersion:row.model_version,
 parameters:JSON.parse(row.parameters),detections:JSON.parse(row.detections) as Detection[],notes:row.notes,revision:row.revision};}
export async function readLimited(request:Request,max:number):Promise<Uint8Array> {
 if(Number(request.headers.get('Content-Length'))>max)throw new HttpError(413,'El archivo supera el tamaño permitido.');
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();
 const parts:Uint8Array[]=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
  if(total>max){await reader.cancel();throw new HttpError(413,'El archivo supera el tamaño permitido.');}parts.push(value);}}
 finally{reader.releaseLock();}
 const result=new Uint8Array(total);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
export async function readJSON(request:Request):Promise<any>{
 try{return JSON.parse(new TextDecoder().decode(await readLimited(request,128*1024)));}
 catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'El contenido enviado no es válido.');}
}
export function validateStudy(d:any){
 check(d&&typeof d==='object','Faltan los datos del estudio.');
 check(typeof d.id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(d.id),'Identificador inválido.');
 check(typeof d.filename==='string'&&d.filename.trim().length>0&&d.filename.length<=200,'Nombre de archivo inválido.');
 check(['image/png','image/jpeg'].includes(d.mimeType),'Solo se admiten imágenes PNG y JPG.');
 check(Number.isInteger(d.size)&&d.size>0&&d.size<=MAX_IMAGE,'La imagen debe pesar como máximo 5 MiB.');
 check(Number.isInteger(d.width)&&Number.isInteger(d.height)&&d.width>0&&d.height>0&&d.width*d.height<=40000000,'Dimensiones de imagen inválidas o demasiado grandes.');
 check(typeof d.sha256==='string'&&/^[0-9a-f]{64}$/.test(d.sha256),'No se pudo verificar la imagen original.');
 check(d.modelVersion==='dental-yolov8n-2025','Versión de modelo no reconocida.');
 check(d.parameters&&Number.isFinite(d.parameters.confidence)&&d.parameters.confidence>=0.05&&d.parameters.confidence<=0.95&&d.parameters.iou===0.7,'Parámetros de análisis inválidos.');
 check(Array.isArray(d.detections)&&d.detections.length<=300,'Resultados inválidos.');
 for(const b of d.detections){check(b&&Number.isInteger(b.classId)&&b.classId>=0&&b.classId<14&&Number.isFinite(b.confidence)&&b.confidence>=0&&b.confidence<=1&&Array.isArray(b.box)&&b.box.length===4&&b.box.every(Number.isFinite),'Detección inválida.');
  check(b.box[0]>=0&&b.box[1]>=0&&b.box[2]<=d.width&&b.box[3]<=d.height&&b.box[2]>b.box[0]&&b.box[3]>b.box[1],'Coordenadas de detección inválidas.');}
 return d;
}
export function validImageMagic(bytes:Uint8Array,mime:string):boolean {
 if(mime==='image/png')return bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 return bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
}
