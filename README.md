# 📡 BigQuery Release Radar

An elegant, premium developer dashboard web application that fetches, aggregates, and organizes release notes from the official Google Cloud BigQuery RSS feed. It enables developer teams to track updates in real-time, filter announcements by category, and easily share specific updates to X (formerly Twitter) using an interactive custom-built Tweet Composer.

---

## 🚀 Key Features

* **Real-time Atom Feed Ingestion**: Connects directly to Google Cloud's official BigQuery feeds, parsing complex nested XML structures into user-friendly layouts.
* **Smart Category Classification**: Evaluates heading and content tokens dynamically, mapping updates into four main categories:
  * 🟢 **Features**: New capabilities, APIs, and product rollouts.
  * 🟣 **Changes**: Optimizations, behavior updates, and configuration adjustments.
  * 🟡 **Deprecations**: End-of-life notices for legacy syntaxes.
  * 🔴 **Fixes**: Service patches, resolutions for known issues, and regressions.
* **Interactive Update Rows**: Allows hovering over any specific bullet point or paragraph to highlight it and reveal a floating share trigger.
* **X/Twitter Intent Modal**: Features a custom-designed Tweet Composer with character validation (handles X.com 280 threshold limit, adjusting for dynamic link lengths) and quick hashtag pills.
* **Persisted Dark & Light Themes**: Sleek dark space-blue theme by default with a transition-smooth light mode toggle.
* **Fail-Safe Offline Mode**: Falls back automatically to local cached XML feed structures if network requests fail or run in firewalled environments.

---

## 📁 File Structure

```
bigquery-notes/
├── app.py                  # Flask application server (Routing & Ingestion API)
├── requirements.txt        # Backend dependencies
├── mock_feed.xml           # Local sample XML feed (Offline backup)
├── .gitignore              # Standard ignore directives for Git
├── templates/
│   └── index.html          # Semantic HTML dashboard template & modals
└── static/
    ├── css/
    │   └── style.css       # Layout styles & color variables (Dark/Light mode)
    └── js/
        └── main.js         # Client-side parsing engine & event handlers
```

---

## 🛠️ Installation & Setup

### Prerequisites
* Python 3.8 or higher installed on your system.

### Step 1: Clone or Navigate to the Folder
Navigate to the directory containing your project files:
```bash
cd C:\Users\mahalakshmi\OneDrive\Desktop\bigquery-notes
```

### Step 2: Install Dependencies
Install the required packages using pip:
```bash
pip install -r requirements.txt
```

### Step 3: Run the Application
Run the local Flask web server:
```bash
python app.py
```

### Step 4: Open in Web Browser
Open your browser and navigate to:
**[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📝 Usage Guide

1. **Dashboard Metrics**: Check the top card grid to view statistics regarding the distribution of Features vs. Fixes.
2. **Search and Filtering**: Use the search input to match query phrases (e.g. `Gemini` or `Iceberg`) or click category tags to isolate specific update types.
3. **Sharing Updates**: Hover your mouse over any specific update line inside a release card. Click the line (or click the floating Twitter/X icon on the right) to open the Tweet Composer. Modify your message, toggle your preferred hashtags, and click **Post to X** to publish!
4. **Theme Customization**: Toggle the Sun/Moon button on the top-right of the page to switch between light and dark modes.

---

## 📄 License
This project is open-source and available under the [MIT License](https://opensource.org/licenses/MIT).
