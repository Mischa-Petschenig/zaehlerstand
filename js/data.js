
/**
 * Data layer – CRUD operations for meters and readings.
 * All functions return Promises.
 */
var Data = (function() {
  var METERS_KEY = 'meters_db';
  var READINGS_KEY = 'readings_db';

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

  async function getMeters() {
    var data = await Storage.getItem(METERS_KEY);
    if (!data) return [];
    try { return JSON.parse(data); } catch(e) { return []; }
  }

  async function saveMeters(meters) {
    await Storage.setItem(METERS_KEY, JSON.stringify(meters));
  }

  async function getReadings() {
    var data = await Storage.getItem(READINGS_KEY);
    if (!data) return [];
    try { return JSON.parse(data); } catch(e) { return []; }
  }

  async function saveReadings(readings) {
    await Storage.setItem(READINGS_KEY, JSON.stringify(readings));
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

  function generateCSV(meters, readings) {
    var header = ['Zählernummer', 'Zählername', 'Zählertyp', 'Einheit', 'Ablesedatum', 'Zählerstand', 'Notiz'];
    var lines = [header.map(escapeCSV).join(';')];
    var sorted = readings.slice().sort(function(a, b) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    sorted.forEach(function(reading) {
      var meter = meters.find(function(m) { return m.id === reading.meterId; });
      if (!meter) return;
      var row = [
        meter.number,
        meter.name,
        meter.type,
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
  function generateBackupJSON(meters, readings) {
    var backup = {
      appVersion: '1.0',
      exportDate: new Date().toISOString(),
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

    // Validate each meter has required fields
    for (var i = 0; i < data.meters.length; i++) {
      var m = data.meters[i];
      if (!m.id || !m.name || !m.number) {
        return { valid: false, error: 'Zähler #' + (i + 1) + ' hat fehlende Pflichtfelder (id, name oder number).' };
      }
    }

    // Validate each reading has required fields
    for (var j = 0; j < data.readings.length; j++) {
      var r = data.readings[j];
      if (!r.id || !r.meterId || r.value === undefined || !r.date) {
        return { valid: false, error: 'Ablesung #' + (j + 1) + ' hat fehlende Pflichtfelder (id, meterId, value oder date).' };
      }
    }

    return {
      valid: true,
      data: data,
      meterCount: data.meters.length,
      readingCount: data.readings.length,
      exportDate: data.exportDate || null,
      appVersion: data.appVersion || 'unbekannt'
    };
  }

  // Import – Replace mode
  async function importReplace(backupData) {
    await saveMeters(backupData.meters);
    await saveReadings(backupData.readings);
  }

  // Import – Merge mode
  async function importMerge(backupData) {
    var existingMeters = await getMeters();
    var existingReadings = await getReadings();

    var existingMeterIds = {};
    existingMeters.forEach(function(m) { existingMeterIds[m.id] = true; });

    var existingReadingIds = {};
    existingReadings.forEach(function(r) { existingReadingIds[r.id] = true; });

    var newMeters = 0;
    var newReadings = 0;

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

    await saveMeters(existingMeters);
    await saveReadings(existingReadings);

    return { newMeters: newMeters, newReadings: newReadings };
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
    getMeters: getMeters,
    saveMeters: saveMeters,
    getReadings: getReadings,
    saveReadings: saveReadings,
    addMeter: addMeter,
    updateMeter: updateMeter,
    deleteMeter: deleteMeter,
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
