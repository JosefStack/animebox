import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import cookieParser from "cookie-parser";

const app = express();
const port = 3000;

const BASE_API = "https://api.jikan.moe/v4";

let sessions = {
    
};



const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "anibox",
    password: "postgres",
    port: 5432,
})

db.connect();



app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended:true}));    
app.use(cookieParser());
app.set("view engine", "ejs");

app.use(authMiddleware)

function authMiddleware (req, res, next) {
    const sessionId = req.cookies.session_id;

    if (sessionId && sessions[sessionId]) {
            res.locals.loggedIn = true;
            res.locals.user = sessions[sessionId].name;
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

    const topAnimeFiltered = topAnime.map(anime => ({
        id : anime.mal_id,
        images: anime.images.jpg.image_url,
        name: anime.title_english,
        episodes: anime.episodes,
        status: anime.status,
        rank: anime.rank,
        favourites: anime.favorites,
        people: anime.scored_by,
        rating: anime.score
    }))

    console.log(topAnimeFiltered);


    res.render("home.ejs", {
        topAnime1: topAnimeFiltered.slice(0, 3),
        topAnime2: topAnimeFiltered.slice(3, 6)
    });
})

app.get("/login", async(req, res) => {
    res.render("partials/login.ejs")
})

app.post("/login", async (req, res) => {

    try {
        const userName = req.body.userName;
        const password = req.body.userPassword;

        const result = await db.query("SELECT * FROM users WHERE user_name=$1", [userName]);

        if (result.rows.length ===   0 ) {
            console.log(`Invalid credentials!`)
            res.locals.message = "Invalid credentials!"
            res.redirect("/login");
        } else {
            
            const mailPass = result.rows[0].password;
            // console.log(result.rows);


            if (mailPass !== password) {
                console.log(`Invald credentials.`)
                res.locals.message = "Incorrect Password!"
                res.redirect("/login");
            }
            else {
                const session_id = Math.random();
    
                sessions[session_id] = {
                    name: userName,
                }
                

                res.cookie("session_id", session_id, {
                    httpOnly: true,
                    sameSite: "lax",
                    maxAge: 1000 * 60 * 60
                })

                console.log("Login successful")
                res.locals.message = "Login successful"
                res.redirect("/");


            }

            



        }


    }   
    catch (err) {
        console.log(`Login failed: ${err.stack}`);
        res.locals.message = "Something went wrong"
    }
    


})


app.get("/logout", async(req, res) => {
    const sessionId = req.cookies.session_id;
    delete sessions[sessionId];

    res.redirect("/");
})


app.get("/signup", async (req, res) => {
    res.render("partials/signup.ejs")
})

app.post("/signup", async (req, res) => {
    try {
        const username = req.body.newUserName
        const email = req.body.newUserMail;
        const password = req.body.newUserPassword;

        await db.query("INSERT INTO users (user_name, email, password) VALUES ($1, $2, $3)", [username, email, password]);
        
        // console.log(`New user registered: ${username}, ${email}, ${password}`)

        res.redirect("/");

    }
    catch (err) {
        console.log(`Singup failed: ${err.stack}`)
        res.locals.message = "Something went wrong."
        res.redirect("/signup");
    }


})

app.get("/anime", async (req, res) => {


    res.render("partials/anime.ejs")

})

app.get("/anime/:id", async (req, res) => {

})

app.get("/profile", async(req, res) => {
    res.send("profile");
})

app.get("/favourites", async (req, res) => {

})

app.get("/reviews", async (req, res) => {

})

app.get("/reviews/edit/:id", async (req, res) => {

})

app.get("/logout", async (req, res) => {

})




app.listen(port, ()=> {
    console.log(`Server is listening on port ${port}`);
})