const express = require("express");
const app = express();
const admin = require("firebase-admin");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const port = process.env.PORT || 5000;
require("dotenv").config();
app.use(cors());
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ID);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
//user name : doctorPortalDB
//pass : kojRYMnU6LVqutAW
const uri = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@cluster0.0mdbb.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const idToken = req.headers.authorization.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.decodedUser = decodedToken.email;
      console.log(decodedToken);
    } catch {
      res.status(403).send("Invalid token");
    }
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("Doctors-portal");
    const appoinmentCollection = database.collection("appoinmentCollection");
    const usersCollection = database.collection("users");
    app.get("/appoinments", async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      });

      const query = { email: email, date: date };
      const cursor = appoinmentCollection.find(query);
      const appoinments = await cursor.toArray();
      res.json(appoinments);
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user.role === "admin") {
        isAdmin = true;
      }
      res.json({ isAdmin });
    });
    app.post("/appoinments", async (req, res) => {
      const appoinmentDetails = req.body;
      const result = await appoinmentCollection.insertOne(appoinmentDetails);
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const userDetails = req.body;
      const result = await usersCollection.insertOne(userDetails);
      res.send(result);
    });
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requiesterEmail = req.decodedUser;
      const filter = { email: user.email };
      // console.log(filter);
      if (requiesterEmail) {
        const requiester = await usersCollection.findOne({
          email: requiesterEmail,
        });
        console.log(requiester);
        if (requiester.role === "admin") {
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.send(result);
        }
      } else {
        res.status(403).send("You are not authorized to do this operation");
      }
    });
    console.log("Connected correctly to server");
  } catch (err) {
    console.log(err);
  } finally {
    // client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});
