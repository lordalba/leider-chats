import User from "../../src/models/User";
import ChatRoom from "../../src/models/chatrooms/ChatRoom";
import IUser from "../../src/types/IUser";
import IChatRoom from "../../src/types/chatrooms/IChatRoom";

export async function makeUser(username: string): Promise<IUser> {
  return User.create({
    username,
    email: `${username}@example.com`,
    password: "password123",
    age: 30,
    profession: "tester",
    location: "nowhere",
  });
}

export async function makeChat(
  participants: IUser[],
  admins: IUser[] = []
): Promise<IChatRoom> {
  return ChatRoom.create({
    name: "Test chat",
    isGroupChat: true,
    participants: participants.map((u) => u._id),
    admins: admins.map((u) => u._id),
  });
}
