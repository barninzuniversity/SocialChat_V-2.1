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

    // Add a dev mode option to avoid using WebSockets
    const devModeParam = new URLSearchParams(window.location.search).get('dev_mode');
    const isDevMode = devModeParam === 'true' || devModeParam === '1';
    
    if (isDevMode) {
        console.log('Running in development mode - WebSocket will be disabled');
        // Add a dev mode indicator
        const devIndicator = document.createElement('span');
        devIndicator.textContent = 'DEV';
        devIndicator.className = 'badge bg-warning ms-1 small';
        devIndicator.title = 'Running in development mode';
        if (voiceCallBtn.parentNode) {
            voiceCallBtn.parentNode.insertBefore(devIndicator, voiceCallBtn.nextSibling);
        }
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
    let wsReconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    
    // WebSocket status indicator elements
    const wsStatus = document.getElementById('ws-status');
    const wsConnecting = document.getElementById('ws-connecting');
    const wsConnected = document.getElementById('ws-connected');
    const wsError = document.getElementById('ws-error');
    
    // Show WebSocket status
    function updateWebSocketStatus(status) {
        if (!wsStatus) return;
        
        wsStatus.classList.remove('d-none');
        
        if (status === 'connecting') {
            wsConnecting.classList.remove('d-none');
            wsConnected.classList.add('d-none');
            wsError.classList.add('d-none');
        } else if (status === 'connected') {
            wsConnecting.classList.add('d-none');
            wsConnected.classList.remove('d-none');
            wsError.classList.add('d-none');
            
            // Hide status after 3 seconds
            setTimeout(() => {
                wsStatus.classList.add('d-none');
            }, 3000);
        } else if (status === 'error') {
            wsConnecting.classList.add('d-none');
            wsConnected.classList.add('d-none');
            wsError.classList.remove('d-none');
        }
    }

    // Initialize websocket connection unless in dev mode
    if (!isDevMode) {
        setupWebSocket();
    } else {
        console.log('Dev mode: Using HTTP polling instead of WebSockets');
        // Start HTTP polling as fallback in dev mode
        startIncomingCallsCheck();
    }

    // Voice call button click handler
    voiceCallBtn.addEventListener('click', function() {
        console.log('Voice call button clicked');
        
        // Check if browser supports WebRTC
        if (!window.RTCPeerConnection) {
            alert('Your browser does not support WebRTC. Please use a modern browser like Chrome, Firefox, or Edge.');
            return;
        }
        
        // First check if there's an active call
        checkForActiveCall();
    });
    
    function setupWebSocket() {
        try {
            // Show connecting status
            updateWebSocketStatus('connecting');
            
            // For development, use relative URL to connect to WebSocket on same server
            // Instead of hardcoded domain
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${window.location.host}/ws/chat/${roomId}/`;
            
            console.log('Attempting WebSocket connection to:', wsUrl);
            
            ws = new WebSocket(wsUrl);
            
            ws.onopen = function() {
                console.log('WebSocket connection established for call notifications');
                wsReconnectAttempts = 0; // Reset reconnection attempts on successful connection
                
                // Update status indicator
                updateWebSocketStatus('connected');
                
                // Enable UI elements that depend on WebSocket
                if (voiceCallBtn) {
                    voiceCallBtn.disabled = false;
                    voiceCallBtn.classList.remove('disabled');
                }
                
                // Add a test message to verify the WebSocket is working
                try {
                    ws.send(JSON.stringify({
                        'type': 'test',
                        'message': 'WebSocket connection test',
                        'username': document.querySelector('meta[name="username"]')?.content || 'Unknown'
                    }));
                    console.log('Test message sent successfully');
                } catch (e) {
                    console.error('Error sending test message:', e);
                }
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
                    } else if (data.type === 'webrtc_signal') {
                        console.log('WebRTC signaling message received:', data);
                        if (data.call_id === currentCallId && data.signals && data.signals.length > 0) {
                            // Process each signaling message
                            data.signals.forEach(message => {
                                handleSignalingMessage(message);
                            });
                        }
                    } else if (data.type === 'test_response') {
                        console.log('WebSocket test response received:', data.message);
                        // Show a toast notification to indicate WebSocket is working
                        if (typeof showToast === 'function') {
                            showToast('WebSocket connection established successfully', 'success');
                        }
                    }
                } catch (e) {
                    console.error('Error processing WebSocket message:', e);
                }
            };
            
            ws.onclose = function(event) {
                console.log('WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
                
                // Update status indicator
                updateWebSocketStatus('error');
                
                // Disable UI elements that depend on WebSocket
                if (voiceCallBtn) {
                    voiceCallBtn.disabled = true;
                    voiceCallBtn.classList.add('disabled');
                    voiceCallBtn.setAttribute('title', 'Voice call unavailable - Connection error');
                }
                
                // Attempt to reconnect if not a normal closure and within max attempts
                if (event.code !== 1000 && event.code !== 1001 && wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    wsReconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000); // Exponential backoff
                    console.log(`Attempting to reconnect in ${delay/1000} seconds... (Attempt ${wsReconnectAttempts})`);
                    
                    setTimeout(() => {
                        if (ws.readyState === WebSocket.CLOSED) {
                            setupWebSocket();
                        }
                    }, delay);
                } else if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    console.error('Maximum WebSocket reconnection attempts reached');
                    console.log('Falling back to HTTP polling for call status');
                    
                    // Enable UI but with fallback message
                    if (voiceCallBtn) {
                        voiceCallBtn.disabled = false;
                        voiceCallBtn.classList.remove('disabled');
                        voiceCallBtn.setAttribute('title', 'Using HTTP fallback (slower)');
                    }
                    
                    // Start HTTP polling for incoming calls as fallback
                    if (!checkIncomingCallsInterval) {
                        startIncomingCallsCheck();
                    }
                }
            };
            
            ws.onerror = function(error) {
                console.error('WebSocket error:', error);
                // Update status indicator
                updateWebSocketStatus('error');
                
                // Log additional connection details for debugging
                console.log('WebSocket state:', ws.readyState);
                console.log('Connection URL:', wsUrl);
            };
        } catch (e) {
            console.error('Error setting up WebSocket:', e);
            
            // Enable UI with fallback message
            if (voiceCallBtn) {
                voiceCallBtn.disabled = false;
                voiceCallBtn.classList.remove('disabled');
                voiceCallBtn.setAttribute('title', 'Using HTTP fallback (slower)');
            }
            
            // Start HTTP polling as fallback
            if (!checkIncomingCallsInterval) {
                startIncomingCallsCheck();
            }
        }
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
        ],
        iceCandidatePoolSize: 10
    };
    
    // Request microphone permissions early (on page load)
    requestMicrophonePermission();
    
    function requestMicrophonePermission() {
        // Check if permission is already granted
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'microphone' })
                .then(permissionStatus => {
                    if (permissionStatus.state === 'granted') {
                        console.log('Microphone permission already granted');
                    } else {
                        // Request permission proactively
                        navigator.mediaDevices.getUserMedia({ audio: true })
                            .then(stream => {
                                console.log('Microphone permission granted');
                                // Stop all tracks in the temporary stream
                                stream.getTracks().forEach(track => track.stop());
                            })
                            .catch(error => {
                                console.error('Error requesting microphone permission:', error);
                            });
                    }
                })
                .catch(error => {
                    console.error('Error querying permissions:', error);
                });
        }
    }
    
    // Set up WebRTC connection
    async function setupWebRTC() {
        try {
            console.log('Setting up WebRTC connection');
            
            // Get user's audio stream
            callStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Got local audio stream');
            
            // Create new RTCPeerConnection
            peerConnection = new RTCPeerConnection(configuration);
            console.log('Created new peer connection');
            
            // Add local audio track to peer connection
            callStream.getTracks().forEach(track => {
                console.log('Adding local track to peer connection:', track.kind);
                peerConnection.addTrack(track, callStream);
            });
            
            // Set up audio recording and transmission
            const mediaRecorder = new MediaRecorder(callStream);
            const audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                    
                    // Convert audio data to base64 and send
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        // Check that peerConnection exists and is connected before sending
                        if (peerConnection && peerConnection.connectionState === 'connected' && !isMuted) {
                            const base64Audio = reader.result;
                            // Send audio data through data channel
                            if (dataChannel && dataChannel.readyState === 'open') {
                                dataChannel.send(base64Audio);
                            }
                        }
                    };
                    reader.readAsDataURL(event.data);
                }
            };
            
            // Start recording in chunks
            mediaRecorder.start(1000); // Capture in 1-second chunks
            
            // Set up data channel for audio transmission
            dataChannel = peerConnection.createDataChannel('audio');
            dataChannel.onopen = () => {
                console.log('Data channel opened');
            };
            dataChannel.onmessage = (event) => {
                // Play received audio
                const audio = new Audio(event.data);
                audio.play().catch(e => console.error('Error playing received audio:', e));
            };
            
            // Set up ICE candidate handling
            peerConnection.onicecandidate = handleICECandidate;
            
            // Handle ICE connection state changes
            peerConnection.oniceconnectionstatechange = function(event) {
                console.log('ICE connection state changed:', peerConnection.iceConnectionState);
                
                // Handle if ICE gathering fails or times out
                if (peerConnection.iceConnectionState === 'failed' || 
                    peerConnection.iceConnectionState === 'disconnected') {
                    console.warn('ICE connection failed or disconnected, attempting to restart ICE');
                    
                    // Try to restart ICE gathering
                    if (peerConnection.restartIce) {
                        peerConnection.restartIce();
                    }
                }
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
        } else {
            console.log('All ICE candidates have been generated');
        }
    }
    
    // Handle negotiation needed with stability check
    async function handleNegotiationNeeded() {
        // Check that the connection is in a stable state before renegotiating
        if (!peerConnection || peerConnection.signalingState !== 'stable') {
            console.log('Skipping negotiation: connection not in stable state');
            return;
        }
        try {
            console.log('Negotiation needed event fired');
            if (isCallInitiator) {
                await createOfferAndSendSignal();
            }
        } catch (error) {
            console.error('Error in negotiation:', error);
        }
    }
    
    // Create and send offer with stability check
    async function createOfferAndSendSignal() {
        // Ensure the connection exists and is stable before creating an offer
        if (!peerConnection || peerConnection.signalingState !== 'stable') {
            console.warn('Cannot create offer because connection is not stable');
            return;
        }
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
            if (error.name === 'InvalidStateError') {
                console.warn('Invalid state - the connection might be closing or already closed');
            } else if (error.message && error.message.includes('m-lines')) {
                console.warn('SDP format error - renegotiation error detected. Resetting connection.');
                if (peerConnection) {
                    peerConnection.close();
                    peerConnection = null;
                    setupWebRTC();
                }
            }
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
    
    // Send pending signaling messages to peer via HTTP API (WebSocket fallback)
    function sendPendingSignallingMessages() {
        if (signallingServerMessages.length > 0 && currentCallId) {
            console.log('Sending pending signaling messages:', signallingServerMessages);
            
            // Clone the messages array since we'll be emptying it
            const messagesToSend = [...signallingServerMessages];
            
            // Clear the pending messages
            signallingServerMessages = [];
            
            // First try to send via WebSocket if available
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log('Sending signaling messages via WebSocket');
                ws.send(JSON.stringify({
                    type: 'webrtc_signal',
                    call_id: currentCallId,
                    signals: messagesToSend
                }));
                return;
            }
            
            // Fallback to HTTP API
            console.log('WebSocket unavailable, sending via HTTP API');
            
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
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Signaling message sent successfully:', data);
                })
                .catch(error => {
                    console.error('Error sending signaling message:', error);
                    // Re-queue the message for retry
                    signallingServerMessages.push(message);
                    
                    // Try again later with exponential backoff
                    setTimeout(() => {
                        if (signallingServerMessages.length > 0) {
                            sendPendingSignallingMessages();
                        }
                    }, 2000); // 2-second delay before retry
                });
            });
        }
    }
    
    // Start a voice call
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', function() {
            console.log('Voice call button clicked');
            
            // First, ensure we have microphone permissions
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(tempStream => {
                    // Stop the temporary stream
                    tempStream.getTracks().forEach(track => track.stop());
                    
                    // Then check for active calls
                    checkForCallsAndInitiate();
                })
                .catch(error => {
                    console.error('Error accessing microphone:', error);
                    alert('This application needs microphone access to make calls. Please enable microphone access and try again.');
                });
        });
    }
    
    function checkForCallsAndInitiate() {
        // Check for active calls first
        fetch(`/chat/${roomId}/active-call/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    if (data.active_call) {
                        console.log('Active call found, joining:', data.active_call);
                        joinExistingCall(data.active_call);
                    } else {
                        console.log('No active call, initiating new call');
                        initiateCall();
                    }
                } else {
                    console.error('Error in active call check response:', data);
                    alert('Could not check for active calls. Please try again.');
                }
            })
            .catch(error => {
                console.error('Error checking for active calls:', error);
                alert('Could not check for active calls. Please try again.');
            });
    }
    
    // Initiate a new call
    function initiateCall() {
        console.log('Initiating new call');
        
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        if (!csrfToken) {
            console.error('CSRF token not found');
            alert('Could not initiate call: CSRF token missing.');
            return;
        }
        
        fetch(`/chat/${roomId}/voice-call/initiate/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
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
            } else {
                console.error('Error in call initiation response:', data);
                alert('Could not initiate call. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error initiating call:', error);
            alert('Could not initiate call. Please try again.');
        });
    }
    
    // Join an existing call
    function joinExistingCall(callInfo) {
        console.log('Joining existing call:', callInfo);
        
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        if (!csrfToken) {
            console.error('CSRF token not found');
            alert('Could not join call: CSRF token missing.');
            return;
        }
        
        // Stop the ringtone if it's playing
        if (window.activeRingtone) {
            window.activeRingtone.pause();
            window.activeRingtone = null;
        }
        
        fetch(`/voice-call/${callInfo.id}/join/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
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
                
                // Hide incoming call modal if it's showing
                if (incomingCallModal._isShown) {
                    incomingCallModal.hide();
                }
                
                // Show voice call modal
                voiceCallModal.show();
                
                // Initialize WebRTC connection
                setupWebRTC();
                
                // Start call timer & polling
                startCallTimer();
                startIncomingCallsCheck();
                pollCallStatus();
            } else {
                console.error('Error in call join response:', data);
                alert('Could not join call. Please try again.');
                currentCallId = null; // Reset the call ID since we couldn't join
            }
        })
        .catch(error => {
            console.error('Error joining call:', error);
            alert('Failed to join call. Please try again.');
            currentCallId = null; // Reset the call ID since we couldn't join
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
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
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
                } else {
                    console.error('Error in call status response:', data);
                    handleCallStatusError();
                }
            })
            .catch(error => {
                console.error('Error polling call status:', error);
                handleCallStatusError();
            });
    }
    
    function handleCallStatusError() {
        callStatusErrorCount++;
        
        // Use exponential backoff for errors (max 1 minute interval)
        const backoffDelay = Math.min(60000, 5000 * Math.pow(2, callStatusErrorCount));
        
        // If too many consecutive errors, end the call
        if (callStatusErrorCount > 5) {
            console.error('Too many call status errors, ending call');
            endCall();
            return;
        }
        
        pollCallStatusTimeout = setTimeout(pollCallStatus, backoffDelay);
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
                endCallOnServer(currentCallId)
                    .then(() => endCall())
                    .catch(error => {
                        console.error('Error ending call on server:', error);
                        // Force end call locally even if the server request failed
                        endCall();
                    });
            }
        });
    }
    
    function endCallOnServer(callId) {
        return new Promise((resolve, reject) => {
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            if (!csrfToken) {
                console.error('CSRF token not found');
                reject(new Error('CSRF token missing'));
                return;
            }
            
            fetch(`/voice-call/${callId}/end/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Call ended on server:', data);
                if (data.status === 'success') {
                    resolve();
                } else {
                    reject(new Error('Server returned error status'));
                }
            })
            .catch(error => {
                console.error('Error ending call on server:', error);
                reject(error);
            });
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
                
                // Hide incoming call modal
                incomingCallModal.hide();
                
                // Check if we have microphone permission before joining
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(tempStream => {
                        // Stop temporary stream
                        tempStream.getTracks().forEach(track => track.stop());
                        
                        // Now join the call
                        joinExistingCall({ id: currentCallId });
                    })
                    .catch(error => {
                        console.error('Microphone access denied:', error);
                        alert('You need to allow microphone access to join the call.');
                        currentCallId = null;
                    });
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
                
                declineCallOnServer(currentCallId)
                    .then(() => {
                        console.log('Call declined successfully');
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
    
    function declineCallOnServer(callId) {
        return new Promise((resolve, reject) => {
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            if (!csrfToken) {
                console.error('CSRF token not found');
                reject(new Error('CSRF token missing'));
                return;
            }
            
            fetch(`/voice-call/${callId}/decline/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Call declined response:', data);
                if (data.status === 'success') {
                    resolve(data);
                } else {
                    reject(new Error('Server returned error status'));
                }
            })
            .catch(error => {
                console.error('Error declining call:', error);
                reject(error);
            });
        });
    }

    // Check for incoming calls with error handling
    let incomingCallErrorCount = 0;
    function checkForIncomingCalls() {
        if (currentCallId) return; // Don't check if already in a call
        
        fetch(`/chat/${roomId}/active-call/`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
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
                        playRingtone();
                        
                        // Show browser notification
                        showCallNotification(callInfo.initiator);
                    }
                }
            })
            .catch(error => {
                console.error('Error checking for incoming calls:', error);
                incomingCallErrorCount++;
                
                // If too many consecutive errors, stop checking
                if (incomingCallErrorCount > 5) {
                    console.error('Too many incoming call check errors, stopping checks');
                    stopIncomingCallsCheck();
                }
            });
    }
    
    // Start checking for incoming calls
    function startIncomingCallsCheck() {
        // Use a 3-second interval for responsive notifications
        if (!checkIncomingCallsInterval) {
            incomingCallErrorCount = 0; // Reset error count
            checkIncomingCallsInterval = setInterval(checkForIncomingCalls, 3000);
            
            // Run an immediate check
            checkForIncomingCalls();
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
