/* The wall's motion: ink behind the first screen, sections rising in, the artists' cards leaning to the
   pointer, and two rows of work running past. With reduced motion asked for, nothing here moves and only
   the arrows under the work run, scrolling the rows a piece at a time. */
(function () {
  var root = document.documentElement;
  var still = !root.hasAttribute('data-wall-motion');
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var each = function (list, fn) {
    Array.prototype.forEach.call(list, fn);
  };
  var rand = function (a, b) {
    return a + Math.random() * (b - a);
  };

  /* Each section's headline and first block rise in once, when a fifth of it is in view. */
  var sections = document.querySelectorAll('[data-section]');
  if (!still && 'IntersectionObserver' in window) {
    var seen = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.setAttribute('data-in', '');
          seen.unobserve(e.target);
        });
      },
      { threshold: 0.2 },
    );
    each(sections, function (s) {
      seen.observe(s);
    });
  } else
    each(sections, function (s) {
      s.setAttribute('data-in', '');
    });

  /* The ink: slow strokes drifting and drawing themselves again, and their mark traced once. */
  function ink() {
    var canvas = document.querySelector('[data-ink]');
    var symbol = document.getElementById('wall-mark');
    if (!canvas || !canvas.getContext || !symbol || !window.Path2D) return;
    var hero = canvas.parentNode;
    var ctx = canvas.getContext('2d');
    var box = symbol.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    var ns = 'http://www.w3.org/2000/svg';
    var probe = document.createElementNS(ns, 'svg');
    probe.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    document.body.appendChild(probe);
    // Each outline of the mark is traced on its own, so they all draw at once.
    var parts = symbol
      .querySelector('path')
      .getAttribute('d')
      .split(/(?=M)/)
      .filter(Boolean)
      .map(function (d) {
        var el = document.createElementNS(ns, 'path');
        el.setAttribute('d', d);
        probe.appendChild(el);
        return { path: new Path2D(d), len: el.getTotalLength() };
      });
    probe.remove();

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0;
    var H = 0;
    var mark = null;
    var strokes = [];
    var start = performance.now();
    var TRACE = 1400;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var onScreen = true;
    var raf = 0;

    function length(p) {
      var n = 16;
      var sum = 0;
      var px = p[0][0];
      var py = p[0][1];
      for (var i = 1; i <= n; i++) {
        var t = i / n;
        var u = 1 - t;
        var x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0];
        var y = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1];
        sum += Math.hypot(x - px, y - py);
        px = x;
        py = y;
      }
      return sum;
    }

    // A long line across the screen, bowed by two handles, with a life of its own: drawn, held, let go.
    function spawn(k, now, age) {
      var fromLeft = Math.random() < 0.5;
      var a = [fromLeft ? -0.06 * W : rand(0, 0.35) * W, rand(0.08, 0.92) * H];
      var b = [fromLeft ? rand(0.65, 1) * W : 1.06 * W, rand(0.08, 0.92) * H];
      k.p = [a, [rand(0.1, 0.5) * W, rand(-0.15, 1.15) * H], [rand(0.5, 0.9) * W, rand(-0.15, 1.15) * H], b];
      k.width = rand(2, 4);
      k.alpha = rand(0.07, 0.18);
      k.depth = rand(0.4, 1);
      k.amp = rand(14, 34);
      k.speed = rand(0.12, 0.26);
      k.phase = rand(0, 6.283);
      k.life = rand(11000, 17000);
      k.born = now - age * k.life;
      k.len = length(k.p) * 1.2;
      return k;
    }

    function layout() {
      var r = hero.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      var wide = W >= 768;
      var g = wide ? 24 : 16;
      var right = (W + Math.min(W - 2 * g, 1440)) / 2;
      var h = wide ? Math.min(H * 0.72, 680) : Math.min(H * 0.42, W * 0.9);
      var s = h / box[3];
      var w = box[2] * s;
      var y = wide ? (H - h) / 2 : 56;
      mark = { x: right - w - box[0] * s, y: y - box[1] * s, s: s };
      var now = performance.now();
      var count = W < 768 ? 6 : 9;
      strokes = [];
      for (var i = 0; i < count; i++) strokes.push(spawn({}, now, rand(0, 0.55)));
    }

    function traceMark(c, p, ox, oy) {
      c.save();
      c.translate(mark.x + ox, mark.y + oy);
      c.scale(mark.s, mark.s);
      c.lineWidth = 1.1 / mark.s;
      c.strokeStyle = 'rgba(243,240,234,0.5)';
      for (var i = 0; i < parts.length; i++) {
        c.setLineDash([parts[i].len * p, parts[i].len + 1]);
        c.stroke(parts[i].path);
      }
      c.restore();
    }

    function frame(now) {
      raf = 0;
      var t = now / 1000;
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = 'round';
      for (var i = 0; i < strokes.length; i++) {
        var k = strokes[i];
        var age = (now - k.born) / k.life;
        if (age >= 1) age = (now - spawn(k, now, 0).born) / k.life;
        var drawn = Math.min(1, age / 0.35);
        drawn = 1 - Math.pow(1 - drawn, 3);
        var fade = age < 0.72 ? 1 : 1 - (age - 0.72) / 0.28;
        var ox = pointer.x * 12 * k.depth;
        var oy = pointer.y * 12 * k.depth;
        var q = k.p.map(function (pt, j) {
          return [pt[0] + Math.sin(t * k.speed + k.phase + j * 1.7) * k.amp + ox, pt[1] + Math.cos(t * k.speed * 0.8 + k.phase * 1.3 + j) * k.amp + oy];
        });
        ctx.beginPath();
        ctx.moveTo(q[0][0], q[0][1]);
        ctx.bezierCurveTo(q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1]);
        ctx.setLineDash([k.len * drawn, k.len]);
        ctx.lineWidth = k.width;
        ctx.strokeStyle = 'rgba(243,240,234,' + (k.alpha * fade).toFixed(3) + ')';
        ctx.stroke();
      }
      ctx.setLineDash([]);
      var mx = pointer.x * 6;
      var my = pointer.y * 6;
      var p = Math.min(1, (now - start) / TRACE);
      traceMark(ctx, p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, mx, my);
      schedule();
    }

    function schedule() {
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    }

    layout();
    schedule();
    if ('ResizeObserver' in window) {
      var lastW = W;
      new ResizeObserver(function () {
        // A phone's address bar changes the height only: the drawing is kept.
        if (Math.abs(hero.getBoundingClientRect().width - lastW) < 1) return;
        layout();
        lastW = W;
      }).observe(hero);
    }
    if ('IntersectionObserver' in window)
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        schedule();
      }).observe(hero);
    document.addEventListener('visibilitychange', schedule);
    if (fine)
      window.addEventListener(
        'pointermove',
        function (e) {
          if (e.pointerType !== 'mouse') return;
          pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
          pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
        },
        { passive: true },
      );
  }

  /* The artists' cards lean up to four degrees toward the pointer. */
  function tilt() {
    each(document.querySelectorAll('[data-tilt]'), function (card) {
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(1000px) rotateX(' + (-y * 8).toFixed(2) + 'deg) rotateY(' + (x * 8).toFixed(2) + 'deg)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* Two rows of work running opposite ways at 24 px a second. The arrows move each row one piece. */
  function rails() {
    var group = document.querySelector('[data-rails]');
    var controls = document.querySelector('[data-rail-controls]');
    if (!group || !controls) return;
    var rows = Array.prototype.map.call(group.querySelectorAll('[data-row]'), function (row) {
      return { row: row, track: row.querySelector('[data-track]'), dir: Number(row.getAttribute('data-dir')) || -1, x: 0, set: 0, anim: null };
    });
    var pieces = function (r) {
      return Array.prototype.filter.call(r.track.children, function (li) {
        return li.offsetWidth > 0;
      });
    };
    // How far to move a row so the next piece one way or the other meets its edge.
    var gapTo = function (r, way, inset) {
      var edge = r.row.getBoundingClientRect().left + inset;
      var best = Infinity;
      pieces(r).forEach(function (li) {
        var left = li.getBoundingClientRect().left - edge;
        [left - r.set, left, left + r.set].forEach(function (l) {
          if (way < 0 && l > 1) best = Math.min(best, l);
          if (way > 0 && l < -1) best = Math.min(best, -l);
        });
      });
      return best === Infinity ? 0 : best;
    };

    if (still) {
      each(controls.querySelectorAll('[data-rail-step]'), function (btn) {
        btn.addEventListener('click', function () {
          var sign = Number(btn.getAttribute('data-rail-step'));
          rows.forEach(function (r) {
            var inset = parseFloat(getComputedStyle(r.row).paddingLeft) || 0;
            r.row.scrollBy({ left: sign * gapTo(r, -sign, inset) });
          });
        });
      });
      return;
    }

    var hold = { hover: false, touch: false, focus: false, user: false, off: true, until: 0 };
    var raf = 0;
    var last = 0;
    var touchTimer = 0;

    function measure() {
      rows.forEach(function (r) {
        var items = r.track.children;
        var half = items.length / 2;
        r.set = items[half].offsetLeft - items[0].offsetLeft;
        // A screen wider than one set of pieces gets another copy, so the row never runs short.
        while (r.set && r.track.offsetWidth < r.row.clientWidth + r.set) {
          for (var i = 0; i < half; i++) r.track.appendChild(items[half + i].cloneNode(true));
        }
      });
    }

    function tick(now) {
      raf = 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      var go = !(hold.hover || hold.touch || hold.focus || hold.user) && now > hold.until;
      rows.forEach(function (r) {
        if (r.anim) {
          var p = Math.min(1, (now - r.anim.t0) / 450);
          r.x = r.anim.from + r.anim.by * (1 - Math.pow(1 - p, 3));
          if (p >= 1) r.anim = null;
        } else if (go) r.x += r.dir * 24 * dt;
        if (r.set) {
          r.x %= r.set;
          if (r.x > 0) r.x -= r.set;
        }
        r.track.style.transform = 'translate3d(' + r.x.toFixed(2) + 'px,0,0)';
      });
      if (!hold.off && !document.hidden) raf = requestAnimationFrame(tick);
      else last = 0;
    }

    function run() {
      if (!raf && !hold.off && !document.hidden) raf = requestAnimationFrame(tick);
    }

    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(group);
    if ('IntersectionObserver' in window)
      new IntersectionObserver(function (entries) {
        hold.off = !entries[0].isIntersecting;
        run();
      }).observe(group);
    else hold.off = false;
    document.addEventListener('visibilitychange', run);
    run();

    group.addEventListener('mouseenter', function () {
      hold.hover = true;
    });
    group.addEventListener('mouseleave', function () {
      hold.hover = false;
    });
    group.addEventListener(
      'touchstart',
      function () {
        hold.touch = true;
        clearTimeout(touchTimer);
      },
      { passive: true },
    );
    group.addEventListener(
      'touchend',
      function () {
        touchTimer = setTimeout(function () {
          hold.touch = false;
        }, 2500);
      },
      { passive: true },
    );
    var section = group.closest('section') || group;
    section.addEventListener('focusin', function () {
      hold.focus = true;
    });
    section.addEventListener('focusout', function (e) {
      hold.focus = section.contains(e.relatedTarget);
    });

    var pause = controls.querySelector('[data-rail-pause]');
    if (pause)
      pause.addEventListener('click', function () {
        hold.user = !hold.user;
        pause.setAttribute('aria-pressed', String(hold.user));
        pause.setAttribute('aria-label', hold.user ? 'Play the work' : 'Pause the work');
      });
    each(controls.querySelectorAll('[data-rail-step]'), function (btn) {
      btn.addEventListener('click', function () {
        var sign = Number(btn.getAttribute('data-rail-step'));
        var now = performance.now();
        hold.until = now + 1800;
        rows.forEach(function (r) {
          // Forward is the way each row runs; back is the other way.
          var way = r.dir * sign;
          var by = gapTo(r, way, 0);
          if (by) r.anim = { t0: now, from: r.x, by: way * by };
        });
        run();
      });
    });
  }

  if (!still) ink();
  if (!still && fine) tilt();
  rails();
})();
