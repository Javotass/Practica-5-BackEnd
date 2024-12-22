import { Collection, ObjectId } from "mongodb";
import { UserModel, PostModel, CommentModel } from "./types.ts";

type context = {
  users: Collection<UserModel>;
  posts: Collection<PostModel>;
  comments: Collection<CommentModel>;
};

type CreateUserInput = {
  name: string;
  password: string;
  email: string;
};

type UpdateUserInput = {
  name?: string;
  password?: string;
  email?: string;
};

type CreatePostInput = {
  content: string;
  author: string;
};

type UpdatePostInput = {
  content?: string;
};

type CreateCommentInput = {
  text: string;
  author: string;
  post: string;
};
type UpdateCommentInput = {
  text?: string;
};
export const resolvers = {
  User: {
    id: (parent: UserModel): string => {
      return parent._id.toString();
    },

    password: (parent: UserModel): string => btoa(parent.password),

    posts: async (
      parent: UserModel,
      _: unknown,
      ctx: context
    ): Promise<PostModel[]> => {
      const posts = await ctx.posts
        .find({ _id: { $in: parent.posts } })
        .toArray();
      return posts;
    },
    comments: async (
      parent: UserModel,
      _: unknown,
      ctx: context
    ): Promise<CommentModel[]> => {
      const comments = await ctx.comments
        .find({ _id: { $in: parent.comments } })
        .toArray();
      return comments;
    },
    likedPosts: async (
      parent: UserModel,
      _: unknown,
      ctx: context
    ): Promise<PostModel[]> => {
      const likedPosts = await ctx.posts
        .find({ _id: { $in: parent.likedPosts } })
        .toArray();
      return likedPosts;
    },
  },
  Post: {
    id: (parent: PostModel): string => {
      return parent._id.toString();
    },

    author: async (
      parent: PostModel,
      _: unknown,
      ctx: context
    ): Promise<UserModel | null> => {
      return await ctx.users.findOne({ _id: parent.author });
    },
    comments: async (
      parent: PostModel,
      _: unknown,
      ctx: context
    ): Promise<CommentModel[]> => {
      const comments = await ctx.comments
        .find({ _id: { $in: parent.comments } })
        .toArray();
      return comments;
    },
    likes: async (
      parent: PostModel,
      _: unknown,
      ctx: context
    ): Promise<UserModel[]> => {
      return await ctx.users.find({ _id: { $in: parent.likes } }).toArray();
    },
  },

  Comment: {
    id: (parent: CommentModel): string => {
      return parent._id.toString();
    },

    author: async (
      parent: CommentModel,
      _: unknown,
      ctx: context
    ): Promise<UserModel | null> => {
      return await ctx.users.findOne({ _id: parent.author });
    },
    post: async (
      parent: CommentModel,
      _: unknown,
      ctx: context
    ): Promise<PostModel | null> => {
      return await ctx.posts.findOne({ _id: parent.post });
    },
  },
  Query: {
    users: async (
      _: unknown,
      __: unknown,
      ctx: context
    ): Promise<UserModel[]> => {
      return await ctx.users.find().toArray();
    },

    user: async (
      _: unknown,
      { id }: { id: string },
      ctx: context
    ): Promise<UserModel | null> => {
      return await ctx.users.findOne({ _id: new ObjectId(id) });
    },

    posts: async (
      _: unknown,
      __: unknown,
      ctx: context
    ): Promise<PostModel[]> => {
      return await ctx.posts.find().toArray();
    },

    post: async (
      _: unknown,
      { id }: { id: string },
      ctx: context
    ): Promise<PostModel | null> => {
      return await ctx.posts.findOne({ _id: new ObjectId(id) });
    },

    comments: async (
      _: unknown,
      __: unknown,
      ctx: context
    ): Promise<CommentModel[]> => {
      return await ctx.comments.find().toArray();
    },

    comment: async (
      _: unknown,
      { id }: { id: string },
      ctx: context
    ): Promise<CommentModel | null> => {
      return await ctx.comments.findOne({ _id: new ObjectId(id) });
    },
  },

  Mutation: {
    createUser: async (
      _: unknown,
      { input }: { input: CreateUserInput },
      ctx: context
    ): Promise<UserModel> => {
      const pass = atob(input.password + "");
      const user: UserModel = {
        _id: new ObjectId(),
        name: input.name,
        password: pass,
        email: input.email,
        posts: [],
        comments: [],
        likedPosts: [],
      };
      const { insertedId } = await ctx.users.insertOne(user);
      if (!insertedId) throw new Error("Could not create user");
      return user;
    },
    updateUser: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateUserInput },
      ctx: context
    ): Promise<UserModel> => {
      const usermodificado: Partial<UserModel> = {};
      if (input.name) usermodificado.name = input.name;
      if (input.password) usermodificado.password = input.password;
      if (input.email) usermodificado.email = input.email;
      const existeEmail = await ctx.users.findOne({ email: input.email });
      if (existeEmail) throw new Error("Email ya existe");
      const result = await ctx.users.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: usermodificado },
        { returnDocument: "after" }
      );
      if (!result) throw new Error("No se ha podido actualizar el usuario");
      return result;
    },
    deleteUser: async (
      _: unknown,
      { id }: { id: string },
      ctx: context
    ): Promise<boolean> => {
      const user = await ctx.users.findOne({ _id: new ObjectId(id) });

      const result = await ctx.users.deleteOne({ _id: new ObjectId(id) });
      if (!result) throw new Error("No se ha podido borrar el usuario");
      const posts = await ctx.posts
        .find({ author: new ObjectId(id) })
        .toArray();
      posts.forEach(async (post) => {
        await ctx.posts.deleteOne({ _id: post._id });
        post.comments.forEach(async (comment) => {
          await ctx.users.updateOne(
            { comments: new ObjectId(comment) },
            { $pull: { comments: new ObjectId(comment) } }
          );
        });
        post.likes.forEach(async (like) => {
          await ctx.users.updateOne(
            { likedPosts: new ObjectId(like) },
            { $pull: { likedPosts: new ObjectId(like) } }
          );
        });
      });

      await ctx.posts.updateMany(
        { _id: { $in: user?.likedPosts } },
        { $pull: { likes: new ObjectId(id) } }
      ); // he borrado el usuario de los likes de los posts
      await ctx.comments.deleteMany({ author: new ObjectId(id) }); // he borrado los comentarios del usuario
      user?.comments.forEach(async (comment) => {
        await ctx.posts.updateMany(
          { comments: new ObjectId(comment) },
          { $pull: { comments: new ObjectId(comment) } }
        );
      });

      return true;
    },

    createPost: async (
      _: unknown,
      { input }: { input: CreatePostInput },
      ctx: context
    ): Promise<PostModel> => {
      const post: PostModel = {
        _id: new ObjectId(),
        content: input.content,
        author: new ObjectId(input.author),
        comments: [],
        likes: [],
      };
      const { insertedId } = await ctx.posts.insertOne(post);
      if (!insertedId) throw new Error("No se ha podido crear el post");
      await ctx.users.updateOne(
        { _id: new ObjectId(input.author) },
        { $push: { posts: new ObjectId(insertedId) } }
      );
      return post;
    },
    updatePost: async (
      _: unknown,
      { id, input }: { id: string; input: UpdatePostInput },
      ctx: context
    ): Promise<PostModel> => {
      const postmodificado: Partial<PostModel> = {};
      if (input.content) postmodificado.content = input.content;
      const result = await ctx.posts.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: postmodificado },
        { returnDocument: "after" }
      );
      if (!result) throw new Error("No se ha podido actualizar el post");
      return result;
    },

    deletePost: async (
      _: unknown,
      { id }: { id: string },
      ctx: context
    ): Promise<boolean> => {
      const post = await ctx.posts.findOne({ _id: new ObjectId(id) });
      const result = await ctx.posts.deleteOne({ _id: new ObjectId(id) });
      if (!result) throw new Error("No se ha podido borrar el post");
      await ctx.users.updateOne(
        { posts: new ObjectId(id) },
        { $pull: { posts: new ObjectId(id) } }
      );
      await ctx.users.updateMany(
        { likedPosts: new ObjectId(id) },
        { $pull: { likedPosts: new ObjectId(id) } }
      );
      await ctx.comments.deleteMany({ post: new ObjectId(id) });
      post?.comments.forEach(async (comment) => {
        await ctx.users.updateMany(
          { comments: new ObjectId(comment) },
          { $pull: { comments: new ObjectId(comment) } }
        );
      });

      return true;
    },

    addLikeToPost: async (
      _: unknown,
      { postId, userId }: { postId: string; userId: string },
      ctx: context
    ): Promise<PostModel> => {
      const post = await ctx.posts.findOne({ _id: new ObjectId(postId) });
      if (!post) throw new Error("Post no encontrado");
      const user = await ctx.users.findOne({ _id: new ObjectId(userId) });
      if (!user) throw new Error("Usuario no encontrado");
      if (post.likes.includes(new ObjectId(userId)))
        throw new Error("Ya le ha dado like");
      const postActualizado = await ctx.posts.findOneAndUpdate(
        { _id: new ObjectId(postId) },
        { $push: { likes: new ObjectId(userId) } },
        { returnDocument: "after" }
      );
      if (!postActualizado) throw new Error("No se ha podido dar like");
      await ctx.users.updateOne(
        { _id: new ObjectId(userId) },
        { $push: { likedPosts: new ObjectId(postId) } }
      );
      return postActualizado;
    },
    removeLikeFromPost: async (
      _: unknown,
      { postId, userId }: { postId: string; userId: string },
      ctx: context
    ): Promise<PostModel> => {
      const post = await ctx.posts.findOne({ _id: new ObjectId(postId) });
      if (!post) throw new Error("Post no encontrado");
      const user = await ctx.users.findOne({ _id: new ObjectId(userId) });
      if (!user) throw new Error("Usuario no encontrado");

      const postActualizado = await ctx.posts.findOneAndUpdate(
        { _id: new ObjectId(postId) },
        { $pull: { likes: new ObjectId(userId) } },
        { returnDocument: "after" }
      );
      if (!postActualizado) throw new Error("No se ha podido quitar el like");
      await ctx.users.updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { likedPosts: new ObjectId(postId) } }
      );
      return postActualizado;
    },
    createComment: async (
      _: unknown,
      { input }: { input: CreateCommentInput },
      ctx: context
    ): Promise<CommentModel> => {
      const comment: CommentModel = {
        _id: new ObjectId(),
        text: input.text,
        author: new ObjectId(input.author),
        post: new ObjectId(input.post),
      };
      const { insertedId } = await ctx.comments.insertOne(comment);
      if (!insertedId) throw new Error("No se ha podido crear el comentario");
      await ctx.users.updateOne(
        { _id: new ObjectId(input.author) },
        { $push: { comments: new ObjectId(insertedId) } }
      );
      await ctx.posts.updateOne(
        { _id: new ObjectId(input.post) },
        { $push: { comments: new ObjectId(insertedId) } }
      );
      return comment;
    },
    updateComment: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateCommentInput },
      ctx: context
    ): Promise<CommentModel> => {
      const commentmodificado: Partial<CommentModel> = {};
      if (input.text) commentmodificado.text = input.text;
      const result = await ctx.comments.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: commentmodificado },
        { returnDocument: "after" }
      );
      if (!result) throw new Error("No se ha podido actualizar el comentario");
      return result;
    },
    deleteComment: async (
      _: unknown,
      { id }: { id: string },
      ctx: context
    ): Promise<boolean> => {
      const comment = await ctx.comments.findOne({ _id: new ObjectId(id) });
      const result = await ctx.comments.deleteOne({ _id: new ObjectId(id) });
      if (!result) throw new Error("No se ha podido borrar el comentario");
      await ctx.users.updateOne(
        { _id: new ObjectId(comment?.author) },
        { $pull: { comments: new ObjectId(id) } }
      );
      await ctx.posts.updateOne(
        { _id: new ObjectId(comment?.post) },
        { $pull: { comments: new ObjectId(id) } }
      );
      return true;
    },
  },
};
