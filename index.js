import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import cookieParser from "cookie-parser";

const app = express();
const port = 3000;

let sessions = {
    
};

console.log(sessions);  

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
            res.locals.user = sessions[sessionId].user
    } else {
        res.locals.loggedIn = false;
        res.locals.user = null;
    }


    next();
}


app.get("/", (req, res) => {
    res.render("home.ejs");
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
            res.redirect("/login");
        } else {
            
            const mailPass = result.rows[0].password;
            // console.log(result.rows);


            if (mailPass !== password) {
                console.log(`Invald credentials.`)
                res.redirect("/login");
            }
            else {
                const sessionId = Math.random();
    
                sessions[sessionId] = {
                    name: req.body.userName,
                }


                res.cookie("session_id", sessionId, {
                    httpOnly: true,
                    sameSite: "lax",
                    maxAge: 1000 * 60 * 60
                })

                console.log("Login successful")
                res.render("home.ejs");


            }

            



        }


    }   
    catch (err) {
        console.log(`Login failed: ${err.stack}`);
    }
    


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
        res.redirect("/signup");
    }


})

app.get("/anime", async (req, res) => {

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