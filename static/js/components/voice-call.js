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
    let remoteStream = new MediaStream();
    let signallingServerMessages = [];
    
    // WebSocket connection for call notifications
    let ws = null;
    try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/chat/${roomId}/`;
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
            console.log('WebSocket connection established for call notifications');
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log('WebSocket message received:', data);
                
                if (data.type === 'call_notification') {
                    console.log('Call notification received:', data.call_data);
                    handleCallNotification(data.call_data);
                } else if (data.type === 'call_status_update') {
                    console.log('Call status update received:', data.status_data);
                    handleCallStatusUpdate(data.status_data);
                }
            } catch (e) {
                console.error('Error processing WebSocket message:', e);
            }
        };
        
        ws.onclose = function() {
            console.log('WebSocket connection closed. Attempting to reconnect...');
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.CLOSED) {
                    ws = new WebSocket(wsUrl);
                }
            }, 3000);
        };
        
        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
        };
    } catch (e) {
        console.error('Error setting up WebSocket:', e);
    }
    
    // Handle call notification from WebSocket
    function handleCallNotification(callData) {
        console.log('Processing call notification:', callData);
        
        if (currentCallId) {
            console.log('Already in a call, ignoring notification');
            return; // Don't show notification if already in a call
        }
        
        const username = document.querySelector('meta[name="username"]')?.content;
        if (callData.initiator === username) {
            console.log('Ignoring own call notification');
            return; // Don't show notification to the caller
        }
        
        // Show incoming call UI
        incomingCallerElement.textContent = `${callData.initiator} is calling...`;
        currentCallId = callData.id;
        
        // Show the modal
        incomingCallModal.show();
        
        // Play ringtone
        try {
            const ringtone = new Audio('/static/sounds/call-ringtone.mp3');
            ringtone.loop = true;
            ringtone.play().catch(e => console.error('Error playing ringtone:', e));
            
            // Store ringtone to stop it later
            window.activeRingtone = ringtone;
        } catch (e) {
            console.error('Error with ringtone:', e);
        }
        
        // Show browser notification if supported
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification('Incoming Call', {
                    body: `${callData.initiator} is calling you`,
                    icon: '/static/images/logo.png'
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification('Incoming Call', {
                            body: `${callData.initiator} is calling you`,
                            icon: '/static/images/logo.png'
                        });
                    }
                });
            }
        }
    }
    
    // Handle call status update from WebSocket
    function handleCallStatusUpdate(statusData) {
        console.log('Processing call status update:', statusData);
        
        if (statusData.call_id !== currentCallId) {
            console.log('Status update for different call, ignoring');
            return;
        }
        
        if (statusData.status === 'completed') {
            console.log('Call completed, ending local call');
            endCall();
        } else if (statusData.status === 'ongoing') {
            console.log('Call ongoing, updating UI');
            callStatusElement.textContent = 'In call';
            if (statusData.participants && statusData.participants.length) {
                callParticipantsElement.textContent = `With: ${statusData.participants.join(', ')}`;
            }
        }
    }
    
    // WebRTC configuration
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    };
    
    // Setup WebRTC connection
    async function setupWebRTC() {
        try {
            console.log('Setting up WebRTC connection');
            
            // Reset any existing connections
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            
            // Get user's audio stream
            callStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false
            });
            
            console.log('Got local media stream:', callStream);
            
            // Create peer connection
            peerConnection = new RTCPeerConnection(configuration);
            console.log('Created peer connection');
            
            // Add local audio track to peer connection
            callStream.getTracks().forEach(track => {
                console.log('Adding local track to peer connection:', track.kind);
                peerConnection.addTrack(track, callStream);
            });
            
            // Handle ICE candidates
            peerConnection.onicecandidate = handleICECandidate;
            
            // Handle connection state changes
            peerConnection.onconnectionstatechange = function(event) {
                console.log('Connection state changed:', peerConnection.connectionState);
                switch(peerConnection.connectionState) {
                    case 'connected':
                        callStatusElement.textContent = 'Connected';
                        startCallTimer();
                        break;
                    case 'disconnected':
                    case 'failed':
                        console.log('Connection failed or disconnected');
                        endCall();
                        break;
                }
            };
            
            // Handle ICE connection state changes
            peerConnection.oniceconnectionstatechange = function(event) {
                console.log('ICE connection state changed:', peerConnection.iceConnectionState);
            };
            
            // Handle signaling state changes
            peerConnection.onsignalingstatechange = function(event) {
                console.log('Signaling state changed:', peerConnection.signalingState);
            };
            
            // Handle negotiation needed
            peerConnection.onnegotiationneeded = handleNegotiationNeeded;
            
            // Handle incoming tracks
            peerConnection.ontrack = function(event) {
                console.log('Received remote track:', event);
                
                // Add incoming audio to remote stream
                event.streams[0].getTracks().forEach(track => {
                    console.log('Adding remote track to remote stream:', track.kind);
                    remoteStream.addTrack(track);
                });
                
                // Create and play remote audio
                const remoteAudio = document.createElement('audio');
                remoteAudio.id = 'remote-audio';
                remoteAudio.srcObject = remoteStream;
                remoteAudio.autoplay = true;
                document.body.appendChild(remoteAudio);
                
                console.log('Remote audio element created and started playing');
                
                // Updates UI when connected
                callStatusElement.textContent = 'Connected';
                startCallTimer();
            };
            
            // If initiator, create and send offer
            if (isCallInitiator) {
                console.log('Creating offer as initiator');
                createOfferAndSendSignal();
            }
            
        } catch (error) {
            console.error('Error setting up WebRTC:', error);
            alert('Could not access microphone. Please allow microphone access and try again.');
            endCall();
        }
    }
    
    // Handle ICE candidate
    function handleICECandidate(event) {
        if (event.candidate) {
            console.log('Generated ICE candidate:', event.candidate);
            
            // Store ICE candidate to send once connected with peer
            signallingServerMessages.push({
                type: 'ice-candidate',
                candidate: event.candidate
            });
            
            // Send all pending messages
            sendPendingSignallingMessages();
        }
    }
    
    // Handle negotiation needed
    async function handleNegotiationNeeded() {
        try {
            console.log('Negotiation needed event fired');
            
            if (isCallInitiator) {
                await createOfferAndSendSignal();
            }
        } catch (error) {
            console.error('Error in negotiation:', error);
        }
    }
    
    // Create and send offer
    async function createOfferAndSendSignal() {
        try {
            console.log('Creating offer');
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: false
            });
            
            console.log('Setting local description:', offer);
            await peerConnection.setLocalDescription(offer);
            
            // Store offer to send
            signallingServerMessages.push({
                type: 'offer',
                sdp: peerConnection.localDescription
            });
            
            // Send all pending messages
            sendPendingSignallingMessages();
            
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }
    
    // Handle incoming WebRTC signaling messages
    function handleSignalingMessage(message) {
        console.log('Handling signaling message:', message);
        
        try {
            if (message.type === 'offer' && !isCallInitiator) {
                handleOffer(message.sdp);
            } else if (message.type === 'answer' && isCallInitiator) {
                handleAnswer(message.sdp);
            } else if (message.type === 'ice-candidate') {
                handleRemoteICECandidate(message.candidate);
            }
        } catch (error) {
            console.error('Error handling signaling message:', error);
        }
    }
    
    // Handle offer from remote peer
    async function handleOffer(offer) {
        try {
            console.log('Received offer, setting remote description');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            console.log('Creating answer');
            const answer = await peerConnection.createAnswer();
            
            console.log('Setting local description:', answer);
            await peerConnection.setLocalDescription(answer);
            
            // Store answer to send
            signallingServerMessages.push({
                type: 'answer',
                sdp: peerConnection.localDescription
            });
            
            // Send all pending messages
            sendPendingSignallingMessages();
            
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }
    
    // Handle answer from remote peer
    async function handleAnswer(answer) {
        try {
            console.log('Received answer, setting remote description');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }
    
    // Handle remote ICE candidate
    async function handleRemoteICECandidate(candidate) {
        try {
            console.log('Adding remote ICE candidate:', candidate);
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding remote ICE candidate:', error);
        }
    }
    
    // Send pending signaling messages to peer
    function sendPendingSignallingMessages() {
        if (signallingServerMessages.length > 0 && peerConnection && currentCallId) {
            console.log('Sending pending signaling messages:', signallingServerMessages);
            
            // Clone the messages array since we'll be emptying it
            const messagesToSend = [...signallingServerMessages];
            
            // Clear the pending messages
            signallingServerMessages = [];
            
            // Send messages to the server for distribution to peers
            messagesToSend.forEach(message => {
                fetch(`/voice-call/${currentCallId}/status/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                    },
                    body: JSON.stringify({
                        signaling_message: message
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.status !== 'success') {
                        console.error('Error sending signaling message:', data);
                        // Put message back in queue if sending failed
                        signallingServerMessages.push(message);
                    }
                })
                .catch(error => {
                    console.error('Error sending signaling message:', error);
                    // Put message back in queue if sending failed
                    signallingServerMessages.push(message);
                });
            });
            
            // Poll more frequently when we have pending messages
            pollCallStatus();
        }
    }
    
    // Start a voice call
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', function() {
            console.log('Voice call button clicked');
            
            // Check for active calls first
            fetch(`/chat/${roomId}/active-call/`)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        if (data.active_call) {
                            console.log('Active call found, joining:', data.active_call);
                            joinExistingCall(data.active_call);
                        } else {
                            console.log('No active call, initiating new call');
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
        console.log('Initiating new call');
        
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
                console.log('Call initiated successfully, call_id:', data.call_id);
                
                // Set up WebRTC
                currentCallId = data.call_id;
                isCallInitiator = true;
                signallingServerMessages = []; // Reset signaling messages
                
                // Show call UI
                callStatusElement.textContent = 'Calling...';
                callParticipantsElement.textContent = 'Waiting for others to join';
                voiceCallModal.show();
                
                // Initialize WebRTC connection
                setupWebRTC();
                
                // Start checking for incoming calls
                startIncomingCallsCheck();
                
                // Poll for participants and signaling messages
                pollCallStatus();
                
                // Request notification permission if not already granted
                if ('Notification' in window && Notification.permission !== 'granted') {
                    Notification.requestPermission();
                }
            }
        })
        .catch(error => {
            console.error('Error initiating call:', error);
        });
    }
    
    // Join an existing call
    function joinExistingCall(callInfo) {
        console.log('Joining existing call:', callInfo);
        
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
                console.log('Call joined successfully');
                
                // Set up WebRTC
                currentCallId = callInfo.id;
                isCallInitiator = false;
                signallingServerMessages = []; // Reset signaling messages
                
                // Show call UI
                callStatusElement.textContent = 'Joining call...';
                if (callInfo.participants && callInfo.participants.length) {
                    callParticipantsElement.textContent = `With: ${callInfo.participants.join(', ')}`;
                }
                voiceCallModal.show();
                
                // Initialize WebRTC connection
                setupWebRTC();
                
                // Start call timer
                startCallTimer();
                
                // Start checking for incoming calls and poll for signaling
                startIncomingCallsCheck();
                pollCallStatus();
            }
        })
        .catch(error => {
            console.error('Error joining call:', error);
            alert('Failed to join call. Please try again.');
        });
    }
    
    // Poll call status with exponential backoff
    function pollCallStatus() {
        if (!currentCallId) return;
        
        // Clear any existing timeout
        if (pollCallStatusTimeout) {
            clearTimeout(pollCallStatusTimeout);
        }
        
        console.log('Polling call status for call_id:', currentCallId);
        
        fetch(`/voice-call/${currentCallId}/status/`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    // Reset error count on success
                    callStatusErrorCount = 0;
                    
                    console.log('Call status poll successful:', data);
                    
                    // Handle any signaling messages
                    if (data.signaling_messages && data.signaling_messages.length > 0) {
                        console.log('Received signaling messages:', data.signaling_messages);
                        // Process each signaling message
                        data.signaling_messages.forEach(message => {
                            handleSignalingMessage(message);
                        });
                    }
                    
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
                        console.log('Call marked as completed on server');
                        endCall();
                        return;
                    }
                    
                    // Schedule next poll
                    // More frequent if we have pending messages to send
                    const pollInterval = signallingServerMessages.length > 0 ? 2000 : 10000;
                    pollCallStatusTimeout = setTimeout(pollCallStatus, pollInterval);
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
        if (callTimer) return; // Don't start if already running
        
        console.log('Starting call timer');
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
            if (!callStream) return;
            
            console.log('Mute button clicked');
            
            const audioTracks = callStream.getAudioTracks();
            if (audioTracks.length > 0) {
                isMuted = !isMuted;
                audioTracks[0].enabled = !isMuted;
                
                if (isMuted) {
                    muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                    muteBtn.classList.add('btn-warning');
                    muteBtn.classList.remove('btn-light');
                    console.log('Microphone muted');
                } else {
                    muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                    muteBtn.classList.add('btn-light');
                    muteBtn.classList.remove('btn-warning');
                    console.log('Microphone unmuted');
                }
            }
        });
    }
    
    // Handle end call
    if (endCallBtn) {
        endCallBtn.addEventListener('click', function() {
            console.log('End call button clicked');
            
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
                    console.log('Call ended on server:', data);
                    if (data.status === 'success') {
                        endCall();
                    }
                })
                .catch(error => {
                    console.error('Error ending call on server:', error);
                    // Force end call even if the request failed
                    endCall();
                });
            }
        });
    }
    
    // End call function
    function endCall() {
        console.log('Ending call');
        
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
        if (peerConnection) {
            console.log('Closing peer connection');
            peerConnection.close();
            peerConnection = null;
        }
        
        // Stop media tracks
        if (callStream) {
            console.log('Stopping media tracks');
            callStream.getTracks().forEach(track => {
                track.stop();
                console.log('Stopped track:', track.kind);
            });
            callStream = null;
        }
        
        // Stop ringtone if active
        if (window.activeRingtone) {
            window.activeRingtone.pause();
            window.activeRingtone = null;
        }
        
        // Hide call UI
        try {
            console.log('Hiding call modals');
            if (voiceCallModal._isShown) voiceCallModal.hide();
            if (incomingCallModal._isShown) incomingCallModal.hide();
        } catch (e) {
            console.error('Error hiding modals:', e);
        }
        
        // Reset call state
        currentCallId = null;
        callSeconds = 0;
        isMuted = false;
        isCallInitiator = false;
        callStatusErrorCount = 0;
        signallingServerMessages = [];
        remoteStream = new MediaStream();
        
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
        
        console.log('Call ended successfully');
    }
    
    // Accept incoming call
    if (acceptCallBtn) {
        acceptCallBtn.addEventListener('click', function() {
            console.log('Accept call button clicked');
            
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
            console.log('Decline call button clicked');
            
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
                    console.log('Call declined successfully:', data);
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
                        console.log('Found incoming call, showing notification:', callInfo);
                        
                        // Show incoming call UI
                        incomingCallerElement.textContent = `${callInfo.initiator} is calling...`;
                        incomingCallModal.show();
                        
                        // Store call ID
                        currentCallId = callInfo.id;
                        
                        // Play ringtone
                        try {
                            const ringtone = new Audio('/static/sounds/call-ringtone.mp3');
                            ringtone.loop = true;
                            ringtone.play().catch(e => console.error('Error playing ringtone:', e));
                            
                            // Store ringtone to stop it later
                            window.activeRingtone = ringtone;
                        } catch (e) {
                            console.error('Error with ringtone:', e);
                        }
                        
                        // Show browser notification
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('Incoming Call', {
                                body: `${callInfo.initiator} is calling you`,
                                icon: '/static/images/logo.png'
                            });
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
        // Use a 3-second interval for responsive notifications
        if (!checkIncomingCallsInterval) {
            checkIncomingCallsInterval = setInterval(checkForIncomingCalls, 3000);
        }
    }
    
    // Stop checking for incoming calls
    function stopIncomingCallsCheck() {
        if (checkIncomingCallsInterval) {
            clearInterval(checkIncomingCallsInterval);
            checkIncomingCallsInterval = null;
        }
    }
    
    // Clean up WebSocket on page unload
    window.addEventListener('beforeunload', function() {
        if (ws) {
            ws.close();
        }
        stopIncomingCallsCheck();
        endCall();
    });
    
    // Initial check for incoming calls
    startIncomingCallsCheck();
    
    // Request notification permissions on page load
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        // Wait a moment before asking for permission to avoid overwhelming the user
        setTimeout(() => {
            Notification.requestPermission();
        }, 5000);
    }
    
    console.log('Voice call system initialized');
}); 