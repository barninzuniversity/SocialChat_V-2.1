/**
 * Animation Injector
 * Automatically injects animation containers into appropriate page sections
 */

document.addEventListener("DOMContentLoaded", () => {
    // Wait a tiny bit to ensure page is fully rendered
    setTimeout(() => {
      const animationInjector = new AnimationInjector();
      animationInjector.init();
    }, 50);
  });
  
  class AnimationInjector {
    constructor() {
      // Configuration for different page types
      this.pageConfig = {
        'home-page': {
          selectors: ['.container > .row', 'main', '.content-wrapper'],
          animations: ['gradient-bg', 'particles', 'floating-elements']
        },
        'profile-page': {
          selectors: ['.profile-header', '.profile-content', '.container > .row'],
          animations: ['gradient-bg', 'spotlight']
        },
        'chat-page': {
          selectors: ['.chat-container', '.messages-container', '.container > .row'],
          animations: ['gradient-pulse', 'waves']
        },
        'auth-page': {
          selectors: ['.auth-container', '.login-container', '.signup-container', '.container > .row'],
          animations: ['gradient-bg', 'particles']
        },
        'default': {
          selectors: ['.container > .row', 'main', '.content-wrapper'],
          animations: ['gradient-bg']
        }
      };
      
      // Animation components that can be applied
      this.animationComponents = {
        'gradient-bg': this.createGradientBg,
        'gradient-pulse': this.createGradientPulse,
        'particles': this.createParticles,
        'waves': this.createWaves,
        'floating-elements': this.createFloatingElements,
        'spotlight': this.createSpotlight,
        'bg-pattern': this.createBgPattern
      };
      
      // Get current page type from body class
      this.pageType = this.getPageType();
      
      // Performance mode detection
      this.lowPerformanceMode = this.detectLowPerformance();
    }
    
    init() {
      console.log(`Animation Injector initializing for page type: ${this.pageType}`);
      
      // Skip if animations should be disabled
      if (this.shouldDisableAnimations()) {
        console.log('Animations disabled due to user preferences or device capabilities');
        return;
      }
      
      // Get configuration for current page type
      const config = this.pageConfig[this.pageType] || this.pageConfig['default'];
      
      // Find appropriate containers based on selectors
      const containers = this.findContainers(config.selectors);
      
      if (containers.length === 0) {
        console.log('No suitable containers found, creating fallback container');
        this.createFallbackContainer();
        return;
      }
      
      // Apply animations to each container
      containers.forEach(container => {
        this.applyAnimations(container, config.animations);
      });
      
      console.log(`Applied animations to ${containers.length} containers`);
    }
    
    getPageType() {
      const bodyClasses = document.body.classList;
      
      if (bodyClasses.contains('home-page')) return 'home-page';
      if (bodyClasses.contains('profile-page')) return 'profile-page';
      if (bodyClasses.contains('chat-page')) return 'chat-page';
      if (bodyClasses.contains('auth-page')) return 'auth-page';
      
      // Try to determine page type from URL if not in body class
      const path = window.location.pathname;
      if (path === '/' || path.includes('/home')) return 'home-page';
      if (path.includes('/profile')) return 'profile-page';
      if (path.includes('/chat') || path.includes('/messages')) return 'chat-page';
      if (path.includes('/login') || path.includes('/signup') || path.includes('/register')) return 'auth-page';
      
      return 'default';
    }
    
    shouldDisableAnimations() {
      // Check for reduced motion preference
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return true;
      }
      
      // Check if animations are explicitly disabled
      if (document.body.classList.contains('disable-animations')) {
        return true;
      }
      
      // Check for saved preference in localStorage
      if (localStorage.getItem('disable-animations') === 'true') {
        return true;
      }
      
      // Check for URL parameter
      if (new URLSearchParams(window.location.search).has('no-animations')) {
        return true;
      }
      
      return false;
    }
    
    detectLowPerformance() {
      // Check for low-end devices
      const lowMemory = navigator.deviceMemory && navigator.deviceMemory < 4;
      const slowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
      
      // Check for battery status if available
      let lowBattery = false;
      if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
          if (battery.level < 0.2 && !battery.charging) {
            document.body.classList.add('low-power-mode');
            lowBattery = true;
          }
        }).catch(() => {
          // Battery API failed, continue
        });
      }
      
      // Check for slow connection
      const slowConnection = navigator.connection && 
        (navigator.connection.saveData || 
         navigator.connection.effectiveType.includes('2g'));
      
      // Check for mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Enable low performance mode if any conditions are met
      if (lowMemory || slowCPU || lowBattery || slowConnection || (isMobile && window.innerWidth < 768)) {
        document.body.classList.add('low-power-mode');
        return true;
      }
      
      return false;
    }
    
    findContainers(selectors) {
      const containers = [];
      
      // Try each selector in order of preference
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // Found matching elements, add them to containers
          elements.forEach(element => {
            // Skip if element already has animations
            if (element.querySelector('.bg-animation-container')) {
              return;
            }
            
            // Skip if element is too small
            const rect = element.getBoundingClientRect();
            if (rect.width < 200 || rect.height < 200) {
              return;
            }
            
            // Add to containers list
            containers.push(element);
          });
          
          // If we found containers with this selector, stop looking
          if (containers.length > 0) {
            break;
          }
        }
      }
      
      return containers;
    }
    
    createFallbackContainer() {
      // Create a container that covers the whole page
      const container = document.createElement('div');
      container.className = 'bg-animation-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        overflow: hidden;
        pointer-events: none;
      `;
      
      document.body.appendChild(container);
      
      // Apply default animations
      this.applyAnimations(container, ['gradient-bg']);
    }
    
    applyAnimations(container, animationTypes) {
      // Set position relative if not already
      const computedStyle = window.getComputedStyle(container);
      if (computedStyle.position === 'static') {
        container.style.position = 'relative';
      }
      
      // Create animation container
      const animationContainer = document.createElement('div');
      animationContainer.className = 'bg-animation-container';
      animationContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        overflow: hidden;
        pointer-events: none;
      `;
      
      // Add animation components based on configuration
      let animationsToApply = animationTypes;
      
      // Reduce animations in low performance mode
      if (this.lowPerformanceMode) {
        // Only use the first animation type in low performance mode
        animationsToApply = animationsToApply.slice(0, 1);
      }
      
      // Apply each animation
      animationsToApply.forEach(type => {
        if (this.animationComponents[type]) {
          const component = this.animationComponents[type].call(this, animationContainer);
          if (component) {
            animationContainer.appendChild(component);
          }
        }
      });
      
      // Add to container
      container.appendChild(animationContainer);
    }
    
    // Animation component creators
    createGradientBg() {
      const element = document.createElement('div');
      element.className = 'gradient-bg';
      return element;
    }
    
    createGradientPulse() {
      const element = document.createElement('div');
      element.className = 'gradient-pulse';
      return element;
    }
    
    createParticles() {
      // Skip particles in low performance mode
      if (this.lowPerformanceMode) return null;
      
      const container = document.createElement('div');
      container.className = 'particles-container';
      
      // Determine number of particles based on screen size
      const width = window.innerWidth;
      const height = window.innerHeight;
      const area = width * height;
      
      // Adjust particle count based on device capability
      let particleCount = Math.min(Math.floor(area / 30000), 30);
      
      // Reduce particles for mobile devices
      if (width < 768) {
        particleCount = Math.min(particleCount, 10);
      }
      
      // Create particles
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random size between 2px and 6px
        const size = 2 + Math.random() * 4;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Random position
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        particle.style.left = `${posX}%`;
        particle.style.top = `${posY}%`;
        
        // Random opacity
        particle.style.opacity = 0.1 + Math.random() * 0.4;
        
        // Alternate colors
        if (Math.random() > 0.5) {
          particle.style.backgroundColor = 'var(--particle-color-alt)';
        }
        
        container.appendChild(particle);
        
        // Animate the particle
        this.animateParticle(particle);
      }
      
      return container;
    }
    
    createWaves() {
      const container = document.createElement('div');
      container.className = 'waves-container';
      
      // Create waves
      for (let i = 1; i <= 3; i++) {
        const wave = document.createElement('div');
        wave.className = `wave wave-${i}`;
        container.appendChild(wave);
      }
      
      return container;
    }
    
    createFloatingElements() {
      // Skip floating elements in low performance mode
      if (this.lowPerformanceMode) return null;
      
      const container = document.createElement('div');
      container.className = 'floating-elements-container';
      
      // Determine number of elements based on screen size
      const width = window.innerWidth;
      const elementCount = width < 768 ? 3 : 6;
      
      // Create floating elements
      const shapes = ['circle', 'square', 'triangle'];
      for (let i = 0; i < elementCount; i++) {
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        
        const element = document.createElement('div');
        element.className = `floating-element ${shape}`;
        
        // Random size between 20px and 60px
        const size = 20 + Math.random() * 40;
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        
        // Random position
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        element.style.left = `${posX}%`;
        element.style.top = `${posY}%`;
        
        // Random opacity
        element.style.opacity = 0.03 + Math.random() * 0.05;
        
        container.appendChild(element);
        
        // Animate the element
        this.animateFloatingElement(element);
      }
      
      return container;
    }
    
    createSpotlight() {
      const container = document.createElement('div');
      container.className = 'spotlight-container';
      
      const spotlight = document.createElement('div');
      spotlight.className = 'spotlight';
      container.appendChild(spotlight);
      
      // Track mouse movement
      document.addEventListener('mousemove', (e) => {
        // Get mouse position as percentage of window
        const x = (e.clientX / window.innerWidth) * 100;
        const y = (e.clientY / window.innerHeight) * 100;
        
        // Update spotlight position
        spotlight.style.background = `radial-gradient(circle at ${x}% ${y}%, 
          rgba(79, 70, 229, 0.05) 0%, 
          rgba(0, 0, 0, 0) 60%)`;
        
        // Fade in spotlight
        spotlight.style.opacity = '1';
        
        // Clear previous timeout
        if (spotlight.timeout) {
          clearTimeout(spotlight.timeout);
        }
        
        // Fade out spotlight after 2 seconds of no movement
        spotlight.timeout = setTimeout(() => {
          spotlight.style.opacity = '0';
        }, 2000);
      });
      
      return container;
    }
    
    createBgPattern() {
      const element = document.createElement('div');
      element.className = 'bg-pattern';
      return element;
    }
    
    // Animation helpers
    animateParticle(particle) {
      // Random duration between 15s and 30s
      const duration = 15000 + Math.random() * 15000;
      
      // Random movement distance
      const moveX = -20 + Math.random() * 40;
      const moveY = -20 + Math.random() * 40;
      
      // Create animation
      const animation = particle.animate(
        [
          { transform: 'translate(0, 0)', opacity: 0 },
          { transform: `translate(${moveX}vw, ${moveY}vh)`, opacity: 0.6, offset: 0.2 },
          { transform: `translate(${moveX * 2}vw, ${moveY * 1.5}vh)`, opacity: 0.4, offset: 0.6 },
          { transform: `translate(${moveX * 1.5}vw, ${moveY * 2}vh)`, opacity: 0 },
        ],
        {
          duration: duration,
          easing: 'ease-in-out',
          iterations: Infinity,
        }
      );
      
      // Pause animation if page is not visible
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          animation.pause();
        } else {
          animation.play();
        }
      });
    }
    
    animateFloatingElement(element) {
      // Random duration between 20s and 40s
      const duration = 20000 + Math.random() * 20000;
      
      // Random movement distance
      const moveX = -10 + Math.random() * 20;
      const moveY = -10 + Math.random() * 20;
      
      // Random rotation
      const rotation = Math.random() > 0.5 ? 360 : -360;
      
      // Create animation
      const animation = element.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg)' },
          { transform: `translate(${moveX}vw, ${moveY}vh) rotate(${rotation}deg)` },
        ],
        {
          duration: duration,
          easing: 'ease-in-out',
          iterations: Infinity,
          direction: 'alternate',
        }
      );
      
      // Pause animation if page is not visible
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          animation.pause();
        } else {
          animation.play();
        }
      });
    }
  }