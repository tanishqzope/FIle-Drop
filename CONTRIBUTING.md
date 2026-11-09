# Contributing to FileDrop

Thank you for your interest in contributing to FileDrop! We welcome contributions, bug reports, and suggestions.

---

## Getting Started

1. **Fork the Repository**:
   Fork [https://github.com/tanishqzope/FIle-Drop](https://github.com/tanishqzope/FIle-Drop) to your GitHub account.

2. **Clone your fork**:
   ```bash
   git clone https://github.com/<your-username>/FIle-Drop.git
   cd FIle-Drop
   ```

3. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Workflow

### Backend (FastAPI)
1. Set up your Python virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
2. Run backend tests before submitting changes:
   ```bash
   python test_server.py
   ```

### Frontend (React 19)
1. Install dependencies:
   ```bash
   cd frontend
   npx yarn install # or: npm install --legacy-peer-deps
   ```
2. Test production build:
   ```bash
   npm run build
   ```

---

## Pull Request Guidelines

- Ensure all existing unit tests in `backend/test_server.py` pass.
- Verify that `npm run build` succeeds without syntax or bundling errors.
- Write clear, concise commit messages.
- Open a Pull Request against the `main` branch with a description of your changes.
