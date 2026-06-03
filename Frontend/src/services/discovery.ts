import { signaling } from './signaling';
import { StorageService, Profile, Friend } from './storage';

export class DiscoveryService {
  private _chatInitiatorFor: string | null = null;

  constructor() {
    this.setupListeners();
  }

  /** Returns the peer ID for which we initiated a chat, or null. */
  public get chatInitiatorFor(): string | null {
    return this._chatInitiatorFor;
  }

  /** Clears the stored initiator flag. */
  public clearInitiator(): void {
    this._chatInitiatorFor = null;
  }

  private setupListeners() {
    signaling.events.addEventListener('CHAT_INIT', ((e: CustomEvent<{ peerId: string; peerDetails: any }>) => this.handleChatInit(e)) as EventListener);
    signaling.events.addEventListener('FRIEND_REQ', ((e: CustomEvent<{ id: string; name: string, avatar: string, country: string }>) => this.handleFriendReq(e)) as EventListener);
    signaling.events.addEventListener('FRIEND_ACCEPT', ((e: CustomEvent<{ peerId: string; peerDetails: any }>) => this.handleFriendAccept(e)) as EventListener);
  }

  // --- Actions ---

  public fetchExplore(filters: { gender?: string; country?: string; language?: string }) {
    signaling.send({
      type: 'fetch_explore',
      data: filters
    });
  }

  public initiateChat(targetId: string, targetDetails: Profile) {
    const localProfile = StorageService.getProfile();

    // Mark ourselves as the chat initiator
    this._chatInitiatorFor = targetId;

    signaling.send({
      type: 'CHAT_INIT',
      target: targetId,
      data: {
        peerId: localProfile?.id,
        peerDetails: localProfile
      }
    });

    // Fire routing event locally
    window.dispatchEvent(
      new CustomEvent('whychat_route_chat', {
        detail: { peerId: targetId, peerDetails: targetDetails },
      }),
    );
  }

  public sendFriendRequest(targetId: string) {
    const localProfile = StorageService.getProfile();
    StorageService.addOutgoingRequest(targetId);

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

  public acceptFriendRequest(targetId: string, targetDetails: Partial<Profile>) {
    const localProfile = StorageService.getProfile();
    StorageService.removeRequest(targetId);

    const friend: Friend = {
      id: targetId,
      name: targetDetails.name || 'Unknown',
      avatar: targetDetails.avatar || '0',
      country: targetDetails.country || 'Unknown',
      addedAt: Date.now()
    };
    StorageService.addFriend(targetId, friend);

    signaling.send({
      type: 'FRIEND_ACCEPT',
      target: targetId,
      data: {
        peerId: localProfile?.id,
        peerDetails: localProfile
      }
    });
  }

  // --- Handlers ---

  private handleChatInit(e: CustomEvent<{ peerId: string; peerDetails: any }>) {
    const { peerId, peerDetails } = e.detail;
    // We are the receiver, so initiatorFor is null
    this._chatInitiatorFor = null;
    window.dispatchEvent(
      new CustomEvent('whychat_route_chat', {
        detail: { peerId, peerDetails },
      }),
    );
  }

  private handleFriendReq(e: CustomEvent<{ id: string; name: string, avatar: string, country: string }>) {
    StorageService.addIncomingRequest(e.detail);
  }

  private handleFriendAccept(e: CustomEvent<{ peerId: string; peerDetails: any }>) {
    const { peerId, peerDetails } = e.detail;
    StorageService.removeRequest(peerId);
    const friend: Friend = {
      id: peerId,
      name: peerDetails.name,
      avatar: peerDetails.avatar,
      country: peerDetails.country,
      addedAt: Date.now()
    };
    StorageService.addFriend(peerId, friend);
  }
}

export const discovery = new DiscoveryService();
