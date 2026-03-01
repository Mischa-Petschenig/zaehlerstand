
/**
 * Main App Controller
 */
var App = (function() {

  // State
  var meters = [];
  var readings = [];
  var categories = [];
  var costRates = {};
  var currentTheme = 'auto';
  var reminderInterval = 30;
  var currentView = 'dashboard';
  var selectedMeterId = null;
  var editingMeter = null;
  var viewHistory = [];
  var expandedCategories = {};
  var meterSearchQuery = '';
  var readingViewMode = 'list';
  var reportYear = new Date().getFullYear();
  var reportMonth = null;
  var comparisonMeterIds = [];

  // DOM refs
  var mainEl, titleEl, backBtn, headerActions;

  // Titles
  var titles = {
    'dashboard': 'Übersicht',
    'meters': 'Zähler',
    'readings': 'Ablesungen',
    'add-reading': 'Neue Ablesung',
    'add-meter': 'Neuer Zähler',
    'edit-meter': 'Zähler bearbeiten',
    'meter-detail': 'Zählerdetails',
    'export': 'Export & Backup',
    'manage-categories': 'Kategorien verwalten',
    'settings': 'Einstellungen',
    'report': 'Verbrauchsbericht',
    'comparison': 'Zählervergleich'
  };

  var mainViews = ['dashboard', 'meters', 'readings', 'export'];

  // Initialize
  async function init() {
    mainEl = document.getElementById('main-content');
    titleEl = document.getElementById('header-title');
    backBtn = document.getElementById('header-back');
    headerActions = document.getElementById('header-actions');

    backBtn.addEventListener('click', goBack);
    setupBottomNav();
    setupInstallPrompt();
    setupDialogOverlay();

    await refreshData();
    await loadSettings();
    applyTheme(currentTheme);
    render();
  }

  async function refreshData() {
    meters = await Data.getMeters();
    readings = await Data.getReadings();
    categories = await Data.getCategories();
    costRates = await Data.getCostRates();
  }

  async function loadSettings() {
    currentTheme = await Data.getTheme();
    reminderInterval = await Data.getReminderInterval();
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (theme === 'dark') {
        meta.setAttribute('content', '#242424');
      } else if (theme === 'light') {
        meta.setAttribute('content', '#1a73e8');
      } else {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          meta.setAttribute('content', '#242424');
        } else {
          meta.setAttribute('content', '#1a73e8');
        }
      }
    }
  }

  // ===== NAVIGATION =====
  function navigate(view, meterId) {
    if (meterId) selectedMeterId = meterId;

    if (view === 'meter-detail' && meterId) {
      var meter = meters.find(function(m) { return m.id === meterId; });
      if (meter) {
        var catId = meter.categoryId || '__sonstige__';
        expandedCategories[catId] = true;
      }
    }

    if (!mainViews.includes(view) || (mainViews.includes(currentView) && currentView !== view)) {
      viewHistory.push({ view: currentView, meterId: selectedMeterId });
    }
    currentView = view;
    editingMeter = null;
    render();
  }

  function goBack() {
    if (viewHistory.length > 0) {
      var prev = viewHistory.pop();
      currentView = prev.view;
      if (prev.meterId) selectedMeterId = prev.meterId;
      editingMeter = null;
      render();
    } else {
      currentView = 'dashboard';
      editingMeter = null;
      render();
    }
  }

  function toggleCategory(catId) {
    expandedCategories[catId] = !expandedCategories[catId];
    render();
  }

  // ===== RENDER =====
  function render() {
    try {
      var showBack = !mainViews.includes(currentView);
      backBtn.style.display = showBack ? 'flex' : 'none';
      titleEl.textContent = titles[currentView] || 'Zählerstand Manager';
      headerActions.innerHTML = '';

      // Update bottom nav
      document.querySelectorAll('.bottom-nav-item').forEach(function(btn) {
        var v = btn.getAttribute('data-view');
        var activeView = currentView;
        if (['add-meter', 'edit-meter', 'meter-detail', 'manage-categories'].indexOf(currentView) !== -1) {
          activeView = 'meters';
        }
        if (['add-reading'].indexOf(currentView) !== -1) {
          activeView = 'readings';
        }
        if (['settings', 'report', 'comparison'].indexOf(currentView) !== -1) {
          activeView = 'export';
        }
        btn.classList.toggle('active', v === activeView);
      });

      // Header actions
      if (currentView === 'dashboard') {
        headerActions.innerHTML = '<button class="header-action-btn" onclick="App.navigate(\'settings\')" aria-label="Einstellungen">' + Icons.settings + '</button>';
      }

      // Render view content
      var html = '';
      switch (currentView) {
        case 'dashboard':
          html = Views.dashboard(meters, readings, categories, expandedCategories, costRates, reminderInterval);
          break;
        case 'meters':
          html = Views.meterList(meters, readings, categories, expandedCategories, meterSearchQuery);
          break;
        case 'add-meter':
          html = Views.meterForm(null, categories);
          break;
        case 'edit-meter':
          html = Views.meterForm(editingMeter, categories);
          break;
        case 'meter-detail':
          var detailMeter = meters.find(function(m) { return m.id === selectedMeterId; });
          html = Views.meterDetail(detailMeter, readings, costRates);
          break;
        case 'readings':
          html = Views.readingList(meters, readings);
          break;
        case 'add-reading':
          html = Views.readingForm(meters, selectedMeterId, readings);
          break;
        case 'export':
          html = Views.exportView(meters, readings, categories);
          break;
        case 'manage-categories':
          html = Views.categoryManagement(categories, meters);
          break;
        case 'settings':
          html = Views.settingsView(currentTheme, reminderInterval);
          break;
        case 'report':
          html = Views.reportView(meters, readings, categories, costRates, reportYear, reportMonth);
          break;
        case 'comparison':
          html = Views.comparisonView(meters, readings, comparisonMeterIds);
          break;
        default:
          html = '<div class="empty-state"><p>Seite nicht gefunden.</p></div>';
      }

      mainEl.innerHTML = html;
      mainEl.scrollTop = 0;

      // Post-render setup
      if (currentView === 'manage-categories') {
        setupCategoryDragDrop();
      }

    } catch (err) {
      console.error('Render error:', err);
      mainEl.innerHTML = '<div class="empty-state"><h3>Ein Fehler ist aufgetreten</h3><p>' + (err.message || 'Unbekannter Fehler') + '</p><button class="empty-state-btn" onclick="App.navigate(\'dashboard\')">Zur Übersicht</button></div>';
    }
  }

  // ===== BOTTOM NAV =====
  function setupBottomNav() {
    document.querySelectorAll('.bottom-nav-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var view = this.getAttribute('data-view');
        viewHistory = [];
        editingMeter = null;
        meterSearchQuery = '';
        currentView = view;
        render();
      });
    });
  }

  // ===== INSTALL PROMPT =====
  var deferredPrompt = null;
  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredPrompt = e;
      var banner = document.getElementById('install-banner');
      if (banner) banner.style.display = 'block';
    });

    var dismissBtn = document.getElementById('install-dismiss');
    var acceptBtn = document.getElementById('install-accept');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function() {
        document.getElementById('install-banner').style.display = 'none';
        deferredPrompt = null;
      });
    }
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function() {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function() {
            deferredPrompt = null;
            document.getElementById('install-banner').style.display = 'none';
          });
        }
      });
    }
  }

  // ===== DIALOG =====
  var dialogResolve = null;
  function setupDialogOverlay() {
    var overlay = document.getElementById('dialog-overlay');
    var cancelBtn = document.getElementById('dialog-cancel');
    var confirmBtn = document.getElementById('dialog-confirm');

    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeDialog(false);
      });
    }
    if (cancelBtn) cancelBtn.addEventListener('click', function() { closeDialog(false); });
    if (confirmBtn) confirmBtn.addEventListener('click', function() { closeDialog(true); });
  }

  function showDialog(title, message, confirmLabel) {
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-message').textContent = message;
    var confirmBtn = document.getElementById('dialog-confirm');
    confirmBtn.textContent = confirmLabel || 'Löschen';
    document.getElementById('dialog-overlay').style.display = 'flex';
    return new Promise(function(resolve) { dialogResolve = resolve; });
  }

  function closeDialog(result) {
    document.getElementById('dialog-overlay').style.display = 'none';
    if (dialogResolve) {
      dialogResolve(result);
      dialogResolve = null;
    }
  }

  // ===== TOAST =====
  var toastTimer = null;
  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' toast-' + type : '');

    var iconHtml = '';
    if (type === 'success') {
      iconHtml = '<span class="toast-icon" style="color:var(--success)">' + Icons.check + '</span>';
    } else if (type === 'error') {
      iconHtml = '<span class="toast-icon" style="color:var(--danger)">' + Icons.warningIcon + '</span>';
    }
    toast.innerHTML = iconHtml + '<span>' + message + '</span>';
    document.body.appendChild(toast);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        toast.classList.add('toast-visible');
      });
    });

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      toast.classList.remove('toast-visible');
      setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
    }, 2500);
  }

  // ===== METER FORM =====
  function editMeter(id) {
    var meter = meters.find(function(m) { return m.id === id; });
    if (meter) {
      editingMeter = meter;
      viewHistory.push({ view: currentView, meterId: selectedMeterId });
      currentView = 'edit-meter';
      render();
    }
  }

  function handleTypeChip(btn) {
    var type = btn.getAttribute('data-type');
    document.querySelectorAll('#mf-type-chips .type-chip').forEach(function(c) {
      c.classList.remove('type-chip-active');
    });
    btn.classList.add('type-chip-active');

    var unitInput = document.getElementById('mf-unit');
    if (unitInput && Data.unitSuggestions[type]) {
      unitInput.value = Data.unitSuggestions[type];
    }
  }

  async function handleMeterSubmit(event) {
    event.preventDefault();
    var numberInput = document.getElementById('mf-number');
    var nameInput = document.getElementById('mf-name');
    var unitInput = document.getElementById('mf-unit');
    var idInput = document.getElementById('mf-id');
    var categorySelect = document.getElementById('mf-category');

    var number = numberInput.value.trim();
    var name = nameInput.value.trim();
    var unit = unitInput.value.trim();
    var categoryId = categorySelect ? categorySelect.value : '';

    var activeChip = document.querySelector('#mf-type-chips .type-chip-active');
    var type = activeChip ? activeChip.getAttribute('data-type') : 'Strom';

    // Validation
    var valid = true;
    if (!number) {
      document.getElementById('mf-number-err').textContent = 'Bitte Zählernummer eingeben.';
      numberInput.classList.add('form-input-error');
      valid = false;
    } else {
      document.getElementById('mf-number-err').textContent = '';
      numberInput.classList.remove('form-input-error');
    }

    if (!name) {
      document.getElementById('mf-name-err').textContent = 'Bitte Zählername eingeben.';
      nameInput.classList.add('form-input-error');
      valid = false;
    } else {
      document.getElementById('mf-name-err').textContent = '';
      nameInput.classList.remove('form-input-error');
    }

    if (!unit) {
      document.getElementById('mf-unit-err').textContent = 'Bitte Einheit eingeben.';
      unitInput.classList.add('form-input-error');
      valid = false;
    } else {
      document.getElementById('mf-unit-err').textContent = '';
      unitInput.classList.remove('form-input-error');
    }

    if (!valid) return;

    if (idInput) {
      // Update existing
      var updated = {
        id: idInput.value,
        number: number,
        name: name,
        type: type,
        unit: unit,
        categoryId: categoryId || null,
        updatedAt: new Date().toISOString()
      };
      // Preserve createdAt
      var existing = meters.find(function(m) { return m.id === updated.id; });
      if (existing) updated.createdAt = existing.createdAt;
      await Data.updateMeter(updated);
      showToast('Zähler aktualisiert', 'success');
    } else {
      // Create new
      var newMeter = {
        id: Data.generateId(),
        number: number,
        name: name,
        type: type,
        unit: unit,
        categoryId: categoryId || null,
        createdAt: new Date().toISOString()
      };
      await Data.addMeter(newMeter);
      showToast('Zähler erstellt', 'success');
    }

    await refreshData();
    goBack();
  }

  async function confirmDeleteMeter(id) {
    var meter = meters.find(function(m) { return m.id === id; });
    if (!meter) return;
    var meterReadingCount = readings.filter(function(r) { return r.meterId === id; }).length;
    var confirmed = await showDialog(
      'Zähler löschen?',
      'Der Zähler "' + meter.name + '" und ' + meterReadingCount + ' Ablesung' + (meterReadingCount !== 1 ? 'en' : '') + ' werden unwiderruflich gelöscht.',
      'Löschen'
    );
    if (confirmed) {
      await Data.deleteMeter(id);
      await refreshData();
      showToast('Zähler gelöscht', 'success');
      // Navigate back to meters list
      viewHistory = [];
      currentView = 'meters';
      render();
    }
  }

  // ===== READING FORM =====
  function updateReadingUnit() {
    var select = document.getElementById('rf-meter');
    var meterId = select ? select.value : '';
    var meter = meters.find(function(m) { return m.id === meterId; });
    var label = document.getElementById('rf-value-label');
    var hint = document.getElementById('rf-value-hint');
    var lastHint = document.getElementById('rf-last-reading');

    if (meter) {
      if (label) label.textContent = 'Zählerstand (' + meter.unit + ') *';
      if (hint) hint.textContent = 'Geben Sie den aktuellen Zählerstand in ' + meter.unit + ' ein';

      // Show last reading hint
      var lastReading = readings.filter(function(r) { return r.meterId === meter.id; })
        .sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); })[0];

      if (lastHint) lastHint.remove();
      if (lastReading) {
        var hintDiv = document.createElement('div');
        hintDiv.className = 'last-reading-hint';
        hintDiv.id = 'rf-last-reading';
        hintDiv.innerHTML = '<span class="last-reading-hint-icon">' + Icons.info + '</span>' +
          '<span>Letzter Stand: <span class="last-reading-hint-value">' + Data.formatNumber(lastReading.value) + ' ' + Views.esc(meter.unit) + '</span> am ' + Data.formatDate(lastReading.date) + '</span>';
        var meterGroup = select.closest('.form-group');
        if (meterGroup && meterGroup.nextElementSibling) {
          meterGroup.parentNode.insertBefore(hintDiv, meterGroup.nextElementSibling);
        }
      }
    } else {
      if (label) label.textContent = 'Zählerstand *';
      if (hint) hint.textContent = '';
      if (lastHint) lastHint.remove();
    }

    // Clear plausibility
    var plausContainer = document.getElementById('rf-plausibility-container');
    if (plausContainer) plausContainer.innerHTML = '';
  }

  function checkReadingPlausibility() {
    var select = document.getElementById('rf-meter');
    var valueInput = document.getElementById('rf-value');
    var dateInput = document.getElementById('rf-date');
    var container = document.getElementById('rf-plausibility-container');

    if (!select || !valueInput || !dateInput || !container) return;

    var meterId = select.value;
    var valStr = valueInput.value.replace(',', '.').trim();
    var val = parseFloat(valStr);
    var date = dateInput.value;

    if (!meterId || isNaN(val) || !date) {
      container.innerHTML = '';
      return;
    }

    var warnings = Data.checkPlausibility(meters, readings, meterId, val, date);
    if (warnings && warnings.length > 0) {
      var html = '';
      warnings.forEach(function(w) {
        html += '<div class="plausibility-warning">' + Icons.warningIcon + '<span>' + w + '</span></div>';
      });
      container.innerHTML = html;
    } else {
      container.innerHTML = '';
    }
  }

  async function handleReadingSubmit(event) {
    event.preventDefault();
    var meterSelect = document.getElementById('rf-meter');
    var valueInput = document.getElementById('rf-value');
    var dateInput = document.getElementById('rf-date');
    var noteInput = document.getElementById('rf-note');

    var meterId = meterSelect.value;
    var valStr = valueInput.value.replace(',', '.').trim();
    var val = parseFloat(valStr);
    var date = dateInput.value;
    var note = noteInput.value.trim();

    var valid = true;
    if (!meterId) {
      document.getElementById('rf-meter-err').textContent = 'Bitte Zähler auswählen.';
      valid = false;
    } else {
      document.getElementById('rf-meter-err').textContent = '';
    }

    if (!valStr || isNaN(val)) {
      document.getElementById('rf-value-err').textContent = 'Bitte gültigen Zählerstand eingeben.';
      valueInput.classList.add('form-input-error');
      valid = false;
    } else if (val < 0) {
      document.getElementById('rf-value-err').textContent = 'Zählerstand kann nicht negativ sein.';
      valueInput.classList.add('form-input-error');
      valid = false;
    } else {
      document.getElementById('rf-value-err').textContent = '';
      valueInput.classList.remove('form-input-error');
    }

    if (!date) {
      document.getElementById('rf-date-err').textContent = 'Bitte Datum auswählen.';
      valid = false;
    } else {
      document.getElementById('rf-date-err').textContent = '';
    }

    if (!valid) return;

    var newReading = {
      id: Data.generateId(),
      meterId: meterId,
      value: val,
      date: date,
      note: note,
      createdAt: new Date().toISOString()
    };

    await Data.addReading(newReading);
    await refreshData();

    var meter = meters.find(function(m) { return m.id === meterId; });
    showToast('Ablesung für ' + (meter ? meter.name : 'Zähler') + ' gespeichert', 'success');
    goBack();
  }

  async function confirmDeleteReading(id) {
    var confirmed = await showDialog(
      'Ablesung löschen?',
      'Diese Ablesung wird unwiderruflich gelöscht.',
      'Löschen'
    );
    if (confirmed) {
      await Data.deleteReading(id);
      await refreshData();
      showToast('Ablesung gelöscht', 'success');
      render();
    }
  }

  // ===== READING LIST =====
  function filterReadings() {
    var filterSelect = document.getElementById('reading-filter');
    var container = document.getElementById('reading-items');
    if (!filterSelect || !container) return;

    var val = filterSelect.value;
    if (readingViewMode === 'timeline') {
      container.innerHTML = Views.renderReadingTimeline(meters, readings, val);
    } else {
      container.innerHTML = Views.renderReadingItems(meters, readings, val);
    }
  }

  function setReadingView(mode, btn) {
    readingViewMode = mode;
    document.querySelectorAll('.chart-period-selector .chart-period-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');

    var filterSelect = document.getElementById('reading-filter');
    var val = filterSelect ? filterSelect.value : 'all';
    var container = document.getElementById('reading-items');
    if (!container) return;

    if (mode === 'timeline') {
      container.innerHTML = Views.renderReadingTimeline(meters, readings, val);
    } else {
      container.innerHTML = Views.renderReadingItems(meters, readings, val);
    }
  }

  // ===== METER SEARCH =====
  function handleMeterSearch(query) {
    meterSearchQuery = query;
    var clearBtn = document.getElementById('meter-search-clear');
    if (clearBtn) {
      clearBtn.classList.toggle('visible', query.length > 0);
    }
    render();
    // Re-focus search
    var searchInput = document.getElementById('meter-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.setSelectionRange(query.length, query.length);
    }
  }

  function clearMeterSearch() {
    meterSearchQuery = '';
    render();
    var searchInput = document.getElementById('meter-search');
    if (searchInput) searchInput.focus();
  }

  // ===== DASHBOARD CHART =====
  function changeDashboardChart(meterId, period, btn) {
    var canvas = document.getElementById('dashboard-chart-canvas');
    if (!canvas) return;

    document.querySelectorAll('#dashboard-chart .chart-period-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');

    var meter = meters.find(function(m) { return m.id === meterId; });
    if (!meter) return;
    var data = Charts.getConsumptionData(readings, meterId, period);
    canvas.innerHTML = Charts.renderBarChart(data, meter.unit, Icons.getChartColor(meter.type));
  }

  function changeDetailChart(meterId, period, btn) {
    var canvas = document.getElementById('detail-chart-canvas');
    if (!canvas) return;

    document.querySelectorAll('#detail-chart .chart-period-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');

    var meter = meters.find(function(m) { return m.id === meterId; });
    if (!meter) return;
    var data = Charts.getConsumptionData(readings, meterId, period);
    canvas.innerHTML = Charts.renderBarChart(data, meter.unit, Icons.getChartColor(meter.type));
  }

  // ===== CATEGORY MANAGEMENT =====
  function showCategoryForm() {
    var container = document.getElementById('category-form-container');
    if (container) {
      container.style.display = 'block';
      var input = document.getElementById('cf-name');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  function hideCategoryForm() {
    var container = document.getElementById('category-form-container');
    if (container) container.style.display = 'none';
  }

  async function handleCategorySubmit() {
    var nameInput = document.getElementById('cf-name');
    var name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      var err = document.getElementById('cf-name-err');
      if (err) err.textContent = 'Bitte Namen eingeben.';
      if (nameInput) nameInput.classList.add('form-input-error');
      return;
    }

    var newCategory = {
      id: Data.generateId(),
      name: name,
      position: categories.length,
      createdAt: new Date().toISOString()
    };

    await Data.addCategory(newCategory);
    await refreshData();
    showToast('Kategorie erstellt', 'success');
    render();
  }

  function editCategory(catId) {
    var editForm = document.getElementById('cat-edit-' + catId);
    if (editForm) {
      editForm.style.display = editForm.style.display === 'none' ? 'flex' : 'none';
      if (editForm.style.display === 'flex') {
        var input = document.getElementById('cat-edit-input-' + catId);
        if (input) input.focus();
      }
    }
  }

  function cancelEditCategory(catId) {
    var editForm = document.getElementById('cat-edit-' + catId);
    if (editForm) editForm.style.display = 'none';
    // Reset value
    var cat = categories.find(function(c) { return c.id === catId; });
    var input = document.getElementById('cat-edit-input-' + catId);
    if (cat && input) input.value = cat.name;
  }

  async function saveEditCategory(catId) {
    var input = document.getElementById('cat-edit-input-' + catId);
    var name = input ? input.value.trim() : '';

    if (!name) {
      var err = document.getElementById('cat-edit-err-' + catId);
      if (err) err.textContent = 'Bitte Namen eingeben.';
      if (input) input.classList.add('form-input-error');
      return;
    }

    var cat = categories.find(function(c) { return c.id === catId; });
    if (cat) {
      cat.name = name;
      await Data.updateCategory(cat);
      await refreshData();
      showToast('Kategorie aktualisiert', 'success');
      render();
    }
  }

  async function confirmDeleteCategory(catId) {
    var cat = categories.find(function(c) { return c.id === catId; });
    if (!cat) return;
    var catMeterCount = meters.filter(function(m) { return m.categoryId === catId; }).length;
    var confirmed = await showDialog(
      'Kategorie löschen?',
      'Die Kategorie "' + cat.name + '" wird gelöscht. ' + catMeterCount + ' Zähler werden in "Sonstige" verschoben.',
      'Löschen'
    );
    if (confirmed) {
      await Data.deleteCategory(catId);
      await refreshData();
      showToast('Kategorie gelöscht', 'success');
      render();
    }
  }

  // ===== CATEGORY DRAG & DROP =====
  function setupCategoryDragDrop() {
    var list = document.getElementById('category-list');
    if (!list) return;

    var items = list.querySelectorAll('.category-item');
    var dragItem = null;

    items.forEach(function(item) {
      // Desktop drag
      item.addEventListener('dragstart', function(e) {
        dragItem = this;
        this.classList.add('category-item-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.getAttribute('data-category-id'));
      });

      item.addEventListener('dragend', function() {
        this.classList.remove('category-item-dragging');
        list.querySelectorAll('.category-item').forEach(function(el) {
          el.classList.remove('category-item-over');
        });
        dragItem = null;
      });

      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (this !== dragItem) {
          this.classList.add('category-item-over');
        }
      });

      item.addEventListener('dragleave', function() {
        this.classList.remove('category-item-over');
      });

      item.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('category-item-over');
        if (dragItem && dragItem !== this) {
          // Reorder
          var allItems = Array.from(list.querySelectorAll('.category-item'));
          var fromIdx = allItems.indexOf(dragItem);
          var toIdx = allItems.indexOf(this);

          if (fromIdx < toIdx) {
            this.parentNode.insertBefore(dragItem, this.nextSibling);
          } else {
            this.parentNode.insertBefore(dragItem, this);
          }

          // Save new order
          saveCategoryOrder();
        }
      });

      // Touch drag support
      var handle = item.querySelector('.category-drag-handle');
      if (handle) {
        var touchStartY = 0;
        var touchItem = null;
        var clone = null;

        handle.addEventListener('touchstart', function(e) {
          touchItem = item;
          touchStartY = e.touches[0].clientY;
          item.classList.add('category-item-dragging');
        }, { passive: true });

        handle.addEventListener('touchmove', function(e) {
          if (!touchItem) return;
          e.preventDefault();
          var touch = e.touches[0];
          var elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
          if (elemBelow) {
            var targetItem = elemBelow.closest('.category-item');
            list.querySelectorAll('.category-item').forEach(function(el) {
              el.classList.remove('category-item-over');
            });
            if (targetItem && targetItem !== touchItem) {
              targetItem.classList.add('category-item-over');
            }
          }
        }, { passive: false });

        handle.addEventListener('touchend', function(e) {
          if (!touchItem) return;
          touchItem.classList.remove('category-item-dragging');

          var overItem = list.querySelector('.category-item-over');
          if (overItem && overItem !== touchItem) {
            var allItems = Array.from(list.querySelectorAll('.category-item'));
            var fromIdx = allItems.indexOf(touchItem);
            var toIdx = allItems.indexOf(overItem);

            if (fromIdx < toIdx) {
              overItem.parentNode.insertBefore(touchItem, overItem.nextSibling);
            } else {
              overItem.parentNode.insertBefore(touchItem, overItem);
            }
            saveCategoryOrder();
          }

          list.querySelectorAll('.category-item').forEach(function(el) {
            el.classList.remove('category-item-over');
          });
          touchItem = null;
        });
      }
    });
  }

  async function saveCategoryOrder() {
    var list = document.getElementById('category-list');
    if (!list) return;

    var orderedIds = [];
    list.querySelectorAll('.category-item').forEach(function(item) {
      var id = item.getAttribute('data-category-id');
      if (id) orderedIds.push(id);
    });

    await Data.reorderCategories(orderedIds);
    await refreshData();
    showToast('Reihenfolge gespeichert', 'success');
  }

  // ===== COST SETTINGS =====
  function showCostSettings() {
    var meterTypes = [];
    var seen = {};
    meters.forEach(function(m) {
      if (!seen[m.type]) {
        seen[m.type] = true;
        meterTypes.push(m.type);
      }
    });

    var html = Views.costSettingsSheet(costRates, meterTypes);
    var div = document.createElement('div');
    div.id = 'cost-settings-container';
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  function hideCostSettings() {
    var container = document.getElementById('cost-settings-container');
    if (container) container.remove();
  }

  async function saveCostSettings() {
    var meterTypes = [];
    var seen = {};
    meters.forEach(function(m) {
      if (!seen[m.type]) {
        seen[m.type] = true;
        meterTypes.push(m.type);
      }
    });

    for (var i = 0; i < meterTypes.length; i++) {
      var type = meterTypes[i];
      var input = document.getElementById('cost-rate-' + type.replace(/\s/g, ''));
      if (input) {
        var val = parseFloat(input.value.replace(',', '.'));
        if (!isNaN(val) && val >= 0) {
          await Data.saveCostRate(type, val);
        }
      }
    }

    costRates = await Data.getCostRates();
    hideCostSettings();
    showToast('Tarife gespeichert', 'success');
    render();
  }

  // ===== EXPORT =====
  function updateExportCount() {
    var meterFilter = document.getElementById('export-meter');
    var typeFilter = document.getElementById('export-type');
    var fromFilter = document.getElementById('export-from');
    var toFilter = document.getElementById('export-to');
    var countEl = document.getElementById('export-count');
    var resetBtn = document.getElementById('export-reset');
    var exportBtn = document.getElementById('export-btn');

    var filteredReadings = getFilteredExportReadings();
    var count = filteredReadings.length;

    if (countEl) countEl.textContent = count + ' Ablesung' + (count !== 1 ? 'en' : '');
    if (exportBtn) exportBtn.disabled = count === 0;

    var hasFilter = (meterFilter && meterFilter.value !== 'all') ||
                    (typeFilter && typeFilter.value !== 'all') ||
                    (fromFilter && fromFilter.value) ||
                    (toFilter && toFilter.value);
    if (resetBtn) resetBtn.style.display = hasFilter ? 'inline-block' : 'none';
  }

  function getFilteredExportReadings() {
    var meterFilter = document.getElementById('export-meter');
    var typeFilter = document.getElementById('export-type');
    var fromFilter = document.getElementById('export-from');
    var toFilter = document.getElementById('export-to');

    var filtered = readings.slice();

    if (meterFilter && meterFilter.value !== 'all') {
      filtered = filtered.filter(function(r) { return r.meterId === meterFilter.value; });
    }

    if (typeFilter && typeFilter.value !== 'all') {
      var typeVal = typeFilter.value;
      var meterIdsOfType = meters.filter(function(m) { return m.type === typeVal; }).map(function(m) { return m.id; });
      filtered = filtered.filter(function(r) { return meterIdsOfType.indexOf(r.meterId) !== -1; });
    }

    if (fromFilter && fromFilter.value) {
      var fromDate = new Date(fromFilter.value);
      filtered = filtered.filter(function(r) { return new Date(r.date) >= fromDate; });
    }

    if (toFilter && toFilter.value) {
      var toDate = new Date(toFilter.value);
      toDate.setDate(toDate.getDate() + 1);
      filtered = filtered.filter(function(r) { return new Date(r.date) < toDate; });
    }

    return filtered;
  }

  function resetExportFilters() {
    var meterFilter = document.getElementById('export-meter');
    var typeFilter = document.getElementById('export-type');
    var fromFilter = document.getElementById('export-from');
    var toFilter = document.getElementById('export-to');

    if (meterFilter) meterFilter.value = 'all';
    if (typeFilter) typeFilter.value = 'all';
    if (fromFilter) fromFilter.value = '';
    if (toFilter) toFilter.value = '';
    updateExportCount();
  }

  function handleExport() {
    var filteredReadings = getFilteredExportReadings();
    if (filteredReadings.length === 0) {
      showToast('Keine Daten zum Exportieren', 'error');
      return;
    }

    var csv = Data.generateCSV(meters, filteredReadings, categories);
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    Data.downloadFile(csv, 'zaehlerstaende_' + dateStr + '.csv', 'text/csv;charset=utf-8');

    showToast(filteredReadings.length + ' Ablesungen exportiert', 'success');

    var btn = document.getElementById('export-btn');
    if (btn) {
      btn.classList.add('export-btn-success');
      btn.innerHTML = Icons.check + ' Exportiert!';
      setTimeout(function() {
        btn.classList.remove('export-btn-success');
        btn.innerHTML = Icons.download + ' Als CSV exportieren';
      }, 2000);
    }
  }

  // ===== BACKUP =====
  function handleBackupExport() {
    var json = Data.generateBackupJSON(meters, readings, categories);
    var now = new Date();
    var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    Data.downloadFile(json, 'zaehlerstand_backup_' + dateStr + '.json', 'application/json');

    showToast('Backup erstellt', 'success');

    var btn = document.getElementById('backup-export-btn');
    if (btn) {
      btn.classList.add('backup-btn-success');
      btn.innerHTML = Icons.check + ' Backup erstellt!';
      setTimeout(function() {
        btn.classList.remove('backup-btn-success');
        btn.innerHTML = Icons.download + ' Backup erstellen';
      }, 2000);
    }
  }

  function triggerBackupImport() {
    var input = document.getElementById('backup-file-input');
    if (input) input.click();
  }

  function handleBackupFileSelect(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var content = e.target.result;
      var validation = Data.validateBackup(content);

      if (!validation.valid) {
        showImportError(validation.error);
        return;
      }

      showImportPreview(validation);
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  }

  function showImportError(message) {
    var html = '<div class="import-error-overlay" id="import-error-overlay" onclick="if(event.target===this)App.closeImportError()">';
    html += '<div class="import-error">';
    html += '<div class="import-error-icon">' + Icons.errorIcon + '</div>';
    html += '<h3 class="import-error-title">Import fehlgeschlagen</h3>';
    html += '<p class="import-error-message">' + Views.esc(message) + '</p>';
    html += '<button class="import-error-btn" onclick="App.closeImportError()">Verstanden</button>';
    html += '</div></div>';

    var div = document.createElement('div');
    div.id = 'import-error-container';
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  function closeImportError() {
    var container = document.getElementById('import-error-container');
    if (container) container.remove();
  }

  var importData = null;
  var importMode = 'merge';

  function showImportPreview(validation) {
    importData = validation.data;
    importMode = 'merge';

    var html = '<div class="import-preview-overlay" id="import-preview-overlay" onclick="if(event.target===this)App.closeImportPreview()">';
    html += '<div class="import-preview">';
    html += '<h3 class="import-preview-title">Backup-Vorschau</h3>';
    html += '<p class="import-preview-subtitle">Überprüfen Sie die Daten vor dem Import.</p>';

    html += '<div class="import-preview-stats">';
    if (validation.categoryCount > 0) {
      html += '<div class="import-preview-stat"><div class="import-preview-stat-value">' + validation.categoryCount + '</div><div class="import-preview-stat-label">Kategorien</div></div>';
    }
    html += '<div class="import-preview-stat"><div class="import-preview-stat-value">' + validation.meterCount + '</div><div class="import-preview-stat-label">Zähler</div></div>';
    html += '<div class="import-preview-stat"><div class="import-preview-stat-value">' + validation.readingCount + '</div><div class="import-preview-stat-label">Ablesungen</div></div>';
    html += '</div>';

    if (validation.exportDate) {
      html += '<div class="import-preview-date">' + Icons.calendar + ' Erstellt: ' + Data.formatDateTime(validation.exportDate) + '</div>';
    }

    html += '<div class="import-mode-section">';
    html += '<div class="import-mode-label">Import-Modus</div>';
    html += '<div class="import-mode-options">';

    html += '<button class="import-mode-option active" id="import-mode-merge" onclick="App.setImportMode(\'merge\')">';
    html += '<div class="import-mode-radio"><div class="import-mode-radio-inner"></div></div>';
    html += '<div class="import-mode-text">';
    html += '<div class="import-mode-title">Zusammenführen</div>';
    html += '<div class="import-mode-desc">Neue Daten werden zu bestehenden hinzugefügt.</div>';
    html += '</div></button>';

    html += '<button class="import-mode-option" id="import-mode-replace" onclick="App.setImportMode(\'replace\')">';
    html += '<div class="import-mode-radio"><div class="import-mode-radio-inner"></div></div>';
    html += '<div class="import-mode-text">';
    html += '<div class="import-mode-title">Ersetzen</div>';
    html += '<div class="import-mode-desc">Alle bestehenden Daten werden überschrieben.</div>';
    html += '</div></button>';

    html += '</div></div>';

    html += '<div class="import-warning" id="import-replace-warning" style="display:none">';
    html += Icons.warningIcon;
    html += '<span>Achtung: Beim Ersetzen gehen alle bestehenden Daten verloren!</span>';
    html += '</div>';

    html += '<div class="import-preview-actions">';
    html += '<button class="import-preview-btn import-preview-cancel" onclick="App.closeImportPreview()">Abbrechen</button>';
    html += '<button class="import-preview-btn import-preview-confirm" id="import-confirm-btn" onclick="App.executeImport()">Importieren</button>';
    html += '</div>';
    html += '</div></div>';

    var div = document.createElement('div');
    div.id = 'import-preview-container';
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  function setImportMode(mode) {
    importMode = mode;
    var mergeBtn = document.getElementById('import-mode-merge');
    var replaceBtn = document.getElementById('import-mode-replace');
    var warning = document.getElementById('import-replace-warning');
    var confirmBtn = document.getElementById('import-confirm-btn');

    if (mergeBtn) mergeBtn.classList.toggle('active', mode === 'merge');
    if (replaceBtn) replaceBtn.classList.toggle('active', mode === 'replace');
    if (warning) warning.style.display = mode === 'replace' ? 'flex' : 'none';

    if (confirmBtn) {
      if (mode === 'replace') {
        confirmBtn.className = 'import-preview-btn import-preview-confirm-danger';
        confirmBtn.textContent = 'Ersetzen & Importieren';
      } else {
        confirmBtn.className = 'import-preview-btn import-preview-confirm';
        confirmBtn.textContent = 'Importieren';
      }
    }
  }

  function closeImportPreview() {
    var container = document.getElementById('import-preview-container');
    if (container) container.remove();
    importData = null;
  }

  async function executeImport() {
    if (!importData) return;

    try {
      if (importMode === 'replace') {
        await Data.importReplace(importData);
        showToast('Daten ersetzt', 'success');
      } else {
        var result = await Data.importMerge(importData);
        var parts = [];
        if (result.newCategories > 0) parts.push(result.newCategories + ' Kategorien');
        if (result.newMeters > 0) parts.push(result.newMeters + ' Zähler');
        if (result.newReadings > 0) parts.push(result.newReadings + ' Ablesungen');
        if (parts.length > 0) {
          showToast(parts.join(', ') + ' importiert', 'success');
        } else {
          showToast('Keine neuen Daten gefunden', 'success');
        }
      }

      closeImportPreview();
      await refreshData();
      render();
    } catch (err) {
      console.error('Import error:', err);
      showToast('Import fehlgeschlagen', 'error');
    }
  }

  // ===== SETTINGS =====
  async function changeTheme(theme) {
    currentTheme = theme;
    applyTheme(theme);
    await Data.setTheme(theme);
    render();
  }

  async function changeReminderInterval(value) {
    var days = parseInt(value);
    if (!isNaN(days) && days > 0) {
      reminderInterval = days;
      await Data.setReminderInterval(days);
    }
  }

  async function confirmClearAllData() {
    var confirmed = await showDialog(
      'Alle Daten löschen?',
      'Alle Zähler, Ablesungen und Kategorien werden unwiderruflich gelöscht. Einstellungen bleiben erhalten. Diese Aktion kann nicht rückgängig gemacht werden!',
      'Alle Daten löschen'
    );
    if (confirmed) {
      await Data.clearAllData();
      await refreshData();
      expandedCategories = {};
      viewHistory = [];
      currentView = 'dashboard';
      showToast('Alle Daten gelöscht', 'success');
      render();
    }
  }

  // ===== REPORT =====
  function setReportPeriod(year, month) {
    reportYear = year;
    reportMonth = month;
    render();
  }

  // ===== COMPARISON =====
  function toggleComparisonMeter(meterId) {
    var idx = comparisonMeterIds.indexOf(meterId);
    if (idx !== -1) {
      comparisonMeterIds.splice(idx, 1);
    } else {
      if (comparisonMeterIds.length < 5) {
        comparisonMeterIds.push(meterId);
      }
    }
    render();
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    navigate: navigate,
    goBack: goBack,
    toggleCategory: toggleCategory,
    handleMeterSubmit: handleMeterSubmit,
    handleTypeChip: handleTypeChip,
    editMeter: editMeter,
    confirmDeleteMeter: confirmDeleteMeter,
    handleReadingSubmit: handleReadingSubmit,
    confirmDeleteReading: confirmDeleteReading,
    updateReadingUnit: updateReadingUnit,
    checkReadingPlausibility: checkReadingPlausibility,
    filterReadings: filterReadings,
    setReadingView: setReadingView,
    handleMeterSearch: handleMeterSearch,
    clearMeterSearch: clearMeterSearch,
    changeDashboardChart: changeDashboardChart,
    changeDetailChart: changeDetailChart,
    showCategoryForm: showCategoryForm,
    hideCategoryForm: hideCategoryForm,
    handleCategorySubmit: handleCategorySubmit,
    editCategory: editCategory,
    cancelEditCategory: cancelEditCategory,
    saveEditCategory: saveEditCategory,
    confirmDeleteCategory: confirmDeleteCategory,
    showCostSettings: showCostSettings,
    hideCostSettings: hideCostSettings,
    saveCostSettings: saveCostSettings,
    updateExportCount: updateExportCount,
    resetExportFilters: resetExportFilters,
    handleExport: handleExport,
    handleBackupExport: handleBackupExport,
    triggerBackupImport: triggerBackupImport,
    handleBackupFileSelect: handleBackupFileSelect,
    closeImportError: closeImportError,
    closeImportPreview: closeImportPreview,
    setImportMode: setImportMode,
    executeImport: executeImport,
    changeTheme: changeTheme,
    changeReminderInterval: changeReminderInterval,
    confirmClearAllData: confirmClearAllData,
    setReportPeriod: setReportPeriod,
    toggleComparisonMeter: toggleComparisonMeter
  };

})();
