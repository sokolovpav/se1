# Shared Shopping Lists

A lightweight web application for creating, managing, and sharing shopping lists with other users in real time. Built with React on the frontend and a modular Node.js on the backend, backed by a MySQL database.

## Description

Shared Shopping Lists is a collaborative tool that lets users organize their grocery and shopping needs in one place. Each user has a personal account and can create any number of lists, populate them with items, and invite other users to collaborate — either as editors who can fully manage items, or as viewers who can only check items off as purchased.

The application is designed to be simple and dependency-free on the client side: only HTML, CSS, and JavaScript served alongside a Node.js API without frameworks or builds.

## Features

- **User Authentication** - Register and log in with an email and password. Sessions are managed with JWTs stored in `localStorage`, valid for 7 days. Passwords are stored as bcrypt hashes.
- **List Management** - Create, rename, and delete your own shopping lists. Lists are displayed in a sidebar split between lists you own and lists shared with you.
- **Item Management** - Add items to a list with a name and quantity. Edit or delete items individually. Mark items as purchased with a checkbox; purchased items are visually distinguished from pending ones.
- **Collaboration & Sharing** - Share any of your lists with other registered users. Assign them either Editor access (can add, edit, and delete items) or Viewer access (can only toggle the purchased status). Revoke access at any time.
- **Permission System** - A tiered role model (Owner / Editor / Viewer) controls what each user can do within a shared list, enforced on both the frontend and the backend.

## Documentation

https://sokolovpav.github.io/se1/

The documentation includes User Guide, Development Documentation covering Frontend, Backend, Database and Development Environment, User Stories, Kernel Analysis, Feasibility Analysis, and Project Requirements.
 
## Getting Started

### Prerequisites
- Node.js v18+
- MySQL 8+

### Installation

```bash
# Clone the repository
git clone https://github.com/sokolovpav/se1.git
cd se1
cd back
 
# Install backend dependencies
npm install
 
# Configure environment variables
cp .env.example .env # Edit .env with your database credentials and JWT secret

# Set up the database
# 1. Create a new database (e.g., 'service_se1')
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS service_se1"

# 2. Import the database schema and structure
mysql -u root -p service_se1 < ../db/db.sql
 
# Start the server
npm run dev
```

Then, open `index.html` in your browser.

## Potential Future Development

The application is finished, but, should you decide to contribute to it, here are some things that might be nice to have eventually.

- **List Categories & Tags** - Allow users to organize lists by category (groceries, hardware, household) and filter or search across them.
- **Item Sorting & Reordering** - Drag-and-drop reordering of items within a list, and automatic grouping of purchased items at the bottom.
- **Notifications** - In-app notifications when a list is shared with a user or when a collaborator makes changes.
- **Mobile App Wrapper** - A PWA wrapper to allow the app to be installed on mobile devices and used offline with background sync.
- **Guest / Link Sharing** - Generate a shareable read-only or edit link for a list that does not require the recipient to have an account.
- **List Templates** - Save a list as a reusable template that can be re-instantiated with all items unchecked.
- **Dark Mode** - A toggleable dark color scheme, with the preference persisted in `localStorage`.
