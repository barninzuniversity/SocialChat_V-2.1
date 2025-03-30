from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0004_remove_post_image_remove_post_video_postvideo_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='is_moderated',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='post',
            name='moderation_passed',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='postimage',
            name='is_moderated',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='postimage',
            name='moderation_passed',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='postvideo',
            name='is_moderated',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='postvideo',
            name='moderation_passed',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='message',
            name='is_image_moderated',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='message',
            name='image_moderation_passed',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='message',
            name='is_video_moderated',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='message',
            name='video_moderation_passed',
            field=models.BooleanField(default=True),
        ),
    ] 