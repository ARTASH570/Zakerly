const url = "https://ulmfvpvqmccbdelnweqs.supabase.co/auth/v1/token?grant_type=password"
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbWZ2cHZxbWNjYmRlbG53ZXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODkwNTYsImV4cCI6MjEwMDU2NTA1Nn0.A8eHj9zmpjBlYdvOSLeEqD6SPxs4ZKnlogYnxDjB8LE"
fetch(url, {
  method: "POST",
  headers: {
    "apikey": anonKey,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: "omaressamouf@icloud.com",
    password: "Zxasqw12$"
  })
})
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => console.error("Error:", err))