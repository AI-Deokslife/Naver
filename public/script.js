
document.addEventListener('DOMContentLoaded', () => {
    // DOM 요소 가져오기
    const regionInput = document.getElementById('region-input');
    const searchBtn = document.getElementById('search-btn');
    const complexDropdown = document.getElementById('complex-dropdown');
    const tradeTypeDropdown = document.getElementById('trade-type-dropdown');
    const fetchBtn = document.getElementById('fetch-btn');
    const downloadBtn = document.getElementById('download-btn');
    const statusText = document.getElementById('status-text');
    const tableContainer = document.getElementById('table-container');

    let fetchedData = []; // 데이터 수집 결과를 저장할 변수

    // --- 이벤트 리스너 설정 ---
    searchBtn.addEventListener('click', searchComplexes);
    regionInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            searchComplexes();
        }
    });
    complexDropdown.addEventListener('change', () => {
        if (complexDropdown.value) {
            fetchBtn.disabled = false;
        } else {
            fetchBtn.disabled = true;
        }
        downloadBtn.disabled = true; // 단지 선택이 바뀌면 다운로드 버튼 비활성화
    });
    fetchBtn.addEventListener('click', fetchListings);
    downloadBtn.addEventListener('click', downloadExcel);

    // --- 함수 구현 ---

    /** 1. 지역 검색 함수 */
    async function searchComplexes() {
        const keyword = regionInput.value.trim();
        if (!keyword) {
            alert('지역명을 입력해주세요.');
            return;
        }

        updateStatus('지역 검색 중...', true);
        complexDropdown.innerHTML = '<option>검색 중...</option>';
        complexDropdown.disabled = true;
        fetchBtn.disabled = true;
        downloadBtn.disabled = true;

        try {
            // Vercel 환경에서는 상대 경로로 API 호출이 가능합니다.
            const response = await fetch(`/api/search_complexes?keyword=${encodeURIComponent(keyword)}`);
            if (!response.ok) {
                throw new Error(`서버 오류: ${response.statusText}`);
            }
            const complexes = await response.json();
            console.log('받은 complexes 데이터:', complexes);

            if (complexes.length === 0) {
                updateStatus('해당 지역에 검색된 아파트 단지가 없습니다.', false);
                complexDropdown.innerHTML = '<option value="">검색 결과 없음</option>';
                return;
            }

            complexDropdown.innerHTML = ''; // 기존 옵션 삭제
            complexes.forEach((c, index) => {
                console.log(`Complex ${index}:`, c);
                const option = document.createElement('option');
                // complexNo를 option의 value로 저장
                option.value = c.complexNo;
                console.log(`Setting option value to: ${c.complexNo}`);
                option.textContent = `${c.complexName} (${c.address})`
                complexDropdown.appendChild(option);
            });

            complexDropdown.disabled = false;
            fetchBtn.disabled = false;
            updateStatus(`'${keyword}' 검색 완료. ${complexes.length}개 단지 발견.`, false);

        } catch (error) {
            console.error('지역 검색 오류:', error);
            updateStatus('지역 검색 중 오류가 발생했습니다.', false);
            complexDropdown.innerHTML = '<option value="">오류 발생</option>';
        }
    }

    /** 2. 매물 정보 수집 함수 */
    async function fetchListings() {
        const complexNo = complexDropdown.value;
        const tradeType = tradeTypeDropdown.value;
        const selectedComplexName = complexDropdown.options[complexDropdown.selectedIndex].text;

        console.log('매물 수집 시작:');
        console.log('- complexNo:', complexNo);
        console.log('- tradeType:', tradeType);
        console.log('- selectedComplexName:', selectedComplexName);

        if (!complexNo) {
            console.error('complexNo가 없습니다!');
            alert('아파트 단지를 선택해주세요.');
            return;
        }

        updateStatus(`'${selectedComplexName}' 매물 수집 중... (시간이 걸릴 수 있습니다)`, true);
        fetchBtn.disabled = true;
        downloadBtn.disabled = true;
        tableContainer.innerHTML = '';

        try {
            const response = await fetch(`/api/fetch_listings?complex_no=${complexNo}&trade_type=${tradeType}`);
            if (!response.ok) {
                throw new Error(`서버 오류: ${response.statusText}`);
            }
            fetchedData = await response.json();

            if (fetchedData.length === 0) {
                updateStatus('해당 조건의 매물이 없습니다.', false);
                tableContainer.innerHTML = '<p>조건에 맞는 매물이 없습니다.</p>';
                return;
            }

            renderTable(fetchedData);
            updateStatus(`총 ${fetchedData.length}개의 매물을 찾았습니다.`, false);
            downloadBtn.disabled = false;

        } catch (error) {
            console.error('매물 수집 오류:', error);
            updateStatus('매물 수집 중 오류가 발생했습니다.', false);
        } finally {
            fetchBtn.disabled = false;
        }
    }

    /** 3. 엑셀 다운로드 함수 */
    function downloadExcel() {
        const complexNo = complexDropdown.value;
        const tradeType = tradeTypeDropdown.value;

        if (!complexNo) {
            alert('아파트 단지를 선택해주세요.');
            return;
        }
        if (fetchedData.length === 0) {
            alert('먼저 데이터를 수집해주세요.');
            return;
        }

        const downloadUrl = `/api/download_excel?complex_no=${complexNo}&trade_type=${tradeType}`;
        // 새 창이나 현재 창에서 URL을 열어 다운로드 트리거
        window.location.href = downloadUrl;
        updateStatus('엑셀 파일을 다운로드합니다.', false);
    }

    /** 4. 테이블 렌더링 함수 */
    function renderTable(data) {
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');

        // 헤더 생성
        const headers = Object.keys(data[0]);
        const headerRow = document.createElement('tr');
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // 본문 생성
        data.forEach(row => {
            const bodyRow = document.createElement('tr');
            headers.forEach(header => {
                const td = document.createElement('td');
                td.textContent = row[header];
                bodyRow.appendChild(td);
            });
            tbody.appendChild(bodyRow);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        tableContainer.innerHTML = ''; // 기존 테이블 삭제
        tableContainer.appendChild(table);
    }

    /** 5. 상태 업데이트 함수 */
    function updateStatus(message, isLoading) {
        statusText.textContent = message;
        if (isLoading) {
            statusText.style.color = 'var(--accent-color-2)';
        } else {
            statusText.style.color = 'var(--primary-text)';
        }
    }
});
