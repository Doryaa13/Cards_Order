// Loads the towers listed in levels/index.json, each with its floors loaded from their files.
// The single-file build inlines them as window.CHAIN_TOWERS instead, since a bundled page has no
// level files next to it.
(function (root) {
  function load() {
    if (root.CHAIN_TOWERS) return Promise.resolve(root.CHAIN_TOWERS);
    var get = function (path) {
      return fetch(path).then(function (r) {
        if (!r.ok) throw new Error(path + ': ' + r.status);
        return r.json();
      });
    };
    return get('levels/index.json').then(function (index) {
      return Promise.all(index.towers.map(function (tower) {
        return Promise.all(tower.floors.map(function (f) { return get('levels/' + f); })).then(function (floors) {
          return Object.assign({}, tower, { floors: floors });
        });
      }));
    });
  }

  root.ChainLevels = { load: load };
})(this);
