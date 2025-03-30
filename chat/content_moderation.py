import os
import requests
import logging
from django.conf import settings
from PIL import Image
import io
import base64
import numpy as np
import tempfile
import cv2

logger = logging.getLogger(__name__)

# Option 1: Using Google Cloud Vision API for content moderation (paid)
def moderate_image_with_google_vision(image_file):
    """
    Check if an image contains inappropriate content using Google Cloud Vision API.
    Returns a tuple (is_safe, confidence, categories)
    """
    try:
        # You would need to set up GCP credentials in your environment
        from google.cloud import vision
        
        client = vision.ImageAnnotatorClient()
        
        if hasattr(image_file, 'read'):
            image_content = image_file.read()
        else:
            with open(image_file, "rb") as f:
                image_content = f.read()
        
        image = vision.Image(content=image_content)
        
        # Performs safe search detection on the image
        response = client.safe_search_detection(image=image)
        safe_search = response.safe_search_annotation
        
        # Check for adult, violence, or medical content
        adult_score = _convert_likelihood(safe_search.adult)
        violence_score = _convert_likelihood(safe_search.violence)
        medical_score = _convert_likelihood(safe_search.medical)
        
        # Consider image unsafe if any score is above 3 (POSSIBLE)
        is_safe = all(score < 4 for score in [adult_score, violence_score, medical_score])
        categories = {
            "adult": adult_score,
            "violence": violence_score, 
            "medical": medical_score,
            "racy": _convert_likelihood(safe_search.racy),
            "spoof": _convert_likelihood(safe_search.spoof)
        }
        
        highest_score = max(adult_score, violence_score, medical_score)
        
        return is_safe, highest_score, categories
        
    except Exception as e:
        logger.error(f"Error in Google Vision moderation: {str(e)}")
        # Default to manual review if API fails
        return False, 0, {"error": str(e)}

def _convert_likelihood(likelihood):
    """Convert Google Vision likelihood string to numeric value"""
    likelihood_map = {
        0: 0,  # UNKNOWN
        1: 1,  # VERY_UNLIKELY
        2: 2,  # UNLIKELY
        3: 3,  # POSSIBLE
        4: 4,  # LIKELY
        5: 5,  # VERY_LIKELY
    }
    return likelihood_map.get(likelihood, 0)


# Option 2: Using a publicly available moderation API (like Sightengine) (paid)
def moderate_image_with_sightengine(image_file):
    """
    Check if an image contains inappropriate content using Sightengine API.
    Returns a tuple (is_safe, confidence, categories)
    """
    try:
        # You would need to set SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET in settings
        api_user = getattr(settings, 'SIGHTENGINE_API_USER', '')
        api_secret = getattr(settings, 'SIGHTENGINE_API_SECRET', '')
        
        if not api_user or not api_secret:
            logger.error("Sightengine API credentials not configured")
            return False, 0, {"error": "API credentials not configured"}
        
        # Prepare the image
        if hasattr(image_file, 'read'):
            # File object - use requests multipart upload
            files = {'media': image_file}
            data = {
                'api_user': api_user,
                'api_secret': api_secret,
                'models': 'nudity,gore,offensive'
            }
            r = requests.post('https://api.sightengine.com/1.0/check.json', 
                             files=files, data=data)
        else:
            # Path to image file
            files = {'media': open(image_file, 'rb')}
            data = {
                'api_user': api_user,
                'api_secret': api_secret,
                'models': 'nudity,gore,offensive'
            }
            r = requests.post('https://api.sightengine.com/1.0/check.json', 
                             files=files, data=data)
        
        output = r.json()
        
        if 'error' in output:
            logger.error(f"Sightengine API error: {output['error']}")
            return False, 0, output
        
        # Check for nudity and gore scores
        nudity_score = output.get('nudity', {}).get('raw', 0)
        gore_score = output.get('gore', {}).get('prob', 0)
        offensive_score = output.get('offensive', {}).get('prob', 0)
        
        # Consider image unsafe if any score is above threshold
        threshold = 0.6  # Adjust as needed
        is_safe = all(score < threshold for score in [nudity_score, gore_score, offensive_score])
        
        highest_score = max(nudity_score, gore_score, offensive_score)
        
        categories = {
            "nudity": nudity_score,
            "gore": gore_score,
            "offensive": offensive_score
        }
        
        return is_safe, highest_score, categories
        
    except Exception as e:
        logger.error(f"Error in Sightengine moderation: {str(e)}")
        # Default to manual review if API fails
        return False, 0, {"error": str(e)}

