import { signaling } from './signaling';
import { StorageService, Profile, Friend } from './storage';

export class DiscoveryService {
  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    // using unknown to bypass TypeScript strictness on CustomEvent casting, though it's bound properly
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
    
    // Initialize an empty thread locally if it doesn't exist
    const chats = StorageService.getChatHistory(targetId);
    if (chats.length === 0) {
      // By adding a "system" style message we can initialize the array, 
      // or just rely on the UI routing to create an empty array naturally.
    }

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
    console.log(`Chat initiated by ${peerDetails?.name}`);
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
    const friend: Friend = {
      id: peerId,
      name: peerDetails.name,
      avatar: peerDetails.avatar,
      country: peerDetails.country,
      addedAt: Date.now()
    };
    // Both users write each other's details directly into local storage
    StorageService.addFriend(peerId, friend);
  }
}

export const discovery = new DiscoveryService();
