import { Types } from "mongoose";
import User from "../models/User";
import { HttpError } from "../http/HttpError";
import { OnlineUserService } from "./OnlineUserService";
import { findOrCreateDirectChat } from "./ChatRoomService";

const PUBLIC_PROFILE_FIELDS = "username profilePictureUrl profession location skills lastConnected aboutMe age";
const SEARCH_RESULT_FIELDS = "username email profilePictureUrl profession location";
const MAX_SEARCH_RESULTS = 10;

const toObjectId = (id: unknown, what = "user"): Types.ObjectId => {
  if (typeof id !== "string" || !Types.ObjectId.isValid(id)) throw HttpError.badRequest(`Invalid ${what} id.`);
  return new Types.ObjectId(id);
};

/** Escapes regex characters so search input like "(" is matched literally. */
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Friend requests, friendships and user search. */
export class FriendshipService {
  /** Sends `fromId`'s friend request to `toId`. Sending twice, or to a friend, is a no-op. */
  async sendRequest(fromId: string, toId: unknown): Promise<void> {
    const from = toObjectId(fromId);
    const to = toObjectId(toId);
    if (from.equals(to)) throw HttpError.badRequest("You can't add yourself.");

    const target = await User.findById(to).select("friends");
    if (!target) throw HttpError.notFound("User not found.");
    if (target.friends.some((id) => id.equals(from))) return;

    await User.updateOne({ _id: to }, { $addToSet: { friendRequests: from } });
  }

  /** Accepts a pending request from `requesterId`: both become friends and get a private chat. */
  async acceptRequest(userId: string, requesterId: unknown): Promise<void> {
    const me = toObjectId(userId);
    const requester = toObjectId(requesterId);

    // Only accept requests that were actually sent.
    const pending = await User.exists({ _id: me, friendRequests: requester });
    if (!pending) throw HttpError.badRequest("There is no friend request from this user.");
    if (!(await User.exists({ _id: requester }))) throw HttpError.notFound("User not found.");

    await User.updateOne({ _id: me }, { $addToSet: { friends: requester }, $pull: { friendRequests: requester } });
    await User.updateOne({ _id: requester }, { $addToSet: { friends: me }, $pull: { friendRequests: me } });
    await findOrCreateDirectChat(me, requester);
  }

  async declineRequest(userId: string, requesterId: unknown): Promise<void> {
    await User.updateOne({ _id: toObjectId(userId) }, { $pull: { friendRequests: toObjectId(requesterId) } });
  }

  /** Ends a friendship on both sides. Existing chats between the two are kept. */
  async removeFriend(userId: string, friendId: unknown): Promise<void> {
    const me = toObjectId(userId);
    const friend = toObjectId(friendId);
    await User.updateOne({ _id: me }, { $pull: { friends: friend } });
    await User.updateOne({ _id: friend }, { $pull: { friends: me } });
  }

  /** The user's friends with their public profile and whether they are online now. */
  async listFriends(userId: string) {
    const user = await User.findById(toObjectId(userId)).populate({ path: "friends", select: PUBLIC_PROFILE_FIELDS });
    if (!user) throw HttpError.notFound("User not found.");
    const online = OnlineUserService.getOnlineUsers();
    return (user.friends as unknown as { _id: Types.ObjectId; toObject(): object }[]).map((friend) => ({
      ...friend.toObject(),
      isOnline: !!online[String(friend._id)],
    }));
  }

  async listRequests(userId: string) {
    const user = await User.findById(toObjectId(userId)).populate({
      path: "friendRequests",
      select: "username profilePictureUrl",
    });
    if (!user) throw HttpError.notFound("User not found.");
    return user.friendRequests;
  }

  /** Users whose name contains `term` (case-insensitive). Only public fields. */
  async searchUsers(term: unknown) {
    const query = typeof term === "string" ? term.trim() : "";
    if (!query) throw HttpError.badRequest("Search term is required.");
    return User.find({ username: new RegExp(escapeRegex(query), "i") })
      .select(SEARCH_RESULT_FIELDS)
      .limit(MAX_SEARCH_RESULTS);
  }
}

export const friendshipService = new FriendshipService();
