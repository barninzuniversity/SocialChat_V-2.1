// Home Feed Animations
document.addEventListener('DOMContentLoaded', function() {
  // Add staggered animations to posts
  const animatePosts = function() {
    const posts = document.querySelectorAll('.card');
    
    posts.forEach(function(post, index) {
      post.style.opacity = '0';
      post.style.transform = 'translateY(20px)';
      
      setTimeout(function() {
        post.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        post.style.opacity = '1';
        post.style.transform = 'translateY(0)';
      }, 100 + (index * 150));
    });
  };

  // Enhance post reactions
  const enhanceReactions = function() {
    const reactions = document.querySelectorAll('.btn-reaction');
    
    reactions.forEach(function(btn) {
      // Add hover animation
      btn.addEventListener('mouseenter', function() {
        const emoji = this.querySelector('.reaction-emoji');
        if (emoji) {
          emoji.style.transform = 'scale(1.3)';
          emoji.style.transition = 'transform 0.3s ease';
        }
      });
      
      btn.addEventListener('mouseleave', function() {
        const emoji = this.querySelector('.reaction-emoji');
        if (emoji) {
          emoji.style.transform = 'scale(1)';
        }
      });
      
      // Add click animation
      btn.addEventListener('click', function() {
        // Add heart animation on like
        if (this.classList.contains('like-button') || this.querySelector('.fa-heart')) {
          createHeartAnimation(this);
        }
      });
    });
  };

  // Create heart animation for likes
  const createHeartAnimation = function(button) {
    // Create floating heart
    const heart = document.createElement('div');
    heart.innerHTML = '❤️';
    heart.className = 'floating-heart';
    heart.style.cssText = `
      position: absolute;
      font-size: 1.5rem;
      left: 50%;
      top: 0;
      transform: translateX(-50%);
      animation: float-up 1s forwards ease-out;
      pointer-events: none;
      opacity: 1;
    `;
    
    button.style.position = 'relative';
    button.appendChild(heart);
    
    // Remove after animation completes
    setTimeout(function() {
      heart.remove();
    }, 1000);
    
    // Add animation keyframes if not already added
    if (!document.querySelector('style#heart-animation')) {
      const style = document.createElement('style');
      style.id = 'heart-animation';
      style.textContent = `
        @keyframes float-up {
          0% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, -20px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  };

  // Enhance comments section
  const enhanceComments = function() {
    const commentBtns = document.querySelectorAll('.comment-toggle-btn');
    
    commentBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const target = this.getAttribute('data-bs-target') || this.getAttribute('data-target');
        if (target) {
          const commentSection = document.querySelector(target);
          if (commentSection) {
            // Add animation to comments after they're shown
            setTimeout(function() {
              const comments = commentSection.querySelectorAll('.comment');
              comments.forEach(function(comment, index) {
                comment.style.opacity = '0';
                comment.style.transform = 'translateY(10px)';
                
                setTimeout(function() {
                  comment.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                  comment.style.opacity = '1';
                  comment.style.transform = 'translateY(0)';
                }, 50 * index);
              });
            }, 300);
          }
        }
      });
    });
    
    // Enhance comment form
    const commentForms = document.querySelectorAll('.comment-form');
    commentForms.forEach(function(form) {
      form.addEventListener('submit', function(e) {
        // Prevent actual form submission for demo
        // In a real app, this would be handled with AJAX
        // e.preventDefault();
        
        // Animate the submission
        const textarea = this.querySelector('textarea');
        const submitBtn = this.querySelector('button[type="submit"]');
        
        if (textarea && submitBtn) {
          submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          
          // Create a preview comment with animation
          const commentPreview = document.createElement('div');
          commentPreview.className = 'comment animate-fade-in mb-2';
          commentPreview.innerHTML = `
            <div class="d-flex">
              <div class="me-2">
                <img src="${document.querySelector('.profile-avatar-sm')?.src || '#'}" class="profile-avatar-sm" alt="You">
              </div>
              <div class="comment-content p-2 rounded bg-light w-100">
                <div class="d-flex justify-content-between align-items-center">
                  <div><strong>You</strong> <small class="text-muted">Just now</small></div>
                </div>
                <div>${textarea.value}</div>
              </div>
            </div>
          `;
          
          // Add to comments section after delay
          setTimeout(function() {
            const commentsContainer = form.closest('.collapse').querySelector('.comments-container');
            if (commentsContainer) {
              commentsContainer.appendChild(commentPreview);
              commentPreview.scrollIntoView({ behavior: 'smooth' });
            }
            
            // Reset form
            textarea.value = '';
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
          }, 500);
        }
      });
    });
  };

  // Enhance file upload for post creation
  const enhancePostCreation = function() {
    const postForm = document.getElementById('post-form');
    if (postForm) {
      const imageInput = document.getElementById('id_images');
      const videoInput = document.getElementById('id_videos');
      const uploadDropZone = document.getElementById('upload-drop-zone');
      const previewContainer = document.getElementById('preview-container');
      const selectedFiles = document.getElementById('files-preview-container');
      const removeFilesBtn = document.getElementById('remove-all-files');
      
      // File preview function
      const previewFiles = function(files, fileType) {
        if (files && files.length > 0) {
          previewContainer.classList.remove('d-none');
          
          // Loop through files
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            
            reader.onload = function(e) {
              const fileItem = document.createElement('div');
              fileItem.className = 'file-preview-item';
              fileItem.dataset.fileName = file.name;
              
              if (fileType === 'image') {
                fileItem.innerHTML = `
                  <img src="${e.target.result}" alt="Image preview">
                  <span class="file-type">Image</span>
                  <span class="remove-item" data-file="${file.name}" data-type="${fileType}">
                    <i class="fas fa-times"></i>
                  </span>
                `;
              } else if (fileType === 'video') {
                fileItem.innerHTML = `
                  <video>
                    <source src="${e.target.result}" type="${file.type}">
                  </video>
                  <span class="file-type">Video</span>
                  <span class="remove-item" data-file="${file.name}" data-type="${fileType}">
                    <i class="fas fa-times"></i>
                  </span>
                `;
              }
              
              selectedFiles.appendChild(fileItem);
              
              // Add confetti effect
              createConfetti(previewContainer);
            };
            
            reader.readAsDataURL(file);
          }
        }
      };
      
      // Handle drag and drop
      uploadDropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
      });
      
      uploadDropZone.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
      });
      
      uploadDropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        
        const dt = e.dataTransfer;
        const files = dt.files;
        
        // Sort files by type
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/')) {
            // Add to the image input files
            const dtImage = new DataTransfer();
            // Add existing files
            if (imageInput.files) {
              for (let j = 0; j < imageInput.files.length; j++) {
                dtImage.items.add(imageInput.files[j]);
              }
            }
            dtImage.items.add(file);
            imageInput.files = dtImage.files;
            previewFiles([file], 'image');
          } else if (file.type.startsWith('video/')) {
            // Add to the video input files
            const dtVideo = new DataTransfer();
            // Add existing files
            if (videoInput.files) {
              for (let j = 0; j < videoInput.files.length; j++) {
                dtVideo.items.add(videoInput.files[j]);
              }
            }
            dtVideo.items.add(file);
            videoInput.files = dtVideo.files;
            previewFiles([file], 'video');
          }
        }
      });
      
      // Handle click to browse
      uploadDropZone.addEventListener('click', function() {
        // Show file dialog for images
        imageInput.click();
      });
      
      // Handle image selection
      imageInput.addEventListener('change', function() {
        previewFiles(this.files, 'image');
      });
      
      // Handle video selection via button
      document.addEventListener('click', function(e) {
        if (e.target.classList.contains('upload-video-btn') || 
            e.target.closest('.upload-video-btn')) {
          videoInput.click();
        }
      });
      
      // Handle video selection
      videoInput.addEventListener('change', function() {
        previewFiles(this.files, 'video');
      });
      
      // Handle removing all files
      removeFilesBtn.addEventListener('click', function() {
        selectedFiles.innerHTML = '';
        imageInput.value = '';
        videoInput.value = '';
        previewContainer.classList.add('d-none');
      });
      
      // Handle removing individual files
      selectedFiles.addEventListener('click', function(e) {
        const removeBtn = e.target.closest('.remove-item');
        if (removeBtn) {
          const fileName = removeBtn.dataset.file;
          const fileType = removeBtn.dataset.type;
          const fileItem = removeBtn.closest('.file-preview-item');
          
          // Remove from preview
          if (fileItem) {
            fileItem.remove();
          }
          
          // Remove from file input
          const input = fileType === 'image' ? imageInput : videoInput;
          if (input.files && input.files.length > 0) {
            const dt = new DataTransfer();
            for (let i = 0; i < input.files.length; i++) {
              const file = input.files[i];
              if (file.name !== fileName) {
                dt.items.add(file);
              }
            }
            input.files = dt.files;
          }
          
          // Hide preview container if no more files
          if (selectedFiles.children.length === 0) {
            previewContainer.classList.add('d-none');
          }
        }
      });
      
      // Enhance submit button with visual feedback
      const submitBtn = postForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        postForm.addEventListener('submit', function() {
          submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Posting...';
          submitBtn.classList.add('disabled');
          return true;
        });
      }
    }
  };
  
  // Create confetti effect
  const createConfetti = function(parent) {
    if (!parent) return;
    
    const confetti = document.createElement('div');
    const colors = ['#FFC700', '#FF0055', '#0066FF', '#44FF00'];
    
    confetti.style.cssText = `
      position: absolute;
      width: 8px;
      height: 8px;
      background-color: ${colors[Math.floor(Math.random() * colors.length)]};
      top: 50%;
      left: 50%;
      opacity: 0;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      transform: rotate(${Math.random() * 360}deg);
    `;
    
    parent.appendChild(confetti);
    
    // Animate confetti
    const animateX = -50 + Math.random() * 100;
    const animateY = -50 + Math.random() * 100;
    
    confetti.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${animateX}px, ${animateY}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
    ], {
      duration: 1000 + Math.random() * 1000,
      easing: 'cubic-bezier(0,.9,.57,1)',
      fill: 'forwards'
    });
    
    setTimeout(function() {
      confetti.remove();
    }, 2000);
  };
  
  // Enhance share dialog
  const enhanceShareDialog = function() {
    const shareBtn = document.querySelectorAll('.share-btn');
    
    shareBtn.forEach(function(btn) {
      btn.addEventListener('click', function() {
        // The modal will be shown by Bootstrap
        // Add animation to the modal when it appears
        const modalId = this.getAttribute('data-bs-target') || this.getAttribute('data-target');
        if (modalId) {
          const modal = document.querySelector(modalId);
          if (modal) {
            modal.addEventListener('shown.bs.modal', function() {
              const modalDialog = this.querySelector('.modal-dialog');
              if (modalDialog) {
                modalDialog.style.animation = 'slideInUp 0.3s ease forwards';
              }
            }, { once: true });
          }
        }
      });
    });
  };
  
  // Run only on home feed page
  if (document.querySelector('.post') || document.querySelectorAll('.card').length > 2) {
    animatePosts();
    enhanceReactions();
    enhanceComments();
    enhancePostCreation();
    enhanceShareDialog();
    
    // Add animation styles for home feed
    if (!document.querySelector('style#home-styles')) {
      const style = document.createElement('style');
      style.id = 'home-styles';
      style.textContent = `
        .animate-fade-in {
          animation: fadeIn 0.5s ease forwards;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideInUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .reaction-btn, .btn-reaction {
          transition: all 0.3s ease;
          position: relative;
        }
        
        .reaction-emoji {
          transition: transform 0.3s ease;
        }
        
        .comment-content {
          transition: background-color 0.3s ease;
        }
        
        .comment-content:hover {
          background-color: #f0f0f0 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }
}); 