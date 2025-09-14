// DOM 요소들
const searchKeyword = document.getElementById('searchKeyword');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const complexNo = document.getElementById('complexNo');
const tradeType = document.getElementById('tradeType');
const fetchBtn = document.getElementById('fetchBtn');
const downloadBtn = document.getElementById('downloadBtn');
const listingResults = document.getElementById('listingResults');
const loadingSpinner = document.getElementById('loadingSpinner');

// 현재 매물 데이터 저장
let currentListingData = [];

// 로딩 상태 관리
function showLoading() {
    loadingSpinner.style.display = 'flex';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

// 에러 메시지 표시
function showError(container, message) {
    container.innerHTML = `<div class="error-message">❌ ${message}</div>`;
}

// 성공 메시지 표시
function showSuccess(container, message) {
    container.innerHTML = `<div class="success-message">✅ ${message}</div>`;
}

// API 기본 URL
const API_BASE = window.location.origin;

// 아파트 검색 함수
async function searchComplexes() {
    const keyword = searchKeyword.value.trim();
    
    if (!keyword) {
        showError(searchResults, '검색어를 입력해주세요.');
        return;
    }

    showLoading();
    searchBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/api/search_complexes?keyword=${encodeURIComponent(keyword)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            showError(searchResults, '검색 결과가 없습니다.');
        } else {
            displaySearchResults(data);
        }
    } catch (error) {
        console.error('검색 오류:', error);
        showError(searchResults, `검색 중 오류 발생: ${error.message}`);
    } finally {
        hideLoading();
        searchBtn.disabled = false;
    }
}

// 검색 결과 표시
function displaySearchResults(results) {
    const resultsHtml = `
        <h3>🏘️ 검색 결과 (${results.length}건)</h3>
        <div class="results-grid">
            ${results.map(result => `
                <div class="result-card" onclick="selectComplex('${result.복합단지번호}', '${result.아파트명}')">
                    <h3>${result.아파트명}</h3>
                    <p>📍 ${result.주소}</p>
                    <p>🏢 복합단지번호: <span class="complex-no">${result.복합단지번호}</span></p>
                </div>
            `).join('')}
        </div>
    `;
    searchResults.innerHTML = resultsHtml;
}

// 아파트 선택
function selectComplex(complexNumber, complexName) {
    complexNo.value = complexNumber;
    showSuccess(listingResults, `"${complexName}" 선택됨. 거래유형을 선택하고 매물 조회 버튼을 클릭하세요.`);
    
    // 매물 조회 섹션으로 스크롤
    document.querySelector('.listing-section').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

// 매물 조회 함수
async function fetchListings() {
    const complexNumber = complexNo.value.trim();
    const selectedTradeType = tradeType.value;
    
    if (!complexNumber) {
        showError(listingResults, '복합단지번호를 입력하거나 위에서 아파트를 선택해주세요.');
        return;
    }

    showLoading();
    fetchBtn.disabled = true;
    downloadBtn.style.display = 'none';
    currentListingData = [];

    try {
        const response = await fetch(`${API_BASE}/api/fetch_listings?complex_no=${complexNumber}&trade_type=${encodeURIComponent(selectedTradeType)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.length === 0) {
            showError(listingResults, '해당 조건의 매물이 없습니다.');
        } else {
            currentListingData = data;
            displayListingResults(data);
            downloadBtn.style.display = 'inline-block';
        }
    } catch (error) {
        console.error('매물 조회 오류:', error);
        showError(listingResults, `매물 조회 중 오류 발생: ${error.message}`);
    } finally {
        hideLoading();
        fetchBtn.disabled = false;
    }
}

// 매물 결과 표시
function displayListingResults(listings) {
    if (!listings || listings.length === 0) {
        showError(listingResults, '표시할 매물 데이터가 없습니다.');
        return;
    }

    const headers = Object.keys(listings[0]);
    
    const tableHtml = `
        <h3>🏠 매물 조회 결과 (${listings.length}건)</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${listings.map(listing => `
                        <tr>
                            ${headers.map(header => `<td>${listing[header] || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    listingResults.innerHTML = tableHtml;
}

// 엑셀 다운로드 함수
async function downloadExcel() {
    const complexNumber = complexNo.value.trim();
    const selectedTradeType = tradeType.value;
    
    if (!complexNumber) {
        showError(listingResults, '복합단지번호를 입력해주세요.');
        return;
    }

    showLoading();
    downloadBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/api/download_excel?complex_no=${complexNumber}&trade_type=${encodeURIComponent(selectedTradeType)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Blob으로 응답 받기
        const blob = await response.blob();
        
        // Content-Disposition 헤더에서 파일명 추출
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = '부동산_데이터.xlsx';
        
        if (contentDisposition) {
            const matches = contentDisposition.match(/filename\*=UTF-8''(.+)/);
            if (matches && matches[1]) {
                filename = decodeURIComponent(matches[1]);
            }
        }
        
        // 파일 다운로드
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showSuccess(listingResults, `엑셀 파일 "${filename}" 다운로드 완료! 📥`);
        
    } catch (error) {
        console.error('엑셀 다운로드 오류:', error);
        showError(listingResults, `엑셀 다운로드 중 오류 발생: ${error.message}`);
    } finally {
        hideLoading();
        downloadBtn.disabled = false;
    }
}

// 이벤트 리스너 등록
searchBtn.addEventListener('click', searchComplexes);
fetchBtn.addEventListener('click', fetchListings);
downloadBtn.addEventListener('click', downloadExcel);

// Enter 키 이벤트 처리
searchKeyword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchComplexes();
    }
});

complexNo.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchListings();
    }
});

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('부동산 검색 서비스가 로드되었습니다.');
    
    // URL 파라미터 체크 (복합단지번호가 있으면 자동 입력)
    const urlParams = new URLSearchParams(window.location.search);
    const complexParam = urlParams.get('complex_no');
    if (complexParam) {
        complexNo.value = complexParam;
    }
});