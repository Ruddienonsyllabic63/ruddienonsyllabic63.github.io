/* ==========================================================================
   관리 페이지 — 소개 페이지의 수상 · 학회 활동 · 공공 위원 · 자격 편집

   저장하면 Supabase 의 site_settings('activities') 에 들어가고,
   소개 페이지는 그 값을 data/activities.json 보다 먼저 읽습니다.
   (Supabase 를 아직 안 붙였으면 이 브라우저에만 저장됩니다.)
   ========================================================================== */

const ActivitiesEditor = (() => {
  let DATA = null;       // 지금 편집 중인 내용
  let SAVED = null;      // 마지막으로 저장된(또는 불러온) 내용 — 되돌리기용

  const el = {};

  /** 저장된 값이 있으면 그것을, 없으면 파일의 기본값을 씁니다. */
  async function loadActivities() {
    const saved = await readSetting('activities', null);
    if (saved && typeof saved === 'object') return saved;
    return fetch('data/activities.json', { cache: 'no-cache' }).then((r) => r.json());
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  async function init() {
    ['act-awards', 'act-societies', 'act-committees', 'act-certs',
     'act-msg', 'act-save', 'act-download', 'act-reset'].forEach((id) => {
      el[id] = document.getElementById(id);
    });
    if (!el['act-awards']) return;   // 편집 칸이 없는 페이지

    try {
      DATA = await loadActivities();
    } catch {
      say('내용을 불러오지 못했습니다.', 'danger');
      return;
    }
    DATA.awards ||= [];
    DATA.societies ||= [];
    DATA.committees ||= [];
    DATA.certifications ||= [];
    SAVED = clone(DATA);

    render();

    document.querySelectorAll('[data-add]').forEach((b) => {
      b.addEventListener('click', () => add(b.dataset.add));
    });
    el['act-save'].addEventListener('click', save);
    el['act-download'].addEventListener('click', download);
    el['act-reset'].addEventListener('click', reset);
  }

  function say(text, kind) {
    el['act-msg'].textContent = text;
    el['act-msg'].style.color =
      kind === 'ok' ? 'var(--ok)' : kind === 'danger' ? 'var(--danger)' : '';
  }

  function dirty() { return JSON.stringify(DATA) !== JSON.stringify(SAVED); }

  function markDirty() {
    if (dirty()) say('고친 내용이 있습니다. 저장을 눌러 주세요.', '');
  }

  /* ---------- 그리기 ---------- */

  function render() {
    renderAwards();
    renderActs('societies', el['act-societies']);
    renderActs('committees', el['act-committees']);
    renderCerts();

    document.getElementById('cnt-awards').textContent = `${DATA.awards.length}건`;
    document.getElementById('cnt-societies').textContent = `${DATA.societies.length}건`;
    document.getElementById('cnt-committees').textContent = `${DATA.committees.length}건`;
    document.getElementById('cnt-certs').textContent =
      `${DATA.certifications.reduce((n, g) => n + (g.items || []).length, 0)}개`;
  }

  /** 입력칸 하나 만들기 — 고치면 곧바로 DATA 에 반영됩니다. */
  function field(list, index, key, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = list[index][key] ?? '';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    input.addEventListener('input', () => {
      list[index][key] = input.value;
      markDirty();
    });
    return input;
  }

  function delButton(list, index) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'editrow__del';
    b.title = '이 줄 삭제';
    b.setAttribute('aria-label', '이 줄 삭제');
    b.textContent = '✕';
    b.addEventListener('click', () => {
      const name = list[index].title || list[index].org || list[index].group || '이 항목';
      if (!confirm(`"${name}" 을(를) 목록에서 지울까요?\n저장을 눌러야 실제로 반영됩니다.`)) return;
      list.splice(index, 1);
      render();
      markDirty();
    });
    return b;
  }

  function renderAwards() {
    const box = el['act-awards'];
    box.innerHTML = '';
    DATA.awards.forEach((_, i) => {
      const row = document.createElement('div');
      row.className = 'editrow editrow--award';
      row.append(
        field(DATA.awards, i, 'year', '연도'),
        field(DATA.awards, i, 'title', '상 이름'),
        field(DATA.awards, i, 'org', '주는 곳'),
        field(DATA.awards, i, 'note', '설명 (선택)'),
        delButton(DATA.awards, i),
      );
      box.appendChild(row);
    });
    if (!DATA.awards.length) box.innerHTML = '<p class="small muted">아직 없습니다.</p>';
  }

  function renderActs(key, box) {
    const list = DATA[key];
    box.innerHTML = '';
    list.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'editrow editrow--act';

      const chk = document.createElement('label');
      chk.className = 'chk';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.current === true;
      cb.addEventListener('change', () => {
        if (cb.checked) item.current = true; else delete item.current;
        markDirty();
      });
      chk.append(cb, document.createTextNode('현재'));

      row.append(
        field(list, i, 'org', '기관·학회 이름'),
        field(list, i, 'role', '맡은 일'),
        field(list, i, 'period', '기간 (예: 2025 — 2026)'),
        chk,
        delButton(list, i),
      );
      box.appendChild(row);
    });
    if (!list.length) box.innerHTML = '<p class="small muted">아직 없습니다.</p>';
  }

  function renderCerts() {
    const box = el['act-certs'];
    box.innerHTML = '';
    DATA.certifications.forEach((g, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'edit-cert';

      const head = document.createElement('div');
      head.className = 'row';
      head.style.marginBottom = '.4rem';
      const name = field(DATA.certifications, i, 'group', '묶음 이름 (예: 교원·사서)');
      name.style.maxWidth = '220px';
      head.append(name, delButton(DATA.certifications, i));

      const ta = document.createElement('textarea');
      ta.value = (g.items || []).join('\n');
      ta.placeholder = '한 줄에 자격 하나씩';
      ta.setAttribute('aria-label', '자격 목록');
      ta.addEventListener('input', () => {
        g.items = ta.value.split('\n').map((s) => s.trim()).filter(Boolean);
        markDirty();
      });

      wrap.append(head, ta);
      box.appendChild(wrap);
    });
    if (!DATA.certifications.length) box.innerHTML = '<p class="small muted">아직 없습니다.</p>';
  }

  /* ---------- 추가 · 저장 · 내려받기 ---------- */

  function add(key) {
    if (key === 'awards') DATA.awards.unshift({ year: '', title: '', org: '', note: '' });
    else if (key === 'certifications') DATA.certifications.push({ group: '', items: [] });
    else DATA[key].push({ org: '', role: '', period: '' });
    render();
    markDirty();

    // 새로 생긴 줄의 첫 칸으로 바로 갑니다.
    const boxId = key === 'certifications' ? 'act-certs' : `act-${key}`;
    const inputs = el[boxId].querySelectorAll('input[type="text"], textarea');
    const target = key === 'awards' ? inputs[0] : inputs[inputs.length - (key === 'certifications' ? 2 : 3)];
    if (target) target.focus();
  }

  function tidy(o) {
    // 빈 줄은 저장하지 않습니다.
    const out = clone(o);
    out.awards = out.awards.filter((x) => x.title || x.org);
    out.societies = out.societies.filter((x) => x.org || x.role);
    out.committees = out.committees.filter((x) => x.org || x.role);
    out.certifications = out.certifications.filter((g) => g.group || (g.items || []).length);
    return out;
  }

  async function save() {
    const payload = tidy(DATA);
    el['act-save'].disabled = true;
    say('저장 중…', '');
    try {
      await API.setSetting('activities', payload);
      DATA = payload;
      SAVED = clone(payload);
      render();
      say(API.mode === 'demo'
        ? '저장했습니다. (데모 모드라 이 브라우저에서만 보입니다)'
        : '저장했습니다. 소개 페이지를 새로 고치면 바뀐 내용이 보입니다.', 'ok');
    } catch (err) {
      say('저장하지 못했습니다: ' + (err.message || err), 'danger');
    } finally {
      el['act-save'].disabled = false;
    }
  }

  function reset() {
    if (dirty() && !confirm('저장하지 않은 수정 내용을 버리고 되돌릴까요?')) return;
    DATA = clone(SAVED);
    render();
    say('마지막으로 저장된 내용으로 되돌렸습니다.', '');
  }

  function download() {
    const blob = new Blob([JSON.stringify(tidy(DATA), null, 2) + '\n'],
      { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'activities.json';
    a.click();
    URL.revokeObjectURL(a.href);
    say('내려받았습니다. data/activities.json 자리에 덮어쓰면 기본값이 바뀝니다.', 'ok');
  }

  // 저장하지 않고 페이지를 떠나려 하면 한 번 물어봅니다.
  window.addEventListener('beforeunload', (e) => {
    if (DATA && dirty()) { e.preventDefault(); e.returnValue = ''; }
  });

  return { init };
})();
