// 실행: $env:NODE_PATH='V:/claude-workspace/hp/sm-plastic-surgery-jp/node_modules'; node check-messengers.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const root = __dirname;
const shots = path.join(root, 'artifacts', 'line-friend');
const pages = {cn:'cn/event', en:'en/event', tw:'tw/event-august'};
const channels = {cn:['wechat','wa','line'],en:['wa','wechat','line'],tw:['line']};
const blocked = /googletagmanager|google-analytics|analytics\.google|connect\.facebook\.net|facebook\.com\/tr|d\.line-scdn\.net|tr\.line\.me/;
const server = http.createServer((req,res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403).end(); return;}
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
  if (!fs.existsSync(file)) {res.writeHead(404).end(); return;}
  res.setHeader('Content-Type', {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'}[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function instrument(context) {
  await context.route('**/*', r => blocked.test(r.request().url()) ? r.fulfill({status:200,body:'',contentType:'application/javascript'}) : r.continue());
  await context.addInitScript(() => {
    window.calls = [];
    for (const name of ['gtag','fbq','_lt']) {
      const stub = (...args) => window.calls.push([name,...args]);
      Object.defineProperty(window,name,{get:()=>stub,set:()=>{},configurable:true});
    }
    window.copied = '';
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text;}}});
  });
}
(async()=>{
  fs.mkdirSync(shots,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({channel:'chrome'});
  let clickCount=0;
  const resourceErrors = new Set();
  try {
    for (const [lang,url] of Object.entries(pages)) for (const width of [360,390,1440]) {
      const mobile=width<=768;
      const ctx=await browser.newContext({viewport:{width,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
      await instrument(ctx);
      const p=await ctx.newPage(), errors=[];
      p.on('pageerror',e=>errors.push(e.message));
      p.on('console',m=>{if(m.type()==='error') errors.push(m.text()+' '+m.location().url);});
      await p.goto(`${base}/${url}/?utm_source=meta&utm_campaign=cn_test_my&utm_content=B_x&utm_term=feed`,{waitUntil:'networkidle'});
      await p.addStyleTag({content:'html{scroll-behavior:auto !important}'});
      const original=execFileSync('git',['show',`HEAD:${url}/index.html`],{cwd:root,encoding:'utf8'});
      assert(await p.evaluate(original=>{
        const old=new DOMParser().parseFromString(original,'text/html');
        const current=document.documentElement.cloneNode(true);
        // 기존 대만 환산 스크립트가 추가한 표시만 제외하고 원문을 비교한다.
        current.querySelectorAll('.ntd').forEach(e=>e.remove());
        const selector='title,meta,link[rel=canonical],script[type="application/ld+json"],h1,h2:not(#line-fallback-title),h3,.items,.price,.tbl-scroll,.special,.notes,.steps li,.doc,.dev,.gal,details,.info,footer,.hero>img,.hero-in>p,.hero-meta,.hstats';
        return JSON.stringify([...old.querySelectorAll(selector)].map(e=>e.outerHTML))===JSON.stringify([...current.querySelectorAll(selector)].map(e=>e.outerHTML));
      },original),`${lang}: protected content changed`);
      const code=lang==='tw'?'TW-202611-B':'B-MY';
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${lang}/${width}: overflow`);
      for (const selector of ['.hero .btns','.steps-cta','.messenger-footer',mobile?'.bar':'.fab']) {
        assert.deepEqual(await p.locator(selector+' [data-ch]').evaluateAll(as=>as.map(a=>a.dataset.ch)),lang==='tw' && selector==='.hero .btns' ? ['line','line'] : channels[lang]);
        for (const a of await p.locator(selector+' [data-ch]').all()) assert(await a.isVisible());
      }
      for (const a of await p.locator('[data-pos="price"]').all()) assert(await a.isVisible());
      const layout=await p.evaluate(()=>{
        const main=document.querySelector('[data-pos="hero"]').getBoundingClientRect();
        const sub=document.querySelector('.hero-sub').getBoundingClientRect();
        const ghost=document.querySelector('.btn-ghost').getBoundingClientRect();
        const widths=[...document.querySelectorAll('.bar a')].map(a=>a.getBoundingClientRect().width);
        return {mainBottom:main.bottom,subTop:sub.top,subBottom:sub.bottom,ghostTop:ghost.top,widths};
      });
      assert((lang==='tw' && !mobile ? layout.mainBottom===layout.subBottom : layout.mainBottom<=layout.subTop) && layout.subBottom<=layout.ghostTop);
      const ghostBox=await p.locator('.btn-ghost').boundingBox(); assert(ghostBox.height>=44);
      if(mobile) assert(lang==='tw' ? layout.widths.length===1 : layout.widths[0]>layout.widths[1]);
      for(const a of await p.locator('[data-ch]').all()) {
        const href=await a.getAttribute('href'), ch=await a.getAttribute('data-ch');
        if(await a.getAttribute('data-method')==='friend') { assert.match(href,/^https:\/\/lin\.ee\/[A-Za-z0-9]+$/); assert.equal(href,await p.evaluate(()=>LINE_FRIEND_URL)); continue; }
        assert(decodeURIComponent(href).includes(code),`${lang}: missing code ${href}`);
        if(ch==='wa') assert(href.startsWith('https://wa.me/821030981064?text='));
        if(ch==='line') assert(href.startsWith('https://line.me/R/oaMessage/@673mireh/?'));
      }
      // 실제 클릭은 실행하되 외부 앱으로 이동하거나 상담을 전송하지 않는다.
      await p.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('a')) e.preventDefault();}));
      const count=await p.locator('.messenger, .concern-btn').count();
      for(let i=0;i<count;i++) {
        const a=p.locator('.messenger, .concern-btn').nth(i);
        if(!await a.isVisible()) continue;
        await a.scrollIntoViewIfNeeded();
        const b=await a.boundingBox(); assert(b.width>=44 && b.height>=44,`${lang}/${width}: small button`);
        const ch=await a.getAttribute('data-ch'),pos=await a.getAttribute('data-pos');
        await p.evaluate(()=>window.calls=[]);
        await a.click();
        const calls=await p.evaluate(()=>window.calls);
        const ga=calls.filter(x=>x[0]==='gtag' && x[1]==='event');
        const fb=calls.filter(x=>x[0]==='fbq' && x[2]==='Contact');
        assert.equal(ga.length,1,`${lang}/${pos}/${ch}: GA count`);
        assert.equal(fb.length,1,`${lang}/${pos}/${ch}: Contact count`);
        assert.equal(ga[0][2],ch+'_click');
        assert.deepEqual(ga[0][3],{channel:ch,pos,page:lang,region:lang==='tw'?'TW':'MY',utm_source:'meta',utm_campaign:'cn_test_my',utm_content:'B_x',concern:await a.getAttribute('data-concern')||'',...(lang==='tw'?{method:await a.getAttribute('data-concern')?'concern':await a.getAttribute('data-method')||'message',in_app:false,placement:'feed'}:{})});
        assert.deepEqual(fb[0][3],{channel:ch,content_name:ch+'_'+pos+(lang==='tw'?'_'+(await a.getAttribute('data-concern')?'concern':await a.getAttribute('data-method')||'message'):'')+(await a.getAttribute('data-concern')?'_'+await a.getAttribute('data-concern'):'')});
        assert.equal(calls.filter(x=>x[0]==='_lt'&&x[2]==='cv').length,lang==='tw'&&ch==='line'?1:0);
        clickCount++;
      }
      if(!mobile && lang!=='tw') {
        await p.mouse.move(0,0);
        await p.waitForTimeout(250);
        await p.locator('.fab [data-ch="wechat"]').hover();
        await p.waitForTimeout(200);
        assert(await p.locator('.wx-pop').isVisible());
        assert.equal(await p.locator('.wx-pop').getAttribute('aria-hidden'),'false');
      }
      await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
      await p.waitForTimeout(200);
      const map=p.locator('a[href^="https://maps.google.com"]');
      await map.scrollIntoViewIfNeeded();
      if(mobile) {
        const m=await map.boundingBox(),bar=await p.locator('.bar').boundingBox();
        assert(m.y+m.height<=bar.y,`${lang}/${width}: map covered`);
        assert(await p.evaluate(()=>parseFloat(getComputedStyle(document.body).paddingBottom)>=document.querySelector('.bar').getBoundingClientRect().height));
      }
      if(width!==390 || lang==='tw') {
        await p.screenshot({path:path.join(shots,`${lang}-${width}-map.png`)});
        await p.evaluate(()=>{window.scrollTo(0,0); document.querySelector('.wx-pop')?.classList.remove('on');});
        await p.waitForFunction(()=>scrollY===0);
        await p.screenshot({path:path.join(shots,`${lang}-${width}-hero.png`)});
        await p.screenshot({path:path.join(shots,`${lang}-${width}.png`),fullPage:true});
      }
      for (const error of errors) {
        if (error.includes('https://oarocnn.com/_next/image?') && error.includes('status of 400')) resourceErrors.add(error);
        else assert.fail(`${lang}/${width}: ${error}`);
      }
      console.log(`PASS ${lang} ${width}: channels, links, codes, click tracking, touch, overflow, map, JS errors 0`);
      await ctx.close();
    }
    // 지역 분기와 쿼리 전달을 실제 모바일 위챗 이동으로 확인한다.
    // 대만판은 위챗을 뺐다(2026-11-13 대표 지시) — 위챗 이동 검사는 중국어·영어판만.
    for(const lang of Object.keys(pages).filter(l=>l!=='tw')) {
      const ctx=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
      await instrument(ctx);
      const p=await ctx.newPage();
      for(const campaign of ['cn_test_my','cn_test_sg','cn_test','']) {
        await p.goto(`${base}/${pages[lang]}/?utm_campaign=${campaign}&utm_content=B_x&utm_term=feed`,{waitUntil:'domcontentloaded'});
        const expected=lang==='tw'?'TW-202611-B':campaign==='cn_test_my'?'B-MY':campaign==='cn_test_sg'?'B-SG':campaign==='cn_test'?'B-CN':'B';
        await p.locator('.hero [data-ch="wechat"]').click();
        await p.waitForURL(`**/${lang}/wechat/**`);
        assert.equal(new URL(p.url()).searchParams.get('code'),expected);
        assert((await p.locator('#wx-msg').textContent()).includes(expected));
        const qr=await p.evaluate(()=>calls.filter(x=>x[0]==='gtag'&&x[2]==='wechat_qr_view'));
        assert.equal(qr.length,1); assert.equal(qr[0][3].code,expected);
        await p.locator('#wx-copy').click();
        assert.equal(await p.evaluate(()=>window.copied),await p.locator('#wx-msg').textContent());
        assert(await p.locator('#wx-save').isVisible());
        assert.equal(await p.locator('.qr').getAttribute('src'),'/cn/wechat/wechat-consult-20261106.png');
        assert(await p.locator('.qr').evaluate(img=>img.complete&&img.naturalWidth>0));
        const downloadPromise=p.waitForEvent('download'); await p.locator('#wx-save').click();
        assert.equal(await (await downloadPromise).failure(),null);
        assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        // 앱 실행 URL과 별도 프레임을 검증한다. OS 앱 실행은 실기기 확인 대상.
        await p.evaluate(()=>{
          window.openAttempt=''; const append=document.body.appendChild.bind(document.body);
          document.body.appendChild=function(n){if(n.tagName==='IFRAME'){window.openAttempt=n.src;return n;}return append(n);};
        });
        const before=p.url(); await p.locator('#wx-open').click();
        assert.equal(await p.evaluate(()=>window.openAttempt),'weixin://'); assert.equal(p.url(),before);
      }
      await ctx.close(); console.log(`PASS ${lang}: MY/SG/CN/default, mobile QR navigation, view, copy, download, app-attempt`);
    }
    for (const width of [360,390,1440]) {
      const ctx=await browser.newContext({viewport:{width,height:900},userAgent:'Mozilla/5.0 Instagram'});
      await instrument(ctx);
      const p=await ctx.newPage();
      await p.goto(`${base}/tw/event-august/?utm_term=story`,{waitUntil:'networkidle'});
      assert.equal(await p.locator('[data-ch="line"][target="_blank"]').count(),0);
      assert((await p.evaluate(()=>calls)).some(c=>c[0]==='gtag' && c[1]==='config' && c[3].placement==='story'));
      await p.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();}));
      const trigger=p.locator('.hero [data-method="friend"]');
      assert.equal(await trigger.getAttribute('href'),await p.evaluate(()=>LINE_FRIEND_URL));
      await trigger.click();
      await p.waitForTimeout(1650);
      assert(await p.locator('#line-fallback').isVisible());
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const event=await p.evaluate(()=>calls.filter(c=>c[2]==='line_fallback_shown'));
      assert.equal(event.length,1); assert.equal(event[0][3].placement,'story');
      const click=await p.evaluate(()=>calls.find(c=>c[2]==='line_click'));
      assert.equal(click[3].in_app,true); assert.equal(click[3].method,'friend');
      await p.locator('#line-copy').click(); assert.equal(await p.evaluate(()=>copied),'@673mireh');
      await p.screenshot({path:path.join(shots,`tw-${width}-fallback.png`)});
      await p.keyboard.press('Escape'); assert(!await p.locator('#line-fallback').isVisible());
      assert(await trigger.evaluate(a=>a===document.activeElement));
      await trigger.click(); await p.waitForTimeout(1650);
      await p.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('denied')}; document.execCommand=()=>false;});
      await p.locator('#line-copy').click();
      assert((await p.locator('#line-copy-status').textContent()).includes('@673mireh'));
      await p.evaluate(()=>{document.execCommand=()=>true;});
      await p.locator('#line-copy').click();
      assert.equal(await p.locator('#line-copy-status').textContent(),'已複製 LINE ID');
      await p.locator('.line-close').click(); assert(!await p.locator('#line-fallback').isVisible());
      await trigger.click();
      await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}); document.dispatchEvent(new Event('visibilitychange'));});
      await p.waitForTimeout(1650);
      await p.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true}); document.dispatchEvent(new Event('visibilitychange'));});
      assert(!await p.locator('#line-fallback').isVisible());
      await ctx.close(); console.log(`PASS tw ${width}: in-app target, fallback, tracking, copy, Escape, close, focus`);
    }
    for(const ua of ['FBAN','FBAV','Line/14.0']) {
      const ctx=await browser.newContext({userAgent:'Mozilla/5.0 '+ua}); await instrument(ctx);
      const p=await ctx.newPage();
      for(const [lang,url] of Object.entries(pages)) {
        await p.goto(`${base}/${url}/`,{waitUntil:'domcontentloaded'});
        assert.equal(await p.locator('[data-ch="line"]').first().getAttribute('target'),lang==='tw'?null:'_blank');
      }
      await ctx.close();
    }
    if(resourceErrors.size) {console.error(`KNOWN EXTERNAL FAIL: ${resourceErrors.size} existing image URLs return HTTP 400; total console errors are not zero.`); process.exitCode=1;}
    console.log(`PASS messenger checks: 9 page viewports + 3 fallback viewports, ${clickCount} individual clicks; screenshots: ${shots}`);
  } finally {await browser.close(); server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

