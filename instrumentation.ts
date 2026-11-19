// Runs once per server process before it takes requests: connect to MySQL, create tables, load the store.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initDb } = await import("./lib/db");
  try {
    await initDb();
  } catch (e) {
    console.error("[db] startup failed — pages will show an error until the database is reachable and the server restarts:", e);
  }
}
