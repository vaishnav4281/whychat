import { signaling } from './signaling';
import { webrtc } from './webrtc';
import { StorageService, Profile } from './storage';

export class DiscoveryService {
  private _chatInitiatorFor: string | null = null;

  constructor() {
    this.setupListeners();
  }

  public get chatInitiatorFor(): string | null {
    return this._chatInitiatorFor;
  }

  public clearInitiator(): void {
    this._chatInitiatorFor = null;
  }

  private setupListeners() {
    signaling.events.addEventListener('CHAT_INIT', ((e: CustomEvent<{ peerId: string; peerDetails: any }>) => this.handleChatInit(e)) as EventListener);
    signaling.events.addEventListener('BOT_MSG', ((e: CustomEvent<{ from: string; text: string; ts: number }>) => {
      window.dispatchEvent(new CustomEvent('whychat_text_received', {
        detail: { text: e.detail.text, sender: e.detail.from }
      }));
    }) as EventListener);

  }

  public fetchExplore(filters: { gender?: string; country?: string; language?: string }) {
    signaling.send({
      type: 'fetch_explore',
      data: filters
    });
  }

  public initiateChat(targetId: string, targetDetails: Profile) {
    const localProfile = StorageService.getProfile();
    this._chatInitiatorFor = targetId;

    signaling.send({
      type: 'CHAT_INIT',
      target: targetId,
      data: {
        peerId: localProfile?.id,
        peerDetails: localProfile
      }
    });

    StorageService.saveChatPlaceholder(
      targetId,
      targetDetails?.name || targetDetails?.nickname || 'Stranger',
      localProfile?.id
    );

    window.dispatchEvent(
      new CustomEvent('whychat_route_chat', {
        detail: { peerId: targetId, peerDetails: targetDetails },
      }),
    );
  }

  public sendFriendRequest(targetId: string) {
    const localProfile = StorageService.getProfile();
    signaling.send({
      type: 'FRIEND_REQ',
      target: targetId,
      data: {
        id: localProfile?.id,
        name: localProfile?.name,
        avatar: localProfile?.avatar,
        country: localProfile?.country
      }
    });
  }

  private handleChatInit(e: CustomEvent<{ peerId: string; peerDetails: any }>) {
    const { peerId, peerDetails } = e.detail;
    const myProfile = StorageService.getProfile();

    if (this._chatInitiatorFor === peerId && myProfile) {
      if (myProfile.id < peerId) {
        this._chatInitiatorFor = peerId;
      } else {
        this._chatInitiatorFor = null;
      }
    } else {
      this._chatInitiatorFor = null;
      if (!peerDetails?.isBot) {
        webrtc.establishDataConnection(peerId, false);
        const chats = StorageService.getChats();
        if (!chats[peerId]) {
          StorageService.saveChatPlaceholder(peerId, peerDetails?.name || peerDetails?.nickname || 'Stranger', peerId);
        }
      }
    }
  }
}

export const discovery = new DiscoveryService();
