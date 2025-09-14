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
        return res.status(400).json({ error: '검색어를 입력해주세요.' });
    }

    try {
        const searchResults = await searchComplexes(keyword);
        res.status(200).json(searchResults);
    } catch (error) {
        console.error('검색 오류:', error);
        res.status(500).json({ error: `검색 중 오류 발생: ${error.message}` });
    }
}

function searchComplexes(keyword) {
    return new Promise((resolve, reject) => {
        const cookies = 'NNB=FGYNFS4Y6M6WO; NFS=2; ASID=afd10077000001934e8033f50000004e; ba.uuid=a5e52e8f-1775-4eea-9b42-30223205f9df; tooltipDisplayed=true; nstore_session=zmRE1M3UHwL1GmMzBg0gfcKH; nstore_pagesession=iH4K+dqWcpYFllsM1U4-116496; NAC=XfPpC4A0XeLCA; page_uid=iHmGBsqVN8ossOXBRrlsssssswV-504443; nhn.realestate.article.rlet_type_cd=A01; nhn.realestate.article.trade_type_cd=""; nhn.realestate.article.ipaddress_city=1100000000; _fwb=242x1Ggncj6Dnv0G6JF6g8h.1738045585397; realestate.beta.lastclick.cortar=1174010900; landHomeFlashUseYn=N; BUC=fwUJCqRUIsM47V0-Lcz1VazTR9EQgUrBIxM1P_x9Id4=; REALESTATE=Tue Jan 28 2025 16:23:02 GMT+0900 (Korean Standard Time); NACT=1';
        const authorization = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlJFQUxFU1RBVEUiLCJpYXQiOjE3MzgwNDcxNjMsImV4cCI6MTczODA1Nzk2M30.Heq-J33LY9pJDnYOqmRhTTrSPqCpChtWxka_XUphnd4';
        
        const url = new URL('https://new.land.naver.com/api/suggest');
        const params = {
            'type': 'complex',
            'q': keyword
        };

        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'accept': '*/*',
                'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'authorization': authorization,
                'referer': 'https://new.land.naver.com/',
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
                    const complexes = result.complexList || [];
                    
                    const processedResults = complexes.map(complex => ({
                        복합단지번호: complex.complexNo,
                        아파트명: complex.complexName,
                        주소: complex.address
                    }));
                    
                    resolve(processedResults);
                } catch (error) {
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