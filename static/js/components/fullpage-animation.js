/**
 * Full Page Background Animations
 * Creates animated backgrounds that cover the entire page
 */

document.addEventListener("DOMContentLoaded", () => {
    // Initialize after a short delay to ensure DOM is fully loaded
    setTimeout(() => {
      const animator = new FullPageAnimator()
      animator.initialize()
    }, 50)
  })
  
  class FullPageAnimator {
    constructor() {
      // Animation configuration for different page types
      this.pageConfigs = {
        "home-page": {
          animations: ["gradient-bg", "particles", "floating-elements"],
          intensity: "medium",
        },
        "profile-page": {
          animations: ["gradient-bg", "spotlight"],
          intensity: "light",
        },
        "chat-page": {
          animations: ["gradient-pulse", "waves"],
          intensity: "light",
        },
        "auth-page": {
          animations: ["gradient-bg", "particles"],
          intensity: "medium",
        },
        default: {
          animations: ["gradient-bg"],
          intensity: "light",
        },
      }
  
      // Get current page type
      this.pageType = this.getPageType()
  
      // Check if animations should be disabled
      this.animationsDisabled = this.shouldDisableAnimations()
  
      // Check for low performance mode
      this.lowPerformanceMode = this.detectLowPerformance()
    }
  
    initialize() {
      if (this.animationsDisabled) {
        console.log("Animations disabled due to user preferences or device capabilities")
        return
      }
  
      console.log(`Initializing full page animations for page type: ${this.pageType}`)
  
      // Create main animation container
      this.createAnimationContainer()
  
      // Apply animations based on page type
      this.applyAnimations()
  
      // Add resize handler to adjust animations on window resize
      window.addEventListener("resize", this.handleResize.bind(this))
  
      // Add visibility change handler to pause animations when tab is not visible
      document.addEventListener("visibilitychange", this.handleVisibilityChange.bind(this))
    }
  
    getPageType() {
      const bodyClasses = document.body.classList
  
      if (bodyClasses.contains("home-page")) return "home-page"
      if (bodyClasses.contains("profile-page")) return "profile-page"
      if (bodyClasses.contains("chat-page")) return "chat-page"
      if (bodyClasses.contains("auth-page")) return "auth-page"
  
      // Try to determine page type from URL if not in body class
      const path = window.location.pathname
      if (path === "/" || path.includes("/home")) return "home-page"
      if (path.includes("/profile")) return "profile-page"
      if (path.includes("/chat") || path.includes("/messages")) return "chat-page"
      if (path.includes("/login") || path.includes("/signup") || path.includes("/register")) return "auth-page"
  
      return "default"
    }
  
    shouldDisableAnimations() {
      // Check for reduced motion preference
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return true
      }
  
      // Check if animations are explicitly disabled
      if (document.body.classList.contains("disable-animations")) {
        return true
      }
  
      // Check for saved preference in localStorage
      if (localStorage.getItem("disable-animations") === "true") {
        return true
      }
  
      // Check for URL parameter
      if (new URLSearchParams(window.location.search).has("no-animations")) {
        return true
      }
  
      return false
    }
  
    detectLowPerformance() {
      // Check for low-end devices
      const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4
      const slowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4
  
      // Check for battery status if available
      let lowBattery = false
      if ("getBattery" in navigator) {
        navigator
          .getBattery()
          .then((battery) => {
            if (battery.level < 0.2 && !battery.charging) {
              document.body.classList.add("low-power-mode")
              lowBattery = true
            }
          })
          .catch(() => {
            // Battery API failed, continue
          })
      }
  
      // Check for slow connection
      const slowConnection =
        navigator.connection && (navigator.connection.saveData || navigator.connection.effectiveType.includes("2g"))
  
      // Check for mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
      // Enable low performance mode if any conditions are met
      if (lowMemory || slowCPU || lowBattery || slowConnection || (isMobile && window.innerWidth < 768)) {
        document.body.classList.add("low-power-mode")
        return true
      }
  
      return false
    }
  
    createAnimationContainer() {
      // Remove any existing animation container
      const existingContainer = document.getElementById("fullpage-animation-container")
      if (existingContainer) {
        existingContainer.remove()
      }
  
      // Create new container
      const container = document.createElement("div")
      container.id = "fullpage-animation-container"
      container.className = "fullpage-animation-container"
  
      // Set styles for full page coverage
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1000;
        overflow: hidden;
        pointer-events: none;
      `
  
      // Add to body as the first child to ensure it's behind everything
      document.body.insertBefore(container, document.body.firstChild)
  
      this.container = container
    }
  
    applyAnimations() {
      // Get config for current page type
      const config = this.pageConfigs[this.pageType] || this.pageConfigs["default"]
  
      // Apply each animation based on config
      config.animations.forEach((animationType) => {
        // Skip some animations in low performance mode
        if (this.lowPerformanceMode && ["particles", "floating-elements"].includes(animationType)) {
          return
        }
  
        // Create and add animation element
        const animationElement = this.createAnimationElement(animationType, config.intensity)
        if (animationElement) {
          this.container.appendChild(animationElement)
        }
      })
    }
  
    createAnimationElement(type, intensity) {
      switch (type) {
        case "gradient-bg":
          return this.createGradientBackground(intensity)
        case "gradient-pulse":
          return this.createGradientPulse(intensity)
        case "particles":
          return this.createParticles(intensity)
        case "waves":
          return this.createWaves(intensity)
        case "floating-elements":
          return this.createFloatingElements(intensity)
        case "spotlight":
          return this.createSpotlight(intensity)
        default:
          return null
      }
    }
  
    createGradientBackground(intensity) {
      const element = document.createElement("div")
      element.className = "gradient-bg"
  
      // Set different animation speeds based on intensity
      let animationDuration = "20s"
      if (intensity === "light") animationDuration = "30s"
      if (intensity === "high") animationDuration = "15s"
  
      element.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          45deg,
          rgba(79, 70, 229, 0.05) 0%,
          rgba(16, 185, 129, 0.05) 50%,
          rgba(245, 158, 11, 0.05) 100%
        );
        background-size: 400% 400%;
        animation: gradientShift ${animationDuration} ease infinite;
      `
  
      // Add keyframes if they don't exist
      if (!document.getElementById("animation-keyframes")) {
        this.addKeyframes()
      }
  
      return element
    }
  
    createGradientPulse(intensity) {
      const element = document.createElement("div")
      element.className = "gradient-pulse"
  
      // Set different animation speeds based on intensity
      let animationDuration = "12s"
      if (intensity === "light") animationDuration = "18s"
      if (intensity === "high") animationDuration = "8s"
  
      element.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, rgba(79, 70, 229, 0.05) 0%, rgba(79, 70, 229, 0) 50%);
        animation: pulsate ${animationDuration} ease-in-out infinite;
      `
  
      return element
    }
  
    createParticles(intensity) {
      const container = document.createElement("div")
      container.className = "particles-container"
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      `
  
      // Determine number of particles based on intensity and screen size
      const width = window.innerWidth
      const height = window.innerHeight
      const area = width * height
  
      let particleCount = Math.min(Math.floor(area / 30000), 30) // Default medium intensity
  
      if (intensity === "light") particleCount = Math.min(Math.floor(area / 50000), 20)
      if (intensity === "high") particleCount = Math.min(Math.floor(area / 20000), 50)
  
      // Reduce particles for mobile devices
      if (width < 768) {
        particleCount = Math.min(particleCount, 10)
      }
  
      // Create particles
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("div")
        particle.className = "particle"
  
        // Random size between 2px and 6px
        const size = 2 + Math.random() * 4
  
        // Random position
        const posX = Math.random() * 100
        const posY = Math.random() * 100
  
        // Random opacity
        const opacity = 0.1 + Math.random() * 0.4
  
        particle.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          background-color: rgba(79, 70, 229, ${opacity});
          border-radius: 50%;
          left: ${posX}%;
          top: ${posY}%;
        `
  
        // Alternate colors
        if (Math.random() > 0.5) {
          particle.style.backgroundColor = `rgba(16, 185, 129, ${opacity})`
        }
  
        container.appendChild(particle)
  
        // Animate the particle
        this.animateParticle(particle)
      }
  
      return container
    }
  
    createWaves(intensity) {
      const container = document.createElement("div")
      container.className = "waves-container"
      container.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      `
  
      // Set different animation speeds based on intensity
      let wave1Duration = "25s"
      let wave2Duration = "20s"
      let wave3Duration = "15s"
  
      if (intensity === "light") {
        wave1Duration = "35s"
        wave2Duration = "30s"
        wave3Duration = "25s"
      }
  
      if (intensity === "high") {
        wave1Duration = "20s"
        wave2Duration = "15s"
        wave3Duration = "10s"
      }
  
      // Create waves
      for (let i = 1; i <= 3; i++) {
        const wave = document.createElement("div")
        wave.className = `wave wave-${i}`
  
        let waveColor, waveDuration
  
        if (i === 1) {
          waveColor = "rgba(79, 70, 229, 0.05)"
          waveDuration = wave1Duration
        } else if (i === 2) {
          waveColor = "rgba(16, 185, 129, 0.05)"
          waveDuration = wave2Duration
        } else {
          waveColor = "rgba(245, 158, 11, 0.05)"
          waveDuration = wave3Duration
        }
  
        wave.style.cssText = `
          position: absolute;
          bottom: ${(i - 1) * 10}%;
          left: 0;
          width: 200%;
          height: ${100 - (i - 1) * 10}px;
          background-color: ${waveColor};
          border-radius: 100% 100% 0 0;
          animation: wave-animation ${waveDuration} linear infinite;
        `
  
        container.appendChild(wave)
      }
  
      return container
    }
  
    createFloatingElements(intensity) {
      const container = document.createElement("div")
      container.className = "floating-elements-container"
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      `
  
      // Determine number of elements based on intensity and screen size
      const width = window.innerWidth
  
      let elementCount = 6 // Default medium intensity
  
      if (intensity === "light") elementCount = 4
      if (intensity === "high") elementCount = 10
  
      // Reduce elements for mobile devices
      if (width < 768) {
        elementCount = Math.min(elementCount, 3)
      }
  
      // Create floating elements
      const shapes = ["circle", "square", "triangle"]
      for (let i = 0; i < elementCount; i++) {
        const shape = shapes[Math.floor(Math.random() * shapes.length)]
  
        const element = document.createElement("div")
        element.className = `floating-element ${shape}`
  
        // Random size between 20px and 60px
        const size = 20 + Math.random() * 40
  
        // Random position
        const posX = Math.random() * 100
        const posY = Math.random() * 100
  
        // Random opacity
        const opacity = 0.03 + Math.random() * 0.05
  
        let backgroundColor
  
        if (shape === "circle") {
          backgroundColor = `rgba(79, 70, 229, ${opacity})`
          element.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background-color: ${backgroundColor};
            left: ${posX}%;
            top: ${posY}%;
          `
        } else if (shape === "square") {
          backgroundColor = `rgba(16, 185, 129, ${opacity})`
          element.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background-color: ${backgroundColor};
            left: ${posX}%;
            top: ${posY}%;
          `
        } else {
          // triangle
          backgroundColor = `rgba(245, 158, 11, ${opacity})`
          element.style.cssText = `
            position: absolute;
            width: 0;
            height: 0;
            border-left: ${size / 2}px solid transparent;
            border-right: ${size / 2}px solid transparent;
            border-bottom: ${size}px solid ${backgroundColor};
            background-color: transparent;
            left: ${posX}%;
            top: ${posY}%;
          `
        }
  
        container.appendChild(element)
  
        // Animate the element
        this.animateFloatingElement(element)
      }
  
      return container
    }
  
    createSpotlight(intensity) {
      const container = document.createElement("div")
      container.className = "spotlight-container"
      container.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        opacity: 0.7;
      `
  
      const spotlight = document.createElement("div")
      spotlight.className = "spotlight"
      spotlight.style.cssText = `
        position: absolute;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at 50% 50%, rgba(79, 70, 229, 0.05) 0%, rgba(0, 0, 0, 0) 60%);
        opacity: 0;
        mix-blend-mode: screen;
      `
  
      container.appendChild(spotlight)
  
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
  
      return container
    }
  
    animateParticle(particle) {
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
  
      // Store animation reference for later control
      particle.animation = animation
    }
  
    animateFloatingElement(element) {
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
  
      // Store animation reference for later control
      element.animation = animation
    }
  
    handleResize() {
      // Recreate animations on window resize for better performance
      this.createAnimationContainer()
      this.applyAnimations()
    }
  
    handleVisibilityChange() {
      // Pause animations when page is not visible
      if (document.hidden) {
        this.pauseAllAnimations()
      } else {
        this.resumeAllAnimations()
      }
    }
  
    pauseAllAnimations() {
      // Pause all Web Animation API animations
      document.querySelectorAll(".particle, .floating-element").forEach((element) => {
        if (element.animation) {
          element.animation.pause()
        }
      })
  
      // Pause CSS animations
      this.container.style.animationPlayState = "paused"
      this.container.querySelectorAll("*").forEach((element) => {
        element.style.animationPlayState = "paused"
      })
    }
  
    resumeAllAnimations() {
      // Resume all Web Animation API animations
      document.querySelectorAll(".particle, .floating-element").forEach((element) => {
        if (element.animation) {
          element.animation.play()
        }
      })
  
      // Resume CSS animations
      this.container.style.animationPlayState = "running"
      this.container.querySelectorAll("*").forEach((element) => {
        element.style.animationPlayState = "running"
      })
    }
  
    addKeyframes() {
      // Add keyframes for animations
      const style = document.createElement("style")
      style.id = "animation-keyframes"
      style.textContent = `
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes pulsate {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.5); opacity: 0.2; }
          100% { transform: scale(1); opacity: 0.5; }
        }
        
        @keyframes wave-animation {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        
        .fullpage-animation-container {
          transition: opacity 0.5s ease;
        }
        
        body.disable-animations .fullpage-animation-container,
        body.low-power-mode .fullpage-animation-container {
          opacity: 0.3;
        }
        
        body.low-power-mode .particles-container,
        body.low-power-mode .floating-elements-container {
          display: none;
        }
        
        @media (prefers-reduced-motion: reduce) {
          .fullpage-animation-container * {
            animation: none !important;
            transition: none !important;
          }
        }
        
        @media (max-width: 768px) {
          .particles-container {
            opacity: 0.5;
          }
          
          .floating-elements-container {
            opacity: 0.3;
          }
        }
      `
  
      document.head.appendChild(style)
    }
  }
  
  