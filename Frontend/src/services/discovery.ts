import { signaling } from './signaling';
import { StorageService, Profile, Friend } from './storage';

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
    signaling.events.addEventListener('FRIEND_REQ', ((e: CustomEvent<{ id: string; name: string, avatar: string, country: string }>) => this.handleFriendReq(e)) as EventListener);
    signaling.events.addEventListener('FRIEND_ACCEPT', ((e: CustomEvent<{ id: string; name: string, avatar: string, country: string }>) => this.handleFriendAccept(e)) as EventListener);
    signaling.events.addEventListener('BOT_MSG', ((e: CustomEvent<{ from: string; text: string; ts: number }>) => {
      window.dispatchEvent(new CustomEvent('whychat_text_received', {
        detail: { text: e.detail.text, sender: e.detail.from }
      }));
    }) as EventListener);
    signaling.events.addEventListener('global_metrics', ((e: CustomEvent<{ online: number; totalVisits?: number }>) => {
      if (e.detail.totalVisits !== undefined) {
        console.log(`[WhyChat] Total accounts created: ${e.detail.totalVisits}`);
      }
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

    StorageService.addOutgoingRequest(targetId);
  }

  public acceptFriendRequest(peerId: string, friend: { id: string; name: string; avatar: string; country: string }) {
    const localProfile = StorageService.getProfile();

    signaling.send({
      type: 'FRIEND_ACCEPT',
      target: peerId,
      data: {
        id: localProfile?.id,
        name: localProfile?.name,
        avatar: localProfile?.avatar,
        country: localProfile?.country
      }
    });

    StorageService.addFriend(peerId, {
      id: peerId,
      name: friend.name || 'Unknown',
      avatar: friend.avatar || '',
      country: friend.country || 'Unknown',
      addedAt: Date.now()
    });

    StorageService.removeRequest(peerId);
  }

  public declineFriendRequest(peerId: string) {
    StorageService.removeRequest(peerId);
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
    }

    window.dispatchEvent(
      new CustomEvent('whychat_route_chat', {
        detail: { peerId, peerDetails },
      }),
    );
  }

  private handleFriendReq(e: CustomEvent<{ id: string; name: string, avatar: string, country: string }>) {
    const { id, name, avatar, country } = e.detail;
    StorageService.addIncomingRequest({ id, name: name || 'Unknown', avatar: avatar || '', country: country || 'Unknown' });
  }

  private handleFriendAccept(e: CustomEvent<{ id: string; name: string, avatar: string, country: string }>) {
    const { id, name, avatar, country } = e.detail;
    StorageService.addFriend(id, {
      id,
      name: name || 'Unknown',
      avatar: avatar || '',
      country: country || 'Unknown',
      addedAt: Date.now()
    });
    StorageService.removeRequest(id);
  }
}

export const discovery = new DiscoveryService();
