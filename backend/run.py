import uvicorn
if __name__ == "__main__":
    # reload=False required on Windows Store Python — subprocess spawner loses user-package paths
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
