/**
 * SocialChat Always-On Animations
 * Provides vibrant background animations across all pages
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
  
      console.log("SocialChat animations initialized")
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
    }
  
    /**
     * Add animated particles
     */
    addParticles() {
      const particlesContainer = document.createElement("div")
      particlesContainer.className = "sc-particles-container"
      this.container.appendChild(particlesContainer)
  
      // Create particles
      const particleCount = this.isMobile() ? 15 : 30
  
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("div")
        particle.className = "sc-particle"
  
        // Random size between 3px and 8px
        const size = 3 + Math.random() * 5
        particle.style.width = `${size}px`
        particle.style.height = `${size}px`
  
        // Random position
        particle.style.left = `${Math.random() * 100}%`
        particle.style.top = `${Math.random() * 100}%`
  
        // Random color
        const colors = [
          "var(--anim-primary)",
          "var(--anim-secondary)",
          "var(--anim-accent)",
          "var(--anim-highlight)",
          "var(--anim-contrast)",
        ]
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
  
        // Random animation duration and delay
        const duration = 15 + Math.random() * 15
        const delay = Math.random() * 10
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
  })
  
  