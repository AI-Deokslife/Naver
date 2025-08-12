const https = require('https');
const { URL } = require('url');

// 토큰과 쿠키 갱신을 위한 함수들
function generateFreshToken() {
    // JWT 형태의 토큰 생성 (실제로는 네이버에서 발급받아야 함)
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
        id: "REALESTATE",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600 // 1시간 후 만료
    })).toString('base64');
    return `Bearer ${header}.${payload}.signature`;
}

function generateFreshCookies() {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    return `NNB=FGYNFS4Y6M6WO; NFS=2; ASID=afd10077000001934e8033f50000004e; ba.uuid=a5e52e8f-1775-4eea-9b42-30223205f9df; tooltipDisplayed=true; nstore_session=zmRE1M3UHwL1GmMzBg0gfcKH; nstore_pagesession=iH4K+dqWcpYFllsM1U4-116496; NAC=XfPpC4A0XeLCA; page_uid=iHmGBsqVN8ossOXBRrlsssssswV-${randomId}; nhn.realestate.article.rlet_type_cd=A01; nhn.realestate.article.trade_type_cd=""; nhn.realestate.article.ipaddress_city=1100000000; _fwb=242x1Ggncj6Dnv0G6JF6g8h.${timestamp}; realestate.beta.lastclick.cortar=1174010900; landHomeFlashUseYn=N; BUC=fwUJCqRUIsM47V0-Lcz1VazTR9EQgUrBIxM1P_x9Id4=; REALESTATE=${new Date().toString()}; NACT=1`;
}

const TRADE_TYPE_MAPPING = {
    "전체": "",
    "매매": "A1",
    "전세": "B1", 
    "월세": "B2"
};

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

    const { complex_no, trade_type } = req.query;

    if (!complex_no || !trade_type) {
        return res.status(400).json({ error: 'complex_no와 trade_type을 모두 입력해주세요.' });
    }

    try {
        const allData = await fetchAllPages(complex_no, trade_type);
        res.status(200).json(allData);
    } catch (error) {
        console.error('데이터 수집 오류:', error);
        res.status(500).json({ error: `데이터 수집 중 오류 발생: ${error.message}` });
    }
}

