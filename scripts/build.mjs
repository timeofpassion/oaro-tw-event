import fs from 'node:fs';
import path from 'node:path';
import { checkAssets, root, folders } from './check-assets.mjs';

console.log('배포 전 자산 검사:', checkAssets());
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
for (const folder of folders) {
  fs.cpSync(path.join(root, folder), path.join(output, folder), { recursive: true });
}
fs.copyFileSync(path.join(root, 'hero.webp'), path.join(output, 'hero.webp'));
console.log('정적 랜딩 배포 파일 준비 완료');
