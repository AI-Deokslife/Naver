
from fastapi import FastAPI, HTTPException
import requests
import urllib3
from fastapi.middleware.cors import CORSMiddleware

# Suppress InsecureRequestWarning
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = FastAPI()

# CORS 미들웨어 추가 (개발 중 프론트엔드 테스트를 위해)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 배포 시에는 특정 도메인으로 제한하는 것이 안전합니다.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

proxies = {
    'http': None,
    'https': None,
}

def get_complexes_by_region(keyword: str):
    """네이버 부동산 API를 통해 아파트 단지 검색"""
    try:
        cookies = {
            'NNB': 'FGYNFS4Y6M6WO',
            'NFS': '2',
            'ASID': 'afd10077000001934e8033f50000004e',
            'ba.uuid': 'a5e52e8f-1775-4eea-9b42-30223205f9df',
            'tooltipDisplayed': 'true',
            'nstore_session': 'zmRE1M3UHwL1GmMzBg0gfcKH',
            '_fwb': '242x1Ggncj6Dnv0G6JF6g8h.1738045585397',
            'landHomeFlashUseYn': 'N',
            'REALESTATE': 'Thu Apr 03 2025 20:14:11 GMT+0900 (Korean Standard Time)',
            'NACT': '1',
        }
        headers = {
            'accept': '*/*',
            'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IlJFQUxFU1RBVEUiLCJpYXQiOjE3MzgwNDcxNjMsImV4cCI6MTczODA1Nzk2M30.Heq-J33LY9pJDnYOqmRhTTrSPqCpChtWxka_XUphnd4',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        }
        params = {'keyword': keyword, 'page': '1'}
        url = 'https://new.land.naver.com/api/search'
        
        session = requests.Session()
        session.headers.update(headers)
        session.cookies.update(cookies)
        session.proxies.update(proxies) # Added this line
        
        # 세션 초기화
        init_url = 'https://new.land.naver.com/complexes'
        init_response = session.get(init_url, verify=False, timeout=10)
        init_response.raise_for_status()
            
        response = session.get(url, params=params, verify=False, timeout=10)
        response.raise_for_status()
            
        data = response.json()
        complexes = data.get('complexes', [])
        if not complexes:
            return []
            
        complexes.sort(key=lambda x: x['complexName'])
        return complexes
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"API 요청 오류: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"내부 서버 오류: {e}")

@app.get("/")
async def search_complexes_api(keyword: str):
    if not keyword:
        raise HTTPException(status_code=400, detail="'keyword'를 입력해주세요.")
    
    complexes = get_complexes_by_region(keyword)
    return complexes
