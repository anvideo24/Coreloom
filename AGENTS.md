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

## 4. 클라우드 에이전트 — 시각 확인 금지

Cursor Cloud Agent는 **브라우저 로그인·스크린샷·녹화·computerUse 시각 확인을 하지 않는다.** UI를 손대더라도 유닛 테스트·코드 검토·문서 갱신으로 끝내고, 화면 확인은 대표(개발 PC)가 한다.

- `cloud:bootstrap` / `cloud:dev` / `/sign-in` 로그인 검증 절차를 돌리지 않는다.
- walkthrough 녹화·스크린샷 의무도 이 제품에서는 적용하지 않는다.
- `production` DB는 쓰지 않는다.

> 작업이 끝난 뒤 무엇을 어디에 되돌려 적는지는 공용 `AGENTS.md` 2절이 정본이다. 이 제품 쪽에 적을 것은 `RULES.md` 「문서와 관리자 화면」 절에 있다.
