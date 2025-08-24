# 부동산 검색 서비스

네이버 부동산 데이터 검색 및 엑셀 다운로드 서비스입니다.

## 주요 기능

- 🔍 **아파트 검색**: 네이버 부동산 API를 통한 아파트 단지 검색
- 📋 **매물 조회**: 거래유형별(매매/전세/월세) 매물 데이터 조회
- 📥 **엑셀 다운로드**: 조회한 매물 데이터를 엑셀 파일로 다운로드
- 🚀 **서버리스**: Vercel 플랫폼에서 서버리스 함수로 동작

## 기술 스택

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js (Serverless Functions)
- **Platform**: Vercel
- **API**: Naver Real Estate API

## 로컬 개발 환경 설정

1. Node.js 18 이상 설치
2. 의존성 패키지 설치
   ```bash
   npm install
   ```
3. 개발 서버 실행
   ```bash
   npm run dev
   ```
4. 브라우저에서 `http://localhost:3000` 접속

## Vercel 배포

### 자동 배포 (추천)
1. GitHub에 코드 push
2. Vercel에서 GitHub 저장소 연결
3. 자동 빌드 및 배포

### 수동 배포
```bash
npm install -g vercel
vercel --prod
```

### 배포 설정

`vercel.json` 파일에서 다음 설정을 확인하세요:
- API 라우트: `api/*.js` 파일들이 서버리스 함수로 동작
- 정적 파일: `public/*` 파일들이 정적 파일로 서빙
- 타임아웃: API 요청별로 30-60초 타임아웃 설정

## API 엔드포인트

### 1. 아파트 검색
```
GET /api/search_complexes?keyword={검색어}
```

### 2. 매물 조회  
```
GET /api/fetch_listings?complex_no={단지번호}&trade_type={거래유형}
```

### 3. 엑셀 다운로드
```
GET /api/download_excel?complex_no={단지번호}&trade_type={거래유형}
```

## 프로젝트 구조

```
├── api/                    # Vercel 서버리스 함수
│   ├── search_complexes.js # 아파트 검색 API
│   ├── fetch_listings.js   # 매물 조회 API
│   └── download_excel.js   # 엑셀 다운로드 API
├── public/                 # 정적 파일
│   ├── index.html         # 메인 페이지
│   ├── style.css          # 스타일시트
│   └── script.js          # 프론트엔드 JavaScript
├── package.json           # Node.js 의존성
├── vercel.json           # Vercel 배포 설정
└── README.md             # 프로젝트 문서
```

## 주요 특징

- **서버리스 아키텍처**: 서버 관리 불필요, 자동 스케일링
- **실시간 데이터**: 네이버 부동산 최신 데이터 제공
- **반응형 디자인**: 모바일/데스크톱 모두 지원
- **Rate Limiting 처리**: API 호출 제한 대응 로직 내장
- **에러 핸들링**: 사용자 친화적 에러 메시지

## 브라우저 지원

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## 라이선스

MIT License