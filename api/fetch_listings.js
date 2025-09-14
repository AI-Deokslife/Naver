const https = require('https');
const { URL } = require('url');

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

function getRealEstateData(complexNo, tradeType, page = 1, retries = 3) {
    return new Promise((resolve, reject) => {
        const cookies = 'NNB=FGYNFS4Y6M6WO; NFS=2; ASID=afd10077000001934e8033f50000004e; ba.uuid=a5e52e8f-1775-4eea-9b42-30223205f9df; tooltipDisplayed=true; nstore_session=zmRE1M3UHwL1GmMzBg0gfcKH; nstore_pagesession=iH4K+dqWcpYFllsM1U4-116496; NAC=XfPpC4A0XeLCA; page_uid=iHmGBsqVN8ossOXBRrlsssssswV-504443; nhn.realestate.article.rlet_type_cd=A01; nhn.realestate.article.trade_type_cd=""; nhn.realestate.article.ipaddress_city=1100000000; _fwb=242x1Ggncj6Dnv0G6JF6g8h.1738045585397; realestate.beta.lastclick.cortar=1174010900; landHomeFlashUseYn=N; BUC=fwUJCqRUIsM47V0-Lcz1VazTR9EQgUrBIxM1P_x9Id4=; REALESTATE=Tue Jan 28 2025 16:23:02 GMT+0900 (Korean Standard Time); NACT=1';
        const authorization = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlJFQUxFU1RBVEUiLCJpYXQiOjE3MzgwNDcxNjMsImV4cCI6MTczODA1Nzk2M30.Heq-J33LY9pJDnYOqmRhTTrSPqCpChtWxka_XUphnd4';
        
        const url = new URL(`https://new.land.naver.com/api/articles/complex/${complexNo}`);
        const params = {
            'realEstateType': 'APT:PRE:ABYG:JGC',
            'tradeType': tradeType,
            'tag': '::::::::',
            'rentPriceMin': '0', 'rentPriceMax': '900000000',
            'priceMin': '0', 'priceMax': '900000000',
            'areaMin': '0', 'areaMax': '900000000',
            'showArticle': 'false', 'sameAddressGroup': 'false',
            'priceType': 'RETAIL', 'page': page.toString(),
            'complexNo': complexNo.toString(), 'type': 'list', 'order': 'rank'
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
                    const retryDelay = Math.pow(2, 4 - retries) * 2000;
                    console.log(`Rate limit 감지, ${retryDelay/1000}초 후 재시도... (남은 시도: ${retries})`);
                    setTimeout(() => {
                        getRealEstateData(complexNo, tradeType, page, retries - 1)
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
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (error) {
                    if (retries > 0) {
                        console.log(`JSON 파싱 실패, 재시도... (남은 시도: ${retries})`);
                        setTimeout(() => {
                            getRealEstateData(complexNo, tradeType, page, retries - 1)
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
                    getRealEstateData(complexNo, tradeType, page, retries - 1)
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
            const baseDelay = 1000;
            const dynamicDelay = baseDelay + (page * 200);
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