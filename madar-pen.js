/*!
 * madar-pen.js — كتابة الطالب بالقلم/الإصبع داخل «منطقة الحل» في صفحات الاختبارات النهائية.
 *
 * يعمل تلقائياً على كل عنصر .nq-solve: يضيف فوقه لوحة رسم شفافة وشريط أدوات صغير
 * (✍️ وضع الكتابة · 🧽 ممحاة · ↶ تراجع · 🗑 مسح · ＋ مساحة إضافية).
 *  - الفأرة وقلم الشاشة يكتبان مباشرة؛ الإصبع يمرّر الصفحة كالمعتاد حتى يفعّل الطالب ✍️.
 *  - يُحفظ ما كتبه الطالب تلقائياً في المتصفح (localStorage) لكل سؤال، ولا يُرسل لأي خادم.
 *  - لا يغيّر أي شيء في المحتوى أو نموذج الحل؛ وإن تعذّر التخزين تعمل الكتابة دون حفظ.
 * يُحمَّل من madar-frac.js (الذي تستخدمه كل صفحات الاختبارات) فلا حاجة لتعديل أي صفحة.
 */
(function () {
  "use strict";
  if (typeof document === "undefined" || window.madarPenLoaded) return;
  window.madarPenLoaded = true;

  var INK = "#14324a", WIDTH = 2.6, ERASE_R = 14, MIN_H = 190, ADD_H = 120, MAX_EXTRA = 960;
  var PFX = "madar-pen:v1:" + location.pathname + ":";

  function load(k) { try { var s = localStorage.getItem(PFX + k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function save(k, d) {
    try {
      if (d.s.length || d.e) localStorage.setItem(PFX + k, JSON.stringify(d));
      else localStorage.removeItem(PFX + k);
    } catch (e) { /* التخزين غير متاح: تستمر الكتابة بلا حفظ */ }
  }

  var css = document.createElement("style");
  css.textContent =
    ".nq-solve{overflow:hidden}" +
    ".mp-pen{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y pinch-zoom;cursor:crosshair;border-radius:inherit}" +
    ".nq-solve.mp-on{border-style:solid;border-color:#1a8f6b;box-shadow:0 0 0 3px rgba(26,143,107,.15)}" +
    ".nq-solve.mp-on .mp-pen{touch-action:none}" +
    ".mp-bar{position:absolute;top:4px;left:6px;display:flex;gap:4px;z-index:2;direction:ltr}" +
    ".mp-bar button{min-width:36px;height:36px;padding:0 8px;border:1px solid #c9d6de;border-radius:10px;background:#fff;color:#14324a;font:700 13px/1 Tajawal,system-ui,sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px}" +
    ".mp-bar button[aria-pressed=true]{background:#1a8f6b;border-color:#1a8f6b;color:#fff}" +
    ".mp-bar button:disabled{opacity:.4;cursor:default}" +
    ".mp-bar button:focus-visible{outline:2px solid #1a8f6b;outline-offset:2px}" +
    ".mp-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;color:#9aa9b3;font-size:13px;text-align:center;padding:0 16px}" +
    "@media print{.mp-bar,.mp-hint{display:none!important}}";
  document.head.appendChild(css);

  function btn(txt, title, onclick, pressable) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = txt; b.title = title; b.setAttribute("aria-label", title);
    if (pressable) b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", onclick);
    return b;
  }

  function init(box, key) {
    var data = load(key) || { s: [], e: 0 };
    if (!Array.isArray(data.s)) data.s = [];
    data.e = Math.min(Math.max(+data.e || 0, 0), MAX_EXTRA);

    var base = Math.max(box.offsetHeight, MIN_H);
    function applyHeight() { box.style.minHeight = (base + data.e) + "px"; }
    applyHeight();

    var cv = document.createElement("canvas");
    cv.className = "mp-pen";
    cv.setAttribute("aria-label", "لوحة كتابة الحل بالقلم أو الإصبع");
    var hint = document.createElement("div");
    hint.className = "mp-hint";
    hint.textContent = "اكتب حلّك هنا بالقلم أو الفأرة — على الجوال اضغط ✍️ ثم اكتب بإصبعك";
    var bar = document.createElement("div");
    bar.className = "mp-bar";

    var writeOn = false, erase = false, cur = null, confirmT = 0;
    var bWrite = btn("✍️", "وضع الكتابة بالإصبع", function () {
      writeOn = !writeOn; if (!writeOn) setErase(false);
      bWrite.setAttribute("aria-pressed", writeOn); box.classList.toggle("mp-on", writeOn);
    }, true);
    var bErase = btn("🧽", "ممحاة: المس الخط لحذفه", function () {
      setErase(!erase);
      if (erase && !writeOn) bWrite.click();
    }, true);
    var bUndo = btn("↶", "تراجع عن آخر خط", function () { data.s.pop(); changed(); });
    var bClear = btn("🗑", "مسح كل ما كُتب", function () {
      if (!data.s.length) return;
      if (!confirmT) {
        bClear.textContent = "متأكد؟";
        confirmT = setTimeout(resetClear, 2500);
        return;
      }
      resetClear(); data.s = []; changed();
    });
    var bMore = btn("＋", "زيادة مساحة الكتابة", function () {
      if (data.e >= MAX_EXTRA) return;
      data.e += ADD_H; applyHeight(); size(); save(key, data);
    });
    function resetClear() { clearTimeout(confirmT); confirmT = 0; bClear.textContent = "🗑"; }
    function setErase(v) { erase = v; bErase.setAttribute("aria-pressed", v); }
    [bWrite, bErase, bUndo, bClear, bMore].forEach(function (b) { bar.appendChild(b); });
    box.appendChild(cv); box.appendChild(hint); box.appendChild(bar);

    var ctx = cv.getContext("2d"), W = 0, H = 0;
    function size() {
      var r = box.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      W = Math.round(r.width) - 3; H = Math.round(r.height) - 3; // مطروحاً منه الإطار
      if (W < 10 || H < 10) return;
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      redraw();
    }
    function style() { ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = WIDTH; ctx.lineCap = "round"; ctx.lineJoin = "round"; }
    function drawStroke(s) {
      style();
      var n = s.length / 2;
      if (n === 1) { ctx.beginPath(); ctx.arc(s[0] * W, s[1], WIDTH / 2, 0, 6.2832); ctx.fill(); return; }
      ctx.beginPath(); ctx.moveTo(s[0] * W, s[1]);
      for (var i = 1; i < n - 1; i++) {
        var mx = (s[2 * i] * W + s[2 * i + 2] * W) / 2, my = (s[2 * i + 1] + s[2 * i + 3]) / 2;
        ctx.quadraticCurveTo(s[2 * i] * W, s[2 * i + 1], mx, my);
      }
      ctx.lineTo(s[2 * n - 2] * W, s[2 * n - 1]); ctx.stroke();
    }
    function redraw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < data.s.length; i++) drawStroke(data.s[i]);
      if (cur) drawStroke(cur);
      hint.style.display = (data.s.length || cur) ? "none" : "flex";
      bUndo.disabled = bClear.disabled = !data.s.length;
    }
    function changed() { redraw(); save(key, data); }

    function pt(e) {
      var r = cv.getBoundingClientRect();
      return [Math.min(Math.max((e.clientX - r.left) / (r.width || 1), 0), 1), Math.min(Math.max(e.clientY - r.top, 0), r.height)];
    }
    function r4(p) { return [Math.round(p[0] * 10000) / 10000, Math.round(p[1] * 10) / 10]; }
    function eraseAt(p) {
      var x = p[0] * W, y = p[1], hit = false;
      data.s = data.s.filter(function (s) {
        for (var i = 0; i < s.length; i += 2) {
          var dx = s[i] * W - x, dy = s[i + 1] - y;
          if (dx * dx + dy * dy < ERASE_R * ERASE_R) { hit = true; return false; }
        }
        return true;
      });
      if (hit) redraw();
    }
    function allowed(e) { return writeOn || e.pointerType === "pen" || e.pointerType === "mouse"; }

    cv.addEventListener("pointerdown", function (e) {
      if (!allowed(e) || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (x) { }
      var p = r4(pt(e));
      if (erase) { cur = { erasing: true, id: e.pointerId }; eraseAt(p); return; }
      cur = p.slice(); cur.id = e.pointerId; redraw();
    });
    cv.addEventListener("pointermove", function (e) {
      if (!cur || cur.id !== e.pointerId) return;
      var p = r4(pt(e));
      if (cur.erasing) { eraseAt(p); return; }
      cur.push(p[0], p[1]); redraw();
    });
    function end(e) {
      if (!cur || cur.id !== e.pointerId) return;
      var s = cur; cur = null;
      if (!s.erasing) data.s.push(Array.prototype.slice.call(s));
      changed();
    }
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", function (e) { if (cur && cur.id === e.pointerId) { cur = null; redraw(); } });
    cv.addEventListener("contextmenu", function (e) { if (writeOn) e.preventDefault(); });

    if (window.ResizeObserver) new ResizeObserver(function () { size(); }).observe(box); else window.addEventListener("resize", size);
    size();
  }

  function start() {
    var boxes = document.querySelectorAll(".nq-solve"), count = {};
    for (var i = 0; i < boxes.length; i++) {
      var card = boxes[i].closest(".sol-section"), id = (card && card.id) || "page";
      count[id] = (count[id] || 0) + 1;
      init(boxes[i], id + "-" + count[id]);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
