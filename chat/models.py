from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone
import logging

# Import needed for moderation
from .content_moderation import moderate_image, moderate_video

logger = logging.getLogger(__name__)

def get_default_avatar_path():
    return 'avatars/default.png'

# Add ContentModerationStatus model
class ContentModerationStatus(models.Model):
    """
    Model to track the moderation status of content (images, videos)
    """
    MODERATION_STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('error', 'Error Processing'),
    ]
    
    CONTENT_TYPE_CHOICES = [
        ('post_image', 'Post Image'),
        ('post_video', 'Post Video'),
        ('message_image', 'Message Image'),
        ('message_video', 'Message Video'),
        ('avatar', 'Profile Avatar'),
        ('comment', 'Comment'),
    ]
    
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)
    content_id = models.PositiveIntegerField()  # ID of the related content
    status = models.CharField(max_length=10, choices=MODERATION_STATUS_CHOICES, default='pending')
    moderation_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=50, blank=True, null=True)
    moderation_data = models.JSONField(default=dict, blank=True)  # Store detailed moderation results
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.content_type} ({self.content_id}): {self.status}"

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    avatar = models.ImageField(upload_to='avatars/', default=get_default_avatar_path)
    bio = models.TextField(max_length=500, blank=True)
    friends = models.ManyToManyField('self', symmetrical=True, blank=True)
    blocked_users = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='blocked_by')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}'s Profile"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()

class FriendRequest(models.Model):
    from_user = models.ForeignKey(Profile, related_name='sent_requests', on_delete=models.CASCADE)
    to_user = models.ForeignKey(Profile, related_name='received_requests', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    
    class Meta:
        unique_together = ('from_user', 'to_user')
    
    def __str__(self):
        return f"{self.from_user.user.username} → {self.to_user.user.username}"

class Post(models.Model):
    author = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Moderation fields
    is_moderated = models.BooleanField(default=False)
    moderation_passed = models.BooleanField(default=True)  # Innocent until proven guilty
    
    def __str__(self):
        return f"{self.author.user.username}: {self.content[:30]}..."

class PostImage(models.Model):
    """Model for post images allowing multiple images per post"""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='post_images/')
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Moderation fields
    is_moderated = models.BooleanField(default=False)
    moderation_passed = models.BooleanField(default=True)  # Default to visible until moderated
    
    def __str__(self):
        return f"Image for {self.post}"

class PostVideo(models.Model):
    """Model for post videos allowing multiple videos per post"""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='videos')
    video = models.FileField(upload_to='post_videos/')
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Moderation fields
    is_moderated = models.BooleanField(default=False)
    moderation_passed = models.BooleanField(default=True)  # Default to visible until moderated
    
    def __str__(self):
        return f"Video for {self.post}"

# Reaction types for posts and comments
REACTION_TYPES = [
    ('like', 'Like'),
    ('love', 'Love'),
    ('haha', 'Haha'),
    ('wow', 'Wow'),
    ('sad', 'Sad'),
    ('angry', 'Angry')
]

class PostReaction(models.Model):
    """Model for post reactions"""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(Profile, on_delete=models.CASCADE)
    reaction_type = models.CharField(max_length=10, choices=REACTION_TYPES, default='like')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('post', 'user')
    
    def __str__(self):
        return f"{self.user.user.username} {self.reaction_type}d {self.post}"

class Comment(models.Model):
    """Model for post comments"""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(Profile, on_delete=models.CASCADE)
    content = models.TextField()
    parent_comment = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_hidden = models.BooleanField(default=False)  # For moderation purposes
    
    def __str__(self):
        return f"Comment by {self.author.user.username} on {self.post}"

class CommentReaction(models.Model):
    """Model for comment reactions"""
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(Profile, on_delete=models.CASCADE)
    reaction_type = models.CharField(max_length=10, choices=REACTION_TYPES, default='like')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('comment', 'user')
    
    def __str__(self):
        return f"{self.user.user.username} {self.reaction_type}d {self.comment}"

class PostShare(models.Model):
    """Model for post shares with friends"""
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='post_shares')
    shared_by = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='posts_shared')
    shared_with = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='posts_shared_with_me')
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_public = models.BooleanField(default=False)
    
    def __str__(self):
        return f"{self.shared_by.user.username} shared {self.post} with {self.shared_with.user.username}"

class Repost(models.Model):
    """Model for post reposts"""
    original_post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reposts')
    repost = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='repost_of')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Repost of {self.original_post} by {self.repost.author.user.username}"

