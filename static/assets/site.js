(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  // Görsel büyütme
  document.querySelectorAll('.prose figure img').forEach(function (img) {
    img.addEventListener('click', function () {
      var lb = el('div', 'lightbox'); lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'Görsel büyütme');
      var big = el('img'); big.src = img.currentSrc || img.src; big.alt = img.alt; lb.appendChild(big);
      lb.addEventListener('click', function () { lb.remove(); });
      document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', k); } });
      document.body.appendChild(lb);
    });
  });

  // Kontrol listeleri (işaretler yalnızca bu tarayıcıda, sayfa açıkken tutulur)
  document.querySelectorAll('.prose li > input[type="checkbox"]').forEach(function (cb) {
    var li = cb.parentElement; cb.removeAttribute('disabled'); li.classList.add('task');
    if (li.parentElement) li.parentElement.classList.add('tasks');
    cb.setAttribute('aria-label', li.textContent.trim());
    function sync() { li.classList.toggle('done', cb.checked); }
    cb.addEventListener('change', sync);
    li.addEventListener('click', function (e) { if (e.target !== cb && !e.target.closest('a,button')) { cb.checked = !cb.checked; sync(); } });
  });

  // Kaynak numaralarını kaynak listesine bağla
  function jump(n) {
    var det = document.getElementById('refs'); if (det) det.open = true;
    var li = document.getElementById('ref-' + n); if (!li) return;
    li.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    li.classList.add('flash'); setTimeout(function () { li.classList.remove('flash'); }, 2200);
  }
  document.querySelectorAll('.prose[data-cites="1"]').forEach(function (root) {
    var re = /\[(\d+(?:\s*[–\-,]\s*\d+)*)\]/g, walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) { var n = walker.currentNode; re.lastIndex = 0; if (re.test(n.nodeValue) && !n.parentElement.closest('code,a')) nodes.push(n); }
    nodes.forEach(function (n) {
      var s = n.nodeValue, frag = document.createDocumentFragment(), last = 0, m; re.lastIndex = 0;
      while ((m = re.exec(s))) {
        frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        var b = el('button', 'cite', m[0]); b.type = 'button'; b.title = 'Kaynağa git';
        (function (first) { b.addEventListener('click', function () { jump(first); }); })(parseInt(m[1], 10));
        frag.appendChild(b); last = m.index + m[0].length;
      }
      frag.appendChild(document.createTextNode(s.slice(last))); n.parentNode.replaceChild(frag, n);
    });
  });

  // İçindekiler
  var toc = document.querySelector('.toc'), prose = document.querySelector('article .prose:not(.hero-video)');
  if (toc && prose) {
    var hs = prose.querySelectorAll('h2');
    if (hs.length > 2) {
      toc.appendChild(el('b', null, 'İçindekiler'));
      hs.forEach(function (h, k) {
        h.id = h.id || 'b-' + (k + 1);
        var a = el('a', 'toclink', h.textContent); a.href = '#' + h.id;
        a.addEventListener('click', function (e) { e.preventDefault(); h.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); history.replaceState(null, '', '#' + h.id); });
        toc.appendChild(a);
      });
    }
  }
})();
