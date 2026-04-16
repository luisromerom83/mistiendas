const fs = require('fs');
let c = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8');

c = c.replace(/const \[openCategory, setOpenCategory\] = useState\('Adulto'\);/, "const [openCategory, setOpenCategory] = useState(tenant.categories[0]?.name || 'Adulto');");

// In handleEdit
c = c.replace(/category: p\.category \|\| 'Adulto'/g, "category: p.category || tenant.categories[0]?.name || 'Adulto'");

// In resetForm & newProduct state
c = c.replace(/category: 'Adulto'/g, "category: tenant.categories[0]?.name || 'Adulto'");

// In addToOrderList
c = c.replace(/category: p\.category \|\| 'Adulto'/g, "category: p.category || tenant.categories[0]?.name || 'Adulto'");

// In updateOrderItem baseProduct search
c = c.replace(/\(p\.category \|\| 'Adulto'\)/g, "(p.category || tenant.categories[0]?.name)");
c = c.replace(/\(item\.category \|\| 'Adulto'\)/g, "(item.category || tenant.categories[0]?.name)");

fs.writeFileSync('src/pages/AdminDashboard.jsx', c);
console.log('Categories hardcodings partially patched');
