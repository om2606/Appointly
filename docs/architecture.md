
flowchart TD
    A["Frontend<br/>HTML, CSS, JavaScript"] <-->|"HTTP requests / responses"| B["FastAPI Backend"]
    B <--> C[("SQLite Database")]
    D["n8n Schedule Trigger"] --> E["Fetch booked appointments"]
    E -->|"GET /appointments/booked"| B
    E --> F{"Reminder due?"}
    F -->|"Yes"| G["Telegram Bot"]
    G --> H["Send appointment reminder"]
    G --> I["Mark reminder as sent"]
    I -->|"PATCH reminder-sent"| B
