document.addEventListener('DOMContentLoaded', function() {
    const notificationToggle = document.getElementById('notificationToggle');
    const notificationCenter = document.getElementById('notification-center');
    const closeNotifications = document.getElementById('closeNotifications');
    const notificationBadge = document.querySelector('.notification-badge');
    
    // Toggle notification center
    notificationToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        notificationCenter.style.display = notificationCenter.style.display === 'none' ? 'block' : 'none';
    });
    
    // Close notification center
    closeNotifications.addEventListener('click', function() {
        notificationCenter.style.display = 'none';
    });
    
    // Close when clicking outside
    document.addEventListener('click', function(e) {
        if (!notificationCenter.contains(e.target) && 
            !notificationToggle.contains(e.target)) {
            notificationCenter.style.display = 'none';
        }
    });
    
    // Mark notifications as read when clicked
    document.addEventListener('click', function(e) {
        const notificationItem = e.target.closest('.notification-item');
        if (notificationItem && notificationItem.classList.contains('notification-unread')) {
            const notificationId = notificationItem.dataset.notificationId;
            fetch(`/notifications/${notificationId}/read/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                }
            }).then(() => {
                notificationItem.classList.remove('notification-unread');
                updateNotificationBadge();
            });
        }
    });
    
    // Update notification badge
    function updateNotificationBadge() {
        const unreadCount = document.querySelectorAll('.notification-item.notification-unread').length;
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    // WebSocket connection for real-time notifications
    const notificationSocket = new WebSocket(
        'ws://' + window.location.host + '/ws/notifications/'
    );
    
    notificationSocket.onmessage = function(e) {
        const data = JSON.parse(e.data);
        if (data.type === 'notification') {
            // Update notification badge
            updateNotificationBadge();
            // Refresh notification list if center is open
            if (notificationCenter.style.display === 'block') {
                htmx.trigger('.notification-list', 'load');
            }
        }
    };
});