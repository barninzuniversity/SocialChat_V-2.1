from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Fix the database schema by adding missing columns'

    def handle(self, *args, **options):
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
                        
            self.stdout.write(self.style.SUCCESS('Database schema fix completed')) 