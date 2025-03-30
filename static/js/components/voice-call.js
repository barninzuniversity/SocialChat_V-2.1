// Voice call functionality

document.addEventListener('DOMContentLoaded', function() {
    const voiceCallBtn = document.getElementById('voice-call-btn');
    if (!voiceCallBtn) return; // Exit if button doesn't exist

    const roomId = document.querySelector('meta[name="room-id"]')?.content;
    if (!roomId) return; // Exit if room ID is not available

    let voiceCallModal, incomingCallModal;
    try {
        voiceCallModal = new bootstrap.Modal(document.getElementById('voiceCallModal'));
        incomingCallModal = new bootstrap.Modal(document.getElementById('incomingCallModal'));
    } catch (e) {
        console.error('Error initializing modals:', e);
        return;
    }

    const callStatusElement = document.getElementById('call-status');
    const callParticipantsElement = document.getElementById('call-participants');
    const callTimerElement = document.getElementById('call-timer');
    const muteBtn = document.getElementById('mute-btn');
    const endCallBtn = document.getElementById('end-call-btn');
    const acceptCallBtn = document.getElementById('accept-call-btn');
    const declineCallBtn = document.getElementById('decline-call-btn');
    const incomingCallerElement = document.getElementById('incoming-caller');
    
    let currentCallId = null;
    let callTimer = null;
    let callSeconds = 0;
    let callStream = null;
    let peerConnection = null;
    let dataChannel = null;
    let isMuted = false;
    let isCallInitiator = false;
    let pollCallStatusTimeout = null;
    let checkIncomingCallsInterval = null;
    let callStatusErrorCount = 0;
    
    // WebRTC configuration
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    // Start a voice call
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', function() {
            // Check for active calls first
            fetch(`/chat/${roomId}/active-call/`)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        if (data.active_call) {
                            // Join existing call
                            joinExistingCall(data.active_call);
                        } else {
                            // Initiate new call
                            initiateCall();
                        }
                    }
                })
                .catch(error => {
                    console.error('Error checking for active calls:', error);
                });
        });
    }
    
    // Initiate a new call
    function initiateCall() {
        fetch(`/chat/${roomId}/voice-call/initiate/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Set up WebRTC
                currentCallId = data.call_id;
                isCallInitiator = true;
                
                // Show call UI
                callStatusElement.textContent = 'Calling...';
                callParticipantsElement.textContent = 'Waiting for others to join';
                voiceCallModal.show();
                
                // Initialize WebRTC connection
                setupWebRTC();
                
                // Start checking for incoming calls
                startIncomingCallsCheck();
                
                // Poll for participants
                pollCallStatus();
            }
        })
        .catch(error => {
            console.error('Error initiating call:', error);
        });
    }
    
    // Join an existing call
    function joinExistingCall(callInfo) {
        fetch(`/voice-call/${callInfo.id}/join/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Set up WebRTC
                currentCallId = callInfo.id;
                isCallInitiator = false;
                
                // Show call UI
                callStatusElement.textContent = 'In call';
                if (callInfo.participants && callInfo.participants.length) {
                    callParticipantsElement.textContent = `With: ${callInfo.participants.join(', ')}`;
                }
                voiceCallModal.show();
                
                // Start call timer
                startCallTimer();
                
                // Initialize WebRTC connection
                setupWebRTC();
                
                // Start checking for incoming calls
                startIncomingCallsCheck();
            }
        })
        .catch(error => {
            console.error('Error joining call:', error);
        });
    }
    
    // Set up WebRTC
    function setupWebRTC() {
        // Request user media
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                callStream = stream;
                
                // Create peer connection
                peerConnection = new RTCPeerConnection(configuration);
                
                // Add local stream
                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });
                
                // Create data channel for signaling
                if (isCallInitiator) {
                    dataChannel = peerConnection.createDataChannel('signaling');
                    dataChannel.onmessage = handleDataChannelMessage;
                } else {
                    peerConnection.ondatachannel = event => {
                        dataChannel = event.channel;
                        dataChannel.onmessage = handleDataChannelMessage;
                    };
                }
                
                // Handle ICE candidates
                peerConnection.onicecandidate = event => {
                    if (event.candidate) {
                        if (dataChannel && dataChannel.readyState === 'open') {
                            dataChannel.send(JSON.stringify({
                                type: 'ice-candidate',
                                candidate: event.candidate
                            }));
                        }
                    }
                };
                
                // Handle connection state changes
                peerConnection.onconnectionstatechange = event => {
                    switch(peerConnection.connectionState) {
                        case 'connected':
                            callStatusElement.textContent = 'Connected';
                            startCallTimer();
                            break;
                        case 'disconnected':
                        case 'failed':
                            endCall();
                            break;
                    }
                };
                
                // Handle track events
                peerConnection.ontrack = event => {
                    // Create audio element for remote stream
                    const remoteAudio = document.createElement('audio');
                    remoteAudio.srcObject = event.streams[0];
                    remoteAudio.autoplay = true;
                    remoteAudio.style.display = 'none';
                    document.body.appendChild(remoteAudio);
                };
                
                // Create offer if initiator
                if (isCallInitiator) {
                    peerConnection.createOffer()
                        .then(offer => peerConnection.setLocalDescription(offer))
                        .then(() => {
                            // Send offer to signaling server
                        })
                        .catch(error => {
                            console.error('Error creating offer:', error);
                        });
                }
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                alert('Could not access microphone. Please allow microphone access and try again.');
                endCall();
            });
    }
    
    // Handle data channel messages
    function handleDataChannelMessage(event) {
        try {
            const message = JSON.parse(event.data);
            
            switch(message.type) {
                case 'ice-candidate':
                    peerConnection.addIceCandidate(message.candidate)
                        .catch(error => {
                            console.error('Error adding ICE candidate:', error);
                        });
                    break;
                case 'offer':
                    peerConnection.setRemoteDescription(message)
                        .then(() => peerConnection.createAnswer())
                        .then(answer => peerConnection.setLocalDescription(answer))
                        .then(() => {
                            dataChannel.send(JSON.stringify({
                                type: 'answer',
                                sdp: peerConnection.localDescription.sdp
                            }));
                        })
                        .catch(error => {
                            console.error('Error handling offer:', error);
                        });
                    break;
                case 'answer':
                    peerConnection.setRemoteDescription(message)
                        .catch(error => {
                            console.error('Error handling answer:', error);
                        });
                    break;
            }
        } catch (error) {
            console.error('Error parsing data channel message:', error);
        }
    }
    
    // Poll call status with exponential backoff
    function pollCallStatus() {
        if (!currentCallId) return;
        
        // Clear any existing timeout
        if (pollCallStatusTimeout) {
            clearTimeout(pollCallStatusTimeout);
        }
        
        fetch(`/voice-call/${currentCallId}/status/`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Reset error count on success
                    callStatusErrorCount = 0;
                    
                    // Update UI based on call status
                    if (data.call_status === 'ongoing') {
                        callStatusElement.textContent = 'In call';
                        
                        if (!callTimer) {
                            startCallTimer();
                        }
                        
                        // Update participants
                        if (data.participants && data.participants.length) {
                            callParticipantsElement.textContent = `With: ${data.participants.join(', ')}`;
                        }
                    } else if (data.call_status === 'completed') {
                        endCall();
                        return;
                    }
                    
                    // Schedule next poll after 10 seconds
                    pollCallStatusTimeout = setTimeout(pollCallStatus, 10000);
                }
            })
            .catch(error => {
                console.error('Error polling call status:', error);
                callStatusErrorCount++;
                
                // Use exponential backoff for errors (max 1 minute interval)
                const backoffDelay = Math.min(60000, 5000 * Math.pow(2, callStatusErrorCount));
                pollCallStatusTimeout = setTimeout(pollCallStatus, backoffDelay);
            });
    }
    
    // Start call timer
    function startCallTimer() {
        callSeconds = 0;
        callTimerElement.textContent = '00:00';
        callTimerElement.style.display = 'block';
        
        callTimer = setInterval(() => {
            callSeconds++;
            const minutes = Math.floor(callSeconds / 60);
            const seconds = callSeconds % 60;
            callTimerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    // Handle mute/unmute
    if (muteBtn) {
        muteBtn.addEventListener('click', function() {
            if (callStream) {
                const audioTracks = callStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    isMuted = !isMuted;
                    audioTracks[0].enabled = !isMuted;
                    
                    if (isMuted) {
                        muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                        muteBtn.classList.add('btn-warning');
                        muteBtn.classList.remove('btn-light');
                    } else {
                        muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                        muteBtn.classList.add('btn-light');
                        muteBtn.classList.remove('btn-warning');
                    }
                }
            }
        });
    }
    
    // Handle end call
    if (endCallBtn) {
        endCallBtn.addEventListener('click', function() {
            if (currentCallId) {
                fetch(`/voice-call/${currentCallId}/end/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        endCall();
                    }
                })
                .catch(error => {
                    console.error('Error ending call:', error);
                    // Force end call even if the request failed
                    endCall();
                });
            }
        });
    }
    
    // End call function
    function endCall() {
        // Stop call timer
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }
        
        // Clear poll timeout
        if (pollCallStatusTimeout) {
            clearTimeout(pollCallStatusTimeout);
            pollCallStatusTimeout = null;
        }
        
        // Stop checking for incoming calls
        stopIncomingCallsCheck();
        
        // Close WebRTC connections
        if (dataChannel) {
            dataChannel.close();
            dataChannel = null;
        }
        
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        // Stop media tracks
        if (callStream) {
            callStream.getTracks().forEach(track => track.stop());
            callStream = null;
        }
        
        // Hide call UI
        try {
            voiceCallModal.hide();
        } catch (e) {
            console.error('Error hiding modal:', e);
        }
        
        // Reset call state
        currentCallId = null;
        callSeconds = 0;
        isMuted = false;
        isCallInitiator = false;
        callStatusErrorCount = 0;
        
        // Reset UI elements
        if (muteBtn) {
            muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            muteBtn.classList.add('btn-light');
            muteBtn.classList.remove('btn-warning');
        }
        if (callTimerElement) {
            callTimerElement.style.display = 'none';
        }
        
        // Remove any remote audio elements
        document.querySelectorAll('audio').forEach(audio => {
            if (audio.id !== 'voice-preview-audio') {
                audio.remove();
            }
        });
        
        // Refresh messages to see the call message
        if (typeof refreshMessages === 'function') {
            refreshMessages(true);
        }
    }
    
    // Accept incoming call
    if (acceptCallBtn) {
        acceptCallBtn.addEventListener('click', function() {
            if (currentCallId) {
                // Stop ringtone
                if (window.activeRingtone) {
                    window.activeRingtone.pause();
                    window.activeRingtone = null;
                }
                
                incomingCallModal.hide();
                joinExistingCall({ id: currentCallId });
            }
        });
    }
    
    // Decline incoming call
    if (declineCallBtn) {
        declineCallBtn.addEventListener('click', function() {
            if (currentCallId) {
                // Stop ringtone
                if (window.activeRingtone) {
                    window.activeRingtone.pause();
                    window.activeRingtone = null;
                }
                
                fetch(`/voice-call/${currentCallId}/decline/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    }
                })
                .then(response => response.json())
                .then(data => {
                    incomingCallModal.hide();
                    currentCallId = null;
                })
                .catch(error => {
                    console.error('Error declining call:', error);
                    incomingCallModal.hide();
                    currentCallId = null;
                });
            }
        });
    }

    // Check for incoming calls with error handling
    let incomingCallErrorCount = 0;
    function checkForIncomingCalls() {
        if (currentCallId) return; // Don't check if already in a call
        
        fetch(`/chat/${roomId}/active-call/`)
            .then(response => response.json())
            .then(data => {
                // Reset error count on success
                incomingCallErrorCount = 0;
                
                if (data.status === 'success' && data.active_call) {
                    const callInfo = data.active_call;
                    const username = document.querySelector('meta[name="username"]')?.content;
                    
                    // If there's an active call and we're not already in it
                    if (callInfo.status === 'initiated' && callInfo.initiator !== username && !currentCallId) {
                        // Show incoming call UI
                        incomingCallerElement.textContent = `${callInfo.initiator} is calling...`;
                        incomingCallModal.show();
                        
                        // Store call ID
                        currentCallId = callInfo.id;
                        
                        // Play ringtone
                        try {
                            const ringtone = new Audio('data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==');
                            ringtone.loop = true;
                            ringtone.play().catch(e => console.error('Error playing ringtone:', e));
                            
                            // Store ringtone to stop it later
                            window.activeRingtone = ringtone;
                        } catch (e) {
                            console.error('Error with ringtone:', e);
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Error checking for incoming calls:', error);
                incomingCallErrorCount++;
            });
    }
    
    // Start checking for incoming calls
    function startIncomingCallsCheck() {
        // Use a 15-second interval instead of 5 seconds to reduce server load
        if (!checkIncomingCallsInterval) {
            checkIncomingCallsInterval = setInterval(checkForIncomingCalls, 15000);
        }
    }
    
    // Stop checking for incoming calls
    function stopIncomingCallsCheck() {
        if (checkIncomingCallsInterval) {
            clearInterval(checkIncomingCallsInterval);
            checkIncomingCallsInterval = null;
        }
    }
    
    // Initial check for incoming calls
    startIncomingCallsCheck();
}); 