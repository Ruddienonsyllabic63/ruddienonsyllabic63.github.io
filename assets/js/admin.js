/* ==========================================================================
   관리 페이지 — 제출물 목록, 공개 범위 바꾸기, 삭제, CSV 내려받기
   권한 확인은 서버(Supabase)가 합니다. 이 화면은 보기 좋게 감싼 것뿐입니다.
   ========================================================================== */
(function () {
  const el = {
    loginSection: document.getElementById('login-section'),
    adminSection: document.getElementById('admin-section'),
    loginForm: document.getElementById('login-form'),
    loginMsg: document.getElementById('login-msg'),
    loginHint: document.getElementById('login-hint'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    who: document.getElementById('who'),
    logout: document.getElementById('logout'),
    filterCourse: document.getElementById('filter-course'),
    filterVis: document.getElementById('filter-vis'),
    filterText: document.getElementById('filter-text'),
    status: document.getElementById('admin-status'),
    works: document.getElementById('admin-works'),
    exportBtn: document.getElementById('export'),
  };

  let courses = [];
  let rows = [];

  el.loginHint.textContent = API.mode === 'demo'
    ? '데모 모드입니다. 아무 값이나 넣어도 관리 화면을 볼 수 있습니다.'
    : `Supabase 에 등록된 관리자 계정으로 로그인하세요 (${SITE_CONFIG.adminHint}).`;

  start();

  async function start() {
    try {
      courses = await API.listCourses();
      courses.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.title;
        el.filterCourse.appendChild(o);
      });
    } catch { /* 과목 정보가 없어도 목록은 볼 수 있습니다 */ }

    const admin = await API.currentAdmin().catch(() => null);
    if (admin) enterAdmin(admin);
  }

  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = el.loginForm.querySelector('button');
    btn.disabled = true;
    el.loginMsg.textContent = '';
    try {
      await API.signIn(el.email.value.trim(), el.password.value);
      const admin = await API.currentAdmin();
      if (!admin) throw new Error('이 계정에는 관리자 권한이 없습니다.');
      enterAdmin(admin);
    } catch (err) {
      el.loginMsg.textContent = err.message || '로그인에 실패했습니다.';
      el.loginMsg.style.color = 'var(--danger)';
    } finally {
      btn.disabled = false;
    }
  });

  el.logout.addEventListener('click', async () => {
    await API.signOut();
    location.reload();
  });

  function enterAdmin(admin) {
    el.loginSection.style.display = 'none';
    el.adminSection.style.display = '';
    el.who.textContent = `${admin.email || '관리자'} 로 로그인됨 · ${API.mode === 'demo' ? '데모 모드' : 'Supabase 연결됨'}`;
    initSettings();
    ActivitiesEditor.init();
    load();
  }

  /* ---------- 사이트 설정 ---------- */
  async function initSettings() {
    const box = document.getElementById('set-budget');
    const msg = document.getElementById('set-msg');
    if (!box) return;

    // 저장된 값이 없으면 projects.json 의 기본값을 따릅니다.
    let fallback = true;
    try {
      const pj = await fetch('data/projects.json').then((r) => r.json());
      fallback = pj.showBudget !== false;
    } catch { /* 기본값 유지 */ }

    const saved = await readSetting('showProjectBudget', null);
    box.checked = saved === null ? fallback : saved === true;

    if (API.mode === 'demo') {
      msg.textContent = '데모 모드에서는 이 브라우저에만 적용됩니다. Supabase 를 붙이면 모든 방문자에게 반영됩니다.';
      msg.style.color = '';
    }

    box.addEventListener('change', async () => {
      box.disabled = true;
      msg.style.color = '';
      msg.textContent = '저장 중…';
      try {
        await API.setSetting('showProjectBudget', box.checked);
        msg.textContent = box.checked
          ? '금액을 공개합니다. 연구 페이지를 새로 고치면 보입니다.'
          : '금액을 숨겼습니다. 연구 페이지를 새로 고치면 사라집니다.';
        msg.style.color = 'var(--ok)';
      } catch (err) {
        box.checked = !box.checked;
        msg.textContent = '저장하지 못했습니다: ' + (err.message || err);
        msg.style.color = 'var(--danger)';
      } finally {
        box.disabled = false;
      }
    });
  }

  async function load() {
    el.status.innerHTML = '<span class="spinner"></span> 불러오는 중…';
    try {
      rows = await API.listAll();
      paint();
    } catch (err) {
      el.status.textContent = '';
      el.works.innerHTML = `<div class="notice notice--danger" style="grid-column:1/-1">
        <strong>목록을 불러오지 못했습니다</strong>${esc(err.message || err)}</div>`;
    }
  }

  [el.filterCourse, el.filterVis].forEach((s) => s.addEventListener('change', paint));
  el.filterText.addEventListener('input', paint);

  function filtered() {
    const c = el.filterCourse.value;
    const v = el.filterVis.value;
    const q = el.filterText.value.trim().toLowerCase();
    return rows.filter((r) => {
      if (c && r.course_id !== c) return false;
      if (v && r.visibility !== v) return false;
      if (q && !(`${r.title} ${r.author_name} ${r.student_no || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function paint() {
    document.getElementById('stat-total').textContent = String(rows.length);
    document.getElementById('stat-public').textContent = String(rows.filter((r) => r.visibility === 'public').length);
    document.getElementById('stat-class').textContent = String(rows.filter((r) => r.visibility === 'class').length);

    const list = filtered();
    el.status.textContent = `${list.length}건 표시 중 (전체 ${rows.length}건)`;

    if (!list.length) {
      el.works.innerHTML = `<div class="empty" style="grid-column:1/-1">
        <div class="empty__icon">🗂️</div><p>조건에 맞는 제출물이 없습니다.</p></div>`;
      return;
    }

    const titleOf = (id) => (courses.find((c) => c.id === id) || {}).title || id;
    el.works.innerHTML = list
      .map((r) => workCard(r, { admin: true, courseTitle: titleOf(r.course_id) }))
      .join('');

    el.works.querySelectorAll('.vis-select').forEach((s) => {
      s.addEventListener('change', async () => {
        const id = s.dataset.id;
        s.disabled = true;
        try {
          await API.setVisibility(id, s.value);
          const row = rows.find((r) => r.id === id);
          if (row) row.visibility = s.value;
          paint();
        } catch (err) {
          alert('바꾸지 못했습니다: ' + (err.message || err));
          s.disabled = false;
        }
      });
    });

    el.works.querySelectorAll('.del-btn').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const row = rows.find((r) => r.id === id);
        if (!confirm(`"${row ? row.title : ''}" 을(를) 삭제할까요?\n올린 파일도 함께 지워지며 되돌릴 수 없습니다.`)) return;
        b.disabled = true;
        try {
          await API.removeSubmission(id);
          rows = rows.filter((r) => r.id !== id);
          paint();
        } catch (err) {
          alert('삭제하지 못했습니다: ' + (err.message || err));
          b.disabled = false;
        }
      });
    });
  }

  el.exportBtn.addEventListener('click', () => {
    const list = filtered();
    const head = ['과목', '제목', '이름', '학번', '설명', '공개범위', '파일명', '링크', '제출일시'];
    const titleOf = (id) => (courses.find((c) => c.id === id) || {}).title || id;
    const q = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const lines = [head.map(q).join(',')].concat(
      list.map((r) => [
        titleOf(r.course_id), r.title, r.author_name, r.student_no, r.description,
        r.visibility, r.file_name, r.link_url, r.created_at,
      ].map(q).join(','))
    );
    // 엑셀에서 한글이 깨지지 않도록 BOM 을 붙입니다.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `제출물_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
})();
