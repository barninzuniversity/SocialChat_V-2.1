import pytz

class TimezoneMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Set a default timezone in the session if not already set
        if 'user_timezone' not in request.session:
            request.session['user_timezone'] = 'UTC'  # Default to UTC
        
        # Get response and return
        response = self.get_response(request)
        return response 