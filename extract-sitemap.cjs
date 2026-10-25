const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\chintu\\Downloads\\ExcelCompare\\dist\\sitemap-0.xml', 'utf8');
// Extract all <loc> values
const regex = /<loc>([^<]+)<\/loc>/g;
let match;
const urls = [];
while ((match = regex.exec(content)) !== null) {
    urls.push(match[1]);
}
console.log('Found ' + urls.length + ' URLs');
urls.forEach((u, i) => console.log((i+1) + '. ' + u));
// Now rewrite the file in the proper format
let output = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
urls.forEach(url => {
    output += '  <url>\n    <loc>' + url + '</loc>\n  </url>\n';
});
output += '</urlset>';
fs.writeFileSync('C:\\Users\\chintu\\Downloads\\ExcelCompare\\dist\\sitemap-0.xml', output);
console.log('\\nRewritten sitemap-0.xml');