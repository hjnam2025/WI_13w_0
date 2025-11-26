document.addEventListener('DOMContentLoaded', function() {
    const sections = document.querySelectorAll('.content-section'); 
    const navItems = document.querySelectorAll('.nav-item:not(.map-link)');
    const progressBar = document.getElementById('progressBar');
    
    let currentIndex = 0;
    let isScrolling = false;
    const totalSections = sections.length;

    // ▼▼▼ [사용자 수정 영역] 배경 이미지 및 섬 이름 데이터 ▼▼▼
    const islandBackgrounds = [
        { url: './img/daehwa.jpg', name: '대화도' },
        { url: './img/jak.jpg', name: '작도' },
        { url: './img/noroo.jpg', name: '노루섬' },
        { url: './img/onefive.jpg', name: '1.5미이터암' },
        { url: './img/sangsa.jpg', name: '상사치도' },   
        { url: './img/seomsaeng.jpg', name: '섬생이' },
        { url: './img/sosam.jpg', name: '소삼부도' },
        { url: './img/yoond.jpg', name: '윤돌도' },
    ];
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // --- 배경 및 섬 이름 랜덤 변경 함수 ---
    function setRandomBackground() {
        if (islandBackgrounds.length === 0) return;

        const randomIndex = Math.floor(Math.random() * islandBackgrounds.length);
        const selected = islandBackgrounds[randomIndex];
        
        // 배경 이미지 변경
        const bgImageDiv = document.getElementById('bg-image');
        if (bgImageDiv) {
            bgImageDiv.style.backgroundImage = `url('${selected.url}')`;
        }
        
        // 섬 이름 텍스트 변경
        const nameTags = document.querySelectorAll('.bg-location-name');
        nameTags.forEach(tag => {
            tag.textContent = `📍 ${selected.name}`;
        });
    }


    // --- Progress Bar 업데이트 ---
    function updateProgressBar() {
        const percentage = (currentIndex / (totalSections - 1)) * 100;
        progressBar.style.width = `${percentage}%`;
    }

    // --- 섹션 전환 로직 (Fade Effect) ---
    function scrollToSection(index) {
        if (index < 0 || index >= totalSections) return;
        
        currentIndex = index;

        // 배경 변경 (페이지 넘길 때마다)
        setRandomBackground();

        // 모든 섹션 비활성화 후 현재 섹션만 활성화
        sections.forEach((sec, idx) => {
            if (idx === currentIndex) {
                sec.classList.add('active');
                // 전환된 섹션의 본문에 강제 포커스 (클릭 없이 스크롤 가능하게)
                const cardRight = sec.querySelector('.card-right');
                if (cardRight) {
                    cardRight.focus();
                }
            } else {
                sec.classList.remove('active');
            }
        });

        // 내비게이션 업데이트
        navItems.forEach(item => {
            item.classList.remove('active');
            if (parseInt(item.dataset.index) === currentIndex) {
                item.classList.add('active');
            }
        });
        
        updateProgressBar();

        setTimeout(() => {
            isScrolling = false;
        }, 500); 
    }

    // --- 휠 이벤트 (스크롤 제어) ---
    window.addEventListener('wheel', (e) => {
        if (isScrolling) return;

        const currentSection = sections[currentIndex];
        const scrollableContent = currentSection.querySelector('.card-right');
        
        let preventSectionChange = false;

        if (scrollableContent) {
            // 내용이 넘치는지 확인
            const isOverflowing = scrollableContent.scrollHeight > scrollableContent.clientHeight + 1;
            
            if (isOverflowing) {
                const scrollTop = scrollableContent.scrollTop;
                const maxScroll = scrollableContent.scrollHeight - scrollableContent.clientHeight;

                if (e.deltaY > 0) {
                    // 아래로 스크롤: 바닥에 닿지 않았으면 섹션 이동 막음
                    if (scrollTop < maxScroll - 1) { 
                        preventSectionChange = true;
                    }
                } else {
                    // 위로 스크롤: 천장에 닿지 않았으면 섹션 이동 막음
                    if (scrollTop > 1) {
                        preventSectionChange = true;
                    }
                }
            }
        }

        if (preventSectionChange) return;

        // 섹션 이동
        if (e.deltaY > 0) {
            if (currentIndex < totalSections - 1) {
                isScrolling = true;
                scrollToSection(currentIndex + 1);
            }
        } else {
            if (currentIndex > 0) {
                isScrolling = true;
                scrollToSection(currentIndex - 1);
            }
        }
    }, { passive: false });

    // 내비게이션 클릭 이벤트
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const targetIndex = parseInt(this.dataset.index);
            scrollToSection(targetIndex);
        });
    });

    // 초기화
    updateProgressBar();
    initializeCharts();
    
    // 파도 함수 호출
    initWaves(); 
    
    // 초기 배경 설정 및 첫번째 섹션 포커스
    setRandomBackground();
    const firstRight = sections[0].querySelector('.card-right');
    if (firstRight) firstRight.focus();
});

