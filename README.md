# 🛡️ FileDrop — Zero-Trust Secure File Sharing

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Async%20Motor-47A248.svg?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**FileDrop** is a modern, zero-trust file-sharing platform designed with end-to-end, client-side encryption. Files are encrypted directly in the user's browser before transmission to the server. The server never has access to the plaintext file or the decryption password.

---

## 🌟 Key Features

- 🔐 **Zero-Knowledge Client-Side Encryption**:
  - Files are encrypted in the browser using **AES-256-GCM** via the standard Web Crypto API (`window.crypto.subtle`).
  - The symmetric AES key is encrypted using a password-derived key (**PBKDF2** with 100,000 iterations and salt).
  - Encrypted files and keys are securely transmitted; only recipients with the correct password can decrypt them.
- ⏱️ **Flexible Expiration & Limits**:
  - Configure link expiration (hours/days).
  - Set maximum download limits with auto-revocation when exceeded.
- 📱 **Mobile & Desktop Optimized**:
  - QR Code generation for instant mobile transfers.
  - Multi-method mobile fallback download support.
- 🔍 **Interactive In-Browser File Previews**:
  - Secure preview modal for images, text, PDFs, and office documents before or after download.
- 🛡️ **Two-Factor Authentication (2FA)**:
  - Supports standard TOTP Authenticator apps (Google Authenticator, Authy) with QR code setup.
  - SMS 2FA simulation for multi-channel verification.
- 📊 **Analytics Dashboard**:
  - Storage consumption tracking, total downloads, active shares, file-type distributions, and 7-day activity graphs.
- 📜 **Audit & Compliance Logging**:
  - Tracks timestamped events (upload, download, authentication, 2FA changes) with IP and user-agent metadata.

---

## 🏗️ Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────┐
   │                   React 19 Frontend                     │
   │  Web Crypto API (AES-GCM + PBKDF2) | Tailwind | shadcn   │
   └───────────────────────────┬─────────────────────────────┘
                               │ HTTPS / JSON & Octet-Stream
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │                   FastAPI Backend                       │
   │    Async Motor (MongoDB) | PyJWT | Passlib | Uvicorn    │
   └───────────────┬─────────────────────────┬───────────────┘
                   │                         │
                   ▼                         ▼
   ┌───────────────────────────┐ ┌───────────────────────────┐
   │      MongoDB Database     │ │   Encrypted File Store    │
   │  Users, Metadata, Audits  │ │      /backend/uploads     │
   └───────────────────────────┘ └───────────────────────────┘
```

### Technology Breakdown

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, CRACO, Tailwind CSS, Radix UI / shadcn/ui components, Lucide React, Sonner (Toasts), Axios, Web Crypto API |
| **Backend** | Python 3.10+, FastAPI, Starlette, Uvicorn, Motor (Async MongoDB), Pydantic v2, Python-Jose (JWT), Passlib (PBKDF2-SHA256), PyOTP, QRCode, Pillow |
| **Database** | MongoDB 6.0+ |

---

## 📂 Project Structure

```
FileDrop/
├── backend/
│   ├── uploads/               # Encrypted file blob storage (raw files on disk)
│   ├── server.py              # FastAPI application & API endpoints
│   ├── requirements.txt       # Clean, cross-platform Python dependencies
│   ├── .env                   # Backend environment variables
│   └── .env.example           # Example backend configuration template
├── frontend/
│   ├── public/
│   │   ├── index.html         # Application shell & meta tags
│   │   └── manifest.json      # Web app manifest
│   ├── src/
│   │   ├── components/ui/     # Reusable shadcn/Radix UI components
│   │   ├── hooks/             # Custom React hooks (use-toast, etc.)
│   │   ├── lib/               # Utility functions (cn helper, etc.)
│   │   ├── App.js             # Core application, encryption logic, & router
│   │   ├── App.css            # Custom animations & theme styles
│   │   └── index.js           # React DOM root entrypoint
│   ├── craco.config.js        # CRACO Webpack alias & hot-reload configuration
│   ├── package.json           # Frontend dependencies & scripts
│   ├── tailwind.config.js     # Tailwind CSS theme configuration
│   ├── .env                   # Frontend environment variables
│   └── .env.example           # Example frontend configuration template
├── .gitignore                 # Root gitignore for Python, Node, and secrets
└── README.md                  # Project documentation (this file)
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:
- **Git**
- **Node.js** (v18.0.0 or higher) and **npm** or **yarn**
- **Python** (v3.10 to v3.14)
- **MongoDB** running locally or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster connection string

