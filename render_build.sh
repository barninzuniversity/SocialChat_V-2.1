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
    logger.info("Starting database fix for PostgreSQL on Render.com")
    
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
            
            # Add moderation columns to chat_postimage
            if 'chat_postimage' in tables:
                for col_name, default in [
                    ('is_moderated', 'FALSE'),
                    ('moderation_passed', 'TRUE')
                ]:
                    try:
                        # Check if column exists
                        cursor.execute(f"""
                            SELECT column_name FROM information_schema.columns 
                            WHERE table_name = 'chat_postimage' AND column_name = '{col_name}'
                        """)
                        if not cursor.fetchone():
                            logger.info(f"Adding {col_name} to chat_postimage table")
                            cursor.execute(f"ALTER TABLE chat_postimage ADD COLUMN {col_name} BOOLEAN DEFAULT {default}")
                            logger.info(f"Successfully added {col_name} column to chat_postimage")
                    except Exception as e:
                        logger.error(f"Error adding {col_name} to chat_postimage: {e}")
            
            # Add moderation columns to chat_postvideo
            if 'chat_postvideo' in tables:
                for col_name, default in [
                    ('is_moderated', 'FALSE'),
                    ('moderation_passed', 'TRUE')
                ]:
                    try:
                        # Check if column exists
                        cursor.execute(f"""
                            SELECT column_name FROM information_schema.columns 
                            WHERE table_name = 'chat_postvideo' AND column_name = '{col_name}'
                        """)
                        if not cursor.fetchone():
                            logger.info(f"Adding {col_name} to chat_postvideo table")
                            cursor.execute(f"ALTER TABLE chat_postvideo ADD COLUMN {col_name} BOOLEAN DEFAULT {default}")
                            logger.info(f"Successfully added {col_name} column to chat_postvideo")
                    except Exception as e:
                        logger.error(f"Error adding {col_name} to chat_postvideo: {e}")
            
            # Add moderation columns to chat_message
            if 'chat_message' in tables:
                for col_name, default in [
                    ('is_image_moderated', 'FALSE'),
                    ('image_moderation_passed', 'TRUE'),
                    ('is_video_moderated', 'FALSE'),
                    ('video_moderation_passed', 'TRUE')
                ]:
                    try:
                        # Check if column exists
                        cursor.execute(f"""
                            SELECT column_name FROM information_schema.columns 
                            WHERE table_name = 'chat_message' AND column_name = '{col_name}'
                        """)
                        if not cursor.fetchone():
                            logger.info(f"Adding {col_name} to chat_message table")
                            cursor.execute(f"ALTER TABLE chat_message ADD COLUMN {col_name} BOOLEAN DEFAULT {default}")
                            logger.info(f"Successfully added {col_name} column to chat_message")
                    except Exception as e:
                        logger.error(f"Error adding {col_name} to chat_message: {e}")
            
            logger.info("Database fix completed successfully!")
        except Exception as e:
            logger.error(f"Error during database fix: {e}")
            raise

if __name__ == "__main__":
    main()
EOL

# Execute the script
python fix_db_script.py

# Collect static files
python manage.py collectstatic --noinput

echo "Build completed successfully!" 