function initializeCharts() {
    const totalCtx = document.getElementById('totalChart');
    if (totalCtx) {
        new Chart(totalCtx, {
            type: 'pie',
            data: {
                labels: ['무인도서', '유인도서'],
                datasets: [{
                    data: [2910, 480],
                    backgroundColor: ['#3498db', '#e74c3c'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
    
    const sidoCtx = document.getElementById('sidoChart');
    if (sidoCtx) {
        const rawSidoData = [
            { label: '인천', value: 152 },
            { label: '경기', value: 37 },
            { label: '충남', value: 248 },
            { label: '전북', value: 105 },
            { label: '전남', value: 1741 },
            { label: '경남', value: 475 },
            { label: '부산', value: 41 },
            { label: '울산', value: 4 },
            { label: '경북', value: 19 },
            { label: '강원', value: 29 },
            { label: '제주', value: 59 }
        ];
        rawSidoData.sort((a, b) => b.value - a.value);
        const sortedLabels = rawSidoData.map(d => d.label);
        const sortedData = rawSidoData.map(d => d.value);

        new Chart(sidoCtx, {
            type: 'bar',
            data: {
                labels: sortedLabels,
                datasets: [{
                    label: '무인도서 수',
                    data: sortedData,
                    backgroundColor: '#3498db'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
    
    const areaCtx = document.getElementById('areaChart');
    if (areaCtx) {
        new Chart(areaCtx, {
            type: 'pie',
            data: {
                labels: ['3,000㎡ 미만', '3,000~10,000㎡', '10,000~50,000㎡', '50,000~100,000㎡', '100,000㎡ 이상'],
                datasets: [{
                    data: [908, 624, 682, 182, 153],
                    backgroundColor: ['#3498db', '#2ecc71', '#f39c12', '#e67e22', '#e74c3c']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
    
    const distanceCtx = document.getElementById('distanceChart');
    if (distanceCtx) {
        new Chart(distanceCtx, {
            type: 'bar',
            data: {
                labels: ['1km 미만', '1~5km', '5~20km', '20~80km', '80km 이상'],
                datasets: [{
                    label: '무인도서 수',
                    data: [1219, 680, 569, 319, 123],
                    backgroundColor: ['#3498db', '#2ecc71', '#f39c12', '#e67e22', '#e74c3c']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}

// --- 배경 물결 애니메이션 (CodePen: Sine Waves 로직 적용) ---
function initWaves() {
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    var width = canvas.width = window.innerWidth;
    var height = canvas.height = window.innerHeight;

    var waves = [];
    
    // 물결 설정 (색상, 파장, 높이 등)
    var configs = [
        { y: height * 0.82, length: 0.004, amplitude: 35, speed: 0.01, color: 'rgba(194, 250, 253, 0.58)' },
        { y: height * 0.82, length: 0.003, amplitude: 50, speed: 0.03, color: 'rgba(148, 212, 255, 0.45)' },
        { y: height * 0.85, length: 0.002, amplitude: 25, speed: 0.03, color: 'rgba(92, 189, 253, 0.39)' }
    ];

    // 파동 객체 생성
    function Wave(config) {
        this.y = config.y;
        this.length = config.length;
        this.amplitude = config.amplitude;
        this.speed = config.speed;
        this.color = config.color;
        this.tick = 0;
    }

    Wave.prototype.update = function() {
        this.tick += this.speed;
    };

    Wave.prototype.draw = function() {
        ctx.beginPath();
        ctx.fillStyle = this.color;
        
        // 물결 그리기
        ctx.moveTo(0, height);
        ctx.lineTo(0, this.y);
        
        for (var i = 0; i < width; i += 5) { // 5px 단위로 그림 (성능 최적화)
            ctx.lineTo(i, this.y + Math.sin(i * this.length + this.tick) * this.amplitude);
        }
        
        ctx.lineTo(width, this.y);
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
    };

    // 초기화
    for (var i = 0; i < configs.length; i++) {
        waves.push(new Wave(configs[i]));
    }

    // 애니메이션 루프
    function loop() {
        ctx.clearRect(0, 0, width, height);
        
        for (var i = 0; i < waves.length; i++) {
            waves[i].update();
            waves[i].draw();
        }
        
        requestAnimationFrame(loop);
    }

    loop();

    // 리사이즈 대응
    window.addEventListener('resize', function() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        
        // 리사이즈 시 높이 재조정
        waves[0].y = height * 0.82;
        waves[1].y = height * 0.82;
        waves[2].y = height * 0.85;
    });
}