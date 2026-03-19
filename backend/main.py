from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def students():
    return {"students": "student1"}