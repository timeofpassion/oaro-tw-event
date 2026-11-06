const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('tw/event-august/index.html','utf8');
const scripts=[...html.matchAll(/<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach(s=>new vm.Script(s));
assert(!/10月|10\/31/.test(html));
// 채널 링크·광고 코드·클릭 검증은 실제 브라우저 검사로 이전했다.
require('./check-messengers.cjs');
