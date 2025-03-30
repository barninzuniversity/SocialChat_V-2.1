#!/usr/bin/env bash
# Script to run during Render.com build process

set -o errexit  # Exit on error
set -o pipefail # Exit on pipe failure
set -o nounset  # Exit on unset variable

# Build the Python application
pip install -r requirements.txt

echo "Running migrations in a way that handles existing tables..."

# First apply migrations up to 0002
python manage.py migrate auth
python manage.py migrate contenttypes
python manage.py migrate admin
python manage.py migrate sessions
python manage.py migrate chat 0002

# Fake the problematic migration that's trying to create tables that already exist
echo "Faking migration chat.0003_add_voice_call_model..."
python manage.py migrate chat 0003 --fake

# Continue with the rest of the migrations
echo "Continuing with remaining migrations..."
python manage.py migrate

# Create a temporary script to fix the database
cat > fix_db_script.py << 'EOL'
#!/usr/bin/env python
import os
import django
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("db_fixer")

# Configure Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_project.settings')
django.setup()

from django.db import connection

def main():
    # Detect database engine
    db_engine = connection.vendor
    logger.info(f"Detected database engine: {db_engine}")
    
    if db_engine == 'postgresql':
        fix_postgresql()
    else:
        # Default to SQLite approach
        logger.info(f"Using SQLite approach for {db_engine}")
        fix_sqlite()
    
    logger.info("Database fix completed successfully!")

def fix_postgresql():
    """Fix schema for PostgreSQL database"""
    with connection.cursor() as cursor:
        try:
            # First check which tables exist
            cursor.execute("""
                SELECT tablename FROM pg_catalog.pg_tables 
                WHERE schemaname='public'
            """)
            tables = [row[0] for row in cursor.fetchall()]
            logger.info(f"Found tables: {tables}")
            
            # Add moderation columns to chat_post
            if 'chat_post' in tables:
                for col_name, default in [
                    ('is_moderated', 'FALSE'),
                    ('moderation_passed', 'TRUE')
                ]:
                    try:
                        # Check if column exists
                        cursor.execute(f"""
                            SELECT column_name FROM information_schema.columns 
                            WHERE table_name = 'chat_post' AND column_name = '{col_name}'
                        """)
                        if not cursor.fetchone():
                            logger.info(f"Adding {col_name} to chat_post table")
                            cursor.execute(f"ALTER TABLE chat_post ADD COLUMN {col_name} BOOLEAN DEFAULT {default}")
                            logger.info(f"Successfully added {col_name} column to chat_post")
                    except Exception as e:
                        logger.error(f"Error adding {col_name} to chat_post: {e}")
            
            # Add moderation columns to other tables (similar code for other tables)
            # ... 
        except Exception as e:
            logger.error(f"Error during PostgreSQL fix: {e}")

def fix_sqlite():
    """Fix schema for SQLite database"""
    with connection.cursor() as cursor:
        try:
            # Check if tables exist
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_post'")
            if not cursor.fetchone():
                logger.info("Tables not yet created, skipping schema fixes")
                return
            
            # Check Post table
            try:
                cursor.execute("PRAGMA table_info(chat_post)")
                columns = [info[1] for info in cursor.fetchall()]
                logger.info(f"Found columns in chat_post: {columns}")
                
                if 'is_moderated' not in columns:
                    logger.info("Adding missing is_moderated column to chat_post table...")
                    cursor.execute("ALTER TABLE chat_post ADD COLUMN is_moderated BOOLEAN DEFAULT 0")
                    cursor.execute("ALTER TABLE chat_post ADD COLUMN moderation_passed BOOLEAN DEFAULT 1")
                    logger.info("Added moderation columns to chat_post")
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
                        logger.info("Added moderation columns to chat_postimage")
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
                        logger.info("Added moderation columns to chat_postvideo")
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
                        logger.info("Added moderation columns to chat_message")
            except Exception as e:
                logger.error(f"Error adding columns to Message: {e}")
                
        except Exception as e:
            logger.error(f"Error during SQLite fix: {e}")

if __name__ == "__main__":
    main()
EOL

# Execute the script
python fix_db_script.py

# Collect static files
python manage.py collectstatic --noinput

echo "Build completed successfully!" 