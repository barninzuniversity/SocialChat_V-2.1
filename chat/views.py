from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.http import JsonResponse, StreamingHttpResponse, HttpResponseForbidden, HttpResponseBadRequest, HttpResponseNotAllowed, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib import messages
import json, asyncio, time
from datetime import datetime
from channels.db import database_sync_to_async
from .models import Profile, FriendRequest, Post, ChatRoom, Message, BlockedPost, PostReaction, Comment, CommentReaction, PostShare, Repost, FriendList, MessageReaction, VoiceCall, PostImage, PostVideo, ContentModerationStatus
from .forms import ProfileForm, PostForm
from django.db.models.functions import Now
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.backends.signals import connection_created
from django.db.utils import OperationalError
from django.db.models import Q
from django.template.loader import render_to_string
from django.middleware.csrf import get_token
from django.db.utils import IntegrityError
from django.urls import reverse
from django.views.decorators.http import require_POST
from django.utils import timezone
import pytz
import logging
from django.db.models import F
from django.db.models.functions import Concat
from django.db import connection
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

# Dictionary to store message queues for each chat room
message_queues = {}

# Define reaction types
REACTION_TYPES = [
    ('like', '👍'),
    ('love', '❤️'),
    ('haha', '😂'),
    ('wow', '😮'),
    ('sad', '😢'),
    ('angry', '😡'),
]

logger = logging.getLogger(__name__)

# Function to check if user is staff or superuser
def is_moderator(user):
    return user.is_authenticated and (user.is_staff or user.is_superuser)

