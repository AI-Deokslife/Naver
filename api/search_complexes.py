
import requests
import urllib3
import json
from urllib.parse import parse_qs

# Suppress InsecureRequestWarning
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_complexes_by_region(keyword: str):
    try:
        cookies = {
            'NNB': 'FGYNFS4Y6M6WO',
            'NFS': '2',
            'ASID': 'afd10077000001934e8033f50000004e',
            'ba.uuid': 'a5e52e8f-1775-4eea-9b42-30223205f9df',
        }
        headers = {
            'accept': '*/*',
            'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlJFQUxFU1RBVEUiLCJpYXQiOjE3MzgwNDcxNjMsImV4cCI6MTczODA1Nzk2M30.Heq-J33LY9pJDnYOqmRhTTrSPqCpChtWxka_XUphnd4',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        }
        params = {'keyword': keyword, 'page': '1'}
        url = 'https://new.land.naver.com/api/search'
        
        response = requests.get(url, params=params, cookies=cookies, headers=headers, timeout=30, verify=False)
        response.raise_for_status()
        
        data = response.json()
        complexes = data.get('complexes', [])
        complexes.sort(key=lambda x: x['complexName'])
        return complexes
    except requests.exceptions.RequestException as e:
        raise Exception(f"API 요청 오류: {e}")
    except Exception as e:
        raise Exception(f"내부 서버 오류: {e}")

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
        # Query string에서 keyword 파라미터 가져오기
        query_params = event.get('queryStringParameters') or {}
        keyword = query_params.get('keyword')
        
        if not keyword:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': "'keyword'를 입력해주세요."}, ensure_ascii=False)
            }
        
        # 지역 검색 실행
        complexes = get_complexes_by_region(keyword)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(complexes, ensure_ascii=False)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }
