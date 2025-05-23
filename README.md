# TD10 - Trading Signal Generator & Live Chart

TD10 is a single-user web application designed as a personal TradingView alternative. It allows users to build, train, and deploy machine learning-based trading indicators, generating real-time signals displayed on interactive charts.

This project follows the structure outlined in the `designdoc.txt`.

## Project Structure

- `backend/`: Node.js/Express application handling API requests, database interactions, and ML script orchestration.
- `frontend/`: Vanilla JavaScript client application using Vite (structure setup manually for now) and Bootstrap 5 for the user interface.
- `designdoc.txt`: The master design document outlining features, architecture, and phases.
- `README.md`: This file.

## Prerequisites

- Node.js and npm (or yarn)
- Python 3.x
- MongoDB (local instance or MongoDB Atlas connection string)
- A FinancialModelingPrep (FMP) API Key (for real financial data - required for full functionality)

## Environment Variables

Configuration is managed via environment variables. Create a `.env` file in the `backend/` directory based on the `backend/.env.example` file.

**Required Backend Variables (`backend/.env`):**

- `MONGODB_URI`: Your MongoDB connection string.
- `JWT_SECRET`: A secret string for signing JSON Web Tokens.
- `JWT_EXPIRES_IN`: Token expiration time (e.g., `1h`, `1d`).
- `FMP_API_KEY`: Your API key from FinancialModelingPrep.
- `PORT`: (Optional) Port for the backend server (defaults to 5000).
- `NODE_ENV`: (Optional) Set to `production` or `development`.
- `VITE_API_URL`: The full URL where the backend API is running (used by backend sometimes, critical for frontend). Should match the backend host and port (e.g., `http://localhost:5000`).

**Frontend Configuration:**

- The frontend JavaScript files (`login.js`, `dashboard.js`, `chart.js`) currently hardcode the `API_BASE_URL` to `http://localhost:5000`. In a Vite build setup, this would typically use `import.meta.env.VITE_API_URL`. For deployment (e.g., Netlify), you would set the `VITE_API_URL` environment variable in the build settings to point to your deployed backend API URL.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd TD10
    ```

2.  **Install Backend Dependencies:**
    ```bash
    cd backend
    npm install
    cd .. 
    ```

3.  **Install Python Dependencies (if any needed later):**
    *(No specific Python libraries required for the current placeholder scripts)*
    ```bash
    # cd backend/ml
    # pip install -r requirements.txt # (Create requirements.txt when needed)
    # cd ../..
    ```

4.  **Set up Environment Variables:**
    - Create a `.env` file inside the `backend` directory.
    - Copy the contents from `backend/.env.example` into `backend/.env`.
    - Fill in the actual values for `MONGODB_URI`, `JWT_SECRET`, `FMP_API_KEY`, and `VITE_API_URL`.

## Running the Application

1.  **Run the Backend Server:**
    ```bash
    cd backend
    npm start 
    # Or for development with nodemon (if installed: npm i -D nodemon):
    # npm run dev # (Add "dev": "nodemon server.js" to package.json scripts)
    ```
    The backend API should now be running (typically at `http://localhost:5000` or the `VITE_API_URL`/`PORT` you set).

2.  **Run the Frontend:**
    - Since this is a vanilla JS setup without a build step currently, you need a simple HTTP server to serve the `frontend` directory.
    - **Option A (Using `npx`):**
        ```bash
        cd frontend
        npx serve . 
        ```
        This will usually serve the files on `http://localhost:3000` or another available port.
    - **Option B (Using Python):**
        ```bash
        cd frontend
        python -m http.server 8080 # Or any port you prefer
        ```
        Access the frontend via `http://localhost:8080`.
    - **Option C (Using VS Code Live Server):**
        If using VS Code, install the "Live Server" extension and open `frontend/index.html`, then click "Go Live".

    Open your browser to the URL provided by your chosen frontend serving method (e.g., `http://localhost:3000`, `http://localhost:8080`).

## Deployment

- **Backend (Render):**
    - Connect your Git repository to Render.
    - Create a new "Web Service".
    - Set the Build Command to `npm install`.
    - Set the Start Command to `npm start`.
    - Add all required environment variables (from your `.env` file) in the Render service settings.
    - Ensure the `VITE_API_URL` env var on Render matches the service's public URL.

- **Frontend (Netlify):**
    - Connect your Git repository to Netlify.
    - Configure the build settings:
        - Base directory: `frontend` (or `/` if repo root is frontend)
        - Build command: `npm install && npm run build` (if using Vite build) OR leave empty if serving static files directly.
        - Publish directory: `dist` (if using Vite build) OR `frontend` if serving directly.
    - Add the `VITE_API_URL` environment variable in Netlify's build settings, pointing to your *deployed* Render backend URL.

*(Note: The current frontend setup does not use a build step. For Netlify, you might just deploy the `frontend` folder directly as a static site, ensuring the `API_BASE_URL` in the JS points correctly or is configured via environment variables if you add a build process later).* 
