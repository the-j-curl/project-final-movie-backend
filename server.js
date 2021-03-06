import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcrypt";
import endpoints from "express-list-endpoints";
import { isEmail } from "validator/lib/isEmail";

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/jymovieDB";
mongoose.connect(mongoUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
});
mongoose.Promise = Promise;

const ERR_SERVICE_UNAVAILABLE = "Service unavailable";
const ERR_LOGIN_FAILED = "Username and/or password incorrect";
const ERR_CREATE_USER_FAILED = "Could not create user";
const ERR_AUTHENTICATION = "Authentication error";
const ERR_UNABLE_TO_SAVE_ITEM = "Could not save/update item";
const ERR_NO_DATA_FOUND = "No data found";
const ERR_ITEM_ALREADY_EXISTS = "Item already exits";
const ERR_INVALID_REQUEST = "Invalid request";
const ERR_UNABLE_TO_DELETE_ITEM = " Could not delete item";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    required: [true, "Username is required"],
    minlength: [2, "Username is too short - min length 2 characters"],
    maxlength: [50, "Username is too long - max length 50 characters"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email address is required"],
    minlength: [5, "Email is too short - min length 5 characters"],
    maxlength: [100, "Email is too long - max length 100 characters"],
    validator: [isEmail, "Not a valid email"],
    trim: true,
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    minlength: [6, "Password is too short - min length 6 character"],
    maxlength: [60, "Password is too long - max length 60 characters"],
    trim: true,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex"),
  },
});

const watchMovieSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  movieId: {
    type: Number,
  },
  watchlist: {
    type: Boolean,
    default: false,
  },
});

const ratingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  movieId: {
    type: Number,
  },
  rating: {
    type: Number,
    default: 0,
  },
  comments: [
    {
      comment: String,
      username: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
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
const WatchMovie = mongoose.model("WatchMovie", watchMovieSchema);
const Rating = mongoose.model("Rating", ratingSchema);

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
    res.status(201).json({
      userId: user._id,
      accessToken: user.accessToken,
      username: user.username,
    });
  } catch (err) {
    res.status(400).json({
      message: ERR_CREATE_USER_FAILED,
      error: err,
    });
  }
});

// POST - user login via accessToken
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
        username: updatedUser.username,
      });
    } else {
      throw ERR_LOGIN_FAILED;
    }
  } catch (err) {
    res.status(404).json({ error: err }); // 404 - not found | 400 - bad request | 401 unauthorised
  }
});

// PUT - checks if movie is in the watchlist and if not movie will be added to the watchlist.
// If movie is in the database it will be updated (boolean value)
app.put("/users/:userId/watchlist", authenticateUser);
app.put("/users/:userId/watchlist", async (req, res) => {
  const { userId } = req.params;
  const { movieId, watchlist } = req.body;
  try {
    const watchlistExist = await WatchMovie.findOne({
      userId: userId,
      movieId: movieId,
    });
    if (!watchlistExist) {
      try {
        const movie = await new WatchMovie({
          userId,
          movieId,
          watchlist,
        }).save();
        res.status(201).json({
          success: true,
          movie,
        });
      } catch (err) {
        res.status(400).json({
          message: ERR_UNABLE_TO_SAVE_ITEM,
          error: err,
        });
      }
    } else if (watchlistExist) {
      try {
        const updated = await WatchMovie.findOneAndUpdate(
          { userId: userId, movieId: movieId },
          req.body,
          { new: true }
        );
        res.status(201).json({
          success: true,
          updated,
        });
      } catch (err) {
        res.status(400).json({ message: ERR_UNABLE_TO_SAVE_ITEM, error: err });
      }
    } else {
      res.status(400).json({ message: ERR_ITEM_ALREADY_EXISTS });
    }
  } catch (err) {
    res.status(400).json({
      message: ERR_INVALID_REQUEST,
      error: err,
    });
  }
});

// GET - returns movies with a watchlist: true value
app.get("/users/:userId/watchlist", authenticateUser);
app.get("/users/:userId/watchlist", async (req, res) => {
  const { userId } = req.params;
  try {
    const userWatchlist = await WatchMovie.find({
      userId: userId,
      watchlist: true,
    });
    res.status(200).json({ userWatchlist });
  } catch (err) {
    res.status(404).json({ message: ERR_NO_DATA_FOUND, error: err });
  }
});

// POST - add comment to a specific movie
app.post("/comments/:movieId", authenticateUser);
app.post("/comments/:movieId", async (req, res) => {
  const { movieId } = req.params;
  const { userId, comment, username } = req.body;
  try {
    const ratingExist = await Rating.findOne({
      userId: userId,
      movieId: movieId,
    });

    if (!ratingExist) {
      await new Rating({
        userId,
        movieId,
      }).save();
    }

    const updated = await Rating.findOneAndUpdate(
      { userId: userId, movieId: movieId },
      { $push: { comments: { comment, username } } },
      { new: true }
    );
    res.status(201).json({
      success: true,
      updated,
    });
  } catch (err) {
    res.status(400).json({
      message: ERR_INVALID_REQUEST,
      error: err,
    });
  }
});

// GET - This endpoint returns comments for a specific movie
app.get("/comments/:movieId", async (req, res) => {
  const { movieId } = req.params;
  try {
    const movieReviews = await Rating.find({
      movieId: movieId,
    });

    let comments = [];
    movieReviews.map(commentedMovie => comments.push(commentedMovie.comments));

    let allComments = [].concat.apply([], comments);

    const sortedComments = allComments.sort(
      (a, b) => b.createdAt - a.createdAt
    );

    res.status(200).json({ sortedComments });
  } catch (err) {
    res.status(404).json({ message: ERR_NO_DATA_FOUND, error: err });
  }
});

// DELETE - This endpoint delete one specific comment
app.delete("/comments/:movieId/", authenticateUser);
app.delete("/comments/:movieId", async (req, res) => {
  const { movieId } = req.params;
  const { userId, _id } = req.body;
  try {
    const deleteComment = await Rating.updateOne(
      {
        userId: userId,
        movieId: movieId,
      },
      { $pull: { comments: { _id } } }
    );
    if (deleteComment) {
      res.status(200).json({ success: true, message: deleteComment });
    } else {
      res
        .status(404)
        .json({ success: false, message: ERR_UNABLE_TO_DELETE_ITEM });
    }
  } catch (err) {
    res.status(400).json({ message: ERR_INVALID_REQUEST, error: err });
  }
});
// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