def signup(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Account created successfully. You can now log in.')
            return redirect('login')
    else:
        form = UserCreationForm()
    return render(request, 'registration/signup.html', {'form': form})

@login_required
def home(request):
    """Display the home feed with posts"""
    user_profile = request.user.profile
    form = PostForm()
    
    # Get friend IDs to filter posts
    friends = user_profile.friends.all()
    friend_ids = [friend.id for friend in friends]
    
    # Get blocked users
    blocked_user_ids = user_profile.blocked_users.values_list('id', flat=True)
    blocked_by_ids = user_profile.blocked_by.values_list('id', flat=True)
    all_blocked_ids = list(blocked_user_ids) + list(blocked_by_ids)
    
    # Query posts from the user and their friends, excluding blocked users and failed moderation
    posts = Post.objects.filter(
        Q(author=user_profile) | Q(author__in=friends)
    ).exclude(
        author__in=all_blocked_ids
    )
    
    # Try to filter by moderation status, but don't break if fields don't exist
    try:
        # Check if moderation fields exist before filtering
        with connection.cursor() as cursor:
            # For PostgreSQL (Render.com)
            try:
                cursor.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'chat_post' AND column_name = 'is_moderated'
                """)
                has_moderation = bool(cursor.fetchone())
            except:
                # For SQLite (local development)
                try:
                    cursor.execute("PRAGMA table_info(chat_post)")
                    columns = [info[1] for info in cursor.fetchall()]
                    has_moderation = 'is_moderated' in columns
                except:
                    has_moderation = False
                    
        if has_moderation:
            posts = posts.exclude(
                # Exclude posts that failed moderation (unless they belong to the current user)
                ~Q(author=user_profile) & Q(is_moderated=True) & Q(moderation_passed=False)
            )
        else:
            logger.warning("Moderation fields don't exist yet, skipping moderation filtering")
            
    except Exception as e:
        logger.warning(f"Could not filter posts by moderation status: {str(e)}. Database may need migration.")
    
    # Select related fields and order by created_at
    posts = posts.select_related('author', 'author__user').prefetch_related(
        'comments', 'comments__author', 'comments__author__user',
        'post_shares', 'reactions', 'repost_of', 'repost_of__original_post',
        'images', 'videos'  # Added prefetch for images and videos
    ).order_by('-created_at')
    
    # Check user reactions for each post
    for post in posts:
        post.user_reaction = PostReaction.objects.filter(post=post, user=user_profile).first()
        for comment in post.comments.all():
            comment.user_reaction = CommentReaction.objects.filter(comment=comment, user=user_profile).first()
    
    # Process post creation form
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            # Create post
            post = form.save(commit=False)
            post.author = user_profile
            post.save()
            
            # Handle multiple images
            images = request.FILES.getlist('images')
            for image in images:
                PostImage.objects.create(post=post, image=image)
            
            # Handle multiple videos
            videos = request.FILES.getlist('videos')
            for video in videos:
                PostVideo.objects.create(post=post, video=video)
                
            messages.success(request, "Post created successfully! Media files will be reviewed for appropriate content.")
            return redirect('home')
    
    return render(request, 'chat/home.html', {
        'form': form,
        'posts': posts,
        'friend_requests': FriendRequest.objects.filter(to_user=user_profile, status='pending'),
    })

@login_required
def profile_detail(request, username):
    user = get_object_or_404(User, username=username)
    profile = user.profile
    
    # Get user's own posts - use .all() to reset ordering
    own_posts = Post.objects.filter(author=profile).all()
    
    # Get posts that the user reposted
    reposted_post_ids = Repost.objects.filter(repost__author=profile).values_list('original_post_id', flat=True)
    reposted_posts = Post.objects.filter(id__in=reposted_post_ids).all()
    
    # Combined posts (own + reposted)
    posts = own_posts.union(reposted_posts).order_by('-created_at')
    
    # Check friend status
    is_friend = request.user.profile.friends.filter(id=profile.id).exists()
    
    # Check if friend request exists
    friend_request_sent = FriendRequest.objects.filter(
        from_user=request.user.profile,
        to_user=profile,
        status='pending'
    ).exists()
    
    friend_request_received = FriendRequest.objects.filter(
        from_user=profile,
        to_user=request.user.profile,
        status='pending'
    ).exists()
    
    context = {
        'profile': profile,
        'posts': posts,
        'is_friend': is_friend,
        'is_self': request.user == user,
        'friend_request_sent': friend_request_sent,
        'friend_request_received': friend_request_received,
    }
    return render(request, 'chat/profile_detail.html', context)

@login_required
def edit_profile(request):
    if request.method == 'POST':
        form = ProfileForm(request.POST, request.FILES, instance=request.user.profile)
        if form.is_valid():
            form.save()
            messages.success(request, 'Profile updated successfully.')
            return redirect('profile_detail', username=request.user.username)
    else:
        form = ProfileForm(instance=request.user.profile)
    
    return render(request, 'chat/edit_profile.html', {'form': form})

@login_required
def send_friend_request(request, username):
    to_user = get_object_or_404(User, username=username)
    from_user = request.user.profile
    
    if from_user == to_user.profile:
        messages.error(request, "You cannot send a friend request to yourself.")
        return redirect('profile_detail', username=username)
    
    if from_user.friends.filter(id=to_user.profile.id).exists():
        messages.info(request, "You are already friends with this user.")
        return redirect('profile_detail', username=username)
    
    friend_request, created = FriendRequest.objects.get_or_create(
        from_user=from_user,
        to_user=to_user.profile
    )
    
    if created:
        messages.success(request, f"Friend request sent to {to_user.username}.")
    else:
        messages.info(request, f"Friend request to {to_user.username} already exists.")
    
    return redirect('profile_detail', username=username)

@login_required
def respond_friend_request(request, request_id, action):
    friend_request = get_object_or_404(FriendRequest, id=request_id, to_user=request.user.profile)
    
    if action == 'accept':
        friend_request.status = 'accepted'
        friend_request.save()
        
        # Add to friends list (both ways due to symmetrical=True)
        request.user.profile.friends.add(friend_request.from_user)
        
        messages.success(request, f"You are now friends with {friend_request.from_user.user.username}.")
    
    elif action == 'reject':
        friend_request.status = 'rejected'
        friend_request.save()
        messages.info(request, f"Friend request from {friend_request.from_user.user.username} rejected.")
    
    return redirect('home')

@login_required
def chat_list(request):
    user_profile = request.user.profile
    chat_rooms = ChatRoom.objects.filter(participants=user_profile)
    
    context = {
        'chat_rooms': chat_rooms
    }
    return render(request, 'chat/chat_list.html', context)

@login_required
def create_or_get_direct_chat(request, username):
    other_user = get_object_or_404(User, username=username)
    user_profile = request.user.profile
    other_profile = other_user.profile
    
    # Check if users are friends
    if not user_profile.friends.filter(id=other_profile.id).exists():
        messages.error(request, "You can only chat with your friends.")
        return redirect('profile_detail', username=username)
    
    # Find existing direct chat
    common_chats = ChatRoom.objects.filter(
        participants=user_profile,
        is_group_chat=False
    ).filter(
        participants=other_profile
    )
    
    if common_chats.exists():
        chat_room = common_chats.first()
    else:
        # Create new chat room
        chat_room = ChatRoom.objects.create(is_group_chat=False)
        chat_room.participants.add(user_profile, other_profile)
    
    return redirect('chat_room', room_id=chat_room.id)

@login_required
def chat_room(request, room_id):
    chat_room = get_object_or_404(ChatRoom, id=room_id)
    user_profile = request.user.profile
    
    # Check if user is participant
    if not chat_room.participants.filter(id=user_profile.id).exists():
        messages.error(request, "You cannot access this chat room.")
        return redirect('chat_list')
    
    # Get messages
    messages_list = Message.objects.filter(room=chat_room).order_by('timestamp')
    
    # Mark unread messages as read
    unread_messages = messages_list.filter(
        is_read=False
    ).exclude(sender=user_profile)
    
    for msg in unread_messages:
        msg.is_read = True
        msg.save()
    
    # Get other participants
    other_participants = chat_room.participants.exclude(id=user_profile.id)
    
    context = {
        'chat_room': chat_room,
        'messages': messages_list,
        'user_profile': user_profile,
        'other_participants': other_participants,
    }
    
    return render(request, 'chat/chat_room.html', context)

@login_required
def friends_list(request):
    user_profile = request.user.profile
    friends = user_profile.friends.all()
    
    context = {
        'friends': friends
    }
    
    return render(request, 'chat/friends_list.html', context)

@login_required
def search_users(request):
    query = request.GET.get('q', '')
    if query:
        users = User.objects.filter(username__icontains=query).exclude(id=request.user.id)
    else:
        users = User.objects.none()
    
    context = {
        'users': users,
        'query': query
    }
    
    return render(request, 'chat/search_users.html', context)

@login_required
def delete_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    
    # Check if the user is the author of the post
    if post.author.user != request.user:
        messages.error(request, "You cannot delete posts that aren't yours.")
        return redirect('home')
    
    if request.method == 'POST':
        post.delete()
        messages.success(request, "Post deleted successfully.")
        
    return redirect('home')

@login_required
def block_post(request, post_id):
    post = get_object_or_404(Post, id=post_id)
    user_profile = request.user.profile
    
    # Cannot block your own post
    if post.author == user_profile:
        messages.error(request, "You cannot block your own post.")
        return redirect('home')
    
    # Check if already blocked
    block, created = BlockedPost.objects.get_or_create(user=user_profile, post=post)
    
    if created:
        messages.success(request, f"Post by {post.author.user.username} has been blocked.")
    else:
        messages.info(request, f"Post was already blocked.")
    
    return redirect('home')

@login_required
def block_user(request, username):
    target_user = get_object_or_404(User, username=username)
    user_profile = request.user.profile
    target_profile = target_user.profile
    
    # Cannot block yourself
    if target_user == request.user:
        messages.error(request, "You cannot block yourself.")
        return redirect('home')
    
    # Add to blocked users
    user_profile.blocked_users.add(target_profile)
    
    # Remove from friends if they are friends
    if user_profile.friends.filter(id=target_profile.id).exists():
        user_profile.friends.remove(target_profile)
        messages.info(request, f"{target_user.username} has been removed from your friends.")
    
    # Delete any pending friend requests
    FriendRequest.objects.filter(
        (Q(from_user=user_profile) & Q(to_user=target_profile)) |
        (Q(from_user=target_profile) & Q(to_user=user_profile))
    ).delete()
    
    messages.success(request, f"{target_user.username} has been blocked.")
    
    # Redirect to previous page or home
    return redirect(request.META.get('HTTP_REFERER', 'home'))

@login_required
def unblock_user(request, username):
    target_user = get_object_or_404(User, username=username)
    user_profile = request.user.profile
    target_profile = target_user.profile
    
    # Remove from blocked users
    user_profile.blocked_users.remove(target_profile)
    
    messages.success(request, f"{target_user.username} has been unblocked.")
    
    return redirect('home')

@login_required
def blocked_users(request):
    user_profile = request.user.profile
    blocked = user_profile.blocked_users.all()
    
    context = {
        'blocked_users': blocked
    }
    
    return render(request, 'chat/blocked_users.html', context)

@login_required
def get_messages(request, room_id):
    """Get messages for a chat room"""
    chat_room = get_object_or_404(ChatRoom, id=room_id)
    user_profile = request.user.profile
    
    # Check if user is participant
    if not chat_room.participants.filter(id=user_profile.id).exists():
        return JsonResponse({'status': 'error', 'message': 'Access denied'}, status=403)
    
    # Get messages
    messages_list = Message.objects.filter(room=chat_room).order_by('timestamp')
    
    # Mark unread messages as read
    unread_messages = messages_list.filter(
        is_read=False
    ).exclude(sender=user_profile)
    
    for msg in unread_messages:
        msg.is_read = True
        msg.save()
    
    # Render messages template
    messages_html = render_to_string('chat/messages.html', {
        'messages': messages_list,
        'user_profile': user_profile
    }, request=request)
    
    return JsonResponse({
        'status': 'success',
        'messages': messages_html
    })

@login_required
def get_chat_messages(request, room_id):
    """Get messages for a chat room with HTMX support"""
    chat_room = get_object_or_404(ChatRoom, id=room_id)
    user_profile = request.user.profile
    
    # Check if user is participant
    if not chat_room.participants.filter(id=user_profile.id).exists():
        return HttpResponseForbidden("Access denied")
    
    # Get messages
    messages_list = Message.objects.filter(room=chat_room).order_by('timestamp')
    
    # Mark unread messages as read
    unread_messages = messages_list.filter(
        is_read=False
    ).exclude(sender=user_profile)
    
    for msg in unread_messages:
        msg.is_read = True
        msg.save()
    
    # Render messages template for HTMX
    return render(request, 'chat/messages.html', {
        'messages': messages_list,
        'request': request
    })

@login_required
def send_message(request, room_id):
    """Send a message to a chat room"""
    try:
        chat_room = ChatRoom.objects.get(id=room_id)
        if not chat_room.participants.filter(id=request.user.profile.id).exists():
            return JsonResponse({'status': 'error', 'message': 'You are not a participant in this chat room'})
        
        message = Message(room=chat_room, sender=request.user.profile)
        
        # Handle text content
        if 'content' in request.POST and request.POST['content'].strip():
            message.content = request.POST['content'].strip()
        
        # Handle image upload
        if 'image' in request.FILES:
            message.image = request.FILES['image']
        
        # Handle video upload
        if 'video' in request.FILES:
            message.video = request.FILES['video']
            
        # Handle file upload
        if 'file' in request.FILES:
            message.file = request.FILES['file']
            
        # Handle voice message upload
        if 'voice_message' in request.FILES:
            message.voice_message = request.FILES['voice_message']
            
        # Handle reply to message
        if 'reply_to' in request.POST and request.POST['reply_to']:
            try:
                reply_to_id = int(request.POST['reply_to'])
                reply_to_message = Message.objects.get(id=reply_to_id)
                if reply_to_message.room_id == chat_room.id:
                    message.reply_to = reply_to_message
            except (ValueError, Message.DoesNotExist):
                pass
        
        # Check if we have at least one content type
        if not any([message.content, message.image, message.file, message.video, message.voice_message]):
            return JsonResponse({'status': 'error', 'message': 'Message cannot be empty'})
        
        message.save()
        
        # Mark all previous messages as read for the sender
        unread_messages = Message.objects.filter(
            room=chat_room, 
            is_read=False
        ).exclude(sender=request.user.profile)
        unread_messages.update(is_read=True)
        
        return JsonResponse({'status': 'success', 'message': 'Message sent successfully', 'message_id': message.id})
    except ChatRoom.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Chat room does not exist'})

@login_required
def message_stream(request, room_id):
    """Stream messages using Server-Sent Events (SSE)"""
    chat_room = get_object_or_404(ChatRoom, id=room_id)
    user_profile = request.user.profile
    
    # Check if user is participant
    if not chat_room.participants.filter(id=user_profile.id).exists():
        return HttpResponseForbidden("Access denied")
    
    def event_stream():
        last_id = 0
        while True:
            # Get new messages
            messages = Message.objects.filter(
                room=chat_room,
                id__gt=last_id
            ).order_by('timestamp')
            
            if messages.exists():
                last_id = messages.last().id
                data = {
                    'type': 'message',
                    'messages': [
                        {
                            'id': msg.id,
                            'content': msg.content,
                            'sender': msg.sender.user.username,
                            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
                        }
                        for msg in messages
                    ]
                }
                yield f"data: {json.dumps(data)}\n\n"
            
            time.sleep(1)  # Wait 1 second before checking for new messages
    
    response = StreamingHttpResponse(
        event_stream(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response

@login_required
def add_post_reaction(request, post_id):
    """Add a reaction to a post"""
    if request.method == 'POST':
        reaction_type = request.POST.get('reaction_type', 'like')
        post = get_object_or_404(Post, id=post_id)
        user_profile = request.user.profile
        
        try:
            # Check if user already reacted to this post
            existing_reaction = PostReaction.objects.filter(post=post, user=user_profile).first()
            
            if existing_reaction:
                # If the reaction is the same, remove it (toggle off)
                if existing_reaction.reaction_type == reaction_type:
                    existing_reaction.delete()
                    return JsonResponse({'status': 'success', 'action': 'removed', 'count': post.reactions.count()})
                else:
                    # Update to new reaction type
                    existing_reaction.reaction_type = reaction_type
                    existing_reaction.save()
                    return JsonResponse({'status': 'success', 'action': 'updated', 'type': reaction_type, 'count': post.reactions.count()})
            else:
                # Create new reaction
                PostReaction.objects.create(
                    post=post,
                    user=user_profile,
                    reaction_type=reaction_type
                )
                return JsonResponse({'status': 'success', 'action': 'added', 'type': reaction_type, 'count': post.reactions.count()})
        except IntegrityError:
            # If there's a race condition (user double-clicked), handle it gracefully
            # Just get the current reaction count and return it
            return JsonResponse({'status': 'success', 'action': 'exists', 'count': post.reactions.count()})
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=400)

@login_required
def add_comment(request, post_id):
    """Add a comment to a post"""
    if request.method == 'POST':
        content = request.POST.get('content')
        parent_comment_id = request.POST.get('parent_comment_id')
        
        if not content:
            return JsonResponse({'status': 'error', 'message': 'Comment content is required'}, status=400)
        
        post = get_object_or_404(Post, id=post_id)
        user_profile = request.user.profile
        
        print(f"[DEBUG] Adding comment to post {post_id}, content: {content[:30]}...")
        
        # Create comment with optional parent_comment
        comment_data = {
            'post': post,
            'author': user_profile,
            'content': content
        }
        
        # If this is a reply to another comment
        if parent_comment_id:
            try:
                parent_comment = Comment.objects.get(id=parent_comment_id)
                comment_data['parent_comment'] = parent_comment
            except Comment.DoesNotExist:
                pass
                
        comment = Comment.objects.create(**comment_data)
        print(f"[DEBUG] Comment created with ID: {comment.id}")
        
        # If this is an HTMX request, return the updated comments list
        if request.headers.get('HX-Request'):
            print(f"[DEBUG] HTMX request detected, returning full comments list")
            # Get all comments and add reaction info
            comments = post.comments.filter(parent_comment=None).order_by('-created_at')
            
            def add_reaction_info(comment_list):
                for c in comment_list:
                    c.user_has_reacted = CommentReaction.objects.filter(
                        comment=c, user=user_profile
                    ).exists()
                    if hasattr(c, 'replies'):
                        add_reaction_info(c.replies.all())
            
            add_reaction_info(comments)
            
            context = {
                'post': post,
                'comments': comments,
                'user_profile': user_profile
            }
            
            # Return the full comments list HTML
            return render(request, 'chat/comments_list.html', context)
        
        # Otherwise return JSON for API
        # Set user reaction info for template
        comment.user_has_reacted = False
        
        # Render the comment HTML
        html = render_to_string('chat/comment.html', {
            'comment': comment,
            'user_profile': user_profile,
            'csrf_token': get_token(request)
        }, request=request)
        
        return JsonResponse({
            'status': 'success', 
            'html': html, 
            'comment_id': comment.id, 
            'count': post.comments.count(),
            'is_reply': bool(parent_comment_id)
        })
    
    return JsonResponse({'status': 'error', 'message': 'Invalid request method'}, status=400)

@login_required
def add_comment_reaction(request, comment_id):
    if request.method == 'POST':
        try:
            data = {}
            if request.headers.get('Content-Type') == 'application/json' and request.body:
                data = json.loads(request.body)
            reaction_type = data.get('reaction_type', 'like')
            
            # Validate reaction type
            valid_reactions = [r[0] for r in REACTION_TYPES]
            if reaction_type not in valid_reactions:
                return JsonResponse({'success': False, 'error': 'Invalid reaction type'})
            
            comment = Comment.objects.get(id=comment_id)
            user_profile = request.user.profile
            
            # Check if a reaction already exists
            try:
                existing_reaction = CommentReaction.objects.get(
                    comment=comment,
                    user=user_profile
                )
                
                # If reaction exists with same type, remove it (toggle)
                if existing_reaction.reaction_type == reaction_type:
                    existing_reaction.delete()
                    user_has_reacted = False
                else:
                    # If different type, update it
                    existing_reaction.reaction_type = reaction_type
                    existing_reaction.save()
                    user_has_reacted = True
            except CommentReaction.DoesNotExist:
                # Create new reaction
                CommentReaction.objects.create(
                    comment=comment,
                    user=user_profile,
                    reaction_type=reaction_type
                )
                user_has_reacted = True
            
            # Get updated reaction count
            reaction_count = comment.reactions.count()
            
            # If this is an HTMX request, return the updated button
            if request.headers.get('HX-Request'):
                button_html = f'''
                <button class="btn btn-sm btn-link p-0 me-2 comment-reaction-btn {'active' if user_has_reacted else ''}" 
                        data-comment-id="{comment.id}"
                        hx-post="{reverse('add_comment_reaction', args=[comment.id])}"
                        hx-vals='{{"reaction_type": "like"}}'
                        hx-headers='{{"X-CSRFToken": "{get_token(request)}"}}' 
                        hx-target="closest .comment-reaction-btn"
                        hx-swap="outerHTML">
                    <i class="{'fas' if user_has_reacted else 'far'} fa-thumbs-up me-1"></i> Like
                    <span class="reaction-count">{reaction_count}</span>
                </button>
                '''
                return HttpResponse(button_html)
            else:
                # Return JSON response for non-HTMX requests
                return JsonResponse({
                    'success': True,
                    'user_has_reacted': user_has_reacted,
                    'reaction_count': reaction_count
                })
            
        except Comment.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Comment not found'}, status=404)
        except Exception as e:
            print(f"Error in add_comment_reaction: {str(e)}")
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
            
    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405)

@login_required
def share_dialog(request, post_id):
    """Show dialog to share a post with friends"""
    post = get_object_or_404(Post, id=post_id)
    user_profile = request.user.profile
    
    # Get list of friends to share with
    friends = user_profile.friends.all()
    
    return render(request, 'chat/share_dialog.html', {
        'post': post,
        'friends': friends
    })

@login_required
def share_post(request, post_id):
    """Share a post with selected friends"""
    if request.method == 'POST':
        post = get_object_or_404(Post, id=post_id)
        user_profile = request.user.profile
        
        # Get share recipients
        recipient_ids = request.POST.getlist('share_with')
        comment = request.POST.get('comment', '')
        
        if not recipient_ids:
            messages.warning(request, "Please select at least one friend to share with.")
            return redirect('share_dialog', post_id=post_id)
        
        # Create shares for each recipient
        for recipient_id in recipient_ids:
            recipient = get_object_or_404(Profile, id=recipient_id)
            
            # Create the share
            PostShare.objects.create(
                post=post,
                shared_by=user_profile,
                shared_with=recipient,
                comment=comment
            )
        
        messages.success(request, f"Post shared with {len(recipient_ids)} friend{'s' if len(recipient_ids) > 1 else ''}!")
        return redirect('home')
    
    # Handle GET request (redirect to dialog)
    return redirect('share_dialog', post_id=post_id)

@login_required
def repost(request, post_id):
    """Repost a post"""
    original_post = get_object_or_404(Post, id=post_id)
    user_profile = request.user.profile
    
    if request.method == 'POST':
        content = request.POST.get('content', f"Reposted from {original_post.author.user.username}")
        
        # Create the repost as a new post
        repost = Post.objects.create(
            author=user_profile,
            content=content
        )
        
        # Create relationship between original and repost
        Repost.objects.create(
            original_post=original_post,
            repost=repost
        )
        
        messages.success(request, "Post has been reposted to your profile!")
        return redirect('home')
    
    return render(request, 'chat/repost_form.html', {
        'post_id': post_id,
        'original_post': original_post
    })

@login_required
def set_dark_mode(request):
    """Save dark mode preference for the user"""
    if request.method == 'POST':
        # Get the dark mode preference from the request
        dark_mode = request.POST.get('dark_mode', 'off')
        
        # Store in session
        request.session['dark_mode'] = dark_mode == 'on'
        
        # Redirect back to the referring page or home
        referer = request.META.get('HTTP_REFERER')
        if referer:
            return redirect(referer)
        return redirect('home')
    
    # If not a POST request, redirect to home
    return redirect('home')

@login_required
def get_comments(request, post_id):
    """Get comments for a post"""
    post = get_object_or_404(Post, id=post_id)
    
    # For staff/superusers, show all comments; for regular users, exclude hidden ones
    if request.user.is_staff or request.user.is_superuser:
        comments = Comment.objects.filter(post=post, parent_comment=None)
    else:
        comments = Comment.objects.filter(post=post, parent_comment=None, is_hidden=False)
        
    comments = comments.select_related('author', 'author__user').prefetch_related('reactions')
    
    # Add reaction info to each comment
    def add_reaction_info(comment_list):
        """Add reaction information to comments"""
        for comment in comment_list:
            comment.user_has_reacted = CommentReaction.objects.filter(
                comment=comment, 
                user=request.user.profile
            ).exists()
            
            # Also process all replies to this comment
            if hasattr(comment, 'replies'):
                replies = comment.replies.all()
                add_reaction_info(replies)
    
    add_reaction_info(comments)
    
    context = {
        'post': post,
        'comments': comments,
        'user_profile': request.user.profile
    }
    
    # Always render the comments list, whether HTMX or not
    html = render_to_string('chat/comments_list.html', context, request=request)
    
    # Check if the request is from HTMX
    if request.headers.get('HX-Request'):
        print(f"[DEBUG] Returning HTMX response for post {post_id}")
        return HttpResponse(html)
    else:
        print(f"[DEBUG] Returning JSON response for post {post_id}")
        return JsonResponse({
            'status': 'success', 
            'html': html, 
            'count': comments.count()
        })

@login_required
def message_reaction(request, message_id):
    """Add or remove a reaction to a message"""
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    
    user_profile = request.user.profile
    message = get_object_or_404(Message, id=message_id)
    
    # Verify user has access to the chat room
    if not message.room.participants.filter(id=user_profile.id).exists():
        return HttpResponseForbidden()
    
    try:
        data = json.loads(request.body)
        reaction = data.get('reaction', '👍')
        
        # Check if this reaction already exists
        existing_reaction = MessageReaction.objects.filter(
            message=message,
            user=user_profile,
            reaction=reaction
        ).first()
        
        if existing_reaction:
            # Remove the reaction if it exists
            existing_reaction.delete()
            added = False
        else:
            # Add the reaction
            MessageReaction.objects.create(
                message=message,
                user=user_profile,
                reaction=reaction
            )
            added = True
        
        # Get all reactions for this message
        reactions = MessageReaction.objects.filter(message=message)
        reaction_data = {}
        
        for r in reactions:
            if r.reaction in reaction_data:
                reaction_data[r.reaction] += 1
            else:
                reaction_data[r.reaction] = 1
        
        return JsonResponse({
            'success': True,
            'added': added,
            'reactions': reaction_data
        })
    
    except (json.JSONDecodeError, KeyError):
        return HttpResponseBadRequest("Invalid request format")

@login_required
def reply_to_message(request, message_id):
    """Reply to a specific message"""
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    
    user_profile = request.user.profile
    original_message = get_object_or_404(Message, id=message_id)
    
    # Verify user has access to the chat room
    chat_room = original_message.room
    if not chat_room.participants.filter(id=user_profile.id).exists():
        return HttpResponseForbidden()
    
    try:
        data = json.loads(request.body)
        content = data.get('content', '')
        
        if not content.strip():
            return HttpResponseBadRequest("Reply cannot be empty")
        
        # Create the reply message
        reply_message = Message.objects.create(
            room=chat_room,
            sender=user_profile,
            content=content,
            reply_to=original_message
        )
        
        # Return a JSON response with message details
        return JsonResponse({
            'success': True,
            'message': {
                'id': reply_message.id,
                'content': reply_message.content,
                'sender': reply_message.sender.user.username,
                'timestamp': reply_message.timestamp.strftime('%H:%M %p'),
                'reply_to': {
                    'id': original_message.id,
                    'content': original_message.content,
                    'sender': original_message.sender.user.username
                }
            }
        })
    
    except (json.JSONDecodeError, KeyError):
        return HttpResponseBadRequest("Invalid request format")

@login_required
def reply_to_comment(request, comment_id):
    """Handle replying to a comment"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method is allowed'}, status=405)
    
    comment = get_object_or_404(Comment, id=comment_id)
    user_profile = request.user.profile
    
    try:
        # Try to parse JSON body
        data = {}
        try:
            if request.body:
                data = json.loads(request.body)
        except json.JSONDecodeError:
            # If not JSON, try to get from POST form data
            data = request.POST.dict()
            
        content = data.get('content', '').strip()
        post_id = data.get('post_id')
        
        if not content:
            return JsonResponse({'success': False, 'error': 'Comment content cannot be empty'}, status=400)
        
        # Make sure we have the post
        post = None
        if post_id:
            post = get_object_or_404(Post, id=post_id)
        else:
            post = comment.post
            post_id = post.id  # Ensure we have post_id for response
        
        # Create the reply comment
        reply = Comment.objects.create(
            post=post,
            author=user_profile,
            content=content,
            parent_comment=comment
        )
        
        print(f"Created reply: {reply.id} to comment {comment.id} for post {post.id}")
        
        # Add user reaction info for templates
        reply.user_has_reacted = False
        
        return JsonResponse({
            'success': True,
            'comment_id': reply.id,
            'post_id': str(post_id),
            'author': reply.author.user.username,
            'content': reply.content,
            'created_at': reply.created_at.isoformat(),
            'parent_comment_id': comment.id
        })
    
    except Exception as e:
        print(f"Error in reply_to_comment: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

@require_POST
def set_timezone(request):
    """Set the user's timezone in the session"""
    timezone = request.POST.get('timezone')
    if timezone:
        try:
            # Validate the timezone
            pytz.timezone(timezone)
            
            # Save in session
            request.session['user_timezone'] = timezone
            
            # If this is from the timezone setting form, show a success message
            next_url = request.GET.get('next', 'home')
            if request.headers.get('HTTP_REFERER') and 'set_timezone' in request.headers.get('HTTP_REFERER'):
                messages.success(request, f"Timezone set to {timezone}")
                
            # Redirect back to the referring page or specified next URL
            if request.headers.get('HTTP_REFERER') and not 'set_timezone' in request.headers.get('HTTP_REFERER'):
                return redirect(request.headers.get('HTTP_REFERER'))
            return redirect(next_url)
            
        except pytz.exceptions.UnknownTimeZoneError:
            # Handle manual form submission with invalid timezone
            if request.headers.get('HTTP_REFERER') and 'set_timezone' in request.headers.get('HTTP_REFERER'):
                messages.error(request, f"Invalid timezone: {timezone}")
                return redirect('set_timezone')
            
    # If we reach here with a GET request, show the timezone form
    timezones = sorted(pytz.common_timezones)
    current_timezone = request.session.get('user_timezone', 'UTC')
    
    return render(request, 'chat/set_timezone.html', {
        'timezones': timezones,
        'current_timezone': current_timezone,
    })

@login_required
def initiate_voice_call(request, room_id):
    """Initiate a voice call in a chat room"""
    try:
        chat_room = ChatRoom.objects.get(id=room_id)
        if not chat_room.participants.filter(id=request.user.profile.id).exists():
            return JsonResponse({'status': 'error', 'message': 'You are not a participant in this chat room'})
        
        # Create a new voice call
        voice_call = VoiceCall.objects.create(
            room=chat_room,
            initiator=request.user.profile,
            status='initiated'
        )
        
        # Add the initiator as a participant
        voice_call.participants.add(request.user.profile)
        
        # Create a system message for the call
        message = Message.objects.create(
            room=chat_room,
            sender=request.user.profile,
            content=f"Started a voice call"
        )
        
        # Send WebSocket notification to all participants
        channel_layer = get_channel_layer()
        call_data = {
            'id': voice_call.id,
            'initiator': request.user.username,
            'status': voice_call.status,
            'start_time': voice_call.start_time.isoformat()
        }
        
        # Send to all participants except the initiator
        for participant in chat_room.participants.exclude(id=request.user.profile.id):
            async_to_sync(channel_layer.group_send)(
                f'chat_{room_id}',
                {
                    'type': 'call_notification',
                    'call_data': call_data
                }
            )
        
        return JsonResponse({
            'status': 'success', 
            'call_id': voice_call.id,
            'message': 'Voice call initiated'
        })
    except ChatRoom.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Chat room does not exist'})

@login_required
def join_voice_call(request, call_id):
    """Join an ongoing voice call"""
    try:
        voice_call = VoiceCall.objects.get(id=call_id)
        
        # Check if user is a participant in the chat room
        if not voice_call.room.participants.filter(id=request.user.profile.id).exists():
            return JsonResponse({'status': 'error', 'message': 'You are not authorized to join this call'})
        
        # Check if the call is still active
        if voice_call.status not in ['initiated', 'ongoing']:
            return JsonResponse({'status': 'error', 'message': 'This call has ended'})
        
        # Update call status if it was just initiated
        if voice_call.status == 'initiated':
            voice_call.status = 'ongoing'
            voice_call.save()
            
            # Send WebSocket notification about call status update
            channel_layer = get_channel_layer()
            status_data = {
                'call_id': voice_call.id,
                'status': voice_call.status,
                'participants': list(voice_call.participants.values_list('user__username', flat=True))
            }
            
            async_to_sync(channel_layer.group_send)(
                f'chat_{voice_call.room.id}',
                {
                    'type': 'call_status_update',
                    'status_data': status_data
                }
            )
        
        # Add user as a participant if not already
        if not voice_call.participants.filter(id=request.user.profile.id).exists():
            voice_call.participants.add(request.user.profile)
            
            # Add system message that user joined the call
            if request.user.profile != voice_call.initiator:
                Message.objects.create(
                    room=voice_call.room,
                    sender=request.user.profile,
                    content=f"Joined the voice call"
                )
        
        return JsonResponse({
            'status': 'success', 
            'message': 'Joined voice call successfully',
            'call_info': {
                'id': voice_call.id,
                'initiator': voice_call.initiator.user.username,
                'start_time': voice_call.start_time.isoformat(),
                'room_id': voice_call.room.id
            }
        })
    except VoiceCall.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Voice call does not exist'})

@login_required
def end_voice_call(request, call_id):
    """End a voice call"""
    try:
        voice_call = VoiceCall.objects.get(id=call_id)
        
        # Check if user is the initiator or a participant
        is_participant = voice_call.participants.filter(id=request.user.profile.id).exists()
        is_initiator = (voice_call.initiator == request.user.profile)
        
        if not is_participant and not is_initiator:
            return JsonResponse({'status': 'error', 'message': 'You are not authorized to end this call'})
        
        # Update call status
        voice_call.status = 'completed'
        voice_call.end_time = timezone.now()
        voice_call.save()
        
        # Add system message that the call ended
        Message.objects.create(
            room=voice_call.room,
            sender=request.user.profile,
            content=f"Ended the voice call"
        )
        
        # Send WebSocket notification about call end
        channel_layer = get_channel_layer()
        status_data = {
            'call_id': voice_call.id,
            'status': voice_call.status,
            'end_time': voice_call.end_time.isoformat()
        }
        
        async_to_sync(channel_layer.group_send)(
            f'chat_{voice_call.room.id}',
            {
                'type': 'call_status_update',
                'status_data': status_data
            }
        )
        
        # Calculate the duration
        duration_seconds = voice_call.duration
        minutes, seconds = divmod(int(duration_seconds), 60)
        
        return JsonResponse({
            'status': 'success', 
            'message': 'Voice call ended',
            'duration': f"{minutes}:{seconds:02d}"
        })
    except VoiceCall.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Voice call does not exist'})

@login_required
def get_active_call(request, room_id):
    """Get information about an active voice call in a chat room"""
    try:
        chat_room = ChatRoom.objects.get(id=room_id)
        
        # Check if user is a participant in the chat room
        if not chat_room.participants.filter(id=request.user.profile.id).exists():
            return JsonResponse({'status': 'error', 'message': 'Not authorized'})
        
        # Check for active calls in this room
        active_call = VoiceCall.objects.filter(
            room=chat_room,
            status__in=['initiated', 'ongoing']
        ).first()
        
        if active_call:
            participants = list(active_call.participants.values_list('user__username', flat=True))
            
            return JsonResponse({
                'status': 'success',
                'active_call': {
                    'id': active_call.id,
                    'initiator': active_call.initiator.user.username,
                    'participants': participants,
                    'start_time': active_call.start_time.isoformat(),
                    'status': active_call.status
                }
            })
        else:
            return JsonResponse({
                'status': 'success',
                'active_call': None
            })
    except ChatRoom.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Chat room does not exist'})

@login_required
def voice_call_status(request, call_id):
    """Get status of a voice call and exchange signaling messages"""
    try:
        voice_call = VoiceCall.objects.get(id=call_id)
        
        # Check if user is a participant
        if not voice_call.participants.filter(id=request.user.profile.id).exists():
            return JsonResponse({'status': 'error', 'message': 'Not authorized'})
        
        # Process incoming signaling messages if any
        if request.method == 'POST':
            try:
                data = json.loads(request.body)
                signaling_message = data.get('signaling_message')
                if signaling_message:
                    # Store signaling message for other participants
                    # In a real app, this would be stored in a database or Redis
                    # For simplicity, we'll use a session-based approach
                    
                    # Create a key for this call's signaling messages
                    call_messages_key = f'call_{call_id}_signaling_messages'
                    
                    # Get existing messages or initialize an empty list
                    if not hasattr(request, 'session'):
                        request.session = {}
                    
                    messages = request.session.get(call_messages_key, [])
                    
                    # Add sender info to the message
                    signaling_message['sender'] = request.user.username
                    signaling_message['timestamp'] = timezone.now().isoformat()
                    
                    # Add to messages list
                    messages.append(signaling_message)
                    
                    # Store back in session (limit to last 20 messages)
                    request.session[call_messages_key] = messages[-20:]
                    request.session.modified = True
            except json.JSONDecodeError:
                pass
        
        # Get participants list
        participants = list(voice_call.participants.values_list('user__username', flat=True))
        
        # Get signaling messages for this user (exclude own messages)
        signaling_messages = []
        call_messages_key = f'call_{call_id}_signaling_messages'
        if hasattr(request, 'session') and call_messages_key in request.session:
            all_messages = request.session.get(call_messages_key, [])
            
            # Filter to get only messages from other participants
            signaling_messages = [
                msg for msg in all_messages 
                if msg.get('sender') != request.user.username
            ]
            
            # Remove processed messages from session
            request.session[call_messages_key] = [
                msg for msg in all_messages 
                if msg.get('sender') == request.user.username
            ]
            request.session.modified = True
        
        # Calculate duration if call is ongoing or completed
        duration = None
        if voice_call.status in ['ongoing', 'completed'] and voice_call.start_time:
            if voice_call.end_time:
                duration = (voice_call.end_time - voice_call.start_time).total_seconds()
            else:
                duration = (timezone.now() - voice_call.start_time).total_seconds()
        
        return JsonResponse({
            'status': 'success',
            'call_status': voice_call.status,
            'participants': participants,
            'duration': duration,
            'signaling_messages': signaling_messages,
            'initiator': voice_call.initiator.user.username
        })
    except VoiceCall.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Voice call does not exist'})

@login_required
def decline_voice_call(request, call_id):
    """Decline an incoming voice call"""
    try:
        voice_call = VoiceCall.objects.get(id=call_id)
        
        # Check if user is a participant in the chat room
        if not voice_call.room.participants.filter(id=request.user.profile.id).exists():
            return JsonResponse({'status': 'error', 'message': 'Not authorized'})
        
        # Add system message that the call was declined
        Message.objects.create(
            room=voice_call.room,
            sender=request.user.profile,
            content=f"Declined voice call"
        )
        
        # If this is the only participant, end the call
        if voice_call.participants.count() <= 1:
            voice_call.status = 'completed'
            voice_call.end_time = timezone.now()
            voice_call.save()
            
            # Send WebSocket notification about call end
            channel_layer = get_channel_layer()
            status_data = {
                'call_id': voice_call.id,
                'status': voice_call.status,
                'end_time': voice_call.end_time.isoformat()
            }
            
            async_to_sync(channel_layer.group_send)(
                f'chat_{voice_call.room.id}',
                {
                    'type': 'call_status_update',
                    'status_data': status_data
                }
            )
        
        return JsonResponse({'status': 'success', 'message': 'Call declined'})
    except VoiceCall.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Voice call does not exist'})

# Moderation Dashboard
@user_passes_test(is_moderator)
def moderation_dashboard(request):
    """Dashboard for content moderation"""
    pending_items = ContentModerationStatus.objects.filter(status='pending').select_related('content_object')
    approved_items = ContentModerationStatus.objects.filter(status='approved').select_related('content_object')
    rejected_items = ContentModerationStatus.objects.filter(status='rejected').select_related('content_object')
    error_items = ContentModerationStatus.objects.filter(status='error').select_related('content_object')
    
    # Add display name for content type
    for queryset in [pending_items, approved_items, rejected_items, error_items]:
        for item in queryset:
            item.content_type_display = dict(ContentModerationStatus.CONTENT_TYPE_CHOICES).get(item.content_type, item.content_type)
    
    context = {
        'pending_items': pending_items,
        'pending_count': pending_items.count(),
        'approved_items': approved_items,
        'approved_count': approved_items.count(),
        'rejected_items': rejected_items,
        'rejected_count': rejected_items.count(),
        'error_items': error_items,
        'error_count': error_items.count(),
    }
    
    return render(request, 'chat/moderation_dashboard.html', context)

@user_passes_test(is_moderator)
def approve_content(request, moderation_id):
    """Approve content that was flagged for moderation"""
    if request.method == 'POST':
        try:
            moderation = ContentModerationStatus.objects.get(id=moderation_id)
            moderation.status = 'approved'
            moderation.moderation_date = timezone.now()
            moderation.save()
            
            # Update the object's moderation status based on content type
            if moderation.content_type == 'post_image':
                post_image = PostImage.objects.get(id=moderation.content_id)
                post_image.is_moderated = True
                post_image.moderation_passed = True
                post_image.save()
            elif moderation.content_type == 'post_video':
                post_video = PostVideo.objects.get(id=moderation.content_id)
                post_video.is_moderated = True
                post_video.moderation_passed = True
                post_video.save()
            elif moderation.content_type == 'message_image':
                message = Message.objects.get(id=moderation.content_id)
                message.is_image_moderated = True
                message.image_moderation_passed = True
                message.save()
            elif moderation.content_type == 'message_video':
                message = Message.objects.get(id=moderation.content_id)
                message.is_video_moderated = True
                message.video_moderation_passed = True
                message.save()
            
            messages.success(request, f"Content approved successfully.")
        except Exception as e:
            messages.error(request, f"Error approving content: {str(e)}")
    
    return redirect('moderation_dashboard')

@user_passes_test(is_moderator)
def reject_content(request, moderation_id):
    """Reject content that was flagged for moderation"""
    if request.method == 'POST':
        try:
            moderation = ContentModerationStatus.objects.get(id=moderation_id)
            moderation.status = 'rejected'
            moderation.moderation_date = timezone.now()
            
            if not moderation.rejection_reason:
                moderation.rejection_reason = "Rejected by moderator"
                
            moderation.save()
            
            # Update the object's moderation status based on content type
            if moderation.content_type == 'post_image':
                post_image = PostImage.objects.get(id=moderation.content_id)
                post_image.is_moderated = True
                post_image.moderation_passed = False
                post_image.save()
                
                # Update the parent post's moderation status
                post = post_image.post
                post.moderation_passed = False
                post.is_moderated = True
                post.save()
                
            elif moderation.content_type == 'post_video':
                post_video = PostVideo.objects.get(id=moderation.content_id)
                post_video.is_moderated = True
                post_video.moderation_passed = False
                post_video.save()
                
                # Update the parent post's moderation status
                post = post_video.post
                post.moderation_passed = False
                post.is_moderated = True
                post.save()
                
            elif moderation.content_type == 'message_image':
                message = Message.objects.get(id=moderation.content_id)
                message.is_image_moderated = True
                message.image_moderation_passed = False
                message.save()
                
            elif moderation.content_type == 'message_video':
                message = Message.objects.get(id=moderation.content_id)
                message.is_video_moderated = True
                message.video_moderation_passed = False
                message.save()
            
            messages.success(request, f"Content rejected successfully.")
        except Exception as e:
            messages.error(request, f"Error rejecting content: {str(e)}")
    
    return redirect('moderation_dashboard')

@user_passes_test(is_moderator)
def retry_moderation(request, moderation_id):
    """Retry moderation for content that had errors"""
    if request.method == 'POST':
        try:
            moderation = ContentModerationStatus.objects.get(id=moderation_id)
            
            # Get the content object based on type
            content_object = None
            if moderation.content_type == 'post_image':
                content_object = PostImage.objects.get(id=moderation.content_id)
                is_safe, confidence, categories = moderate_image(content_object.image)
            elif moderation.content_type == 'post_video':
                content_object = PostVideo.objects.get(id=moderation.content_id)
                is_safe, confidence, categories = moderate_video(content_object.video)
            elif moderation.content_type == 'message_image':
                content_object = Message.objects.get(id=moderation.content_id)
                is_safe, confidence, categories = moderate_image(content_object.image)
            elif moderation.content_type == 'message_video':
                content_object = Message.objects.get(id=moderation.content_id)
                is_safe, confidence, categories = moderate_video(content_object.video)
            
            if content_object:
                # Update moderation status
                moderation.status = 'approved' if is_safe else 'rejected'
                moderation.moderation_date = timezone.now()
                moderation.rejection_reason = 'Inappropriate content detected' if not is_safe else None
                moderation.moderation_data = categories
                moderation.save()
                
                # Update the object's moderation status
                if moderation.content_type == 'post_image':
                    content_object.is_moderated = True
                    content_object.moderation_passed = is_safe
                    content_object.save()
                    
                    if not is_safe:
                        post = content_object.post
                        post.moderation_passed = False
                        post.is_moderated = True
                        post.save()
                        
                elif moderation.content_type == 'post_video':
                    content_object.is_moderated = True
                    content_object.moderation_passed = is_safe
                    content_object.save()
                    
                    if not is_safe:
                        post = content_object.post
                        post.moderation_passed = False
                        post.is_moderated = True
                        post.save()
                        
                elif moderation.content_type == 'message_image':
                    content_object.is_image_moderated = True
                    content_object.image_moderation_passed = is_safe
                    content_object.save()
                    
                elif moderation.content_type == 'message_video':
                    content_object.is_video_moderated = True
                    content_object.video_moderation_passed = is_safe
                    content_object.save()
                
                messages.success(request, f"Content moderation retried successfully.")
            else:
                messages.error(request, f"Content not found.")
                
        except Exception as e:
            messages.error(request, f"Error retrying moderation: {str(e)}")
    
    return redirect('moderation_dashboard')

@user_passes_test(is_moderator)
def reject_comment(request, comment_id):
    """Reject a comment - mark as inappropriate"""
    if request.method == 'POST':
        try:
            comment = Comment.objects.get(id=comment_id)
            comment.is_hidden = True
            comment.save()
            
            # Create moderation status entry
            ContentModerationStatus.objects.create(
                content_type='comment',
                content_id=comment.id,
                status='rejected',
                moderation_date=timezone.now(),
                rejection_reason='Rejected by moderator'
            )
            
            messages.success(request, f"Comment by {comment.author.user.username} has been rejected.")
        except Exception as e:
            messages.error(request, f"Error rejecting comment: {str(e)}")
    
    # Return to the previous page
    referer = request.META.get('HTTP_REFERER', 'home')
    return redirect(referer)

@user_passes_test(is_moderator)
def accept_comment(request, comment_id):
    """Approve a previously flagged comment"""
    if request.method == 'POST':
        try:
            comment = Comment.objects.get(id=comment_id)
            comment.is_hidden = False
            comment.save()
            
            # Update moderation status if exists
            moderation, created = ContentModerationStatus.objects.get_or_create(
                content_type='comment',
                content_id=comment.id,
                defaults={
                    'status': 'approved',
                    'moderation_date': timezone.now()
                }
            )
            
            if not created:
                moderation.status = 'approved'
                moderation.moderation_date = timezone.now()
                moderation.save()
            
            messages.success(request, f"Comment by {comment.author.user.username} has been approved.")
        except Exception as e:
            messages.error(request, f"Error approving comment: {str(e)}")
    
    # Return to the previous page
    referer = request.META.get('HTTP_REFERER', 'home')
    return redirect(referer)
