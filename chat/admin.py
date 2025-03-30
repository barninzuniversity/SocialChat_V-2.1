from django.contrib import admin
from django.utils.html import format_html
from .models import (Profile, FriendRequest, Post, PostImage, PostVideo, 
                    ChatRoom, Message, BlockedPost, ContentModerationStatus)

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'bio')
    search_fields = ('user__username', 'bio')
    filter_horizontal = ('friends', 'blocked_users')

@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
    list_display = ('from_user', 'to_user', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('from_user__user__username', 'to_user__user__username')

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('author', 'content', 'created_at', 'is_moderated', 'moderation_status')
    search_fields = ('author__user__username', 'content')
    list_filter = ('created_at', 'is_moderated', 'moderation_passed')
    
    def moderation_status(self, obj):
        if not obj.is_moderated:
            return format_html('<span style="color: orange;">Pending</span>')
        elif obj.moderation_passed:
            return format_html('<span style="color: green;">Approved</span>')
        else:
            return format_html('<span style="color: red;">Rejected</span>')
    
    moderation_status.short_description = 'Moderation'

@admin.register(PostImage)
class PostImageAdmin(admin.ModelAdmin):
    list_display = ('post', 'image_preview', 'created_at', 'is_moderated', 'moderation_status')
    list_filter = ('is_moderated', 'moderation_passed', 'created_at')
    search_fields = ('post__content', 'post__author__user__username')
    
    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" width="100" />', obj.image.url)
        return "No image"
    
    def moderation_status(self, obj):
        if not obj.is_moderated:
            return format_html('<span style="color: orange;">Pending</span>')
        elif obj.moderation_passed:
            return format_html('<span style="color: green;">Approved</span>')
        else:
            return format_html('<span style="color: red;">Rejected</span>')
    
    image_preview.short_description = 'Image'
    moderation_status.short_description = 'Moderation'

@admin.register(PostVideo)
class PostVideoAdmin(admin.ModelAdmin):
    list_display = ('post', 'video', 'created_at', 'is_moderated', 'moderation_status')
    list_filter = ('is_moderated', 'moderation_passed', 'created_at')
    search_fields = ('post__content', 'post__author__user__username')
    
    def moderation_status(self, obj):
        if not obj.is_moderated:
            return format_html('<span style="color: orange;">Pending</span>')
        elif obj.moderation_passed:
            return format_html('<span style="color: green;">Approved</span>')
        else:
            return format_html('<span style="color: red;">Rejected</span>')
    
    moderation_status.short_description = 'Moderation'

@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_group_chat', 'created_at')
    list_filter = ('is_group_chat',)
    filter_horizontal = ('participants',)

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'room', 'content', 'timestamp', 'is_read', 'moderation_status')
    list_filter = ('is_read', 'timestamp', 'is_image_moderated', 'image_moderation_passed', 
                  'is_video_moderated', 'video_moderation_passed')
    search_fields = ('sender__user__username', 'content')
    
    def moderation_status(self, obj):
        statuses = []
        if obj.image:
            if not obj.is_image_moderated:
                statuses.append('Image: Pending')
            elif obj.image_moderation_passed:
                statuses.append('Image: ✓')
            else:
                statuses.append('Image: ✗')
                
        if obj.video:
            if not obj.is_video_moderated:
                statuses.append('Video: Pending')
            elif obj.video_moderation_passed:
                statuses.append('Video: ✓')
            else:
                statuses.append('Video: ✗')
                
        return ', '.join(statuses) if statuses else 'No media'
    
    moderation_status.short_description = 'Media Moderation'

@admin.register(BlockedPost)
class BlockedPostAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'blocked_at', 'reason')
    search_fields = ('user__user__username', 'post__content', 'reason')
    list_filter = ('blocked_at',)

@admin.register(ContentModerationStatus)
class ContentModerationStatusAdmin(admin.ModelAdmin):
    list_display = ('content_type', 'content_id', 'status', 'moderation_date', 'rejection_reason')
    list_filter = ('status', 'content_type', 'moderation_date')
    search_fields = ('content_id', 'rejection_reason')
    readonly_fields = ('content_data_display',)
    
    def content_data_display(self, obj):
        """Format JSON data for the admin view"""
        if not obj.moderation_data:
            return "No moderation data"
        
        html = "<table>"
        for key, value in obj.moderation_data.items():
            if isinstance(value, (int, float)):
                # Format scores with color coding
                if value > 0.8:
                    color = "red"
                elif value > 0.6:
                    color = "orange"
                elif value > 0.4:
                    color = "yellow"
                else:
                    color = "green"
                    
                value_display = f'<span style="color: {color}">{value:.2f}</span>'
            else:
                value_display = str(value)
                
            html += f"<tr><td><b>{key}</b></td><td>{value_display}</td></tr>"
        html += "</table>"
        
        return format_html(html)
    
    content_data_display.short_description = "Moderation Data"
