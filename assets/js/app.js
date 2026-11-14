/* =========================================================
   主交互：导航 / 粒子背景 / 章节地图 / 公式速查 / 互动实验室
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const COLORS = ['#57D2F2', '#6A8DFF', '#A88BFF', '#F3C969', '#4BE3A8', '#FF8A7A'];

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  window.toast = function (msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
  };

  /* ---------------- 导航 ---------------- */
  const nav = $('#nav');
  const menu = $('#mobileMenu');
  const toggle = $('#navToggle');

  function onScrollNav() {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
    const links = $$('.nav-links a');
    let current = '';
    ['overview', 'philosophy', 'chapters', 'ai', 'quiz', 'wrongbook', 'formulas', 'lab', 'share'].forEach(id => {
      const sec = document.getElementById(id);
      if (sec && sec.getBoundingClientRect().top <= 140) current = id;
    });
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
  }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('a', menu).forEach(a => a.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------------- 滚动出现 ---------------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ---------------- Hero 粒子场 ---------------- */
  (function heroParticles() {
    const cv = $('#heroCanvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, dpr = 1;
    let pts = [];
    const mouse = { x: -999, y: -999 };

    function resize() {
      const rect = cv.parentElement.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width; h = rect.height;
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.max(34, Math.floor(w * h / 16000)));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.6 + 0.6
      }));
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dxm = p.x - mouse.x, dym = p.y - mouse.y;
        const dm = Math.hypot(dxm, dym);
        if (dm < 120) { p.x += dxm / dm * 0.6; p.y += dym / dm * 0.6; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(150,200,255,.55)';
        ctx.fill();

        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(110,160,230,' + (0.16 * (1 - d / 130)) + ')';
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    const hero = cv.parentElement;
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });

    resize();
    requestAnimationFrame(frame);
  })();

  /* ---------------- 章节地图 ---------------- */
  (function chapterMap() {
    const grid = $('#chapterGrid');
    if (!grid || !window.PHY) return;
    grid.innerHTML = window.PHY.chapters.map(ch => `
      <article class="chapter-card reveal" data-chapter="${ch.id}" style="--ch-color:${ch.color}">
        <div class="chapter-top">
          <div>
            <h3>${ch.name}</h3>
            <div class="en">${ch.en}</div>
          </div>
          <span class="chapter-idx">${ch.idx}</span>
        </div>
        <p>${ch.desc}</p>
        <div class="chapter-points">${ch.points.map(p => `<span>${p}</span>`).join('')}</div>
        <span class="chapter-ask">
          让助教梳理本章
          <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </article>
    `).join('');

    grid.addEventListener('click', e => {
      const card = e.target.closest('.chapter-card');
      if (!card) return;
      const id = card.dataset.chapter;
      const ch = window.PHY.chapters.find(c => c.id === id);
      if (!ch) return;
      document.getElementById('ai').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        if (window.Chat) window.Chat.ask(`请系统梳理《${ch.name}》这一章的核心知识框架和常见易错点。`);
      }, 480);
    });

    // 重新观察新插入的 reveal 元素
    if ('IntersectionObserver' in window) {
      const io2 = new IntersectionObserver(es => es.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('in'); io2.unobserve(en.target); }
      }), { threshold: 0.1 });
      $$('.reveal', grid).forEach(el => io2.observe(el));
    } else {
      $$('.reveal', grid).forEach(el => el.classList.add('in'));
    }
  })();

  /* ---------------- 公式速查 ---------------- */
  (function formulaIndex() {
    const grid = $('#formulaGrid');
    const chips = $('#formulaChips');
    const search = $('#formulaSearch');
    const empty = $('#formulaEmpty');
    if (!grid || !window.PHY) return;

    let chapter = 'all';
    let keyword = '';

    const chapterName = id => (window.PHY.chapters.find(c => c.id === id) || {}).name || '';

    function render() {
      const list = window.PHY.formulas.filter(f => {
        const okCh = chapter === 'all' || f.ch === chapter;
        const text = (f.name + f.expr + f.note + chapterName(f.ch)).toLowerCase();
        const okKw = !keyword || text.includes(keyword.toLowerCase());
        return okCh && okKw;
      });
      grid.innerHTML = list.map(f => `
        <div class="f-card">
          <div class="f-ch"><span>${chapterName(f.ch)}</span><span>${f.name}</span></div>
          <h5>${f.name}</h5>
          <div class="expr">${f.expr}</div>
          <p class="note">${f.note}</p>
        </div>
      `).join('');
      if (empty) empty.style.display = list.length ? 'none' : 'block';
    }

    if (chips) {
      chips.innerHTML = `<button class="chip on" data-ch="all">全部</button>` +
        window.PHY.chapters.map(c => `<button class="chip" data-ch="${c.id}">${c.name}</button>`).join('');
      chips.addEventListener('click', e => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        $$('.chip', chips).forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        chapter = btn.dataset.ch;
        render();
      });
    }

    if (search) {
      search.addEventListener('input', () => { keyword = search.value.trim(); render(); });
    }

    render();
  })();

  /* ---------------- 互动实验室 ---------------- */
  (function lab() {
    const cv = $('#labCanvas');
    const tabs = $('#labTabs');
    const controlsBox = $('#labControls');
    const readout = $('#labReadout');
    if (!cv || !tabs) return;

    const W = 820, H = 420;
    const ctx = cv.getContext('2d');
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const C = {
      cyan: '#57D2F2', blue: '#6A8DFF', violet: '#A88BFF',
      gold: '#F3C969', green: '#4BE3A8', ink: '#EAF1FC',
      muted: '#8DA0BC', grid: 'rgba(129,165,219,.12)', dim: '#5D6E87'
    };

    function label(text, x, y, color, size, align) {
      ctx.fillStyle = color || C.muted;
      ctx.font = (size || 12) + 'px "Cascadia Code", Consolas, monospace';
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    }
    function line(x1, y1, x2, y2, color, width) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width || 1;
      ctx.stroke();
    }
    function dot(x, y, r, color, glow) {
      if (glow) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        g.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ',.45)'));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 7); ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fillStyle = color;
      ctx.fill();
    }
    function rr(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    /* ---------- 简谐振动 ---------- */
    const shm = {
      title: '简谐振动', 
      note: '弹簧振子：位移 x=Acos(ωt+φ)。周期 T=2π√(m/k)，与振幅无关——这是简谐振动最重要的性质之一。',
      controls: [
        { key: 'A', label: '振幅 A', min: 20, max: 110, step: 1, value: 70, unit: 'px' },
        { key: 'w', label: '角频率 ω', min: 0.6, max: 3.2, step: 0.1, value: 1.6, unit: 'rad/s' }
      ],
      init(s) { s.t = 0; s.hist = []; },
      draw(s, dt) {
        s.t += dt;
        const cx = 430, cy = 150, A = s.A, w = s.w;
        const x = A * Math.cos(w * s.t);
        const v = -A * w * Math.sin(w * s.t);
        const a = -w * w * x;

        line(60, cy, 780, cy, C.grid, 1);
        line(60, cy - 130, 60, cy + 130, 'rgba(129,165,219,.35)', 2);
        for (let i = -120; i <= 120; i += 30) line(60, cy + i, 70, cy + i, 'rgba(129,165,219,.25)', 1);

        // 弹簧
        const massX = cx + x, massW = 58;
        const springEnd = massX - massW / 2;
        const coils = 12, total = springEnd - 72;
        ctx.beginPath();
        ctx.moveTo(72, cy);
        for (let i = 0; i <= coils * 2; i++) {
          const px = 72 + total * (i / (coils * 2));
          const py = cy + (i % 2 === 0 ? -1 : 1) * 17;
          ctx.lineTo(px, py);
        }
        ctx.lineTo(springEnd, cy);
        ctx.strokeStyle = 'rgba(140,170,220,.7)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 平衡位置虚线
        ctx.setLineDash([4, 6]);
        line(cx, cy - 110, cx, cy + 110, 'rgba(87,210,242,.35)', 1);
        ctx.setLineDash([]);

        // 物块
        const g = ctx.createLinearGradient(massX - massW / 2, cy - 28, massX + massW / 2, cy + 28);
        g.addColorStop(0, '#2A4A6E'); g.addColorStop(1, '#16304A');
        ctx.fillStyle = g;
        ctx.strokeStyle = C.cyan;
        ctx.lineWidth = 1.4;
        rr(massX - massW / 2, cy - 28, massW, 56, 8);
        ctx.fill(); ctx.stroke();
        label('m', massX, cy, '#CFEFFF', 15, 'center');

        // 位移标尺
        line(cx, cy + 96, massX, cy + 96, 'rgba(243,201,105,.55)', 1.4);
        label('x = ' + x.toFixed(1), (cx + massX) / 2, cy + 112, C.gold, 12, 'center');

        // x-t 曲线
        const gx = 90, gy = 300, gw = 640, gh = 84;
        line(gx, gy, gx + gw, gy, 'rgba(129,165,219,.25)', 1);
        line(gx, gy - gh / 2, gx, gy + gh / 2, 'rgba(129,165,219,.25)', 1);
        s.hist.push(x);
        if (s.hist.length > gw) s.hist.shift();
        ctx.beginPath();
        s.hist.forEach((val, i) => {
          const px = gx + i, py = gy - val * (gh / 2) / 110;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        });
        ctx.strokeStyle = C.cyan;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        label('x–t 振动图像', gx, gy - gh / 2 - 14, C.dim, 11);

        // 数据
        readout.innerHTML =
          `位移 <b>${x.toFixed(1)}</b> px　速度 <b>${v.toFixed(1)}</b> px/s　` +
          `加速度 <b>${a.toFixed(1)}</b> px/s²　周期 <b>${(2 * Math.PI / w).toFixed(2)}</b> s`;
      }
    };

    /* ---------- 行波 / 驻波 ---------- */
    const wave = {
      title: '行波与驻波',
      note: '两列等幅反向传播的波叠加形成驻波：波节处始终静止，相邻波节间距 λ/2，驻波不传播能量。',
      controls: [
        { key: 'lam', label: '波长 λ', min: 70, max: 300, step: 5, value: 180, unit: 'px' },
        { key: 'f', label: '频率 f', min: 0.15, max: 1.2, step: 0.05, value: 0.5, unit: 'Hz' },
        { key: 'amp', label: '振幅 A', min: 10, max: 60, step: 2, value: 38, unit: 'px' },
        { key: 'stand', label: '驻波模式', type: 'toggle', value: 1 }
      ],
      init(s) { s.t = 0; },
      draw(s, dt) {
        s.t += dt;
        const x0 = 60, x1 = 760, mid = 120, amp = s.amp;
        const k = 2 * Math.PI / s.lam, w = 2 * Math.PI * s.f;

        // 参考轴
        line(x0, mid, x1, mid, C.grid, 1);
        line(x0, 320, x1, 320, 'rgba(129,165,219,.16)', 1);

        const ys = [], ys2 = [];
        for (let x = x0; x <= x1; x += 3) {
          const ph = k * (x - x0);
          const y1 = Math.sin(ph - w * s.t);
          const y2 = Math.sin(ph + w * s.t);
          ys.push({ x, y1, y2 });
          ys2.push({ x, y: (y1 + y2) });
        }

        if (s.stand) {
          // 驻波包络
          ctx.beginPath();
          ys.forEach((p, i) => {
            const y = mid - amp * p.y1;
            i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y);
          });
          ctx.strokeStyle = 'rgba(106,141,255,.35)';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // 合成波
          ctx.beginPath();
          ys2.forEach((p, i) => {
            const y = mid - amp * p.y;
            i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y);
          });
          ctx.strokeStyle = C.cyan;
          ctx.lineWidth = 2.4;
          ctx.stroke();

          // 波节
          for (let x = x0; x <= x1; x += s.lam / 2) {
            const y = mid - amp * (Math.sin(k * (x - x0) - w * s.t) + Math.sin(k * (x - x0) + w * s.t));
            dot(x, mid, 3.2, 'rgba(243,201,105,.9)');
            if (Math.abs(y - mid) > 0.6) dot(x, y, 2.4, 'rgba(255,138,122,.75)');
          }
          label('波节', x0 + 4, mid + 56, 'rgba(243,201,105,.9)', 11);
          label('驻波：波形不移动，能量不传播', x1, 60, C.muted, 12, 'right');
        } else {
          ctx.beginPath();
          ys.forEach((p, i) => {
            const y = mid - amp * p.y1;
            i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y);
          });
          ctx.strokeStyle = C.cyan;
          ctx.lineWidth = 2.4;
          ctx.stroke();

          // 传播方向箭头
          const ax = 400, ay = 62;
          line(ax - 40, ay, ax + 40, ay, 'rgba(87,210,242,.5)', 1.4);
          line(ax + 40, ay, ax + 30, ay - 5, 'rgba(87,210,242,.5)', 1.4);
          line(ax + 40, ay, ax + 30, ay + 5, 'rgba(87,210,242,.5)', 1.4);
          label('传播方向 →', ax + 52, ay, C.muted, 12);
          label('行波：波形整体平移', x1, 60, C.muted, 12, 'right');

          // 两个质点的振动
          [0.25, 0.5].forEach((f, i) => {
            const px = x0 + s.lam * f;
            dot(px, mid, 4, i ? C.violet : C.gold);
            label(i ? 'P₂' : 'P₁', px, mid - 22, i ? C.violet : C.gold, 11, 'center');
          });
        }

        // 波长标注
        const yb = 350;
        line(x0, yb, x0 + s.lam, yb, 'rgba(243,201,105,.6)', 1);
        line(x0, yb - 6, x0, yb + 6, 'rgba(243,201,105,.6)', 1);
        line(x0 + s.lam, yb - 6, x0 + s.lam, yb + 6, 'rgba(243,201,105,.6)', 1);
        label('λ = ' + s.lam + ' px', x0 + s.lam / 2, yb - 14, C.gold, 11, 'center');

        readout.innerHTML =
          `波长 <b>${s.lam}</b> px　频率 <b>${s.f.toFixed(2)}</b> Hz　` +
          `波速 <b>${(s.lam * s.f).toFixed(1)}</b> px/s　` +
          `模式 <b>${s.stand ? '驻波' : '行波'}</b>`;
      }
    };

    /* ---------- 洛伦兹力 ---------- */
    const lorentz = {
      title: '带电粒子在匀强磁场中',
      note: '洛伦兹力 F=qv×B 始终垂直于速度，不做功。粒子在垂直磁场的平面内作匀速圆周运动，半径 r=mv/(qB)，周期与速率无关。',
      controls: [
        { key: 'B', label: '磁感应强度 B', min: 0.4, max: 3, step: 0.1, value: 1.2, unit: 'T' },
        { key: 'v', label: '速率 v', min: 0.4, max: 2.4, step: 0.1, value: 1.2, unit: '×10⁶ m/s' },
        { key: 'q', label: '电荷符号', type: 'toggle', value: 1 }
      ],
      init(s) {
        s.ang = 0;
        s.trail = [];
        s.time = 0;
      },
      draw(s, dt) {
        const cx = 430, cy = 205;
        const R = 55 + (s.v / s.B) * 60;
        const omega = (s.v / s.B) * 0.9;
        s.time += dt;
        s.ang += (s.q > 0 ? -1 : 1) * omega * dt * 2.2;

        // 磁场符号：垂直纸面向里
        ctx.save();
        for (let x = 80; x <= 760; x += 56) {
          for (let y = 60; y <= 370; y += 54) {
            ctx.beginPath();
            ctx.arc(x, y, 4.6, 0, 7);
            ctx.strokeStyle = 'rgba(129,165,219,.18)';
            ctx.lineWidth = 1;
            ctx.stroke();
            line(x - 3, y - 3, x + 3, y + 3, 'rgba(129,165,219,.18)', 1);
            line(x + 3, y - 3, x - 3, y + 3, 'rgba(129,165,219,.18)', 1);
          }
        }
        ctx.restore();

        const px = cx + R * Math.cos(s.ang);
        const py = cy + R * Math.sin(s.ang);

        // 轨迹圆
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 7);
        ctx.setLineDash([3, 7]);
        ctx.strokeStyle = 'rgba(87,210,242,.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // 粒子拖尾
        s.trail.push({ x: px, y: py });
        if (s.trail.length > 120) s.trail.shift();
        s.trail.forEach((p, i) => {
          const a = i / s.trail.length;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.8, 0, 7);
          ctx.fillStyle = 'rgba(87,210,242,' + (a * 0.5) + ')';
          ctx.fill();
        });

        // 速度矢量
        const vdir = { x: -Math.sin(s.ang), y: Math.cos(s.ang) };
        const sign = s.q > 0 ? 1 : -1;
        const vx = vdir.x * 62 * sign, vy = vdir.y * 62 * sign;
        line(px, py, px + vx, py + vy, C.gold, 2);
        // 洛伦兹力（指向圆心）
        const fx = (cx - px), fy = (cy - py);
        const fm = Math.hypot(fx, fy) || 1;
        line(px, py, px + fx / fm * 52, py + fy / fm * 52, C.violet, 2);

        dot(px, py, 7, s.q > 0 ? '#FF8A7A' : '#57D2F2', true);
        label(s.q > 0 ? '+' : '−', px, py - 0.5, '#06101F', 12, 'center');
        dot(cx, cy, 3, 'rgba(129,165,219,.5)');

        label('v', px + vx * 1.15, py + vy * 1.15, C.gold, 12, 'center');
        label('F', px + fx / fm * 64, py + fy / fm * 64, C.violet, 12, 'center');
        label('B ⊗ 垂直纸面向里', 80, 34, C.muted, 12);

        readout.innerHTML =
          `回旋半径 <b>${R.toFixed(0)}</b> px　周期 <b>${(2 * Math.PI / (omega * 2.2)).toFixed(2)}</b> s　` +
          `电荷 <b>${s.q > 0 ? '正电荷' : '负电荷'}</b>　洛伦兹力 <b>不做功</b>`;
      }
    };

    /* ---------- 双缝干涉 ---------- */
    function wl2rgb(nm) {
      let r = 0, g = 0, b = 0;
      if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
      else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
      else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
      else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
      else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
      else { r = 1; }
      return 'rgb(' + Math.round(r * 255) + ',' + Math.round(g * 255) + ',' + Math.round(b * 255) + ')';
    }
    const doubleSlit = {
      title: '杨氏双缝干涉',
      note: '条纹间距 Δx=λD/d。增大波长、增大屏距或减小缝距，条纹都会变疏——拖动参数验证一下。',
      controls: [
        { key: 'lam', label: '波长 λ', min: 400, max: 700, step: 5, value: 550, unit: 'nm' },
        { key: 'd', label: '缝间距 d', min: 0.15, max: 0.6, step: 0.01, value: 0.3, unit: 'mm' },
        { key: 'L', label: '屏距 D', min: 0.8, max: 2.4, step: 0.1, value: 1.4, unit: 'm' }
      ],
      init() {},
      draw(s) {
        const color = wl2rgb(s.lam);
        const dx = s.lam * 1e-9 * s.L / (s.d * 1e-3); // 米
        const dxMM = dx * 1000;

        // 双缝
        const sx = 170, sy = 205;
        line(sx, 50, sx, 165, 'rgba(140,170,220,.6)', 3);
        line(sx, 245, sx, 360, 'rgba(140,170,220,.6)', 3);
        line(sx, 165, sx, 180, C.cyan, 5);
        line(sx, 230, sx, 245, C.cyan, 5);
        label('S₁', sx - 22, 172, C.cyan, 11, 'center');
        label('S₂', sx - 22, 238, C.cyan, 11, 'center');

        // 光线
        const screenX = 700;
        [1, -1].forEach(sgn => {
          ctx.beginPath();
          ctx.moveTo(sx, 172.5 + (sgn === 1 ? 0 : 65));
          ctx.lineTo(screenX, 205 + sgn * 90);
          ctx.strokeStyle = 'rgba(129,165,219,.18)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // 光屏
        ctx.fillStyle = 'rgba(8,14,26,.9)';
        ctx.fillRect(screenX, 40, 76, 330);
        ctx.strokeStyle = 'rgba(129,165,219,.3)';
        ctx.strokeRect(screenX, 40, 76, 330);

        // 条纹：I = cos²(π d x /(λ L))，把屏幕像素映射到 x
        const mapK = 0.00042 * (0.3 / s.d) * (1.4 / s.L) * (550 / s.lam);
        for (let y = 40; y < 370; y += 1) {
          const xm = (y - 205) * 0.9;
          const I = Math.pow(Math.cos(Math.PI * xm * mapK * 3.6), 2);
          if (I > 0.02) {
            ctx.globalAlpha = I * 0.95;
            ctx.fillStyle = color;
            ctx.fillRect(screenX + 4, y, 68, 1);
          }
        }
        ctx.globalAlpha = 1;
        label('屏', screenX + 38, 26, C.muted, 11, 'center');

        // 标注中央明纹
        line(screenX + 84, 205, screenX + 106, 205, 'rgba(243,201,105,.7)', 1);
        label('中央明纹', screenX + 112, 205, C.gold, 11);

        // 参数示意
        label('d = ' + s.d.toFixed(2) + ' mm', 90, 392, C.dim, 11);
        label('D = ' + s.L.toFixed(1) + ' m', 250, 392, C.dim, 11);
        label('λ = ' + s.lam + ' nm', 380, 392, C.dim, 11);

        readout.innerHTML =
          `条纹间距 Δx <b>${dxMM.toFixed(2)}</b> mm　波长 <b>${s.lam}</b> nm　` +
          `缝距 <b>${s.d.toFixed(2)}</b> mm　屏距 <b>${s.L.toFixed(1)}</b> m`;
      }
    };

    const labs = { shm, wave, lorentz, double: doubleSlit };
    let current = 'shm';
    let state = {};
    let last = performance.now();

    function applyDefaults(cfg) {
      const s = {};
      cfg.controls.forEach(c => { s[c.key] = c.value; });
      cfg.init(s);
      return s;
    }

    function renderControls(cfg, s) {
      controlsBox.innerHTML = `<h5>${cfg.title}</h5><p>拖动滑块，观察图像变化</p>` +
        cfg.controls.map(c => {
          if (c.type === 'toggle') {
            return `<div class="ctrl">
              <label>${c.label}<b>${s[c.key] ? '开' : '关'}</b></label>
              <div class="chip-grid" style="margin-top:8px;">
                <button class="chip ${s[c.key] ? 'on' : ''}" data-toggle="${c.key}" data-val="1">开启</button>
                <button class="chip ${!s[c.key] ? 'on' : ''}" data-toggle="${c.key}" data-val="0">关闭</button>
              </div></div>`;
          }
          return `<div class="ctrl">
            <label>${c.label}<b>${s[c.key]}${c.unit ? ' ' + c.unit : ''}</b></label>
            <input type="range" data-key="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}" value="${s[c.key]}">
          </div>`;
        }).join('') +
        `<div class="lab-note">${cfg.note}</div>`;

      $$('input[type=range]', controlsBox).forEach(inp => {
        inp.addEventListener('input', () => {
          s[inp.dataset.key] = parseFloat(inp.value);
          const lab = labs[current];
          const ctrl = lab.controls.find(c => c.key === inp.dataset.key);
          inp.parentElement.querySelector('label b').textContent = inp.value + (ctrl && ctrl.unit ? ' ' + ctrl.unit : '');
          if (current === 'shm' || current === 'wave' || current === 'lorentz' || current === 'double') {
            drawOnce();
          }
        });
      });
      $$('[data-toggle]', controlsBox).forEach(btn => {
        btn.addEventListener('click', () => {
          s[btn.dataset.toggle] = parseInt(btn.dataset.val, 10);
          renderControls(cfg, s);
          drawOnce();
        });
      });
    }

    function drawOnce() {
      ctx.clearRect(0, 0, W, H);
      // 背景网格
      for (let x = 0; x <= W; x += 40) line(x, 0, x, H, 'rgba(129,165,219,.045)', 1);
      for (let y = 0; y <= H; y += 40) line(0, y, W, 0 + y, 'rgba(129,165,219,.045)', 1);
      labs[current].draw(state, 0);
    }

    function switchLab(key) {
      current = key;
      const cfg = labs[key];
      state = applyDefaults(cfg);
      renderControls(cfg, state);
      ctx.clearRect(0, 0, W, H);
      drawOnce();
    }

    tabs.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      $$('button', tabs).forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      switchLab(btn.dataset.lab);
    });

    switchLab('shm');

    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        ctx.clearRect(0, 0, W, H);
        for (let x = 0; x <= W; x += 40) line(x, 0, x, H, 'rgba(129,165,219,.045)', 1);
        for (let y = 0; y <= H; y += 40) line(0, y, W, y, 'rgba(129,165,219,.045)', 1);
        labs[current].draw(state, dt);
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();

  /* ---------------- 分享 / 数据导出 ---------------- */
  (function share() {
    const urlEl = $('#siteUrl');
    const url = urlEl ? urlEl.textContent.trim() : location.href;
    const copyBtn = $('#btnCopyLink');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
          window.toast('链接已复制');
        } catch (err) {
          window.toast('复制失败，请手动选择链接');
        }
      });
    }
    const openBtn = $('#btnOpenSite');
    if (openBtn) {
      openBtn.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
    }
    const expBtn = $('#btnExportData');
    if (expBtn) {
      expBtn.addEventListener('click', () => {
        const data = {
          exportedAt: new Date().toISOString(),
          quizHistory: JSON.parse(localStorage.getItem('phy_quiz_history') || '[]'),
          wrongbook: JSON.parse(localStorage.getItem('phy_wrongbook') || '[]')
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '大学物理学习记录.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        window.toast('学习数据已导出');
      });
    }
    const qr = $('#qrImg');
    if (qr) {
      qr.addEventListener('error', () => {
        qr.style.display = 'none';
        qr.parentElement.innerHTML = '<div style="width:156px;height:156px;display:grid;place-items:center;color:#0B1322;font-size:12px;text-align:center;line-height:1.6;">二维码加载失败<br>请直接使用左侧链接</div>';
      });
    }
  })();

  /* ---------------- 数字滚动（首屏统计） ---------------- */
  (function counters() {
    const items = $$('.hero-stats div strong');
    if (!items.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target;
        const raw = el.textContent.trim();
        const m = raw.match(/^([\d.]+)(.*)$/);
        if (!m) return;
        const target = parseFloat(m[1]);
        const suffix = m[2] || '';
        const dur = 1200;
        const t0 = performance.now();
        function step(t) {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          const val = target < 10 ? (target * eased).toFixed(0) : Math.round(target * eased);
          el.textContent = val + suffix;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = raw;
        }
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    items.forEach(el => io.observe(el));
  })();

})();
