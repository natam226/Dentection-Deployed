import './styles.css';
import {prepareChallenge,getChallengeToken,resetChallenge,removeChallenge} from './turnstile';
import {api,ApiError,saveAnalysis,needsNoteSave} from './api';
import {CLASS_LABELS,MODEL_VERSION,type Study,type Profile} from './types';
import type {Detection} from './detection';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const iconPaths:Record<string,string>={plus:'M12 5v14M5 12h14',history:'M3 12a9 9 0 1 0 3-6.7M3 3v6h6M12 7v5l3 2',shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3ZM8 12l3 3 5-6',upload:'M12 16V3M7 8l5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',download:'M12 3v13M7 11l5 5 5-5M4 17v4h16v-4',logout:'M9 4H4v16h5M14 8l4 4-4 4M8 12h10',file:'M14 2H5v20h14V7l-5-5ZM14 2v6h5M8 13h8M8 17h6'};
for(const node of document.querySelectorAll<HTMLElement>('[data-icon]'))node.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+iconPaths[node.dataset.icon!]+'"/></svg>';
let profile:Profile|undefined,current:Study|undefined,original:Blob|undefined,image:ImageBitmap|HTMLImageElement|undefined;
let authRecovery=false,recoveryView:'new'|'history'='new',expectedEmail:string|undefined;
let historyCursor:string|null=null,historyTotal=0;
let studies:Study[]=[],busy=false,selected:number|undefined,zoom=1,canRetry=false,objectURL:string|undefined;
const notes=$<HTMLTextAreaElement>('notes'),input=$<HTMLInputElement>('image-input');
const date=(value?:string)=>value?new Date(value).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'}):'Análisis actual';
const percent=(n:number)=>(n*100).toFixed(1)+' %';
function notice(message:string,kind='info'){const el=$('notification');el.textContent=message;el.className='notification '+kind;el.hidden=false;}
function clearNotice(){$('notification').hidden=true;}
function errorMessage(error:unknown){if(error instanceof ApiError&&error.status===401)return 'Tu sesión terminó. Inicia sesión aquí para continuar; tu imagen y observaciones siguen en esta vista.';return error instanceof Error?error.message:'No se pudo completar la operación.';}
function progress(message:string){$('activity').hidden=false;$('activity-text').textContent=message;}
function actions(){
 const dirty=!!current&&needsNoteSave(current,notes.value);
 $<HTMLButtonElement>('download-pdf').disabled=busy||!current||current.status!=='ready';
 $<HTMLButtonElement>('save-notes').disabled=busy||!current||current.status!=='ready'||!dirty;
 $('note-state').textContent=dirty?'Cambios sin guardar':'Sin cambios pendientes';
 $('notes-count').textContent=notes.value.length.toLocaleString('es-CO')+' / 10.000 caracteres';
 $('retry-save').hidden=!canRetry||busy;
 notes.disabled=busy||!current||current.status!=='ready';input.disabled=busy;
 for(const id of ['nav-new','nav-history','new-study','history-new','history-more'])$<HTMLButtonElement>(id).disabled=busy||!profile||authRecovery;
 const status=$('save-status');status.textContent=current?.status==='ready'?'Guardado en tu historial':canRetry?'Guardado pendiente':'Sin guardar';status.classList.toggle('saved',current?.status==='ready');
}
async function operation(fn:()=>Promise<void>){if(busy)return;busy=true;actions();try{await fn();}catch(error){notice(errorMessage(error),'error');if(error instanceof ApiError&&error.status===401)showSessionRecovery();}finally{busy=false;$('activity').hidden=true;actions();}}
function canLeave(){return !current||(!needsNoteSave(current,notes.value)&&current.status==='ready')||confirm('Hay cambios o un estudio sin guardar. ¿Quieres salir de esta revisión?');}
function activate(view:'new'|'history'){$('new-view').hidden=view!=='new';$('history-view').hidden=view!=='history';$('nav-new').classList.toggle('active',view==='new');$('nav-history').classList.toggle('active',view==='history');
 $('nav-new').setAttribute('aria-current',view==='new'?'page':'false');$('nav-history').setAttribute('aria-current',view==='history'?'page':'false');}
function reset(){current=undefined;original=undefined;if(image&&'close'in image)image.close();image=undefined;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=undefined;selected=undefined;canRetry=false;notes.value='';input.value='';$('upload-panel').hidden=false;$('analysis-workspace').hidden=true;activate('new');clearNotice();actions();}
function newStudy(){if(!busy&&canLeave())reset();}
for(const id of ['nav-new','new-study','history-new'])$(id).addEventListener('click',newStudy);
$('nav-history').addEventListener('click',()=>{if(!busy&&canLeave()){activate('history');clearNotice();void operation(refreshHistory);}});
interface HistoryPage{studies:Study[];total:number;nextCursor:string|null}
function historyState(){$('history-count').textContent=String(historyTotal);$('history-state').textContent=historyTotal>studies.length?'Mostrando '+studies.length+' de '+historyTotal+' estudios. Carga más para buscar entre los anteriores.':(historyTotal===1?'1 estudio en tu historial.':historyTotal+' estudios en tu historial.');$('history-more').hidden=!historyCursor;}
async function refreshHistory(){const result=await api<HistoryPage>('/studies');studies=result.studies;historyCursor=result.nextCursor;historyTotal=result.total;historyState();renderHistory();}
$('history-more').addEventListener('click',()=>void operation(async()=>{if(!historyCursor)return;const result=await api<HistoryPage>('/studies?cursor='+encodeURIComponent(historyCursor));studies.push(...result.studies);historyCursor=result.nextCursor;historyTotal=result.total;historyState();renderHistory();}));
function renderHistory(){
 const list=$('history-list');list.replaceChildren();const search=$<HTMLInputElement>('history-search').value.trim().toLocaleLowerCase('es');
 const visible=studies.filter(s=>s.filename.toLocaleLowerCase('es').includes(search));
 if(!visible.length){const p=document.createElement('p');p.className='history-empty';p.textContent=search?'No hay estudios con ese nombre.':'Tu historial empieza con tu primera radiografía.';list.append(p);return;}
 for(const study of visible){const row=document.createElement('article');row.className='history-row';
  const symbol=document.createElement('div');symbol.className='study-file-icon';symbol.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="'+iconPaths.file+'"/></svg>';
  const main=document.createElement('div');main.className='history-row-main';const title=document.createElement('strong');title.textContent=study.filename;const meta=document.createElement('p');meta.textContent=date(study.createdAt)+' · '+(study.status==='ready'?study.detections.length+' hallazgos':study.status==='deleting'?'Eliminación pendiente: vuelve a intentar':'Carga incompleta')+(study.notes?' · Con observaciones':'');main.append(title,meta);
  const open=document.createElement('button');open.className='button secondary';open.textContent='Abrir estudio';open.disabled=study.status!=='ready';open.addEventListener('click',()=>{if(!busy&&canLeave())void operation(()=>openStudy(study.id));});
  const remove=document.createElement('button');remove.className='delete-study';remove.textContent=study.status==='deleting'?'Reintentar eliminación':'Eliminar';remove.setAttribute('aria-label','Eliminar '+study.filename);remove.addEventListener('click',()=>{if(busy||!confirm('¿Eliminar este estudio y su radiografía de tu historial? Esta acción no se puede deshacer.'))return;void operation(async()=>{try{await api('/studies/'+study.id,{method:'DELETE'});}catch(error){if(!(error instanceof ApiError&&error.status===401))await refreshHistory();throw error;}if(current?.id===study.id){current=undefined;original=undefined;}await refreshHistory();notice('El estudio se eliminó de tu historial.','success');});});
  row.append(symbol,main,open,remove);list.append(row);
 }
}
$('history-search').addEventListener('input',renderHistory);
async function digest(blob:Blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function decode(blob:Blob){const bitmap=await createImageBitmap(blob);if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000){bitmap.close();throw new Error('La imagen es demasiado grande. Usa una panorámica de hasta 40 megapíxeles.');}return bitmap;}
function filtered(){if(!current)return [];const classId=$<HTMLSelectElement>('class-filter').value;const threshold=Number($<HTMLInputElement>('visible-threshold').value)/100;return current.detections.map((d,index)=>({d,index})).filter(({d})=>(classId==='all'||String(d.classId)===classId)&&d.confidence>=threshold);}
function draw(target:HTMLCanvasElement,all=false){
 if(!current||!image)return;target.width=current.width;target.height=current.height;const ctx=target.getContext('2d')!;ctx.drawImage(image,0,0,target.width,target.height);
 const detections=all?current.detections.map((d,index)=>({d,index})):filtered();
 const ratio=Math.max(1,current.width/1000),lineWidth=Math.max(2,ratio*2),fontSize=Math.max(12,ratio*13);
 for(const {d,index}of detections){const isSelected=!all&&selected===index;const [x1,y1,x2,y2]=d.box;ctx.strokeStyle=isSelected?'#48debd':selected!==undefined&&!all?'#9aafc2':'#72c5ff';ctx.lineWidth=isSelected?lineWidth*1.7:lineWidth;ctx.strokeRect(x1,y1,x2-x1,y2-y1);ctx.font='600 '+fontSize+'px sans-serif';const label=String(index+1),w=ctx.measureText(label).width+10;ctx.fillStyle=ctx.strokeStyle;ctx.fillRect(x1,Math.max(0,y1-fontSize-7),w,fontSize+7);ctx.fillStyle='#102233';ctx.fillText(label,x1+5,Math.max(fontSize+1,y1-5));}
}
function drawCurrent(){draw($<HTMLCanvasElement>('radiograph'));}
function results(){
 if(!current)return;const visible=filtered();$('findings-total').textContent=String(visible.length);$('visible-threshold-value').textContent=$<HTMLInputElement>('visible-threshold').value+' %';
 const summary=$('summary');summary.replaceChildren();const counts=new Map<number,number>();for(const {d}of visible)counts.set(d.classId,(counts.get(d.classId)||0)+1);
 for(const [classId,count]of [...counts].sort((a,b)=>b[1]-a[1]).slice(0,4)){const row=document.createElement('div');row.className='summary-row';const label=document.createElement('span');label.textContent=CLASS_LABELS[classId];const amount=document.createElement('strong');amount.textContent=String(count);row.append(label,amount);summary.append(row);}
 const body=$('detections-body');body.replaceChildren();for(const {d,index}of visible){const tr=document.createElement('tr');tr.classList.toggle('selected-row',selected===index);const cell=document.createElement('td');const button=document.createElement('button');button.className='detection-button';button.setAttribute('aria-pressed',String(selected===index));const number=document.createElement('span');number.className='detection-number';number.textContent=String(index+1);const label=document.createElement('span');label.textContent=CLASS_LABELS[d.classId];button.append(number,label);button.addEventListener('click',()=>{selected=selected===index?undefined:index;results();});cell.append(button);const confidence=document.createElement('td');confidence.textContent=percent(d.confidence);tr.append(cell,confidence);body.append(tr);}
 $('findings-empty').hidden=visible.length>0;$('detections-table').hidden=visible.length===0;drawCurrent();
}
function setZoom(value:number){zoom=Math.max(1,Math.min(4,value));$<HTMLCanvasElement>('radiograph').style.width=zoom*100+'%';$('zoom-value').textContent=Math.round(zoom*100)+' %';$('image-viewport').classList.toggle('zoomed',zoom>1);}
$('zoom-in').addEventListener('click',()=>setZoom(zoom+.25));$('zoom-out').addEventListener('click',()=>setZoom(zoom-.25));$('zoom-reset').addEventListener('click',()=>setZoom(1));
$('class-filter').addEventListener('change',()=>{selected=undefined;results();});$('visible-threshold').addEventListener('input',()=>{selected=undefined;results();});
function setupStudy(){
 if(!current)return;$('upload-panel').hidden=true;$('analysis-workspace').hidden=false;activate('new');$('study-filename').textContent=current.filename;$('study-meta').textContent=date(current.createdAt)+' · '+current.width+' × '+current.height+' px';notes.value=current.notes;selected=undefined;
 const threshold=$<HTMLInputElement>('visible-threshold');threshold.min=String(Math.round(current.parameters.confidence*100));threshold.value=threshold.min;
 const select=$<HTMLSelectElement>('class-filter');select.replaceChildren();const all=document.createElement('option');all.value='all';all.textContent='Todos los tipos';select.append(all);
 for(const classId of [...new Set(current.detections.map(d=>d.classId))].sort((a,b)=>a-b)){const option=document.createElement('option');option.value=String(classId);option.textContent=CLASS_LABELS[classId];select.append(option);}
 setZoom(1);results();actions();
}
async function storeCurrent(){
 if(!current||!original)return;canRetry=false;try{current=await saveAnalysis(current,original);$('study-meta').textContent=date(current.createdAt)+' · '+current.width+' × '+current.height+' px';}
 catch(error){canRetry=true;throw error;}
 try{await refreshHistory();}catch{notice('Estudio guardado. No se pudo actualizar la lista; puedes volver a abrir el historial.');return;}
 notice('La radiografía y sus resultados quedaron guardados en tu historial.','success');
}
async function acceptFile(file:File){
 if(busy||!canLeave())return;clearNotice();await operation(async()=>{
  if(file.size>5*1024*1024||file.size===0)throw new Error('La imagen debe pesar entre 1 byte y 5 MiB.');
  if(!['image/jpeg','image/png'].includes(file.type))throw new Error('Selecciona una imagen JPG o PNG.');
  const decoded=await decode(file).catch(()=>{throw new Error('No se pudo leer la imagen. Comprueba que sea un archivo JPG o PNG válido de hasta 40 megapíxeles.');});
  if(image&&'close'in image)image.close();image=decoded;original=file;canRetry=false;
  const confidence=Number($<HTMLInputElement>('analysis-threshold').value)/100;
  current={id:crypto.randomUUID(),filename:file.name.slice(0,200),mimeType:file.type,size:file.size,width:decoded.width,height:decoded.height,status:'pending',modelVersion:MODEL_VERSION,parameters:{confidence,iou:0.7},detections:[],notes:'',revision:0,sha256:await digest(file)};
  setupStudy();progress('Preparando el análisis…');
  try{const {analyze}=await import('./inference');current.detections=await analyze(image,current.width,current.height,confidence,progress);setupStudy();progress('Guardando el estudio en tu historial…');await storeCurrent();}
  catch(error){if(!canRetry){$('retry-save').hidden=true;notice(errorMessage(error)+' Puedes seleccionar un nuevo archivo para volver a intentar.','error');throw error;}throw error;}
 });
}
input.addEventListener('change',()=>{const file=input.files?.[0];if(file)void acceptFile(file);});
const drop=$('drop-zone');drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag-over');});drop.addEventListener('dragleave',()=>drop.classList.remove('drag-over'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag-over');const file=e.dataTransfer?.files[0];if(file)void acceptFile(file);});
$('analysis-threshold').addEventListener('input',()=>{$('analysis-threshold-value').textContent=$<HTMLInputElement>('analysis-threshold').value+' %';});
$('retry-save').addEventListener('click',()=>void operation(async()=>{progress('Reintentando el guardado…');await storeCurrent();}));
async function openStudy(id:string){
 progress('Abriendo tu estudio…');const study=await api<Study>('/studies/'+id);const response=await fetch('/api/studies/'+id+'/image',{credentials:'same-origin'});
 if(response.status===401)throw new ApiError(401,'Tu sesión terminó.');
 if(!response.ok){let message='No se pudo recuperar la radiografía.';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}
 const blob=await response.blob(),decoded=await decode(blob);if(image&&'close'in image)image.close();image=decoded;original=blob;current=study;canRetry=false;clearNotice();setupStudy();
}
notes.addEventListener('input',actions);
async function saveNotes(){
 if(!current||!needsNoteSave(current,notes.value))return;
 const text=notes.value;const result=await api<{notes:string;revision:number}>('/studies/'+current.id+'/notes',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes:text,revision:current.revision})});
 current.notes=result.notes;current.revision=result.revision;notes.value=result.notes;actions();
}
$('save-notes').addEventListener('click',()=>void operation(async()=>{await saveNotes();notice('Observaciones guardadas.','success');}));
$('download-pdf').addEventListener('click',()=>void operation(async()=>{
 if(!current||!profile)return;progress('Preparando el informe PDF…');await saveNotes();const canvas=document.createElement('canvas');draw(canvas,true);
 const {createReport}=await import('./pdf');const pdf=await createReport(current,profile,canvas.toDataURL('image/jpeg',.94));pdf.save('Informe_Dentection_'+current.id.slice(0,8)+'.pdf');notice('Informe descargado con las observaciones guardadas.','success');
}));
window.addEventListener('beforeunload',event=>{if(current&&(needsNoteSave(current,notes.value)||canRetry)){event.preventDefault();}});
let registering=false,authSubmitting=false,challengeReady=false;
function authButton(){const button=$<HTMLButtonElement>('auth-submit');button.disabled=authSubmitting||!challengeReady;button.setAttribute('aria-busy',String(authSubmitting));$<HTMLButtonElement>('auth-switch').disabled=authSubmitting;}
function prepareAuthChallenge(){
 challengeReady=false;authButton();
 void prepareChallenge($('auth-challenge'),registering?'register':'login',(ready,message,retry=false)=>{
  challengeReady=ready;$('auth-challenge-state').textContent=message;$('auth-challenge-retry').hidden=!retry;authButton();
 });
}
$('auth-challenge-retry').addEventListener('click',prepareAuthChallenge);
function setAuthMode(value:boolean){
 registering=value;$('register-name').hidden=!value;$('register-confirm').hidden=!value;$('password-hint').hidden=!value;
 $('auth-title').textContent=value?'Crea tu cuenta profesional':'Accede a tu espacio';
 $('auth-description').textContent=value?'Guarda tus radiografías y reúne tu revisión en un historial privado.':'Tus radiografías, observaciones e informes, en una cuenta privada.';
 $('auth-submit').textContent=value?'Crear cuenta':'Iniciar sesión';$('auth-switch').textContent=value?'Iniciar sesión':'Crear una cuenta';$('auth-switch-caption').textContent=value?'¿Ya tienes una cuenta?':'¿Es tu primera visita?';
 $<HTMLInputElement>('auth-name').required=value;$<HTMLInputElement>('auth-confirm').required=value;
 $<HTMLInputElement>('auth-password').minLength=value?15:1;$<HTMLInputElement>('auth-password').autocomplete=value?'new-password':'current-password';$('auth-error').hidden=true;
 $<HTMLInputElement>('auth-confirm').value='';prepareAuthChallenge();
}
function showSessionRecovery(){
 if(!authRecovery)recoveryView=$('history-view').hidden?'new':'history';
 authRecovery=true;expectedEmail=profile?.email;setAuthMode(false);
 $('auth-panel').hidden=false;$('new-view').hidden=true;$('history-view').hidden=true;$('auth-switch').hidden=true;$('auth-switch-caption').hidden=true;
 $('auth-title').textContent='Recupera tu sesión';$('auth-description').textContent='Vuelve a iniciar sesión con la misma cuenta. Conservaremos la radiografía y las observaciones para que puedas reintentar el guardado.';
 const email=$<HTMLInputElement>('auth-email');email.value=expectedEmail||'';email.readOnly=!!expectedEmail;
}
$('auth-switch').addEventListener('click',()=>{if(!authSubmitting)setAuthMode(!registering);});
$('auth-form').addEventListener('submit',event=>{event.preventDefault();if(authSubmitting)return;void(async()=>{
 const button=$<HTMLButtonElement>('auth-submit');authSubmitting=true;authButton();button.textContent=registering?'Creando cuenta…':'Iniciando sesión…';$('auth-error').hidden=true;let attempted=false;
 try{
 const password=$<HTMLInputElement>('auth-password').value;
 if(registering&&password!==$<HTMLInputElement>('auth-confirm').value)throw new Error('Las contraseñas no coinciden. Revisa ambos campos.');
 const turnstileToken=getChallengeToken();if(!turnstileToken)throw new Error('Completa la verificación de seguridad para continuar.');
 attempted=true;
 await api('/auth/'+(registering?'register':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$<HTMLInputElement>('auth-email').value.trim(),password,name:$<HTMLInputElement>('auth-name').value,turnstileToken})});
 $<HTMLInputElement>('auth-password').value='';$<HTMLInputElement>('auth-confirm').value='';
 const signedIn=await api<Profile>('/me');
 if(authRecovery&&expectedEmail&&signedIn.email!==expectedEmail){await api('/auth/logout',{method:'POST'});throw new Error('Inicia sesión con la misma cuenta para recuperar este trabajo.');}
 profile=signedIn;$('account-name').textContent=profile.name;$('account-email').textContent=profile.email;$('account-avatar').textContent=profile.name.slice(0,1).toUpperCase();
 $('auth-panel').hidden=true;removeChallenge();challengeReady=false;
 if(authRecovery){authRecovery=false;activate(recoveryView);notice('Sesión recuperada. Ya puedes reintentar el guardado o descargar el informe.','success');}
 else{activate('new');await refreshHistory();}
 actions();}
 catch(error){$('auth-error').textContent=error instanceof Error?error.message:'No se pudo iniciar sesión.';$('auth-error').hidden=false;if(attempted)resetChallenge();}
 finally{authSubmitting=false;authButton();button.textContent=registering?'Crear cuenta':'Iniciar sesión';}
 })();});
$('logout').addEventListener('click',event=>{event.preventDefault();if(busy||!canLeave())return;void operation(async()=>{await api('/auth/logout',{method:'POST'});current=undefined;location.reload();});});
async function init(){
 try{profile=await api<Profile>('/me');$('account-name').textContent=profile.name;$('account-email').textContent=profile.email;$('account-avatar').textContent=profile.name.slice(0,1).toUpperCase();await refreshHistory();}
 catch(error){if(error instanceof ApiError&&error.status===401){$('auth-panel').hidden=false;$('new-view').hidden=true;$('nav-new').setAttribute('disabled','');$('nav-history').setAttribute('disabled','');$('account-name').textContent='Sesión requerida';prepareAuthChallenge();}else notice(errorMessage(error),'error');}
 actions();
}
void init();
