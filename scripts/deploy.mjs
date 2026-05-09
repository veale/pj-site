// Builds, zips, uploads, and activates the theme on the Ghost site.
// Env: GHOST_ADMIN_API_URL, GHOST_ADMIN_API_KEY (id:secret)
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const url = process.env.GHOST_ADMIN_API_URL;
const key = process.env.GHOST_ADMIN_API_KEY;
if (!url || !key || !key.includes(':')) {
    console.error('Missing or malformed GHOST_ADMIN_API_URL / GHOST_ADMIN_API_KEY.');
    process.exit(1);
}

const themeName = JSON.parse(fs.readFileSync('package.json', 'utf8')).name;
const zipPath = `${themeName}.zip`;
const base = url.replace(/\/$/, '');

console.log(`Building ${themeName}...`);
execSync('npm run zip', { stdio: 'inherit' });

const [id, secret] = key.split(':');
const token = () => jwt.sign({}, Buffer.from(secret, 'hex'), {
    keyid: id, algorithm: 'HS256', expiresIn: '5m', audience: '/admin/',
});

const fd = new FormData();
fd.append('file', new Blob([fs.readFileSync(zipPath)], { type: 'application/zip' }), zipPath);

console.log(`Uploading to ${base}...`);
const upload = await fetch(`${base}/ghost/api/admin/themes/upload/`, {
    method: 'POST',
    headers: { Authorization: `Ghost ${token()}` },
    body: fd,
});
if (!upload.ok) {
    console.error(`Upload failed: ${upload.status}\n${await upload.text()}`);
    process.exit(1);
}
console.log('Uploaded.');

console.log(`Activating ${themeName}...`);
const activate = await fetch(`${base}/ghost/api/admin/themes/${themeName}/activate/`, {
    method: 'PUT',
    headers: { Authorization: `Ghost ${token()}` },
});
if (!activate.ok) {
    console.error(`Activation failed: ${activate.status}\n${await activate.text()}`);
    process.exit(1);
}
console.log('Activated. Live on site.');
