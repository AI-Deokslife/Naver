const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 미들웨어
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (public 폴더)
app.use(express.static('public'));

// API 라우트 설정
app.use('/api/search_complexes', require('./api/search_complexes'));
app.use('/api/fetch_listings', require('./api/fetch_listings'));
app.use('/api/download_excel', require('./api/download_excel'));

// 루트 경로에서 index.html 서빙
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`📁 정적 파일: public 폴더`);
    console.log(`🔗 API: /api/search_complexes, /api/fetch_listings, /api/download_excel`);
});

module.exports = app;