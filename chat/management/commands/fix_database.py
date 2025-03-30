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