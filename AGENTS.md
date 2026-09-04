# Coreloom 작업 지침

일하는 방식의 정본은 GitHub `anvideo24/working-method`다. 이 파일은 그 정본을 가리키고, **이 프로젝트 기동·금지만** 적는다. 공용 HOW·LESSONS·RULES를 여기에 복사해 두지 않는다.

## 0. 작업 시작

1. `working-method`를 `git pull` 한다.
   - Windows: `C:\dev\working-method`
   - Mac: Coreloom과 같은 부모 폴더의 `working-method`
2. 그 저장소의 `HOW.md`, `LESSONS.md`, `RULES.md`를 읽는다.
3. 그다음 이 저장소 [RULES.md](RULES.md)와 [manual/00-coreloom-매뉴얼.md](manual/00-coreloom-매뉴얼.md)를 읽는다.
4. 새 작업이나 작업 종류가 바뀌면 공용과 이 제품 규칙을 다시 읽는다.

로컬에 클론이 없으면 GitHub `anvideo24/working-method`의 `main`을 읽는다. 지금 Coreloom 브랜치에 남아 있는 옛 `AGENTS.md`를 일하는 방식 정본으로 쓰지 않는다.

## 1. 이 프로젝트

- 새 작업은 반드시 최신 `origin/main`에서 새 브랜치를 딴다. 이미 `main`에 머지된 옛 브랜치에 이어서 커밋하지 않는다. `cursor/project-tasks-schedule-0ce2`는 그 예다.
- 요청한 업무 흐름과 데이터를 먼저 고정하고, 인접 기능을 임의로 추가하지 않는다.
- 문서와 규칙만 바꾼 작업은 링크·내용을 직접 확인한다. 구현·배포 여부를 추정해 완료로 말하지 않는다.
- 운영 화면 셸의 **지금 동작**은 이 저장소 `RULES.md` 화면 셸 절이다.

## 2. 매뉴얼과 관리자 화면

- 매뉴얼의 원본은 저장소 `manual/`의 Markdown 파일이다.
- 관리자 화면 `/admin/manual`이 **무엇을 보여 주는지는 이 저장소 [RULES.md](RULES.md) 「문서와 관리자 화면」 절이 정본이다.** 그 목록을 여기에 옮겨 적지 않는다.
- 화면용 사본을 별도로 관리하지 않는다. 화면은 git 원본을 읽는다.
- 운영자가 화면에서 매뉴얼 변경을 요청할 경우에도, 변경은 검토·커밋·배포 과정을 거쳐야 한다.

## 3. 개발 PC와 스키마

- 개발 Windows PC의 로컬 저장소는 `C:\dev\Coreloom`이다. 정식 기동은 `apps/web`에서 `npm run up`이다. 로컬은 HTTP `http://127.0.0.1:3000`만 쓰고, 로그인 Origin은 `localhost`와 같게 본다. 휴대폰 Funnel은 HTTPS `:8443`이다. 숫자 없는 `443`은 끄고, `:10000`은 다른 앱이므로 건드리지 않는다. 상세는 매뉴얼 정본을 따른다.
- 스키마를 바꾸면 같은 변경에 drizzle 마이그레이션을 둔다. 개발 PC에서 `npm run db:migrate`(또는 `tsx scripts/migrate.ts`)가 필요하면 그 안내를 빠뜨리지 않는다.

## 4. 작업이 끝나면

오케이 나면 `working-method`의 `HOW.md`대로 처음 안과 최종안을 비교한다.

- Coreloom만의 제품 상태면 이 저장소 `RULES.md`와 매뉴얼·`manual/CHANGELOG.md`·필요하면 `manual/system-progress.md`를 같은 커밋에서 고친다.
- 어디에나 해당하는 규칙·생각·배운 것이면 `working-method`를 고치고 푸시한다.
