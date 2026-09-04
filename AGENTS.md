# Coreloom 작업 지침

일을 시작하고 끝내는 법의 정본은 **GitHub `anvideo24/working-method`의 [AGENTS.md](https://github.com/anvideo24/working-method/blob/main/AGENTS.md)** 다. 먼저 그것을 읽는다.

이 파일에는 **Coreloom만의 기동과 금지**만 적는다. 읽는 순서·되돌려 적는 자리·가지 규칙·완료 판정은 공용에 있고, 여기에 옮겨 적지 않는다.

## 1. 이 제품에서 먼저 읽을 것

공용 셋을 읽은 다음, 이 저장소 [RULES.md](RULES.md)와 [manual/00-coreloom-매뉴얼.md](manual/00-coreloom-매뉴얼.md)를 읽는다.

운영 화면 셸의 **지금 동작**은 이 저장소 `RULES.md` 화면 셸 절이다. 그 절을 다른 면에 베끼거나, 앞으로 영원히 같다고 닫지 않는다.

## 2. 매뉴얼과 관리자 화면

- 이 제품의 매뉴얼 원본은 저장소 `manual/`의 Markdown 파일이다. 공용 문서는 옆 폴더 `working-method`에서 읽는다.
- 관리자 화면 `/admin/manual`이 **무엇을 보여 주고 무엇을 금지하는지는 이 저장소 [RULES.md](RULES.md) 「문서와 관리자 화면」 절이 정본이다.** 그 내용을 여기에 옮겨 적지 않는다.

## 3. 개발 PC와 스키마

- 개발 Windows PC의 로컬 저장소는 `C:\dev\Coreloom`이고, 공용 정본은 같은 부모 폴더의 `C:\dev\working-method`다. 정식 기동은 `apps/web`에서 `npm run up`이다. 로컬은 HTTP `http://127.0.0.1:3000`만 쓰고, 로그인 Origin은 `localhost`와 같게 본다. 휴대폰 Funnel은 HTTPS `:8443`이다. 숫자 없는 `443`은 끄고, `:10000`은 다른 앱이므로 건드리지 않는다. 상세는 매뉴얼 정본을 따른다.
- 스키마를 바꾸면 같은 변경에 drizzle 마이그레이션을 둔다. 개발 PC에서 `npm run db:migrate`(또는 `tsx scripts/migrate.ts`)가 필요하면 그 안내를 빠뜨리지 않는다.

## 4. 클라우드 에이전트 시각 검증

UI·견적·셸·로그인 뒤 화면을 손댄 작업은 **유닛 테스트만으로 끝내지 않는다.** Cursor Cloud Agent가 브라우저로 `/sign-in`에 들어가 대상 화면을 눈으로 확인한다.

1. Cursor 환경 Secrets에 아래 **이름**이 있어야 한다. 값·실이메일은 채팅·커밋·PR·로그에 넣지 않는다.
   - 서버: `DATABASE_URL`(ai-development만), `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `CORELOOM_FOUNDER_EMAIL`
   - 로그인: `TEST_LOGIN_USERNAME`, `TEST_LOGIN_PASSWORD` (대표 Neon 계정. `CORELOOM_FOUNDER_EMAIL`과 같아야 한다)
2. `apps/web`에서 `npm run cloud:bootstrap`으로 `.env.local`을 만들고 migrate 한다. 이어 `npm run cloud:dev`로 `http://127.0.0.1:3000`을 연다. (`npm run up`·`predev` 동기화는 클라우드에서 쓰지 않는다.)
3. `computerUse`로 `/sign-in`을 연 뒤 `TEST_LOGIN_*`로 로그인하고, 변경한 화면을 스크린샷·녹화로 남긴다. 비밀 값은 출력·녹화 UI에 노출하지 않는다.
4. Secrets가 없으면 추정으로 「화면 확인 완료」라고 말하지 말고, 막힌 비밀 **이름**만 알린다. `production` DB는 쓰지 않는다.

환경 `start`/`terminals`에는 `cd apps/web && npm run cloud:dev`를 둔다. Secrets를 넣은 뒤에는 환경 Save가 반영된 **새** 에이전트에서만 통한다.

> 작업이 끝난 뒤 무엇을 어디에 되돌려 적는지는 공용 `AGENTS.md` 2절이 정본이다. 이 제품 쪽에 적을 것은 `RULES.md` 「문서와 관리자 화면」 절에 있다.
