/**
 * Background Animations for SocialChat
 * Provides visually captivating background effects while maintaining performance
 */

// Initialize when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    // Check if animations should be enabled
    if (shouldEnableAnimations()) {
      initBackgroundAnimations()
    }
  })
  
  /**
   * Determine if animations should be enabled based on user preferences and device capabilities
   */
  function shouldEnableAnimations() {
    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false
    }
  
    // Check if animations are explicitly disabled
    if (document.body.classList.contains("disable-animations")) {
      return false
    }
  
    // Check for low battery (if Battery API is available)
    if ("getBattery" in navigator) {
      navigator
        .getBattery()
        .then((battery) => {
          if (battery.level < 0.2 && !battery.charging) {
            document.body.classList.add("low-power-mode")
          }
        })
        .catch(() => {
          // Battery API failed, continue with animations
        })
    }
  
    return true
  }
  
  /**
   * Initialize all background animations
   */
  function initBackgroundAnimations() {
    console.log("Initializing background animations...")
  
    // Create main animation container if it doesn't exist
    createAnimationContainer()
  
    // Initialize different animation types
    initGradientAnimations()
    initParticleAnimations()
    initWaveAnimations()
    initFloatingElements()
    initSpotlightEffect()
  
    // Add page-specific classes
    addPageSpecificClasses()
  
    // Set up performance monitoring
    setupPerformanceMonitoring()
  }
  
  /**
   * Create the main animation container
   */
  function createAnimationContainer() {
    // Check if container already exists
    if (document.querySelector(".bg-animation-container")) {
      return
    }
  
    // Create main container
    const container = document.createElement("div")
    container.className = "bg-animation-container"
  
    // Add to body
    document.body.appendChild(container)
  
    return container
  }
  
  /**
   * Initialize gradient animations
   */
  function initGradientAnimations() {
    const container = document.querySelector(".bg-animation-container")
    if (!container) return
  
    // Create gradient background
    const gradientBg = document.createElement("div")
    gradientBg.className = "gradient-bg"
    container.appendChild(gradientBg)
  
    // Create gradient pulse
    const gradientPulse = document.createElement("div")
    gradientPulse.className = "gradient-pulse"
    container.appendChild(gradientPulse)
  
    // Create background pattern
    const bgPattern = document.createElement("div")
    bgPattern.className = "bg-pattern"
    container.appendChild(bgPattern)
  }
  
  /**
   * Initialize particle animations
   */
  function initParticleAnimations() {
    const container = document.querySelector(".bg-animation-container")
    if (!container) return
  
    // Create particles container
    const particlesContainer = document.createElement("div")
    particlesContainer.className = "particles-container"
    container.appendChild(particlesContainer)
  
    // Determine number of particles based on screen size
    const width = window.innerWidth
    const height = window.innerHeight
    const area = width * height
  
    // Adjust particle count based on device capability
    let particleCount = Math.min(Math.floor(area / 20000), 50)
  
    // Reduce particles for mobile devices
    if (width < 768) {
      particleCount = Math.min(particleCount, 15)
    }
  
    // Create particles
    for (let i = 0; i < particleCount; i++) {
      createParticle(particlesContainer)
    }
  }
  
  /**
   * Create a single animated particle
   */
  function createParticle(container) {
    const particle = document.createElement("div")
    particle.className = "particle"
  
    // Random size between 2px and 6px
    const size = 2 + Math.random() * 4
    particle.style.width = `${size}px`
    particle.style.height = `${size}px`
  
    // Random position
    const posX = Math.random() * 100
    const posY = Math.random() * 100
    particle.style.left = `${posX}%`
    particle.style.top = `${posY}%`
  
    // Random opacity
    particle.style.opacity = 0.1 + Math.random() * 0.4
  
    // Alternate colors
    if (Math.random() > 0.5) {
      particle.style.backgroundColor = "var(--particle-color-alt)"
    }
  
    // Add to container
    container.appendChild(particle)
  
    // Animate the particle
    animateParticle(particle)
  }
  
  /**
   * Animate a particle with random movement
   */
  function animateParticle(particle) {
    // Random duration between 15s and 30s
    const duration = 15000 + Math.random() * 15000
  
    // Random movement distance
    const moveX = -20 + Math.random() * 40
    const moveY = -20 + Math.random() * 40
  
    // Create animation
    const animation = particle.animate(
      [
        { transform: "translate(0, 0)", opacity: 0 },
        { transform: `translate(${moveX}vw, ${moveY}vh)`, opacity: 0.6, offset: 0.2 },
        { transform: `translate(${moveX * 2}vw, ${moveY * 1.5}vh)`, opacity: 0.4, offset: 0.6 },
        { transform: `translate(${moveX * 1.5}vw, ${moveY * 2}vh)`, opacity: 0 },
      ],
      {
        duration: duration,
        easing: "ease-in-out",
        iterations: Number.POSITIVE_INFINITY,
      },
    )
  
    // Pause animation if page is not visible
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        animation.pause()
      } else {
        animation.play()
      }
    })
  }
  
  /**
   * Initialize wave animations
   */
  function initWaveAnimations() {
    const container = document.querySelector(".bg-animation-container")
    if (!container) return
  
    // Create waves container
    const wavesContainer = document.createElement("div")
    wavesContainer.className = "waves-container"
    container.appendChild(wavesContainer)
  
    // Create waves
    for (let i = 1; i <= 3; i++) {
      const wave = document.createElement("div")
      wave.className = `wave wave-${i}`
      wavesContainer.appendChild(wave)
    }
  }
  
  /**
   * Initialize floating elements
   */
  function initFloatingElements() {
    const container = document.querySelector(".bg-animation-container")
    if (!container) return
  
    // Create floating elements container
    const floatingContainer = document.createElement("div")
    floatingContainer.className = "floating-elements-container"
    container.appendChild(floatingContainer)
  
    // Determine number of elements based on screen size
    const width = window.innerWidth
    const elementCount = width < 768 ? 5 : 10
  
    // Create floating elements
    const shapes = ["circle", "square", "triangle"]
    for (let i = 0; i < elementCount; i++) {
      const shape = shapes[Math.floor(Math.random() * shapes.length)]
      createFloatingElement(floatingContainer, shape)
    }
  }
  
  /**
   * Create a single floating element
   */
  function createFloatingElement(container, shape) {
    const element = document.createElement("div")
    element.className = `floating-element ${shape}`
  
    // Random size between 20px and 60px
    const size = 20 + Math.random() * 40
    element.style.width = `${size}px`
    element.style.height = `${size}px`
  
    // Random position
    const posX = Math.random() * 100
    const posY = Math.random() * 100
    element.style.left = `${posX}%`
    element.style.top = `${posY}%`
  
    // Random opacity
    element.style.opacity = 0.03 + Math.random() * 0.05
  
    // Add to container
    container.appendChild(element)
  
    // Animate the element
    animateFloatingElement(element)
  }
  
  /**
   * Animate a floating element
   */
  function animateFloatingElement(element) {
    // Random duration between 20s and 40s
    const duration = 20000 + Math.random() * 20000
  
    // Random movement distance
    const moveX = -10 + Math.random() * 20
    const moveY = -10 + Math.random() * 20
  
    // Random rotation
    const rotation = Math.random() > 0.5 ? 360 : -360
  
    // Create animation
    const animation = element.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)" },
        { transform: `translate(${moveX}vw, ${moveY}vh) rotate(${rotation}deg)` },
      ],
      {
        duration: duration,
        easing: "ease-in-out",
        iterations: Number.POSITIVE_INFINITY,
        direction: "alternate",
      },
    )
  
    // Pause animation if page is not visible
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        animation.pause()
      } else {
        animation.play()
      }
    })
  }
  
  /**
   * Initialize spotlight effect that follows cursor
   */
  function initSpotlightEffect() {
    const container = document.querySelector(".bg-animation-container")
    if (!container) return
  
    // Create spotlight container
    const spotlightContainer = document.createElement("div")
    spotlightContainer.className = "spotlight-container"
    container.appendChild(spotlightContainer)
  
    // Create spotlight
    const spotlight = document.createElement("div")
    spotlight.className = "spotlight"
    spotlightContainer.appendChild(spotlight)
  
    // Track mouse movement
    document.addEventListener("mousemove", (e) => {
      // Get mouse position as percentage of window
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
  
      // Update spotlight position
      spotlight.style.background = `radial-gradient(circle at ${x}% ${y}%, 
        rgba(79, 70, 229, 0.05) 0%, 
        rgba(0, 0, 0, 0) 60%)`
  
      // Fade in spotlight
      spotlight.style.opacity = "1"
  
      // Clear previous timeout
      if (spotlight.timeout) {
        clearTimeout(spotlight.timeout)
      }
  
      // Fade out spotlight after 2 seconds of no movement
      spotlight.timeout = setTimeout(() => {
        spotlight.style.opacity = "0"
      }, 2000)
    })
  
    // Handle touch events for mobile
    document.addEventListener("touchmove", (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0]
        const x = (touch.clientX / window.innerWidth) * 100
        const y = (touch.clientY / window.innerHeight) * 100
  
        spotlight.style.background = `radial-gradient(circle at ${x}% ${y}%, 
          rgba(79, 70, 229, 0.05) 0%, 
          rgba(0, 0, 0, 0) 60%)`
        spotlight.style.opacity = "1"
  
        if (spotlight.timeout) {
          clearTimeout(spotlight.timeout)
        }
  
        spotlight.timeout = setTimeout(() => {
          spotlight.style.opacity = "0"
        }, 2000)
      }
    })
  }
  
  /**
   * Add page-specific classes based on current URL
   */
  function addPageSpecificClasses() {
    const path = window.location.pathname
  
    // Remove any existing page classes
    document.body.classList.remove("home-page", "profile-page", "chat-page", "auth-page")
  
    // Add appropriate class based on URL
    if (path === "/" || path.includes("/home")) {
      document.body.classList.add("home-page")
    } else if (path.includes("/profile")) {
      document.body.classList.add("profile-page")
    } else if (path.includes("/chat")) {
      document.body.classList.add("chat-page")
    } else if (path.includes("/login") || path.includes("/signup")) {
      document.body.classList.add("auth-page")
    }
  }
  
  /**
   * Set up performance monitoring to adjust animations if needed
   */
  function setupPerformanceMonitoring() {
    // Skip if the Performance API is not available
    if (!window.performance || !window.performance.now) {
      return
    }
  
    let lastTime = 0
    let frames = 0
    let fps = 60 // Assume 60fps initially
  
    // Function to measure FPS
    function measureFPS(timestamp) {
      if (!lastTime) {
        lastTime = timestamp
      }
  
      frames++
  
      // Calculate FPS every second
      if (timestamp - lastTime >= 1000) {
        fps = frames
        frames = 0
        lastTime = timestamp
  
        // If FPS drops below threshold, reduce animations
        if (fps < 30) {
          reduceAnimations()
        }
      }
  
      requestAnimationFrame(measureFPS)
    }
  
    // Start measuring FPS
    requestAnimationFrame(measureFPS)
  }
  
  /**
   * Reduce animations to improve performance
   */
  function reduceAnimations() {
    console.log("Reducing animations for better performance")
  
    // Add low-power mode class
    document.body.classList.add("low-power-mode")
  
    // Remove particle animations
    const particlesContainer = document.querySelector(".particles-container")
    if (particlesContainer) {
      particlesContainer.remove()
    }
  
    // Reduce floating elements
    const floatingElements = document.querySelectorAll(".floating-element")
    for (let i = 0; i < floatingElements.length; i++) {
      if (i % 2 === 0) {
        floatingElements[i].remove()
      }
    }
  }
  
  /**
   * Utility function to check if an element is in viewport
   */
  function isInViewport(element) {
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }
  
  /**
   * Apply animations only to elements in viewport
   */
  function animateElementsInViewport() {
    const animatedElements = document.querySelectorAll(".floating-element, .particle")
  
    animatedElements.forEach((element) => {
      if (isInViewport(element)) {
        element.style.animationPlayState = "running"
      } else {
        element.style.animationPlayState = "paused"
      }
    })
  }
  
  // Initialize viewport-based animation optimization
  window.addEventListener("scroll", throttle(animateElementsInViewport, 200))
  window.addEventListener("resize", throttle(animateElementsInViewport, 200))
  
  /**
   * Throttle function to limit how often a function runs
   */
  function throttle(func, limit) {
    let inThrottle
    return function () {
      const args = arguments
      
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => (inThrottle = false), limit)
      }
    }
  }
  
  