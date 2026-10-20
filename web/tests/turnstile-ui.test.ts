// @vitest-environment happy-dom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
let callbacks:Record<string,any>,provider:any;
beforeEach(()=>{vi.resetModules();callbacks={};provider={ready:(fn:any)=>fn(),render:vi.fn((_node:any,options:any)=>{callbacks=options;return 'widget';}),remove:vi.fn()};window.turnstile=provider;vi.stubGlobal('fetch',vi.fn(async()=>Response.json({siteKey:'public-site-key'})));});
afterEach(()=>{delete window.turnstile;vi.unstubAllGlobals();});
it('clears the consumed token on retry and ignores callbacks from the previous form',async()=>{
 const module=await import('../src/turnstile'),change=vi.fn(),node=document.createElement('div');
 await module.prepareChallenge(node,'register',change);const previous=callbacks;previous.callback('one-time-token');expect(module.getChallengeToken()).toBe('one-time-token');
 await module.prepareChallenge(node,'login',change);previous.callback('stale-register-token');expect(module.getChallengeToken()).toBe('');expect(callbacks.action).toBe('login');
 callbacks.callback('login-token');module.resetChallenge();expect(module.getChallengeToken()).toBe('');
});
it('blocks an expired or failed widget and offers a retry',async()=>{
 const module=await import('../src/turnstile'),change=vi.fn();await module.prepareChallenge(document.createElement('div'),'register',change);
 callbacks.callback('token');callbacks['expired-callback']();expect(module.getChallengeToken()).toBe('');expect(change.mock.calls.at(-1)?.[0]).toBe(false);
 callbacks['error-callback']();expect(change.mock.calls.at(-1)?.[2]).toBe(true);
});
it('fails closed when public challenge configuration cannot load',async()=>{
 vi.mocked(fetch).mockResolvedValue(Response.json({error:'unavailable'},{status:503}));const module=await import('../src/turnstile'),change=vi.fn();await module.prepareChallenge(document.createElement('div'),'register',change);
 expect(provider.render).not.toHaveBeenCalled();expect(module.getChallengeToken()).toBe('');expect(change.mock.calls.at(-1)?.[2]).toBe(true);
});

it('loads the provider without async before calling its ready API',async()=>{
 delete window.turnstile;
 const hook=vi.spyOn(document.head,'append').mockImplementation((...nodes:any[])=>{
  const script=nodes[0] as HTMLScriptElement;
  window.turnstile={...provider,ready:(fn:any)=>{if(script.async)throw new Error('Remove async/defer before turnstile.ready');fn();}};
  script.dispatchEvent(new Event('load'));
 });
 try{const module=await import('../src/turnstile');await module.prepareChallenge(document.createElement('div'),'register',vi.fn());expect(provider.render).toHaveBeenCalledOnce();}
 finally{hook.mockRestore();document.querySelectorAll('script[src*="challenges.cloudflare.com"]').forEach(node=>node.remove());}
});

it('uses the compact challenge when a narrow phone cannot fit 300px',async()=>{
 const module=await import('../src/turnstile'),node=document.createElement('div');Object.defineProperty(node,'clientWidth',{value:248});
 await module.prepareChallenge(node,'register',vi.fn());expect(callbacks.size).toBe('compact');
});
