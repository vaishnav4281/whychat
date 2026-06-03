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
    signaling.events.addEventListener('signal_relay', ((e: CustomEvent<{ peerId: string; signal: any }>) => {
      this.handleSignal(e.detail.signal);
    }) as EventListener);
  }

  public setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    window.dispatchEvent(new CustomEvent('whychat_local_stream', { detail: { stream } }));
  }

  public hasLocalStream(): boolean {
    return this.localStream !== null;
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
    this.incomingMedia = { chunks: [], mimeType: '', name: '', receiving: false };
    window.dispatchEvent(new Event('whychat_video_cleanup'));
  }

  /**
   * Establish a WebRTC data channel for chat.
   * @param peerId  The remote peer's ID
   * @param initiate  true = create & send offer; false = wait for incoming offer
   */
  public async establishDataConnection(peerId: string, initiate: boolean = true) {
    if (this.peerConnection) {
      this.closeConnections();
    }

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

    this.peerConnection.onconnectionstatechange = () => {
      if (
        this.peerConnection?.connectionState === 'disconnected' ||
        this.peerConnection?.connectionState === 'failed' ||
        this.peerConnection?.connectionState === 'closed'
      ) {
        window.dispatchEvent(new Event('whychat_partner_left'));
      }
    };

    if (initiate) {
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
