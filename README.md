# 한걸음 · 과제 7

과제 6의 운동 다이어리에 앱 자체 회원가입·로그인·로그아웃과 서버 세션, 개인 자료 접근 제어, 5일 습관 관찰을 추가했습니다.

앱: https://move-diary-pds-1012.kjhw7849.chatgpt.site
공개 소스·설명·검증: https://move-diary-pds-1012.kjhw7849.chatgpt.site/source

## 사용 순서
1. 회원가입하고 본인 계획을 저장합니다. 비밀번호는 12자 이상, UTF-8 72바이트 이하입니다. 아이디는 영문 소문자·숫자·밑줄 4~32자입니다.
2. 실제 운동 뒤 실행 기록을 남깁니다. 계획·실행·돌아보기 기능은 과제 6과 이어집니다.
3. '5일 습관 관찰'에서 질문·지표·처음 규칙을 확인하고 시작합니다.
4. 서로 다른 실제 날짜에 기록합니다. 2일차 기록 뒤 3일차 기록 전에 계획 규칙 하나를 바꾸고 이유를 남깁니다.
5. 5일이 채워지면 합계·평균을 손계산과 대조하고 전체 자료를 내보냅니다.

실제 5일 사용 기록은 자동 생성하지 않습니다. 오늘 기록은 날짜당 한 번 확정되고 수정할 수 없으므로 저장 전에 확인하세요. 실제 운동을 하지 않은 날만 0분을 입력합니다.

## 제출 문서
- docs/auth-implementation.md: 인증 구현 설명서 6항목, 확인법4줄, AI와 내 판단3줄, 한계.
- public/auth-evidence.json: 실제 로컬 요청·응답 증거. 원문 비밀번호·세션은 가림. 테스트 계정의 bcrypt 해시 두 개만 비교 증거로 포함.
- contracts/pds-schema-v2.json + contracts/pds-auth-v3.json: 기존 및 인증 확장 DB 명세.
- T06 최종 커밋: 704893d03fd11c581da6ecc192192a5458679add. 같은 Git 이력에서 이어 개발.

## 개발 및 검증
Node.js 22.13 이상. npm run install:ci → npm run build. 로컬 DB에는 drizzle/0000_nosy_stick.sql 이후 drizzle/0001_abnormal_black_widow.sql을 순서대로 한 번씩 적용합니다. 이미 적용한 SQL은 수정하거나 재실행하지 않습니다.

로컬 마이그레이션 명령:
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_abnormal_black_widow.sql

npm start로 로컬 Worker를 실행합니다. 테스트는 127.0.0.1:5173을 사용합니다. node --test tests/metrics.test.mjs tests/experiment.test.mjs 및 node tests/auth.integration.mjs를 실행합니다. 인증 통합 검증의 DB 해시 검사·시간 fixture에는 Node.js의 node:sqlite가 필요합니다(검증 환경 Node25). 이전 tests/api.integration.mjs는 T06 전용이며 인증 도입 후에는 사용하지 않습니다.

소스·문서 갱신: node scripts/export-source.mjs. 서버 코드와 D1 바인딩에만 인증 자료가 존재하며, 브라우저 코드·내보내기·제출 문서에 비밀번호나 세션 원문을 포함하지 않습니다.

## 제한
비밀번호 찾기·이메일 인증·다중 인증은 미구현입니다. 기본 횟수 제한이 모든 분산 공격을 막지는 않습니다. 계정 삭제는 운영 DB의 자료를 삭제하며 이미 받은 파일이나 호스팅 업체의 내부 백업까지 회수하지 않습니다. 사용자 운영 데이터는 인증 도입 전 0건으로 확인돼 이전할 기록이 없었습니다.
