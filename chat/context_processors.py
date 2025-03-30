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