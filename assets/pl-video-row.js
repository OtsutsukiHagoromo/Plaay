/* Plaay 2026 — reel row player (sections/pl-video-row.liquid).
   Tiles: <button class="pl-video" data-pl-reel data-video="…mp4">. A <video playsinline> is
   created lazily inside the tile on first play. Mobile: tap plays with sound, tap again pauses.
   Desktop (hover-capable): hover plays muted, click turns sound on, leaving the tile pauses a
   muted preview. Only one tile plays at a time; tiles pause when scrolled out of view. */
(function () {
  if (window.plVideoRow) return;
  window.plVideoRow = true;

  var SEL = '[data-pl-reel][data-video]';
  var current = null;
  var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)');
  var noop = function () {};
  var observer = null;

  function getObserver() {
    if (observer || !('IntersectionObserver' in window)) return observer;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting && entry.target.classList.contains('is-playing')) stop(entry.target);
      });
    }, { threshold: 0.35 });
    return observer;
  }

  function ensureVideo(tile) {
    var v = tile.querySelector('video');
    if (v) return v;
    var src = tile.getAttribute('data-video');
    if (!src) return null;
    v = document.createElement('video');
    v.setAttribute('playsinline', '');
    v.playsInline = true;
    v.preload = 'metadata';
    v.loop = true;
    v.muted = true;
    v.src = src;
    v.addEventListener('error', function () { stop(tile); });
    var play = tile.querySelector('.pl-video__play');
    if (play) tile.insertBefore(v, play); else tile.appendChild(v);
    var io = getObserver();
    if (io) io.observe(tile);
    return v;
  }

  function stop(tile) {
    if (!tile) return;
    var v = tile.querySelector('video');
    if (v && !v.paused) v.pause();
    tile.classList.remove('is-playing', 'is-muted');
    tile.setAttribute('aria-pressed', 'false');
    if (current === tile) current = null;
  }

  function play(tile, sound) {
    var v = ensureVideo(tile);
    if (!v) return;
    if (current && current !== tile) stop(current);
    current = tile;
    v.muted = !sound;
    tile.classList.add('is-playing');
    tile.classList.toggle('is-muted', !sound);
    tile.setAttribute('aria-pressed', 'true');
    var p = v.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        if (sound) {
          v.muted = true;
          tile.classList.add('is-muted');
          var q = v.play();
          if (q && typeof q.catch === 'function') q.catch(function () { stop(tile); });
        } else {
          stop(tile);
        }
      });
    }
  }

  function isPlaying(tile) {
    var v = tile.querySelector('video');
    return !!(v && !v.paused && tile.classList.contains('is-playing'));
  }

  document.addEventListener('click', function (e) {
    var tile = e.target.closest ? e.target.closest(SEL) : null;
    if (!tile) return;
    e.preventDefault();
    if (isPlaying(tile) && !tile.classList.contains('is-muted')) {
      stop(tile);
    } else {
      play(tile, true);
    }
  });

  document.addEventListener('mouseover', function (e) {
    if (!hoverable.matches) return;
    var tile = e.target.closest ? e.target.closest(SEL) : null;
    if (!tile || tile.contains(e.relatedTarget)) return;
    if (!isPlaying(tile)) play(tile, false);
  });

  document.addEventListener('mouseout', function (e) {
    if (!hoverable.matches) return;
    var tile = e.target.closest ? e.target.closest(SEL) : null;
    if (!tile || tile.contains(e.relatedTarget)) return;
    if (isPlaying(tile) && tile.classList.contains('is-muted')) stop(tile);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && current) stop(current);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current) stop(current);
  });

  // Theme editor: a re-rendered section drops its <video>; forget the stale tile.
  document.addEventListener('shopify:section:unload', function () {
    if (current && !document.body.contains(current)) current = null;
  });
})();
