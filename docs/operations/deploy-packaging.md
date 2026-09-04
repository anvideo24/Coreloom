# Coreloom 배포본 포장

> 운영 빌드(`next build`)는 이미 된다. 이 문서는 **싸서 띄우는** 방법을 정본으로 둔다.
> 호스팅 공급자(Vercel·VM·쿠버네티스) 선정은 대표가 한다. 이 저장소는 `standalone`과 Dockerfile만 둔다.

## 무엇이 있나

| 항목 | 자리 |
|---|---|
| Next `output: "standalone"` | `apps/web/next.config.ts` |
| 추적 기준(저장소 뿌리) | `outputFileTracingRoot` — `manual/`·뿌리 `RULES.md`가 목록에 오름 |
| 비밀 제외 | `outputFileTracingExcludes` — `.env*` 제외 |
| Dockerfile | 저장소 뿌리 `Dockerfile` |
| 컨테이너 진입점 | `apps/web/server.js` (standalone 산출물 기준) |

## 로컬에서 standalone만 확인

```bash
cd apps/web
npm run build
# 산출: .next/standalone/apps/web/server.js
# 정적 파일은 옆에 맞춰 둔다 (문서 아래 Docker와 동일)
```

PC 개발(`npm run up` / `npm run dev`)은 standalone을 쓰지 않는다.

## Docker 이미지

저장소 **뿌리**에서:

```bash
docker build -t coreloom:local .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL \
  -e NEON_AUTH_BASE_URL \
  -e NEON_AUTH_COOKIE_SECRET \
  -e CORELOOM_FOUNDER_EMAIL \
  coreloom:local
```

- `.env*`는 이미지에 넣지 않는다. 실행 시 환경 변수로만 넘긴다.
- 공용 `working-method` 클론은 이미지에 없다. `/admin/manual`의 공용 칸은 「아직 없다」로 보인다.
- 이 클라우드 에이전트 환경에는 Docker가 없을 수 있다. 이미지 빌드 확인은 개발 PC 또는 CI에서 한다.

## 하지 않는 것

- 운영 DB·실비밀을 이미지·저장소·채팅에 넣지 않는다.
- Funnel 주소·고객사명·이메일을 배포 문서에 적지 않는다.
- Vercel 프로젝트 연결·도메인·프로덕션 프로모션은 이 포장 범위 밖이다.
