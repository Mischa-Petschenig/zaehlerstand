
/**
 * Main App Controller
 */
var App = (function() {

  // State
  var meters = [];
  var readings = [];
  var categories = [];
  var costRates = {};
  var currentView = 'dashboard';
  var selectedMeterId = null;
  var editingMeter = null;
  var viewHistory = [];
  var expandedCategories = {};
  var meterSearchQuery = '';

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
    'manage-categories': 'Kategorien verwalten'
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
    render();
  }

  async function refreshData() {
    meters = await Data.getMeters();
    readings = await Data.getReadings();
    categories = await Data.getCategories();
    costRates = await Data.getCostRates();
  }

  // Navigation
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
    render();
  }

  function goBack() {
    if (viewHistory.length > 0) {
      var prev = viewHistory.pop();
      currentView = prev.view;
      if (prev.meterId) selectedMeterId = prev.meterId;
      render();
    } else {
      currentView = 'dashboard';
      render();
    }
  }

  function toggleCategory(catId) {
    expandedCategories[catId] = !expandedCategories[catId];
    render();
  }

  // Render
  function render() {
    var showBack = !mainViews.includes(currentView);
    backBtn.style.display = showBack ? 'flex' : 'none';
    titleEl.textContent = titles[currentView] || 'Zählerstand Manager';
    headerActions.innerHTML = '';

    document.querySelectorAll('.bottom-nav-item').forEach(function(btn) {
      var v = btn.getAttribute('data-view');
      var activeView = currentView;
      if (['add-meter', 'edit-meter', 'meter-detail', 'manage-categories'].indexOf(currentView) !== -1) activeView = 'meters';
      if (currentView === 'add-reading') activeView = 'readings';
      btn.classList.toggle('active', v === activeView);
    });

    var html = '';
    switch(currentView) {
      case 'dashboard':
        html = Views.dashboard(meters, readings, categories, expandedCategories, costRates);
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
        var meter = meters.find(function(m) { return m.id === selectedMeterId; });
        html = Views.meterDetail(meter, readings, costRates);
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
    }
    mainEl.innerHTML = html;
    mainEl.scrollTop = 0;

    if (currentView === 'manage-categories') {
      setupCategoryDragDrop();
    }

    // Restore search focus
    if (currentView === 'meters' && meterSearchQuery) {
      var searchEl = document.getElementById('meter-search');
      if (searchEl) {
        searchEl.focus();
        searchEl.setSelectionRange(meterSearchQuery.length, meterSearchQuery.length);
      }
    }
  }

  // Bottom Nav
  function setupBottomNav() {
    document.querySelectorAll('.bottom-nav-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var v = this.getAttribute('data-view');
        editingMeter = null;
        selectedMeterId = null;
        viewHistory = [];
        meterSearchQuery = '';
        currentView = v;
        render();
      });
    });
  }

  // ===== SEARCH =====
  var searchTimeout = null;

  function handleMeterSearch(value) {
    clearTimeout(searchTimeout);
    meterSearchQuery = value;
    var clearBtn = document.getElementById('meter-search-clear');
    if (clearBtn) {
      clearBtn.classList.toggle('visible', value.length > 0);
    }
    searchTimeout = setTimeout(function() {
      // Re-render meter list content only
      var listEl = mainEl.querySelector('.meter-list');
      if (listEl) {
        render();
      }
    }, 200);
  }

  function clearMeterSearch() {
    meterSearchQuery = '';
    render();
  }

  // ===== TOAST =====
  var toastTimeout = null;

  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (toastTimeout) clearTimeout(toastTimeout);

    var toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' toast-' + type : '');

    var iconHtml = '';
    if (type === 'success') {
      iconHtml = '<span class="toast-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';
    } else if (type === 'error') {
      iconHtml = '<span class="toast-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></span>';
    }

    toast.innerHTML = iconHtml + '<span>' + message + '</span>';
    document.getElementById('app').appendChild(toast);

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        toast.classList.add('toast-visible');
      });
    });

    toastTimeout = setTimeout(function() {
      toast.classList.remove('toast-visible');
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // ===== CHARTS =====
  function changeDashboardChart(meterId, period, btnEl) {
    var container = document.getElementById('dashboard-chart');
    if (!container) return;
    
    container.querySelectorAll('.chart-period-btn').forEach(function(b) { b.classList.remove('active'); });
    btnEl.classList.add('active');
    
    var canvas = document.getElementById('dashboard-chart-canvas');
    if (!canvas) return;
    
    var meter = meters.find(function(m) { return m.id === meterId; });
    if (!meter) return;
    
    var data = Charts.getConsumptionData(readings, meterId, period);
    canvas.innerHTML = Charts.renderBarChart(data, meter.unit, Icons.getChartColor(meter.type));
  }

  function changeDetailChart(meterId, period, btnEl) {
    var container = document.getElementById('detail-chart');
    if (!container) return;
    
    container.querySelectorAll('.chart-period-btn').forEach(function(b) { b.classList.remove('active'); });
    btnEl.classList.add('active');
    
    var canvas = document.getElementById('detail-chart-canvas');
    if (!canvas) return;
    
    var meter = meters.find(function(m) { return m.id === meterId; });
    if (!meter) return;
    
    var data = Charts.getConsumptionData(readings, meterId, period);
    canvas.innerHTML = Charts.renderBarChart(data, meter.unit, Icons.getChartColor(meter.type));
  }

  // ===== COST SETTINGS =====
  function showCostSettings() {
    var meterTypes = [];
    var seen = {};
    meters.forEach(function(m) {
      if (!seen[m.type]) {
        meterTypes.push(m.type);
        seen[m.type] = true;
      }
    });
    
    var html = Views.costSettingsSheet(costRates, meterTypes);
    var div = document.createElement('div');
    div.id = 'cost-settings-container';
    div.innerHTML = html;
    document.getElementById('app').appendChild(div.firstElementChild);
  }

  function hideCostSettings() {
    var overlay = document.getElementById('cost-form-overlay');
    if (overlay) overlay.remove();
  }

  async function saveCostSettings() {
    var meterTypes = [];
    var seen = {};
    meters.forEach(function(m) {
      if (!seen[m.type]) {
        meterTypes.push(m.type);
        seen[m.type] = true;
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

    await refreshData();
    hideCostSettings();
    render();
    showToast('Tarife gespeichert', 'success');
  }

  // ===== METER FORM =====
  function handleTypeChip(el) {
    var type = el.getAttribute('data-type');
    document.querySelectorAll('.type-chip').forEach(function(c) { c.classList.remove('type-chip-active'); });
    el.classList.add('type-chip-active');
    if (!editingMeter && Data.unitSuggestions[type]) {
      document.getElementById('mf-unit').value = Data.unitSuggestions[type];
    }
  }

  async function handleMeterSubmit(e) {
    e.preventDefault();
    var numberEl = document.getElementById('mf-number');
    var nameEl = document.getElementById('mf-name');
    var unitEl = document.getElementById('mf-unit');
    var categoryEl = document.getElementById('mf-category');
    var idEl = document.getElementById('mf-id');
    var activeChip = document.querySelector('.type-chip-active');
    var type = activeChip ? activeChip.getAttribute('data-type') : 'Strom';

    document.getElementById('mf-number-err').textContent = '';
    document.getElementById('mf-name-err').textContent = '';
    document.getElementById('mf-unit-err').textContent = '';
    numberEl.classList.remove('form-input-error');
    nameEl.classList.remove('form-input-error');
    unitEl.classList.remove('form-input-error');

    var valid = true;
    if (!numberEl.value.trim()) {
      document.getElementById('mf-number-err').textContent = 'Zählernummer ist erforderlich';
      numberEl.classList.add('form-input-error');
      valid = false;
    }
    if (!nameEl.value.trim()) {
      document.getElementById('mf-name-err').textContent = 'Zählername ist erforderlich';
      nameEl.classList.add('form-input-error');
      valid = false;
    }
    if (!unitEl.value.trim()) {
      document.getElementById('mf-unit-err').textContent = 'Einheit ist erforderlich';
      unitEl.classList.add('form-input-error');
      valid = false;
    }
    if (!valid) return;

    var categoryId = categoryEl ? categoryEl.value : '';

    var submitBtn = document.getElementById('mf-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Speichern...';

    try {
      if (idEl) {
        await Data.updateMeter({
          id: idEl.value,
          number: numberEl.value.trim(),
          name: nameEl.value.trim(),
          type: type,
          categoryId: categoryId || null,
          unit: unitEl.value.trim(),
          createdAt: editingMeter.createdAt
        });
        showToast('Zähler aktualisiert', 'success');
      } else {
        await Data.addMeter({
          id: Data.generateId(),
          number: numberEl.value.trim(),
          name: nameEl.value.trim(),
          type: type,
          categoryId: categoryId || null,
          unit: unitEl.value.trim(),
          createdAt: new Date().toISOString()
        });
        showToast('Zähler erstellt', 'success');
      }
      await refreshData();
      goBack();
    } catch(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = idEl ? 'Aktualisieren' : 'Erstellen';
      showToast('Fehler beim Speichern', 'error');
    }
  }

  function editMeter(id) {
    editingMeter = meters.find(function(m) { return m.id === id; });
    if (editingMeter) {
      navigate('edit-meter');
    }
  }

  // ===== READING FORM =====
  function updateReadingUnit() {
    var meterId = document.getElementById('rf-meter').value;
    var meter = meters.find(function(m) { return m.id === meterId; });
    var label = document.getElementById('rf-value-label');
    var hint = document.getElementById('rf-value-hint');
    
    if (meter) {
      label.textContent = 'Zählerstand (' + meter.unit + ') *';
      hint.textContent = 'Geben Sie den aktuellen Zählerstand in ' + meter.unit + ' ein';
    } else {
      label.textContent = 'Zählerstand *';
      hint.textContent = '';
    }

    // Update last reading hint
    var hintEl = document.getElementById('rf-last-reading');
    if (hintEl) hintEl.remove();
    
    if (meter) {
      var lastReading = readings.filter(function(r) { return r.meterId === meter.id; })
        .sort(function(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); })[0];
      
      if (lastReading) {
        var hintHtml = '<div class="last-reading-hint" id="rf-last-reading">';
        hintHtml += '<span class="last-reading-hint-icon">' + Icons.info + '</span>';
        hintHtml += '<span>Letzter Stand: <span class="last-reading-hint-value">' + Data.formatNumber(lastReading.value) + ' ' + meter.unit + '</span> am ' + Data.formatDate(lastReading.date) + '</span>';
        hintHtml += '</div>';
        
        var meterSelect = document.getElementById('rf-meter').closest('.form-group');
        meterSelect.insertAdjacentHTML('afterend', hintHtml);
      }
    }
  }

  async function handleReadingSubmit(e) {
    e.preventDefault();
    var meterEl = document.getElementById('rf-meter');
    var valueEl = document.getElementById('rf-value');
    var dateEl = document.getElementById('rf-date');
    var noteEl = document.getElementById('rf-note');

    document.getElementById('rf-meter-err').textContent = '';
    document.getElementById('rf-value-err').textContent = '';
    document.getElementById('rf-date-err').textContent = '';
    meterEl.classList.remove('form-input-error');
    valueEl.classList.remove('form-input-error');
    dateEl.classList.remove('form-input-error');

    var valid = true;
    if (!meterEl.value) {
      document.getElementById('rf-meter-err').textContent = 'Bitte Zähler auswählen';
      meterEl.classList.add('form-input-error');
      valid = false;
    }

    var valStr = valueEl.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    var val = parseFloat(valStr);
    if (!valueEl.value.trim()) {
      document.getElementById('rf-value-err').textContent = 'Zählerstand ist erforderlich';
      valueEl.classList.add('form-input-error');
      valid = false;
    } else if (isNaN(val)) {
      document.getElementById('rf-value-err').textContent = 'Ungültiger Wert';
      valueEl.classList.add('form-input-error');
      valid = false;
    } else if (val < 0) {
      document.getElementById('rf-value-err').textContent = 'Wert darf nicht negativ sein';
      valueEl.classList.add('form-input-error');
      valid = false;
    }

    if (!dateEl.value) {
      document.getElementById('rf-date-err').textContent = 'Datum ist erforderlich';
      dateEl.classList.add('form-input-error');
      valid = false;
    }

    if (!valid) return;

    var submitBtn = document.getElementById('rf-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Speichern...';

    try {
      await Data.addReading({
        id: Data.generateId(),
        meterId: meterEl.value,
        value: val,
        date: dateEl.value,
        note: (noteEl.value || '').trim(),
        createdAt: new Date().toISOString()
      });
      await refreshData();
      showToast('Ablesung gespeichert', 'success');
      goBack();
    } catch(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Speichern';
      showToast('Fehler beim Speichern', 'error');
    }
  }

  // ===== FILTER READINGS =====
  function filterReadings() {
    var filterEl = document.getElementById('reading-filter');
    var val = filterEl ? filterEl.value : 'all';
    var itemsEl = document.getElementById('reading-items');
    if (itemsEl) {
      itemsEl.innerHTML = Views.renderReadingItems(meters, readings, val);
    }
  }

  // ===== DELETE =====
  var pendingDeleteAction = null;

  function confirmDeleteMeter(id) {
    var meter = meters.find(function(m) { return m.id === id; });
    if (!meter) return;
    showDialog(
      'Zähler löschen?',
      'Der Zähler "' + meter.name + '" und alle zugehörigen Ablesungen werden unwiderruflich gelöscht.',
      'Löschen',
      async function() {
        await Data.deleteMeter(id);
        await refreshData();
        selectedMeterId = null;
        viewHistory = [];
        currentView = 'meters';
        render();
        showToast('Zähler gelöscht', 'success');
      }
    );
  }

  function confirmDeleteReading(id) {
    showDialog(
      'Ablesung löschen?',
      'Diese Ablesung wird unwiderruflich gelöscht.',
      'Löschen',
      async function() {
        await Data.deleteReading(id);
        await refreshData();
        render();
        showToast('Ablesung gelöscht', 'success');
      }
    );
  }

  function showDialog(title, message, confirmLabel, onConfirm) {
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-message').textContent = message;
    document.getElementById('dialog-confirm').textContent = confirmLabel;
    document.getElementById('dialog-overlay').style.display = 'flex';
    pendingDeleteAction = onConfirm;
  }

  function hideDialog() {
    document.getElementById('dialog-overlay').style.display = 'none';
    pendingDeleteAction = null;
  }

  function setupDialogOverlay() {
    document.getElementById('dialog-overlay').addEventListener('click', hideDialog);
    document.getElementById('dialog-cancel').addEventListener('click', hideDialog);
    document.getElementById('dialog-confirm').addEventListener('click', async function() {
      if (pendingDeleteAction) {
        await pendingDeleteAction();
      }
      hideDialog();
    });
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
    var nameEl = document.getElementById('cf-name');
    var errEl = document.getElementById('cf-name-err');
    errEl.textContent = '';
    nameEl.classList.remove('form-input-error');

    if (!nameEl.value.trim()) {
      errEl.textContent = 'Kategoriename ist erforderlich';
      nameEl.classList.add('form-input-error');
      return;
    }

    var name = nameEl.value.trim();
    var existing = categories.find(function(c) { return c.name.toLowerCase() === name.toLowerCase(); });
    if (existing) {
      errEl.textContent = 'Eine Kategorie mit diesem Namen existiert bereits';
      nameEl.classList.add('form-input-error');
      return;
    }

    await Data.addCategory({
      id: Data.generateId(),
      name: name,
      position: categories.length,
      createdAt: new Date().toISOString()
    });
    await refreshData();
    showToast('Kategorie "' + name + '" erstellt', 'success');
    render();
  }

  function editCategory(catId) {
    var editForm = document.getElementById('cat-edit-' + catId);
    if (editForm) {
      editForm.style.display = 'block';
      var input = document.getElementById('cat-edit-input-' + catId);
      if (input) input.focus();
    }
  }

  function cancelEditCategory(catId) {
    var editForm = document.getElementById('cat-edit-' + catId);
    if (editForm) editForm.style.display = 'none';
    var cat = categories.find(function(c) { return c.id === catId; });
    if (cat) {
      var input = document.getElementById('cat-edit-input-' + catId);
      if (input) input.value = cat.name;
    }
    var errEl = document.getElementById('cat-edit-err-' + catId);
    if (errEl) errEl.textContent = '';
  }

  async function saveEditCategory(catId) {
    var input = document.getElementById('cat-edit-input-' + catId);
    var errEl = document.getElementById('cat-edit-err-' + catId);
    if (!input) return;
    errEl.textContent = '';
    input.classList.remove('form-input-error');

    var name = input.value.trim();
    if (!name) {
      errEl.textContent = 'Kategoriename ist erforderlich';
      input.classList.add('form-input-error');
      return;
    }

    var existing = categories.find(function(c) { return c.id !== catId && c.name.toLowerCase() === name.toLowerCase(); });
    if (existing) {
      errEl.textContent = 'Eine Kategorie mit diesem Namen existiert bereits';
      input.classList.add('form-input-error');
      return;
    }

    var cat = categories.find(function(c) { return c.id === catId; });
    if (cat) {
      cat.name = name;
      await Data.updateCategory(cat);
      await refreshData();
      showToast('Kategorie umbenannt', 'success');
      render();
    }
  }

  function confirmDeleteCategory(catId) {
    var cat = categories.find(function(c) { return c.id === catId; });
    if (!cat) return;
    var catMeters = meters.filter(function(m) { return m.categoryId === catId; });
    var msg = 'Die Kategorie "' + cat.name + '" wird gelöscht.';
    if (catMeters.length > 0) {
      msg += ' ' + catMeters.length + ' Zähler werden nach "Sonstige" verschoben.';
    }
    showDialog(
      'Kategorie löschen?',
      msg,
      'Löschen',
      async function() {
        await Data.deleteCategory(catId);
        await refreshData();
        showToast('Kategorie gelöscht', 'success');
        render();
      }
    );
  }

  // ===== DRAG AND DROP FOR CATEGORIES =====
  var dragSrcEl = null;

  function setupCategoryDragDrop() {
    var list = document.getElementById('category-list');
    if (!list) return;

    var items = list.querySelectorAll('.category-item');
    items.forEach(function(item) {
      var handle = item.querySelector('.category-drag-handle');
      if (!handle) return;

      handle.addEventListener('touchstart', function(e) {
        e.preventDefault();
        dragSrcEl = item;
        item.classList.add('category-item-dragging');
        item.style.opacity = '0.6';
      }, { passive: false });

      item.addEventListener('dragstart', function(e) {
        dragSrcEl = item;
        item.classList.add('category-item-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.getAttribute('data-category-id'));
        setTimeout(function() { item.style.opacity = '0.4'; }, 0);
      });

      item.addEventListener('dragend', function() {
        item.style.opacity = '1';
        item.classList.remove('category-item-dragging');
        document.querySelectorAll('.category-item').forEach(function(el) {
          el.classList.remove('category-item-over');
        });
      });

      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (item !== dragSrcEl) item.classList.add('category-item-over');
      });

      item.addEventListener('dragleave', function() {
        item.classList.remove('category-item-over');
      });

      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('category-item-over');
        if (dragSrcEl && dragSrcEl !== item) {
          var allItems = Array.from(list.querySelectorAll('.category-item'));
          var fromIdx = allItems.indexOf(dragSrcEl);
          var toIdx = allItems.indexOf(item);
          if (fromIdx < toIdx) {
            item.parentNode.insertBefore(dragSrcEl, item.nextSibling);
          } else {
            item.parentNode.insertBefore(dragSrcEl, item);
          }
          saveCategoryOrder();
        }
      });
    });

    setupTouchDragDrop(list);
  }

  function setupTouchDragDrop(list) {
    var touchMoving = false;
    var touchClone = null;

    document.addEventListener('touchmove', function(e) {
      if (!dragSrcEl) return;
      e.preventDefault();
      touchMoving = true;

      var touch = e.touches[0];

      if (!touchClone) {
        touchClone = dragSrcEl.cloneNode(true);
        touchClone.className = 'category-item-touch-clone';
        touchClone.style.cssText = 'position:fixed;z-index:999;pointer-events:none;opacity:0.85;width:' + dragSrcEl.offsetWidth + 'px;box-shadow:0 8px 24px rgba(0,0,0,0.2);border-radius:12px;background:var(--surface);';
        document.body.appendChild(touchClone);
      }

      touchClone.style.left = touch.clientX - dragSrcEl.offsetWidth / 2 + 'px';
      touchClone.style.top = touch.clientY - 30 + 'px';

      if (touchClone) touchClone.style.display = 'none';
      var elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      if (touchClone) touchClone.style.display = '';

      var targetItem = elemBelow ? elemBelow.closest('.category-item') : null;
      document.querySelectorAll('.category-item').forEach(function(el) {
        el.classList.remove('category-item-over');
      });
      if (targetItem && targetItem !== dragSrcEl) {
        targetItem.classList.add('category-item-over');
      }
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
      if (!dragSrcEl) return;

      if (touchClone) {
        touchClone.remove();
        touchClone = null;
      }

      dragSrcEl.style.opacity = '1';
      dragSrcEl.classList.remove('category-item-dragging');

      if (touchMoving) {
        var elemBelow = document.elementFromPoint(
          e.changedTouches[0].clientX,
          e.changedTouches[0].clientY
        );
        var targetItem = elemBelow ? elemBelow.closest('.category-item') : null;

        if (targetItem && targetItem !== dragSrcEl && list.contains(targetItem)) {
          var allItems = Array.from(list.querySelectorAll('.category-item'));
          var fromIdx = allItems.indexOf(dragSrcEl);
          var toIdx = allItems.indexOf(targetItem);
          if (fromIdx < toIdx) {
            targetItem.parentNode.insertBefore(dragSrcEl, targetItem.nextSibling);
          } else {
            targetItem.parentNode.insertBefore(dragSrcEl, targetItem);
          }
          saveCategoryOrder();
        }
      }

      document.querySelectorAll('.category-item').forEach(function(el) {
        el.classList.remove('category-item-over');
      });

      dragSrcEl = null;
      touchMoving = false;
    });
  }

  async function saveCategoryOrder() {
    var list = document.getElementById('category-list');
    if (!list) return;
    var items = list.querySelectorAll('.category-item');
    var orderedIds = [];
    items.forEach(function(item) {
      orderedIds.push(item.getAttribute('data-category-id'));
    });
    await Data.reorderCategories(orderedIds);
    await refreshData();
    showToast('Reihenfolge gespeichert', 'success');
  }

  // ===== CSV EXPORT =====
  function getFilteredExportReadings() {
    var meterFilter = document.getElementById('export-meter');
    var typeFilter = document.getElementById('export-type');
    var fromEl = document.getElementById('export-from');
    var toEl = document.getElementById('export-to');

    var filtered = readings.slice();
    if (meterFilter && meterFilter.value !== 'all') {
      filtered = filtered.filter(function(r) { return r.meterId === meterFilter.value; });
    }
    if (typeFilter && typeFilter.value !== 'all') {
      var meterIds = meters.filter(function(m) { return m.type === typeFilter.value; }).map(function(m) { return m.id; });
      filtered = filtered.filter(function(r) { return meterIds.indexOf(r.meterId) !== -1; });
    }
    if (fromEl && fromEl.value) {
      filtered = filtered.filter(function(r) { return r.date >= fromEl.value; });
    }
    if (toEl && toEl.value) {
      filtered = filtered.filter(function(r) { return r.date <= toEl.value; });
    }
    return filtered;
  }

  function updateExportCount() {
    var filtered = getFilteredExportReadings();
    var countEl = document.getElementById('export-count');
    var btnEl = document.getElementById('export-btn');
    var resetEl = document.getElementById('export-reset');
    if (countEl) countEl.textContent = filtered.length + ' Ablesung' + (filtered.length !== 1 ? 'en' : '');
    if (btnEl) btnEl.disabled = filtered.length === 0;

    var meterFilter = document.getElementById('export-meter');
    var typeFilter = document.getElementById('export-type');
    var fromEl = document.getElementById('export-from');
    var toEl = document.getElementById('export-to');
    var hasFilter = (meterFilter && meterFilter.value !== 'all') ||
                    (typeFilter && typeFilter.value !== 'all') ||
                    (fromEl && fromEl.value) ||
                    (toEl && toEl.value);
    if (resetEl) resetEl.style.display = hasFilter ? 'inline' : 'none';
  }

  function resetExportFilters() {
    ['export-meter', 'export-type'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = 'all';
    });
    ['export-from', 'export-to'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    updateExportCount();
  }

  function handleExport() {
    var filtered = getFilteredExportReadings();
    if (filtered.length === 0) return;
    var csv = Data.generateCSV(meters, filtered, categories);
    var now = new Date();
    var ts = '' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    Data.downloadFile(csv, 'zaehlerstaende_' + ts + '.csv', 'text/csv;charset=utf-8');

    var btn = document.getElementById('export-btn');
    if (btn) {
      btn.classList.add('export-btn-success');
      btn.innerHTML = Icons.check + ' Exportiert!';
      setTimeout(function() {
        btn.classList.remove('export-btn-success');
        btn.innerHTML = Icons.download + ' Als CSV exportieren';
      }, 3000);
    }
    showToast('CSV exportiert', 'success');
  }

  // ===== JSON BACKUP =====
  function handleBackupExport() {
    var json = Data.generateBackupJSON(meters, readings, categories);
    var now = new Date();
    var ts = '' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    Data.downloadFile(json, 'zaehlerstand_backup_' + ts + '.json', 'application/json');

    var btn = document.getElementById('backup-export-btn');
    if (btn) {
      btn.classList.add('backup-btn-success');
      btn.innerHTML = Icons.check + ' Backup erstellt!';
      setTimeout(function() {
        btn.classList.remove('backup-btn-success');
        btn.innerHTML = Icons.download + ' Backup erstellen';
      }, 3000);
    }
    showToast('Backup erstellt', 'success');
  }

  function triggerBackupImport() {
    var input = document.getElementById('backup-file-input');
    if (input) { input.value = ''; input.click(); }
  }

  function handleBackupFileSelect(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      showImportError('Ungültiges Dateiformat', 'Bitte wählen Sie eine JSON-Datei (.json) aus.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showImportError('Datei zu groß', 'Die Datei darf maximal 10 MB groß sein.');
      return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
      var result = Data.validateBackup(e.target.result);
      if (!result.valid) {
        showImportError('Ungültige Backup-Datei', result.error);
        return;
      }
      showImportPreview(result);
    };
    reader.onerror = function() {
      showImportError('Lesefehler', 'Die Datei konnte nicht gelesen werden.');
    };
    reader.readAsText(file);
  }

  function showImportError(title, message) {
    var overlay = document.createElement('div');
    overlay.className = 'import-error-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) removeOverlay(overlay); };

    var html = '<div class="import-error">';
    html += '<div class="import-error-icon">' + Icons.errorIcon + '</div>';
    html += '<h3 class="import-error-title">' + Views.esc(title) + '</h3>';
    html += '<p class="import-error-message">' + Views.esc(message) + '</p>';
    html += '<button class="import-error-btn" id="import-error-close">Verstanden</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.getElementById('app').appendChild(overlay);
    document.getElementById('import-error-close').onclick = function() { removeOverlay(overlay); };
  }

  var importPreviewData = null;
  var importMode = 'merge';

  function showImportPreview(result) {
    importPreviewData = result.data;
    importMode = 'merge';

    var overlay = document.createElement('div');
    overlay.className = 'import-preview-overlay';
    overlay.id = 'import-preview-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) removeOverlay(overlay); };

    var html = '<div class="import-preview">';
    html += '<h3 class="import-preview-title">Backup wiederherstellen</h3>';
    html += '<p class="import-preview-subtitle">Folgende Daten wurden in der Backup-Datei gefunden:</p>';

    html += '<div class="import-preview-stats">';
    if (result.categoryCount > 0) {
      html += '<div class="import-preview-stat"><div class="import-preview-stat-value">' + result.categoryCount + '</div><div class="import-preview-stat-label">Kategorien</div></div>';
    }
    html += '<div class="import-preview-stat"><div class="import-preview-stat-value">' + result.meterCount + '</div><div class="import-preview-stat-label">Zähler</div></div>';
    html += '<div class="import-preview-stat"><div class="import-preview-stat-value">' + result.readingCount + '</div><div class="import-preview-stat-label">Ablesungen</div></div>';
    html += '</div>';

    if (result.exportDate) {
      html += '<div class="import-preview-date">' + Icons.calendar + '<span>Backup vom ' + Data.formatDateTime(result.exportDate) + '</span></div>';
    }

    html += '<div class="import-mode-section"><div class="import-mode-label">Import-Modus</div><div class="import-mode-options">';
    html += '<button class="import-mode-option active" id="import-mode-merge" onclick="App.setImportMode(\'merge\')"><div class="import-mode-radio"><div class="import-mode-radio-inner"></div></div><div class="import-mode-text"><div class="import-mode-title">Zusammenführen</div><p class="import-mode-desc">Fügt nur neue Daten hinzu, vorhandene bleiben erhalten.</p></div></button>';
    html += '<button class="import-mode-option" id="import-mode-replace" onclick="App.setImportMode(\'replace\')"><div class="import-mode-radio"><div class="import-mode-radio-inner"></div></div><div class="import-mode-text"><div class="import-mode-title">Ersetzen</div><p class="import-mode-desc">Löscht alle aktuellen Daten und ersetzt sie durch das Backup.</p></div></button>';
    html += '</div></div>';

    html += '<div class="import-warning" id="import-replace-warning" style="display:none;">' + Icons.warningIcon + '<span>Achtung: Alle aktuellen Daten (' + categories.length + ' Kategorien, ' + meters.length + ' Zähler, ' + readings.length + ' Ablesungen) werden unwiderruflich gelöscht!</span></div>';

    html += '<div class="import-preview-actions">';
    html += '<button class="import-preview-btn import-preview-cancel" id="import-preview-cancel">Abbrechen</button>';
    html += '<button class="import-preview-btn import-preview-confirm" id="import-preview-confirm">Importieren</button>';
    html += '</div></div>';

    overlay.innerHTML = html;
    document.getElementById('app').appendChild(overlay);

    document.getElementById('import-preview-cancel').onclick = function() { removeOverlay(overlay); };
    document.getElementById('import-preview-confirm').onclick = async function() {
      await executeImport();
      removeOverlay(overlay);
    };
  }

  function setImportMode(mode) {
    importMode = mode;
    var mergeBtn = document.getElementById('import-mode-merge');
    var replaceBtn = document.getElementById('import-mode-replace');
    var warning = document.getElementById('import-replace-warning');
    var confirmBtn = document.getElementById('import-preview-confirm');

    if (mergeBtn && replaceBtn) {
      mergeBtn.className = 'import-mode-option' + (mode === 'merge' ? ' active' : '');
      replaceBtn.className = 'import-mode-option' + (mode === 'replace' ? ' active' : '');
    }
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

  async function executeImport() {
    if (!importPreviewData) return;
    try {
      if (importMode === 'replace') {
        await Data.importReplace(importPreviewData);
        await refreshData();
        render();
        showToast('Backup wiederhergestellt!', 'success');
      } else {
        var result = await Data.importMerge(importPreviewData);
        await refreshData();
        render();
        var msg = '';
        if (result.newMeters === 0 && result.newReadings === 0 && result.newCategories === 0) {
          msg = 'Alle Daten waren bereits vorhanden.';
        } else {
          var parts = [];
          if (result.newCategories > 0) parts.push(result.newCategories + ' Kategorie' + (result.newCategories !== 1 ? 'n' : ''));
          if (result.newMeters > 0) parts.push(result.newMeters + ' Zähler');
          if (result.newReadings > 0) parts.push(result.newReadings + ' Ablesung' + (result.newReadings !== 1 ? 'en' : ''));
          msg = parts.join(', ') + ' importiert!';
        }
        showToast(msg, 'success');
      }
    } catch(err) {
      showToast('Fehler: ' + err.message, 'error');
    }
    importPreviewData = null;
  }

  function removeOverlay(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  // ===== INSTALL PROMPT =====
  var deferredPrompt = null;

  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredPrompt = e;
      document.getElementById('install-banner').style.display = 'block';
    });

    window.addEventListener('appinstalled', function() {
      document.getElementById('install-banner').style.display = 'none';
    });

    if (window.matchMedia('(display-mode: standalone)').matches) return;

    document.getElementById('install-dismiss').addEventListener('click', function() {
      document.getElementById('install-banner').style.display = 'none';
    });

    document.getElementById('install-accept').addEventListener('click', async function() {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      var choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        document.getElementById('install-banner').style.display = 'none';
      }
      deferredPrompt = null;
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    navigate: navigate,
    goBack: goBack,
    toggleCategory: toggleCategory,
    handleTypeChip: handleTypeChip,
    handleMeterSubmit: handleMeterSubmit,
    editMeter: editMeter,
    handleReadingSubmit: handleReadingSubmit,
    updateReadingUnit: updateReadingUnit,
    filterReadings: filterReadings,
    confirmDeleteMeter: confirmDeleteMeter,
    confirmDeleteReading: confirmDeleteReading,
    updateExportCount: updateExportCount,
    resetExportFilters: resetExportFilters,
    handleExport: handleExport,
    handleBackupExport: handleBackupExport,
    triggerBackupImport: triggerBackupImport,
    handleBackupFileSelect: handleBackupFileSelect,
    setImportMode: setImportMode,
    showCategoryForm: showCategoryForm,
    hideCategoryForm: hideCategoryForm,
    handleCategorySubmit: handleCategorySubmit,
    editCategory: editCategory,
    cancelEditCategory: cancelEditCategory,
    saveEditCategory: saveEditCategory,
    confirmDeleteCategory: confirmDeleteCategory,
    handleMeterSearch: handleMeterSearch,
    clearMeterSearch: clearMeterSearch,
    changeDashboardChart: changeDashboardChart,
    changeDetailChart: changeDetailChart,
    showCostSettings: showCostSettings,
    hideCostSettings: hideCostSettings,
    saveCostSettings: saveCostSettings
  };
})();
