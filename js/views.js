
/**
 * View rendering functions – each returns an HTML string
 */
var Views = (function() {

  function dashboard(meters, readings) {
    var totalMeters = meters.length;
    var totalReadings = readings.length;

    var html = '<div class="dashboard view-enter">';

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

    // Meter summary
    if (meters.length > 0) {
      html += '<section class="dashboard-section">';
      html += '<h2 class="section-title">Meine Zähler</h2>';
      html += '<div class="meter-summary-list">';
      meters.forEach(function(meter) {
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
        } else {
          html += '<span class="summary-none">–</span>';
        }
        html += '</div>';
        html += '</div></button>';
      });
      html += '</div></section>';
    }

    // Recent readings
    var recent = readings.slice().sort(function(a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }).slice(0, 5);

    if (recent.length > 0) {
      html += '<section class="dashboard-section">';
      html += '<h2 class="section-title">Letzte Ablesungen</h2>';
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

    // Empty
    if (meters.length === 0) {
      html += '<div class="dashboard-empty">';
      html += '<div class="dashboard-empty-icon">' + Icons.clockBig + '</div>';
      html += '<h3>Willkommen!</h3>';
      html += '<p>Erstellen Sie Ihren ersten Zähler, um Ablesungen zu erfassen.</p>';
      html += '<button class="dashboard-start-btn" onclick="App.navigate(\'meters\')">Zähler anlegen</button>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function meterList(meters, readings) {
    if (meters.length === 0) {
      var html = '<div class="view-enter">';
      html += emptyState(Icons.clockSmall, 'Keine Zähler vorhanden', 'Erstellen Sie Ihren ersten Zähler, um Ablesungen zu erfassen.', '+ Zähler anlegen', "App.navigate('add-meter')");
      html += '</div>';
      return html;
    }

    var html = '<div class="meter-list view-enter">';
    meters.forEach(function(meter) {
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
    html += '<button class="fab" onclick="App.navigate(\'add-meter\')" aria-label="Zähler hinzufügen">' + Icons.plus + '</button>';
    html += '</div>';
    return html;
  }

  function meterForm(meter) {
    var isEdit = !!meter;
    var number = isEdit ? meter.number : '';
    var name = isEdit ? meter.name : '';
    var type = isEdit ? meter.type : 'Strom';
    var unit = isEdit ? meter.unit : 'kWh';
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

  function meterDetail(meter, readings) {
    if (!meter) {
      return '<div class="detail-error view-enter">Zähler nicht gefunden.</div>';
    }

    var meterReadings = readings.filter(function(r) { return r.meterId === meter.id; })
      .sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });

    var html = '<div class="meter-detail view-enter">';

    // Header card
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

    // Stats
    if (meterReadings.length > 0) {
      html += '<div class="detail-stats">';
      html += '<div class="detail-stat"><span class="detail-stat-value">' + Data.formatNumber(meterReadings[0].value) + '</span><span class="detail-stat-label">Letzter Stand (' + esc(meter.unit) + ')</span></div>';
      html += '<div class="detail-stat"><span class="detail-stat-value">' + meterReadings.length + '</span><span class="detail-stat-label">Ablesungen</span></div>';
      html += '</div>';
    }

    // Section header
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
      var html = '<div class="view-enter">';
      html += emptyState(Icons.docSmall, 'Keine Ablesungen vorhanden', 'Erfassen Sie Ihre erste Ablesung.', '+ Ablesung erfassen', "App.navigate('add-reading')");
      html += '</div>';
      return html;
    }

    var html = '<div class="reading-list view-enter">';

    if (meters.length > 1) {
      html += '<div class="reading-filter">';
      html += '<select class="reading-filter-select" id="reading-filter" onchange="App.filterReadings()">';
      html += '<option value="all">Alle Zähler</option>';
      meters.forEach(function(m) {
        html += '<option value="' + m.id + '">' + esc(m.name) + ' (' + esc(m.number) + ')</option>';
      });
      html += '</select></div>';
    }

    html += '<div class="reading-items" id="reading-items">';
    html += renderReadingItems(meters, readings, 'all');
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

  function readingForm(meters, preselectedMeterId) {
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

    html += '<div class="form-group">';
    html += '<label class="form-label" id="rf-value-label">Zählerstand' + (selectedMeter ? ' (' + esc(selectedMeter.unit) + ')' : '') + ' *</label>';
    html += '<input class="form-input form-input-large" type="text" inputmode="decimal" id="rf-value" placeholder="z.B. 12345,67" autocomplete="off"' + (meterId ? ' autofocus' : '') + ' />';
    html += '<span class="form-error" id="rf-value-err"></span>';
    html += '<span class="form-hint" id="rf-value-hint">' + (selectedMeter ? 'Geben Sie den aktuellen Zählerstand in ' + esc(selectedMeter.unit) + ' ein' : '') + '</span>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Ablesedatum *</label>';
    html += '<input class="form-input" type="date" id="rf-date" value="' + today + '" />';
    html += '<span class="form-error" id="rf-date-err"></span>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Notiz (optional)</label>';
    html += '<input class="form-input" type="text" id="rf-note" placeholder="z.B. Jahresablesung" />';
    html += '</div>';

    html += '<div class="form-actions">';
    html += '<button type="button" class="btn-secondary" onclick="App.goBack()">Abbrechen</button>';
    html += '<button type="submit" class="btn-primary" id="rf-submit">Speichern</button>';
    html += '</div>';

    html += '</form>';
    return html;
  }

  function exportView(meters, readings) {
    var types = ['Strom', 'Kaltwasser', 'Warmwasser', 'Betriebsstunden', 'Wärme'];
    var availableTypes = types.filter(function(t) { return meters.some(function(m) { return m.type === t; }); });

    var html = '<div class="export-view view-enter">';

    // ===== CSV EXPORT SECTION =====
    html += '<div class="card export-info-card">';
    html += '<div class="export-info-icon">' + Icons.downloadBig + '</div>';
    html += '<div class="export-info-text">';
    html += '<h3>CSV-Export</h3>';
    html += '<p>Exportieren Sie Ihre Zählerstände als CSV-Datei für Excel und andere Tabellenkalkulationen.</p>';
    html += '</div></div>';

    // Filters
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

    // Summary
    html += '<div class="export-summary">';
    html += '<span class="export-count" id="export-count">' + readings.length + ' Ablesung' + (readings.length !== 1 ? 'en' : '') + '</span>';
    html += '<button class="export-reset" id="export-reset" onclick="App.resetExportFilters()" style="display:none;">Filter zurücksetzen</button>';
    html += '</div>';

    // Export button
    html += '<button class="export-btn" id="export-btn" onclick="App.handleExport()"' + (readings.length === 0 ? ' disabled' : '') + '>';
    html += Icons.download + ' Als CSV exportieren';
    html += '</button>';

    // Hint
    html += '<div class="export-hint">';
    html += Icons.info;
    html += '<span>Die CSV-Datei verwendet Semikolon (;) als Trennzeichen und ist für Excel optimiert.</span>';
    html += '</div>';

    // ===== BACKUP SECTION =====
    html += '<div class="backup-divider">';
    html += '<div class="backup-divider-line"></div>';
    html += '<span class="backup-divider-text">Backup & Wiederherstellung</span>';
    html += '<div class="backup-divider-line"></div>';
    html += '</div>';

    // Backup export info
    html += '<div class="card backup-info-card">';
    html += '<div class="backup-info-icon backup-info-icon-blue">' + Icons.shield + '</div>';
    html += '<div class="backup-info-text">';
    html += '<h3>Komplettes Backup</h3>';
    html += '<p>Sichern Sie alle Zähler und Ablesungen in einer JSON-Datei. Perfekt zur Datensicherung oder zum Übertragen auf ein anderes Gerät.</p>';
    html += '</div></div>';

    // Backup actions
    html += '<div class="backup-actions">';

    // Export backup button
    html += '<button class="backup-btn backup-btn-export" id="backup-export-btn" onclick="App.handleBackupExport()"' + (meters.length === 0 && readings.length === 0 ? ' disabled' : '') + '>';
    html += Icons.download + ' Backup erstellen';
    html += '</button>';

    // Import backup button
    html += '<button class="backup-btn backup-btn-import" id="backup-import-btn" onclick="App.triggerBackupImport()">';
    html += Icons.upload + ' Backup wiederherstellen';
    html += '</button>';

    // Hidden file input
    html += '<input type="file" accept=".json,application/json" class="backup-file-input" id="backup-file-input" onchange="App.handleBackupFileSelect(event)" />';

    html += '</div>';

    // Backup summary
    html += '<div class="export-summary">';
    html += '<span class="export-count">' + meters.length + ' Zähler, ' + readings.length + ' Ablesungen</span>';
    html += '</div>';

    // Backup hint
    html += '<div class="backup-hint">';
    html += Icons.info;
    html += '<span>Erstellen Sie regelmäßig Backups um Datenverlust zu vermeiden. Die JSON-Datei enthält alle Ihre Daten und kann jederzeit wiederhergestellt werden.</span>';
    html += '</div>';

    html += '</div>';
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
    exportView: exportView,
    renderReadingItems: renderReadingItems,
    esc: esc
  };
})();
