/* ==========================================================================
   사이트 설정 — 여기만 고치면 됩니다.
   --------------------------------------------------------------------------
   Supabase 가입 후 받은 값 두 개를 아래에 넣으세요.
   (Supabase 대시보드 → Project Settings → API 에서 확인)

     url      : Project URL          예) https://abcdefgh.supabase.co
     anonKey  : anon / public  키    예) eyJhbGciOi...

   ※ anonKey 는 브라우저에 공개되는 것이 정상인 키입니다.
      절대 넣으면 안 되는 것은 service_role 키입니다.
   ※ 두 값이 비어 있으면 사이트가 자동으로 "데모 모드"로 돌아갑니다.
      데모 모드에서는 업로드한 내용이 내 브라우저에만 저장되어,
      실제 연결 전에 화면을 마음껏 시험해 볼 수 있습니다.
   ========================================================================== */

window.SITE_CONFIG = {
  supabase: {
    url: '',
    anonKey: '',
  },

  /** 파일이 저장될 Supabase Storage 버킷 이름 (schema.sql 과 같아야 합니다) */
  bucket: 'submissions',

  /** 한 번에 올릴 수 있는 파일 최대 크기 (MB) */
  maxFileMB: 20,

  /** 올릴 수 있는 파일 확장자 */
  allowedExt: [
    'pdf', 'hwp', 'hwpx', 'doc', 'docx', 'txt', 'md',
    'ppt', 'pptx', 'key',
    'xls', 'xlsx', 'csv',
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic',
    'zip',
  ],

  /** 관리자(교수) 계정 이메일 — 관리 페이지 안내문에만 쓰입니다 */
  adminHint: 'park51566@jnu.ac.kr',
};

/** Supabase 설정이 채워져 있는지 */
window.isSupabaseConfigured = function () {
  const s = window.SITE_CONFIG.supabase;
  return Boolean(s.url && s.anonKey && s.url.startsWith('http'));
};
