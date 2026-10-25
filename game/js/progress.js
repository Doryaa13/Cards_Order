// The player's progress, kept in this browser: best stars per floor, the arrangement that earned
// them, and the arrangement last tried. Storage can be missing or blocked (private windows, previews),
// so every access is guarded and the game works without it.
(function (root) {
  var KEY = 'chain-reaction-progress-v1';

  function read() {
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || '{}');
      return data && typeof data === 'object' && data.floors ? data : { floors: {} };
    } catch (e) {
      return { floors: {} };
    }
  }

  function create() {
    var data = read();
    function floor(id) { return data.floors[id] || (data.floors[id] = {}); }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* progress just isn't kept */ }
    }

    return {
      stars: function (id) { return (data.floors[id] && data.floors[id].stars) || 0; },

      // The arrangement to start a floor with: the last one tried, else the best one, else empty
      placements: function (id) {
        var f = data.floors[id] || {};
        return JSON.parse(JSON.stringify(f.draft || f.best || {}));
      },

      saveDraft: function (id, placements) {
        floor(id).draft = placements;
        save();
      },

      // Keeps the best result; a run that ties the best stars replaces the stored arrangement
      saveWin: function (id, stars, placements) {
        var f = floor(id);
        if (stars >= (f.stars || 0)) {
          f.stars = stars;
          f.best = placements;
        }
        save();
      },

      // Floor i is open once the floor above it has at least one star
      unlocked: function (levels, i) { return i === 0 || this.stars(levels[i - 1].id) > 0; },

      // Where to play next: the first open floor without stars, else the last floor
      currentIndex: function (levels) {
        for (var i = 0; i < levels.length; i++) {
          if (!this.unlocked(levels, i)) return i - 1;
          if (!this.stars(levels[i].id)) return i;
        }
        return levels.length - 1;
      }
    };
  }

  root.ChainProgress = { create: create };
})(this);
