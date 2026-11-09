import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync('index.html', 'utf8');

const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => m[1]);
const linkMatches = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/g)].map(m => m[1]);

console.log('Script tags:', scriptMatches);
console.log('Link tags:', linkMatches);

let allFound = true;
for (const rel of [...scriptMatches, ...linkMatches]) {
  if (rel.startsWith('http://') || rel.startsWith('https://') || rel.startsWith('data:')) {
    console.log('External / data URI (skipping local fs check):', rel.slice(0, 30));
    continue;
  }
  const cleanPath = rel.split('?')[0].replace(/^\.\//, '');
  const absPath = path.resolve(process.cwd(), cleanPath);
  if (fs.existsSync(absPath)) {
    const stat = fs.statSync(absPath);
    console.log(`PASS: ${cleanPath} (${stat.size} bytes)`);
  } else {
    console.error(`FAIL NOT FOUND: ${cleanPath} (resolved to ${absPath})`);
    allFound = false;
  }
}

// Also verify core script imports in scripts/app.js
const appJs = fs.readFileSync('scripts/app.js', 'utf8');
const importMatches = [...appJs.matchAll(/from\s+["'](\.[^"']+)["']/g)].map(m => m[1]);
for (const imp of importMatches) {
  const cleanPath = path.resolve(process.cwd(), 'scripts', imp);
  if (fs.existsSync(cleanPath)) {
    console.log(`PASS core import: ${imp}`);
  } else {
    console.error(`FAIL NOT FOUND core import: ${imp}`);
    allFound = false;
  }
}

if (!allFound) {
  process.exit(1);
}
console.log('ALL ASSETS AND MODULE IMPORTS PASS VERIFICATION!');
