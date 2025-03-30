"""
ASGI config for chat_project project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os
import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

# Set the Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "chat_project.settings")

django.setup()

# Import after Django setup
import chat.routing

# Run migrations automatically on startup
import django.core.management
try:
    # Run sessions migrations explicitly first
    django.core.management.call_command('migrate', 'sessions', interactive=False)
    print("Sessions migrations completed successfully!")
    
    # Run auth migrations explicitly
    django.core.management.call_command('migrate', 'auth', interactive=False)
    print("Auth migrations completed successfully!")
    
    # Run admin migrations explicitly
    django.core.management.call_command('migrate', 'admin', interactive=False)
    print("Admin migrations completed successfully!")
    
    # Run contenttypes migrations explicitly
    django.core.management.call_command('migrate', 'contenttypes', interactive=False)
    print("Contenttypes migrations completed successfully!")
    
    # Try to run chat migrations (skipping the problematic one if needed)
    try:
        django.core.management.call_command('migrate', 'chat', interactive=False)
        print("Chat migrations completed successfully!")
    except Exception as e:
        print(f"Warning: Chat migrations had issues: {e}")
        
except Exception as e:
    print(f"Error running migrations: {e}")

# Get ASGI application
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                chat.routing.websocket_urlpatterns
            )
        )
    ),
})
