from django.core.management.base import BaseCommand
from django.db import connection
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Fix the database schema by adding missing columns for both SQLite and PostgreSQL'

    def handle(self, *args, **options):
        db_engine = connection.vendor
        self.stdout.write(f"Detected database engine: {db_engine}")
        
        if db_engine == 'sqlite':
            self._fix_sqlite()
        elif db_engine == 'postgresql':
            self._fix_postgresql()
        else:
            self.stdout.write(f"Using generic approach for {db_engine}")
            self._fix_generic()
            
        self.stdout.write(self.style.SUCCESS('Database schema fix completed'))
    
    def _fix_sqlite(self):
        """Fix schema for SQLite database"""
        # Create a cursor
        with connection.cursor() as cursor:
            # Check all columns in the table
            cursor.execute("PRAGMA table_info(chat_message)")
            columns = cursor.fetchall()
            
            # Print all columns for debugging
            self.stdout.write('Existing columns in chat_message table:')
            for col in columns:
                self.stdout.write(f'- {col[1]} ({col[2]})')
            
            # Get just the column names for easier checking
            column_names = [col[1] for col in columns]
            
            # Add video column if it doesn't exist
            if 'video' not in column_names:
                self.stdout.write('Adding video column to chat_message table...')
                cursor.execute('ALTER TABLE chat_message ADD COLUMN video VARCHAR(100) NULL')
                self.stdout.write(self.style.SUCCESS('Successfully added video column'))
            else:
                self.stdout.write('Video column already exists')
            
            # Add voice_message column if it doesn't exist
            if 'voice_message' not in column_names:
                self.stdout.write('Adding voice_message column to chat_message table...')
                cursor.execute('ALTER TABLE chat_message ADD COLUMN voice_message VARCHAR(100) NULL')
                self.stdout.write(self.style.SUCCESS('Successfully added voice_message column'))
            else:
                self.stdout.write('Voice message column already exists')
                
            # Add moderation columns to chat_message table
            for col_name in ['is_image_moderated', 'image_moderation_passed', 'is_video_moderated', 'video_moderation_passed']:
                if col_name not in column_names:
                    self.stdout.write(f'Adding {col_name} column to chat_message table...')
                    cursor.execute(f'ALTER TABLE chat_message ADD COLUMN {col_name} BOOLEAN DEFAULT {"0" if col_name.startswith("is_") else "1"}')
                    self.stdout.write(self.style.SUCCESS(f'Successfully added {col_name} column'))
                else:
                    self.stdout.write(f'{col_name} column already exists')
            
            # Check the Post table moderation fields
            self.stdout.write('Checking chat_post table...')
            cursor.execute("PRAGMA table_info(chat_post)")
            post_columns = [col[1] for col in cursor.fetchall()]
            
            for col_name in ['is_moderated', 'moderation_passed']:
                if col_name not in post_columns:
                    self.stdout.write(f'Adding {col_name} column to chat_post table...')
                    cursor.execute(f'ALTER TABLE chat_post ADD COLUMN {col_name} BOOLEAN DEFAULT {"0" if col_name == "is_moderated" else "1"}')
                    self.stdout.write(self.style.SUCCESS(f'Successfully added {col_name} column'))
                else:
                    self.stdout.write(f'{col_name} column already exists in chat_post')
            
            # Check the PostImage table moderation fields
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_postimage'")
            if cursor.fetchone():
                self.stdout.write('Checking chat_postimage table...')
                cursor.execute("PRAGMA table_info(chat_postimage)")
                postimage_columns = [col[1] for col in cursor.fetchall()]
                
                for col_name in ['is_moderated', 'moderation_passed']:
                    if col_name not in postimage_columns:
                        self.stdout.write(f'Adding {col_name} column to chat_postimage table...')
                        cursor.execute(f'ALTER TABLE chat_postimage ADD COLUMN {col_name} BOOLEAN DEFAULT {"0" if col_name == "is_moderated" else "1"}')
                        self.stdout.write(self.style.SUCCESS(f'Successfully added {col_name} column'))
                    else:
                        self.stdout.write(f'{col_name} column already exists in chat_postimage')
            
            # Check the PostVideo table moderation fields
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_postvideo'")
            if cursor.fetchone():
                self.stdout.write('Checking chat_postvideo table...')
                cursor.execute("PRAGMA table_info(chat_postvideo)")
                postvideo_columns = [col[1] for col in cursor.fetchall()]
                
                for col_name in ['is_moderated', 'moderation_passed']:
                    if col_name not in postvideo_columns:
                        self.stdout.write(f'Adding {col_name} column to chat_postvideo table...')
                        cursor.execute(f'ALTER TABLE chat_postvideo ADD COLUMN {col_name} BOOLEAN DEFAULT {"0" if col_name == "is_moderated" else "1"}')
                        self.stdout.write(self.style.SUCCESS(f'Successfully added {col_name} column'))
                    else:
                        self.stdout.write(f'{col_name} column already exists in chat_postvideo')
    
    def _fix_postgresql(self):
        """Fix schema for PostgreSQL database"""
        with connection.cursor() as cursor:
            # Check Message table moderation fields
            self.stdout.write('Checking chat_message table in PostgreSQL...')
            
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
                        self.stdout.write(f'Adding {col_name} column to chat_message table...')
                        cursor.execute(f'ALTER TABLE chat_message ADD COLUMN {col_name} {col_type} NULL')
                        self.stdout.write(self.style.SUCCESS(f'Successfully added {col_name} column'))
                    else:
                        self.stdout.write(f'{col_name} column already exists')
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f'Error adding {col_name} column: {e}'))
            
            # Add moderation columns to chat_message table
            for col_name in ['is_image_moderated', 'image_moderation_passed', 'is_video_moderated', 'video_moderation_passed']:
                try:
                    cursor.execute(f"""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'chat_message' AND column_name = '{col_name}'
                    """)
                    if not cursor.fetchone():
                        self.stdout.write(f'Adding {col_name} column to chat_message table...')
                        default_val = "FALSE" if col_name.startswith("is_") else "TRUE"
                        cursor.execute(f'ALTER TABLE chat_message ADD COLUMN {col_name} BOOLEAN DEFAULT {default_val}')
                        self.stdout.write(self.style.SUCCESS(f'Successfully added {col_name} column'))
                    else:
                        self.stdout.write(f'{col_name} column already exists')
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f'Error adding {col_name} column: {e}'))
            
            # Check the Post table moderation fields
            self.stdout.write('Checking chat_post table...')
            for col_name in ['is_moderated', 'moderation_passed']:
                try:
                    cursor.execute(f"""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'chat_post' AND column_name = '{col_name}'
                    """)
                    if not cursor.fetchone():
                        self.stdout.write(f'Adding {col_name} column to chat_post table...')
                        default_val = "FALSE" if col_name == "is_moderated" else "TRUE"
                        cursor.execute(f'ALTER TABLE chat_post ADD COLUMN {col_name} BOOLEAN DEFAULT {default_val}')
                        self.stdout.write(self.style.SUCCESS(f'Successfully added {col_name} column'))
                    else:
                        self.stdout.write(f'{col_name} column already exists in chat_post')
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f'Error adding {col_name} column to chat_post: {e}'))
            
            # Check the PostImage table moderation fields
            self.stdout.write('Checking chat_postimage table...')
            for col_name in ['is_moderated', 'moderation_passed']:
                try:
                    cursor.execute(f"""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'chat_postimage' AND column_name = '{col_name}'
                    """)
                    if not cursor.fetchone():
                        self.stdout.write(f'Adding {col_name} column to chat_postimage table...')
                        default_val = "FALSE" if col_name == "is_moderated" else "TRUE"
                        cursor.execute(f'ALTER TABLE chat_postimage ADD COLUMN {col_name} BOOLEAN DEFAULT {default_val}')
                        self.stdout.write(self.style.SUCCESS(f'Successfully added {col_name} column'))
                    else:
                        self.stdout.write(f'{col_name} column already exists in chat_postimage')
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f'Error adding {col_name} column to chat_postimage: {e}'))
            
            # Check the PostVideo table moderation fields
            self.stdout.write('Checking chat_postvideo table...')
            for col_name in ['is_moderated', 'moderation_passed']:
                try:
                    cursor.execute(f"""
                        SELECT column_name FROM information_schema.columns 
                        WHERE table_name = 'chat_postvideo' AND column_name = '{col_name}'
                    """)
                    if not cursor.fetchone():
                        self.stdout.write(f'Adding {col_name} column to chat_postvideo table...')
                        default_val = "FALSE" if col_name == "is_moderated" else "TRUE"
                        cursor.execute(f'ALTER TABLE chat_postvideo ADD COLUMN {col_name} BOOLEAN DEFAULT {default_val}')
                        self.stdout.write(self.style.SUCCESS(f'Successfully added {col_name} column'))
                    else:
                        self.stdout.write(f'{col_name} column already exists in chat_postvideo')
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f'Error adding {col_name} column to chat_postvideo: {e}'))
    
    def _fix_generic(self):
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
                self.stdout.write(f'Checking {table_name} table...')
                for col_name, col_def in columns:
                    try:
                        # Try to add the column - this is a simplified approach that will fail if column exists
                        cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}')
                        self.stdout.write(self.style.SUCCESS(f'Added {col_name} column to {table_name}'))
                    except Exception as e:
                        # Most likely the column already exists or other issue
                        self.stdout.write(f'Could not add {col_name} to {table_name}: {e}') 