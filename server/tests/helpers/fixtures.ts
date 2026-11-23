import User from "../../src/models/User";
import ChatRoom from "../../src/models/chatrooms/ChatRoom";
import IUser from "../../src/types/IUser";
import IChatRoom from "../../src/types/chatrooms/IChatRoom";

let counter = 0;

export const makeUser = async (username: string): Promise<IUser> => {
  counter += 1;
  return User.create({
    username,
    email: `${username}-${counter}-${Date.now()}@test.local`,
    password: "x",
    age: 30,
    profession: "tester",
    location: "nowhere",
  });
};

export const makeChat = async (
  participants: IUser[],
  admins: IUser[] = []
): Promise<IChatRoom> => {
  return ChatRoom.create({
    participants: participants.map((p) => p._id),
    admins: admins.map((a) => a._id),
    name: "Test chat",
    isGroupChat: true,
  });
};