class ChatRoom(models.Model):
    name = models.CharField(max_length=100, blank=True)
    participants = models.ManyToManyField(Profile, related_name='chat_rooms')
    is_group_chat = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        if self.is_group_chat:
            return self.name
        participants_list = list(self.participants.all())
        if len(participants_list) >= 2:
            return f"Chat between {participants_list[0].user.username} and {participants_list[1].user.username}"
        return "Empty chat"

class Message(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField(blank=True)
    image = models.ImageField(upload_to='messages/images/', blank=True, null=True)
    video = models.FileField(upload_to='messages/videos/', blank=True, null=True)
    file = models.FileField(upload_to='messages/files/', blank=True, null=True)
    voice_message = models.FileField(upload_to='messages/voice/', blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    
    # Moderation fields
    is_image_moderated = models.BooleanField(default=False)
    image_moderation_passed = models.BooleanField(default=True)
    is_video_moderated = models.BooleanField(default=False)
    video_moderation_passed = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['timestamp']
    
    def __str__(self):
        return f"{self.sender.user.username}: {self.content[:30]}..."

class MessageReaction(models.Model):
    """Model for message reactions"""
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(Profile, on_delete=models.CASCADE)
    reaction = models.CharField(max_length=10, default='👍')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('message', 'user', 'reaction')
    
    def __str__(self):
        return f"{self.user.user.username} reacted with {self.reaction} to {self.message}"
        
    @property
    def count(self):
        return MessageReaction.objects.filter(message=self.message, reaction=self.reaction).count()

class BlockedPost(models.Model):
    """Model to track blocked posts by users"""
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='blocked_posts')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='blocked_by')
    blocked_at = models.DateTimeField(auto_now_add=True)
    reason = models.CharField(max_length=100, blank=True, null=True)
    
    class Meta:
        unique_together = ('user', 'post')
        
    def __str__(self):
        return f"{self.user.user.username} blocked {self.post}"

# Signal handlers for content moderation
@receiver(post_save, sender=PostImage)
def moderate_post_image(sender, instance, created, **kwargs):
    """Moderate newly uploaded post images"""
    if created and instance.image:
        try:
            is_safe, confidence, categories = moderate_image(instance.image)
            
            # Create moderation status
            moderation = ContentModerationStatus.objects.create(
                content_type='post_image',
                content_id=instance.id,
                status='approved' if is_safe else 'rejected',
                moderation_date=timezone.now(),
                rejection_reason='Inappropriate content detected' if not is_safe else None,
                moderation_data=categories
            )
            
            # Update the image moderation status - use try/except in case the column doesn't exist yet
            try:
                instance.is_moderated = True
                instance.moderation_passed = is_safe
                instance.save(update_fields=['is_moderated', 'moderation_passed'])
                
                # Update the post status if the image failed moderation
                if not is_safe:
                    post = instance.post
                    post.moderation_passed = False
                    post.is_moderated = True
                    post.save(update_fields=['is_moderated', 'moderation_passed'])
                    
                    # Create a blocked post entry for the admin
                    BlockedPost.objects.create(
                        user=Profile.objects.filter(user__is_superuser=True).first(),
                        post=post,
                        reason=f"Automatic block: Inappropriate image (score: {confidence})"
                    )
                    
                    logger.warning(f"Post {post.id} blocked due to inappropriate image content")
            except Exception as e:
                logger.error(f"Error updating moderation status: {str(e)}. Database may need migration.")
        
        except Exception as e:
            logger.error(f"Error processing image moderation for PostImage {instance.id}: {str(e)}")
            ContentModerationStatus.objects.create(
                content_type='post_image',
                content_id=instance.id,
                status='error',
                moderation_date=timezone.now(),
                rejection_reason=str(e)[:50],
                moderation_data={"error": str(e)}
            )

@receiver(post_save, sender=PostVideo)
def moderate_post_video(sender, instance, created, **kwargs):
    """Moderate newly uploaded post videos"""
    if created and instance.video:
        try:
            is_safe, confidence, categories = moderate_video(instance.video)
            
            # Create moderation status
            moderation = ContentModerationStatus.objects.create(
                content_type='post_video',
                content_id=instance.id,
                status='approved' if is_safe else 'rejected',
                moderation_date=timezone.now(),
                rejection_reason='Inappropriate content detected' if not is_safe else None,
                moderation_data=categories
            )
            
            # Update the video moderation status - use try/except in case the column doesn't exist yet
            try:
                instance.is_moderated = True
                instance.moderation_passed = is_safe
                instance.save(update_fields=['is_moderated', 'moderation_passed'])
                
                # Update the post status if the video failed moderation
                if not is_safe:
                    post = instance.post
                    post.moderation_passed = False
                    post.is_moderated = True
                    post.save(update_fields=['is_moderated', 'moderation_passed'])
                    
                    # Create a blocked post entry for the admin
                    BlockedPost.objects.create(
                        user=Profile.objects.filter(user__is_superuser=True).first(),
                        post=post,
                        reason=f"Automatic block: Inappropriate video (score: {confidence})"
                    )
                    
                    logger.warning(f"Post {post.id} blocked due to inappropriate video content")
            except Exception as e:
                logger.error(f"Error updating moderation status: {str(e)}. Database may need migration.")
        
        except Exception as e:
            logger.error(f"Error processing video moderation for PostVideo {instance.id}: {str(e)}")
            ContentModerationStatus.objects.create(
                content_type='post_video',
                content_id=instance.id,
                status='error',
                moderation_date=timezone.now(),
                rejection_reason=str(e)[:50],
                moderation_data={"error": str(e)}
            )

