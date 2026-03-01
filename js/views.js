
/**
 * View rendering functions – each returns an HTML string
 */
var Views = (function() {

  function dashboard(meters, readings, categories, expandedCategories, costRates, reminderInterval) {
    var totalMeters = meters.length;
    var totalReadings = readings.length;

    var html = '<div class="dashboard view-enter">';

    if (meters.length === 0) {
      html += '<div class="dashboard-empty">';
      html += '<div class="dashboard-empty-icon">' + Icons.clockBig + '</div>';
      html += '<h3>Willkommen!</h3>';
      html += '<p>Erstellen Sie Ihren ersten Zähler, um Ablesungen zu erfassen und den Verbrauch zu analysieren.</p>';
      html += '<button class="dashboard-start-btn" onclick="App.navigate(\'meters\')">Zähler anlegen</button>';
      html += '</div>';
      html += '</div>';
      return html;
    }

    // Reminder card for overdue meters
    var interval = reminderInterval || 30;
    var overdueMeters = Data.getOverdueMeters(meters, readings, interval);
    if (overdueMeters.length > 0) {
      var overdueNames = overdueMeters.slice(0, 3).map(function(o) { return o.meter.name; }).join(', ');
      if (overdueMeters.length > 3) overdueNames += ' +' + (overdueMeters.length - 3);
      html += '<div class="card reminder-card">';
      html += '<div class="reminder-icon">' + Icons.bell + '</div>';
      html += '<div class="reminder-content">';
      html += '<div class="reminder-title">Ablesung fällig</div>';
      html += '<div class="reminder-desc">' + overdueMeters.length + ' Zähler seit mehr als ' + interval + ' Tagen nicht abgelesen: ' + esc(overdueNames) + '</div>';
      html += '</div>';
      html += '<button class="reminder-action" onclick="App.navigate(\'add-reading\')">Ablesen</button>';
      html += '</div>';
    }

    // Stats
    html += '<div class="stats-grid">';
    html += '<button class="card card-clickable stat-card" onclick="App.navigate(\'meters\')">';
    html += '<div class="stat-number">' + totalMeters + '</div>';
    html += '<div class="stat-label">Zähler</div>';
    html += '</button>';
    html += '<button class="card card-clickable stat-card" onclick="App.navigate(\'readings\')">';
    html += '<div class="stat-number">' + totalReadings + '</div>';
    html += '<div class="stat-label">Ablesungen</div>';
    html += '</button>';
    html += '</div>';

    // Quick Actions
    html += '<div class="quick-actions">';
    html += '<button class="card card-clickable quick-action-btn" onclick="App.navigate(\'add-reading\')">';
    html += '<div class="quick-action-icon" style="background:var(--success-light);color:var(--success)">' + Icons.plus + '</div>';
    html += '<span class="quick-action-label">Ablesung erfassen</span>';
    html += '</button>';
    html += '<button class="card card-clickable quick-action-btn" onclick="App.navigate(\'report\')">';
    html += '<div class="quick-action-icon" style="background:var(--primary-light);color:var(--primary)">' + Icons.pieChart + '</div>';
    html += '<span class="quick-action-label">Bericht anzeigen</span>';
    html += '</button>';
    html += '</div>';

    // Consumption insights
    var hasInsights = false;
    meters.forEach(function(meter) {
      var comp = Charts.getConsumptionComparison(readings, meter.id);
      if (comp && comp.count >= 2) {
        if (!hasInsights) {
          html += '<section class="dashboard-section">';
          html += '<h2 class="section-title">Verbrauchs-Insights</h2>';
          hasInsights = true;
        }
        var trendIcon, trendValueClass;
        if (comp.trend === 'up') {
          trendIcon = '<div class="insight-icon insight-icon-up">' + Icons.trendUp + '</div>';
          trendValueClass = 'insight-value-up';
        } else if (comp.trend === 'down') {
          trendIcon = '<div class="insight-icon insight-icon-down">' + Icons.trendDown + '</div>';
          trendValueClass = 'insight-value-down';
        } else {
          trendIcon = '<div class="insight-icon insight-icon-neutral">' + Icons.barChart + '</div>';
          trendValueClass = 'insight-value-neutral';
        }

        var changeLabel = '';
        if (comp.changePct > 0) {
          changeLabel = '+' + Math.round(comp.changePct) + '% zum Vorperiode';
        } else if (comp.changePct < 0) {
          changeLabel = Math.round(comp.changePct) + '% zum Vorperiode';
        } else {
          changeLabel = 'Keine Veränderung';
        }

        html += '<div class="card insight-card">';
        html += trendIcon;
        html += '<div class="insight-content">';
        html += '<div class="insight-title">' + esc(meter.name) + '</div>';
        html += '<div class="insight-desc">' + changeLabel + '</div>';
        html += '</div>';
        html += '<div class="insight-value ' + trendValueClass + '">' + Data.formatNumber(Math.abs(comp.last)) + ' <span style="font-size:12px;font-weight:500">' + esc(meter.unit) + '</span></div>';
        html += '</div>';
      }
    });
    if (hasInsights) html += '</section>';

    // Consumption chart for first meter with data
    var chartMeter = null;
    meters.forEach(function(m) {
      if (!chartMeter) {
        var data = Charts.getConsumptionData(readings, m.id, '12m');
        if (data.length >= 2) chartMeter = m;
      }
    });

    if (chartMeter) {
      html += '<section class="dashboard-section">';
      html += '<h2 class="section-title">Verbrauch ' + Icons.barChart + '</h2>';
      html += '<div class="chart-container" id="dashboard-chart">';
      html += '<div class="chart-header">';
      html += '<span class="chart-title">' + esc(chartMeter.name) + '</span>';
      html += '<div class="chart-period-selector">';
      html += '<button class="chart-period-btn active" data-period="6m" onclick="App.changeDashboardChart(\'' + chartMeter.id + '\', \'6m\', this)">6M</button>';
      html += '<button class="chart-period-btn" data-period="12m" onclick="App.changeDashboardChart(\'' + chartMeter.id + '\', \'12m\', this)">12M</button>';
      html += '<button class="chart-period-btn" data-period="all" onclick="App.changeDashboardChart(\'' + chartMeter.id + '\', \'all\', this)">Alle</button>';
      html += '</div></div>';
      html += '<div class="chart-canvas" id="dashboard-chart-canvas">';
      var chartData = Charts.getConsumptionData(readings, chartMeter.id, '6m');
      html += Charts.renderBarChart(chartData, chartMeter.unit, Icons.getChartColor(chartMeter.type));
      html += '</div></div>';
      html += '</section>';
    }

    // Cost estimate
    if (readings.length > 0) {
      var totalMonthlyCost = 0;
      var hasCostData = false;
      meters.forEach(function(meter) {
        var comp = Charts.getConsumptionComparison(readings, meter.id);
        if (comp && comp.last > 0) {
          var rate = (costRates && costRates[meter.type]) || Data.defaultCostRates[meter.type] || 0;
          if (rate > 0) {
            totalMonthlyCost += comp.last * rate;
            hasCostData = true;
          }
        }
      });

      if (hasCostData) {
        html += '<section class="dashboard-section">';
        html += '<h2 class="section-title">Geschätzte Kosten ' + Icons.euroSign + '</h2>';
        html += '<div class="card cost-card">';
        html += '<div class="cost-header">';
        html += '<span class="cost-title">Letzter Verbrauchszeitraum</span>';
        html += '<button class="cost-edit-btn" onclick="App.showCostSettings()">Tarife anpassen</button>';
        html += '</div>';
        html += '<div class="cost-amount">' + Data.formatCurrency(totalMonthlyCost) + '</div>';
        html += '<div class="cost-period">basierend auf letzten Ablesungen</div>';
        html += '<div class="cost-breakdown">';
        html += '<div class="cost-breakdown-item">';
        html += '<div class="cost-breakdown-value">' + Data.formatCurrency(totalMonthlyCost * 12) + '</div>';
        html += '<div class="cost-breakdown-label">Hochrechnung/Jahr</div>';
        html += '</div>';
        html += '<div class="cost-breakdown-item">';
        html += '<div class="cost-breakdown-value">' + Data.formatCurrency(totalMonthlyCost / 30) + '</div>';
        html += '<div class="cost-breakdown-label">Pro Tag (Ø)</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        html += '</section>';
      }
    }

    // Meter groups by category
    if (meters.length > 0) {
      html += '<section class="dashboard-section">';
      html += '<h2 class="section-title">Zähler</h2>';
      var groups = Data.groupMetersByCategory(meters, categories);
      groups.forEach(function(group) {
        if (group.meters.length === 0) return;
        var catId = group.category.id;
        var isExpanded = expandedCategories && expandedCategories[catId];
        html += renderCategoryGroup(group, readings, isExpanded, 'dashboard');
      });
      html += '</section>';
    }

    // Recent readings
    var recent = readings.slice().sort(function(a, b) {
      return new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime();
    }).slice(0, 5);

    if (recent.length > 0) {
      html += '<section class="dashboard-section">';
      html += '<h2 class="section-title">Letzte Ablesungen <span class="section-badge">Neu</span></h2>';
      html += '<div class="recent-list">';
      recent.forEach(function(reading) {
        var meter = meters.find(function(m) { return m.id === reading.meterId; });
        if (!meter) return;
        html += '<button class="card card-clickable recent-card" onclick="App.navigate(\'meter-detail\',\'' + meter.id + '\')">';
        html += '<div class="recent-row">';
        html += Icons.meterIcon(meter.type);
        html += '<div class="recent-info">';
        html += '<div class="recent-meter">' + esc(meter.name) + '</div>';
        html += '<div class="recent-date">' + Data.formatDate(reading.date) + '</div>';
        html += '</div>';
        html += '<div class="recent-value">';
        html += '<span class="recent-val">' + Data.formatNumber(reading.value) + '</span>';
        html += '<span class="recent-unit">' + esc(meter.unit) + '</span>';
        html += '</div>';
        html += '</div></button>';
      });
      html += '</div></section>';
    }

    html += '</div>';
    return html;
  }

  function renderCategoryGroup(group, readings, isExpanded, context) {
    var catId = group.category.id;
    var catName = group.category.name;
    var meterCount = group.meters.length;

    var html = '<section class="category-group">';
    html += '<button class="category-header" onclick="App.toggleCategory(\'' + catId + '\')">';
    html += '<div class="category-header-left">';
    html += '<span class="category-chevron' + (isExpanded ? ' category-chevron-open' : '') + '">' + Icons.chevronDown + '</span>';
    html += '<h2 class="category-header-title">' + esc(catName) + '</h2>';
    html += '</div>';
    html += '<span class="category-header-count">' + meterCount + '</span>';
    html += '</button>';

    html += '<div class="category-content' + (isExpanded ? ' category-content-open' : '') + '">';
    if (isExpanded) {
      html += '<div class="meter-summary-list">';
      group.meters.forEach(function(meter) {
        var last = getLastReading(readings, meter.id);
        html += '<button class="card card-clickable meter-summary-card" onclick="App.navigate(\'meter-detail\',\'' + meter.id + '\')">';
        html += '<div class="meter-summary-row">';
        html += Icons.meterIcon(meter.type);
        html += '<div class="meter-summary-info">';
        html += '<div class="meter-summary-name">' + esc(meter.name) + '</div>';
        html += '<div class="meter-summary-number">' + esc(meter.number) + ' · ' + esc(meter.type) + '</div>';
        html += '</div>';
        html += '<div class="meter-summary-value">';
        if (last) {
          html += '<span class="summary-val">' + Data.formatNumber(last.value) + '</span>';
          html += '<span class="summary-unit">' + esc(meter.unit) + '</span>';
          html += '<div style="margin-top:4px">' + Charts.renderSparkline(readings, meter.id, 56, 20) + '</div>';
        } else {
          html += '<span class="summary-none">–</span>';
        }
        html += '</div>';
        html += '</div></button>';
      });
      html += '</div>';
    }
    html += '</div>';
    html += '</section>';
    return html;
  }

  function meterList(meters, readings, categories, expandedCategories, searchQuery) {
    if (meters.length === 0 && categories.length === 0) {
      var h = '<div class="view-enter">';
      h += emptyState(Icons.clockSmall, 'Keine Zähler vorhanden', 'Erstellen Sie Ihren ersten Zähler, um Ablesungen zu erfassen.', '+ Zähler anlegen', "App.navigate('add-meter')");
      h += '</div>';
      return h;
    }

    var html = '<div class="meter-list view-enter">';

    if (meters.length > 2) {
      html += '<div class="search-bar">';
      html += '<span class="search-icon">' + Icons.search + '</span>';
      html += '<input class="search-input" type="text" id="meter-search" placeholder="Zähler suchen..." value="' + escAttr(searchQuery || '') + '" oninput="App.handleMeterSearch(this.value)" autocomplete="off" />';
      html += '<button class="search-clear' + (searchQuery ? ' visible' : '') + '" id="meter-search-clear" onclick="App.clearMeterSearch()">' + Icons.closeX + '</button>';
      html += '</div>';
    }

    html += '<button class="card card-clickable category-manage-btn" onclick="App.navigate(\'manage-categories\')">';
    html += '<div class="category-manage-row">';
    html += '<div class="category-manage-icon">' + Icons.settings + '</div>';
    html += '<div class="category-manage-text">';
    html += '<div class="category-manage-title">Kategorien verwalten</div>';
    html += '<div class="category-manage-subtitle">' + categories.length + ' Kategorie' + (categories.length !== 1 ? 'n' : '') + '</div>';
    html += '</div>';
    html += '<span class="category-manage-chevron">' + Icons.chevronRight + '</span>';
    html += '</div></button>';

    var filteredMeters = meters;
    if (searchQuery) {
      var q = searchQuery.toLowerCase();
      filteredMeters = meters.filter(function(m) {
        return m.name.toLowerCase().indexOf(q) !== -1 ||
               m.number.toLowerCase().indexOf(q) !== -1 ||
               m.type.toLowerCase().indexOf(q) !== -1;
      });
    }

    if (filteredMeters.length === 0 && searchQuery) {
      html += '<div class="reading-filter-empty">Keine Zähler für "' + esc(searchQuery) + '" gefunden.</div>';
    } else if (filteredMeters.length === 0) {
      html += emptyState(Icons.clockSmall, 'Keine Zähler vorhanden', 'Erstellen Sie Ihren ersten Zähler.', '+ Zähler anlegen', "App.navigate('add-meter')");
    } else {
      var groups = Data.groupMetersByCategory(filteredMeters, categories);
      groups.forEach(function(group) {
        if (group.meters.length === 0) return;
        var catId = group.category.id;
        var isExpanded = expandedCategories && expandedCategories[catId];
        if (searchQuery) isExpanded = true;
        html += renderMeterListGroup(group, readings, isExpanded);
      });
    }

    html += '<button class="fab" onclick="App.navigate(\'add-meter\')" aria-label="Zähler hinzufügen">' + Icons.plus + '</button>';
    html += '</div>';
    return html;
  }

  function renderMeterListGroup(group, readings, isExpanded) {
    var catId = group.category.id;
    var catName = group.category.name;
    var meterCount = group.meters.length;

    var html = '<section class="category-group">';
    html += '<button class="category-header" onclick="App.toggleCategory(\'' + catId + '\')">';
    html += '<div class="category-header-left">';
    html += '<span class="category-chevron' + (isExpanded ? ' category-chevron-open' : '') + '">' + Icons.chevronDown + '</span>';
    html += '<h2 class="category-header-title">' + esc(catName) + '</h2>';
    html += '</div>';
    html += '<span class="category-header-count">' + meterCount + '</span>';
    html += '</button>';

    html += '<div class="category-content' + (isExpanded ? ' category-content-open' : '') + '">';
    if (isExpanded) {
      group.meters.forEach(function(meter) {
        var meterReadings = readings.filter(function(r) { return r.meterId === meter.id; });
        var count = meterReadings.length;
        var last = getLastReading(readings, meter.id);

        html += '<button class="card card-clickable meter-list-card" onclick="App.navigate(\'meter-detail\',\'' + meter.id + '\')">';
        html += '<div class="meter-list-row">';
        html += Icons.meterIcon(meter.type);
        html += '<div class="meter-list-info">';
        html += '<div class="meter-list-name">' + esc(meter.name) + '</div>';
        html += '<div class="meter-list-meta">Nr. ' + esc(meter.number) + ' · ' + esc(meter.type) + ' · ' + count + ' Ablesung' + (count !== 1 ? 'en' : '') + '</div>';
        html += '</div>';
        html += '<div class="meter-list-value">';
        if (last) {
          html += '<div class="meter-list-val">' + Data.formatNumber(last.value) + '</div>';
          html += '<div class="meter-list-unit">' + esc(meter.unit) + '</div>';
        } else {
          html += '<div class="meter-list-none">–</div>';
        }
        html += '</div>';
        html += '</div></button>';
      });
    }
    html += '</div>';
    html += '</section>';
    return html;
  }

  function meterForm(meter, categories) {
    var isEdit = !!meter;
    var number = isEdit ? meter.number : '';
    var name = isEdit ? meter.name : '';
    var type = isEdit ? meter.type : 'Strom';
    var unit = isEdit ? meter.unit : 'kWh';
    var categoryId = isEdit ? (meter.categoryId || '') : '';
    var types = ['Strom', 'Kaltwasser', 'Warmwasser', 'Betriebsstunden', 'Wärme'];

    var html = '<form class="meter-form view-enter" id="meter-form" onsubmit="App.handleMeterSubmit(event)">';

    html += '<div class="form-group">';
    html += '<label class="form-label">Zählernummer *</label>';
    html += '<input class="form-input" type="text" id="mf-number" value="' + escAttr(number) + '" placeholder="z.B. 12345678 oder DE0012345" autocomplete="off" autofocus />';
    html += '<span class="form-error" id="mf-number-err"></span>';
    html += '<span class="form-hint">Zählernummern können Zahlen und Buchstaben enthalten</span>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Zählername *</label>';
    html += '<input class="form-input" type="text" id="mf-name" value="' + escAttr(name) + '" placeholder="z.B. Stromzähler Keller" />';
    html += '<span class="form-error" id="mf-name-err"></span>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Zählertyp</label>';
    html += '<div class="type-chips" id="mf-type-chips">';
    types.forEach(function(t) {
      html += '<button type="button" class="type-chip' + (t === type ? ' type-chip-active' : '') + '" data-type="' + t + '" onclick="App.handleTypeChip(this)">' + t + '</button>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Kategorie</label>';
    html += '<select class="form-input form-select" id="mf-category">';
    html += '<option value="">Sonstige</option>';
    var sortedCats = Data.getSortedCategories(categories || []);
    sortedCats.forEach(function(cat) {
      html += '<option value="' + cat.id + '"' + (categoryId === cat.id ? ' selected' : '') + '>' + esc(cat.name) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Einheit *</label>';
    html += '<input class="form-input" type="text" id="mf-unit" value="' + escAttr(unit) + '" placeholder="z.B. kWh, m³, h" />';
    html += '<span class="form-error" id="mf-unit-err"></span>';
    html += '</div>';

    if (isEdit) {
      html += '<input type="hidden" id="mf-id" value="' + meter.id + '" />';
    }

    html += '<div class="form-actions">';
    html += '<button type="button" class="btn-secondary" onclick="App.goBack()">Abbrechen</button>';
    html += '<button type="submit" class="btn-primary" id="mf-submit">' + (isEdit ? 'Aktualisieren' : 'Erstellen') + '</button>';
    html += '</div>';

    html += '</form>';
    return html;
  }

  function meterDetail(meter, readings, costRates) {
    if (!meter) {
      return '<div class="detail-error view-enter">Zähler nicht gefunden.</div>';
    }

    var meterReadings = readings.filter(function(r) { return r.meterId === meter.id; })
      .sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });

    var html = '<div class="meter-detail view-enter">';

    html += '<div class="card detail-header-card">';
    html += '<div class="detail-header">';
    html += Icons.meterIcon(meter.type);
    html += '<div class="detail-header-info">';
    html += '<h2 class="detail-name">' + esc(meter.name) + '</h2>';
    html += '<div class="detail-meta">Nr. ' + esc(meter.number) + ' · ' + esc(meter.type) + ' · ' + esc(meter.unit) + '</div>';
    html += '</div></div>';

    html += '<div class="detail-actions-row">';
    html += '<button class="detail-action-btn" onclick="App.editMeter(\'' + meter.id + '\')">' + Icons.edit + ' Bearbeiten</button>';
    html += '<button class="detail-action-btn detail-action-danger" onclick="App.confirmDeleteMeter(\'' + meter.id + '\')">' + Icons.trash + ' Löschen</button>';
    html += '</div></div>';

    if (meterReadings.length > 0) {
      var totalConsumption = Charts.getTotalConsumption(readings, meter.id);
      html += '<div class="detail-stats">';
      html += '<div class="detail-stat"><span class="detail-stat-value">' + Data.formatNumber(meterReadings[0].value) + '</span><span class="detail-stat-label">Letzter Stand (' + esc(meter.unit) + ')</span></div>';
      html += '<div class="detail-stat"><span class="detail-stat-value">' + meterReadings.length + '</span><span class="detail-stat-label">Ablesungen</span></div>';
      if (totalConsumption > 0) {
        html += '<div class="detail-stat"><span class="detail-stat-value">' + Data.formatNumber(totalConsumption) + '</span><span class="detail-stat-label">Gesamtverbrauch (' + esc(meter.unit) + ')</span></div>';
        var rate = (costRates && costRates[meter.type]) || Data.defaultCostRates[meter.type] || 0;
        if (rate > 0) {
          html += '<div class="detail-stat"><span class="detail-stat-value">' + Data.formatCurrency(totalConsumption * rate) + '</span><span class="detail-stat-label">Geschätzte Kosten</span></div>';
        }
      }
      html += '</div>';
    }

    if (meterReadings.length >= 2) {
      html += '<div class="chart-container" id="detail-chart">';
      html += '<div class="chart-header">';
      html += '<span class="chart-title">Verbrauch</span>';
      html += '<div class="chart-period-selector">';
      html += '<button class="chart-period-btn active" onclick="App.changeDetailChart(\'' + meter.id + '\', \'6m\', this)">6M</button>';
      html += '<button class="chart-period-btn" onclick="App.changeDetailChart(\'' + meter.id + '\', \'12m\', this)">12M</button>';
      html += '<button class="chart-period-btn" onclick="App.changeDetailChart(\'' + meter.id + '\', \'all\', this)">Alle</button>';
      html += '</div></div>';
      html += '<div class="chart-canvas" id="detail-chart-canvas">';
      var chartData = Charts.getConsumptionData(readings, meter.id, '6m');
      html += Charts.renderBarChart(chartData, meter.unit, Icons.getChartColor(meter.type));
      html += '</div></div>';

      html += '<div class="chart-container">';
      html += '<div class="chart-header"><span class="chart-title">Zählerstandverlauf</span></div>';
      html += '<div class="chart-canvas">';
      html += Charts.renderLineChart(Charts.getConsumptionData(readings, meter.id, '12m'), meter.unit, Icons.getChartColor(meter.type));
      html += '</div></div>';

      var comp = Charts.getConsumptionComparison(readings, meter.id);
      if (comp && comp.count >= 2) {
        var trendIcon;
        if (comp.trend === 'up') {
          trendIcon = '<div class="insight-icon insight-icon-up">' + Icons.trendUp + '</div>';
        } else if (comp.trend === 'down') {
          trendIcon = '<div class="insight-icon insight-icon-down">' + Icons.trendDown + '</div>';
        } else {
          trendIcon = '<div class="insight-icon insight-icon-neutral">' + Icons.barChart + '</div>';
        }

        html += '<div class="card insight-card">';
        html += trendIcon;
        html += '<div class="insight-content">';
        html += '<div class="insight-title">Verbrauchsanalyse</div>';
        var desc = 'Ø ' + Data.formatNumber(comp.average) + ' ' + esc(meter.unit) + ' pro Periode';
        if (comp.changePct !== 0) {
          desc += ' · ' + (comp.changePct > 0 ? '+' : '') + Math.round(comp.changePct) + '% vs. Vorperiode';
        }
        html += '<div class="insight-desc">' + desc + '</div>';
        html += '</div>';
        html += '</div>';
      }
    }

    html += '<div class="detail-section-header">';
    html += '<h3 class="detail-section-title">Ablesungen</h3>';
    html += '<button class="detail-add-btn" onclick="App.navigate(\'add-reading\',\'' + meter.id + '\')">+ Neue Ablesung</button>';
    html += '</div>';

    if (meterReadings.length === 0) {
      html += '<div class="detail-empty">';
      html += '<p>Noch keine Ablesungen vorhanden.</p>';
      html += '<button class="detail-empty-btn" onclick="App.navigate(\'add-reading\',\'' + meter.id + '\')">Erste Ablesung erfassen</button>';
      html += '</div>';
    } else {
      html += '<div class="detail-readings">';
      meterReadings.forEach(function(reading, index) {
        var consumption = null;
        if (index < meterReadings.length - 1) {
          consumption = reading.value - meterReadings[index + 1].value;
        }

        html += '<div class="card detail-reading-card">';
        html += '<div class="detail-reading-main">';
        html += '<div class="detail-reading-left">';
        html += '<div class="detail-reading-value">' + Data.formatNumber(reading.value) + ' <span class="detail-reading-unit">' + esc(meter.unit) + '</span></div>';
        html += '<div class="detail-reading-date">' + Data.formatDate(reading.date) + '</div>';
        if (reading.note) {
          html += '<div class="detail-reading-note">' + esc(reading.note) + '</div>';
        }
        html += '</div>';
        html += '<div class="detail-reading-right">';
        if (consumption !== null) {
          var cls = consumption >= 0 ? 'positive' : 'negative';
          html += '<div class="detail-reading-consumption ' + cls + '">' + (consumption >= 0 ? '+' : '') + Data.formatNumber(consumption) + ' ' + esc(meter.unit) + '</div>';
        }
        html += '<button class="detail-reading-delete" onclick="App.confirmDeleteReading(\'' + reading.id + '\')" aria-label="Ablesung löschen">' + Icons.trash + '</button>';
        html += '</div>';
        html += '</div></div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function readingList(meters, readings) {
    if (meters.length === 0) {
      return '<div class="view-enter">' + emptyState(Icons.docSmall, 'Keine Ablesungen möglich', 'Erstellen Sie zuerst einen Zähler, um Ablesungen zu erfassen.') + '</div>';
    }

    if (readings.length === 0) {
      var h = '<div class="view-enter">';
      h += emptyState(Icons.docSmall, 'Keine Ablesungen vorhanden', 'Erfassen Sie Ihre erste Ablesung.', '+ Ablesung erfassen', "App.navigate('add-reading')");
      h += '</div>';
      return h;
    }

    var html = '<div class="reading-list view-enter">';

    // View toggle: list vs timeline
    html += '<div class="chart-period-selector" style="margin-bottom:12px;justify-content:center;display:flex">';
    html += '<button class="chart-period-btn active" id="reading-view-list" onclick="App.setReadingView(\'list\',this)">Liste</button>';
    html += '<button class="chart-period-btn" id="reading-view-timeline" onclick="App.setReadingView(\'timeline\',this)">Timeline</button>';
    html += '</div>';

    if (meters.length > 1) {
      html += '<div class="reading-filter">';
      html += '<select class="reading-filter-select" id="reading-filter" onchange="App.filterReadings()">';
      html += '<option value="all">Alle Zähler</option>';
      meters.forEach(function(m) {
        html += '<option value="' + m.id + '">' + esc(m.name) + ' (' + esc(m.number) + ')</option>';
      });
      html += '</select></div>';
    }

    html += '<div id="reading-items-container">';
    html += '<div class="reading-items" id="reading-items">';
    html += renderReadingItems(meters, readings, 'all');
    html += '</div>';
    html += '</div>';

    html += '<button class="fab" onclick="App.navigate(\'add-reading\')" aria-label="Ablesung hinzufügen">' + Icons.plus + '</button>';
    html += '</div>';
    return html;
  }

  function renderReadingItems(meters, readings, filterMeterId) {
    var filtered = filterMeterId === 'all' ? readings : readings.filter(function(r) { return r.meterId === filterMeterId; });
    var sorted = filtered.slice().sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });

    if (sorted.length === 0) {
      return '<div class="reading-filter-empty">Keine Ablesungen für diesen Zähler.</div>';
    }

    var html = '';
    sorted.forEach(function(reading) {
      var meter = meters.find(function(m) { return m.id === reading.meterId; });
      if (!meter) return;
      html += '<div class="card reading-item-card">';
      html += '<div class="reading-item-row">';
      html += Icons.meterIcon(meter.type);
      html += '<div class="reading-item-info">';
      html += '<div class="reading-item-meter">' + esc(meter.name) + '</div>';
      html += '<div class="reading-item-date">' + Data.formatDate(reading.date) + '</div>';
      if (reading.note) {
        html += '<div class="reading-item-note">' + esc(reading.note) + '</div>';
      }
      html += '</div>';
      html += '<div class="reading-item-right">';
      html += '<div class="reading-item-value">' + Data.formatNumber(reading.value) + '</div>';
      html += '<div class="reading-item-unit">' + esc(meter.unit) + '</div>';
      html += '</div>';
      html += '<button class="reading-item-delete" onclick="App.confirmDeleteReading(\'' + reading.id + '\')" aria-label="Löschen">' + Icons.trash + '</button>';
      html += '</div></div>';
    });
    return html;
  }

  function renderReadingTimeline(meters, readings, filterMeterId) {
    var filtered = filterMeterId === 'all' ? readings : readings.filter(function(r) { return r.meterId === filterMeterId; });
    var sorted = filtered.slice().sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });

    if (sorted.length === 0) {
      return '<div class="reading-filter-empty">Keine Ablesungen für diesen Zähler.</div>';
    }

    var html = '<div class="timeline">';
    var lastDateStr = '';
    sorted.forEach(function(reading) {
      var meter = meters.find(function(m) { return m.id === reading.meterId; });
      if (!meter) return;
      var dateStr = Data.formatDate(reading.date);
      
      html += '<div class="timeline-item">';
      html += '<div class="timeline-dot" style="background:' + (Icons.colorMap[meter.type] || 'var(--primary)') + '"></div>';
      if (dateStr !== lastDateStr) {
        html += '<div class="timeline-date">' + dateStr + '</div>';
        lastDateStr = dateStr;
      }
      html += '<div class="card timeline-card">';
      html += '<div class="timeline-card-row">';
      html += Icons.meterIcon(meter.type);
      html += '<div class="timeline-card-info">';
      html += '<div class="timeline-card-meter">' + esc(meter.name) + '</div>';
      if (reading.note) html += '<div class="timeline-card-note">' + esc(reading.note) + '</div>';
      html += '</div>';
      html += '<div><span class="timeline-card-value">' + Data.formatNumber(reading.value) + '</span> <span class="timeline-card-unit">' + esc(meter.unit) + '</span></div>';
      html += '</div></div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function readingForm(meters, preselectedMeterId, readings) {
    var meterId = preselectedMeterId || (meters.length === 1 ? meters[0].id : '');
    var today = new Date().toISOString().split('T')[0];
    var selectedMeter = meters.find(function(m) { return m.id === meterId; });

    var html = '<form class="reading-form view-enter" id="reading-form" onsubmit="App.handleReadingSubmit(event)">';

    html += '<div class="form-group">';
    html += '<label class="form-label">Zähler *</label>';
    html += '<select class="form-input form-select" id="rf-meter" onchange="App.updateReadingUnit()">';
    html += '<option value="">Zähler auswählen...</option>';
    meters.forEach(function(m) {
      html += '<option value="' + m.id + '"' + (m.id === meterId ? ' selected' : '') + '>' + esc(m.name) + ' (Nr. ' + esc(m.number) + ')</option>';
    });
    html += '</select>';
    html += '<span class="form-error" id="rf-meter-err"></span>';
    html += '</div>';

    if (selectedMeter && readings) {
      var lastReading = getLastReading(readings, selectedMeter.id);
      if (lastReading) {
        html += '<div class="last-reading-hint" id="rf-last-reading">';
        html += '<span class="last-reading-hint-icon">' + Icons.info + '</span>';
        html += '<span>Letzter Stand: <span class="last-reading-hint-value">' + Data.formatNumber(lastReading.value) + ' ' + esc(selectedMeter.unit) + '</span> am ' + Data.formatDate(lastReading.date) + '</span>';
        html += '</div>';
      }
    }

    html += '<div class="form-group">';
    html += '<label class="form-label" id="rf-value-label">Zählerstand' + (selectedMeter ? ' (' + esc(selectedMeter.unit) + ')' : '') + ' *</label>';
    html += '<input class="form-input form-input-large" type="text" inputmode="decimal" id="rf-value" placeholder="z.B. 12345,67" autocomplete="off"' + (meterId ? ' autofocus' : '') + ' oninput="App.checkReadingPlausibility()" />';
    html += '<span class="form-error" id="rf-value-err"></span>';
    html += '<span class="form-hint" id="rf-value-hint">' + (selectedMeter ? 'Geben Sie den aktuellen Zählerstand in ' + esc(selectedMeter.unit) + ' ein' : '') + '</span>';
    html += '</div>';

    html += '<div id="rf-plausibility-container"></div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Ablesedatum *</label>';
    html += '<input class="form-input" type="date" id="rf-date" value="' + today + '" />';
    html += '<span class="form-error" id="rf-date-err"></span>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Notiz (optional)</label>';
    html += '<input class="form-input" type="text" id="rf-note" placeholder="z.B. Jahresablesung, Zwischenablesung" />';
    html += '</div>';

    html += '<div class="form-actions">';
    html += '<button type="button" class="btn-secondary" onclick="App.goBack()">Abbrechen</button>';
    html += '<button type="submit" class="btn-primary" id="rf-submit">Speichern</button>';
    html += '</div>';

    html += '</form>';
    return html;
  }

  function categoryManagement(categories, meters) {
    var sorted = Data.getSortedCategories(categories);

    var html = '<div class="category-management view-enter">';

    html += '<div class="card category-info-card">';
    html += '<div class="category-info-icon">' + Icons.folderBig + '</div>';
    html += '<div class="category-info-text">';
    html += '<h3>Kategorien</h3>';
    html += '<p>Organisieren Sie Ihre Zähler in Kategorien. Ziehen Sie Kategorien um die Reihenfolge zu ändern.</p>';
    html += '</div></div>';

    html += '<button class="card card-clickable category-add-btn" onclick="App.showCategoryForm()">';
    html += '<div class="category-add-row">';
    html += '<div class="category-add-icon">' + Icons.plus + '</div>';
    html += '<span class="category-add-text">Neue Kategorie</span>';
    html += '</div></button>';

    html += '<div class="category-form-container" id="category-form-container" style="display:none;">';
    html += '<div class="card category-form-card">';
    html += '<div class="form-group">';
    html += '<label class="form-label">Kategoriename *</label>';
    html += '<input class="form-input" type="text" id="cf-name" placeholder="z.B. Kaltwasser und Warmwasser" autocomplete="off" />';
    html += '<span class="form-error" id="cf-name-err"></span>';
    html += '</div>';
    html += '<div class="form-actions">';
    html += '<button type="button" class="btn-secondary" onclick="App.hideCategoryForm()">Abbrechen</button>';
    html += '<button type="button" class="btn-primary" id="cf-submit" onclick="App.handleCategorySubmit()">Erstellen</button>';
    html += '</div>';
    html += '</div></div>';

    if (sorted.length > 0) {
      html += '<div class="category-list" id="category-list">';
      sorted.forEach(function(cat) {
        var catMeters = meters.filter(function(m) { return m.categoryId === cat.id; });
        html += '<div class="card category-item" data-category-id="' + cat.id + '" draggable="true">';
        html += '<div class="category-item-row">';
        html += '<div class="category-drag-handle" aria-label="Reihenfolge ändern">' + Icons.gripVertical + '</div>';
        html += '<div class="category-item-info">';
        html += '<div class="category-item-name" id="cat-name-' + cat.id + '">' + esc(cat.name) + '</div>';
        html += '<div class="category-item-count">' + catMeters.length + ' Zähler</div>';
        html += '</div>';
        html += '<div class="category-item-actions">';
        html += '<button class="category-item-btn" onclick="App.editCategory(\'' + cat.id + '\')" aria-label="Bearbeiten">' + Icons.edit + '</button>';
        html += '<button class="category-item-btn category-item-btn-danger" onclick="App.confirmDeleteCategory(\'' + cat.id + '\')" aria-label="Löschen">' + Icons.trash + '</button>';
        html += '</div>';
        html += '</div>';

        html += '<div class="category-edit-form" id="cat-edit-' + cat.id + '" style="display:none;">';
        html += '<div class="form-group">';
        html += '<input class="form-input" type="text" id="cat-edit-input-' + cat.id + '" value="' + escAttr(cat.name) + '" />';
        html += '<span class="form-error" id="cat-edit-err-' + cat.id + '"></span>';
        html += '</div>';
        html += '<div class="form-actions">';
        html += '<button type="button" class="btn-secondary" onclick="App.cancelEditCategory(\'' + cat.id + '\')">Abbrechen</button>';
        html += '<button type="button" class="btn-primary" onclick="App.saveEditCategory(\'' + cat.id + '\')">Speichern</button>';
        html += '</div>';
        html += '</div>';

        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="category-empty">';
      html += '<p>Noch keine Kategorien erstellt.</p>';
      html += '<p class="category-empty-hint">Zähler ohne Kategorie erscheinen unter "Sonstige".</p>';
      html += '</div>';
    }

    var uncategorizedMeters = meters.filter(function(m) {
      return !m.categoryId || !categories.some(function(c) { return c.id === m.categoryId; });
    });
    html += '<div class="card category-sonstige-card">';
    html += '<div class="category-sonstige-row">';
    html += '<div class="category-sonstige-icon">' + Icons.folder + '</div>';
    html += '<div class="category-sonstige-info">';
    html += '<div class="category-sonstige-name">Sonstige</div>';
    html += '<div class="category-sonstige-desc">' + uncategorizedMeters.length + ' Zähler · System-Kategorie</div>';
    html += '</div></div></div>';

    html += '</div>';
    return html;
  }

  function reportView(meters, readings, categories, costRates, reportYear, reportMonth) {
    var now = new Date();
    var year = reportYear || now.getFullYear();

    var html = '<div class="report-view view-enter">';

    html += '<div class="card report-header-card">';
    html += '<h2 class="report-title">Verbrauchsbericht</h2>';
    html += '<p class="report-subtitle">' + (reportMonth !== undefined && reportMonth !== null ? Data.getMonthName(reportMonth) + ' ' : '') + year + '</p>';
    html += '<div class="report-period-selector">';
    html += '<button class="report-period-btn' + (reportMonth === undefined || reportMonth === null ? ' active' : '') + '" onclick="App.setReportPeriod(' + year + ',null)">Ganzes Jahr</button>';
    for (var m = 0; m < 12; m++) {
      var isActive = reportMonth === m;
      html += '<button class="report-period-btn' + (isActive ? ' active' : '') + '" onclick="App.setReportPeriod(' + year + ',' + m + ')">' + Data.getMonthShort(m) + '</button>';
    }
    html += '</div>';

    // Year navigation
    html += '<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-top:12px">';
    html += '<button class="chart-period-btn" onclick="App.setReportPeriod(' + (year - 1) + ',' + (reportMonth !== undefined && reportMonth !== null ? reportMonth : 'null') + ')">← ' + (year - 1) + '</button>';
    html += '<span style="font-weight:700">' + year + '</span>';
    if (year < now.getFullYear()) {
      html += '<button class="chart-period-btn" onclick="App.setReportPeriod(' + (year + 1) + ',' + (reportMonth !== undefined && reportMonth !== null ? reportMonth : 'null') + ')">' + (year + 1) + ' →</button>';
    }
    html += '</div>';
    html += '</div>';

    var report = Data.generateReportData(meters, readings, year, reportMonth);

    // Summary
    var totalConsumptionCount = Object.keys(report.totalConsumption).length;
    html += '<div class="report-summary-grid">';
    html += '<div class="card report-summary-item"><div class="report-summary-value">' + report.readingCount + '</div><div class="report-summary-label">Ablesungen</div></div>';
    html += '<div class="card report-summary-item"><div class="report-summary-value">' + report.meters.length + '</div><div class="report-summary-label">Zähler aktiv</div></div>';
    html += '<div class="card report-summary-item"><div class="report-summary-value">' + totalConsumptionCount + '</div><div class="report-summary-label">Verbrauchsarten</div></div>';
    html += '</div>';

    // Consumption by type
    if (totalConsumptionCount > 0) {
      Object.keys(report.totalConsumption).forEach(function(type) {
        var tc = report.totalConsumption[type];
        var rate = (costRates && costRates[type]) || Data.defaultCostRates[type] || 0;
        var cost = tc.value * rate;

        html += '<div class="card insight-card">';
        html += Icons.meterIcon(type);
        html += '<div class="insight-content">';
        html += '<div class="insight-title">' + esc(type) + '</div>';
        html += '<div class="insight-desc">' + Data.formatNumber(tc.value) + ' ' + esc(tc.unit) + (rate > 0 ? ' · ' + Data.formatCurrency(cost) : '') + '</div>';
        html += '</div>';
        html += '</div>';
      });
    }

    // Per meter breakdown
    if (report.meters.length > 0) {
      html += '<h3 class="section-title" style="margin-top:8px">Zähler-Details</h3>';
      html += '<div class="report-meter-section">';
      report.meters.forEach(function(rm) {
        html += '<div class="card report-meter-card">';
        html += '<div class="report-meter-header">';
        html += Icons.meterIcon(rm.meter.type);
        html += '<div>';
        html += '<div class="report-meter-name">' + esc(rm.meter.name) + '</div>';
        html += '<div class="report-meter-type">Nr. ' + esc(rm.meter.number) + '</div>';
        html += '</div></div>';
        html += '<div class="report-meter-stats">';
        html += '<div class="report-meter-stat"><div class="report-meter-stat-value">' + Data.formatNumber(rm.consumption) + ' ' + esc(rm.meter.unit) + '</div><div class="report-meter-stat-label">Verbrauch</div></div>';
        html += '<div class="report-meter-stat"><div class="report-meter-stat-value">' + rm.readingCount + '</div><div class="report-meter-stat-label">Ablesungen</div></div>';
        if (rm.firstValue !== null) {
          html += '<div class="report-meter-stat"><div class="report-meter-stat-value">' + Data.formatNumber(rm.firstValue) + '</div><div class="report-meter-stat-label">Anfangsstand</div></div>';
        }
        if (rm.lastValue !== null) {
          html += '<div class="report-meter-stat"><div class="report-meter-stat-value">' + Data.formatNumber(rm.lastValue) + '</div><div class="report-meter-stat-label">Endstand</div></div>';
        }
        html += '</div></div>';
      });
      html += '</div>';
    }

    // Print button
    html += '<button class="report-print-btn" onclick="window.print()">' + Icons.printer + ' Bericht drucken</button>';

    html += '</div>';
    return html;
  }

  function comparisonView(meters, readings, selectedMeterIds) {
    var html = '<div class="comparison-view view-enter">';

    html += '<div class="card" style="padding:16px">';
    html += '<h3 class="section-title" style="margin-bottom:8px">Zähler vergleichen</h3>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin:0 0 12px">Wählen Sie Zähler zum Vergleichen aus.</p>';
    html += '<div class="comparison-meter-chips">';
    var colors = ['var(--chart-color-1)','var(--chart-color-2)','var(--chart-color-3)','var(--chart-color-4)','var(--chart-color-5)'];
    meters.forEach(function(m, idx) {
      var isActive = selectedMeterIds && selectedMeterIds.indexOf(m.id) !== -1;
      var colorIdx = isActive ? selectedMeterIds.indexOf(m.id) : idx;
      html += '<button class="comparison-chip' + (isActive ? ' active' : '') + '" onclick="App.toggleComparisonMeter(\'' + m.id + '\')">';
      if (isActive) html += '<span class="comparison-chip-dot" style="background:' + colors[colorIdx % colors.length] + '"></span>';
      html += esc(m.name);
      html += '</button>';
    });
    html += '</div></div>';

    if (selectedMeterIds && selectedMeterIds.length >= 2) {
      // Build comparison chart data
      var dataSets = [];
      selectedMeterIds.forEach(function(id, idx) {
        var meter = meters.find(function(mm) { return mm.id === id; });
        if (!meter) return;
        var data = Charts.getConsumptionData(readings, id, '12m');
        dataSets.push({
          name: meter.name,
          data: data,
          color: Icons.getChartColor(meter.type)
        });
      });

      html += '<div class="chart-container">';
      html += '<div class="chart-header"><span class="chart-title">Verbrauchsvergleich</span></div>';
      html += '<div class="chart-canvas">';
      html += Charts.renderComparisonChart(dataSets, '');
      html += '</div></div>';

      // Comparison table
      html += '<div class="card" style="padding:16px;overflow-x:auto">';
      html += '<table class="comparison-table"><thead><tr><th>Zähler</th><th>Letzter Stand</th><th>Gesamt</th><th>Ø Verbrauch</th></tr></thead><tbody>';
      selectedMeterIds.forEach(function(id) {
        var meter = meters.find(function(mm) { return mm.id === id; });
        if (!meter) return;
        var totalC = Charts.getTotalConsumption(readings, meter.id);
        var comp = Charts.getConsumptionComparison(readings, meter.id);
        var lastR = getLastReading(readings, meter.id);
        html += '<tr>';
        html += '<td style="font-weight:600">' + esc(meter.name) + '</td>';
        html += '<td>' + (lastR ? Data.formatNumber(lastR.value) + ' ' + esc(meter.unit) : '–') + '</td>';
        html += '<td>' + Data.formatNumber(totalC) + ' ' + esc(meter.unit) + '</td>';
        html += '<td>' + (comp ? Data.formatNumber(comp.average) : '–') + ' ' + esc(meter.unit) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    } else if (selectedMeterIds && selectedMeterIds.length === 1) {
      html += '<div class="reading-filter-empty">Wählen Sie mindestens 2 Zähler zum Vergleichen.</div>';
    } else {
      html += '<div class="reading-filter-empty">Wählen Sie Zähler oben aus, um den Verbrauch zu vergleichen.</div>';
    }

    html += '</div>';
    return html;
  }

  function settingsView(currentTheme, reminderInterval) {
    var html = '<div class="settings-view view-enter">';

    // About
    html += '<div class="card about-card">';
    html += '<div class="about-logo"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div>';
    html += '<h3 class="about-name">Zählerstand Manager</h3>';
    html += '<p class="about-version">Version 3.0</p>';
    html += '<p class="about-credits">Made with ♥ for smart metering</p>';
    html += '</div>';

    // Appearance
    html += '<div class="settings-section">';
    html += '<div class="settings-section-title">Darstellung</div>';
    html += '<div class="card settings-item" style="cursor:default;flex-direction:column;align-items:stretch;gap:12px">';
    html += '<div style="display:flex;align-items:center;gap:14px">';
    html += '<div class="settings-item-icon" style="background:var(--primary-light);color:var(--primary)">' + Icons.palette + '</div>';
    html += '<div class="settings-item-content">';
    html += '<div class="settings-item-title">Design</div>';
    html += '<div class="settings-item-desc">Wählen Sie das Farbschema</div>';
    html += '</div></div>';
    html += '<div class="theme-selector">';
    html += '<button class="theme-option' + (currentTheme === 'light' ? ' active' : '') + '" onclick="App.changeTheme(\'light\')">' + Icons.sun + ' Hell</button>';
    html += '<button class="theme-option' + (currentTheme === 'auto' ? ' active' : '') + '" onclick="App.changeTheme(\'auto\')">' + Icons.monitor + ' Auto</button>';
    html += '<button class="theme-option' + (currentTheme === 'dark' ? ' active' : '') + '" onclick="App.changeTheme(\'dark\')">' + Icons.moon + ' Dunkel</button>';
    html += '</div></div>';
    html += '</div>';

    // Reminders
    html += '<div class="settings-section">';
    html += '<div class="settings-section-title">Erinnerungen</div>';
    html += '<div class="card settings-item" style="cursor:default">';
    html += '<div class="settings-item-icon" style="background:var(--warning-light);color:var(--warning)">' + Icons.bell + '</div>';
    html += '<div class="settings-item-content">';
    html += '<div class="settings-item-title">Ableseintervall</div>';
    html += '<div class="settings-item-desc">Erinnerung nach X Tagen ohne Ablesung</div>';
    html += '</div>';
    html += '<div class="settings-item-right">';
    html += '<select class="form-input form-select" style="width:auto;padding:8px 12px;font-size:14px" id="settings-reminder" onchange="App.changeReminderInterval(this.value)">';
    [7, 14, 30, 60, 90].forEach(function(d) {
      html += '<option value="' + d + '"' + (reminderInterval === d ? ' selected' : '') + '>' + d + ' Tage</option>';
    });
    html += '</select>';
    html += '</div></div>';
    html += '</div>';

    // Tools
    html += '<div class="settings-section">';
    html += '<div class="settings-section-title">Werkzeuge</div>';

    html += '<button class="card card-clickable settings-item" onclick="App.navigate(\'report\')">';
    html += '<div class="settings-item-icon" style="background:var(--primary-light);color:var(--primary)">' + Icons.pieChart + '</div>';
    html += '<div class="settings-item-content">';
    html += '<div class="settings-item-title">Verbrauchsbericht</div>';
    html += '<div class="settings-item-desc">Monatliche und jährliche Berichte</div>';
    html += '</div>';
    html += '<span class="settings-item-chevron">' + Icons.chevronRight + '</span>';
    html += '</button>';

    html += '<button class="card card-clickable settings-item" onclick="App.navigate(\'comparison\')">';
    html += '<div class="settings-item-icon" style="background:var(--success-light);color:var(--success)">' + Icons.layers + '</div>';
    html += '<div class="settings-item-content">';
    html += '<div class="settings-item-title">Zähler vergleichen</div>';
    html += '<div class="settings-item-desc">Verbrauchsdaten nebeneinander</div>';
    html += '</div>';
    html += '<span class="settings-item-chevron">' + Icons.chevronRight + '</span>';
    html += '</button>';

    html += '<button class="card card-clickable settings-item" onclick="App.navigate(\'export\')">';
    html += '<div class="settings-item-icon" style="background:var(--primary-light);color:var(--primary)">' + Icons.shield + '</div>';
    html += '<div class="settings-item-content">';
    html += '<div class="settings-item-title">Export & Backup</div>';
    html += '<div class="settings-item-desc">CSV-Export und Datensicherung</div>';
    html += '</div>';
    html += '<span class="settings-item-chevron">' + Icons.chevronRight + '</span>';
    html += '</button>';

    html += '</div>';

    // Danger zone
    html += '<div class="settings-section">';
    html += '<div class="settings-section-title">Gefahrenzone</div>';
    html += '<div class="card danger-zone">';
    html += '<div class="danger-zone-title">Alle Daten löschen</div>';
    html += '<div class="danger-zone-desc">Löscht alle Zähler, Ablesungen und Kategorien unwiderruflich. Einstellungen bleiben erhalten.</div>';
    html += '<button class="danger-zone-btn" onclick="App.confirmClearAllData()">' + Icons.trashBig + ' Alle Daten löschen</button>';
    html += '</div></div>';

    html += '</div>';
    return html;
  }

  function exportView(meters, readings, categories) {
    var types = ['Strom', 'Kaltwasser', 'Warmwasser', 'Betriebsstunden', 'Wärme'];
    var availableTypes = types.filter(function(t) { return meters.some(function(m) { return m.type === t; }); });

    var html = '<div class="export-view view-enter">';

    html += '<div class="card export-info-card">';
    html += '<div class="export-info-icon">' + Icons.downloadBig + '</div>';
    html += '<div class="export-info-text">';
    html += '<h3>CSV-Export</h3>';
    html += '<p>Exportieren Sie Ihre Zählerstände als CSV-Datei für Excel und andere Tabellenkalkulationen.</p>';
    html += '</div></div>';

    html += '<div class="export-filters">';
    html += '<h3 class="export-section-title">Filter (optional)</h3>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Zähler</label>';
    html += '<select class="form-input form-select" id="export-meter" onchange="App.updateExportCount()">';
    html += '<option value="all">Alle Zähler</option>';
    meters.forEach(function(m) {
      html += '<option value="' + m.id + '">' + esc(m.name) + ' (' + esc(m.number) + ')</option>';
    });
    html += '</select></div>';

    if (availableTypes.length > 1) {
      html += '<div class="form-group">';
      html += '<label class="form-label">Zählertyp</label>';
      html += '<select class="form-input form-select" id="export-type" onchange="App.updateExportCount()">';
      html += '<option value="all">Alle Typen</option>';
      availableTypes.forEach(function(t) {
        html += '<option value="' + t + '">' + t + '</option>';
      });
      html += '</select></div>';
    }

    html += '<div class="export-date-range">';
    html += '<div class="form-group"><label class="form-label">Von</label><input class="form-input" type="date" id="export-from" onchange="App.updateExportCount()" /></div>';
    html += '<div class="form-group"><label class="form-label">Bis</label><input class="form-input" type="date" id="export-to" onchange="App.updateExportCount()" /></div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="export-summary">';
    html += '<span class="export-count" id="export-count">' + readings.length + ' Ablesung' + (readings.length !== 1 ? 'en' : '') + '</span>';
    html += '<button class="export-reset" id="export-reset" onclick="App.resetExportFilters()" style="display:none;">Filter zurücksetzen</button>';
    html += '</div>';

    html += '<button class="export-btn" id="export-btn" onclick="App.handleExport()"' + (readings.length === 0 ? ' disabled' : '') + '>';
    html += Icons.download + ' Als CSV exportieren';
    html += '</button>';

    html += '<div class="export-hint">';
    html += Icons.info;
    html += '<span>Die CSV-Datei verwendet Semikolon (;) als Trennzeichen und ist für Excel optimiert.</span>';
    html += '</div>';

    html += '<div class="backup-divider">';
    html += '<div class="backup-divider-line"></div>';
    html += '<span class="backup-divider-text">Backup & Wiederherstellung</span>';
    html += '<div class="backup-divider-line"></div>';
    html += '</div>';

    html += '<div class="card backup-info-card">';
    html += '<div class="backup-info-icon backup-info-icon-blue">' + Icons.shield + '</div>';
    html += '<div class="backup-info-text">';
    html += '<h3>Komplettes Backup</h3>';
    html += '<p>Sichern Sie alle Zähler, Kategorien und Ablesungen in einer JSON-Datei.</p>';
    html += '</div></div>';

    html += '<div class="backup-actions">';
    html += '<button class="backup-btn backup-btn-export" id="backup-export-btn" onclick="App.handleBackupExport()"' + (meters.length === 0 && readings.length === 0 ? ' disabled' : '') + '>';
    html += Icons.download + ' Backup erstellen';
    html += '</button>';

    html += '<button class="backup-btn backup-btn-import" id="backup-import-btn" onclick="App.triggerBackupImport()">';
    html += Icons.upload + ' Backup wiederherstellen';
    html += '</button>';

    html += '<input type="file" accept=".json,application/json" class="backup-file-input" id="backup-file-input" onchange="App.handleBackupFileSelect(event)" />';
    html += '</div>';

    html += '<div class="export-summary">';
    html += '<span class="export-count">' + (categories || []).length + ' Kategorien, ' + meters.length + ' Zähler, ' + readings.length + ' Ablesungen</span>';
    html += '</div>';

    html += '<div class="backup-hint">';
    html += Icons.info;
    html += '<span>Erstellen Sie regelmäßig Backups um Datenverlust zu vermeiden.</span>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function costSettingsSheet(costRates, meterTypes) {
    var html = '<div class="cost-form-overlay" id="cost-form-overlay" onclick="if(event.target===this)App.hideCostSettings()">';
    html += '<div class="cost-form-sheet" onclick="event.stopPropagation()">';
    html += '<div class="cost-form-handle"></div>';
    html += '<h3 class="cost-form-title">Tarife konfigurieren</h3>';
    html += '<div class="cost-form-grid">';

    meterTypes.forEach(function(type) {
      var rate = (costRates && costRates[type]) || Data.defaultCostRates[type] || 0;
      var costUnit = Data.costUnits[type] || '€/Einheit';
      html += '<div class="cost-input-row">';
      html += '<div class="form-group">';
      html += '<label class="form-label">' + esc(type) + '</label>';
      html += '<input class="form-input" type="text" inputmode="decimal" id="cost-rate-' + type.replace(/\s/g, '') + '" value="' + rate.toString().replace('.', ',') + '" />';
      html += '</div>';
      html += '<span class="cost-input-suffix">' + costUnit + '</span>';
      html += '</div>';
    });

    html += '</div>';
    html += '<div class="form-actions" style="margin-top:16px;">';
    html += '<button type="button" class="btn-secondary" onclick="App.hideCostSettings()">Abbrechen</button>';
    html += '<button type="button" class="btn-primary" onclick="App.saveCostSettings()">Speichern</button>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  // Helpers
  function getLastReading(readings, meterId) {
    return readings.filter(function(r) { return r.meterId === meterId; })
      .sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); })[0] || null;
  }

  function emptyState(icon, title, desc, actionLabel, actionOnClick) {
    var html = '<div class="empty-state">';
    html += '<div class="empty-state-icon">' + icon + '</div>';
    html += '<h3 class="empty-state-title">' + title + '</h3>';
    html += '<p class="empty-state-desc">' + desc + '</p>';
    if (actionLabel && actionOnClick) {
      html += '<button class="empty-state-btn" onclick="' + actionOnClick + '">' + actionLabel + '</button>';
    }
    html += '</div>';
    return html;
  }

  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function escAttr(str) {
    return esc(str);
  }

  return {
    dashboard: dashboard,
    meterList: meterList,
    meterForm: meterForm,
    meterDetail: meterDetail,
    readingList: readingList,
    readingForm: readingForm,
    categoryManagement: categoryManagement,
    exportView: exportView,
    costSettingsSheet: costSettingsSheet,
    renderReadingItems: renderReadingItems,
    renderReadingTimeline: renderReadingTimeline,
    reportView: reportView,
    comparisonView: comparisonView,
    settingsView: settingsView,
    esc: esc
  };
})();
