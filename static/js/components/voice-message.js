// Voice message recording functionality

document.addEventListener('DOMContentLoaded', function() {
    const voiceRecordBtn = document.getElementById('voice-record-btn');
    if (!voiceRecordBtn) return; // Exit if button doesn't exist

    const voiceRecorderContainer = document.getElementById('voice-recorder-container');
    const cancelRecordingBtn = document.getElementById('cancel-recording');
    const stopRecordingBtn = document.getElementById('stop-recording');
    const voicePreview = document.getElementById('voice-preview');
    const voicePreviewAudio = document.getElementById('voice-preview-audio');
    const clearVoiceBtn = document.getElementById('clear-voice');
    const sendVoiceBtn = document.getElementById('send-voice');
    const voiceMessageInput = document.getElementById('voice-message');
    const recordingTime = document.querySelector('.recording-time');
    
    let mediaRecorder;
    let audioChunks = [];
    let recordingTimer;
    let secondsRecorded = 0;
    let audioBlob;
    
    // Request microphone access and set up recorder
    voiceRecordBtn.addEventListener('click', function() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    mediaRecorder = new MediaRecorder(stream);
                    
                    mediaRecorder.ondataavailable = event => {
                        audioChunks.push(event.data);
                    };
                    
                    mediaRecorder.onstop = () => {
                        audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        voicePreviewAudio.src = audioUrl;
                        
                        // Show voice preview
                        voiceRecorderContainer.style.display = 'none';
                        voicePreview.style.display = 'block';
                        
                        // Create a File object from the Blob
                        const audioFile = new File([audioBlob], "voice-message.mp3", { 
                            type: 'audio/mpeg',
                            lastModified: new Date().getTime()
                        });
                        
                        // Create a FileList-like object
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(audioFile);
                        voiceMessageInput.files = dataTransfer.files;
                        
                        // Stop all tracks to release microphone
                        stream.getTracks().forEach(track => track.stop());
                    };
                    
                    // Reset chunks
                    audioChunks = [];
                    
                    // Start recording
                    mediaRecorder.start();
                    
                    // Show recorder UI
                    voiceRecorderContainer.style.display = 'block';
                    
                    // Start recording timer
                    secondsRecorded = 0;
                    updateRecordingTime();
                    recordingTimer = setInterval(updateRecordingTime, 1000);
                })
                .catch(error => {
                    console.error('Error accessing microphone:', error);
                    alert('Could not access your microphone. Please allow microphone access and try again.');
                });
        } else {
            alert('Your browser does not support audio recording.');
        }
    });
    
    // Update recording time display
    function updateRecordingTime() {
        secondsRecorded++;
        const minutes = Math.floor(secondsRecorded / 60);
        const seconds = secondsRecorded % 60;
        recordingTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Limit recording to 2 minutes
        if (secondsRecorded >= 120) {
            stopRecording();
        }
    }
    
    // Handle cancel recording
    if (cancelRecordingBtn) {
        cancelRecordingBtn.addEventListener('click', function() {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                clearInterval(recordingTimer);
                voiceRecorderContainer.style.display = 'none';
            }
        });
    }
    
    // Handle stop recording
    if (stopRecordingBtn) {
        stopRecordingBtn.addEventListener('click', stopRecording);
    }
    
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            clearInterval(recordingTimer);
        }
    }
    
    // Handle clear voice preview
    if (clearVoiceBtn) {
        clearVoiceBtn.addEventListener('click', function() {
            voicePreview.style.display = 'none';
            voicePreviewAudio.src = '';
            voiceMessageInput.value = '';
        });
    }
    
    // Handle send voice message
    if (sendVoiceBtn) {
        sendVoiceBtn.addEventListener('click', function() {
            if (voiceMessageInput.files.length > 0) {
                const formData = new FormData(document.getElementById('send-message-form'));
                formData.delete('content'); // Remove empty content field
                
                const roomId = document.querySelector('meta[name="room-id"]')?.content;
                if (!roomId) return;
                
                fetch(`/chat/${roomId}/send/`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        // Clear preview
                        voicePreview.style.display = 'none';
                        voicePreviewAudio.src = '';
                        voiceMessageInput.value = '';
                        
                        // Refresh messages
                        if (typeof window.refreshMessages === 'function') {
                            window.refreshMessages(true);
                        } else {
                            window.location.reload();
                        }
                    }
                })
                .catch(error => {
                    console.error('Error sending voice message:', error);
                });
            }
        });
    }
}); 