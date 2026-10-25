// Bundles the game into one self-contained page (Matter.js from a CDN), for sharing as a single file.
// The output has no <html>/<head>/<body> wrapper so it can be published as a claude.ai artifact.
// Usage: node game/tools/bundle.js <output.html>
var fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..');
var read = function (f) { return fs.readFileSync(path.join(root, f), 'utf8'); };
var src = read('index.html');
var title = src.match(/<title>[\s\S]*?<\/title>/)[0];
var body = src.match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/<script src="(js\/[^"]+)"><\/script>/g, function (_, f) { return '<script>\n' + read(f) + '</script>'; })
  .replace('<script src="vendor/matter.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js"></script>');
var out = title + '\n<meta name="claude:viewport-fit-sides" content="cover">\n' +
  '<script>document.documentElement.lang = "he"; document.documentElement.dir = "rtl";</script>\n' +
  '<style>\n' + read('style.css') + '</style>\n' + body;
fs.writeFileSync(process.argv[2], out);
console.log('wrote ' + process.argv[2]);
