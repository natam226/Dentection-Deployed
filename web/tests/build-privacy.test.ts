import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {assertNoPrivateFixtures} from '../scripts/build-guards.mjs';
it('rejects a production public directory containing a proof image',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dentection-proof-'));
 try{await mkdir(join(dir,'proof'));await writeFile(join(dir,'proof/input.png'),'private fixture');
 await expect(assertNoPrivateFixtures(dir)).rejects.toThrow(/proof/);
 await rm(join(dir,'proof'),{recursive:true});await expect(assertNoPrivateFixtures(dir)).resolves.toBeUndefined();
 }finally{await rm(dir,{recursive:true,force:true});}
});
