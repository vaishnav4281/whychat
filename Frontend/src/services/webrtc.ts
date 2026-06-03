import { signaling } from './signaling';
import { StorageService } from './storage';

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private partnerId: string | null = null;
  private expectedPeerId: string | null = null;
  private messageQueue: string[] = [];

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

  public get dcReady(): boolean {
    return this.dataChannel?.readyState === 'open';
  }

  private setupListeners() {
    signaling.events.addEventListener('signal_relay', ((e: CustomEvent<{ peerId: string; signal: any }>) => {
      this.handleSignal(e.detail.signal, e.detail.peerId);
    }) as EventListener);

    signaling.events.addEventListener('connected', () => {
      if (this.expectedPeerId && (!this.dataChannel || this.dataChannel.readyState !== 'open')) {
        this.establishDataConnection(this.expectedPeerId, false);
      }
    });
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
    this.expectedPeerId = null;
    this.messageQueue = [];
    this.incomingMedia = { chunks: [], mimeType: '', name: '', receiving: false };
    window.dispatchEvent(new Event('whychat_video_cleanup'));
  }

  public async establishDataConnection(peerId: string, initiate: boolean = true) {
    if (this.partnerId === peerId && this.dataChannel?.readyState === 'open') return;

    this.expectedPeerId = peerId;

    if (this.peerConnection && this.partnerId !== peerId) {
      this.closeConnections();
    }

    if (!this.peerConnection) {
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
    }

    if (initiate && (!this.dataChannel || this.dataChannel.readyState !== 'open')) {
      this.dataChannel = this.peerConnection.createDataChannel('whychat_data');
      this.setupDataChannel();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      signaling.send({
        type: 'signal_relay',
        target: this.partnerId,
        data: { type: 'offer', offer }
      });
    } else if (!initiate && !this.dataChannel) {
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };
    }
  }

  private async handleSignal(signal: any, fromPeerId?: string) {
    if (!this.peerConnection) return;

    try {
      if (signal.type === 'offer') {
        if (this.peerConnection.localDescription?.type === 'offer' && fromPeerId) {
          const myProfile = StorageService.getProfile();
          if (myProfile && myProfile.id < fromPeerId) {
            return;
          }
          await this.peerConnection.setLocalDescription({ type: 'rollback' });
        }
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        signaling.send({
          type: 'signal_relay',
          target: this.partnerId,
          data: { type: 'answer', answer }
        });
      } else if (signal.type === 'answer') {
        if (this.peerConnection.signalingState === 'stable') return;
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
      } else if (signal.type === 'ice-candidate') {
        if (signal.candidate) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    } catch (e) {
      console.error("WebRTC signal handling failed", e);
    }
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.binaryType = 'arraybuffer';

    this.dataChannel.onopen = () => {
      while (this.messageQueue.length) {
        const msg = this.messageQueue.shift()!;
        this.dataChannel!.send(msg);
      }
      window.dispatchEvent(new CustomEvent('whychat_dc_status', { detail: { status: 'open', peerId: this.partnerId } }));
    };

    this.dataChannel.onclose = () => {
      window.dispatchEvent(new CustomEvent('whychat_dc_status', { detail: { status: 'closed', peerId: this.partnerId } }));
      if (this.expectedPeerId) {
        setTimeout(() => this.establishDataConnection(this.expectedPeerId!, false), 1000);
      }
    };

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
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('Data channel not open, file not sent');
      return;
    }

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

  public sendText(text: string): boolean {
    const payload = JSON.stringify({ type: 'TEXT', content: text });
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(payload);
      return true;
    }
    this.messageQueue.push(payload);
    return false;
  }
}

export const webrtc = new WebRTCService();
