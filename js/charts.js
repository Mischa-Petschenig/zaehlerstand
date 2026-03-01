
/**
 * Chart rendering – SVG-based charts for consumption visualization
 */
var Charts = (function() {
  
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  function getConsumptionData(readings, meterId, period) {
    var meterReadings = readings.filter(function(r) { return r.meterId === meterId; })
      .sort(function(a, b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); });
    
    if (meterReadings.length < 2) return [];

    var data = [];
    for (var i = 1; i < meterReadings.length; i++) {
      var prev = meterReadings[i - 1];
      var curr = meterReadings[i];
      var consumption = curr.value - prev.value;
      var date = new Date(curr.date);
      data.push({
        value: consumption,
        date: date,
        label: formatPeriodLabel(date, period),
        rawDate: curr.date,
        meterValue: curr.value
      });
    }

    if (period === '6m') {
      data = data.slice(-6);
    } else if (period === '12m') {
      data = data.slice(-12);
    }
    // 'all' returns everything

    return data;
  }

  function getMultiMeterConsumption(meters, readings, type, period) {
    var filteredMeters = type ? meters.filter(function(m) { return m.type === type; }) : meters;
    var allData = {};

    filteredMeters.forEach(function(meter) {
      var data = getConsumptionData(readings, meter.id, period);
      data.forEach(function(d) {
        var key = d.label;
        if (!allData[key]) {
          allData[key] = { label: key, date: d.date, total: 0, meters: {} };
        }
        allData[key].total += d.value;
        allData[key].meters[meter.id] = d.value;
      });
    });

    return Object.values(allData).sort(function(a, b) {
      return a.date.getTime() - b.date.getTime();
    });
  }

  function formatPeriodLabel(date, period) {
    return MONTHS_SHORT[date.getMonth()] + ' ' + String(date.getFullYear()).slice(2);
  }

  // Bar Chart SVG
  function renderBarChart(data, unit, color) {
    if (!data || data.length === 0) {
      return '<div class="chart-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-8"/></svg><span>Nicht genug Daten für ein Diagramm</span></div>';
    }

    var width = 540;
    var height = 200;
    var padding = { top: 20, right: 10, bottom: 40, left: 10 };
    var chartW = width - padding.left - padding.right;
    var chartH = height - padding.top - padding.bottom;
    
    var maxVal = Math.max.apply(null, data.map(function(d) { return Math.abs(d.value); }));
    if (maxVal === 0) maxVal = 1;
    
    var barCount = data.length;
    var barGap = Math.min(8, chartW / barCount * 0.2);
    var barWidth = Math.min(48, (chartW - barGap * (barCount + 1)) / barCount);
    var totalBarsWidth = barCount * barWidth + (barCount + 1) * barGap;
    var startX = padding.left + (chartW - totalBarsWidth) / 2 + barGap;

    var svg = '<svg class="chart-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet">';

    // Grid lines
    var gridLines = 4;
    for (var g = 0; g <= gridLines; g++) {
      var gy = padding.top + (chartH / gridLines) * g;
      svg += '<line class="chart-grid-line" x1="' + padding.left + '" y1="' + gy + '" x2="' + (width - padding.right) + '" y2="' + gy + '"/>';
    }

    // Bars
    data.forEach(function(d, i) {
      var barH = (Math.abs(d.value) / maxVal) * chartH;
      var x = startX + i * (barWidth + barGap);
      var y = padding.top + chartH - barH;
      
      svg += '<g class="chart-bar-group">';
      svg += '<rect class="chart-bar" x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barH + '" fill="' + (color || 'var(--chart-color-1)') + '" rx="4" ry="4"/>';
      
      // Value label on top
      if (barH > 20 && barCount <= 12) {
        svg += '<text class="chart-value-label" x="' + (x + barWidth / 2) + '" y="' + (y - 6) + '" text-anchor="middle">' + formatChartValue(d.value) + '</text>';
      }
      
      // X-axis label
      svg += '<text class="chart-label" x="' + (x + barWidth / 2) + '" y="' + (height - 8) + '" text-anchor="middle">' + d.label + '</text>';
      svg += '</g>';
    });

    svg += '</svg>';
    return svg;
  }

  // Line Chart SVG
  function renderLineChart(data, unit, color) {
    if (!data || data.length < 2) {
      return '<div class="chart-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-8"/></svg><span>Mindestens 2 Datenpunkte benötigt</span></div>';
    }

    var width = 540;
    var height = 200;
    var padding = { top: 20, right: 20, bottom: 40, left: 20 };
    var chartW = width - padding.left - padding.right;
    var chartH = height - padding.top - padding.bottom;

    var values = data.map(function(d) { return d.meterValue || d.value; });
    var minVal = Math.min.apply(null, values);
    var maxVal = Math.max.apply(null, values);
    var range = maxVal - minVal;
    if (range === 0) range = 1;

    var points = data.map(function(d, i) {
      var x = padding.left + (i / (data.length - 1)) * chartW;
      var y = padding.top + chartH - ((d.meterValue || d.value) - minVal) / range * chartH;
      return { x: x, y: y, data: d };
    });

    var lineColor = color || 'var(--chart-color-1)';

    var svg = '<svg class="chart-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet">';

    // Grid lines
    var gridLines = 4;
    for (var g = 0; g <= gridLines; g++) {
      var gy = padding.top + (chartH / gridLines) * g;
      svg += '<line class="chart-grid-line" x1="' + padding.left + '" y1="' + gy + '" x2="' + (width - padding.right) + '" y2="' + gy + '"/>';
    }

    // Area fill
    var areaPath = 'M' + points[0].x + ',' + (padding.top + chartH);
    points.forEach(function(p) { areaPath += ' L' + p.x + ',' + p.y; });
    areaPath += ' L' + points[points.length - 1].x + ',' + (padding.top + chartH) + ' Z';
    svg += '<path class="chart-area" d="' + areaPath + '" fill="' + lineColor + '"/>';

    // Line
    var linePath = 'M' + points[0].x + ',' + points[0].y;
    for (var i = 1; i < points.length; i++) {
      linePath += ' L' + points[i].x + ',' + points[i].y;
    }
    svg += '<path class="chart-line" d="' + linePath + '" stroke="' + lineColor + '"/>';

    // Dots and labels
    points.forEach(function(p, i) {
      svg += '<circle class="chart-dot" cx="' + p.x + '" cy="' + p.y + '" r="4" fill="' + lineColor + '" stroke="var(--surface)" stroke-width="2"/>';
      
      // X label
      if (data.length <= 12 || i % Math.ceil(data.length / 8) === 0) {
        svg += '<text class="chart-label" x="' + p.x + '" y="' + (height - 8) + '" text-anchor="middle">' + p.data.label + '</text>';
      }
    });

    svg += '</svg>';
    return svg;
  }

  // Sparkline – tiny inline chart
  function renderSparkline(readings, meterId, width, height) {
    width = width || 60;
    height = height || 24;
    
    var meterReadings = readings.filter(function(r) { return r.meterId === meterId; })
      .sort(function(a, b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); })
      .slice(-8);

    if (meterReadings.length < 2) return '';

    var values = meterReadings.map(function(r) { return r.value; });
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = max - min;
    if (range === 0) range = 1;

    var points = values.map(function(v, i) {
      var x = (i / (values.length - 1)) * width;
      var y = height - ((v - min) / range) * (height - 4) - 2;
      return x + ',' + y;
    });

    var trending = values[values.length - 1] >= values[values.length - 2];
    var color = trending ? 'var(--primary)' : 'var(--success)';

    return '<span class="sparkline-container"><svg class="sparkline" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><polyline points="' + points.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  // Consumption comparison
  function getConsumptionComparison(readings, meterId) {
    var meterReadings = readings.filter(function(r) { return r.meterId === meterId; })
      .sort(function(a, b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); });

    if (meterReadings.length < 3) return null;

    var consumptions = [];
    for (var i = 1; i < meterReadings.length; i++) {
      consumptions.push(meterReadings[i].value - meterReadings[i - 1].value);
    }

    var lastConsumption = consumptions[consumptions.length - 1];
    var prevConsumption = consumptions[consumptions.length - 2];
    var avgConsumption = consumptions.reduce(function(a, b) { return a + b; }, 0) / consumptions.length;

    var changePercent = prevConsumption !== 0 ? ((lastConsumption - prevConsumption) / Math.abs(prevConsumption)) * 100 : 0;
    var vsAvgPercent = avgConsumption !== 0 ? ((lastConsumption - avgConsumption) / Math.abs(avgConsumption)) * 100 : 0;

    return {
      last: lastConsumption,
      previous: prevConsumption,
      average: avgConsumption,
      total: consumptions.reduce(function(a, b) { return a + b; }, 0),
      changePct: changePercent,
      vsAvgPct: vsAvgPercent,
      trend: lastConsumption > prevConsumption ? 'up' : (lastConsumption < prevConsumption ? 'down' : 'neutral'),
      count: consumptions.length
    };
  }

  // Get total consumption for a meter
  function getTotalConsumption(readings, meterId) {
    var meterReadings = readings.filter(function(r) { return r.meterId === meterId; })
      .sort(function(a, b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); });

    if (meterReadings.length < 2) return 0;
    return meterReadings[meterReadings.length - 1].value - meterReadings[0].value;
  }

  function formatChartValue(val) {
    if (Math.abs(val) >= 1000) {
      return (val / 1000).toFixed(1) + 'k';
    }
    if (Math.abs(val) >= 100) {
      return Math.round(val).toString();
    }
    return val.toFixed(1);
  }

  return {
    getConsumptionData: getConsumptionData,
    getMultiMeterConsumption: getMultiMeterConsumption,
    renderBarChart: renderBarChart,
    renderLineChart: renderLineChart,
    renderSparkline: renderSparkline,
    getConsumptionComparison: getConsumptionComparison,
    getTotalConsumption: getTotalConsumption
  };
})();
