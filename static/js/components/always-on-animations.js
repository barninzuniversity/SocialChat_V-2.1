/**
 * SocialChat Ultra-Clear Animations
 * Provides maximum visibility background animations across all pages
 * Enhanced with crystal clear elements and maximum intensity
 */

class SocialChatAnimations {
    constructor() {
      // Initialize animation container
      this.createAnimationContainer()
  
      // Add basic animation elements
      this.addGradientBackground()
      this.addOrbs()
      this.addParticles()
      this.addWaves()
  
      // Set page-specific class
      this.setPageClass()
  
      // Add extra elements for auth pages
      this.addPageSpecificElements()
  
      console.log("SocialChat animations initialized with MAXIMUM intensity")
    }
  
    /**
     * Create the main animation container
     */
    createAnimationContainer() {
      // Remove any existing container
      const existingContainer = document.querySelector(".sc-animation-container")
      if (existingContainer) {
        existingContainer.remove()
      }
  
      // Create new container
      const container = document.createElement("div")
      container.className = "sc-animation-container"
  
      // Add to body as first child
      document.body.insertBefore(container, document.body.firstChild)
  
      this.container = container
    }
  
    /**
     * Add gradient background
     */
    addGradientBackground() {
      const gradient = document.createElement("div")
      gradient.className = "sc-gradient-bg"
      this.container.appendChild(gradient)
    }
  
    /**
     * Add animated orbs
     */
    addOrbs() {
      // Create 3 orbs with different positions and colors
      for (let i = 1; i <= 3; i++) {
        const orb = document.createElement("div")
        orb.className = `sc-orb sc-orb-${i}`
        this.container.appendChild(orb)
      }
  
      // Add extra orbs for more visual impact
      const extraOrb1 = document.createElement("div")
      extraOrb1.className = "sc-orb"
      extraOrb1.style.width = "350px"
      extraOrb1.style.height = "350px"
      extraOrb1.style.backgroundColor = "var(--anim-contrast)"
      extraOrb1.style.top = "60%"
      extraOrb1.style.right = "20%"
      extraOrb1.style.animation = "sc-pulse var(--anim-speed-fast) ease-in-out infinite"
      extraOrb1.style.opacity = "var(--anim-opacity-high)"
      extraOrb1.style.filter = "blur(50px)"
      this.container.appendChild(extraOrb1)
  
      const extraOrb2 = document.createElement("div")
      extraOrb2.className = "sc-orb"
      extraOrb2.style.width = "300px"
      extraOrb2.style.height = "300px"
      extraOrb2.style.backgroundColor = "var(--anim-secondary)"
      extraOrb2.style.bottom = "30%"
      extraOrb2.style.left = "60%"
      extraOrb2.style.animation = "sc-float var(--anim-speed-medium) ease-in-out infinite alternate"
      extraOrb2.style.opacity = "var(--anim-opacity-high)"
      extraOrb2.style.filter = "blur(50px)"
      this.container.appendChild(extraOrb2)
    }
  
