import { signaling } from './signaling';

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private partnerId: string | null = null;

  private readonly CHUNK_SIZE = 16384;
  private incomingMedia: {
    chunks: Uint8Array[];
    mimeType: string;
    name: string;
    receiving: boolean;
  } = { chunks: [], mimeType: '', name: '', receiving: false };

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    signaling.events.addEventListener('match_found', ((e: CustomEvent<{ peerId: string; initiateCall: boolean }>) => {
      this.handleMatchFound(e.detail.peerId, e.detail.initiateCall);
    }) as EventListener);

    signaling.events.addEventListener('signal_relay', ((e: CustomEvent<{ peerId: string; signal: any }>) => {
      this.handleSignal(e.detail.signal);
    }) as EventListener);
  }

  /** Pre-set a local stream acquired via user gesture */
  public setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    window.dispatchEvent(new CustomEvent('whychat_local_stream', { detail: { stream } }));
  }

  public hasLocalStream(): boolean {
    return this.localStream !== null;
  }

  public joinVideoQueue() {
    signaling.send({ type: 'join_video_queue' });
  }

  public skipVideo() {
    this.closeConnections();
    signaling.send({ type: 'leave_video' });
    this.joinVideoQueue();
  }

  public closeConnections() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.partnerId = null;
    window.dispatchEvent(new Event('whychat_video_cleanup'));
  }

  public async establishDataConnection(peerId: string) {
    this.partnerId = peerId;

    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.peerConnection = new RTCPeerConnection(configuration);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.send({
          type: 'signal_relay',
          target: this.partnerId,
          data: { type: 'ice-candidate', candidate: event.candidate }
        });
      }
    };

    this.dataChannel = this.peerConnection.createDataChannel('whychat_data');
    this.setupDataChannel();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    signaling.send({
      type: 'signal_relay',
      target: this.partnerId,
      data: { type: 'offer', offer }
    });
  }

  private async handleMatchFound(peerId: string, initiateCall: boolean) {
    this.partnerId = peerId;

    // If no stream yet, try to acquire it now
    if (!this.localStream) {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("Camera access is not supported. Ensure you are on localhost or HTTPS.");
          return;
        }
        this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        window.dispatchEvent(new CustomEvent('whychat_local_stream', { detail: { stream: this.localStream } }));
      } catch (e: any) {
        console.error("Camera permission denied or failed", e);
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          alert("Camera permission was denied. Please allow camera access and try again.");
        } else if (e.name === 'NotFoundError') {
          alert("No camera or microphone found.");
        } else if (e.name === 'NotReadableError') {
          alert("Your camera is already in use by another application.");
        } else {
          alert("Failed to access camera: " + (e.message || e.toString()));
        }
        return;
      }
    }

    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.peerConnection = new RTCPeerConnection(configuration);

    this.localStream.getTracks().forEach(track => {
      if (this.localStream) this.peerConnection!.addTrack(track, this.localStream);
    });

    this.peerConnection.ontrack = (event) => {
      window.dispatchEvent(new CustomEvent('whychat_remote_stream', { detail: { stream: event.streams[0] } }));
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.send({
          type: 'signal_relay',
          target: this.partnerId,
          data: { type: 'ice-candidate', candidate: event.candidate }
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (
        this.peerConnection?.connectionState === 'disconnected' ||
        this.peerConnection?.connectionState === 'failed' ||
        this.peerConnection?.connectionState === 'closed'
      ) {
        window.dispatchEvent(new Event('whychat_partner_left'));
      }
    };

    if (initiateCall) {
      this.dataChannel = this.peerConnection.createDataChannel('whychat_data');
      this.setupDataChannel();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      signaling.send({
        type: 'signal_relay',
        target: this.partnerId,
        data: { type: 'offer', offer }
      });
    } else {
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
  }

  private async handleSignal(signal: any) {
    if (!this.peerConnection) return;

    try {
      if (signal.type === 'offer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        signaling.send({
          type: 'signal_relay',
          target: this.partnerId,
          data: { type: 'answer', answer }
        });
      } else if (signal.type === 'answer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
      } else if (signal.type === 'ice-candidate') {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (e) {
      console.error("WebRTC signal handling failed", e);
    }
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => console.log('Data channel opened');
    this.dataChannel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        this.handleTextMessage(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        this.handleBinaryMessage(event.data);
      }
    };
  }

  private handleTextMessage(dataString: string) {
    try {
      const msg = JSON.parse(dataString);
      if (msg.type === 'MEDIA_START') {
        this.incomingMedia = { chunks: [], mimeType: msg.mimeType, name: msg.name, receiving: true };
      } else if (msg.type === 'MEDIA_END') {
        this.finalizeIncomingMedia();
      } else if (msg.type === 'TEXT') {
        window.dispatchEvent(new CustomEvent('whychat_text_received', { detail: { text: msg.content, sender: this.partnerId } }));
      }
    } catch (e) {
      console.error("Failed to parse data channel message", e);
    }
  }

  private handleBinaryMessage(buffer: ArrayBuffer) {
    if (this.incomingMedia.receiving) {
      this.incomingMedia.chunks.push(new Uint8Array(buffer));
    }
  }

  private finalizeIncomingMedia() {
    const blob = new Blob(this.incomingMedia.chunks as BlobPart[], { type: this.incomingMedia.mimeType });
    const localUrl = URL.createObjectURL(blob);

    window.dispatchEvent(new CustomEvent('whychat_media_received', {
      detail: {
        url: localUrl,
        mimeType: this.incomingMedia.mimeType,
        name: this.incomingMedia.name,
        sender: this.partnerId
      }
    }));

    this.incomingMedia = { chunks: [], mimeType: '', name: '', receiving: false };
  }

  public async sendFile(file: File) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    this.dataChannel.send(JSON.stringify({ type: 'MEDIA_START', mimeType: file.type, name: file.name }));

    const arrayBuffer = await file.arrayBuffer();
    let offset = 0;

    while (offset < arrayBuffer.byteLength) {
      const slice = arrayBuffer.slice(offset, offset + this.CHUNK_SIZE);
      this.dataChannel.send(slice);
      offset += this.CHUNK_SIZE;
    }

    this.dataChannel.send(JSON.stringify({ type: 'MEDIA_END' }));
  }

  public sendText(text: string) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'TEXT', content: text }));
    }
  }
}

export const webrtc = new WebRTCService();