function getRealEstateData(complexNo, tradeType, page = 1, retries = 3, useOldCredentials = true) {
    return new Promise((resolve, reject) => {
        // 기본 인증 정보 사용 또는 갱신된 정보 사용
        const cookies = useOldCredentials ? 
            'NNB=FGYNFS4Y6M6WO; NFS=2; ASID=afd10077000001934e8033f50000004e; ba.uuid=a5e52e8f-1775-4eea-9b42-30223205f9df; tooltipDisplayed=true; nstore_session=zmRE1M3UHwL1GmMzBg0gfcKH; nstore_pagesession=iH4K+dqWcpYFllsM1U4-116496; NAC=XfPpC4A0XeLCA; page_uid=iHmGBsqVN8ossOXBRrlsssssswV-504443; nhn.realestate.article.rlet_type_cd=A01; nhn.realestate.article.trade_type_cd=""; nhn.realestate.article.ipaddress_city=1100000000; _fwb=242x1Ggncj6Dnv0G6JF6g8h.1738045585397; realestate.beta.lastclick.cortar=1174010900; landHomeFlashUseYn=N; BUC=fwUJCqRUIsM47V0-Lcz1VazTR9EQgUrBIxM1P_x9Id4=; REALESTATE=Tue Jan 28 2025 16:23:02 GMT+0900 (Korean Standard Time); NACT=1' :
            generateFreshCookies();
            
        const authorization = useOldCredentials ? 
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlJFQUxFU1RBVEUiLCJpYXQiOjE3MzgwNDcxNjMsImV4cCI6MTczODA1Nzk2M30.Heq-J33LY9pJDnYOqmRhTTrSPqCpChtWxka_XUphnd4' :
            generateFreshToken();
        
        const url = new URL(`https://new.land.naver.com/api/articles/complex/${complexNo}`);
        const params = {
            'realEstateType': 'APT:PRE:ABYG:JGC',
            'tradeType': tradeType,
            'tag': '::::::::',
            'rentPriceMin': '0',
            'rentPriceMax': '900000000',
            'priceMin': '0',
            'priceMax': '900000000',
            'areaMin': '0',
            'areaMax': '900000000',
            'showArticle': 'false',
            'sameAddressGroup': 'false',
            'priceType': 'RETAIL',
            'page': page.toString(),
            'complexNo': complexNo.toString(),
            'type': 'list',
            'order': 'rank'
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
                'referer': `https://new.land.naver.com/complexes/${complexNo}`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'cookie': cookies
            }
        };

        const req = https.request(options, (response) => {
            let data = '';

            // Rate Limiting 및 인증 오류 체크
            if (response.statusCode === 429) {
                if (retries > 0) {
                    const retryDelay = Math.pow(2, 4 - retries) * 2000; // 2초, 4초, 8초 백오프
                    console.log(`Rate limit 감지, ${retryDelay/1000}초 후 재시도... (남은 시도: ${retries})`);
                    setTimeout(() => {
                        getRealEstateData(complexNo, tradeType, page, retries - 1, useOldCredentials)
                            .then(resolve)
                            .catch(reject);
                    }, retryDelay);
                    return;
                } else {
                    reject(new Error('Too Many Requests - Rate limit 초과'));
                    return;
                }
            }

            // 인증 오류 (401, 403) 체크 - 토큰/쿠키 갱신 필요
            if ((response.statusCode === 401 || response.statusCode === 403) && useOldCredentials && retries > 0) {
                console.log('인증 오류 감지, 새로운 인증 정보로 재시도...');
                setTimeout(() => {
                    getRealEstateData(complexNo, tradeType, page, retries - 1, false) // 새로운 인증 정보 사용
                        .then(resolve)
                        .catch(reject);
                }, 1000);
                return;
            }

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (error) {
                    if (retries > 0) {
                        console.log(`JSON 파싱 실패, 재시도... (남은 시도: ${retries})`);
                        setTimeout(() => {
                            getRealEstateData(complexNo, tradeType, page, retries - 1, useOldCredentials)
                                .then(resolve)
                                .catch(reject);
                        }, 1000);
                    } else {
                        reject(new Error(`JSON 파싱 오류: ${error.message}`));
                    }
                }
            });
        });

        req.on('error', (error) => {
            if (retries > 0) {
                console.log(`네트워크 오류, 재시도... (남은 시도: ${retries})`);
                setTimeout(() => {
                    getRealEstateData(complexNo, tradeType, page, retries - 1, useOldCredentials)
                        .then(resolve)
                        .catch(reject);
                }, 1000);
            } else {
                reject(new Error(`API 요청 오류: ${error.message}`));
            }
        });

        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('요청 시간 초과'));
        });

        req.end();
    });
}

function processData(data) {
    if (!data || !data.articleList) {
        return [];
    }
    
    const articles = data.articleList || [];
    const processedData = [];
    
    for (const article of articles) {
        const tags = article.tagList ? article.tagList.join(', ') : '';
        const processedArticle = {
            '아파트명': article.articleName,
            '거래유형': article.tradeTypeName,
            '층수': article.floorInfo,
            '월세': article.rentPrc,
            '거래가격': article.dealOrWarrantPrc,
            '면적(m²)': article.area2,
            '방향': article.direction,
            '등록일': article.articleConfirmYmd,
            '동': article.buildingName,
            '중개사무소': article.realtorName,
            '특징': tags,
            '특징설명': article.articleFeatureDesc || ''
        };
        processedData.push(processedArticle);
    }
    
    return processedData;
}

async function fetchAllPages(complexNo, tradeTypeKey) {
    const allData = [];
    let page = 1;
    const tradeType = TRADE_TYPE_MAPPING[tradeTypeKey] || "";

    while (true) {
        try {
            const responseData = await getRealEstateData(complexNo, tradeType, page);
            
            if (!responseData || !responseData.articleList) {
                break;
            }
            
            const processedData = processData(responseData);
            allData.push(...processedData);
            
            if (!responseData.isMoreData) {
                break;
            }
            
            page++;
            // 동적 딜레이 시스템: 페이지 번호에 따라 딜레이 증가
            const baseDelay = 1000; // 기본 1초
            const dynamicDelay = baseDelay + (page * 200); // 페이지마다 200ms 추가
            console.log(`페이지 ${page} 완료, ${dynamicDelay/1000}초 대기...`);
            await new Promise(resolve => setTimeout(resolve, dynamicDelay));
        } catch (error) {
            console.error(`페이지 ${page} 처리 중 오류:`, error);
            break;
        }
    }
    
    // 등록일로 정렬
    allData.sort((a, b) => {
        const dateA = a['등록일'] || '99999999';
        const dateB = b['등록일'] || '99999999';
        return dateA.localeCompare(dateB);
    });
    
    return allData;
}