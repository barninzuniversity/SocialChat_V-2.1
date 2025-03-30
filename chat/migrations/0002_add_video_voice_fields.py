from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0001_initial'),  # Updated to reference the correct dependency
    ]

    operations = [
        # Empty operations - these fields already exist in the initial migration
    ] 