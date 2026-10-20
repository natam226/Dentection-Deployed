import * as ort from 'onnxruntime-web/wasm';
import {decodeDetections,type Detection} from './detection';
import {MODEL_VERSION} from './types';
ort.env.wasm.numThreads=1;
ort.env.wasm.wasmPaths='/ort/';
let sessionPromise:Promise<ort.InferenceSession>|undefined;
async function session(progress:(message:string)=>void){
 if(!sessionPromise){sessionPromise=(async()=>{
  progress('Descargando el modelo (12 MB). Solo se prepara una vez por sesión…');
  const [response,metaResponse]=await Promise.all([fetch('/model/model.onnx'),fetch('/model/metadata.json')]);
  if(!response.ok||!metaResponse.ok)throw new Error('No se pudo descargar el modelo. Comprueba la conexión y vuelve a intentar.');
  const [bytes,metadata]=await Promise.all([response.arrayBuffer(),metaResponse.json()]);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
  if(metadata.version!==MODEL_VERSION||metadata.names.length!==14||digest!==metadata.sha256)throw new Error('No se pudo verificar la versión del modelo. Recarga la página.');
  progress('Preparando el detector en tu navegador…');
  return ort.InferenceSession.create(bytes,{executionProviders:['wasm']});
 })().catch(error=>{sessionPromise=undefined;throw error;});}
 return sessionPromise;
}
export async function analyze(image:CanvasImageSource,width:number,height:number,confidence:number,progress:(message:string)=>void):Promise<Detection[]>{
 const model=await session(progress);
 progress('Analizando la radiografía…');
 // Match the established YOLO RGB/CHW/letterbox input with 114-valued padding.
 const scale=Math.min(640/width,640/height), nw=Math.round(width*scale), nh=Math.round(height*scale);
 const padX=Math.round((640-nw)/2-0.1), padY=Math.round((640-nh)/2-0.1);
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
 const context=canvas.getContext('2d',{willReadFrequently:true})!;
 context.fillStyle='rgb(114,114,114)';context.fillRect(0,0,640,640);
 context.drawImage(image,padX,padY,nw,nh);
 const pixels=context.getImageData(0,0,640,640).data,input=new Float32Array(3*640*640),plane=640*640;
 for(let p=0;p<plane;p++){input[p]=pixels[p*4]/255;input[p+plane]=pixels[p*4+1]/255;input[p+plane*2]=pixels[p*4+2]/255;}
 const output=await model.run({[model.inputNames[0]]:new ort.Tensor('float32',input,[1,3,640,640])});
 const result=output[model.outputNames[0]];
 return decodeDetections(result.data as Float32Array,result.dims,{width,height,scale,padX,padY},confidence,0.7);
}
