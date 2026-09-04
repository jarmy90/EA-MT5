/* pixel_worker.js — Pixel-art "office" scene per agent, animated by real state.
   new WorkerScene(canvas, {color:'#22d3ee', flip:false}).setState('WORKING')
   States: DISCONNECTED, SLEEPING, STANDBY, WORKING, ENERGIZED, STRESSED, ALERT */
(function (global) {
'use strict';
var U = 4, W = 120, H = 80; // cell 4px, logical canvas 30x20 cells

var PAL = {
  wall: '#0d1424', wall2: '#111a2e', floor: '#0a0f1c', floorTop: '#131c31',
  desk: '#1c2742', deskTop: '#27365a', chair: '#1a2440', chairLeg: '#141d33',
  bezel: '#0b1322', screenOff: '#0a111f', skin: '#e6b487', hair: '#26314e',
  zzz: '#8ea6c9', sweat: '#6ec9ff', up: '#35d07f', down: '#ff5d5d',
  cup: '#d8dee9', steam: 'rgba(200,220,255,.35)', floorLine: '#33415e'
};

function shade(hex, f) {
  var n = parseInt(hex.slice(1), 16);
  var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}

function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x * U, y * U, w * U, h * U);
}

function line(ctx, x0, y0, x1, y1, c) {
  var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (var i = 0; i <= n; i++) {
    px(ctx, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1, c);
  }
}

function fr(t, hz) { return Math.floor(t * hz) % 2; }

function WorkerScene(canvas, opts) {
  opts = opts || {};
  this.cv = canvas;
  this.ctx = canvas.getContext('2d');
  this.color = opts.color || '#22d3ee';
  this.flip = !!opts.flip;
  this.state = 'STANDBY';
  this.t0 = performance.now();
  var self = this;
  function loop() {
    self._draw((performance.now() - self.t0) / 1000);
    self._raf = requestAnimationFrame(loop);
  }
  loop();
}

WorkerScene.prototype.setState = function (s) {
  if (s !== this.state) { this.state = s; this.t0 = performance.now(); }
};

WorkerScene.prototype.destroy = function () {
  cancelAnimationFrame(this._raf);
};

