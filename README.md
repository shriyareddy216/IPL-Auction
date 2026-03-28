# 🏏 IPL Auction 2025 - Multi-Room Engine

A high-performance, real-time multiplayer auction engine designed for immersive IPL simulation. This application supports multiple isolated auction rooms, automated player transitions, and strict squad constraint enforcement.

---

## 🚀 Quick Start (Local Machine)

### 1. Prerequisites
Ensure you have **Node.js** (v18+) and **npm** installed on your Mac.

### 2. Start the Backend
The backend manages the auction state, bidding logic, and the player database (using an in-memory MongoDB).

```zsh
cd backend
npm install
node server.js
```
*The server will start on [http://localhost:5001](http://localhost:5001). Connects to a pristine CSV player catalog on every boot.*

### 3. Start the Frontend
The frontend provides the real-time dashboard for bidders and hosts.

```zsh
cd frontend
npm install
npm run dev
```
*The dashboard will be available at [http://localhost:5173](http://localhost:5173).*

---

## 🛠️ Key features

- **Multi-Room Support:** Create or join isolated lobbies using unique Room Codes.
- **Automated Flow:** 5-second auto-advance to the next player after every sale/unsold event.
- **Real-time Bidding:** Instant updates across all clients using WebSockets (Socket.io).
- **Squad Constraints:** Hardcoded enforcement of IPL rules:
  - Maximum 25 players per squad.
  - Maximum 8 overseas players per squad.
  - Automatic budget validation (no bidding beyond purse limit).
- **Live Activity Logs & Chat:** Track every bid and communicate with other managers in the room.

---

## 📁 Project Structure

```text
ipl_auction/
├── backend/
│   ├── models/        # Database schemas (Player, User)
│   ├── routes/        # Auth APIs
│   ├── server.js      # Core Engine & WebSocket logic
│   ├── seed.js        # CSV Importer logic
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/     # AuctionRoom, Login, Dashboard
│   │   ├── context/   # Auth state management
│   │   └── App.jsx    # Routing
│   └── package.json
└── ipl_2025_auction_players.csv  # 600+ Player Catalog
```

---

## 📝 Usage for Hosts
- The first user to create a room is designated the **Host**.
- Hosts can:
  - **Start/Pause** the auction.
  - **Force Skip** to the next player.
  - **Terminate** the session.
