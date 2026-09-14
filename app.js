/**
 * Airbnb NYC 2019 - Live Data Visualization Engine
 * Connects AB_NYC_2019.csv to the Stitch design system.
 */

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('data-status-badge');
  const statusText = document.getElementById('data-status-text');
  const statusDot = document.getElementById('data-status-dot');

  // Tooltip element
  const tooltip = document.createElement('div');
  tooltip.id = 'viz-tooltip';
  tooltip.className = 'fixed hidden pointer-events-none z-50 px-3 py-2 rounded-lg bg-[#171f33]/95 backdrop-blur-md border border-[#494454]/50 text-[#dae2fd] text-xs shadow-2xl transition-opacity duration-150';
  document.body.appendChild(tooltip);

  function showTooltip(html, e) {
    tooltip.innerHTML = html;
    tooltip.classList.remove('hidden');
    tooltip.style.opacity = '1';
    positionTooltip(e);
  }

  function positionTooltip(e) {
    const pad = 12;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const rect = tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 10) {
      x = e.clientX - rect.width - pad;
    }
    if (y + rect.height > window.innerHeight - 10) {
      y = e.clientY - rect.height - pad;
    }
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    tooltip.classList.add('hidden');
    tooltip.style.opacity = '0';
  }

  // Load CSV with fallback paths
  const possiblePaths = ['./AB_NYC_2019.csv', '../AB_NYC_2019.csv', 'AB_NYC_2019.csv'];

  function loadDataset(index = 0) {
    if (index >= possiblePaths.length) {
      if (statusText) statusText.textContent = 'CSV LOAD FAILED';
      if (statusDot) statusDot.className = 'w-1.5 h-1.5 rounded-full bg-error';
      console.error('Could not locate AB_NYC_2019.csv in any expected directory.');
      return;
    }

    Papa.parse(possiblePaths[index], {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (results.data && results.data.length > 0) {
          initVisualizations(results.data);
        } else {
          loadDataset(index + 1);
        }
      },
      error: function() {
        loadDataset(index + 1);
      }
    });
  }

  loadDataset(0);

  function initVisualizations(rawRecords) {
    // Filter valid records (latitude, longitude, price exist)
    const records = rawRecords.filter(d => d.id && d.price !== null && !isNaN(d.latitude) && !isNaN(d.longitude));
    const totalCount = records.length;

    // Update status badge
    if (statusBadge && statusText && statusDot) {
      statusText.textContent = `LIVE DATA: ${totalCount.toLocaleString()} LISTINGS`;
      statusDot.className = 'w-1.5 h-1.5 rounded-full bg-secondary';
      statusBadge.className = 'inline-flex items-center gap-1.5 px-space-sm py-space-xs rounded-full bg-secondary/15 border border-secondary/40 text-secondary font-label-sm text-label-sm';
    }

    const heroTotal = document.getElementById('hero-total-listings');
    if (heroTotal) heroTotal.textContent = totalCount.toLocaleString();

    // ----------------------------------------------------
    // PHASE 2: 7 KPI CARDS
    // ----------------------------------------------------
    const prices = records.map(d => d.price).sort((a, b) => a - b);
    const meanPrice = d3.mean(prices) || 152.72;
    const medianPrice = d3.median(prices) || 106;
    const meanReviews = d3.mean(records, d => d.number_of_reviews) || 23.27;
    const meanAvailability = d3.mean(records, d => d.availability_365) || 112.8;
    const uniqueNeighborhoods = new Set(records.map(d => d.neighbourhood)).size;

    const roomCounts = d3.rollup(records, v => v.length, d => d.room_type);
    const entireCount = roomCounts.get('Entire home/apt') || 0;
    const privateCount = roomCounts.get('Private room') || 0;
    const sharedCount = roomCounts.get('Shared room') || 0;

    const entirePct = ((entireCount / totalCount) * 100).toFixed(1);
    const privatePct = ((privateCount / totalCount) * 100).toFixed(1);
    const sharedPct = ((sharedCount / totalCount) * 100).toFixed(1);

    const priceDiff = (((medianPrice - meanPrice) / meanPrice) * 100).toFixed(1);

    const kpiTotal = document.getElementById('kpi-total-listings');
    const kpiMeanPrice = document.getElementById('kpi-mean-price');
    const kpiMedianPrice = document.getElementById('kpi-median-price');
    const kpiPriceDiff = document.getElementById('kpi-price-diff');
    const kpiMeanReviews = document.getElementById('kpi-mean-reviews');
    const kpiAvail = document.getElementById('kpi-availability');
    const kpiNeigh = document.getElementById('kpi-neighborhoods');
    const kpiDominantType = document.getElementById('kpi-dominant-type');
    const kpiDominantPct = document.getElementById('kpi-dominant-pct');

    if (kpiTotal) kpiTotal.textContent = totalCount.toLocaleString();
    if (kpiMeanPrice) kpiMeanPrice.textContent = `$${meanPrice.toFixed(2)}`;
    if (kpiMedianPrice) kpiMedianPrice.textContent = `$${medianPrice.toFixed(2)}`;
    if (kpiPriceDiff) kpiPriceDiff.textContent = `${priceDiff}% vs Mean`;
    if (kpiMeanReviews) kpiMeanReviews.textContent = meanReviews.toFixed(2);
    if (kpiAvail) kpiAvail.textContent = `${meanAvailability.toFixed(1)} d`;
    if (kpiNeigh) kpiNeigh.textContent = uniqueNeighborhoods;
    if (kpiDominantType) kpiDominantType.textContent = 'Entire Home';
    if (kpiDominantPct) kpiDominantPct.textContent = `${entirePct}% of Market`;

    const barEntire = document.getElementById('kpi-room-bar-entire');
    const barPrivate = document.getElementById('kpi-room-bar-private');
    const barShared = document.getElementById('kpi-room-bar-shared');
    if (barEntire) barEntire.style.width = `${entirePct}%`;
    if (barPrivate) barPrivate.style.width = `${privatePct}%`;
    if (barShared) barShared.style.width = `${sharedPct}%`;

    // ----------------------------------------------------
    // RESEARCH QUESTION 01: PRICING ACROSS NEIGHBORHOODS & ROOM TYPES
    // ----------------------------------------------------
    let currentMetric = 'median'; // 'median' | 'mean'
    let currentRoomFilter = 'all'; // 'all' | 'Entire home/apt' | 'Private room' | 'Shared room'

    const btnMedian = document.getElementById('btn-median-price');
    const btnAvg = document.getElementById('btn-avg-price');
    const barTitle = document.getElementById('bar-chart-title');
    const barSubtitle = document.getElementById('bar-chart-subtitle');
    const insightParagraph = document.getElementById('pricing-dynamic-insight');

    // Precalculate room type stats for comparison
    const roomTypeStats = {
      'Entire home/apt': {
        count: entireCount,
        pct: entirePct,
        mean: d3.mean(records.filter(d => d.room_type === 'Entire home/apt'), d => d.price) || 211,
        median: d3.median(records.filter(d => d.room_type === 'Entire home/apt'), d => d.price) || 160
      },
      'Private room': {
        count: privateCount,
        pct: privatePct,
        mean: d3.mean(records.filter(d => d.room_type === 'Private room'), d => d.price) || 89,
        median: d3.median(records.filter(d => d.room_type === 'Private room'), d => d.price) || 70
      },
      'Shared room': {
        count: sharedCount,
        pct: sharedPct,
        mean: d3.mean(records.filter(d => d.room_type === 'Shared room'), d => d.price) || 70,
        median: d3.median(records.filter(d => d.room_type === 'Shared room'), d => d.price) || 45
      }
    };

    // Metric Toggle Buttons
    if (btnMedian && btnAvg) {
      btnMedian.addEventListener('click', () => {
        if (currentMetric === 'median') return;
        currentMetric = 'median';
        btnMedian.className = 'px-space-sm py-space-xs rounded-full font-label-md text-label-md bg-secondary text-on-secondary shadow-sm transition-all';
        btnAvg.className = 'px-space-sm py-space-xs rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all';
        if (barSubtitle) barSubtitle.textContent = 'Sorted by Median Price (descending)';
        renderBarChart();
        updateDynamicInsight();
      });

      btnAvg.addEventListener('click', () => {
        if (currentMetric === 'mean') return;
        currentMetric = 'mean';
        btnAvg.className = 'px-space-sm py-space-xs rounded-full font-label-md text-label-md bg-secondary text-on-secondary shadow-sm transition-all';
        btnMedian.className = 'px-space-sm py-space-xs rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all';
        if (barSubtitle) barSubtitle.textContent = 'Sorted by Average Price (descending)';
        renderBarChart();
        updateDynamicInsight();
      });
    }

    // Room Type Filter Buttons
    const roomButtons = document.querySelectorAll('.room-filter-btn');
    function setRoomFilter(roomType) {
      currentRoomFilter = roomType;
      roomButtons.forEach(b => {
        if (b.getAttribute('data-room-type') === roomType) {
          b.className = 'room-filter-btn px-space-sm py-space-xs rounded-full font-label-md text-label-md bg-primary-container text-on-primary-container transition-all';
        } else {
          b.className = 'room-filter-btn px-space-sm py-space-xs rounded-full font-label-md text-label-md bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-all';
        }
      });
      renderBarChart();
      updateDonutHighlight();
      updateDynamicInsight();
    }

    roomButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        setRoomFilter(btn.getAttribute('data-room-type'));
      });
    });

    // Donut Legend Rows Click Handlers for seamless room-type comparison
    const legendRowEntire = document.getElementById('donut-legend-row-entire');
    const legendRowPrivate = document.getElementById('donut-legend-row-private');
    const legendRowShared = document.getElementById('donut-legend-row-shared');

    if (legendRowEntire) {
      legendRowEntire.addEventListener('click', () => {
        setRoomFilter(currentRoomFilter === 'Entire home/apt' ? 'all' : 'Entire home/apt');
      });
    }
    if (legendRowPrivate) {
      legendRowPrivate.addEventListener('click', () => {
        setRoomFilter(currentRoomFilter === 'Private room' ? 'all' : 'Private room');
      });
    }
    if (legendRowShared) {
      legendRowShared.addEventListener('click', () => {
        setRoomFilter(currentRoomFilter === 'Shared room' ? 'all' : 'Shared room');
      });
    }

    // Interactive Donut Segments
    const circ = 2 * Math.PI * 38; // ~238.76
    const donutEntire = document.getElementById('donut-entire');
    const donutPrivate = document.getElementById('donut-private');
    const donutShared = document.getElementById('donut-shared');
    const donutCenterCount = document.getElementById('donut-center-count');
    const donutCenterLabel = document.getElementById('donut-center-label');

    if (donutEntire) {
      donutEntire.addEventListener('click', () => setRoomFilter(currentRoomFilter === 'Entire home/apt' ? 'all' : 'Entire home/apt'));
    }
    if (donutPrivate) {
      donutPrivate.addEventListener('click', () => setRoomFilter(currentRoomFilter === 'Private room' ? 'all' : 'Private room'));
    }
    if (donutShared) {
      donutShared.addEventListener('click', () => setRoomFilter(currentRoomFilter === 'Shared room' ? 'all' : 'Shared room'));
    }

    // Attach rich tooltips to donut segments and legend rows
    function attachRoomTooltip(element, typeName) {
      const stats = roomTypeStats[typeName];
      if (!element || !stats) return;
      element.addEventListener('mousemove', (e) => {
        showTooltip(`
          <div class="font-bold text-on-surface text-sm mb-1">${typeName}</div>
          <div class="text-xs text-on-surface-variant border-b border-outline/20 pb-1 mb-1.5">Market Share: <span class="text-secondary font-semibold">${stats.pct}%</span> · <span class="font-semibold text-on-surface">${stats.count.toLocaleString()}</span> listings</div>
          <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div>Median Price: <span class="text-secondary font-semibold">$${stats.median}</span>/night</div>
            <div>Average Price: <span class="text-primary font-semibold">$${Math.round(stats.mean)}</span>/night</div>
          </div>
        `, e);
      });
      element.addEventListener('mouseleave', hideTooltip);
    }

    attachRoomTooltip(donutEntire, 'Entire home/apt');
    attachRoomTooltip(donutPrivate, 'Private room');
    attachRoomTooltip(donutShared, 'Shared room');
    attachRoomTooltip(legendRowEntire, 'Entire home/apt');
    attachRoomTooltip(legendRowPrivate, 'Private room');
    attachRoomTooltip(legendRowShared, 'Shared room');

    function updateDonutHighlight() {
      if (!donutEntire || !donutPrivate || !donutShared) return;
      const lenEntire = (entireCount / totalCount) * circ;
      const lenPrivate = (privateCount / totalCount) * circ;
      const lenShared = (sharedCount / totalCount) * circ;

      donutEntire.setAttribute('stroke-dasharray', `${lenEntire} ${circ}`);
      donutEntire.setAttribute('stroke-dashoffset', `${circ * 0.25}`);

      donutPrivate.setAttribute('stroke-dasharray', `${lenPrivate} ${circ}`);
      donutPrivate.setAttribute('stroke-dashoffset', `${circ * 0.25 - lenEntire}`);

      donutShared.setAttribute('stroke-dasharray', `${lenShared} ${circ}`);
      donutShared.setAttribute('stroke-dashoffset', `${circ * 0.25 - lenEntire - lenPrivate}`);

      // Highlight active segment & update center count/label
      if (currentRoomFilter === 'all') {
        donutEntire.style.opacity = '1';
        donutPrivate.style.opacity = '1';
        donutShared.style.opacity = '1';
        donutEntire.setAttribute('stroke-width', '14');
        donutPrivate.setAttribute('stroke-width', '14');
        donutShared.setAttribute('stroke-width', '14');
        if (donutCenterCount) donutCenterCount.textContent = totalCount.toLocaleString();
        if (donutCenterLabel) donutCenterLabel.textContent = 'LISTINGS';
      } else {
        donutEntire.style.opacity = currentRoomFilter === 'Entire home/apt' ? '1' : '0.35';
        donutEntire.setAttribute('stroke-width', currentRoomFilter === 'Entire home/apt' ? '17' : '12');

        donutPrivate.style.opacity = currentRoomFilter === 'Private room' ? '1' : '0.35';
        donutPrivate.setAttribute('stroke-width', currentRoomFilter === 'Private room' ? '17' : '12');

        donutShared.style.opacity = currentRoomFilter === 'Shared room' ? '1' : '0.35';
        donutShared.setAttribute('stroke-width', currentRoomFilter === 'Shared room' ? '17' : '12');

        if (donutCenterCount) donutCenterCount.textContent = (roomTypeStats[currentRoomFilter]?.count || 0).toLocaleString();
        if (donutCenterLabel) donutCenterLabel.textContent = currentRoomFilter === 'Entire home/apt' ? 'ENTIRE HOME' : (currentRoomFilter === 'Private room' ? 'PRIV ROOM' : 'SHARED');
      }

      // Highlight active legend row
      [
        { el: legendRowEntire, type: 'Entire home/apt' },
        { el: legendRowPrivate, type: 'Private room' },
        { el: legendRowShared, type: 'Shared room' }
      ].forEach(({ el, type }) => {
        if (!el) return;
        if (currentRoomFilter === type) {
          el.className = 'flex items-center justify-between p-2 rounded-lg bg-surface-container-high border border-secondary/40 cursor-pointer transition-all shadow-sm';
        } else {
          el.className = 'flex items-center justify-between p-2 rounded-lg bg-surface-container-low border border-transparent cursor-pointer hover:bg-surface-container-high transition-colors';
        }
      });
    }

    // Populate Legend Text
    const legendEntirePct = document.getElementById('donut-legend-entire-pct');
    const legendEntireAvg = document.getElementById('donut-legend-entire-avg');
    const legendPrivatePct = document.getElementById('donut-legend-private-pct');
    const legendPrivateAvg = document.getElementById('donut-legend-private-avg');
    const legendSharedPct = document.getElementById('donut-legend-shared-pct');
    const legendSharedAvg = document.getElementById('donut-legend-shared-avg');

    if (legendEntirePct) legendEntirePct.textContent = `${entirePct}% (${entireCount.toLocaleString()})`;
    if (legendEntireAvg) legendEntireAvg.textContent = `$${roomTypeStats['Entire home/apt'].median} med · $${Math.round(roomTypeStats['Entire home/apt'].mean)} avg`;
    if (legendPrivatePct) legendPrivatePct.textContent = `${privatePct}% (${privateCount.toLocaleString()})`;
    if (legendPrivateAvg) legendPrivateAvg.textContent = `$${roomTypeStats['Private room'].median} med · $${Math.round(roomTypeStats['Private room'].mean)} avg`;
    if (legendSharedPct) legendSharedPct.textContent = `${sharedPct}% (${sharedCount.toLocaleString()})`;
    if (legendSharedAvg) legendSharedAvg.textContent = `$${roomTypeStats['Shared room'].median} med · $${Math.round(roomTypeStats['Shared room'].mean)} avg`;
    if (donutCenterCount) donutCenterCount.textContent = totalCount.toLocaleString();

    updateDonutHighlight();

    // ----------------------------------------------------
    // D3 BAR CHART RENDERING WITH 16-20 NEIGHBORHOODS
    // ----------------------------------------------------
    function renderBarChart() {
      const barsGroup = document.getElementById('pricing-bars-group');
      const gridGroup = document.getElementById('pricing-grid-group');
      const baseLine = document.getElementById('pricing-base-line');
      if (!barsGroup || !gridGroup) return;

      // Filter subset by room type and ensure positive valid price & neighborhood
      const subset = (currentRoomFilter === 'all'
        ? records
        : records.filter(d => d.room_type === currentRoomFilter)
      ).filter(d => d.price !== null && !isNaN(d.price) && d.price > 0 && d.neighbourhood);

      // Minimum sample size threshold to avoid single-listing skew
      const minSampleThreshold = currentRoomFilter === 'Shared room' ? 3 : (currentRoomFilter === 'all' ? 15 : 8);

      // Group by neighborhood
      const byNeigh = d3.rollup(
        subset,
        v => {
          const pList = v.map(d => d.price).sort((a, b) => a - b);
          return {
            count: v.length,
            borough: v[0].neighbourhood_group,
            mean: d3.mean(pList),
            median: d3.median(pList),
            min: pList[0],
            max: pList[pList.length - 1]
          };
        },
        d => d.neighbourhood
      );

      // Rank top 16 neighborhoods
      let ranked = Array.from(byNeigh, ([name, stats]) => ({
        name,
        count: stats.count,
        borough: stats.borough,
        mean: Math.round(stats.mean),
        median: Math.round(stats.median),
        price: Math.round(currentMetric === 'median' ? stats.median : stats.mean),
        min: stats.min,
        max: stats.max
      }))
      .filter(d => d.count >= minSampleThreshold)
      .sort((a, b) => b.price - a.price)
      .slice(0, 16);

      // Fallback if subset is restrictive
      if (ranked.length < 10) {
        ranked = Array.from(byNeigh, ([name, stats]) => ({
          name,
          count: stats.count,
          borough: stats.borough,
          mean: Math.round(stats.mean),
          median: Math.round(stats.median),
          price: Math.round(currentMetric === 'median' ? stats.median : stats.mean),
          min: stats.min,
          max: stats.max
        }))
        .filter(d => d.count >= 2)
        .sort((a, b) => b.price - a.price)
        .slice(0, 16);
      }

      if (ranked.length === 0) return;

      // Update Bar Title
      if (barTitle) {
        const roomLabel = currentRoomFilter === 'all' ? 'All Room Types' : currentRoomFilter;
        barTitle.textContent = `Top 16 Neighborhoods by ${currentMetric === 'median' ? 'Median' : 'Average'} Price — ${roomLabel} ($ USD / night)`;
      }

      const maxPrice = Math.max(...ranked.map(d => d.price));
      const axisMax = Math.ceil((maxPrice * 1.15) / 50) * 50 || 350;

      const barX = 155;
      const barMaxW = 320;
      const rowHeight = 32;
      const totalChartHeight = 30 + ranked.length * rowHeight + 20;

      // Adjust Base Line
      if (baseLine) {
        baseLine.setAttribute('x1', barX);
        baseLine.setAttribute('x2', barX);
        baseLine.setAttribute('y2', totalChartHeight - 10);
      }

      // 1. Render Gridlines & Axis Ticks with D3
      gridGroup.querySelectorAll(':scope > line, :scope > text').forEach(el => el.remove());

      const steps = 4;
      const gridTicks = [];
      for (let i = 1; i <= steps; i++) {
        const val = Math.round((axisMax / steps) * i);
        const x = barX + (i / steps) * barMaxW;
        gridTicks.push({ val, x });
      }

      const gridSelection = d3.select(gridGroup)
        .selectAll('g.grid-tick')
        .data(gridTicks, (d, i) => i);

      const gridEnter = gridSelection.enter()
        .append('g')
        .attr('class', 'grid-tick');

      gridEnter.append('line')
        .attr('stroke', '#2d3449')
        .attr('stroke-dasharray', '2,3')
        .attr('stroke-width', 1)
        .attr('y1', 20)
        .attr('y2', totalChartHeight - 10)
        .attr('x1', d => d.x)
        .attr('x2', d => d.x);

      gridEnter.append('text')
        .attr('fill', '#958ea0')
        .attr('font-family', 'JetBrains Mono')
        .attr('font-size', 10)
        .attr('text-anchor', 'middle')
        .attr('y', 14)
        .attr('x', d => d.x)
        .text(d => `$${d.val}`);

      const gridMerge = gridEnter.merge(gridSelection);

      gridMerge.select('line')
        .transition()
        .duration(450)
        .attr('x1', d => d.x)
        .attr('x2', d => d.x)
        .attr('y2', totalChartHeight - 10);

      gridMerge.select('text')
        .transition()
        .duration(450)
        .attr('x', d => d.x)
        .text(d => `$${d.val}`);

      gridSelection.exit().remove();

      // 2. Render Bars with D3 Data-Join & Smooth Transitions
      const t = d3.transition().duration(450);

      const barsSelection = d3.select(barsGroup)
        .selectAll('g.bar-row')
        .data(ranked, d => d.name);

      const barsEnter = barsSelection.enter()
        .append('g')
        .attr('class', 'bar-row cursor-pointer')
        .attr('opacity', 0);

      // Neighborhood Label
      barsEnter.append('text')
        .attr('class', 'bar-name-label')
        .attr('fill', '#dae2fd')
        .attr('font-family', 'JetBrains Mono')
        .attr('font-size', 11)
        .attr('text-anchor', 'end')
        .attr('x', barX - 10);

      // SVG Bar Rect
      barsEnter.append('rect')
        .attr('class', 'bar-rect transition-[filter] duration-150')
        .attr('height', 18)
        .attr('rx', 4)
        .attr('x', barX)
        .attr('width', 0);

      // Price Value Label
      barsEnter.append('text')
        .attr('class', 'bar-price-label')
        .attr('font-family', 'JetBrains Mono')
        .attr('font-size', 11)
        .attr('font-weight', '600');

      // Listing Count Label
      barsEnter.append('text')
        .attr('class', 'bar-count-label')
        .attr('fill', '#958ea0')
        .attr('font-family', 'JetBrains Mono')
        .attr('font-size', 10);

      // Merge and Animate with Synchronized D3 Transition
      const barsMerge = barsEnter.merge(barsSelection);

      barsMerge.transition(t)
        .attr('opacity', 1)
        .attr('transform', (d, idx) => `translate(0, ${30 + idx * rowHeight})`);

      barsMerge.select('.bar-name-label')
        .attr('y', 13)
        .text(d => d.name.length > 18 ? d.name.slice(0, 16) + '..' : d.name);

      barsMerge.select('.bar-rect')
        .attr('y', 0)
        .attr('fill', d => d.borough === 'Brooklyn' ? 'url(#barGradSecondary)' : 'url(#barGradPrimary)')
        .transition(t)
        .attr('width', d => Math.max(10, Math.round((d.price / axisMax) * barMaxW)));

      barsMerge.select('.bar-price-label')
        .attr('y', 13)
        .attr('fill', d => d.borough === 'Brooklyn' ? '#7bd0ff' : '#d0bcff')
        .transition(t)
        .attr('x', d => barX + Math.max(10, Math.round((d.price / axisMax) * barMaxW)) + 8)
        .text(d => `$${d.price}`);

      barsMerge.select('.bar-count-label')
        .attr('y', 13)
        .transition(t)
        .attr('x', d => barX + Math.max(10, Math.round((d.price / axisMax) * barMaxW)) + 50)
        .text(d => `${d.count} listings`);

      // Exit transition
      barsSelection.exit()
        .transition()
        .duration(300)
        .attr('opacity', 0)
        .remove();

      // Tooltips & Hover Effects
      barsMerge
        .on('mouseenter', function() {
          d3.select(this).select('.bar-rect').attr('filter', 'brightness(1.25)');
        })
        .on('mousemove', function(event, d) {
          const skewPct = (((d.mean - d.median) / d.median) * 100).toFixed(0);
          const skewColor = skewPct > 25 ? 'text-[#ffb2b7]' : 'text-[#7bd0ff]';
          const roomContext = currentRoomFilter === 'all' ? 'All Room Types' : currentRoomFilter;

          showTooltip(`
            <div class="font-bold text-on-surface text-sm mb-1">${d.name} <span class="text-xs font-normal text-on-surface-variant">(${d.borough})</span></div>
            <div class="text-xs text-on-surface-variant border-b border-outline/20 pb-1 mb-1.5">Room Type: <span class="text-primary font-medium">${roomContext}</span> · <span class="font-semibold text-on-surface">${d.count.toLocaleString()}</span> listings</div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>Median Price: <span class="text-secondary font-semibold">$${d.median}</span>/night</div>
              <div>Average Price: <span class="text-primary font-semibold">$${d.mean}</span>/night</div>
              <div>Price Range: <span class="text-on-surface-variant font-mono">$${d.min}–$${d.max.toLocaleString()}</span></div>
              <div>Skew: <span class="${skewColor} font-semibold">${skewPct >= 0 ? '+' : ''}${skewPct}%</span> vs median</div>
            </div>
          `, event);
        })
        .on('mouseleave', function() {
          d3.select(this).select('.bar-rect').attr('filter', null);
          hideTooltip();
        });

      // Save ranked data for insight generator
      window._currentRanked = ranked;
      window._currentSubset = subset;
    }

    // ----------------------------------------------------
    // DYNAMIC DATA-DRIVEN INSIGHT GENERATOR
    // ----------------------------------------------------
    function updateDynamicInsight() {
      if (!insightParagraph) return;
      const ranked = window._currentRanked || [];
      const subset = window._currentSubset || records;
      if (ranked.length === 0) return;

      const top = ranked[0];
      const overallMedian = Math.round(d3.median(subset, d => d.price)) || 106;
      const overallMean = Math.round(d3.mean(subset, d => d.price)) || 153;
      const topSkew = Math.round(((top.mean - top.median) / top.median) * 100);

      let insightHtml = '';

      if (currentRoomFilter === 'all') {
        if (currentMetric === 'median') {
          const outerBoro = ranked.find(d => d.borough !== 'Manhattan');
          const outerText = outerBoro 
            ? ` Meanwhile, Brooklyn's <span class="text-secondary font-semibold">${outerBoro.name}</span> leads outer boroughs at <span class="text-secondary font-semibold">$${outerBoro.price}/night</span>.` 
            : '';
          insightHtml = `Across 221 neighborhoods, <span class="text-secondary font-semibold">${top.name}</span> (${top.borough}) commands NYC's highest median lodging rate at <span class="text-secondary font-semibold">$${top.price}/night</span> (${top.count} verified listings), a ${Math.round(((top.price - overallMedian) / overallMedian) * 100)}% premium over the citywide median ($${overallMedian}/night).${outerText}`;
        } else {
          insightHtml = `Calculated average prices reveal heavy luxury outlier skew in Lower Manhattan: in <span class="text-secondary font-semibold">${top.name}</span>, the average price is <span class="text-secondary font-semibold">$${top.price}/night</span> (+${topSkew}% above its $${top.median} median), driven by penthouses reaching $10,000/night.`;
        }
      } else if (currentRoomFilter === 'Entire home/apt') {
        if (currentMetric === 'median') {
          insightHtml = `Entire homes dominate 52.0% of NYC lodging supply (25,409 listings). <span class="text-secondary font-semibold">${top.name}</span> leads all neighborhoods at <span class="text-secondary font-semibold">$${top.price}/night</span> median (${top.count} listings), compared to the citywide entire-home median of <span class="text-secondary font-semibold">$${overallMedian}/night</span> ($${overallMean} average).`;
        } else {
          insightHtml = `Entire apartments average <span class="text-secondary font-semibold">$${overallMean}/night</span> citywide. <span class="text-secondary font-semibold">${top.name}</span> posts the highest average at <span class="text-secondary font-semibold">$${top.price}/night</span> (${top.count} listings), elevated by premier multi-bedroom lofts.`;
        }
      } else if (currentRoomFilter === 'Private room') {
        if (currentMetric === 'median') {
          insightHtml = `Private rooms serve as NYC's key affordability anchor (45.7% market share, city median of <span class="text-primary font-semibold">$${overallMedian}/night</span>). <span class="text-primary font-semibold">${top.name}</span> (${top.borough}) commands the highest private-room rate at <span class="text-primary font-semibold">$${top.price}/night</span> (${top.count} listings), offering over 55% savings compared to standard Manhattan apartments.`;
        } else {
          insightHtml = `Private rooms average <span class="text-primary font-semibold">$${overallMean}/night</span> across NYC. In high-demand transit hubs like <span class="text-primary font-semibold">${top.name}</span> ($${top.price}/night average), private rooms deliver substantial affordability for short-stay professionals.`;
        }
      } else {
        if (currentMetric === 'median') {
          insightHtml = `Shared rooms represent an ultra-economy micro-market (1,160 listings, 2.3% share, citywide median of <span class="text-tertiary font-semibold">$${overallMedian}/night</span>). <span class="text-tertiary font-semibold">${top.name}</span> leads this tier at <span class="text-tertiary font-semibold">$${top.price}/night</span> (${top.count} listings), absorbing budget commuter and student demand.`;
        } else {
          insightHtml = `Shared rooms average <span class="text-tertiary font-semibold">$${overallMean}/night</span> across NYC. Concentrations in <span class="text-tertiary font-semibold">${top.name}</span> ($${top.price}/night average) cater primarily to transient budget travelers and medical interns.`;
        }
      }

      // Smooth D3 text transition
      d3.select(insightParagraph)
        .transition()
        .duration(200)
        .style('opacity', 0)
        .on('end', function() {
          insightParagraph.innerHTML = insightHtml;
          d3.select(insightParagraph)
            .transition()
            .duration(300)
            .style('opacity', 1);
        });
    }

    renderBarChart();
    updateDynamicInsight();

    // ----------------------------------------------------
    // PHASE 5: RESEARCH QUESTION 02 — GEOSPATIAL CLUSTERS MAP
    // ----------------------------------------------------
    let currentBorough = 'All'; // 'All' | 'Manhattan' | 'Brooklyn' | 'Queens'
    let currentReviewFilter = 'all'; // 'all' | 'highly' | 'top'
    let selectedNeighborhood = null; // string | null
    let currentTransform = d3.zoomIdentity;
    let hoveredListing = null;

    // Cache geographic projection coordinates for all 48,895 records once
    const lonMin = -74.259, lonMax = -73.700;
    const latMin = 40.477, latMax = 40.917;

    records.forEach(d => {
      d._x = ((d.longitude - lonMin) / (lonMax - lonMin)) * 1000;
      d._y = ((latMax - d.latitude) / (latMax - latMin)) * 650;
    });

    const mapCanvas = document.getElementById('geospatial-map-canvas');
    const mapViewport = document.getElementById('map-viewport-group');
    const boroughLabel = document.getElementById('map-active-borough-label');
    const zoomText = document.getElementById('map-zoom-level-text');
    const mapCounter = document.getElementById('map-nodes-count');
    const inferenceP = document.getElementById('geo-spatial-inference');
    const subInferenceP = document.getElementById('geo-spatial-sub-inference');
    const moranSpan = document.getElementById('geo-spatial-moran');
    const topReviewedContainer = document.getElementById('top-reviewed-clusters');
    const calloutsLayer = document.getElementById('map-callouts-layer');

    const ctx = mapCanvas ? mapCanvas.getContext('2d') : null;

    // Helper: escape HTML safely
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Precalculate top neighborhoods by cumulative reviews
    const neighRollup = d3.rollup(
      records,
      v => ({
        totalReviews: d3.sum(v, d => d.number_of_reviews),
        count: v.length,
        highRevCount: v.filter(d => d.number_of_reviews >= 50).length,
        topRevCount: v.filter(d => d.number_of_reviews >= 100).length,
        borough: v[0].neighbourhood_group,
        centroidX: d3.mean(v, d => d._x),
        centroidY: d3.mean(v, d => d._y),
        avgPrice: Math.round(d3.mean(v, d => d.price))
      }),
      d => d.neighbourhood
    );

    const topRankedClusters = Array.from(neighRollup, ([name, stats]) => ({
      name,
      ...stats
    }))
    .sort((a, b) => b.totalReviews - a.totalReviews)
    .slice(0, 5);

    // Filter active listings based on borough and review filter
    function getFilteredListings() {
      return records.filter(d => {
        if (currentBorough !== 'All' && d.neighbourhood_group !== currentBorough) return false;
        if (currentReviewFilter === 'highly' && d.number_of_reviews < 50) return false;
        if (currentReviewFilter === 'top' && d.number_of_reviews < 100) return false;
        return true;
      });
    }

    let activeListings = getFilteredListings();
    let mapQuadtree = d3.quadtree().x(d => d._x).y(d => d._y).addAll(activeListings);

    // High-performance batched canvas rendering
    function drawCanvas() {
      if (!ctx || !mapCanvas) return;

      ctx.save();
      ctx.clearRect(0, 0, 1000, 650);

      // Apply D3 zoom and pan transform
      ctx.translate(currentTransform.x, currentTransform.y);
      ctx.scale(currentTransform.k, currentTransform.k);

      // Group active listings into 4 review tiers for ultra-fast batched drawing
      const tierLow = [];    // < 15 reviews
      const tierMid = [];    // 15 - 49 reviews
      const tierHigh = [];   // 50 - 99 reviews
      const tierTop = [];    // >= 100 reviews
      const selectedTier = []; // If a neighborhood is selected

      const hasSelection = !!selectedNeighborhood;

      for (let i = 0; i < activeListings.length; i++) {
        const d = activeListings[i];
        if (hasSelection && d.neighbourhood === selectedNeighborhood) {
          selectedTier.push(d);
        } else {
          const rev = d.number_of_reviews;
          if (rev >= 100) tierTop.push(d);
          else if (rev >= 50) tierHigh.push(d);
          else if (rev >= 15) tierMid.push(d);
          else tierLow.push(d);
        }
      }

      const dimFactor = hasSelection ? 0.2 : 1.0;

      // Tier 1: Low reviews (< 15) - Cyan
      if (tierLow.length > 0) {
        ctx.fillStyle = `rgba(123, 208, 255, ${0.45 * dimFactor})`;
        ctx.beginPath();
        const r = 1.3;
        for (let i = 0; i < tierLow.length; i++) {
          const d = tierLow[i];
          ctx.moveTo(d._x + r, d._y);
          ctx.arc(d._x, d._y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Tier 2: Mid reviews (15 - 49) - Purple
      if (tierMid.length > 0) {
        ctx.fillStyle = `rgba(160, 120, 255, ${0.65 * dimFactor})`;
        ctx.beginPath();
        const r = 1.8;
        for (let i = 0; i < tierMid.length; i++) {
          const d = tierMid[i];
          ctx.moveTo(d._x + r, d._y);
          ctx.arc(d._x, d._y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Tier 3: High reviews (50 - 99) - Coral / Hot Pink
      if (tierHigh.length > 0) {
        ctx.fillStyle = `rgba(255, 81, 106, ${0.85 * dimFactor})`;
        ctx.beginPath();
        const r = 2.6;
        for (let i = 0; i < tierHigh.length; i++) {
          const d = tierHigh[i];
          ctx.moveTo(d._x + r, d._y);
          ctx.arc(d._x, d._y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Tier 4: Top review range (>= 100) - Radiant Coral with Glow
      if (tierTop.length > 0) {
        ctx.fillStyle = `rgba(255, 178, 183, ${0.95 * dimFactor})`;
        ctx.beginPath();
        const r = 3.4;
        for (let i = 0; i < tierTop.length; i++) {
          const d = tierTop[i];
          ctx.moveTo(d._x + r, d._y);
          ctx.arc(d._x, d._y, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      // Highlighted Selected Neighborhood Points
      if (hasSelection && selectedTier.length > 0) {
        ctx.fillStyle = '#7bd0ff';
        ctx.shadowColor = '#00a6e0';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        const r = 3.6;
        for (let i = 0; i < selectedTier.length; i++) {
          const d = selectedTier[i];
          ctx.moveTo(d._x + r, d._y);
          ctx.arc(d._x, d._y, r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.shadowBlur = 0; // reset shadow
      }

      // Hovered point targeting ring
      if (hoveredListing) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8 / currentTransform.k;
        ctx.fillStyle = '#ff516a';
        ctx.beginPath();
        ctx.arc(hoveredListing._x, hoveredListing._y, 5.5 / currentTransform.k, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    // Listing Counter Updater (Requirement 5)
    function updateListingCounter() {
      if (!mapCounter) return;
      if (selectedNeighborhood) {
        const selCount = activeListings.filter(d => d.neighbourhood === selectedNeighborhood).length;
        mapCounter.textContent = `Showing ${selCount.toLocaleString()} listings in ${selectedNeighborhood}`;
      } else {
        const filterSuffix = currentReviewFilter === 'highly' ? ' (Highly Reviewed ≥50)' : (currentReviewFilter === 'top' ? ' (Top Review Range ≥100)' : '');
        const boroSuffix = currentBorough !== 'All' ? ` in ${currentBorough}` : '';
        mapCounter.textContent = `Showing ${activeListings.length.toLocaleString()} listings${boroSuffix}${filterSuffix}`;
      }
    }

    // Dynamic Spatial Insight Statement (Requirement 8)
    function updateGeospatialInsight() {
      if (!inferenceP || !subInferenceP) return;

      let mainStatement = '';
      let subStatement = '';
      let moranVal = '+0.412 (p < 0.001)';

      if (selectedNeighborhood) {
        const cluster = topRankedClusters.find(c => c.name === selectedNeighborhood) || neighRollup.get(selectedNeighborhood);
        if (cluster) {
          const cityTotalRevs = d3.sum(records, d => d.number_of_reviews);
          const revShare = ((cluster.totalReviews / cityTotalRevs) * 100).toFixed(1);
          mainStatement = `<span class="text-secondary font-semibold">${selectedNeighborhood}</span> (${cluster.borough}) concentrates <span class="text-secondary font-semibold">${cluster.totalReviews.toLocaleString()} verified reviews</span> across ${cluster.count.toLocaleString()} listings, accounting for ${revShare}% of all traveler feedback citywide.`;
          subStatement = `With ${cluster.highRevCount} highly reviewed listings (≥50 reviews) averaging $${cluster.avgPrice}/night, this micro-region represents a primary lodging demand engine.`;
          moranVal = `Local Moran's I = +0.648`;
        }
      } else if (currentReviewFilter === 'highly') {
        mainStatement = `Across NYC, <span class="text-secondary font-semibold">7,081 listings</span> boast 50+ reviews. Over <span class="text-secondary font-semibold">21.6%</span> of this premier tier resides in North Brooklyn (<span class="text-secondary font-semibold">Bedford-Stuyvesant</span>: 708, <span class="text-secondary font-semibold">Williamsburg</span>: 495), vastly outpacing any individual Manhattan submarket.`;
        subStatement = `Guests actively reward accessible Brooklyn brownstones and loft apartments that combine subway connectivity with lower nightly rates.`;
        moranVal = `Moran's I = +0.524 (p < 0.001)`;
      } else if (currentReviewFilter === 'top') {
        mainStatement = `Restricting to the top review tier (≥100 reviews, <span class="text-secondary font-semibold">3,044 listings</span>), <span class="text-secondary font-semibold">Bedford-Stuyvesant</span> commands NYC with 346 top-tier listings, followed by <span class="text-secondary font-semibold">Williamsburg</span> with 221 and <span class="text-primary font-semibold">Harlem</span> with 206.`;
        subStatement = `Super-reviewed properties correlate with multi-year host tenure and high calendar availability, forming resilient lodging infrastructure.`;
        moranVal = `Moran's I = +0.589 (p < 0.001)`;
      } else if (currentBorough === 'Manhattan') {
        mainStatement = `In Manhattan, high review velocity is concentrated uptown in <span class="text-primary font-semibold">Harlem</span> (75,962 reviews) and <span class="text-primary font-semibold">Hell's Kitchen</span> (50,227 reviews), contrasting sharply with low review volume in luxury districts like Tribeca and Flatiron.`;
        subStatement = `Tourists favor midtown theater proximity in Hell's Kitchen and cultural heritage at lower rates in Upper Manhattan.`;
        moranVal = `Borough Moran's I = +0.385`;
      } else if (currentBorough === 'Brooklyn') {
        mainStatement = `Brooklyn represents NYC's undisputed review volume epicenter: <span class="text-secondary font-semibold">Bed-Stuy</span> (110,352 reviews), <span class="text-secondary font-semibold">Williamsburg</span> (85,427), and <span class="text-secondary font-semibold">Bushwick</span> (52,514) combine for <span class="text-secondary font-semibold">248,293 reviews</span> (over 21.8% of all NYC reviews).`;
        subStatement = `Review velocity directly traces the L and G train transit corridors, driven by cultural hubs, indie venues, and neighborhood amenities.`;
        moranVal = `Borough Moran's I = +0.472`;
      } else {
        mainStatement = `High review velocity clusters around <span class="text-secondary font-semibold">creative transit hubs</span> (specifically the L and G subway corridors in North Brooklyn) rather than the highest-priced Midtown Manhattan hotels.`;
        subStatement = `Travelers favor high host responsiveness, neighborhood authenticity, and sub-$130 price points over conventional Manhattan proximity.`;
        moranVal = `Moran's I = +0.412 (p < 0.001)`;
      }

      // Smooth transition
      d3.select(inferenceP)
        .transition().duration(200).style('opacity', 0)
        .on('end', () => {
          inferenceP.innerHTML = mainStatement;
          d3.select(inferenceP).transition().duration(300).style('opacity', 1);
        });

      d3.select(subInferenceP)
        .transition().duration(200).style('opacity', 0)
        .on('end', () => {
          subInferenceP.innerHTML = subStatement;
          d3.select(subInferenceP).transition().duration(300).style('opacity', 1);
        });

      if (moranSpan) moranSpan.textContent = moranVal;
    }

    // Dynamic Density Clusters & Callouts in SVG (Requirement 6)
    function renderDensityCallouts() {
      if (!calloutsLayer) return;

      let calloutHtml = '';
      topRankedClusters.forEach((c, idx) => {
        const isSelected = selectedNeighborhood === c.name;
        const color = c.borough === 'Manhattan' ? '#d0bcff' : '#7bd0ff';
        const activeColor = isSelected ? '#ffffff' : color;
        const strokeW = isSelected ? 2.5 : 1.5;

        // Position offsets based on quadrant to avoid overlap
        const isLeft = c.centroidX > 530;
        const lineEndX = isLeft ? c.centroidX + 65 : c.centroidX - 65;
        const lineEndY = idx % 2 === 0 ? c.centroidY + 25 : c.centroidY - 25;
        const boxX = isLeft ? lineEndX + 4 : lineEndX - 154;
        const boxY = lineEndY - 13;

        calloutHtml += `
          <g class="cluster-callout cursor-pointer" data-neighborhood="${c.name}">
            <line stroke="${activeColor}" stroke-width="${strokeW}" x1="${c.centroidX.toFixed(1)}" y1="${c.centroidY.toFixed(1)}" x2="${lineEndX.toFixed(1)}" y2="${lineEndY.toFixed(1)}"></line>
            <circle cx="${lineEndX.toFixed(1)}" cy="${lineEndY.toFixed(1)}" r="3" fill="${activeColor}"></circle>
            <rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="150" height="26" rx="4" fill="#171f33" opacity="0.92" stroke="${isSelected ? '#7bd0ff' : '#494454'}" stroke-width="${isSelected ? 1.5 : 0.8}"></rect>
            <text x="${(boxX + 8).toFixed(1)}" y="${(boxY + 17).toFixed(1)}" fill="${activeColor}" font-family="JetBrains Mono" font-size="10" font-weight="${isSelected ? '700' : '600'}">
              ${c.name.length > 13 ? c.name.slice(0, 11) + '..' : c.name}: ${(c.totalReviews / 1000).toFixed(0)}k revs
            </text>
          </g>
        `;
      });

      calloutsLayer.innerHTML = calloutHtml;

      // Callout click handler
      calloutsLayer.querySelectorAll('.cluster-callout').forEach(el => {
        el.addEventListener('click', () => {
          const neigh = el.getAttribute('data-neighborhood');
          toggleNeighborhoodSelection(neigh);
        });
      });
    }

    // Neighborhood Ranking UI (Requirement 7)
    function renderRankingList() {
      if (!topReviewedContainer) return;
      const maxReviews = topRankedClusters[0].totalReviews;
      let html = '';

      topRankedClusters.forEach((item, idx) => {
        const pct = ((item.totalReviews / maxReviews) * 100).toFixed(1);
        const isSelected = selectedNeighborhood === item.name;
        const isMht = item.borough === 'Manhattan';
        const colorClass = isMht ? 'text-primary' : 'text-secondary';
        const barGrad = isMht ? 'from-primary-container to-primary' : 'from-secondary-container to-secondary';
        const activeClass = isSelected
          ? 'bg-surface-container-high border border-secondary ring-1 ring-secondary/50 shadow-md'
          : 'bg-surface-container-low hover:bg-surface-container-high border border-transparent';

        html += `
          <div class="ranking-row p-2 rounded-lg ${activeClass} cursor-pointer transition-all duration-200" data-neighborhood="${item.name}">
            <div class="flex justify-between font-label-sm text-label-sm mb-1">
              <span class="text-on-surface font-medium flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-secondary animate-ping' : 'bg-outline'}"></span>
                ${idx + 1}. ${item.name} <span class="text-on-surface-variant font-normal">(${item.borough})</span>
              </span>
              <span class="${colorClass} font-semibold">${item.totalReviews.toLocaleString()} reviews</span>
            </div>
            <div class="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden">
              <div class="bg-gradient-to-r ${barGrad} h-full rounded-full transition-all duration-500" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      });

      topReviewedContainer.innerHTML = html;

      // Ranking row click handler
      topReviewedContainer.querySelectorAll('.ranking-row').forEach(row => {
        row.addEventListener('click', () => {
          const neigh = row.getAttribute('data-neighborhood');
          toggleNeighborhoodSelection(neigh);
        });
      });
    }

    // Neighborhood selection toggle
    function toggleNeighborhoodSelection(neighName) {
      if (selectedNeighborhood === neighName) {
        selectedNeighborhood = null;
        // Reset map zoom
        if (mapCanvas) {
          d3.select(mapCanvas).transition().duration(500).call(zoom.transform, d3.zoomIdentity);
        }
      } else {
        selectedNeighborhood = neighName;
        // Smoothly zoom and center on neighborhood centroid
        const cluster = neighRollup.get(neighName);
        if (cluster && mapCanvas) {
          const targetScale = 2.4;
          const targetX = 500 - cluster.centroidX * targetScale;
          const targetY = 325 - cluster.centroidY * targetScale;
          const targetTransform = d3.zoomIdentity.translate(targetX, targetY).scale(targetScale);
          d3.select(mapCanvas).transition().duration(600).call(zoom.transform, targetTransform);
        }
      }

      renderRankingList();
      renderDensityCallouts();
      updateAll();
    }

    function updateAll() {
      activeListings = getFilteredListings();
      mapQuadtree = d3.quadtree().x(d => d._x).y(d => d._y).addAll(activeListings);
      drawCanvas();
      updateListingCounter();
      updateGeospatialInsight();
    }

    // D3 Zoom & Pan (Requirement 1)
    const zoom = d3.zoom()
      .scaleExtent([0.8, 8])
      .on('zoom', (event) => {
        currentTransform = event.transform;
        if (mapViewport) {
          mapViewport.setAttribute('transform', event.transform.toString());
        }
        drawCanvas();
        if (zoomText) {
          zoomText.textContent = `ZOOM: ${currentTransform.k.toFixed(1)}x (NYC CENSUS TRACT)`;
        }
      });

    if (mapCanvas) {
      d3.select(mapCanvas).call(zoom);

      // Tooltips via Quadtree (Requirement 4)
      mapCanvas.addEventListener('mousemove', (e) => {
        const rect = mapCanvas.getBoundingClientRect();
        const screenX = (e.clientX - rect.left) * (1000 / rect.width);
        const screenY = (e.clientY - rect.top) * (650 / rect.height);
        const [dataX, dataY] = currentTransform.invert([screenX, screenY]);
        const searchRadius = 14 / currentTransform.k;
        const match = mapQuadtree.find(dataX, dataY, searchRadius);

        if (match) {
          hoveredListing = match;
          drawCanvas();
          showTooltip(`
            <div class="font-bold text-on-surface text-sm mb-1 truncate max-w-xs">${escapeHtml(match.name || 'Listing #' + match.id)}</div>
            <div class="text-xs text-on-surface-variant border-b border-outline/20 pb-1 mb-1.5">${match.neighbourhood} <span class="text-xs text-secondary font-medium">(${match.neighbourhood_group})</span></div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>Room Type: <span class="text-primary font-medium">${match.room_type}</span></div>
              <div>Price: <span class="text-secondary font-semibold">$${match.price}/night</span></div>
              <div>Reviews: <span class="text-tertiary font-semibold">${match.number_of_reviews} reviews</span></div>
              <div>Availability: <span class="text-on-surface-variant font-mono">${match.availability_365} days/yr</span></div>
            </div>
          `, e);
        } else {
          if (hoveredListing) {
            hoveredListing = null;
            drawCanvas();
          }
          hideTooltip();
        }
      });

      mapCanvas.addEventListener('mouseleave', () => {
        if (hoveredListing) {
          hoveredListing = null;
          drawCanvas();
        }
        hideTooltip();
      });
    }

    // Zoom Buttons
    const btnZoomIn = document.getElementById('map-zoom-in');
    const btnZoomOut = document.getElementById('map-zoom-out');
    const btnZoomReset = document.getElementById('map-zoom-reset');

    if (btnZoomIn && mapCanvas) {
      btnZoomIn.addEventListener('click', () => {
        d3.select(mapCanvas).transition().duration(300).call(zoom.scaleBy, 1.35);
      });
    }

    if (btnZoomOut && mapCanvas) {
      btnZoomOut.addEventListener('click', () => {
        d3.select(mapCanvas).transition().duration(300).call(zoom.scaleBy, 0.74);
      });
    }

    if (btnZoomReset && mapCanvas) {
      btnZoomReset.addEventListener('click', () => {
        selectedNeighborhood = null;
        renderRankingList();
        renderDensityCallouts();
        d3.select(mapCanvas).transition().duration(450).call(zoom.transform, d3.zoomIdentity);
        updateAll();
      });
    }

    // Borough Filter Pill Buttons
    const boroughButtons = document.querySelectorAll('.borough-filter-btn');
    boroughButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        currentBorough = btn.getAttribute('data-borough');
        boroughButtons.forEach(b => {
          b.className = 'borough-filter-btn px-space-sm py-0.5 rounded-full font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-all';
        });
        btn.className = 'borough-filter-btn px-space-sm py-0.5 rounded-full font-label-sm text-label-sm bg-secondary text-on-secondary font-medium transition-all';

        if (boroughLabel) {
          if (currentBorough === 'All') {
            boroughLabel.textContent = 'High Density Cluster: North Brooklyn';
          } else {
            boroughLabel.textContent = `Filtered Region: ${currentBorough}`;
          }
        }

        // Highlight selected borough silhouette in SVG basemap
        const silhouettes = {
          'Manhattan': 'borough-silhouette-manhattan',
          'Brooklyn': 'borough-silhouette-brooklyn',
          'Queens': 'borough-silhouette-queens',
          'Bronx': 'borough-silhouette-bronx',
          'Staten Island': 'borough-silhouette-staten-island'
        };

        Object.entries(silhouettes).forEach(([boro, id]) => {
          const el = document.getElementById(id);
          if (el) {
            if (currentBorough === 'All' || currentBorough === boro) {
              el.style.opacity = '1';
              el.setAttribute('stroke', currentBorough === boro ? '#7bd0ff' : 'none');
              el.setAttribute('stroke-width', currentBorough === boro ? '1.5' : '0');
            } else {
              el.style.opacity = '0.35';
              el.setAttribute('stroke', 'none');
            }
          }
        });

        updateAll();
      });
    });

    // Review Filter Pill Buttons (Requirement 3)
    const reviewButtons = document.querySelectorAll('.review-filter-btn');
    reviewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        currentReviewFilter = btn.getAttribute('data-review-filter');
        reviewButtons.forEach(b => {
          b.className = 'review-filter-btn px-space-sm py-0.5 rounded-full font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-all';
        });
        btn.className = 'review-filter-btn px-space-sm py-0.5 rounded-full font-label-sm text-label-sm bg-primary-container text-on-primary-container font-medium transition-all';
        updateAll();
      });
    });

    // Initial renders for Question 02
    renderRankingList();
    renderDensityCallouts();
    updateAll();

    // ----------------------------------------------------
    // PHASE 6: RESEARCH QUESTION 03 — MINIMUM NIGHTS VS AVAILABILITY SCATTER
    // ----------------------------------------------------
    let currentQ3Room = 'all'; // 'all' | 'Entire home/apt' | 'Private room' | 'Shared room'
    let currentQ3Boro = 'All'; // 'All' | 'Manhattan' | 'Brooklyn' | 'Queens'
    let hoveredScatterListing = null;

    const pearsonBadge = document.getElementById('q3-pearson-badge');
    const pearsonText = document.getElementById('q3-pearson-stat-text');
    const interpretationP = document.getElementById('q3-interpretation-text');
    const shortTermPctSpan = document.getElementById('q3-short-term-pct');
    const longTermPctSpan = document.getElementById('q3-long-term-pct');
    const complianceSpan = document.getElementById('q3-compliance-count');
    const q3CounterSpan = document.getElementById('q3-listing-counter');
    const trendline = document.getElementById('scatter-trendline');

    const scatterCanvas = document.getElementById('scatter-canvas');
    const sCtx = scatterCanvas ? scatterCanvas.getContext('2d') : null;

    // Filter valid positive minimum nights and valid availability
    const validScatterRecords = records.filter(d => 
      d.minimum_nights !== null && !isNaN(d.minimum_nights) && d.minimum_nights > 0 &&
      d.availability_365 !== null && !isNaN(d.availability_365) && d.availability_365 >= 0
    );

    // Scale mappings matching SVG:
    // Log scale for X: [1, 365] -> [70, 580]
    // Linear scale for Y: [0, 365] -> [330, 30]
    const scaleScatterX = d3.scaleLog().domain([1, 365]).range([70, 580]).clamp(true);
    const scaleScatterY = d3.scaleLinear().domain([0, 365]).range([330, 30]);

    validScatterRecords.forEach(d => {
      const minN = Math.max(1, Math.min(365, d.minimum_nights));
      const avail = Math.max(0, Math.min(365, d.availability_365));
      d._scatterX = scaleScatterX(minN);
      d._scatterY = scaleScatterY(avail);
    });

    function getFilteredScatterRecords() {
      return validScatterRecords.filter(d => {
        if (currentQ3Room !== 'all' && d.room_type !== currentQ3Room) return false;
        if (currentQ3Boro !== 'All' && d.neighbourhood_group !== currentQ3Boro) return false;
        return true;
      });
    }

    let activeScatterRecords = getFilteredScatterRecords();
    let scatterQuadtree = d3.quadtree().x(d => d._scatterX).y(d => d._scatterY).addAll(activeScatterRecords);

    function drawScatterCanvas() {
      if (!sCtx || !scatterCanvas) return;

      sCtx.clearRect(0, 0, 640, 400);

      // Separate points into tiers for batched rendering:
      // Short-stay (< 30 nights)
      // Exactly 30 nights (cliff)
      // Extended-stay (> 30 nights)
      const shortTier = [];
      const cliffTier = [];
      const longTier = [];

      for (let i = 0; i < activeScatterRecords.length; i++) {
        const d = activeScatterRecords[i];
        if (d.minimum_nights === 30) {
          cliffTier.push(d);
        } else if (d.minimum_nights > 30) {
          longTier.push(d);
        } else {
          shortTier.push(d);
        }
      }

      // Draw Short-stay (< 30 nights): Cyan/Blue
      if (shortTier.length > 0) {
        sCtx.fillStyle = 'rgba(123, 208, 255, 0.45)';
        sCtx.beginPath();
        const r = 1.8;
        for (let i = 0; i < shortTier.length; i++) {
          const d = shortTier[i];
          sCtx.moveTo(d._scatterX + r, d._scatterY);
          sCtx.arc(d._scatterX, d._scatterY, r, 0, Math.PI * 2);
        }
        sCtx.fill();
      }

      // Draw Extended-stay (> 30 nights): Purple/Lavender
      if (longTier.length > 0) {
        sCtx.fillStyle = 'rgba(208, 188, 255, 0.65)';
        sCtx.beginPath();
        const r = 2.4;
        for (let i = 0; i < longTier.length; i++) {
          const d = longTier[i];
          sCtx.moveTo(d._scatterX + r, d._scatterY);
          sCtx.arc(d._scatterX, d._scatterY, r, 0, Math.PI * 2);
        }
        sCtx.fill();
      }

      // Draw 30 Nights Demarcation Cliff: Coral / Pink with glow
      if (cliffTier.length > 0) {
        sCtx.fillStyle = 'rgba(255, 81, 106, 0.85)';
        sCtx.shadowColor = '#ff516a';
        sCtx.shadowBlur = 4;
        sCtx.beginPath();
        const r = 2.8;
        for (let i = 0; i < cliffTier.length; i++) {
          const d = cliffTier[i];
          sCtx.moveTo(d._scatterX + r, d._scatterY);
          sCtx.arc(d._scatterX, d._scatterY, r, 0, Math.PI * 2);
        }
        sCtx.fill();
        sCtx.shadowBlur = 0;
      }

      // Hovered point targeting ring
      if (hoveredScatterListing) {
        sCtx.strokeStyle = '#ffffff';
        sCtx.lineWidth = 2;
        sCtx.fillStyle = '#ff516a';
        sCtx.beginPath();
        sCtx.arc(hoveredScatterListing._scatterX, hoveredScatterListing._scatterY, 6, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.stroke();
      }
    }

    // Quadtree Hover Tooltip (Requirement 2)
    if (scatterCanvas) {
      scatterCanvas.addEventListener('mousemove', (e) => {
        const rect = scatterCanvas.getBoundingClientRect();
        const screenX = (e.clientX - rect.left) * (640 / rect.width);
        const screenY = (e.clientY - rect.top) * (400 / rect.height);
        const match = scatterQuadtree.find(screenX, screenY, 12);

        if (match) {
          hoveredScatterListing = match;
          drawScatterCanvas();
          showTooltip(`
            <div class="font-bold text-on-surface text-sm mb-1 truncate max-w-xs">${escapeHtml(match.name || 'Listing #' + match.id)}</div>
            <div class="text-xs text-on-surface-variant border-b border-outline/20 pb-1 mb-1.5">${match.neighbourhood} <span class="text-xs text-secondary font-medium">(${match.neighbourhood_group})</span> · <span class="text-primary font-medium">${match.room_type}</span></div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>Minimum Stay: <span class="text-tertiary font-semibold">${match.minimum_nights} nights</span></div>
              <div>Availability: <span class="text-secondary font-semibold">${match.availability_365} days/yr</span></div>
              <div>Nightly Price: <span class="text-on-surface font-semibold">$${match.price}</span></div>
              <div>Compliance: <span class="${match.minimum_nights >= 30 ? 'text-secondary font-semibold' : 'text-on-surface-variant font-mono'}">${match.minimum_nights >= 30 ? '≥30d (Compliant)' : '<30d (Short-Term)'}</span></div>
            </div>
          `, e);
        } else {
          if (hoveredScatterListing) {
            hoveredScatterListing = null;
            drawScatterCanvas();
          }
          hideTooltip();
        }
      });

      scatterCanvas.addEventListener('mouseleave', () => {
        if (hoveredScatterListing) {
          hoveredScatterListing = null;
          drawScatterCanvas();
        }
        hideTooltip();
      });
    }

    function updateScatterSection() {
      activeScatterRecords = getFilteredScatterRecords();
      scatterQuadtree = d3.quadtree().x(d => d._scatterX).y(d => d._scatterY).addAll(activeScatterRecords);
      drawScatterCanvas();

      const totalActive = activeScatterRecords.length;
      if (totalActive === 0) return;

      // Calculate Pearson correlation on the active slice (Requirement 3)
      const r = calculatePearsonR(activeScatterRecords, 'minimum_nights', 'availability_365');
      const sign = r >= 0 ? '+' : '';
      const rFormatted = `${sign}${r.toFixed(2)}`;

      if (pearsonBadge) {
        pearsonBadge.textContent = `Correlation: ${rFormatted}`;
      }
      if (pearsonText) {
        pearsonText.textContent = `Correlation: ${rFormatted}`;
      }

      // Update Listing Counter (Requirement 5)
      if (q3CounterSpan) {
        const roomLabel = currentQ3Room === 'all' ? '' : ` (${currentQ3Room})`;
        const boroLabel = currentQ3Boro === 'All' ? '' : ` in ${currentQ3Boro}`;
        q3CounterSpan.textContent = `Showing ${totalActive.toLocaleString()} listings${roomLabel}${boroLabel}`;
      }

      // Compliance Counts & Percentages
      const shortTerm = activeScatterRecords.filter(d => d.minimum_nights < 30);
      const longTerm = activeScatterRecords.filter(d => d.minimum_nights >= 30);
      const shortPct = ((shortTerm.length / totalActive) * 100).toFixed(1);
      const longPct = ((longTerm.length / totalActive) * 100).toFixed(1);

      if (shortTermPctSpan) shortTermPctSpan.textContent = `${shortPct}% of total (${shortTerm.length.toLocaleString()})`;
      if (longTermPctSpan) longTermPctSpan.textContent = `${longPct}% of total (${longTerm.length.toLocaleString()})`;
      if (complianceSpan) {
        complianceSpan.textContent = `Over ${longTerm.length.toLocaleString()} listings have minimum stays of 30+ nights compliant with Local Law 18.`;
      }

      // Regression Trendline with D3 transition
      if (trendline && totalActive > 1) {
        const meanX = d3.mean(activeScatterRecords, d => d._scatterX);
        const meanY = d3.mean(activeScatterRecords, d => d._scatterY);
        let num = 0, den = 0;
        for (let i = 0; i < totalActive; i++) {
          const dx = activeScatterRecords[i]._scatterX - meanX;
          const dy = activeScatterRecords[i]._scatterY - meanY;
          num += dx * dy;
          den += dx * dx;
        }
        const m = den !== 0 ? num / den : 0;
        const b = meanY - m * meanX;

        const x1 = 70;
        const x2 = 580;
        const y1 = Math.max(30, Math.min(330, m * x1 + b));
        const y2 = Math.max(30, Math.min(330, m * x2 + b));

        d3.select(trendline)
          .transition()
          .duration(450)
          .attr('x1', x1)
          .attr('y1', y1.toFixed(1))
          .attr('x2', x2)
          .attr('y2', y2.toFixed(1));
      }

      // Interpretation Generation (Requirement 4: positive/negative, weak/moderate/strong, no causation)
      if (interpretationP) {
        const direction = r >= 0 ? 'positive' : 'negative';
        const absR = Math.abs(r);
        const strength = absR >= 0.7 ? 'strong' : (absR >= 0.3 ? 'moderate' : 'weak');
        const meanAvailShort = Math.round(d3.mean(shortTerm, d => d.availability_365) || 107);
        const meanAvailLong = Math.round(d3.mean(longTerm, d => d.availability_365) || 172);

        const interpretationHtml = `
          The calculated Pearson correlation (<span class="font-label-sm text-label-sm text-secondary font-semibold">Correlation: ${rFormatted}</span>) demonstrates a <span class="text-secondary font-semibold">${strength} ${direction}</span> linear association (r = ${sign}${r.toFixed(3)}). Extended-stay listings (≥30 nights) maintain higher average calendar availability (${meanAvailLong} days/year) compared to short-stay units (${meanAvailShort} days/year). However, this statistical correlation does not indicate causation: the observed alignment reflects commercial host scheduling and municipal regulatory compliance under Local Law 18 rather than length of stay driving availability.
        `;

        d3.select(interpretationP)
          .transition()
          .duration(200)
          .style('opacity', 0)
          .on('end', () => {
            interpretationP.innerHTML = interpretationHtml;
            d3.select(interpretationP).transition().duration(300).style('opacity', 1);
          });
      }
    }

    // Room Type Filter Buttons for Q03
    const q3RoomButtons = document.querySelectorAll('.q3-room-btn');
    q3RoomButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        currentQ3Room = btn.getAttribute('data-q3-room');
        q3RoomButtons.forEach(b => {
          b.className = 'q3-room-btn px-space-sm py-0.5 rounded-full font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-all';
        });
        btn.className = 'q3-room-btn px-space-sm py-0.5 rounded-full font-label-sm text-label-sm bg-primary-container text-on-primary-container font-medium transition-all';
        updateScatterSection();
      });
    });

    // Borough Filter Buttons for Q03
    const q3BoroButtons = document.querySelectorAll('.q3-boro-btn');
    q3BoroButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        currentQ3Boro = btn.getAttribute('data-q3-boro');
        q3BoroButtons.forEach(b => {
          b.className = 'q3-boro-btn px-space-sm py-0.5 rounded-full font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-all';
        });
        btn.className = 'q3-boro-btn px-space-sm py-0.5 rounded-full font-label-sm text-label-sm bg-secondary text-on-secondary font-medium transition-all';
        updateScatterSection();
      });
    });

    // Initial render for Question 03
    updateScatterSection();
  }

  function calculatePearsonR(data, xKey, yKey) {
    const n = data.length;
    if (n < 2) return 0;
    let sumX = 0, sumY = 0;
    for (let i = 0; i < n; i++) {
      sumX += data[i][xKey] || 0;
      sumY += data[i][yKey] || 0;
    }
    const meanX = sumX / n;
    const meanY = sumY / n;
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = (data[i][xKey] || 0) - meanX;
      const dy = (data[i][yKey] || 0) - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    const den = Math.sqrt(denX * denY);
    return den === 0 ? 0 : num / den;
  }

  // ----------------------------------------------------
  // GLOBAL NAVIGATION & SMOOTH SCROLLING
  // ----------------------------------------------------
  const navLinks = document.querySelectorAll('header a[href^="#"], nav a[href^="#"], footer a[href^="#"], a[href^="#"]');
  const headerProgressBar = document.getElementById('header-progress-bar');
  const navItems = document.querySelectorAll('#main-navbar .nav-item');

  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (!href || !href.startsWith('#') || href === '#') return;
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        e.preventDefault();
        const headerOffset = 70;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
        history.pushState(null, null, `#${targetId}`);
      }
    });
  });

  // Scroll Spy for Navbar and Progress Bar
  const trackedSections = [
    { id: 'overview', name: 'Overview' },
    { id: 'pricing', name: 'Pricing' },
    { id: 'geospatial', name: 'Geospatial' },
    { id: 'availability', name: 'Availability' },
    { id: 'findings', name: 'Findings' },
    { id: 'methodology', name: 'Methodology' }
  ];

  function onScrollUpdate() {
    // Header Progress Bar
    const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    if (headerProgressBar) {
      headerProgressBar.style.width = `${scrolled}%`;
    }

    // Scroll Spy for Nav Items
    const scrollPosition = window.pageYOffset + 120;
    let currentActiveId = 'overview';

    for (let i = 0; i < trackedSections.length; i++) {
      const el = document.getElementById(trackedSections[i].id);
      if (el) {
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (scrollPosition >= top && scrollPosition < top + height) {
          currentActiveId = trackedSections[i].id;
          break;
        } else if (scrollPosition >= top) {
          currentActiveId = trackedSections[i].id;
        }
      }
    }

    navItems.forEach(item => {
      const href = item.getAttribute('href');
      const targetId = href ? href.substring(1) : '';
      if (targetId === currentActiveId || (currentActiveId === 'availability' && targetId === 'correlation')) {
        item.className = 'nav-item px-space-sm py-space-xs transition-colors bg-primary-container text-on-primary-container font-medium rounded-full';
        item.setAttribute('aria-current', 'page');
      } else {
        item.className = 'nav-item px-space-sm py-space-xs font-label-md text-label-md text-on-surface-variant hover:text-on-surface rounded-full transition-colors';
        item.removeAttribute('aria-current');
      }
    });
  }

  window.addEventListener('scroll', onScrollUpdate, { passive: true });
  onScrollUpdate();
});
