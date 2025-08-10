const https = require('https');
const { URL } = require('url');
const ExcelJS = require('exceljs');

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
        
        if (!allData || allData.length === 0) {
            return res.status(404).json({ error: '다운로드할 데이터가 없습니다.' });
        }

        const excelBuffer = await createExcelInMemory(allData);
        const title = allData[0]['아파트명'] || '부동산_데이터';
        const filename = `${title}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        
        res.status(200).send(excelBuffer);
    } catch (error) {
        console.error('엑셀 생성 오류:', error);
        res.status(500).json({ error: `엑셀 생성 중 오류 발생: ${error.message}` });
    }
}

function getRealEstateData(complexNo, tradeType, page = 1) {
    return new Promise((resolve, reject) => {
        const cookies = 'NNB=FGYNFS4Y6M6WO; REALESTATE=Tue Jan 28 2025 16:23:02 GMT+0900 (Korean Standard Time)';
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
                    resolve(result);
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

function processData(data) {
    if (!data || !data.articleList) {
        return [];
    }
    
    const articles = data.articleList || [];
    const processedData = [];
    
    for (const article of articles) {
        const tags = article.tagList ? article.tagList.join(', ') : '';
        const processedArticle = {
            '순번': 'N/A', // 나중에 순번 추가
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
            '특징': tags
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
            await new Promise(resolve => setTimeout(resolve, 500));
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

async function createExcelInMemory(data) {
    if (!data || data.length === 0) {
        throw new Error('생성할 데이터가 없습니다.');
    }

    const workbook = new ExcelJS.Workbook();
    const title = data[0]['아파트명'] || '부동산_데이터';
    
    // 아파트명 컬럼 제거
    data.forEach(row => {
        if ('아파트명' in row) {
            delete row['아파트명'];
        }
    });

    const headers = Object.keys(data[0]);
    const worksheet = workbook.addWorksheet(title.length <= 31 ? title : title.substr(0, 31));

    // 제목 행
    worksheet.mergeCells(1, 1, 1, headers.length);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // 헤더 행
    const headerRow = worksheet.getRow(3);
    headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' }
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    // 데이터 행
    data.forEach((rowData, rowIndex) => {
        const row = worksheet.getRow(rowIndex + 4);
        headers.forEach((header, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            
            if (header === '순번') {
                cell.value = rowIndex + 1;
            } else {
                cell.value = rowData[header];
            }
            
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });

    // 컬럼 너비 자동 조정
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength + 2;
    });

    // 엑셀 파일을 버퍼로 생성
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}