# Option 3: Using NudeNet (free, open-source)
def moderate_image_with_nudenet(image_file):
    """
    Check if an image contains nudity using the NudeNet library.
    Returns a tuple (is_safe, confidence, categories)
    """
    try:
        from nudenet import NudeClassifier
        
        # Initialize the classifier (first run downloads the model)
        classifier = NudeClassifier()
        
        # Handle different input types
        if hasattr(image_file, 'read'):
            # If it's a file-like object (from upload), save to temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp:
                temp.write(image_file.read())
                image_path = temp.name
                # Reset file pointer for other functions
                image_file.seek(0)
        else:
            # If it's a file path
            image_path = image_file
        
        # Classify the image
        result = classifier.classify(image_path)
        
        # Clean up temp file if created
        if hasattr(image_file, 'read') and os.path.exists(image_path):
            os.unlink(image_path)
        
        # Extract scores from the result
        nudity_score = result[image_path].get('unsafe', 0)
        
        # Set threshold for safety
        threshold = float(getattr(settings, 'MODERATION_THRESHOLD_NUDITY', 0.6))
        is_safe = nudity_score < threshold
        
        categories = {
            "nudity": nudity_score,
            "safe": 1 - nudity_score
        }
        
        return is_safe, nudity_score, categories
        
    except Exception as e:
        logger.error(f"Error in NudeNet moderation: {str(e)}")
        # Default to manual review if processing fails
        return False, 0, {"error": str(e)}

# Option 4: Using TensorFlow with pre-trained model (free, open-source)
def moderate_image_with_tensorflow(image_file):
    """
    Check if an image contains violence or graphic content using TensorFlow.
    Returns a tuple (is_safe, confidence, categories)
    """
    try:
        import tensorflow as tf
        import tensorflow_hub as hub
        
        # Load pre-trained MobileNetV2 model once
        if not hasattr(moderate_image_with_tensorflow, 'model'):
            # Use a model that can detect general objects, then we'll post-process
            # the results to identify potential violence/gore
            model_url = "https://tfhub.dev/google/tf2-preview/mobilenet_v2/classification/4"
            moderate_image_with_tensorflow.model = tf.keras.Sequential([
                hub.KerasLayer(model_url)
            ])
            
        # Process the image
        img = _load_and_prepare_image(image_file)
        if img is None:
            return False, 0, {"error": "Unable to process image"}
        
        # Make prediction
        predictions = moderate_image_with_tensorflow.model.predict(img)
        
        # Load ImageNet labels
        labels_path = os.path.join(os.path.dirname(__file__), 'imagenet_labels.txt')
        if not os.path.exists(labels_path):
            # Download labels if they don't exist
            url = "https://storage.googleapis.com/download.tensorflow.org/data/ImageNetLabels.txt"
            r = requests.get(url)
            with open(labels_path, 'wb') as f:
                f.write(r.content)
                
        with open(labels_path, 'r') as f:
            labels = [line.strip() for line in f.readlines()]
        
        # Get top 5 predictions
        top_indices = predictions[0].argsort()[-5:][::-1]
        top_predictions = {labels[i]: float(predictions[0][i]) for i in top_indices}
        
        # Define violence-related categories
        violence_categories = [
            'revolver', 'rifle', 'assault_rifle', 'weapon', 'knife', 'dagger',
            'axe', 'guillotine', 'chainsaw', 'blood', 'wound', 'injury',
            'coffin', 'stretcher', 'ambulance', 'military_uniform'
        ]
        
        # Check for matches in violence categories
        violence_score = 0
        for category in violence_categories:
            for label, score in top_predictions.items():
                if category.lower() in label.lower():
                    violence_score = max(violence_score, score)
        
        # Set threshold for safety
        threshold = float(getattr(settings, 'MODERATION_THRESHOLD_VIOLENCE', 0.6))
        is_safe = violence_score < threshold
        
        categories = {
            "violence": violence_score,
            "top_predictions": top_predictions
        }
        
        return is_safe, violence_score, categories
        
    except Exception as e:
        logger.error(f"Error in TensorFlow moderation: {str(e)}")
        # Default to manual review if processing fails
        return False, 0, {"error": str(e)}

def _load_and_prepare_image(image_file):
    """Helper function to load and prepare images for TensorFlow"""
    try:
        # Handle different input types
        if hasattr(image_file, 'read'):
            # If file-like object
            image_bytes = image_file.read()
            # Reset file pointer for other functions
            image_file.seek(0)
            img = tf.image.decode_image(image_bytes, channels=3)
        else:
            # If file path
            img = tf.io.read_file(image_file)
            img = tf.image.decode_image(img, channels=3)
        
        # Resize and preprocess
        img = tf.image.resize(img, [224, 224])
        img = img / 255.0  # Normalize to [0,1]
        img = tf.expand_dims(img, 0)  # Add batch dimension
        
        return img
    except Exception as e:
        logger.error(f"Error loading image: {str(e)}")
        return None

