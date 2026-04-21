const fs = require('fs');
const html = fs.readFileSync('c:/Users/rena3/doc/AI-PT/大毅建設官網/image-specs/index.html', 'utf-8');
const sections = html.split('class="page-section"');
sections.slice(1).forEach((s) => {
  const idMatch = s.match(/id="([^"]+)"/);
  const id = idMatch ? idMatch[1] : '?';
  const rows = [...s.matchAll(/class="filename">([^<]+)/g)].map(m => m[1]);
  const classes = [...s.matchAll(/class="container-class">\.([^<]+)/g)].map(m => m[1]);
  console.log('\n=== ' + id + ' ===');
  rows.forEach((r, j) => console.log((j + 1) + '. ' + r + ' | .' + (classes[j * 2] || '?')));
});
