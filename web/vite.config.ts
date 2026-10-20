import {defineConfig} from 'vite';
export default defineConfig({build:{target:'es2022',chunkSizeWarningLimit:900},server:{host:'127.0.0.1',proxy:{'/api':'http://127.0.0.1:8787'}}});
