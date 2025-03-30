from django.apps import AppConfig
from django.db import connection


class ChatConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "chat"

    def ready(self):
        # Fix database schema on startup
        self.apply_schema_fixes()
        
    def apply_schema_fixes(self):
        """Add missing columns to the database schema"""
        try:
            with connection.cursor() as cursor:
                # Check if the column exists first
                cursor.execute("PRAGMA table_info(chat_post)")
                columns = [info[1] for info in cursor.fetchall()]
                
                if 'is_moderated' not in columns:
                    print("Adding missing is_moderated column to chat_post table...")
                    cursor.execute("ALTER TABLE chat_post ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
                    cursor.execute("ALTER TABLE chat_post ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
                
                # Check PostImage table
                cursor.execute("PRAGMA table_info(chat_postimage)")
                columns = [info[1] for info in cursor.fetchall()]
                if 'is_moderated' not in columns:
                    cursor.execute("ALTER TABLE chat_postimage ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
                    cursor.execute("ALTER TABLE chat_postimage ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
                
                # Check PostVideo table
                cursor.execute("PRAGMA table_info(chat_postvideo)")
                columns = [info[1] for info in cursor.fetchall()]
                if 'is_moderated' not in columns:
                    cursor.execute("ALTER TABLE chat_postvideo ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
                    cursor.execute("ALTER TABLE chat_postvideo ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
                
                # Check Message table for moderation columns
                cursor.execute("PRAGMA table_info(chat_message)")
                columns = [info[1] for info in cursor.fetchall()]
                if 'is_image_moderated' not in columns:
                    cursor.execute("ALTER TABLE chat_message ADD COLUMN is_image_moderated BOOLEAN DEFAULT 0")
                    cursor.execute("ALTER TABLE chat_message ADD COLUMN image_moderation_passed BOOLEAN DEFAULT 1")
                    cursor.execute("ALTER TABLE chat_message ADD COLUMN is_video_moderated BOOLEAN DEFAULT 0")
                    cursor.execute("ALTER TABLE chat_message ADD COLUMN video_moderation_passed BOOLEAN DEFAULT 1")
                
                print("Database schema fix check completed")
        except Exception as e:
            print(f"Error during schema fix: {e}")
