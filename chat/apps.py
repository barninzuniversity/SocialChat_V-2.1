from django.apps import AppConfig
from django.db import connection
import logging

logger = logging.getLogger(__name__)

class ChatConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "chat"

    def ready(self):
        # Import at runtime to avoid AppRegistryNotReady error
        import django.db.utils
        
        # Defer the schema fix to ensure tables are created first
        from django.db.models.signals import post_migrate
        from django.dispatch import receiver
        
        @receiver(post_migrate)
        def run_after_migrations(sender, **kwargs):
            if sender.name == self.name:  # Only run for this app
                self.apply_schema_fixes()
        
    def apply_schema_fixes(self):
        """Add missing columns to the database schema if they don't exist"""
        try:
            # First check if tables exist
            with connection.cursor() as cursor:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_post'")
                if not cursor.fetchone():
                    logger.info("Tables not yet created, skipping schema fixes")
                    return
                
                # Check Post table
                try:
                    cursor.execute("PRAGMA table_info(chat_post)")
                    columns = [info[1] for info in cursor.fetchall()]
                    
                    if 'is_moderated' not in columns:
                        logger.info("Adding missing is_moderated column to chat_post table...")
                        cursor.execute("ALTER TABLE chat_post ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
                        cursor.execute("ALTER TABLE chat_post ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
                except Exception as e:
                    logger.error(f"Error adding columns to Post: {e}")
                
                # Check PostImage table
                try:
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_postimage'")
                    if cursor.fetchone():
                        cursor.execute("PRAGMA table_info(chat_postimage)")
                        columns = [info[1] for info in cursor.fetchall()]
                        if 'is_moderated' not in columns:
                            logger.info("Adding missing columns to PostImage table...")
                            cursor.execute("ALTER TABLE chat_postimage ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
                            cursor.execute("ALTER TABLE chat_postimage ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
                except Exception as e:
                    logger.error(f"Error adding columns to PostImage: {e}")
                
                # Check PostVideo table
                try:
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_postvideo'")
                    if cursor.fetchone():
                        cursor.execute("PRAGMA table_info(chat_postvideo)")
                        columns = [info[1] for info in cursor.fetchall()]
                        if 'is_moderated' not in columns:
                            logger.info("Adding missing columns to PostVideo table...")
                            cursor.execute("ALTER TABLE chat_postvideo ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
                            cursor.execute("ALTER TABLE chat_postvideo ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
                except Exception as e:
                    logger.error(f"Error adding columns to PostVideo: {e}")
                
                # Check Message table
                try:
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_message'")
                    if cursor.fetchone():
                        cursor.execute("PRAGMA table_info(chat_message)")
                        columns = [info[1] for info in cursor.fetchall()]
                        if 'is_image_moderated' not in columns:
                            logger.info("Adding missing columns to Message table...")
                            cursor.execute("ALTER TABLE chat_message ADD COLUMN is_image_moderated BOOLEAN DEFAULT 0")
                            cursor.execute("ALTER TABLE chat_message ADD COLUMN image_moderation_passed BOOLEAN DEFAULT 1")
                            cursor.execute("ALTER TABLE chat_message ADD COLUMN is_video_moderated BOOLEAN DEFAULT 0")
                            cursor.execute("ALTER TABLE chat_message ADD COLUMN video_moderation_passed BOOLEAN DEFAULT 1")
                except Exception as e:
                    logger.error(f"Error adding columns to Message: {e}")
                
                logger.info("Database schema fix check completed")
        except Exception as e:
            logger.error(f"Error during schema fix: {e}")
