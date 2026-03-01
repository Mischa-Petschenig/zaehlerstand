
/**
 * Data layer – CRUD operations for meters, readings, and categories.
 * All functions return Promises.
 */
var Data = (function() {
  var METERS_KEY = 'meters_db';
  var READINGS_KEY = 'readings_db';
  var CATEGORIES_KEY = 'categories_db';

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
    // Move meters in this category to "Sonstige" (categoryId = null)
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
    // Add any categories not in orderedIds (shouldn't happen, but safe)
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

  // Group meters by category
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

    // "Sonstige" – meters without category or with null/undefined categoryId
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

  // JSON Backup Export
  function generateBackupJSON(meters, readings, categories) {
    var backup = {
      appVersion: '2.0',
      exportDate: new Date().toISOString(),
      categories: categories || [],
      meters: meters,
      readings: readings
    };
    return JSON.stringify(backup, null, 2);
  }

  // JSON Backup Import – Validation
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

    // Categories array is optional for backward compat
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

  // Import – Replace mode
  async function importReplace(backupData) {
    await saveMeters(backupData.meters);
    await saveReadings(backupData.readings);
    if (backupData.categories) {
      await saveCategories(backupData.categories);
    } else {
      await saveCategories([]);
    }
  }

  // Import – Merge mode
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

    // Merge categories first
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

  return {
    generateId: generateId,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatNumber: formatNumber,
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
    generateCSV: generateCSV,
    generateBackupJSON: generateBackupJSON,
    validateBackup: validateBackup,
    importReplace: importReplace,
    importMerge: importMerge,
    downloadFile: downloadFile,
    unitSuggestions: unitSuggestions
  };
})();
