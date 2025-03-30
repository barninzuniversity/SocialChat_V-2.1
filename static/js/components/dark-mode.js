// Dark Mode Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
  // Check if there's already a theme toggle in the page
  const existingToggle = document.getElementById('theme-toggle');
  
  if (existingToggle) {
    // If toggle exists, just make sure it works correctly
    const darkIcon = document.getElementById('dark-icon');
    const lightIcon = document.getElementById('light-icon');
    
    // Check for saved theme preference or default to light
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    // Apply the saved theme on page load
    if (currentTheme === 'dark') {
      document.body.classList.add('dark');
      if (darkIcon) darkIcon.classList.add('d-none');
      if (lightIcon) lightIcon.classList.remove('d-none');
    } else {
      document.body.classList.remove('dark');
      if (darkIcon) darkIcon.classList.remove('d-none');
      if (lightIcon) lightIcon.classList.add('d-none');
    }
    
    // Make sure the click event works
    existingToggle.addEventListener('click', function() {
      if (document.body.classList.contains('dark')) {
        // Switch to light mode
        document.body.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if (darkIcon) darkIcon.classList.remove('d-none');
        if (lightIcon) lightIcon.classList.add('d-none');
        // Send to server
        savePreferenceToServer(false);
      } else {
        // Switch to dark mode
        document.body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if (darkIcon) darkIcon.classList.add('d-none');
        if (lightIcon) lightIcon.classList.remove('d-none');
        // Send to server
        savePreferenceToServer(true);
      }
    });
  } else {
    // No existing toggle, so add one to the navbar
    const addDarkModeToggle = function() {
      const navbarNav = document.querySelector('.navbar-nav');
      
      if (navbarNav) {
        // Create the toggle button
        const darkModeItem = document.createElement('li');
        darkModeItem.className = 'nav-item ms-2 d-flex align-items-center';
        
        // Get current mode preference from local storage or body class
        const isDarkMode = document.body.classList.contains('dark');
        
        darkModeItem.innerHTML = `
          <button id="dark-mode-toggle" class="btn btn-sm rounded-circle ${isDarkMode ? 'btn-light' : 'btn-dark'}" 
                  style="width: 36px; height: 36px;">
            <i class="fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}"></i>
          </button>
        `;
        
        navbarNav.appendChild(darkModeItem);
        
        // Add toggle functionality
        const toggleButton = document.getElementById('dark-mode-toggle');
        toggleButton.addEventListener('click', toggleDarkMode);
      }
    };
    
    // Toggle between light and dark mode
    const toggleDarkMode = function() {
      const isDarkMode = document.body.classList.contains('dark');
      const toggleButton = document.getElementById('dark-mode-toggle');
      
      // Toggle body class
      document.body.classList.toggle('dark');
      
      // Update button appearance
      if (isDarkMode) {
        toggleButton.classList.remove('btn-light');
        toggleButton.classList.add('btn-dark');
        toggleButton.querySelector('i').classList.remove('fa-sun');
        toggleButton.querySelector('i').classList.add('fa-moon');
      } else {
        toggleButton.classList.remove('btn-dark');
        toggleButton.classList.add('btn-light');
        toggleButton.querySelector('i').classList.remove('fa-moon');
        toggleButton.querySelector('i').classList.add('fa-sun');
      }
      
      // Save preference to local storage for persistence across sessions
      localStorage.setItem('theme', isDarkMode ? 'light' : 'dark');
      
      // Send preference to server
      savePreferenceToServer(!isDarkMode);
    };
    
    // Run initialization and add toggle
    initDarkMode();
    addDarkModeToggle();
  }
  
  // Save dark mode preference to server
  function savePreferenceToServer(isDarkMode) {
    // Create a form to send the preference
    const form = document.createElement('form');
    form.method = 'POST';
    form.style.display = 'none';
    
    // Get CSRF token
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    
    if (!csrfToken) {
      // If no CSRF token found, just save to local storage
      console.warn('CSRF token not found, dark mode preference will not be saved to server');
      return;
    }
    
    // Create CSRF input
    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = 'csrfmiddlewaretoken';
    csrfInput.value = csrfToken;
    
    // Create dark mode preference input
    const preferenceInput = document.createElement('input');
    preferenceInput.type = 'hidden';
    preferenceInput.name = 'dark_mode';
    preferenceInput.value = isDarkMode ? 'on' : 'off';
    
    // Add inputs to form
    form.appendChild(csrfInput);
    form.appendChild(preferenceInput);
    
    // Add form to document
    document.body.appendChild(form);
    
    // Submit form
    form.action = '/set_dark_mode/';
    form.submit();
  }
  
  // Initialize dark mode based on stored preference
  function initDarkMode() {
    // Check local storage first (for persistence across sessions)
    const storedPreference = localStorage.getItem('theme');
    
    if (storedPreference) {
      // We have a stored preference
      const isDarkMode = storedPreference === 'dark';
      
      if (isDarkMode && !document.body.classList.contains('dark')) {
        document.body.classList.add('dark');
      } else if (!isDarkMode && document.body.classList.contains('dark')) {
        document.body.classList.remove('dark');
      }
    }
  }
});
