import { ObjectId } from "mongodb";

export type UserModel = {
  _id: ObjectId;
  name: string;
  password: string;
  email: string;
  posts: ObjectId[];
  comments: ObjectId[];
  likedPosts: ObjectId[];
};

export type PostModel = {
  _id: ObjectId;
  content: string;
  author: ObjectId;
  comments: ObjectId[];
  likes: ObjectId[];
};

export type CommentModel = {
  _id: ObjectId;
  text: string;
  author: ObjectId;
  post: ObjectId;
};
