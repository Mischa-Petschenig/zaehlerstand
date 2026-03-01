
/**
 * Data layer – CRUD operations for meters, readings, categories, and settings.
 * All functions return Promises.
 */
var Data = (function() {
  var METERS_KEY = 'meters_db';
  var READINGS_KEY = 'readings_db';
  var CATEGORIES_KEY = 'categories_db';
  var SETTINGS_KEY = 'settings_db';

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    return day + '.' + month + '.' + year;
  }

  function formatDateTime(isoStr) {
    var d = new Date(isoStr);
    var day = String(d.getDate()).padStart(2, '0');
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var year = d.getFullYear();
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    return day + '.' + month + '.' + year + ' um ' + hours + ':' + minutes + ' Uhr';
  }

  function formatNumber(num) {
    return num.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }

  function formatCurrency(num) {
    return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function getMonthName(monthIdx) {
    var names = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    return names[monthIdx] || '';
  }

  function getMonthShort(monthIdx) {
    var names = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    return names[monthIdx] || '';
  }

  // ===== SETTINGS =====
  async function getSettings() {
    var data = await Storage.getItem(SETTINGS_KEY);
    if (!data) return {};
    try { return JSON.parse(data); } catch(e) { return {}; }
  }

  async function saveSettings(settings) {
    await Storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  async function getCostRates() {
    var settings = await getSettings();
    return settings.costRates || {};
  }

  async function saveCostRate(meterType, rate) {
    var settings = await getSettings();
    if (!settings.costRates) settings.costRates = {};
    settings.costRates[meterType] = rate;
    await saveSettings(settings);
  }

  async function getTheme() {
    var settings = await getSettings();
    return settings.theme || 'auto';
  }

  async function setTheme(theme) {
    var settings = await getSettings();
    settings.theme = theme;
    await saveSettings(settings);
  }

  async function getReminderInterval() {
    var settings = await getSettings();
    return settings.reminderInterval || 30;
  }

  async function setReminderInterval(days) {
    var settings = await getSettings();
    settings.reminderInterval = days;
    await saveSettings(settings);
  }

  // ===== CATEGORIES =====
  async function getCategories() {
    var data = await Storage.getItem(CATEGORIES_KEY);
    if (!data) return [];
    try { return JSON.parse(data); } catch(e) { return []; }
  }

  async function saveCategories(categories) {
    await Storage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }

  async function addCategory(category) {
    var categories = await getCategories();
    categories.push(category);
    await saveCategories(categories);
  }

  async function updateCategory(updated) {
    var categories = await getCategories();
    var idx = categories.findIndex(function(c) { return c.id === updated.id; });
    if (idx !== -1) {
      categories[idx] = updated;
      await saveCategories(categories);
    }
  }

  async function deleteCategory(id) {
    var categories = await getCategories();
    categories = categories.filter(function(c) { return c.id !== id; });
    await saveCategories(categories);
    var meters = await getMeters();
    var changed = false;
    meters.forEach(function(m) {
      if (m.categoryId === id) {
        m.categoryId = null;
        changed = true;
      }
    });
    if (changed) {
      await saveMeters(meters);
    }
  }

  async function reorderCategories(orderedIds) {
    var categories = await getCategories();
    var catMap = {};
    categories.forEach(function(c) { catMap[c.id] = c; });
    var reordered = [];
    orderedIds.forEach(function(id, idx) {
      if (catMap[id]) {
        catMap[id].position = idx;
        reordered.push(catMap[id]);
      }
    });
    categories.forEach(function(c) {
      if (orderedIds.indexOf(c.id) === -1) {
        c.position = reordered.length;
        reordered.push(c);
      }
    });
    await saveCategories(reordered);
  }

  function getSortedCategories(categories) {
    return categories.slice().sort(function(a, b) {
      var pa = typeof a.position === 'number' ? a.position : 9999;
      var pb = typeof b.position === 'number' ? b.position : 9999;
      if (pa !== pb) return pa - pb;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
  }

  // ===== METERS =====
  async function getMeters() {
    var data = await Storage.getItem(METERS_KEY);
    if (!data) return [];
    try { return JSON.parse(data); } catch(e) { return []; }
  }

  async function saveMeters(meters) {
    await Storage.setItem(METERS_KEY, JSON.stringify(meters));
  }

  async function addMeter(meter) {
    var meters = await getMeters();
    meters.push(meter);
    await saveMeters(meters);
  }

  async function updateMeter(updated) {
    var meters = await getMeters();
    var idx = meters.findIndex(function(m) { return m.id === updated.id; });
    if (idx !== -1) {
      meters[idx] = updated;
      await saveMeters(meters);
    }
  }

  async function deleteMeter(id) {
    var meters = await getMeters();
    meters = meters.filter(function(m) { return m.id !== id; });
    await saveMeters(meters);
    var readings = await getReadings();
    readings = readings.filter(function(r) { return r.meterId !== id; });
    await saveReadings(readings);
  }

  function groupMetersByCategory(meters, categories) {
    var sorted = getSortedCategories(categories);
    var groups = [];
    var assignedMeterIds = {};

    sorted.forEach(function(cat) {
      var catMeters = meters.filter(function(m) { return m.categoryId === cat.id; });
      catMeters.forEach(function(m) { assignedMeterIds[m.id] = true; });
      groups.push({
        category: cat,
        meters: catMeters
      });
    });

    var uncategorized = meters.filter(function(m) { return !assignedMeterIds[m.id]; });
    if (uncategorized.length > 0 || groups.length === 0) {
      groups.push({
        category: { id: '__sonstige__', name: 'Sonstige', position: 99999 },
        meters: uncategorized,
        isDefault: true
      });
    }

    return groups;
  }

  // ===== READINGS =====
  async function getReadings() {
    var data = await Storage.getItem(READINGS_KEY);
    if (!data) return [];
    try { return JSON.parse(data); } catch(e) { return []; }
  }

  async function saveReadings(readings) {
    await Storage.setItem(READINGS_KEY, JSON.stringify(readings));
  }

  async function addReading(reading) {
    var readings = await getReadings();
    readings.push(reading);
    await saveReadings(readings);
  }

  async function deleteReading(id) {
    var readings = await getReadings();
    readings = readings.filter(function(r) { return r.id !== id; });
    await saveReadings(readings);
  }

  // ===== PLAUSIBILITY CHECK =====
  function checkPlausibility(meters, readings, meterId, newValue, newDate) {
    var meter = meters.find(function(m) { return m.id === meterId; });
    if (!meter) return null;

    var meterReadings = readings.filter(function(r) { return r.meterId === meterId; })
      .sort(function(a, b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); });
    
    if (meterReadings.length === 0) return null;

    var warnings = [];
    var lastReading = meterReadings[meterReadings.length - 1];

    // Check if value is lower than last reading (unlikely for most meters)
    if (newValue < lastReading.value) {
      warnings.push('Der neue Wert (' + formatNumber(newValue) + ') ist niedriger als der letzte Stand (' + formatNumber(lastReading.value) + '). Bitte überprüfen Sie die Eingabe.');
    }

    // Check if consumption is extremely high (>10x average)
    if (meterReadings.length >= 2 && newValue > lastReading.value) {
      var consumptions = [];
      for (var i = 1; i < meterReadings.length; i++) {
        consumptions.push(meterReadings[i].value - meterReadings[i-1].value);
      }
      var avgConsumption = consumptions.reduce(function(a,b){return a+b;}, 0) / consumptions.length;
      var newConsumption = newValue - lastReading.value;
      
      if (avgConsumption > 0 && newConsumption > avgConsumption * 10) {
        warnings.push('Der Verbrauch (' + formatNumber(newConsumption) + ' ' + meter.unit + ') ist ungewöhnlich hoch – mehr als 10x des Durchschnitts (' + formatNumber(avgConsumption) + ' ' + meter.unit + ').');
      }
    }

    // Check for duplicate date
    var hasSameDate = meterReadings.some(function(r) { return r.date === newDate; });
    if (hasSameDate) {
      warnings.push('Für dieses Datum existiert bereits eine Ablesung.');
    }

    return warnings.length > 0 ? warnings : null;
  }

  // ===== READING REMINDERS =====
  function getOverdueMeters(meters, readings, intervalDays) {
    var now = new Date();
    var overdue = [];
    
    meters.forEach(function(meter) {
      var meterReadings = readings.filter(function(r) { return r.meterId === meter.id; });
      if (meterReadings.length === 0) {
        // Never read -> overdue
        overdue.push({ meter: meter, daysSince: null, lastDate: null });
        return;
      }
      
      var lastReading = meterReadings.sort(function(a,b) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })[0];
      
      var lastDate = new Date(lastReading.date);
      var daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSince >= intervalDays) {
        overdue.push({ meter: meter, daysSince: daysSince, lastDate: lastReading.date });
      }
    });
    
    return overdue;
  }

  // ===== REPORT DATA =====
  function generateReportData(meters, readings, year, month) {
    var report = {
      totalConsumption: {},
      totalCost: 0,
      meters: [],
      readingCount: 0
    };

    meters.forEach(function(meter) {
      var meterReadings = readings.filter(function(r) {
        if (r.meterId !== meter.id) return false;
        var d = new Date(r.date);
        if (month !== undefined && month !== null) {
          return d.getFullYear() === year && d.getMonth() === month;
        }
        return d.getFullYear() === year;
      }).sort(function(a,b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); });

      // Get readings for consumption calculation (need before/after period too)
      var allMeterReadings = readings.filter(function(r) { return r.meterId === meter.id; })
        .sort(function(a,b) { return new Date(a.date).getTime() - new Date(b.date).getTime(); });

      var consumption = 0;
      var firstValue = null;
      var lastValue = null;

      if (meterReadings.length >= 2) {
        firstValue = meterReadings[0].value;
        lastValue = meterReadings[meterReadings.length - 1].value;
        consumption = lastValue - firstValue;
      } else if (meterReadings.length === 1) {
        // Find previous reading before this period
        var periodStart = new Date(year, month !== undefined && month !== null ? month : 0, 1);
        var prevReadings = allMeterReadings.filter(function(r) {
          return new Date(r.date).getTime() < periodStart.getTime();
        });
        if (prevReadings.length > 0) {
          firstValue = prevReadings[prevReadings.length - 1].value;
          lastValue = meterReadings[0].value;
          consumption = lastValue - firstValue;
        }
      }

      report.readingCount += meterReadings.length;

      if (consumption > 0 || meterReadings.length > 0) {
        if (!report.totalConsumption[meter.type]) {
          report.totalConsumption[meter.type] = { value: 0, unit: meter.unit };
        }
        report.totalConsumption[meter.type].value += consumption;

        report.meters.push({
          meter: meter,
          consumption: consumption,
          readingCount: meterReadings.length,
          firstValue: firstValue,
          lastValue: lastValue,
          readings: meterReadings
        });
      }
    });

    return report;
  }

  // CSV Export
  function escapeCSV(val) {
    if (val.indexOf('"') !== -1 || val.indexOf(';') !== -1 || val.indexOf('\n') !== -1) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  }

  function generateCSV(meters, readings, categories) {
    var header = ['Zählernummer', 'Zählername', 'Zählertyp', 'Kategorie', 'Einheit', 'Ablesedatum', 'Zählerstand', 'Notiz'];
    var lines = [header.map(escapeCSV).join(';')];
    var sorted = readings.slice().sort(function(a, b) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    var catMap = {};
    (categories || []).forEach(function(c) { catMap[c.id] = c.name; });

    sorted.forEach(function(reading) {
      var meter = meters.find(function(m) { return m.id === reading.meterId; });
      if (!meter) return;
      var catName = meter.categoryId ? (catMap[meter.categoryId] || 'Sonstige') : 'Sonstige';
      var row = [
        meter.number,
        meter.name,
        meter.type,
        catName,
        meter.unit,
        formatDate(reading.date),
        reading.value.toString().replace('.', ','),
        reading.note || ''
      ];
      lines.push(row.map(escapeCSV).join(';'));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  function generateBackupJSON(meters, readings, categories) {
    var backup = {
      appVersion: '3.0',
      exportDate: new Date().toISOString(),
      categories: categories || [],
      meters: meters,
      readings: readings
    };
    return JSON.stringify(backup, null, 2);
  }

  function validateBackup(jsonString) {
    var data;
    try {
      data = JSON.parse(jsonString);
    } catch(e) {
      return { valid: false, error: 'Die Datei enthält kein gültiges JSON-Format.' };
    }

    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Die Datei enthält keine gültigen Backup-Daten.' };
    }

    if (!Array.isArray(data.meters)) {
      return { valid: false, error: 'Die Backup-Datei enthält keine Zähler-Daten (meters Array fehlt).' };
    }

    if (!Array.isArray(data.readings)) {
      return { valid: false, error: 'Die Backup-Datei enthält keine Ablesungs-Daten (readings Array fehlt).' };
    }

    if (data.categories && !Array.isArray(data.categories)) {
      return { valid: false, error: 'Die Backup-Datei enthält ungültige Kategorie-Daten.' };
    }

    for (var i = 0; i < data.meters.length; i++) {
      var m = data.meters[i];
      if (!m.id || !m.name || !m.number) {
        return { valid: false, error: 'Zähler #' + (i + 1) + ' hat fehlende Pflichtfelder (id, name oder number).' };
      }
    }

    for (var j = 0; j < data.readings.length; j++) {
      var r = data.readings[j];
      if (!r.id || !r.meterId || r.value === undefined || !r.date) {
        return { valid: false, error: 'Ablesung #' + (j + 1) + ' hat fehlende Pflichtfelder (id, meterId, value oder date).' };
      }
    }

    var categoryCount = (data.categories || []).length;

    return {
      valid: true,
      data: data,
      meterCount: data.meters.length,
      readingCount: data.readings.length,
      categoryCount: categoryCount,
      exportDate: data.exportDate || null,
      appVersion: data.appVersion || 'unbekannt'
    };
  }

  async function importReplace(backupData) {
    await saveMeters(backupData.meters);
    await saveReadings(backupData.readings);
    if (backupData.categories) {
      await saveCategories(backupData.categories);
    } else {
      await saveCategories([]);
    }
  }

  async function importMerge(backupData) {
    var existingMeters = await getMeters();
    var existingReadings = await getReadings();
    var existingCategories = await getCategories();

    var existingMeterIds = {};
    existingMeters.forEach(function(m) { existingMeterIds[m.id] = true; });
    var existingReadingIds = {};
    existingReadings.forEach(function(r) { existingReadingIds[r.id] = true; });
    var existingCategoryIds = {};
    existingCategories.forEach(function(c) { existingCategoryIds[c.id] = true; });

    var newMeters = 0;
    var newReadings = 0;
    var newCategories = 0;

    if (backupData.categories) {
      backupData.categories.forEach(function(c) {
        if (!existingCategoryIds[c.id]) {
          existingCategories.push(c);
          existingCategoryIds[c.id] = true;
          newCategories++;
        }
      });
    }

    backupData.meters.forEach(function(m) {
      if (!existingMeterIds[m.id]) {
        existingMeters.push(m);
        existingMeterIds[m.id] = true;
        newMeters++;
      }
    });

    backupData.readings.forEach(function(r) {
      if (!existingReadingIds[r.id]) {
        existingReadings.push(r);
        existingReadingIds[r.id] = true;
        newReadings++;
      }
    });

    await saveCategories(existingCategories);
    await saveMeters(existingMeters);
    await saveReadings(existingReadings);

    return { newMeters: newMeters, newReadings: newReadings, newCategories: newCategories };
  }

  async function clearAllData() {
    await saveMeters([]);
    await saveReadings([]);
    await saveCategories([]);
    // Keep settings
  }

  function downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  var unitSuggestions = {
    'Strom': 'kWh',
    'Kaltwasser': 'm³',
    'Warmwasser': 'm³',
    'Betriebsstunden': 'h',
    'Wärme': 'MWh'
  };

  var defaultCostRates = {
    'Strom': 0.35,
    'Kaltwasser': 4.50,
    'Warmwasser': 9.80,
    'Wärme': 120.00,
    'Betriebsstunden': 0
  };

  var costUnits = {
    'Strom': '€/kWh',
    'Kaltwasser': '€/m³',
    'Warmwasser': '€/m³',
    'Wärme': '€/MWh',
    'Betriebsstunden': '€/h'
  };

  return {
    generateId: generateId,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatNumber: formatNumber,
    formatCurrency: formatCurrency,
    getMonthName: getMonthName,
    getMonthShort: getMonthShort,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getCostRates: getCostRates,
    saveCostRate: saveCostRate,
    getTheme: getTheme,
    setTheme: setTheme,
    getReminderInterval: getReminderInterval,
    setReminderInterval: setReminderInterval,
    getCategories: getCategories,
    saveCategories: saveCategories,
    addCategory: addCategory,
    updateCategory: updateCategory,
    deleteCategory: deleteCategory,
    reorderCategories: reorderCategories,
    getSortedCategories: getSortedCategories,
    groupMetersByCategory: groupMetersByCategory,
    getMeters: getMeters,
    saveMeters: saveMeters,
    addMeter: addMeter,
    updateMeter: updateMeter,
    deleteMeter: deleteMeter,
    getReadings: getReadings,
    saveReadings: saveReadings,
    addReading: addReading,
    deleteReading: deleteReading,
    checkPlausibility: checkPlausibility,
    getOverdueMeters: getOverdueMeters,
    generateReportData: generateReportData,
    generateCSV: generateCSV,
    generateBackupJSON: generateBackupJSON,
    validateBackup: validateBackup,
    importReplace: importReplace,
    importMerge: importMerge,
    clearAllData: clearAllData,
    downloadFile: downloadFile,
    unitSuggestions: unitSuggestions,
    defaultCostRates: defaultCostRates,
    costUnits: costUnits
  };
})();
