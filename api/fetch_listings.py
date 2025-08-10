
import requests
import urllib3
import time
import json

# Suppress InsecureRequestWarning
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

TRADE_TYPE_MAPPING = {
    "전체": "",
    "매매": "A1",
    "전세": "B1",
    "월세": "B2"
}

def get_real_estate_data(complex_no: str, trade_type: str, page: int = 1):
    try:
        cookies = {
            'NNB': 'FGYNFS4Y6M6WO',
            'REALESTATE': 'Tue Jan 28 2025 16:23:02 GMT+0900 (Korean Standard Time)',
        }
        headers = {
            'accept': '*/*',
            'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlJFQUxFU1RBVEUiLCJpYXQiOjE3MzgwNDcxNjMsImV4cCI6MTczODA1Nzk2M30.Heq-J33LY9pJDnYOqmRhTTrSPqCpChtWxka_XUphnd4',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        }
        params = {
            'realEstateType': 'APT:PRE:ABYG:JGC',
            'tradeType': trade_type,
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
            'page': str(page),
            'complexNo': str(complex_no),
            'type': 'list',
            'order': 'rank'
        }
        url = f'https://new.land.naver.com/api/articles/complex/{complex_no}'
        response = requests.get(url, params=params, cookies=cookies, headers=headers, timeout=30, verify=False)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"매물 정보 API 요청 오류: {e}")
        return None

def process_data(data):
    if not data or 'articleList' not in data:
        return []
    
    articles = data.get('articleList', [])
    processed_data = []
    for article in articles:
        tags = ', '.join(article.get('tagList', [])) if article.get('tagList') else ''
        processed_article = {
            '아파트명': article.get('articleName'),
            '거래유형': article.get('tradeTypeName'),
            '층수': article.get('floorInfo'),
            '월세': article.get('rentPrc'),
            '거래가격': article.get('dealOrWarrantPrc'),
            '면적(m²)': article.get('area2'),
            '방향': article.get('direction'),
            '등록일': article.get('articleConfirmYmd'),
            '동': article.get('buildingName'),
            '중개사무소': article.get('realtorName'),
            '특징': tags
        }
        processed_data.append(processed_article)
    return processed_data

def fetch_all_pages(complex_no: str, trade_type_key: str):
    all_data = []
    page = 1
    trade_type = TRADE_TYPE_MAPPING.get(trade_type_key, "")

    while True:
        response_data = get_real_estate_data(complex_no, trade_type, page)
        if not response_data or not response_data.get('articleList'):
            break
        
        processed_data = process_data(response_data)
        all_data.extend(processed_data)
        
        if not response_data.get('isMoreData', False):
            break
        page += 1
        time.sleep(0.5) # 네이버 서버에 대한 과도한 요청 방지
        
    all_data.sort(key=lambda x: x['등록일'] if x['등록일'] else '99999999')
    return all_data

def handler(event, context):
    """Vercel Serverless Function handler"""
    
    # CORS 헤더 설정
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    }
    
    # OPTIONS 요청 (preflight) 처리
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }
    
    try:
        # Query string에서 파라미터 가져오기
        query_params = event.get('queryStringParameters') or {}
        complex_no = query_params.get('complex_no')
        trade_type = query_params.get('trade_type')
        
        if not complex_no or not trade_type:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'complex_no와 trade_type을 모두 입력해주세요.'}, ensure_ascii=False)
            }
        
        # 매물 정보 가져오기
        all_data = fetch_all_pages(complex_no, trade_type)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(all_data, ensure_ascii=False)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': f'데이터 수집 중 오류 발생: {str(e)}'}, ensure_ascii=False)
        }
