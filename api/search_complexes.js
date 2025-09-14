const https = require('https');

module.exports = async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // OPTIONS 요청 (preflight) 처리
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { keyword } = req.query;

    if (!keyword) {
        return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    console.log(`[DEBUG] 검색 요청 시작: ${keyword}`);

    try {
        // Rate limiting을 위한 기본 지연 추가 (2초로 단축)
        await new Promise(resolve => setTimeout(resolve, 2000));

        const searchResults = await searchComplexes(keyword);

        console.log(`[DEBUG] 검색 완료: ${searchResults.length}개 결과`);
        res.status(200).json(searchResults);
    } catch (error) {
        console.error('=== 검색 오류 상세 정보 ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        res.status(500).json({
            error: `검색 중 오류 발생: ${error.message}`,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
}

function searchComplexes(keyword, retries = 2) {
    return new Promise((resolve, reject) => {
        const cookies = 'NNB=FGYNFS4Y6M6WO; NFS=2; ASID=afd10077000001934e8033f50000004e; REALESTATE=Thu Jan 30 2025 10:00:00 GMT+0900; NACT=1';
        const authorization = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlJFQUxFU1RBVEUiLCJpYXQiOjE3MzgwNDcxNjMsImV4cCI6MTczODA1Nzk2M30.Heq-J33LY9pJDnYOqmRhTTrSPqCpChtWxka_XUphnd4';

        console.log(`[DEBUG] 검색 시도: ${keyword}, 재시도 횟수: ${3 - retries}`);

        const requestData = JSON.stringify({
            keyword: keyword,
            page: 1
        });

        const options = {
            hostname: 'new.land.naver.com',
            path: '/api/search',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData),
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'authorization': authorization,
                'referer': 'https://new.land.naver.com/complexes',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'cookie': cookies
            }
        };

        const req = https.request(options, (response) => {
            let data = '';

            console.log(`[DEBUG] 응답 상태: ${response.statusCode}`);

            if (response.statusCode === 429) {
                if (retries > 0) {
                    const retryDelay = 2000;
                    console.log(`Rate limit 감지, ${retryDelay/1000}초 후 재시도... (남은 시도: ${retries})`);
                    setTimeout(() => {
                        searchComplexes(keyword, retries - 1)
                            .then(resolve)
                            .catch(reject);
                    }, retryDelay);
                    return;
                } else {
                    reject(new Error('Too Many Requests - Rate limit 초과'));
                    return;
                }
            }

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    console.log(`[DEBUG] 응답 데이터 길이: ${data.length}`);
                    console.log(`[DEBUG] 응답 샘플: ${data.substring(0, 200)}`);

                    const result = JSON.parse(data);
                    const complexes = result.complexes || [];

                    console.log(`[DEBUG] 파싱된 complexes 개수: ${complexes.length}`);

                    const processedResults = complexes
                        .filter(complex => complex.complexNo || complex.complexId || complex.id)
                        .map(complex => {
                            const complexId = complex.complexNo || complex.complexId || complex.id;
                            return {
                                complexNo: complexId,
                                complexName: complex.complexName || complex.name,
                                address: `${complex.address || ''} ${complex.detailAddress || ''}`.trim()
                            };
                        });

                    resolve(processedResults);
                } catch (error) {
                    if (retries > 0) {
                        console.log(`JSON 파싱 실패, 재시도... (남은 시도: ${retries})`);
                        setTimeout(() => {
                            searchComplexes(keyword, retries - 1)
                                .then(resolve)
                                .catch(reject);
                        }, 1000);
                    } else {
                        console.error('JSON 파싱 오류:', error);
                        console.error('파싱 실패한 데이터:', data);
                        reject(new Error(`JSON 파싱 오류: ${error.message}`));
                    }
                }
            });
        });

        req.on('error', (error) => {
            console.error(`[ERROR] 네트워크 오류: ${error.message}`);
            if (retries > 0) {
                setTimeout(() => {
                    searchComplexes(keyword, retries - 1)
                        .then(resolve)
                        .catch(reject);
                }, 1000);
            } else {
                reject(new Error(`API 요청 오류: ${error.message}`));
            }
        });

        req.setTimeout(25000, () => {
            req.destroy();
            reject(new Error('요청 시간 초과 (25초)'));
        });

        req.write(requestData);
        req.end();
    });
}