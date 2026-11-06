const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('tw/event-august/index.html','utf8');
const scripts=[...html.matchAll(/<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach(s=>new vm.Script(s));
assert(!/10月|10\/31/.test(html));
for(const mobile of [false,true]){
 const a={dataset:{ch:'line'},href:'',addEventListener(){}};
 const ctx={navigator:{userAgent:mobile?'iPhone':'Desktop'},location:{search:'?utm_content=B_doctor'},URLSearchParams,document:{querySelectorAll:()=>[a],getElementById:()=>null,querySelector:()=>null},window:{},addEventListener(){},setInterval(){return 1},clearInterval(){},Date:class extends Date { static now(){ return Date.UTC(2026,11,1); } }};
 vm.runInNewContext(scripts.at(-1),ctx);
 assert(a.href.includes(mobile?'@673mireh':'lin.ee/rhdeHM0'));
 if(mobile){const msg=decodeURIComponent(a.href.split('/?')[1]);assert(msg.includes('TW-202611-B'));assert(msg.includes('預計訪韓日期'));}
}
console.log('PASS: script syntax, no expired offers, desktop/mobile LINE target and inquiry code, absent TOP control');
