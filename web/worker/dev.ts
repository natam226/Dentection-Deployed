// Local preview entry only. Production config always points to index.ts.
import {createHandler} from './index';
import type {Env} from './types';
const local=createHandler(async()=>({id:'local-reviewer',email:'revision-local@example.test'}));
export default {fetch(request:Request,env:Env){
 if(!['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname))return new Response('Local preview only',{status:403});
 return local(request,env);
}};
