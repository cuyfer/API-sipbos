import {Client, Storage} from 'node-appwrite'

const client = new Client()
  .setEndpoint("https://nyc.cloud.appwrite.io/v1") // endpoint default Appwrite Cloud
  .setProject(process.env.APPWRITE_PROJECT_ID) // Project ID dari dashboard Appwrite
  .setKey(process.env.APPWRITE_API_KEY); // API key dengan akses storage

export const storage = new Storage(client);