# Function to choose which moderation service to use
def moderate_image(image_file):
    """
    Moderate an image using the configured service.
    Returns a tuple (is_safe, confidence, categories)
    """
    moderation_service = getattr(settings, 'CONTENT_MODERATION_SERVICE', 'nudenet')
    
    if moderation_service == 'google_vision':
        return moderate_image_with_google_vision(image_file)
    elif moderation_service == 'sightengine':
        return moderate_image_with_sightengine(image_file)
    elif moderation_service == 'nudenet':
        return moderate_image_with_nudenet(image_file)
    elif moderation_service == 'tensorflow':
        return moderate_image_with_tensorflow(image_file)
    else:
        logger.error(f"Unknown moderation service: {moderation_service}")
        return False, 0, {"error": "Unknown moderation service"}

# Video moderation can be implemented by sampling frames
def moderate_video(video_file):
    """
    Moderate a video by sampling frames and checking them.
    Returns a tuple (is_safe, confidence, categories)
    """
    try:
        import cv2
        import tempfile
        
        # Create a temporary directory to store frames
        with tempfile.TemporaryDirectory() as tmpdirname:
            # Open the video
            video = cv2.VideoCapture(video_file.temporary_file_path() if hasattr(video_file, 'temporary_file_path') else video_file)
            
            # Get video properties
            fps = video.get(cv2.CAP_PROP_FPS)
            frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = frame_count / fps
            
            # Determine number of frames to sample (1 frame per second, max 10 frames)
            sample_count = min(int(duration), 10)
            
            # Calculate frame indices to sample
            if sample_count <= 1:
                frame_indices = [0]
            else:
                frame_indices = [int(i * frame_count / sample_count) for i in range(sample_count)]
            
            results = []
            
            # Process each sampled frame
            for frame_idx in frame_indices:
                video.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                success, frame = video.read()
                
                if success:
                    # Save frame to temporary file
                    frame_path = os.path.join(tmpdirname, f"frame_{frame_idx}.jpg")
                    cv2.imwrite(frame_path, frame)
                    
                    # Moderate the frame
                    is_safe, confidence, categories = moderate_image(frame_path)
                    results.append((is_safe, confidence, categories))
            
            video.release()
            
            # If any frame is not safe, the whole video is not safe
            is_video_safe = all(result[0] for result in results)
            
            # Get the highest confidence score from unsafe frames
            if not is_video_safe:
                unsafe_results = [result for result in results if not result[0]]
                highest_confidence = max(result[1] for result in unsafe_results) if unsafe_results else 0
            else:
                highest_confidence = 0
            
            # Combine all categories
            combined_categories = {}
            for _, _, categories in results:
                for category, score in categories.items():
                    if category in combined_categories:
                        combined_categories[category] = max(combined_categories[category], score)
                    else:
                        combined_categories[category] = score
            
            return is_video_safe, highest_confidence, combined_categories
            
    except Exception as e:
        logger.error(f"Error in video moderation: {str(e)}")
        # Default to manual review if processing fails
        return False, 0, {"error": str(e)}

# Option 5: Simple color analysis for blood detection (very basic)
def detect_blood_in_image(image_file):
    """
    A very basic approach to detect potential blood in an image based on color analysis.
    This is not comprehensive but can serve as a simple first-pass filter.
    Returns a tuple (is_safe, confidence, categories)
    """
    try:
        # Load image
        if hasattr(image_file, 'read'):
            # Convert file-like object to numpy array
            image_bytes = np.frombuffer(image_file.read(), np.uint8)
            image_file.seek(0)  # Reset file pointer
            img = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
        else:
            # Load from path
            img = cv2.imread(image_file)
        
        if img is None:
            return False, 0, {"error": "Unable to load image"}
        
        # Convert to HSV color space which is better for color analysis
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        
        # Define range for blood-red color
        # HSV range for blood red: Hue 0-10 or 160-180, Saturation 60-255, Value 60-255
        lower_red1 = np.array([0, 60, 60])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([160, 60, 60])
        upper_red2 = np.array([180, 255, 255])
        
        # Create masks for red regions
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask = cv2.bitwise_or(mask1, mask2)
        
        # Calculate percentage of red pixels
        red_pixel_count = cv2.countNonZero(mask)
        total_pixels = img.shape[0] * img.shape[1]
        red_percentage = red_pixel_count / total_pixels
        
        # If percentage of red pixels is above threshold, flag as potential blood
        threshold = 0.1  # 10% of the image is red
        blood_score = min(1.0, red_percentage * 5)  # Scale up to get a 0-1 score
        
        is_safe = blood_score < threshold
        
        categories = {
            "blood_detection": blood_score,
            "red_percentage": red_percentage
        }
        
        return is_safe, blood_score, categories
        
    except Exception as e:
        logger.error(f"Error in blood detection: {str(e)}")
        return False, 0, {"error": str(e)} 