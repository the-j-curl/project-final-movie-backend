import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import endpoints from "express-list-endpoints";
import { isEmail } from "validator/lib/isEmail";

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/movieDB";
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

const ERR_SERVICE_UNAVAILABLE = "Service unavailable";
const ERR_LOGIN_FAILED = "Username and/or password incorrect";
const ERR_LOGOUT_FAILED = "Could not log out";
const ERR_CREATE_USER_FAILED = "Could not create user";
const ERR_AUTHENTICATION = "Authentication error";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    minlength: [2, "Username is too short - min length 2 characters"],
    maxlength: [50, "Username is too long - max length 50 characters"],
    required: [true, "Username is required"],
    trim: true,
  },
  email: {
    // TO-DO - Add min and max length?
    type: String,
    required: [true, "Email address is required"],
    unique: [true, "Email address already exists in database"],
    // validator: [isEmail, "Not a valid email"], // TO-DO Tested and validator is working but error message is not working
    trim: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [5, "Password is too short - min length 5 character"],
    maxlength: [130, "Password is too long - max length 50 characters"], // TO-DO - Check if 50 is a good value, perhaps increase it.
    trim: true,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex"),
  },
});

const port = process.env.PORT || 8080;
const app = express();

// Middleware to hash password before new user is saved
userSchema.pre("save", async function (next) {
  // Executes a function pre save which allows the password to be validated before it is hashed
  const user = this;
  if (!user.isModified("password")) {
    return next();
  }
  const salt = bcrypt.genSaltSync();
  user.password = bcrypt.hashSync(user.password, salt);
  next();
});

// Middleware to authenticate user
const authenticateUser = async (req, res, next) => {
  const user = await User.findOne({ accessToken: req.header("Authorization") });
  if (user) {
    req.user = user;
    next();
  } else {
    res.status(401).json({ error: ERR_AUTHENTICATION });
  }
};

const User = mongoose.model("User", userSchema);

// Middlewares to enable cors and json body parsing
app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next();
  } else {
    res.status(503).json({ error: ERR_SERVICE_UNAVAILABLE });
  }
});

// GET - this will list of all endpoints
app.get("/", (req, res) => {
  res.send(endpoints(app));
});

// POST - signup creates a user
app.post("/users", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await new User({
      username,
      email,
      password,
    }).save();
    res.status(201).json({ userId: user._id, accessToken: user.accessToken });
  } catch (err) {
    res.status(400).json({
      message: ERR_CREATE_USER_FAILED,
      error: err,
    });
  }
});

app.post("/sessions", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && bcrypt.compareSync(password, user.password)) {
      user.accessToken = crypto.randomBytes(128).toString("hex");
      const updatedUser = await user.save();
      res.status(201).json({
        login: "success",
        userId: updatedUser._id,
        accessToken: updatedUser.accessToken,
      });
    } else {
      throw ERR_LOGIN_FAILED;
    }
  } catch (err) {
    res.status(404).json({ error: err }); // 404 - not found | 400 - bad request | 401 unauthorised
  }
});

// POST - logs user out and sets access token back to null
app.post("/sessions/logout", authenticateUser);
app.post("/sessions/logout", async (req, res) => {
  const accessToken = req.header("Authorization");

  console.log(`access token: ${accessToken}`); // TO-DO remove console log
  try {
    await User.updateOne({ accessToken: accessToken }, { accessToken: "0" });
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({
      message: ERR_LOGOUT_FAILED,
      error: err.errors,
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
