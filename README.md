# FriendFile

## Overview
FriendFile is a lightweight, single-page application (SPA) for managing contacts, built with Flask and HTML/CSS/JS. It offers a responsive UI, RESTful API, and manual URL path navigation, making it a solid foundation for personal or small-team contact management.

## Tech stack

### Frontend

- HTML: Provides the structure for the UI interface.
  - Used to define the contact list, forms, and modals.
- CSS: Styles the app with custom styles and Materialize Web for a modern, consistent look.
  - Used to style adaptive and responsive layout.
- JS: Manages interactivity, navigation, and API integration.
  - Implemented features like async/await and DOM manipulation.

### Backend

- Python (Flask): Powers the server-side logic and API with a lightweight framework. 
  - Used with Blueprints for modular routing and request handling.
- SQLite: Stores contact data in a simple database.
  - Managed in Flask app with schema creation and parameterized queries.

## Features

### General 
- CRUD Operations: Create, read, update, and delete contacts with a RESTful API.
  - Achieved via SQLite CRUD, Flask routes and JS Fetch.
- Search: Filter contacts by name with real-time results.
  - Implemented querying the API’s query param.

### Frontend
- Responsive Design: Adapts UI for compact, medium and large screens.
  - Achieved with CSS Flex, media queries and JS dynamic DOM manipulation.
- Smooth UX: Intuitive and predictable workflows.
  - Added loading bar, confirmation dialogs and dirty form management.
- Light and Dark Themes: Supports theme switching for user preference.
  - Enabled via Materialize Web.
- Dynamic Page Title: Updates browser title based on view mode.
  - Managed with JS, triggered by navigation and view changes.
- Optimized API Requests: Efficient, cancellable requests with loading feedback.
  - Designed to limit API requests to optimize API usage and improve UX on slow connections.
- URL Path Navigation: Manual URL paths for bookmarking and navigation.
  - Handled with JS using History API.
- Optimized Accessibility: ARIA attributes and keyboard navigation to enhance usability.
  - Used ARIA attributes and listeners on HTML and JS.

### Backend
- Client and Backend Path Mapping: Consistent URL prefixes for client and API.
  - Set via env variables on backend for flexibility and dynamically injected to client for consistency.
- Data Validation and Sanitization: Ensures clean, valid input data.
  - Enforced using Regex, SQLite interface and custom validation functions.
- Structured Response: JSON responses with status, data, and metadata.
  - Returned by API routes on server API.
- Logging and Error Handling: Custom error codes and logging.
  - Managed with JSON error responses and RotatingFileHandler for logs.
- Containerized: Docker-ready for consistent deployment.
  - Defined in Dockerfile with Python slim, selective file copying, and /data volume.

## Final Note
Creating this app has been a short but amazing journey. Starting with a simple Flask backend and SQLite, it evolved into a fully functional SPA with a responsive UI and robust features (and all using vanilla HTML/CSS/JS!). This project showcases the power of combining Python’s simplicity with JavaScript’s interactivity in a compact, deployable package.
