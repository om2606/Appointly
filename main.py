
from contextlib import asynccontextmanager
from datetime import date, time
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from database import create_table, get_connection
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_table()
    yield


app = FastAPI(
    title="Appointment Booking API",
    description="API for managing appointments",
    version="1.0.0",
    lifespan=lifespan,
)


# Allow frontend to connect to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Appointment data model
class Appointment(BaseModel):
    customer_name: str = Field(min_length=2)
    email: EmailStr
    provider_name: str = Field(min_length=2)
    appointment_date: date
    appointment_time: time
    duration_minutes: int = Field(gt=0)
    status: Literal["booked", "cancelled"] = "booked"

    @field_validator("appointment_date")
    @classmethod
    def validate_appointment_date(cls, value):
        if value < date.today():
            raise ValueError("Appointment date cannot be in the past")
        return value


# Home route
@app.get("/")
def home():
    return {
        "message": "Welcome to Appointly Appointment Booking API"
    }


# About route
@app.get("/about")
def about():
    return {
        "app": "Appointly",
        "description": "Appointment Booking API",
        "features": [
            "Create appointments",
            "View appointments",
            "Update appointments",
            "Cancel appointments",
            "Delete appointments",
            "Track reminder status",
        ],
    }


# Create a new appointment
@app.post("/appointments", status_code=201)
def create_appointment(appointment: Appointment):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO appointments (
                customer_name,
                email,
                provider_name,
                appointment_date,
                appointment_time,
                duration_minutes,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                appointment.customer_name,
                str(appointment.email),
                appointment.provider_name,
                appointment.appointment_date.isoformat(),
                appointment.appointment_time.isoformat(),
                appointment.duration_minutes,
                appointment.status,
            ),
        )

        appointment_id = cursor.lastrowid

        return {
            "message": "Appointment created successfully",
            "appointment_id": appointment_id,
        }


# Get all appointments
@app.get("/appointments")
def get_appointments():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM appointments ORDER BY id DESC"
        ).fetchall()

        return [dict(row) for row in rows]


# Get booked appointments
@app.get("/appointments/booked")
def get_booked_appointments():
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM appointments
            WHERE status = 'booked'
            ORDER BY appointment_date, appointment_time
            """
        ).fetchall()

        return {
            "appointments": [dict(row) for row in rows]
        }


# Mark an appointment reminder as sent
@app.patch("/appointments/{appointment_id}/reminder-sent")
def mark_reminder_sent(appointment_id: int):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE appointments
            SET reminder_sent = 1
            WHERE id = ?
            """,
            (appointment_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Appointment not found",
            )

        return {
            "message": "Reminder marked as sent",
            "appointment_id": appointment_id,
        }


# Get an appointment by ID
@app.get("/appointments/{appointment_id}")
def get_appointment(appointment_id: int):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM appointments WHERE id = ?",
            (appointment_id,),
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Appointment not found",
            )

        return dict(row)


# Cancel an appointment
@app.patch("/appointments/{appointment_id}/cancel")
def cancel_appointment(appointment_id: int):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE appointments
            SET status = 'cancelled'
            WHERE id = ?
            """,
            (appointment_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Appointment not found",
            )

        return {
            "message": "Appointment cancelled successfully",
            "appointment_id": appointment_id,
        }


# Update an appointment
@app.put("/appointments/{appointment_id}")
def update_appointment(
    appointment_id: int,
    appointment: Appointment,
):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE appointments
            SET customer_name = ?,
                email = ?,
                provider_name = ?,
                appointment_date = ?,
                appointment_time = ?,
                duration_minutes = ?,
                status = ?
            WHERE id = ?
            """,
            (
                appointment.customer_name,
                str(appointment.email),
                appointment.provider_name,
                appointment.appointment_date.isoformat(),
                appointment.appointment_time.isoformat(),
                appointment.duration_minutes,
                appointment.status,
                appointment_id,
            ),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Appointment not found",
            )

        return {
            "message": "Appointment updated successfully",
            "appointment_id": appointment_id,
        }


# Delete an appointment
@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int):
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM appointments WHERE id = ?",
            (appointment_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Appointment not found",
            )

        return {
            "message": "Appointment deleted successfully",
            "appointment_id": appointment_id,
        }
