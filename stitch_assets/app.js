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
    // PHASE 5: QUESTION 02 — GEOSPATIAL CLUSTERS MAP
    // ----------------------------------------------------
    let currentBorough = 'All'; // 'All' | 'Manhattan' | 'Brooklyn' | 'Queens'
    let currentZoom = 1.0;
    let panX = 0;
    let panY = 0;

    const mapLayer = document.getElementById('map-live-points-layer');
    const mapViewport = document.getElementById('map-viewport-group');
    const boroughLabel = document.getElementById('map-active-borough-label');
    const zoomText = document.getElementById('map-zoom-level-text');

    function projectCoords(lat, lon) {
      // Bounds: BBOX: [-74.259, 40.477, -73.700, 40.917]
      const lonMin = -74.259;
      const lonMax = -73.700;
      const latMin = 40.477;
      const latMax = 40.917;

      const x = ((lon - lonMin) / (lonMax - lonMin)) * 1000;
      const y = ((latMax - lat) / (latMax - latMin)) * 650;
      return { x, y };
    }

    // Sample stratified points for high performance & silky rendering
    // Pick representative points across boroughs
    const sampleSize = 2200;
    const step = Math.max(1, Math.floor(records.length / sampleSize));
    const sampledMapPoints = [];
    for (let i = 0; i < records.length; i += step) {
      sampledMapPoints.push(records[i]);
    }

    function renderMapPoints() {
      if (!mapLayer) return;

      const activeListings = currentBorough === 'All'
        ? sampledMapPoints
        : sampledMapPoints.filter(d => d.neighbourhood_group === currentBorough);

      let svgPoints = '';
      activeListings.forEach(d => {
        const { x, y } = projectCoords(d.latitude, d.longitude);
        if (x >= -20 && x <= 1020 && y >= -20 && y <= 670) {
          // Color based on review intensity
          let fill = '#7bd0ff';
          let r = 2.2;
          let opacity = 0.65;

          if (d.number_of_reviews >= 150) {
            fill = '#ff516a';
            r = 3.4;
            opacity = 0.85;
          } else if (d.number_of_reviews >= 50) {
            fill = '#a078ff';
            r = 2.8;
            opacity = 0.75;
          }

          svgPoints += `
            <circle 
              cx="${x.toFixed(1)}" 
              cy="${y.toFixed(1)}" 
              r="${r}" 
              fill="${fill}" 
              opacity="${opacity}" 
              class="map-node hover:r-5 hover:opacity-100 cursor-pointer transition-all duration-150"
              data-name="${escapeHtml(d.name || 'Listing')}"
              data-neigh="${d.neighbourhood}"
              data-borough="${d.neighbourhood_group}"
              data-price="$${d.price}"
              data-reviews="${d.number_of_reviews}"
              data-room="${d.room_type}"
            />
          `;
        }
      });

      mapLayer.innerHTML = svgPoints;

      // Map hover events
      mapLayer.querySelectorAll('.map-node').forEach(node => {
        node.addEventListener('mousemove', (e) => {
          const name = node.getAttribute('data-name');
          const neigh = node.getAttribute('data-neigh');
          const borough = node.getAttribute('data-borough');
          const price = node.getAttribute('data-price');
          const reviews = node.getAttribute('data-reviews');
          const room = node.getAttribute('data-room');

          showTooltip(`
            <div class="font-bold text-on-surface mb-0.5 line-clamp-1">${name}</div>
            <div class="text-xs text-on-surface-variant">${neigh} (${borough}) · ${room}</div>
            <div class="text-secondary font-semibold mt-1">${price}/night · ${reviews} reviews</div>
          `, e);
        });
        node.addEventListener('mouseleave', hideTooltip);
      });
    }

    function applyMapTransform() {
      if (mapViewport) {
        mapViewport.setAttribute('transform', `translate(${panX}, ${panY}) scale(${currentZoom})`);
      }
      if (zoomText) {
        zoomText.textContent = `ZOOM: ${currentZoom.toFixed(1)}x (NYC CENSUS TRACT)`;
      }
    }

    renderMapPoints();

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

        // Highlight selected borough silhouette
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

        renderMapPoints();
      });
    });

    // Zoom buttons
    const btnZoomIn = document.getElementById('map-zoom-in');
    const btnZoomOut = document.getElementById('map-zoom-out');
    const btnZoomReset = document.getElementById('map-zoom-reset');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        currentZoom = Math.min(3.5, currentZoom + 0.3);
        applyMapTransform();
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        currentZoom = Math.max(0.7, currentZoom - 0.3);
        applyMapTransform();
      });
    }

    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => {
        currentZoom = 1.0;
        panX = 0;
        panY = 0;
        applyMapTransform();
      });
    }

    // Top 5 Neighborhoods by Cumulative Reviews
    const topReviewedContainer = document.getElementById('top-reviewed-clusters');
    if (topReviewedContainer) {
      const neighReviews = d3.rollup(
        records,
        v => ({
          totalReviews: d3.sum(v, d => d.number_of_reviews),
          borough: v[0].neighbourhood_group,
          count: v.length
        }),
        d => d.neighbourhood
      );

      const top5 = Array.from(neighReviews, ([name, stats]) => ({
        name,
        totalReviews: stats.totalReviews,
        borough: stats.borough,
        count: stats.count
      }))
      .sort((a, b) => b.totalReviews - a.totalReviews)
      .slice(0, 5);

      const maxReviews = top5[0].totalReviews;
      let topHtml = '';

      top5.forEach((item, idx) => {
        const pct = ((item.totalReviews / maxReviews) * 100).toFixed(1);
        const isMht = item.borough === 'Manhattan';
        const colorClass = isMht ? 'text-primary' : 'text-secondary';
        const barGrad = isMht ? 'from-primary-container to-primary' : 'from-secondary-container to-secondary';

        topHtml += `
          <div>
            <div class="flex justify-between font-label-sm text-label-sm mb-1">
              <span class="text-on-surface font-medium">${idx + 1}. ${item.name} (${item.borough})</span>
              <span class="${colorClass} font-semibold">${item.totalReviews.toLocaleString()} reviews</span>
            </div>
            <div class="w-full bg-surface-container-low rounded-full h-3 overflow-hidden">
              <div class="bg-gradient-to-r ${barGrad} h-full rounded-full transition-all duration-500" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      });

      topReviewedContainer.innerHTML = topHtml;
    }

    // ----------------------------------------------------
    // PHASE 6: QUESTION 03 — MINIMUM NIGHTS VS AVAILABILITY SCATTER
    // ----------------------------------------------------
    const scatterLayer = document.getElementById('scatter-live-points-layer');
    const pearsonBadge = document.getElementById('q3-pearson-badge');
    const pearsonText = document.getElementById('q3-pearson-stat-text');
    const shortTermPctSpan = document.getElementById('q3-short-term-pct');
    const longTermPctSpan = document.getElementById('q3-long-term-pct');
    const complianceSpan = document.getElementById('q3-compliance-count');

    // Calculate real Pearson r
    const pearsonR = calculatePearsonR(records, 'minimum_nights', 'availability_365');
    const formattedR = (pearsonR >= 0 ? '+' : '') + pearsonR.toFixed(3);

    if (pearsonBadge) pearsonBadge.textContent = `Pearson r = ${formattedR} (Weak / Non-linear)`;
    if (pearsonText) pearsonText.textContent = `r = ${formattedR}`;

    const shortTermCount = records.filter(d => d.minimum_nights < 30).length;
    const longTermCount = records.filter(d => d.minimum_nights >= 30).length;
    const realShortPct = ((shortTermCount / totalCount) * 100).toFixed(1);
    const realLongPct = ((longTermCount / totalCount) * 100).toFixed(1);

    if (shortTermPctSpan) shortTermPctSpan.textContent = `${realShortPct}% of total`;
    if (longTermPctSpan) longTermPctSpan.textContent = `${realLongPct}% of total`;
    if (complianceSpan) {
      complianceSpan.textContent = `Over ${longTermCount.toLocaleString()} listings have minimum stays of 30+ nights compliant with Local Law 18.`;
    }

    // Scales for Scatter Plot:
    // Log scale for X: [1, 365] -> [70, 580]
    // Linear scale for Y: [0, 365] -> [330, 30]
    const scaleScatterX = d3.scaleLog().domain([1, 365]).range([70, 580]).clamp(true);
    const scaleScatterY = d3.scaleLinear().domain([0, 365]).range([330, 30]);

    if (scatterLayer) {
      // Stratified sample of 1,200 points for the scatter plot
      const scatterStep = Math.max(1, Math.floor(records.length / 1200));
      const scatterSample = [];
      for (let i = 0; i < records.length; i += scatterStep) {
        scatterSample.push(records[i]);
      }

      let scatterHtml = '';
      scatterSample.forEach(d => {
        const minNights = Math.max(1, Math.min(365, d.minimum_nights || 1));
        const avail = Math.max(0, Math.min(365, d.availability_365 || 0));

        const cx = scaleScatterX(minNights);
        const cy = scaleScatterY(avail);

        let fill = '#7bd0ff';
        let r = 2.4;
        let opacity = 0.55;

        if (d.minimum_nights === 30) {
          fill = '#ff516a';
          r = 3.6;
          opacity = 0.85;
        } else if (d.minimum_nights > 30) {
          fill = '#d0bcff';
          r = 2.8;
          opacity = 0.65;
        } else if (avail > 200) {
          fill = '#a078ff';
          r = 2.6;
          opacity = 0.6;
        }

        scatterHtml += `
          <circle 
            cx="${cx.toFixed(1)}" 
            cy="${cy.toFixed(1)}" 
            r="${r}" 
            fill="${fill}" 
            opacity="${opacity}" 
            class="scatter-dot hover:r-5 hover:opacity-100 cursor-pointer transition-all duration-150"
            data-name="${escapeHtml(d.name || 'Listing')}"
            data-nights="${d.minimum_nights}"
            data-avail="${d.availability_365}"
            data-price="$${d.price}"
            data-neigh="${d.neighbourhood}"
          />
        `;
      });

      scatterLayer.innerHTML = scatterHtml;

      // Scatter hover events
      scatterLayer.querySelectorAll('.scatter-dot').forEach(dot => {
        dot.addEventListener('mousemove', (e) => {
          const name = dot.getAttribute('data-name');
          const nights = dot.getAttribute('data-nights');
          const avail = dot.getAttribute('data-avail');
          const price = dot.getAttribute('data-price');
          const neigh = dot.getAttribute('data-neigh');

          showTooltip(`
            <div class="font-bold text-on-surface mb-0.5 line-clamp-1">${name}</div>
            <div class="text-xs text-on-surface-variant">${neigh} · ${price}/night</div>
            <div class="text-secondary font-semibold mt-1">Min Stay: ${nights} nights · Available: ${avail} days/year</div>
          `, e);
        });
        dot.addEventListener('mouseleave', hideTooltip);
      });
    }
  }

  function calculatePearsonR(data, xKey, yKey) {
    const n = data.length;
    if (n === 0) return 0;
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

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
});
