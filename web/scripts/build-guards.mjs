import {access} from 'node:fs/promises';import {join} from 'node:path';
export async function assertNoPrivateFixtures(publicDirectory){
 let exists=false;try{await access(join(publicDirectory,'proof'));exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
 if(exists)throw new Error('Private proof assets must stay outside public/. Move public/proof to work/ before building.');
}
