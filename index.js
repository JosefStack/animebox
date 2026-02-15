import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import dotenv from "dotenv";
import generateName from "sillyname";

dotenv.config();

const app = express();
const port = 3000;
const saltRounds = 10;

const BASE_API = "https://api.jikan.moe/v4";

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect()
  .then(() => console.log("Connected to supabase db!"))
  .catch((err) => console.error("Database connection error:", err));

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.SESSION_SIGNATURE,
    resave: false,
    saveUninitialized: true,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use(authMiddleware);

function authMiddleware(req, res, next) {
  if (req.isAuthenticated()) {
    res.locals.loggedIn = true;
    res.locals.user = req.user.user_name;
  } else {
    res.locals.loggedIn = false;
    res.locals.user = null;
  }

  next();
}

app.get("/", async (req, res) => {
  const URL = BASE_API + "/top/anime";
  console.log(URL);

  const response = await axios.get(URL);
  const topAnime = response.data.data.slice(0, 6);
  // console.log(topAnime);

  const topAnimeFiltered = topAnime.map((anime) => ({
    id: anime.mal_id,
    images: anime.images.jpg.image_url,
    name: anime.title_english,
    episodes: anime.episodes,
    status: anime.status,
    rank: anime.rank,
    favourites: anime.favorites,
    people: anime.scored_by,
    rating: anime.score,
  }));

  // console.log(topAnimeFiltered);

  res.render("home.ejs", {
    topAnime1: topAnimeFiltered.slice(0, 3),
    topAnime2: topAnimeFiltered.slice(3, 6),
  });
});

app.get("/login", async (req, res) => {
  res.render("partials/login.ejs");
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/anime",
    failureRedirect: "/login",
  }),
);

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    } else {
      res.redirect("/");
    }
  });
});

app.get("/signup", async (req, res) => {
  res.render("partials/signup.ejs");
});

app.post("/signup", async (req, res) => {
  const username = req.body.newUserName;
  const email = req.body.newUserMail;
  const password = req.body.newUserPassword;
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    if (checkResult.rows.length > 0) {
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error(`Error hashing password: ${err}`);
        } else {
          const result = await db.query(
            "INSERT INTO users (user_name, email, password) VALUES ($1, $2, $3) RETURNING *",
            [username, email, hash],
          );
          const user = result.rows[0];
          console.log(result);
          req.login(user, (err) => {
            res.redirect("/anime");
          });
        }
      });
    }
  } catch (err) {
    console.log(`Error creating account: ${err}`);
  }
});

app.get("/anime", async (req, res) => {
  const response = await axios.get(BASE_API + "/top/anime");

  const topAnime = response.data.data;
  // console.log(topAnime);

  const topAnimeFiltered = topAnime.map((anime) => ({
    id: anime.mal_id,
    images: anime.images.jpg.image_url,
    name: anime.title_english,
    episodes: anime.episodes,
    status: anime.status,
    rank: anime.rank,
    favourites: anime.favorites,
    people: anime.scored_by,
    rating: anime.score,
  }));

  res.render("partials/anime.ejs", {
    anime: topAnimeFiltered,
  });
});

app.get("/anime/:id", async (req, res) => {
  const URL = BASE_API + `/anime/${req.params.id}/full`;
  console.log(URL);
  const response = await axios.get(BASE_API + `/anime/${req.params.id}/full`);

  // console.log(response.data.data.trailer)

  const trailerParts = response.data.data.trailer.embed_url
    .split("?")[0]
    .split("/");
  console.log(trailerParts);
  const trailerId = trailerParts[trailerParts.length - 1];

  // console.log(response);
  const filtered = {
    status: response.data.data.status,
    id: response.data.data.mal_id,
    name_english: response.data.data.title_english,
    name_jap: response.data.data.title,
    episodes: response.data.data.episodes,
    aired: response.data.data.aired.string,
    duration: response.data.data.duration,
    ageRating: response.data.data.rating,
    rating: response.data.data.score,
    rated_by: response.data.data.scored_by,
    rank: response.data.data.rank,
    favourites: response.data.data.favorites,
    synopsis: response.data.data.synopsis,
    background: response.data.data.background,
    genres: response.data.data.genres,
    relations: response.data.data.relations,
    image: response.data.data.images.jpg.image_url,
    studios: response.data.data.studios,
    producers: response.data.data.producers,
    trailer: response.data.data.trailer.embed_url,
    trailerId: trailerId,
  };

  let reviews = [];
  try {
    const result = await db.query("SELECT * FROM reviews WHERE anime_id=$1", [
      req.params.id,
    ]);
    reviews = result.rows;
  } catch (err) {
    console.log(`Failed to load reviews: ${err.stack}`);
  }

  // console.log(filtered);
  res.render("partials/animedesc.ejs", {
    info: filtered,
    reviews: reviews,
  });
});

