from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0002_add_video_voice_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='VoiceCall',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_time', models.DateTimeField(auto_now_add=True)),
                ('end_time', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('initiated', 'Initiated'), ('ongoing', 'Ongoing'), ('completed', 'Completed'), ('missed', 'Missed'), ('declined', 'Declined')], default='initiated', max_length=20)),
                ('initiator', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='initiated_calls', to='chat.profile')),
                ('participants', models.ManyToManyField(related_name='voice_call_participants', to='chat.profile')),
                ('room', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='voice_calls', to='chat.chatroom')),
            ],
        ),
    ] 