---

### Step 0: Clone the Repository

```bash
git clone https://github.com/tanishqzope/FIle-Drop.git
cd FIle-Drop
```

---

### 🐳 One-Command Startup (Docker Compose)

If you have Docker installed, you can start the complete stack (MongoDB + FastAPI + React) in one command:

```bash
docker compose up --build
```

- **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8000/api/](http://localhost:8000/api/)
- **Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Manual Setup (Step-by-Step)

### Step 1: Start MongoDB

#### Option A: Local MongoDB Service
If MongoDB is installed locally on your system, start the MongoDB service:
```powershell
# Windows
net start MongoDB
```

#### Option B: Docker
```bash
docker run -d -p 27017:27017 --name filedrop-mongo mongo:latest
```

#### Option C: MongoDB Atlas (Cloud)
If using MongoDB Atlas, copy your connection string (e.g., `mongodb+srv://<user>:<password>@cluster.mongodb.net/filedrop?retryWrites=true&w=majority`) and set it as `MONGO_URL` in `backend/.env`.

---

### Step 2: Setup & Run the Backend

1. **Navigate to the backend directory**:
   ```powershell
   cd backend
   ```

2. **Create and activate a virtual environment**:
   ```powershell
   # Windows PowerShell
   python -m venv .venv
   .venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Ensure `backend/.env` is configured (copy from `backend/.env.example` if needed):
   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=filedrop
   CORS_ORIGINS=*
   SECRET_KEY=filedrop-super-secure-key-change-in-production
   PORT=8000
   HOST=0.0.0.0
   ```

5. **Start the backend server**:
   ```powershell
   python server.py
   # Or directly using uvicorn:
   uvicorn server:app --host 127.0.0.1 --port 8000 --reload
   ```

   The API will be available at:
   - **API Root**: [http://localhost:8000/api/](http://localhost:8000/api/)
   - **Interactive API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### Step 3: Setup & Run the Frontend

1. **Open a new terminal and navigate to the frontend directory**:
   ```powershell
   cd frontend
   ```

2. **Install frontend dependencies**:
   ```powershell
   # Using yarn (recommended, lockfile present)
   npx yarn install

   # Or using npm with legacy peer dependencies
   npm install --legacy-peer-deps
   ```

3. **Configure environment variables**:
   Verify `frontend/.env` points to the backend:
   ```env
   REACT_APP_BACKEND_URL=http://localhost:8000
   ```

4. **Start the development server**:
   ```powershell
   # Using yarn
   npx yarn start

   # Or using npm
   npm start
   ```

5. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Server health check | No |
| `GET` | `/api/` | API status check | No |
| `POST` | `/api/auth/register` | Register new user account | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | No |
| `POST` | `/api/auth/2fa/setup` | Generate TOTP QR code or SMS setup | Bearer JWT |
| `POST` | `/api/auth/2fa/verify` | Verify & activate 2FA | Bearer JWT |
| `POST` | `/api/auth/2fa/login` | Complete login with 2FA code | Temporary JWT |
| `POST` | `/api/auth/2fa/disable` | Disable 2FA on account | Bearer JWT |
| `POST` | `/api/files/upload` | Upload encrypted file blob & metadata | Bearer JWT |
| `GET` | `/api/files/share/{link}` | Retrieve file metadata without downloading | No |
| `GET` | `/api/files/download/{link}` | Increment count & get encrypted key blob | No |
| `GET` | `/api/files/raw/{link}` | Stream encrypted binary file | No |
| `GET` | `/api/files/my-files` | Retrieve all files uploaded by user | Bearer JWT |
| `GET` | `/api/analytics/dashboard` | Get dashboard stats & 7-day activity | Bearer JWT |
| `GET` | `/api/analytics/admin` | Get global platform statistics | Bearer JWT |
| `GET` | `/api/audit-logs` | Retrieve user audit trail for compliance | Bearer JWT |

---

## 🛠️ Summary of Changes & Fixes Applied

During analysis of the codebase, several critical issues were identified and resolved to ensure full functionality:

1. **Cross-Platform Storage Path**:
   - *Problem*: `server.py` had `UPLOAD_DIR = Path("/app/backend/uploads")` hardcoded from a Linux Docker container, causing a fatal `FileNotFoundError: [WinError 3]` crash on Windows startup.
   - *Fix*: Updated to `Path(os.environ.get("UPLOAD_DIR", ROOT_DIR / "uploads"))` with `parents=True`, ensuring cross-platform compatibility on Windows, macOS, and Linux.

2. **Clean Dependencies & Build Environment**:
   - *Problem*: `requirements.txt` contained pinned Linux-specific packages such as `jq==1.10.0` (which fails building C extensions on Windows) and unused packages (`s5cmd`, `boto3`).
   - *Fix*: Replaced `requirements.txt` with a clean, fully tested requirement specification that installs cleanly on Python 3.10+.

3. **Backend Startup Entrypoint**:
   - *Problem*: Running `python server.py` exited immediately because no `if __name__ == "__main__":` block was present.
   - *Fix*: Added standard entrypoint running Uvicorn with environment-configurable port and host.

4. **Audit Logs Serialization Fix**:
   - *Problem*: `/api/audit-logs` returned raw MongoDB documents containing BSON `ObjectId` and `datetime` types, causing a FastAPI JSON serialization error (HTTP 500).
   - *Fix*: Added field normalization converting `_id` to string and datetimes to ISO format.

5. **Localhost API Route Resolution**:
   - *Problem*: `frontend/.env` had an external sandbox URL (`REACT_APP_BACKEND_URL=https://shareguard.preview.emergentagent.com`) and `WDS_SOCKET_PORT=443`. If the preview URL was offline, all API requests failed.
   - *Fix*: Updated `frontend/.env` to `http://localhost:8000`, added default fallback in `App.js`, and created `.env.example` templates.

6. **URL Parsing Resilience**:
   - *Problem*: In `FileDownload`, `window.location.pathname.split('/').pop()` returned an empty string if URLs contained trailing slashes (`/share/:link/`).
   - *Fix*: Integrated `useParams()` from `react-router-dom` with fallback filtering.

7. **Missing/Empty Static Assets**:
   - *Problem*: `manifest.json` and `components.json` were 0 bytes, triggering JSON parse warnings.
   - *Fix*: Created a valid Web App Manifest and shadcn UI component configuration.

8. **HTML Syntax Fix**:
   - *Problem*: `index.html` contained a dangling closing `</a>` tag.
   - *Fix*: Removed the mismatched tag.

---

## 🔒 Security Best Practices

- **Production Secret Key**: Always update `SECRET_KEY` in `backend/.env` with a strong random string before deploying (`openssl rand -hex 32`).
- **HTTPS Enforcement**: Always deploy behind HTTPS / TLS in production so that Web Crypto API, passwords, and tokens are protected in transit.
- **File Expiration & Shredding**: Regularly clean expired files from `backend/uploads/` using a scheduled cron job or lifecycle policy.

---

## 📄 License

This project is licensed under the MIT License.