@receiver(post_save, sender=Message)
def moderate_message_media(sender, instance, created, **kwargs):
    """Moderate media in messages"""
    if created:
        # Check for image
        if instance.image:
            try:
                is_safe, confidence, categories = moderate_image(instance.image)
                
                # Create moderation status
                ContentModerationStatus.objects.create(
                    content_type='message_image',
                    content_id=instance.id,
                    status='approved' if is_safe else 'rejected',
                    moderation_date=timezone.now(),
                    rejection_reason='Inappropriate content detected' if not is_safe else None,
                    moderation_data=categories
                )
                
                # Update message status - use try/except in case the column doesn't exist yet
                try:
                    instance.is_image_moderated = True
                    instance.image_moderation_passed = is_safe
                    instance.save(update_fields=['is_image_moderated', 'image_moderation_passed'])
                    
                    if not is_safe:
                        logger.warning(f"Message {instance.id} contained inappropriate image")
                except Exception as e:
                    logger.error(f"Error updating image moderation status: {str(e)}. Database may need migration.")
            
            except Exception as e:
                logger.error(f"Error processing image moderation for Message {instance.id}: {str(e)}")
                ContentModerationStatus.objects.create(
                    content_type='message_image',
                    content_id=instance.id,
                    status='error',
                    moderation_date=timezone.now(),
                    rejection_reason=str(e)[:50],
                    moderation_data={"error": str(e)}
                )
        
        # Check for video
        if instance.video:
            try:
                is_safe, confidence, categories = moderate_video(instance.video)
                
                # Create moderation status
                ContentModerationStatus.objects.create(
                    content_type='message_video',
                    content_id=instance.id,
                    status='approved' if is_safe else 'rejected',
                    moderation_date=timezone.now(),
                    rejection_reason='Inappropriate content detected' if not is_safe else None,
                    moderation_data=categories
                )
                
                # Update message status - use try/except in case the column doesn't exist yet
                try:
                    instance.is_video_moderated = True
                    instance.video_moderation_passed = is_safe
                    instance.save(update_fields=['is_video_moderated', 'video_moderation_passed'])
                    
                    if not is_safe:
                        logger.warning(f"Message {instance.id} contained inappropriate video")
                except Exception as e:
                    logger.error(f"Error updating video moderation status: {str(e)}. Database may need migration.")
            
            except Exception as e:
                logger.error(f"Error processing video moderation for Message {instance.id}: {str(e)}")
                ContentModerationStatus.objects.create(
                    content_type='message_video',
                    content_id=instance.id,
                    status='error',
                    moderation_date=timezone.now(),
                    rejection_reason=str(e)[:50],
                    moderation_data={"error": str(e)}
                )

# Continue with your existing models...
class FriendList(models.Model):
    """Model to manage user friends list"""
    user = models.OneToOneField(Profile, on_delete=models.CASCADE, related_name='friends_list')
    friends = models.ManyToManyField(Profile, blank=True, related_name='friends_of')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.user.username}'s Friends List"

class VoiceCall(models.Model):
    """Model for voice calls between users"""
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='voice_calls')
    initiator = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='initiated_calls')
    participants = models.ManyToManyField(Profile, related_name='voice_call_participants')
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('initiated', 'Initiated'),
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
        ('missed', 'Missed'),
        ('declined', 'Declined')
    ], default='initiated')
    
    def __str__(self):
        return f"Call from {self.initiator.user.username} at {self.start_time}"
    
    @property
    def duration(self):
        if self.end_time and self.status == 'completed':
            return (self.end_time - self.start_time).total_seconds()
        return None

class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_notifications')
    message = models.TextField()
    notification_type = models.CharField(max_length=50)  # e.g., 'message', 'like', 'comment'
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    related_object_id = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
