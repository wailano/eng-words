'use strict';

const DashboardModule = (() => {
  let _chart = null;

  async function render(email) {
    const el = document.getElementById('page-dashboard');
    el.innerHTML = `<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>불러오는 중...</p></div>`;

    let records;
    try { records = await DB.scores.list(email); }
    catch(e) {
      el.innerHTML = `<h2 style="margin-bottom:16px">📊 성적 대시보드</h2>
        <div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>데이터 로드 실패: ${e.message}</p></div>`;
      return;
    }

    if (!records.length) {
      el.innerHTML = `
        <h2 style="margin-bottom:16px">📊 성적 대시보드</h2>
        <div class="empty-state">
          <i class="fas fa-chart-line"></i>
          <p>아직 시험 기록이 없습니다.<br>테스트 모드에서 시험을 치러보세요!</p>
        </div>`;
      return;
    }

    const elem = records.filter(r => r.level === 'elementary');
    const mid  = records.filter(r => r.level === 'middle');
    const avg  = r => r.length ? Math.round(r.reduce((s,x)=>s+x.score,0)/r.length) : 0;
    const best = r => r.length ? Math.max(...r.map(x=>x.score)) : 0;

    el.innerHTML = `
      <h2 style="margin-bottom:16px">📊 성적 대시보드</h2>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="num">${records.length}</div>
          <div class="lbl">총 시험 횟수</div>
        </div>
        <div class="stat-card">
          <div class="num">${avg(records)}</div>
          <div class="lbl">전체 평균</div>
        </div>
        <div class="stat-card">
          <div class="num" style="color:#4DAA84">${avg(elem)}</div>
          <div class="lbl">초등 평균</div>
        </div>
        <div class="stat-card">
          <div class="num" style="color:#6C8EBF">${avg(mid)}</div>
          <div class="lbl">중등 평균</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">성적 추이</div>
        <div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="badge badge-green">초등</span>
          <span class="badge badge-blue">중등</span>
        </div>
        <div class="chart-container">
          <canvas id="scoreChart"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-title">최근 10회 기록</div>
        <div id="recentList"></div>
      </div>`;

    // Chart
    if (_chart) _chart.destroy();
    const dates = [...new Set(records.map(r => r.test_date))].sort();
    const getAvgByDate = (arr, date) => {
      const day = arr.filter(r => r.test_date === date);
      return day.length ? Math.round(day.reduce((s,x)=>s+x.score,0)/day.length) : null;
    };

    const ctx = document.getElementById('scoreChart').getContext('2d');
    _chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: '초등',
            data: dates.map(d => getAvgByDate(elem, d)),
            borderColor: '#4DAA84', backgroundColor: '#4DAA8420',
            tension: 0.3, fill: true, spanGaps: true,
          },
          {
            label: '중등',
            data: dates.map(d => getAvgByDate(mid, d)),
            borderColor: '#6C8EBF', backgroundColor: '#6C8EBF20',
            tension: 0.3, fill: true, spanGaps: true,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 30, ticks: { stepSize: 5 } }
        },
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Recent list
    const recent = [...records].reverse().slice(0, 10);
    const lvlLabel = l => l === 'elementary' ? '초등' : '중등';
    document.getElementById('recentList').innerHTML = recent.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:10px 0;border-bottom:1px solid #EDF2F7;">
        <div>
          <span class="badge ${r.level==='elementary'?'badge-green':'badge-blue'}">${lvlLabel(r.level)}</span>
          <span style="font-size:.82rem;color:var(--text-sub);margin-left:8px;">${r.test_date}</span>
        </div>
        <strong style="font-size:1rem;color:var(--primary-dark)">${r.score}/30</strong>
      </div>`).join('');
  }

  return { render };
})();
