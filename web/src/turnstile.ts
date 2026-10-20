interface TurnstileAPI {
 ready(callback:()=>void):void;
 render(container:HTMLElement,options:Record<string,unknown>):string;
 remove(id:string):void;
}
declare global{interface Window{turnstile?:TurnstileAPI}}
type Changed=(ready:boolean,message:string,retry?:boolean)=>void;
let apiPromise:Promise<TurnstileAPI>|undefined,siteKey:string|undefined,widget:string|undefined;
let token='',completedAt=0,generation=0,target:HTMLElement|undefined,action='login',changed:Changed|undefined;
function loadAPI():Promise<TurnstileAPI>{
 if(window.turnstile)return new Promise(resolve=>window.turnstile!.ready(()=>resolve(window.turnstile!)));
 if(!apiPromise)apiPromise=new Promise<TurnstileAPI>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=false;
  const fail=()=>{script.remove();reject(new Error('No se pudo cargar la verificación. Comprueba la conexión y reintenta.'));};
  const timeout=setTimeout(fail,15000);
  script.addEventListener('error',()=>{clearTimeout(timeout);fail();},{once:true});
  script.addEventListener('load',()=>{if(!window.turnstile){clearTimeout(timeout);fail();return;}window.turnstile.ready(()=>{clearTimeout(timeout);resolve(window.turnstile!);});},{once:true});
  document.head.append(script);
 }).catch(error=>{apiPromise=undefined;throw error;});
 return apiPromise;
}
export function removeChallenge(){generation++;token='';completedAt=0;if(widget!==undefined&&window.turnstile)window.turnstile.remove(widget);widget=undefined;}
export async function prepareChallenge(container:HTMLElement,nextAction:string,onChange:Changed){
 removeChallenge();const current=generation;target=container;action=nextAction;changed=onChange;container.replaceChildren();onChange(false,'Preparando verificación de seguridad…');
 try{
  if(!siteKey){const response=await fetch('/api/auth/config',{credentials:'same-origin'});if(!response.ok)throw new Error('La verificación no está disponible. Reintenta en unos segundos.');const config=await response.json();if(typeof config.siteKey!=='string'||!config.siteKey)throw new Error('La verificación no está disponible.');siteKey=config.siteKey;}
  const api=await loadAPI();if(current!==generation)return;
  widget=api.render(container,{sitekey:siteKey,action:nextAction,theme:'light',size:container.clientWidth<300?'compact':'flexible',language:'es',
   callback:(value:string)=>{if(current!==generation)return;token=value;completedAt=Date.now();onChange(true,'Verificación completada.');},
   'expired-callback':()=>{if(current!==generation)return;token='';onChange(false,'La verificación venció. Se está renovando…');},
   'error-callback':()=>{if(current!==generation)return;token='';onChange(false,'No se pudo verificar. Revisa la conexión y reintenta.',true);},
   'timeout-callback':()=>{if(current!==generation)return;token='';onChange(false,'La verificación tardó demasiado. Vuelve a intentarlo.',true);},
  });
 }catch(error){if(current===generation)onChange(false,error instanceof Error?error.message:'No se pudo cargar la verificación.',true);}
}
export function getChallengeToken(){if(token&&Date.now()-completedAt>=295000){resetChallenge();return '';}return token;}
export function resetChallenge(){if(target&&changed)void prepareChallenge(target,action,changed);}
