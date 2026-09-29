# Riftbound Origins 온라인 카드샵 v1

- index.html: 공개 판매페이지
- admin.html: 관리자 로그인/재고/가격 수정
- config.js: Supabase URL / anon key / 기본 카카오 링크
- supabase.sql: DB 및 권한 설정
- import-helper.html: 기존 v22 CSV를 Supabase import CSV로 변환

## 설치
1. Supabase 무료 프로젝트 생성
2. SQL Editor에서 `supabase.sql` 실행
3. Authentication > Users에서 본인 관리자 이메일 계정 1개 생성
4. Project URL과 anon key를 `config.js`에 입력
5. 기존 v22에서 전체 또는 원하는 필터로 CSV 내보내기
6. `import-helper.html`로 변환 후 Supabase `cards` 테이블에 CSV import
7. `admin.html`에서 카카오 오픈채팅 URL 저장
8. 이 폴더를 GitHub Pages 또는 Cloudflare Pages에 올리면 공개 가능

## 구매자 화면
판매가능 수량/판매가만 표시 → 수량 선택 → 총액 자동 계산 → 구매목록 복사 → 카카오톡 문의

## 관리자 화면
판매수량, 판매가, 북미가, 바인더 보유 및 카카오 링크 관리

참고: 1인 운영 전제로 authenticated 사용자는 관리자입니다. Supabase Auth에는 본인 계정만 만들어 사용하세요.
