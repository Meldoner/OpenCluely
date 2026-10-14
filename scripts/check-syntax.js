const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
let files = 0;
let blocks = 0;
function check(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }); files++;
    }
  }
}
check(root);
for (const file of ['index.html', 'chat.html', 'llm-response.html', 'settings.html', 'onboarding.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML ID in ' + file);
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
    new vm.Script(match[2], { filename: file }); blocks++;
  }
}
console.log(`Syntax valid: ${files} JS files, ${blocks} inline scripts; no duplicate HTML IDs.`);
