# Neon 브랜치와 백업 운영 절차

## 경계

- `production`은 실제 회사 운영 데이터 경계입니다. AI/MCP, 실험 코드, 합성 데이터는 연결하지 않습니다.
- `ai-development`에는 합성 데이터만 넣습니다. 개발·테스트·스키마 검증은 이 브랜치에서만 합니다.
- 연결 문자열, 인증 URL, 쿠키 비밀값, 고객·재무·문서 데이터, 백업 파일은 Git·채팅·테스트에 넣지 않습니다.

## 스키마 변경 절차

1. 로컬에서 `npm --prefix apps/web run db:generate`로 SQL을 생성합니다.
2. 생성 SQL과 코드 변경을 검토합니다.
3. `.env.local`의 `CORELOOM_DATABASE_BRANCH=ai-development` 및 Console 선택 브랜치가 모두 `ai-development`임을 확인합니다.
4. `npm --prefix apps/web run db:migrate`로 개발 브랜치에만 적용하고, Tables 화면에서 테이블 이름만 확인합니다.
5. 코드 작업 안내에는 개발 PC에서 `npm run db:migrate`가 필요한지를 빠뜨리지 않습니다.
6. 코드·SQL·검증 결과를 Git에 커밋·푸시합니다.
7. 대표가 명시적으로 승인한 경우에만, 별도 로컬 운영 연결로 같은 검토 SQL을 `production`에 적용합니다.

연결 대상, 선택된 브랜치, 생성 SQL 중 하나라도 검토 조건과 다르면 즉시 중단합니다. Neon Free의 짧은 복구 이력은 논리 백업을 대신하지 않습니다.

## 수동 백업

- 운영 스키마 변경을 승인하기 전과 적용한 뒤에 백업합니다.
- 파괴적인 운영 유지보수 전에 반드시 백업합니다.
- 로컬에서만 `DATABASE_URL`과 저장소 밖의 절대 경로 `CORELOOM_BACKUP_DIR`를 설정합니다.
- `pwsh -File apps/web/scripts/backup-production.ps1`를 실행합니다.
- 스크립트는 custom-format 덤프와 최소 영수증을 만들고 `pg_restore --list`로 읽기만 검증합니다. 자동 실행·삭제·업로드·암호화는 하지 않습니다.

## 복구 점검

복구 검증은 새 비운영 Neon 브랜치에만 수행합니다. 스키마와 레코드 수를 사람 눈으로 확인한 뒤, 운영 복구가 필요한지 별도로 결정합니다. Console에서 `production`을 복구하는 행위는 항상 대표의 별도 승인을 받아야 합니다.
