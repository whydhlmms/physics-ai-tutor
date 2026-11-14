/* =========================================================
   AI 智能答疑：本地知识引擎 + 可选大模型接口
   ========================================================= */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const scroll = $('#chatScroll');
  if (!scroll) return;

  const input = $('#chatInput');
  const sendBtn = $('#btnSend');
  const engineLabel = $('#engineLabel');
  const modeHint = $('#modeHint');
  const chapterBox = $('#aiChapters');
  const quickBox = $('#quickList');

  const CFG_KEY = 'phy_llm_config';
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) { cfg = null; }
  let pending = false;
  let streamTimers = [];
  let history = [];

  /* ---------------- 工具 ---------------- */
  const now = () => {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const chapterName = id => ((window.PHY.chapters.find(c => c.id === id)) || {}).name || '';

  function scrollBottom() {
    scroll.scrollTop = scroll.scrollHeight;
  }

  /* ---------------- 消息渲染 ---------------- */
  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = `<div class="msg-ava">我</div><div class="msg-body">${esc(text).replace(/\n/g, '<br>')}</div>`;
    scroll.appendChild(el);
    scrollBottom();
  }

  function addTyping() {
    const el = document.createElement('div');
    el.className = 'msg ai';
    el.id = 'typingMsg';
    el.innerHTML = `<div class="msg-ava">物</div>
      <div class="msg-body" style="padding:14px 18px;">
        <span class="typing"><i></i><i></i><i></i></span>
      </div>`;
    scroll.appendChild(el);
    scrollBottom();
    return el;
  }

  function answerShell(answer) {
    const body = document.createElement('div');
    body.className = 'msg ai';
    body.innerHTML = `
      <div class="msg-ava">物</div>
      <div class="msg-body">
        <div class="msg-meta"><b>物小理</b><span>·</span><span>${now()}</span><span>·</span><span>${esc(answer.tag || 'AI 助教')}</span></div>
        <h4 class="ai-title">${answer.title}</h4>
        <p class="ai-intro">${answer.intro}</p>
        <div class="step-list"></div>
        <div class="tail"></div>
      </div>`;
    scroll.appendChild(body);
    scrollBottom();
    return body;
  }

  function pushStep(stepList, step, index) {
    const div = document.createElement('div');
    div.className = 'step';
    div.innerHTML = `<span class="step-num">${String(index + 1).padStart(2, '0')}</span>
      <h5>${step.t}</h5>
      <p>${step.d || ''}</p>
      ${step.f ? `<div class="formula">${step.f}</div>` : ''}`;
    stepList.appendChild(div);
    scrollBottom();
  }

  function pushTail(tail, answer) {
    let html = '';
    if (answer.conclusion) {
      html += `<div class="ai-conclusion"><b>小结</b>　${answer.conclusion}</div>`;
    }
    if (answer.followups && answer.followups.length) {
      html += `<div class="followups">${answer.followups.map(q => `<button data-q="${esc(q)}">${q}</button>`).join('')}</div>`;
    }
    tail.innerHTML = html;
    $$('.followups button', tail).forEach(b => {
      b.addEventListener('click', () => ask(b.dataset.q));
    });
    scrollBottom();
  }

  function clearTimers() {
    streamTimers.forEach(t => clearTimeout(t));
    streamTimers = [];
  }

  function streamAnswer(answer) {
    clearTimers();
    const shell = answerShell(answer);
    const stepList = $('.step-list', shell);
    const tail = $('.tail', shell);
    const steps = answer.steps || [];
    steps.forEach((st, i) => {
      const t = setTimeout(() => pushStep(stepList, st, i), 120 + i * 300);
      streamTimers.push(t);
    });
    const t2 = setTimeout(() => {
      pushTail(tail, answer);
      pending = false;
      setBusy(false);
    }, 200 + steps.length * 300);
    streamTimers.push(t2);
  }

  function renderPlain(text, tag) {
    const body = document.createElement('div');
    body.className = 'msg ai';
    const html = esc(text)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<span class="formula" style="display:inline-block;margin:2px 0;white-space:normal">$1</span>')
      .replace(/\n{2,}/g, '</p><p class="ai-intro">')
      .replace(/\n/g, '<br>');
    body.innerHTML = `
      <div class="msg-ava">物</div>
      <div class="msg-body">
        <div class="msg-meta"><b>物小理</b><span>·</span><span>${now()}</span><span>·</span><span>${esc(tag || '大模型')}</span></div>
        <p class="ai-intro" style="margin-bottom:0;">${html}</p>
      </div>`;
    scroll.appendChild(body);
    scrollBottom();
  }

  /* ---------------- 本地知识引擎 ---------------- */
  function findMeta(q) {
    return window.PHY.meta.find(m => m.keys.some(k => q.includes(k)));
  }

  function findKb(q) {
    let best = null, bestScore = 0;
    window.PHY.kb.forEach(e => {
      let sc = 0;
      e.keys.forEach(k => {
        if (q.includes(k.toLowerCase())) sc += k.length >= 4 ? 3 : 2;
      });
      if (q.includes(e.title)) sc += 7;
      if (sc > bestScore) { bestScore = sc; best = e; }
    });
    return bestScore >= 3 ? best : null;
  }

  function detectChapter(q) {
    let hit = null, score = 0;
    window.PHY.chapters.forEach(ch => {
      let s = 0;
      if (q.includes(ch.name)) s += 6;
      ch.points.forEach(p => { if (q.includes(p)) s += 2; });
      if (s > score) { score = s; hit = ch; }
    });
    return score > 0 ? hit : null;
  }

  function chapterOverview(ch) {
    const kbs = window.PHY.kb.filter(k => k.ch === ch.id);
    const fs = window.PHY.formulas.filter(f => f.ch === ch.id).slice(0, 3);
    return {
      tag: '知识框架',
      title: `《${ch.name}》核心知识框架`,
      intro: ch.desc + '　下面按“主线概念 → 核心规律 → 高频考点”梳理，你可以顺着任意一条继续追问。',
      steps: [
        { t: '本章的知识主线', d: ch.points.join('　·　'), f: kbs.length ? '重点主题：' + kbs.map(k => k.title).join(' / ') : '' },
        { t: '必须掌握的公式', d: '这些公式是本章计算的骨架，注意各自的适用条件。', f: fs.map(f => f.name + '：' + f.expr).join('　|　') },
        { t: '高频易错点', d: '① 只记公式不看适用条件；② 矢量不分解直接代数相加；③ 忽略过程特征（等温/绝热/保守力）就套结论。' },
        { t: '建议的学习路径', d: '先用概念题确认理解，再做 2–3 道典型计算题，最后回到错题本核对同类题是否还会错。' }
      ],
      conclusion: `《${ch.name}》共 ${ch.points.length} 个核心知识块、${kbs.length} 个可追问主题。想从哪一个开始？`,
      followups: kbs.slice(0, 3).map(k => `讲讲${k.title}`)
    };
  }

  function studyPlan() {
    let wrong = [], hist = [];
    try { wrong = JSON.parse(localStorage.getItem('phy_wrongbook') || '[]'); } catch (e) {}
    try { hist = JSON.parse(localStorage.getItem('phy_quiz_history') || '[]'); } catch (e) {}

    if (!wrong.length && !hist.length) {
      return {
        tag: '学习建议',
        title: '先做一次测验，我才能“看见”你的薄弱点',
        intro: '目前还没有答题记录。用 5 道题做一次快速检验，我就能基于错题给出针对性的复习顺序。',
        steps: [
          { t: '做一次 5 题快速测验', d: '选择最没把握的章节，5 道题只需几分钟。' },
          { t: '把错题留在错题本', d: '提交后系统会自动归档，并按知识点统计。' },
          { t: '回来问我', d: '再次点击“分析我的薄弱点”，我会生成具体的复习清单。' }
        ],
        conclusion: '没有数据就没有诊断，先让练习发生。',
        followups: ['推荐一个复习顺序', '怎么开始一次测验？', '简谐振动的初相怎么判断？']
      };
    }

    const kpCount = {};
    wrong.forEach(w => { kpCount[w.kp] = (kpCount[w.kp] || 0) + (w.count || 1); });
    const top = Object.entries(kpCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const answered = hist.reduce((s, h) => s + (h.total || 0), 0);
    const correct = hist.reduce((s, h) => s + (h.correct || 0), 0);
    const rate = answered ? Math.round(correct / answered * 100) : 0;

    return {
      tag: '学习建议',
      title: '你的学情诊断：先补这三个知识点',
      intro: `你已完成 ${hist.length} 次测验、作答 ${answered} 题，总体正确率 ${rate}%。错题本中有 ${wrong.length} 道题，主要集中在以下知识点。`,
      steps: top.length ? top.map((t, i) => ({
        t: `优先级 ${i + 1}：${t[0]}`,
        d: `累计错误 ${t[1]} 次。建议先回到对应章节的公式与概念，再做同类题 2 道，最后用错题本「重做」验证是否真正掌握。`
      })) : [
        { t: '保持当前节奏', d: '错题较少，建议把练习重点放在综合题与跨章节模型上。' }
      ],
      conclusion: rate >= 85 ? '正确率已经不错，接下来重点是稳定性：限时训练 + 综合题。' :
        rate >= 60 ? '基础概念基本掌握，失分多来自“会但做不对”，建议加强规范书写与检验习惯。' :
        '建议先回到教材例题，逐题复述解题思路，再进入测验；不要在没理解的情况下反复刷题。',
      followups: ['帮我讲讲 ' + (top[0] ? top[0][0] : '力学基础'), '怎么高效使用错题本？', '推荐一个复习顺序']
    };
  }

  function genericAnswer(q) {
    const ch = detectChapter(q);
    if (ch) {
      const fs = window.PHY.formulas.filter(f => f.ch === ch.id).slice(0, 3);
      const kbs = window.PHY.kb.filter(k => k.ch === ch.id).slice(0, 3);
      return {
        tag: '解题框架',
        title: `这个问题属于《${ch.name}》，可以这样拆`,
        intro: '我还没有在知识库中找到完全匹配的条目，但可以给你一套通用的分析框架。把题目条件补充给我，我能讲得更具体。',
        steps: [
          { t: '确定研究对象与过程', d: '先问自己：研究的是哪个物体/系统？过程是瞬时、一段还是循环？不同过程对应不同规律。' },
          { t: '找出守恒量或约束', d: '优先检查动量、角动量、机械能、电荷、能量是否守恒；不守恒时回到牛顿定律或热一律。', f: fs[0] ? fs[0].name + '：' + fs[0].expr : '' },
          { t: '列方程并求未知量', d: '方程个数与未知量个数要匹配；矢量先分解再求和，标量直接代数运算。' },
          { t: '回到物理图像检验', d: '检查量纲、数量级与极限情形，看结果是否符合直觉。', f: fs[1] ? fs[1].name + '：' + fs[1].expr : '' }
        ],
        conclusion: '可以把完整题干发给我，或者告诉我你卡在哪一步，我会针对那一步展开。',
        followups: kbs.map(k => `讲讲${k.title}`).concat(['动量守恒和机械能守恒怎么区分？'])
      };
    }
    return {
      tag: 'AI 助教',
      title: '可以再具体一点吗？',
      intro: '我还不能确定你的问题指向哪个物理情境。补充下面任一信息，我就能给出分步讲解：',
      steps: [
        { t: '说明章节或关键词', d: '例如：力学 / 电磁感应 / 光的偏振 / 不确定关系。' },
        { t: '贴出题干或卡住的步骤', d: '例如：“这题用动量守恒列出 m₁v₁=(m₁+m₂)v 之后不知道怎么求热量。”' },
        { t: '说明你已尝试的思路', d: '我会指出思路在哪里断掉，而不是重新讲一遍。' }
      ],
      conclusion: '物理问题的关键，往往就差在“选哪个规律”这一步。告诉我情境，我们从这一步开始。',
      followups: ['帮我讲一道力学题', '电磁感应怎么判断方向？', '分析我的薄弱点']
    };
  }

  function localAnswer(q) {
    const text = q.toLowerCase();
    if (/薄弱|诊断|建议|复习计划|怎么复习|学情|分析我/.test(text)) return studyPlan();
    if (/梳理|框架|知识地图|思维导图|体系|大纲/.test(text) && detectChapter(q)) return chapterOverview(detectChapter(q));

    const meta = findMeta(text);
    if (meta) return { tag: '助教介绍', ...meta };

    const kb = findKb(text);
    if (kb) {
      return {
        tag: chapterName(kb.ch) + ' · 概念讲解',
        title: kb.title,
        intro: kb.intro,
        steps: kb.steps,
        conclusion: kb.conclusion,
        followups: kb.followups
      };
    }
    return genericAnswer(q);
  }

  /* ---------------- 大模型 ---------------- */
  async function llmAnswer(q) {
    const sys = '你是《大学物理》课程的 AI 助教，面向中国高校本科生。回答用中文，结构清晰：先一句话点明思路，再分步骤讲解（3-5 步），涉及公式时单独一行给出，最后用一句话小结并提醒易错点。不要编造数据，不确定时说明假设。控制在 500 字以内。';
    const messages = [{ role: 'system', content: sys }]
      .concat(history.slice(-6))
      .concat([{ role: 'user', content: q }]);

    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key
      },
      body: JSON.stringify({
        model: cfg.model || 'deepseek-chat',
        messages,
        temperature: 0.4,
        max_tokens: 900
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('empty response');
    return content.trim();
  }

  /* ---------------- 主流程 ---------------- */
  function setBusy(busy) {
    if (sendBtn) sendBtn.disabled = busy;
    if (input) input.disabled = busy;
  }

  async function ask(raw) {
    const q = String(raw || '').trim();
    if (!q || pending) return;

    pending = true;
    setBusy(true);
    clearTimers();
    addUser(q);
    history.push({ role: 'user', content: q });
    if (input) { input.value = ''; input.style.height = 'auto'; }
    const typing = addTyping();

    if (cfg && cfg.url && cfg.key) {
      try {
        const content = await llmAnswer(q);
        typing.remove();
        renderPlain(content, '大模型 · ' + (cfg.model || 'online'));
        history.push({ role: 'assistant', content });
        pending = false;
        setBusy(false);
        return;
      } catch (err) {
        typing.remove();
        window.toast('大模型接口调用失败，已切回本地知识引擎');
      }
    } else {
      await new Promise(r => setTimeout(r, 520));
      typing.remove();
    }

    const answer = localAnswer(q);
    streamAnswer(answer);
    history.push({ role: 'assistant', content: answer.title + '。' + (answer.conclusion || '') });
    if (history.length > 12) history = history.slice(-12);
  }

  window.Chat = { ask };

  /* ---------------- 界面初始化 ---------------- */
  function initSidebar() {
    if (chapterBox) {
      chapterBox.innerHTML = window.PHY.chapters.map(ch => `
        <button data-ch="${ch.id}">
          <span class="dot" style="--c:${ch.color}"></span>${ch.name}
          <small>${ch.idx}</small>
        </button>`).join('');
      chapterBox.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const ch = window.PHY.chapters.find(c => c.id === btn.dataset.ch);
        ask(`请系统梳理《${ch.name}》这一章的核心知识框架和常见易错点。`);
      });
    }
    const quick = [
      '动量守恒和机械能守恒怎么区分？',
      '简谐振动的初相怎么判断？',
      '卡诺循环效率是怎么推导的？',
      '高斯定理为什么只与面内电荷有关？',
      '增透膜厚度为什么是 λ/(4n)？',
      '光电效应为什么能证明光的粒子性？',
      '分析我的薄弱知识点'
    ];
    if (quickBox) {
      quickBox.innerHTML = quick.map(q => `<button data-q="${esc(q)}">${q}</button>`).join('');
      quickBox.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (btn) ask(btn.dataset.q);
      });
    }
  }

  function welcome() {
    addMessageStatic();
  }

  function addMessageStatic() {
    const el = document.createElement('div');
    el.className = 'msg ai';
    el.innerHTML = `
      <div class="msg-ava">物</div>
      <div class="msg-body">
        <div class="msg-meta"><b>物小理</b><span>·</span><span>${now()}</span><span>·</span><span>课程助教</span></div>
        <h4 class="ai-title">同学你好，我是《大学物理》AI 助教「物小理」</h4>
        <p class="ai-intro">
          我可以帮你梳理概念、拆解推导、讲解习题。回答会分步骤展开，你可以随时追问某一步。
          左侧按章节浏览，或直接描述你的问题。
        </p>
        <div class="ai-conclusion" style="margin-top:14px;">
          <b>试试问我</b>　“动量守恒和机械能守恒怎么区分？”“为什么增透膜厚度是 λ/4n？”“帮我分析薄弱知识点”
        </div>
        <div class="followups">
          <button data-q="动量守恒和机械能守恒怎么区分？">动量与能量守恒的区别</button>
          <button data-q="为什么增透膜厚度是 λ/4n？">增透膜厚度</button>
          <button data-q="分析我的薄弱知识点">分析我的薄弱点</button>
        </div>
      </div>`;
    scroll.appendChild(el);
    $$('.followups button', el).forEach(b => b.addEventListener('click', () => ask(b.dataset.q)));
  }

  /* ---------------- 事件 ---------------- */
  if (sendBtn) sendBtn.addEventListener('click', () => ask(input.value));
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ask(input.value);
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(120, input.scrollHeight) + 'px';
    });
  }

  const clearBtn = $('#btnClearChat');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearTimers();
      scroll.innerHTML = '';
      history = [];
      pending = false;
      setBusy(false);
      welcome();
      window.toast('对话已清空');
    });
  }

  /* ---------------- 模型设置 ---------------- */
  const modal = $('#modelModal');
  const btnModel = $('#btnModel');
  if (btnModel && modal) {
    btnModel.addEventListener('click', () => {
      $('#apiUrl').value = (cfg && cfg.url) || '';
      $('#apiModel').value = (cfg && cfg.model) || '';
      $('#apiKey').value = (cfg && cfg.key) || '';
      modal.classList.add('open');
    });
    $('#btnModelClose').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

    $('#btnModelSave').addEventListener('click', () => {
      const url = $('#apiUrl').value.trim();
      const model = $('#apiModel').value.trim();
      const key = $('#apiKey').value.trim();
      if (!url || !key) { window.toast('请填写接口地址与 API Key'); return; }
      cfg = { url, model, key };
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
      applyEngineLabel();
      modal.classList.remove('open');
      window.toast('已启用大模型接口');
    });

    $('#btnModelReset').addEventListener('click', () => {
      cfg = null;
      localStorage.removeItem(CFG_KEY);
      applyEngineLabel();
      modal.classList.remove('open');
      window.toast('已恢复本地知识引擎');
    });
  }

  function applyEngineLabel() {
    const online = !!(cfg && cfg.url && cfg.key);
    if (engineLabel) engineLabel.textContent = online ? '大模型 · ' + (cfg.model || 'online') : '本地知识引擎';
    if (modeHint) modeHint.textContent = online ? '已接入大模型 · 失败自动回退本地' : '本地知识引擎 · 离线可用';
  }

  initSidebar();
  applyEngineLabel();
  welcome();
})();
