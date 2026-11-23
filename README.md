## Running locally

Requires **Node.js 22** (see `.nvmrc`). Node 25+ will not work: `jsonwebtoken`'s dependency
`buffer-equal-constant-time` crashes because Node removed `SlowBuffer`.

```sh
# 1. Server (http://localhost:3000). Reads server/.env (MONGO_URI, JWT_SECRET, PORT, ...)
cd server
npm install
npm run dev

# 2. Client (http://localhost:8080), in a second terminal
cd client
npm install
npm run serve
```

Open http://localhost:8080, log in, open a chat and click its header to open **Chat Details**.
Under **Workspaces**, click **New** to create one. Everyone in the chat can open it from there
or from the **Workspaces** page, and edit its task board, documents and whiteboards together.

Tests:

```sh
cd server && npx jest      # uses an in-memory MongoDB (or MONGO_TEST_URI if set)
cd client && npm test      # vitest
```

---

**Edit a file, create a new file, and clone from Bitbucket in under 2 minutes**

Yoav Is the king of the worldddd

---

## Backend Features and Improvements:

1. User Roles and Permissions

2. Role-based access control (RBAC) to manage different user roles (e.g., admin, regular user).
Profile Management

3. Create routes to allow users to update their profile information (username, email, password).
Password Reset Functionality

4. Implement a mechanism for users to reset their passwords using email tokens.
Email Verification

5. Add email verification after registration to ensure valid email addresses.
Logging and Monitoring

6. Implement logging using libraries like winston or morgan.
Set up error monitoring (e.g., Sentry) for tracking issues in production.
Security Improvements

7. Add rate limiting to prevent brute-force attacks.
Set up CORS for secure communication between frontend and backend.
Ensure HTTPS is enabled for encrypted communication.
Implement CSRF protection if you are using forms or sessions.
Validate and sanitize user inputs to prevent attacks like SQL injection and XSS.
Frontend Integration

8. Deploy the backend to cloud services like Heroku, AWS, or DigitalOcean.
Use MongoDB Atlas or similar cloud services for your MongoDB instance.
Manage environment variables securely using dotenv or another method.

---

## How to add a link to words:

[download and install first](https://www.sourcetreeapp.com/). If you prefer to clone from the command line, see [Clone a repository](https://confluence.atlassian.com/x/4whODQ).