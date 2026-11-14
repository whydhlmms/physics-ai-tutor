/* =========================================================
   智能测验 + 错题本 + 学情图表
   ========================================================= */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const setupEl = $('#quizSetup');
  if (!setupEl || !window.PHY) return;

  const QS = window.PHY.questions;
  const CHS = window.PHY.chapters;
  const COLOR = {};
  CHS.forEach(c => { COLOR[c.id] = c.color; });
  const chName = id => (CHS.find(c => c.id === id) || {}).name || '综合';
  const LETTER = ['A', 'B', 'C', 'D', 'E'];
  const KEY_WRONG = 'phy_wrongbook';
  const KEY_HIST = 'phy_quiz_history';

  /* ---------------- 存储 ---------------- */
  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  const getWrong = () => load(KEY_WRONG, []);
  const getHist = () => load(KEY_HIST, []);

  /* ---------------- 组卷状态 ---------------- */
  const state = {
    chapter: 'all',
    type: 'all',
    count: 8,
    list: [],
    answers: [],
    idx: 0,
    startAt: 0,
    timer: null,
    mode: 'normal'
  };

  /* ---------------- 组卷界面 ---------------- */
  const chapterChips = $('#quizChapters');
  if (chapterChips) {
    chapterChips.innerHTML = `<button class="chip on" data-ch="all">全部章节</button>` +
      CHS.map(c => `<button class="chip" data-ch="${c.id}">${c.name}</button>`).join('');
    chapterChips.addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      $$('.chip', chapterChips).forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      state.chapter = b.dataset.ch;
      updateMeta();
    });
  }
  const typeBox = $('#quizTypes');
  if (typeBox) {
    typeBox.addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      $$('.chip', typeBox).forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      state.type = b.dataset.type;
      updateMeta();
    });
  }
  const countBox = $('#quizCounts');
  if (countBox) {
    countBox.addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      $$('.chip', countBox).forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      state.count = parseInt(b.dataset.count, 10);
      updateMeta();
    });
  }

  function pool() {
    return QS.filter(q =>
      (state.chapter === 'all' || q.ch === state.chapter) &&
      (state.type === 'all' || q.type === state.type)
    );
  }
  function updateMeta() {
    const n = pool().length;
    const meta = $('#quizMeta');
    if (meta) meta.innerHTML = `当前范围可用题目 <b>${n}</b> 道 · 将抽取 <b>${Math.min(state.count, n)}</b> 道`;
  }
  updateMeta();

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------------- 开始 / 退出 ---------------- */
  function startQuiz(list, mode) {
    state.mode = mode || 'normal';
    state.list = list || shuffle(pool()).slice(0, Math.min(state.count, pool().length));
    if (!state.list.length) { window.toast('当前范围没有可用题目'); return; }
    state.answers = new Array(state.list.length).fill(-1);
    state.idx = 0;
    state.startAt = Date.now();
    $('#quizSetup').classList.add('off');
    $('#quizPlay').classList.add('on');
    $('#quizResult').classList.remove('on');
    startTimer();
    renderQuestion();
    document.getElementById('quiz').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const startBtn = $('#btnStartQuiz');
  if (startBtn) startBtn.addEventListener('click', () => startQuiz());

  const quitBtn = $('#btnQuitQuiz');
  if (quitBtn) quitBtn.addEventListener('click', () => {
    if (!confirm('退出后本次答题记录不会保存，确定退出吗？')) return;
    stopTimer();
    $('#quizPlay').classList.remove('on');
    $('#quizSetup').classList.remove('off');
  });

  /* ---------------- 计时 ---------------- */
  function startTimer() {
    stopTimer();
    const el = $('#qTimer');
    state.timer = setInterval(() => {
      const s = Math.floor((Date.now() - state.startAt) / 1000);
      if (el) el.textContent = fmt(s);
    }, 1000);
    if (el) el.textContent = '00:00';
  }
  function stopTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }
  function fmt(sec) {
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }

  /* ---------------- 答题渲染 ---------------- */
  function renderQuestion() {
    const i = state.idx;
    const q = state.list[i];
    const total = state.list.length;
    if (!q) return;

    const pct = Math.round(((i + 1) / total) * 100);
    $('#qProgressText').textContent = `第 ${i + 1} / ${total} 题`;
    $('#qProgressPct').textContent = pct + '%';
    $('#qProgressBar').style.width = pct + '%';

    $('#qTags').innerHTML = `
      <span class="tag" style="color:${COLOR[q.ch] || '#57D2F2'};border-color:${COLOR[q.ch] || '#57D2F2'}40;background:${COLOR[q.ch] || '#57D2F2'}14">${chName(q.ch)}</span>
      <span class="tag violet">${q.type === 'single' ? '单选题' : '判断题'}</span>
      <span class="tag gold">${q.kp}</span>`;

    $('#qText').textContent = q.q;

    const opts = $('#qOptions');
    opts.innerHTML = q.opts.map((o, k) => `
      <button class="opt ${state.answers[i] === k ? 'sel' : ''}" data-k="${k}">
        <span class="key">${LETTER[k]}</span>
        <span>${o}</span>
      </button>`).join('');

    $$('.opt', opts).forEach(btn => {
      btn.addEventListener('click', () => {
        state.answers[i] = parseInt(btn.dataset.k, 10);
        $$('.opt', opts).forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
        renderDots();
      });
    });

    $('#btnPrevQ').disabled = i === 0;
    $('#btnNextQ').disabled = i === total - 1;
    $('#btnNextQ').style.opacity = i === total - 1 ? '.4' : '1';
    renderDots();
  }

  function renderDots() {
    const box = $('#qDots');
    if (!box) return;
    box.innerHTML = state.list.map((q, i) => {
      const cls = i === state.idx ? 'cur' : (state.answers[i] >= 0 ? 'done' : '');
      return `<button class="q-dot ${cls}" data-i="${i}">${i + 1}</button>`;
    }).join('');
    $$('.q-dot', box).forEach(b => b.addEventListener('click', () => {
      state.idx = parseInt(b.dataset.i, 10);
      renderQuestion();
    }));
  }

  const prevBtn = $('#btnPrevQ');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (state.idx > 0) { state.idx--; renderQuestion(); }
  });
  const nextBtn = $('#btnNextQ');
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (state.idx < state.list.length - 1) { state.idx++; renderQuestion(); }
  });

  /* ---------------- 提交批改 ---------------- */
  const submitBtn = $('#btnSubmitQuiz');
  if (submitBtn) submitBtn.addEventListener('click', submit);

  function submit() {
    const unanswered = state.answers.filter(a => a < 0).length;
    if (unanswered > 0) {
      if (!confirm(`还有 ${unanswered} 道题未作答，未作答将按错误计分。确定提交吗？`)) return;
    }
    stopTimer();
    const duration = Math.floor((Date.now() - state.startAt) / 1000);
    const items = state.list.map((q, i) => ({
      qid: q.id,
      ch: q.ch,
      kp: q.kp,
      chosen: state.answers[i],
      ok: state.answers[i] === q.a
    }));
    const correct = items.filter(x => x.ok).length;
    const score = Math.round(correct / items.length * 100);

    recordResult(items, duration, score);

    $('#quizPlay').classList.remove('on');
    $('#quizResult').classList.add('on');
    renderResult(items, score, correct, duration);
    $('#quizShell').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function recordResult(items, duration, score) {
    // 历史
    const hist = getHist();
    hist.unshift({
      ts: Date.now(),
      chapter: state.chapter,
      label: state.chapter === 'all' ? '综合' : chName(state.chapter),
      total: items.length,
      correct: items.filter(i => i.ok).length,
      score,
      duration
    });
    save(KEY_HIST, hist.slice(0, 40));

    // 错题本
    const wrong = getWrong();
    items.forEach(it => {
      const pos = wrong.findIndex(w => w.qid === it.qid);
      if (it.ok) {
        if (pos >= 0) wrong.splice(pos, 1); // 答对即视为掌握，移出错题本
      } else {
        if (pos >= 0) {
          wrong[pos].count = (wrong[pos].count || 1) + 1;
          wrong[pos].last = Date.now();
        } else {
          wrong.push({ qid: it.qid, ch: it.ch, kp: it.kp, count: 1, last: Date.now() });
        }
      }
    });
    save(KEY_WRONG, wrong);
    renderWrongbook();
  }

  function renderResult(items, score, correct, duration) {
    const wrong = items.length - correct;
    $('#scoreNum').textContent = score;
    const arc = $('#scoreArc');
    const C = 2 * Math.PI * 52;
    arc.style.strokeDashoffset = String(C);
    arc.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)';
    setTimeout(() => { arc.style.strokeDashoffset = String(C * (1 - score / 100)); }, 80);

    let title, comment;
    if (score >= 90) { title = '优秀 · 掌握扎实'; comment = '知识理解准确、判断稳定。建议把练习重点转向综合题与限时训练，保持手感。'; }
    else if (score >= 75) { title = '良好 · 基本到位'; comment = '主干知识已经掌握，失分多在细节与边界条件。逐条看解析，把“差一点”的地方补上。'; }
    else if (score >= 60) { title = '及格 · 需要巩固'; comment = '概念能识别但应用不稳。建议回到教材对应小节的例题，先复述思路再做同类题。'; }
    else { title = '需要加强 · 从基础开始'; comment = '当前更合适的学习方式是“少而透”：每章只挑 2 个核心模型，先看讲解再做题。'; }

    $('#resultTitle').textContent = title;
    $('#resultComment').textContent = comment;
    $('#statCorrect').textContent = correct;
    $('#statWrong').textContent = wrong;
    $('#statRate').textContent = Math.round(correct / items.length * 100) + '%';
    $('#statTime').textContent = fmt(duration);

    const box = $('#reviewList');
    box.innerHTML = items.map((it, i) => {
      const q = QS.find(x => x.id === it.qid);
      if (!q) return '';
      const chosenText = it.chosen >= 0 ? `${LETTER[it.chosen]}. ${q.opts[it.chosen]}` : '未作答';
      return `<div class="review-item ${it.ok ? 'ok' : 'no'}">
        <div class="ri-top">
          <span class="badge ${it.ok ? 'ok' : 'no'}">${it.ok ? '正确' : '错误'}</span>
          <span>第 ${i + 1} 题</span><span>·</span><span>${chName(q.ch)}</span><span>·</span><span>${q.kp}</span>
        </div>
        <h5>${q.q}</h5>
        <div class="ri-answers">
          <span>你的作答：<b class="${it.ok ? 'good' : 'bad'}">${chosenText}</b></span>
          <span>正确答案：<b class="good">${LETTER[q.a]}. ${q.opts[q.a]}</b></span>
        </div>
        <div class="ri-ex"><b>解析</b>　${q.ex}</div>
        <div class="followups" style="margin-top:12px;">
          <button data-ask="${encodeURIComponent(q.q + ' 请分步骤讲解这道题。')}">让助教讲解这道题</button>
          <button data-ask="${encodeURIComponent('请讲讲「' + q.kp + '」这个知识点，并给我一个易错提醒。')}">复习相关知识点</button>
        </div>
      </div>`;
    }).join('');

    $$('.followups button', box).forEach(b => {
      b.addEventListener('click', () => {
        const text = decodeURIComponent(b.dataset.ask);
        document.getElementById('ai').scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => window.Chat && window.Chat.ask(text), 460);
      });
    });
  }

  const retryBtn = $('#btnRetryQuiz');
  if (retryBtn) retryBtn.addEventListener('click', () => {
    $('#quizResult').classList.remove('on');
    $('#quizSetup').classList.remove('off');
    updateMeta();
  });
  const goWrong = $('#btnGoWrong');
  if (goWrong) goWrong.addEventListener('click', () => {
    document.getElementById('wrongbook').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------------- 错题本 ---------------- */
  function renderWrongbook() {
    const wrong = getWrong();
    const hist = getHist();
    const answered = hist.reduce((s, h) => s + (h.total || 0), 0);
    const correct = hist.reduce((s, h) => s + (h.correct || 0), 0);
    const rate = answered ? Math.round(correct / answered * 100) : null;

    const kpMap = {};
    wrong.forEach(w => { kpMap[w.kp] = (kpMap[w.kp] || 0) + (w.count || 1); });
    const weakSorted = Object.entries(kpMap).sort((a, b) => b[1] - a[1]);

    $('#wbTotal').textContent = wrong.length;
    $('#wbAnswered').textContent = answered;
    $('#wbRate').textContent = rate === null ? '—' : rate + '%';
    $('#wbWeak').textContent = weakSorted.length ? weakSorted[0][0] : '—';

    drawWeakChart(weakSorted.slice(0, 6));
    drawChapterChart(wrong);
    renderAdvice(wrong, hist, weakSorted, rate);
    renderWrongList(wrong);
  }

  /* ---------------- 图表 ---------------- */
  function fit(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 320;
    const h = cv.clientHeight || 200;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawWeakChart(data) {
    const cv = $('#chartWeak');
    if (!cv) return;
    const { ctx, w, h } = fit(cv);
    ctx.textBaseline = 'middle';

    if (!data.length) {
      ctx.fillStyle = 'rgba(129,165,219,.4)';
      ctx.font = '12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无错题数据，完成一次测验后自动生成', w / 2, h / 2);
      return;
    }

    const top = Math.max(1, data[0][1]);
    const labelW = 92, padR = 38, topPad = 8;
    const rowH = Math.min(34, (h - topPad * 2) / data.length);
    const barH = Math.min(13, rowH * 0.44);
    const maxW = w - labelW - padR;

    data.forEach(([label, val], i) => {
      const y = topPad + i * rowH + rowH / 2;
      ctx.fillStyle = '#8DA0BC';
      ctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'right';
      const short = label.length > 7 ? label.slice(0, 7) + '…' : label;
      ctx.fillText(short, labelW - 10, y);

      ctx.fillStyle = 'rgba(129,165,219,.09)';
      roundRect(ctx, labelW, y - barH / 2, maxW, barH, barH / 2);
      ctx.fill();

      const bw = Math.max(6, maxW * (val / top));
      const g = ctx.createLinearGradient(labelW, 0, labelW + bw, 0);
      g.addColorStop(0, '#57D2F2');
      g.addColorStop(1, '#6A8DFF');
      ctx.fillStyle = g;
      roundRect(ctx, labelW, y - barH / 2, bw, barH, barH / 2);
      ctx.fill();

      ctx.fillStyle = '#BFE6FF';
      ctx.font = '11.5px "Cascadia Code", Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(val + ' 次', labelW + bw + 8, y);
    });
  }

  function drawChapterChart(wrong) {
    const cv = $('#chartChapter');
    if (!cv) return;
    const { ctx, w, h } = fit(cv);

    const map = {};
    wrong.forEach(x => { map[x.ch] = (map[x.ch] || 0) + 1; });
    const entries = CHS.map(c => ({ id: c.id, name: c.name, color: c.color, value: map[c.id] || 0 }))
      .filter(x => x.value > 0);
    const total = entries.reduce((s, x) => s + x.value, 0);

    if (!total) {
      ctx.strokeStyle = 'rgba(129,165,219,.18)';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(129,165,219,.4)';
      ctx.font = '12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('暂无错题', w / 2, h / 2);
      return;
    }

    const cx = Math.min(w * 0.34, 110);
    const cy = h / 2;
    const R = Math.min(w * 0.26, h * 0.34);
    const thick = Math.max(12, R * 0.34);
    let ang = -Math.PI / 2;

    entries.forEach(e => {
      const sweep = (e.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, ang + 0.012, ang + sweep - 0.012);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = thick;
      ctx.lineCap = 'round';
      ctx.stroke();
      ang += sweep;
    });

    ctx.fillStyle = '#EAF1FC';
    ctx.font = '600 22px "Palatino Linotype", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - 5);
    ctx.fillStyle = '#64758F';
    ctx.font = '10px "Cascadia Code", monospace';
    ctx.fillText('错题', cx, cy + 17);

    // 图例
    const lx = cx + R + 26;
    const rowH = Math.min(24, (h - 20) / entries.length);
    let ly = (h - entries.length * rowH) / 2 + rowH / 2;
    ctx.textAlign = 'left';
    entries.forEach(e => {
      ctx.beginPath();
      ctx.arc(lx + 4, ly, 4, 0, 7);
      ctx.fillStyle = e.color;
      ctx.fill();
      ctx.fillStyle = '#94A5BF';
      ctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.fillText(e.name, lx + 15, ly);
      ctx.fillStyle = '#64758F';
      ctx.font = '11px "Cascadia Code", monospace';
      ctx.fillText(e.value + '', lx + 84, ly);
      ly += rowH;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- 学习建议 ---------------- */
  function renderAdvice(wrong, hist, weak, rate) {
    const box = $('#adviceList');
    if (!box) return;
    const items = [];

    if (!wrong.length && !hist.length) {
      items.push({ n: '01', html: '还没有练习记录。<b>先做一次 5 题快速测验</b>，错题会自动归档，我才能基于数据给出复习顺序。' });
      items.push({ n: '02', html: '建议按“力学 → 振动与波动 → 热学 → 电磁学 → 光学 → 近代物理”的顺序推进，前后章节的数学工具是递进的。' });
      items.push({ n: '03', html: '每个知识点做到“<b>能复述思路</b>”再刷题，比连做十道同类型题更有效。' });
    } else if (!wrong.length) {
      items.push({ n: '01', html: `错题本已清空，累计正确率 <b>${rate}%</b>。保持节奏，把练习难度提升到综合题与限时训练。` });
      items.push({ n: '02', html: '可以尝试 12 题强化训练，检验长时间专注下的稳定性。' });
      items.push({ n: '03', html: '把“会做”变成“讲得清”：用 AI 答疑复述一遍解题思路，能有效暴露隐藏的理解漏洞。' });
    } else {
      const top = weak.slice(0, 2);
      if (top[0]) items.push({ n: '01', html: `优先复习 <b>${top[0][0]}</b>：已累计错误 ${top[0][1]} 次。先回看该知识点的公式与适用条件，再重做对应错题。` });
      if (top[1]) items.push({ n: '02', html: `其次是 <b>${top[1][0]}</b>（错误 ${top[1][1]} 次）。同类错误往往来自同一个前提被忽略，逐条对照解析找共性。` });
      if (rate !== null && rate < 60) {
        items.push({ n: '03', html: `当前正确率 <b>${rate}%</b>，建议降低刷题速度：每道错题都用自己的话写一遍“错在哪一步”，再点「重做」验证。` });
      } else if (rate !== null && rate < 85) {
        items.push({ n: '03', html: `正确率 <b>${rate}%</b> 已具备基础，建议把错题按知识点归类，一次性重做同类题 2–3 道，形成稳定迁移。` });
      } else {
        items.push({ n: '03', html: `正确率 <b>${rate}%</b> 表现良好。用错题本做“间隔复习”：今天、3 天后、一周后各重做一次。` });
      }
    }

    box.innerHTML = items.map(it => `<div class="advice${it.n === '02' ? ' gold' : ''}"><span class="n">${it.n}</span><span>${it.html}</span></div>`).join('');
  }

  /* ---------------- 错题清单 ---------------- */
  function renderWrongList(wrong) {
    const box = $('#wrongList');
    if (!box) return;
    if (!wrong.length) {
      box.innerHTML = `<div class="empty">
        <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <p>错题本还是空的</p>
        <small>完成一次测验后，答错的题目会自动出现在这里</small>
      </div>`;
      $('#btnRedoAll').style.display = 'none';
      $('#btnClearWrong').style.display = 'none';
      return;
    }
    $('#btnRedoAll').style.display = '';
    $('#btnClearWrong').style.display = '';

    box.innerHTML = wrong.map(w => {
      const q = QS.find(x => x.id === w.qid);
      if (!q) return '';
      return `<div class="wrong-item" data-qid="${w.qid}">
        <div class="wi-body">
          <h5>${q.q}</h5>
          <div class="wi-meta">
            <span style="color:${COLOR[q.ch]}">${chName(q.ch)}</span>
            <span>·</span><span>${q.kp}</span>
            <span>·</span><span>累计错 <b>${w.count || 1}</b> 次</span>
            <span>·</span><span>正确答案 <b>${LETTER[q.a]}</b></span>
          </div>
          <div class="ri-ex" style="margin-top:10px;"><b>解析</b>　${q.ex}</div>
        </div>
        <div class="wi-actions">
          <button data-act="redo">重做</button>
          <button data-act="ask">问助教</button>
          <button data-act="del" class="del">移除</button>
        </div>
      </div>`;
    }).join('');

    $$('.wrong-item', box).forEach(item => {
      const qid = item.dataset.qid;
      const q = QS.find(x => x.id === qid);
      $$('button', item).forEach(b => {
        b.addEventListener('click', () => {
          const act = b.dataset.act;
          if (act === 'redo') startQuiz([q], 'redo');
          if (act === 'ask') {
            document.getElementById('ai').scrollIntoView({ behavior: 'smooth' });
            setTimeout(() => window.Chat && window.Chat.ask(`${q.q} 请分步骤讲解这道题。`), 460);
          }
          if (act === 'del') {
            const wrong = getWrong().filter(x => x.qid !== qid);
            save(KEY_WRONG, wrong);
            renderWrongbook();
            window.toast('已从错题本移除');
          }
        });
      });
    });
  }

  const redoAll = $('#btnRedoAll');
  if (redoAll) redoAll.addEventListener('click', () => {
    const list = getWrong().map(w => QS.find(q => q.id === w.qid)).filter(Boolean);
    if (!list.length) { window.toast('错题本为空'); return; }
    startQuiz(shuffle(list), 'redo');
    window.toast(`已生成 ${list.length} 道错题的专项练习`);
  });

  const clearWrong = $('#btnClearWrong');
  if (clearWrong) clearWrong.addEventListener('click', () => {
    if (!confirm('确定清空错题本吗？该操作不可恢复。')) return;
    save(KEY_WRONG, []);
    renderWrongbook();
    window.toast('错题本已清空');
  });

  /* ---------------- 响应式重绘 ---------------- */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const wrong = getWrong();
      const kpMap = {};
      wrong.forEach(w => { kpMap[w.kp] = (kpMap[w.kp] || 0) + (w.count || 1); });
      drawWeakChart(Object.entries(kpMap).sort((a, b) => b[1] - a[1]).slice(0, 6));
      drawChapterChart(wrong);
    }, 180);
  });

  /* ---------------- 初始化 ---------------- */
  renderWrongbook();
})();
