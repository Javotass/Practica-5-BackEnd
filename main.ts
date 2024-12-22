import { ApolloServer } from "@apollo/server";
import { schema } from "./schema.ts";
import { MongoClient } from "mongodb";
import { UserModel, PostModel, CommentModel } from "./types.ts";
import { startStandaloneServer } from "@apollo/server/standalone";
import { resolvers } from "./resolvers.ts";

const MONGO_URL = Deno.env.get("MONGO_URL");

const mongoClient = new MongoClient(MONGO_URL!);
await mongoClient.connect();

console.info("Connected to MongoDB");

const mongoDB = mongoClient.db("practica5turnoB");
const users = mongoDB.collection<UserModel>("Users");
const posts = mongoDB.collection<PostModel>("Posts");
const comments = mongoDB.collection<CommentModel>("Comments");

const server = new ApolloServer({
  typeDefs: schema,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  context: async () => ({ users, posts, comments }),
  listen: { port: 8000 },
});

console.info(`Server ready at url: ${url}`);
