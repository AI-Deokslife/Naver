
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
    let currentPage = 1; // 현재 페이지
    let itemsPerPage = 20; // 페이지당 항목 수 고정
    let sortColumn = null; // 정렬 중인 컬럼
    let sortDirection = 'asc'; // 정렬 방향

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
                
                // complexNo 대신 다른 ID 필드 사용 (API에서 자동 매핑됨)
                const complexId = c.complexNo || c.complexId || c.id || c.houseId || c.aptId || index;
                option.value = complexId;
                console.log(`Setting option value to: ${complexId}`);
                
                // 고유번호 및 괄호 제거, 아파트명만 표시
                option.textContent = c.complexName;
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

            currentPage = 1; // 새 데이터 시 첫 페이지로
            renderTable();
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

    /** 4. 데이터 정렬 함수 */
    function sortData(column) {
        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'asc';
        }

        fetchedData.sort((a, b) => {
            let valueA = a[column] || '';
            let valueB = b[column] || '';

            // 숫자인 경우 숫자 비교
            if (!isNaN(valueA) && !isNaN(valueB)) {
                valueA = parseFloat(valueA);
                valueB = parseFloat(valueB);
            }

            if (sortDirection === 'asc') {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            } else {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            }
        });

        currentPage = 1; // 정렬 후 첫 페이지로
        renderTable();
    }

    /** 5. 테이블 렌더링 함수 (페이지네이션 포함) */
    function renderTable() {
        if (fetchedData.length === 0) return;

        // 페이지네이션 계산
        const totalItems = fetchedData.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        const currentData = fetchedData.slice(startIndex, endIndex);

        // 테이블 생성
        const table = document.createElement('table');
        table.className = 'data-table';

        // 헤더 생성 - 순번 추가하고 특징설명 제외
        const originalHeaders = Object.keys(fetchedData[0]);
        const headers = ['순번', ...originalHeaders.filter(h => h !== '특징설명')];
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            
            if (header !== '순번') {
                th.style.cursor = 'pointer';
                th.className = 'sortable-header';
                
                // 현재 정렬 중인 컬럼 표시
                if (sortColumn === header) {
                    th.textContent += sortDirection === 'asc' ? ' ↑' : ' ↓';
                    th.classList.add('sorted');
                }
                
                th.addEventListener('click', () => sortData(header));
            }
            
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // 데이터 행 생성
        const tbody = document.createElement('tbody');
        currentData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.addEventListener('click', () => showFeaturePopup(item));
            
            headers.forEach(header => {
                const td = document.createElement('td');
                if (header === '순번') {
                    td.textContent = startIndex + index + 1;
                } else {
                    td.textContent = item[header] || '';
                }
                row.appendChild(td);
            });
            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);

        // 페이지네이션 컨트롤 생성
        const pagination = createPagination(totalPages, currentPage);
        const infoDiv = document.createElement('div');
        infoDiv.className = 'table-info';
        infoDiv.textContent = `${startIndex + 1}-${endIndex} / 총 ${totalItems}개 (${totalPages}페이지)`;

        // 컨테이너 업데이트
        tableContainer.innerHTML = '';
        tableContainer.appendChild(infoDiv);
        tableContainer.appendChild(table);
        tableContainer.appendChild(pagination);
    }

    /** 6. 페이지네이션 컨트롤 생성 */
    function createPagination(totalPages, current) {
        const pagination = document.createElement('div');
        pagination.className = 'pagination';

        // 이전 버튼
        if (current > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = '이전';
            prevBtn.addEventListener('click', () => {
                currentPage = current - 1;
                renderTable();
            });
            pagination.appendChild(prevBtn);
        }

        // 페이지 번호 버튼들
        const startPage = Math.max(1, current - 2);
        const endPage = Math.min(totalPages, current + 2);

        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => {
                currentPage = 1;
                renderTable();
            });
            pagination.appendChild(firstBtn);
            
            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                pagination.appendChild(dots);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            if (i === current) {
                pageBtn.classList.add('active');
            }
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                renderTable();
            });
            pagination.appendChild(pageBtn);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                pagination.appendChild(dots);
            }
            
            const lastBtn = document.createElement('button');
            lastBtn.textContent = totalPages;
            lastBtn.addEventListener('click', () => {
                currentPage = totalPages;
                renderTable();
            });
            pagination.appendChild(lastBtn);
        }

        // 다음 버튼
        if (current < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.textContent = '다음';
            nextBtn.addEventListener('click', () => {
                currentPage = current + 1;
                renderTable();
            });
            pagination.appendChild(nextBtn);
        }

        return pagination;
    }

    /** 7. 특징설명 팝업 함수 */
    function showFeaturePopup(item) {
        const featureDesc = item['특징설명'] || '특징설명이 없습니다.';
        const apartmentName = item['아파트명'] || '매물';
        const floor = item['층수'] || '';
        const area = item['면적(m²)'] || '';
        
        // 기존 팝업이 있다면 제거
        const existingPopup = document.querySelector('.feature-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
        
        // 팝업 생성
        const popup = document.createElement('div');
        popup.className = 'feature-popup';
        popup.innerHTML = `
            <div class="popup-overlay">
                <div class="popup-content">
                    <div class="popup-header">
                        <h3>${apartmentName} ${floor} ${area}</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="popup-body">
                        <h4>매물 특징설명</h4>
                        <p>${featureDesc}</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // 닫기 이벤트
        const closeBtn = popup.querySelector('.close-btn');
        const overlay = popup.querySelector('.popup-overlay');
        
        closeBtn.addEventListener('click', () => popup.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) popup.remove();
        });
        
        // ESC 키로 닫기
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                popup.remove();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }

    /** 8. 상태 업데이트 함수 */
    function updateStatus(message, isLoading) {
        statusText.textContent = message;
        if (isLoading) {
            statusText.style.color = 'var(--accent-color-2)';
        } else {
            statusText.style.color = 'var(--primary-text)';
        }
    }
});
