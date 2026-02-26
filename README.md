# Cortaku Homepage

A highly customized, self-hosted personal dashboard built with modern web technologies. Designed to serve as a beautiful landing page for homelab services, complete with interactive UI elements, Easter eggs, and a hidden mini-game.

## ✨ Features

* **Modern Stack:** Built with Next.js 15, React, and Tailwind CSS v4.
* **App Dashboard:** Quick access cards to self-hosted services (Plex, Mealie, Fitness) featuring smooth 3D tilt hover effects and custom backdrop styling.
* **Custom Theming:** A soft pastel color palette with seamless Dark/Light mode switching.
* **Immersive UI:**
  * Floating cherry blossom particle animations.
  * Satisfying on-click particle effects.
  * Interactive background elements and hidden character animations.
* **Hidden Arcade:** A fully playable, zero-dependency HTML5 Canvas "Jump Game" embedded directly into the homepage.
* **Global Leaderboard:** High scores are permanently saved using Next.js Server Actions and a PostgreSQL database, complete with built-in IP rate-limiting to prevent spam.
* **Containerized:** Ready to deploy anywhere with optimized Docker and Docker Compose configurations.

## 🚀 Tech Stack

* **Framework:** Next.js 15 (App Router)
* **Styling:** Tailwind CSS v4
* **Database:** PostgreSQL (via `pg` driver)
* **Deployment:** Docker & Docker Compose

## 🛠️ Getting Started

### Prerequisites
* Docker and Docker Compose installed on your host machine.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Cortaku/Cortaku-Homepage.git
   cd Cortaku-Homepage

2. **Configure your environment:**
Create a .env.local file in the root directory and add your Postgres connection string:
    ```bash
    # Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME
    DATABASE_URL="postgresql://user:yourpassword@master_db:5432/cortaku_db"

3. **Initialize the Database:**
Ensure your PostgreSQL instance is running, then execute this SQL command to create the leaderboard table:
    ```sql
    SQL
    CREATE TABLE IF NOT EXISTS high_scores (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(50) DEFAULT 'Anonymous',
      score INTEGER NOT NULL,
      ip_address VARCHAR(45),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

4. **Run with Docker:**

    ```bash
    docker-compose up -d --build
The homepage will be accessible at http://localhost:3000

## 🎮 The Jump Game
Cortaku includes a high-performance hidden mini-game! Once discovered, players can dodge obstacles, compete for the highest score, and submit their names to the global leaderboard.

To ensure a buttery-smooth 60fps gaming experience, the game's physics and rendering loops run purely on the HTML5 Canvas API, intentionally detached from React's standard rendering cycle.

## 📝 License
This project is open-source and available for personal use and modification.
