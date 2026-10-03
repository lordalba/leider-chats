import { Response } from "express";
import User from "../models/User";
import IUser from "../types/IUser";
import { MyUserRequest } from "../types/express";
import path from "path";
import fs from "fs";

export const fetchUserDetails = async (
    req: MyUserRequest,
    res: Response
  ): Promise<Response> => {
    try {
      const user = await User.findById(req.userId).populate("friends");
  
      return res.status(200).json(user);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Server error." });
    }
  };

export const updateProfile = async (
  req: MyUserRequest,
  res: Response
): Promise<Response> => {
  const { username, aboutMe, skills } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    let profilePictureUrl = handleFileSaving(req, user, "/uploads/profilePictures");

    // Update the user data
    await User.findByIdAndUpdate(
      req.userId,
      {
        username,
        aboutMe,
        skills: JSON.parse(skills),
        profilePictureUrl,
      },
      { new: true }
    );

    return res.status(200).json({ message: "Profile updated successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

const handleFileSaving = (req: MyUserRequest, user: IUser, destinationPath: string) => {
  let profilePictureUrl = user.profilePictureUrl;
  if (req.file) {
    const fileExtension = path.extname(req.file.originalname);
    const newFileName = `${req.userId}${fileExtension}`;
    const uploadPath = path.join(__dirname, `../..${destinationPath}`, newFileName);

    // Rename and move the uploaded file
    fs.rename(req.file.path, uploadPath, (err) => {
      if (err) throw err;
    });

    profilePictureUrl = `${process.env.SERVER_BASE_URL}${process.env.PORT}${destinationPath}/${newFileName}`;
  }
  return profilePictureUrl;
};