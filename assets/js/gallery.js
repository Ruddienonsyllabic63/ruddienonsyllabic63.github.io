/* ==========================================================================
   결과물 갤러리
   - 과목을 고르지 않으면: 모든 과목의 "모두 공개" 결과물
   - 과목을 고르면: 그 과목의 결과물 (수업 코드를 풀면 수업 공개까지)
   ========================================================================== */
(function () {
  const selectEl  = document.getElementById('course-select');
  const worksEl   = document.getElementById('works');
  const statusEl  = document.getElementById('status');
  const lockEl    = document.getElementById('lock-area');
  const lockBtn   = document.getElementById('lock-btn');
  const uploadEl  = document.getElementById('upload-link');

  let courses = [];
  let current = param('course');

  if (API.mode === 'demo') {
    const banner = document.getElementById('demo-banner');
    banner.style.display = '';
    document.getElementById('clear-demo').addEventListener('click', () => {
      if (confirm('이 브라우저에 저장된 데모 자료를 모두 지울까요?')) {
        API.clearDemo();
        location.reload();
      }
    });
  }

  init();

  async function init() {
    try {
      courses = await API.listCourses();
    } catch {
      statusEl.textContent = '과목 정보를 불러오지 못했습니다.';
      return;
    }

    courses.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = `${c.title} (${c.term})`;
      selectEl.appendChild(o);
    });

    if (current && courses.some((c) => c.id === current)) {
      selectEl.value = current;
    } else {
      current = '';
    }

    selectEl.addEventListener('change', () => {
      current = selectEl.value;
      const url = new URL(location.href);
      if (current) url.searchParams.set('course', current);
      else url.searchParams.delete('course');
      history.replaceState(null, '', url);
      load();
    });

    lockBtn.addEventListener('click', () => {
      API.lock(current);
      load();
    });

    load();
  }

  async function load() {
    lockEl.innerHTML = '';
    worksEl.innerHTML = '';
    statusEl.innerHTML = '<span class="spinner"></span> 불러오는 중…';

    uploadEl.href = current ? `upload.html?course=${encodeURIComponent(current)}` : 'upload.html';

    try {
      if (!current) {
        const rows = await API.listPublic();
        statusEl.textContent = rows.length
          ? `모두 공개된 결과물 ${rows.length}건`
          : '';
        lockBtn.style.display = 'none';
        renderRows(rows, true);
        return;
      }

      const course = courses.find((c) => c.id === current);
      const unlocked = API.isUnlocked(current);
      lockBtn.style.display = unlocked ? '' : 'none';

      const rows = await API.listSubmissions(current);
      statusEl.textContent = unlocked
        ? `${course.title} — 수업 코드로 열람 중 · ${rows.length}건`
        : `${course.title} — 모두 공개된 결과물만 보입니다 · ${rows.length}건`;

      if (!unlocked) renderLock(course);
      renderRows(rows, false);
    } catch (err) {
      statusEl.textContent = '';
      worksEl.innerHTML = '';
      lockEl.innerHTML = `<div class="notice notice--danger"><strong>불러오지 못했습니다</strong>${esc(err.message || err)}</div>`;
    }
  }

  function renderLock(course) {
    lockEl.innerHTML = `
      <div class="lock">
        <div class="lock__icon">🔐</div>
        <h2 style="font-size:1.15rem; margin-bottom:.4rem">수업 코드를 입력하세요</h2>
        <p class="small muted">${esc(course.title)} 수강생에게 안내된 코드를 넣으면
           수업 안에서만 공개된 결과물까지 볼 수 있습니다.</p>
        <form id="code-form" style="margin-top:1.2rem">
          <div class="field">
            <label class="sr-only" for="code">수업 코드</label>
            <input type="text" id="code" autocomplete="off" placeholder="수업 코드" required>
          </div>
          <button class="btn" type="submit" style="width:100%">열어 보기</button>
          <p class="small" id="code-msg" style="margin:.7rem 0 0; min-height:1.2em"></p>
        </form>
      </div>`;

    const form = document.getElementById('code-form');
    const msg = document.getElementById('code-msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true;
      msg.textContent = '';
      msg.className = 'small';
      try {
        const ok = await API.unlock(current, document.getElementById('code').value);
        if (ok) { load(); return; }
        msg.textContent = '코드가 맞지 않습니다. 다시 확인해 주세요.';
        msg.className = 'small';
        msg.style.color = 'var(--danger)';
      } catch (err) {
        msg.textContent = err.message || '확인 중 문제가 생겼습니다.';
        msg.style.color = 'var(--danger)';
      } finally {
        btn.disabled = false;
      }
    });
  }

  function renderRows(rows, showCourse) {
    if (!rows.length) {
      worksEl.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <div class="empty__icon">🗂️</div>
          <p>아직 올라온 결과물이 없습니다.</p>
          <a class="btn btn--ghost btn--sm" href="${esc(uploadEl.href)}">첫 번째로 올리기</a>
        </div>`;
      return;
    }
    const titleOf = (id) => (courses.find((c) => c.id === id) || {}).title || '';
    worksEl.innerHTML = rows
      .map((r) => workCard(r, { courseTitle: showCourse ? titleOf(r.course_id) : '' }))
      .join('');
  }
})();
