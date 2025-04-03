/**
 * Background Animations Loader
 * Efficiently loads background animations with performance considerations
 */

// Load animations after page content is fully loaded
window.addEventListener("load", () => {
    // Check if animations should be enabled
    if (shouldLoadAnimations()) {
      loadBackgroundAnimations()
    }
  })
  
  /**
   * Determine if animations should be loaded based on user preferences and system capabilities
   */
  function shouldLoadAnimations() {
    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      console.log("Reduced motion preference detected, skipping animations")
      return false
    }
  
    // Check if animations are explicitly disabled via URL parameter
    if (new URLSearchParams(window.location.search).has("no-animations")) {
      console.log("Animations disabled via URL parameter")
      return false
    }
  
    // Check if animations are disabled in localStorage
    if (localStorage.getItem("disable-animations") === "true") {
      console.log("Animations disabled via user preference")
      return false
    }
  
    return true
  }
  
  /**
   * Load background animations CSS and JS
   */
  function loadBackgroundAnimations() {
    // Load CSS
    const cssLink = document.createElement("link")
    cssLink.rel = "stylesheet"
    cssLink.href = "/static/css/background-animations.css"
    document.head.appendChild(cssLink)
  
    // Load JS with a slight delay to prioritize core page functionality
    setTimeout(() => {
      const script = document.createElement("script")
      script.src = "/static/js/components/background-animations.js"
      script.async = true
      document.body.appendChild(script)
  
      // Log when animations are loaded
      script.onload = () => {
        console.log("Background animations loaded successfully")
      }
  
      // Handle loading errors
      script.onerror = () => {
        console.error("Failed to load background animations")
      }
    }, 300)
  }
  
  /**
   * Add animation toggle functionality
   */
  document.addEventListener("DOMContentLoaded", () => {
    // Create animation toggle button if it doesn't exist
    if (!document.getElementById("animation-toggle")) {
      createAnimationToggle()
    }
  })
  
  /**
   * Create animation toggle button in settings
   */
  function createAnimationToggle() {
    // Find settings container (if it exists)
    const settingsContainer = document.querySelector(".settings-container, .user-preferences, footer")
  
    if (settingsContainer) {
      const toggleContainer = document.createElement("div")
      toggleContainer.className = "animation-toggle-container mt-3"
      toggleContainer.innerHTML = `
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="animation-toggle" 
                 ${localStorage.getItem("disable-animations") === "true" ? "" : "checked"}>
          <label class="form-check-label" for="animation-toggle">
            Background Animations
          </label>
        </div>
      `
  
      settingsContainer.appendChild(toggleContainer)
  
      // Add event listener
      document.getElementById("animation-toggle").addEventListener("change", function () {
        if (this.checked) {
          localStorage.removeItem("disable-animations")
          document.body.classList.remove("disable-animations")
          loadBackgroundAnimations()
        } else {
          localStorage.setItem("disable-animations", "true")
          document.body.classList.add("disable-animations")
          // Remove animation container if it exists
          const container = document.querySelector(".bg-animation-container")
          if (container) {
            container.remove()
          }
        }
      })
    }
  }
  
  