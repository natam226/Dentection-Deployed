import {describe,it,expect} from 'vitest';
import {saveAnalysis,needsNoteSave} from '../src/api';
import type {Study} from '../src/types';
const study:Study={id:'same-request-id',filename:'image.png',mimeType:'image/png',size:3,width:10,height:10,status:'pending',modelVersion:'dental-yolov8n-2025',parameters:{confidence:0.25,iou:0.7},detections:[],notes:'Guardada',revision:0};
describe('save workflow',()=>{
 it('retries a failed original upload with the same study identity and returns only a ready study',async()=>{
  let attempt=0;const ids:string[]=[];
  const transport=async(path:string,options:RequestInit={})=>{
   if(path==='/studies'){ids.push(JSON.parse(options.body as string).id);return {...study};}
   if(attempt++===0)throw new Error('Network unavailable');
   return {...study,status:'ready'};
  };
  await expect(saveAnalysis(study,new Blob(['png']),transport as any)).rejects.toThrow('Network unavailable');
  const result=await saveAnalysis(study,new Blob(['png']),transport as any);
  expect(result.status).toBe('ready');expect(ids).toEqual(['same-request-id','same-request-id']);
 });
 it('treats unsaved text as dirty until the server-confirmed note matches',()=>{
  expect(needsNoteSave(study,'Cambio')).toBe(true);
  expect(needsNoteSave(study,'Guardada')).toBe(false);
 });
 it('does not upload or re-analyze an already stored study',async()=>{
  const transport=async(path:string)=>{if(path!=='/studies')throw new Error('Already saved original must not be uploaded again');return {...study,status:'ready'};};
  const result=await saveAnalysis(study,new Blob(['png']),transport as any);
  expect(result.status).toBe('ready');
 });
});
