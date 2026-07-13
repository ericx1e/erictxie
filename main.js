/*
 * Eric Xie — toy box physics playground.
 *
 * The name hangs from strings at the top; project cards tumble into a pile.
 * Everything is a matter.js body synced to a DOM element (so text stays
 * crisp and cards stay clickable).
 */

(function () {
  'use strict';

  var worldEl = document.getElementById('world');
  var stringsSvg = document.getElementById('strings');
  var overlay = document.getElementById('overlay');
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var NAME = 'ERIC XIE';

  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }

  function cardEl(p, i) {
    var el = document.createElement('div');
    el.className = 'card tint' + (i % 6);
    var em = document.createElement('span');
    em.className = 'emoji';
    em.textContent = p.emoji;
    var nm = document.createElement('span');
    nm.className = 'pname';
    nm.textContent = p.name;
    el.appendChild(em);
    el.appendChild(nm);
    return el;
  }

  /* ---------- modal ---------- */

  function openModal(p) {
    overlay.querySelector('.m-emoji').textContent = p.emoji;
    overlay.querySelector('.m-title').textContent = p.name;
    overlay.querySelector('.m-desc').textContent = p.desc;
    var shotWrap = overlay.querySelector('.m-shotwrap');
    if (p.img) {
      var shot = overlay.querySelector('.m-shot');
      shot.src = p.img;
      shot.alt = p.name + ' screenshot';
      shotWrap.hidden = false;
    } else {
      shotWrap.hidden = true;
    }
    var links = overlay.querySelector('.m-links');
    links.innerHTML = '';
    var list = p.links || [];
    if (!p.links) {
      if (p.live) list.push({ href: p.live, label: 'try it ↗' });
      if (p.github) list.push({ href: p.github, label: 'source ↗' });
    }
    list.forEach(function (l) { links.appendChild(linkBtn(l.href, l.label)); });
    overlay.hidden = false;
  }

  function linkBtn(href, label) {
    var a = document.createElement('a');
    a.className = 'btn';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label;
    return a;
  }

  function wireModal() {
    function close() { overlay.hidden = true; }
    document.getElementById('closeBtn').addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  /* ---------- fallback: no matter.js (CDN blocked, etc.) ---------- */

  if (typeof Matter === 'undefined') {
    document.body.classList.add('no-physics');
    PROJECTS.forEach(function (p, i) {
      var el = cardEl(p, i);
      el.addEventListener('click', function () { openModal(p); });
      worldEl.appendChild(el);
    });
    wireModal();
    return;
  }

  /* ---------- physics setup ---------- */

  var Engine = Matter.Engine, Runner = Matter.Runner, Bodies = Matter.Bodies,
    Body = Matter.Body, Composite = Matter.Composite, Constraint = Matter.Constraint,
    Mouse = Matter.Mouse, MouseConstraint = Matter.MouseConstraint,
    Events = Matter.Events, Sleeping = Matter.Sleeping, Vector = Matter.Vector;

  // sleeping stays off: sleeping bodies act as immovable walls, and anything
  // squeezed against one gets violently ejected by the solver every frame.
  // the collision dampers below do the settling job instead.
  var engine = Engine.create();
  engine.positionIterations = 10;
  engine.velocityIterations = 6;
  engine.constraintIterations = 5; // keeps the rope chains from stretching
  var entities = []; // { body, el, w, h }
  var entById = {};  // body.id -> entity, for collision effects
  var letters = [];  // entities + { string, line, idx }
  var cards = [];
  var toys = [];     // decorative clutter: emoji toys + doodle balls
  var loose = [];    // everything that falls in from the top (cards + toys)
  var looseTotal = 0;
  var walls = {};
  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shuffle(arr) {
    for (var k = arr.length - 1; k > 0; k--) {
      var r = Math.floor(Math.random() * (k + 1));
      var tmp = arr[k]; arr[k] = arr[r]; arr[r] = tmp;
    }
    return arr;
  }
  var WALL_T = 400;

  // letters ignore cards and toys (things would land on the hanging name
  // and balance there); everything collides with walls and terrain
  var LETTER_CAT = 0x0002, CARD_CAT = 0x0004, TOY_CAT = 0x0008;
  var LETTER_FILTER = { category: LETTER_CAT, mask: 0xFFFF & ~(CARD_CAT | TOY_CAT) };
  var CARD_FILTER = { category: CARD_CAT, mask: 0xFFFF & ~LETTER_CAT };
  var TOY_FILTER = { category: TOY_CAT, mask: 0xFFFF & ~LETTER_CAT };

  // static surfaces get real friction (matter defaults to a slippery 0.1,
  // which lets spinning bodies skid around forever instead of gripping)
  var STATIC_OPTS = { isStatic: true, friction: 0.8 };

  function buildWalls() {
    walls.floor = Bodies.rectangle(vw() / 2, vh() + WALL_T / 2 - 6, vw() * 4, WALL_T, STATIC_OPTS);
    walls.left = Bodies.rectangle(-WALL_T / 2 + 6, vh() / 2, WALL_T, vh() * 6, STATIC_OPTS);
    walls.right = Bodies.rectangle(vw() + WALL_T / 2 - 6, vh() / 2, WALL_T, vh() * 6, STATIC_OPTS);
    Composite.add(engine.world, [walls.floor, walls.left, walls.right]);
  }

  // The ceiling arrives only after every card has fallen in, so flipping
  // gravity pins the pile to the top of the screen instead of losing it.
  function addCeiling() {
    var ready = looseTotal > 0 && loose.length === looseTotal && loose.every(function (c) {
      return c.body.position.y > 80;
    });
    if (!ready) { setTimeout(addCeiling, 400); return; }
    walls.ceiling = Bodies.rectangle(vw() / 2, -WALL_T / 2, vw() * 4, WALL_T, STATIC_OPTS);
    Composite.add(engine.world, walls.ceiling);
  }

  /* ---------- name letters on strings ---------- */

  // ransom-note treatment: each tile gets a random size (stable across
  // resizes so the layout doesn't reshuffle), its own handwriting font and
  // pastel tint, and strings attach off-center so tiles hang crooked
  var letterStyle = null;
  // per-font size multiplier (hand fonts differ wildly in x-height);
  // indices match the .lf0-.lf4 classes in the stylesheet
  var LETTER_FONT_SCALE = [0.66, 0.82, 0.72, 0.66, 0.6];

  function letterLayout() {
    var s = Math.max(30, Math.min(64, (vw() - 40) / 11));
    if (!letterStyle) {
      letterStyle = [];
      // deal fonts and tints from shuffled pools so neighbours differ
      var fontPool = shuffle([0, 1, 2, 3, 4]);
      var tintPool = shuffle([0, 1, 2, 3, 4, 5]);
      var k = 0;
      for (var j = 0; j < NAME.length; j++) {
        if (NAME[j] === ' ') { letterStyle.push(null); continue; }
        letterStyle.push({
          factor: 0.85 + Math.random() * 0.4,
          tint: tintPool[k % 6],
          font: fontPool[k % 5],
          attach: (Math.random() - 0.5) * 0.36
        });
        k++;
      }
    }
    var gap = s * 0.22, space = s * 0.55;
    var anchors = [], sizes = [], x = 0;
    for (var i = 0; i < NAME.length; i++) {
      if (NAME[i] === ' ') { anchors.push(null); sizes.push(0); x += space + gap; continue; }
      var si = s * letterStyle[i].factor;
      sizes.push(si);
      anchors.push(x + si / 2);
      x += si + gap;
    }
    var left = (vw() - (x - gap)) / 2;
    return {
      sizes: sizes,
      anchors: anchors.map(function (v) { return v === null ? null : v + left; })
    };
  }

  // a real rope: a chain of tiny invisible bodies linked by constraints.
  // unlike a single constraint (a rigid rod), it goes slack, folds when the
  // tile is pushed upward, and keeps dangling if the tile is snipped off.
  function makeRope(ax, len, body, attachX, halfH) {
    len *= 0.88; // chains stretch a bit under load; hang slightly short
    var n = Math.max(4, Math.min(8, Math.round(len / 18)));
    var linkLen = len / n;
    var segs = [], links = [], prev = null;
    for (var i = 0; i < n; i++) {
      // segments collide only with other rope segments: gives the rope
      // "thickness" so slack rope drapes instead of folding into a point
      var seg = Bodies.circle(ax, linkLen * (i + 0.5), 2.5, {
        density: 0.002,
        frictionAir: 0.03,
        collisionFilter: { category: 0x0020, mask: 0x0020 }
      });
      segs.push(seg);
      links.push(i === 0
        ? Constraint.create({ pointA: { x: ax, y: 0 }, bodyB: seg, length: linkLen / 2, stiffness: 1 })
        : Constraint.create({ bodyA: prev, bodyB: seg, length: linkLen, stiffness: 1 }));
      prev = seg;
    }
    var tie = Constraint.create({
      bodyA: prev, bodyB: body,
      pointB: { x: attachX, y: -halfH },
      length: linkLen / 2, stiffness: 1
    });
    Composite.add(engine.world, segs.concat(links).concat([tie]));
    return { segs: segs, links: links, tie: tie, anchor: links[0] };
  }

  function buildLetters() {
    var L = letterLayout();
    for (var i = 0; i < NAME.length; i++) {
      if (NAME[i] === ' ') continue;
      var st = letterStyle[i];
      var s = L.sizes[i], w = s, h = s * 1.14;
      var ax = L.anchors[i];
      var len = 48 + Math.random() * 46;

      var el = document.createElement('div');
      el.className = 'letter tint' + st.tint + ' lf' + st.font;
      el.textContent = NAME[i];
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.fontSize = (s * LETTER_FONT_SCALE[st.font]) + 'px';
      worldEl.appendChild(el);

      // spawn each tile roughly at its rest position with a gentle swing,
      // so neighbours don't overlap and tangle on load
      var body = Bodies.rectangle(ax + (Math.random() * 24 - 12), len + h / 2 - 10, w, h, {
        frictionAir: 0.03,
        restitution: 0.3,
        density: 0.0007, // light, so the rope barely stretches
        collisionFilter: LETTER_FILTER
      });
      Body.setAngle(body, (Math.random() - 0.5) * 0.3);
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1);
      var attachX = st.attach * w;
      Composite.add(engine.world, body);
      var rope = makeRope(ax, len, body, attachX, h / 2);

      var ent = { body: body, el: el, w: w, h: h, rope: rope, idx: i, attachX: attachX };
      addStringLines(ent);
      entities.push(ent);
      letters.push(ent);
      entById[body.id] = ent;
    }
  }

  /* ---------- dangling link buttons: email + github on strings ---------- */

  // about-me content shown in the same modal the projects use
  // (bio pulled from the old site — edit freely, it may be stale!)
  var ABOUT = {
    name: 'about me',
    emoji: '👋',
    desc: 'I\'m Eric — CS + math alum at the University of Maryland, based in Virginia. ' +
      'I build games and playful things for the internet, and I\'m into machine ' +
      'learning, web dev, finance, and algorithms. Also bouldering, pickleball, and running.',
    links: [
      { href: 'Eric_Xie_Resume.pdf', label: 'resume ↗' },
      // { href: 'mailto:ericxie6@gmail.com', label: 'say hi ↗' }
    ]
  };

  var DANGLERS = [
    {
      label: 'about me', char: '?', fx: 0.175, tint: 0, modal: ABOUT
    },
    {
      label: 'email', href: 'mailto:ericxie6@gmail.com', fx: 0.1, tint: 2,
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.5 6.5 L12 13 L20.5 6.5"/></g></svg>'
    },
    {
      label: 'github', href: 'https://github.com/ericx1e', fx: 0.9, tint: 1,
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>'
    }
  ];

  function buildDanglers() {
    DANGLERS.forEach(function (d) {
      var w = Math.max(46, Math.min(60, vw() * 0.042));
      var h = w;
      var ax = vw() * d.fx;
      // on narrow screens the sides are occupied by the name, so the
      // buttons hang on longer strings below the letter row instead
      var len = vw() < 700 ? 185 + Math.random() * 40 : 70 + Math.random() * 60;

      var el = document.createElement('div');
      el.className = 'dangler tint' + d.tint;
      if (d.icon) el.innerHTML = d.icon;
      else { el.textContent = d.char; el.classList.add('q'); }
      el.title = d.label;
      el.setAttribute('aria-label', d.label);
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      worldEl.appendChild(el);

      var body = Bodies.rectangle(ax + (Math.random() * 20 - 10), len + h / 2 - 8, w, h, {
        frictionAir: 0.03,
        restitution: 0.3,
        density: 0.0007,
        chamfer: { radius: 6 },
        collisionFilter: LETTER_FILTER
      });
      Body.setAngle(body, (Math.random() - 0.5) * 0.2);
      if (d.href) body.plugin.href = d.href;
      if (d.modal) body.plugin.modal = d.modal;
      var attachX = (Math.random() - 0.5) * 0.2 * w;
      Composite.add(engine.world, body);
      var rope = makeRope(ax, len, body, attachX, h / 2);

      // joins `letters` so it shares string rendering and popcorn swings
      var ent = { body: body, el: el, w: w, h: h, rope: rope, fx: d.fx, attachX: attachX };
      addStringLines(ent);
      entities.push(ent);
      letters.push(ent);
      entById[body.id] = ent;
    });
  }

  /* ---------- project cards ---------- */

  function spawnCards() {
    var cw = Math.max(96, Math.min(150, vw() * 0.15));
    var ch = Math.round(cw * 0.74);

    // deal cards into shuffled slots across the width so the pile spreads
    // out and most cards land face-up (drops straight down = less tumbling)
    var slots = shuffle(PROJECTS.map(function (_, i) { return i; }));
    looseTotal += PROJECTS.length;

    PROJECTS.forEach(function (p, i) {
      setTimeout(function () {
        var w = Math.round(cw * (0.9 + Math.random() * 0.25));
        var h = Math.round(w * 0.74);
        var el = cardEl(p, i);
        if (w < 116) el.classList.add('small');
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        // in tidy mode cards are static, so the physics click detection
        // can't see them — open the modal from a plain DOM click instead
        el.addEventListener('click', function () { if (tidyMode) openModal(p); });
        worldEl.appendChild(el);

        var margin = cw / 2 + 24;
        var span = Math.max(60, vw() - margin * 2);
        var x = margin + span * (slots[i] + 0.2 + Math.random() * 0.6) / PROJECTS.length;
        var body = Bodies.rectangle(x, -h, w, h, {
          restitution: 0.15,
          friction: 0.55,
          frictionAir: 0.012,
          chamfer: { radius: 8 },
          collisionFilter: CARD_FILTER
        });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
        body.plugin.project = p;
        Composite.add(engine.world, body);

        var ent = { body: body, el: el, w: w, h: h };
        entities.push(ent);
        cards.push(ent);
        loose.push(ent);
        entById[body.id] = ent;
      }, 500 + i * 240);
    });
  }

  /* ---------- toy clutter: the rest of the toy box ---------- */

  var POLY_FILLS = ['--pink', '--blue', '--yellow', '--green', '--purple', '--orange'];

  // draws a sketchy SVG matching a polygon body's vertices (built while the
  // body is still at angle 0; the DOM element rotates with the body after)
  function polySvg(body, size, fillVar) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'doodle-poly');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    var poly = document.createElementNS(SVG_NS, 'polygon');
    var c = size / 2;
    var pts = body.vertices.map(function (v) {
      var wob = function () { return (Math.random() - 0.5) * 2.4; };
      return (v.x - body.position.x + c + wob()) + ',' + (v.y - body.position.y + c + wob());
    });
    poly.setAttribute('points', pts.join(' '));
    poly.style.fill = 'var(' + fillVar + ')';
    svg.appendChild(poly);
    return svg;
  }

  function spawnToys() {
    var count = Math.max(9, Math.min(15, Math.round(vw() / 110)));
    looseTotal += count;

    for (var i = 0; i < count; i++) {
      (function (i) {
        setTimeout(function () {
          var el = document.createElement('div');
          el.className = 'toy';
          var r, body;

          var x = 30 + Math.random() * Math.max(60, vw() - 60);
          // restitution stays ≤ 0.55: much above that, matter.js sustains
          // near-perpetual bounce loops on static surfaces
          var opts = {
            restitution: 0.3 + Math.random() * 0.25,
            friction: 0.12,
            frictionAir: 0.012,
            density: 0.0012,
            collisionFilter: TOY_FILTER
          };

          if (i === 0) {
            // one big doodle beach ball for scale contrast
            r = Math.max(30, Math.min(46, vw() * 0.032));
            el.classList.add('ball', 'b' + Math.floor(Math.random() * 4));
            body = Bodies.circle(x, -r * 2, r, opts);
          } else if (i % 2 === 0) {
            // wobbly doodle polygon: triangle, pentagon, or hexagon
            r = 16 + Math.random() * 14;
            var sides = [3, 5, 6][Math.floor(Math.random() * 3)];
            opts.restitution = 0.25 + Math.random() * 0.2;
            opts.friction = 0.4;
            body = Bodies.polygon(x, -r * 2, sides, r, opts);
            var size = Math.ceil(r * 2) + 8;
            el.appendChild(polySvg(body, size, POLY_FILLS[i % POLY_FILLS.length]));
            r = size / 2; // element box includes stroke padding
          } else {
            r = 14 + Math.random() * 12;
            el.classList.add('ball', 'b' + (i % 4));
            body = Bodies.circle(x, -r * 2, r, opts);
          }

          el.style.width = (r * 2) + 'px';
          el.style.height = (r * 2) + 'px';
          worldEl.appendChild(el);

          Body.setAngle(body, Math.random() * Math.PI * 2);
          Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);
          Composite.add(engine.world, body);

          var ent = { body: body, el: el, w: r * 2, h: r * 2 };
          entities.push(ent);
          toys.push(ent);
          loose.push(ent);
          entById[body.id] = ent;
        }, 900 + i * 260 + Math.random() * 200);
      })(i);
    }
  }

  /* ---------- terrain: mounds and a seesaw ---------- */

  var terrain = []; // static mounds: entities + { fx, r }
  var seesaw = null; // { ent, pivot, wedge, fx }

  function buildTerrain() {
    // mounds sit in open floor, well clear of the walls: if the gap between
    // a mound and a wall is narrower than a card, whatever wedges in there
    // gets squeeze-ejected by the solver every frame and pinballs forever
    var mounds = vw() < 700
      ? [{ fx: 0.3, rf: 0.16, c: 'm-green' }]
      : [{ fx: 0.22, rf: 0.085, c: 'm-green' }, { fx: 0.78, rf: 0.06, c: 'm-yellow' }];

    mounds.forEach(function (m) {
      var r = Math.max(55, Math.min(115, vw() * m.rf));
      var el = document.createElement('div');
      el.className = 'mound ' + m.c;
      el.style.width = (r * 2) + 'px';
      el.style.height = (r * 2) + 'px';
      worldEl.appendChild(el);
      // buried circle: only the top arc pokes above the floor line
      var body = Bodies.circle(vw() * m.fx, vh() + r * 0.5, r, STATIC_OPTS);
      // invisible flat ledge at the crown: a flat card can't balance on a
      // convex point (it teeters forever), so give it a stable shelf whose
      // top is tangent to the arc
      var ledge = Bodies.rectangle(vw() * m.fx, vh() - r * 0.5 + 6, r * 0.85, 12,
        Object.assign({ chamfer: { radius: 5 } }, STATIC_OPTS));
      Composite.add(engine.world, [body, ledge]);
      var ent = { body: body, el: el, w: r * 2, h: r * 2, fx: m.fx, r: r, ledge: ledge };
      entities.push(ent);
      terrain.push(ent);
    });

    if (vw() >= 640) buildSeesaw();
  }

  function buildSeesaw() {
    var fx = 0.5;
    var len = Math.max(150, Math.min(240, vw() * 0.16));
    var px = vw() * fx, py = vh() - 44;

    var body = Bodies.rectangle(px, py, len, 13, {
      density: 0.002,
      friction: 0.8,
      frictionAir: 0.03,
      chamfer: { radius: 5 }
    });
    var pivot = Constraint.create({
      pointA: { x: px, y: py },
      bodyB: body, pointB: { x: 0, y: 0 },
      length: 0, stiffness: 0.92
    });
    Composite.add(engine.world, [body, pivot]);

    var el = document.createElement('div');
    el.className = 'plank';
    el.style.width = len + 'px';
    el.style.height = '13px';
    worldEl.appendChild(el);
    var ent = { body: body, el: el, w: len, h: 13 };
    entities.push(ent);

    var wedge = document.createElementNS(SVG_NS, 'svg');
    wedge.setAttribute('class', 'wedge');
    wedge.setAttribute('width', '36');
    wedge.setAttribute('height', '40');
    wedge.setAttribute('viewBox', '0 0 36 40');
    var tri = document.createElementNS(SVG_NS, 'polygon');
    tri.setAttribute('points', '18,3 34,38 2,38');
    wedge.appendChild(tri);
    worldEl.appendChild(wedge);

    seesaw = { ent: ent, pivot: pivot, wedge: wedge, fx: fx };
    positionWedge();
  }

  function positionWedge() {
    if (!seesaw) return;
    seesaw.wedge.style.left = (vw() * seesaw.fx - 18) + 'px';
    seesaw.wedge.style.top = (vh() - 40) + 'px';
  }

  /* ---------- impact juice: cartoon squash & stretch ---------- */

  // hard impacts briefly squash the thing that landed; the render loop
  // applies the scale along the body's own axis and decays it
  function wireSquash() {
    Events.on(engine, 'collisionStart', function (ev) {
      var pairs = ev.pairs;
      for (var i = 0; i < pairs.length; i++) {
        var a = pairs[i].bodyA, b = pairs[i].bodyB;
        var rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
        // every impact bleeds spin: a tumbling card stores far more energy
        // in rotation than in its bounce, and keeps rattling until it's gone
        if (!a.isStatic && entById[a.id]) Body.setAngularVelocity(a, a.angularVelocity * 0.8);
        if (!b.isStatic && entById[b.id]) Body.setAngularVelocity(b, b.angularVelocity * 0.8);
        if (rel < 3.5) {
          // micro-bounce damper: bleed energy from slow impacts against
          // static surfaces so nothing gets stuck in a bounce loop
          // (this fires before the resolver, so the bounce shrinks too)
          var d = a.isStatic && !b.isStatic ? b : (b.isStatic && !a.isStatic ? a : null);
          if (d) {
            Body.setVelocity(d, { x: d.velocity.x * 0.85, y: d.velocity.y * 0.45 });
          } else if (!a.isStatic && !b.isStatic) {
            // gentler for body-on-body, so precarious stacks stop jittering
            Body.setVelocity(a, { x: a.velocity.x * 0.92, y: a.velocity.y * 0.8 });
            Body.setVelocity(b, { x: b.velocity.x * 0.92, y: b.velocity.y * 0.8 });
          }
          continue;
        }
        if (rel < 5) continue;
        var s = Math.min(0.3, (rel - 5) * 0.03);
        var ea = entById[a.id], eb = entById[b.id];
        if (ea && !a.isStatic) ea.squash = Math.max(ea.squash || 0, s);
        if (eb && !b.isStatic) eb.squash = Math.max(eb.squash || 0, s);
      }
    });
  }

  var lastUserInput = 0;
  function markInput() { lastUserInput = Date.now(); }

  /* ---------- tidy mode: cards freeze into a readable grid ---------- */

  var tidyMode = false;

  function tweenBody(body, to, ms) {
    var from = { x: body.position.x, y: body.position.y, a: body.angle };
    // unwind full rotations so the card straightens the short way round
    var ta = to.a + Math.round((from.a - to.a) / (Math.PI * 2)) * Math.PI * 2;
    var start = performance.now();
    (function step() {
      var t = Math.min(1, (performance.now() - start) / ms);
      var e = 1 - Math.pow(1 - t, 3);
      Body.setPosition(body, { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      Body.setAngle(body, from.a + (ta - from.a) * e);
      if (t < 1 && body.isStatic) requestAnimationFrame(step);
    })();
  }

  function tidyLayout(instant) {
    var maxW = 0, maxH = 0;
    cards.forEach(function (c) { maxW = Math.max(maxW, c.w); maxH = Math.max(maxH, c.h); });
    var slotW = maxW + 26, slotH = maxH + 26;
    var cols = Math.max(2, Math.min(4, Math.floor((vw() - 48) / slotW)));
    var rows = Math.ceil(cards.length / cols);
    var startX = (vw() - cols * slotW) / 2 + slotW / 2;
    // sit the grid in the lower half so it clears the tagline text
    var startY = Math.max(340, vh() * 0.56 - (rows * slotH) / 2 + slotH / 2);
    startY = Math.min(startY, vh() - 50 - maxH / 2 - (rows - 1) * slotH);
    cards.forEach(function (c, i) {
      var to = {
        x: startX + (i % cols) * slotW,
        y: startY + Math.floor(i / cols) * slotH,
        a: 0
      };
      Body.setStatic(c.body, true);
      if (instant) {
        Body.setPosition(c.body, { x: to.x, y: to.y });
        Body.setAngle(c.body, 0);
      } else {
        tweenBody(c.body, to, 480 + i * 40);
      }
    });
  }

  function wireTidy() {
    var btn = document.getElementById('tidyBtn');
    btn.addEventListener('click', function () {
      markInput();
      tidyMode = !tidyMode;
      btn.textContent = tidyMode ? 'make a mess! 🌪️' : 'tidy up 🧹';
      if (tidyMode) {
        tidyLayout(false);
      } else {
        cards.forEach(function (c) {
          Body.setStatic(c.body, false);
          Body.setVelocity(c.body, { x: (Math.random() - 0.5) * 4, y: 2 });
          Body.setAngularVelocity(c.body, (Math.random() - 0.5) * 0.15);
        });
      }
    });
  }

  // settle watchdog: anything still fast several seconds after the user
  // last touched the world gets extra air drag until it calms down — bad
  // solver pinches can otherwise feed a bounce loop indefinitely
  function wireWatchdog() {
    setInterval(function () {
      var now = Date.now();
      if (now - lastUserInput < 3000) return;
      loose.forEach(function (e) {
        var b = e.body;
        if (b.speed > 3) {
          e.fastSince = e.fastSince || now;
          if (now - e.fastSince > 3500 && !e.calming) {
            e.calming = true;
            e.baseFrictionAir = b.frictionAir;
            b.frictionAir = 0.08;
          }
        } else {
          e.fastSince = null;
          if (e.calming && b.speed < 1) {
            b.frictionAir = e.baseFrictionAir;
            e.calming = false;
          }
        }
      });
    }, 500);
  }

  // safety valve: no matter what the solver does in a bad pinch, nothing
  // gets to keep ricocheting at silly speeds
  function wireSpeedCap() {
    Events.on(engine, 'beforeUpdate', function () {
      for (var i = 0; i < loose.length; i++) {
        var b = loose[i].body;
        if (b.speed > 32) {
          var f = 32 / b.speed;
          Body.setVelocity(b, { x: b.velocity.x * f, y: b.velocity.y * f });
        }
      }
    });
  }

  /* ---------- poke: double-click sends a shockwave through the pile ---------- */

  function poke(x, y) {
    markInput();
    var R = 170;
    loose.forEach(function (e) {
      var dx = e.body.position.x - x, dy = e.body.position.y - y;
      var d = Math.hypot(dx, dy) || 1;
      if (d > R) return;
      var k = (1 - d / R) * 11;
      Sleeping.set(e.body, false);
      Body.setVelocity(e.body, {
        x: e.body.velocity.x + (dx / d) * k,
        y: e.body.velocity.y + (dy / d) * k - 2
      });
    });
    var rip = document.createElement('div');
    rip.className = 'ripple';
    rip.style.left = x + 'px';
    rip.style.top = y + 'px';
    worldEl.appendChild(rip);
    setTimeout(function () { rip.remove(); }, 600);
  }

  function wirePoke() {
    worldEl.addEventListener('dblclick', function (ev) {
      poke(ev.clientX, ev.clientY);
    });
  }

  /* ---------- ambient life ---------- */

  // popcorn: every few seconds something in the pile stirs, so the scene
  // never goes completely still
  function popcorn() {
    setTimeout(function tick() {
      if (!document.hidden && overlay.hidden) {
        var dir = engine.gravity.y >= 0 ? -1 : 1;
        var roll = Math.random();
        if (roll < 0.6 && toys.length) {
          var t = toys[Math.floor(Math.random() * toys.length)];
          Sleeping.set(t.body, false);
          Body.setVelocity(t.body, { x: (Math.random() - 0.5) * 4, y: dir * (5 + Math.random() * 4) });
          Body.setAngularVelocity(t.body, (Math.random() - 0.5) * 0.3);
        } else if (roll < 0.85 && cards.length && !tidyMode) {
          var c = cards[Math.floor(Math.random() * cards.length)];
          Sleeping.set(c.body, false);
          Body.setVelocity(c.body, { x: (Math.random() - 0.5) * 2, y: dir * (3 + Math.random() * 2) });
        } else if (letters.length) {
          var l = letters[Math.floor(Math.random() * letters.length)];
          Sleeping.set(l.body, false);
          Body.setVelocity(l.body, { x: (Math.random() - 0.5) * 7, y: l.body.velocity.y });
        }
      }
      setTimeout(tick, 2600 + Math.random() * 3200);
    }, 8000);
  }

  // breeze: moving the cursor swats nearby toys without grabbing them
  function wireBreeze() {
    var last = { x: 0, y: 0 };
    Events.on(engine, 'beforeUpdate', function () {
      var mp = mouse.position;
      var mvx = mp.x - last.x, mvy = mp.y - last.y;
      last.x = mp.x; last.y = mp.y;
      if (mouseConstraint.body) return; // don't fight an active drag
      var speed = Math.hypot(mvx, mvy);
      if (speed < 3) return;
      var clamp = Math.min(speed, 30) / speed;
      function swat(ent) {
        var b = ent.body;
        var dist = Math.hypot(b.position.x - mp.x, b.position.y - mp.y);
        var reach = 60 + ent.w;
        if (dist < reach) {
          Sleeping.set(b, false);
          Body.applyForce(b, b.position, {
            x: mvx * clamp * 0.00022 * b.mass * (1 - dist / reach + 0.3),
            y: mvy * clamp * 0.00022 * b.mass * (1 - dist / reach + 0.3)
          });
        }
      }
      toys.forEach(swat);
    });
  }

  /* ---------- mouse: drag anything, click a card to open it ---------- */

  var mouse = Mouse.create(worldEl);
  var mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: { stiffness: 0.2, damping: 0.08 }
  });
  Composite.add(engine.world, mouseConstraint);

  var down = null;
  Events.on(mouseConstraint, 'startdrag', function (e) {
    markInput();
    down = { t: Date.now(), x: mouse.position.x, y: mouse.position.y };
    document.body.classList.add('grabbing');
  });
  Events.on(mouseConstraint, 'enddrag', markInput);
  Events.on(mouseConstraint, 'enddrag', function (e) {
    document.body.classList.remove('grabbing');
    if (!down) return;
    var dt = Date.now() - down.t;
    var dist = Math.hypot(mouse.position.x - down.x, mouse.position.y - down.y);
    if (dt < 350 && dist < 10 && e.body && e.body.plugin) {
      var plug = e.body.plugin;
      if (plug.project) {
        openModal(plug.project);
      } else if (plug.modal) {
        openModal(plug.modal);
      } else if (plug.href) {
        if (plug.href.indexOf('mailto:') === 0) location.href = plug.href;
        else window.open(plug.href, '_blank', 'noopener');
      }
    }
    down = null;
  });

  /* ---------- controls ---------- */

  function wakeAll() {
    Composite.allBodies(engine.world).forEach(function (b) {
      if (!b.isStatic) Sleeping.set(b, false);
    });
  }

  document.getElementById('shakeBtn').addEventListener('click', function () {
    markInput();
    wakeAll();
    var up = engine.gravity.y >= 0 ? -1 : 1;
    entities.forEach(function (e) {
      Body.setVelocity(e.body, {
        x: (Math.random() - 0.5) * 16,
        y: up * (9 + Math.random() * 9)
      });
      Body.setAngularVelocity(e.body, (Math.random() - 0.5) * 0.35);
    });
  });

  document.getElementById('gravityBtn').addEventListener('click', function () {
    markInput();
    engine.gravity.y *= -1;
    wakeAll();
    document.body.classList.toggle('upside-down', engine.gravity.y < 0);
  });

  /* ---------- render: sync DOM to bodies ---------- */

  function render() {
    for (var i = 0; i < entities.length; i++) {
      var e = entities[i], pos = e.body.position;
      var tf =
        'translate(' + (pos.x - e.w / 2) + 'px,' + (pos.y - e.h / 2) + 'px) ' +
        'rotate(' + e.body.angle + 'rad)';
      if (e.squash) {
        tf += ' scale(' + (1 + e.squash) + ',' + (1 - e.squash) + ')';
        e.squash = e.squash > 0.008 ? e.squash * 0.86 : 0;
      }
      e.el.style.transform = tf;
    }
    for (var j = 0; j < letters.length; j++) {
      var l = letters[j];
      var pts = [{ x: l.rope.anchor.pointA.x, y: 0 }];
      var segs = l.rope.segs;
      for (var m = 0; m < segs.length; m++) {
        pts.push({ x: segs[m].position.x, y: segs[m].position.y });
      }
      if (!l.cut) {
        var off = Vector.rotate({ x: l.attachX || 0, y: -l.h / 2 }, l.body.angle);
        pts.push({ x: l.body.position.x + off.x, y: l.body.position.y + off.y });
      }
      var d = smoothPath(pts);
      l.line.setAttribute('d', d);
      l.hit.setAttribute('d', d);
    }
    requestAnimationFrame(render);
  }

  /* ---------- resize ---------- */

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 150);
  });

  function onResize() {
    Body.setPosition(walls.floor, { x: vw() / 2, y: vh() + WALL_T / 2 - 6 });
    Body.setPosition(walls.left, { x: -WALL_T / 2 + 6, y: vh() / 2 });
    Body.setPosition(walls.right, { x: vw() + WALL_T / 2 - 6, y: vh() / 2 });
    if (walls.ceiling) Body.setPosition(walls.ceiling, { x: vw() / 2, y: -WALL_T / 2 });

    var L = letterLayout();
    letters.forEach(function (l) {
      if (l.fx) l.rope.anchor.pointA.x = vw() * l.fx;
      else if (L.anchors[l.idx] != null) l.rope.anchor.pointA.x = L.anchors[l.idx];
    });

    terrain.forEach(function (m) {
      Body.setPosition(m.body, { x: vw() * m.fx, y: vh() + m.r * 0.5 });
      Body.setPosition(m.ledge, { x: vw() * m.fx, y: vh() - m.r * 0.5 + 6 });
    });
    if (seesaw) {
      seesaw.pivot.pointA = { x: vw() * seesaw.fx, y: vh() - 44 };
      Sleeping.set(seesaw.ent.body, false);
      positionWedge();
    }

    if (tidyMode) tidyLayout(true);

    // herd any body stranded outside the new walls back on screen
    entities.forEach(function (e) {
      if (e.body.isStatic) return;
      var p = e.body.position;
      if (p.x > vw() - 10 || p.x < 10) {
        Body.setPosition(e.body, {
          x: Math.max(e.w, Math.min(vw() - e.w, p.x)),
          y: Math.min(p.y, vh() - e.h)
        });
      }
      Sleeping.set(e.body, false);
    });
  }

  /* ---------- go ---------- */

  buildWalls();
  wireModal();
  buildTerrain();
  spawnCards();
  spawnToys();
  setTimeout(addCeiling, 5200);
  wireSquash();
  wireSpeedCap();
  wireWatchdog();
  wirePoke();
  wireTidy();
  if (!reducedMotion) {
    popcorn();
    wireBreeze();
  }

  // creates the visible string plus a fat invisible hit-line you can click
  // to snip it (✂️); ent must already have .string
  function addStringLines(ent) {
    var line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('class', 'string');
    stringsSvg.appendChild(line);
    var hit = document.createElementNS(SVG_NS, 'path');
    hit.setAttribute('class', 'string-hit');
    stringsSvg.appendChild(hit);
    hit.addEventListener('click', function () { snip(ent); });
    ent.line = line;
    ent.hit = hit;
  }

  // Catmull-Rom → bezier: draws the rope as a smooth curve through the
  // chain, so slack rope reads as a drape instead of a thick zigzag blob
  function smoothPath(pts) {
    var d = 'M' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += 'C' + (p1.x + (p2.x - p0.x) / 6).toFixed(1) + ' ' + (p1.y + (p2.y - p0.y) / 6).toFixed(1) +
        ',' + (p2.x - (p3.x - p1.x) / 6).toFixed(1) + ' ' + (p2.y - (p3.y - p1.y) / 6).toFixed(1) +
        ',' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d;
  }

  function snip(ent) {
    if (ent.cut) return;
    ent.cut = true;
    markInput();
    // cut the tile free; the rope itself stays dangling from the ceiling
    Composite.remove(engine.world, ent.rope.tie);
    worldEl.appendChild(ent.el); // draw above the pile so it stays visible
    Body.setAngularVelocity(ent.body, (Math.random() - 0.5) * 0.25);
    document.getElementById('rehangBtn').hidden = false;
  }

  document.getElementById('rehangBtn').addEventListener('click', function () {
    markInput();
    letters.forEach(function (l) {
      if (!l.cut) return;
      l.cut = false;
      // pop the tile back up to the rope's loose end, then re-tie
      var end = l.rope.segs[l.rope.segs.length - 1];
      Body.setPosition(l.body, { x: end.position.x, y: end.position.y + l.h / 2 + 4 });
      Body.setVelocity(l.body, { x: 0, y: 0 });
      Body.setAngularVelocity(l.body, 0);
      Body.setAngle(l.body, 0);
      Composite.add(engine.world, l.rope.tie);
    });
    this.hidden = true;
  });

  var hangingBuilt = false;
  function buildHanging() {
    if (hangingBuilt) return;
    hangingBuilt = true;
    buildLetters();
    buildDanglers();
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(buildHanging);
    setTimeout(function () { if (!letters.length) buildHanging(); }, 1500);
  } else {
    buildHanging();
  }

  Runner.run(Runner.create(), engine);
  requestAnimationFrame(render);

  // console handle for poking at the world
  window.__toybox = { engine: engine, entities: entities, cards: cards, toys: toys, letters: letters, walls: walls };
})();