app.get("/profile", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM favourites WHERE user_name=$1",
      [userId],
    );
    const animeId = result.rows;

    const favouriteIds = [];
    const favouriteData = [];

    result.rows.forEach((row) => {
      favouriteIds.push(row.anime_id);
    });

    for (const favourite of favouriteIds) {
      const URL = BASE_API + `/anime/${favourite}/full`;
      console.log(URL);
      const response = await axios.get(URL);

      favouriteData.push(response.data.data);
    }

    const filtered = favouriteData.map((favourite) => ({
      id: favourite.mal_id,
      // name_english: favourite.title_english,
      // name_jap: favourite.title,
      name: favourite.title_english,
      episodes: favourite.episodes,
      aired: favourite.aired.string,
      duration: favourite.duration,
      ageRating: favourite.rating,
      rating: favourite.score,
      // rated_by: favourite.scored_by,
      people: favourite.scored_by,
      rank: favourite.rank,
      favourites: favourite.favorites,
      synopsis: favourite.synopsis,
      background: favourite.background,
      genres: favourite.genres,
      relations: favourite.relations,
      images: favourite.images.jpg.image_url,
    }));

    // console.log(filtered);

    res.render("partials/profile.ejs", {
      favourites: filtered,
    });
  } catch (err) {
    console.log(`Failed to retrieve favourites: ${err.stack}`);
    res.render("partials/profile.ejs", {
      error: "Failed to retrieve favourites!",
    });
  }
});

app.get("/favourites", async (req, res) => {
  if (req.isAuthenticated()) {
    const userId = req.user.user_name;

    try {
      const result = await db.query(
        "SELECT * FROM favourites WHERE user_name=$1",
        [userId],
      );
      // const animeId = result.rows;

      const favouriteIds = [];
      const favouriteData = [];

      result.rows.forEach((row) => {
        favouriteIds.push(row.anime_id);
      });

      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      for (let i = 0; i < favouriteIds.length; i += 2) {
        const batch = favouriteIds.slice(i, i + 2);

        const responses = await Promise.all(
          batch.map((id) => axios.get(`${BASE_API}/anime/${id}/full`)),
        );

        responses.forEach((res) => {
          favouriteData.push(res.data.data);
        });

        await delay(1000);
      }

      const filtered = await favouriteData.map((favourite) => ({
        id: favourite.mal_id,
        // name_english: favourite.title_english,
        // name_jap: favourite.title,
        name: favourite.title_english,
        episodes: favourite.episodes,
        aired: favourite.aired.string,
        duration: favourite.duration,
        ageRating: favourite.rating,
        rating: favourite.score,
        // rated_by: favourite.scored_by,
        people: favourite.scored_by,
        rank: favourite.rank,
        favourites: favourite.favorites,
        synopsis: favourite.synopsis,
        background: favourite.background,
        genres: favourite.genres,
        relations: favourite.relations,
        images: favourite.images.jpg.image_url,
      }));

      // console.log(filtered);

      res.render("partials/favourites.ejs", {
        favourites: filtered,
      });
    } catch (err) {
      console.log(`Failed to retrieve favourites: ${err.stack}`);
      res.render("partials/favourites.ejs", {
        error: "Failed to retrieve favourites!",
      });
    }
  } else {
    res.redirect("/login")
  }
});

app.post("/new/favourite", async (req, res) => {
  try {
    await db.query(`INSERT INTO favourites VALUES ($1, $2)`, [
      req.body.userName,
      parseInt(req.body.animeId),
    ]);
    res.redirect(`/anime/${req.body.animeId}`);
  } catch (err) {
    console.log(`Failed to add favourite: ${err.stack}`);
    res.redirect(`/anime/${req.body.animeId}`);
  }
});

app.post("/delete/favourite", async (req, res) => {
  const userName = req.body.userId;
  const animeId = parseInt(req.body.animeId);

  // console.log(req.body);

  // console.log(userName, animeId);

  try {
    await db.query(
      "DELETE FROM favourites WHERE user_name=$1 AND anime_id=$2",
      [userName, animeId],
    );

    res.redirect("/favourites");
  } catch (err) {
    // console.log(`Failed to remove favourite: ${err.stack}`);
    console.log("err");
    res.redirect("/favourites");
  }
});

app.post("/new/review", async (req, res) => {
  const userId = req.body.userId;
  const animeId = parseInt(req.body.animeId);
  const review = req.body.review;

  try {
    await db.query("INSERT INTO reviews VALUES ($1, $2, $3)", [
      animeId,
      userId,
      review,
    ]);
    res.redirect(`/anime/${animeId}`);
  } catch (err) {
    console.log(`Failed to post review: ${err.stack}`);
    res.redirect(`/anime/${animeId}`);
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
);

app.get(
  "/auth/google/favourites",
  passport.authenticate("google", {
    successRedirect: "/favourites",
    failureRedirect: "/login",
  }),
);

app.get("/user/reviews", async (req, res) => {});

app.get("/reviews/edit/:id", async (req, res) => {});

passport.use(
  "local",
  new Strategy(
    {
      usernameField: "userName",
      passwordField: "userPassword",
    },
    async function verify(userName, userPassword, cb) {
      try {
        const result = await db.query(
          "SELECT * FROM users WHERE user_name=$1",
          [userName],
        );
        // console.log(result.rows);
        if (result.rows.length > 0) {
          const user = result.rows[0];
          const storedHashedPassword = user.password;
          bcrypt.compare(userPassword, storedHashedPassword, (err, valid) => {
            if (err) {
              console.log(`Error comparing passwordd: ${err}`);
              return cb(err);
            } else {
              if (valid) {
                return cb(null, user);
              } else {
                return cb(null, false);
              }
            }
          });
        } else {
          return cb(null, false, "User not found");
        }
      } catch (err) {
        console.log(`Error: ${err}`);
      }
    },
  ),
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.NODE_ENV === "production"
          ? "https://anibox.onrender.com/auth/google/favourites"
          : "http://localhost:3000/auth/google/favourites",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email=$1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (user_name, email, password) VALUES ($1, $2, $3) RETURNING *",
            [generateName(), profile.email, "google"],
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(null, false, "signup failed");
      }
    },
  ),
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
