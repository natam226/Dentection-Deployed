import {randomBytes,createHash} from 'node:crypto';
import {writeFile,mkdir,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const [emailRaw,outputArg,mode]=process.argv.slice(2),email=emailRaw?.trim().toLowerCase();
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!outputArg){console.error('Uso: node scripts/invite.mjs correo archivo-de-invitacion [--local]');process.exit(1);}
const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
const dir=resolve('../work');await mkdir(dir,{recursive:true});const sql=resolve(dir,'invite-'+randomBytes(8).toString('hex')+'.sql');
await writeFile(sql,"INSERT INTO invitations(token_hash,email) VALUES('"+hash+"','"+email.replaceAll("'","''")+"');\n");
try{
 const args=['node_modules/wrangler/bin/wrangler.js','d1','execute','dentection-db','--file',sql,mode==='--local'?'--local':'--remote'];
 const result=spawnSync(process.execPath,args,{encoding:'utf8'});if(result.status!==0){console.error(result.stderr||result.stdout);process.exitCode=1;}else{
  await writeFile(resolve(outputArg),`Dentection — invitación personal\n\nAbre https://dentection.natalia-moreno-mon.workers.dev\nPulsa «Tengo una invitación».\nCorreo: ${email}\nCódigo: ${token}\n\nEscribe tu nombre y elige una contraseña de al menos 15 caracteres.\nEl código sirve una sola vez y vence en 7 días. No publiques este archivo.\n`,{mode:0o600});
  console.log('Invitación creada en el archivo indicado. El código no se muestra en la consola.');
 }
}finally{await unlink(sql);}
