#!/usr/bin/env python
"""
Run this script on Render to manually add the missing columns to your database.
"""
import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_project.settings')
django.setup()

from django.db import connection

print("Running database fixes...")

# Execute SQL to add the missing columns
try:
    with connection.cursor() as cursor:
        # Add is_moderated column to Post table
        cursor.execute("ALTER TABLE chat_post ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
        # Add moderation_passed column to Post table
        cursor.execute("ALTER TABLE chat_post ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
        
        # Add columns to PostImage table
        cursor.execute("ALTER TABLE chat_postimage ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
        cursor.execute("ALTER TABLE chat_postimage ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
        
        # Add columns to PostVideo table
        cursor.execute("ALTER TABLE chat_postvideo ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
        cursor.execute("ALTER TABLE chat_postvideo ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
        
        # Add message moderation columns
        cursor.execute("ALTER TABLE chat_message ADD COLUMN is_image_moderated BOOLEAN DEFAULT 0")
        cursor.execute("ALTER TABLE chat_message ADD COLUMN image_moderation_passed BOOLEAN DEFAULT 1")
        cursor.execute("ALTER TABLE chat_message ADD COLUMN is_video_moderated BOOLEAN DEFAULT 0")
        cursor.execute("ALTER TABLE chat_message ADD COLUMN video_moderation_passed BOOLEAN DEFAULT 1")
        
    print("Database schema updated successfully!")
    
except Exception as e:
    print(f"Error: {e}")
    print("Some columns might already exist, which is fine.") 