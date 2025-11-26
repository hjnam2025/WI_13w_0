// Map and marker variables
let map;
let markers = [];
let markerClusterGroup;
let usableClusterGroup;
let territorialLayer; 
let portLayer; 
let currentLayer;
let allIslands = [];
let allPorts = []; 
let islandMarkers = new Map(); 
let portMarkers = new Map(); 
let regionPolygon = null; 

// 리스트 데이터
let currentIslandListItems = []; 
let currentViewportItems = [];

// 경로 데이터
const ferryRoutes = [
    { island: "팔미도", port: "인천항 연안부두" },
    { island: "차귀도", port: "자구내포구" },
    { island: "소쿠리섬", port: "명동선착장" },
    { island: "소매물도 등대섬", port: "통영항" },
    { island: "질마도", port: "회진항" }, 
    { island: "옹도", port: "안흥외항" },
    { island: "할미도", port: "무한의 다리" },
    { island: "사승봉도", port: "승봉도 선착장" }
];

let islandCoords = {}; 
let portCoords = {};

const territorialIslands = [
    "호미곶", "1.5미이터암", "생도", "간여암", "하백도", 
    "사수도", "절명서", "소국흘도", "고서", "직도", "서격렬비도", "소령도",
    "홍도"
];

const regionMapping = {
    '경기도': ['경기도', '인천광역시'],
    '충청도': ['충청북도', '충청남도', '세종특별자치시'],
    '전라남도': ['전라남도'],
    '전라북도': ['전라북도', '전북특별자치도'],
    '경상남도': ['경상남도', '부산광역시', '울산광역시'],
    '경상북도': ['경상북도', '대구광역시'],
    '강원도': ['강원특별자치도', '강원도'],
    '제주도': ['제주특별자치도', '제주도']
};

const mapStyles = {
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri', maxZoom: 19 }),
    mystyle: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19 }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO', maxZoom: 19 })
};

