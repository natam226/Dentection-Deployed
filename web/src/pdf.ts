import {jsPDF} from 'jspdf';
import {CLASS_LABELS,type Profile,type Study} from './types';
let fontPromise:Promise<string>|undefined;
async function font(){
 if(!fontPromise)fontPromise=fetch('/fonts/NotoSans-Regular.ttf').then(async r=>{if(!r.ok)throw new Error('No se pudo preparar la tipografía del informe. Reintenta la descarga.');const bytes=new Uint8Array(await r.arrayBuffer());let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(binary);}).catch(error=>{fontPromise=undefined;throw error;});
 return fontPromise;
}
export async function createReport(study:Study,profile:Profile,image:string):Promise<jsPDF> {
 const pdf=new jsPDF({compress:true});const width=180,left=15;let y=20;
 pdf.addFileToVFS('NotoSans-Regular.ttf',await font());pdf.addFont('NotoSans-Regular.ttf','NotoSans','normal');pdf.addFont('NotoSans-Regular.ttf','NotoSans','bold');
 const ensure=(height:number)=>{if(y+height>277){pdf.addPage();y=20;}};
 const line=(text:string,size=10,bold=false)=>{pdf.setFont('NotoSans',bold?'bold':'normal');pdf.setFontSize(size);const lines=pdf.splitTextToSize(text,width) as string[];
  for(const content of lines){ensure(size*.45+3);pdf.text(content,left,y);y+=size*.45+2;} };
 pdf.setTextColor(39,70,117);line('Dentection',22,true);pdf.setTextColor(45,60,80);
 line('Informe de revisión de radiografía panorámica',13,true);y+=4;
 line('Profesional: '+profile.name);line('Correo: '+profile.email);
 line('Estudio: '+study.filename);line('Fecha del análisis: '+new Date(study.createdAt||Date.now()).toLocaleString('es-CO'));
 line('Modelo: '+study.modelVersion+' | Confianza mínima: '+Math.round(study.parameters.confidence*100)+' %');y+=6;
 const imageWidth=Math.min(width,100*study.width/study.height),imageHeight=imageWidth*study.height/study.width;ensure(imageHeight+10);
 pdf.addImage(image,'JPEG',left+(width-imageWidth)/2,y,imageWidth,imageHeight,undefined,'FAST');y+=imageHeight+10;
 line('Resumen de detecciones automáticas',12,true);
 const counts=new Map<string,number>();for(const d of study.detections){const label=CLASS_LABELS[d.classId];counts.set(label,(counts.get(label)||0)+1);}
 if(!study.detections.length)line('El modelo no detectó hallazgos con el umbral utilizado. Esto no descarta otras condiciones.');
 else {line('Total de hallazgos: '+study.detections.length);for(const [label,count]of counts)line(label+': '+count);}
 y+=5;line('Detalle de detecciones',12,true);
 for(const [index,d]of study.detections.entries())line((index+1)+'. '+CLASS_LABELS[d.classId]+' — Confianza del modelo: '+(d.confidence*100).toFixed(1)+' %');
 y+=6;line('Observaciones del profesional',12,true);
 for(const paragraph of (study.notes||'Sin observaciones registradas.').split('\n')){line(paragraph||' ');}
 y+=7;pdf.setTextColor(90,105,125);line('Las detecciones automáticas requieren revisión profesional. Las observaciones fueron escritas por el profesional y no son recomendaciones generadas por el modelo.',9);
 const total=pdf.getNumberOfPages();for(let p=1;p<=total;p++){pdf.setPage(p);pdf.setFontSize(8);pdf.setTextColor(100,115,130);pdf.text('Dentection · '+p+' / '+total,195,289,{align:'right'});}
 return pdf;
}
