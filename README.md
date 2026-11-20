# 🛡️ Safe Route – Smart and Secure Navigation System

**Safe Route** is a web-based navigation application designed to help users find routes, view nearby emergency facilities, and manage their travel history.

## 🌟 Features

- **Interactive Map:** Explore locations using an interactive map.
- **Location Search:** Search for places and destinations.
- **Route Calculation:** Calculate driving routes between locations.
- **Current Location:** Access your current location with browser permission.
- **Voice Search:** Search for locations using voice input where supported.
- **Nearby Emergency Facilities:** View nearby hospitals and police stations.
- **Route History:** Save and view previously searched routes.
- **Clear History:** Delete saved route history.
- **Dark Mode:** Switch between light and dark themes.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| Flask | Web application framework |
| HTML | Web page structure |
| CSS | Styling and design |
| JavaScript | Frontend functionality |
| Supabase | Cloud database |
| Leaflet | Interactive maps |
| OpenStreetMap | Map data |
| OSRM | Route calculation |
| Overpass API | Nearby facility data |
| Vercel | Application deployment |

## 📁 Project Structure

```text
safe-route/
│
├── app.py
├── requirements.txt
├── .gitignore
│
├── templates/
│   └── index.html
│
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── script.js
│
└── database/
```

## ⚙️ Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/dilipreddy2/safe-route.git
```

### 2. Open the project folder

```bash
cd safe-route
```

### 3. Create a virtual environment

```bash
python -m venv .venv
```

### 4. Activate the virtual environment

Windows:

```powershell
.venv\Scripts\activate
```

### 5. Install dependencies

```bash
pip install -r requirements.txt
