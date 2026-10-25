// The player's progress, kept in this browser: best stars per floor, the arrangement and taps that
// earned them (enough to replay that run exactly), and the arrangement last tried. Storage can be missing or blocked (private windows, previews),
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

      // Keeps the best result; a run that ties the best stars replaces the stored arrangement.
      // taps: [{ part, step }] – which tappable part was tapped at which physics step.
      saveWin: function (id, stars, placements, taps) {
        var f = floor(id);
        if (stars >= (f.stars || 0)) {
          f.stars = stars;
          f.best = placements;
          f.taps = taps || [];
        }
        save();
      },

      // The winning run to replay: arrangement and taps, or null if the floor was never won
      bestRun: function (id) {
        var f = data.floors[id];
        return f && f.best ? { placements: JSON.parse(JSON.stringify(f.best)), taps: f.taps || [] } : null;
      },

      // Every floor of the tower has at least one star
      complete: function (tower) {
        var self = this;
        return tower.floors.every(function (f) { return self.stars(f.id) > 0; });
      },

      // Tower i opens once the tower before it is complete; open towers (the lab) are always open
      towerUnlocked: function (towers, i) {
        if (i === 0 || towers[i].open) return true;
        for (var j = i - 1; j >= 0; j--) if (!towers[j].open) return this.complete(towers[j]);
        return true;
      },

      // Floor i of a tower is open once the floor above it has at least one star.
      // An open tower (the lab) has every floor open from the start.
      unlocked: function (tower, i) { return tower.open || i === 0 || this.stars(tower.floors[i - 1].id) > 0; },

      // Where to play next in a tower: the first open floor without stars, else the last floor
      currentIndex: function (tower) {
        var floors = tower.floors;
        for (var i = 0; i < floors.length; i++) {
          if (!this.unlocked(tower, i)) return i - 1;
          if (!this.stars(floors[i].id)) return i;
        }
        return floors.length - 1;
      }
    };
  }

  root.ChainProgress = { create: create };
})(this);
