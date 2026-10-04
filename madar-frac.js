/*!
 * madar-frac.js — shows the model solutions on the exam pages with stacked (scientific) fractions.
 *
 * What it does: in every written solution ("sol-body") and every typed question ("q-text-body", "q-text-box", "q-text") it finds
 * formula text such as  "v² = GMe/r",  "r = (6.67×10⁻¹¹ × 6.0×10²⁴) / (4.0×10³)²",  "T = √(4π²r³/GM)"
 * and redraws every "a / b" as a fraction (a over b) and every "√( … )" with a root bar.
 *
 * How it reads the linear text (same rule used for the printed student files):
 *   - inside one bracket level the formula is cut at = ≈ ∝ ⟹ ⇒ → + − , ;
 *   - in each piece, everything before the first "/" is the numerator and everything after it is the denominator;
 *   - "(…) / (…)" drops the outer brackets;  x^(3/2) is a superscript;
 *   - unit slashes after a number ("3.0 m/s", "2.6×10² N/C", "9.8 m/s²") stay as written;
 *   - Arabic words are never touched ("نبضة/دقيقة", "و/أو" stay).
 * It only changes how the text is drawn; the text itself is not modified, so copy/paste still gives the original.
 */
(function () {
  "use strict";

  var SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺";
  // physical units only (so a variable such as "r" or "d" is never mistaken for a unit)
  var BASE = "(?:[kMGTmµμcn]?(?:m|s|g|C|N|J|V|A|T|K|W|F|H|Hz|Pa|L|mol|rad|eV|Ω)|min|h)";
  var UNIT = BASE + "[" + SUP + "]*";
  // a unit slash: "3.0 m/s", "2.6×10² N/C", "5000 V/m"  (number, then a space or directly, then unit / unit)
  var UNIT_NUM_END = new RegExp("(?:[0-9]\\s*|[" + SUP + ")\\]]\\s+)" + UNIT + "(?:[·⋅]" + UNIT + ")*$");
  var UNIT_DEN = new RegExp("^" + UNIT + "(?:[·⋅\\s]*" + UNIT + ")*\\.?$");
  // a chunk = a run of Latin letters, digits, Greek, maths symbols, brackets, super/subscripts (no Arabic letters)
  var CHUNK = /[A-Za-z0-9Ͱ-Ͽµ±×÷=+\-−<>%.\/()\[\]²³⁰¹⁴⁵⁶⁷⁸⁹⁻⁺₀₁₂₃₄₅₆₇₈₉ᴀ-ᶿₐ-₟√π≈∝⟹⇒→Δ∴∵≥≤°^:·⋅_,; ]+/g;
  var DELIM = { "=": 1, "≈": 1, "∝": 1, "⟹": 1, "⇒": 1, "→": 1, "+": 1, "−": 1, ",": 1, ";": 1, "≥": 1, "≤": 1, "<": 1, ">": 1 };
  var OPEN = { "(": ")", "[": "]" };

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function matching(s, i) { // s[i] is "(" or "[" -> index of its closer, or -1
    var d = 0, c;
    for (var k = i; k < s.length; k++) {
      c = s[k];
      if (c === "(" || c === "[") d++;
      else if (c === ")" || c === "]") { d--; if (d === 0) return k; }
    }
    return -1;
  }
  function stripWrap(s) {
    s = s.trim();
    while ((s[0] === "(" || s[0] === "[") && matching(s, 0) === s.length - 1) s = s.slice(1, -1).trim();
    return s;
  }
  function slashAt(s) { // first "/" at bracket depth 0
    var d = 0, c;
    for (var i = 0; i < s.length; i++) {
      c = s[i];
      if (c === "(" || c === "[") d++;
      else if (c === ")" || c === "]") d--;
      else if (c === "/" && d === 0) return i;
    }
    return -1;
  }

  function build(s) { // relation / plus / minus / comma pieces, fraction inside each piece
    var out = "", depth = 0, cur = "", ch;
    for (var i = 0; i < s.length; i++) {
      ch = s[i];
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      if (depth === 0 && DELIM[ch]) {
        out += term(cur) + "<span class=\"mop\">" + esc(ch === "," || ch === ";" ? ch + " " : " " + ch + " ") + "</span>";
        cur = "";
      } else cur += ch;
    }
    return out + term(cur);
  }
  // English words ("Variable Resistor / Rheostat", "Current/EMF") are alternatives in a sentence, not a division
  function prose(x) { return /[A-Za-z]{3,}s+[A-Za-z]{3,}/.test(x) || /^[A-Za-z]{5,}$/.test(x.trim()); }
  function term(t) {
    if (!t.trim()) return "";
    var k = slashAt(t);
    if (k > 0) {
      var left = t.slice(0, k), right = t.slice(k + 1);
      var den = stripWrap(right), num = stripWrap(left);
      var isUnit = UNIT_NUM_END.test(left.trim()) && UNIT_DEN.test(den);
      if (!isUnit && num && den && !prose(num) && !prose(den)) {
        return "<span class=\"mfrac\"><span class=\"mnum\">" + inline(num) + "</span><span class=\"mden\">" + inline(den) + "</span></span>";
      }
    }
    return inline(t);
  }
  function inline(s) {
    var out = "", buf = "", i, c, j;
    function flush() { if (buf) { out += esc(buf); buf = ""; } }
    for (i = 0; i < s.length; i++) {
      c = s[i];
      if (c === "(" || c === "[") {
        j = matching(s, i);
        if (j < 0) { buf += c; continue; }
        flush();
        out += esc(c) + build(s.slice(i + 1, j)) + esc(s[j]);
        i = j;
      } else if (c === "√") {
        flush();
        if (s[i + 1] === "(" || s[i + 1] === "[") {
          j = matching(s, i + 1);
          if (j < 0) { buf += c; continue; }
          out += "<span class=\"msqrt\"><span class=\"mrad\">√</span><span class=\"mrb\">" + build(s.slice(i + 2, j)) + "</span></span>";
          i = j;
        } else {
          j = i + 1; while (j < s.length && /[A-Za-z0-9.πͰ-Ͽ₀-₉]/.test(s[j])) j++;
          out += "<span class=\"msqrt\"><span class=\"mrad\">√</span><span class=\"mrb\">" + esc(s.slice(i + 1, j)) + "</span></span>";
          i = j - 1;
        }
      } else if (c === "^" && (s[i + 1] === "(" || s[i + 1] === "[")) {
        j = matching(s, i + 1);
        if (j < 0) { buf += c; continue; }
        flush();
        out += "<sup class=\"msup\">" + build(s.slice(i + 2, j)) + "</sup>";
        i = j;
      } else if (c === "_" && /[A-Za-z0-9]/.test(s[i + 1] || "")) {
        j = i + 1; while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j++;
        flush();
        out += "<sub class=\"msub\">" + esc(s.slice(i + 1, j)) + "</sub>";
        i = j - 1;
      } else buf += c;
    }
    flush();
    return out;
  }

  function cleanChunk(raw) {
    var s = raw.replace(/^[ .,;:·⋅\-=+<>%)\]]+/, "").replace(/[ ,;:·⋅]+$/, "");
    if (/[^.]\.$/.test(s)) s = s.slice(0, -1);
    s = s.replace(/[ ,;:·⋅]+$/, "");
    function bal(str, o, c) { var d = 0; for (var q = 0; q < str.length; q++) { if (str[q] === o) d++; else if (str[q] === c) d--; } return d; }
    var pairs = [["(", ")"], ["[", "]"]];
    for (var p = 0; p < pairs.length; p++) {
      var o = pairs[p][0], c = pairs[p][1], g = 0;
      while (g++ < 6 && bal(s, o, c) < 0 && s[s.length - 1] === c) s = s.slice(0, -1).replace(/[ ,;:·⋅]+$/, "");
      g = 0;
      while (g++ < 6 && bal(s, o, c) > 0 && s[0] === o) s = s.slice(1);
      g = 0;
      while (g++ < 6 && bal(s, o, c) > 0 && s[s.length - 1] === o) s = s.slice(0, -1).replace(/[ ,;:·⋅]+$/, "");
    }
    return s;
  }
  function wanted(c) { return /[\/√]/.test(c) && /[A-Za-z0-9Ͱ-Ͽ]/.test(c); }

  /** text -> html string with stacked fractions, or null when nothing in it needs redrawing */
  function convert(text) {
    var out = "", last = 0, changed = false, m, raw, c, start, end, html;
    CHUNK.lastIndex = 0;
    while ((m = CHUNK.exec(text))) {
      raw = m[0]; c = cleanChunk(raw);
      if (!c || !wanted(c)) continue;
      html = build(c);
      if (html.indexOf("<span class=\"mfrac\"") < 0 && html.indexOf("msqrt") < 0 && html.indexOf("msup") < 0) continue;
      start = m.index + raw.indexOf(c); end = start + c.length;
      out += esc(text.slice(last, start)) + "<span class=\"mmath\">" + html + "</span>";
      last = end; changed = true;
    }
    if (!changed) return null;
    return out + esc(text.slice(last));
  }

  var CSS = ".mmath{direction:ltr;unicode-bidi:isolate;display:inline-block;white-space:normal;text-align:left;font-family:'Cambria Math','STIX Two Math','Latin Modern Math','Times New Roman',serif;font-size:1.22em;line-height:1.5;margin:.15em 0}" +
    ".mop{padding:0 .1em}" +
    ".mfrac{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;margin:0 .22em;line-height:1.3}" +
    ".mfrac>.mnum{padding:0 .3em .06em;border-bottom:1.6px solid currentColor}.mfrac>.mden{padding:.06em .3em 0}" +
    ".msqrt{display:inline-flex;align-items:stretch;vertical-align:middle}.msqrt>.mrad{font-size:1.3em;line-height:1;margin-right:-.04em}" +
    ".msqrt>.mrb{border-top:1.6px solid currentColor;padding:0 .25em 0 .1em;margin-top:.12em}" +
    ".mfrac .mfrac,.msqrt .mfrac,.msup .mfrac{font-size:.9em}.msup{display:inline-block;vertical-align:.55em;font-size:.8em;line-height:1}.msub{font-size:.78em}";

  function run(root) {
    var scope = root || document;
    var boxes = scope.querySelectorAll(".sol-body, .q-text-body, .q-text-box, .q-text");
    var walker, node, nodes, i, html, holder, k;
    for (k = 0; k < boxes.length; k++) {
      if (boxes[k].getAttribute("data-mfrac")) continue;
      boxes[k].setAttribute("data-mfrac", "1");
      nodes = [];
      walker = document.createTreeWalker(boxes[k], NodeFilter.SHOW_TEXT, null, false);
      while ((node = walker.nextNode())) nodes.push(node);
      for (i = 0; i < nodes.length; i++) {
        if (nodes[i].parentNode.closest && nodes[i].parentNode.closest(".mmath")) continue;
        html = convert(nodes[i].nodeValue);
        if (html === null) continue;
        holder = document.createElement("span");
        holder.className = "mline";
        holder.innerHTML = html;
        nodes[i].parentNode.replaceChild(holder, nodes[i]);
      }
    }
  }
  function start() {
    if (!document.getElementById("madar-frac-css")) {
      var st = document.createElement("style"); st.id = "madar-frac-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    run(document);
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
    window.madarFrac = { run: run, convert: convert };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { convert: convert };
})();
