# Spotify to Tidal

A web application to help you authenticate with both Spotify and Tidal, enabling playlist and collection management across both platforms.

## Features

- **OAuth2 Authentication** for both Spotify and Tidal
- Secure token handling with cookies
- PKCE (Proof Key for Code Exchange) support for Tidal
- Simple Express.js backend
- Static frontend for login

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (for running and development)
- [Node.js](https://nodejs.org/) (for type definitions and compatibility)
- [TypeScript](https://www.typescriptlang.org/)

### Installation

1. **Clone the repository:**

   ```sh
   git clone https://github.com/yourusername/spotify-to-tidal.git
   cd spotify-to-tidal
   ```

2. **Install dependencies:**

   ```sh
   bun install
   ```

3. **Configure environment variables:**

   Copy `.env.example`, rename it to `.env` and fill in your credentials

4. **Build the project:**

   ```sh
   bun run build
   ```

5. **Start the server:**

   ```sh
   bun run start
   ```

   The server will run on [http://localhost:8080](http://localhost:8080) by default.

### Development

For hot-reloading during development:

```sh
bun run dev
```

## Usage

- Visit [http://localhost:8080](http://localhost:8080)
- Click "Login with Spotify" or "Login with Tidal" to start the authentication flow.
- On successful login, tokens are stored securely in cookies.

## Project Structure

```
spotify-to-tidal/
├── src/
│   ├── server.ts        # Express server setup
│   ├── spotify.ts       # Spotify OAuth logic
│   ├── tidal.ts         # Tidal OAuth logic (with PKCE)
│   └── util.ts          # Utility functions (PKCE, random strings)
├── public/
│   └── index.html       # Frontend UI
├── .env                 # Environment variables
├── package.json
├── tsconfig.json
└── bun.lockb
```

## Scripts

- `bun run start` — Start the server
- `bun run build` — Compile TypeScript
- `bun run dev` — Start server with watch mode

## Notes

- **Security:** Tokens are stored in HTTP-only, secure cookies.
- **PKCE:** Tidal authentication uses PKCE for enhanced security.
- **Frontend:** Minimal static HTML for demonstration.

## License

MIT

---

**Contributions welcome!**
