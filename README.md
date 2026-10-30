# Appointly — Appointment Booking & Reminder System

Appointly is an appointment booking application built with **FastAPI, SQLite, HTML, CSS, JavaScript, n8n, and Telegram**. It allows users to manage appointments and automates appointment reminders through Telegram.

## Features

- Create new appointments
- View and manage booked appointments
- Update appointment details
- Cancel or delete appointments
- Store appointment information in an SQLite database
- Validate appointment details and prevent past-date bookings
- Automate appointment reminders using n8n
- Send reminder notifications through Telegram
- Track reminder status to help prevent duplicate notifications

## Technologies Used

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| FastAPI | REST API development |
| SQLite | Database storage |
| HTML, CSS, JavaScript | Frontend |
| n8n | Workflow automation |
| Telegram Bot API | Reminder notifications |
| Uvicorn | ASGI server |

## Project Workflow

1. An appointment is created through the frontend.
2. FastAPI validates the appointment details.
3. Appointment information is stored in SQLite.
4. n8n periodically retrieves booked appointments.
5. The workflow checks appointment status, reminder timing, and reminder status.
6. Telegram sends the reminder when the appointment matches the configured time window.
7. The API updates the reminder status after successful notification delivery.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Root endpoint |
| GET | `/about` | About endpoint |
| POST | `/appointments` | Create an appointment |
| GET | `/appointments` | Retrieve appointments |
| GET | `/appointments/booked` | Retrieve booked appointments |
| GET | `/appointments/{appointment_id}` | Retrieve a specific appointment |
| PUT | `/appointments/{appointment_id}` | Update an appointment |
| PATCH | `/appointments/{appointment_id}/cancel` | Cancel an appointment |
| PATCH | `/appointments/{appointment_id}/reminder-sent` | Mark a reminder as sent |
| DELETE | `/appointments/{appointment_id}` | Delete an appointment |

## Installation and Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd appointment-booking-api
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your actual repository URL.

### 2. Install dependencies

```bash
python -m pip install fastapi uvicorn
```

Install any additional dependencies required by your project.

### 3. Start the backend

```bash
python -m uvicorn main:app --reload
```

Backend URL: `http://127.0.0.1:8000`

Interactive API documentation: `http://127.0.0.1:8000/docs`

### Database Initialization

Appointly uses SQLite to store appointment records. The database file is named `appointments.db`.

When the FastAPI application starts, its lifespan function calls `create_table()` to create the required database tables automatically if they do not already exist. The application also adds the `reminder_sent` column to an existing appointments table when necessary.

No separate database server is required.

### 4. Start the frontend

Open another terminal:

```bash
cd frontend
python -m http.server 5500
```

Frontend URL: `http://127.0.0.1:5500`

### 5. Configure n8n and Telegram

n8n runs on your local computer.



1. The workflow retrieves booked appointments from FastAPI.
2. The Filter checks booking status, reminder status, and the 25–30 minute time window.
3. Telegram sends the reminder.
4. FastAPI marks the reminder as sent to help prevent duplicates.
5. Keep the backend and n8n running while using the local automation workflow.

## Database

Appointly uses SQLite to store appointment records, including customer information, provider details, appointment date and time, booking status, and reminder status.

## Future Improvements

- User authentication and authorization
- Email and SMS reminders
- Calendar integration
- Deployment to a cloud server
- Automated testing
- Improved logging and error handling

## Author

**Om Patel**

Built as a practical project to learn backend development, REST APIs, database management, and workflow automation.
