const https = require('https');
const { URL } = require('url');

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
        return res.status(400).json({ error: "'keyword'를 입력해주세요." });
    }

    try {
        const complexes = await getComplexesByRegion(keyword);
        res.status(200).json(complexes);
    } catch (error) {
        console.error('API 오류:', error);
        res.status(500).json({ error: error.message });
    }
}

function getComplexesByRegion(keyword) {
    return new Promise((resolve, reject) => {
        const cookies = 'NNB=FGYNFS4Y6M6WO; NFS=2; ASID=afd10077000001934e8033f50000004e; ba.uuid=a5e52e8f-1775-4eea-9b42-30223205f9df; tooltipDisplayed=true; nstore_session=zmRE1M3UHwL1GmMzBg0gfcKH; _fwb=242x1Ggncj6Dnv0G6JF6g8h.1738045585397; landHomeFlashUseYn=N; REALESTATE=Thu Apr 03 2025 20:14:11 GMT+0900 (Korean Standard Time); NACT=1';
        const authorization = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlJFQUxFU1RBVEUiLCJpYXQiOjE3MzgwNDcxNjMsImV4cCI6MTczODA1Nzk2M30.Heq-J33LY9pJDnYOqmRhTTrSPqCpChtWxka_XUphnd4';
        
        const url = new URL('https://new.land.naver.com/api/search');
        url.searchParams.append('keyword', keyword);
        url.searchParams.append('page', '1');

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'accept': '*/*',
                'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'authorization': authorization,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'cookie': cookies
            }
        };

        const req = https.request(options, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('네이버 API 응답:', JSON.stringify(result, null, 2));
                    
                    const complexes = result.complexes || [];
                    console.log('추출된 complexes:', complexes.length, '개');
                    
                    if (complexes.length > 0) {
                        console.log('첫 번째 complex 샘플:', complexes[0]);
                        console.log('Available fields:', Object.keys(complexes[0]));
                        
                        // complexNo 필드가 없는 경우 대체 필드 찾기
                        const firstComplex = complexes[0];
                        if (!firstComplex.complexNo) {
                            console.log('complexNo 필드가 없습니다. 대체 필드를 찾는 중...');
                            const possibleIdFields = ['complexId', 'id', 'houseId', 'aptId', 'complexNumber', 'no'];
                            for (const field of possibleIdFields) {
                                if (firstComplex[field]) {
                                    console.log(`대체 필드 발견: ${field} = ${firstComplex[field]}`);
                                    // 모든 complex 객체에 complexNo 필드 추가
                                    complexes.forEach(c => {
                                        c.complexNo = c[field];
                                    });
                                    break;
                                }
                            }
                        }
                    }
                    
                    complexes.sort((a, b) => a.complexName.localeCompare(b.complexName));
                    resolve(complexes);
                } catch (error) {
                    console.error('JSON 파싱 실패:', data);
                    reject(new Error(`JSON 파싱 오류: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`API 요청 오류: ${error.message}`));
        });

        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('요청 시간 초과'));
        });

        req.end();
    });
}