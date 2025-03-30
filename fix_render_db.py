#!/usr/bin/env python
import os
import sys
import django
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_project.settings')
django.setup()

from django.db import connection

def main():
    """Fix database schema for PostgreSQL database on Render.com"""
    try:
        # Detect database type
        db_engine = connection.vendor
        logger.info(f"Detected database engine: {db_engine}")
        
        if db_engine == 'postgresql':
            fix_postgresql()
        else:
            logger.warning(f"Unexpected database engine: {db_engine}. Render.com typically uses PostgreSQL.")
            fix_generic()
            
        logger.info("Database schema fix completed successfully")
        return 0
    except Exception as e:
        logger.error(f"Error fixing database: {str(e)}")
        return 1

def fix_postgresql():
    """Fix schema for PostgreSQL database"""
    with connection.cursor() as cursor:
        # Check Message table moderation fields
        logger.info('Checking chat_message table in PostgreSQL...')
        
        # Check and add video and voice_message columns
        for col_name, col_type in [
            ('video', 'VARCHAR(100)'), 
            ('voice_message', 'VARCHAR(100)')
        ]:
            try:
                cursor.execute(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_message' AND column_name = '{col_name}'
                """)
                if not cursor.fetchone():
                    logger.info(f'Adding {col_name} column to chat_message table...')
                    cursor.execute(f'ALTER TABLE chat_message ADD COLUMN {col_name} {col_type} NULL')
                    logger.info(f'Successfully added {col_name} column')
                else:
                    logger.info(f'{col_name} column already exists')
            except Exception as e:
                logger.error(f'Error adding {col_name} column: {e}')
        
        # Add moderation columns to chat_message table
        for col_name in ['is_image_moderated', 'image_moderation_passed', 'is_video_moderated', 'video_moderation_passed']:
            try:
                cursor.execute(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_message' AND column_name = '{col_name}'
                """)
                if not cursor.fetchone():
                    logger.info(f'Adding {col_name} column to chat_message table...')
                    default_val = "FALSE" if col_name.startswith("is_") else "TRUE"
                    cursor.execute(f'ALTER TABLE chat_message ADD COLUMN {col_name} BOOLEAN DEFAULT {default_val}')
                    logger.info(f'Successfully added {col_name} column')
                else:
                    logger.info(f'{col_name} column already exists')
            except Exception as e:
                logger.error(f'Error adding {col_name} column: {e}')
        
        # Check the Post table moderation fields
        logger.info('Checking chat_post table...')
        for col_name in ['is_moderated', 'moderation_passed']:
            try:
                cursor.execute(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_post' AND column_name = '{col_name}'
                """)
                if not cursor.fetchone():
                    logger.info(f'Adding {col_name} column to chat_post table...')
                    default_val = "FALSE" if col_name == "is_moderated" else "TRUE"
                    cursor.execute(f'ALTER TABLE chat_post ADD COLUMN {col_name} BOOLEAN DEFAULT {default_val}')
                    logger.info(f'Successfully added {col_name} column')
                else:
                    logger.info(f'{col_name} column already exists in chat_post')
            except Exception as e:
                logger.error(f'Error adding {col_name} column to chat_post: {e}')
        
        # Check the PostImage table moderation fields
        logger.info('Checking chat_postimage table...')
        for col_name in ['is_moderated', 'moderation_passed']:
            try:
                cursor.execute(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_postimage' AND column_name = '{col_name}'
                """)
                if not cursor.fetchone():
                    logger.info(f'Adding {col_name} column to chat_postimage table...')
                    default_val = "FALSE" if col_name == "is_moderated" else "TRUE"
                    cursor.execute(f'ALTER TABLE chat_postimage ADD COLUMN {col_name} BOOLEAN DEFAULT {default_val}')
                    logger.info(f'Successfully added {col_name} column')
                else:
                    logger.info(f'{col_name} column already exists in chat_postimage')
            except Exception as e:
                logger.error(f'Error adding {col_name} column to chat_postimage: {e}')
        
        # Check the PostVideo table moderation fields
        logger.info('Checking chat_postvideo table...')
        for col_name in ['is_moderated', 'moderation_passed']:
            try:
                cursor.execute(f"""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_postvideo' AND column_name = '{col_name}'
                """)
                if not cursor.fetchone():
                    logger.info(f'Adding {col_name} column to chat_postvideo table...')
                    default_val = "FALSE" if col_name == "is_moderated" else "TRUE"
                    cursor.execute(f'ALTER TABLE chat_postvideo ADD COLUMN {col_name} BOOLEAN DEFAULT {default_val}')
                    logger.info(f'Successfully added {col_name} column')
                else:
                    logger.info(f'{col_name} column already exists in chat_postvideo')
            except Exception as e:
                logger.error(f'Error adding {col_name} column to chat_postvideo: {e}')

def fix_generic():
    """Generic database fix approach"""
    with connection.cursor() as cursor:
        for table_name, columns in [
            ('chat_message', [
                ('video', 'VARCHAR(100) NULL'),
                ('voice_message', 'VARCHAR(100) NULL'),
                ('is_image_moderated', 'BOOLEAN DEFAULT FALSE'),
                ('image_moderation_passed', 'BOOLEAN DEFAULT TRUE'),
                ('is_video_moderated', 'BOOLEAN DEFAULT FALSE'),
                ('video_moderation_passed', 'BOOLEAN DEFAULT TRUE')
            ]),
            ('chat_post', [
                ('is_moderated', 'BOOLEAN DEFAULT FALSE'),
                ('moderation_passed', 'BOOLEAN DEFAULT TRUE')
            ]),
            ('chat_postimage', [
                ('is_moderated', 'BOOLEAN DEFAULT FALSE'),
                ('moderation_passed', 'BOOLEAN DEFAULT TRUE')
            ]),
            ('chat_postvideo', [
                ('is_moderated', 'BOOLEAN DEFAULT FALSE'),
                ('moderation_passed', 'BOOLEAN DEFAULT TRUE')
            ])
        ]:
            logger.info(f'Checking {table_name} table...')
            for col_name, col_def in columns:
                try:
                    # Try to add the column - this is a simplified approach that will fail if column exists
                    cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}')
                    logger.info(f'Added {col_name} column to {table_name}')
                except Exception as e:
                    # Most likely the column already exists or other issue
                    logger.info(f'Could not add {col_name} to {table_name}: {e}')

if __name__ == "__main__":
    sys.exit(main()) 