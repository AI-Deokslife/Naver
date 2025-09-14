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
        // Rate limiting을 위한 기본 지연 추가 (Vercel timeout 고려하여 5초로 조정)
        await new Promise(resolve => setTimeout(resolve, 5000));

        const searchResults = await searchComplexes(keyword);
        res.status(200).json(searchResults);
    } catch (error) {
        console.error('검색 오류:', error);
        if (error.message.includes('Too Many Requests')) {
            res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' });
        } else {
            res.status(500).json({ error: `검색 중 오류 발생: ${error.message}` });
        }
    }
}

function searchComplexes(keyword, retries = 3) {
    return new Promise((resolve, reject) => {
        // Flask 앱에서 사용하는 더 상세한 쿠키 설정
        // 동적으로 생성되는 쿠키와 토큰 (현재 시간 기반)
        const currentTime = new Date().toUTCString();
        const currentTimestamp = Date.now();

        const cookies = `NNB=FGYNFS4Y6M6WO; NFS=2; ASID=afd10077000001934e8033f50000004e; ba.uuid=a5e52e8f-1775-4eea-9b42-30223205f9df; tooltipDisplayed=true; nstore_session=zmRE1M3UHwL1GmMzBg0gfcKH; nstore_pagesession=iH4K+dqWcpYFllsM1U4-116496; NAC=XfPpC4A0XeLCA; page_uid=iHmGBsqVN8ossOXBRrlsssssswV-504443; nhn.realestate.article.rlet_type_cd=A01; nhn.realestate.article.trade_type_cd=""; nhn.realestate.article.ipaddress_city=1100000000; _fwb=242x1Ggncj6Dnv0G6JF6g8h.${currentTimestamp}; realestate.beta.lastclick.cortar=1174010900; landHomeFlashUseYn=N; BUC=fwUJCqRUIsM47V0-Lcz1VazTR9EQgUrBIxM1P_x9Id4=; REALESTATE=${currentTime}; NACT=1`;

        // 새로운 JWT 토큰 생성 (현재 시간 기반)
        const tokenPayload = Buffer.from(JSON.stringify({
            "id": "REALESTATE",
            "iat": Math.floor(Date.now() / 1000),
            "exp": Math.floor(Date.now() / 1000) + 10800
        })).toString('base64');
        const authorization = `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${tokenPayload}.Heq-J33LY9pJDnYOqmRhTTrSPqCpChtWxka_XUphnd4`;
        
        const url = new URL('https://new.land.naver.com/api/search');
        const params = {
            'keyword': keyword,
            'page': '1'
        };

        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        // 먼저 세션 초기화를 위해 /complexes 페이지 방문 (Flask 앱 방식)
        const initOptions = {
            hostname: 'new.land.naver.com',
            path: '/complexes',
            method: 'GET',
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'cookie': cookies
            }
        };

        console.log('[DEBUG] 세션 초기화 중...');
        const initReq = https.request(initOptions, (initResponse) => {
            console.log(`[DEBUG] 세션 초기화 응답: ${initResponse.statusCode}`);

            let initData = '';
            initResponse.on('data', (chunk) => {
                initData += chunk;
            });

            initResponse.on('end', () => {
                console.log('[DEBUG] 세션 초기화 완료, 검색 요청 시작...');

                // 세션 초기화 완료 후 실제 검색 요청
                const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                    'authorization': authorization,
                    'referer': 'https://new.land.naver.com/complexes',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'cookie': cookies
                }
            };

            const req = https.request(options, (response) => {
                let data = '';

                // Rate Limiting 및 인증 오류 체크
                if (response.statusCode === 429) {
                    if (retries > 0) {
                        const retryDelay = Math.pow(2, 4 - retries) * 15000;
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
                        console.log('=== API 응답 디버깅 ===');
                        console.log('응답 상태 코드:', response.statusCode);
                        console.log('응답 데이터 (처음 1000자):', data.substring(0, 1000));

                        const result = JSON.parse(data);
                        console.log('파싱된 결과 키들:', Object.keys(result));
                        console.log('complexes 배열 길이:', (result.complexes || []).length);

                        const complexes = result.complexes || [];
                        if (complexes.length > 0) {
                            console.log('첫 번째 complex 데이터:', complexes[0]);
                        }

                        // Flask 앱처럼 complexNo가 있는 항목만 필터링하고 필드명 매핑
                        const processedResults = complexes
                            .filter(complex => {
                                // complexNo 또는 다른 ID 필드가 있는 항목만
                                return complex.complexNo || complex.complexId || complex.id || complex.houseId || complex.aptId;
                            })
                            .map(complex => {
                                // 다양한 ID 필드명 통합
                                const complexId = complex.complexNo || complex.complexId || complex.id || complex.houseId || complex.aptId;

                                return {
                                    complexNo: complexId,
                                    complexName: complex.complexName || complex.name || complex.aptName || complex.houseName,
                                    address: `${complex.address || complex.location || ''} ${complex.detailAddress || complex.addressDetail || ''}`.trim()
                                };
                            });

                        console.log('처리된 결과 개수:', processedResults.length);
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
                            console.log('파싱 실패한 데이터:', data);
                            reject(new Error(`JSON 파싱 오류: ${error.message}`));
                        }
                    }
                });
            });

        req.on('error', (error) => {
            if (retries > 0) {
                console.log(`네트워크 오류, 재시도... (남은 시도: ${retries})`);
                setTimeout(() => {
                    searchComplexes(keyword, retries - 1)
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
        });

        initReq.on('error', (error) => {
            console.error('[DEBUG] 세션 초기화 실패:', error);
            if (retries > 0) {
                setTimeout(() => {
                    searchComplexes(keyword, retries - 1)
                        .then(resolve)
                        .catch(reject);
                }, 1000);
            } else {
                reject(new Error(`세션 초기화 오류: ${error.message}`));
            }
        });

        initReq.setTimeout(30000, () => {
            initReq.destroy();
            reject(new Error('세션 초기화 시간 초과'));
        });

        initReq.end();
    });
}