    /**
     * Add animated particles
     */
    addParticles() {
      const particlesContainer = document.createElement("div")
      particlesContainer.className = "sc-particles-container"
      this.container.appendChild(particlesContainer)
  
      // Create particles - increased count for more visual impact
      const particleCount = this.isMobile() ? 40 : 80 // Dramatically increased from 25/50
  
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("div")
        particle.className = "sc-particle"
  
        // Random size between 5px and 12px (increased for visibility)
        const size = 5 + Math.random() * 7
        particle.style.width = `${size}px`
        particle.style.height = `${size}px`
  
        // Random position
        particle.style.left = `${Math.random() * 100}%`
        particle.style.top = `${Math.random() * 100}%`
  
        // Random color - using direct RGB values for maximum saturation
        const colors = [
          "rgb(0, 85, 255)", // Bright blue
          "rgb(102, 0, 255)", // Vibrant purple
          "rgb(255, 0, 102)", // Hot pink
          "rgb(0, 204, 255)", // Bright cyan
          "rgb(153, 0, 255)", // Vivid violet
        ]
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
  
        // Add glow effect
        particle.style.boxShadow = "0 0 10px rgba(255, 255, 255, 0.7)"
  
        // Random animation duration and delay
        const duration = 12 + Math.random() * 10 // Faster animations
        const delay = Math.random() * 5
        particle.style.animationDuration = `${duration}s`
        particle.style.animationDelay = `${delay}s`
  
        particlesContainer.appendChild(particle)
      }
    }
  
    /**
     * Add animated waves
     */
    addWaves() {
      const wavesContainer = document.createElement("div")
      wavesContainer.className = "sc-waves-container"
      this.container.appendChild(wavesContainer)
  
      // Create 3 waves
      for (let i = 1; i <= 3; i++) {
        const wave = document.createElement("div")
        wave.className = `sc-wave sc-wave-${i}`
        wavesContainer.appendChild(wave)
      }
    }
  
    /**
     * Add page-specific elements
     */
    addPageSpecificElements() {
      // Check if we're on an auth page
      if (document.body.classList.contains("auth-page")) {
        // Add extra orb for login/signup pages
        const authOrb = document.createElement("div")
        authOrb.className = "sc-orb-extra"
        this.container.appendChild(authOrb)
  
        // Add more particles
        this.addExtraParticles(30) // 30 more particles
      }
    }
  
    /**
     * Add extra particles
     */
    addExtraParticles(count) {
      const particlesContainer = document.querySelector(".sc-particles-container")
      if (!particlesContainer) return
  
      for (let i = 0; i < count; i++) {
        const particle = document.createElement("div")
        particle.className = "sc-particle"
  
        // Larger size for extra visibility
        const size = 8 + Math.random() * 8
        particle.style.width = `${size}px`
        particle.style.height = `${size}px`
  
        // Random position
        particle.style.left = `${Math.random() * 100}%`
        particle.style.top = `${Math.random() * 100}%`
  
        // Bright colors
        const colors = [
          "rgb(0, 85, 255)", // Bright blue
          "rgb(102, 0, 255)", // Vibrant purple
          "rgb(255, 0, 102)", // Hot pink
          "rgb(0, 204, 255)", // Bright cyan
          "rgb(153, 0, 255)", // Vivid violet
        ]
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
  
        // Add stronger glow effect
        particle.style.boxShadow = "0 0 15px rgba(255, 255, 255, 0.9)"
  
        // Faster animations
        const duration = 8 + Math.random() * 8
        const delay = Math.random() * 3
        particle.style.animationDuration = `${duration}s`
        particle.style.animationDelay = `${delay}s`
  
        particlesContainer.appendChild(particle)
      }
    }
  
    /**
     * Set page-specific class based on URL
     */
    setPageClass() {
      const path = window.location.pathname
      let pageClass = "default-page"
  
      if (path === "/" || path.includes("/home")) {
        pageClass = "home-page"
      } else if (path.includes("/profile")) {
        pageClass = "profile-page"
      } else if (path.includes("/chat") || path.includes("/messages")) {
        pageClass = "chat-page"
      } else if (path.includes("/login") || path.includes("/signup") || path.includes("/register")) {
        pageClass = "auth-page"
      }
  
      // Remove any existing page classes
      document.body.classList.remove("home-page", "profile-page", "chat-page", "auth-page", "default-page")
  
      // Add class to body
      document.body.classList.add(pageClass)
    }
  
    /**
     * Check if device is mobile
     */
    isMobile() {
      return window.innerWidth < 768
    }
  }
  
  // Initialize animations when DOM is loaded
  document.addEventListener("DOMContentLoaded", () => {
    // Create global instance
    window.scAnimations = new SocialChatAnimations()
  
    // Re-initialize on page changes (for SPAs)
    document.addEventListener("turbolinks:load", () => {
      window.scAnimations = new SocialChatAnimations()
    })
  
    // Handle theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.attributeName === "class" &&
          (document.body.classList.contains("dark") || !document.body.classList.contains("dark"))
        ) {
          // Reinitialize animations when theme changes
          window.scAnimations = new SocialChatAnimations()
        }
      })
    })
  
    // Start observing the body for class changes
    observer.observe(document.body, { attributes: true })
  })
  
  