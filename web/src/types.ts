import type {Detection} from './detection';
export interface Study {
 id:string;filename:string;createdAt?:string;status:'pending'|'ready'|'deleting';mimeType:string;size:number;width:number;height:number;
 modelVersion:string;parameters:{confidence:number;iou:number};detections:Detection[];notes:string;revision:number;sha256?:string;
}
export interface Profile {email:string;name:string}
export const CLASS_LABELS=['Tratamiento de conducto','Fractura','Diastema','Cordal','Quiste periapical','Diente retenido','Caries','Zona edéntula','Diente sano','Apiñamiento','Diente rotado','Supernumerario','Enanismo radicular','Residuo radicular'];
export const MODEL_VERSION='dental-yolov8n-2025';
