-- ============================================================================
--  박주현 교수 웹사이트 — Supabase 데이터베이스 설계
--  ---------------------------------------------------------------------------
--  Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여 넣고 한 번 실행하세요.
--  여러 번 실행해도 문제가 없도록 만들어 두었습니다.
--
--  실행 전에 먼저 해 두어야 할 것
--   1) Authentication → Sign In / Providers → "Anonymous sign-ins" 켜기
--      (수업 코드를 푼 사람을 구분하기 위해 필요합니다. 계정 가입과는 다릅니다.)
--   2) 아래 8번 항목에서 실제 과목과 수업 코드를 넣기
-- ============================================================================


-- ── 1. 확장 ────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;


-- ── 2. 표 만들기 ────────────────────────────────────────────────────────────

-- 과목. 수업 코드는 원문이 아니라 해시로만 저장합니다.
create table if not exists public.courses (
  id          text primary key,
  title       text not null,
  term        text,
  code_hash   text not null,
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 관리자(교수). Authentication 에서 만든 계정의 id 를 여기에 넣어야 권한이 생깁니다.
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- 수업 코드를 푼 방문자 기록 (브라우저별 익명 계정 단위)
create table if not exists public.course_access (
  user_id    uuid not null references auth.users(id) on delete cascade,
  course_id  text not null references public.courses(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- 학생 제출물
create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  course_id   text not null references public.courses(id) on delete cascade,
  title       text not null check (length(title) between 1 and 200),
  author_name text not null check (length(author_name) between 1 and 60),
  student_no  text check (student_no is null or length(student_no) <= 30),
  description text check (description is null or length(description) <= 1000),
  link_url    text check (link_url is null or link_url ~* '^https?://'),
  file_path   text,
  file_name   text,
  file_size   bigint,
  visibility  text not null default 'class'
              check (visibility in ('class', 'public', 'private')),
  owner_id    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- 파일이든 링크든 둘 중 하나는 반드시 있어야 합니다.
  constraint has_content check (file_path is not null or link_url is not null)
);

create index if not exists submissions_course_idx  on public.submissions (course_id, created_at desc);
create index if not exists submissions_public_idx  on public.submissions (visibility, created_at desc);


-- ── 3. 도우미 함수 ──────────────────────────────────────────────────────────

-- 지금 접속한 사람이 관리자인가?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- 지금 접속한 사람이 이 과목의 코드를 풀었는가?
create or replace function public.has_access(p_course_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.course_access ca
    where ca.user_id = auth.uid() and ca.course_id = p_course_id
  );
$$;

-- 수업 코드 확인 → 맞으면 열람 권한을 기록합니다.
create or replace function public.unlock_course(p_course_id text, p_code text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_ok boolean;
begin
  if auth.uid() is null then
    raise exception '접속 세션이 없습니다. 페이지를 새로 고친 뒤 다시 시도해 주세요.';
  end if;

  select (c.code_hash = extensions.crypt(p_code, c.code_hash))
    into v_ok
    from public.courses c
   where c.id = p_course_id and c.is_open;

  if coalesce(v_ok, false) then
    insert into public.course_access (user_id, course_id)
    values (auth.uid(), p_course_id)
    on conflict do nothing;
    return true;
  end if;

  return false;
end;
$$;

-- 수업 코드 바꾸기 (관리자 전용). SQL Editor 에서 직접 실행할 때도 씁니다.
create or replace function public.set_course_code(p_course_id text, p_code text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  if length(coalesce(p_code, '')) < 6 then
    raise exception '수업 코드는 6자 이상으로 정해 주세요.';
  end if;
  update public.courses
     set code_hash = extensions.crypt(p_code, extensions.gen_salt('bf'))
   where id = p_course_id;
  if not found then
    raise exception '그런 과목이 없습니다: %', p_course_id;
  end if;
end;
$$;

grant execute on function public.is_admin()                        to anon, authenticated;
grant execute on function public.has_access(text)                  to anon, authenticated;
grant execute on function public.unlock_course(text, text)         to anon, authenticated;


-- ── 4. 접근 규칙 켜기 ───────────────────────────────────────────────────────
alter table public.courses       enable row level security;
alter table public.admins        enable row level security;
alter table public.course_access enable row level security;
alter table public.submissions   enable row level security;


-- ── 5. 접근 규칙 ────────────────────────────────────────────────────────────
-- courses 에는 일부러 읽기 규칙을 두지 않습니다.
-- 과목 정보는 사이트의 data/courses.json 에서 읽고,
-- 수업 코드 해시는 위 함수를 통해서만 확인되므로 브라우저에 절대 노출되지 않습니다.
drop policy if exists "과목은 관리자만" on public.courses;
create policy "과목은 관리자만" on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "내 관리자 정보만" on public.admins;
create policy "내 관리자 정보만" on public.admins
  for select using (user_id = auth.uid());

drop policy if exists "내 해제 기록만" on public.course_access;
create policy "내 해제 기록만" on public.course_access
  for select using (user_id = auth.uid());

-- 제출물 읽기: 전체 공개 / 관리자 / 코드를 푼 사람의 수업 공개 / 내가 올린 것
drop policy if exists "제출물 읽기" on public.submissions;
create policy "제출물 읽기" on public.submissions
  for select using (
    visibility = 'public'
    or public.is_admin()
    or (visibility = 'class' and public.has_access(course_id))
    or (owner_id is not null and owner_id = auth.uid())
  );

-- 제출물 올리기: 그 과목의 코드를 푼 사람만. 비공개로는 올릴 수 없습니다.
drop policy if exists "제출물 올리기" on public.submissions;
create policy "제출물 올리기" on public.submissions
  for insert with check (
    public.has_access(course_id)
    and visibility in ('class', 'public')
    and owner_id = auth.uid()
  );

-- 공개 범위 바꾸기: 관리자만
drop policy if exists "제출물 수정" on public.submissions;
create policy "제출물 수정" on public.submissions
  for update using (public.is_admin()) with check (public.is_admin());

-- 삭제: 관리자 또는 올린 본인
drop policy if exists "제출물 삭제" on public.submissions;
create policy "제출물 삭제" on public.submissions
  for delete using (public.is_admin() or owner_id = auth.uid());


-- ── 5-b. 사이트 설정 (관리 화면에서 켜고 끄는 값) ───────────────────────────
-- 예) 연구 과제 사업비 금액을 공개할지 여부
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- 설정 값은 누구나 읽을 수 있어야 합니다(방문자 화면이 이 값을 보고 그립니다).
drop policy if exists "설정 읽기" on public.site_settings;
create policy "설정 읽기" on public.site_settings
  for select using (true);

-- 바꾸는 것은 관리자만.
drop policy if exists "설정 쓰기" on public.site_settings;
create policy "설정 쓰기" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());


-- ── 6. 파일 저장소 ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('submissions', 'submissions', false, 20971520)   -- 20MB
on conflict (id) do update set public = false, file_size_limit = 20971520;

-- 파일 읽기: 관리자 / 코드를 푼 사람 / 전체 공개 제출물의 파일
drop policy if exists "제출 파일 읽기" on storage.objects;
create policy "제출 파일 읽기" on storage.objects
  for select using (
    bucket_id = 'submissions' and (
      public.is_admin()
      or public.has_access((storage.foldername(name))[1])
      or exists (
        select 1 from public.submissions s
        where s.file_path = storage.objects.name and s.visibility = 'public'
      )
    )
  );

-- 파일 올리기: 그 과목 코드를 푼 사람만 (폴더 이름이 과목 id 입니다)
drop policy if exists "제출 파일 올리기" on storage.objects;
create policy "제출 파일 올리기" on storage.objects
  for insert with check (
    bucket_id = 'submissions'
    and public.has_access((storage.foldername(name))[1])
  );

-- 파일 삭제: 관리자만
drop policy if exists "제출 파일 삭제" on storage.objects;
create policy "제출 파일 삭제" on storage.objects
  for delete using (bucket_id = 'submissions' and public.is_admin());


-- ── 7. 관리자 등록 ──────────────────────────────────────────────────────────
-- Authentication → Users → "Add user" 로 교수님 계정을 먼저 만든 뒤,
-- 아래 한 줄을 실행하면 그 계정이 관리자가 됩니다. 이메일만 바꿔 주세요.
--
--   insert into public.admins (user_id, email)
--   select id, email from auth.users where email = 'park51566@jnu.ac.kr'
--   on conflict (user_id) do nothing;


-- ── 8. 과목과 수업 코드 등록 ────────────────────────────────────────────────
-- id 는 사이트의 data/courses.json 에 적은 id 와 똑같아야 합니다.
-- 코드는 6자 이상, 수업 시간에만 알려 주세요.
--
--   insert into public.courses (id, title, term, code_hash)
--   values ('ai-reading-2026-2', 'AI독서리터러시', '2026학년도 2학기', 'x')
--   on conflict (id) do update set title = excluded.title, term = excluded.term;
--   select public.set_course_code('ai-reading-2026-2', '여기에실제코드');
--
--   insert into public.courses (id, title, term, code_hash)
--   values ('metadata-2026-2', '메타데이터와아카이빙연구', '2026학년도 2학기', 'x')
--   on conflict (id) do update set title = excluded.title, term = excluded.term;
--   select public.set_course_code('metadata-2026-2', '여기에실제코드');
--
-- 학기가 끝나 제출을 닫고 싶을 때:
--   update public.courses set is_open = false where id = 'ai-reading-2026-2';
