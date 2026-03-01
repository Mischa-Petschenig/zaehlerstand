
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

  var mainViews = ['dashboard', 'meters', 'readings', 'settings'];

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
    // Update meta theme-color
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (theme === 'dark') {
        meta.setAttribute('content', '#242424');
      } else if (theme === 'light') {
        meta.setAttribute('content', '#1a73e8');
      } else {
        // auto - check preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          meta.setAttribute('content', '#242424');
        } else {
          meta.setAttribute('content', '#1a73e8');
        }
      }
    }
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
      if (['add-meter', 'edit-meter', 'meter-detail', 'manage-categories'].indexOf(currentView) !== -1) activeView =