WorkerScene.prototype._draw = function (t) {
  var ctx = this.ctx, st = this.state;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (this.flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  var ox = 0;
  if (st === 'STRESSED') ox = fr(t, 9) ? 1 : -1;
  if (st === 'ALERT') ox = fr(t, 5) ? 1 : 0;
  ctx.translate(ox, 0);
  ctx.imageSmoothingEnabled = false;

  this._room(ctx, t, st);
  this._desk(ctx, t, st);
  if (st !== 'DISCONNECTED') this._worker(ctx, t, st);

  // Overlays
  if (st === 'SLEEPING') {
    ctx.fillStyle = 'rgba(2,6,16,.45)';
    ctx.fillRect(-8, -8, W + 16, H + 16);
  }
  if (st === 'DISCONNECTED') {
    ctx.fillStyle = 'rgba(0,2,8,.62)';
    ctx.fillRect(-8, -8, W + 16, H + 16);
  }
  if (st === 'ALERT') {
    ctx.fillStyle = 'rgba(255,64,64,' + (0.10 + 0.12 * (0.5 + 0.5 * Math.sin(t * 7))) + ')';
    ctx.fillRect(-8, -8, W + 16, H + 16);
  }
};

WorkerScene.prototype._room = function (ctx, t, st) {
  px(ctx, 0, 0, 30, 17, PAL.wall);
  px(ctx, 0, 0, 30, 1, PAL.wall2);
  px(ctx, 0, 17, 30, 3, PAL.floor);
  px(ctx, 0, 17, 30, 1, PAL.floorTop);
  // Window with stars
  px(ctx, 20, 2, 8, 6, '#060b16');
  px(ctx, 20, 2, 8, 1, PAL.bezel);
  px(ctx, 20, 2, 1, 6, PAL.bezel);
  var stars = [22, 24, 26, 27];
  for (var i = 0; i < stars.length; i++) {
    if (Math.sin(t * 1.4 + i * 2.1) > 0.1)
      px(ctx, stars[i], 3 + (i % 2) * 2, 1, 1, '#cfe4ff');
  }
  if (st === 'SLEEPING' || st === 'DISCONNECTED')
    px(ctx, 24, 4, 2, 2, PAL.floorLine);
};

WorkerScene.prototype._desk = function (ctx, t, st) {
  // Desk surface
  px(ctx, 2, 12, 11, 1, PAL.deskTop);
  px(ctx, 2, 13, 11, 1, PAL.desk);
  px(ctx, 3, 14, 1, 3, PAL.desk);
  px(ctx, 11, 14, 1, 3, PAL.desk);
  // Keyboard
  px(ctx, 10, 11, 3, 1, shade('#7f9cc9', -0.5));
  // Monitor
  px(ctx, 4, 8, 6, 4, PAL.bezel);
  this._screen(ctx, t, st);
  // Coffee cup
  px(ctx, 1, 11, 1, 1, PAL.cup);
  if (st !== 'SLEEPING' && st !== 'DISCONNECTED' && Math.sin(t * 3) > 0)
    px(ctx, 1, 10, 1, 1, PAL.steam);
  // Chair
  px(ctx, 15, 13, 4, 1, PAL.chair);
  px(ctx, 18, 8, 1, 5, PAL.chair);
  px(ctx, 17, 14, 1, 2, PAL.chairLeg);
  px(ctx, 16, 16, 3, 1, PAL.chairLeg);
};

WorkerScene.prototype._screen = function (ctx, t, st) {
  var sx = 5, sy = 9, sw = 4, sh = 2;
  if (st === 'DISCONNECTED' || st === 'SLEEPING') {
    px(ctx, sx, sy, sw, sh, PAL.screenOff);
    if (Math.sin(t * 0.7) > 0.9) px(ctx, sx, sy + 1, 2, 1, '#152033');
    return;
  }
  if (st === 'STANDBY') {
    ctx.globalAlpha = 0.22 + 0.10 * Math.sin(t * 2);
    px(ctx, sx, sy, sw, sh, this.color);
    ctx.globalAlpha = 1;
    return;
  }
  // Candlestick bars (WORKING/STRESSED/ENERGIZED/ALERT)
  var hz = st === 'STRESSED' ? 6 : 2;
  for (var i = 0; i < 4; i++) {
    var v = Math.sin(t * hz + i * 1.7);
    px(ctx, sx + i, sy + sh - (v > 0.15 ? 2 : 1), 1, v > 0.15 ? 2 : 1, v >= 0 ? PAL.up : PAL.down);
  }
  if (st === 'ENERGIZED' && fr(t, 3))
    px(ctx, sx, sy, sw, sh, shade(this.color, -0.35));
  if (st === 'ALERT' && fr(t, 4))
    px(ctx, sx, sy, sw, sh, 'rgba(255,60,60,.35)');
};

WorkerScene.prototype._worker = function (ctx, t, st) {
  var col = this.color;
  var suit = shade(col, -0.55);
  var suitD = shade(col, -0.75);

  if (st === 'SLEEPING') { this._sleep(ctx, t); return; }

  if (st === 'ALERT') {
    // Standing, hands on head, alarm beacon
    px(ctx, 14, 3, 3, 3, PAL.skin);
    px(ctx, 14, 3, 3, 1, PAL.hair);
    px(ctx, 14, 4, 1, 1, '#1b2334');
    px(ctx, 14, 6, 3, 6, suit);
    line(ctx, 14, 6, 13, 3, suit);
    line(ctx, 16, 6, 17, 3, suit);
    px(ctx, 14, 12, 2, 4, suitD);
    px(ctx, 13, 16, 2, 1, '#0c1220');
    px(ctx, 16, 16, 2, 1, '#0c1220');
    px(ctx, 24, 1, 2, 2, fr(t, 4) ? '#ff4444' : '#551111');
    return;
  }

  var blink = (t % 3.4) < 0.12;
  var by = (st === 'STANDBY' && (t % 2.6) < 1.3 ? -1 : 0) +
           (st === 'ENERGIZED' && fr(t, 5) ? -1 : 0);
  var hy = 5 + by, ty = hy + 3;

  // Head
  px(ctx, 14, hy, 3, 3, PAL.skin);
  px(ctx, 14, hy, 3, 1, PAL.hair);
  if (!blink && st !== 'ENERGIZED') px(ctx, 14, hy + 1, 1, 1, '#101828');

  // Torso
  px(ctx, 14, ty, 3, 5, suit);

  if (st === 'ENERGIZED') {
    // Arms up celebrating + sparks
    line(ctx, 14, ty, 12, 3 + by, suit);
    line(ctx, 16, ty, 18, 3 + by, suit);
    px(ctx, 12, 3 + by, 1, 1, PAL.skin);
    px(ctx, 18, 3 + by, 1, 1, PAL.skin);
    var sparks = [[3, 4], [21, 3], [25, 8], [5, 9]];
    for (var si = 0; si < sparks.length; si++) {
      if ((t * 2 + si * 0.7) % 2 < 1) {
        px(ctx, sparks[si][0], sparks[si][1] - 1, 1, 1, col);
        px(ctx, sparks[si][0], sparks[si][1] + 1, 1, 1, col);
        px(ctx, sparks[si][0] - 1, sparks[si][1], 1, 1, col);
        px(ctx, sparks[si][0] + 1, sparks[si][1], 1, 1, col);
        px(ctx, sparks[si][0], sparks[si][1], 1, 1, '#fff');
      }
    }
  } else if (st === 'WORKING' || st === 'STRESSED') {
    // Typing
    var hz = st === 'STRESSED' ? 10 : 5;
    var hand = fr(t, hz) ? 10 : 12;
    line(ctx, 14, ty + 1, hand, 11, suit);
    px(ctx, hand, 11, 1, 1, PAL.skin);
    if (st === 'STRESSED') {
      var h2 = fr(t, hz) ? 12 : 10;
      line(ctx, 16, ty + 1, h2, 11, suitD);
      px(ctx, h2, 11, 1, 1, PAL.skin);
      var syy = 6 + ((t * 6) % 5);
      ctx.globalAlpha = 1 - ((t * 6) % 5) / 6;
      px(ctx, 13, syy | 0, 1, 1, PAL.sweat);
      ctx.globalAlpha = 1;
    }
  } else {
    // STANDBY: leaning, relaxed
    line(ctx, 14, ty + 1, 11, 12, suit);
    line(ctx, 16, ty + 1, 17, 12, suitD);
  }

  // Legs
  px(ctx, 12, 13, 2, 1, suitD);
  px(ctx, 11, 14, 1, 2, suitD);
  px(ctx, 10, 16, 2, 1, '#0c1220');
};

WorkerScene.prototype._sleep = function (ctx, t) {
  // Head on desk + floating Zzz
  px(ctx, 8, 10, 3, 2, PAL.skin);
  px(ctx, 8, 10, 3, 1, PAL.hair);
  px(ctx, 11, 11, 2, 2, shade(this.color, -0.55));
  px(ctx, 13, 12, 2, 2, shade(this.color, -0.55));
  px(ctx, 15, 13, 3, 1, shade(this.color, -0.55));
  px(ctx, 14, 14, 1, 2, shade(this.color, -0.75));
  px(ctx, 13, 16, 2, 1, '#0c1220');

  for (var i = 0; i < 3; i++) {
    var ph = (t * 0.5 + i * 0.33) % 1;
    ctx.globalAlpha = 1 - ph;
    this._z(ctx, (10 + ph * 5 + i * 2) | 0, (8 - ph * 5) | 0, PAL.zzz);
    ctx.globalAlpha = 1;
  }
};

WorkerScene.prototype._z = function (ctx, x, y, c) {
  px(ctx, x, y, 3, 1, c);
  px(ctx, x + 1, y + 1, 1, 1, c);
  px(ctx, x, y + 2, 3, 1, c);
};

global.WorkerScene = WorkerScene;
})(window);
