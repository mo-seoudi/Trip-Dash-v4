// mongoDbProvider.js

import mongoose from "mongoose";

export async function connectMongo(uri) {
  if (!uri) throw new Error("MongoDB URI not provided");

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  return mongoose;
}
