import {defineConfig} from 'vite';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export default defineConfig({
 plugins:[{name:'local-model-proof',configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
   const name=req.url?.split('?')[0];
   const files:Record<string,string>={'/proof/input.f32':'input.f32','/proof/input.png':'input.png','/proof/python.json':'python.json'};
   if(!name||!files[name])return next();
   try{const bytes=await readFile(resolve('../work/parity',files[name]));res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',name.endsWith('.json')?'application/json':name.endsWith('.png')?'image/png':'application/octet-stream');res.end(bytes);}
   catch{res.statusCode=404;res.end('Run the model export first.');}
  });
 }}],build:{target:'es2022',chunkSizeWarningLimit:900},server:{host:'127.0.0.1',proxy:{'/api':'http://127.0.0.1:8787'}}
});
