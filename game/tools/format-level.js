// Rewrites level JSON files in a compact, hand-editable layout: one line per part, tray item and solution.
// Usage: node game/tools/format-level.js game/levels/floor1.json [...]
var fs = require('fs');

function format(level) {
  var lines = ['{'];
  var keys = Object.keys(level);
  keys.forEach(function (k, i) {
    var v = level[k], comma = i < keys.length - 1 ? ',' : '';
    if (Array.isArray(v)) {
      lines.push('  ' + JSON.stringify(k) + ': [');
      v.forEach(function (item, j) {
        lines.push('    ' + JSON.stringify(item).replace(/,"/g, ', "').replace(/":/g, '": ') + (j < v.length - 1 ? ',' : ''));
      });
      lines.push('  ]' + comma);
    } else {
      lines.push('  ' + JSON.stringify(k) + ': ' + JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ') + comma);
    }
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

process.argv.slice(2).forEach(function (file) {
  fs.writeFileSync(file, format(JSON.parse(fs.readFileSync(file, 'utf8'))));
});
