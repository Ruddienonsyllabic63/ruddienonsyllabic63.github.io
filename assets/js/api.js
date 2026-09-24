/* ==========================================================================
   데이터 계층 — 갤러리·업로드·관리 페이지가 공통으로 씁니다.

   두 가지 모드로 돌아갑니다.
     supabase 모드 : config.js 에 url/anonKey 가 채워져 있을 때. 진짜 저장.
     demo 모드     : 비어 있을 때. 내 브라우저에만 저장(연결 전 화면 확인용).
   화면 쪽 코드는 어느 모드인지 신경 쓰지 않아도 되도록 감싸 두었습니다.
   ========================================================================== */

const API = (() => {
  const CFG = window.SITE_CONFIG;
  const MODE = window.isSupabaseConfigured() ? 'supabase' : 'demo';

  let client = null;          // supabase client
  let clientReady = null;     // 준비 중인 Promise

  /* ---------- Supabase 준비 ---------- */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Supabase 라이브러리를 불러오지 못했습니다.'));
      document.head.appendChild(s);
    });
  }

  async function getClient() {
    if (MODE !== 'supabase') return null;
    if (client) return client;
    if (!clientReady) {
      clientReady = (async () => {
        if (!window.supabase?.createClient) {
          await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
        }
        client = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
        });
        // 수업 코드 해제 기록을 브라우저별로 묶기 위해 익명 로그인을 해 둡니다.
        const { data } = await client.auth.getSession();
        if (!data.session) await client.auth.signInAnonymously();
        return client;
      })();
    }
    return clientReady;
  }

  /* ---------- 데모 저장소 ---------- */

  const DEMO_KEY = 'demo:submissions';
  const UNLOCK_KEY = 'unlocked:courses';

  function demoAll() {
    try { return JSON.parse(store.get(DEMO_KEY) || '[]'); } catch { return []; }
  }
  function demoSave(rows) {
    try { store.set(DEMO_KEY, JSON.stringify(rows)); return true; }
    catch { return false; }
  }

  function unlockedList() {
    try { return JSON.parse(store.get(UNLOCK_KEY) || '[]'); } catch { return []; }
  }
  function rememberUnlock(courseId) {
    const list = unlockedList();
    if (!list.includes(courseId)) { list.push(courseId); store.set(UNLOCK_KEY, JSON.stringify(list)); }
  }

  /* ---------- 과목 정보 (두 모드 공통, 파일에서 읽음) ---------- */

  let coursesCache = null;
  async function listCourses() {
    if (coursesCache) return coursesCache;
    const res = await fetch('data/courses.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('과목 정보를 불러오지 못했습니다.');
    const json = await res.json();
    coursesCache = json.courses || [];
    return coursesCache;
  }

  async function getCourse(id) {
    const all = await listCourses();
    return all.find((c) => c.id === id) || null;
  }

  /* ---------- 수업 코드 ---------- */

  function isUnlocked(courseId) {
    return unlockedList().includes(courseId);
  }

  async function unlock(courseId, code) {
    const clean = String(code || '').trim();
    if (!clean) return false;

    if (MODE === 'demo') {
      const course = await getCourse(courseId);
      const ok = course && clean.toLowerCase() === String(course.demoCode || '').toLowerCase();
      if (ok) rememberUnlock(courseId);
      return ok;
    }

    const supa = await getClient();
    const { data, error } = await supa.rpc('unlock_course', {
      p_course_id: courseId,
      p_code: clean,
    });
    if (error) throw error;
    if (data === true) rememberUnlock(courseId);
    return data === true;
  }

  function lock(courseId) {
    const list = unlockedList().filter((id) => id !== courseId);
    store.set(UNLOCK_KEY, JSON.stringify(list));
  }

  /* ---------- 결과물 목록 ---------- */

  /**
   * 한 과목의 결과물을 가져옵니다.
   * 권한은 서버(Supabase)가 판단합니다. 코드를 풀지 않았으면 공개 항목만 돌아옵니다.
   */
  async function listSubmissions(courseId) {
    if (MODE === 'demo') {
      const unlocked = isUnlocked(courseId);
      const admin = isDemoAdmin();
      return demoAll()
        .filter((r) => r.course_id === courseId)
        .filter((r) => admin || r.visibility === 'public' || (unlocked && r.visibility === 'class'))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }

    const supa = await getClient();
    const { data, error } = await supa
      .from('submissions')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // 비공개 파일은 시간 제한이 걸린 임시 주소를 그때그때 발급받습니다.
    return Promise.all((data || []).map(withFileUrl));
  }

  /** 모든 과목의 "모두 공개" 결과물만 모아 보여 줄 때 (갤러리 첫 화면) */
  async function listPublic(limit = 60) {
    if (MODE === 'demo') {
      return demoAll()
        .filter((r) => r.visibility === 'public')
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, limit);
    }
    const supa = await getClient();
    const { data, error } = await supa
      .from('submissions')
      .select('*')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return Promise.all((data || []).map(withFileUrl));
  }

  async function withFileUrl(row) {
    if (!row.file_path) return row;
    try {
      const supa = await getClient();
      const { data } = await supa.storage.from(CFG.bucket).createSignedUrl(row.file_path, 60 * 60);
      return { ...row, file_url: data?.signedUrl || null };
    } catch {
      return { ...row, file_url: null };
    }
  }

  /* ---------- 결과물 올리기 ---------- */

  /**
   * @param {Object} p
   * @param {string} p.courseId  과목 id
   * @param {string} p.title     제목
   * @param {string} p.author    이름
   * @param {string} p.studentNo 학번(선택)
   * @param {string} p.description 설명(선택)
   * @param {string} p.linkUrl   링크 제출일 때
   * @param {File}   p.file      파일 제출일 때
   * @param {'class'|'public'} p.visibility
   * @param {(pct:number)=>void} [p.onProgress]
   */
  async function createSubmission(p) {
    const now = new Date().toISOString();
    const base = {
      course_id: p.courseId,
      title: p.title.trim(),
      author_name: p.author.trim(),
      student_no: (p.studentNo || '').trim() || null,
      description: (p.description || '').trim() || null,
      link_url: (p.linkUrl || '').trim() || null,
      visibility: p.visibility === 'public' ? 'public' : 'class',
      created_at: now,
    };

    if (MODE === 'demo') {
      const rows = demoAll();
      const row = {
        ...base,
        id: 'demo-' + Math.random().toString(36).slice(2, 10),
        file_name: p.file ? p.file.name : null,
        file_size: p.file ? p.file.size : null,
        file_path: null,
        file_url: null,
      };
      // 작은 이미지에 한해 미리보기를 위해 브라우저에 담아 둡니다.
      if (p.file && p.file.type.startsWith('image/') && p.file.size < 700 * 1024) {
        row.file_url = await readAsDataUrl(p.file);
      }
      rows.push(row);
      if (!demoSave(rows)) {
        throw new Error('브라우저 저장 공간이 가득 찼습니다. 데모 자료를 비우고 다시 시도하세요.');
      }
      return row;
    }

    const supa = await getClient();
    let filePath = null;

    if (p.file) {
      const ext = (p.file.name.split('.').pop() || '').toLowerCase();
      const rand = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      filePath = `${p.courseId}/${rand}.${ext}`;
      const { error: upErr } = await supa.storage
        .from(CFG.bucket)
        .upload(filePath, p.file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
    }

    const { data, error } = await supa
      .from('submissions')
      .insert({
        ...base,
        file_path: filePath,
        file_name: p.file ? p.file.name : null,
        file_size: p.file ? p.file.size : null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
      r.readAsDataURL(file);
    });
  }

  /* ---------- 관리자 ---------- */

  function isDemoAdmin() { return store.get('demo:admin') === '1'; }

  async function signIn(email, password) {
    if (MODE === 'demo') {
      // 데모에서는 아무 값이나 넣으면 관리자 화면을 볼 수 있습니다.
      store.set('demo:admin', '1');
      return { email: email || '데모 관리자' };
    }
    const supa = await getClient();
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async function signOut() {
    if (MODE === 'demo') { store.del('demo:admin'); return; }
    const supa = await getClient();
    await supa.auth.signOut();
    await supa.auth.signInAnonymously(); // 다시 일반 방문자로
  }

  /** 지금 관리자로 로그인되어 있는지 */
  async function currentAdmin() {
    if (MODE === 'demo') return isDemoAdmin() ? { email: '데모 관리자' } : null;
    const supa = await getClient();
    const { data } = await supa.auth.getUser();
    const user = data?.user;
    if (!user || user.is_anonymous) return null;
    const { data: ok } = await supa.rpc('is_admin');
    return ok ? user : null;
  }

  /** 모든 과목의 모든 제출물 (관리자 전용 — 권한은 서버가 확인) */
  async function listAll() {
    if (MODE === 'demo') {
      return demoAll().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
    const supa = await getClient();
    const { data, error } = await supa
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return Promise.all((data || []).map(withFileUrl));
  }

  async function setVisibility(id, visibility) {
    if (MODE === 'demo') {
      const rows = demoAll();
      const row = rows.find((r) => r.id === id);
      if (row) { row.visibility = visibility; demoSave(rows); }
      return;
    }
    const supa = await getClient();
    const { error } = await supa.from('submissions').update({ visibility }).eq('id', id);
    if (error) throw error;
  }

  async function removeSubmission(id) {
    if (MODE === 'demo') {
      demoSave(demoAll().filter((r) => r.id !== id));
      return;
    }
    const supa = await getClient();
    const { data: row } = await supa.from('submissions').select('file_path').eq('id', id).single();
    if (row?.file_path) {
      await supa.storage.from(CFG.bucket).remove([row.file_path]);
    }
    const { error } = await supa.from('submissions').delete().eq('id', id);
    if (error) throw error;
  }

  /* ---------- 사이트 설정 (관리자가 켜고 끄는 값) ---------- */

  /** 읽기는 settings.js 의 readSetting() 이 맡습니다. 여기서는 저장만 합니다. */
  async function setSetting(key, value) {
    if (MODE === 'demo') {
      store.set('setting:' + key, JSON.stringify(value));
      return;
    }
    const supa = await getClient();
    const { error } = await supa
      .from('site_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  /** 데모 자료 전부 지우기 */
  function clearDemo() { store.del(DEMO_KEY); store.del(UNLOCK_KEY); store.del('demo:admin'); }

  return {
    mode: MODE,
    listCourses, getCourse,
    isUnlocked, unlock, lock,
    listSubmissions, listPublic, createSubmission,
    signIn, signOut, currentAdmin, listAll, setVisibility, removeSubmission,
    setSetting,
    clearDemo,
  };
})();
