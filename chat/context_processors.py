import pytz

def timezone_context_processor(request):
    """Add timezone information to all template contexts"""
    # Get timezone from session or use UTC as default
    user_timezone = request.session.get('user_timezone', 'UTC')
    
    # Ensure it's a valid timezone
    try:
        tz = pytz.timezone(user_timezone)
    except pytz.exceptions.UnknownTimeZoneError:
        # Fallback to UTC if invalid
        user_timezone = 'UTC'
    
    return {
        'user_timezone': user_timezone
    } 
def animation_context(request):
    """
    Context processor to add page-specific animation classes
    """
    # Determine page type from URL
    path = request.path
    animation_class = ""
    
    if path == "/" or path.startswith("/home"):
        animation_class = "home-page"
    elif "/profile" in path:
        animation_class = "profile-page"
    elif "/chat" in path or "/messages" in path:
        animation_class = "chat-page"
    elif "/login" in path or "/signup" in path or "/register" in path:
        animation_class = "auth-page"
    else:
        animation_class = "default-page"
    
    return {
        'page_animation_class': animation_class
    }

