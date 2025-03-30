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
            # Detect database type to use appropriate queries
            db_engine = connection.vendor
            logger.info(f"Detected database engine: {db_engine}")
            
            if db_engine == 'sqlite':
                self._apply_sqlite_fixes()
            elif db_engine == 'postgresql':
                self._apply_postgresql_fixes()
            else:
                logger.warning(f"No specific fix for {db_engine}, using generic approach")
                self._apply_generic_fixes()
                
            logger.info("Database schema fix check completed")
        except Exception as e:
            logger.error(f"Error during schema fix: {e}")
    
    def _apply_sqlite_fixes(self):
        """Apply fixes specific to SQLite database"""
        with connection.cursor() as cursor:
            # Check if tables exist
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
    
    def _apply_postgresql_fixes(self):
        """Apply fixes specific to PostgreSQL database"""
        with connection.cursor() as cursor:
            # Check Post table
            try:
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_post' AND column_name = 'is_moderated'
                """)
                if not cursor.fetchone():
                    logger.info("Adding missing is_moderated column to chat_post table...")
                    cursor.execute("ALTER TABLE chat_post ADD COLUMN is_moderated BOOLEAN DEFAULT FALSE")
                    cursor.execute("ALTER TABLE chat_post ADD COLUMN moderation_passed BOOLEAN DEFAULT TRUE")
            except Exception as e:
                logger.error(f"Error adding columns to Post: {e}")
            
            # Check PostImage table
            try:
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_postimage' AND column_name = 'is_moderated'
                """)
                if not cursor.fetchone():
                    logger.info("Adding missing columns to PostImage table...")
                    cursor.execute("ALTER TABLE chat_postimage ADD COLUMN is_moderated BOOLEAN DEFAULT FALSE")
                    cursor.execute("ALTER TABLE chat_postimage ADD COLUMN moderation_passed BOOLEAN DEFAULT TRUE")
            except Exception as e:
                logger.error(f"Error adding columns to PostImage: {e}")
            
            # Check PostVideo table
            try:
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_postvideo' AND column_name = 'is_moderated'
                """)
                if not cursor.fetchone():
                    logger.info("Adding missing columns to PostVideo table...")
                    cursor.execute("ALTER TABLE chat_postvideo ADD COLUMN is_moderated BOOLEAN DEFAULT FALSE")
                    cursor.execute("ALTER TABLE chat_postvideo ADD COLUMN moderation_passed BOOLEAN DEFAULT TRUE")
            except Exception as e:
                logger.error(f"Error adding columns to PostVideo: {e}")
            
            # Check Message table
            try:
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_message' AND column_name = 'is_image_moderated'
                """)
                if not cursor.fetchone():
                    logger.info("Adding missing columns to Message table...")
                    cursor.execute("ALTER TABLE chat_message ADD COLUMN is_image_moderated BOOLEAN DEFAULT FALSE")
                    cursor.execute("ALTER TABLE chat_message ADD COLUMN image_moderation_passed BOOLEAN DEFAULT TRUE")
                    cursor.execute("ALTER TABLE chat_message ADD COLUMN is_video_moderated BOOLEAN DEFAULT FALSE")
                    cursor.execute("ALTER TABLE chat_message ADD COLUMN video_moderation_passed BOOLEAN DEFAULT TRUE")
            except Exception as e:
                logger.error(f"Error adding columns to Message: {e}")
    
    def _apply_generic_fixes(self):
        """Apply fixes using Django ORM approach"""
        from django.db import models
        from django.db.models import Q
        from django.db.migrations.operations.fields import AddField
        from django.db.migrations.state import ProjectState
        
        tables_to_fix = [
            ('chat_post', [
                ('is_moderated', models.BooleanField(default=False)),
                ('moderation_passed', models.BooleanField(default=True))
            ]),
            ('chat_postimage', [
                ('is_moderated', models.BooleanField(default=False)),
                ('moderation_passed', models.BooleanField(default=True))
            ]),
            ('chat_postvideo', [
                ('is_moderated', models.BooleanField(default=False)),
                ('moderation_passed', models.BooleanField(default=True))
            ]),
            ('chat_message', [
                ('is_image_moderated', models.BooleanField(default=False)),
                ('image_moderation_passed', models.BooleanField(default=True)),
                ('is_video_moderated', models.BooleanField(default=False)),
                ('video_moderation_passed', models.BooleanField(default=True))
            ])
        ]
        
        with connection.cursor() as cursor:
            for table_name, fields in tables_to_fix:
                for field_name, field_instance in fields:
                    try:
                        # Try a simple direct approach
                        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {field_name} boolean")
                        # Set default values
                        default_value = "TRUE" if field_name.endswith("_passed") else "FALSE"
                        cursor.execute(f"UPDATE {table_name} SET {field_name} = {default_value}")
                        logger.info(f"Added column {field_name} to {table_name}")
                    except Exception as e:
                        # Column might already exist or other issue
                        logger.info(f"Couldn't add column {field_name} to {table_name}: {e}")
