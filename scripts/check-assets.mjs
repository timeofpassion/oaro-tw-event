import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const folders = ['cn', 'en', 'tw', 'assets'];

export function checkAssets(base = root) {
  base = path.resolve(base);
  const errors = [];
  let pages = 0;
  let resources = 0;
  const verify = (ref, file) => {
    const route = '/' + path.relative(base, path.dirname(file)).split(path.sep).join('/') + '/';
    const url = new URL(ref, 'https://landing.invalid' + route.replace(/^\/\//, '/'));
    if (url.origin !== 'https://landing.invalid') return;
    resources++;
    const target = path.resolve(base, '.' + decodeURIComponent(url.pathname));
    if (!target.startsWith(base + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile())
      errors.push(`${path.relative(base, file)}: 파일 없음 ${ref}`);
  };

  for (const folder of folders) {
    const directory = path.join(base, folder);
    if (!fs.existsSync(directory)) continue;
    for (const item of fs.readdirSync(directory, { recursive: true })) {
      const file = path.join(directory, item);
      if (!fs.statSync(file).isFile()) continue;
      if (file.endsWith('.js')) {
        try { new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }); }
        catch (error) { errors.push(error.message); }
      }
      if (!file.endsWith('.html')) continue;
      pages++;
      const html = fs.readFileSync(file, 'utf8');
      for (const tag of html.matchAll(/<(img|script|link)\b[^>]*>/gi)) {
        if (tag[1].toLowerCase() === 'link' && !/\brel=["']stylesheet["']/i.test(tag[0])) continue;
        const ref = /\b(?:src|href)=["']([^"']+)["']/i.exec(tag[0])?.[1];
        if (ref && !ref.startsWith('data:')) verify(ref.replaceAll('&amp;', '&'), file);
      }
      for (const block of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (/\bsrc=|application\/ld\+json/i.test(block[1])) continue;
        try { new vm.Script(block[2], { filename: path.relative(base, file) }); }
        catch (error) { errors.push(error.message); }
      }
    }
  }
  const config = JSON.parse(fs.readFileSync(path.join(base, 'vercel.json'), 'utf8'));
  for (const redirect of config.redirects ?? []) {
    if (redirect.destination.startsWith('/')) {
      const destination = path.join(base, redirect.destination, 'index.html');
      if (!fs.existsSync(destination)) errors.push(`이동 대상 없음 ${redirect.destination}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { pages, localResources: resources };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('이미지·스크립트·스타일·이동 대상 검사:', checkAssets());
}
