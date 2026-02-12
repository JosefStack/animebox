import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

console.log("Attempting database connection to Supavisor (Port 6543)...");
// Force port 6543 for Supavisor
const dbUrl = process.env.DATABASE_URL.replace(":5432", ":6543");

console.log(`URL: ${dbUrl?.replace(/:[^:@]*@/, ":[HIDDEN]@")}`); // Hide password

const db = new pg.Client({
    connectionString: dbUrl,
    ssl: {
        rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 5000,
});

async function run() {
    try {
        await db.connect();
        console.log("✅ Connection Successful via IPv4 Pooler!");

        console.log("Querying current time...");
        const res = await db.query("SELECT NOW()");
        console.log("✅ Time from DB:", res.rows[0].now);

    } catch (err) {
        console.error("❌ ERROR:", err.message);
        if (err.code === "ENOTFOUND") {
            console.error("DNS Resolution Failed. This suggests the domain itself is unreachable/invalid.");
        }
    } finally {
        await db.end();
        console.log("Connection closed.");
    }
}

run();
