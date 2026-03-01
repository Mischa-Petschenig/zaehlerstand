
/**
 * Main App Controller
 */
var App = (function() {

  // State
  var meters = [];
  var readings = [];
  var categories = [];
  var currentView = 'dashboard';
  var selectedMeterId = null;
  var editingMeter = null;
  var viewHistory = [];
  var expandedCategories = {}; // { categoryId: true/false }

  // DOM refs
  var mainEl, titleEl, backBtn;

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
  }

  // Navigation
  function navigate(view, meterId) {
    if (meterId) selectedMeterId = meterId;

    // When navigating to meter-detail, expand that meter's category
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

  // Category expand/collapse
  function toggleCategory(catId) {
    expandedCategories[catId] = !expandedCategories[catId];
    render();
  }

  // Render
  function render() {
    var showBack = !mainViews.includes(currentView);
    backBtn.style.display = showBack ? 'flex' : 'none';
    titleEl.textContent = titles[currentView] || 'Zählerstand Manager';

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
        html = Views.dashboard(meters, readings, categories, expandedCategories);
        break;
      case 'meters':
        html = Views.meterList(meters, readings, categories, expandedCategories);
        break;
      case 'add-meter':
        html = Views.meterForm(null, categories);
        break;
      case 'edit-meter':
        html = Views.meterForm(editingMeter, categories);
        break;
      case 'meter-detail':
        var meter = meters.find(function(m) { return m.id === selectedMeterId; });
        html = Views.meterDetail(meter, readings);
        break;
      case 'readings':
        html = Views.readingList(meters, readings);
        break;
      case 'add-reading':
        html = Views.readingForm(meters, selectedMeterId);
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

    // Setup drag and drop for categories
    if (currentView === 'manage-categories') {
      setupCategoryDragDrop();
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
        currentView = v;
        render();
      });
    });
  }

  // ===== TOAST =====
  var toastTimeout = null;

  function showToast(message, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (toastTimeout) clearTimeout(toastTimeout);

    var toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    toast.textContent = message;
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
      }
      await refreshData();
      goBack();
    } catch(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = idEl ? 'Aktualisieren' : 'Erstellen';
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
      goBack();
    } catch(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Speichern';
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
    if (container) {
      container.style.display = 'none';
    }
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

    // Check for duplicates
    var name = nameEl.value.trim();
    var existing = categories.find(function(c) { return c.name.toLowerCase() === name.toLowerCase(); });
    if (existing) {
      errEl.textContent = 'Eine Kategorie mit diesem Namen existiert bereits';
      nameEl.classList.add('form-input-error');
      return;
    }

    var newCat = {
      id: Data.generateId(),
      name: name,
      position: categories.length,
      createdAt: new Date().toISOString()
    };

    await Data.addCategory(newCat);
    await refreshData();
    showToast('Kategorie "' + name + '" erstellt', 'success');
    render();
  }

  function editCategory(catId) {
    // Hide the normal display, show the edit form
    var editForm = document.getElementById('cat-edit-' + catId);
    var nameDisplay = document.getElementById('cat-name-' + catId);
    if (editForm) {
      editForm.style.display = 'block';
      var input = document.getElementById('cat-edit-input-' + catId);
      if (input) input.focus();
    }
  }

  function cancelEditCategory(catId) {
    var editForm = document.getElementById('cat-edit-' + catId);
    if (editForm) {
      editForm.style.display = 'none';
    }
    // Reset input value
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

    // Check for duplicates (exclude self)
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
      // Touch events for mobile drag & drop
      var handle = item.querySelector('.category-drag-handle');
      if (!handle) return;

      // Prevent default touch behavior on handle
      handle.addEventListener('touchstart', function(e) {
        e.preventDefault();
        dragSrcEl = item;
        item.classList.add('category-item-dragging');
        item.style.opacity = '0.6';
      }, { passive: false });

      // Desktop drag events
      item.addEventListener('dragstart', function(e) {
        dragSrcEl = item;
        item.classList.add('category-item-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.getAttribute('data-category-id'));
        setTimeout(function() {
          item.style.opacity = '0.4';
        }, 0);
      });

      item.addEventListener('dragend', function(e) {
        item.style.opacity = '1';
        item.classList.remove('category-item-dragging');
        document.querySelectorAll('.category-item').forEach(function(el) {
          el.classList.remove('category-item-over');
        });
      });

      item.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (item !== dragSrcEl) {
          item.classList.add('category-item-over');
        }
      });

      item.addEventListener('dragleave', function(e) {
        item.classList.remove('category-item-over');
      });

      item.addEventListener('drop', function(e) {
        e.preventDefault();
        item.classList.remove('category-item-over');
        if (dragSrcEl && dragSrcEl !== item) {
          // Reorder in DOM
          var allItems = Array.from(list.querySelectorAll('.category-item'));
          var fromIdx = allItems.indexOf(dragSrcEl);
          var toIdx = allItems.indexOf(item);

          if (fromIdx < toIdx) {
            item.parentNode.insertBefore(dragSrcEl, item.nextSibling);
          } else {
            item.parentNode.insertBefore(dragSrcEl, item);
          }

          // Save new order
          saveCategoryOrder();
        }
      });
    });

    // Touch move / end on document for mobile
    setupTouchDragDrop(list);
  }

  function setupTouchDragDrop(list) {
    var touchMoving = false;
    var touchClone = null;
    var lastTouchY = 0;

    document.addEventListener('touchmove', function(e) {
      if (!dragSrcEl) return;
      e.preventDefault();
      touchMoving = true;

      var touch = e.touches[0];
      lastTouchY = touch.clientY;

      // Create visual feedback clone
      if (!touchClone) {
        touchClone = dragSrcEl.cloneNode(true);
        touchClone.className = 'category-item-touch-clone';
        touchClone.style.cssText = 'position:fixed;z-index:999;pointer-events:none;opacity:0.85;width:' + dragSrcEl.offsetWidth + 'px;box-shadow:0 8px 24px rgba(0,0,0,0.2);border-radius:12px;background:white;';
        document.body.appendChild(touchClone);
      }

      touchClone.style.left = touch.clientX - dragSrcEl.offsetWidth / 2 + 'px';
      touchClone.style.top = touch.clientY - 30 + 'px';

      // Find element under touch
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

      // Clean up clone
      if (touchClone) {
        touchClone.remove();
        touchClone = null;
      }

      dragSrcEl.style.opacity = '1';
      dragSrcEl.classList.remove('category-item-dragging');

      if (touchMoving) {
        // Find target
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
    if (countEl) {
      countEl.textContent = filtered.length + ' Ablesung' + (filtered.length !== 1 ? 'en' : '');
    }
    if (btnEl) {
      btnEl.disabled = filtered.length === 0;
    }

    var meterFilter = document.getElementById('export-meter');
    var typeFilter = document.getElementById('export-type');
    var fromEl = document.getElementById('export-from');
    var toEl = document.getElementById('export-to');
    var hasFilter = (meterFilter && meterFilter.value !== 'all') ||
                    (typeFilter && typeFilter.value !== 'all') ||
                    (fromEl && fromEl.value) ||
                    (toEl && toEl.value);
    if (resetEl) {
      resetEl.style.display = hasFilter ? 'inline' : 'none';
    }
  }

  function resetExportFilters() {
    var els = ['export-meter', 'export-type'];
    els.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = 'all';
    });
    var dateEls = ['export-from', 'export-to'];
    dateEls.forEach(function(id) {
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
  }

  // ===== JSON BACKUP EXPORT =====
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

    showToast('Backup erfolgreich erstellt!', 'success');
  }

  // ===== JSON BACKUP IMPORT =====
  function triggerBackupImport() {
    var input = document.getElementById('backup-file-input');
    if (input) {
      input.value = '';
      input.click();
    }
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
      var content = e.target.result;
      var result = Data.validateBackup(content);

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
    overlay.onclick = function(e) {
      if (e.target === overlay) removeOverlay(overlay);
    };

    var html = '<div class="import-error">';
    html += '<div class="import-error-icon">' + Icons.errorIcon + '</div>';
    html += '<h3 class="import-error-title">' + Views.esc(title) + '</h3>';
    html += '<p class="import-error-message">' + Views.esc(message) + '</p>';
    html += '<button class="import-error-btn" id="import-error-close">Verstanden</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.getElementById('app').appendChild(overlay);

    document.getElementById('import-error-close').onclick = function() {
      removeOverlay(overlay);
    };
  }

  var importPreviewData = null;
  var importMode = 'merge';

  function showImportPreview(result) {
    importPreviewData = result.data;
    importMode = 'merge';

    var overlay = document.createElement('div');
    overlay.className = 'import-preview-overlay';
    overlay.id = 'import-preview-overlay';
    overlay.onclick = function(e) {
      if (e.target === overlay) removeOverlay(overlay);
    };

    var html = '<div class="import-preview">';
    html += '<h3 class="import-preview-title">Backup wiederherstellen</h3>';
    html += '<p class="import-preview-subtitle">Folgende Daten wurden in der Backup-Datei gefunden:</p>';

    // Stats
    html += '<div class="import-preview-stats">';
    if (result.categoryCount > 0) {
      html += '<div class="import-preview-stat">';
      html += '<div class="import-preview-stat-value">' + result.categoryCount + '</div>';
      html += '<div class="import-preview-stat-label">Kategorien</div>';
      html += '</div>';
    }
    html += '<div class="import-preview-stat">';
    html += '<div class="import-preview-stat-value">' + result.meterCount + '</div>';
    html += '<div class="import-preview-stat-label">Zähler</div>';
    html += '</div>';
    html += '<div class="import-preview-stat">';
    html += '<div class="import-preview-stat-value">' + result.readingCount + '</div>';
    html += '<div class="import-preview-stat-label">Ablesungen</div>';
    html += '</div>';
    html += '</div>';

    if (result.exportDate) {
      html += '<div class="import-preview-date">';
      html += Icons.calendar;
      html += '<span>Backup vom ' + Data.formatDateTime(result.exportDate) + '</span>';
      html += '</div>';
    }

    // Mode selection
    html += '<div class="import-mode-section">';
    html += '<div class="import-mode-label">Import-Modus</div>';
    html += '<div class="import-mode-options">';

    html += '<button class="import-mode-option active" id="import-mode-merge" onclick="App.setImportMode(\'merge\')">';
    html += '<div class="import-mode-radio"><div class="import-mode-radio-inner"></div></div>';
    html += '<div class="import-mode-text">';
    html += '<div class="import-mode-title">Zusammenführen</div>';
    html += '<p class="import-mode-desc">Fügt nur neue Daten hinzu, vorhandene bleiben erhalten.</p>';
    html += '</div></button>';

    html += '<button class="import-mode-option" id="import-mode-replace" onclick="App.setImportMode(\'replace\')">';
    html += '<div class="import-mode-radio"><div class="import-mode-radio-inner"></div></div>';
    html += '<div class="import-mode-text">';
    html += '<div class="import-mode-title">Ersetzen</div>';
    html += '<p class="import-mode-desc">Löscht alle aktuellen Daten und ersetzt sie durch das Backup.</p>';
    html += '</div></button>';

    html += '</div></div>';

    html += '<div class="import-warning" id="import-replace-warning" style="display:none;">';
    html += Icons.warningIcon;
    html += '<span>Achtung: Alle aktuellen Daten (' + categories.length + ' Kategorien, ' + meters.length + ' Zähler, ' + readings.length + ' Ablesungen) werden unwiderruflich gelöscht!</span>';
    html += '</div>';

    html += '<div class="import-preview-actions">';
    html += '<button class="import-preview-btn import-preview-cancel" id="import-preview-cancel">Abbrechen</button>';
    html += '<button class="import-preview-btn import-preview-confirm" id="import-preview-confirm">Importieren</button>';
    html += '</div>';

    html += '</div>';

    overlay.innerHTML = html;
    document.getElementById('app').appendChild(overlay);

    document.getElementById('import-preview-cancel').onclick = function() {
      removeOverlay(overlay);
    };

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

    if (warning) {
      warning.style.display = mode === 'replace' ? 'flex' : 'none';
    }

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
        showToast('Backup erfolgreich wiederhergestellt!', 'success');
      } else {
        var result = await Data.importMerge(importPreviewData);
        await refreshData();
        render();
        var msg = '';
        if (result.newMeters === 0 && result.newReadings === 0 && result.newCategories === 0) {
          msg = 'Alle Daten waren bereits vorhanden.';
        } else {
          var parts = [];
          if (result.newCategories > 0) parts.push(result.newCategories + ' neue Kategorie' + (result.newCategories !== 1 ? 'n' : ''));
          if (result.newMeters > 0) parts.push(result.newMeters + ' neue' + (result.newMeters === 1 ? 'r' : '') + ' Zähler');
          if (result.newReadings > 0) parts.push(result.newReadings + ' neue Ablesung' + (result.newReadings !== 1 ? 'en' : ''));
          msg = parts.join(', ') + ' importiert!';
        }
        showToast(msg, 'success');
      }
    } catch(err) {
      showToast('Fehler beim Import: ' + err.message, 'error');
    }

    importPreviewData = null;
  }

  function removeOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
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

    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

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

  // Start the app
  document.addEventListener('DOMContentLoaded', init);

  // Public API
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
    confirmDeleteCategory: confirmDeleteCategory
  };
})();