function getSolidMarkerSvg(color, size) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="rgba(0,0,0,0.2)"/>
    </svg>`;
}

function updatePortMarkers() {
    if (!map) return;
    const currentZoom = map.getZoom();
    let newSize = 20 + (currentZoom - 6) * 5;
    if (newSize < 15) newSize = 15; 
    if (newSize > 60) newSize = 60; 
    
    const portMarkers = document.querySelectorAll('.port-marker-content');
    portMarkers.forEach(el => {
        el.style.fontSize = `${newSize}px`;
        el.style.lineHeight = `${newSize}px`;
        el.style.width = `${newSize}px`;
        el.style.height = `${newSize}px`;
    });
}

// ▼▼▼ 수정됨: 좌표 변환 함수 (버그 수정) ▼▼▼
function dmsToDecimal(dmsString) {
    if (!dmsString || typeof dmsString !== 'string') return null;
    const cleaned = dmsString.trim();
    
    // 1. 도분초(DMS) 형식 확인 (예: 34° 26′ 13.74″N)
    let dmsMatch = cleaned.match(/(\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]\s*([NSEW])/);
    if (dmsMatch) {
        let decimal = parseFloat(dmsMatch[1]) + (parseFloat(dmsMatch[2]) / 60) + (parseFloat(dmsMatch[3]) / 3600);
        if (dmsMatch[4] === 'S' || dmsMatch[4] === 'W') decimal = -decimal;
        return decimal;
    }

    // 2. 소수점(Decimal) 형식 확인 (예: 34.1234 N 또는 그냥 34.1234)
    let decimalMatch = cleaned.match(/(-?\d+\.?\d*)\s*([NSEW])?/);
    if (decimalMatch) {
        let decimal = parseFloat(decimalMatch[1]);
        if (decimalMatch[2] === 'S' || decimalMatch[2] === 'W') decimal = -decimal;
        return decimal;
    }

    return null;
}

function formatAddress(island) {
    const sido = island.Column3 || '';
    const sigungu = island.Column4 || '';
    let addressParts = [];
    if (sido && sigungu) {
        addressParts.push((sido.includes('광역시') || sido.includes('특별시')) ? `${sido} ${sigungu}` : sido, sigungu);
    } else if (sido) {
        addressParts.push(sido);
    }
    const parts = [island.Column5, island.Column6, island.Column7].filter(p => p && p.trim() !== '');
    return addressParts.concat(parts).join(' ') || '주소 정보 없음';
}

function checkIsTerritorial(island) {
    const name = island['무인도서 정보'];
    const code = island.Column2;
    const sido = island.Column3;
    if (code && code.includes('영해기점-')) return true;
    if (name === '홍도') { return sido === '경상남도'; }
    const requiredNames = ["호미곶", "1.5미이터암", "생도", "간여암", "하백도", "사수도", "절명서", "소국흘도", "고서", "직도", "서격렬비도", "소령도"];
    return requiredNames.includes(name);
}

function checkIsUsable(island) {
    return island.Column21 === '이용가능';
}

function createTooltipContent(island) {
    const name = island['무인도서 정보'] || '이름 없음';
    const address = formatAddress(island);
    const isTerritorial = checkIsTerritorial(island);
    const isUsable = checkIsUsable(island);
    
    let html = `<div class="tooltip-title">
                    <span>${name}</span>
                    <div style="display:flex;">
                        ${isTerritorial ? '<span class="territorial-badge">영해기점</span>' : ''}
                        ${isUsable ? '<span class="usable-badge">이용가능</span>' : ''}
                    </div>
                </div>`;
    html += `<div class="tooltip-info"><strong>소재지:</strong> ${address}</div>`;
    html += `<div class="tooltip-info"><strong>관리유형:</strong> ${island.Column21 || '정보 없음'}</div>`;
    return html;
}

function createDetailContent(island) {
    const address = formatAddress(island);
    const name = island['무인도서 정보'] || '이름 없음';
    let isTerritorial = checkIsTerritorial(island);
    let territorialText = isTerritorial ? "영해기점" : (island.Column20 || "해당 없음");
    if (territorialText === '영해기점 없음') territorialText = "해당 없음";
    const territorialStyle = isTerritorial ? 'color: #e74c3c; font-weight: bold;' : '';
    const isUsable = checkIsUsable(island);

    // 연결된 항구 찾기
    let routeInfo = null;
    let isTargetIsland = true;
    if (name === "질마도" && island.Column2 !== "전남-완도-09-29") {
        isTargetIsland = false;
    }
    
    if (isTargetIsland) {
        routeInfo = ferryRoutes.find(r => r.island === name);
    }

    let travelHtml = '';
    if (isUsable) {
        if (routeInfo) {
            travelHtml = `
            <div class="travel-info-box">
                <h4>🛳️ 가는 방법</h4>
                <p class="info-value" style="font-size:0.95em; color:#333;">
                    <strong>${routeInfo.port}</strong> 이용
                </p>
            </div>`;
        } else {
            travelHtml = `
            <div class="travel-info-box">
                <h4>🛳️ 가는 방법</h4>
                <p class="empty-info" style="font-size:0.9em; color:#555;">준비 중입니다.</p>
            </div>`;
        }
    }

    let html = `
        <div class="sticky-info-header">
            <h3>${name}</h3>
            ${travelHtml}
        </div>
        
        <div class="info-row"><div class="info-label">소재지</div><div class="info-value">${address}</div></div>
        <div class="info-row">
            <div class="info-label">영해기점 무인도서 유무</div>
            <div class="info-value" style="${territorialStyle}">${territorialText}</div>
        </div>
        <div class="info-row"><div class="info-label">무인도서 관리유형</div><div class="info-value">${island.Column21 || '정보 없음'}</div></div>
        
        <div style="margin-top:15px;"></div>
        <div class="info-row"><div class="info-label">토지소유구분</div><div class="info-value">${island.Column9 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">관리번호</div><div class="info-value">${island.Column2 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">토지 소유자</div><div class="info-value">${island.Column10 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">토지 전체 면적(㎡)</div><div class="info-value">${island.Column11 ? island.Column11.toLocaleString() : '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">육지와의 거리(㎞)</div><div class="info-value">${island.Column16 !== undefined ? island.Column16 : '정보 없음'}</div></div>
        
        <div class="info-row horizontal">
            <div><div class="info-label">국유지</div><div class="info-value">${island.Column12 ? island.Column12.toLocaleString() : '-'}</div></div>
            <div><div class="info-label">공유지</div><div class="info-value">${island.Column13 ? island.Column13.toLocaleString() : '-'}</div></div>
            <div><div class="info-label">사유지</div><div class="info-value">${island.Column14 ? island.Column14.toLocaleString() : '-'}</div></div>
        </div>
        
        <div class="info-row"><div class="info-label">용도구분</div><div class="info-value">${island.Column18 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">지목</div><div class="info-value">${island.Column19 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">주변해역 관리유형</div><div class="info-value">${island.Column22 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">지정고시일</div><div class="info-value">${island.Column25 || '정보 없음'}</div></div>
    `;
    return html;
}

function initMap() {
    map = L.map('map', {zoomControl: false}).setView([37.5665, 126.9780], 10);
    currentLayer = mapStyles.satellite;
    currentLayer.addTo(map);

    markerClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50
    });
    map.addLayer(markerClusterGroup);

    usableClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        iconCreateFunction: function(cluster) {
            const childCount = cluster.getChildCount();
            let c = 'marker-cluster-usable-';
            if (childCount < 10) c += 'small';
            else if (childCount < 100) c += 'medium';
            else c += 'large';
            return new L.DivIcon({
                html: '<div><span>' + childCount + '</span></div>',
                className: 'marker-cluster ' + c,
                iconSize: new L.Point(40, 40)
            });
        }
    });
    
    territorialLayer = L.layerGroup().addTo(map);
    portLayer = L.layerGroup().addTo(map);

    map.on('zoomend', updatePortMarkers);
}

async function loadIslands() {
    try {
        const response = await fetch('data00.json');
        const data = await response.json();
        const islands = Array.isArray(data) ? data.filter(i => i['무인도서 정보'] !== '무인도서명' && i.Column23 && i.Column24) : [];
        
        allIslands = islands;
        const validMarkers = [];
        const defaultIconHtml = getSolidMarkerSvg('#89c1f5ff', '30px');

        islands.forEach(island => {
            const lat = dmsToDecimal(island.Column23);
            const lng = dmsToDecimal(island.Column24);
            const iName = island['무인도서 정보'];
            
            // 경로 그리기용 좌표 저장
            if (lat && lng) {
                if (iName === "질마도") {
                    if (island.Column2 === "전남-완도-09-29") {
                        islandCoords[iName] = [lat, lng];
                    }
                } else {
                    islandCoords[iName] = [lat, lng];
                }
            }

            if (lat && lng) {
                const marker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: 'custom-svg-marker',
                        html: defaultIconHtml,
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    })
                });
                islandMarkers.set(marker, island);

                // 툴팁 생성
                let tooltipHtml = createTooltipContent(island);
                
                let isTargetIsland = true;
                if (iName === "질마도" && island.Column2 !== "전남-완도-09-29") {
                    isTargetIsland = false;
                }

                const route = isTargetIsland ? ferryRoutes.find(r => r.island === iName) : null;
                if (route) {
                    tooltipHtml += `<div class="tooltip-info" style="margin-top:5px; color:#e67e22;"><strong>🚢 출발 항구:</strong> ${route.port}</div>`;
                }

                marker.bindTooltip(tooltipHtml, { permanent: false, direction: 'top', className: 'island-tooltip' });
                marker.on('click', () => showIslandDetails(island));
                validMarkers.push(marker);
            }
        });

        markers = validMarkers;
        markerClusterGroup.addLayers(validMarkers);
        console.log(`Loaded ${validMarkers.length} islands`);
        
        tryDrawRoutes();

    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadPorts() {
    try {
        const response = await fetch('port.json');
        const ports = await response.json();
        allPorts = ports;

        ports.forEach(port => {
            const coords = port.경위도.split(',').map(c => parseFloat(c.trim()));
            const lat = coords[0];
            const lng = coords[1];
            
            if (lat && lng) {
                portCoords[port.이름] = [lat, lng];
            }

            if (lat && lng) {
                 const customIcon = L.divIcon({
                    html: '<div class="port-marker-content">🚢</div>', 
                    className: 'port-marker-icon', 
                    iconSize: [30, 30], 
                    iconAnchor: [15, 15]
                });
                const marker = L.marker([lat, lng], { icon: customIcon });
                portMarkers.set(port.이름, marker);

                let tooltipText = `<b>${port.이름}</b><br>${port.주소}`;
                const destIslands = ferryRoutes.filter(r => r.port === port.이름).map(r => r.island);
                if (destIslands.length > 0) {
                    tooltipText += `<br><span style="color:#27ae60; font-size:0.9em;">🏝️ 운항: ${destIslands.join(', ')}</span>`;
                }

                marker.bindTooltip(tooltipText, { direction: 'top', className: 'island-tooltip' });
                portLayer.addLayer(marker);
            }
        });
        map.removeLayer(portLayer); 
        
        tryDrawRoutes();

    } catch (error) {
        console.error('Error loading ports:', error);
    }
}

// ▼▼▼ 점선 스타일 수정 (네 요청 반영) ▼▼▼
function tryDrawRoutes() {
    if (Object.keys(islandCoords).length === 0 || Object.keys(portCoords).length === 0) return;

    ferryRoutes.forEach(route => {
        const iLoc = islandCoords[route.island];
        const pLoc = portCoords[route.port];

        if (iLoc && pLoc) {
            L.polyline([iLoc, pLoc], {
                color: '#ff4032ff',
                weight: 4,
                opacity: 0.95,
                dashArray: '5, 10',
                className: 'route-line'
            }).addTo(map);
        }
    });
}

function updatePortListUI() {
    const listContent = document.getElementById('portListContent');
    if (!listContent) return;

    let html = '';
    allPorts.forEach(port => {
        html += `
            <div class="t-list-item" data-port-name="${port.이름}">
                <div class="t-name">${port.이름}</div>
                <div class="t-addr">${port.주소}</div>
            </div>
        `;
    });
    listContent.innerHTML = html;

    listContent.querySelectorAll('.t-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const portName = this.dataset.portName;
            const coords = portCoords[portName];
            if (coords) {
                map.flyTo(coords, 15, { animate: true, duration: 1.0 });
                const marker = portMarkers.get(portName);
                if (marker) {
                    marker.openTooltip();
                }
            }
        });
    });
}

function showIslandDetails(island) {
    const detailPanel = document.getElementById('detailPanel');
    const detailContainer = document.getElementById('detailContainer');
    detailContainer.innerHTML = createDetailContent(island);
    detailPanel.classList.remove('hidden');
    detailContainer.scrollTop = 0;
}

function getIslandsByRegion(regionName) {
    if (!regionName) return allIslands;
    const regions = regionMapping[regionName] || [];
    return allIslands.filter(i => regions.some(r => (i.Column3 || '').includes(r)));
}

function highlightRegion(regionIslands) {
    if (regionPolygon) { map.removeLayer(regionPolygon); regionPolygon = null; }
    if (!regionIslands.length) return;

    const coords = [];
    regionIslands.forEach(i => {
        const lat = dmsToDecimal(i.Column23);
        const lng = dmsToDecimal(i.Column24);
        if (lat && lng) coords.push([lat, lng]);
    });
    if (!coords.length) return;

    let minLat = coords[0][0], maxLat = coords[0][0], minLng = coords[0][1], maxLng = coords[0][1];
    coords.forEach(c => {
        if (c[0] < minLat) minLat = c[0]; if (c[0] > maxLat) maxLat = c[0];
        if (c[1] < minLng) minLng = c[1]; if (c[1] > maxLng) maxLng = c[1];
    });

    const latPad = (maxLat - minLat) * 0.1, lngPad = (maxLng - minLng) * 0.1;
    const pCoords = [
        [minLat - latPad, minLng - lngPad],
        [maxLat + latPad, minLng - lngPad],
        [maxLat + latPad, maxLng + lngPad],
        [minLat - latPad, maxLng + lngPad]
    ];

    try {
        regionPolygon = L.polygon(pCoords, {
            color: '#ffffff', weight: 2, opacity: 1, fillColor: '#ffffff', fillOpacity: 0.0, lineJoin: 'round', className: 'region-highlight-polygon'
        }).addTo(map);
    } catch (e) { console.error(e); }
}

function clearRegionHighlight() {
    if (regionPolygon) { map.removeLayer(regionPolygon); regionPolygon = null; }
}

function getSigunguList(islands) {
    const map = new Map();
    islands.forEach(i => {
        if (i.Column4) {
            let full = i.Column4;
            if ((i.Column3 || '').match(/(광역시|특별시)/)) full = `${i.Column3} ${i.Column4}`;
            if (!map.has(i.Column4)) map.set(i.Column4, { short: i.Column4, full, sido: i.Column3 });
        }
    });
    return Array.from(map.values()).sort((a, b) => {
        if (a.sido !== b.sido) return a.sido.localeCompare(b.sido);
        return a.short.localeCompare(b.short);
    });
}

function updateSigunguSelect(islands) {
    const sel = document.getElementById('sigunguSelect');
    const list = getSigunguList(islands);
    if (!list.length) { sel.style.display = 'none'; sel.value = ''; return; }
    sel.style.display = 'block'; 
    sel.innerHTML = '<option value="">전체</option>' + list.map(s => `<option value="${s.short}">${s.full}</option>`).join('');
}

function renderIslandList() {
    const list = document.getElementById('islandList');
    
    if (!list) return;

    if (currentIslandListItems.length === 0) {
        list.innerHTML = '<p style="padding: 10px; color: #666; text-align: center;">해당하는 섬이 없습니다</p>';
        return;
    }

    list.innerHTML = currentIslandListItems.map(i => `
        <div class="island-list-item" data-island-id="${i.Column2}">
            <div class="island-name">${i['무인도서 정보'] || '이름 없음'}</div>
            <div class="island-address">${formatAddress(i)}</div>
        </div>
    `).join('');

    list.querySelectorAll('.island-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const islandId = this.dataset.islandId;
            const island = allIslands.find(i => i.Column2 === islandId);
            if (island) {
                showIslandDetails(island);
                const lat = dmsToDecimal(island.Column23);
                const lng = dmsToDecimal(island.Column24);
                if (lat && lng) map.flyTo([lat, lng], 15, { animate: true, duration: 1.0 });
            }
        });
    });
}

function updateIslandList(regionName, sigungu = '') {
    const header = document.querySelector('.island-list-header h4');
    let islands = getIslandsByRegion(regionName);

    const usableBtn = document.getElementById('usableToggleBtn');
    const isUsableActive = usableBtn && usableBtn.classList.contains('active');
    if (isUsableActive) islands = islands.filter(checkIsUsable);

    if (sigungu) islands = islands.filter(i => i.Column4 === sigungu);

    currentIslandListItems = islands;
    
    if (!regionName) {
        document.getElementById('sigunguSelect').style.display = 'none';
        if (header) header.textContent = '섬 목록';
        clearRegionHighlight();
        renderIslandList();
        return;
    }
    
    if (header) {
        if (sigungu) {
            const sObj = getSigunguList(getIslandsByRegion(regionName)).find(s => s.short === sigungu);
            header.textContent = `섬 목록 - ${sObj ? sObj.full : sigungu}`;
        } else {
            header.textContent = `섬 목록 - 전체`;
        }
    }

    renderIslandList();

    const markersToShow = markers.filter(m => {
        const i = islandMarkers.get(m);
        return islands.some(regionIsland => regionIsland.Column2 === i.Column2);
    });

    if (markersToShow.length > 0) {
        const bounds = L.latLngBounds(markersToShow.map(m => m.getLatLng()));
        map.fitBounds(bounds.pad(0.2));
        setTimeout(() => highlightRegion(islands), 500); 
    } else {
        clearRegionHighlight();
    }
}

function updateTerritorialListUI() {
    const listContent = document.getElementById('territorialListContent');
    if (!listContent) return;

    const tIslands = allIslands.filter(i => checkIsTerritorial(i));
    
    let html = '';
    tIslands.forEach(island => {
        html += `
            <div class="t-list-item" data-island-id="${island.Column2}">
                <div class="t-name">${island['무인도서 정보']}</div>
                <div class="t-addr">${formatAddress(island)}</div>
            </div>
        `;
    });
    listContent.innerHTML = html;
    
    listContent.querySelectorAll('.t-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const islandId = this.dataset.islandId;
            const island = allIslands.find(i => i.Column2 === islandId);
            if (island) {
                showIslandDetails(island);
                const lat = dmsToDecimal(island.Column23);
                const lng = dmsToDecimal(island.Column24);
                if (lat && lng) map.flyTo([lat, lng], 15, { animate: true, duration: 1.0 });
            }
        });
    });
}

function updateViewportList() {
    const box = document.getElementById('viewportListBox');
    const listContent = document.getElementById('viewportListContent');
    if (box.classList.contains('hidden') || !listContent) return; 
    
    if (map.getZoom() < 10) {
        listContent.innerHTML = '<p style="padding:10px; color:#999;">지도를 더 확대하세요.</p>';
        document.getElementById('viewportCount').textContent = '현재 화면의 섬 (-)';
        return;
    }

    const bounds = map.getBounds();
    const usableBtn = document.getElementById('usableToggleBtn');
    const isUsableActive = usableBtn && usableBtn.classList.contains('active');
    
    let visibleIslands = allIslands.filter(island => {
        if (isUsableActive && !checkIsUsable(island)) return false;
        const lat = dmsToDecimal(island.Column23);
        const lng = dmsToDecimal(island.Column24);
        if (lat && lng) return bounds.contains([lat, lng]);
        return false;
    });

    document.getElementById('viewportCount').textContent = `현재 화면의 섬 (${visibleIslands.length})`;

    let html = '';
    if (visibleIslands.length === 0) {
        html = '<p style="padding:10px; color:#999;">화면 내 섬이 없습니다.</p>';
    } else {
        visibleIslands.forEach(island => {
             html += `
                <div class="t-list-item" data-island-id="${island.Column2}">
                    <div class="t-name">${island['무인도서 정보']}</div>
                    <div class="t-addr">${formatAddress(island)}</div>
                </div>
            `;
        });
    }

    listContent.innerHTML = html;

    listContent.querySelectorAll('.t-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const islandId = this.dataset.islandId;
            const island = allIslands.find(i => i.Column2 === islandId);
            if (island) {
                showIslandDetails(island);
                const lat = dmsToDecimal(island.Column23);
                const lng = dmsToDecimal(island.Column24);
                if (lat && lng) map.flyTo([lat, lng], 15, { animate: true, duration: 1.0 });
            }
        });
    });
}

function toggleSearchPanel() {
    const searchPanel = document.getElementById('searchPanel');
    const openBtn = document.getElementById('openSearchPanelBtn');
    if (searchPanel.classList.contains('hidden')) {
        searchPanel.classList.remove('hidden');
        openBtn.classList.add('hidden');
    } else {
        searchPanel.classList.add('hidden');
        openBtn.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadIslands();
    loadPorts();

    const territorialInfoPanel = document.getElementById('territorialInfoPanel');
    const closeTerritorialInfo = document.getElementById('closeTerritorialInfo');

    document.getElementById('custom-zoom-in').onclick = (e) => { e.preventDefault(); map.zoomIn(); };
    document.getElementById('custom-zoom-out').onclick = (e) => { e.preventDefault(); map.zoomOut(); };
    document.getElementById('custom-zoom-korea').onclick = (e) => { 
        e.preventDefault(); 
        map.setView([36.5, 127.5], 7, { animate: true, duration: 1.0 });
        clearRegionHighlight();
        document.getElementById('regionSelect').value = "";
        document.getElementById('sigunguSelect').style.display = 'none';
        updateIslandList(""); 
    };

    const styleBtns = document.querySelectorAll('.style-btn');
    styleBtns.forEach(btn => {
        btn.onclick = function() {
            styleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            if (mapStyles[this.dataset.style]) {
                map.removeLayer(currentLayer);
                currentLayer = mapStyles[this.dataset.style];
                currentLayer.addTo(map);
            }
        };
    });

    document.getElementById('toggleSearchPanelBtn').onclick = toggleSearchPanel;
    document.getElementById('openSearchPanelBtn').onclick = toggleSearchPanel;
    
    document.getElementById('toggleIslandList').onclick = function() {
        const list = document.getElementById('islandList');
        if (list.style.display === 'none') {
            list.style.display = 'block';
            this.textContent = '접기 ▲';
        } else {
            list.style.display = 'none';
            this.textContent = '펼치기 ▼';
        }
    };

    const rSel = document.getElementById('regionSelect');
    const sSel = document.getElementById('sigunguSelect');
    rSel.onchange = function() {
        const regionIslands = getIslandsByRegion(this.value);
        updateSigunguSelect(regionIslands);
        updateIslandList(this.value, '');
    };
    sSel.onchange = function() {
        updateIslandList(rSel.value, this.value);
    };
    
    document.getElementById('closeDetailPanel').addEventListener('click', () => {
        document.getElementById('detailPanel').classList.add('hidden');
    });

    const territorialBtn = document.getElementById('territorialToggleBtn');
    const territorialListBox = document.getElementById('territorialListBox');
    const closeTerritorialList = document.getElementById('closeTerritorialList');
    let isTerritorialActive = false;

    if (territorialListBox) {
        L.DomEvent.disableScrollPropagation(territorialListBox);
        L.DomEvent.disableClickPropagation(territorialListBox);
    }

    territorialBtn.addEventListener('click', function() {
        isTerritorialActive = !isTerritorialActive;
        if (isTerritorialActive) {
            this.classList.add('active');
            updateTerritorialListUI();
            territorialListBox.classList.remove('hidden');
            territorialLayer.clearLayers();
            territorialInfoPanel.classList.remove('hidden'); 
            
            const tIconHtml = getSolidMarkerSvg('#e74c3c', '30px');

            allIslands.forEach(island => {
                if (checkIsTerritorial(island)) {
                    const lat = dmsToDecimal(island.Column23);
                    const lng = dmsToDecimal(island.Column24);
                    if (lat && lng) {
                        const marker = L.marker([lat, lng], { 
                             icon: L.divIcon({
                                className: 'territorial-marker-icon',
                                html: tIconHtml,
                                iconSize: [30, 30],
                                iconAnchor: [15, 30]
                            })
                        });
                        marker.on('add', function() {
                            const el = this.getElement();
                            if (el) el.classList.add('territorial-highlight');
                        });
                        marker.bindTooltip(createTooltipContent(island), { permanent: false, direction: 'top', className: 'island-tooltip' });
                        marker.on('click', () => showIslandDetails(island));
                        territorialLayer.addLayer(marker);
                    }
                }
            });
        } else {
            this.classList.remove('active');
            territorialListBox.classList.add('hidden'); 
            territorialLayer.clearLayers();
            territorialInfoPanel.classList.add('hidden');
        }
    });
    
    closeTerritorialList.addEventListener('click', () => {
        territorialListBox.classList.add('hidden');
    });

    closeTerritorialInfo.addEventListener('click', () => {
        territorialInfoPanel.classList.add('hidden');
    });

    const usableBtn = document.getElementById('usableToggleBtn');
    let isUsableActive = false;

    usableBtn.addEventListener('click', function() {
        isUsableActive = !isUsableActive;
        if (isUsableActive) {
            this.classList.add('active');
            map.removeLayer(markerClusterGroup);
            usableClusterGroup.clearLayers();
            
            const uIconHtml = getSolidMarkerSvg('#27ae60', '30px');

            const usableMarkers = [];
            allIslands.forEach(island => {
                if (checkIsUsable(island)) {
                    const lat = dmsToDecimal(island.Column23);
                    const lng = dmsToDecimal(island.Column24);
                    if (lat && lng) {
                        const marker = L.marker([lat, lng], { 
                            icon: L.divIcon({
                                className: 'usable-marker-icon',
                                html: uIconHtml,
                                iconSize: [30, 30],
                                iconAnchor: [15, 30]
                            })
                        });
                        marker.on('add', function() {
                            const el = this.getElement();
                            if (el) el.classList.add('usable-highlight');
                        });
                        marker.bindTooltip(createTooltipContent(island), { permanent: false, direction: 'top', className: 'island-tooltip' });
                        marker.on('click', () => showIslandDetails(island));
                        usableMarkers.push(marker);
                    }
                }
            });
            usableClusterGroup.addLayers(usableMarkers);
            map.addLayer(usableClusterGroup);
        } else {
            this.classList.remove('active');
            map.removeLayer(usableClusterGroup);
            map.addLayer(markerClusterGroup);
        }
        updateIslandList(rSel.value, sSel.value);
        updateViewportList();
    });

    const portBtn = document.getElementById('portToggleBtn');
    const portListBox = document.getElementById('portListBox'); 
    const closePortList = document.getElementById('closePortList');
    let isPortActive = false;

    if (portListBox) {
        L.DomEvent.disableScrollPropagation(portListBox);
        L.DomEvent.disableClickPropagation(portListBox);
    }

    portBtn.addEventListener('click', function() {
        isPortActive = !isPortActive;
        if (isPortActive) {
            this.classList.add('active');
            map.addLayer(portLayer);
            updatePortMarkers(); 
            portListBox.classList.remove('hidden'); 
            updatePortListUI(); 
        } else {
            this.classList.remove('active');
            map.removeLayer(portLayer);
            portListBox.classList.add('hidden'); 
        }
    });

    if (closePortList) {
        closePortList.addEventListener('click', () => {
            portListBox.classList.add('hidden');
        });
    }

    const viewportListBox = document.getElementById('viewportListBox');
    const closeViewportList = document.getElementById('closeViewportList');

    if (viewportListBox) {
        L.DomEvent.disableScrollPropagation(viewportListBox);
        L.DomEvent.disableClickPropagation(viewportListBox);
    }

    map.on('moveend', function() {
        if (map.getZoom() >= 10 && !viewportListBox.classList.contains('closed-by-user')) {
            viewportListBox.classList.remove('hidden');
            updateViewportList();
        } else {
            viewportListBox.classList.add('hidden');
        }
    });

    closeViewportList.addEventListener('click', () => {
        viewportListBox.classList.add('hidden');
        viewportListBox.classList.add('closed-by-user');
    });
});