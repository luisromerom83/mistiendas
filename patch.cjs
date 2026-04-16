const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

// We want to replace fetch(`/api/something`) with fetch(`/api/something?tenant_id=${tenant.slug}`)
// Or if it already has query parameters fetch(`/api/something?id=${id}`) with fetch(`/api/something?id=${id}&tenant_id=${tenant.slug}`)

content = content.replace(/fetch\(\`\/api\/(products|orders|sales|reservations|customers)(.*?)\`/g, (match, ep, rest) => {
  if (rest.includes('tenant_id=')) return match;
  if (rest.includes('?')) {
    return `fetch(\`/api/${ep}${rest}&tenant_id=\${tenant.slug}\``;
  } else {
    return `fetch(\`/api/${ep}${rest}?tenant_id=\${tenant.slug}\``;
  }
});

fs.writeFileSync('src/pages/AdminDashboard.jsx', content);
console.log('AdminDashboard APIs updated with tenant.slug!');
