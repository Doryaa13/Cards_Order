// Loads the floors listed in levels/index.json. The single-file build inlines them as
// window.CHAIN_LEVELS instead, since a bundled page has no level files next to it.
(function (root) {
  function load() {
    if (root.CHAIN_LEVELS) return Promise.resolve(root.CHAIN_LEVELS);
    var get = function (path) {
      return fetch(path).then(function (r) {
        if (!r.ok) throw new Error(path + ': ' + r.status);
        return r.json();
      });
    };
    return get('levels/index.json').then(function (files) {
      return Promise.all(files.map(function (f) { return get('levels/' + f); }));
    });
  }

  root.ChainLevels = { load: load };
})(this);
